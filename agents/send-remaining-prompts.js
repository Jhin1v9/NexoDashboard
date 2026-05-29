const { chromium } = require('playwright');
const fs = require('fs');

async function sendPrompt(page, promptPath, name) {
  const prompt = fs.readFileSync(promptPath, 'utf8');
  console.log(`Sending ${name}, length:`, prompt.length);
  
  const textarea = page.locator('textarea, [contenteditable="true"]').first();
  await textarea.waitFor({ state: 'visible', timeout: 15000 });
  
  await textarea.fill(prompt);
  await textarea.press('Enter');
  console.log(`${name} sent!`);
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  
  // Send file 2 in new page
  console.log('\n=== 2/3: meta-executor-secure.cjs ===');
  const page2 = await context.newPage();
  await page2.goto('https://kimi.com/?chat_enter_method=new_chat');
  await page2.waitForTimeout(4000);
  await sendPrompt(page2, '/tmp/prompt-file2.txt', 'meta-executor-secure.cjs');
  
  // Send file 3 in new page
  console.log('\n=== 3/3: luna-soul-refactored.cjs ===');
  const page3 = await context.newPage();
  await page3.goto('https://kimi.com/?chat_enter_method=new_chat');
  await page3.waitForTimeout(4000);
  await sendPrompt(page3, '/tmp/prompt-file3.txt', 'luna-soul-refactored.cjs');
  
  console.log('\nAll prompts sent!');
  await browser.close();
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
