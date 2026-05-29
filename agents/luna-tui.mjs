#!/usr/bin/env node
/**
 * Luna TUI v3.3 — Interface Terminal com Ink + React
 * Arquitetura inspirada em ShellAgent, Claude Code, Gemini CLI
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { render, Box, Text, useInput, useApp, useWindowSize } from 'ink';
import { Spinner, Badge } from '@inkjs/ui';
import { LunaSoul } from './luna-soul.cjs';
import { SessionManager } from './session-manager.cjs';
import { workspaceManager } from './luna-workspace.cjs';
import { execSync, spawn } from 'child_process';
import { cleanThinking, getThinkingMetrics, stripResponseTags } from './thinking-cleaner.cjs';

const h = React.createElement;

// ═══════════════════════════════════════════════════════════════════════════
// CORES E ESTILO
// ═══════════════════════════════════════════════════════════════════════════

const C = {
  headerBg: '#1a1a2e',
  headerFg: '#e0e0e0',
  dim: '#666666',
  user: '#4fc3f7',
  luna: '#ce93d8',
  tool: '#ffd54f',
  success: '#81c784',
  error: '#e57373',
  warning: '#ffb74d',
  system: '#aaaaaa',
  input: '#ffffff',
  border: '#444444',
  code: '#ff79c6',
  codeBg: '#2d2d4a',
  path: '#8be9fd',
  url: '#bd93f9',
  command: '#50fa7b',
  thinkingBg: '#1a1a2e',
};

const PERSONA_COLORS = {
  default: C.luna,
  dev: C.user,
  architect: C.user,
  devops: C.success,
  product: C.warning,
  surgeon: C.error,
};

// ═══════════════════════════════════════════════════════════════════════════
// RICH TEXT PARSER — Markdown + Syntax Highlighting para Terminal
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Quebra uma linha em segmentos tipados para renderização rica no Ink.
 * Detecta: **negrito**, *itálico*, `código`, /paths, https://urls, comandos shell
 */
