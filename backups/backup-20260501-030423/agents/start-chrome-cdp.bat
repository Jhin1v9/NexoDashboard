@echo off
REM Inicia Chrome com perfil abnergabriel1313 + CDP para automação

echo 🔧 Iniciando Chrome com CDP na porta 9222...
echo    Perfil: Profile 1 (abnergabriel1313@gmail.com)
echo.

"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --user-data-dir="C:\Users\Administrator\AppData\Local\Google\Chrome\User Data" ^
  --profile-directory="Profile 1" ^
  --no-first-run ^
  --no-default-browser-check ^
  https://web.whatsapp.com

echo.
echo ✅ Chrome iniciado! Aguardando 5 segundos...
timeout /t 5 /nobreak >nul
