import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { resolveBranchId } from '@/lib/session';

/** Busca una categoría por nombre (sin duplicarla) o la crea. Por defecto "General". */
async function findOrCreateCategory(name?: string | null): Promise<string> {
  const clean = (name || '').trim() || 'General';
  const existing = await prisma.category.findFirst({
    where: { name: { equals: clean, mode: 'insensitive' } }
  });
  if (existing) return existing.id;
  const created = await prisma.category.create({ data: { name: clean } });
  return created.id;
}

const toNumber = (value: any, fallback = 0) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};
const toInt = (value: any, fallback = 0) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  // Usar la misma sucursal que el POS y los ajustes, para que el stock mostrado coincida
  const branchId = searchParams.get('branchId') || (await resolveBranchId(session));
  const search = searchParams.get('search')?.trim();

  try {
    const products = await prisma.product.findMany({
      where: search ? {
        OR: [
          // En PostgreSQL "contains" distingue mayúsculas: usar modo insensible
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } }
        ]
      } : undefined,
      include: {
        category: true,
        inventories: branchId ? {
          where: { branchId },
        } : true
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const branchId = await resolveBranchId(session);
  if (!branchId) {
    return NextResponse.json({ error: 'Primero crea una sucursal en Configuración' }, { status: 400 });
  }

  try {
    const data = await request.json();

    const code = String(data.code || '').trim();
    const name = String(data.name || '').trim();
    const price = toNumber(data.price, NaN);
    const cost = toNumber(data.cost, 0);

    if (!code || !name) {
      return NextResponse.json({ error: 'El código y el nombre son obligatorios' }, { status: 400 });
    }
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'El precio no es válido' }, { status: 400 });
    }

    const categoryId = data.categoryId || (await findOrCreateCategory(data.categoryName));

    const newProduct = await prisma.product.create({
      data: {
        code,
        name,
        description: data.description,
        price,
        cost,
        unit: data.unit || 'PZA',
        categoryId,
        inventories: {
          create: {
            branchId,
            quantity: toInt(data.initialStock, 0),
            minStock: toInt(data.minStock, 0),
            location: data.location || null
          }
        }
      }
    });

    await createAuditLog({
      userId: session.user.id,
      branchId,
      action: 'CREATE_PRODUCT',
      entity: 'PRODUCT',
      entityId: newProduct.id,
      details: newProduct
    });

    return NextResponse.json(newProduct, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un producto con ese código' }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Failed to create product', details: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  // Solo admin/gerente pueden cambiar precios y costos
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'No tienes permisos para editar productos' }, { status: 403 });
  }

  const branchId = await resolveBranchId(session);

  try {
    const data = await request.json();
    const { id, name, description, price, cost, minStock, location, categoryName } = data;

    if (!id) return NextResponse.json({ error: 'Falta el ID del producto' }, { status: 400 });

    const numericPrice = toNumber(price, NaN);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return NextResponse.json({ error: 'El precio no es válido' }, { status: 400 });
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        price: numericPrice,
        cost: toNumber(cost, 0),
        ...(categoryName ? { categoryId: await findOrCreateCategory(categoryName) } : {}),
      }
    });

    // upsert: si el producto aún no tiene registro de inventario en esta sucursal, se crea
    if (branchId) {
      await prisma.inventory.upsert({
        where: { branchId_productId: { branchId, productId: id } },
        update: {
          minStock: toInt(minStock, 0),
          location: location || null
        },
        create: {
          branchId,
          productId: id,
          quantity: 0,
          minStock: toInt(minStock, 0),
          location: location || null
        }
      });
    }

    await createAuditLog({
      userId: session.user.id,
      branchId,
      action: 'UPDATE_PRODUCT',
      entity: 'PRODUCT',
      entityId: id,
      details: { name, price: numericPrice, cost }
    });

    return NextResponse.json(product);
  } catch (error: any) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Error interno actualizando producto' }, { status: 500 });
  }
}
