const { chromium } = require('playwright');
const fs = require('fs');

const PROMPTS = [
  { file: '/tmp/prompt-file1.txt', name: 'response-stream-parser.cjs' },
  { file: '/tmp/prompt-file2.txt', name: 'meta-executor-secure.cjs' },
  { file: '/tmp/prompt-file3.txt', name: 'luna-soul-refactored.cjs' },
];

async function openNewChat(page) {
  // Click new chat button or use keyboard shortcut
  try {
    await page.keyboard.press('Alt+KeyT');
    await page.waitForTimeout(2000);
  } catch (e) {}
  
  // Try clicking new chat button
  const newChatBtn = page.locator('button[title="New chat"], [data-testid="new-chat"], .new-chat-btn').first();
  if (await newChatBtn.count() > 0) {
    await newChatBtn.click();
    await page.waitForTimeout(3000);
  }
  
  // Navigate to new chat URL
  await page.goto('https://kimi.com/?chat_enter_method=new_chat');
  await page.waitForTimeout(3000);
}

async function sendPrompt(page, promptPath) {
  const prompt = fs.readFileSync(promptPath, 'utf8');
  console.log('Sending prompt, length:', prompt.length);
  
  const textarea = page.locator('textarea, [contenteditable="true"]').first();
  await textarea.waitFor({ state: 'visible', timeout: 15000 });
  
  await textarea.fill(prompt);
  await textarea.press('Enter');
  console.log('Prompt sent!');
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();
  
  // Find existing kimi page
  let kimiPage = pages.find(p => p.url().includes('kimi.com'));
  if (!kimiPage) {
    console.log('No kimi page found, creating one');
    kimiPage = await context.newPage();
    await kimiPage.goto('https://kimi.com');
    await kimiPage.waitForTimeout(5000);
  }
  
  for (let i = 0; i < PROMPTS.length; i++) {
    const p = PROMPTS[i];
    console.log(`\n=== ${i+1}/3: ${p.name} ===`);
    
    if (i > 0) {
      // Open new tab for new chat
      await openNewChat(kimiPage);
    }
    
    await sendPrompt(kimiPage, p.file);
    
    // Wait a bit before next
    await kimiPage.waitForTimeout(5000);
  }
  
  console.log('\nAll 3 prompts sent!');
  await browser.close();
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
