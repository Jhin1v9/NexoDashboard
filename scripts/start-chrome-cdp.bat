@echo off
chcp 65001 >nul
:: Chrome CDP para Luna Agent — NUNCA reinicie o Chrome PWA original!
:: Este script lança uma segunda instância do Chrome com perfil COPIADO

set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
set USER_DATA_DIR=C:\Users\Administrator\.luna-chrome-debug
set PROFILE=Luna
set CDP_PORT=9223

:: Verificar se já está rodando
netstat -ano | findstr ":%CDP_PORT%" >nul
if %errorlevel% == 0 (
    echo [Chrome CDP] Ja rodando na porta %CDP_PORT%
    exit /b 0
)

echo [Chrome CDP] Iniciando Chrome com perfil copiado na porta %CDP_PORT%...
start /min %CHROME% --user-data-dir="%USER_DATA_DIR%" --profile-directory=%PROFILE% --remote-debugging-port=%CDP_PORT% --no-first-run --no-default-browser-check --restore-last-session

timeout /t 3 /nobreak >nul
echo [Chrome CDP] Iniciado. WhatsApp Web deve estar logado.
