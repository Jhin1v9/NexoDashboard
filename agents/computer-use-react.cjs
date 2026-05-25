/**
 * Computer Use ReAct Loop
 * Reasoning + Acting — uma ação por vez, guiado pela Kimi Web
 *
 * Inspirado em: Claude Computer Use, OpenAI Operator, Browser Use
 */

const { ComputerUseEngine } = require('./computer-use-engine.cjs');

// ============================================================
// PROMPTS
// ============================================================

const SYSTEM_PROMPT = `Você é o Computer Use Agent da Luna. Você controla o PC do usuário Abner (Ubuntu + GNOME + Wayland) REMOTAMENTE.

🧠 COMO FUNCIONA (LEIA COM ATENÇÃO):
1. Você recebe uma descrição da tela atual (screenshot, OCR, estado do desktop)
2. Você decide QUAL ação executar e responde com JSON
3. O AGENTE LOCAL executa essa ação NO PC DO USUÁRIO em tempo real
4. Você vê o resultado e decide a próxima ação

Você NÃO precisa de acesso direto ao PC — basta responder com a ação correta em JSON que o agente local executa para você.

REGRAS CRÍTICAS:
1. Responda SEMPRE em JSON válido com este formato EXATO:
   {"thought": "raciocínio em português", "action": {"type": "...", "params": {...}}, "message": "mensagem pro usuário", "done": false}
2. Quando a tarefa estiver COMPLETA: {"done": true, "message": "Tarefa concluída!"}
3. ENVIE APENAS UMA AÇÃO POR VEZ — não faça plano de múltiplos passos
4. Use coordenadas relativas à resolução informada
5. Se não souber onde clicar, peça um screenshot ou use OCR
6. Para apps comuns use open_app ao invés de coordenadas
7. Use hotkeys quando possível (mais confiável que coordenadas)
8. Sempre verifique o resultado com screenshot após ações importantes

AÇÕES DISPONÍVEIS (o agente local executa estas ações):
- click: {"type": "click", "params": {"x": 100, "y": 200}}
- doubleClick: {"type": "doubleClick", "params": {"x": 100, "y": 200}}
- rightClick: {"type": "rightClick", "params": {"x": 100, "y": 200}}
- type: {"type": "type", "params": {"text": "hello"}}
- key: {"type": "key", "params": {"key": "Return"}}
- hotkey: {"type": "hotkey", "params": {"keys": ["ctrl", "t"]}}
- scroll: {"type": "scroll", "params": {"amount": 500}}
- moveTo: {"type": "moveTo", "params": {"x": 100, "y": 200}}
- wait: {"type": "wait", "params": {"seconds": 2}}
- shell: {"type": "shell", "params": {"command": "ls -la"}}
- open_app: {"type": "open_app", "params": {"app": "chrome"}}
- screenshot: {"type": "screenshot", "params": {}}
- getMousePos: {"type": "getMousePos", "params": {}}
- getScreenSize: {"type": "getScreenSize", "params": {}}
- getWindows: {"type": "getWindows", "params": {}}
- ocr: {"type": "ocr", "params": {"imagePath": "/path/to/screenshot.png"}}

DICAS:
- Chrome: app="google-chrome" ou "chrome"
- Terminal: app="gnome-terminal" ou "terminal"
- VSCode: app="code"
- Telegram: app="telegram-desktop"
- Para nova aba no Chrome: hotkey ["ctrl", "t"]
- Para barra de endereço: hotkey ["ctrl", "l"]
- Para fullscreen: hotkey ["f11"]

IMPORTANTE: Você TEM controle total. Quando você envia {"type": "shell", "params": {"command": "date"}}, o comando DATE É EXECUTADO no PC do usuário e o resultado volta para você no próximo passo.`;

// ============================================================
// JSON PARSER (robusto)
// ============================================================

