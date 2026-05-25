/**
 * Page Object: LunaChatPage
 * Como interagir com o painel de chat da Luna
 */

class LunaChatPage {
  constructor(page) {
    this.page = page;
    // Botão flutuante que abre o chat
    this.chatToggle = page.locator('button[class*="rounded-full"][class*="shadow"]').first();
    // Input de mensagem
    this.messageInput = page.locator('input[placeholder*="Luna"], textarea[placeholder*="Luna"]').first();
    // Área de mensagens do chat
    this.chatPanel = page.locator('[class*="chat"], [class*="messages"]').first();
  }

  async open() {
    // Tenta clicar no botão flutuante
    const isVisible = await this.chatToggle.isVisible().catch(() => false);
    if (!isVisible) {
      // Se não estiver visível, talvez o chat já esteja aberto
      const inputVisible = await this.messageInput.isVisible().catch(() => false);
      if (!inputVisible) throw new Error('Chat da Luna não encontrado');
      return;
    }
    await this.chatToggle.click();
    await this.page.waitForTimeout(800);
  }

  async sendMessage(text) {
    await this.messageInput.fill(text);
    await this.messageInput.press('Enter');
    // Aguarda resposta da Luna (pode demorar por causa do NLU/LLM)
    await this.page.waitForTimeout(3000);
  }

  async getLastLunaMessage() {
    // Mensagens da Luna têm rounded-tl-sm (não rounded-tr-sm que é do usuário)
    const lunaMessages = this.page.locator('[class*="rounded-tl-sm"]').filter({ hasText: /./ });
    const count = await lunaMessages.count();
    if (count === 0) return null;
    return lunaMessages.nth(count - 1);
  }

  async hasConfirmationCard() {
    const text = await this.page.locator('body').innerText();
    return text.includes('Tem certeza') || text.includes('Confirmar exclusão') || text.includes('Editar tarefa');
  }

  async hasUndoButton() {
    const undoBtn = this.page.locator('button:has-text("Desfazer")').first();
    return undoBtn.isVisible().catch(() => false);
  }

  async clickUndo() {
    const undoBtn = this.page.locator('button:has-text("Desfazer")').first();
    await undoBtn.click();
    await this.page.waitForTimeout(3000);
  }

  async getConfirmTextValue() {
    // Extrai o valor que deve ser digitado do label "Digite 'X' para confirmar"
    const bodyText = await this.page.locator('body').innerText();
    const match = bodyText.match(/Digite\s+["'](.+?)["']\s+para\s+confirmar/);
    return match ? match[1] : null;
  }

  async fillConfirmText(text) {
    const input = this.page.locator('input[placeholder*="Digite o nome"], input[placeholder*="confirmar"]').first();
    const isVisible = await input.isVisible().catch(() => false);
    if (isVisible) {
      await input.fill(text);
    }
  }

  async clickConfirm() {
    // Se houver campo de confirmação por texto, preenche primeiro
    const confirmText = await this.getConfirmTextValue();
    if (confirmText) {
      await this.fillConfirmText(confirmText);
    }
    // Clica no último botão Confirmar (o do card atual)
    const confirmBtn = this.page.locator('button:has-text("Confirmar"), button:has-text("✅ Confirmar"), button:has-text("Sim, excluir")').last();
    await confirmBtn.click();
    await this.page.waitForTimeout(5000);
  }

  async clickCancel() {
    const cancelBtn = this.page.locator('button:has-text("Cancelar"), button:has-text("❌ Cancelar")').first();
    await cancelBtn.click();
    await this.page.waitForTimeout(2000);
  }

  async getLastMessageText() {
    const lastMsg = await this.getLastLunaMessage();
    if (!lastMsg) return '';
    return lastMsg.innerText();
  }

  async waitForLunaResponse(timeout = 12000) {
    // Aguarda o indicador "pensando" desaparecer
    const thinking = this.page.locator('text=Luna está pensando').first();
    try {
      await thinking.waitFor({ state: 'hidden', timeout });
    } catch {
      // Se não apareceu "pensando", segue em frente
    }
    // Aguarda mais um pouco para renderização
    await this.page.waitForTimeout(2000);
  }
}

module.exports = { LunaChatPage };
