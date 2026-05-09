import os
import time
import asyncio
import uuid
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import yt_dlp
from pydantic import BaseModel
from typing import Dict, Any

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DOWNLOAD_DIR = os.path.join(os.path.dirname(__file__), "downloads")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

async def cleanup_old_files():
    while True:
        try:
            now = time.time()
            for filename in os.listdir(DOWNLOAD_DIR):
                file_path = os.path.join(DOWNLOAD_DIR, filename)
                if os.path.isfile(file_path):
                    # Remove files older than 1 hour
                    if os.stat(file_path).st_mtime < now - 3600:
                        os.remove(file_path)
        except Exception as e:
            print(f"Cleanup error: {e}")
        await asyncio.sleep(600)  # Check every 10 minutes

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(cleanup_old_files())

active_tasks: Dict[str, asyncio.Task] = {}
active_downloads_info: Dict[str, dict] = {}

class InfoRequest(BaseModel):
    url: str

@app.post("/api/info")
async def get_video_info(request: InfoRequest):
    ydl_opts = {
        'quiet': True,
        'skip_download': True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(request.url, download=False)
            return {
                "title": info.get("title", "Unknown"),
                "thumbnail": info.get("thumbnail"),
                "duration": info.get("duration", 0),
                "formats": [
                    {
                        "format_id": f.get("format_id"),
                        "ext": f.get("ext"),
                        "resolution": f.get("resolution", "audio only"),
                        "vcodec": f.get("vcodec"),
                        "acodec": f.get("acodec")
                    } for f in info.get("formats", [])
                ]
            }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.websocket("/api/ws/download")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    download_id = str(uuid.uuid4())
    
    try:
        data = await websocket.receive_json()
        url = data.get("url")
        format_type = data.get("format", "mp4")
        quality = data.get("quality", "1080p")
        
        ydl_opts = {
            'outtmpl': os.path.join(DOWNLOAD_DIR, f'{download_id}.%(ext)s'),
            'quiet': True,
            'no_warnings': True,
        }
        
        if format_type == "mp3":
            ydl_opts['format'] = 'bestaudio/best'
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }]
        else:
            if quality == "144p":
                ydl_opts['format'] = 'bestvideo[height<=144]+bestaudio/best'
            elif quality == "360p":
                ydl_opts['format'] = 'bestvideo[height<=360]+bestaudio/best'
            elif quality == "720p":
                ydl_opts['format'] = 'bestvideo[height<=720]+bestaudio/best'
            elif quality == "1080p":
                ydl_opts['format'] = 'bestvideo[height<=1080]+bestaudio/best'
            else:
                ydl_opts['format'] = 'bestvideo+bestaudio/best'
                
            ydl_opts['merge_output_format'] = 'mp4'

        def progress_hook(d):
            if d['status'] == 'downloading':
                progress_str = d.get('_percent_str', '0%').strip('\x1b[0;94m').strip('\x1b[0m').strip()
                speed_str = d.get('_speed_str', '0KiB/s').strip('\x1b[0;32m').strip('\x1b[0m').strip()
                eta_str = d.get('_eta_str', 'Unknown').strip('\x1b[0;33m').strip('\x1b[0m').strip()
                
                try:
                    progress_val = float(progress_str.replace('%', ''))
                except:
                    progress_val = 0
                
                msg = {
                    "status": "downloading",
                    "progress": progress_val,
                    "speed": speed_str,
                    "eta": eta_str
                }
                asyncio.run_coroutine_threadsafe(websocket.send_json(msg), asyncio.get_event_loop())

        ydl_opts['progress_hooks'] = [progress_hook]

        def download_sync():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                ext = 'mp3' if format_type == 'mp3' else 'mp4'
                return f"{download_id}.{ext}", info.get("title", "video")

        loop = asyncio.get_event_loop()
        task = loop.run_in_executor(None, download_sync)
        active_tasks[download_id] = task
        
        try:
            filename, title = await task
            await websocket.send_json({
                "status": "completed",
                "download_url": f"/api/files/{filename}",
                "title": title
            })
        except asyncio.CancelledError:
            await websocket.send_json({"status": "cancelled"})
        except Exception as e:
            await websocket.send_json({"status": "error", "message": str(e)})
            
    except WebSocketDisconnect:
        if download_id in active_tasks:
            active_tasks[download_id].cancel()
    finally:
        if download_id in active_tasks:
            del active_tasks[download_id]

@app.get("/api/files/{filename}")
async def get_file(filename: str):
    file_path = os.path.join(DOWNLOAD_DIR, filename)
    if os.path.exists(file_path):
        return FileResponse(path=file_path, filename=filename, media_type='application/octet-stream')
    raise HTTPException(status_code=404, detail="File not found")

@app.post("/api/cancel/{download_id}")
async def cancel_download(download_id: str):
    if download_id in active_tasks:
        active_tasks[download_id].cancel()
        return {"status": "cancelled"}
    return {"status": "not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
