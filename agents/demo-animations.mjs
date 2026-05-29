#!/usr/bin/env node
/**
 * Demo das animações de tool call do Luna TUI v3.1
 */

import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';

const h = React.createElement;

const C = {
  headerBg: '#1a1a2e',
  headerFg: '#e0e0e0',
  dim: '#666666',
  user: '#4fc3f7',
  luna: '#ce93d8',
  tool: '#ffd54f',
  success: '#81c784',
  error: '#e57373',
  warning: '#ffb74d',
  system: '#aaaaaa',
  input: '#ffffff',
  border: '#444444',
};

const SPINNER_FRAMES = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];

function getToolCategory(tool) {
  const t = (tool || '').toLowerCase();
  if (t.includes('read') || t.includes('view') || t.includes('cat') || t.includes('fetch') || t.includes('get')) return 'read';
  if (t.includes('write') || t.includes('edit') || t.includes('save') || t.includes('create') || t.includes('touch')) return 'write';
  if (t.includes('shell') || t.includes('exec') || t.includes('run') || t.includes('cmd') || t.includes('npm') || t.includes('git')) return 'shell';
  if (t.includes('search') || t.includes('find') || t.includes('grep') || t.includes('query')) return 'search';
  if (t.includes('wait') || t.includes('sleep') || t.includes('pause')) return 'wait';
  return 'generic';
}

function getToolStyle(category) {
  switch (category) {
    case 'read':    return { color: C.user,    icon: '📖', verb: 'Lendo',      past: 'Lido' };
    case 'write':   return { color: C.tool,    icon: '✏️ ', verb: 'Escrevendo', past: 'Escrito' };
    case 'shell':   return { color: C.success, icon: '⚡', verb: 'Executando', past: 'Executado' };
    case 'search':  return { color: C.luna,    icon: '🔍', verb: 'Buscando',   past: 'Encontrado' };
    case 'wait':    return { color: C.system,  icon: '⏳', verb: 'Aguardando', past: 'Concluído' };
    default:        return { color: C.tool,    icon: '🔧', verb: 'Processando',past: 'Concluído' };
  }
}

function extractToolTarget(tool, params) {
  if (!params || typeof params !== 'object') return '';
  const p = params;
  if (p.path) return p.path;
  if (p.file) return p.file;
  if (p.command) return p.command.slice(0, 60) + (p.command.length > 60 ? '…' : '');
  if (p.cmd) return p.cmd.slice(0, 60) + (p.cmd.length > 60 ? '…' : '');
  if (p.url) return p.url.slice(0, 60) + (p.url.length > 60 ? '…' : '');
  if (p.query) return p.query.slice(0, 60) + (p.query.length > 60 ? '…' : '');
  const firstKey = Object.keys(p).find(k => typeof p[k] === 'string' && p[k].length < 100);
  return firstKey ? `${firstKey}=${p[firstKey].slice(0, 40)}` : '';
}

function formatToolAction(tool, params) {
  const cat = getToolCategory(tool);
  const style = getToolStyle(cat);
  const target = extractToolTarget(tool, params);
  return { line: `${style.icon} ${style.verb}${target ? ' ' + target : ''}...`, style };
}

