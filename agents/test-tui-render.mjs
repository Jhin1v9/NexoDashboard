import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp, useWindowSize } from 'ink';
import { Spinner, Badge } from '@inkjs/ui';

const h = React.createElement;
const C = {
  headerBg: '#1a1a2e', headerFg: '#e0e0e0', dim: '#666666',
  user: '#4fc3f7', luna: '#ce93d8', tool: '#ffd54f',
  success: '#81c784', error: '#e57373', warning: '#ffb74d',
  system: '#aaaaaa', input: '#ffffff', border: '#444444',
};

function Header({ session, msgCount }) {
  const id = session?.id?.slice(0, 8) || '????';
  const title = (session?.title || 'Nova sessão').slice(0, 28);
  const mode = session?.mode || 'thinking';
  const persona = session?.persona || 'default';
  return h(Box, { flexDirection: 'row', width: '100%', height: 1, backgroundColor: C.headerBg },
    h(Text, { color: C.headerFg, bold: true }, ' 🌙 Luna'),
    h(Text, { color: C.dim }, ` │ ${title}`),
    h(Text, { color: C.dim }, ` │ ${id} │ ${msgCount} msgs │ `),
    h(Text, { color: C.luna, bold: true }, persona),
    h(Text, { color: C.dim }, ` │ ${mode} `)
  );
}

function MessageItem({ msg }) {
  if (msg.type === 'user') {
    return h(Box, { flexDirection: 'column', marginY: 1 },
      h(Box, { flexDirection: 'row' },
        h(Text, { color: C.user, bold: true }, '> Você  '),
        h(Text, { color: C.dim, dimColor: true }, msg.time)
      ),
      h(Box, { marginLeft: 2 }, h(Text, { wrap: 'wrap' }, msg.content))
    );
  }
  if (msg.type === 'assistant') {
    return h(Box, { flexDirection: 'column', marginY: 1 },
      h(Box, { flexDirection: 'row' },
        h(Text, { color: C.luna, bold: true }, '🌙 Luna  '),
        h(Text, { color: C.dim, dimColor: true }, msg.time)
      ),
      h(Box, { marginLeft: 2 }, h(Text, { wrap: 'wrap' }, msg.content))
    );
  }
  if (msg.type === 'system') {
    return h(Box, { flexDirection: 'row', marginY: 1 },
      h(Text, { color: C.system, dimColor: true }, '⚡ ' + msg.content)
    );
  }
  return null;
}

function MessageList({ messages }) {
  return h(Box, { flexDirection: 'column', width: '100%' },
    messages.map(msg => h(MessageItem, { key: msg.id, msg }))
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
  return h(Box, { flexDirection: 'column', paddingX: 1, paddingY: 1, borderStyle: 'single', borderColor: C.warning, width: '100%', marginY: 1 },
    h(Text, { color: C.warning, bold: true }, '💡 Sugestão: '),
    h(Text, { color: C.input }, `Ativar persona "${suggestion.target}" (${Math.round(suggestion.confidence * 100)}%)`),
    h(Text, { color: C.dim, italic: true }, '/sim para confirmar │ /nao para rejeitar')
  );
}

function InputBox({ onSubmit, isActive }) {
  const [input, setInput] = useState('');
  useInput((char, key) => {
    if (!isActive) return;
    if (key.return) { onSubmit(input); setInput(''); return; }
    if (key.backspace || key.delete) { setInput(v => v.slice(0, -1)); return; }
    if (!key.ctrl && !key.meta && char) setInput(v => v + char);
  }, { isActive });
  return h(Box, { flexDirection: 'row', borderStyle: 'single', borderColor: isActive ? C.user : C.border, paddingX: 1, height: 3, width: '100%' },
    h(Text, { color: C.user, bold: true }, '❯ '),
    h(Text, { color: C.input }, input),
    isActive && h(Text, { color: C.input }, '▌')
  );
}

function TestApp() {
  const [messages, setMessages] = useState([
    { id: '1', type: 'user', content: 'Qual a hora?', time: '16:24:10' },
    { id: '2', type: 'assistant', content: 'São 16:24 CEST.', time: '16:24:12' },
    { id: '3', type: 'system', content: '🎭 Persona "surgeon" ativada (92% confiança)', time: '16:24:15' },
    { id: '4', type: 'user', content: 'Tem um bug no meu código', time: '16:24:20' },
  ]);
  const [status, setStatus] = useState('🧠 Analisando...');
  const [processing, setProcessing] = useState(true);
  const [suggestion, setSuggestion] = useState({ target: 'surgeon', confidence: 0.92 });

  useEffect(() => {
    const t1 = setTimeout(() => {
      setMessages(prev => [...prev, { id: '5', type: 'assistant', content: 'Vou investigar. Me mostre o stack trace ou o arquivo com o erro.', time: '16:24:25' }]);
      setStatus('');
      setProcessing(false);
    }, 1500);
    const t2 = setTimeout(() => {
      setMessages(prev => [...prev, { id: '6', type: 'user', content: 'Erro: Cannot read property of undefined', time: '16:24:30' }]);
      setStatus('🔧 shell: node test.js');
      setProcessing(true);
    }, 2500);
    const t3 = setTimeout(() => {
      setMessages(prev => [...prev,
        { id: '7', type: 'tool_call', content: 'shell node test.js', time: '16:24:32' },
        { id: '8', type: 'tool_result', content: 'TypeError: Cannot read property \'x\' of undefined\\n    at line 42', time: '16:24:33' },
      ]);
      setStatus('');
      setProcessing(false);
    }, 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return h(Box, { flexDirection: 'column', height: '100%' },
    h(Header, { session: { id: 'abc123def', title: 'Debug Session', mode: 'thinking', persona: 'surgeon' }, msgCount: messages.length }),
    h(Box, { flexDirection: 'column', flexGrow: 1, overflow: 'hidden' },
      h(MessageList, { messages })
    ),
    h(StatusLine, { text: status, isProcessing: processing }),
    h(SuggestionBar, { suggestion }),
    h(InputBox, { onSubmit: () => {}, isActive: true })
  );
}

const { unmount } = render(h(TestApp), { exitOnCtrlC: false });
setTimeout(() => { unmount(); console.log('\n[Test complete]'); process.exit(0); }, 5000);
