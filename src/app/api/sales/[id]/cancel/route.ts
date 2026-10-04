import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'MANAGER'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Solo administradores o gerentes pueden cancelar ventas' }, { status: 403 });
  }

  const saleId = (await Promise.resolve(params)).id;

  try {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true }
    });

    if (!sale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    if (sale.status === 'CANCELLED') return NextResponse.json({ error: 'La venta ya está cancelada' }, { status: 400 });

    // Cancelar venta en una transacción
    await prisma.$transaction(async (tx) => {
      // 1. Marcar venta como cancelada
      await tx.sale.update({
        where: { id: saleId },
        data: { status: 'CANCELLED' }
      });

      // 2. Regresar inventario
      for (const item of sale.items) {
        await tx.inventory.update({
          where: { branchId_productId: { branchId: sale.branchId, productId: item.productId } },
          data: { quantity: { increment: item.quantity } }
        });
      }
    });

    await createAuditLog({
      userId: session.user.id,
      branchId: sale.branchId,
      action: 'CANCEL_SALE',
      entity: 'SALE',
      entityId: saleId,
      details: { folio: sale.folio, total: sale.total }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Error cancelando venta', details: error.message }, { status: 500 });
  }
}
