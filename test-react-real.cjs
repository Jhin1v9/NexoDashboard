/**
 * Teste end-to-end: ReAct + Kimi Web real
 * Tarefa simples para verificar se a Kimi responde com JSON válido
 */

const { KimiBridge } = require('./agents/kimi-bridge.cjs');
const { ComputerUseReAct } = require('./agents/computer-use-react.cjs');

async function main() {
  console.log('🔌 Conectando ao Kimi Bridge...');
  const bridge = new KimiBridge({ debug: true });
  await bridge.connect();

  const userId = 'test-react-' + Date.now();

  const react = new ComputerUseReAct({
    kimiBridge: bridge,
    userId,
    mode: 'thinking',
    maxIterations: 3,
    async onStep(step) {
      console.log(`[STEP ${step.step || 0}] ${step.type}: ${step.message.slice(0, 80)}`);
    },
  });

  console.log('\n🚀 Enviando tarefa para Kimi Web...');
  console.log('Tarefa: "Qual a hora atual no PC?" (usando comando shell)');

  const result = await react.runTask('Qual a hora atual no PC? Use o comando date para descobrir e me diga.');

  console.log('\n═══════════════════════════════════════');
  console.log('RESULTADO:', result.success ? '✅ SUCESSO' : '❌ FALHA');
  console.log('Mensagem:', result.message);
  if (result.error) console.log('Erro:', result.error);
  console.log('Ações executadas:', result.actions?.length || 0);
  console.log('═══════════════════════════════════════');

  await bridge.disconnect();
}

main().catch(e => {
  console.error('Erro fatal:', e.message);
  console.error(e.stack);
  process.exit(1);
});
