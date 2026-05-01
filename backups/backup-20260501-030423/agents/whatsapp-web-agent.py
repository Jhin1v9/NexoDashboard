#!/usr/bin/env python3
"""
NEXO WhatsApp Web Agent
Usa Playwright para conectar no WhatsApp Web e extrair mensagens do grupo.
O perfil persiste entre execuções (só precisa escanear QR code uma vez).
"""

import json
import time
import sys
import os
from datetime import datetime

# Adiciona o path do playwright do node_modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'node_modules', 'playwright'))

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("❌ Playwright não encontrado. Instalando...")
    os.system("npm install playwright")
    from playwright.sync_api import sync_playwright

CONFIG = {
    "group_name": "🏆Production - 2026🙏",
    "api_url": "http://127.0.0.1:3456/api/whatsapp",
    "profile_dir": os.path.join(os.path.dirname(__file__), "..", "data", "whatsapp-web-profile"),
    "check_interval": 5,  # segundos
}

def now_iso():
    return datetime.now().isoformat()

def extract_tasks(text):
    """Extrai possíveis tarefas do texto"""
    import re
    patterns = [
        r'(?:fazer|faz|fazemos|precisamos|tem que|temos que|devemos|vamos)\s+(.+)',
        r'(?:tarefa|task|todo|ação):?\s*(.+)',
        r'(?:bug|erro|problema|issue):?\s*(.+)',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None

def detect_mentions(text):
    """Detecta menções a integrantes"""
    mentions = []
    if re.search(r'\b(abner|jhin)\b', text, re.I):
        mentions.append("abner")
    if re.search(r'\b(nonoke|nono)\b', text, re.I):
        mentions.append("nonoke")
    if re.search(r'\b(elias)\b', text, re.I):
        mentions.append("elias")
    if re.search(r'\b(todos|equipe|time|galera)\b', text, re.I):
        mentions.append("all")
    return mentions

def send_to_dashboard(msg):
    """Envia mensagem para o dashboard"""
    try:
        import urllib.request
        data = json.dumps(msg).encode('utf-8')
        req = urllib.request.Request(
            CONFIG["api_url"],
            data=data,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        urllib.request.urlopen(req, timeout=5)
        print(f"   📤 Dashboard: {msg['text'][:50]}...")
    except Exception as e:
        print(f"   ⚠️  Dashboard offline: {e}")

def main():
    print("📱 NEXO WhatsApp Web Agent")
    print(f"   Grupo: {CONFIG['group_name']}")
    print(f"   Perfil: {CONFIG['profile_dir']}")
    print("")

    # Cria diretório do perfil se não existir
    os.makedirs(CONFIG["profile_dir"], exist_ok=True)

    with sync_playwright() as p:
        # Launch persistent context (perfil persiste)
        print("🚀 Iniciando Chrome com perfil persistente...")
        context = p.chromium.launch_persistent_context(
            CONFIG["profile_dir"],
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-first-run",
                "--no-default-browser-check",
            ]
        )

        page = context.new_page()
        print("🌐 Navegando para web.whatsapp.com...")
        page.goto("https://web.whatsapp.com", wait_until="domcontentloaded")

        # Aguarda login
        print("⏳ Aguardando login...")
        try:
            page.wait_for_selector('[data-testid="chat-list"]', timeout=60000)
            print("✅ WhatsApp logado!")
        except:
            print("📷 QR Code visível. Escaneie com o celular...")
            page.wait_for_selector('[data-testid="chat-list"]', timeout=120000)
            print("✅ Login confirmado!")

        # Procura o grupo
        print("")
        print(f"🔍 Procurando grupo: {CONFIG['group_name']}")

        # Clica na pesquisa
        search = page.locator('[data-testid="chat-list-search"]').or_(
            page.locator('div[contenteditable="true"][data-tab="3"]')
        )
        search.first.click()
        time.sleep(0.5)
        page.keyboard.type(CONFIG["group_name"])
        time.sleep(2)

        # Clica no grupo
        group = page.locator(f"text={CONFIG['group_name']}").first
        try:
            group.click(timeout=10000)
            print("✅ Grupo aberto!")
        except:
            print("❌ Grupo não encontrado. Verifique o nome exato.")
            print("   Chats visíveis:")
            chats = page.locator('[data-testid="chat-list-item"]').all()
            for chat in chats[:10]:
                title = chat.text_content() or "???"
                print(f"   - {title[:50]}")
            context.close()
            return

        time.sleep(2)

        # ── Monitoramento ─────────────────────────────────────────────────
        print("")
        print("👁️  Monitorando mensagens... (Ctrl+C para parar)")
        print("─" * 50)

        last_messages = set()

        def get_messages():
            """Extrai mensagens da página"""
            msgs = []
            containers = page.locator('[data-testid="msg-container"]').all()
            for container in containers[-20:]:  # últimas 20
                try:
                    text_el = container.locator('.selectable-text span').first
                    text = text_el.text_content(timeout=500)
                    if text:
                        msgs.append(text)
                except:
                    pass
            return msgs

        # Inicializa
        initial = get_messages()
        for m in initial:
            last_messages.add(m)
        print(f"   {len(initial)} mensagens carregadas.")

        # Loop
        try:
            while True:
                time.sleep(CONFIG["check_interval"])

                current = get_messages()
                new_msgs = [m for m in current if m not in last_messages]

                for text in new_msgs:
                    last_messages.add(text)

                    # Filtra lixo
                    if len(text) < 3:
                        continue
                    if text in ["WhatsApp", "Search", "Menu", "Type a message"]:
                        continue

                    task = extract_tasks(text)
                    mentions = detect_mentions(text)

                    print("")
                    print(f"💬 {text[:120]}")
                    if task:
                        print(f"   🎯 Tarefa: {task}")
                    if mentions:
                        print(f"   👥 Menções: {', '.join(mentions)}")

                    send_to_dashboard({
                        "text": text,
                        "from": "whatsapp-web",
                        "time": now_iso(),
                        "group": CONFIG["group_name"],
                        "task": task,
                        "mentions": mentions,
                        "source": "whatsapp-web-agent",
                    })

        except KeyboardInterrupt:
            print("\n\n🛑 Parado pelo usuário.")
        finally:
            context.close()
            print("✅ Chrome fechado.")

if __name__ == "__main__":
    main()
