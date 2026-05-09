"""
AnyDL — FastAPI Backend Entry Point

Architecture:
  main.py      → App bootstrap, middleware, route registration
  config.py    → Environment-based settings
  downloader.py → yt-dlp orchestration service
  validators.py → URL/filename validation & sanitization
"""
import asyncio
import logging
import time
import subprocess
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from config import (
    ALLOWED_ORIGINS, DOWNLOAD_DIR, FILE_TTL_SECONDS, CLEANUP_INTERVAL, RATE_LIMIT,
    COOKIE_FILE,
)
from validators import validate_youtube_url, sanitize_filename
from downloader import fetch_video_info, start_download

# ── Logging ────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("anydl")


# ── Cleanup background task ───────────────────────────────────────
async def _cleanup_loop():
    """Periodically remove expired download files."""
    while True:
        try:
            now = time.time()
            removed = 0
            for path in DOWNLOAD_DIR.iterdir():
                if path.is_file() and path.stat().st_mtime < now - FILE_TTL_SECONDS:
                    path.unlink(missing_ok=True)
                    removed += 1
            if removed:
                logger.info("Cleanup: removed %d expired file(s)", removed)
        except Exception:
            logger.exception("Cleanup sweep failed")
        await asyncio.sleep(CLEANUP_INTERVAL)


# ── App lifespan (replaces deprecated on_event) ───────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_cleanup_loop())
    logger.info("AnyDL backend started — cleanup task scheduled")
    logger.info("CORS allowed origins: %s", ALLOWED_ORIGINS)
    logger.info("Cookie file: %s", COOKIE_FILE or "NOT FOUND (unauthenticated mode)")
    yield
    task.cancel()
    logger.info("AnyDL backend shutting down")


# ── FastAPI app ────────────────────────────────────────────────────
app = FastAPI(
    title="AnyDL API",
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limiter
limiter = Limiter(key_func=get_remote_address, default_limits=[RATE_LIMIT])
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

@app.exception_handler(RateLimitExceeded)
async def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
    raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")

# CORS — uses explicit origins instead of wildcard
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ── Schemas ────────────────────────────────────────────────────────
class InfoRequest(BaseModel):
    url: str


# ── Routes ─────────────────────────────────────────────────────────
@app.get("/api/health")
async def health_check():
    """Health check endpoint for monitoring and load balancers."""
    return {"status": "ok"}


@app.get("/api/debug")
async def debug_ytdlp(url: str):
    """Run yt-dlp --list-formats to see exactly what Render sees."""
    cmd = [
        "yt-dlp",
        "--list-formats",
        "--remote-components", "ejs:github",
        "--extractor-args", "youtube:player_client=android,web"
    ]
    if COOKIE_FILE and COOKIE_FILE.exists():
        cmd.extend(["--cookies", str(COOKIE_FILE)])
    cmd.append(url)
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        cookie_size = COOKIE_FILE.stat().st_size if COOKIE_FILE and COOKIE_FILE.exists() else 0
        return {
            "cookie_file": str(COOKIE_FILE),
            "cookie_size_bytes": cookie_size,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode
        }
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/info")
@limiter.limit(RATE_LIMIT)
async def get_video_info(request: Request, body: InfoRequest):
    """Fetch video metadata (title, thumbnail, duration)."""
    try:
        url = validate_youtube_url(body.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        info = await fetch_video_info(url)
        return info
    except Exception as e:
        logger.warning("Info extraction failed for %s: %s", body.url, e)
        raise HTTPException(status_code=400, detail="Could not fetch video info. Check the URL and try again.")


@app.websocket("/api/ws/download")
async def websocket_download(websocket: WebSocket):
    """
    WebSocket-based download endpoint.

    Protocol:
      1. Client connects
      2. Client sends JSON: { url, format, quality }
      3. Server streams JSON progress: { status, progress, speed, eta }
      4. Server sends final: { status: "completed", download_url, title }
      5. Connection closes

    Cancellation: client closes the WebSocket → download aborts.
    """
    await websocket.accept()
    download_task = None

    try:
        data = await websocket.receive_json()

        # Validate inputs
        try:
            url = validate_youtube_url(data.get("url", ""))
        except ValueError as e:
            await websocket.send_json({"status": "error", "message": str(e)})
            await websocket.close()
            return

        format_type = data.get("format", "mp4")
        if format_type not in ("mp3", "mp4"):
            format_type = "mp4"

        quality = data.get("quality", "1080p")
        if quality not in ("144p", "360p", "720p", "1080p"):
            quality = "1080p"

        # Progress callback — sends updates over the WebSocket
        async def on_progress(msg: dict):
            try:
                await websocket.send_json(msg)
            except Exception:
                pass  # WebSocket may have closed

        logger.info("Download started: %s (%s %s)", url, format_type, quality)

        # Run the download
        download_task = asyncio.ensure_future(
            start_download(url, format_type, quality, on_progress)
        )
        filename, title = await download_task

        await websocket.send_json({
            "status": "completed",
            "download_url": f"/api/files/{filename}",
            "title": title,
        })
        logger.info("Download completed: %s → %s", title, filename)

    except asyncio.CancelledError:
        # Graceful cancellation — don't try to send on a closed socket
        logger.info("Download cancelled by client")
    except WebSocketDisconnect:
        logger.info("Client disconnected — aborting download")
        if download_task and not download_task.done():
            download_task.cancel()
    except Exception as e:
        logger.exception("Download failed: %s", e)
        try:
            await websocket.send_json({"status": "error", "message": str(e)})
        except Exception:
            pass  # Socket already gone
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


@app.get("/api/files/{filename}")
async def serve_file(filename: str):
    """
    Serve a completed download file.
    Sanitizes the filename to prevent path traversal attacks.
    """
    try:
        safe_name = sanitize_filename(filename)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid filename")

    file_path = DOWNLOAD_DIR / safe_name

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found or expired")

    # Double-check the resolved path is inside DOWNLOAD_DIR
    if not file_path.resolve().is_relative_to(DOWNLOAD_DIR.resolve()):
        raise HTTPException(status_code=403, detail="Access denied")

    return FileResponse(
        path=str(file_path),
        filename=safe_name,
        media_type="application/octet-stream",
    )


# ── Entry point ────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    from config import HOST, PORT

    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
