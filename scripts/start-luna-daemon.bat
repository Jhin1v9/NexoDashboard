@echo off
chcp 65001 >nul
title Luna Daemon v10.2
cd /d "C:\Users\Administrator\Documents\NEXO DIGITAL\01_ATIVOS\NEXO_DASHBOARD_PRO"

echo =======================================================================
echo   LUNA DAEMON v10.2
echo   Iniciando servico permanente...
echo =======================================================================
echo.

:: Mata processos antigos do Luna
powershell -Command "Get-Process node | Where-Object { $_.StartTime -gt (Get-Date).AddMinutes(-60) } | Stop-Process -Force -ErrorAction SilentlyContinue"
timeout /t 2 >nul

:: Inicia o daemon
node agents\luna-daemon.mjs

:: Se chegou aqui, o daemon morreu -- reinicia automaticamente
echo.
echo ! Daemon encerrou. Reiniciando em 5 segundos...
timeout /t 5 >nul
start "" "%~f0"
exit
