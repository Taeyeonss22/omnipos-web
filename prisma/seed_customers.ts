import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Agregando clientes...');

  await prisma.customer.create({
    data: {
      name: 'Público en General',
      rfc: 'XAXX010101000',
    }
  });

  await prisma.customer.create({
    data: {
      name: 'Constructora del Norte SA de CV',
      email: 'pagos@constructoranorte.com',
      phone: '555-9988',
      rfc: 'CNO900101XYZ',
      credit: {
        create: {
          creditLimit: 50000.00,
          balance: 15400.50
        }
      }
    }
  });

  await prisma.customer.create({
    data: {
      name: 'Juan Pérez',
      phone: '555-1122',
      credit: {
        create: {
          creditLimit: 5000.00,
          balance: 0.00
        }
      }
    }
  });

  console.log('✅ Clientes de prueba creados');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
