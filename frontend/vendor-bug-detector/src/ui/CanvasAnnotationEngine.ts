/**
 * CanvasAnnotationEngine
 * Engine vanilla para anotações em screenshots
 * Suporta: retângulo, seta, blur, texto, undo/redo
 */

export type AnnotationTool = 'rectangle' | 'arrow' | 'blur' | 'text';

export interface AnnotationAction {
  tool: AnnotationTool;
  color: string;
  startX: number;
  startY: number;
  endX?: number;
  endY?: number;
  text?: string;
}

export interface SensitiveRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class CanvasAnnotationEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private actions: AnnotationAction[] = [];
  private undoneActions: AnnotationAction[] = [];
  private backgroundImage: HTMLImageElement | null = null;
  private currentTool: AnnotationTool = 'rectangle';
  private currentColor = '#ef4444';
  private isDrawing = false;
  private startX = 0;
  private startY = 0;
  private sensitiveRects: SensitiveRect[] = [];
  private textInputCallback?: (x: number, y: number, callback: (text: string) => void) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context not supported');
    }
    this.ctx = ctx;
    this.setupEvents();
  }

  /** Carrega imagem de fundo (screenshot) */
  loadImage(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.backgroundImage = img;
        this.canvas.width = img.naturalWidth;
        this.canvas.height = img.naturalHeight;
        this.redraw();
        resolve();
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  /** Define áreas sensíveis para blur automático */
  setSensitiveRects(rects: SensitiveRect[]): void {
    this.sensitiveRects = rects;
    this.redraw();
  }

  /** Define ferramenta ativa */
  setTool(tool: AnnotationTool): void {
    this.currentTool = tool;
  }

  /** Define cor atual */
  setColor(color: string): void {
    this.currentColor = color;
  }

  /** Define callback para input de texto */
  setTextInputCallback(callback: (x: number, y: number, cb: (text: string) => void) => void): void {
    this.textInputCallback = callback;
  }

  /** Desfazer */
  undo(): void {
    if (this.actions.length === 0) return;
    const action = this.actions.pop();
    if (action) {
      this.undoneActions.push(action);
      this.redraw();
    }
  }

  /** Refazer */
  redo(): void {
    if (this.undoneActions.length === 0) return;
    const action = this.undoneActions.pop();
    if (action) {
      this.actions.push(action);
      this.redraw();
    }
  }

  /** Limpa tudo */
  clear(): void {
    this.actions = [];
    this.undoneActions = [];
    this.redraw();
  }

  /** Exporta para base64 PNG */
  export(): string {
    return this.canvas.toDataURL('image/png');
  }

  /** Verifica se há anotações */
  hasAnnotations(): boolean {
    return this.actions.length > 0;
  }

  /** Verifica se pode desfazer */
  canUndo(): boolean {
    return this.actions.length > 0;
  }

  /** Verifica se pode refazer */
  canRedo(): boolean {
    return this.undoneActions.length > 0;
  }

  private setupEvents(): void {
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
  }

  destroy(): void {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
  }

  private getCoordinates(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  private handleMouseDown = (e: MouseEvent): void => {
    if (this.currentTool === 'text') {
      const { x, y } = this.getCoordinates(e);
      if (this.textInputCallback) {
        this.textInputCallback(x, y, (text) => {
          if (text.trim()) {
            this.actions.push({
              tool: 'text',
              color: this.currentColor,
              startX: x,
              startY: y,
              text: text.trim(),
            });
            this.undoneActions = [];
            this.redraw();
          }
        });
      }
      return;
    }

    this.isDrawing = true;
    const { x, y } = this.getCoordinates(e);
    this.startX = x;
    this.startY = y;
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.isDrawing) return;
    const { x, y } = this.getCoordinates(e);
    this.redraw();
    this.drawPreview(this.currentTool, this.startX, this.startY, x, y, this.currentColor);
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    const { x, y } = this.getCoordinates(e);

    // Ignora cliques sem movimento (exceto blur que pode ser um clique simples)
    const minDistance = this.currentTool === 'blur' ? 0 : 4;
    if (Math.abs(x - this.startX) < minDistance && Math.abs(y - this.startY) < minDistance && this.currentTool !== 'blur') {
      this.redraw();
      return;
    }

    this.actions.push({
      tool: this.currentTool,
      color: this.currentColor,
      startX: this.startX,
      startY: this.startY,
      endX: x,
      endY: y,
    });
    this.undoneActions = [];
    this.redraw();
  };

  private redraw(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.backgroundImage) {
      this.ctx.drawImage(this.backgroundImage, 0, 0);
    }

    // Aplica blur em áreas sensíveis
    this.sensitiveRects.forEach((rect) => {
      this.applyBlurRect(rect.x, rect.y, rect.width, rect.height);
    });

    // Re-desenha todas as ações
    this.actions.forEach((action) => {
      this.drawAction(action);
    });
  }

  private drawPreview(tool: AnnotationTool, x1: number, y1: number, x2: number, y2: number, color: string): void {
    this.drawShape(tool, x1, y1, x2, y2, color);
  }

  private drawAction(action: AnnotationAction): void {
    if (action.tool === 'text' && action.text) {
      this.drawText(action.startX, action.startY, action.text, action.color);
    } else if (action.endX !== undefined && action.endY !== undefined) {
      this.drawShape(action.tool, action.startX, action.startY, action.endX, action.endY, action.color);
    }
  }

  private drawShape(tool: AnnotationTool, x1: number, y1: number, x2: number, y2: number, color: string): void {
    switch (tool) {
      case 'rectangle':
        this.drawRectangle(x1, y1, x2, y2, color);
        break;
      case 'arrow':
        this.drawArrow(x1, y1, x2, y2, color);
        break;
      case 'blur':
        this.drawBlur(x1, y1, x2, y2);
        break;
    }
  }

  private drawRectangle(x1: number, y1: number, x2: number, y2: number, color: string): void {
    const width = x2 - x1;
    const height = y2 - y1;
    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 4;
    this.ctx.lineJoin = 'round';
    this.ctx.strokeRect(x1, y1, width, height);
    this.ctx.restore();
  }

  private drawArrow(x1: number, y1: number, x2: number, y2: number, color: string): void {
    const headLen = 16;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = 4;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Linha
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();

    // Cabeça
    this.ctx.beginPath();
    this.ctx.moveTo(x2, y2);
    this.ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    this.ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  private drawBlur(x1: number, y1: number, x2: number, y2: number): void {
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    this.applyBlurRect(left, top, width, height);
  }

  private applyBlurRect(x: number, y: number, width: number, height: number): void {
    if (width <= 0 || height <= 0) return;

    this.ctx.save();
    // Pixelização com caixas de 8px
    const pixelSize = 8;
    const cols = Math.ceil(width / pixelSize);
    const rows = Math.ceil(height / pixelSize);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const px = x + col * pixelSize;
        const py = y + row * pixelSize;
        const pw = Math.min(pixelSize, x + width - px);
        const ph = Math.min(pixelSize, y + height - py);

        try {
          const imageData = this.ctx.getImageData(px, py, Math.max(1, pw), Math.max(1, ph));
          const data = imageData.data;
          let r = 0, g = 0, b = 0, count = 0;
          for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
          if (count > 0) {
            this.ctx.fillStyle = `rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)})`;
            this.ctx.fillRect(px, py, pw, ph);
          }
        } catch {
          // Fallback se getImageData falhar (CORS, etc.)
          this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
          this.ctx.fillRect(px, py, pw, ph);
        }
      }
    }
    this.ctx.restore();
  }

  private drawText(x: number, y: number, text: string, color: string): void {
    this.ctx.save();
    this.ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    this.ctx.lineWidth = 4;
    this.ctx.lineJoin = 'round';
    this.ctx.strokeText(text, x, y);
    this.ctx.fillText(text, x, y);
    this.ctx.restore();
  }
}

export default CanvasAnnotationEngine;
