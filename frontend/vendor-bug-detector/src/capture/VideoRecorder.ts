/**
 * Video Recorder
 * Records the browser tab/screen using MediaRecorder API.
 * Falls back to event-based replay when not available.
 * Supports: tab capture, screen capture, canvas-based recording.
 */

export interface VideoRecorderOptions {
  /** Max recording duration in ms (default: 30000) */
  maxDurationMs?: number;
  /** Video mime type preference */
  mimeType?: string;
  /** Video bitrate */
  videoBitsPerSecond?: number;
  /** Frame rate */
  frameRate?: number;
  /** Record audio too */
  audio?: boolean;
  /** Quality: 'low' | 'medium' | 'high' */
  quality?: 'low' | 'medium' | 'high';
}

export interface VideoRecording {
  id: string;
  blob: Blob;
  url: string;
  mimeType: string;
  durationMs: number;
  sizeBytes: number;
  startTime: string;
  endTime: string;
  viewport: { width: number; height: number };
}

export interface VideoRecorderState {
  isRecording: boolean;
  isSupported: boolean;
  currentDurationMs: number;
  maxDurationMs: number;
}

const QUALITY_PRESETS: Record<string, { bitrate: number; frameRate: number }> = {
  low: { bitrate: 500_000, frameRate: 10 },
  medium: { bitrate: 1_500_000, frameRate: 15 },
  high: { bitrate: 4_000_000, frameRate: 30 },
};

export class VideoRecorder {
  private options: Required<VideoRecorderOptions>;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startTime = 0;
  private maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  private durationInterval: ReturnType<typeof setInterval> | null = null;
  private currentDurationMs = 0;
  private isRecording = false;
  private isSupported: boolean;
  private onStateChangeCallbacks: ((state: VideoRecorderState) => void)[] = [];
  private onRecordingCompleteCallbacks: ((recording: VideoRecording) => void)[] = [];

  constructor(options: VideoRecorderOptions = {}) {
    const quality = options.quality || 'medium';
    const preset = QUALITY_PRESETS[quality];

    this.options = {
      maxDurationMs: options.maxDurationMs || 30000,
      mimeType: options.mimeType || this.getSupportedMimeType(),
      videoBitsPerSecond: options.videoBitsPerSecond || preset.bitrate,
      frameRate: options.frameRate || preset.frameRate,
      audio: options.audio ?? false,
      quality,
    };

    this.isSupported = this.checkSupport();
  }

  /** Check if browser supports screen/tab recording */
  checkSupport(): boolean {
    return !!(typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === 'function' &&
      'MediaRecorder' in window);
  }

  getState(): VideoRecorderState {
    return {
      isRecording: this.isRecording,
      isSupported: this.isSupported,
      currentDurationMs: this.currentDurationMs,
      maxDurationMs: this.options.maxDurationMs,
    };
  }

  async start(): Promise<boolean> {
    if (this.isRecording) return true;
    if (!this.isSupported) {
      console.warn('[BugDetector] Video recording not supported in this browser');
      return false;
    }

    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: this.options.frameRate,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: this.options.audio,
      });

      // Handle user cancelling the share dialog
      this.stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        this.stop();
      });

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.options.mimeType,
        videoBitsPerSecond: this.options.videoBitsPerSecond,
      });

      this.chunks = [];
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.finalizeRecording();
      };

      this.mediaRecorder.onerror = (e) => {
        console.error('[BugDetector] MediaRecorder error:', e);
        this.cleanup();
      };

      this.mediaRecorder.start(1000); // Collect chunks every 1s
      this.startTime = Date.now();
      this.isRecording = true;
      this.currentDurationMs = 0;

      // Max duration timer
      this.maxDurationTimer = setTimeout(() => {
        this.stop();
      }, this.options.maxDurationMs);

      // Duration tracking
      this.durationInterval = setInterval(() => {
        this.currentDurationMs = Date.now() - this.startTime;
        this.notifyStateChange();
      }, 1000);

      this.notifyStateChange();
      return true;
    } catch (err) {
      console.error('[BugDetector] Failed to start video recording:', err);
      this.cleanup();
      return false;
    }
  }

  stop(): VideoRecording | null {
    if (!this.isRecording) return null;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    this.cleanupTimers();
    this.isRecording = false;
    this.notifyStateChange();

    // The actual recording object is created in finalizeRecording via onstop
    return null; // Use onRecordingComplete callback for the result
  }

  onStateChange(callback: (state: VideoRecorderState) => void): () => void {
    this.onStateChangeCallbacks.push(callback);
    return () => {
      this.onStateChangeCallbacks = this.onStateChangeCallbacks.filter((c) => c !== callback);
    };
  }

  onRecordingComplete(callback: (recording: VideoRecording) => void): () => void {
    this.onRecordingCompleteCallbacks.push(callback);
    return () => {
      this.onRecordingCompleteCallbacks = this.onRecordingCompleteCallbacks.filter((c) => c !== callback);
    };
  }

  destroy(): void {
    this.stop();
    this.cleanup();
  }

  // ============================================================================
  // PRIVATE
  // ============================================================================

  private finalizeRecording(): void {
    if (this.chunks.length === 0) {
      this.cleanup();
      return;
    }

    const blob = new Blob(this.chunks, { type: this.options.mimeType });
    const durationMs = Date.now() - this.startTime;

    const recording: VideoRecording = {
      id: crypto.randomUUID(),
      blob,
      url: URL.createObjectURL(blob),
      mimeType: this.options.mimeType,
      durationMs,
      sizeBytes: blob.size,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };

    this.onRecordingCompleteCallbacks.forEach((cb) => {
      try { cb(recording); } catch { /* ignore */ }
    });

    this.cleanup();
  }

  private cleanup(): void {
    this.cleanupTimers();

    if (this.mediaRecorder) {
      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch { /* ignore */ }
      this.mediaRecorder = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    this.chunks = [];
    this.isRecording = false;
    this.currentDurationMs = 0;
  }

  private cleanupTimers(): void {
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  private notifyStateChange(): void {
    const state = this.getState();
    this.onStateChangeCallbacks.forEach((cb) => {
      try { cb(state); } catch { /* ignore */ }
    });
  }

  private getSupportedMimeType(): string {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'video/webm';
  }
}

export default VideoRecorder;
