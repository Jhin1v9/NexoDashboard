/**
 * Teste rápido da Luna — validar melhorias de validação e truncamento
 */

const { LunaSoul } = require('./agents/luna-soul.cjs');
const fs = require('fs');
const path = require('path');

const TEST_DIR = '/home/jhin/Documentos/luna-teste-rapido';

async function main() {
  console.log('🚀 Teste rápido Luna');
  
  const luna = new LunaSoul({ autoConfirmDestructive: true });
  await luna.init({ userId: 'test-rapido' });
  console.log('✅ Luna inicializado');

  // Limpar diretório anterior
  try { fs.rmSync(TEST_DIR, { recursive: true }); } catch {}

  // Teste 1: Criar um arquivo JSX com tags balanceadas
  const prompt1 = `Crie um arquivo React em ${TEST_DIR}/src/Hello.jsx com este conteúdo EXATO:

import React from 'react';

export default function Hello() {
  return (
    <div className="hello">
      <h1>Hello World</h1>
      <p>This is a test</p>
    </div>
  );
}

Use writeFile para criar o arquivo. Depois use executeShell para verificar se o arquivo existe.`;

  console.log('\n📤 Teste 1: Criar arquivo JSX válido');
  const stream1 = luna.processMessageStream(prompt1, {
    sessionId: 'test-rapido-session',
    userId: 'test-rapido',
    mode: 'thinking',
  });

  let actionCount = 0;
  for await (const ev of stream1) {
    if (ev.type === 'action_start') {
      actionCount++;
      console.log(`🔧 [ACTION #${actionCount}]: ${ev.tool}`);
    }
    if (ev.type === 'action_end') {
      const msg = ev.result?.result?.message || '';
      const hasValidationError = msg.includes('VALIDAÇÃO IMEDIATA') || msg.includes('truncado');
      if (hasValidationError) {
        console.log('⚠️  Validação detectou erro:', msg.slice(0, 200));
      } else {
        console.log(`✅ [ACTION DONE #${actionCount}]: success=${ev.result?.success}`);
      }
    }
    if (ev.type === 'done') {
      console.log('🎉 Teste 1 concluído');
    }
  }

  // Verificar se arquivo foi criado
  const helloPath = path.join(TEST_DIR, 'src', 'Hello.jsx');
  if (fs.existsSync(helloPath)) {
    console.log('✅ Arquivo Hello.jsx criado!');
    const content = fs.readFileSync(helloPath, 'utf8');
    console.log(`📄 Tamanho: ${content.length} chars`);
  } else {
    console.log('❌ Arquivo Hello.jsx NÃO foi criado');
  }

  // Teste 2: Verificar se bash truncado é rejeitado
  console.log('\n📤 Teste 2: Enviar comando bash truncado (heredoc não fechado)');
  const prompt2 = `Execute este comando shell em ${TEST_DIR}:

cat << 'EOF' > test.txt
Hello world

NÃO FECHE O HEREDOC PROPOSITALMENTE. Quero ver se o sistema detecta o erro.`;

  const stream2 = luna.processMessageStream(prompt2, {
    sessionId: 'test-rapido-session',
    userId: 'test-rapido',
    mode: 'thinking',
  });

  for await (const ev of stream2) {
    if (ev.type === 'action_end') {
      const error = ev.result?.result?.error || ev.result?.error || '';
      if (error.includes('truncado') || error.includes('Heredoc')) {
        console.log('✅ Sistema detectou comando truncado:', error.slice(0, 150));
      } else {
        console.log('❌ Sistema NÃO detectou truncamento. Resultado:', JSON.stringify(ev.result).slice(0, 200));
      }
    }
    if (ev.type === 'done') {
      console.log('🎉 Teste 2 concluído');
    }
  }

  await luna.disconnect();
  console.log('\n🏁 Testes rápidos finalizados');
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
