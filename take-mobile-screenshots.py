
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 375, 'height': 667},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
        )
        page = await context.new_page()
        
        # 1. Abrir landing page
        await page.goto('http://localhost:3456/', wait_until='networkidle')
        await page.screenshot(path='/home/jhin/NEXO_DASHBOARD_PRO/mobile-screenshots/01-landing-mobile.png', full_page=True)
        print("Screenshot 1: Landing page mobile")
        
        # 2. Navegar para login
        await page.goto('http://localhost:3456/login', wait_until='networkidle')
        await page.screenshot(path='/home/jhin/NEXO_DASHBOARD_PRO/mobile-screenshots/02-login-mobile.png', full_page=True)
        print("Screenshot 2: Login page mobile")
        
        # 3. Fazer login
        await page.fill('input[type="text"], input[name="username"], input[name="email"], input[placeholder*="usu"], input[placeholder*="email"]', 'abner')
        await page.fill('input[type="password"], input[name="password"]', '7741')
        await page.click('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")')
        await page.wait_for_timeout(3000)
        await page.screenshot(path='/home/jhin/NEXO_DASHBOARD_PRO/mobile-screenshots/03-after-login-mobile.png', full_page=True)
        print("Screenshot 3: After login mobile")
        
        # 4. Dashboard
        await page.goto('http://localhost:3456/dashboard', wait_until='networkidle')
        await page.wait_for_timeout(2000)
        await page.screenshot(path='/home/jhin/NEXO_DASHBOARD_PRO/mobile-screenshots/04-dashboard-mobile.png', full_page=True)
        print("Screenshot 4: Dashboard mobile")
        
        # 5. Tarefas
        await page.goto('http://localhost:3456/tarefas', wait_until='networkidle')
        await page.wait_for_timeout(2000)
        await page.screenshot(path='/home/jhin/NEXO_DASHBOARD_PRO/mobile-screenshots/05-tarefas-mobile.png', full_page=True)
        print("Screenshot 5: Tarefas mobile")
        
        # 6. Financeiro
        await page.goto('http://localhost:3456/financeiro', wait_until='networkidle')
        await page.wait_for_timeout(2000)
        await page.screenshot(path='/home/jhin/NEXO_DASHBOARD_PRO/mobile-screenshots/06-financeiro-mobile.png', full_page=True)
        print("Screenshot 6: Financeiro mobile")
        
        # 7. Caixa
        await page.goto('http://localhost:3456/financeiro/caixa', wait_until='networkidle')
        await page.wait_for_timeout(2000)
        await page.screenshot(path='/home/jhin/NEXO_DASHBOARD_PRO/mobile-screenshots/07-caixa-mobile.png', full_page=True)
        print("Screenshot 7: Caixa mobile")
        
        await browser.close()
        print("\nTodos screenshots salvos em /home/jhin/NEXO_DASHBOARD_PRO/mobile-screenshots/")

asyncio.run(main())
