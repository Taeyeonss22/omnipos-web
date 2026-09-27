import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';

// Listar traspasos
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const branchId = (session.user as any).branchId || undefined;

  try {
    const transfers = await prisma.transferRequest.findMany({
      where: {
        OR: [
          { sourceBranchId: branchId },
          { targetBranchId: branchId }
        ]
      },
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
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const sourceBranchId = (session.user as any).branchId;

  try {
    const data = await request.json();
    const { targetBranchId, items } = data; // items: [{ productId, quantity }]

    if (!targetBranchId || !items || items.length === 0) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const folio = `TR-${Date.now().toString().slice(-6)}`;

    const transfer = await prisma.transferRequest.create({
      data: {
        folio,
        sourceBranchId,
        targetBranchId,
        status: 'PENDING',
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity
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

// Actualizar estado de traspaso (Aprobar/Recibir)
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, action } = await request.json();
    
    const transfer = await prisma.transferRequest.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!transfer) return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });

    let newStatus = transfer.status;

    if (action === 'APPROVE' && transfer.status === 'PENDING') {
      newStatus = 'APPROVED';
    } else if (action === 'SHIP' && transfer.status === 'APPROVED') {
      newStatus = 'SHIPPED';
      // Descontar inventario de la sucursal origen
      await prisma.$transaction(async (tx) => {
        for (const item of transfer.items) {
          const inv = await tx.inventory.findUnique({
            where: { branchId_productId: { branchId: transfer.sourceBranchId, productId: item.productId } }
          });
          if (!inv || inv.quantity < item.quantity) throw new Error('Stock insuficiente en origen para enviar');
          
          await tx.inventory.update({
            where: { id: inv.id },
            data: { quantity: { decrement: item.quantity } }
          });
        }
      });
    } else if (action === 'RECEIVE' && transfer.status === 'SHIPPED') {
      newStatus = 'RECEIVED';
      // Aumentar inventario en la sucursal destino
      await prisma.$transaction(async (tx) => {
        for (const item of transfer.items) {
          // Usar upsert por si no existía el producto en la sucursal destino
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
      });
    } else {
      return NextResponse.json({ error: 'Transición de estado no válida' }, { status: 400 });
    }

    const updated = await prisma.transferRequest.update({
      where: { id },
      data: { status: newStatus }
    });

    await createAuditLog({
      userId: session.user.id,
      branchId: (session.user as any).branchId,
      action: `TRANSFER_${action}`,
      entity: 'TRANSFER',
      entityId: id,
      details: { newStatus }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error updating transfer' }, { status: 500 });
  }
}
