export interface VideoInfo {
  title: string;
  thumbnail?: string;
  duration: number;
  channel?: string;
}

export type DownloadStatus = 'pending' | 'downloading' | 'completed' | 'error' | 'cancelled';
export type FormatType = 'mp3' | 'mp4';
export type QualityOption = '144p' | '360p' | '720p' | '1080p';

export interface DownloadJob {
  id: string;
  url: string;
  format: FormatType;
  quality: QualityOption;
  status: DownloadStatus;
  progress: number;
  speed: string;
  eta: string;
  title: string;
  downloadUrl?: string;
  errorMessage?: string;
}
