# AnyDL — Modern YouTube Downloader

A production-grade, full-stack YouTube downloader built with **React + Vite + TailwindCSS** and **FastAPI + yt-dlp**.

## ✨ Features

| Feature | Details |
|---------|---------|
| **Formats** | MP3 (audio) and MP4 (video) |
| **Quality** | 144p, 360p, 720p, 1080p |
| **Live Progress** | Real-time speed, ETA, and progress bar via WebSockets |
| **Drag & Drop** | Drop a YouTube URL anywhere on the page |
| **Auto-detect** | Paste a link and video info loads automatically (debounced) |
| **Dark/Light Mode** | System-aware with localStorage persistence |
| **PWA** | Installable on desktop and mobile, offline fallback |
| **Responsive** | Fully mobile-friendly layout |
| **Security** | URL whitelist, rate limiting, path traversal protection |
| **Docker** | One-command deployment with `docker compose up` |

## 📁 Project Structure

```
youtube-downloader/
├── backend/
│   ├── main.py            # FastAPI app + routes
│   ├── config.py           # Environment-based settings
│   ├── downloader.py       # yt-dlp download service
│   ├── validators.py       # URL & filename sanitization
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  # Root application
│   │   ├── main.tsx                 # Entry point + PWA registration
│   │   ├── index.css                # Global styles + design tokens
│   │   ├── lib/
│   │   │   ├── hooks.ts             # useDebounce, useTheme, constants
│   │   │   ├── types.ts             # TypeScript interfaces
│   │   │   └── utils.ts             # cn() utility
│   │   └── components/
│   │       ├── Navbar.tsx
│   │       ├── Footer.tsx
│   │       ├── VideoPreview.tsx      # + skeleton loader
│   │       └── DownloadCard.tsx      # Memoized + animated
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🚀 Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **FFmpeg** — must be installed and on your system PATH

### Installing FFmpeg
| OS | Command |
|----|---------|
| Windows | Download from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/), add `bin/` to PATH |
| macOS | `brew install ffmpeg` |
| Linux | `sudo apt install ffmpeg` |

## 🏃 Running Locally

### Backend

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
python main.py
```
Server starts at **http://localhost:8000**

### Frontend

```bash
cd frontend
npm install
npm run dev
```
App opens at **http://localhost:5173**

## 🐳 Docker

```bash
docker compose up --build
```
Frontend: **http://localhost:5173** · Backend: **http://localhost:8000**

## 🔧 Environment Variables

See `.env.example` for all available settings. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOWED_ORIGINS` | `http://localhost:5173` | CORS allowed origins (comma-separated) |
| `FILE_TTL_SECONDS` | `3600` | Auto-cleanup interval for downloaded files |
| `RATE_LIMIT` | `30/minute` | API rate limit per IP |
| `VITE_BACKEND_URL` | `http://localhost:8000` | Backend URL for frontend |
| `VITE_WS_URL` | `ws://localhost:8000/...` | WebSocket URL for frontend |

## 🔒 Security

- **URL Whitelist**: Only `youtube.com` and `youtu.be` domains are accepted
- **Rate Limiting**: Configurable per-IP rate limiting via `slowapi`
- **Path Traversal Protection**: Filename sanitization + resolved path validation
- **No Wildcard CORS**: Explicit origin whitelist
- **Input Validation**: All user input validated on server side

## 📦 Deployment

### Backend (Render / Railway / Docker)
Use the provided `Dockerfile` in `backend/`. The image includes FFmpeg.

```
Entry command: uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Frontend (Vercel / Netlify)
Set root directory to `frontend/`, build command to `npm run build`, output to `dist/`.
Set `VITE_BACKEND_URL` and `VITE_WS_URL` environment variables to your deployed backend.

### Full Stack (Docker Compose)
Use `docker compose up --build` for a single-command deployment of both services.
