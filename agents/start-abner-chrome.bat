@echo off
REM Inicia Chrome com perfil ABNER (Profile 1) + CDP para automacao
REM Este perfil JA TEM o WhatsApp Web logado!

echo ==========================================
echo  NEXO - Chrome Abner (Profile 1)
echo  Email: abnergabriel1313@gmail.com
echo  CDP Port: 9222
echo ==========================================
echo.

REM Fecha Chrome se estiver rodando
taskkill /F /IM chrome.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [1/3] Chrome fechado. Iniciando com perfil Abner...

REM Abre Chrome com CDP no perfil do usuario
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --profile-directory="Profile 1" --no-first-run --no-default-browser-check

timeout /t 5 /nobreak >nul

echo [2/3] Chrome iniciado!
echo.
echo [3/3] Verificando CDP...

curl -s http://127.0.0.1:9222/json/version >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] CDP respondendo na porta 9222!
    echo.
    echo Agora voce pode:
    echo  1. Acessar web.whatsapp.com se nao estiver logado
    echo  2. Rodar: node whatsapp-checkpoint-agent.js
) else (
    echo [AVISO] CDP nao respondeu ainda. Aguarde mais alguns segundos...
)

echo.
pause
