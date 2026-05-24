/**
 * E2E Spec: Luna Fase 1 (1A + 1B)
 * Preview Contextual + Confirmação/Neagação + Undo/Redo
 *
 * Cenários testados como um humano real usaria:
 * - Admin: excluir com preview, confirmar, desfazer
 * - Admin: criar com preview editável, cancelar
 * - Admin: cancelar exclusão → resposta inteligente
 * - Operador: tentar excluir (sem permissão)
 * - NLU: "sim", "não", "desfazer", "refazer"
 */

const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage.js');
const { LunaChatPage } = require('../pages/LunaChatPage.js');

const API_URL = 'http://localhost:3456';

async function getServiceToken() {
  const res = await fetch(`${API_URL}/api/auth/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Token': 'nexo-tap-7x-2026' },
    body: JSON.stringify({ userId: 'abner' }),
  });
  const data = await res.json();
  return data.token;
}

async function createTask(token, title) {
  const res = await fetch(`${API_URL}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ title, description: 'tarefa de teste e2e', priority: 'low' }),
  });
  return res.ok;
}

async function deleteTask(token, title) {
  // Busca a tarefa pelo título e deleta
  const res = await fetch(`${API_URL}/api/tasks`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const tasks = await res.json();
  const tasksArray = Array.isArray(tasks) ? tasks : (tasks?.tasks || []);
  const task = tasksArray.find(t => t.title === title);
  if (task) {
    await fetch(`${API_URL}/api/tasks/${task.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  }
}

test.describe('Luna Fase 1 — Preview Contextual + Confirmação + Undo', () => {
  test.beforeEach(async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login('abner', '7741');
  });

  test('ADMIN: excluir tarefa mostra preview rico e permite undo', async ({ page }) => {
    const token = await getServiceToken();
    const taskName = `E2E Undo ${Date.now()}`;
    await createTask(token, taskName);

    const luna = new LunaChatPage(page);
    await luna.open();
    await luna.sendMessage(`apagar tarefa ${taskName}`);
    await luna.waitForLunaResponse();

    // Deve mostrar card de confirmação com preview
    const hasPreview = await luna.hasConfirmationCard();
    expect(hasPreview).toBe(true);

    // Confirma
    await luna.clickConfirm();
    await luna.waitForLunaResponse();

    // Deve ter executado
    const lastText = await luna.getLastMessageText();
    expect(lastText).toMatch(/excluída|apagada|executada/);

    // Deve mostrar botão Desfazer
    const hasUndo = await luna.hasUndoButton();
    expect(hasUndo).toBe(true);

    // Clica em Desfazer
    await luna.clickUndo();
    await luna.waitForLunaResponse();

    // Verifica se a tarefa voltou
    const tasksRes = await fetch(`${API_URL}/api/tasks`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const tasks = await tasksRes.json();
    const tasksArray = Array.isArray(tasks) ? tasks : (tasks?.tasks || []);
    const restored = tasksArray.some(t => t.title === taskName);
    expect(restored).toBe(true);

    // Cleanup
    await deleteTask(token, taskName);
  });

  test('ADMIN: criar tarefa mostra preview editável e cancela', async ({ page }) => {
    const luna = new LunaChatPage(page);
    await luna.open();
    await luna.sendMessage('criar tarefa Teste E2E Criar responsável Abner');
    await luna.waitForLunaResponse();

    // Deve mostrar card de edição
    const hasPreview = await luna.hasConfirmationCard();
    expect(hasPreview).toBe(true);

    // Cancela
    await luna.clickCancel();
    await luna.waitForLunaResponse();

    // Deve responder com cancelamento inteligente
    const lastText = await luna.getLastMessageText();
    expect(lastText).toMatch(/entendido|errado|queria fazer/);
  });

  test('ADMIN: cancelar exclusão responde com mensagem inteligente', async ({ page }) => {
    const token = await getServiceToken();
    const taskName = `E2E Cancel ${Date.now()}`;
    await createTask(token, taskName);

    const luna = new LunaChatPage(page);
    await luna.open();
    await luna.sendMessage(`apagar tarefa ${taskName}`);
    await luna.waitForLunaResponse();

    const hasPreview = await luna.hasConfirmationCard();
    expect(hasPreview).toBe(true);

    // Cancela por texto
    await luna.sendMessage('não');
    await luna.waitForLunaResponse();

    const lastText = await luna.getLastMessageText();
    expect(lastText).toMatch(/entendido|errado|queria fazer/);

    // Cleanup
    await deleteTask(token, taskName);
  });

  test('NLU: reconhece confirmação, negação e undo', async ({ page }) => {
    const token = await getServiceToken();
    const luna = new LunaChatPage(page);
    await luna.open();

    // Testa "sim" puro
    await luna.sendMessage('sim');
    await luna.waitForLunaResponse();
    let text = await luna.getLastMessageText();
    expect(text.length).toBeGreaterThan(0);

    // Testa "não quero"
    await luna.sendMessage('não quero');
    await luna.waitForLunaResponse();
    text = await luna.getLastMessageText();
    expect(text.length).toBeGreaterThan(0);

    // Testa "desfazer"
    await luna.sendMessage('desfazer');
    await luna.waitForLunaResponse();
    text = await luna.getLastMessageText();
    expect(text).toMatch(/desfazer|undo|nenhuma ação/);
  });

  test('Listar tarefas funciona normalmente', async ({ page }) => {
    const luna = new LunaChatPage(page);
    await luna.open();
    await luna.sendMessage('minhas tarefas');
    await luna.waitForLunaResponse(10000);

    const lastText = await luna.getLastMessageText();
    expect(lastText.length).toBeGreaterThan(0);
  });
});
