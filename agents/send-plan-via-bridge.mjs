import { LunaSoul } from './luna-soul.cjs';

const prompt = `🧠 SEGUNDA OPINIÃO TÉCNICA — Luna CLI v3.2

Sou uma CLI (Node.js v24 + React v19 + Ink v7) que orquestra você via Playwright CDP. Preciso da sua análise técnica.

## PROBLEMAS ATUAIS
1. Timeout 60s quebra quando você usa ferramentas internas (fetch/python). Fica 2-3min sem gerar texto.
2. Detectamos "fim" prematuramente quando isGenerating=false durante execução Python interna.
3. Erro no bridge não libera input na TUI (isProcessing fica true pra sempre).
4. Scroll corrompe layout quando mensagens novas chegam.

Fixes propostos:
- Timeout 180s no modo thinking, 60s no instant. Resetar timer quando isGenerating muda true→false.
- Só marcar fim se: botões visíveis + !isGenerating + texto estável 3s + NÃO há spinners/processamento ativo no DOM.
- Case 'error' na TUI setando isProcessing=false e mostrando erro no chat.
- Resetar scrollOffset quando messages.length aumenta.

## PLANOS FUTUROS
- Modo Agent: você trabalha autonomamente (fetch, think, code). TUI mostra steps em tempo real. Input bloqueado até terminar.
- Modo Agent Swarm: múltiplos agentes em paralelo.
- Aproveitar seu coder/fetch nativo em vez de reimplementar.
- Mapear links de preview/download que você gera (React apps, HTML pages).

## PERGUNTAS TÉCNICAS
1. Os fixes fazem sentido? Alguma brecha?
2. Como detectar via DOM que você está em modo Agent vs chat normal?
3. Quais seletores CSS usar para extrair steps em tempo real? (Page fetched, Think, Python execution)
4. Agent Swarm funciona como? Múltiplas conversas independentes? API específica?
5. Como extrair de forma confiável o output do seu Python executado internamente?

Responda em português com análise técnica profunda. Queremos um plano infalível. Qualidade > velocidade.`;

const luna = new LunaSoul({ defaultMode: 'thinking' });

try {
  await luna.init({ userId: 'luna-cli' });
  console.log('Bridge conectado. Enviando prompt...');
  
  const stream = luna.kimiBridge.sendMessageStream('luna-cli', prompt, { mode: 'thinking' });
  let fullResponse = '';
  let fullThinking = '';
  
  for await (const ev of stream) {
    if (ev.type === 'thinking_delta') {
      fullThinking += ev.text;
      process.stdout.write('🧠');
    } else if (ev.type === 'response_delta') {
      fullResponse += ev.text;
      process.stdout.write('💬');
    } else if (ev.type === 'done') {
      fullResponse = ev.response || fullResponse;
      console.log('\n\n=== RESPOSTA FINAL ===\n');
      console.log(fullResponse);
      break;
    } else if (ev.type === 'error') {
      console.error('\nErro:', ev.error);
      break;
    }
  }
  
  // Salva resposta em arquivo
  const fs = await import('fs');
  fs.writeFileSync('/tmp/kimi-response.md', `# Resposta da Kimi Web\n\n${fullResponse}\n\n---\n\n## Thinking\n\n${fullThinking}`);
  console.log('\nResposta salva em /tmp/kimi-response.md');
  
} catch (err) {
  console.error('Erro:', err.message);
} finally {
  await luna.disconnect();
}
