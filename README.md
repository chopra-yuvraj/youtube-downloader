# AnyDL - Modern YouTube Downloader

A full-stack, modern YouTube downloader built with React, Vite, TailwindCSS, and FastAPI.

## Features

- 🎵 Download MP3 and MP4 formats
- 📺 Multiple quality options (144p to 1080p)
- 🚀 Real-time download progress and speed via WebSockets
- 📱 Fully responsive and mobile-friendly
- 🌗 Dark/Light mode support
- 📥 PWA support (installable on desktop & mobile)
- ⚡ Fast, asynchronous backend using FastAPI and yt-dlp

## Prerequisites

- **Node.js** (v18+)
- **Python** (v3.8+)
- **FFmpeg** (Must be installed and added to system PATH)

### Installing FFmpeg
- **Windows**: Download from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/), extract, and add the `bin` folder to your system's PATH.
- **Mac**: `brew install ffmpeg`
- **Linux**: `sudo apt update && sudo apt install ffmpeg`

## Setup & Running Locally

### 1. Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On Mac/Linux:
   source venv/bin/activate
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the backend server:
   ```bash
   python main.py
   ```
   The backend will run on `http://localhost:8000`.

### 2. Frontend

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend will run on `http://localhost:5173`.

## Deployment

### Backend Deployment (e.g., Render, Railway, DigitalOcean)
1. Use the `backend` folder as your root directory or specify it in your deployment settings.
2. The entry command should be: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. **Important**: Ensure your hosting provider has FFmpeg installed in the environment. Docker is highly recommended for backend deployment to easily include FFmpeg.

### Frontend Deployment (e.g., Vercel, Netlify)
1. Set the root directory to `frontend`.
2. The build command is `npm run build`.
3. The output directory is `dist`.
4. Make sure to set the environment variables in your hosting provider to point to your deployed backend URL. Update the `BACKEND_URL` and `WS_URL` in `App.tsx` (or use `.env` files appropriately).

## Architecture

- **Frontend**: Built with React and Vite. Uses TailwindCSS for styling and Lucide React for icons. The UI is designed to be modern, responsive, and user-friendly.
- **Backend**: Built with FastAPI. Uses `yt-dlp` for extracting video info and handling downloads. `FFmpeg` is utilized internally by `yt-dlp` to merge video and audio streams for high-quality MP4s and to extract MP3s. WebSockets provide real-time updates to the frontend.
