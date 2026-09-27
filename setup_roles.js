const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log("Configurando roles y usuarios en Supabase...");

  // 1. Asegurar Sucursal Principal
  let branch = await prisma.branch.findFirst();
  if (!branch) {
    branch = await prisma.branch.create({
      data: { name: "CRIMEN SANTO - Matriz" }
    });
  }

  // 2. Roles
  const roles = [
    { name: 'ADMIN', description: 'Dueño - Acceso total', permissions: '["ALL"]' },
    { name: 'MANAGER', description: 'Gerente - Inventario, Compras, Ventas', permissions: '["INVENTORY", "PURCHASES", "SALES", "REPORTS"]' },
    { name: 'CASHIER', description: 'Cajera - Solo Ventas y Cortes', permissions: '["SALES"]' }
  ];

  for (const roleData of roles) {
    await prisma.role.upsert({
      where: { name: roleData.name },
      update: { description: roleData.description, permissions: roleData.permissions },
      create: roleData
    });
  }

  const roleAdmin = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const roleManager = await prisma.role.findUnique({ where: { name: 'MANAGER' } });
  const roleCashier = await prisma.role.findUnique({ where: { name: 'CASHIER' } });

  // 3. Usuarios
  const defaultPassword = await bcrypt.hash('123456', 10);

  const users = [
    {
      email: 'admin@crimensanto.com',
      firstName: 'Dueño',
      lastName: 'Admin',
      roleId: roleAdmin.id,
      password: defaultPassword
    },
    {
      email: 'gerente@crimensanto.com',
      firstName: 'Gerente',
      lastName: 'Tienda',
      roleId: roleManager.id,
      branchId: branch.id,
      password: defaultPassword
    },
    {
      email: 'caja1@crimensanto.com',
      firstName: 'Cajera',
      lastName: 'Principal',
      roleId: roleCashier.id,
      branchId: branch.id,
      password: defaultPassword
    }
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { roleId: u.roleId, password: u.password },
      create: u
    });
  }

  console.log("✅ ¡Roles y Usuarios creados exitosamente!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
