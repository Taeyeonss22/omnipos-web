import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get('branchId') || (session.user as any)?.branchId;
  const search = searchParams.get('search');

  try {
    const products = await prisma.product.findMany({
      where: search ? {
        OR: [
          { name: { contains: search } },
          { code: { contains: search } }
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
  if (!session || !['ADMIN', 'MANAGER'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let branchId = (session.user as any).branchId || undefined;
  if (!branchId) {
    const firstBranch = await prisma.branch.findFirst();
    if (firstBranch) branchId = firstBranch.id;
  }

  try {
    const data = await request.json();
    
    // Si no hay categoría, usamos una por defecto o la creamos
    let categoryId = data.categoryId;
    if (!categoryId && data.categoryName) {
      const cat = await prisma.category.create({ data: { name: data.categoryName } });
      categoryId = cat.id;
    }

    const newProduct = await prisma.product.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        price: parseFloat(data.price),
        cost: parseFloat(data.cost),
        unit: data.unit || 'PZA',
        categoryId: categoryId,
        inventories: {
          create: {
            branchId,
            quantity: parseInt(data.initialStock || '0', 10),
            minStock: parseInt(data.minStock || '0', 10),
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
    console.error(error);
    return NextResponse.json({ error: 'Failed to create product', details: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let branchId = (session.user as any).branchId || undefined;
  if (!branchId) {
    const firstBranch = await prisma.branch.findFirst();
    if (firstBranch) branchId = firstBranch.id;
  }

  try {
    const data = await request.json();
    const { id, name, description, price, cost, minStock, location } = data;

    if (!id) return NextResponse.json({ error: 'Falta el ID del producto' }, { status: 400 });

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        price: parseFloat(price),
        cost: parseFloat(cost),
        inventories: {
          update: {
            where: { branchId_productId: { branchId, productId: id } },
            data: {
              minStock: parseInt(minStock),
              location: location || null
            }
          }
        }
      }
    });

    return NextResponse.json(product);
  } catch (error: any) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Error interno actualizando producto' }, { status: 500 });
  }
}
