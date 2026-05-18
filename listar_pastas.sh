#!/bin/bash
# ============================================
# LISTAR PASTAS DO USUÁRIO (pra acertar backups)
# ============================================

echo "📂 PASTAS NA HOME:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ls -d ~/*/ 2>/dev/null | head -30

echo ""
echo "📂 PASTAS COM 'NEXO' NO NOME:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
find ~ -maxdepth 2 -type d -iname "*nexo*" 2>/dev/null

echo ""
echo "📂 PASTAS COM 'PROJETO' NO NOME:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
find ~ -maxdepth 2 -type d -iname "*projeto*" 2>/dev/null

echo ""
echo "📂 PENDRIVES/MÍDIAS MONTADAS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ls /media/*/ 2>/dev/null || ls /mnt/*/ 2>/dev/null || ls /Volumes/*/ 2>/dev/null || echo "Nenhum pendrive encontrado"

echo ""
echo "📊 TAMANHO DAS PASTAS (top 10):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
du -sh ~/*/ 2>/dev/null | sort -rh | head -10
