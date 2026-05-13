/**
 * Hook useBugDetector
 * Acesso ao contexto do BugDetector no React
 */

import { createContext, useContext } from 'react';
import type { BugDetector } from '../core/BugDetector';
import type { UseBugDetectorReturn } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReactModule = any;

interface BugDetectorContextValue extends UseBugDetectorReturn {
  detector: BugDetector | null;
}

export const BugDetectorContext = createContext<BugDetectorContextValue | null>(null);

export function useBugDetector(): UseBugDetectorReturn {
  const context = useContext(BugDetectorContext);
  if (!context) {
    throw new Error('useBugDetector deve ser usado dentro de BugDetectorProvider');
  }
  return context;
}
