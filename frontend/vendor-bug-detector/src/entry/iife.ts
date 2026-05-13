/**
 * Entry point IIFE — expõe BugDetectorAPI como window.BugDetector
 *
 * Uso: window.BugDetector.init({ ... })
 */

import { BugDetectorAPI } from '../adapters/vanilla';

// Em ambiente browser, attacha no global para acesso direto
if (typeof window !== 'undefined') {
  (window as any).BugDetector = BugDetectorAPI;
}

export default BugDetectorAPI;
