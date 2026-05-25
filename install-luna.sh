#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Luna CLI v3.1 — Installer Script
# Para os sócios da NEXO DIGITAL S.L.
# ═══════════════════════════════════════════════════════════════════════════

set -e

LUNA_VERSION="3.1.0"
REPO_URL="https://github.com/Jhin1v9/NexoDashboard.git"
INSTALL_DIR="${HOME}/NEXO_DASHBOARD_PRO"
BIN_DIR="${HOME}/.local/bin"
DATA_DIR="${HOME}/.luna"

echo ""
echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║                 🌙 LUNA CLI v${LUNA_VERSION} — Instalador                          ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Check Node.js ──────────────────────────────────────────────────────
echo "📦 Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale o Node.js v18+ primeiro:"
    echo "   Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt install -y nodejs"
    echo "   macOS: brew install node"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "❌ Node.js v${NODE_VERSION} encontrado, mas v18+ é necessário."
    exit 1
fi
echo "   ✅ Node.js v${NODE_VERSION}"

# ── 2. Check Git ──────────────────────────────────────────────────────────
echo "📦 Verificando Git..."
if ! command -v git &> /dev/null; then
    echo "❌ Git não encontrado. Instale: sudo apt install git"
    exit 1
fi
echo "   ✅ Git"

# ── 3. Check Chrome/Chromium ──────────────────────────────────────────────
echo "📦 Verificando Chrome/Chromium..."
CHROME_FOUND=false
for cmd in google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "$cmd" &> /dev/null; then
        echo "   ✅ $cmd encontrado"
        CHROME_FOUND=true
        break
    fi
done
if [ "$CHROME_FOUND" = false ]; then
    echo "⚠️  Chrome/Chromium não encontrado. A Luna precisa dele para o Kimi Web."
    echo "   Instale: sudo apt install google-chrome-stable"
    echo "   Ou:      sudo apt install chromium-browser"
fi

# ── 4. Clone or update repo ───────────────────────────────────────────────
echo ""
echo "📥 Baixando Luna..."
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "   Diretório existe. Atualizando..."
    cd "$INSTALL_DIR"
    git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || echo "   ⚠️ Não foi possível atualizar (pode estar offline)"
else
    echo "   Clonando de ${REPO_URL}..."
    git clone "$REPO_URL" "$INSTALL_DIR"
fi

# ── 5. Install dependencies ───────────────────────────────────────────────
echo ""
echo "📦 Instalando dependências..."
cd "$INSTALL_DIR/agents"
npm install ink react playwright glob turndown chalk dotenv shell-quote

# ── 6. Create data directories ────────────────────────────────────────────
echo ""
echo "📁 Criando diretórios de dados..."
mkdir -p "$DATA_DIR/sessions"
mkdir -p "$DATA_DIR/skills"
mkdir -p "$DATA_DIR/personas"
mkdir -p "$DATA_DIR/memories"
mkdir -p "$DATA_DIR/chrome-profile"
echo "   ✅ ~/.luna/"

# ── 7. Create symlink ─────────────────────────────────────────────────────
echo ""
echo "🔗 Criando comando 'luna'..."
mkdir -p "$BIN_DIR"

# Remove old symlink if exists
rm -f "$BIN_DIR/luna"

# Create new symlink
ln -s "$INSTALL_DIR/agents/luna-tui.mjs" "$BIN_DIR/luna"
chmod +x "$INSTALL_DIR/agents/luna-tui.mjs"

# Add to PATH if needed
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    echo ""
    echo "⚠️  ${BIN_DIR} não está no PATH."
    echo "   Adicione ao seu ~/.bashrc ou ~/.zshrc:"
    echo "   export PATH=\"\$HOME/.local/bin:\$PATH\""
fi
echo "   ✅ luna → ${BIN_DIR}/luna"

# ── 8. Check xclip for clipboard ──────────────────────────────────────────
echo ""
echo "📋 Verificando clipboard (xclip)..."
if ! command -v xclip &> /dev/null; then
    echo "   ⚠️  xclip não encontrado. Paste (Ctrl+V) não funcionará."
    echo "   Instale: sudo apt install xclip"
else
    echo "   ✅ xclip"
fi

# ── 9. Done ───────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ INSTALAÇÃO CONCLUÍDA                               ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "🚀 Para iniciar a Luna:"
echo "   luna"
echo ""
echo "🔐 Na PRIMEIRA vez, faça login no Kimi Web:"
echo "   1. Execute: luna"
echo "   2. Digite: /login"
echo "   3. O Chrome vai abrir — faça login em kimi.com"
echo "   4. Pronto! A Luna está pronta para usar."
echo ""
echo "📚 Comandos úteis:"
echo "   /login    → Inicia Chrome e verifica login"
echo "   /status   → Status do sistema"
echo "   /yolo     → Modo sem confirmação (cuidado!)"
echo "   /help     → Mostra ajuda"
echo "   Ctrl+S    → Steer (interromper/responder)"
echo "   Ctrl+V    → Colar do clipboard"
echo ""
echo "🌙 Luna CLI v${LUNA_VERSION} — Criada por Abner Gabriel / NEXO DIGITAL S.L."
echo ""
