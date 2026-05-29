import { KimiBridge } from './kimi-bridge.cjs';
const bridge = new KimiBridge();
try {
  await bridge.connect();
  const result = await bridge.newChat('luna-cli');
  console.log('✅ Nova thread criada:', result.chatUrl);
} catch (e) {
  console.error('❌ Erro:', e.message);
} finally {
  await bridge.disconnect();
  process.exit(0);
}