function tokenizeRichText(line) {
  const tokens = [];
  let remaining = line;

  // Ordem de prioridade: code > bold > italic > path > url > command
  const patterns = [
    { regex: /^(```[^`]*```|``[^`]*``|`[^`]+`)/, type: 'code' },
    { regex: /^\*\*([^*]+)\*\*/, type: 'bold' },
    { regex: /^\*([^*]+)\*/, type: 'italic' },
    { regex: /^(\/[^\s:;|&<>"'{}()[\]]+|~\/[^\s:;|&<>"'{}()[\]]*)/, type: 'path' },
    { regex: /^https?:\/\/[^\s]+/, type: 'url' },
  ];

  while (remaining.length > 0) {
    let matched = false;
    for (const { regex, type } of patterns) {
      const m = remaining.match(regex);
      if (m) {
        const raw = m[0];
        // Extrai conteúdo interno para code/bold/italic
        let text = raw;
        if (type === 'code') {
          // Remove backticks
          const backticks = raw.match(/^(`+)/)[1];
          text = raw.slice(backticks.length, raw.length - backticks.length);
        } else if (type === 'bold') {
          text = m[1];
        } else if (type === 'italic') {
          text = m[1];
        }
        tokens.push({ type, text: text || raw });
        remaining = remaining.slice(raw.length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Pega texto comum até o próximo caractere especial
      const nextSpecial = remaining.search(/[`*\/]|https?:/);
      const take = nextSpecial === -1 ? remaining.length : nextSpecial;
      if (take === 0) {
        // Caractere especial isolado, consome 1
        tokens.push({ type: 'text', text: remaining[0] });
        remaining = remaining.slice(1);
      } else {
        tokens.push({ type: 'text', text: remaining.slice(0, take) });
        remaining = remaining.slice(take);
      }
    }
  }
  return tokens;
}

/**
 * Converte tokens de uma linha em array de componentes Ink <Text>.
 * O chamador deve embrulhar em <Box flexDirection="row">.
 */
function renderRichLine(line, baseColor = C.input, baseDim = false) {
  const tokens = tokenizeRichText(line);
  if (tokens.length === 1 && tokens[0].type === 'text') {
    // Linha simples, sem formatação — retorna array com um Text
    return [h(Text, { color: baseColor, dimColor: baseDim, wrap: 'wrap' }, line || ' ')];
  }
  return tokens.map((tok, i) => {
    const key = `${i}-${tok.text.slice(0, 10)}`;
    switch (tok.type) {
      case 'bold':
        return h(Text, { key, color: baseColor, bold: true, wrap: 'wrap' }, tok.text);
      case 'italic':
        return h(Text, { key, color: baseColor, italic: true, wrap: 'wrap' }, tok.text);
      case 'code':
        return h(Text, { key, color: C.code, backgroundColor: C.codeBg, wrap: 'wrap' }, tok.text);
      case 'path':
        return h(Text, { key, color: C.path, wrap: 'wrap' }, tok.text);
      case 'url':
        return h(Text, { key, color: C.url, wrap: 'wrap' }, tok.text);
      default:
        return h(Text, { key, color: baseColor, dimColor: baseDim, wrap: 'wrap' }, tok.text);
    }
  });
}

/**
 * Renderiza múltiplas linhas com parsing rico.
 * Detecta blocos de código delimitados por ```
 */
function renderRichText(text, baseColor = C.input, baseDim = false) {
  if (!text) return [];
  const lines = text.split('\n');
  const result = [];
  let inCodeBlock = false;
  let codeBuffer = [];
  let codeLang = '';
  let lineIdx = 0;

  for (const line of lines) {
    const trimmed = line.trimStart();
    const isFence = trimmed.startsWith('```');

    if (isFence && !inCodeBlock) {
      inCodeBlock = true;
      codeLang = trimmed.slice(3).trim();
      codeBuffer = [];
      continue;
    }
    if (isFence && inCodeBlock) {
      inCodeBlock = false;
      // Renderiza bloco de código
      result.push(
        h(Box, {
          key: `code-${lineIdx++}`,
          flexDirection: 'column',
          borderStyle: 'single',
          borderColor: '#333355',
          backgroundColor: C.codeBg,
          paddingX: 1,
          paddingY: 0,
          marginY: 1,
          width: '95%',
        },
          codeLang && h(Text, { color: C.dim, dimColor: true, italic: true }, codeLang),
          ...codeBuffer.map((cl, i) =>
            h(Text, { key: i, color: C.code, wrap: 'wrap' }, cl || ' ')
          )
        )
      );
      codeBuffer = [];
      codeLang = '';
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
    } else {
      result.push(
        h(Box, { key: `line-${lineIdx++}`, flexDirection: 'row', flexWrap: 'wrap' },
          ...renderRichLine(line, baseColor, baseDim)
        )
      );
    }
  }

  // Se terminou com bloco de código aberto, renderiza o que sobrou
  if (inCodeBlock && codeBuffer.length > 0) {
    result.push(
      h(Box, {
        key: `code-end`,
        flexDirection: 'column',
        borderStyle: 'single',
        borderColor: '#333355',
        backgroundColor: C.codeBg,
        paddingX: 1,
        paddingY: 0,
        marginY: 1,
        width: '95%',
      },
        ...codeBuffer.map((cl, i) =>
          h(Text, { key: i, color: C.code, wrap: 'wrap' }, cl || ' ')
        )
      )
    );
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════════════════

function fmtTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ''; }
}

function formatDuration(ms) {
  if (!ms || ms < 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function estimateTokens(text) {
  if (!text) return 0;
  // Rough estimate: ~4 chars per token for English/Portuguese
  return Math.ceil(text.length / 4);
}

function renderProgressBar(percent, width = 10) {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

let _idCounter = 0;
function nextId() {
  return `${Date.now()}-${++_idCounter}-${Math.random().toString(36).slice(2, 5)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTES
// ═══════════════════════════════════════════════════════════════════════════

function Header({ session, msgCount }) {
  const id = session?.id?.slice(0, 8) || '????';
  const title = (session?.title || 'Nova sessão').slice(0, 24);
  const mode = session?.mode || 'thinking';
  const persona = session?.persona || 'default';
  const yolo = session?.yoloMode;
  const pColor = PERSONA_COLORS[persona] || C.luna;

  return h(Box, { flexDirection: 'row', width: '100%', height: 1, backgroundColor: C.headerBg },
    h(Text, { color: C.headerFg, bold: true }, ' 🌙 Luna'),
    h(Text, { color: C.dim }, ` │ ${title}`),
    h(Text, { color: C.dim }, ` │ ${id} │ ${msgCount} msgs │ `),
    h(Text, { color: pColor, bold: true }, persona),
    h(Text, { color: C.dim }, ` │ ${mode} `),
    yolo && h(Text, { color: C.error, bold: true }, ' 🔥YOLO')
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL CALL VISUAL SYSTEM — digno e extraordinário
// ═══════════════════════════════════════════════════════════════════════════

const SPINNER_FRAMES = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];

// Categorize tools by semantic action
function getToolCategory(tool) {
  const t = (tool || '').toLowerCase();
  if (t.includes('read') || t.includes('view') || t.includes('cat') || t.includes('fetch') || t.includes('get')) return 'read';
  if (t.includes('write') || t.includes('edit') || t.includes('save') || t.includes('create') || t.includes('touch')) return 'write';
  if (t.includes('shell') || t.includes('exec') || t.includes('run') || t.includes('cmd') || t.includes('npm') || t.includes('git')) return 'shell';
  if (t.includes('search') || t.includes('find') || t.includes('grep') || t.includes('query')) return 'search';
  if (t.includes('wait') || t.includes('sleep') || t.includes('pause')) return 'wait';
  return 'generic';
}

// Style per category: color, icon, verb
function getToolStyle(category) {
  switch (category) {
    case 'read':    return { color: C.user,    icon: '📖', verb: 'Lendo',      past: 'Lido' };
    case 'write':   return { color: C.tool,    icon: '✏️ ', verb: 'Escrevendo', past: 'Escrito' };
    case 'shell':   return { color: C.success, icon: '⚡', verb: 'Executando', past: 'Executado' };
    case 'search':  return { color: C.luna,    icon: '🔍', verb: 'Buscando',   past: 'Encontrado' };
    case 'wait':    return { color: C.system,  icon: '⏳', verb: 'Aguardando', past: 'Concluído' };
    default:        return { color: C.tool,    icon: '🔧', verb: 'Processando',past: 'Concluído' };
  }
}

// Extract the target of a tool (file path, url, command, etc.)
function extractToolTarget(tool, params) {
  if (!params || typeof params !== 'object') return '';
  const p = params;
  if (p.path) return p.path;
  if (p.file) return p.file;
  if (p.command) return p.command.slice(0, 60) + (p.command.length > 60 ? '…' : '');
  if (p.cmd) return p.cmd.slice(0, 60) + (p.cmd.length > 60 ? '…' : '');
  if (p.url) return p.url.slice(0, 60) + (p.url.length > 60 ? '…' : '');
  if (p.query) return p.query.slice(0, 60) + (p.query.length > 60 ? '…' : '');
  const firstKey = Object.keys(p).find(k => typeof p[k] === 'string' && p[k].length < 100);
  return firstKey ? `${firstKey}=${p[firstKey].slice(0, 40)}` : '';
}

// Build the action line: "📖 Lendo test.js..."
function formatToolAction(tool, params) {
  const cat = getToolCategory(tool);
  const style = getToolStyle(cat);
  const target = extractToolTarget(tool, params);
  return { line: `${style.icon} ${style.verb}${target ? ' ' + target : ''}...`, style };
}

// Summarize result with category-aware phrasing
function formatToolResult(tool, output, success) {
  const cat = getToolCategory(tool);
  const style = getToolStyle(cat);
  if (!success) return { line: `${style.icon} ${style.past} com erro`, style, isError: true };
  if (!output) return { line: `${style.icon} ${style.past}`, style, isError: false };
  const s = String(output);
  if (s.length > 200 && s.includes('\n')) {
    const lines = s.trim().split('\n').length;
    const preview = s.trim().split('\n').slice(0, 3);
    return { line: `${style.icon} ${style.past} │ ${lines} linhas`, style, isError: false, preview };
  }
  const short = s.slice(0, 100) + (s.length > 100 ? '…' : '');
  return { line: `${style.icon} ${style.past} │ ${short}`, style, isError: false };
}

// Mini preview for read operations (first few lines only)
function formatPreview(output) {
  if (!output) return null;
  const s = String(output);
  if (s.length < 50) return null;
  const lines = s.trim().split('\n');
  if (lines.length < 2) return null;
  const previewLines = lines.slice(0, 4);
  if (lines.length > 4) previewLines.push('│ …');
  return previewLines;
}

const ToolCallItem = React.memo(function ToolCallItem({ msg }) {
  const [frame, setFrame] = useState(0);
  const completed = msg.completed === true;
  useEffect(() => {
    if (completed) return;
    const iv = setInterval(() => setFrame(f => (f + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(iv);
  }, [completed]);
  const tool = msg.tool || 'tool';
  const { line, style } = formatToolAction(tool, msg.params);
  return h(Box, { flexDirection: 'column', marginY: 1 },
    h(Box, { flexDirection: 'row' },
      h(Text, { color: style.color }, completed ? '◉ ' : `${SPINNER_FRAMES[frame]} `),
      h(Text, { color: style.color, bold: true }, line)
    ),
    !completed && h(Box, { flexDirection: 'row', marginLeft: 1 },
      h(Text, { color: C.dim, dimColor: true }, '│')
    )
  );
});

const ToolResultItem = React.memo(function ToolResultItem({ msg }) {
  const tool = msg.tool || 'tool';
  const ok = msg.success !== false;
  const { line, style, isError, preview } = formatToolResult(tool, msg.output, ok);
  const resultColor = isError ? C.error : C.success;
  const resultIcon = isError ? '✗' : '✓';
  return h(Box, { flexDirection: 'column', marginY: 1, marginLeft: 2 },
    h(Box, { flexDirection: 'row' },
      h(Text, { color: resultColor, bold: true }, `${resultIcon} `),
      h(Text, { color: resultColor }, line),
      h(Text, { color: C.dim, dimColor: true }, `  ${fmtTime(msg.timestamp)}`)
    ),
    preview && h(Box, {
      marginLeft: 1,
      marginTop: 0,
      flexDirection: 'column',
      borderStyle: 'single',
      borderColor: '#333355',
      paddingX: 1,
      paddingY: 0,
      width: '85%'
    },
      ...preview.map((pl, i) =>
        h(Text, { key: i, color: C.dim, dimColor: true, wrap: 'wrap' }, pl)
      )
    )
  );
});

const MessageItem = React.memo(function MessageItem({ msg }) {
  if (msg.type === 'user') {
    return h(Box, { flexDirection: 'column', marginY: 1 },
      h(Box, { flexDirection: 'row' },
        h(Text, { color: C.user, bold: true }, '> '),
        h(Text, { color: C.user, bold: true }, 'Você'),
        h(Text, { color: C.dim, dimColor: true }, `  ${fmtTime(msg.timestamp)}`)
      ),
      h(Box, { marginLeft: 2, flexDirection: 'column' },
        ...renderRichText(msg.content || '', C.user, false)
      )
    );
  }

  if (msg.type === 'assistant') {
    const content = msg.response || msg.content || '';
    const modeTag = msg.mode && msg.mode !== 'CHAT' ? ` [${msg.mode}]` : '';
    return h(Box, { flexDirection: 'column', marginY: 1 },
      h(Box, { flexDirection: 'row' },
        h(Text, { color: C.luna, bold: true }, '🌙 '),
        h(Text, { color: C.luna, bold: true }, 'Luna'),
        h(Text, { color: C.dim, dimColor: true }, `${modeTag}  ${fmtTime(msg.timestamp)}`)
      ),
      h(Box, { marginLeft: 2, flexDirection: 'column' },
        ...renderRichText(content, C.input, false)
      )
    );
  }

  if (msg.type === 'tool_call') {
    return h(ToolCallItem, { msg });
  }

  if (msg.type === 'tool_result') {
    return h(ToolResultItem, { msg });
  }

  if (msg.type === 'system') {
    return h(Box, { flexDirection: 'column', marginY: 1 },
      h(Box, { flexDirection: 'row' },
        h(Text, { color: C.system, dimColor: true }, '⚡ '),
        h(Text, { color: C.system, dimColor: true, italic: true }, 'Sistema')
      ),
      h(Box, { marginLeft: 2, flexDirection: 'column' },
        ...renderRichText(msg.content || '', C.system, true)
      )
    );
  }

  return null;
});

function MessageList({ messages, streamingText, thinkingText, isStreaming, showThinkingStream, scrollOffset, maxHeight, thinkingCollapsed, onToggleThinking }) {
  // Apply scroll offset: skip first N messages from bottom
  const visibleMessages = scrollOffset > 0
    ? messages.slice(0, Math.max(1, messages.length - scrollOffset))
    : messages;

  return h(Box, { flexDirection: 'column', width: '100%', height: maxHeight || undefined, overflow: 'hidden' },
    visibleMessages.map(msg => h(MessageItem, { key: msg.id, msg })),

    // Thinking mode — COLAPSADO por padrão (header apenas)
    isStreaming && thinkingText && showThinkingStream && h(Box, {
      flexDirection: 'column',
      marginY: 1,
      borderStyle: 'single',
      borderColor: '#333355',
      backgroundColor: C.thinkingBg,
      paddingX: 1,
      paddingY: thinkingCollapsed ? 0 : 1,
      width: '95%',
    },
      h(Box, { flexDirection: 'row' },
        h(Text, { color: C.warning, bold: true }, '🧠 '),
        h(Text, { color: C.warning, bold: true }, thinkingCollapsed ? 'Pensando... (clique para expandir)' : 'Pensando...'),
        thinkingCollapsed && h(Text, { color: C.dim, dimColor: true, italic: true }, `  (${getThinkingMetrics(thinkingText).tokens} tokens)`)
      ),
      !thinkingCollapsed && h(Box, { flexDirection: 'column', marginTop: 1 },
        ...renderRichText(thinkingText, C.dim, true)
      )
    ),

    // Streaming response
    isStreaming && streamingText && h(Box, { flexDirection: 'column', marginY: 1 },
      h(Box, { flexDirection: 'row' },
        h(Text, { color: C.luna, bold: true }, '🌙 '),
        h(Text, { color: C.luna, bold: true }, 'Luna')
      ),
      h(Box, { marginLeft: 2, flexDirection: 'column' },
        ...renderRichText(streamingText, C.input, false),
        !thinkingText && h(Text, { color: C.luna }, '▋')
      )
    )
  );
}

function StatusLine({ text, isProcessing }) {
  if (!text && !isProcessing) return null;
  return h(Box, { flexDirection: 'row', width: '100%', height: 1, paddingX: 1 },
    isProcessing && h(Spinner, { type: 'dots' }),
    h(Text, { color: C.tool, italic: true }, text || '')
  );
}

function SuggestionBar({ suggestion }) {
  if (!suggestion) return null;
  const auto = (suggestion.confidence || 0) >= 0.85;
  const typeLabel = suggestion.type === 'persona' ? '🎭 Persona' : '📚 Skill';
  const conf = Math.round((suggestion.confidence || 0) * 100);

  return h(Box, {
    flexDirection: 'column',
    paddingX: 1,
    paddingY: 1,
    borderStyle: 'single',
    borderColor: C.warning,
    width: '100%',
    marginY: 1,
  },
    h(Box, { flexDirection: 'row' },
      h(Text, { color: C.warning, bold: true }, auto ? '⚡ Auto-switch: ' : '💡 Sugestão: '),
      h(Text, { color: C.input, bold: true }, `${typeLabel} "${suggestion.target}"`),
      h(Text, { color: C.dim }, ` (${conf}%)`)
    ),
    suggestion.reason && h(Text, { color: C.dim, wrap: 'wrap' }, `Motivo: ${suggestion.reason}`),
    !auto && h(Text, { color: C.dim, italic: true }, '/sim para confirmar │ /nao para rejeitar')
  );
}

function StatusBar({ session, messages, isProcessing, activeToolCalls, activeAgents, bridgeStatus, sessionStartTime, followMode, scrollOffset, aiState }) {
  const { columns } = useWindowSize();
  const [now, setNow] = useState(Date.now());

  // Update every second for uptime
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!session) return null;

  // Estimate tokens from all message content
  let totalText = '';
  for (const msg of messages) {
    totalText += msg.content || msg.response || msg.text || '';
  }
  const tokens = estimateTokens(totalText);
  const maxContext = 200000; // Kimi K2.6 context window
  const contextPercent = Math.min(100, Math.round((tokens / maxContext) * 100));

  // Uptime
  const uptime = sessionStartTime ? formatDuration(now - sessionStartTime) : '00:00';

  // Bridge status
  const bridgeIcon = bridgeStatus?.active ? '🟢' : '🔴';
  const bridgeText = bridgeStatus?.active ? 'online' : 'offline';

  // YOLO
  const yoloText = session.yoloMode ? '🔥YOLO' : '';

  // AI State indicator colors
  const stateConfig = {
    idle:     { dot: '⚪', label: 'idle',     color: C.dim },
    analyzing:{ dot: '🟡', label: 'thinking', color: C.warning },
    responding:{ dot: '🟢', label: 'responding', color: C.success },
    error:    { dot: '🔴', label: 'error',    color: C.error },
  };
  const st = stateConfig[aiState] || stateConfig.idle;

  // Mode
  const modeText = session.mode || 'thinking';

  // Progress bar color
  const barColor = contextPercent > 80 ? C.error : contextPercent > 50 ? C.warning : C.success;

  // Layout: split into left/center/right
  // If terminal is narrow, stack vertically
  const isNarrow = columns < 100;

  // Scroll indicator
  const scrollIndicator = scrollOffset > 0
    ? `⬆${scrollOffset}`
    : (followMode ? '⬇' : '');

  const leftContent = h(Box, { flexDirection: 'row', width: isNarrow ? '100%' : '35%' },
    h(Text, { color: C.dim }, `${bridgeIcon} ${bridgeText} │ `),
    h(Text, { color: st.color, bold: true }, `${st.dot} ${st.label}`),
    yoloText && h(Text, { color: C.error }, ` │ ${yoloText}`),
    activeToolCalls > 0 && h(Text, { color: C.tool }, ` │ 🔧${activeToolCalls}`),
    activeAgents > 0 && h(Text, { color: C.luna }, ` │ ⚙${activeAgents}`),
    scrollIndicator && h(Text, { color: C.warning }, ` │ ${scrollIndicator}`)
  );

  const centerContent = h(Box, { flexDirection: 'row', width: isNarrow ? '100%' : '40%', justifyContent: 'center' },
    h(Text, { color: C.dim }, 'ctx: '),
    h(Text, { color: barColor }, renderProgressBar(contextPercent, 8)),
    h(Text, { color: C.dim }, ` ${contextPercent}% │ `),
    h(Text, { color: C.system }, `${(tokens / 1000).toFixed(1)}k/${(maxContext / 1000).toFixed(0)}k tks`)
  );

  const rightContent = h(Box, { flexDirection: 'row', width: isNarrow ? '100%' : '25%', justifyContent: 'flex-end' },
    h(Text, { color: C.dim }, `⏱ ${uptime} │ `),
    h(Text, { color: C.dim }, `${messages.length} msgs`)
  );

  return h(Box, {
    flexDirection: isNarrow ? 'column' : 'row',
    width: '100%',
    height: isNarrow ? 3 : 1,
    paddingX: 1,
    backgroundColor: '#0d0d1a',
    borderStyle: isNarrow ? 'single' : undefined,
    borderColor: isNarrow ? '#222244' : undefined,
    marginTop: 0,
  },
    leftContent,
    centerContent,
    rightContent
  );
}

function InputBox({ onSubmit, isActive, isProcessing, onQueue, queueLength }) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const { columns } = useWindowSize();

  // Dynamic height based on text length
  const availableWidth = Math.max(10, columns - 6); // account for prefix + padding + borders
  const textLines = input.length > 0 ? Math.ceil(input.length / availableWidth) : 1;
  const boxHeight = Math.min(12, Math.max(3, textLines + 2));

  useInput((char, key) => {
    if (!isActive) return;

    if (key.return) {
      const trimmed = input.trim();
      if (trimmed) {
        if (isProcessing && onQueue) {
          onQueue(trimmed);
        } else {
          onSubmit(trimmed);
        }
        setHistory(h => [trimmed, ...h].slice(0, 100));
        setInput('');
        setHistoryIndex(-1);
      }
      return;
    }

    if (key.backspace || key.delete) {
      setInput(v => v.slice(0, -1));
      return;
    }

    if (key.upArrow) {
      if (history.length > 0) {
        const next = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(next);
        setInput(history[next]);
      }
      return;
    }

    if (key.downArrow) {
      if (historyIndex > 0) {
        const next = historyIndex - 1;
        setHistoryIndex(next);
        setInput(history[next]);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
      return;
    }

    if (key.ctrl && char === 'u') {
      setInput('');
      return;
    }

    // Paste support: Ctrl+V or Ctrl+Shift+V
    if (key.ctrl && (char === 'v' || char === 'V')) {
      try {
        const pasted = execSync('xclip -o -selection clipboard 2>/dev/null', { encoding: 'utf8', timeout: 500 });
        if (pasted) {
          setInput(v => v + pasted.replace(/\n/g, ' ').replace(/\r/g, ''));
        }
      } catch {
        // clipboard empty or xclip failed
      }
      return;
    }

    if (!key.ctrl && !key.meta && char) {
      setInput(v => v + char);
    }
  }, { isActive });

  const borderColor = isProcessing ? C.warning : (isActive ? C.user : C.border);
  const prefix = isProcessing ? '⏳ ' : '❯ ';
  const queueIndicator = queueLength > 0 ? ` [${queueLength} na fila]` : '';

  return h(Box, {
    flexDirection: 'column',
    borderStyle: 'single',
    borderColor,
    paddingX: 1,
    height: boxHeight,
    width: '100%',
  },
    h(Box, { flexDirection: 'row' },
      h(Text, { color: isProcessing ? C.warning : C.user, bold: true }, prefix),
      h(Text, { color: C.input, wrap: 'wrap' }, input),
      h(Text, { color: C.warning, dimColor: true }, queueIndicator),
      isActive && !isProcessing && h(Text, { color: C.input }, '▌')
    )
  );
}

function SteerInput({ onSubmit, onCancel }) {
  const [input, setInput] = useState('');

  useInput((char, key) => {
    if (key.return) {
      onSubmit(input);
      return;
    }
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.backspace || key.delete) {
      setInput(v => v.slice(0, -1));
      return;
    }
    if (!key.ctrl && !key.meta && char) {
      setInput(v => v + char);
    }
  });

  return h(Box, {
    flexDirection: 'column',
    borderStyle: 'double',
    borderColor: C.warning,
    paddingX: 1,
    paddingY: 1,
    width: '100%',
  },
    h(Text, { color: C.warning, bold: true }, '🎯 Steer (Ctrl+S):'),
    h(Box, { flexDirection: 'row', marginTop: 1 },
      h(Text, { color: C.warning }, '❯ '),
      h(Text, { color: C.input }, input),
      h(Text, { color: C.input }, '▌')
    ),
    h(Text, { color: C.dim, dimColor: true, italic: true }, 'Enter para enviar │ ESC para cancelar')
  );
}

function SessionPicker({ sessions, onSelect, onNew }) {
  const [selected, setSelected] = useState(0);
  const total = sessions.length + 1;

  useInput((input, key) => {
    if (key.upArrow) setSelected(s => (s - 1 + total) % total);
    else if (key.downArrow) setSelected(s => (s + 1) % total);
    else if (key.return) {
      if (selected === 0) onNew();
      else onSelect(sessions[selected - 1]);
    }
  });

  const fmt = (iso) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  return h(Box, { flexDirection: 'column', padding: 1, width: '100%' },
    h(Text, { color: C.user, bold: true }, '📁 Sessões disponíveis'),
    h(Text, { color: C.dim }, '─'.repeat(56)),
    h(Box, { flexDirection: 'row', height: 1 },
      h(Text, { color: selected === 0 ? C.user : C.dim, bold: selected === 0, width: 3 }, selected === 0 ? '▸' : ' '),
      h(Text, { color: selected === 0 ? C.input : C.dim, bold: selected === 0 }, ' 0. 🆕 Nova sessão')
    ),
    ...sessions.map((s, i) => {
      const idx = i + 1;
      const sel = selected === idx;
      return h(Box, { key: s.id, flexDirection: 'row', height: 1 },
        h(Text, { color: sel ? C.user : C.dim, bold: sel, width: 3 }, sel ? '▸' : ' '),
        h(Text, { color: sel ? C.input : C.dim, bold: sel }, ` ${idx}. ${(s.title || 'Sem título').slice(0, 32)}`),
        h(Text, { color: C.dim, dimColor: true }, `  ${fmt(s.lastAccessedAt)}  ${s.messageCount || 0} msgs`)
      );
    }),
    h(Text, { color: C.dim, italic: true, marginTop: 1 }, '↑↓ navegar  Enter selecionar')
  );
}

function HelpOverlay({ onClose }) {
  useInput((input, key) => {
    if (key.escape || input === 'q' || input === 'Q') onClose();
  });

  const cmds = [
    ['/sair, /exit', 'Encerra'],
    ['/reiniciar', 'Reinicia Luna para carregar atualizações'],
    ['/novo', 'Nova sessão'],
    ['/newaba', 'Nova aba no Kimi Web (reset contexto)'],
    ['/limpar', 'Limpa contexto'],
    ['/compact', 'Resume contexto e inicia nova thread'],
    ['/modo <nome>', 'Muda persona'],
    ['/modo instant/thinking', 'Muda modo'],
    ['/workspace <path>', 'Define workspace do projeto'],
    ['/workspace', 'Mostra workspace atual'],
    ['/add <file>', 'Adiciona arquivo ao contexto ativo'],
    ['/drop <file>', 'Remove arquivo do contexto ativo'],
    ['/skills', 'Lista skills'],
    ['/auto', 'Toggle auto-switch'],
    ['/sim /nao', 'Confirma/rejeita sugestão'],
    ['/status', 'Status do sistema'],
    ['/login', 'Login no Kimi Web (inicia Chrome se necessário)'],
    ['/logout', 'Desloga e fecha Chrome'],
    ['/undo', 'Reverte todas as mudanças da sessão'],
    ['/diff', 'Mostra diff da sessão'],
    ['/reset', 'Descarta sessão e volta para branch base'],
    ['/yolo', 'Toggle YOLO'],
    ['/thinking', 'Toggle thinking display (compact/stream)'],
    ['/help', 'Ajuda'],
    ['Ctrl+H', 'Toggle ajuda'],
    ['Ctrl+S', 'Steer (interromper/responder)'],
    ['Ctrl+C', 'Sair'],
    ['↑↓', 'Histórico de input'],
    ['Enter (proc)', 'Queue msg se processando'],
  ];

  return h(Box, {
    flexDirection: 'column',
    paddingX: 2,
    paddingY: 1,
    borderStyle: 'double',
    borderColor: C.user,
    width: 62,
  },
    h(Text, { color: C.user, bold: true }, '🌙 Comandos Luna'),
    h(Text, { color: C.dim }, '─'.repeat(56)),
    ...cmds.map(([cmd, desc], i) =>
      h(Box, { key: i, flexDirection: 'row', height: 1 },
        h(Text, { color: C.luna, width: 30 }, cmd),
        h(Text, { color: C.dim }, desc)
      )
    ),
    h(Text, { color: C.dim, italic: true, marginTop: 1 }, 'ESC ou Q para fechar')
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

function App({ luna, sessionManager, initialSession }) {
  const { exit } = useApp();
  const { rows, columns } = useWindowSize();

  // Alternate screen buffer: isolate TUI from scrollback to prevent jump-to-top
  useEffect(() => {
    // v3.5-fix: exit alternate screen first (in case previous TUI crashed)
    process.stdout.write('\x1b[?1049l'); // exit alternate screen
    process.stdout.write('\x1b[?25h');    // show cursor
    process.stdout.write('\x1b[0m');      // reset colors
    // small delay to let terminal settle before entering alternate screen
    const timer = setTimeout(() => {
      process.stdout.write('\x1b[?1049h'); // enter alternate screen
    }, 50);
    return () => {
      clearTimeout(timer);
      process.stdout.write('\x1b[?1049l'); // exit alternate screen
      process.stdout.write('\x1b[?25h');    // show cursor
      process.stdout.write('\x1b[0m');      // reset colors
    };
  }, []);

  // Estado
  const [session, setSession] = useState(initialSession);
  const [showPicker, setShowPicker] = useState(!initialSession);
  const [sessionsList, setSessionsList] = useState([]);
  const [messages, setMessages] = useState([]);
  const [streamingText, setStreamingText] = useState('');
  const [thinkingText, setThinkingText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState(null);
  const [activeToolCalls, setActiveToolCalls] = useState(0);
  const [activeAgents, setActiveAgents] = useState(0);
  const [canSteer, setCanSteer] = useState(false);
  const [steerInput, setSteerInput] = useState('');
  const [showSteerInput, setShowSteerInput] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState({ active: false });
  const [sessionStartTime, setSessionStartTime] = useState(Date.now());
  const [awaitingLogin, setAwaitingLogin] = useState(false);
  const [showThinkingStream, setShowThinkingStream] = useState(session?.showThinkingStream ?? false);

  // ── AI State for status indicators ──
  // 'idle' | 'analyzing' | 'responding' | 'error'
  const [aiState, setAiState] = useState('idle');
  const [thinkingCollapsed, setThinkingCollapsed] = useState(true);

  // ── Scroll / Viewport Control ──
  const [scrollOffset, setScrollOffset] = useState(0);
  const [followMode, setFollowMode] = useState(true);
  const [hasNewContent, setHasNewContent] = useState(false);
  const messagesCountRef = useRef(0);

  // Refs for accumulated text to reduce re-renders
  const thinkingRef = useRef('');
  const responseRef = useRef('');
  const thinkingStartRef = useRef(null);

  // Message queue: when AI is processing, user input queues here
  const messageQueue = useRef([]);
  const isProcessingRef = useRef(false);
  isProcessingRef.current = isProcessing;

  // v3.5-fix: Watchdog — force reset isProcessing if stuck for >10min
  // This prevents input lock when the bridge generator never terminates.
  useEffect(() => {
    if (!isProcessing) return;
    const stuckTimer = setTimeout(() => {
      console.error('[LunaTUI] Watchdog: isProcessing stuck for 10min — forcing reset');
      setIsProcessing(false);
      setStreamingText('');
      setThinkingText('');
      setStatusText('');
      setActiveToolCalls(0);
      setActiveAgents(0);
      setAiState('idle');
      setMessages(prev => [...prev, {
        type: 'system', content: '⏹ Operação abortada (timeout de segurança).',
        timestamp: new Date().toISOString(), id: nextId(),
      }]);
      // Process queued messages
      if (messageQueue.current.length > 0) {
        setTimeout(() => processQueue(), 500);
      }
    }, 10 * 60 * 1000); // 10 minutes
    return () => clearTimeout(stuckTimer);
  }, [isProcessing]);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const pendingRef = useRef(pendingSuggestion);
  pendingRef.current = pendingSuggestion;

  // Carregar sessões para picker
  useEffect(() => {
    if (showPicker) setSessionsList(sessionManager.listSessions());
  }, [showPicker, sessionManager]);

  // Carregar histórico
  useEffect(() => {
    if (!session) return;
    try {
      const events = sessionManager.readContext(session.id) || [];
      setMessages(events.map((ev, i) => ({ ...ev, id: `${ev.timestamp || Date.now()}-${i}` })));
    } catch { setMessages([]); }
    setSessionStartTime(Date.now());
  }, [session?.id, sessionManager]);

  // ── Follow Mode / Scroll Logic ──
  useEffect(() => {
    const count = messages.length;
    if (count > messagesCountRef.current) {
      if (followMode) {
        setScrollOffset(0);
        setHasNewContent(false);
      } else {
        // Maintain visual position when new messages arrive while user is reading history.
        // New message is appended at bottom, so increment scrollOffset to keep
        // the same viewport instead of pushing content up unexpectedly.
        setScrollOffset(prev => prev + 1);
        setHasNewContent(true);
      }
    }
    messagesCountRef.current = count;
  }, [messages.length, followMode]);

  useEffect(() => {
    if (isProcessing && !followMode) {
      setFollowMode(true);
      setScrollOffset(0);
      setHasNewContent(false);
    }
  }, [isProcessing]);

  // Verificar status do bridge periodicamente
  useEffect(() => {
    const checkBridge = async () => {
      try {
        const st = await luna.kimiBridge?.getStatus?.('luna-cli');
        setBridgeStatus({ active: st?.active || false, ...st });
      } catch {
        setBridgeStatus({ active: false });
      }
    };
    checkBridge();
    const interval = setInterval(checkBridge, 10000); // every 10s
    return () => clearInterval(interval);
  }, [luna]);

  // Polling de detecção de login automático
  useEffect(() => {
    if (!awaitingLogin) return;
    let cancelled = false;
    const poll = async () => {
      setMessages(prev => [...prev, {
        type: 'system',
        content: '⏳ Aguardando login no Chrome... (monitorando a cada 3s)',
        id: nextId(), timestamp: new Date().toISOString()
      }]);
      try {
        const result = await luna.kimiBridge?.waitForLogin?.('luna-cli', 60000, 3000);
        if (cancelled) return;
        if (result?.loggedIn) {
          setMessages(prev => [...prev, {
            type: 'system',
            content: `✅ ${result.message}`,
            id: nextId(), timestamp: new Date().toISOString()
          }]);
          setBridgeStatus(prev => ({ ...prev, active: true }));
        } else {
          setMessages(prev => [...prev, {
            type: 'system',
            content: `⏱️ ${result?.message || 'Tempo esgotado aguardando login.'}`,
            id: nextId(), timestamp: new Date().toISOString()
          }]);
        }
      } catch (e) {
        if (!cancelled) {
          setMessages(prev => [...prev, {
            type: 'system',
            content: `❌ Erro no monitoramento: ${e.message}`,
            id: nextId(), timestamp: new Date().toISOString()
          }]);
        }
      } finally {
        if (!cancelled) setAwaitingLogin(false);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [awaitingLogin, luna]);

  // Process message queue after response completes
  const processQueue = useCallback(async () => {
    if (messageQueue.current.length === 0) return;
    const next = messageQueue.current.shift();
    const text = typeof next === 'string' ? next : next?.text;
    const retries = typeof next === 'object' ? (next.retries || 0) : 0;
    // Small delay to let UI settle
    await new Promise(r => setTimeout(r, 300));
    await handleCommand(text, retries);
  }, []);

  // Core: handle a message with streaming
  const handleCommand = useCallback(async (text, retries = 0) => {
    if (!session) return;
    // Reset abort flag for new operation
    shouldAbortRef.current = false;

    // /sair
    if (text === '/sair' || text === '/exit') { exit(); return; }

    // /reiniciar
    if (text === '/reiniciar') {
      setMessages(prev => [...prev, {
        type: 'system', content: '🔄 Reiniciando Luna para carregar atualizações...',
        timestamp: new Date().toISOString(), id: nextId(),
      }]);
      // Small delay so the message renders
      setTimeout(() => {
        try {
          luna.disconnect?.().catch(() => {});
        } catch {}
        // Respawn the same process
        spawn(process.argv[0], process.argv.slice(1), {
          detached: true,
          stdio: 'inherit',
          env: process.env,
        });
        exit();
      }, 500);
      return;
    }

    // /help
    if (text === '/help') { setShowHelp(true); return; }

    // /novo
    if (text === '/novo') {
      const s = sessionManager.createSession({ title: 'Nova sessão' });
      setSession(s); setMessages([]); return;
    }

    // /newaba — force new Kimi Web tab (full system prompt on next msg)
    if (text === '/newaba') {
      setMessages(prev => [...prev, { type: 'system', content: '🔄 Criando nova thread no Kimi Web...', id: nextId(), timestamp: new Date().toISOString() }]);
      try {
        const result = await luna.newThread?.('luna-default');
        sessionManager.clearContext(session.id);
        setMessages([{ type: 'system', content: `✅ Nova thread criada. Próxima mensagem enviará o system prompt completo.`, id: nextId(), timestamp: new Date().toISOString() }]);
      } catch (err) {
        setMessages(prev => [...prev, { type: 'system', content: `❌ Erro ao criar thread: ${err.message}`, id: nextId(), timestamp: new Date().toISOString() }]);
      }
      return;
    }

    // /compact — summarize context and start fresh thread
    if (text === '/compact') {
      setMessages(prev => [...prev, { type: 'system', content: '📦 Compactando contexto...', id: nextId(), timestamp: new Date().toISOString() }]);
      try {
        // Build a summary of the current session
        const events = sessionManager.readContext(session.id) || [];
        const summaryLines = [];
        for (const ev of events.slice(-20)) {
          if (ev.type === 'user') summaryLines.push(`User: ${ev.content?.slice(0, 100)}`);
          else if (ev.type === 'assistant') summaryLines.push(`Luna: ${ev.response?.slice(0, 100) || ev.content?.slice(0, 100)}`);
          else if (ev.type === 'tool_result') summaryLines.push(`Tool ${ev.tool}: ${ev.success ? '✅' : '❌'}`);
        }
        const summary = summaryLines.join('\n');

        // Create new thread in Kimi Web
        await luna.newThread?.('luna-default');

        // Clear local context but keep session
        sessionManager.clearContext(session.id);

        // Store summary as first event so next message includes it
        sessionManager.appendEvent(session.id, {
          type: 'system',
          content: `Resumo da sessão anterior:\n${summary}`,
          timestamp: new Date().toISOString(),
        });

        setMessages([{ type: 'system', content: `✅ Contexto compactado. Thread nova. Resumo salvo.`, id: nextId(), timestamp: new Date().toISOString() }]);
      } catch (err) {
        setMessages(prev => [...prev, { type: 'system', content: `❌ Erro ao compactar: ${err.message}`, id: nextId(), timestamp: new Date().toISOString() }]);
      }
      return;
    }

    // /limpar (alias: /clear)
    if (text === '/limpar' || text === '/clear') {
      sessionManager.clearContext(session.id);
      setMessages([]); return;
    }

    // /workspace <path> — define workspace
    if (text.startsWith('/workspace ')) {
      const wp = text.slice(10).trim();
      try {
        const result = await workspaceManager.bootstrap(wp, 'luna-cli');
        setMessages(prev => [...prev, {
          type: 'system',
          content: `📁 Workspace definido: ${result.manifest.name}\n${result.formatted}`,
          id: nextId(), timestamp: new Date().toISOString(),
        }]);
      } catch (err) {
        setMessages(prev => [...prev, {
          type: 'system', content: `❌ Erro: ${err.message}`,
          id: nextId(), timestamp: new Date().toISOString(),
        }]);
      }
      return;
    }

    // /workspace — mostra workspace atual
    if (text === '/workspace') {
      const manifest = workspaceManager.getFormattedManifest('luna-cli');
      if (manifest) {
        setMessages(prev => [...prev, {
          type: 'system', content: `📁 Workspace atual:\n${manifest}`,
          id: nextId(), timestamp: new Date().toISOString(),
        }]);
      } else {
        setMessages(prev => [...prev, {
          type: 'system', content: '⚠️ Nenhum workspace definido. Use /workspace <path>',
          id: nextId(), timestamp: new Date().toISOString(),
        }]);
      }
      return;
    }

    // /add <file> — adiciona arquivo ao contexto ativo
    if (text.startsWith('/add ')) {
      const filePath = text.slice(5).trim();
      try {
        const fs = await import('fs');
        const path = await import('path');
        const resolved = path.resolve(filePath);
        if (!fs.existsSync(resolved)) {
          setMessages(prev => [...prev, {
            type: 'system', content: `❌ Arquivo não encontrado: ${resolved}`,
            id: nextId(), timestamp: new Date().toISOString(),
          }]);
          return;
        }
        const content = fs.readFileSync(resolved, 'utf8');
        workspaceManager.addActiveFile('luna-cli', resolved, content);
        const lines = content.split('\n').length;
        setMessages(prev => [...prev, {
          type: 'system', content: `📄 Adicionado ao contexto: ${resolved} (${lines} linhas, ${content.length} chars)`,
          id: nextId(), timestamp: new Date().toISOString(),
        }]);
      } catch (err) {
        setMessages(prev => [...prev, {
          type: 'system', content: `❌ Erro: ${err.message}`,
          id: nextId(), timestamp: new Date().toISOString(),
        }]);
      }
      return;
    }

    // /drop <file> — remove arquivo do contexto ativo
    if (text.startsWith('/drop ')) {
      const filePath = text.slice(6).trim();
      const path = await import('path');
      const resolved = path.resolve(filePath);
      const removed = workspaceManager.removeActiveFile('luna-cli', resolved);
      if (removed) {
        setMessages(prev => [...prev, {
          type: 'system', content: `🗑️ Removido do contexto: ${resolved}`,
          id: nextId(), timestamp: new Date().toISOString(),
        }]);
      } else {
        setMessages(prev => [...prev, {
          type: 'system', content: `⚠️ Arquivo não estava no contexto: ${resolved}`,
          id: nextId(), timestamp: new Date().toISOString(),
        }]);
      }
      return;
    }

    // /undo — reverte TODAS as mudanças da sessão
    if (text === '/undo') {
      try {
        const { LunaGit } = await import('./luna-git.cjs');
        const ws = workspaceManager.getWorkspace('luna-cli');
        if (!ws) {
          setMessages(prev => [...prev, {
            type: 'system', content: '⚠️ Nenhum workspace definido.',
            id: nextId(), timestamp: new Date().toISOString(),
          }]);
          return;
        }
        const git = new LunaGit(ws.path);
        await git.init();
        const currentBranch = git._getCurrentBranch();
        // Triple-guard: must be on a luna/session branch
        if (!currentBranch || !currentBranch.startsWith('luna/session-')) {
          setMessages(prev => [...prev, {
            type: 'system', content: `🛡️ Undo bloqueado: branch atual é "${currentBranch || 'unknown'}". Só é permitido em branches "luna/session-*".`,
            id: nextId(), timestamp: new Date().toISOString(),
          }]);
          return;
        }
        git.sessionBranch = currentBranch;
        const result = await git.undo();
        if (result.success) {
          setMessages(prev => [...prev, {
            type: 'system', content: `↩️ Revertidos ${result.reverted} commits. Workspace restaurado.`,
            id: nextId(), timestamp: new Date().toISOString(),
          }]);
        } else {
          setMessages(prev => [...prev, {
            type: 'system', content: `❌ Erro ao reverter: ${result.error}`,
            id: nextId(), timestamp: new Date().toISOString(),
          }]);
        }
      } catch (err) {
        setMessages(prev => [...prev, {
          type: 'system', content: `❌ Erro: ${err.message}`,
          id: nextId(), timestamp: new Date().toISOString(),
        }]);
      }
      return;
    }

    // /diff — mostra diff da sessão
    if (text === '/diff') {
      try {
        const { LunaGit } = await import('./luna-git.cjs');
        const ws = workspaceManager.getWorkspace('luna-cli');
        if (!ws) {
          setMessages(prev => [...prev, {
            type: 'system', content: '⚠️ Nenhum workspace definido.',
            id: nextId(), timestamp: new Date().toISOString(),
          }]);
          return;
        }
        const git = new LunaGit(ws.path);
        const result = await git.diffFull();
        if (result.success) {
          const diffText = result.diff || 'Nenhuma mudança.';
          setMessages(prev => [...prev, {
            type: 'system', content: `🌿 Diff da sessão:\n\`\`\`diff\n${diffText.slice(0, 2000)}\n\`\`\``,
            id: nextId(), timestamp: new Date().toISOString(),
          }]);
        } else {
          setMessages(prev => [...prev, {
            type: 'system', content: `❌ Erro: ${result.error}`,
            id: nextId(), timestamp: new Date().toISOString(),
          }]);
        }
      } catch (err) {
        setMessages(prev => [...prev, {
          type: 'system', content: `❌ Erro: ${err.message}`,
          id: nextId(), timestamp: new Date().toISOString(),
        }]);
      }
      return;
    }

    // /reset — descarta tudo e volta pra base
    if (text === '/reset') {
      try {
        const { LunaGit } = await import('./luna-git.cjs');
        const ws = workspaceManager.getWorkspace('luna-cli');
        if (!ws) {
          setMessages(prev => [...prev, {
            type: 'system', content: '⚠️ Nenhum workspace definido.',
            id: nextId(), timestamp: new Date().toISOString(),
          }]);
          return;
        }
        const git = new LunaGit(ws.path);
        const result = await git.reset();
        if (result.success) {
          setMessages(prev => [...prev, {
            type: 'system', content: `🗑️ Sessão descartada. Voltando para ${result.baseBranch}.`,
            id: nextId(), timestamp: new Date().toISOString(),
          }]);
        } else {
          setMessages(prev => [...prev, {
            type: 'system', content: `❌ Erro: ${result.error}`,
            id: nextId(), timestamp: new Date().toISOString(),
          }]);
        }
      } catch (err) {
        setMessages(prev => [...prev, {
          type: 'system', content: `❌ Erro: ${err.message}`,
          id: nextId(), timestamp: new Date().toISOString(),
        }]);
      }
      return;
    }

    // /modo <arg>
    if (text.startsWith('/modo ')) {
      const arg = text.split(' ')[1];
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      const statePath = path.join(os.homedir(), '.luna', 'sessions', session.id, 'state.json');

      if (arg === 'instant' || arg === 'thinking') {
        try {
          const s = JSON.parse(fs.readFileSync(statePath, 'utf8'));
          s.mode = arg; fs.writeFileSync(statePath, JSON.stringify(s, null, 2));
        } catch {}
        setSession(prev => ({ ...prev, mode: arg }));
        setMessages(prev => [...prev, { type: 'system', content: `Modo: ${arg}`, id: nextId(), timestamp: new Date().toISOString() }]);
      } else {
        const personaPath = path.join(os.homedir(), '.luna', 'personas', `${arg}.md`);
        if (fs.existsSync(personaPath)) {
          try {
            const s = JSON.parse(fs.readFileSync(statePath, 'utf8'));
            s.persona = arg; fs.writeFileSync(statePath, JSON.stringify(s, null, 2));
          } catch {}
          setSession(prev => ({ ...prev, persona: arg }));
          setMessages(prev => [...prev, { type: 'system', content: `🎭 Persona "${arg}" ativada`, id: nextId(), timestamp: new Date().toISOString() }]);
        } else {
          setMessages(prev => [...prev, { type: 'system', content: `❌ Persona "${arg}" não encontrada`, id: nextId(), timestamp: new Date().toISOString() }]);
        }
      }
      return;
    }

    // /modo (listar)
    if (text === '/modo') {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      const personaDir = path.join(os.homedir(), '.luna', 'personas');
      const personas = fs.existsSync(personaDir)
        ? fs.readdirSync(personaDir).filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''))
        : [];
      const lines = [
        '🎭 Personas: ' + personas.join(', '),
        `Modos: instant | thinking (atual: ${session.mode || 'thinking'})`,
      ];
      setMessages(prev => [...prev, { type: 'system', content: lines.join('\n'), id: nextId(), timestamp: new Date().toISOString() }]);
      return;
    }

    // /skills
    if (text === '/skills') {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      const skillDir = path.join(os.homedir(), '.luna', 'skills');
      const skills = fs.existsSync(skillDir)
        ? fs.readdirSync(skillDir).filter(d => fs.statSync(path.join(skillDir, d)).isDirectory())
        : [];
      setMessages(prev => [...prev, { type: 'system', content: '📚 Skills: ' + skills.join(', '), id: nextId(), timestamp: new Date().toISOString() }]);
      return;
    }

    // /auto
    if (text === '/auto') {
      luna.autoSwitchEnabled = !luna.autoSwitchEnabled;
      setMessages(prev => [...prev, { type: 'system', content: `🤖 Auto-switch: ${luna.autoSwitchEnabled ? 'ON' : 'OFF'}`, id: nextId(), timestamp: new Date().toISOString() }]);
      return;
    }

    // /sim
    if (text === '/sim' || text === '/yes') {
      const sug = pendingRef.current;
      if (sug) {
        const result = await luna.applySuggestion(session.id, sug.type, sug.target);
        setMessages(prev => [...prev, {
          type: 'system',
          content: result.success ? `✅ ${sug.type} "${sug.target}" ativada.` : `❌ ${result.error}`,
          id: nextId(), timestamp: new Date().toISOString(),
        }]);
        setPendingSuggestion(null);
      } else {
        setMessages(prev => [...prev, { type: 'system', content: 'Nenhuma sugestão pendente.', id: nextId(), timestamp: new Date().toISOString() }]);
      }
      return;
    }

    // /nao
    if (text === '/nao' || text === '/no') {
      const sug = pendingRef.current;
      if (sug) {
        setMessages(prev => [...prev, { type: 'system', content: `❌ Sugestão rejeitada: ${sug.target}`, id: nextId(), timestamp: new Date().toISOString() }]);
        setPendingSuggestion(null);
      } else {
        setMessages(prev => [...prev, { type: 'system', content: 'Nenhuma sugestão pendente.', id: nextId(), timestamp: new Date().toISOString() }]);
      }
      return;
    }

    // /login
    if (text === '/login') {
      setMessages(prev => [...prev, { type: 'system', content: '🔐 Verificando Chrome + Kimi login...', id: nextId(), timestamp: new Date().toISOString() }]);
      try {
        // Check if Chrome is already running
        const existingChrome = await luna.kimiBridge?.getChromeStatus?.();
        if (existingChrome && existingChrome.running && !existingChrome.isHeadless) {
          setMessages(prev => [...prev, {
            type: 'system',
            content: `ℹ️ Chrome já está aberto (PID: ${existingChrome.pid}). Reutilizando... Digite /logout para fechar.`,
            id: nextId(), timestamp: new Date().toISOString()
          }]);
        } else {
          // Start Chrome
          const chromeStatus = await luna.kimiBridge?.checkChrome?.();
          if (chromeStatus) {
            if (chromeStatus.wasHeadless) {
              setMessages(prev => [...prev, { type: 'system', content: '⚠️ Chrome headless detectado e reiniciado em modo visível.', id: nextId(), timestamp: new Date().toISOString() }]);
            }
            if (chromeStatus.started) {
              const profileMsg = chromeStatus.profileDir ? ` (perfil: ${chromeStatus.profileDir.slice(-30)})` : '';
              setMessages(prev => [...prev, { type: 'system', content: `🚀 Chrome visível iniciado (PID: ${chromeStatus.pid})${profileMsg}`, id: nextId(), timestamp: new Date().toISOString() }]);
            } else if (chromeStatus.running) {
              setMessages(prev => [...prev, { type: 'system', content: '✅ Chrome já está rodando (modo visível)', id: nextId(), timestamp: new Date().toISOString() }]);
            } else if (chromeStatus.error) {
              setMessages(prev => [...prev, { type: 'system', content: `❌ Chrome: ${chromeStatus.error}`, id: nextId(), timestamp: new Date().toISOString() }]);
              return;
            }
          }
        }
        // Check Kimi login
        await new Promise(r => setTimeout(r, 1500));
        const loginStatus = await luna.kimiBridge?.ensureLogin?.('luna-cli');
        if (loginStatus) {
          if (loginStatus.loggedIn) {
            setMessages(prev => [...prev, { type: 'system', content: '✅ ' + loginStatus.message, id: nextId(), timestamp: new Date().toISOString() }]);
            setBridgeStatus(prev => ({ ...prev, active: true }));
          } else {
            setMessages(prev => [...prev, { type: 'system', content: '⚠️ ' + loginStatus.message, id: nextId(), timestamp: new Date().toISOString() }]);
            // Start background polling to detect when user logs in
            setAwaitingLogin(true);
          }
        }
      } catch (e) {
        setMessages(prev => [...prev, { type: 'system', content: `❌ Erro no login: ${e.message}`, id: nextId(), timestamp: new Date().toISOString() }]);
      }
      return;
    }

    // /logout
    if (text === '/logout') {
      setMessages(prev => [...prev, { type: 'system', content: '🚪 Encerrando sessão...', id: nextId(), timestamp: new Date().toISOString() }]);
      try {
        const result = await luna.kimiBridge?.logout?.('luna-cli', { killChrome: true });
        if (result) {
          setMessages(prev => [...prev, { type: 'system', content: result.message, id: nextId(), timestamp: new Date().toISOString() }]);
          setBridgeStatus({ active: false });
        }
      } catch (e) {
        setMessages(prev => [...prev, { type: 'system', content: `❌ Erro: ${e.message}`, id: nextId(), timestamp: new Date().toISOString() }]);
      }
      return;
    }

    // /status
    if (text === '/status') {
      try {
        const st = await luna.kimiBridge?.getStatus?.('luna-cli') || { active: false };
        const txt = `Kimi: ${st.active ? '✅' : '❌'} │ Sessão: ${session.id?.slice(0, 8)} │ Msgs: ${messages.length}`;
        setMessages(prev => [...prev, { type: 'system', content: txt, id: nextId(), timestamp: new Date().toISOString() }]);
      } catch (e) {
        setMessages(prev => [...prev, { type: 'system', content: `❌ ${e.message}`, id: nextId(), timestamp: new Date().toISOString() }]);
      }
      return;
    }

    // /yolo
    if (text === '/yolo') {
      const ny = !session.yoloMode;
      setSession(prev => ({ ...prev, yoloMode: ny }));
      setMessages(prev => [...prev, { type: 'system', content: `YOLO: ${ny ? 'ON' : 'OFF'}`, id: nextId(), timestamp: new Date().toISOString() }]);
      return;
    }

    // /thinking — toggle thinking display mode (compact vs stream)
    if (text === '/thinking') {
      const next = !showThinkingStream;
      setShowThinkingStream(next);
      setSession(prev => ({ ...prev, showThinkingStream: next }));
      setMessages(prev => [...prev, {
        type: 'system',
        content: `🧠 Thinking display: ${next ? 'STREAM (full text)' : 'COMPACT (indicator only)'}`,
        id: nextId(), timestamp: new Date().toISOString()
      }]);
      return;
    }

    // ─── Mensagem normal para LunaSoul ────────────────────────────────────
    setMessages(prev => [...prev, {
      type: 'user', content: text,
      timestamp: new Date().toISOString(), id: nextId(),
    }]);
    setIsProcessing(true);
    const processingStart = Date.now();
    setStatusText('🧠 Analisando...');
    setStreamingText('');
    setThinkingText('');
    thinkingRef.current = '';
    responseRef.current = '';
    thinkingStartRef.current = null;
    setCanSteer(false);

    try {
      const stream = luna.processMessageStream(text, {
        sessionId: session.id,
        mode: session.mode,
        persona: session.persona,
        userId: 'luna-cli',
      });

      let finalResult = null;

      // Watchdog: protect against infinite loops or stalled streams
      const WATCHDOG_STALL_MS = 60000;   // 60s without any event
      const WATCHDOG_MAX_MS = 300000;    // 5m total hard limit
      let lastEventTime = Date.now();
      let streamTimedOut = false;
      const watchdog = setInterval(() => {
        const now = Date.now();
        if (now - lastEventTime > WATCHDOG_STALL_MS) {
          streamTimedOut = true;
          clearInterval(watchdog);
        }
        if (now - processingStart > WATCHDOG_MAX_MS) {
          streamTimedOut = true;
          clearInterval(watchdog);
        }
      }, 5000);

      for await (const ev of stream) {
        lastEventTime = Date.now();
        if (streamTimedOut) break;
        // If user aborted with Ctrl+C, ignore remaining events
        if (shouldAbortRef.current) continue;
        switch (ev.type) {
          case 'thinking_start':
            setAiState('analyzing');
            setStatusText('🧠 Pensando...');
            thinkingStartRef.current = Date.now();
            break;

          case 'thinking_delta': {
            const full = ev.fullThinking || '';
            thinkingRef.current = full;
            if (showThinkingStream) {
              // Clean thinking before displaying
              const cleaned = cleanThinking(full, { removeNoise: true, deduplicate: true });
              setThinkingText(cleaned.thinking);
            }
            // Compute compact indicator
            const elapsed = thinkingStartRef.current ? ((Date.now() - thinkingStartRef.current) / 1000).toFixed(1) : '0.0';
            const metrics = getThinkingMetrics(full);
            const tokStr = metrics.tokens >= 1000 ? `${(metrics.tokens / 1000).toFixed(1)}k` : `${metrics.tokens}`;
            if (!showThinkingStream) {
              setStatusText(`🧠 Thinking ${'.'.repeat((Date.now() / 200) % 4)}  ${elapsed}s · ${tokStr} tokens`);
            } else {
              setStatusText('🧠 Pensando...');
            }
            break;
          }

          case 'response_delta': {
            const full = stripResponseTags(ev.fullResponse || '');
            responseRef.current = full;
            setStreamingText(full);
            setAiState('responding');
            setStatusText('💬 Respondendo...');
            // When response starts, collapse thinking if it was expanded
            if (showThinkingStream && !thinkingCollapsed) {
              setThinkingCollapsed(true);
            }
            break;
          }

          case 'can_steer':
            setCanSteer(ev.value);
            break;

          case 'waiting':
            setStatusText(`⏳ ${ev.message || 'Aguardando...'}`);
            break;

          case 'response_done':
            setStreamingText(stripResponseTags(ev.response || ''));
            setThinkingText('');
            setAiState('idle');
            break;

          case 'mode_detected':
            setStatusText(`🔹 Modo: ${ev.mode}`);
            break;

          case 'action_start': {
            const tool = ev.tool || 'tool';
            setActiveToolCalls(n => n + 1);
            setMessages(prev => [...prev, {
              type: 'tool_call', tool,
              params: ev.params,
              timestamp: new Date().toISOString(),
              id: nextId(),
            }]);
            setStatusText(`🔧 ${tool}`);
            break;
          }

          case 'action_end': {
            setActiveToolCalls(n => Math.max(0, n - 1));
            const res = ev.result;
            // Mark corresponding tool_call as completed (stops spinner)
            setMessages(prev => {
              const updated = [...prev];
              // Find last tool_call with same tool that isn't completed
              for (let i = updated.length - 1; i >= 0; i--) {
                if (updated[i].type === 'tool_call' && updated[i].tool === ev.tool && !updated[i].completed) {
                  updated[i] = { ...updated[i], completed: true };
                  break;
                }
              }
              return updated;
            });
            if (res) {
              const friendly = res.result?.friendlyMessage || res.friendlyMessage;
              const technical = res.result?.stdout || res.result?.output || res.result?.text || JSON.stringify(res.result);
              setMessages(prev => [...prev, {
                type: 'tool_result', success: res.success !== false,
                tool: ev.tool,
                output: friendly || technical,
                friendly: !!friendly,
                timestamp: new Date().toISOString(),
                id: nextId(),
              }]);
            }
            break;
          }

          case 'plan_start':
            setActiveAgents(n => n + 1);
            setStatusText(`📋 Plano: ${(ev.steps || []).length} passos`);
            break;

          case 'plan_step':
            setStatusText(`📋 Passo ${ev.stepIndex + 1}/${ev.total}: ${ev.tool}`);
            break;

          case 'plan_error':
            setActiveAgents(n => Math.max(0, n - 1));
            setMessages(prev => [...prev, {
              type: 'system', content: `❌ Plano falhou no passo ${(ev.stepIndex || 0) + 1}: ${ev.error}`,
              timestamp: new Date().toISOString(), id: nextId(),
            }]);
            break;

          case 'plan_complete':
            setActiveAgents(n => Math.max(0, n - 1));
            setStatusText('✅ Plano concluído');
            break;

          case 'meta_start':
            setActiveAgents(n => n + 1);
            setStatusText(`🔮 META: ${ev.metaAction}`);
            break;

          case 'meta_end': {
            setActiveAgents(n => Math.max(0, n - 1));
            const mres = ev.result;
            setMessages(prev => [...prev, {
              type: 'system',
              content: mres?.success ? `✅ ${mres.message}` : `❌ ${mres?.error}`,
              timestamp: new Date().toISOString(), id: nextId(),
            }]);
            break;
          }

          case 'suggest': {
            const sug = ev.suggestion || {};
            setPendingSuggestion({
              type: sug.type,
              target: sug.target,
              reason: sug.reason,
              confidence: sug.confidence,
            });
            if (ev.result?.autoApproved) {
              setTimeout(() => {
                const s = sessionRef.current;
                if (s) luna.applySuggestion(s.id, sug.type, sug.target);
                setPendingSuggestion(null);
              }, 2000);
            }
            break;
          }

          case 'error': {
            const errMsg = ev.error || '';
            // CRITICAL: Always release processing lock on error so user can type again
            setIsProcessing(false);
            setStreamingText('');
            setThinkingText('');
            setStatusText('');
            setAiState('error');
            setActiveToolCalls(0);
            setActiveAgents(0);
            setCanSteer(false);
            thinkingRef.current = '';
            responseRef.current = '';
            const isConnErr = errMsg.includes('ECONNREFUSED') || errMsg.includes('ETIMEDOUT') || errMsg.includes('connectOverCDP') || errMsg.includes('disconnected');
            if (isConnErr) {
              setMessages(prev => [...prev, {
                type: 'system', content: '🔌 Chrome não detectado. Iniciando automaticamente...',
                timestamp: new Date().toISOString(), id: nextId(),
              }]);
              // Fire-and-forget auto-heal
              (async () => {
                try {
                  const st = await luna.kimiBridge?.checkChrome?.();
                  if (st && st.running) {
                    const pmsg = st.port ? ` (porta ${st.port})` : '';
                    setMessages(prev => [...prev, {
                      type: 'system', content: `🚀 Chrome iniciado${pmsg}. Pode enviar sua mensagem.`,
                      timestamp: new Date().toISOString(), id: nextId(),
                    }]);
                  } else {
                    setMessages(prev => [...prev, {
                      type: 'system', content: `⚠️ Não consegui iniciar Chrome: ${st?.error || errMsg}. Tente /login.`,
                      timestamp: new Date().toISOString(), id: nextId(),
                    }]);
                  }
                } catch (e) {
                  setMessages(prev => [...prev, {
                    type: 'system', content: `❌ Auto-heal falhou: ${e.message}. Tente /login.`,
                    timestamp: new Date().toISOString(), id: nextId(),
                  }]);
                }
              })();
            } else {
              setMessages(prev => [...prev, {
                type: 'system', content: `❌ ${errMsg}`,
                timestamp: new Date().toISOString(), id: nextId(),
              }]);
            }
            break;
          }

          case 'warning':
            setMessages(prev => [...prev, {
              type: 'system', content: ev.message,
              timestamp: new Date().toISOString(), id: nextId(),
            }]);
            break;

          case 'compact_start':
            setStatusText('📦 Compactando contexto...');
            setMessages(prev => [...prev, {
              type: 'system', content: ev.message,
              timestamp: new Date().toISOString(), id: nextId(),
            }]);
            break;

          case 'compact_progress':
            setStatusText(ev.message);
            setMessages(prev => [...prev, {
              type: 'system', content: ev.message,
              timestamp: new Date().toISOString(), id: nextId(),
            }]);
            break;

          case 'compact_end':
            setStatusText('✅ Contexto compactado');
            setMessages(prev => [...prev, {
              type: 'system', content: ev.message,
              timestamp: new Date().toISOString(), id: nextId(),
            }]);
            break;

          case 'compact_error':
            setStatusText('❌ Erro na compactação');
            setMessages(prev => [...prev, {
              type: 'system', content: ev.message,
              timestamp: new Date().toISOString(), id: nextId(),
            }]);
            break;

          case 'done':
            finalResult = ev.result;
            break;
        }
      }
      clearInterval(watchdog);

      // Handle stream timeout — force release lock
      if (streamTimedOut && !finalResult) {
        setIsProcessing(false);
        setStreamingText('');
        setThinkingText('');
        setStatusText('');
        setAiState('error');
        setActiveToolCalls(0);
        setActiveAgents(0);
        thinkingRef.current = '';
        responseRef.current = '';
        setMessages(prev => [...prev, {
          type: 'system', content: '⏱️ Stream travado por timeout (sem eventos por 60s ou >5m total). Lock liberado.',
          timestamp: new Date().toISOString(), id: nextId(),
        }]);
        return;
      }

      // Add final assistant message if it's a chat/done response
      if (finalResult) {
        const isChatLike = finalResult.mode === 'CHAT' || finalResult.mode === 'DONE';
        const hasResponse = finalResult.response || finalResult.message;
        if (isChatLike && hasResponse) {
          setMessages(prev => [...prev, {
            type: 'assistant', response: hasResponse, mode: finalResult.mode,
            timestamp: new Date().toISOString(), id: nextId(),
          }]);
        }

        // Handle continuation
        if (finalResult.needsContinue) {
          let cont = finalResult;
          let safety = 0;
          while (cont.needsContinue && safety < 15) {
            safety++;
            cont = await luna.continueLoop(session.id, { mode: session.mode, userId: 'luna-cli' });
            if (cont.mode === 'CHAT' || cont.mode === 'DONE') {
              if (cont.response || cont.message) {
                setMessages(prev => [...prev, {
                  type: 'assistant', response: cont.response || cont.message, mode: cont.mode,
                  timestamp: new Date().toISOString(), id: nextId(),
                }]);
              }
              break;
            }
            if (!cont.success) {
              setMessages(prev => [...prev, {
                type: 'system', content: `❌ ${cont.error || 'Erro'}`,
                timestamp: new Date().toISOString(), id: nextId(),
              }]);
              break;
            }
          }
        }
      }

      setIsProcessing(false);
      setStreamingText('');
      setThinkingText('');
      thinkingRef.current = '';
      responseRef.current = '';
      thinkingStartRef.current = null;
      setStatusText('');
      setActiveToolCalls(0);
      setActiveAgents(0);
      setCanSteer(false);

      const updated = sessionManager.loadSession(session.id);
      if (updated) setSession(updated);

      // Process queued messages
      await processQueue();

    } catch (err) {
      setActiveAgents(0);
      const msg = err.message || '';
      const isConnectionError = msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('connectOverCDP') || msg.includes('disconnected');

      if (isConnectionError && !text.startsWith('/') && retries < 1) {
        // Auto-heal: try to start Chrome and retry the message (max 1 retry)
        setMessages(prev => [...prev, {
          type: 'system', content: '🔌 Chrome não detectado. Iniciando automaticamente...',
          timestamp: new Date().toISOString(), id: nextId(),
        }]);
        try {
          const chromeStatus = await luna.kimiBridge?.checkChrome?.();
          if (chromeStatus && chromeStatus.running) {
            const portMsg = chromeStatus.port ? ` (porta ${chromeStatus.port})` : '';
            setMessages(prev => [...prev, {
              type: 'system', content: `🚀 Chrome iniciado${portMsg}. Reenviando mensagem...`,
              timestamp: new Date().toISOString(), id: nextId(),
            }]);
            // Queue the message for retry with incremented retry count
            messageQueue.current.unshift({ text, retries: retries + 1 });
          } else {
            setMessages(prev => [...prev, {
              type: 'system', content: `⚠️ Não consegui iniciar Chrome: ${chromeStatus?.error || msg}. Tente /login manualmente.`,
              timestamp: new Date().toISOString(), id: nextId(),
            }]);
          }
        } catch (e) {
          setMessages(prev => [...prev, {
            type: 'system', content: `❌ Auto-heal falhou: ${e.message}. Tente /login.`,
            timestamp: new Date().toISOString(), id: nextId(),
          }]);
        }
      } else {
        setMessages(prev => [...prev, {
          type: 'system', content: `❌ Erro: ${err.message}`,
          timestamp: new Date().toISOString(), id: nextId(),
        }]);
      }

      setIsProcessing(false);
      setStreamingText('');
      setThinkingText('');
      setStatusText('');
      setCanSteer(false);

      // Still process queue on error
      await processQueue();
    }
  }, [session, luna, sessionManager, messages.length, exit, processQueue]);

  // Abort controller for Ctrl+C during processing
  const shouldAbortRef = useRef(false);

  // Teclas globais
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (isProcessingRef.current) {
        // Abort current operation instead of exiting
        shouldAbortRef.current = true;
        setIsProcessing(false);
        setStreamingText('');
        setThinkingText('');
        setStatusText('');
        setActiveToolCalls(0);
        setActiveAgents(0);
        setCanSteer(false);
        setMessages(prev => [...prev, {
          type: 'system', content: '⏹ Operação abortada pelo usuário.',
          timestamp: new Date().toISOString(), id: nextId(),
        }]);
        // Fire-and-forget: ask bridge to click stop button
        (async () => {
          try {
            await luna.kimiBridge?.abortGeneration?.('luna-cli');
          } catch (e) { /* ignore */ }
        })();
        return;
      }
      exit();
      return;
    }
    if (key.ctrl && input === 'h') { setShowHelp(h => !h); return; }

    // Ctrl+S: Steer mode — inject mid-response guidance
    if (key.ctrl && input === 's') {
      if (isProcessingRef.current && canSteer) {
        setShowSteerInput(true);
      }
      return;
    }

    // ── Scroll Control ──
    // PgUp / PgDn / ↑ / ↓ for viewport scroll
    if (key.pageUp) {
      setScrollOffset(s => s + 5);
      setFollowMode(false);
      return;
    }
    if (key.pageDown) {
      setScrollOffset(s => Math.max(0, s - 5));
      return;
    }
    if (key.upArrow && key.shift) {
      setScrollOffset(s => s + 1);
      setFollowMode(false);
      return;
    }
    if (key.downArrow && key.shift) {
      setScrollOffset(s => Math.max(0, s - 1));
      return;
    }
    if (key.end || (key.ctrl && input === 'e')) {
      setScrollOffset(0);
      setFollowMode(true);
      setHasNewContent(false);
      return;
    }
  });

  // Steer input handler
  const handleSteerSubmit = useCallback(async (text) => {
    setShowSteerInput(false);
    if (!text.trim()) return;
    try {
      setStatusText('🎯 Steer enviado...');
      const result = await luna.kimiBridge.injectSteer('luna-cli', text);
      if (result.success) {
        setMessages(prev => [...prev, {
          type: 'system', content: `🎯 Steer: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`,
          timestamp: new Date().toISOString(), id: nextId(),
        }]);
      } else {
        setMessages(prev => [...prev, {
          type: 'system', content: `❌ Steer falhou: ${result.error}`,
          timestamp: new Date().toISOString(), id: nextId(),
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        type: 'system', content: `❌ Steer erro: ${err.message}`,
        timestamp: new Date().toISOString(), id: nextId(),
      }]);
    }
  }, [luna]);

  // Picker handlers
  const handleSelectSession = useCallback((s) => {
    const loaded = sessionManager.loadSession(s.id);
    setSession(loaded || s);
    setShowPicker(false);
  }, [sessionManager]);

  const handleNewSession = useCallback(() => {
    const s = sessionManager.createSession({ title: 'Nova sessão' });
    setSession(s);
    setShowPicker(false);
  }, [sessionManager]);

  // ─── RENDER ─────────────────────────────────────────────────────────────

  if (showPicker) {
    return h(Box, { flexDirection: 'column', height: '100%', width: '100%', padding: 1 },
      h(SessionPicker, {
        sessions: sessionsList,
        onSelect: handleSelectSession,
        onNew: handleNewSession,
      })
    );
  }

  if (!session) {
    return h(Box, { flexDirection: 'column', padding: 2 },
      h(Text, { color: C.error }, '❌ Nenhuma sessão ativa.')
    );
  }

  return h(Box, { flexDirection: 'column', height: '100%', width: '100%' },
    // Header
    h(Header, { session, msgCount: messages.length }),

    // Chat area — flexGrow takes remaining space, flexShrink prevents overflow
    h(Box, {
      flexDirection: 'column',
      flexGrow: 1,
      flexShrink: 1,
      width: '100%',
      minHeight: 2,
    },
      // New content indicator
      hasNewContent && !followMode && h(Box, { flexDirection: 'row', justifyContent: 'center', height: 1 },
        h(Text, { color: C.warning, bold: true, backgroundColor: C.headerBg }, ' ↓ Novas mensagens ↓ ')
      ),
      h(MessageList, {
        messages, streamingText, thinkingText,
        isStreaming: isProcessing, showThinkingStream,
        scrollOffset,
        maxHeight: rows - 6,
        thinkingCollapsed,
        onToggleThinking: () => setThinkingCollapsed(c => !c),
      }),
    ),

    // Status
    h(StatusLine, { text: statusText, isProcessing }),

    // Suggestion
    h(SuggestionBar, { suggestion: pendingSuggestion }),

    // Steer input overlay
    showSteerInput && h(SteerInput, {
      onSubmit: handleSteerSubmit,
      onCancel: () => setShowSteerInput(false),
    }),

    // Help overlay — centered but clamps to available space
    showHelp && h(Box, {
      position: 'absolute',
      marginTop: Math.max(0, Math.floor((rows - 20) / 2)),
      marginLeft: Math.max(0, Math.floor((columns - 62) / 2)),
    },
      h(HelpOverlay, { onClose: () => setShowHelp(false) })
    ),

    // Input
    h(InputBox, {
      onSubmit: handleCommand,
      onQueue: (msg) => { messageQueue.current.push(msg); },
      isActive: !showHelp && !showPicker && !showSteerInput,
      isProcessing,
      queueLength: messageQueue.current.length,
    }),

    // StatusBar inferior (abaixo do input)
    h(StatusBar, {
      session,
      messages,
      isProcessing,
      activeToolCalls,
      activeAgents,
      bridgeStatus,
      sessionStartTime,
      followMode,
      scrollOffset,
      aiState,
    }),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTRYPOINT
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const hasFlag = (f) => args.includes(f);
  const getFlagValue = (f) => {
    const i = args.indexOf(f);
    return i >= 0 ? args[i + 1] : undefined;
  };

  if (hasFlag('--version') || hasFlag('-v')) {
    console.log('3.3.0');
    process.exit(0);
  }

  const sessionManager = new SessionManager();

  let session;
  if (hasFlag('--new') || hasFlag('-n')) {
    session = sessionManager.createSession({ title: 'Nova sessão' });
  } else if (hasFlag('--resume') || hasFlag('-r')) {
    const id = getFlagValue('--resume') || getFlagValue('-r');
    session = sessionManager.loadSession(id);
    if (!session) { console.error('Sessão não encontrada.'); process.exit(1); }
  } else {
    session = sessionManager.getOrCreateCurrentSession();
  }

  if (hasFlag('--mode') || hasFlag('-m')) {
    const m = getFlagValue('--mode') || getFlagValue('-m');
    if (m) session.mode = m;
  }
  if (hasFlag('--thinking')) session.mode = 'thinking';
  if (hasFlag('--instant')) session.mode = 'instant';

  const luna = new LunaSoul({ defaultMode: session.mode });

  try {
    await luna.init({ userId: 'luna-cli' });
  } catch (err) {
    console.error('❌ Kimi Web:', err.message);
    console.error('Verifique se Chrome está rodando com --remote-debugging-port=9222\n');
  }

  // One-shot
  const oneShot = args.find(a => !a.startsWith('-') && !['instant', 'thinking'].includes(a));
  if (oneShot) {
    try {
      await luna.processMessage(oneShot, { sessionId: session.id, mode: session.mode, userId: 'luna-cli' });
    } catch (err) { console.error('❌', err.message); }
    await luna.disconnect();
    process.exit(0);
  }

  render(h(App, { luna, sessionManager, initialSession: session }), { exitOnCtrlC: false });

  const cleanup = () => {
    process.stdout.write('\x1b[?1049l'); // restore primary screen
  };
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  process.on('exit', () => {
    cleanup();
    luna.disconnect?.().catch(() => {});
  });
}

main().catch(err => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
