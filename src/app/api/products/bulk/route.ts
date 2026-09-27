import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'MANAGER'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const branchId = (session.user as any).branchId;

  try {
    const items = await request.json();
    
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 });
    }

    let imported = 0;
    
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        // Find or create category
        let categoryId = null;
        if (item.categoryName) {
          let cat = await tx.category.findFirst({ where: { name: item.categoryName } });
          if (!cat) cat = await tx.category.create({ data: { name: item.categoryName } });
          categoryId = cat.id;
        }

        // Upsert Product
        const product = await tx.product.upsert({
          where: { code: item.code },
          update: {
            name: item.name,
            price: parseFloat(item.price || '0'),
            cost: parseFloat(item.cost || '0'),
            categoryId
          },
          create: {
            code: item.code,
            name: item.name,
            price: parseFloat(item.price || '0'),
            cost: parseFloat(item.cost || '0'),
            categoryId
          }
        });

        // Initialize Inventory if provided
        if (item.initialStock) {
          await tx.inventory.upsert({
            where: { branchId_productId: { branchId, productId: product.id } },
            update: {}, // Don't overwrite existing inventory if we are just importing products
            create: {
              branchId,
              productId: product.id,
              quantity: parseInt(item.initialStock || '0', 10),
              minStock: parseInt(item.minStock || '5', 10)
            }
          });
        }
        imported++;
      }
    });

    await createAuditLog({
      userId: session.user.id,
      branchId: branchId,
      action: 'BULK_IMPORT_PRODUCTS',
      entity: 'PRODUCT',
      entityId: 'BULK',
      details: { count: imported }
    });

    return NextResponse.json({ success: true, count: imported }, { status: 201 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to import products', details: error.message }, { status: 500 });
  }
}
