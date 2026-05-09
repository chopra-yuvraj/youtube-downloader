import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle, AlertCircle, Loader2, XCircle, Trash2, Download,
} from 'lucide-react';
import type { DownloadJob } from '../lib/types';

interface DownloadCardProps {
  job: DownloadJob;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
}

const DownloadCard = memo(function DownloadCard({ job, onCancel, onRemove }: DownloadCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -40, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="bg-card border border-border rounded-xl p-4 relative overflow-hidden"
    >
      {/* Subtle gradient accent on the left side */}
      <div className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-primary via-primary/50 to-transparent rounded-l-xl" />

      {/* Header */}
      <div className="flex justify-between items-start gap-3 pl-3">
        <h4 className="font-semibold text-sm line-clamp-2 leading-snug flex-1">{job.title}</h4>
        <span className="text-[10px] font-semibold uppercase px-2 py-1 bg-muted rounded-md shrink-0 tracking-wider">
          {job.format} {job.format === 'mp4' ? `• ${job.quality}` : '• Audio'}
        </span>
      </div>

      {/* Status content */}
      <div className="mt-3 pl-3">
        {job.status === 'pending' && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Connecting...</span>
          </div>
        )}

        {job.status === 'downloading' && (
          <div className="space-y-2.5">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-primary font-bold text-sm">{job.progress.toFixed(1)}%</span>
              <span className="text-muted-foreground">{job.speed} &middot; {job.eta}</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-blue-400 rounded-full progress-glow"
                initial={false}
                animate={{ width: `${Math.max(job.progress, 1)}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
            <button
              onClick={() => onCancel(job.id)}
              className="text-xs text-destructive hover:text-destructive/80 font-medium flex items-center gap-1 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> Cancel Download
            </button>
          </div>
        )}

        {job.status === 'completed' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              <span>Ready to save</span>
            </div>
            <div className="flex gap-2">
              <a
                href={job.downloadUrl}
                download
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-sm shadow-primary/20"
              >
                <Download className="w-3.5 h-3.5" />
                Save
              </a>
              <button
                onClick={() => onRemove(job.id)}
                className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                aria-label="Remove download"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {job.status === 'error' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-destructive text-sm font-medium min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="truncate" title={job.errorMessage}>
                {job.errorMessage || 'Download failed'}
              </span>
            </div>
            <button
              onClick={() => onRemove(job.id)}
              className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors shrink-0 ml-2"
              aria-label="Dismiss error"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {job.status === 'cancelled' && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Cancelled</span>
            <button
              onClick={() => onRemove(job.id)}
              className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
              aria-label="Remove cancelled download"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default DownloadCard;
