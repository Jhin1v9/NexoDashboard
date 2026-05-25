const { sendMouseClick, sendType, sendKey, sendHotkey, moveMouse, getMousePosition } = require('./agents/computer-use-engine.cjs');

async function test() {
  console.log('🖱️ Testando input actions...\n');

  // Test 1: Move mouse to center
  console.log('① Move mouse to center (683, 384)...');
  const move = await moveMouse(683, 384);
  console.log('   Move:', move.success ? '✅ OK' : '❌ ' + move.error);

  // Test 2: Click at center
  console.log('② Click at center...');
  const click = await sendMouseClick(683, 384);
  console.log('   Click:', click.success ? '✅ OK' : '❌ ' + click.error);

  // Test 3: Type text
  console.log('③ Type "hello world"...');
  const type = await sendType('hello world');
  console.log('   Type:', type.success ? '✅ OK' : '❌ ' + type.error);

  // Test 4: Press Enter
  console.log('④ Press Enter...');
  const key = await sendKey('Return');
  console.log('   Key:', key.success ? '✅ OK' : '❌ ' + key.error);

  // Test 5: Hotkey Ctrl+A
  console.log('⑤ Hotkey Ctrl+A...');
  const hotkey = await sendHotkey(['ctrl', 'a']);
  console.log('   Hotkey:', hotkey.success ? '✅ OK' : '❌ ' + hotkey.error);

  console.log('\n✅ Input tests done!');
}

test().catch(e => {
  console.error('Erro:', e.message);
  console.error(e.stack);
});
