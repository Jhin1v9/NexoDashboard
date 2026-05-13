/**
 * React Adapter para BugDetector
 * Provider, hook e componentes UI integrados
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

import { BugDetector } from '../core/BugDetector';
import { BugDetectorContext, useBugDetector } from '../hooks/useBugDetector';
import { BugDetectorOverlay, BugReportModal, BugTrackerPanel } from '../ui';
import type {
  BugDetectorConfig,
  InspectedElement,
  BugReport,
  CreateReportData,
  ExportOptions,
  ExportResult,
  UseBugDetectorProps,
} from '../types';

// Re-export hook para conveniência
export { useBugDetector, BugDetectorContext };

/** Provider do BugDetector */
interface BugDetectorProviderProps {
  children: ReactNode;
  config?: BugDetectorConfig;
}

export function BugDetectorProvider({
  children,
  config = {},
}: BugDetectorProviderProps): JSX.Element {
  const detectorRef = useRef<BugDetector | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [selectedElement, setSelectedElement] = useState<InspectedElement | null>(null);
  const [reports, setReports] = useState<BugReport[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);

  // Inicializa detector em modo headless (UI controlada pelo React)
  useEffect(() => {
    detectorRef.current = new BugDetector({
      ...config,
      headless: true,
      callbacks: {
        ...config.callbacks,
        onActivate: () => {
          setIsActive(true);
          config.callbacks?.onActivate?.();
        },
        onDeactivate: () => {
          setIsActive(false);
          setSelectedElement(null);
          // Não fecha o modal aqui — ele é controlado pelo fluxo de inspeção
          config.callbacks?.onDeactivate?.();
        },
        onElementSelected: (element) => {
          setSelectedElement(element);
          config.callbacks?.onElementSelected?.(element);
        },
        onReportCreated: (report) => {
          setReports((prev) => [...prev, report]);
          config.callbacks?.onReportCreated?.(report);
        },
      },
    });

    setReports(detectorRef.current.getReports());

    if (config.autoActivateInDev && typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      detectorRef.current.activate();
    }

    return () => {
      detectorRef.current?.destroy();
    };
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    if (!config.shortcut) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const keys = config.shortcut!.toLowerCase().split('+');
      const hasCtrl = keys.includes('ctrl') || keys.includes('control');
      const hasShift = keys.includes('shift');
      const hasAlt = keys.includes('alt');
      const key = keys.find((k) => !['ctrl', 'control', 'shift', 'alt'].includes(k));

      if (
        e.ctrlKey === hasCtrl &&
        e.shiftKey === hasShift &&
        e.altKey === hasAlt &&
        e.key.toLowerCase() === key
      ) {
        e.preventDefault();
        detectorRef.current?.toggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config.shortcut]);

  const activate = useCallback(() => detectorRef.current?.activate(), []);
  const deactivate = useCallback(() => detectorRef.current?.deactivate(), []);
  const toggle = useCallback(() => detectorRef.current?.toggle(), []);

  const createReport = useCallback(async (data: CreateReportData): Promise<BugReport> => {
    if (!detectorRef.current) throw new Error('BugDetector não inicializado');
    const report = await detectorRef.current.createReport(data);
    return report;
  }, []);

  const exportReport = useCallback(async (reportId: string, options: ExportOptions): Promise<ExportResult> => {
    if (!detectorRef.current) throw new Error('BugDetector não inicializado');
    return detectorRef.current.exportReport(reportId, options);
  }, []);

  const resolveReport = useCallback(async (id: string): Promise<void> => {
    if (!detectorRef.current) return;
    await detectorRef.current.resolveReport(id);
    setReports(detectorRef.current.getReports());
  }, []);

  const deleteReport = useCallback(async (id: string): Promise<void> => {
    if (!detectorRef.current) return;
    await detectorRef.current.deleteReport(id);
    setReports(detectorRef.current.getReports());
  }, []);

  const stats = useMemo(() => {
    return detectorRef.current?.getStats() ?? {
      total: 0, pending: 0, resolved: 0,
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      byType: { bug: 0, improvement: 0, question: 0 },
    };
  }, [reports]);

  const handleElementClick = useCallback(async (element: InspectedElement) => {
    setSelectedElement(element);
    // Captura screenshot simples
    try {
      const canvas = await import('html2canvas').then((m) => m.default);
      const c = await canvas(document.body, {
        logging: false,
        useCORS: true,
        allowTaint: true,
        scale: 1,
      });
      setScreenshotDataUrl(c.toDataURL('image/png'));
    } catch {
      setScreenshotDataUrl(null);
    }
    setIsModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedElement(null);
  }, []);

  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);

  const value = {
    isActive,
    activate,
    deactivate,
    toggle,
    selectedElement,
    reports,
    stats,
    createReport,
    exportReport,
    resolveReport,
    deleteReport,
    openPanel,
    closePanel,
    detector: detectorRef.current,
  };

  const showUI = !config.headless;

  return (
    <BugDetectorContext.Provider value={value}>
      {children}
      {showUI && (
        <>
          <BugDetectorOverlay
            isActive={isActive && !isModalOpen}
            selectedElement={selectedElement}
            onDeactivate={deactivate}
            reportCount={reports.length}
            onElementClick={handleElementClick}
            onOpenPanel={openPanel}
          />
          <BugReportModal
            isOpen={isModalOpen}
            element={selectedElement}
            screenshotDataUrl={screenshotDataUrl}
            onClose={handleModalClose}
            onSubmit={createReport}
            primaryColor={config.branding?.primaryColor}
          />
          <BugTrackerPanel
            isOpen={isPanelOpen}
            reports={reports}
            stats={stats}
            onClose={() => setIsPanelOpen(false)}
            onResolve={resolveReport}
            onDelete={deleteReport}
            onSyncGitHub={detectorRef.current ? (id) => detectorRef.current!.syncGitHubStatus(id) : undefined}
            primaryColor={config.branding?.primaryColor}
          />
        </>
      )}
    </BugDetectorContext.Provider>
  );
}

