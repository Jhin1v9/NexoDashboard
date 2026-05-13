/**
 * DeviceInfo - Informações do dispositivo e navegador
 */

import type { DeviceInfo as DeviceInfoType } from '../types';

/** Classe para obter informações do dispositivo */
export class DeviceInfo {
  /** Retorna as informações do dispositivo */
  static getInfo(): DeviceInfoType {
    const ua = navigator.userAgent;

    return {
      os: this.getOS(ua),
      browser: this.getBrowser(ua),
      resolution: `${window.screen.width}x${window.screen.height}`,
      userAgent: ua,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  /** Retorna o sistema operacional */
  private static getOS(ua: string): string {
    if (ua.includes('Windows NT 10.0')) return 'Windows 10/11';
    if (ua.includes('Windows NT 6.3')) return 'Windows 8.1';
    if (ua.includes('Windows NT 6.2')) return 'Windows 8';
    if (ua.includes('Windows NT 6.1')) return 'Windows 7';
    if (ua.includes('Macintosh')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) return 'iOS';
    return 'Unknown';
  }

  /** Retorna o navegador */
  private static getBrowser(ua: string): string {
    if (ua.includes('Chrome') && !ua.includes('Edg')) {
      const match = ua.match(/Chrome\/(\d+\.\d+)/);
      return match ? `Chrome ${match[1]}` : 'Chrome';
    }
    if (ua.includes('Firefox')) {
      const match = ua.match(/Firefox\/(\d+\.\d+)/);
      return match ? `Firefox ${match[1]}` : 'Firefox';
    }
    if (ua.includes('Safari') && !ua.includes('Chrome')) {
      const match = ua.match(/Version\/(\d+\.\d+)/);
      return match ? `Safari ${match[1]}` : 'Safari';
    }
    if (ua.includes('Edg')) {
      const match = ua.match(/Edg\/(\d+\.\d+)/);
      return match ? `Edge ${match[1]}` : 'Edge';
    }
    return 'Unknown';
  }

  /** Retorna informações de performance */
  static getPerformanceInfo(): {
    lcp?: number;
    fcp?: number;
    ttfb?: number;
    memory?: {
      used: number;
      total: number;
      limit: number;
    };
  } {
    const perf = performance;
    const memory = (perf as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;

    return {
      memory: memory ? {
        used: Math.round(memory.usedJSHeapSize / 1048576), // MB
        total: Math.round(memory.totalJSHeapSize / 1048576),
        limit: Math.round(memory.jsHeapSizeLimit / 1048576),
      } : undefined,
    };
  }

  /** Retorna informações da viewport */
  static getViewportInfo(): {
    width: number;
    height: number;
    devicePixelRatio: number;
    orientation: 'portrait' | 'landscape';
  } {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
    };
  }
}

export default DeviceInfo;
