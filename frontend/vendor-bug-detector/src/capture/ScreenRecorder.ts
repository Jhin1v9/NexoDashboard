/**
 * ScreenRecorder
 * Engine vanilla para gravação de tela via getDisplayMedia + MediaRecorder
 */

export interface ScreenRecorderOptions {
  /** Duração máxima da gravação em ms */
  maxDuration?: number;
  /** MimeType preferido (auto-detectado se não informado) */
  mimeType?: string;
  /** FPS alvo */
  videoBitsPerSecond?: number;
  /** Callback de progresso (ms gravados) */
  onProgress?: (elapsedMs: number) => void;
  /** Callback quando termina (por stop ou timeout) */
  onStop?: (blob: Blob | null) => void;
  /** Callback de erro */
  onError?: (error: Error) => void;
}

export class ScreenRecorder {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private timerId: ReturnType<typeof setInterval> | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private startTime = 0;
  private options: ScreenRecorderOptions;
  private isRecording = false;

  constructor(options: ScreenRecorderOptions = {}) {
    this.options = {
      maxDuration: 10000,
      videoBitsPerSecond: 2_500_000,
      ...options,
    };
  }

  /** Verifica se o browser suporta gravação de tela */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices !== 'undefined' &&
      typeof navigator.mediaDevices.getDisplayMedia === 'function' &&
      typeof MediaRecorder !== 'undefined';
  }

  /** Detecta o melhor mime type suportado */
  static getSupportedMimeType(): string | null {
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
    return null;
  }

  /** Inicia a gravação de tela */
  async start(): Promise<void> {
    if (this.isRecording) {
      throw new Error('Gravação já em andamento');
    }

    if (!ScreenRecorder.isSupported()) {
      throw new Error('Seu navegador não suporta gravação de tela');
    }

    const mimeType = this.options.mimeType || ScreenRecorder.getSupportedMimeType();
    if (!mimeType) {
      throw new Error('Nenhum formato de vídeo suportado neste navegador');
    }

    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30 },
        } as MediaTrackConstraints,
        audio: false,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.name === 'NotAllowedError') {
        throw new Error('Permissão de gravação negada pelo usuário');
      }
      throw new Error(`Falha ao iniciar gravação: ${error.message}`);
    }

    // Se o usuário parar compartilhamento via UI do navegador, paramos a gravação
    this.stream.getVideoTracks().forEach((track) => {
      track.onended = () => {
        this.stop();
      };
    });

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType,
      videoBitsPerSecond: this.options.videoBitsPerSecond,
    });

    this.chunks = [];
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      this.cleanupTimer();
      const blob = this.chunks.length > 0 ? new Blob(this.chunks, { type: mimeType }) : null;
      this.options.onStop?.(blob);
      this.isRecording = false;
    };

    this.mediaRecorder.onerror = () => {
      this.cleanupTimer();
      this.options.onError?.(new Error('Erro do MediaRecorder durante a gravação'));
      this.isRecording = false;
    };

    this.mediaRecorder.start(1000); // coleta a cada 1s
    this.isRecording = true;
    this.startTime = Date.now();

    // Progresso a cada 500ms
    this.timerId = setInterval(() => {
      const elapsed = Date.now() - this.startTime;
      this.options.onProgress?.(elapsed);
    }, 500);

    // Auto-stop após maxDuration
    if (this.options.maxDuration && this.options.maxDuration > 0) {
      this.timeoutId = setTimeout(() => {
        this.stop();
      }, this.options.maxDuration);
    }
  }

  /** Para a gravação manualmente */
  stop(): void {
    if (!this.isRecording) return;

    try {
      this.mediaRecorder?.stop();
      this.stream?.getTracks().forEach((track) => track.stop());
    } catch {
      // ignore
    }
    this.cleanupTimer();
    this.isRecording = false;
  }

  /** Cancela a gravação e descarta o vídeo */
  cancel(): void {
    if (!this.isRecording) return;
    this.chunks = [];
    this.stop();
  }

  /** Retorna se está gravando */
  get recording(): boolean {
    return this.isRecording;
  }

  /** Retorna o tempo decorrido em ms */
  getElapsedTime(): number {
    if (!this.isRecording) return 0;
    return Date.now() - this.startTime;
  }

  /** Converte blob para base64 */
  static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /** Gera uma URL de preview a partir do blob */
  static createPreviewUrl(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  private cleanupTimer(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

export default ScreenRecorder;