/** Botão flutuante para ativar o BugDetector */
interface FloatingButtonProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  color?: string;
}

export function BugDetectorFloatingButton({
  position = 'bottom-right',
  color = '#3b82f6',
}: FloatingButtonProps): JSX.Element {
  const { isActive, toggle, openPanel, reports } = useBugDetector();
  const [menuOpen, setMenuOpen] = useState(false);

  const positionStyles: Record<string, React.CSSProperties> = {
    'top-left': { top: 20, left: 20 },
    'top-right': { top: 20, right: 20 },
    'bottom-left': { bottom: 20, left: 20 },
    'bottom-right': { bottom: 20, right: 20 },
  };

  const p = positionStyles[position];

  return (
    <>
      {/* Menu secundário */}
      {menuOpen && (
        <div
          style={{
            position: 'fixed',
            ...p,
            zIndex: 2147483646,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginBottom: position.startsWith('bottom') ? 64 : undefined,
            marginTop: position.startsWith('top') ? 64 : undefined,
            ...(position.startsWith('bottom') ? { bottom: 84 } : {}),
            ...(position.startsWith('top') ? { top: 84 } : {}),
            ...(position.endsWith('left') ? { left: 20 } : {}),
            ...(position.endsWith('right') ? { right: 20 } : {}),
          }}
        >
          <button
            onClick={() => { openPanel(); setMenuOpen(false); }}
            style={{
              padding: '8px 14px',
              background: 'rgba(15,23,42,0.95)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              backdropFilter: 'blur(8px)',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            📋 Ver Reports {reports.length > 0 && <span style={{ background: color, borderRadius: 10, padding: '2px 6px', fontSize: 11 }}>{reports.length}</span>}
          </button>
        </div>
      )}

      <button
        onClick={(e) => {
          if (e.shiftKey) {
            openPanel();
          } else {
            toggle();
          }
          setMenuOpen(false);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen((v) => !v);
        }}
        style={{
          position: 'fixed',
          ...p,
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: isActive ? '#ef4444' : color,
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          zIndex: 2147483647,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          transition: 'all 0.2s',
        }}
        title={isActive ? 'Desativar Debug (Shift+Click p/ painel, RMB p/ menu)' : 'Ativar Debug'}
        aria-label={isActive ? 'Desativar Debug' : 'Ativar Debug'}
      >
        {isActive ? '✕' : '🐛'}
      </button>
    </>
  );
}

/** Hook avançado com configuração completa */
export function useBugDetectorAdvanced(
  props: UseBugDetectorProps = {}
): ReturnType<typeof useBugDetector> & {
  detector: BugDetector | null;
  refreshReports: () => Promise<void>;
  analyzeWithAI: (reportId: string) => Promise<void>;
  createGitHubIssue: (reportId: string, repo?: string) => Promise<void>;
  syncGitHubStatus: (reportId: string) => Promise<void>;
  notifySlack: (reportId: string, channel?: string) => Promise<void>;
  openPanel: () => void;
  closePanel: () => void;
  isPanelOpen: boolean;
} {
  const base = useBugDetector();
  const [localReports, setLocalReports] = useState<BugReport[]>(base.reports);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const detectorRef = useRef<BugDetector | null>(base.detector);

  useEffect(() => {
    detectorRef.current = base.detector;
  }, [base.detector]);

  const refreshReports = useCallback(async () => {
    if (!detectorRef.current) return;
    setLocalReports(detectorRef.current.getReports());
  }, []);

  const analyzeWithAI = useCallback(async (reportId: string) => {
    if (!detectorRef.current) return;
    await detectorRef.current.analyzeReport(reportId);
    await refreshReports();
  }, [refreshReports]);

  const createGitHubIssue = useCallback(async (reportId: string, repo?: string) => {
    if (!detectorRef.current) return;
    await detectorRef.current.createGitHubIssue(reportId, repo);
  }, []);

  const syncGitHubStatus = useCallback(async (reportId: string) => {
    if (!detectorRef.current) return;
    await detectorRef.current.syncGitHubStatus(reportId);
    await refreshReports();
  }, [refreshReports]);

  const notifySlack = useCallback(async (reportId: string, channel?: string) => {
    if (!detectorRef.current) return;
    await detectorRef.current.notifySlack(reportId, channel);
  }, []);

  return {
    ...base,
    reports: localReports.length > 0 ? localReports : base.reports,
    detector: detectorRef.current,
    refreshReports,
    analyzeWithAI,
    createGitHubIssue,
    syncGitHubStatus,
    notifySlack,
    openPanel: () => setIsPanelOpen(true),
    closePanel: () => setIsPanelOpen(false),
    isPanelOpen,
  };
}

export default useBugDetector;
