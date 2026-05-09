import React, { useState, useEffect, useRef, DragEvent } from 'react';
import { 
  DownloadCloud, Link as LinkIcon, Settings2, Moon, Sun, 
  X, CheckCircle, AlertCircle, Loader2, PlayCircle, Monitor, 
  Trash2, XCircle
} from 'lucide-react';
import { cn } from './lib/utils';
import axios from 'axios';

const BACKEND_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/api/ws/download';

interface VideoInfo {
  title: string;
  thumbnail?: string;
  duration: number;
}

interface DownloadJob {
  id: string;
  url: string;
  format: 'mp3' | 'mp4';
  quality: string;
  status: 'pending' | 'downloading' | 'completed' | 'error' | 'cancelled';
  progress: number;
  speed: string;
  eta: string;
  title: string;
  downloadUrl?: string;
  errorMessage?: string;
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [url, setUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [format, setFormat] = useState<'mp3' | 'mp4'>('mp4');
  const [quality, setQuality] = useState('1080p');
  
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [infoError, setInfoError] = useState('');

  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const wsRefs = useRef<{[key: string]: WebSocket}>({});

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const fetchVideoInfo = async (videoUrl: string) => {
    if (!videoUrl) return;
    setIsLoadingInfo(true);
    setInfoError('');
    try {
      const res = await axios.post(`${BACKEND_URL}/api/info`, { url: videoUrl });
      setVideoInfo(res.data);
    } catch (err: any) {
      setInfoError(err.response?.data?.detail || 'Failed to fetch video info');
      setVideoInfo(null);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    
    if (newUrl.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/)) {
      fetchVideoInfo(newUrl);
    } else {
      setVideoInfo(null);
      setInfoError('');
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const text = e.dataTransfer.getData('text');
    if (text) {
      setUrl(text);
      if (text.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/)) {
        fetchVideoInfo(text);
      }
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      if (text.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/)) {
        fetchVideoInfo(text);
      }
    } catch (err) {
      console.error('Failed to read clipboard', err);
    }
  };

