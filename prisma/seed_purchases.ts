import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Agregando proveedores y órdenes de compra...');

  const mainBranch = await prisma.branch.findFirst({ where: { name: 'Sucursal Matriz' } });
  const product = await prisma.product.findFirst({ where: { code: '7501234567890' } });

  if (!mainBranch || !product) {
    console.log('Faltan datos base');
    return;
  }

  const supplier = await prisma.supplier.create({
    data: {
      name: 'Herramientas Nacionales SA de CV',
      contactName: 'Carlos López',
      email: 'ventas@herramientasnacionales.com',
      phone: '55-1234-5678',
    }
  });

  await prisma.purchaseOrder.create({
    data: {
      folio: 'OC-998877',
      supplierId: supplier.id,
      branchId: mainBranch.id,
      total: 8000.00,
      status: 'PENDING',
      items: {
        create: [
          {
            productId: product.id,
            quantity: 100,
            unitCost: 80.00
          }
        ]
      }
    }
  });

  console.log('✅ Proveedores y órdenes de prueba creados');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
