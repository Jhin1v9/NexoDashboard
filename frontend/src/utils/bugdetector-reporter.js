/**
 * BugDetector Reporter - Integração com backend NEXO
 * 
 * Este script intercepta os reports do BugDetector e os envia
 * para o backend do NEXO Dashboard para persistência.
 * 
 * Uso: Importe no main.jsx antes do BugDetectorProvider
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3456';

/**
 * Envia um report para o backend
 */
async function sendReportToBackend(report) {
  try {
    const response = await fetch(`${API_BASE}/api/bugdetector/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(report),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('[BugDetector Reporter] Report enviado:', result.filename);
    return result;
  } catch (error) {
    console.error('[BugDetector Reporter] Erro ao enviar report:', error);
    // Não lança erro para não quebrar o fluxo do BugDetector
    return null;
  }
}

/**
 * Intercepta o localStorage do BugDetector para capturar novos reports
 */
export function setupBugDetectorReporter() {
  console.log('[BugDetector Reporter] Inicializando...');

  // Guarda a referência original do localStorage.setItem
  const originalSetItem = Storage.prototype.setItem;
  
  // Intercepta setItem para detectar quando o BugDetector salva um report
  Storage.prototype.setItem = function(key, value) {
    // Chama o original primeiro
    originalSetItem.call(this, key, value);
    
    // Verifica se é um report do BugDetector
    if (key.startsWith('bugdetector_') || key.startsWith('bd_')) {
      try {
        const data = JSON.parse(value);
        
        // Se for um array de reports ou um report individual
        if (Array.isArray(data)) {
          // É uma lista de reports, pega o último
          const latestReport = data[data.length - 1];
          if (latestReport && latestReport.id) {
            sendReportToBackend(latestReport);
          }
        } else if (data.id && data.timestamp) {
          // É um report individual
          sendReportToBackend(data);
        }
      } catch (e) {
        // Não é JSON válido, ignora
      }
    }
  };

  console.log('[BugDetector Reporter] Interceptação ativada ✓');
}

/**
 * Hook para usar com o BugDetectorProvider
 * Captura o evento de submit do report
 */
export function useBugDetectorReporter() {
  return {
    onReportSubmit: async (report) => {
      await sendReportToBackend(report);
    },
    
    onReportExport: async (report, format) => {
      if (format === 'json' || format === 'markdown') {
        await sendReportToBackend(report);
      }
    }
  };
}

/**
 * Configuração para passar ao BugDetectorProvider
 */
export const bugDetectorReporterConfig = {
  callbacks: {
    onReportSubmit: async (report) => {
      await sendReportToBackend(report);
    },
    onReportExport: async (report) => {
      await sendReportToBackend(report);
    }
  }
};

export default {
  setupBugDetectorReporter,
  useBugDetectorReporter,
  bugDetectorReporterConfig,
  sendReportToBackend
};