  const startDownload = () => {
    if (!url) return;

    const jobId = Math.random().toString(36).substring(7);
    const newJob: DownloadJob = {
      id: jobId,
      url,
      format,
      quality,
      status: 'pending',
      progress: 0,
      speed: '0KiB/s',
      eta: 'Unknown',
      title: videoInfo?.title || 'Unknown Video',
    };

    setJobs(prev => [newJob, ...prev]);

    const ws = new WebSocket(WS_URL);
    wsRefs.current[jobId] = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ url, format, quality }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      setJobs(prev => prev.map(job => {
        if (job.id === jobId) {
          if (data.status === 'downloading') {
            return { ...job, status: 'downloading', progress: data.progress, speed: data.speed, eta: data.eta };
          } else if (data.status === 'completed') {
            return { ...job, status: 'completed', progress: 100, downloadUrl: `${BACKEND_URL}${data.download_url}`, title: data.title || job.title };
          } else if (data.status === 'error') {
            return { ...job, status: 'error', errorMessage: data.message };
          } else if (data.status === 'cancelled') {
            return { ...job, status: 'cancelled' };
          }
        }
        return job;
      }));
    };

    ws.onclose = () => {
      delete wsRefs.current[jobId];
    };
    
    setUrl('');
    setVideoInfo(null);
  };

  const cancelJob = (jobId: string) => {
    if (wsRefs.current[jobId]) {
      wsRefs.current[jobId].close();
      delete wsRefs.current[jobId];
    }
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'cancelled' } : j));
  };

  const removeJob = (jobId: string) => {
    setJobs(prev => prev.filter(j => j.id !== jobId));
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 flex flex-col">
      <nav className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg">
              <DownloadCloud className="w-6 h-6 text-primary" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              AnyDL
            </span>
          </div>
          <button
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto px-4 py-12 w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tighter">
              Download Media <br />
              <span className="text-primary">Instantly.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg">
              High-quality downloads from YouTube. Simply paste your link, choose your format, and let us handle the rest.
            </p>
          </div>

          <div
            className={cn(
              "border-2 border-dashed rounded-2xl p-8 transition-all duration-300 relative group overflow-hidden bg-card",
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative flex flex-col items-center gap-6">
              <div className="w-full relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  placeholder="Paste YouTube link here..."
                  value={url}
                  onChange={handleUrlChange}
                  className="w-full bg-background border border-border rounded-xl pl-12 pr-24 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground"
                />
                <button
                  onClick={handlePaste}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg font-medium transition-colors text-sm"
                >
                  Paste
                </button>
              </div>

              {isLoadingInfo && (
                <div className="flex items-center gap-2 text-primary">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Fetching info...</span>
                </div>
              )}

              {infoError && (
                <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-4 py-2 rounded-lg w-full">
                  <AlertCircle className="w-5 h-5" />
                  <span>{infoError}</span>
                </div>
              )}

              {videoInfo && (
                <div className="flex gap-4 w-full bg-background p-4 rounded-xl border border-border animate-in fade-in slide-in-from-bottom-4">
                  <div className="relative w-32 aspect-video rounded-lg overflow-hidden shrink-0 bg-muted">
                    {videoInfo.thumbnail ? (
                      <img src={videoInfo.thumbnail} alt="thumbnail" className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <PlayCircle className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center overflow-hidden">
                    <h3 className="font-semibold text-lg truncate" title={videoInfo.title}>{videoInfo.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {Math.floor(videoInfo.duration / 60)}:{String(videoInfo.duration % 60).padStart(2, '0')}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <div className="flex-1 bg-background border border-border rounded-xl p-1 flex">
                  {(['mp4', 'mp3'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-lg font-medium transition-all text-sm uppercase tracking-wider",
                        format === f 
                          ? "bg-primary text-primary-foreground shadow-sm" 
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {format === 'mp4' && (
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-xl px-4 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground cursor-pointer appearance-none"
                  >
                    <option value="1080p">1080p (FHD)</option>
                    <option value="720p">720p (HD)</option>
                    <option value="360p">360p (SD)</option>
                    <option value="144p">144p (Basic)</option>
                  </select>
                )}
              </div>

              <button
                onClick={startDownload}
                disabled={!url || isLoadingInfo || !!infoError}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg py-4 rounded-xl shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none hover:scale-[1.02] active:scale-[0.98]"
              >
                Download Now
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-xl font-bold">Your Downloads</h2>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {jobs.length === 0 ? (
              <div className="text-center py-12 px-4 border border-border border-dashed rounded-2xl bg-card/50">
                <Settings2 className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No active downloads.</p>
                <p className="text-sm text-muted-foreground/70">Paste a link to get started.</p>
              </div>
            ) : (
              jobs.map(job => (
                <div key={job.id} className="bg-card border border-border rounded-xl p-4 animate-in slide-in-from-right-8 relative group">
                  <div className="flex justify-between items-start mb-2 gap-4">
                    <h4 className="font-semibold text-sm line-clamp-2">{job.title}</h4>
                    <span className="text-xs font-medium uppercase px-2 py-1 bg-muted rounded-md shrink-0">
                      {job.format} • {job.format === 'mp4' ? job.quality : 'Audio'}
                    </span>
                  </div>

                  {job.status === 'downloading' && (
                    <div className="space-y-2 mt-4">
                      <div className="flex justify-between text-xs text-muted-foreground font-medium">
                        <span>{job.progress.toFixed(1)}%</span>
                        <span>{job.speed} • ETA: {job.eta}</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <button 
                        onClick={() => cancelJob(job.id)}
                        className="text-xs text-destructive hover:underline mt-2 flex items-center gap-1"
                      >
                        <XCircle className="w-3 h-3" /> Cancel
                      </button>
                    </div>
                  )}

                  {job.status === 'completed' && (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-green-500 text-sm font-medium">
                        <CheckCircle className="w-4 h-4" />
                        <span>Ready</span>
                      </div>
                      <div className="flex gap-2">
                        <a 
                          href={job.downloadUrl}
                          download
                          className="px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
                        >
                          Save File
                        </a>
                        <button onClick={() => removeJob(job.id)} className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {job.status === 'error' && (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                        <AlertCircle className="w-4 h-4" />
                        <span className="truncate max-w-[200px]" title={job.errorMessage}>Failed: {job.errorMessage}</span>
                      </div>
                      <button onClick={() => removeJob(job.id)} className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  
                  {job.status === 'cancelled' && (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-muted-foreground text-sm font-medium">
                        Cancelled
                      </div>
                      <button onClick={() => removeJob(job.id)} className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {job.status === 'pending' && (
                    <div className="mt-4 flex items-center gap-2 text-muted-foreground text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Starting...</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
      
      <footer className="border-t border-border mt-auto py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© 2026 AnyDL. Built with FastAPI & React.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
