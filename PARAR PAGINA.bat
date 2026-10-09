@echo off
rem Apaga la pagina y deja libres los puertos 5190-5199
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort (5190..5199) -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo   Pagina apagada. Puertos libres.
timeout /t 2 >nul
