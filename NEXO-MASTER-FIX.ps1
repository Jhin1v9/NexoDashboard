# ═══════════════════════════════════════════════════════════════════════════════
# NEXO DASHBOARD PRO — SCRIPT MASTER DE CORREÇÃO COMPLETA v1.0
# Gerado: 2026-05-03 | Node.js v24.13.0 | Windows 10/11
# Autor: Kimi K2.6 | Missão: Restaurar 100% da operação Luna
# ═══════════════════════════════════════════════════════════════════════════════
#
# INSTRUÇÕES DE USO:
# 1. Salve este arquivo como: NEXO-MASTER-FIX.ps1
# 2. Execute no PowerShell como ADMINISTRADOR:
#    Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
#    .\NEXO-MASTER-FIX.ps1
# 3. O script é IDEMPOTENTE — pode rodar múltiplas vezes sem danos
# 4. Cada fase tem CONFIRMAÇÃO — leia antes de prosseguir
#
# ═══════════════════════════════════════════════════════════════════════════════

#requires -Version 5.1
#requires -RunAsAdministrator

[CmdletBinding()]
param(
    [switch]$AutoFix,      # Pula confirmações (modo automático)
    [switch]$OnlyDiagnose, # Só diagnostica, não corrige
    [switch]$SkipBackup,   # Pula criação de backup
    [string]$ProjectPath = "C:\Users\Administrator\Documents\NEXO DIGITAL\01_ATIVOS\NEXO_DASHBOARD_PRO"
)

# ═══════════════════════════════════════════════════════════════════════════════
# SEÇÃO 0: CONFIGURAÇÕES E CONSTANTES
# ═══════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

# Cores para output
$colors = @{
    Red     = "Red"
    Green   = "Green"
    Yellow  = "Yellow"
    Cyan    = "Cyan"
    Magenta = "Magenta"
    White   = "White"
}

# Configurações do projeto
$CONFIG = @{
    ProjectPath        = $ProjectPath
    BackendPort        = 3456
    ChromeCdpPort      = 9223
    ChromeCdpFallback  = 9222
    NodeMinVersion     = [Version]"18.0.0"
    NodeMaxTested      = [Version]"24.13.0"

    # Paths críticos
    BackendServer      = "$ProjectPath\backend\server.js"
    FrontendDist       = "$ProjectPath\frontend\dist"
    AgentsDir          = "$ProjectPath\agents"
    DataDir            = "$ProjectPath\backend\data"

    # Arquivos críticos dos agentes
    LunaScheduler      = "$ProjectPath\agents\luna-scheduler.mjs"
    LunaAgentMJS       = "$ProjectPath\agents\luna-cto-agent.mjs"
    LunaAgentCJS       = "$ProjectPath\agents\luna-cto-agent.cjs"
    LunaDaemon         = "$ProjectPath\agents\luna-daemon.mjs"
    LunaRules          = "$ProjectPath\agents\LUNA-RULES.md"

    # Arquivos de estado
    LunaBuffer         = "$ProjectPath\backend\data\luna-buffer.json"
    LunaCheckpoint     = "$ProjectPath\backend\data\luna-checkpoint.json"
    WhatsAppCheckpoint = "$ProjectPath\backend\data\whatsapp-checkpoint.json"

    # Logs
    DaemonLog          = "$ProjectPath\backend\data\luna-daemon.log"
    SchedulerLog       = "$ProjectPath\backend\data\luna-scheduler.log"
    SchedulerErrLog    = "$ProjectPath\backend\data\luna-scheduler-errors.log"

    # Chrome profile
    ChromeProfile      = "$ProjectPath\data\chrome-abner-profile"
    ChromeProfileBackup = "$ProjectPath\backups\chrome-abner-profile-backup"

    # Scripts de inicialização
    StartChromeBat     = "$ProjectPath\agents\start-chrome-cdp.bat"
    StartAbnerChrome   = "$ProjectPath\agents\start-abner-chrome.bat"

    # Backup
    BackupDir          = "$ProjectPath\backups\auto-fix-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
}

# Status global do diagnóstico
$GLOBAL:DiagStatus = @{
    BackendRunning     = $false
    ChromeCdpRunning   = $false
    NodeVersionOK      = $false
    LunaAgentImportOK  = $false
    SchedulerFileOK    = $false
    DaemonFileOK       = $false
    DataFilesOK        = $false
    ChromeProfileOK    = $false
    GitRepoOK          = $false
    AllCriticalOK      = $false
}

$GLOBAL:FixesApplied = @()
$GLOBAL:Warnings = @()

# ═══════════════════════════════════════════════════════════════════════════════
# SEÇÃO 1: FUNÇÕES UTILITÁRIAS
# ═══════════════════════════════════════════════════════════════════════════════

function Write-Banner {
    param([string]$Title, [string]$Color = "Cyan")
    $width = 78
    $pad = [math]::Max(0, ($width - $Title.Length - 4) / 2)
    $line = "═" * $width
    Write-Host "`n$line" -ForegroundColor $Color
    Write-Host ("{0}{1}{2}" -f (" " * [math]::Floor($pad)), "  $Title  ", (" " * [math]::Ceiling($pad))) -ForegroundColor $Color
    Write-Host "$line`n" -ForegroundColor $Color
}

function Write-Step {
    param([int]$Number, [string]$Text)
    Write-Host "[FASE $Number] " -NoNewline -ForegroundColor Yellow
    Write-Host $Text -ForegroundColor White
}

function Write-OK {
    param([string]$Text)
    Write-Host "  ✓ $Text" -ForegroundColor Green
}

function Write-FAIL {
    param([string]$Text)
    Write-Host "  ✗ $Text" -ForegroundColor Red
}

function Write-WARN {
    param([string]$Text)
    Write-Host "  ⚠ $Text" -ForegroundColor Yellow
    $GLOBAL:Warnings += $Text
}

function Write-INFO {
    param([string]$Text)
    Write-Host "  → $Text" -ForegroundColor Cyan
}

function Confirm-Continue {
    param([string]$Message = "Continuar?")
    if ($AutoFix) { return $true }
    $response = Read-Host "$Message (S/N)"
    return $response -match '^[Ss]$'
}

function Test-Port {
    param([int]$Port, [int]$TimeoutMs = 2000)
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $result = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        $success = $result.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
        if ($success) { $client.Close() }
        return $success
    } catch { return $false }
}

function Test-HttpEndpoint {
    param([string]$Url, [int]$TimeoutSec = 5)
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec $TimeoutSec -UseBasicParsing -ErrorAction Stop
        return @{ Success = $true; StatusCode = $response.StatusCode; Content = $response.Content }
    } catch {
        return @{ Success = $false; StatusCode = $_.Exception.Response.StatusCode.value__; Error = $_.Exception.Message }
    }
}

