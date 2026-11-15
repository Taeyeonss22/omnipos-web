// Script para inicializar la base de datos SQLite local de la sucursal offline
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const jsonPath = path.join(__dirname, '..', 'catalogo_offline.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('No se encontro el archivo catalogo_offline.json en la raiz.');
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, 'utf8');
  const payload = JSON.parse(raw);
  const data = payload.data || payload;

  console.log('--- Iniciando siembra de base de datos SQLite local ---');

  // 1. Roles
  if (Array.isArray(data.roles)) {
    for (const r of data.roles) {
      await prisma.role.upsert({
        where: { id: r.id },
        update: {},
        create: {
          id: r.id,
          name: r.name,
          description: r.description || null,
          permissions: r.permissions || '[]',
        },
      });
    }
    console.log(`Roles listos: ${data.roles.length}`);
  }

  // 2. Sucursales
  if (Array.isArray(data.branches)) {
    for (const b of data.branches) {
      await prisma.branch.upsert({
        where: { id: b.id },
        update: {},
        create: {
          id: b.id,
          name: b.name,
          address: b.address || null,
          phone: b.phone || null,
        },
      });
    }
    console.log(`Sucursales listas: ${data.branches.length}`);
  }

  // 3. Usuarios
  if (Array.isArray(data.users)) {
    for (const u of data.users) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: { password: u.password },
        create: {
          id: u.id,
          email: u.email,
          password: u.password,
          firstName: u.firstName,
          lastName: u.lastName,
          isActive: u.isActive !== undefined ? u.isActive : true,
          roleId: u.roleId,
          branchId: u.branchId || null,
        },
      });
    }
    console.log(`Usuarios/Cajeros listos: ${data.users.length}`);
  }

  // 4. Categorías
  if (Array.isArray(data.categories)) {
    for (const c of data.categories) {
      await prisma.category.upsert({
        where: { id: c.id },
        update: {},
        create: {
          id: c.id,
          name: c.name,
          description: c.description || null,
        },
      });
    }
    console.log(`Categorias listas: ${data.categories.length}`);
  }

  // 5. Cajas registradoras
  if (Array.isArray(data.cashRegisters)) {
    for (const cr of data.cashRegisters) {
      await prisma.cashRegister.upsert({
        where: { id: cr.id },
        update: {},
        create: {
          id: cr.id,
          branchId: cr.branchId,
          name: cr.name,
          isActive: cr.isActive !== undefined ? cr.isActive : true,
        },
      });
    }
    console.log(`Cajas registradoras listas: ${data.cashRegisters.length}`);
  }

  // 6. Productos
  if (Array.isArray(data.products)) {
    for (const p of data.products) {
      await prisma.product.upsert({
        where: { code: p.code },
        update: {
          name: p.name,
          price: Number(p.price),
          cost: Number(p.cost),
          unit: p.unit || 'PZA',
          categoryId: p.categoryId,
        },
        create: {
          id: p.id,
          code: p.code,
          name: p.name,
          description: p.description || null,
          price: Number(p.price),
          cost: Number(p.cost),
          unit: p.unit || 'PZA',
          imageUrl: p.imageUrl || null,
          categoryId: p.categoryId,
        },
      });
    }
    console.log(`Productos cargados: ${data.products.length}`);
  }

  // 7. Clientes
  if (Array.isArray(data.customers)) {
    for (const cust of data.customers) {
      await prisma.customer.upsert({
        where: { id: cust.id },
        update: {},
        create: {
          id: cust.id,
          name: cust.name,
          email: cust.email || null,
          phone: cust.phone || null,
          rfc: cust.rfc || null,
        },
      });
    }
    console.log(`Clientes listos: ${data.customers.length}`);
  }

  console.log('¡Base de datos local SQLite configurada y lista para operar sin internet!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
