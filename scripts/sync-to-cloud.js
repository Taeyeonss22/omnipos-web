// Script para subir ventas acumuladas de la sucursal local a la nube de Vercel/Supabase
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CLOUD_URL = process.env.CLOUD_URL || 'https://omnipos-web-zeta.vercel.app';

async function main() {
  console.log(`--- Iniciando sincronización hacia la nube (${CLOUD_URL}) ---`);

  // 1. Obtener sesiones locales
  const sessions = await prisma.cashRegisterSession.findMany();
  // 2. Obtener ventas locales con sus items y pagos
  const sales = await prisma.sale.findMany({
    include: {
      items: true,
      payments: true,
    },
  });
  // 3. Obtener movimientos de caja locales
  const movements = await prisma.cashMovement.findMany();

  console.log(`Datos locales encontrados:`);
  console.log(`- Turnos de caja: ${sessions.length}`);
  console.log(`- Ventas totales: ${sales.length}`);
  console.log(`- Egresos/Ingresos: ${movements.length}`);

  if (sales.length === 0 && sessions.length === 0) {
    console.log('No hay datos nuevos para sincronizar.');
    return;
  }

  // Enviar a la nube
  const res = await fetch(`${CLOUD_URL}/api/offline/sync-up`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessions,
      sales,
      movements,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error en el servidor de la nube (${res.status}): ${errorText}`);
  }

  const result = await res.json();
  console.log('¡Sincronización completada con éxito!');
  console.log(result);
}

main()
  .catch((err) => {
    console.error('Error durante la sincronización:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
