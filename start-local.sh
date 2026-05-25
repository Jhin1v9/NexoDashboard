#!/bin/bash
# =============================================================================
# NEXO Dashboard Pro — Modo Desenvolvimento Local (PostgreSQL Docker)
# Desbloqueia desenvolvimento quando Neon está com quota excedida
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  NEXO Dashboard Pro — Modo Desenvolvimento Local${NC}"
echo -e "${BLUE}  PostgreSQL local via Docker (sem depender do Neon)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# 1. Verifica se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker não está instalado!${NC}"
    echo "   Instale: https://docs.docker.com/engine/install/"
    echo ""
    echo "   Alternativa rápida (Ubuntu/Debian):"
    echo "   sudo apt update && sudo apt install -y docker.io docker-compose"
    exit 1
fi

# 2. Sobe o PostgreSQL local
echo -e "${YELLOW}🐳 Subindo PostgreSQL local...${NC}"
docker compose -f docker-compose.dev.yml up -d

# 3. Aguarda o banco ficar pronto
echo -e "${YELLOW}⏳ Aguardando PostgreSQL ficar pronto...${NC}"
until docker exec nexo-postgres-dev pg_isready -U nexo -d nexodb > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo ""
echo -e "${GREEN}✅ PostgreSQL local pronto!${NC}"

# 4. Verifica se as tabelas já existem, se não, rota as migrações
TABLES=$(docker exec nexo-postgres-dev psql -U nexo -d nexodb -t -c "
    SELECT COUNT(*) FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
" 2>/dev/null | xargs || echo "0")

if [ "$TABLES" -lt "5" ]; then
    echo -e "${YELLOW}📦 Banco vazio ou quase vazio. Rodando migrações...${NC}"
    
    # Lista todos os arquivos SQL de migração na ordem
    for migration in backend/migrations/*.sql; do
        if [ -f "$migration" ]; then
            echo -e "   ${BLUE}→ Aplicando $(basename $migration)...${NC}"
            docker exec -i nexo-postgres-dev psql -U nexo -d nexodb < "$migration" 2>/dev/null || true
        fi
    done
    
    echo -e "${GREEN}✅ Migrações aplicadas!${NC}"
else
    echo -e "${GREEN}✅ Banco já tem $TABLES tabelas. Pulando migrações.${NC}"
fi

echo ""

# 5. Inicia o backend apontando para o banco local
echo -e "${YELLOW}🚀 Iniciando NEXO Dashboard (backend)...${NC}"
echo -e "   ${BLUE}URL do banco: postgres://nexo:nexo123@localhost:5432/nexodb${NC}"
echo ""

cd backend
export DATABASE_URL="postgres://nexo:nexo123@localhost:5432/nexodb"
export NODE_ENV="development"
export PORT="3456"

node server.js
