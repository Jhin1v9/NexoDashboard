/**
 * ScreenRecorder - Gravação de tela
 */

/** Configuração do ScreenRecorder */
interface ScreenRecorderConfig {
  videoBitsPerSecond?: number;
  mimeType?: string;
}

/** Estado do recorder */
type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped';

/** Classe para gravar a tela */
export class ScreenRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private config: ScreenRecorderConfig;
  private state: RecorderState = 'idle';
  private onDataAvailableCallback?: (blob: Blob) => void;
  private onStopCallback?: (blob: Blob) => void;

  constructor(config: ScreenRecorderConfig = {}) {
    this.config = {
      videoBitsPerSecond: config.videoBitsPerSecond ?? 2500000, // 2.5 Mbps
      mimeType: config.mimeType ?? this.getSupportedMimeType(),
    };
  }

  /** Inicia a gravação */
  async start(options?: { onDataAvailable?: (blob: Blob) => void }): Promise<void> {
    if (this.state === 'recording') {
      throw new Error('Recording already in progress');
    }

    this.onDataAvailableCallback = options?.onDataAvailable;
    this.recordedChunks = [];

    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.config.mimeType,
        videoBitsPerSecond: this.config.videoBitsPerSecond,
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
          this.onDataAvailableCallback?.(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.handleStop();
      };

      // Iniciar gravação com chunks a cada 1 segundo
      this.mediaRecorder.start(1000);
      this.state = 'recording';

      // Detectar quando o usuário para o compartilhamento
      this.stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        this.stop();
      });
    } catch (error) {
      this.state = 'idle';
      throw error;
    }
  }

  /** Para a gravação */
  stop(): void {
    if (this.state !== 'recording') return;

    this.mediaRecorder?.stop();
    this.stream?.getTracks().forEach(track => track.stop());
    this.state = 'stopped';
  }

  /** Pausa a gravação */
  pause(): void {
    if (this.state !== 'recording') return;

    this.mediaRecorder?.pause();
    this.state = 'paused';
  }

  /** Retoma a gravação */
  resume(): void {
    if (this.state !== 'paused') return;

    this.mediaRecorder?.resume();
    this.state = 'recording';
  }

  /** Retorna o estado atual */
  getState(): RecorderState {
    return this.state;
  }

  /** Retorna se está gravando */
  isRecording(): boolean {
    return this.state === 'recording';
  }

  /** Retorna o blob gravado */
  getBlob(): Blob | null {
    if (this.recordedChunks.length === 0) return null;
    return new Blob(this.recordedChunks, { type: this.config.mimeType });
  }

  /** Retorna a URL do vídeo gravado */
  getVideoUrl(): string | null {
    const blob = this.getBlob();
    return blob ? URL.createObjectURL(blob) : null;
  }

  /** Define o callback para quando parar */
  onStop(callback: (blob: Blob) => void): void {
    this.onStopCallback = callback;
  }

  /** Limpa os dados gravados */
  clear(): void {
    this.recordedChunks = [];
    this.state = 'idle';
  }

  /** Handler de parada */
  private handleStop(): void {
    const blob = this.getBlob();
    if (blob) {
      this.onStopCallback?.(blob);
    }
  }

  /** Retorna o mime type suportado */
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

export default ScreenRecorder;
