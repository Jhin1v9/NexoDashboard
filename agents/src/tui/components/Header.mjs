import React from 'react';
import { Box, Text, Spacer } from 'ink';

const h = React.createElement;

const COLORS = {
  bg: '#1a1a2e',
  fg: '#e0e0e0',
  dim: '#666666',
  user: '#4fc3f7',
  luna: '#ce93d8',
  architect: '#4fc3f7',
  devops: '#81c784',
  product: '#ffb74d',
  surgeon: '#e57373',
  default: '#ce93d8',
};

function personaColor(persona) {
  return COLORS[persona] || COLORS.default;
}

export function Header({ session, messageCount }) {
  const id = session?.id?.slice(0, 8) || '????';
  const title = (session?.title || 'Nova sessão').slice(0, 30);
  const mode = session?.mode || 'thinking';
  const persona = session?.persona || 'default';
  const count = messageCount || 0;
  const pColor = personaColor(persona);

  return h(Box, {
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
    paddingX: 1,
    height: 1,
    width: '100%',
  },
    h(Text, { color: COLORS.fg, bold: true }, '🌙 Luna'),
    h(Text, { color: COLORS.dim }, ' │ '),
    h(Text, { color: COLORS.fg }, title),
    h(Text, { color: COLORS.dim }, ` │ ${id} │ ${count} msgs │ `),
    h(Text, { color: pColor, bold: true }, persona),
    h(Text, { color: COLORS.dim }, ` │ ${mode}`),
    h(Spacer),
    h(Text, { color: COLORS.dim, dimColor: true }, 'Ctrl+H ajuda')
  );
}
