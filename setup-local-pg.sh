#!/bin/bash
# =============================================================================
# Instala PostgreSQL local rapidamente (Ubuntu/Debian)
# Alternativa gratuita ao Neon quando quota é excedida
# =============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Instalador Rápido — PostgreSQL Local${NC}"
echo -e "${BLUE}  Alternativa GRATUITA ao Neon para desenvolvimento${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Verifica se já está instalado
if command -v psql &> /dev/null; then
    echo -e "${GREEN}✅ PostgreSQL já está instalado: $(psql --version)${NC}"
else
    echo -e "${YELLOW}📦 Instalando PostgreSQL...${NC}"
    sudo apt update
    sudo apt install -y postgresql postgresql-contrib
    echo -e "${GREEN}✅ PostgreSQL instalado!${NC}"
fi

# Inicia o serviço
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Cria usuário e banco para o NEXO
DB_NAME="nexodb"
DB_USER="nexo"
DB_PASS="nexo123"

echo -e "${YELLOW}🔧 Configurando banco e usuário...${NC}"

sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "   Usuário já existe, pulando..."
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || echo "   Banco já existe, pulando..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true

# Permite conexão local com senha
PG_HBA="/etc/postgresql/$(ls /etc/postgresql/ | head -1)/main/pg_hba.conf"
if [ -f "$PG_HBA" ]; then
    echo -e "${YELLOW}🔓 Configurando autenticação local...${NC}"
    # Troca peer/md5 para scram-sha-256 ou md5 local
    sudo sed -i 's/local   all             all                                     peer/local   all             all                                     md5/' "$PG_HBA"
    sudo sed -i 's/host    all             all             127.0.0.1\/32            scram-sha-256/host    all             all             127.0.0.1\/32            md5/' "$PG_HBA"
    sudo sed -i 's/host    all             all             ::1\/128                 scram-sha-256/host    all             all             ::1\/128                 md5/' "$PG_HBA"
    sudo systemctl restart postgresql
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ PostgreSQL local configurado!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "   ${BLUE}Host:${NC}     localhost"
echo -e "   ${BLUE}Porta:${NC}    5432"
echo -e "   ${BLUE}Banco:${NC}    $DB_NAME"
echo -e "   ${BLUE}Usuário:${NC}  $DB_USER"
echo -e "   ${BLUE}Senha:${NC}    $DB_PASS"
echo ""
echo -e "   ${YELLOW}DATABASE_URL para .env:${NC}"
echo -e "   ${GREEN}DATABASE_URL=postgres://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME${NC}"
echo ""
echo -e "   ${YELLOW}Para rodar o backend local:${NC}"
echo -e "   ${BLUE}cd backend && DATABASE_URL=postgres://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME node server.js${NC}"
echo ""
echo -e "   ${YELLOW}Para aplicar as migrações:${NC}"
echo -e "   ${BLUE}psql postgres://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME < backend/migrations/005-real-schema.sql${NC}"
echo ""
