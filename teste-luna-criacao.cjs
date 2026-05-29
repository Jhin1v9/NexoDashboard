const { LunaSoul } = require('./agents/luna-soul.cjs');

async function main() {
  const luna = new LunaSoul({});
  await luna.init({ userId: 'direct-test' });
  console.log('✅ Luna inicializado');

  const prompt = `Cria um app React INCRÍVEL de portfólio pessoal para um desenvolvedor full-stack chamado "Abner Gabriel" (CEO da NEXO DIGITAL). 

Requisitos:
1. Use Vite + React + Tailwind CSS
2. Dark mode por padrão (futurista, neon cyan/purple accents)
3. Seções: Hero com typing animation, Sobre, Projetos (cards com hover effects), Skills (barras animadas), Contato
4. Animações com Framer Motion (fade in, slide up)
5. Totalmente responsivo
6. Ícones com Lucide React
7. Um easter egg: clique no nome no hero ativa um modo "matrix"

Crie em /home/jhin/Documentos/portfolio-luna/
Instale dependências, rode npm run dev, tire screenshot da página e me mostre o resultado.`;

  console.log('🚀 Enviando prompt criativo para o Kimi...');
  
  const stream = luna.processMessageStream(prompt, {
    sessionId: 'direct-test-session',
    userId: 'direct-test',
    mode: 'thinking',
    persona: 'engenheiro',
  });

  for await (const ev of stream) {
    switch (ev.type) {
      case 'thinking_start':
        console.log('🧠 [THINKING START]');
        break;
      case 'thinking_delta':
        process.stdout.write('.');
        break;
      case 'response_delta':
        console.log('\n📄 [RESPONSE]:', ev.text?.slice(0, 200));
        break;
      case 'action_start':
        console.log('\n🔧 [ACTION]:', ev.tool);
        break;
      case 'action_end':
        console.log('\n✅ [ACTION DONE]:', JSON.stringify(ev.result, null, 2).slice(0, 500));
        break;
      case 'error':
        console.log('\n❌ [ERROR]:', ev.error || ev.message);
        break;
      case 'done':
        console.log('\n🎉 [DONE]');
        break;
    }
  }

  console.log('\n🏁 Fluxo completo.');
  await luna.disconnect();
}

main().catch(e => {
  console.error('Falha:', e);
  process.exit(1);
});
