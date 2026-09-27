import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seeder...');

  // 1. Crear sucursal principal
  const mainBranch = await prisma.branch.create({
    data: {
      name: 'Sucursal Matriz',
      address: 'Av. Principal 123, Centro',
      phone: '555-0100',
    },
  });
  console.log(`✅ Sucursal creada: ${mainBranch.name}`);

  // 2. Crear roles
  const adminRole = await prisma.role.create({
    data: {
      name: 'ADMIN',
      description: 'Administrador del Sistema',
      permissions: JSON.stringify(['ALL']),
    },
  });

  const cashierRole = await prisma.role.create({
    data: {
      name: 'CASHIER',
      description: 'Cajero de Sucursal',
      permissions: JSON.stringify(['CREATE_SALE', 'VIEW_INVENTORY']),
    },
  });
  console.log(`✅ Roles creados: ADMIN, CASHIER`);

  // 3. Crear usuario admin
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@ferremix.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'General',
      roleId: adminRole.id,
      branchId: mainBranch.id,
    },
  });
  console.log(`✅ Usuario creado: ${adminUser.email} (admin123)`);

  // 4. Crear categorías y productos de prueba
  const catHerramientas = await prisma.category.create({
    data: { name: 'Herramientas Manuales', description: 'Martillos, desarmadores, etc.' }
  });

  await prisma.product.create({
    data: {
      code: '7501234567890',
      name: 'Martillo de Uña 16oz',
      price: 150.00,
      cost: 80.00,
      unit: 'PZA',
      categoryId: catHerramientas.id,
      inventories: {
        create: {
          branchId: mainBranch.id,
          quantity: 50,
          minStock: 10,
          location: 'Pasillo 1, Anaquel A'
        }
      }
    }
  });
  console.log(`✅ Productos y categorías de prueba creados`);
  
  // 5. Crear una caja
  await prisma.cashRegister.create({
    data: {
      name: 'Caja 1 - Matriz',
      branchId: mainBranch.id,
    }
  });
  console.log(`✅ Caja de cobro creada`);
}

main()
  .catch((e) => {
    console.error('❌ Error en el seeder:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🌱 Seeder terminado.');
  });
