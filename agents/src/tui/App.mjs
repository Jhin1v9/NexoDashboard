/**
 * Luna TUI v3.1 — App Principal
 * Integra LunaSoul + Ink React components
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, Static, useInput, useApp, useWindowSize } from 'ink';
import { Header } from './components/Header.mjs';
import { MessageBubble } from './components/MessageBubble.mjs';
import { InputBar } from './components/InputBar.mjs';
import { StatusLine } from './components/StatusLine.mjs';
import { SuggestionLine } from './components/SuggestionLine.mjs';
import { HelpOverlay } from './components/HelpOverlay.mjs';
import { SessionPicker } from './components/SessionPicker.mjs';

const h = React.createElement;

// ─── App Component ────────────────────────────────────────────────────────

export function App({ luna, sessionManager, initialSession }) {
  const { exit } = useApp();
  const { columns, rows } = useWindowSize();

  // Session state
  const [session, setSession] = useState(initialSession);
  const [showPicker, setShowPicker] = useState(!initialSession);
  const [sessionsList, setSessionsList] = useState([]);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [activeStatus, setActiveStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // UI state
  const [showHelp, setShowHelp] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState(null);

  // Refs for latest state in callbacks
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const pendingRef = useRef(pendingSuggestion);
  pendingRef.current = pendingSuggestion;

  // ─── Load sessions for picker ──────────────────────────────────────────
  useEffect(() => {
    if (showPicker) {
      setSessionsList(sessionManager.listSessions());
    }
  }, [showPicker, sessionManager]);

  // ─── Load chat history ─────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    try {
      const events = sessionManager.readContext(session.id) || [];
      setMessages(events.map((ev, i) => ({ ...ev, key: `${ev.timestamp || Date.now()}-${i}` })));
    } catch {
      setMessages([]);
    }
  }, [session?.id, sessionManager]);

  // ─── LunaSoul event listeners ──────────────────────────────────────────
  useEffect(() => {
    const onProgress = (ev) => {
      if (ev.type === 'thinking') {
        setActiveStatus(ev.message || '🧠 Analisando...');
        setIsProcessing(true);
      } else if (ev.type === 'action' || ev.type === 'tool_call') {
        const tool = ev.tool || ev.action?.type || 'tool';
        const params = JSON.stringify(ev.params || ev.action?.params || {}).slice(0, 120);
        setMessages(prev => [...prev, {
          type: 'tool_call', tool, params: ev.params || ev.action?.params,
          timestamp: new Date().toISOString(),
          key: `tool-${Date.now()}`,
        }]);
        setActiveStatus(`🔧 ${tool} ${params}`);
      } else if (ev.type === 'success' || ev.type === 'tool_result') {
        setMessages(prev => [...prev, {
          type: 'tool_result', success: ev.success !== false,
          output: ev.output || ev.stdout || ev.message,
          timestamp: new Date().toISOString(),
          key: `result-${Date.now()}`,
        }]);
        setActiveStatus('');
      } else if (ev.type === 'error') {
        setMessages(prev => [...prev, {
          type: 'system', content: `❌ ${ev.message}`,
          timestamp: new Date().toISOString(),
          key: `err-${Date.now()}`,
        }]);
        setIsProcessing(false);
        setActiveStatus('');
      } else if (ev.type === 'plan') {
        setActiveStatus(`📋 ${ev.message}`);
      } else if (ev.type === 'meta' || ev.type === 'meta_success' || ev.type === 'meta_error') {
        setMessages(prev => [...prev, {
          type: 'system', content: ev.message,
          timestamp: new Date().toISOString(),
          key: `meta-${Date.now()}`,
        }]);
      } else if (ev.type === 'suggest') {
        setPendingSuggestion({
          type: ev.suggestionType,
          target: ev.target,
          reason: ev.reason,
          confidence: ev.confidence,
        });
        if (ev.autoApproved) {
          setTimeout(() => {
            const s = sessionRef.current;
            if (s) luna.applySuggestion(s.id, ev.suggestionType, ev.target);
            setPendingSuggestion(null);
          }, 2000);
        }
      } else if (ev.type === 'persona_switched') {
        setMessages(prev => [...prev, {
          type: 'system', content: ev.message,
          timestamp: new Date().toISOString(),
          key: `switch-${Date.now()}`,
        }]);
        const updated = sessionManager.loadSession(sessionRef.current?.id);
        if (updated) setSession(updated);
      }
    };

    const onResponse = (ev) => {
      if (!ev.content) return;
      setMessages(prev => [...prev, {
        type: 'assistant', response: ev.content, mode: ev.mode,
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

  // ─── Global keyboard shortcuts ─────────────────────────────────────────
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

  // ─── Command handlers ──────────────────────────────────────────────────
  const handleCommand = useCallback(async (text) => {
    if (!session) return;
    const trimmed = text.trim();

    // /sair /exit
    if (trimmed === '/sair' || trimmed === '/exit') {
      exit(); return;
    }

    // /help
    if (trimmed === '/help') {
      setShowHelp(true); return;
    }

    // /novo
    if (trimmed === '/novo') {
      const s = sessionManager.createSession({ title: 'Nova sessão' });
      setSession(s); setMessages([]); return;
    }

    // /limpar
    if (trimmed === '/limpar') {
      sessionManager.clearContext(session.id);
      setMessages([]); return;
    }

    // /modo <arg>
    if (trimmed.startsWith('/modo ')) {
      const arg = trimmed.split(' ')[1];
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
        setMessages(prev => [...prev, {
          type: 'system', content: `Modo: ${arg}`,
          timestamp: new Date().toISOString(), key: `cmd-${Date.now()}`,
        }]);
      } else {
        const personaPath = path.join(os.homedir(), '.luna', 'personas', `${arg}.md`);
        if (fs.existsSync(personaPath)) {
          try {
            const s = JSON.parse(fs.readFileSync(statePath, 'utf8'));
            s.persona = arg; fs.writeFileSync(statePath, JSON.stringify(s, null, 2));
          } catch {}
          setSession(prev => ({ ...prev, persona: arg }));
          setMessages(prev => [...prev, {
            type: 'system', content: `🎭 Persona "${arg}" ativada`,
            timestamp: new Date().toISOString(), key: `cmd-${Date.now()}`,
          }]);
        } else {
          setMessages(prev => [...prev, {
            type: 'system', content: `❌ Persona "${arg}" não encontrada`,
            timestamp: new Date().toISOString(), key: `cmd-${Date.now()}`,
          }]);
        }
      }
      return;
    }

    // /modo (listar)
    if (trimmed === '/modo') {
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
      setMessages(prev => [...prev, {
        type: 'system', content: lines.join('\n'),
        timestamp: new Date().toISOString(), key: `cmd-${Date.now()}`,
      }]);
      return;
    }

    // /skills
    if (trimmed === '/skills') {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      const skillDir = path.join(os.homedir(), '.luna', 'skills');
      const skills = fs.existsSync(skillDir)
        ? fs.readdirSync(skillDir).filter(d => fs.statSync(path.join(skillDir, d)).isDirectory())
        : [];
      setMessages(prev => [...prev, {
        type: 'system', content: '📚 Skills: ' + skills.join(', '),
        timestamp: new Date().toISOString(), key: `cmd-${Date.now()}`,
      }]);
      return;
    }

    // /auto
    if (trimmed === '/auto') {
      luna.autoSwitchEnabled = !luna.autoSwitchEnabled;
      setMessages(prev => [...prev, {
        type: 'system', content: `🤖 Auto-switch: ${luna.autoSwitchEnabled ? 'ON' : 'OFF'}`,
        timestamp: new Date().toISOString(), key: `cmd-${Date.now()}`,
      }]);
      return;
    }

    // /sim /yes
    if (trimmed === '/sim' || trimmed === '/yes') {
      const sug = pendingRef.current;
      if (sug) {
        const result = await luna.applySuggestion(session.id, sug.type, sug.target);
        setMessages(prev => [...prev, {
          type: 'system',
          content: result.success ? `✅ ${sug.type} "${sug.target}" ativada.` : `❌ ${result.error}`,
          timestamp: new Date().toISOString(), key: `cmd-${Date.now()}`,
        }]);
        setPendingSuggestion(null);
      } else {
        setMessages(prev => [...prev, {
          type: 'system', content: 'Nenhuma sugestão pendente.',
          timestamp: new Date().toISOString(), key: `cmd-${Date.now()}`,
        }]);
      }
      return;
    }

    // /nao /no
    if (trimmed === '/nao' || trimmed === '/no') {
      const sug = pendingRef.current;
      if (sug) {
        setMessages(prev => [...prev, {
          type: 'system', content: `❌ Sugestão rejeitada: ${sug.target}`,
          timestamp: new Date().toISOString(), key: `cmd-${Date.now()}`,
        }]);
        setPendingSuggestion(null);
      } else {
        setMessages(prev => [...prev, {
          type: 'system', content: 'Nenhuma sugestão pendente.',
          timestamp: new Date().toISOString(), key: `cmd-${Date.now()}`,
        }]);
      }
      return;
    }

    // /status
    if (trimmed === '/status') {
      try {
        const st = await luna.kimiBridge?.getStatus?.('luna-cli') || { active: false };
        const text = `Kimi: ${st.active ? '✅' : '❌'} │ Sessão: ${session.id?.slice(0, 8)} │ Msgs: ${messages.length}`;
        setMessages(prev => [...prev, {
          type: 'system', content: text,
          timestamp: new Date().toISOString(), key: `cmd-${Date.now()}`,
        }]);
      } catch (e) {
        setMessages(prev => [...prev, {
          type: 'system', content: `❌ Status indisponível: ${e.message}`,
          timestamp: new Date().toISOString(), key: `cmd-${Date.now()}`,
        }]);
      }
      return;
    }

    // /yolo
    if (trimmed === '/yolo') {
      const newYolo = !session.yoloMode;
      setSession(prev => ({ ...prev, yoloMode: newYolo }));
      setMessages(prev => [...prev, {
        type: 'system', content: `YOLO: ${newYolo ? 'ON' : 'OFF'}`,
        timestamp: new Date().toISOString(), key: `cmd-${Date.now()}`,
      }]);
      return;
    }

    // ─── Normal message to LunaSoul ──────────────────────────────────────
    setMessages(prev => [...prev, {
      type: 'user', content: trimmed,
      timestamp: new Date().toISOString(),
      key: `user-${Date.now()}`,
    }]);
    setIsProcessing(true);
    setActiveStatus('🧠 Analisando...');

    try {
      const result = await luna.processMessage(trimmed, {
        sessionId: session.id,
        mode: session.mode,
        persona: session.persona,
        userId: 'luna-cli',
      });

      if (result.mode === 'SUGGEST' && result.needsConfirmation) {
        setPendingSuggestion({ type: result.type, target: result.target, reason: result.reason, confidence: result.confidence });
      }

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
                type: 'assistant', response: cont.response || cont.message, mode: cont.mode,
                timestamp: new Date().toISOString(), key: `resp-${Date.now()}`,
              }]);
            }
            break;
          }
          if (!cont.success) {
            setMessages(prev => [...prev, {
              type: 'system', content: `❌ ${cont.error || 'Erro'}`,
              timestamp: new Date().toISOString(), key: `err-${Date.now()}`,
            }]);
            break;
          }
        }
        setIsProcessing(false);
        setActiveStatus('');
      }

      if (result.mode === 'ACTION' && !result.needsContinue) {
        setIsProcessing(false);
        setActiveStatus('');
      }

      // Refresh session stats
      const updated = sessionManager.loadSession(session.id);
      if (updated) setSession(updated);

    } catch (err) {
      setMessages(prev => [...prev, {
        type: 'system', content: `❌ Erro: ${err.message}`,
        timestamp: new Date().toISOString(), key: `err-${Date.now()}`,
      }]);
      setIsProcessing(false);
      setActiveStatus('');
    }
  }, [session, luna, sessionManager, messages.length, exit]);

  // ─── Session picker handlers ───────────────────────────────────────────
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

  // ─── Render ────────────────────────────────────────────────────────────

  if (showPicker) {
    return h(Box, {
      flexDirection: 'column',
      height: rows,
      width: columns,
      padding: 1,
    },
      h(SessionPicker, {
        sessions: sessionsList,
        onSelect: handleSelectSession,
        onNew: handleNewSession,
      })
    );
  }

  if (!session) {
    return h(Box, { flexDirection: 'column', padding: 2 },
      h(Text, { color: '#e57373' }, '❌ Nenhuma sessão ativa.')
    );
  }

  // Calculate heights
  const headerHeight = 1;
  const inputHeight = 3;
  const suggestHeight = pendingSuggestion ? 4 : 0;
  const statusHeight = (activeStatus || isProcessing) ? 1 : 0;
  const chatHeight = Math.max(5, rows - headerHeight - inputHeight - suggestHeight - statusHeight - 1);

  return h(Box, {
    flexDirection: 'column',
    height: rows,
    width: columns,
  },
    // Header
    h(Header, {
      session,
      messageCount: messages.length,
    }),

    // Chat area
    h(Box, {
      flexDirection: 'column',
      height: chatHeight,
      width: '100%',
      overflow: 'hidden',
    },
      // Messages list
      messages.length > 0 && h(Box, { flexDirection: 'column' },
        messages.map(msg => h(MessageBubble, { key: msg.key, msg }))
      ),
    ),

    // Status line
    h(StatusLine, { text: activeStatus, isProcessing }),

    // Suggestion bar
    h(SuggestionLine, { suggestion: pendingSuggestion }),

    // Help overlay
    showHelp && h(Box, {
      position: 'absolute',
      marginTop: Math.floor(rows / 4),
      marginLeft: Math.floor((columns - 60) / 2),
    },
      h(HelpOverlay, { onClose: () => setShowHelp(false) })
    ),

    // Input bar
    h(InputBar, {
      onSubmit: handleCommand,
      isActive: !showHelp && !showPicker,
    }),
  );
}

export default App;
