import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

const h = React.createElement;

export function InputBar({ onSubmit, isActive, prefix = '❯ ' }) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useInput((char, key) => {
    if (!isActive) return;

    if (key.return) {
      const trimmed = input.trim();
      if (trimmed) {
        onSubmit(trimmed);
        setHistory(h => [trimmed, ...h].slice(0, 100));
        setInput('');
        setHistoryIndex(-1);
      }
      return;
    }

    if (key.backspace || key.delete) {
      setInput(v => v.slice(0, -1));
      return;
    }

    if (key.upArrow) {
      if (history.length > 0) {
        const next = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(next);
        setInput(history[next]);
      }
      return;
    }

    if (key.downArrow) {
      if (historyIndex > 0) {
        const next = historyIndex - 1;
        setHistoryIndex(next);
        setInput(history[next]);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
      return;
    }

    if (key.ctrl && char === 'u') {
      setInput('');
      return;
    }

    if (key.ctrl && char === 'c') {
      // Let parent handle exit
      return;
    }

    if (!key.ctrl && !key.meta && char) {
      setInput(v => v + char);
    }
  }, { isActive });

  return h(Box, {
    flexDirection: 'row',
    borderStyle: 'single',
    borderColor: isActive ? '#4fc3f7' : '#444444',
    paddingX: 1,
    height: 3,
    width: '100%',
  },
    h(Text, { color: '#4fc3f7', bold: true }, prefix),
    h(Text, { color: '#ffffff' }, input),
    isActive && h(Text, { color: '#ffffff' }, '▌')
  );
}