function Backup-CriticalFiles {
    param([string]$BackupPath)

    Write-INFO "Criando backup em: $BackupPath"
    New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null

    $filesToBackup = @(
        $CONFIG.LunaScheduler
        $CONFIG.LunaAgentMJS
        $CONFIG.LunaAgentCJS
        $CONFIG.LunaDaemon
        $CONFIG.LunaRules
        $CONFIG.LunaBuffer
        $CONFIG.LunaCheckpoint
        $CONFIG.WhatsAppCheckpoint
        "$($CONFIG.BackendServer).backup"
    )

    foreach ($file in $filesToBackup) {
        if (Test-Path $file) {
            $dest = Join-Path $BackupPath (Split-Path $file -Leaf)
            Copy-Item $file $dest -Force
            Write-OK "Backup: $(Split-Path $file -Leaf)"
        }
    }

    # Backup do chrome profile (se existir)
    if (Test-Path $CONFIG.ChromeProfile) {
        $chromeBackup = Join-Path $BackupPath "chrome-profile"
        robocopy $CONFIG.ChromeProfile $chromeBackup /E /R:1 /W:1 /NJH /NJS /NDL /NC /NS | Out-Null
        Write-OK "Backup: Chrome profile"
    }

    Write-OK "Backup completo em: $BackupPath"
    return $BackupPath
}

# ═══════════════════════════════════════════════════════════════════════════════
# SEÇÃO 2: FASE 1 — DIAGNÓSTICO COMPLETO DO SISTEMA
# ═══════════════════════════════════════════════════════════════════════════════

