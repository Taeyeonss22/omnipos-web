import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { BusinessError, makeFolio, resolveBranchId } from '@/lib/session';

// Listar traspasos
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const branchId = session.user.branchId || undefined;
  // El ADMIN sin sucursal ve todos los traspasos
  const where = branchId
    ? { OR: [{ sourceBranchId: branchId }, { targetBranchId: branchId }] }
    : {};

  try {
    const transfers = await prisma.transferRequest.findMany({
      where,
      include: {
        sourceBranch: true,
        targetBranch: true,
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(transfers);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching transfers' }, { status: 500 });
  }
}

// Crear solicitud de traspaso
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'No tienes permisos para crear traspasos' }, { status: 403 });
  }

  const userId = session.user.id;

  try {
    const data = await request.json();
    const { targetBranchId, items } = data; // items: [{ productId, quantity }]
    // Permite indicar el origen; si no, se usa la sucursal del usuario
    const sourceBranchId = data.sourceBranchId || (await resolveBranchId(session));

    if (!sourceBranchId || !targetBranchId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }
    if (sourceBranchId === targetBranchId) {
      return NextResponse.json({ error: 'La sucursal destino debe ser distinta a la de origen' }, { status: 400 });
    }
    if (items.some((i: any) => !i.productId || !(parseInt(i.quantity, 10) > 0))) {
      return NextResponse.json({ error: 'Hay artículos con cantidad inválida' }, { status: 400 });
    }

    const folio = makeFolio('TR');

    const transfer = await prisma.transferRequest.create({
      data: {
        folio,
        sourceBranchId,
        targetBranchId,
        status: 'PENDING',
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: parseInt(item.quantity, 10)
          }))
        }
      },
      include: { items: true }
    });

    await createAuditLog({
      userId,
      branchId: sourceBranchId,
      action: 'CREATE_TRANSFER',
      entity: 'TRANSFER',
      entityId: transfer.id,
      details: { folio }
    });

    return NextResponse.json(transfer, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error creating transfer' }, { status: 500 });
  }
}

const TRANSITIONS: Record<string, { from: string; to: string }> = {
  APPROVE: { from: 'PENDING', to: 'APPROVED' },
  SHIP: { from: 'APPROVED', to: 'SHIPPED' },
  RECEIVE: { from: 'SHIPPED', to: 'RECEIVED' },
  CANCEL: { from: 'PENDING', to: 'CANCELLED' },
};

// Actualizar estado de traspaso (Aprobar/Enviar/Recibir)
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'No tienes permisos para modificar traspasos' }, { status: 403 });
  }

  try {
    const { id, action } = await request.json();
    const transition = TRANSITIONS[action];
    if (!transition) {
      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

    const transfer = await prisma.transferRequest.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!transfer) return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    if (transfer.status !== transition.from) {
      return NextResponse.json({ error: 'Transición de estado no válida' }, { status: 400 });
    }

    // Cambio de estado + movimiento de inventario en UNA sola transacción.
    // El cambio de estado es condicional, así un doble clic no descuenta/suma dos veces.
    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.transferRequest.updateMany({
        where: { id, status: transition.from },
        data: { status: transition.to }
      });
      if (claimed.count === 0) throw new BusinessError('El traspaso ya fue actualizado por otra persona');

      if (action === 'SHIP') {
        // Descontar inventario de la sucursal origen
        for (const item of transfer.items) {
          const res = await tx.inventory.updateMany({
            where: { branchId: transfer.sourceBranchId, productId: item.productId, quantity: { gte: item.quantity } },
            data: { quantity: { decrement: item.quantity } }
          });
          if (res.count === 0) throw new BusinessError('Stock insuficiente en origen para enviar');
        }
      } else if (action === 'RECEIVE') {
        // Aumentar inventario en la sucursal destino
        for (const item of transfer.items) {
          await tx.inventory.upsert({
            where: { branchId_productId: { branchId: transfer.targetBranchId, productId: item.productId } },
            update: { quantity: { increment: item.quantity } },
            create: {
              branchId: transfer.targetBranchId,
              productId: item.productId,
              quantity: item.quantity,
              minStock: 5 // Default
            }
          });
        }
      }

      return tx.transferRequest.findUnique({ where: { id } });
    }, { timeout: 30000 });

    await createAuditLog({
      userId: session.user.id,
      branchId: session.user.branchId || undefined,
      action: `TRANSFER_${action}`,
      entity: 'TRANSFER',
      entityId: id,
      details: { newStatus: transition.to }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Error updating transfer' }, { status: 500 });
  }
}
