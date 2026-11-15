#!/bin/bash
# OmniPOS - Instalador Modo Offline para Mac / Linux
set -e

echo "========================================================"
echo "  OMNIPOS - INSTALADOR MODO OFFLINE (SUCURSAL SIN INTERNET)"
echo "========================================================"
echo ""

# 1. Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js no está instalado."
    echo "Por favor instala Node.js desde https://nodejs.org antes de continuar."
    exit 1
fi
echo "[OK] Node.js $(node -v) detectado."

# 2. Configurar SQLite
echo "[1/4] Configurando base de datos local SQLite..."
cp -f prisma/schema.sqlite.prisma prisma/schema.prisma
cat << 'EOF' > .env
DATABASE_URL="file:./offline.db"
DIRECT_URL="file:./offline.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="omnipos-offline-secure-key-2026"
NEXT_PUBLIC_APP_NAME="OmniPOS Offline"
EOF

# 3. Dependencias
echo "[2/4] Instalando dependencias..."
npm install

# 4. Generar DB y sembrar catálogo
echo "[3/4] Generando base de datos local..."
npx prisma generate
npx prisma db push --accept-data-loss

if [ -f "catalogo_offline.json" ]; then
    echo "Sembrando catálogo..."
    node scripts/seed-offline.js
fi

# 5. Crear lanzador en el Escritorio
DESKTOP="$HOME/Desktop"
cat << 'EOF' > "$DESKTOP/Iniciar OmniPOS Offline.command"
#!/bin/bash
cd "$(dirname "$0")"
cd -P "$(pwd)"
echo "Iniciando OmniPOS Local..."
open http://localhost:3000/dashboard/pos
npm run dev
EOF
chmod +x "$DESKTOP/Iniciar OmniPOS Offline.command"

cat << 'EOF' > "$DESKTOP/Sincronizar a la Nube.command"
#!/bin/bash
cd "$(dirname "$0")"
echo "Conecta tus datos móviles antes de continuar..."
read -p "Presiona ENTER para sincronizar..."
node scripts/sync-to-cloud.js
read -p "Presiona ENTER para salir..."
EOF
chmod +x "$DESKTOP/Sincronizar a la Nube.command"

echo ""
echo "========================================================"
echo "  ¡INSTALACIÓN COMPLETADA CON ÉXITO!"
echo "========================================================"
echo "Acceso directo creado en tu Escritorio: Iniciar OmniPOS Offline.command"