function Start-Diagnosis {
    Write-Banner "FASE 1: DIAGNÓSTICO COMPLETO DO SISTEMA" "Magenta"

    # 2.1 Verificar Node.js
    Write-Step 1 "Verificando Node.js"
    try {
        $nodeVersion = (node --version) -replace 'v',''
        $ver = [Version]$nodeVersion
        Write-INFO "Node.js detectado: v$nodeVersion"

        if ($ver -ge $CONFIG.NodeMinVersion -and $ver -le $CONFIG.NodeMaxTested) {
            Write-OK "Versão compatível (v$nodeVersion)"
            $GLOBAL:DiagStatus.NodeVersionOK = $true
        } elseif ($ver -gt $CONFIG.NodeMaxTested) {
            Write-WARN "Node.js v$nodeVersion > v$($CONFIG.NodeMaxTested) — pode haver incompatibilidades ESM/CJS"
            Write-INFO "Node.js v24+ exige extensões explícitas em imports ESM [^1^][^4^]"
            $GLOBAL:DiagStatus.NodeVersionOK = $true  # Continuar com cautela
        } else {
            Write-FAIL "Node.js v$nodeVersion < v$($CONFIG.NodeMinVersion) — REQUER ATUALIZAÇÃO"
            $GLOBAL:DiagStatus.NodeVersionOK = $false
        }
    } catch {
        Write-FAIL "Node.js não encontrado no PATH!"
        $GLOBAL:DiagStatus.NodeVersionOK = $false
    }

    # 2.2 Verificar estrutura do projeto
    Write-Step 2 "Verificando estrutura do projeto"
    $criticalPaths = @(
        $CONFIG.ProjectPath
        $CONFIG.BackendServer
        $CONFIG.AgentsDir
        $CONFIG.DataDir
    )
    foreach ($path in $criticalPaths) {
        if (Test-Path $path) {
            Write-OK "Existe: $(Split-Path $path -Leaf)"
        } else {
            Write-FAIL "FALTANDO: $path"
        }
    }

    # 2.3 Verificar arquivos críticos dos agentes
    Write-Step 3 "Verificando arquivos dos agentes Luna"
    $agentFiles = @{
        "luna-scheduler.mjs"      = $CONFIG.LunaScheduler
        "luna-cto-agent.mjs"    = $CONFIG.LunaAgentMJS
        "luna-cto-agent.cjs"    = $CONFIG.LunaAgentCJS
        "luna-daemon.mjs"       = $CONFIG.LunaDaemon
        "LUNA-RULES.md"         = $CONFIG.LunaRules
    }

    foreach ($name in $agentFiles.Keys) {
        $path = $agentFiles[$name]
        if (Test-Path $path) {
            $size = (Get-Item $path).Length
            Write-OK "$name ($size bytes)"
            if ($name -eq "luna-cto-agent.mjs" -and $size -lt 1000) {
                Write-WARN "$name está muito pequeno ($size bytes) — possível corrompimento!"
            }
        } else {
            Write-FAIL "$name NÃO ENCONTRADO!"
        }
    }

    # 2.4 Verificar sintaxe dos arquivos principais
    Write-Step 4 "Verificando sintaxe Node.js"
    $syntaxFiles = @($CONFIG.LunaScheduler, $CONFIG.LunaDaemon, $CONFIG.LunaAgentCJS)
    foreach ($file in $syntaxFiles) {
        if (Test-Path $file) {
            try {
                $result = node --check $file 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-OK "Sintaxe OK: $(Split-Path $file -Leaf)"
                } else {
                    Write-FAIL "Erro de sintaxe em $(Split-Path $file -Leaf): $result"
                }
            } catch {
                Write-FAIL "Falha ao verificar $(Split-Path $file -Leaf): $_"
            }
        }
    }

    # 2.5 Testar import ESM do luna-cto-agent.mjs (TESTE CRÍTICO)
    Write-Step 5 "TESTE CRÍTICO: Import ESM do luna-cto-agent"
    Write-INFO "Este é o teste que falha no seu sistema atual..."

    try {
        # Criar script temporário de teste
        $testScript = @"
import { runAgent } from './agents/luna-cto-agent.mjs';
console.log('IMPORT_OK');
"@
        $testPath = Join-Path $CONFIG.ProjectPath "test-import.mjs"
        $testScript | Out-File -FilePath $testPath -Encoding UTF8 -Force

        Push-Location $CONFIG.ProjectPath
        $result = node $testPath 2>&1
        Pop-Location
        Remove-Item $testPath -Force -ErrorAction SilentlyContinue

        if ($result -match "IMPORT_OK") {
            Write-OK "Import ESM funciona corretamente!"
            $GLOBAL:DiagStatus.LunaAgentImportOK = $true
        } elseif ($result -match "ERR_MODULE_NOT_FOUND") {
            Write-FAIL "ERR_MODULE_NOT_FOUND — Problema confirmado!"
            Write-INFO "Detalhes: $result"
            $GLOBAL:DiagStatus.LunaAgentImportOK = $false
        } else {
            Write-WARN "Resultado inesperado: $result"
            $GLOBAL:DiagStatus.LunaAgentImportOK = $false
        }
    } catch {
        Write-FAIL "Falha no teste de import: $_"
        $GLOBAL:DiagStatus.LunaAgentImportOK = $false
    }

    # 2.6 Verificar backend rodando
    Write-Step 6 "Verificando backend (porta $($CONFIG.BackendPort))"
    if (Test-Port -Port $CONFIG.BackendPort) {
        Write-OK "Backend respondendo na porta $($CONFIG.BackendPort)"
        $GLOBAL:DiagStatus.BackendRunning = $true

        # Testar endpoint da API
        $apiTest = Test-HttpEndpoint -Url "http://127.0.0.1:$($CONFIG.BackendPort)/api/state"
        if ($apiTest.Success) {
            Write-OK "API /api/state respondendo (HTTP $($apiTest.StatusCode))"
        } else {
            Write-WARN "API /api/state não respondeu — backend pode estar incompleto"
        }
    } else {
        Write-FAIL "Backend NÃO está rodando na porta $($CONFIG.BackendPort)"
        Write-INFO "É necessário iniciar: node backend/server.js"
        $GLOBAL:DiagStatus.BackendRunning = $false
    }

    # 2.7 Verificar Chrome CDP
    Write-Step 7 "Verificando Chrome CDP (porta $($CONFIG.ChromeCdpPort))"
    $cdpPort = $CONFIG.ChromeCdpPort
    if (-not (Test-Port -Port $cdpPort)) {
        $cdpPort = $CONFIG.ChromeCdpFallback
        Write-INFO "Tentando porta fallback: $cdpPort"
    }

    if (Test-Port -Port $cdpPort) {
        Write-OK "Chrome CDP respondendo na porta $cdpPort"
        $GLOBAL:DiagStatus.ChromeCdpRunning = $true

        # Verificar se é realmente o Chrome
        try {
            $cdpInfo = Invoke-WebRequest -Uri "http://127.0.0.1:$cdpPort/json/version" -UseBasicParsing -TimeoutSec 3
            $cdpJson = $cdpInfo.Content | ConvertFrom-Json
            Write-OK "Chrome v$($cdpJson.Browser) detectado"
        } catch {
            Write-WARN "Porta $cdpPort aberta mas não parece ser Chrome CDP"
        }
    } else {
        Write-FAIL "Chrome CDP NÃO respondendo nas portas testadas"
        Write-INFO "É necessário executar: agents\start-chrome-cdp.bat"
        $GLOBAL:DiagStatus.ChromeCdpRunning = $false
    }

    # 2.8 Verificar dados persistentes
    Write-Step 8 "Verificando arquivos de dados"
    $dataFiles = @($CONFIG.LunaBuffer, $CONFIG.LunaCheckpoint, $CONFIG.WhatsAppCheckpoint)
    $allDataOK = $true
    foreach ($file in $dataFiles) {
        if (Test-Path $file) {
            try {
                $content = Get-Content $file -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
                Write-OK "$(Split-Path $file -Leaf) — JSON válido"
            } catch {
                Write-FAIL "$(Split-Path $file -Leaf) — JSON CORROMPIDO!"
                $allDataOK = $false
            }
        } else {
            Write-WARN "$(Split-Path $file -Leaf) — não existe (será criado)"
        }
    }
    $GLOBAL:DiagStatus.DataFilesOK = $allDataOK

    # 2.9 Verificar Chrome Profile
    Write-Step 9 "Verificando perfil do Chrome (WhatsApp Web)"
    if (Test-Path $CONFIG.ChromeProfile) {
        $profileSize = (Get-ChildItem $CONFIG.ChromeProfile -Recurse -File | Measure-Object -Property Length -Sum).Sum
        $profileSizeMB = [math]::Round($profileSize / 1MB, 2)
        Write-OK "Perfil encontrado ($profileSizeMB MB)"

        # Verificar se tem dados do WhatsApp
        $whatsappIndexedDB = Join-Path $CONFIG.ChromeProfile "Default\IndexedDB\https_web.whatsapp.com_0.indexeddb.leveldb"
        if (Test-Path $whatsappIndexedDB) {
            Write-OK "Dados do WhatsApp Web presentes no perfil"
            $GLOBAL:DiagStatus.ChromeProfileOK = $true
        } else {
            Write-WARN "Dados do WhatsApp Web não encontrados — pode precisar de novo QR code"
            $GLOBAL:DiagStatus.ChromeProfileOK = $true  # Perfil existe, só precisa logar
        }
    } else {
        Write-FAIL "Perfil do Chrome NÃO encontrado!"
        Write-INFO "WhatsApp Web precisará de autenticação nova (QR code)"
        $GLOBAL:DiagStatus.ChromeProfileOK = $false
    }

    # 2.10 Verificar Git
    Write-Step 10 "Verificando repositório Git"
    Push-Location $CONFIG.ProjectPath
    try {
        $gitStatus = git status --short 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-OK "Git repository OK"
            if ($gitStatus) {
                Write-WARN "Há alterações não commitadas:`n$gitStatus"
            }
            $GLOBAL:DiagStatus.GitRepoOK = $true
        } else {
            Write-WARN "Não é um repositório Git ou Git não instalado"
        }
    } catch {
        Write-WARN "Git não disponível"
    }
    Pop-Location

    # 2.11 Resumo do diagnóstico
    Write-Banner "RESUMO DO DIAGNÓSTICO" "Yellow"

    $totalTests = $GLOBAL:DiagStatus.Count
    $passedTests = ($GLOBAL:DiagStatus.Values | Where-Object { $_ -eq $true }).Count

    Write-Host "  Testes passados: $passedTests/$totalTests" -ForegroundColor $(if ($passedTests -eq $totalTests) { "Green" } else { "Yellow" })
    Write-Host ""

    foreach ($key in $GLOBAL:DiagStatus.Keys | Sort-Object) {
        $status = $GLOBAL:DiagStatus[$key]
        $icon = if ($status) { "✓" } else { "✗" }
        $color = if ($status) { "Green" } else { "Red" }
        $label = switch ($key) {
            "BackendRunning"     { "Backend rodando" }
            "ChromeCdpRunning"   { "Chrome CDP ativo" }
            "NodeVersionOK"      { "Node.js versão" }
            "LunaAgentImportOK"  { "Import ESM Luna" }
            "SchedulerFileOK"    { "Arquivo scheduler" }
            "DaemonFileOK"       { "Arquivo daemon" }
            "DataFilesOK"        { "Arquivos de dados" }
            "ChromeProfileOK"    { "Perfil Chrome" }
            "GitRepoOK"          { "Repositório Git" }
            "AllCriticalOK"      { "Todos críticos OK" }
        }
        Write-Host "  $icon $label" -ForegroundColor $color
    }

    # Determinar se todos os críticos estão OK
    $critical = @("NodeVersionOK", "LunaAgentImportOK", "DataFilesOK")
    $GLOBAL:DiagStatus.AllCriticalOK = ($critical | ForEach-Object { $GLOBAL:DiagStatus[$_] }) -notcontains $false

    if ($GLOBAL:DiagStatus.AllCriticalOK -and $GLOBAL:DiagStatus.BackendRunning -and $GLOBAL:DiagStatus.ChromeCdpRunning) {
        Write-Host "`n  🎉 SISTEMA OPERACIONAL! Nenhuma correção necessária." -ForegroundColor Green
        return $true
    } else {
        Write-Host "`n  🔧 CORREÇÕES NECESSÁRIAS detectadas." -ForegroundColor Yellow
        return $false
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# SEÇÃO 3: FASE 2 — CORREÇÃO DO ERRO ESM (P0)
# ═══════════════════════════════════════════════════════════════════════════════

function Fix-ESMImportError {
    Write-Banner "FASE 2: CORREÇÃO DO ERRO ESM (P0 — CRÍTICO)" "Red"

    Write-INFO "Problema: Node.js v24+ exige extensões explícitas em imports ESM"
    Write-INFO "O luna-scheduler.mjs importa './luna-cto-agent.mjs' que é um wrapper"
    Write-INFO "O wrapper importa do .cjs usando 'import from' que pode falhar"
    Write-INFO "Solução: Reescrever o wrapper .mjs com createRequire para compatibilidade"

    if (-not (Confirm-Continue "Prosseguir com correção do import ESM?")) {
        Write-WARN "Correção pulada pelo usuário"
        return $false
    }

    # 3.1 Verificar o conteúdo atual do wrapper
    Write-Step 1 "Analisando luna-cto-agent.mjs atual"
    if (Test-Path $CONFIG.LunaAgentMJS) {
        $currentContent = Get-Content $CONFIG.LunaAgentMJS -Raw
        Write-INFO "Conteúdo atual ($((Get-Item $CONFIG.LunaAgentMJS).Length bytes):"
        Write-Host $currentContent -ForegroundColor DarkGray

        if ($currentContent -match "createRequire") {
            Write-WARN "Arquivo já parece ter createRequire — verificar se está correto"
        }
    }

    # 3.2 Criar o novo wrapper ESM compatível com Node.js v24+
    Write-Step 2 "Criando novo wrapper ESM compatível"

    $newWrapper = @'
/**
 * NEXO Luna CTO Agent — Wrapper ESM v2.0
 * Compatível com Node.js v18+ incluindo v24+
 * Usa createRequire para interoperabilidade ESM/CJS robusta
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// createRequire permite importar CJS de forma síncrona dentro de ESM
const require = createRequire(import.meta.url);

// Importa o engine CJS real
const lunaModule = require('./luna-cto-agent.cjs');

// Extrai as exportações
const { LunaAgent, runAgent, diagnose, CONFIG } = lunaModule;

// Re-exporta para ESM
export { LunaAgent, runAgent, diagnose, CONFIG };
export default LunaAgent;

// Log de inicialização para debug
if (process.env.LUNA_DEBUG) {
    console.log('[LunaWrapper] ESM wrapper carregado com createRequire');
    console.log('[LunaWrapper] Node.js:', process.version);
    console.log('[LunaWrapper] Exports disponíveis:', Object.keys(lunaModule).join(', '));
}
'@

    # Backup do arquivo original
    $backupFile = "$($CONFIG.LunaAgentMJS).backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $CONFIG.LunaAgentMJS $backupFile -Force
    Write-OK "Backup criado: $backupFile"

    # Escrever novo wrapper
    $newWrapper | Out-File -FilePath $CONFIG.LunaAgentMJS -Encoding UTF8 -Force
    Write-OK "Novo wrapper ESM escrito ($($newWrapper.Length) chars)"

    # 3.3 Verificar sintaxe do novo wrapper
    Write-Step 3 "Verificando sintaxe do novo wrapper"
    try {
        $checkResult = node --check $CONFIG.LunaAgentMJS 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-OK "Sintaxe do novo wrapper OK"
        } else {
            Write-FAIL "Erro de sintaxe no novo wrapper: $checkResult"
            Write-INFO "Restaurando backup..."
            Copy-Item $backupFile $CONFIG.LunaAgentMJS -Force
            return $false
        }
    } catch {
        Write-FAIL "Falha na verificação de sintaxe: $_"
        return $false
    }

    # 3.4 Testar o import novamente
    Write-Step 4 "Testando import ESM após correção"
    $testScript = @"
import { runAgent, LunaAgent, CONFIG } from './agents/luna-cto-agent.mjs';
console.log('IMPORT_OK');
console.log('Exports:', Object.keys({ runAgent, LunaAgent, CONFIG }).join(', '));
"@
    $testPath = Join-Path $CONFIG.ProjectPath "test-import-v2.mjs"
    $testScript | Out-File -FilePath $testPath -Encoding UTF8 -Force

    try {
        Push-Location $CONFIG.ProjectPath
        $result = node $testPath 2>&1
        Pop-Location

        if ($result -match "IMPORT_OK") {
            Write-OK "✅ IMPORT ESM FUNCIONANDO!"
            Write-INFO "Resultado: $result"
            $GLOBAL:DiagStatus.LunaAgentImportOK = $true
            $GLOBAL:FixesApplied += "ESM Import Fix: Reescrito luna-cto-agent.mjs com createRequire"
        } else {
            Write-FAIL "Import ainda falha: $result"
            # Tentar diagnóstico adicional
            Write-INFO "Tentando import direto do .cjs..."
            $directTest = @"
const m = require('./agents/luna-cto-agent.cjs');
console.log('DIRECT_CJS_OK:', Object.keys(m).join(', '));
"@
            $directPath = Join-Path $CONFIG.ProjectPath "test-direct.cjs"
            $directTest | Out-File -FilePath $directPath -Encoding UTF8 -Force
            $directResult = node $directPath 2>&1
            Remove-Item $directPath -Force
            Write-INFO "Resultado direto CJS: $directResult"
        }
    } catch {
        Write-FAIL "Falha no teste pós-correção: $_"
    } finally {
        Remove-Item $testPath -Force -ErrorAction SilentlyContinue
    }

    # 3.5 Verificar se o luna-scheduler.mjs também precisa de ajustes
    Write-Step 5 "Verificando luna-scheduler.mjs"
    $schedulerContent = Get-Content $CONFIG.LunaScheduler -Raw

    if ($schedulerContent -match "from\s+'\.\/luna-cto-agent\.mjs'") {
        Write-OK "Scheduler importa .mjs corretamente"
    } elseif ($schedulerContent -match "from\s+'\.\/luna-cto-agent'") {
        Write-WARN "Scheduler importa sem extensão — corrigindo..."
        $fixedScheduler = $schedulerContent -replace "from\s+'\.\/luna-cto-agent'", "from './luna-cto-agent.mjs'"
        $fixedScheduler | Out-File -FilePath $CONFIG.LunaScheduler -Encoding UTF8 -Force
        Write-OK "Scheduler corrigido com extensão .mjs"
        $GLOBAL:FixesApplied += "Scheduler Fix: Adicionada extensão .mjs no import"
    }

    return $GLOBAL:DiagStatus.LunaAgentImportOK
}

# ═══════════════════════════════════════════════════════════════════════════════
# SEÇÃO 4: FASE 3 — CORREÇÃO DO BACKEND (P0)
# ═══════════════════════════════════════════════════════════════════════════════

function Fix-Backend {
    Write-Banner "FASE 3: CORREÇÃO/INICIALIZAÇÃO DO BACKEND" "Red"

    if ($GLOBAL:DiagStatus.BackendRunning) {
        Write-OK "Backend já está rodando — nenhuma ação necessária"
        return $true
    }

    Write-INFO "O backend Express.js precisa estar rodando na porta $($CONFIG.BackendPort)"
    Write-INFO "Ele serve a API para os agentes e o frontend"

    if (-not (Confirm-Continue "Iniciar o backend agora?")) {
        Write-WARN "Inicialização do backend pulada"
        return $false
    }

    # 4.1 Verificar dependências do backend
    Write-Step 1 "Verificando dependências do backend"
    $backendPackageJson = Join-Path (Split-Path $CONFIG.BackendServer) "package.json"
    if (Test-Path $backendPackageJson) {
        Write-OK "package.json do backend encontrado"
        $backendNodeModules = Join-Path (Split-Path $CONFIG.BackendServer) "node_modules"
        if (-not (Test-Path $backendNodeModules)) {
            Write-WARN "node_modules não encontrado — instalando dependências..."
            Push-Location (Split-Path $CONFIG.BackendServer)
            try {
                npm install 2>&1 | ForEach-Object { Write-INFO $_ }
                Write-OK "Dependências instaladas"
            } catch {
                Write-FAIL "Falha ao instalar dependências: $_"
                Pop-Location
                return $false
            }
            Pop-Location
        } else {
            Write-OK "node_modules presente"
        }
    }

    # 4.2 Verificar se a porta está livre
    Write-Step 2 "Verificando porta $($CONFIG.BackendPort)"
    if (Test-Port -Port $CONFIG.BackendPort) {
        Write-WARN "Porta $($CONFIG.BackendPort) já está em uso!"
        Write-INFO "Verificando se é o backend NEXO..."
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:$($CONFIG.BackendPort)/api/state" -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -eq 200) {
                Write-OK "Porta em uso pelo backend NEXO — OK"
                $GLOBAL:DiagStatus.BackendRunning = $true
                return $true
            }
        } catch {
            Write-FAIL "Porta em uso por outro processo!"
            Write-INFO "Processo na porta:"
            Get-NetTCPConnection -LocalPort $CONFIG.BackendPort -ErrorAction SilentlyContinue | 
                Select-Object LocalPort, OwningProcess, @{N='ProcessName';E={(Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName}}
            return $false
        }
    } else {
        Write-OK "Porta $($CONFIG.BackendPort) livre"
    }

    # 4.3 Iniciar o backend
    Write-Step 3 "Iniciando backend"
    Write-INFO "Comando: node $($CONFIG.BackendServer)"
    Write-INFO "Isso abrirá uma nova janela do PowerShell..."

    try {
        $backendDir = Split-Path $CONFIG.BackendServer
        $serverFile = Split-Path $CONFIG.BackendServer -Leaf

        # Iniciar em nova janela para não bloquear
        Start-Process powershell -ArgumentList @(
            "-NoExit",
            "-Command",
            "cd '$backendDir'; Write-Host '=== NEXO BACKEND ===' -ForegroundColor Green; node '$serverFile'"
        ) -WindowStyle Normal

        Write-OK "Backend iniciado em nova janela"
        Write-INFO "Aguardando 3 segundos para inicialização..."
        Start-Sleep -Seconds 3

        # Verificar se subiu
        if (Test-Port -Port $CONFIG.BackendPort) {
            Write-OK "✅ Backend confirmado rodando na porta $($CONFIG.BackendPort)!"
            $GLOBAL:DiagStatus.BackendRunning = $true
            $GLOBAL:FixesApplied += "Backend: Iniciado na porta $($CONFIG.BackendPort)"
            return $true
        } else {
            Write-WARN "Backend iniciado mas porta não responde ainda"
            Write-INFO "Aguarde mais alguns segundos e verifique manualmente"
            return $true  # Assume sucesso, usuário verificará
        }
    } catch {
        Write-FAIL "Falha ao iniciar backend: $_"
        return $false
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# SEÇÃO 5: FASE 4 — CORREÇÃO DO CHROME CDP (P0)
# ═══════════════════════════════════════════════════════════════════════════════

function Fix-ChromeCDP {
    Write-Banner "FASE 4: CORREÇÃO/INICIALIZAÇÃO DO CHROME CDP" "Red"

    if ($GLOBAL:DiagStatus.ChromeCdpRunning) {
        Write-OK "Chrome CDP já ativo — nenhuma ação necessária"
        return $true
    }

    Write-INFO "O Chrome precisa rodar com --remote-debugging-port=$($CONFIG.ChromeCdpPort)"
    Write-INFO "Isso permite que o Playwright se conecte e controle o WhatsApp Web"

    if (-not (Confirm-Continue "Iniciar Chrome com CDP agora?")) {
        Write-WARN "Inicialização do Chrome pulada"
        return $false
    }

    # 5.1 Verificar se o script start-chrome-cdp.bat existe
    Write-Step 1 "Verificando script de inicialização"
    $batFile = $CONFIG.StartChromeBat
    if (-not (Test-Path $batFile)) {
        Write-WARN "$batFile não encontrado — criando..."

        $batContent = @"
@echo off
chcp 65001 >nul
echo ==========================================
echo   NEXO Chrome CDP Launcher
echo   Porta: $($CONFIG.ChromeCdpPort)
echo   Perfil: $($CONFIG.ChromeProfile)
echo ==========================================

set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
set PROFILE_PATH=$($CONFIG.ChromeProfile)
set CDP_PORT=$($CONFIG.ChromeCdpPort)

if not exist "%CHROME_PATH%" (
    echo Chrome nao encontrado no path padrao!
    echo Tentando path alternativo...
    set CHROME_PATH=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe
)

if not exist "%CHROME_PATH%" (
    echo ERRO: Google Chrome nao encontrado!
    echo Instale o Chrome ou ajuste o path no script.
    pause
    exit /b 1
)

echo Iniciando Chrome com CDP na porta %CDP_PORT%...
echo Perfil: %PROFILE_PATH%

"%CHROME_PATH%" ^
    --remote-debugging-port=%CDP_PORT% ^
    --user-data-dir="%PROFILE_PATH%" ^
    --no-first-run ^
    --no-default-browser-check ^
    --disable-blink-features=AutomationControlled ^
    https://web.whatsapp.com

echo.
echo Chrome iniciado! CDP disponivel em: http://127.0.0.1:%CDP_PORT%
pause
"@
        $batContent | Out-File -FilePath $batFile -Encoding UTF8 -Force
        Write-OK "Script criado: $batFile"
    } else {
        Write-OK "Script encontrado: $batFile"
    }

    # 5.2 Verificar se Chrome está instalado
    Write-Step 2 "Verificando Google Chrome"
    $chromePaths = @(
        "C:\Program Files\Google\Chrome\Application\chrome.exe"
        "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    )
    $chromeFound = $false
    foreach ($path in $chromePaths) {
        if (Test-Path $path) {
            Write-OK "Chrome encontrado: $path"
            $chromeFound = $true
            break
        }
    }
    if (-not $chromeFound) {
        Write-FAIL "Google Chrome não encontrado!"
        Write-INFO "Instale o Chrome: https://www.google.com/chrome/"
        return $false
    }

    # 5.3 Verificar/criar perfil do Chrome
    Write-Step 3 "Verificando perfil do Chrome"
    if (-not (Test-Path $CONFIG.ChromeProfile)) {
        Write-WARN "Perfil não existe — criando..."
        New-Item -ItemType Directory -Path $CONFIG.ChromeProfile -Force | Out-Null
        Write-OK "Perfil criado: $($CONFIG.ChromeProfile)"
        Write-WARN "⚠️  WhatsApp Web precisará de autenticação nova (QR code)"
    } else {
        Write-OK "Perfil existe: $($CONFIG.ChromeProfile)"
    }

    # 5.4 Iniciar Chrome com CDP
    Write-Step 4 "Iniciando Chrome com CDP"
    Write-INFO "Isso abrirá o Chrome com WhatsApp Web..."

    try {
        Start-Process $batFile
        Write-OK "Chrome iniciado!"
        Write-INFO "Aguardando 5 segundos para inicialização..."
        Start-Sleep -Seconds 5

        # Verificar CDP
        $attempts = 0
        $maxAttempts = 10
        while ($attempts -lt $maxAttempts) {
            if (Test-Port -Port $CONFIG.ChromeCdpPort) {
                Write-OK "✅ Chrome CDP confirmado na porta $($CONFIG.ChromeCdpPort)!"
                $GLOBAL:DiagStatus.ChromeCdpRunning = $true
                $GLOBAL:FixesApplied += "Chrome CDP: Iniciado na porta $($CONFIG.ChromeCdpPort)"
                return $true
            }
            $attempts++
            Write-INFO "Tentativa $attempts/$maxAttempts..."
            Start-Sleep -Seconds 2
        }

        Write-WARN "Chrome iniciado mas CDP não confirmado após $maxAttempts tentativas"
        Write-INFO "Verifique manualmente se o Chrome abriu e está na web.whatsapp.com"
        return $true  # Assume sucesso parcial
    } catch {
        Write-FAIL "Falha ao iniciar Chrome: $_"
        return $false
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# SEÇÃO 6: FASE 5 — CORREÇÃO DE DADOS CORROMPIDOS (P1)
# ═══════════════════════════════════════════════════════════════════════════════

function Fix-DataFiles {
    Write-Banner "FASE 5: CORREÇÃO DE ARQUIVOS DE DADOS" "Yellow"

    if ($GLOBAL:DiagStatus.DataFilesOK) {
        Write-OK "Todos os arquivos de dados estão OK"
        return $true
    }

    Write-INFO "Verificando e corrigindo JSONs do Luna..."

    $filesToCheck = @{
        $CONFIG.LunaBuffer         = @{ required = $false; template = @{ msgs = @(); tasks = @(); ideas = @(); decisions = @(); links = @(); mentions = @(); newMessages = @(); silence = 0; lastUpdate = (Get-Date -Format "o") } }
        $CONFIG.LunaCheckpoint     = @{ required = $false; template = @{ lastScan = (Get-Date -Format "o"); hashes = @(); processed = 0; silence = 0; version = "v10.2"; lastRun = (Get-Date -Format "o"); knownMessageHashes = @(); totalMessagesSeen = 0; lastReportHadNews = $false; lastReportTime = $null; silenceCount = 0; engine = "hybrid" } }
        $CONFIG.WhatsAppCheckpoint = @{ required = $false; template = @{ version = "v4"; lastRun = (Get-Date -Format "o"); groups = @{}; totalMessagesSeen = 0; knownMessageHashes = @() } }
    }

    foreach ($filePath in $filesToCheck.Keys) {
        $config = $filesToCheck[$filePath]
        $fileName = Split-Path $filePath -Leaf

        if (Test-Path $filePath) {
            try {
                $content = Get-Content $filePath -Raw | ConvertFrom-Json -ErrorAction Stop
                Write-OK "$fileName — JSON válido"
            } catch {
                Write-FAIL "$fileName — JSON corrompido!"
                if (Confirm-Continue "Recriar $fileName com template padrão?") {
                    $config.template | ConvertTo-Json -Depth 10 | Out-File -FilePath $filePath -Encoding UTF8 -Force
                    Write-OK "$fileName recriado com template padrão"
                    $GLOBAL:FixesApplied += "Data Fix: Recriado $fileName"
                }
            }
        } else {
            Write-WARN "$fileName — não existe"
            if ($config.required -or (Confirm-Continue "Criar $fileName?")) {
                $config.template | ConvertTo-Json -Depth 10 | Out-File -FilePath $filePath -Encoding UTF8 -Force
                Write-OK "$fileName criado"
                $GLOBAL:FixesApplied += "Data Fix: Criado $fileName"
            }
        }
    }

    return $true
}

# ═══════════════════════════════════════════════════════════════════════════════
# SEÇÃO 7: FASE 6 — CORREÇÃO DE ENCODING E LOGS (P2)
# ═══════════════════════════════════════════════════════════════════════════════

function Fix-EncodingAndLogs {
    Write-Banner "FASE 6: CORREÇÃO DE ENCODING E LIMPEZA DE LOGS" "Yellow"

    # 7.1 Verificar encoding dos arquivos principais
    Write-Step 1 "Verificando encoding UTF-8"
    $filesToCheck = @($CONFIG.LunaScheduler, $CONFIG.LunaAgentMJS, $CONFIG.LunaDaemon)
    foreach ($file in $filesToCheck) {
        if (Test-Path $file) {
            $bytes = [System.IO.File]::ReadAllBytes($file)
            # Verificar BOM UTF-8
            $hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
            if ($hasBom) {
                Write-OK "$(Split-Path $file -Leaf) — UTF-8 com BOM"
            } else {
                Write-INFO "$(Split-Path $file -Leaf) — UTF-8 sem BOM (OK)"
            }
        }
    }

    # 7.2 Limpar logs antigos (manter últimos 7 dias)
    Write-Step 2 "Gerenciando logs"
    $logFiles = @($CONFIG.DaemonLog, $CONFIG.SchedulerLog, $CONFIG.SchedulerErrLog)
    foreach ($log in $logFiles) {
        if (Test-Path $log) {
            $logSize = (Get-Item $log).Length
            $logSizeMB = [math]::Round($logSize / 1MB, 2)
            if ($logSizeMB -gt 10) {
                Write-WARN "$(Split-Path $log -Leaf) muito grande ($logSizeMB MB) — arquivando..."
                $archiveName = "$log.archive-$(Get-Date -Format 'yyyyMMdd')"
                Move-Item $log $archiveName -Force
                Write-OK "Log arquivado: $archiveName"
                $GLOBAL:FixesApplied += "Log: Arquivado $(Split-Path $log -Leaf) ($logSizeMB MB)"
            } else {
                Write-OK "$(Split-Path $log -Leaf) — $logSizeMB MB"
            }
        }
    }

    # 7.3 Limpar arquivos temporários
    Write-Step 3 "Limpando arquivos temporários"
    $tempPatterns = @("*.tmp", "*.log.old", "test-*.mjs", "test-*.cjs")
    $cleaned = 0
    foreach ($pattern in $tempPatterns) {
        Get-ChildItem $CONFIG.ProjectPath -Filter $pattern -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
            Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
            $cleaned++
        }
    }
    if ($cleaned -gt 0) {
        Write-OK "$cleaned arquivos temporários removidos"
    }

    return $true
}

# ═══════════════════════════════════════════════════════════════════════════════
# SEÇÃO 8: FASE 7 — TESTE INTEGRADO FINAL
# ═══════════════════════════════════════════════════════════════════════════════

function Start-IntegrationTest {
    Write-Banner "FASE 7: TESTE INTEGRADO FINAL" "Green"

    Write-INFO "Executando teste completo do sistema..."

    # 8.1 Testar backend
    Write-Step 1 "Testando Backend API"
    if (Test-Port -Port $CONFIG.BackendPort) {
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:$($CONFIG.BackendPort)/api/state" -UseBasicParsing -TimeoutSec 5
            $state = $response.Content | ConvertFrom-Json
            Write-OK "Backend API respondendo"
            Write-INFO "Clientes: $($state.clients.Count) | Predições: $($state.predictions.Count)"
        } catch {
            Write-WARN "Backend na porta mas API /api/state falhou"
        }
    } else {
        Write-FAIL "Backend não responde"
    }

    # 8.2 Testar import do agente
    Write-Step 2 "Testando Import do Agente"
    $testPath = Join-Path $CONFIG.ProjectPath "final-test.mjs"
    @"
import { runAgent, LunaAgent, CONFIG } from './agents/luna-cto-agent.mjs';
console.log('✅ IMPORT FINAL OK');
console.log('Versão Luna:', CONFIG?.version || 'unknown');
"@ | Out-File -FilePath $testPath -Encoding UTF8 -Force

    try {
        Push-Location $CONFIG.ProjectPath
        $result = node $testPath 2>&1
        Pop-Location
        if ($result -match "IMPORT FINAL OK") {
            Write-OK "Import do agente funcionando!"
        } else {
            Write-FAIL "Import do agente ainda falha: $result"
        }
    } catch {
        Write-FAIL "Teste de import falhou: $_"
    } finally {
        Remove-Item $testPath -Force -ErrorAction SilentlyContinue
    }

    # 8.3 Testar Chrome CDP
    Write-Step 3 "Testando Chrome CDP"
    if (Test-Port -Port $CONFIG.ChromeCdpPort) {
        try {
            $cdp = Invoke-WebRequest -Uri "http://127.0.0.1:$($CONFIG.ChromeCdpPort)/json/version" -UseBasicParsing -TimeoutSec 3
            $cdpJson = $cdp.Content | ConvertFrom-Json
            Write-OK "Chrome CDP v$($cdpJson.Browser)"

            # Listar páginas abertas
            $pages = Invoke-WebRequest -Uri "http://127.0.0.1:$($CONFIG.ChromeCdpPort)/json/list" -UseBasicParsing -TimeoutSec 3
            $pagesJson = $pages.Content | ConvertFrom-Json
            $whatsappPage = $pagesJson | Where-Object { $_.url -match "web.whatsapp.com" }
            if ($whatsappPage) {
                Write-OK "WhatsApp Web encontrado no Chrome!"
            } else {
                Write-WARN "WhatsApp Web não encontrado — navegue para web.whatsapp.com"
            }
        } catch {
            Write-WARN "CDP responde mas não conseguiu listar páginas"
        }
    } else {
        Write-FAIL "Chrome CDP não responde"
    }

    # 8.4 Resumo final
    Write-Banner "RESULTADO DO TESTE INTEGRADO" $(if ($GLOBAL:DiagStatus.AllCriticalOK) { "Green" } else { "Yellow" })

    $allOK = $GLOBAL:DiagStatus.BackendRunning -and 
             $GLOBAL:DiagStatus.ChromeCdpRunning -and 
             $GLOBAL:DiagStatus.LunaAgentImportOK

    if ($allOK) {
        Write-Host "  🎉 SISTEMA 100% OPERACIONAL!" -ForegroundColor Green
        Write-Host "  Próximo passo: Execute o Luna Daemon" -ForegroundColor Cyan
        Write-Host "  Comando: npm start" -ForegroundColor White
        Write-Host "  Ou: node agents/luna-daemon.mjs" -ForegroundColor White
    } else {
        Write-Host "  ⚠️  SISTEMA PARCIALMENTE FUNCIONAL" -ForegroundColor Yellow
        Write-Host "  Verifique os itens marcados com ✗ acima" -ForegroundColor Yellow
    }

    return $allOK
}

# ═══════════════════════════════════════════════════════════════════════════════
# SEÇÃO 9: FASE 8 — RELATÓRIO E PRÓXIMOS PASSOS
# ═══════════════════════════════════════════════════════════════════════════════

function Show-FinalReport {
    Write-Banner "RELATÓRIO FINAL E PRÓXIMOS PASSOS" "Cyan"

    # 9.1 Resumo das correções
    Write-Step 1 "Correções aplicadas"
    if ($GLOBAL:FixesApplied.Count -eq 0) {
        Write-INFO "Nenhuma correção necessária — sistema já estava OK!"
    } else {
        foreach ($fix in $GLOBAL:FixesApplied) {
            Write-OK $fix
        }
    }

    # 9.2 Warnings
    if ($GLOBAL:Warnings.Count -gt 0) {
        Write-Step 2 "Avisos pendentes"
        foreach ($warn in $GLOBAL:Warnings) {
            Write-WARN $warn
        }
    }

    # 9.3 Próximos passos
    Write-Step 3 "Próximos passos recomendados"

    Write-Host @"

  ┌─────────────────────────────────────────────────────────────────────────┐
  │                    CHECKLIST PÓS-CORREÇÃO                               │
  ├─────────────────────────────────────────────────────────────────────────┤
  │                                                                         │
  │  □ 1. Verificar se Chrome abriu com WhatsApp Web                      │
  │      → Se pedir QR code, escaneie com o celular                        │
  │                                                                         │
  │  □ 2. Iniciar o Luna Daemon (em novo terminal):                       │
  │      cd "$($CONFIG.ProjectPath)"                                       │
  │      npm start                                                         │
  │      # OU: node agents/luna-daemon.mjs                                 │
  │                                                                         │
  │  □ 3. Verificar logs em tempo real:                                   │
  │      Get-Content backend/data/luna-scheduler.log -Tail 20 -Wait        │
  │                                                                         │
  │  □ 4. Testar menção no grupo WhatsApp:                                │
  │      Envie: "@Luna status" no grupo 🏆Production - 2026🙏               │
  │                                                                         │
  │  □ 5. Verificar dashboard no navegador:                               │
  │      http://localhost:$($CONFIG.BackendPort)                             │
  │                                                                         │
  │  □ 6. Commit das correções no Git:                                    │
  │      git add -A                                                        │
  │      git commit -m "fix: Correcao ESM Node.js v24 + sistema Luna"      │
  │      git push                                                          │
  │                                                                         │
  └─────────────────────────────────────────────────────────────────────────┘

"@ -ForegroundColor Cyan

    # 9.4 Comandos de verificação rápida
    Write-Step 4 "Comandos de verificação rápida (copie e cole)"
    Write-Host @"
  # Verificar status do sistema:
  curl http://127.0.0.1:$($CONFIG.BackendPort)/api/state

  # Verificar Chrome CDP:
  curl http://127.0.0.1:$($CONFIG.ChromeCdpPort)/json/version

  # Verificar processos Node.js:
  Get-Process node -ErrorAction SilentlyContinue | Select-Object Id, StartTime, @{N='Runtime';E={(Get-Date)-$_.StartTime}}

  # Verificar portas em uso:
  Get-NetTCPConnection -LocalPort $($CONFIG.BackendPort),$($CONFIG.ChromeCdpPort) -ErrorAction SilentlyContinue | 
      Select-Object LocalPort, OwningProcess, @{N='Name';E={(Get-Process -Id `$_.OwningProcess -ErrorAction SilentlyContinue).Name}}
"@ -ForegroundColor DarkGray

    # 9.5 Backup info
    if (Test-Path $CONFIG.BackupDir) {
        Write-Step 5 "Backup disponível"
        Write-INFO "Se algo der errado, restaure de: $($CONFIG.BackupDir)"
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# SEÇÃO 10: FUNÇÃO PRINCIPAL (MAIN)
# ═══════════════════════════════════════════════════════════════════════════════

function Main {
    Clear-Host
    Write-Banner "NEXO DASHBOARD PRO — SCRIPT MASTER DE CORREÇÃO" "Magenta"

    Write-Host "  Versão: 1.0 | Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
    Write-Host "  Projeto: $ProjectPath" -ForegroundColor DarkGray
    Write-Host "  Modo: $(if ($AutoFix) { 'AUTOMÁTICO' } else { 'INTERATIVO' })" -ForegroundColor DarkGray
    Write-Host "  OnlyDiagnose: $(if ($OnlyDiagnose) { 'SIM' } else { 'NÃO' })" -ForegroundColor DarkGray
    Write-Host ""

    # Validação inicial
    if (-not (Test-Path $CONFIG.ProjectPath)) {
        Write-FAIL "Diretório do projeto não encontrado: $($CONFIG.ProjectPath)"
        Write-INFO "Ajuste o parâmetro -ProjectPath"
        exit 1
    }

    # Criar backup
    if (-not $SkipBackup) {
        $backupPath = Backup-CriticalFiles -BackupPath $CONFIG.BackupDir
    }

    # FASE 1: Diagnóstico
    $systemOK = Start-Diagnosis

    if ($OnlyDiagnose) {
        Write-Banner "MODO DIAGNÓSTICO — NENHUMA CORREÇÃO APLICADA" "Yellow"
        exit 0
    }

    if ($systemOK) {
        Show-FinalReport
        exit 0
    }

    # FASE 2: Correção ESM (se necessário)
    if (-not $GLOBAL:DiagStatus.LunaAgentImportOK) {
        Fix-ESMImportError
    }

    # FASE 3: Backend
    if (-not $GLOBAL:DiagStatus.BackendRunning) {
        Fix-Backend
    }

    # FASE 4: Chrome CDP
    if (-not $GLOBAL:DiagStatus.ChromeCdpRunning) {
        Fix-ChromeCDP
    }

    # FASE 5: Dados
    Fix-DataFiles

    # FASE 6: Encoding
    Fix-EncodingAndLogs

    # FASE 7: Teste integrado
    Start-IntegrationTest

    # FASE 8: Relatório final
    Show-FinalReport

    Write-Banner "SCRIPT CONCLUÍDO" $(if ($GLOBAL:DiagStatus.AllCriticalOK) { "Green" } else { "Yellow" })
}

# ═══════════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

# Tratamento de erros global
trap {
    Write-FAIL "ERRO FATAL: $_"
    Write-INFO "Stack: $($_.ScriptStackTrace)"
    Write-INFO "Linha: $($_.InvocationInfo.ScriptLineNumber)"
    exit 1
}

# Executar
Main
