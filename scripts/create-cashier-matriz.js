const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Creando usuario de caja para la primera sucursal (Sucursal Matriz)...');

  // 1. Obtener Sucursal Matriz
  const matriz = await prisma.branch.findFirst({
    where: { name: { contains: 'Matriz' } }
  });

  if (!matriz) {
    throw new Error('No se encontró Sucursal Matriz');
  }

  // 2. Obtener rol CASHIER
  const roleCashier = await prisma.role.findUnique({
    where: { name: 'CASHIER' }
  });

  if (!roleCashier) {
    throw new Error('No se encontró el rol CASHIER');
  }

  // 3. Crear usuario Cajero Matriz
  const passwordHash = await bcrypt.hash('cajero123', 10);

  const newCashier = await prisma.user.upsert({
    where: { email: 'cajero.matriz@crimensanto.com' },
    update: {
      firstName: 'Cajero',
      lastName: 'Matriz',
      roleId: roleCashier.id,
      branchId: matriz.id,
      password: passwordHash,
      isActive: true
    },
    create: {
      email: 'cajero.matriz@crimensanto.com',
      firstName: 'Cajero',
      lastName: 'Matriz',
      roleId: roleCashier.id,
      branchId: matriz.id,
      password: passwordHash,
      isActive: true
    }
  });

  // Opcional: También aseguramos que caja1@crimensanto.com tenga la contraseña homologada
  await prisma.user.update({
    where: { email: 'caja1@crimensanto.com' },
    data: { password: passwordHash }
  });

  console.log(`✅ Usuario creado/actualizado exitosamente:`);
  console.log(`- Email / Usuario: ${newCashier.email}`);
  console.log(`- Sucursal: ${matriz.name}`);
  console.log(`- Rol: CASHIER (Solo ventas y caja)`);
  console.log(`- Contraseña: cajero123`);
  console.log(`\n(Nota: caja1@crimensanto.com también se homologó con la contraseña: cajero123)`);
}

main()
  .catch(e => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
