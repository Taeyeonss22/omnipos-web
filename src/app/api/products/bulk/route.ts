import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { resolveBranchId } from '@/lib/session';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'MANAGER'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const branchId = await resolveBranchId(session);
  if (!branchId) {
    return NextResponse.json({ error: 'Primero crea una sucursal en Configuración' }, { status: 400 });
  }

  try {
    const items = await request.json();
    
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 });
    }

    let imported = 0;
    let skipped = 0;
    const categoryCache = new Map<string, string>();
    
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        // Filas sin código o sin nombre no se pueden importar
        const code = String(item.code ?? '').trim();
        const name = String(item.name ?? '').trim();
        if (!code || !name) { skipped++; continue; }

        // Buscar o crear categoría (la categoría es obligatoria: por defecto "General")
        const catName = String(item.categoryName ?? '').trim() || 'General';
        let categoryId = categoryCache.get(catName.toLowerCase());
        if (!categoryId) {
          let cat = await tx.category.findFirst({ where: { name: { equals: catName, mode: 'insensitive' } } });
          if (!cat) cat = await tx.category.create({ data: { name: catName } });
          categoryId = cat.id as string;
          categoryCache.set(catName.toLowerCase(), cat.id as string);
        }

        // Upsert Product
        const product = await tx.product.upsert({
          where: { code },
          update: {
            name,
            price: parseFloat(item.price || '0'),
            cost: parseFloat(item.cost || '0'),
            categoryId
          },
          create: {
            code,
            name,
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
    }, { timeout: 60000 });

    await createAuditLog({
      userId: session.user.id,
      branchId: branchId,
      action: 'BULK_IMPORT_PRODUCTS',
      entity: 'PRODUCT',
      entityId: 'BULK',
      details: { count: imported, skipped }
    });

    return NextResponse.json({ success: true, count: imported, skipped }, { status: 201 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to import products', details: error.message }, { status: 500 });
  }
}
