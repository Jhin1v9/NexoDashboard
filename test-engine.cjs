const { takeScreenshot, getScreenSize, getMousePosition, getWindowList, getActiveWindow, runShell, runOCR } = require('./agents/computer-use-engine.cjs');

async function test() {
  console.log('🧪 Testando Computer Use Engine v2.0...\n');

  // Test 1: Screenshot
  console.log('① Screenshot...');
  const ss = await takeScreenshot();
  console.log('   Screenshot:', ss ? '✅ OK' : '❌ FAIL');

  // Test 2: Screen size
  console.log('② Screen size...');
  const size = await getScreenSize();
  console.log('   Size:', size.success ? '✅ ' + size.width + 'x' + size.height : '❌ FAIL');

  // Test 3: Mouse position
  console.log('③ Mouse position...');
  const mouse = await getMousePosition();
  console.log('   Mouse:', mouse.success ? '✅ (' + mouse.x + ', ' + mouse.y + ')' : '❌ FAIL');

  // Test 4: Window list
  console.log('④ Window list...');
  const wins = await getWindowList();
  console.log('   Windows:', wins.length > 0 ? '✅ ' + wins.length + ' janelas' : '❌ FAIL');
  if (wins.length > 0) {
    console.log('   Primeiras:', wins.slice(0, 3).map(w => w.name).join(', '));
  }

  // Test 5: Active window
  console.log('⑤ Active window...');
  const active = await getActiveWindow();
  console.log('   Active:', active ? '✅ ' + active.name : '❌ FAIL');

  // Test 6: Shell safe
  console.log('⑥ Shell (ls -la ~/ | head -5)...');
  const shell = await runShell('ls -la ~/ | head -5');
  console.log('   Shell:', shell.success ? '✅ OK' : '❌ FAIL');
  console.log('   Output:', shell.stdout.slice(0, 100));

  // Test 7: OCR on screenshot
  if (ss) {
    console.log('⑦ OCR...');
    const ocr = await runOCR(ss);
    console.log('   OCR:', ocr ? '✅ ' + ocr.length + ' chars' : '❌ FAIL');
    console.log('   Sample:', ocr ? ocr.slice(0, 100).replace(/\n/g, ' ') : 'N/A');
  }

  console.log('\n✅ Testes concluídos!');
}

test().catch(e => {
  console.error('Erro:', e.message);
  console.error(e.stack);
  process.exit(1);
});
