import React from 'react';
import { Box, Text } from 'ink';

const h = React.createElement;

const COLORS = {
  suggest: '#ffb74d',
  input: '#ffffff',
  dim: '#888888',
};

export function SuggestionLine({ suggestion }) {
  if (!suggestion) return null;

  const auto = (suggestion.confidence || 0) >= 0.85;
  const typeLabel = suggestion.type === 'persona' ? '🎭 Persona' : '📚 Skill';
  const confidence = Math.round((suggestion.confidence || 0) * 100);

  return h(Box, {
    flexDirection: 'column',
    paddingX: 1,
    paddingY: 1,
    borderStyle: 'single',
    borderColor: COLORS.suggest,
    width: '100%',
  },
    h(Box, { flexDirection: 'row' },
      h(Text, { color: COLORS.suggest, bold: true }, auto ? '⚡ Auto-switch: ' : '💡 Sugestão: '),
      h(Text, { color: COLORS.input, bold: true }, `${typeLabel} "${suggestion.target}"`),
      h(Text, { color: COLORS.dim }, ` (${confidence}%)`)
    ),
    suggestion.reason && h(Text, { color: COLORS.dim, wrap: 'wrap' }, `Motivo: ${suggestion.reason}`),
    !auto && h(Text, { color: COLORS.dim, italic: true }, 'Digite /sim para confirmar ou /nao para rejeitar')
  );
}
