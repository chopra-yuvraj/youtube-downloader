/**
 * Shared hooks for the AnyDL frontend.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

/** ── useDebounce ────────────────────────────────────────────────
 *  Delays invoking a callback until `delay` ms have elapsed since
 *  the last call. Prevents hammering the API on every keystroke.
 */
export function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): T {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debounced = useCallback((...args: Parameters<T>) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]) as unknown as T;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return debounced;
}

/** ── useTheme ───────────────────────────────────────────────────
 *  Manages dark/light mode with localStorage persistence.
 *  Respects system preference on first visit.
 */
export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem('anydl-theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('anydl-theme', theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  return { theme, toggle } as const;
}

/** ── YouTube URL regex ──────────────────────────────────────────
 *  Matches standard YouTube watch, shorts, and youtu.be links.
 */
export const YOUTUBE_URL_RE = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/).+$/;

/** ── Backend URLs ───────────────────────────────────────────────
 *  Pulled from Vite env vars with production Render backend as default.
 *  For local dev, set VITE_BACKEND_URL=http://localhost:8000 in a .env file.
 */
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://youtube-downloader-yt35.onrender.com';
export const WS_URL = import.meta.env.VITE_WS_URL || 'wss://youtube-downloader-yt35.onrender.com/api/ws/download';
