const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando configuración de Sucursal Silvestre y usuarios...');

  // 1. Roles
  const roleCashier = await prisma.role.findUnique({ where: { name: 'CASHIER' } });
  const roleManager = await prisma.role.findUnique({ where: { name: 'MANAGER' } });

  if (!roleCashier || !roleManager) {
    throw new Error('Roles no encontrados en la base de datos');
  }

  // 2. Crear o actualizar Sucursal Silvestre
  let branch = await prisma.branch.findFirst({
    where: { name: { equals: 'Sucursal Silvestre', mode: 'insensitive' } }
  });

  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        name: 'Sucursal Silvestre',
        address: 'Sucursal Silvestre',
        phone: '555-0200',
        cashRegisters: {
          create: {
            name: 'Caja 1 - Silvestre',
            isActive: true
          }
        }
      },
      include: { cashRegisters: true }
    });
    console.log(`✅ Sucursal creada: ${branch.name} con ID: ${branch.id}`);
  } else {
    console.log(`ℹ️ Sucursal ya existe: ${branch.name} (${branch.id})`);
    const reg = await prisma.cashRegister.findFirst({ where: { branchId: branch.id } });
    if (!reg) {
      await prisma.cashRegister.create({
        data: { name: 'Caja 1 - Silvestre', branchId: branch.id, isActive: true }
      });
      console.log('✅ Caja 1 - Silvestre creada');
    }
  }

  // 3. Inicializar inventario para Sucursal Silvestre en lote (createMany con skipDuplicates)
  const products = await prisma.product.findMany({ select: { id: true } });
  const invData = products.map(p => ({
    branchId: branch.id,
    productId: p.id,
    quantity: 0,
    minStock: 5
  }));

  const createdCount = await prisma.inventory.createMany({
    data: invData,
    skipDuplicates: true
  });
  console.log(`✅ Inventario inicializado para Sucursal Silvestre (${createdCount.count} nuevos registros en stock 0)`);

  // 4. Actualizar contraseña del Gerente
  const newManagerPassword = await bcrypt.hash('Gerente2026!', 10);
  const updatedManager = await prisma.user.updateMany({
    where: {
      OR: [
        { email: 'gerente@crimensanto.com' },
        { roleId: roleManager.id }
      ]
    },
    data: {
      password: newManagerPassword
    }
  });
  console.log(`✅ Contraseña del Gerente actualizada (${updatedManager.count} usuario(s)) a: Gerente2026!`);

  // 5. Crear los 2 usuarios Cajeros para Sucursal Silvestre
  const cashierPassword = await bcrypt.hash('cajero123', 10);

  const cashiersToCreate = [
    {
      email: 'cajero1.silvestre@crimensanto.com',
      firstName: 'Cajero 1',
      lastName: 'Silvestre',
      roleId: roleCashier.id,
      branchId: branch.id,
      password: cashierPassword
    },
    {
      email: 'cajero2.silvestre@crimensanto.com',
      firstName: 'Cajero 2',
      lastName: 'Silvestre',
      roleId: roleCashier.id,
      branchId: branch.id,
      password: cashierPassword
    }
  ];

  for (const c of cashiersToCreate) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {
        firstName: c.firstName,
        lastName: c.lastName,
        roleId: c.roleId,
        branchId: c.branchId,
        password: c.password,
        isActive: true
      },
      create: c
    });
    console.log(`✅ Cajero configurado: ${user.email} (Rol: CASHIER, Sucursal: Silvestre)`);
  }

  console.log('\n🎉 ¡Toda la configuración fue aplicada exitosamente en Supabase!');
}

main()
  .catch(e => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
