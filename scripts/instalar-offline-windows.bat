@echo off
setlocal
title OmniPOS - Instalador Modo Offline
color 0A

echo ========================================================
echo   OMNIPOS - INSTALADOR MODO OFFLINE (SUCURSAL SILVESTRE)
echo ========================================================
echo.
echo Este asistente preparara esta computadora para operar 100%%
echo desconectada de internet durante 1 semana o mas.
echo.
echo Requisitos: Estar conectado temporalmente a los datos de tu celular.
echo.
echo Presiona cualquier tecla para comenzar...
pause >nul

:: Paso 1: Verificar Node.js
echo.
echo [1/5] Verificando Node.js en el sistema...
where node >nul 2>nul
if errorlevel 1 goto :install_node
goto :node_ok

:install_node
echo.
echo [AVISO] Node.js no esta instalado en este equipo.
echo Intentando descargar e instalar Node.js LTS automaticamente...
echo Espera un momento, esto puede tardar unos minutos con datos moviles...

powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host 'Descargando instalador de Node.js...'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi', '$env:TEMP\nodejs_setup.msi'); Write-Host 'Instalando Node.js (por favor espera)...'; Start-Process msiexec.exe -ArgumentList '/i', ('`\"' + $env:TEMP + '\nodejs_setup.msi`\"'), '/passive' -Wait"

set "PATH=%PATH%;%ProgramFiles%\nodejs;%LOCALAPPDATA%\Programs\nodejs"

where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo ========================================================
    echo ERROR: Node.js no se detecto tras la instalacion.
    echo Por favor descarga e instala Node.js manualmente desde:
    echo https://nodejs.org/en/download/
    echo Luego vuelve a ejecutar este archivo.
    echo ========================================================
    goto :fin
)

:node_ok
echo [OK] Node.js detectado:
node -v

:: Paso 2: Preparar carpeta del sistema
echo.
echo [2/5] Verificando archivos del sistema...
set "INSTALL_DIR=%USERPROFILE%\OmniPOS"

if exist "%INSTALL_DIR%\package.json" goto :repo_ready

echo Carpeta del sistema no encontrada. Descargando codigo de OmniPOS desde GitHub...
echo Guardando en: %INSTALL_DIR%

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host 'Descargando paquete de OmniPOS...'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://github.com/Taeyeonss22/omnipos-web/archive/refs/heads/main.zip', '$env:TEMP\omnipos.zip'); Write-Host 'Extrayendo archivos...'; Expand-Archive -Path '$env:TEMP\omnipos.zip' -DestinationPath '$env:TEMP\omnipos_extracted' -Force; Copy-Item -Path '$env:TEMP\omnipos_extracted\omnipos-web-main\*' -Destination '$env:USERPROFILE\OmniPOS' -Recurse -Force; Remove-Item '$env:TEMP\omnipos.zip' -Force; Remove-Item '$env:TEMP\omnipos_extracted' -Recurse -Force"

:repo_ready
cd /d "%INSTALL_DIR%"
if not exist "package.json" (
    echo.
    echo ERROR: No se pudo obtener el codigo de la aplicacion en %INSTALL_DIR%.
    goto :fin
)

:: Copiar catalogo si se encuentra en Descargas o carpeta actual
if exist "%~dp0catalogo_offline.json" (
    echo Copiando catalogo inicial desde %~dp0...
    copy /Y "%~dp0catalogo_offline.json" "%INSTALL_DIR%\catalogo_offline.json" >nul
) else if exist "%USERPROFILE%\Downloads\catalogo_offline.json" (
    echo Copiando catalogo inicial desde Descargas...
    copy /Y "%USERPROFILE%\Downloads\catalogo_offline.json" "%INSTALL_DIR%\catalogo_offline.json" >nul
) else if not exist "%INSTALL_DIR%\catalogo_offline.json" (
    echo Descargando catalogo inicial de la sucursal desde la nube...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://omnipos-web-zeta.vercel.app/api/offline/export?download=1', 'catalogo_offline.json')"
)

