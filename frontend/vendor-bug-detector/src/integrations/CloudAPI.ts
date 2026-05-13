/**
 * CloudAPI
 * Cliente para enviar reports ao dashboard cloud do BugDetector
 */

import type { BugReport } from '../types';

export interface CloudAPIConfig {
  baseURL: string;
}

export class CloudAPI {
  private baseURL: string;

  constructor(config: CloudAPIConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, '');
  }

  /** Envia um report para a nuvem */
  async sendReport(report: BugReport): Promise<{ id: string; saved: boolean }> {
    const response = await fetch(`${this.baseURL}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error');
      throw new Error(`Cloud API error ${response.status}: ${text}`);
    }

    return response.json();
  }

  /** Verifica saúde da API */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/health`, { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export default CloudAPI;
