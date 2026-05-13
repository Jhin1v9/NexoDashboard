/**
 * Hook useScreenCapture
 * Captura screenshots em componentes React
 */

import { useState, useCallback, useRef } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReactModule = any;

interface UseScreenCaptureReturn {
  screenshot: string | null;
  isCapturing: boolean;
  error: Error | null;
  captureElement: (element?: HTMLElement) => Promise<string | null>;
  captureFullPage: () => Promise<string | null>;
  clear: () => void;
}

export function useScreenCapture(): UseScreenCaptureReturn {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const html2canvasRef = useRef<typeof import('html2canvas').default | null>(null);

  // Lazy load html2canvas
  const getHtml2Canvas = async () => {
    if (!html2canvasRef.current) {
      const mod = await import('html2canvas');
      html2canvasRef.current = mod.default;
    }
    return html2canvasRef.current;
  };

  const captureElement = useCallback(async (element?: HTMLElement): Promise<string | null> => {
    setIsCapturing(true);
    setError(null);

    try {
      const html2canvas = await getHtml2Canvas();
      const target = element || document.body;

      const canvas = await html2canvas(target, {
        logging: false,
        useCORS: true,
        allowTaint: true,
        scale: window.devicePixelRatio,
        backgroundColor: null,
      });

      const dataUrl = canvas.toDataURL('image/png');
      setScreenshot(dataUrl);
      return dataUrl;
    } catch (err) {
      const captureError = err instanceof Error ? err : new Error('Failed to capture screenshot');
      setError(captureError);
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const captureFullPage = useCallback(async (): Promise<string | null> => {
    setIsCapturing(true);
    setError(null);

    try {
      const html2canvas = await getHtml2Canvas();

      const canvas = await html2canvas(document.body, {
        logging: false,
        useCORS: true,
        allowTaint: true,
        scale: 1,
        height: document.body.scrollHeight,
        windowHeight: document.body.scrollHeight,
      });

      const dataUrl = canvas.toDataURL('image/png');
      setScreenshot(dataUrl);
      return dataUrl;
    } catch (err) {
      const captureError = err instanceof Error ? err : new Error('Failed to capture full page');
      setError(captureError);
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const clear = useCallback(() => {
    setScreenshot(null);
    setError(null);
  }, []);

  return {
    screenshot,
    isCapturing,
    error,
    captureElement,
    captureFullPage,
    clear,
  };
}

export default useScreenCapture;
