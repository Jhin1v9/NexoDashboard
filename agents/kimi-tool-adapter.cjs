/**
 * kimi-tool-adapter.cjs — Contrato de Interface Versionado para Tools Nativas Kimi → Luna
 *
 * Isola o mapeamento de tools nativas da Kimi para tools Luna em um único ponto.
 * Permite versionamento e facilita adaptação quando a Kimi muda sua API interna.
 *
 * @version 1.0.0
 */

const ADAPTER_VERSION = '1.0.0';

// ── Contrato de Interface ──
// Cada tool nativa da Kimi tem um adaptador que traduz args Kimi → params Luna
const ADAPTERS = {
  /**
   * ipython → executeShell (Python local)
   * Fidelidade: Total — Python roda igual localmente
   */
  ipython: {
    version: '1.0.0',
    fidelity: 'total',
    lunaTool: 'executeShell',
    adapt(args) {
      const code = args.code || args.input || args.query || args.command || '';
      if (!code) return { error: 'ipython: nenhum código fornecido' };

      // Security: base64 heredoc for multi-line safety
      const isMulti = code.includes('\n') || code.length > 200;
      let shellCmd;
      if (isMulti) {
        const b64 = Buffer.from(code, 'utf8').toString('base64');
        shellCmd = `python3 -c "import base64; exec(base64.b64decode('${b64}').decode('utf-8'))"`;
      } else {
        const safe = code.replace(/'/g, "'\\''");
        shellCmd = `python3 -c '${safe}'`;
      }
      return { command: shellCmd };
    },
  },

  /**
   * web_search → searchWeb (busca na web)
   * Fidelidade: Parcial — mesmo conceito, provedor diferente
   */
  web_search: {
    version: '1.0.0',
    fidelity: 'partial',
    lunaTool: 'searchWeb',
    adapt(args) {
      const query = args.query || args.q || args.search || args.text || '';
      if (!query) return { error: 'web_search: nenhuma query fornecida' };
      return { query: String(query) };
    },
  },

  /**
   * browser → fetchURL (navegação básica)
   * Fidelidade: Baixa — só fetch estático, sem interação (click, form, scroll)
   * NOTA: A tool nativa 'browser' da Kimi faz navegação completa. Nós só fazemos
   * fetch estático. Ações complexas devem usar 'computer' → desktop engine.
   */
  browser: {
    version: '1.0.0',
    fidelity: 'low',
    lunaTool: 'fetchURL',
    adapt(args) {
      const url = args.url || args.link || args.href || args.address || '';
      if (!url) return { error: 'browser: nenhuma URL fornecida' };
      // Validate URL scheme
      if (!/^https?:\/\//.test(url)) {
        return { error: `browser: URL inválida: ${url}` };
      }
      return { url: String(url) };
    },
  },

  /**
   * computer → desktop engine (ações de desktop)
   * Fidelidade: Parcial — mapeamos ações comuns, mas coordenadas exatas podem variar
   */
  computer: {
    version: '1.0.0',
    fidelity: 'partial',
    lunaTool: 'desktop',
    adapt(args) {
      const action = args.action || args.type || 'screenshot';
      const supported = ['click', 'type', 'keypress', 'hotkey', 'screenshot', 'scroll', 'wait', 'open_app'];
      if (!supported.includes(action)) {
        return { error: `computer: ação '${action}' não suportada. Use: ${supported.join(', ')}` };
      }
      const params = { ...args };
      delete params.action;
      delete params.type;
      return { action, params };
    },
  },
};

// ── KimiToolAdapter Class ──
class KimiToolAdapter {
  constructor(version = ADAPTER_VERSION) {
    this.version = version;
    this.adapters = { ...ADAPTERS };
  }

  /**
   * Adapta uma tool call nativa da Kimi para params Luna.
   * @param {string} toolName — nome da tool nativa (ipython, browser, etc.)
   * @param {object} args — argumentos da tool nativa
   * @returns {{ lunaTool: string, params: object, fidelity: string, version: string } | { error: string }}
   */
  adapt(toolName, args) {
    const adapter = this.adapters[toolName];
    if (!adapter) {
      return { error: `Adapter: tool nativa '${toolName}' não suportada (versão ${this.version})` };
    }
    const params = adapter.adapt(args);
    if (params.error) return { error: params.error };

    return {
      lunaTool: adapter.lunaTool,
      params,
      fidelity: adapter.fidelity,
      version: adapter.version,
    };
  }

  /**
   * Lista todas as tools nativas suportadas com sua fidelidade.
   */
  listSupported() {
    return Object.entries(this.adapters).map(([name, a]) => ({
      name,
      lunaTool: a.lunaTool,
      fidelity: a.fidelity,
      version: a.version,
    }));
  }

  /**
   * Verifica se uma tool nativa é suportada.
   */
  isSupported(toolName) {
    return toolName in this.adapters;
  }
}

module.exports = {
  KimiToolAdapter,
  ADAPTER_VERSION,
  ADAPTERS,
};
