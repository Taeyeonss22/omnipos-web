import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { BusinessError, makeFolio, resolveBranchId } from '@/lib/session';

// Listar órdenes de compra
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const branchId = await resolveBranchId(session);

  try {
    const orders = await prisma.purchaseOrder.findMany({
      where: { branchId },
      include: {
        supplier: true,
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching purchase orders' }, { status: 500 });
  }
}

// Crear orden de compra
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'No tienes permisos para crear compras' }, { status: 403 });
  }

  const userId = session.user.id;
  // Antes el ADMIN sin sucursal no podía crear órdenes (branchId vacío)
  const branchId = await resolveBranchId(session);
  if (!branchId) {
    return NextResponse.json({ error: 'Primero crea una sucursal en Configuración' }, { status: 400 });
  }

  try {
    const data = await request.json();
    const { supplierId, items } = data; // items: [{ productId, quantity, unitCost }]

    if (!supplierId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }
    const invalid = items.some((item: any) =>
      !item.productId || !(parseInt(item.quantity, 10) > 0) || !(parseFloat(item.unitCost) >= 0)
    );
    if (invalid) {
      return NextResponse.json({ error: 'Hay artículos con cantidad o costo inválido' }, { status: 400 });
    }

    const folio = makeFolio('OC');
    const total = items.reduce((acc: number, item: any) => acc + (parseInt(item.quantity, 10) * parseFloat(item.unitCost)), 0);

    const order = await prisma.purchaseOrder.create({
      data: {
        folio,
        supplierId,
        branchId,
        total,
        status: 'PENDING',
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: parseInt(item.quantity, 10),
            unitCost: parseFloat(item.unitCost)
          }))
        }
      },
      include: { items: true }
    });

    await createAuditLog({
      userId,
      branchId,
      action: 'CREATE_PURCHASE_ORDER',
      entity: 'PURCHASE_ORDER',
      entityId: order.id,
      details: { folio, total }
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error creating purchase order' }, { status: 500 });
  }
}

// Recibir orden de compra (Aumentar Inventario)
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'No tienes permisos para recibir compras' }, { status: 403 });
  }

  try {
    const { id, action } = await request.json();
    
    if (action !== 'RECEIVE') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!order || order.status !== 'PENDING') {
      return NextResponse.json({ error: 'Orden no válida o ya recibida' }, { status: 400 });
    }

    // Transacción: Cambiar estado y subir inventario
    const updated = await prisma.$transaction(async (tx) => {
      // 0. Marcar como recibida de forma atómica: si dos personas dan clic
      //    al mismo tiempo, solo una suma el inventario.
      const claimed = await tx.purchaseOrder.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'RECEIVED' }
      });
      if (claimed.count === 0) throw new BusinessError('Orden no válida o ya recibida');

      // 1. Aumentar inventario en la sucursal actual
      for (const item of order.items) {
        await tx.inventory.upsert({
          where: { branchId_productId: { branchId: order.branchId, productId: item.productId } },
          update: { quantity: { increment: item.quantity } },
          create: {
            branchId: order.branchId,
            productId: item.productId,
            quantity: item.quantity,
            minStock: 5
          }
        });

        // Opcional: Actualizar el costo del producto con el último costo de compra
        await tx.product.update({
          where: { id: item.productId },
          data: { cost: item.unitCost }
        });

        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { receivedQuantity: item.quantity }
        });
      }

      return await tx.purchaseOrder.findUnique({ where: { id } });
    }, { timeout: 30000 });

    await createAuditLog({
      userId: session.user.id,
      branchId: (session.user as any).branchId,
      action: `RECEIVE_PURCHASE_ORDER`,
      entity: 'PURCHASE_ORDER',
      entityId: id,
      details: { status: 'RECEIVED' }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Error updating order' }, { status: 500 });
  }
}
