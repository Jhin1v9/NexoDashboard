import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from '@inkjs/ui';

const h = React.createElement;

export function StatusLine({ text, isProcessing }) {
  if (!text && !isProcessing) return null;

  return h(Box, {
    flexDirection: 'row',
    paddingX: 1,
    height: 1,
    width: '100%',
  },
    isProcessing && h(Spinner, { type: 'dots' }),
    h(Text, { color: '#ffd54f', italic: true, wrap: 'wrap' }, text || 'Pensando...')
  );
}