:: Paso 3: Configurar base de datos SQLite local
echo.
echo [3/5] Configurando base de datos local SQLite...
if exist "prisma\schema.sqlite.prisma" (
    copy /Y prisma\schema.sqlite.prisma prisma\schema.prisma >nul
)

echo DATABASE_URL="file:./offline.db"> .env
echo DIRECT_URL="file:./offline.db">> .env
echo NEXTAUTH_URL="http://localhost:3000">> .env
echo NEXTAUTH_SECRET="omnipos-offline-secure-key-2026">> .env
echo NEXT_PUBLIC_APP_NAME="OmniPOS Offline - Sucursal Silvestre">> .env

:: Paso 4: Instalar dependencias y preparar base de datos
echo.
echo [4/5] Instalando dependencias de OmniPOS (esto toma 1-2 minutos)...
call npm install --no-audit
if errorlevel 1 (
    echo.
    echo ERROR al ejecutar npm install. Verifica tu conexion a internet.
    goto :fin
)

echo Generando cliente de base de datos...
call npx prisma generate
call npx prisma db push --accept-data-loss

if exist catalogo_offline.json (
    echo Sembrando catalogo offline de productos y usuarios...
    node scripts\seed-offline.js
) else (
    echo [AVISO] catalogo_offline.json no encontrado, se iniciara con base de datos limpia.
)

:: Paso 5: Crear accesos directos en el Escritorio
echo.
echo [5/5] Creando accesos directos en tu Escritorio...
set "DESKTOP=%USERPROFILE%\Desktop"

echo @echo off> "%DESKTOP%\Iniciar OmniPOS.bat"
echo title OmniPOS - Punto de Venta Local>> "%DESKTOP%\Iniciar OmniPOS.bat"
echo color 0B>> "%DESKTOP%\Iniciar OmniPOS.bat"
echo echo Iniciando sistema local en http://localhost:3000 ...>> "%DESKTOP%\Iniciar OmniPOS.bat"
echo cd /d "%INSTALL_DIR%">> "%DESKTOP%\Iniciar OmniPOS.bat"
echo start http://localhost:3000/dashboard/pos>> "%DESKTOP%\Iniciar OmniPOS.bat"
echo npm run dev>> "%DESKTOP%\Iniciar OmniPOS.bat"
echo pause>> "%DESKTOP%\Iniciar OmniPOS.bat"

echo @echo off> "%DESKTOP%\Sincronizar a la Nube.bat"
echo title OmniPOS - Sincronizar Ventas a la Nube>> "%DESKTOP%\Sincronizar a la Nube.bat"
echo color 0E>> "%DESKTOP%\Sincronizar a la Nube.bat"
echo echo Conecta los datos de tu celular a la PC antes de continuar...>> "%DESKTOP%\Sincronizar a la Nube.bat"
echo pause>> "%DESKTOP%\Sincronizar a la Nube.bat"
echo cd /d "%INSTALL_DIR%">> "%DESKTOP%\Sincronizar a la Nube.bat"
echo node scripts\sync-to-cloud.js>> "%DESKTOP%\Sincronizar a la Nube.bat"
echo echo.>> "%DESKTOP%\Sincronizar a la Nube.bat"
echo echo Proceso terminado.>> "%DESKTOP%\Sincronizar a la Nube.bat"
echo pause>> "%DESKTOP%\Sincronizar a la Nube.bat"

echo.
echo ========================================================
echo   ¡INSTALACION COMPLETADA CON EXITO!
echo ========================================================
echo.
echo Se crearon 2 accesos directos en tu Escritorio:
echo 1. "Iniciar OmniPOS.bat"        - Abre tu caja y cobra sin internet.
echo 2. "Sincronizar a la Nube.bat" - Sube ventas cuando haya conexion.
echo.
echo Ya puedes desconectar el celular y dar doble clic en "Iniciar OmniPOS.bat".
echo.

:fin
echo.
echo Presiona cualquier tecla para salir...
pause >nul
