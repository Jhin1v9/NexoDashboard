# NEXO WhatsApp Agent v8.0 — Task Scheduler Setup
# Executar como Administrador

$taskName = "NEXO-WhatsApp-Agent-v8"
$workingDir = "C:\Users\Administrator\Documents\NEXO DIGITAL\01_ATIVOS\NEXO_DASHBOARD_PRO"
$scriptPath = "$workingDir\agents\nexo-whatsapp-agent-v8.mjs"

# Remove tarefa antiga se existir
schtasks /delete /tn $taskName /f 2>$null
schtasks /delete /tn "NEXO-WhatsApp-Agent" /f 2>$null

# Cria nova tarefa — executa a cada 30 minutos
$action = "node `""$scriptPath`"""
$startTime = (Get-Date).AddMinutes(5).ToString("HH:mm")

Write-Host "🔧 Criando tarefa agendada: $taskName" -ForegroundColor Cyan
Write-Host "   Diretório: $workingDir" -ForegroundColor Gray
Write-Host "   Script: $scriptPath" -ForegroundColor Gray
Write-Host "   Frequência: A cada 30 minutos" -ForegroundColor Gray
Write-Host "   Início: $startTime" -ForegroundColor Gray

schtasks /create /tn $taskName /tr "cmd /c cd /d `""$workingDir`"" & node `""$scriptPath`""" /sc minute /mo 30 /st $startTime /f /rl highest

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Tarefa criada com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Detalhes:" -ForegroundColor Cyan
    schtasks /query /tn $taskName /fo list | Select-String "Task Name|Next Run Time|Schedule Type"
} else {
    Write-Host "❌ Falha ao criar tarefa. Código: $LASTEXITCODE" -ForegroundColor Red
}

Write-Host ""
Write-Host "📝 Para executar manualmente:" -ForegroundColor Yellow
Write-Host "   node agents\nexo-whatsapp-agent-v8.mjs" -ForegroundColor White
Write-Host ""
pause
