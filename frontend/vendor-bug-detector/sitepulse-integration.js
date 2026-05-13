/**
 * SitePulse Integration — Preload Script para Electron
 *
 * Injeta o Bug Detector no <webview> do SitePulse e comunica
 * os reports capturados para o renderer principal via IPC.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Configurações injetadas pelo main process
const BUG_DETECTOR_CONFIG = {
  cloudBaseURL: process.env.BUGDETECTOR_CLOUD_URL || 'http://localhost:3456',
  shortcut: 'Ctrl+Shift+D',
  guestMode: true,
};

// Código que será injetado no webview
const INJECT_SCRIPT = `
(function() {
  if (window.__bugDetectorInjected) return;
  window.__bugDetectorInjected = true;

  const script = document.createElement('script');
  script.type = 'module';
  script.textContent = \`
    import { initBugDetector } from '${process.env.BUGDETECTOR_SCRIPT_URL || './bug-detector.iife.js'}';
    initBugDetector({
      shortcut: '${BUG_DETECTOR_CONFIG.shortcut}',
      guestMode: ${BUG_DETECTOR_CONFIG.guestMode},
      integrations: {
        cloud: { baseURL: '${BUG_DETECTOR_CONFIG.cloudBaseURL}' }
      },
      callbacks: {
        onReportCreated: (report) => {
          window.postMessage({ source: 'bug-detector', type: 'report-created', payload: report }, '*');
        }
      }
    });
  \`;
  document.head.appendChild(script);
})();
`;

// Escuta reports do webview e repassa para o renderer principal
window.addEventListener('message', (event) => {
  if (event.data?.source === 'bug-detector') {
    ipcRenderer.send('bug-detector:message', event.data);
  }
});

// API exposta ao renderer do SitePulse
contextBridge.exposeInMainWorld('bugDetectorBridge', {
  getInjectScript: () => INJECT_SCRIPT,
  onReportCreated: (callback) => {
    ipcRenderer.on('bug-detector:report', (_, report) => callback(report));
  },
  onMessage: (callback) => {
    ipcRenderer.on('bug-detector:message', (_, data) => callback(data));
  },
});
