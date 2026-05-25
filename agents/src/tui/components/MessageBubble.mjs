import React from 'react';
import { Box, Text, Newline } from 'ink';

const h = React.createElement;

const COLORS = {
  user: '#4fc3f7',
  luna: '#ce93d8',
  tool: '#ffd54f',
  success: '#81c784',
  error: '#e57373',
  dim: '#888888',
  system: '#aaaaaa',
};

function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ''; }
}

export function MessageBubble({ msg }) {
  const type = msg.type;

  if (type === 'user') {
    return h(Box, { flexDirection: 'column', marginY: 1, paddingX: 1 },
      h(Box, { flexDirection: 'row' },
        h(Text, { color: COLORS.user, bold: true }, '❯ '),
        h(Text, { color: COLORS.user, bold: true }, 'Você'),
        h(Text, { color: COLORS.dim, dimColor: true }, `  ${formatTime(msg.timestamp)}`)
      ),
      h(Box, { marginLeft: 2, flexDirection: 'column' },
        ...(msg.content || '').split('\n').map((line, i) =>
          h(Text, { key: i, wrap: 'wrap' }, line || ' ')
        )
      )
    );
  }

  if (type === 'assistant') {
    const content = msg.response || msg.content || '';
    const modeLabel = msg.mode && msg.mode !== 'CHAT' ? ` [${msg.mode}]` : '';
    return h(Box, { flexDirection: 'column', marginY: 1, paddingX: 1 },
      h(Box, { flexDirection: 'row' },
        h(Text, { color: COLORS.luna, bold: true }, '🌙 '),
        h(Text, { color: COLORS.luna, bold: true }, 'Luna'),
        h(Text, { color: COLORS.dim, dimColor: true }, `${modeLabel}  ${formatTime(msg.timestamp)}`)
      ),
      h(Box, { marginLeft: 2, flexDirection: 'column' },
        ...(content).split('\n').map((line, i) =>
          h(Text, { key: i, wrap: 'wrap' }, line || ' ')
        )
      )
    );
  }

  if (type === 'tool_call') {
    const tool = msg.tool || msg.action?.type || 'tool';
    const params = JSON.stringify(msg.params || msg.action?.params || {}).slice(0, 120);
    return h(Box, { flexDirection: 'column', marginY: 1, paddingX: 1 },
      h(Box, { flexDirection: 'row' },
        h(Text, { color: COLORS.tool, bold: true }, '🔧 '),
        h(Text, { color: COLORS.tool, bold: true }, tool),
        h(Text, { color: COLORS.dim, dimColor: true }, `  ${formatTime(msg.timestamp)}`)
      ),
      h(Box, { marginLeft: 2 },
        h(Text, { color: COLORS.dim, wrap: 'wrap' }, params)
      )
    );
  }

  if (type === 'tool_result') {
    const ok = msg.success !== false;
    const output = (msg.output || msg.stdout || '').slice(0, 500);
    return h(Box, { flexDirection: 'column', marginY: 1, paddingX: 1, marginLeft: 2 },
      h(Box, { flexDirection: 'row' },
        h(Text, { color: ok ? COLORS.success : COLORS.error }, ok ? '✅ ' : '❌ '),
        h(Text, { color: ok ? COLORS.success : COLORS.error, bold: true }, ok ? 'Sucesso' : 'Erro'),
        h(Text, { color: COLORS.dim, dimColor: true }, `  ${formatTime(msg.timestamp)}`)
      ),
      output && h(Box, { marginLeft: 2, flexDirection: 'column' },
        ...output.split('\n').map((line, i) =>
          h(Text, { key: i, color: COLORS.dim, wrap: 'wrap' }, line || ' ')
        )
      )
    );
  }

  if (type === 'system') {
    return h(Box, { flexDirection: 'column', marginY: 1, paddingX: 1 },
      h(Box, { flexDirection: 'row' },
        h(Text, { color: COLORS.system, dimColor: true }, '⚡ '),
        h(Text, { color: COLORS.system, dimColor: true, wrap: 'wrap' }, msg.content || '')
      )
    );
  }

  return null;
}
