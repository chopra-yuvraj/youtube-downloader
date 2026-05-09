import { PlayCircle, User } from 'lucide-react';
import type { VideoInfo } from '../lib/types';

interface VideoPreviewProps {
  info: VideoInfo;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VideoPreview({ info }: VideoPreviewProps) {
  return (
    <div className="flex gap-4 w-full bg-background/80 p-4 rounded-xl border border-border">
      {/* Thumbnail */}
      <div className="relative w-28 sm:w-36 aspect-video rounded-lg overflow-hidden shrink-0 bg-muted">
        {info.thumbnail ? (
          <img
            src={info.thumbnail}
            alt={`Thumbnail for ${info.title}`}
            className="object-cover w-full h-full"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <PlayCircle className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
        {/* Duration badge */}
        <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
          {formatDuration(info.duration)}
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col justify-center overflow-hidden min-w-0">
        <h3 className="font-semibold text-sm sm:text-base leading-snug line-clamp-2" title={info.title}>
          {info.title}
        </h3>
        {info.channel && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <User className="w-3 h-3" />
            {info.channel}
          </p>
        )}
      </div>
    </div>
  );
}

export function VideoPreviewSkeleton() {
  return (
    <div className="flex gap-4 w-full p-4 rounded-xl border border-border bg-background/80">
      <div className="w-28 sm:w-36 aspect-video rounded-lg skeleton shrink-0" />
      <div className="flex flex-col justify-center gap-2 flex-1">
        <div className="h-4 skeleton rounded w-3/4" />
        <div className="h-3 skeleton rounded w-1/3" />
      </div>
    </div>
  );
}
