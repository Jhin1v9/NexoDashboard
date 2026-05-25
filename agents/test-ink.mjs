import React, { useState, useEffect } from 'react';
import { render, Box, Text, Static, useInput, useStdout } from 'ink';

const h = React.createElement;

function TestApp() {
  const [msgs, setMsgs] = useState([
    { id: '1', type: 'user', text: 'Oi Luna!' },
    { id: '2', type: 'assistant', text: 'Olá! Como posso ajudar?' },
  ]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('');

  useInput((inp, key) => {
    if (key.return) {
      setMsgs(prev => [...prev, { id: Date.now().toString(), type: 'user', text: input }]);
      setInput('');
      setStatus('🧠 Pensando...');
      setTimeout(() => {
        setStatus('');
        setMsgs(prev => [...prev, { id: (Date.now()+1).toString(), type: 'assistant', text: 'Resposta!' }]);
      }, 1000);
      return;
    }
    if (key.backspace || key.delete) {
      setInput(i => i.slice(0, -1));
      return;
    }
    if (inp && !key.ctrl && !key.meta) {
      setInput(i => i + inp);
    }
  });

  return h(Box, { flexDirection: 'column', height: '100%' },
    h(Box, { height: 1, backgroundColor: '#1a1a2e', flexDirection: 'row' },
      h(Text, { color: '#e0e0e0', bold: true }, '🌙 Luna v3.1 │ Teste')
    ),
    h(Box, { flexDirection: 'column', flexGrow: 1 },
      h(Static, { items: msgs }, msg =>
        h(Box, { key: msg.id, flexDirection: 'column', marginY: 1 },
          h(Text, { color: msg.type === 'user' ? '#4fc3f7' : '#ce93d8', bold: true },
            msg.type === 'user' ? 'Você' : 'Luna'
          ),
          h(Text, { wrap: 'wrap' }, msg.text)
        )
      ),
      status && h(Text, { color: '#ffd54f', italic: true }, status)
    ),
    h(Box, { flexDirection: 'row', borderStyle: 'single', borderColor: '#4fc3f7', paddingX: 1 },
      h(Text, { color: '#4fc3f7', bold: true }, '❯ '),
      h(Text, null, input),
      h(Text, { color: '#ffffff' }, '▌')
    )
  );
}

render(h(TestApp));
