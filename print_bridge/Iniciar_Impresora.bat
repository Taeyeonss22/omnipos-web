@echo off
echo Iniciando Servidor de Impresion de CRIMEN SANTO...
echo Instalando requerimientos (si es la primera vez)...
call npm install
echo.
echo ==============================================
echo 🖨️  LISTO PARA IMPRIMIR TICKETS
echo ==============================================
node index.js
pause
