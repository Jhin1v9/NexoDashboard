#!/usr/bin/env bash
# LUNA v16.1 - instalador seguro para NEXO Dashboard Pro

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[LUNA]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "LUNA v16.1 - Instalador Automatico"
echo "=================================="
echo

log "Verificando dependencias..."

if ! command -v node >/dev/null 2>&1; then
  error "Node.js nao encontrado. Instale Node 20+ antes de continuar."
  exit 1
fi

NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
if [ "$NODE_MAJOR" -lt 18 ]; then
  warn "Node.js $(node -v) detectado. Recomendado: v18+."
else
  success "Node.js $(node -v)"
fi

if ! command -v npm >/dev/null 2>&1; then
  error "npm nao encontrado."
  exit 1
fi
success "npm $(npm -v)"

if ! command -v ollama >/dev/null 2>&1; then
  error "Ollama nao encontrado. Instale com: curl -fsSL https://ollama.com/install.sh | sh"
  exit 1
fi
success "$(ollama -v 2>/dev/null || echo 'Ollama instalado')"

if ! command -v git >/dev/null 2>&1; then
  warn "Git nao encontrado. Commits/push nao ficarao disponiveis nesta maquina."
fi

log "Verificando estrutura..."
mkdir -p agents backend/data/config backend/data/schema .wwebjs_auth backups
success "Estrutura base pronta"

BACKUP_DIR="backups/luna-v16.1-$(date +%Y%m%d-%H%M%S)"
log "Fazendo backup em $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"

for file in \
  agents/SmartClassifier_v16.js \
  agents/LunaBrain_v16.js \
  agents/luna-cto-agent.cjs \
  agents/LUNA-RULES.md \
  package.json
do
  if [ -f "$file" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$file")"
    cp "$file" "$BACKUP_DIR/$file"
  fi
done
success "Backup concluido"

log "Instalando dependencias npm da raiz..."
npm install
success "Dependencias da raiz instaladas"

if [ -f "frontend/package.json" ]; then
  log "Instalando dependencias do frontend..."
  npm --prefix frontend install
  success "Frontend pronto"
fi

if [ -f "backend/package.json" ]; then
  log "Instalando dependencias do backend..."
  npm --prefix backend install
  success "Backend pronto"
fi

if [ -f "agents/package.json" ]; then
  log "Instalando dependencias dos agents..."
  npm --prefix agents install
  success "Agents pronto"
fi

log "Garantindo modelo qwen3:1.7b no Ollama..."
ollama pull qwen3:1.7b
success "Modelo qwen3:1.7b pronto"

log "Validando arquivos principais..."
node -c agents/SmartClassifier_v16.js
node -c agents/LunaBrain_v16.js
node -c agents/luna-cto-agent.cjs
success "Sintaxe principal OK"

log "Testando classificacao rapida..."
node - <<'NODE'
const { LunaBrain } = require('./agents/LunaBrain_v16.js');

(async () => {
  const brain = new LunaBrain({
    model: process.env.LUNA_QWEN_MODEL || process.env.LUNA_LLM_MODEL || 'qwen3:1.7b',
    classifyTimeoutMs: 30000
  });
  const result = await brain.fastClassify({ body: 'Consegui consertar o bug do dashboard', author: 'abner' });
  console.log(JSON.stringify({
    category: result.category,
    confidence: result.confidence,
    source: result.source || 'regex'
  }, null, 2));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
NODE
success "Classificacao operacional"

echo
echo "=================================="
echo -e "${GREEN}INSTALACAO CONCLUIDA${NC}"
echo "=================================="
echo
echo "Backup salvo em: $BACKUP_DIR"
echo
echo "Proximos passos:"
echo "  1. Revise agents/luna-cto-agent.cjs e confirme CONFIG.groupName."
echo "  2. Execute: npm start"
echo "  3. Escaneie o QR Code se a sessao WhatsApp ainda nao existir."
echo "  4. Teste no grupo permitido: @luna oi"
echo
echo "Comandos uteis:"
echo "  npm start     - inicia Luna"
echo "  npm run once  - executa uma passagem"
echo "  npm run diagnose - diagnostico"
