# =======================================================================
# Luna Service Installer v10.2
# Instala o Luna como tarefa agendada do Windows
# Roda automaticamente no login do Administrator
# =======================================================================

$TaskName = "Luna-Daemon-v10"
$WorkingDir = "C:\Users\Administrator\Documents\NEXO DIGITAL\01_ATIVOS\NEXO_DASHBOARD_PRO"
$NodePath = (Get-Command node).Source
$ScriptPath = "$WorkingDir\agents\luna-daemon.mjs"

Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "  LUNA SERVICE INSTALLER v10.2" -ForegroundColor Cyan
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host ""

# Verifica se node está instalado
if (-not $NodePath) {
    Write-Host "ERRO: Node.js nao encontrado!" -ForegroundColor Red
    exit 1
}

Write-Host "Node.js: $NodePath" -ForegroundColor Green
Write-Host "Script:  $ScriptPath" -ForegroundColor Green
Write-Host ""

# Remove tarefa antiga se existir
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removendo tarefa antiga..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Cria ação
$Action = New-ScheduledTaskAction -Execute $NodePath -Argument "`"$ScriptPath`"" -WorkingDirectory $WorkingDir

# Cria trigger (no login do usuário)
$Trigger = New-ScheduledTaskTrigger -AtLogOn

# Cria configurações
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable:$false `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Days 365)

# Cria tarefa
$Principal = New-ScheduledTaskPrincipal -UserId "Administrator" -LogonType Interactive -RunLevel Highest

Write-Host "Criando tarefa agendada..." -ForegroundColor Yellow
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "Luna Daemon v10.2 - Servico permanente de monitoramento WhatsApp" `
    -Force

Write-Host ""
Write-Host "=======================================================================" -ForegroundColor Green
Write-Host "  ✅ SERVICO INSTALADO COM SUCESSO!" -ForegroundColor Green
Write-Host "=======================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Nome:    $TaskName" -ForegroundColor Cyan
Write-Host "Trigger: No login do Administrator" -ForegroundColor Cyan
Write-Host "Restart: Automatico (3 tentativas)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Comandos uteis:" -ForegroundColor Yellow
Write-Host "  Start:  Start-ScheduledTask -TaskName $TaskName" -ForegroundColor Gray
Write-Host "  Stop:   Stop-ScheduledTask -TaskName $TaskName" -ForegroundColor Gray
Write-Host "  Check:  Get-ScheduledTask -TaskName $TaskName" -ForegroundColor Gray
Write-Host "  Remove: Unregister-ScheduledTask -TaskName $TaskName" -ForegroundColor Gray
Write-Host ""

# Inicia imediatamente
Write-Host "Iniciando servico agora..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $TaskName
Start-Sleep 3

# Verifica status
$task = Get-ScheduledTask -TaskName $TaskName
Write-Host "Status: $($task.State)" -ForegroundColor $(if ($task.State -eq 'Running') { 'Green' } else { 'Red' })

# Mostra PID
$pidFile = "$WorkingDir\artifacts\luna-daemon.pid"
if (Test-Path $pidFile) {
    $pid = Get-Content $pidFile
    Write-Host "PID: $pid" -ForegroundColor Green
}
