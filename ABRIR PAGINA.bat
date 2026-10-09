@echo off
chcp 65001 >nul
title GeoReplica - no cierres esta ventana mientras presentas
cd /d "%~dp0"

rem 1. Libera el puerto por si quedó algo colgado de antes
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5190 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

rem 2. Comprueba que Node existe
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Falta Node.js en este ordenador. Instalalo desde https://nodejs.org y vuelve a abrir este archivo.
  echo.
  pause
  exit /b 1
)

rem 3. Si no hay version compilada, la genera una vez
if not exist "dist\index.html" (
  echo   Preparando la pagina por primera vez...
  call npm run build
)

rem 4. Arranca y abre el navegador
node servidor.mjs
pause
