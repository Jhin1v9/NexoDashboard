/**
 * Page Object: LandingPage
 * Como interagir com a landing page pública
 */

class LandingPage {
  constructor(page) {
    this.page = page;
    this.registerButton = page.locator('a[href="/register"], button:has-text("Registrar"), a:has-text("Registrar")').first();
    this.loginButton = page.locator('a[href="/login"], button:has-text("Entrar"), a:has-text("Entrar")').first();
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async clickRegistrar() {
    await this.registerButton.click();
    await this.page.waitForURL('**/register', { timeout: 10000 });
  }

  async clickEntrar() {
    await this.loginButton.click();
    await this.page.waitForURL('**/login', { timeout: 10000 });
  }
}

module.exports = { LandingPage };
