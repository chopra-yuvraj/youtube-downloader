import { useState, useRef, useCallback } from 'react';
import type { DragEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Link as LinkIcon, AlertCircle, Clipboard,
  DownloadCloud, Sparkles, Inbox,
} from 'lucide-react';
import axios from 'axios';

import { cn } from './lib/utils';
import { useTheme, useDebounce, BACKEND_URL, WS_URL, YOUTUBE_URL_RE } from './lib/hooks';
import type { VideoInfo, DownloadJob, FormatType, QualityOption } from './lib/types';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import VideoPreview, { VideoPreviewSkeleton } from './components/VideoPreview';
import DownloadCard from './components/DownloadCard';

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();

  // ── URL input state ──────────────────────────────────────────
  const [url, setUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [format, setFormat] = useState<FormatType>('mp4');
  const [quality, setQuality] = useState<QualityOption>('1080p');

  // ── Video info state ─────────────────────────────────────────
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [infoError, setInfoError] = useState('');

  // ── Downloads state ──────────────────────────────────────────
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const wsRefs = useRef<Record<string, WebSocket>>({});

  // ── Debounced info fetch (700ms delay) ───────────────────────
  const fetchVideoInfo = useCallback(async (videoUrl: string) => {
    if (!videoUrl || !YOUTUBE_URL_RE.test(videoUrl)) return;
    setIsLoadingInfo(true);
    setInfoError('');
    try {
      const res = await axios.post(`${BACKEND_URL}/api/info`, { url: videoUrl });
      setVideoInfo(res.data);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Could not fetch video info';
      setInfoError(msg);
      setVideoInfo(null);
    } finally {
      setIsLoadingInfo(false);
    }
  }, []);

  const debouncedFetch = useDebounce(fetchVideoInfo, 700);

  // ── Handlers ─────────────────────────────────────────────────
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    setInfoError('');

    if (YOUTUBE_URL_RE.test(newUrl)) {
      debouncedFetch(newUrl);
    } else {
      setVideoInfo(null);
    }
  };

  const handleDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const text = e.dataTransfer.getData('text');
    if (text) {
      setUrl(text);
      if (YOUTUBE_URL_RE.test(text)) fetchVideoInfo(text);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      if (YOUTUBE_URL_RE.test(text)) fetchVideoInfo(text);
    } catch {
      // Clipboard API may be blocked; fail silently
    }
  };

  // ── Download start ───────────────────────────────────────────
  const startDownload = () => {
    if (!url) return;

    const jobId = crypto.randomUUID();
    const newJob: DownloadJob = {
      id: jobId,
      url,
      format,
      quality,
      status: 'pending',
      progress: 0,
      speed: '—',
      eta: '—',
      title: videoInfo?.title || 'Fetching title...',
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
        if (job.id !== jobId) return job;

        switch (data.status) {
          case 'downloading':
            return { ...job, status: 'downloading', progress: data.progress, speed: data.speed, eta: data.eta };
          case 'completed':
            return { ...job, status: 'completed', progress: 100, downloadUrl: `${BACKEND_URL}${data.download_url}`, title: data.title || job.title };
          case 'error':
            return { ...job, status: 'error', errorMessage: data.message };
          case 'cancelled':
            return { ...job, status: 'cancelled' };
          default:
            return job;
        }
      }));
    };

    ws.onerror = () => {
      setJobs(prev => prev.map(j =>
        j.id === jobId ? { ...j, status: 'error', errorMessage: 'Connection to server failed' } : j
      ));
    };

    ws.onclose = () => {
      delete wsRefs.current[jobId];
    };

    // Reset input
    setUrl('');
    setVideoInfo(null);
    setInfoError('');
  };

  const cancelJob = useCallback((jobId: string) => {
    const ws = wsRefs.current[jobId];
    if (ws) { ws.close(); delete wsRefs.current[jobId]; }
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'cancelled' } : j));
  }, []);

  const removeJob = useCallback((jobId: string) => {
    setJobs(prev => prev.filter(j => j.id !== jobId));
  }, []);

  const activeCount = jobs.filter(j => j.status === 'downloading' || j.status === 'pending').length;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 flex flex-col">
      <Navbar theme={theme} onToggleTheme={toggleTheme} />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
        {/* ── Left Column: Input ──────────────────────────────── */}
        <div className="lg:col-span-7 space-y-8">
          {/* Hero */}
          <div className="space-y-3">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.1]"
            >
              Download Media{' '}
              <span className="text-gradient">Instantly.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="text-base sm:text-lg text-muted-foreground max-w-lg"
            >
              Paste a YouTube link, pick your format, and download. 
              Fast, private, and free.
            </motion.p>
          </div>

          {/* Drop Zone */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className={cn(
              "border-2 border-dashed rounded-2xl p-6 sm:p-8 transition-all duration-300 relative group overflow-hidden bg-card",
              isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/40"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Background gradient hover effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="relative flex flex-col items-center gap-5">
              {/* URL Input */}
              <div className="w-full relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <input
                  id="url-input"
                  type="url"
                  placeholder="Paste YouTube link here..."
                  value={url}
                  onChange={handleUrlChange}
                  className="w-full bg-background border border-border rounded-xl pl-12 pr-24 py-4 text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all placeholder:text-muted-foreground"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  onClick={handlePaste}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg font-medium transition-all text-sm flex items-center gap-1.5 hover:scale-105 active:scale-95"
                  aria-label="Paste URL from clipboard"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  Paste
                </button>
              </div>

              {/* Loading / Error / Preview */}
              <AnimatePresence mode="wait">
                {isLoadingInfo && (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <VideoPreviewSkeleton />
                  </motion.div>
                )}

                {infoError && !isLoadingInfo && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex items-center gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-xl w-full text-sm font-medium"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{infoError}</span>
                  </motion.div>
                )}

                {videoInfo && !isLoadingInfo && (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="w-full"
                  >
                    <VideoPreview info={videoInfo} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Format / Quality selectors */}
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                {/* Format Toggle */}
                <div className="flex-1 bg-background border border-border rounded-xl p-1 flex">
                  {(['mp4', 'mp3'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-lg font-semibold transition-all text-sm uppercase tracking-wider",
                        format === f
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {f === 'mp4' ? '🎬 MP4' : '🎵 MP3'}
                    </button>
                  ))}
                </div>

                {/* Quality Selector */}
                {format === 'mp4' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex-1"
                  >
                    <select
                      value={quality}
                      onChange={(e) => setQuality(e.target.value as QualityOption)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground cursor-pointer appearance-none"
                    >
                      <option value="1080p">1080p — Full HD</option>
                      <option value="720p">720p — HD</option>
                      <option value="360p">360p — SD</option>
                      <option value="144p">144p — Low</option>
                    </select>
                  </motion.div>
                )}
              </div>

              {/* Download Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={startDownload}
                disabled={!url || isLoadingInfo}
                className="w-full bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90 text-white font-bold text-base sm:text-lg py-4 rounded-xl shadow-lg shadow-primary/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2.5"
              >
                <DownloadCloud className="w-5 h-5" />
                Download Now
              </motion.button>
            </div>
          </motion.div>

          {/* Feature badges */}
          <div className="flex flex-wrap gap-2">
            {['No signup', 'Private', 'HD quality', 'MP3 & MP4'].map(label => (
              <span key={label} className="inline-flex items-center gap-1 text-xs font-medium bg-muted text-muted-foreground px-3 py-1.5 rounded-full">
                <Sparkles className="w-3 h-3 text-primary" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Right Column: Downloads ─────────────────────────── */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Inbox className="w-5 h-5 text-muted-foreground" />
              Downloads
              {activeCount > 0 && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">
                  {activeCount}
                </span>
              )}
            </h2>
            {jobs.length > 0 && (
              <button
                onClick={() => setJobs([])}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {jobs.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-16 px-4 border border-dashed border-border rounded-2xl bg-card/30"
                >
                  <DownloadCloud className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">No downloads yet</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">
                    Paste a link to get started
                  </p>
                </motion.div>
              ) : (
                jobs.map(job => (
                  <DownloadCard
                    key={job.id}
                    job={job}
                    onCancel={cancelJob}
                    onRemove={removeJob}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