function parseKimiAction(text) {
  // Remove markdown code blocks
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*$/gm, '');
  cleaned = cleaned.replace(/```\s*/g, '');

  // Try to find JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*?\}(?=\s*$|\s*\n)/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }

  // Try multiple JSON extraction strategies
  const strategies = [
    () => JSON.parse(cleaned),
    () => {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      }
      throw new Error('No JSON object found');
    },
    () => {
      // Handle trailing commas
      const noTrailing = cleaned.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(noTrailing);
    },
  ];

  for (const strategy of strategies) {
    try {
      return strategy();
    } catch {}
  }

  return null;
}

// ============================================================
// REACT LOOP
// ============================================================

class ComputerUseReAct {
  constructor(options = {}) {
    this.engine = new ComputerUseEngine();
    this.kimiBridge = options.kimiBridge || null;
    this.maxIterations = options.maxIterations || 20;
    this.taskTimeoutMs = options.taskTimeoutMs || 5 * 60 * 1000;
    this.mode = options.mode || 'thinking';
    this.onStep = options.onStep || null; // callback(stepInfo)
    this.userId = options.userId || 'computer-use-default';
  }

  async _sendToKimi(prompt, imageBase64 = null) {
    if (!this.kimiBridge) {
      throw new Error('Kimi Bridge not available');
    }

    let result;
    if (imageBase64) {
      // Use sendImage if available
      result = await this.kimiBridge.sendImage(this.userId, imageBase64, prompt, { mode: this.mode });
    } else {
      result = await this.kimiBridge.sendMessage(this.userId, prompt, { mode: this.mode });
    }

    return result.response;
  }

  async _buildPrompt(task, step, desktopState, ocrText, actionHistory, lastResult) {
    const lines = [SYSTEM_PROMPT];

    lines.push(`\n--- TAREFA ---\n${task}`);
    lines.push(`\n--- PASSO ${step + 1} / ${this.maxIterations} ---`);

    if (desktopState.screenSize) {
      lines.push(`\n--- TELA ---\nResolução: ${desktopState.screenSize.width}x${desktopState.screenSize.height}`);
    }
    if (desktopState.mousePosition) {
      lines.push(`Mouse: (${desktopState.mousePosition.x}, ${desktopState.mousePosition.y})`);
    }
    if (desktopState.activeWindow) {
      lines.push(`Janela ativa: ${desktopState.activeWindow.name}`);
    }

    if (ocrText) {
      lines.push(`\n--- TEXTO NA TELA (OCR) ---\n${ocrText.slice(0, 1500)}`);
    }

    if (actionHistory.length > 0) {
      lines.push(`\n--- HISTÓRICO DE AÇÕES ---`);
      actionHistory.slice(-5).forEach((a, i) => {
        let detail = '';
        if (a.action.type === 'shell' && a.result.stdout) {
          detail = ` → Output: ${a.result.stdout.slice(0, 200)}`;
        }
        lines.push(`${i + 1}. ${a.action.type} → ${a.result.success ? '✅' : '❌'} ${a.result.error || ''}${detail}`);
      });
    }

    if (lastResult && !lastResult.success) {
      lines.push(`\n--- ERRO ANTERIOR ---\n${lastResult.error}`);
      lines.push(`Tente uma abordagem diferente.`);
    }

    lines.push(`\nResponda com o PRÓXIMO passo em JSON:`);

    return lines.join('\n');
  }

  async runTask(taskDescription) {
    const startTime = Date.now();
    const actionHistory = [];
    let screenshotPath = null;
    let lastResult = null;

    // Send initial status
    if (this.onStep) {
      await this.onStep({
        step: 0,
        type: 'start',
        message: `📝 Tarefa: ${taskDescription}`,
        done: false,
      });
    }

    try {
      for (let step = 0; step < this.maxIterations; step++) {
        // Check timeout
        if (Date.now() - startTime > this.taskTimeoutMs) {
          return { success: false, error: 'Timeout: tarefa excedeu 5 minutos', actions: actionHistory };
        }

        // Collect desktop state
        if (this.onStep) {
          await this.onStep({ step: step + 1, type: 'screenshot', message: '📸 Analisando tela...', done: false });
        }

        const desktopState = await this.engine.getDesktopState();
        screenshotPath = await this.engine.executeSingle({ type: 'screenshot' });

        let ocrText = null;
        if (screenshotPath.success && screenshotPath.screenshot) {
          ocrText = await this.engine.executeSingle({
            type: 'ocr',
            params: { imagePath: screenshotPath.screenshot },
          });
          ocrText = ocrText.success ? ocrText.text : null;
        }

        // Build prompt
        const prompt = await this._buildPrompt(
          taskDescription,
          step,
          desktopState,
          ocrText,
          actionHistory,
          lastResult,
        );

        // Send to Kimi
        if (this.onStep) {
          await this.onStep({ step: step + 1, type: 'thinking', message: '🧠 Kimi está decidindo...', done: false });
        }

        let kimResponse;
        try {
          // If screenshot available and we want vision, send image
          // For now, text-only (OCR) to save tokens and avoid Bridge image upload issues
          const result = await this._sendToKimi(prompt);
          kimResponse = result;
        } catch (err) {
          return { success: false, error: `Kimi error: ${err.message}`, actions: actionHistory };
        }

        // Parse response
        const parsed = parseKimiAction(kimResponse);
        if (!parsed) {
          return {
            success: false,
            error: 'Falha ao interpretar resposta da Kimi',
            rawResponse: kimResponse,
            actions: actionHistory,
          };
        }

        // Check if done
        if (parsed.done) {
          if (this.onStep) {
            await this.onStep({
              step: step + 1,
              type: 'done',
              message: parsed.message || '✅ Tarefa concluída!',
              done: true,
            });
          }
          return {
            success: true,
            message: parsed.message || 'Tarefa concluída',
            actions: actionHistory,
          };
        }

        // Validate action
        if (!parsed.action || !parsed.action.type) {
          return {
            success: false,
            error: 'Ação inválida da Kimi (sem type)',
            rawResponse: kimResponse,
            actions: actionHistory,
          };
        }

        // Notify user about action
        if (this.onStep) {
          const actionEmoji = {
            click: '🖱️', doubleClick: '🖱️🖱️', rightClick: '🖱️▶️',
            type: '⌨️', key: '🔑', hotkey: '🔑', scroll: '📜',
            moveTo: '🖱️', wait: '⏱️', shell: '💻', open_app: '🚀',
            screenshot: '📸', getMousePos: '🖱️', getScreenSize: '📺',
            getWindows: '🪟', ocr: '👁️',
          }[parsed.action.type] || '⚡';

          await this.onStep({
            step: step + 1,
            type: 'action',
            action: parsed.action,
            message: `${actionEmoji} ${parsed.message || `${parsed.action.type}: ${JSON.stringify(parsed.action.params || {})}`}`,
            done: false,
          });
        }

        // Execute action
        const result = await this.engine.executeSingle(parsed.action);
        actionHistory.push({ action: parsed.action, result });
        lastResult = result;

        if (!result.success) {
          if (this.onStep) {
            await this.onStep({
              step: step + 1,
              type: 'error',
              message: `❌ Erro: ${result.error}`,
              done: false,
            });
          }
          // Continue to next iteration — Kimi will see the error and try to recover
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }

        // Small delay between actions
        await new Promise(r => setTimeout(r, 800));
      }

      return {
        success: false,
        error: `Máximo de iterações (${this.maxIterations}) atingido`,
        actions: actionHistory,
      };

    } catch (err) {
      return {
        success: false,
        error: `Erro inesperado: ${err.message}`,
        actions: actionHistory,
      };
    }
  }

  cancel() {
    this.engine.cancel();
    return { success: true, message: 'Tarefa cancelada' };
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  ComputerUseReAct,
  parseKimiAction,
};
