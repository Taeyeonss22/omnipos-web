import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { BusinessError } from '@/lib/session';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Solo administradores o gerentes pueden cancelar ventas' }, { status: 403 });
  }

  const { id: saleId } = await params;

  try {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true, payments: true }
    });

    if (!sale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    if (sale.status === 'CANCELLED') return NextResponse.json({ error: 'La venta ya está cancelada' }, { status: 400 });

    // Cancelar venta en una transacción
    await prisma.$transaction(async (tx) => {
      // 1. Marcar venta como cancelada (de forma atómica, para que dos clics
      //    seguidos no regresen el inventario dos veces)
      const updated = await tx.sale.updateMany({
        where: { id: saleId, status: { not: 'CANCELLED' } },
        data: { status: 'CANCELLED' }
      });
      if (updated.count === 0) throw new BusinessError('La venta ya está cancelada');

      // 2. Regresar inventario (o retirarlo, si era una devolución)
      for (const item of sale.items) {
        await tx.inventory.upsert({
          where: { branchId_productId: { branchId: sale.branchId, productId: item.productId } },
          update: { quantity: { increment: item.quantity } },
          create: { branchId: sale.branchId, productId: item.productId, quantity: item.quantity, minStock: 0 }
        });
      }

      // 3. Si se cobró a crédito, quitar el cargo del saldo del cliente
      const creditAmount = sale.payments
        .filter(p => p.method === 'CREDIT')
        .reduce((acc, p) => acc + Number(p.amount), 0);
      if (creditAmount !== 0 && sale.customerId) {
        await tx.customerCredit.updateMany({
          where: { customerId: sale.customerId },
          data: { balance: { decrement: creditAmount } }
        });
      }
    });

    await createAuditLog({
      userId: session.user.id,
      branchId: sale.branchId,
      action: 'CANCEL_SALE',
      entity: 'SALE',
      entityId: saleId,
      details: { folio: sale.folio, total: sale.total, previousStatus: sale.status }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error cancelando venta', details: error.message }, { status: 500 });
  }
}
