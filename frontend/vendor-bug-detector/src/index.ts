/**
 * @auris/bug-detector
 * Ferramenta profissional de debug com IA para qualquer projeto web
 *
 * @example
 * ```typescript
 * // React
 * import { useBugDetector } from '@auris/bug-detector/react';
 *
 * // Vue
 * import { createBugDetector } from '@auris/bug-detector/vue';
 *
 * // Vanilla JS
 * import { BugDetector } from '@auris/bug-detector';
 * ```
 */

// Core
export { BugDetector } from './core/BugDetector';
export { Inspector } from './core/Inspector';
export { Config, DEFAULT_CONFIG } from './core/Config';

// Types
export type {
  BugDetectorConfig,
  AIConfig,
  IntegrationsConfig,
  GitHubConfig,
  JiraConfig,
  SlackConfig,
  WebhookConfig,
  CaptureConfig,
  BugDetectorCallbacks,
  InspectedElement,
  ParentInfo,
  BugReport,
  BugStats,
  ConsoleLog,
  NetworkRequest,
  PerformanceMetrics,
  CreateReportData,
  AIAdapter,
  AIAnalysis,
  BugCategory,
  PersonalityAnalysis,
  PersonalityType,
  CodeFix,
  ChatMessage,
  ChatSession,
  StorageAdapter,
  ReportFilters,
  ExportOptions,
  ExportResult,
  UseBugDetectorProps,
  UseBugDetectorReturn,
  AutoErrorConfig,
  PrivacyConfig,
  RageClickConfig,
  VideoRecorderOptions,
} from './types';

// UI React
export {
  BugDetectorOverlay,
  BugReportModal,
  BugTrackerPanel,
} from './ui';

// Hooks React
export {
  useBugDetector,
  BugDetectorContext,
  useConsoleCapture,
  useNetworkMonitor,
  useScreenCapture,
  useAIAnalyzer,
  useElementInspector,
} from './hooks';

// Intelligence
export { IntelligenceEngine } from './intelligence/IntelligenceEngine';
export { ReportGenerator } from './intelligence/ReportGenerator';

// Capture
export { CaptureManager } from './capture/CaptureManager';
export { VideoRecorder } from './capture/VideoRecorder';

// Storage
export { StorageManager } from './storage/StorageManager';

// Integrations
export { GitHubIntegration } from './integrations/GitHub';
export { JiraIntegration } from './integrations/Jira';
export { SlackIntegration } from './integrations/Slack';

// Utils
export { RateLimiter } from './utils/RateLimiter';
export { PrivacyMasking } from './utils/PrivacyMasking';
export { RageClickDetector } from './utils/RageClickDetector';

// DevTools
export {
  ConsoleCapture,
  NetworkMonitor,
  DeviceInfo,
  ScreenRecorder,
  AIAnalyzer,
  AutoErrorDetector,
} from './devtools';

// Version
export const VERSION = '2.0.0';

// Default export
export { BugDetector as default } from './core/BugDetector';
