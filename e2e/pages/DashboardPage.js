/**
 * Page Object: DashboardPage
 * Como interagir com o dashboard principal
 */

class DashboardPage {
  constructor(page) {
    this.page = page;
    this.sidebar = page.locator('nav, aside').first();
    this.notificationBell = page.locator('button[aria-label*="Notificações"], button[aria-haspopup="dialog"]').first();
    this.notificationPanel = page.locator('div[role="dialog"][aria-labelledby*="nc-title"], div[role="dialog"]').first();
  }

  async openNotifications() {
    await this.notificationBell.click();
    await this.notificationPanel.waitFor({ state: 'visible', timeout: 5000 });
  }

  async closeNotifications() {
    await this.page.keyboard.press('Escape');
    await this.notificationPanel.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }

  async navigateTo(section) {
    const map = {
      tarefas: 'Tarefas',
      leads: 'Leads',
      financeiro: 'Financeiro',
      ideias: 'Ideias',
      workspace: 'Workspace',
    };
    const label = map[section] || section;
    await this.page.click(`text=${label}`);
    await this.page.waitForURL(`**/${section}`, { timeout: 10000 });
  }

  async expectCard(title) {
    await this.page.waitForSelector(`text=${title}`, { timeout: 5000 });
  }
}

module.exports = { DashboardPage };