function formatToolResult(tool, output, success) {
  const cat = getToolCategory(tool);
  const style = getToolStyle(cat);
  if (!success) return { line: `${style.icon} ${style.past} com erro`, style, isError: true };
  if (!output) return { line: `${style.icon} ${style.past}`, style, isError: false };
  const s = String(output);
  if (s.length > 200 && s.includes('\n')) {
    const lines = s.trim().split('\n').length;
    const preview = s.trim().split('\n').slice(0, 3).join('\n');
    return { line: `${style.icon} ${style.past} │ ${lines} linhas`, style, isError: false, preview };
  }
  const short = s.slice(0, 100) + (s.length > 100 ? '…' : '');
  return { line: `${style.icon} ${style.past} │ ${short}`, style, isError: false };
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const ToolCallItem = React.memo(function ToolCallItem({ msg }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setFrame(f => (f + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(iv);
  }, []);
  const tool = msg.tool || 'tool';
  const { line, style } = formatToolAction(tool, msg.params);
  return h(Box, { flexDirection: 'column', marginY: 1 },
    h(Box, { flexDirection: 'row' },
      h(Text, { color: style.color }, `${SPINNER_FRAMES[frame]} `),
      h(Text, { color: style.color, bold: true }, line)
    ),
    h(Box, { flexDirection: 'row', marginLeft: 1 },
      h(Text, { color: C.dim, dimColor: true }, '│')
    )
  );
});

const ToolResultItem = React.memo(function ToolResultItem({ msg }) {
  const tool = msg.tool || 'tool';
  const ok = msg.success !== false;
  const { line, style, isError, preview } = formatToolResult(tool, msg.output, ok);
  const resultColor = isError ? C.error : C.success;
  const resultIcon = isError ? '✗' : '✓';
  return h(Box, { flexDirection: 'column', marginY: 1, marginLeft: 2 },
    h(Box, { flexDirection: 'row' },
      h(Text, { color: resultColor, bold: true }, `${resultIcon} `),
      h(Text, { color: resultColor }, line),
      h(Text, { color: C.dim, dimColor: true }, `  ${fmtTime(msg.timestamp)}`)
    ),
    preview && h(Box, {
      marginLeft: 1,
      marginTop: 0,
      flexDirection: 'column',
      borderStyle: 'single',
      borderColor: '#333355',
      paddingX: 1,
      paddingY: 0,
      width: '85%'
    },
      ...preview.split('\n').map((pl, i) =>
        h(Text, { key: i, color: C.dim, dimColor: true, wrap: 'wrap' }, pl)
      )
    )
  );
});

const demoMessages = [
  { type: 'user', content: 'Analisa o arquivo luna-soul.cjs e depois roda os testes', timestamp: new Date().toISOString(), id: '1' },
  { type: 'tool_call', tool: 'read_file', params: { path: 'luna-soul.cjs' }, timestamp: new Date().toISOString(), id: '2' },
  { type: 'tool_result', tool: 'read_file', success: true, output: 'import { LunaSoul } from \'./luna-soul.cjs\';\nconst MAX_LOOPS = 8;\n\nclass LunaSoul {\n  async processMessage(msg) {\n    // ...\n  }\n}\n\nexport { LunaSoul };', timestamp: new Date().toISOString(), id: '3' },
  { type: 'tool_call', tool: 'write_file', params: { path: 'test-novo.mjs', content: 'test code here' }, timestamp: new Date().toISOString(), id: '4' },
  { type: 'tool_result', tool: 'write_file', success: true, output: 'Arquivo salvo com sucesso', timestamp: new Date().toISOString(), id: '5' },
  { type: 'tool_call', tool: 'shell_exec', params: { command: 'npm test' }, timestamp: new Date().toISOString(), id: '6' },
  { type: 'tool_result', tool: 'shell_exec', success: true, output: 'PASS  test-workspace-e2e.mjs\n  ✓ Bootstrap cria workspace\n  ✓ ToolGuard valida schema\n  ✓ Auto-commit funciona\n\nTest Suites: 1 passed, 1 total', timestamp: new Date().toISOString(), id: '7' },
  { type: 'tool_call', tool: 'search_code', params: { query: 'function processMessage' }, timestamp: new Date().toISOString(), id: '8' },
  { type: 'tool_result', tool: 'search_code', success: true, output: 'luna-soul.cjs:42: async processMessage(msg, opts) {\nluna-soul.cjs:89: processMessage: function() {}', timestamp: new Date().toISOString(), id: '9' },
  { type: 'tool_call', tool: 'shell_exec', params: { command: 'git push origin main' }, timestamp: new Date().toISOString(), id: '10' },
  { type: 'tool_result', tool: 'shell_exec', success: false, output: 'fatal: unable to access: Could not resolve host: github.com', timestamp: new Date().toISOString(), id: '11' },
  { type: 'assistant', response: 'Análise completa! O arquivo luna-soul.cjs está bem estruturado. Os testes passaram (6/6).\n\nNote que o git push falhou por problema de rede — isso é normal e não afeta os testes locais.', timestamp: new Date().toISOString(), id: '12' },
];

function DemoApp() {
  const [showResults, setShowResults] = useState(0);

  useEffect(() => {
    const timers = [];
    for (let i = 1; i <= 5; i++) {
      timers.push(setTimeout(() => setShowResults(i), i * 1200));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  const visible = [];
  const toolCalls = demoMessages.filter(m => m.type === 'tool_call');
  const toolResults = demoMessages.filter(m => m.type === 'tool_result');
  const others = demoMessages.filter(m => !['tool_call', 'tool_result'].includes(m.type));

  // Interleave: user msg -> tool call -> wait -> tool result
  visible.push(others[0]); // user
  
  for (let i = 0; i < toolCalls.length; i++) {
    visible.push(toolCalls[i]);
    if (i < showResults) {
      visible.push(toolResults[i]);
    }
  }
  visible.push(others[1]); // assistant

  return h(Box, { flexDirection: 'column', paddingX: 2, paddingY: 1, width: '100%' },
    h(Box, { flexDirection: 'row', marginBottom: 1 },
      h(Text, { color: C.headerFg, bold: true }, '🌙 Luna'),
      h(Text, { color: C.dim }, ' │ Demo Tool Animations v3.1')
    ),
    h(Box, { flexDirection: 'column', width: '100%' },
      visible.map(msg => {
        if (msg.type === 'user') {
          return h(Box, { key: msg.id, flexDirection: 'column', marginY: 1 },
            h(Box, { flexDirection: 'row' },
              h(Text, { color: C.user, bold: true }, '> Você')
            ),
            h(Box, { marginLeft: 2 },
              h(Text, { wrap: 'wrap' }, msg.content)
            )
          );
        }
        if (msg.type === 'assistant') {
          return h(Box, { key: msg.id, flexDirection: 'column', marginY: 1 },
            h(Box, { flexDirection: 'row' },
              h(Text, { color: C.luna, bold: true }, '🌙 Luna')
            ),
            h(Box, { marginLeft: 2 },
              ...msg.response.split('\n').map((line, i) =>
                h(Text, { key: i, wrap: 'wrap' }, line || ' ')
              )
            )
          );
        }
        if (msg.type === 'tool_call') {
          return h(ToolCallItem, { key: msg.id, msg });
        }
        if (msg.type === 'tool_result') {
          return h(ToolResultItem, { key: msg.id, msg });
        }
        return null;
      })
    ),
    h(Box, { flexDirection: 'row', marginTop: 1, borderStyle: 'single', borderColor: C.border, paddingX: 1, height: 3, width: '100%' },
      h(Text, { color: C.user, bold: true }, '❯ '),
      h(Text, { color: C.input }, 'Digite /sair para encerrar...'),
      h(Text, { color: C.input }, '▌')
    )
  );
}

render(h(DemoApp));
