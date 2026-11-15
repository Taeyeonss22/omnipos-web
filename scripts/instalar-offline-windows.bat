@echo off
chcp 65001 >nul
title OmniPOS - Instalador Modo Offline
color 0A

echo ========================================================
echo   OMNIPOS - INSTALADOR MODO OFFLINE (SUCURSAL SIN INTERNET)
echo ========================================================
echo.
echo Este asistente preparará esta computadora para operar 100%%
echo desconectada de internet durante 1 semana o más.
echo.
echo Requisitos: Estar conectado temporalmente a los datos de tu celular.
echo.
pause

echo.
echo [1/5] Verificando Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [AVISO] Node.js no está instalado en este equipo.
    echo Intentando instalar Node.js automáticamente con winget...
    winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo No se pudo instalar automáticamente. Abriendo el sitio oficial de Node.js...
        start https://nodejs.org/en/download/
        echo Por favor instala Node.js y vuelve a ejecutar este instalador.
        pause
        exit /b 1
    )
)
echo [OK] Node.js detectado correctamente.

echo.
echo [2/5] Configurando base de datos local SQLite...
copy /Y prisma\schema.sqlite.prisma prisma\schema.prisma >nul
(
echo DATABASE_URL="file:./offline.db"
echo DIRECT_URL="file:./offline.db"
echo NEXTAUTH_URL="http://localhost:3000"
echo NEXTAUTH_SECRET="omnipos-offline-secure-key-2026"
echo NEXT_PUBLIC_APP_NAME="OmniPOS Offline"
) > .env

echo.
echo [3/5] Instalando dependencias de la aplicación...
call npm install --no-audit --prefer-offline
if %errorlevel% neq 0 (
    echo Error al instalar dependencias con npm. Verifica la conexión a internet.
    pause
    exit /b 1
)

echo.
echo [4/5] Creando tablas locales y sembrando catálogo...
call npx prisma generate
call npx prisma db push --accept-data-loss

if exist catalogo_offline.json (
    node scripts\seed-offline.js
) else (
    echo [AVISO] No se encontró catalogo_offline.json. Puedes descargarlo desde la web
    echo y colocarlo en esta carpeta, luego ejecutar: node scripts\seed-offline.js
)

echo.
echo [5/5] Creando accesos directos en el Escritorio...
set DESKTOP=%USERPROFILE%\Desktop

(
echo @echo off
echo title OmniPOS - Punto de Venta Local
echo color 0B
echo echo Iniciando sistema local en http://localhost:3000 ...
echo cd /d "%~dp0"
echo start http://localhost:3000/dashboard/pos
echo npm run dev
) > "%DESKTOP%\Iniciar OmniPOS Offline.bat"

(
echo @echo off
echo title OmniPOS - Sincronizar Ventas a la Nube
echo color 0E
echo Conecta el internet de tu celular antes de continuar.
echo pause
echo cd /d "%~dp0"
echo node scripts\sync-to-cloud.js
echo pause
) > "%DESKTOP%\Sincronizar a la Nube.bat"

echo.
echo ========================================================
echo   ¡INSTALACIÓN COMPLETADA CON ÉXITO!
echo ========================================================
echo.
echo Se crearon 2 accesos directos en tu Escritorio:
echo 1. "Iniciar OmniPOS Offline.bat" - Para abrir la caja y cobrar sin internet.
echo 2. "Sincronizar a la Nube.bat"   - Para subir los cortes cuando llegue el internet.
echo.
echo Ya puedes desconectar los datos de tu celular y comenzar a operar.
echo.
pause
start "" "%DESKTOP%\Iniciar OmniPOS Offline.bat"
