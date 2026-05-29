#!/usr/bin/env node
/**
 * Teste real da TUI — simula o fluxo completo sem interface visual
 */

import { LunaSoul } from './luna-soul.cjs';

const luna = new LunaSoul({ defaultMode: 'thinking' });

async function main() {
  await luna.init({ userId: 'luna-cli' });
  
  const sessions = luna.sessionManager.listSessions();
  const sessionId = sessions[0]?.id || '8d3090aa-79b0';
  
  // Mensagem real — sem forçar formato, deixa o system prompt trabalhar
  const prompt = `Crie um arquivo HTML de teste em /tmp/luna-real-test.html com um título "Luna CLI v3.2 Test" e um parágrafo "Sistema operacional". Use as ferramentas disponíveis.`;
  
  console.log('🧪 TESTE REAL DA TUI');
  console.log('====================');
  console.log('Sessão:', sessionId);
  console.log('Prompt:', prompt.slice(0, 80) + '...\n');
  
  const stream = luna.processMessageStream(prompt, { sessionId, mode: 'thinking', userId: 'luna-cli' });
  
  let actionDetected = false;
  let actionExecuted = false;
  let fileCreated = false;
  let finalMode = null;
  
  for await (const ev of stream) {
    switch (ev.type) {
      case 'thinking_start':
        process.stdout.write('🧠');
        break;
      case 'thinking_delta':
        if (ev.text && ev.text.length % 100 < 5) process.stdout.write('·');
        break;
      case 'response_delta':
        if (ev.text && ev.text.length % 100 < 5) process.stdout.write('💬');
        break;
      case 'mode_detected':
        finalMode = ev.mode;
        console.log(`\n📡 Modo detectado: ${ev.mode}`);
        break;
      case 'action_start':
        actionDetected = true;
        console.log(`🔧 Ação iniciada: ${ev.tool}`);
        break;
      case 'action_end':
        actionExecuted = true;
        const success = ev.result?.success || ev.result?.result?.success;
        console.log(`✅ Ação finalizada: success=${success}`);
        if (ev.result?.result?.path) {
          console.log(`   Path: ${ev.result.result.path}`);
        }
        break;
      case 'done':
        console.log(`\n🏁 DONE: mode=${ev.result?.mode}`);
        break;
      case 'error':
        console.log(`\n❌ ERROR: ${ev.error}`);
        break;
      case 'waiting':
        process.stdout.write('⏳');
        break;
    }
  }
  
  // Verifica se arquivo foi criado
  const fs = await import('fs');
  fileCreated = fs.existsSync('/tmp/luna-real-test.html');
  
  console.log('\n====================');
  console.log('RESULTADO DO TESTE:');
  console.log('  Ação detectada:', actionDetected ? '✅ SIM' : '❌ NÃO');
  console.log('  Ação executada:', actionExecuted ? '✅ SIM' : '❌ NÃO');
  console.log('  Arquivo criado:', fileCreated ? '✅ SIM' : '❌ NÃO');
  console.log('  Modo final:', finalMode || 'N/A');
  
  if (fileCreated) {
    const content = fs.readFileSync('/tmp/luna-real-test.html', 'utf-8');
    console.log('\n  Conteúdo do arquivo:');
    console.log('  ', content.slice(0, 200).replace(/\n/g, ' '));
  }
  
  await luna.disconnect();
  
  const allPassed = actionDetected && actionExecuted && fileCreated;
  console.log('\n' + (allPassed ? '🎉 TUDO PASSOU!' : '⚠️ ALGUNS TESTES FALHARAM'));
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
