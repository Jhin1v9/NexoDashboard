import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';

const h = React.createElement;

export function SessionPicker({ sessions, onSelect, onNew }) {
  const total = sessions.length + 1;
  const [selected, setSelected] = useState(0);

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

  const formatDate = (iso) => {
    if (!iso) return 'N/A';
    try {
      return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return 'N/A'; }
  };

  return h(Box, {
    flexDirection: 'column',
    paddingX: 2,
    paddingY: 1,
    width: '100%',
  },
    h(Text, { color: '#4fc3f7', bold: true }, '📁 Sessões disponíveis'),
    h(Text, { color: '#666666' }, '─'.repeat(56)),

    // Nova sessão option
    h(Box, { flexDirection: 'row', height: 1 },
      h(Text, {
        color: selected === 0 ? '#4fc3f7' : '#666666',
        bold: selected === 0,
        width: 3,
      }, selected === 0 ? '▸' : ' '),
      h(Text, {
        color: selected === 0 ? '#ffffff' : '#888888',
        bold: selected === 0,
      }, ' 0. 🆕 Nova sessão')
    ),

    // Existing sessions
    ...sessions.map((s, i) => {
      const idx = i + 1;
      const isSelected = selected === idx;
      const date = formatDate(s.lastAccessedAt);
      const msgCount = s.messageCount || 0;
      const title = (s.title || 'Sem título').slice(0, 35);
      return h(Box, {
        key: s.id,
        flexDirection: 'row',
        height: 1,
      },
        h(Text, {
          color: isSelected ? '#4fc3f7' : '#666666',
          bold: isSelected,
          width: 3,
        }, isSelected ? '▸' : ' '),
        h(Text, {
          color: isSelected ? '#ffffff' : '#888888',
          bold: isSelected,
        }, ` ${idx}. ${title}`),
        h(Text, {
          color: '#666666',
          dimColor: true,
        }, `  ${date}  ${msgCount} msgs`)
      );
    }),

    h(Text, { color: '#666666', italic: true, marginTop: 1 }, '↑↓ navegar  Enter selecionar')
  );
}
