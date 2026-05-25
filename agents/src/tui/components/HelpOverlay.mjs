import React from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';

const h = React.createElement;

const COMMANDS = [
  ['/sair, /exit', 'Encerra a sessão'],
  ['/novo', 'Nova sessão'],
  ['/limpar', 'Limpa contexto'],
  ['/modo', 'Lista personas/modos'],
  ['/modo <nome>', 'Muda persona'],
  ['/modo instant/thinking', 'Muda modo de resposta'],
  ['/skills', 'Lista skills disponíveis'],
  ['/auto', 'Toggle auto-switch ON/OFF'],
  ['/sim', 'Confirma sugestão pendente'],
  ['/nao', 'Rejeita sugestão pendente'],
  ['/status', 'Status do sistema'],
  ['/yolo', 'Toggle YOLO mode'],
  ['/help', 'Mostra esta ajuda'],
  ['Ctrl+H', 'Toggle ajuda'],
  ['Ctrl+C', 'Sair'],
  ['↑ ↓', 'Navegar histórico de input'],
];

export function HelpOverlay({ onClose }) {
  useInput((input, key) => {
    if (key.escape || input === 'q' || input === 'Q') {
      onClose();
    }
  });

  return h(Box, {
    flexDirection: 'column',
    paddingX: 2,
    paddingY: 1,
    borderStyle: 'double',
    borderColor: '#4fc3f7',
    width: 60,
  },
    h(Text, { color: '#4fc3f7', bold: true }, '🌙 Comandos Luna'),
    h(Text, { color: '#666666' }, '─'.repeat(56)),
    ...COMMANDS.map(([cmd, desc], i) =>
      h(Box, { key: i, flexDirection: 'row', marginY: 0 },
        h(Text, { color: '#ce93d8', width: 28 }, cmd),
        h(Text, { color: '#888888' }, desc)
      )
    ),
    h(Text, { color: '#666666', italic: true }, '\nPressione ESC ou Q para fechar')
  );
}
