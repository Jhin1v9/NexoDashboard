#!/usr/bin/env node
/**
 * Luna TUI v3.1 — Interface Terminal com Ink + React
 * Arquitetura inspirada em ShellAgent, Claude Code, Gemini CLI
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { render, Box, Text, useInput, useApp, useWindowSize } from 'ink';
import { Spinner, Badge } from '@inkjs/ui';
import { LunaSoul } from './luna-soul.cjs';
import { SessionManager } from './session-manager.cjs';
import { execSync } from 'child_process';

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

function MessageItem({ msg }) {
  if (msg.type === 'user') {
    return h(Box, { flexDirection: 'column', marginY: 1 },
      h(Box, { flexDirection: 'row' },
        h(Text, { color: C.user, bold: true }, '> '),
        h(Text, { color: C.user, bold: true }, 'Você'),
        h(Text, { color: C.dim, dimColor: true }, `  ${fmtTime(msg.timestamp)}`)
      ),
      h(Box, { marginLeft: 2, flexDirection: 'column' },
        ...(msg.content || '').split('\n').map((line, i) =>
          h(Text, { key: i, wrap: 'wrap' }, line || ' ')
        )
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
        ...content.split('\n').map((line, i) =>
          h(Text, { key: i, wrap: 'wrap' }, line || ' ')
        )
      )
    );
  }

  if (msg.type === 'tool_call') {
    const tool = msg.tool || 'tool';
    const params = JSON.stringify(msg.params || {}).slice(0, 140);
    return h(Box, { flexDirection: 'column', marginY: 1 },
      h(Box, { flexDirection: 'row' },
        h(Text, { color: C.tool, bold: true }, '🔧 '),
        h(Text, { color: C.tool, bold: true }, tool),
        h(Text, { color: C.dim, dimColor: true }, `  ${fmtTime(msg.timestamp)}`)
      ),
      h(Box, { marginLeft: 2 },
        h(Text, { color: C.dim, wrap: 'wrap' }, params)
      )
    );
  }

  if (msg.type === 'tool_result') {
    const ok = msg.success !== false;
    const output = (msg.output || '').slice(0, 500);
    return h(Box, { flexDirection: 'column', marginY: 1, marginLeft: 2 },
      h(Box, { flexDirection: 'row' },
        h(Text, { color: ok ? C.success : C.error }, ok ? '✅ ' : '❌ '),
        h(Text, { color: ok ? C.success : C.error }, ok ? 'Sucesso' : 'Erro'),
        h(Text, { color: C.dim, dimColor: true }, `  ${fmtTime(msg.timestamp)}`)
      ),
      output && h(Box, { marginLeft: 2, flexDirection: 'column' },
        ...output.split('\n').map((line, i) =>
          h(Text, { key: i, color: C.dim, wrap: 'wrap' }, line || ' ')
        )
      )
    );
  }

  if (msg.type === 'system') {
    return h(Box, { flexDirection: 'row', marginY: 1 },
      h(Text, { color: C.system, dimColor: true }, '⚡ '),
      h(Text, { color: C.system, dimColor: true, wrap: 'wrap' }, msg.content || '')
    );
  }

  return null;
}

function MessageList({ messages, streamingText, thinkingText, isStreaming, maxRows }) {
  // Limit visible messages to prevent layout overflow in small terminals
  const visibleCount = maxRows ? Math.max(1, Math.floor(maxRows / 2)) : messages.length;
  const visibleMessages = messages.slice(-visibleCount);

  return h(Box, { flexDirection: 'column', width: '100%' },
    visibleMessages.map(msg => h(MessageItem, { key: msg.id, msg })),

    // Thinking mode: dimmed, lower opacity reasoning text
    isStreaming && thinkingText && h(Box, { flexDirection: 'column', marginY: 1 },
      h(Box, { flexDirection: 'row' },
        h(Text, { color: C.dim, dimColor: true, bold: true }, '🧠 '),
        h(Text, { color: C.dim, dimColor: true, bold: true }, 'Pensando...')
      ),
      h(Box, { marginLeft: 2, flexDirection: 'column' },
        ...thinkingText.split('\n').map((line, i) =>
          h(Text, { key: i, color: C.dim, dimColor: true, wrap: 'wrap' }, line || ' ')
        )
      )
    ),

    // Streaming response
    isStreaming && streamingText && h(Box, { flexDirection: 'column', marginY: 1 },
      h(Box, { flexDirection: 'row' },
        h(Text, { color: C.luna, bold: true }, '🌙 '),
        h(Text, { color: C.luna, bold: true }, 'Luna')
      ),
      h(Box, { marginLeft: 2, flexDirection: 'column' },
        ...streamingText.split('\n').map((line, i) =>
          h(Text, { key: i, wrap: 'wrap' }, line || ' ')
        ),
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

function StatusBar({ session, messages, isProcessing, activeToolCalls, bridgeStatus, sessionStartTime }) {
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

  // Mode
  const modeText = session.mode || 'thinking';

  // Progress bar color
  const barColor = contextPercent > 80 ? C.error : contextPercent > 50 ? C.warning : C.success;

  // Layout: split into left/center/right
  // If terminal is narrow, stack vertically
  const isNarrow = columns < 100;

  const leftContent = h(Box, { flexDirection: 'row', width: isNarrow ? '100%' : '35%' },
    h(Text, { color: C.dim }, `${bridgeIcon} ${bridgeText} │ `),
    h(Text, { color: modeText === 'thinking' ? C.warning : C.success }, modeText),
    yoloText && h(Text, { color: C.error }, ` │ ${yoloText}`),
    activeToolCalls > 0 && h(Text, { color: C.tool }, ` │ 🔧${activeToolCalls}`)
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
    ['/novo', 'Nova sessão'],
    ['/limpar', 'Limpa contexto'],
    ['/modo <nome>', 'Muda persona'],
    ['/modo instant/thinking', 'Muda modo'],
    ['/skills', 'Lista skills'],
    ['/auto', 'Toggle auto-switch'],
    ['/sim /nao', 'Confirma/rejeita sugestão'],
    ['/status', 'Status do sistema'],
    ['/login', 'Login no Kimi Web (inicia Chrome se necessário)'],
    ['/yolo', 'Toggle YOLO'],
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
  const [canSteer, setCanSteer] = useState(false);
  const [steerInput, setSteerInput] = useState('');
  const [showSteerInput, setShowSteerInput] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState({ active: false });
  const [sessionStartTime, setSessionStartTime] = useState(Date.now());

  // Message queue: when AI is processing, user input queues here
  const messageQueue = useRef([]);
  const isProcessingRef = useRef(false);
  isProcessingRef.current = isProcessing;

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

  // Process message queue after response completes
  const processQueue = useCallback(async () => {
    if (messageQueue.current.length === 0) return;
    const nextMsg = messageQueue.current.shift();
    // Small delay to let UI settle
    await new Promise(r => setTimeout(r, 300));
    await handleCommand(nextMsg);
  }, []);

  // Core: handle a message with streaming
  const handleCommand = useCallback(async (text) => {
    if (!session) return;

    // /sair
    if (text === '/sair' || text === '/exit') { exit(); return; }

    // /help
    if (text === '/help') { setShowHelp(true); return; }

    // /novo
    if (text === '/novo') {
      const s = sessionManager.createSession({ title: 'Nova sessão' });
      setSession(s); setMessages([]); return;
    }

    // /limpar
    if (text === '/limpar') {
      sessionManager.clearContext(session.id);
      setMessages([]); return;
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
        // Step 1: Check/start Chrome
        const chromeStatus = await luna.kimiBridge?.checkChrome?.();
        if (chromeStatus) {
          if (chromeStatus.wasHeadless) {
            setMessages(prev => [...prev, { type: 'system', content: '⚠️ Chrome headless detectado e reiniciado em modo visível. Uma janela do Chrome deve aparecer.', id: nextId(), timestamp: new Date().toISOString() }]);
          }
          if (chromeStatus.started) {
            setMessages(prev => [...prev, { type: 'system', content: `🚀 Chrome visível iniciado (PID: ${chromeStatus.pid})`, id: nextId(), timestamp: new Date().toISOString() }]);
          } else if (chromeStatus.running) {
            setMessages(prev => [...prev, { type: 'system', content: '✅ Chrome já está rodando (modo visível)', id: nextId(), timestamp: new Date().toISOString() }]);
          } else if (chromeStatus.error) {
            setMessages(prev => [...prev, { type: 'system', content: `❌ Chrome: ${chromeStatus.error}`, id: nextId(), timestamp: new Date().toISOString() }]);
            return;
          }
        }
        // Step 2: Check Kimi login
        await new Promise(r => setTimeout(r, 2000));
        const loginStatus = await luna.kimiBridge?.ensureLogin?.('luna-cli');
        if (loginStatus) {
          setMessages(prev => [...prev, { type: 'system', content: loginStatus.loggedIn ? '✅ ' + loginStatus.message : '⚠️ ' + loginStatus.message, id: nextId(), timestamp: new Date().toISOString() }]);
        }
      } catch (e) {
        setMessages(prev => [...prev, { type: 'system', content: `❌ Erro no login: ${e.message}`, id: nextId(), timestamp: new Date().toISOString() }]);
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

    // ─── Mensagem normal para LunaSoul ────────────────────────────────────
    setMessages(prev => [...prev, {
      type: 'user', content: text,
      timestamp: new Date().toISOString(), id: nextId(),
    }]);
    setIsProcessing(true);
    setStatusText('🧠 Analisando...');
    setStreamingText('');
    setThinkingText('');
    setCanSteer(false);

    try {
      const stream = luna.processMessageStream(text, {
        sessionId: session.id,
        mode: session.mode,
        persona: session.persona,
        userId: 'luna-cli',
      });

      let finalResult = null;

      for await (const ev of stream) {
        switch (ev.type) {
          case 'thinking_start':
            setStatusText('🧠 Pensando...');
            break;

          case 'thinking_delta':
            setThinkingText(ev.fullThinking || '');
            setStatusText('🧠 Pensando...');
            break;

          case 'response_delta':
            setStreamingText(ev.fullResponse || '');
            setStatusText('💬 Respondendo...');
            break;

          case 'can_steer':
            setCanSteer(ev.value);
            break;

          case 'waiting':
            setStatusText(`⏳ ${ev.message || 'Aguardando...'}`);
            break;

          case 'response_done':
            setStreamingText(ev.response || '');
            setThinkingText('');
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
            if (res) {
              setMessages(prev => [...prev, {
                type: 'tool_result', success: res.success !== false,
                output: res.result?.stdout || res.result?.output || res.result?.text || JSON.stringify(res.result),
                timestamp: new Date().toISOString(),
                id: nextId(),
              }]);
            }
            break;
          }

          case 'plan_start':
            setStatusText(`📋 Plano: ${(ev.steps || []).length} passos`);
            break;

          case 'plan_step':
            setStatusText(`📋 Passo ${ev.stepIndex + 1}/${ev.total}: ${ev.tool}`);
            break;

          case 'plan_error':
            setMessages(prev => [...prev, {
              type: 'system', content: `❌ Plano falhou no passo ${(ev.stepIndex || 0) + 1}: ${ev.error}`,
              timestamp: new Date().toISOString(), id: nextId(),
            }]);
            break;

          case 'plan_complete':
            setStatusText('✅ Plano concluído');
            break;

          case 'meta_start':
            setStatusText(`🔮 META: ${ev.metaAction}`);
            break;

          case 'meta_end': {
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

          case 'error':
            setMessages(prev => [...prev, {
              type: 'system', content: `❌ ${ev.error}`,
              timestamp: new Date().toISOString(), id: nextId(),
            }]);
            break;

          case 'warning':
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
      setStatusText('');
      setActiveToolCalls(0);
      setCanSteer(false);

      const updated = sessionManager.loadSession(session.id);
      if (updated) setSession(updated);

      // Process queued messages
      await processQueue();

    } catch (err) {
      setMessages(prev => [...prev, {
        type: 'system', content: `❌ Erro: ${err.message}`,
        timestamp: new Date().toISOString(), id: nextId(),
      }]);
      setIsProcessing(false);
      setStreamingText('');
      setThinkingText('');
      setStatusText('');
      setCanSteer(false);

      // Still process queue on error
      await processQueue();
    }
  }, [session, luna, sessionManager, messages.length, exit, processQueue]);

  // Teclas globais
  useInput((input, key) => {
    if (key.ctrl && input === 'c') { exit(); return; }
    if (key.ctrl && input === 'h') { setShowHelp(h => !h); return; }

    // Ctrl+S: Steer mode — inject mid-response guidance
    if (key.ctrl && input === 's') {
      if (isProcessingRef.current && canSteer) {
        setShowSteerInput(true);
      }
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
      h(MessageList, { messages, streamingText, thinkingText, isProcessing, maxRows: Math.max(3, rows - 8) }),
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
      bridgeStatus,
      sessionStartTime,
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
    console.log('3.1.0');
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

  process.on('exit', async () => {
    await luna.disconnect();
  });
}

main().catch(err => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
