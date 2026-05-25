/**
 * Luna TUI v3.1 — Interface Terminal com Ink + React
 * Componentes principais da interface
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, useInput, useApp, useStdout, Static, Spacer } from 'ink';

// ─── Helpers ──────────────────────────────────────────────────────────────

const h = React.createElement;

const COLORS = {
  headerBg: '#1a1a2e',
  headerFg: '#e0e0e0',
  user: '#4fc3f7',
  luna: '#ce93d8',
  tool: '#ffd54f',
  success: '#81c784',
  error: '#e57373',
  dim: '#666666',
  input: '#ffffff',
  border: '#444444',
  suggest: '#ffb74d',
};

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Header ───────────────────────────────────────────────────────────────

function Header({ session, persona, mode, messageCount }) {
  const id = session?.id?.slice(0, 8) || '????';
  const title = session?.title || 'Nova sessão';
  return h(Box, { flexDirection: 'row', backgroundColor: COLORS.headerBg, paddingX: 1, height: 1 },
    h(Text, { color: COLORS.headerFg, bold: true }, `🌙 Luna `),
    h(Text, { color: COLORS.dim }, `│ ${title} `),
    h(Text, { color: COLORS.dim }, `│ ${id} │ ${messageCount} msgs │ `),
    h(Text, { color: persona === 'surgeon' ? COLORS.error : persona === 'architect' ? COLORS.user : COLORS.luna, bold: true }, persona || 'default'),
    h(Text, { color: COLORS.dim }, ` │ ${mode || 'thinking'}`),
    h(Spacer),
    h(Text, { color: COLORS.dim }, 'Ctrl+H ajuda')
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────

function MessageBubble({ msg }) {
  const isUser = msg.type === 'user';
  const isTool = msg.type === 'tool_call';
  const isResult = msg.type === 'tool_result';
  const isSystem = msg.type === 'system';

  let label, color, content;
  if (isUser) {
    label = 'Você';
    color = COLORS.user;
    content = msg.content || '';
  } else if (msg.type === 'assistant') {
    label = 'Luna' + (msg.mode ? ` [${msg.mode}]` : '');
    color = COLORS.luna;
    content = msg.response || msg.content || '';
  } else if (isTool) {
    label = `🔧 ${msg.tool || msg.action?.type || 'tool'}`;
    color = COLORS.tool;
    content = JSON.stringify(msg.params || msg.action?.params || {}).slice(0, 200);
  } else if (isResult) {
    const ok = msg.success !== false;
    label = ok ? '✅' : '❌';
    color = ok ? COLORS.success : COLORS.error;
    content = (msg.output || msg.stdout || '').slice(0, 300);
  } else if (isSystem) {
    label = '⚡';
    color = COLORS.dim;
    content = msg.content || '';
  } else {
    return null;
  }

  return h(Box, { flexDirection: 'column', marginY: 1, paddingX: 1 },
    h(Text, { color, bold: true, dimColor: isSystem }, `${label}${msg.timestamp ? ` ${formatTime(msg.timestamp)}` : ''}`),
    h(Box, { marginLeft: 2, flexDirection: 'column' },
      content.split('\n').map((line, i) =>
        h(Text, { key: i, color: isSystem ? COLORS.dim : undefined, wrap: 'wrap' }, line || ' ')
      )
    )
  );
}

// ─── Status Bar ───────────────────────────────────────────────────────────

function StatusBar({ text, isProcessing }) {
  if (!text && !isProcessing) return null;
  return h(Box, { flexDirection: 'row', paddingX: 1, marginY: 1 },
    h(Text, { color: COLORS.tool }, isProcessing ? '🧠 ' : ''),
    h(Text, { color: COLORS.dim, italic: true }, text || 'Pensando...')
  );
}

// ─── Suggestion Bar ───────────────────────────────────────────────────────

function SuggestionBar({ suggestion, onConfirm, onReject }) {
  if (!suggestion) return null;
  const auto = suggestion.confidence >= 0.85;
  return h(Box, { flexDirection: 'column', paddingX: 1, marginY: 1, borderStyle: 'single', borderColor: COLORS.suggest },
    h(Box, { flexDirection: 'row' },
      h(Text, { color: COLORS.suggest, bold: true }, auto ? '⚡ Auto-switch: ' : '💡 Sugestão: '),
      h(Text, { color: COLORS.input }, `${suggestion.type === 'persona' ? 'Persona' : 'Skill'} "${suggestion.target}"`),
      h(Text, { color: COLORS.dim }, ` (${Math.round((suggestion.confidence || 0) * 100)}%)`)
    ),
    h(Text, { color: COLORS.dim, wrap: 'wrap' }, `Motivo: ${suggestion.reason || ''}`),
    !auto && h(Text, { color: COLORS.dim, italic: true }, 'Digite /sim para confirmar ou /nao para rejeitar')
  );
}

// ─── Input Box ────────────────────────────────────────────────────────────

function InputBox({ value, onChange, onSubmit, isFocused, prefix = '❯ ' }) {
  useInput((input, key) => {
    if (key.return) {
      onSubmit(value);
      return;
    }
    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
      return;
    }
    if (key.ctrl && input === 'u') {
      onChange('');
      return;
    }
    if (input && !key.ctrl && !key.meta && !key.tab) {
      onChange(value + input);
    }
  }, { isActive: isFocused });

  return h(Box, { flexDirection: 'row', paddingX: 1, borderStyle: 'single', borderColor: isFocused ? COLORS.user : COLORS.border, height: 3 },
    h(Text, { color: COLORS.user, bold: true }, prefix),
    h(Text, { color: COLORS.input }, value),
    isFocused && h(Text, { color: COLORS.input }, '▌')
  );
}

// ─── Help Modal ───────────────────────────────────────────────────────────

function HelpModal({ onClose }) {
  useInput((input, key) => {
    if (key.escape || input === 'q' || input === 'Q') {
      onClose();
    }
  });

  const commands = [
    ['/sair, /exit', 'Encerra a sessão'],
    ['/novo', 'Nova sessão'],
    ['/limpar', 'Limpa contexto'],
    ['/modo', 'Lista personas/modos'],
    ['/modo <nome>', 'Muda persona'],
    ['/modo instant/thinking', 'Muda modo'],
    ['/skills', 'Lista skills'],
    ['/auto', 'Toggle auto-switch'],
    ['/sim', 'Confirma sugestão'],
    ['/nao', 'Rejeita sugestão'],
    ['/status', 'Status do sistema'],
    ['/yolo', 'Toggle YOLO mode'],
    ['/help', 'Mostra esta ajuda'],
    ['Ctrl+H', 'Toggle ajuda'],
    ['Ctrl+C', 'Sair'],
  ];

  return h(Box, { flexDirection: 'column', paddingX: 2, paddingY: 1, borderStyle: 'double', borderColor: COLORS.user },
    h(Text, { color: COLORS.user, bold: true }, '🌙 Comandos Luna'),
    h(Text, { color: COLORS.dim }, '─'.repeat(40)),
    ...commands.map(([cmd, desc], i) =>
      h(Box, { key: i, flexDirection: 'row' },
        h(Text, { color: COLORS.luna, width: 24 }, cmd),
        h(Text, { color: COLORS.dim }, desc)
      )
    ),
    h(Text, { color: COLORS.dim, italic: true }, '\nPressione ESC ou Q para fechar')
  );
}

// ─── Session Picker ───────────────────────────────────────────────────────

function SessionPicker({ sessions, onSelect, onNew }) {
  const [selected, setSelected] = useState(0);
  const total = sessions.length + 1; // +1 for "Nova sessão"

  useInput((input, key) => {
    if (key.upArrow) {
      setSelected(s => (s - 1 + total) % total);
    } else if (key.downArrow) {
      setSelected(s => (s + 1) % total);
    } else if (key.return) {
      if (selected === 0) {
        onNew();
      } else {
        onSelect(sessions[selected - 1]);
      }
    }
  });

  return h(Box, { flexDirection: 'column', paddingX: 2, paddingY: 1 },
    h(Text, { color: COLORS.user, bold: true }, '📁 Sessões disponíveis'),
    h(Text, { color: COLORS.dim }, '─'.repeat(50)),
    h(Box, { flexDirection: 'row' },
      h(Text, { color: selected === 0 ? COLORS.user : COLORS.dim, bold: selected === 0 }, selected === 0 ? '▸' : ' '),
      h(Text, { color: selected === 0 ? COLORS.input : COLORS.dim }, ' 0. Nova sessão')
    ),
    ...sessions.map((s, i) => {
      const idx = i + 1;
      const date = s.lastAccessedAt ? new Date(s.lastAccessedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'N/A';
      return h(Box, { key: s.id, flexDirection: 'row' },
        h(Text, { color: selected === idx ? COLORS.user : COLORS.dim, bold: selected === idx }, selected === idx ? '▸' : ' '),
        h(Text, { color: selected === idx ? COLORS.input : COLORS.dim }, ` ${idx}. ${s.title || 'Sem título'} ${date} (${s.messageCount || 0} msgs)`)
      );
    }),
    h(Text, { color: COLORS.dim, italic: true }, '\n↑↓ navegar  Enter selecionar')
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────

export function App({ luna, sessionManager, initialSession }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [width, setWidth] = useState(stdout.columns || 80);

  // Session state
  const [session, setSession] = useState(initialSession);
  const [showPicker, setShowPicker] = useState(!initialSession);
  const [sessions, setSessions] = useState([]);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [activeStatus, setActiveStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Input state
  const [inputValue, setInputValue] = useState('');
  const [inputFocused, setInputFocused] = useState(true);

  // UI state
  const [showHelp, setShowHelp] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState(null);

  // Refs for event handlers
  const inputRef = useRef(inputValue);
  inputRef.current = inputValue;
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Resize handler
  useEffect(() => {
    const onResize = () => setWidth(stdout.columns || 80);
    stdout.on('resize', onResize);
    return () => stdout.off('resize', onResize);
  }, [stdout]);

  // Load sessions for picker
  useEffect(() => {
    if (showPicker) {
      setSessions(sessionManager.listSessions());
    }
  }, [showPicker, sessionManager]);

  // Load chat history when session changes
  useEffect(() => {
    if (!session) return;
    try {
      const events = sessionManager.readContext(session.id) || [];
      setMessages(events.map(ev => ({ ...ev, key: `${ev.timestamp}-${Math.random()}` })));
    } catch {
      setMessages([]);
    }
  }, [session?.id, sessionManager]);

  // Listen to LunaSoul events
  useEffect(() => {
    const onProgress = (ev) => {
      if (ev.type === 'thinking') {
        setActiveStatus(ev.message || '🧠 Analisando...');
        setIsProcessing(true);
      } else if (ev.type === 'action' || ev.type === 'tool_call') {
        const tool = ev.tool || ev.action?.type || 'tool';
        const params = JSON.stringify(ev.params || ev.action?.params || {}).slice(0, 80);
        setMessages(prev => [...prev, {
          type: 'tool_call',
          tool,
          params: ev.params || ev.action?.params,
          timestamp: new Date().toISOString(),
          key: `tool-${Date.now()}`,
        }]);
        setActiveStatus(`🔧 ${tool} ${params}`);
      } else if (ev.type === 'success' || ev.type === 'tool_result') {
        setMessages(prev => [...prev, {
          type: 'tool_result',
          success: ev.success !== false,
          output: ev.output || ev.stdout || ev.message,
          timestamp: new Date().toISOString(),
          key: `result-${Date.now()}`,
        }]);
        setActiveStatus('');
      } else if (ev.type === 'error') {
        setMessages(prev => [...prev, {
          type: 'system',
          content: `❌ ${ev.message}`,
          timestamp: new Date().toISOString(),
          key: `err-${Date.now()}`,
        }]);
        setIsProcessing(false);
        setActiveStatus('');
      } else if (ev.type === 'plan') {
        setActiveStatus(`📋 ${ev.message}`);
      } else if (ev.type === 'meta' || ev.type === 'meta_success' || ev.type === 'meta_error') {
        setMessages(prev => [...prev, {
          type: 'system',
          content: ev.message,
          timestamp: new Date().toISOString(),
          key: `meta-${Date.now()}`,
        }]);
      } else if (ev.type === 'suggest') {
        setPendingSuggestion({
          type: ev.suggestionType,
          target: ev.target,
          reason: ev.reason,
          confidence: ev.confidence,
          autoApproved: ev.autoApproved,
        });
        if (ev.autoApproved) {
          // Auto-apply after a short delay to let user see
          setTimeout(() => {
            luna.applySuggestion(sessionRef.current?.id, ev.suggestionType, ev.target);
            setPendingSuggestion(null);
          }, 2000);
        }
      } else if (ev.type === 'persona_switched') {
        setMessages(prev => [...prev, {
          type: 'system',
          content: ev.message,
          timestamp: new Date().toISOString(),
          key: `switch-${Date.now()}`,
        }]);
        // Refresh session to get new persona
        const updated = sessionManager.loadSession(sessionRef.current?.id);
        if (updated) setSession(updated);
      }
    };

    const onResponse = (ev) => {
      if (!ev.content) return;
      setMessages(prev => [...prev, {
        type: 'assistant',
        response: ev.content,
        mode: ev.mode,
        timestamp: new Date().toISOString(),
        key: `resp-${Date.now()}`,
      }]);
      setIsProcessing(false);
      setActiveStatus('');
    };

    luna.on('progress', onProgress);
    luna.on('response', onResponse);

    return () => {
      luna.off('progress', onProgress);
      luna.off('response', onResponse);
    };
  }, [luna, sessionManager]);

  // Global keyboard shortcuts
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }
    if (key.ctrl && input === 'h') {
      setShowHelp(h => !h);
      return;
    }
  });

  // Handle user input submission
  const handleSubmit = useCallback(async (text) => {
    if (!text.trim()) return;
    if (!session) return;

    // Inline commands
    const trimmed = text.trim();

    if (trimmed === '/sair' || trimmed === '/exit') {
      exit();
      return;
    }

    if (trimmed === '/help') {
      setShowHelp(true);
      setInputValue('');
      return;
    }

    if (trimmed === '/novo') {
      const s = sessionManager.createSession({ title: 'Nova sessão' });
      setSession(s);
      setMessages([]);
      setInputValue('');
      return;
    }

    if (trimmed === '/limpar') {
      sessionManager.clearContext(session.id);
      setMessages([]);
      setInputValue('');
      return;
    }

    if (trimmed.startsWith('/modo ')) {
      const arg = trimmed.split(' ')[1];
      if (arg === 'instant' || arg === 'thinking') {
        const statePath = sessionManager._getStatePath?.(session.id) || require('path').join(require('os').homedir(), '.luna', 'sessions', session.id, 'state.json');
        try {
          const fs = await import('fs');
          const s = JSON.parse(fs.readFileSync(statePath, 'utf8'));
          s.mode = arg;
          fs.writeFileSync(statePath, JSON.stringify(s, null, 2));
        } catch {}
        setSession(prev => ({ ...prev, mode: arg }));
      } else {
        // Change persona
        const personaPath = require('path').join(require('os').homedir(), '.luna', 'personas', `${arg}.md`);
        const fs = require('fs');
        if (fs.existsSync(personaPath)) {
          const statePath = require('path').join(require('os').homedir(), '.luna', 'sessions', session.id, 'state.json');
          try {
            const s = JSON.parse(fs.readFileSync(statePath, 'utf8'));
            s.persona = arg;
            fs.writeFileSync(statePath, JSON.stringify(s, null, 2));
          } catch {}
          setSession(prev => ({ ...prev, persona: arg }));
          setMessages(prev => [...prev, { type: 'system', content: `🎭 Persona "${arg}" ativada`, timestamp: new Date().toISOString(), key: `mode-${Date.now()}` }]);
        } else {
          setMessages(prev => [...prev, { type: 'system', content: `❌ Persona "${arg}" não encontrada`, timestamp: new Date().toISOString(), key: `err-${Date.now()}` }]);
        }
      }
      setInputValue('');
      return;
    }

    if (trimmed === '/modo') {
      const personaDir = require('path').join(require('os').homedir(), '.luna', 'personas');
      const fs = require('fs');
      const personas = fs.existsSync(personaDir) ? fs.readdirSync(personaDir).filter(f => f.endsWith('.md')).map(f => f.replace('.md', '')) : [];
      const lines = ['🎭 Personas: ' + personas.join(', '), `Modos: instant | thinking (atual: ${session.mode || 'thinking'})`];
      setMessages(prev => [...prev, { type: 'system', content: lines.join('\n'), timestamp: new Date().toISOString(), key: `modo-${Date.now()}` }]);
      setInputValue('');
      return;
    }

    if (trimmed === '/skills') {
      const skillDir = require('path').join(require('os').homedir(), '.luna', 'skills');
      const fs = require('fs');
      const skills = fs.existsSync(skillDir) ? fs.readdirSync(skillDir).filter(d => fs.statSync(require('path').join(skillDir, d)).isDirectory()) : [];
      setMessages(prev => [...prev, { type: 'system', content: '📚 Skills: ' + skills.join(', '), timestamp: new Date().toISOString(), key: `skills-${Date.now()}` }]);
      setInputValue('');
      return;
    }

    if (trimmed === '/auto') {
      luna.autoSwitchEnabled = !luna.autoSwitchEnabled;
      setMessages(prev => [...prev, { type: 'system', content: `🤖 Auto-switch: ${luna.autoSwitchEnabled ? 'ON' : 'OFF'}`, timestamp: new Date().toISOString(), key: `auto-${Date.now()}` }]);
      setInputValue('');
      return;
    }

    if (trimmed === '/sim' || trimmed === '/yes') {
      if (pendingSuggestion) {
        const s = pendingSuggestion;
        const result = await luna.applySuggestion(session.id, s.type, s.target);
        setMessages(prev => [...prev, { type: 'system', content: result.success ? `✅ ${s.type} "${s.target}" ativada.` : `❌ ${result.error}`, timestamp: new Date().toISOString(), key: `sim-${Date.now()}` }]);
        setPendingSuggestion(null);
      } else {
        setMessages(prev => [...prev, { type: 'system', content: 'Nenhuma sugestão pendente.', timestamp: new Date().toISOString(), key: `sim-${Date.now()}` }]);
      }
      setInputValue('');
      return;
    }

    if (trimmed === '/nao' || trimmed === '/no') {
      if (pendingSuggestion) {
        setMessages(prev => [...prev, { type: 'system', content: `❌ Sugestão rejeitada: ${pendingSuggestion.target}`, timestamp: new Date().toISOString(), key: `nao-${Date.now()}` }]);
        setPendingSuggestion(null);
      } else {
        setMessages(prev => [...prev, { type: 'system', content: 'Nenhuma sugestão pendente.', timestamp: new Date().toISOString(), key: `nao-${Date.now()}` }]);
      }
      setInputValue('');
      return;
    }

    if (trimmed === '/status') {
      const st = luna.kimiBridge?.getStatus?.('luna-cli') || { active: false };
      const text = `Kimi: ${st.active ? '✅' : '❌'} │ Sessão: ${session.id?.slice(0,8)} │ Msgs: ${messages.length}`;
      setMessages(prev => [...prev, { type: 'system', content: text, timestamp: new Date().toISOString(), key: `status-${Date.now()}` }]);
      setInputValue('');
      return;
    }

    if (trimmed === '/yolo') {
      const newYolo = !session.yoloMode;
      setSession(prev => ({ ...prev, yoloMode: newYolo }));
      setMessages(prev => [...prev, { type: 'system', content: `YOLO: ${newYolo ? 'ON' : 'OFF'}`, timestamp: new Date().toISOString(), key: `yolo-${Date.now()}` }]);
      setInputValue('');
      return;
    }

    // Normal message
    setMessages(prev => [...prev, {
      type: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
      key: `user-${Date.now()}`,
    }]);
    setInputValue('');
    setIsProcessing(true);
    setActiveStatus('🧠 Analisando...');

    try {
      const result = await luna.processMessage(trimmed, {
        sessionId: session.id,
        mode: session.mode,
        persona: session.persona,
        userId: 'luna-cli',
      });

      // Handle suggestions that need confirmation
      if (result.mode === 'SUGGEST' && result.needsConfirmation) {
        setPendingSuggestion({ type: result.type, target: result.target, reason: result.reason, confidence: result.confidence });
      }

      // Handle continue loop for ACTION/PLAN modes
      if (result.needsContinue) {
        let cont = result;
        let safety = 0;
        while (cont.needsContinue && safety < 15) {
          safety++;
          cont = await luna.continueLoop(session.id, {
            mode: session.mode,
            userId: 'luna-cli',
          });
          if (cont.mode === 'CHAT' || cont.mode === 'DONE') {
            if (cont.response || cont.message) {
              setMessages(prev => [...prev, {
                type: 'assistant',
                response: cont.response || cont.message,
                mode: cont.mode,
                timestamp: new Date().toISOString(),
                key: `resp-${Date.now()}`,
              }]);
            }
            break;
          }
          if (!cont.success) {
            setMessages(prev => [...prev, {
              type: 'system',
              content: `❌ ${cont.error || 'Erro'}`,
              timestamp: new Date().toISOString(),
              key: `err-${Date.now()}`,
            }]);
            break;
          }
        }
        setIsProcessing(false);
        setActiveStatus('');
      }

      // Refresh session stats
      const updated = sessionManager.loadSession(session.id);
      if (updated) setSession(updated);

    } catch (err) {
      setMessages(prev => [...prev, {
        type: 'system',
        content: `❌ Erro: ${err.message}`,
        timestamp: new Date().toISOString(),
        key: `err-${Date.now()}`,
      }]);
      setIsProcessing(false);
      setActiveStatus('');
    }
  }, [session, luna, sessionManager, pendingSuggestion, messages.length, exit]);

  // Session picker handlers
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

  // Render
  if (showPicker) {
    return h(SessionPicker, { sessions, onSelect: handleSelectSession, onNew: handleNewSession });
  }

  if (!session) {
    return h(Box, { flexDirection: 'column', padding: 2 },
      h(Text, { color: COLORS.error }, '❌ Nenhuma sessão ativa.')
    );
  }

  return h(Box, { flexDirection: 'column', height: '100%' },
    // Header
    h(Header, {
      session,
      persona: session.persona || 'default',
      mode: session.mode || 'thinking',
      messageCount: messages.length,
    }),

    // Chat history (scrollable area)
    h(Box, { flexDirection: 'column', flexGrow: 1, overflow: 'hidden' },
      // Static messages (permanent, no re-render)
      messages.length > 0 && h(Static, { items: messages },
        msg => h(MessageBubble, { key: msg.key, msg })
      ),

      // Active status / thinking indicator
      h(StatusBar, { text: activeStatus, isProcessing }),
    ),

    // Suggestion bar
    h(SuggestionBar, {
      suggestion: pendingSuggestion,
      onConfirm: () => handleSubmit('/sim'),
      onReject: () => handleSubmit('/nao'),
    }),

    // Help modal overlay
    showHelp && h(Box, { position: 'absolute', marginTop: 2, marginLeft: 4 },
      h(HelpModal, { onClose: () => setShowHelp(false) })
    ),

    // Input box
    h(InputBox, {
      value: inputValue,
      onChange: setInputValue,
      onSubmit: handleSubmit,
      isFocused: inputFocused,
    }),
  );
}

export default App;
