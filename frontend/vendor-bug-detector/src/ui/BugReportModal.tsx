/**
 * BugReportModal
 * Modal para criação de reports de bug
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { InspectedElement, CreateReportData, BugReport } from '../types';
import { ScreenshotAnnotationCanvas } from './ScreenshotAnnotationCanvas';
import { ScreenRecorder } from '../capture/ScreenRecorder';

interface BugReportModalProps {
  isOpen: boolean;
  element: InspectedElement | null;
  screenshotDataUrl: string | null;
  onClose: () => void;
  onSubmit: (data: CreateReportData) => Promise<BugReport>;
  primaryColor?: string;
}

const reportTypes = [
  { id: 'bug', label: 'Bug', color: 'bg-red-500' },
  { id: 'improvement', label: 'Melhoria', color: 'bg-amber-500' },
  { id: 'question', label: 'Dúvida', color: 'bg-blue-500' },
] as const;

const severityLevels = [
  { id: 'critical', label: 'Crítica', color: '#ef4444' },
  { id: 'high', label: 'Alta', color: '#f97316' },
  { id: 'medium', label: 'Média', color: '#eab308' },
  { id: 'low', label: 'Baixa', color: '#3b82f6' },
] as const;

const formatTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const tenths = Math.floor((ms % 1000) / 100);
  return `${seconds}.${tenths}s`;
};

export const BugReportModal: React.FC<BugReportModalProps> = ({
  isOpen,
  element,
  screenshotDataUrl,
  onClose,
  onSubmit,
  primaryColor = '#06b6d4',
}) => {
  const [type, setType] = useState<BugReport['type']>('bug');
  const [severity, setSeverity] = useState<BugReport['severity']>('medium');
  const [description, setDescription] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotatedScreenshotUrl, setAnnotatedScreenshotUrl] = useState<string | null>(null);

  // Screen recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState<string | null>(null);
  const [recordProgress, setRecordProgress] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);
  const recorderRef = useRef<ScreenRecorder | null>(null);

  // Calcula retângulos sensíveis para blur automático
  const sensitiveRects = useMemo(() => {
    const target = element?.domElement;
    if (!target) return [];
    const rects: Array<{ x: number; y: number; width: number; height: number }> = [];

    const addRect = (el: Element) => {
      const rect = el.getBoundingClientRect();
      const bodyRect = document.body.getBoundingClientRect();
      rects.push({
        x: rect.left - bodyRect.left + window.scrollX,
        y: rect.top - bodyRect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      });
    };

    target.querySelectorAll('input[type="password"]').forEach(addRect);
    const sensitiveNames = ['cpf', 'ssn', 'credit', 'card', 'cvv', 'password', 'secret'];
    sensitiveNames.forEach((name) => {
      target.querySelectorAll(`input[name*="${name}"], input[id*="${name}"]`).forEach(addRect);
    });
    target.querySelectorAll('input[type="email"]').forEach(addRect);

    return rects;
  }, [element]);

  const activeScreenshotUrl = annotatedScreenshotUrl ?? screenshotDataUrl;

  const handleSubmit = useCallback(async () => {
    if (!element || !description.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        description: description.trim(),
        type,
        severity,
        expectedBehavior: expectedBehavior.trim() || undefined,
        element,
        screenshot: includeScreenshot ? (activeScreenshotUrl || undefined) : undefined,
        video: recordedVideo || undefined,
      });
      // Reset
      setType('bug');
      setSeverity('medium');
      setDescription('');
      setExpectedBehavior('');
      setIncludeScreenshot(true);
      setAnnotatedScreenshotUrl(null);
      setRecordedVideo(null);
      setRecordError(null);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }, [description, element, expectedBehavior, onClose, onSubmit, severity, type, includeScreenshot, activeScreenshotUrl, recordedVideo]);

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setAnnotatedScreenshotUrl(null);
      setRecordedVideo(null);
      setRecordError(null);
      if (recorderRef.current) {
        recorderRef.current.cancel();
        recorderRef.current = null;
      }
      onClose();
    }
  }, [isSubmitting, onClose]);

  const handleApplyAnnotation = useCallback((dataUrl: string) => {
    setAnnotatedScreenshotUrl(dataUrl);
    setIsAnnotating(false);
  }, []);

  const handleCancelAnnotation = useCallback(() => {
    setIsAnnotating(false);
  }, []);

  const handleStartRecording = useCallback(async () => {
    setRecordError(null);
    try {
      recorderRef.current = new ScreenRecorder({
        maxDuration: 10000,
        onProgress: (elapsed) => setRecordProgress(elapsed),
        onStop: async (blob) => {
          setIsRecording(false);
          setRecordProgress(0);
          if (blob && blob.size > 0) {
            const base64 = await ScreenRecorder.blobToBase64(blob);
            setRecordedVideo(base64);
          }
        },
        onError: (err) => {
          setIsRecording(false);
          setRecordProgress(0);
          setRecordError(err.message);
        },
      });
      setIsRecording(true);
      await recorderRef.current.start();
    } catch (err) {
      setIsRecording(false);
      setRecordError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleStopRecording = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const handleRemoveVideo = useCallback(() => {
    setRecordedVideo(null);
  }, []);

  // Limpa recorder ao desmontar
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.cancel();
        recorderRef.current = null;
      }
    };
  }, []);

  if (!isOpen || !element) return null;

  if (isAnnotating && activeScreenshotUrl) {
    return (
      <ScreenshotAnnotationCanvas
        screenshotDataUrl={activeScreenshotUrl}
        sensitiveRects={sensitiveRects}
        onApply={handleApplyAnnotation}
        onCancel={handleCancelAnnotation}
      />
    );
  }

  const canRecord = typeof window !== 'undefined' && ScreenRecorder.isSupported();

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={handleClose}
      data-bug-detector-ui
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold">
              🐛
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Reportar Bug</h2>
              <p className="text-xs text-slate-400">
                Elemento: <code className="text-cyan-400">{element.tag}</code>
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting || isRecording}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-xl mx-auto space-y-6">
            {/* Elemento info */}
            <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Elemento Selecionado
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Tag:</span>
                  <code className="ml-2 px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded font-mono">
                    {element.tag}
                  </code>
                </div>
                <div>
                  <span className="text-slate-500">ID:</span>
                  <code className="ml-2 text-slate-300 font-mono">
                    {element.elementId || 'N/A'}
                  </code>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Seletor:</span>
                  <code className="ml-2 text-emerald-300 font-mono break-all text-xs">
                    {element.selector}
                  </code>
                </div>
                <div>
                  <span className="text-slate-500">Dimensões:</span>
                  <span className="ml-2 text-slate-300">
                    {Math.round(element.rect.width)} × {Math.round(element.rect.height)}px
                  </span>
                </div>
              </div>
            </div>

            {/* Tipo */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block">
                Tipo de Report
              </label>
              <div className="flex gap-3">
                {reportTypes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setType(t.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                      type === t.id
                        ? 'bg-slate-700 border-slate-500 text-white'
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${t.color}`} />
                    <span className="font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Severidade */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block">
                Severidade
              </label>
              <div className="flex gap-2">
                {severityLevels.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSeverity(s.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      severity === s.id
                        ? 'bg-slate-700 border-slate-500 text-white'
                        : 'bg-slate-800/30 border-slate-700/50 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-sm">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Descrição */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block">
                Descrição do Problema *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o problema encontrado..."
                rows={4}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 resize-none focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              />
            </div>

            {/* Comportamento esperado */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block">
                Comportamento Esperado (opcional)
              </label>
              <textarea
                value={expectedBehavior}
                onChange={(e) => setExpectedBehavior(e.target.value)}
                placeholder="Como deveria funcionar?"
                rows={2}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 resize-none focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              />
            </div>

            {/* Screenshot */}
            {activeScreenshotUrl && (
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeScreenshot}
                    onChange={(e) => setIncludeScreenshot(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-cyan-500"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-300">Incluir screenshot</span>
                  </div>
                </label>
                {includeScreenshot && (
                  <div className="mt-3 p-2 bg-slate-800/30 rounded-lg border border-slate-700/50 relative group">
                    <img
                      src={activeScreenshotUrl}
                      alt="Screenshot"
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => setIsAnnotating(true)}
                      className="absolute inset-0 m-auto w-fit h-fit px-4 py-2 bg-slate-900/90 text-white text-sm font-medium rounded-lg border border-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      ✏️ Anotar Screenshot
                    </button>
                    {annotatedScreenshotUrl && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-cyan-500 text-white text-xs font-medium rounded">
                        Anotado
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Screen Recording */}
            <div className="border-t border-slate-800 pt-4">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block">
                Gravação de Tela
              </label>

              {!canRecord && (
                <p className="text-sm text-slate-500">
                  Seu navegador não suporta gravação de tela.
                </p>
              )}

              {canRecord && !recordedVideo && !isRecording && (
                <button
                  onClick={handleStartRecording}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg border border-slate-600 transition-colors"
                >
                  <span>🔴</span>
                  Gravar Tela (10s)
                </button>
              )}

              {isRecording && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg border border-red-500/30">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                    </span>
                    <span className="text-sm font-medium">Gravando… {formatTime(recordProgress)}</span>
                  </div>
                  <button
                    onClick={handleStopRecording}
                    className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-md"
                  >
                    Parar
                  </button>
                </div>
              )}

              {recordError && (
                <p className="mt-2 text-sm text-red-400">{recordError}</p>
              )}

              {recordedVideo && (
                <div className="mt-2 space-y-2">
                  <video
                    src={recordedVideo}
                    controls
                    className="w-full h-32 rounded-lg bg-black"
                  />
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-emerald-400">✓ Vídeo gravado</span>
                    <button
                      onClick={handleRemoveVideo}
                      className="text-sm text-red-400 hover:text-red-300 underline"
                    >
                      Remover vídeo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <span className="text-xs text-slate-500">* Campo obrigatório</span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              disabled={isSubmitting || isRecording}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!description.trim() || isSubmitting || isRecording}
              className="flex items-center gap-2 px-6 py-2 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, #3b82f6)` }}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <span>➤</span>
                  Enviar Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
