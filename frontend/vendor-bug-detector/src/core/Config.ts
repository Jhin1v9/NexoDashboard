/**
 * Gerenciamento de configuração do BugDetector
 */

import type { BugDetectorConfig, AIConfig, IntegrationsConfig, CaptureConfig, BrandingConfig, AutoErrorConfig, PrivacyConfig, RageClickConfig, VideoRecorderOptions } from '../types';

/** Configuração padrão */
export const DEFAULT_CONFIG: Required<BugDetectorConfig> = {
  trigger: 'floating-button',
  shortcut: 'Ctrl+Shift+D',
  headless: false,
  persistTo: 'localStorage',
  autoActivateInDev: false,
  zIndexBase: 999999,
  ai: {
    provider: 'none',
    apiKey: '',
    model: 'kimi-for-coding',
    baseURL: 'https://api.kimi.com/coding/v1',
    temperature: 0.3,
    timeout: 30000,
  },
  integrations: {},
  capture: {
    screenshot: true,
    console: true,
    network: true,
    performance: true,
    includeHTML: false,
    includeStyles: true,
  },
  callbacks: {},
  branding: {},
  guestMode: false,
  autoError: {
    enabled: true,
    captureConsoleErrors: true,
    captureResourceErrors: true,
    maxErrorsPerMinute: 30,
    sampleRate: 1.0,
    includeLocalhost: true,
    ignorePatterns: [
      /Script error\.?/i,
      /chrome-extension:\/\//i,
      /moz-extension:\/\//i,
      /ResizeObserver loop limit exceeded/i,
    ],
  },
  privacy: {
    enabled: true,
    maskPasswordInputs: true,
    maskCreditCards: true,
    maskEmails: true,
    maskPhones: true,
    maskTaxIds: true,
    maskApiKeys: true,
    maskSelectors: [],
    maskAttributes: ['data-bugdetector-mask', 'data-mask'],
    maskReplacement: '[REDACTED]',
    maskInScreenshots: false,
  },
  rageClick: {
    enabled: true,
    rageWindowMs: 1000,
    rageThreshold: 3,
    deadClickThresholdMs: 100,
    ignoreSelectors: ['[data-bug-detector-ui]', 'body', 'html'],
  },
  video: {
    maxDurationMs: 30000,
    quality: 'medium',
    audio: false,
  },
};

/** Classe de configuração — instância isolada por BugDetector */
export class Config {
  private config: Required<BugDetectorConfig>;

  constructor(userConfig: BugDetectorConfig = {}) {
    this.config = this.mergeConfig(DEFAULT_CONFIG, userConfig);
  }

  /** Merge de configurações */
  private mergeConfig(
    defaultConfig: Required<BugDetectorConfig>,
    userConfig: BugDetectorConfig
  ): Required<BugDetectorConfig> {
    const ai = { ...defaultConfig.ai, ...userConfig.ai };
    if (userConfig.ai?.provider && !userConfig.ai.model) {
      ai.model = this.getDefaultAIModel(userConfig.ai.provider);
    }
    if (userConfig.ai?.provider === 'kimi' && !userConfig.ai.baseURL) {
      ai.baseURL = 'https://api.kimi.com/coding/v1';
    }

    return {
      ...defaultConfig,
      ...userConfig,
      ai,
      integrations: { ...defaultConfig.integrations, ...userConfig.integrations },
      capture: { ...defaultConfig.capture, ...userConfig.capture },
      callbacks: { ...defaultConfig.callbacks, ...userConfig.callbacks },
      branding: { ...defaultConfig.branding, ...userConfig.branding },
      autoError: { ...defaultConfig.autoError, ...userConfig.autoError },
      privacy: { ...defaultConfig.privacy, ...userConfig.privacy },
      rageClick: { ...defaultConfig.rageClick, ...userConfig.rageClick },
      video: { ...defaultConfig.video, ...userConfig.video },
    };
  }

  private getDefaultAIModel(provider: AIConfig['provider']): string {
    const defaults: Record<AIConfig['provider'], string> = {
      kimi: 'kimi-for-coding',
      gemini: 'gemini-pro',
      openai: 'gpt-4o-mini',
      deepseek: 'deepseek-chat',
      none: 'kimi-for-coding',
    };

    return defaults[provider];
  }

  /** Obtém configuração completa */
  get(): Required<BugDetectorConfig> {
    return this.config;
  }

  /** Obtém configuração de IA */
  getAI(): Required<AIConfig> {
    return this.config.ai as Required<AIConfig>;
  }

  /** Obtém configuração de integrações */
  getIntegrations(): IntegrationsConfig {
    return this.config.integrations;
  }

  /** Obtém configuração de captura */
  getCapture(): Required<CaptureConfig> {
    return this.config.capture as Required<CaptureConfig>;
  }

  /** Obtém configuração de branding */
  getBranding(): BrandingConfig {
    return this.config.branding;
  }

  /** Verifica se está em modo guest */
  isGuestMode(): boolean {
    return this.config.guestMode;
  }

  /** Verifica se está em modo headless */
  isHeadless(): boolean {
    return this.config.headless;
  }

  /** Verifica se deve persistir */
  shouldPersist(): boolean {
    return this.config.persistTo !== 'none';
  }

  /** Obtém método de persistência */
  getPersistMethod(): 'localStorage' | 'indexedDB' | 'api' | 'none' {
    return this.config.persistTo;
  }

  /** Atualiza configuração */
  update(updates: Partial<BugDetectorConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
  }

  /** Reseta para padrão */
  reset(): void {
    this.config = DEFAULT_CONFIG;
  }
}

export default Config;
