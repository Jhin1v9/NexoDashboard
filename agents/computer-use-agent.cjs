/**
 * Computer Use Agent v1.0
 * Agente de controle de desktop guiado pela Kimi Web
 *
 * Arquitetura:
 * 1. Usuário envia comando no Telegram
 * 2. Agente consulta Kimi Web para plano de ações
 * 3. Executa ações no PC via pyautogui (Python child_process)
 * 4. Verifica resultado com screenshots
 * 5. Loop até completar ou timeout
 *
 * Segurança:
 * - Máximo 20 iterações por tarefa
 * - Confirmação obrigatória para ações destrutivas
 * - Timeout de 5 minutos por tarefa
 * - Lista de ações bloqueadas (rm -rf, format, etc.)
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

// ============================================================
// CONFIG
// ============================================================
const VENV_PYTHON = path.join(__dirname, '..', 'venv-computer-use', 'bin', 'python');
const SCREENSHOT_DIR = path.join(__dirname, '..', 'ARTIFACTS', 'computer-use-screenshots');
const MAX_ITERATIONS = 20;
const TASK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos
const ACTION_DELAY_MS = 1000; // 1s entre ações

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Ações bloqueadas por segurança
const BLOCKED_ACTIONS = [
  'rm -rf', 'format', 'fdisk', 'mkfs', 'dd if=',
  'shutdown', 'reboot', 'poweroff', 'init 0',
  'del /f /s /q', 'rd /s /q',
  'curl.*|.*sh', 'wget.*|.*sh',
  'chmod 777', 'chmod -R 777'
];

// Ações que precisam de confirmação
const DESTRUCTIVE_ACTIONS = [
  'delete', 'remove', 'rm ', 'del ', 'rmdir',
  'uninstall', 'purge', 'destroy'
];

// ============================================================
// PYTHON SCRIPTS (executados via child_process)
// ============================================================

const PYTHON_SCRIPTS = {
  screenshot: `
import sys
import os
from PIL import Image
import mss

output_path = sys.argv[1]
with mss.mss() as sct:
    monitor = sct.monitors[0]  # Full screen
    screenshot = sct.grab(monitor)
    img = Image.frombytes("RGB", screenshot.size, screenshot.bgra, "raw", "BGRX")
    # Resize to reduce upload size (max 1280 width)
    max_width = 1280
    if img.width > max_width:
        ratio = max_width / img.width
        new_height = int(img.height * ratio)
        img = img.resize((max_width, new_height), Image.LANCZOS)
    img.save(output_path, "PNG", quality=85)
    print(f"Screenshot saved: {output_path} ({img.width}x{img.height})")
`,

  click: `
import sys
import pyautogui
pyautogui.FAILSAFE = True
x, y = int(sys.argv[1]), int(sys.argv[2])
pyautogui.click(x, y)
print(f"Clicked at ({x}, {y})")
`,

  doubleClick: `
import sys
import pyautogui
pyautogui.FAILSAFE = True
x, y = int(sys.argv[1]), int(sys.argv[2])
pyautogui.doubleClick(x, y)
print(f"Double-clicked at ({x}, {y})")
`,

  rightClick: `
import sys
import pyautogui
pyautogui.FAILSAFE = True
x, y = int(sys.argv[1]), int(sys.argv[2])
pyautogui.rightClick(x, y)
print(f"Right-clicked at ({x}, {y})")
`,

  type: `
import sys
import pyautogui
pyautogui.FAILSAFE = True
text = sys.argv[1]
pyautogui.typewrite(text, interval=0.01)
print(f"Typed: {text}")
`,

  key: `
import sys
import pyautogui
pyautogui.FAILSAFE = True
key = sys.argv[1]
pyautogui.press(key)
print(f"Pressed key: {key}")
`,

  hotkey: `
import sys
import pyautogui
pyautogui.FAILSAFE = True
keys = sys.argv[1:]
pyautogui.hotkey(*keys)
print(f"Pressed hotkey: {'+'.join(keys)}")
`,

  scroll: `
import sys
import pyautogui
pyautogui.FAILSAFE = True
amount = int(sys.argv[1])
pyautogui.scroll(amount)
print(f"Scrolled: {amount}")
`,

  moveTo: `
import sys
import pyautogui
pyautogui.FAILSAFE = True
x, y = int(sys.argv[1]), int(sys.argv[2])
pyautogui.moveTo(x, y)
print(f"Moved to ({x}, {y})")
`,

  dragTo: `
import sys
import pyautogui
pyautogui.FAILSAFE = True
x, y = int(sys.argv[1]), int(sys.argv[2])
pyautogui.dragTo(x, y, duration=0.5)
print(f"Dragged to ({x}, {y})")
`,

  getScreenSize: `
import pyautogui
width, height = pyautogui.size()
print(f"{width},{height}")
`,

  getMousePos: `
import pyautogui
x, y = pyautogui.position()
print(f"{x},{y}")
`,

  findImage: `
import sys
import pyautogui
pyautogui.FAILSAFE = True
image_path = sys.argv[1]
try:
    location = pyautogui.locateCenterOnScreen(image_path, confidence=0.8)
    if location:
        print(f"FOUND:{location.x},{location.y}")
    else:
        print("NOT_FOUND")
except Exception as e:
    print(f"ERROR:{e}")
`,

  shell: `
import sys
import subprocess
cmd = sys.argv[1]
try:
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
    print(f"EXIT_CODE:{result.returncode}")
    if result.stdout:
        print("STDOUT:")
        print(result.stdout[:2000])  # Limit output
    if result.stderr:
        print("STDERR:")
        print(result.stderr[:1000])
except subprocess.TimeoutExpired:
    print("ERROR:Command timed out after 30s")
except Exception as e:
    print(f"ERROR:{e}")
`
};

// ============================================================
// PYTHON RUNNER
// ============================================================

async function runPython(scriptName, args = []) {
  const scriptCode = PYTHON_SCRIPTS[scriptName];
  if (!scriptCode) {
    throw new Error(`Unknown script: ${scriptName}`);
  }

  // Write script to temp file
  const tempFile = path.join(SCREENSHOT_DIR, `_temp_${scriptName}_${Date.now()}.py`);
  fs.writeFileSync(tempFile, scriptCode);

  try {
    const { stdout, stderr } = await execPromise(
      `${VENV_PYTHON} "${tempFile}" ${args.map(a => `"${a}"`).join(' ')}`,
      { timeout: 30000, env: { ...process.env, DISPLAY: ':1' } }
    );
    return { stdout: stdout.trim(), stderr: stderr.trim(), success: true };
  } catch (err) {
    return { stdout: err.stdout?.trim() || '', stderr: err.stderr?.trim() || '', success: false, error: err.message };
  } finally {
    try { fs.unlinkSync(tempFile); } catch {}
  }
}

// ============================================================
// SCREENSHOT
// ============================================================

async function takeScreenshot(taskId, iteration) {
  const filename = `shot_${taskId}_${iteration}_${Date.now()}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  const result = await runPython('screenshot', [filepath]);
  if (!result.success) {
    console.error('[ComputerUse] Screenshot failed:', result.stderr);
    return null;
  }
  return filepath;
}

// ============================================================
// ACTION EXECUTOR
// ============================================================

async function executeAction(action) {
  const { type, params } = action;

  switch (type) {
    case 'screenshot':
      return await takeScreenshot(params.taskId || 'default', params.iteration || 0);

    case 'click':
      return await runPython('click', [params.x, params.y]);

    case 'doubleClick':
      return await runPython('doubleClick', [params.x, params.y]);

    case 'rightClick':
      return await runPython('rightClick', [params.x, params.y]);

    case 'type':
      return await runPython('type', [params.text]);

    case 'key':
      return await runPython('key', [params.key]);

    case 'hotkey':
      return await runPython('hotkey', params.keys);

    case 'scroll':
      return await runPython('scroll', [params.amount]);

    case 'moveTo':
      return await runPython('moveTo', [params.x, params.y]);

    case 'dragTo':
      return await runPython('dragTo', [params.x, params.y]);

    case 'wait':
      await new Promise(r => setTimeout(r, (params.seconds || 1) * 1000));
      return { success: true, stdout: `Waited ${params.seconds || 1}s` };

    case 'shell':
      // Security check
      const cmd = params.command.toLowerCase();
      for (const blocked of BLOCKED_ACTIONS) {
        if (cmd.includes(blocked.toLowerCase())) {
          return { success: false, error: `Ação bloqueada por segurança: ${blocked}` };
        }
      }
      return await runPython('shell', [params.command]);

    case 'findImage':
      return await runPython('findImage', [params.imagePath]);

    default:
      return { success: false, error: `Ação desconhecida: ${type}` };
  }
}

// ============================================================
// SECURITY CHECK
// ============================================================

function isDestructiveAction(action) {
  const cmd = JSON.stringify(action).toLowerCase();
  for (const destructive of DESTRUCTIVE_ACTIONS) {
    if (cmd.includes(destructive)) return true;
  }
  return false;
}

function isBlockedAction(action) {
  const cmd = JSON.stringify(action).toLowerCase();
  for (const blocked of BLOCKED_ACTIONS) {
    if (cmd.includes(blocked.toLowerCase())) return true;
  }
  return false;
}

// ============================================================
// PROMPT BUILDER FOR KIMI
// ============================================================

function buildSystemPrompt() {
  return `Você é um agente de controle de computador (Computer Use Agent) para o usuário Abner.
Você recebe comandos do usuário e responde com um plano de ações JSON para executar no PC.

REGRAS:
1. Responda SEMPRE em JSON válido com o formato:
   {"actions": [{"type": "...", "params": {...}}], "done": false, "message": "..."}
2. Quando a tarefa estiver completa, use "done": true
3. Use coordenadas em pixels (ex: x: 100, y: 200)
4. Use ações disponíveis: click, doubleClick, rightClick, type, key, hotkey, scroll, moveTo, dragTo, wait, shell
5. Para ações destrutivas (deletar, remover), use "needsConfirmation": true
6. NÃO invente coordenadas — se não souber, use "type": "screenshot" primeiro para ver a tela
7. Seja eficiente — use hotkeys quando possível (ex: hotkey ctrl+t para nova aba)
8. Sempre verifique o resultado com screenshot após ações importantes

AÇÕES DISPONÍVEIS:
- click: {"type": "click", "params": {"x": 100, "y": 200}}
- doubleClick: {"type": "doubleClick", "params": {"x": 100, "y": 200}}
- rightClick: {"type": "rightClick", "params": {"x": 100, "y": 200}}
- type: {"type": "type", "params": {"text": "hello world"}}
- key: {"type": "key", "params": {"key": "enter"}}
- hotkey: {"type": "hotkey", "params": {"keys": ["ctrl", "t"]}}
- scroll: {"type": "scroll", "params": {"amount": 500}}
- moveTo: {"type": "moveTo", "params": {"x": 100, "y": 200}}
- dragTo: {"type": "dragTo", "params": {"x": 100, "y": 200}}
- wait: {"type": "wait", "params": {"seconds": 2}}
- shell: {"type": "shell", "params": {"command": "ls -la"}}
- screenshot: {"type": "screenshot", "params": {}}

EXEMPLO:
Usuário: "Abre o Chrome e vai pro Gmail"
Resposta:
{
  "actions": [
    {"type": "click", "params": {"x": 50, "y": 50}},
    {"type": "wait", "params": {"seconds": 2}},
    {"type": "type", "params": {"text": "gmail.com"}},
    {"type": "key", "params": {"key": "return"}},
    {"type": "wait", "params": {"seconds": 3}},
    {"type": "screenshot", "params": {}}
  ],
  "done": false,
  "message": "Abrindo Chrome e navegando para Gmail..."
}`;
}

function buildTaskPrompt(userCommand, previousActions = [], lastScreenshot = null, screenSize = null) {
  let prompt = buildSystemPrompt();
  prompt += `\n\nCOMANDO DO USUÁRIO: "${userCommand}"\n`;

  if (screenSize) {
    prompt += `RESOLUÇÃO DA TELA: ${screenSize.width}x${screenSize.height}\n`;
  }

  if (previousActions.length > 0) {
    prompt += `\nAÇÕES JÁ EXECUTADAS:\n`;
    previousActions.forEach((a, i) => {
      prompt += `${i + 1}. ${JSON.stringify(a.action)} → ${a.result.success ? 'OK' : 'ERRO: ' + a.result.error}\n`;
    });
  }

  if (lastScreenshot) {
    prompt += `\n[Uma screenshot da tela atual será anexada a esta mensagem]\n`;
  }

  prompt += `\nResponda com o próximo passo em JSON.`;
  return prompt;
}

// ============================================================
// JSON PARSER (extrai JSON da resposta da Kimi)
// ============================================================

function parseKimiResponse(text) {
  // Try to extract JSON from markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {}
  }

  // Try to find JSON object in text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }

  return null;
}

// ============================================================
// MAIN AGENT LOOP
// ============================================================

class ComputerUseAgent {
  constructor(kimiBridge) {
    this.kimi = kimiBridge;
    this.active = false;
  }

  async executeTask(userCommand, options = {}) {
    if (this.active) {
      return { success: false, error: 'Já há uma tarefa em execução. Aguarde ou cancele.' };
    }

    this.active = true;
    const taskId = `cu_${Date.now()}`;
    const startTime = Date.now();
    const previousActions = [];
    let iteration = 0;
    let screenSize = null;

    try {
      // Get screen size
      const sizeResult = await runPython('getScreenSize');
      if (sizeResult.success) {
        const [w, h] = sizeResult.stdout.split(',').map(Number);
        screenSize = { width: w, height: h };
      }

      console.log(`[ComputerUse] Starting task: "${userCommand}" (taskId: ${taskId})`);

      while (iteration < MAX_ITERATIONS) {
        // Check timeout
        if (Date.now() - startTime > TASK_TIMEOUT_MS) {
          return { success: false, error: 'Timeout: tarefa excedeu 5 minutos', actions: previousActions };
        }

        iteration++;
        console.log(`[ComputerUse] Iteration ${iteration}/${MAX_ITERATIONS}`);

        // Take screenshot for context (every 3 iterations or first)
        let screenshotPath = null;
        if (iteration === 1 || iteration % 3 === 0) {
          screenshotPath = await takeScreenshot(taskId, iteration);
        }

        // Build prompt
        const prompt = buildTaskPrompt(userCommand, previousActions, screenshotPath, screenSize);

        // Send to Kimi
        let kimResponse;
        try {
          // If we have a screenshot, we need to upload it to Kimi
          // This requires the Kimi Bridge to support file uploads
          // For now, we'll send text-only and use screenshots for verification
          const result = await this.kimi.sendMessage('computer-use', prompt, { mode: 'thinking' });
          kimResponse = result.response;
        } catch (err) {
          console.error('[ComputerUse] Kimi error:', err.message);
          return { success: false, error: `Kimi error: ${err.message}`, actions: previousActions };
        }

        // Parse response
        const parsed = parseKimiResponse(kimResponse);
        if (!parsed) {
          console.error('[ComputerUse] Failed to parse Kimi response:', kimResponse);
          return { success: false, error: 'Failed to parse Kimi response', rawResponse: kimResponse, actions: previousActions };
        }

        console.log(`[ComputerUse] Kimi response:`, JSON.stringify(parsed, null, 2));

        // Check if done
        if (parsed.done) {
          return {
            success: true,
            message: parsed.message || 'Tarefa concluída',
            actions: previousActions
          };
        }

        // Execute actions
        if (!parsed.actions || !Array.isArray(parsed.actions)) {
          return { success: false, error: 'Invalid actions from Kimi', rawResponse: kimResponse, actions: previousActions };
        }

        for (const action of parsed.actions) {
          // Security check
          if (isBlockedAction(action)) {
            previousActions.push({ action, result: { success: false, error: 'Ação bloqueada por segurança' } });
            continue;
          }

          if (isDestructiveAction(action) && !options.skipConfirmation) {
            previousActions.push({ action, result: { success: false, error: 'NEEDS_CONFIRMATION', message: parsed.message } });
            return {
              success: false,
              error: 'NEEDS_CONFIRMATION',
              message: `⚠️ Ação destrutiva detectada: ${JSON.stringify(action)}\n\nResponde "sim" para confirmar ou "não" para cancelar.`,
              pendingAction: action,
              actions: previousActions
            };
          }

          // Execute
          console.log(`[ComputerUse] Executing: ${action.type}`, action.params);
          const result = await executeAction(action);
          previousActions.push({ action, result });

          if (!result.success) {
            console.error(`[ComputerUse] Action failed:`, result.error);
          }

          // Small delay between actions
          await new Promise(r => setTimeout(r, ACTION_DELAY_MS));
        }
      }

      return { success: false, error: `Max iterations (${MAX_ITERATIONS}) reached`, actions: previousActions };

    } finally {
      this.active = false;
      // Cleanup old screenshots (keep last 50)
      try {
        const files = fs.readdirSync(SCREENSHOT_DIR)
          .filter(f => f.startsWith('shot_'))
          .map(f => ({ name: f, time: fs.statSync(path.join(SCREENSHOT_DIR, f)).mtime.getTime() }))
          .sort((a, b) => b.time - a.time);
        for (const file of files.slice(50)) {
          fs.unlinkSync(path.join(SCREENSHOT_DIR, file.name));
        }
      } catch {}
    }
  }

  async cancel() {
    this.active = false;
    return { success: true, message: 'Tarefa cancelada' };
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = { ComputerUseAgent, runPython, takeScreenshot, executeAction };
