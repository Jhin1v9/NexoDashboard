/**
 * Page Object: LoginPage
 * Como interagir com a página /login
 */

class LoginPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.locator('input[name="username"], input[type="text"]').first();
    this.passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    this.submitButton = page.locator('button[type="submit"]').first();
  }

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async login(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    // Aguarda navegação para o dashboard
    await this.page.waitForURL('**/dashboard', { timeout: 10000 });
  }

  async expectError(message) {
    await this.page.waitForSelector(`text=${message}`, { timeout: 5000 });
  }
}

module.exports = { LoginPage };
