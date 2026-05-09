"""
Download service — handles yt-dlp orchestration.
Runs blocking yt-dlp work in a thread pool and reports progress
back to the caller via a thread-safe callback.
"""
import asyncio
import logging
import re
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Callable

import yt_dlp

from config import DOWNLOAD_DIR, BASE_DIR, COOKIE_FILE

logger = logging.getLogger("anydl.downloader")

# Dedicated thread pool for downloads (avoid polluting the default executor)
_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="dl")

# ── ANSI escape stripper ───────────────────────────────────────────
_ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def _strip_ansi(s: str) -> str:
    """Remove ANSI color codes properly using regex instead of str.strip()."""
    return _ANSI_RE.sub("", s).strip()


# ── Quality → preferred resolution mapping ────────────────────────
_QUALITY_RES = {
    "144p": 144,
    "360p": 360,
    "720p": 720,
    "1080p": 1080,
}


def _build_ydl_opts(
    download_id: str,
    format_type: str,
    quality: str,
    progress_callback: Callable[[dict], None],
) -> dict:
    """Build yt-dlp option dict based on requested format and quality."""
    outtmpl = str(DOWNLOAD_DIR / f"{download_id}.%(ext)s")

    opts: dict = {
        "outtmpl": outtmpl,
        "quiet": True,
        "no_warnings": True,
        "noprogress": False,
        "progress_hooks": [progress_callback],
        # Prevent downloading excessively large files
        "max_filesize": 2 * 1024 * 1024 * 1024,  # 2 GB
    }

    if COOKIE_FILE:
        opts["cookiefile"] = str(COOKIE_FILE)

    if format_type == "mp3":
        # Use broad format string — never hard-fail
        opts["format"] = "bestaudio/best"
        opts["postprocessors"] = [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ]
    else:
        # Use "bestvideo+bestaudio/best" which ALWAYS succeeds, then use
        # format_sort to prefer the requested resolution without hard-failing.
        res = _QUALITY_RES.get(quality, 1080)
        opts["format"] = "bestvideo+bestaudio/best"
        opts["format_sort"] = [f"res:{res}", "ext:mp4:m4a"]
        opts["merge_output_format"] = "mp4"

    return opts


def _make_progress_hook(
    loop: asyncio.AbstractEventLoop,
    callback: Callable[[dict], None],
) -> Callable[[dict], None]:
    """
    Create a yt-dlp progress hook that dispatches to the asyncio loop.

    CRITICAL FIX: We capture the event loop reference *before* entering the
    thread. Inside the thread, `asyncio.get_event_loop()` returns the wrong
    loop (or raises). We must use `run_coroutine_threadsafe(coro, loop)`.
    """

    def hook(d: dict) -> None:
        if d["status"] == "downloading":
            # Use raw numeric fields when available (far more reliable than
            # parsing the pretty-printed strings which contain ANSI codes)
            downloaded = d.get("downloaded_bytes", 0)
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            speed = d.get("speed") or 0  # bytes/sec
            eta = d.get("eta")  # seconds

            if total > 0:
                progress = round((downloaded / total) * 100, 1)
            else:
                # Fallback: parse the formatted string
                raw = _strip_ansi(d.get("_percent_str", "0%"))
                try:
                    progress = float(raw.replace("%", ""))
                except ValueError:
                    progress = 0.0

            # Format speed nicely
            if speed > 0:
                if speed >= 1_048_576:
                    speed_str = f"{speed / 1_048_576:.1f} MiB/s"
                else:
                    speed_str = f"{speed / 1024:.0f} KiB/s"
            else:
                speed_str = _strip_ansi(d.get("_speed_str", "— KiB/s"))

            # Format ETA
            if eta is not None:
                mins, secs = divmod(int(eta), 60)
                eta_str = f"{mins}:{secs:02d}" if mins else f"{secs}s"
            else:
                eta_str = _strip_ansi(d.get("_eta_str", "—"))

            msg = {
                "status": "downloading",
                "progress": progress,
                "speed": speed_str,
                "eta": eta_str,
            }
            # Thread-safe dispatch to the event loop
            asyncio.run_coroutine_threadsafe(callback(msg), loop)

    return hook


async def fetch_video_info(url: str) -> dict:
    """
    Fetch video metadata without downloading.
    Runs in executor to avoid blocking the event loop.
    """
    ydl_opts = {"quiet": True, "skip_download": True, "no_warnings": True}
    
    if COOKIE_FILE:
        ydl_opts["cookiefile"] = str(COOKIE_FILE)

    def _extract():
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            return ydl.extract_info(url, download=False)

    loop = asyncio.get_running_loop()
    info = await loop.run_in_executor(_executor, _extract)

    return {
        "title": info.get("title", "Unknown"),
        "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration", 0),
        "channel": info.get("channel", ""),
    }


async def start_download(
    url: str,
    format_type: str,
    quality: str,
    on_progress: Callable,
) -> tuple[str, str]:
    """
    Start a download and return (filename, title) when done.

    CRITICAL FIX: Capture the running loop *here* (in the coroutine context)
    and pass it into the progress hook, instead of calling
    `asyncio.get_event_loop()` from inside the worker thread.
    """
    download_id = str(uuid.uuid4())
    loop = asyncio.get_running_loop()

    hook = _make_progress_hook(loop, on_progress)
    opts = _build_ydl_opts(download_id, format_type, quality, hook)

    def _download() -> tuple[str, str]:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            ext = "mp3" if format_type == "mp3" else "mp4"
            return f"{download_id}.{ext}", info.get("title", "video")

    filename, title = await loop.run_in_executor(_executor, _download)

    # Verify the file actually exists (yt-dlp post-processors may rename)
    expected = DOWNLOAD_DIR / filename
    if not expected.exists():
        # Search for any file with our download_id prefix
        candidates = list(DOWNLOAD_DIR.glob(f"{download_id}.*"))
        if candidates:
            filename = candidates[0].name
        else:
            raise FileNotFoundError(f"Download completed but file not found: {filename}")

    return filename, title
