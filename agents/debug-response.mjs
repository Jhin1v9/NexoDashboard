import { LunaSoul } from './luna-soul.cjs';
import fs from 'fs';

const luna = new LunaSoul({ defaultMode: 'thinking' });
await luna.init({ userId: 'luna-cli' });
const sessions = luna.sessionManager.listSessions();
const sessionId = sessions[0]?.id;
const prompt = 'Crie um arquivo HTML em /tmp/luna-real-test.html com titulo "Test". Use writeFile.';
const stream = luna.processMessageStream(prompt, { sessionId, mode: 'thinking', userId: 'luna-cli' });
let fullResponse = '';
for await (const ev of stream) {
  if (ev.type === 'response_delta') fullResponse += ev.text || '';
}
fs.writeFileSync('/tmp/debug-response.txt', fullResponse);
console.log('Length:', fullResponse.length);
console.log('Has [[action]]:', fullResponse.includes('[[action]]'));
console.log('Has [[/action]]:', fullResponse.includes('[[/action]]'));
const m = fullResponse.match(/\[\[action\]\][\s\S]{0,500}/);
if (m) console.log('Action snippet:', m[0]);
await luna.disconnect();
