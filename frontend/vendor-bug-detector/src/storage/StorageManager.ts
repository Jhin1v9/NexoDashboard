/**
 * Gerenciador de Storage
 * Abstrai diferentes métodos de persistência
 */

import type { BugReport, StorageAdapter, ReportFilters } from '../types';

/** Classe StorageManager */
export class StorageManager implements StorageAdapter {

  private adapter: StorageAdapter;

  constructor(method: 'localStorage' | 'indexedDB' | 'api' | 'none' = 'localStorage') {

    this.adapter = this.createAdapter(method);
  }

  /** Cria adapter baseado no método */
  private createAdapter(method: 'localStorage' | 'indexedDB' | 'api' | 'none'): StorageAdapter {
    switch (method) {
      case 'localStorage':
        return new LocalStorageAdapter();
      case 'indexedDB':
        return new IndexedDBAdapter();
      case 'api':
        return new APIAdapter();
      case 'none':
      default:
        return new NoOpAdapter();
    }
  }

  async save(report: BugReport): Promise<void> {
    return this.adapter.save(report);
  }

  async get(id: string): Promise<BugReport | null> {
    return this.adapter.get(id);
  }

  async getAll(): Promise<BugReport[]> {
    return this.adapter.getAll();
  }

  async delete(id: string): Promise<void> {
    return this.adapter.delete(id);
  }

  async update(id: string, data: Partial<BugReport>): Promise<void> {
    return this.adapter.update(id, data);
  }

  /** Busca com filtros */
  async search(filters: ReportFilters): Promise<BugReport[]> {
    let reports = await this.getAll();

    if (filters.status) {
      reports = reports.filter(r => r.status === filters.status);
    }

    if (filters.severity) {
      reports = reports.filter(r => r.severity === filters.severity);
    }

    if (filters.category && filters.category !== 'other') {
      reports = reports.filter(r => r.aiAnalysis?.category === filters.category);
    }

    if (filters.dateFrom) {
      reports = reports.filter(r => new Date(r.timestamp).getTime() >= filters.dateFrom!.getTime());
    }

    if (filters.dateTo) {
      reports = reports.filter(r => new Date(r.timestamp).getTime() <= filters.dateTo!.getTime());
    }

    if (filters.search) {
      const term = filters.search.toLowerCase();
      reports = reports.filter(r => 
        r.description.toLowerCase().includes(term) ||
        r.element.selector.toLowerCase().includes(term) ||
        r.url.toLowerCase().includes(term)
      );
    }

    return reports;
  }
}

// ============================================================================
// ADAPTERS
// ============================================================================

/** localStorage Adapter */
class LocalStorageAdapter implements StorageAdapter {
  private readonly STORAGE_KEY = 'bug_detector_reports';
  private readonly REPORT_PREFIX = 'bug_report_';

  async save(report: BugReport): Promise<void> {
    // Salva metadados
    const reports = await this.getAll();
    const existingIndex = reports.findIndex(r => r.id === report.id);
    
    if (existingIndex >= 0) {
      reports[existingIndex] = report;
    } else {
      reports.push(report);
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(reports.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      status: r.status,
      severity: r.severity,
      type: r.type,
      url: r.url,
      description: r.description.slice(0, 100),
    }))));

    // Salva report completo separadamente
    localStorage.setItem(this.REPORT_PREFIX + report.id, JSON.stringify(report));
  }

  async get(id: string): Promise<BugReport | null> {
    const data = localStorage.getItem(this.REPORT_PREFIX + id);
    return data ? JSON.parse(data) : null;
  }

  async getAll(): Promise<BugReport[]> {
    const reports: BugReport[] = [];
    const keys = Object.keys(localStorage);
    
    for (const key of keys) {
      if (key.startsWith(this.REPORT_PREFIX)) {
        const data = localStorage.getItem(key);
        if (data) {
          reports.push(JSON.parse(data));
        }
      }
    }

    return reports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async delete(id: string): Promise<void> {
    const reports = await this.getAll();
    const filtered = reports.filter(r => r.id !== id);
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      status: r.status,
      severity: r.severity,
      type: r.type,
      url: r.url,
      description: r.description.slice(0, 100),
    }))));

    localStorage.removeItem(this.REPORT_PREFIX + id);
  }

  async update(id: string, data: Partial<BugReport>): Promise<void> {
    const report = await this.get(id);
    if (report) {
      await this.save({ ...report, ...data });
    }
  }
}

/** IndexedDB Adapter (para grandes volumes) */
class IndexedDBAdapter implements StorageAdapter {
  private readonly DB_NAME = 'BugDetectorDB';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'reports';
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('severity', 'severity', { unique: false });
        }
      };
    });
  }

  async save(report: BugReport): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put(report);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async get(id: string): Promise<BugReport | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(): Promise<BugReport[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.index('timestamp').openCursor(null, 'prev');
      const reports: BugReport[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          reports.push(cursor.value);
          cursor.continue();
        } else {
          resolve(reports);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async update(id: string, data: Partial<BugReport>): Promise<void> {
    const report = await this.get(id);
    if (report) {
      await this.save({ ...report, ...data });
    }
  }
}

/** API Adapter (para backend próprio) */
class APIAdapter implements StorageAdapter {
  private baseURL: string;
  private headers: Record<string, string>;

  constructor() {
    this.baseURL = '/api/bug-detector';
    this.headers = {
      'Content-Type': 'application/json',
    };
  }

  async save(report: BugReport): Promise<void> {
    const response = await fetch(`${this.baseURL}/reports`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(report),
    });

    if (!response.ok) {
      throw new Error(`Erro ao salvar: ${response.statusText}`);
    }
  }

  async get(id: string): Promise<BugReport | null> {
    const response = await fetch(`${this.baseURL}/reports/${id}`);
    if (!response.ok) return null;
    return response.json();
  }

  async getAll(): Promise<BugReport[]> {
    const response = await fetch(`${this.baseURL}/reports`);
    if (!response.ok) return [];
    return response.json();
  }

  async delete(id: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/reports/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Erro ao deletar: ${response.statusText}`);
    }
  }

  async update(id: string, data: Partial<BugReport>): Promise<void> {
    const response = await fetch(`${this.baseURL}/reports/${id}`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Erro ao atualizar: ${response.statusText}`);
    }
  }
}

/** No-op Adapter (quando persistência está desabilitada) */
class NoOpAdapter implements StorageAdapter {
  async save(): Promise<void> {}
  async get(): Promise<null> { return null; }
  async getAll(): Promise<BugReport[]> { return []; }
  async delete(): Promise<void> {}
  async update(): Promise<void> {}
}

export default StorageManager;
