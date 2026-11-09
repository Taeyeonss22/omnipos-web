import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { BusinessError } from '@/lib/session';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: saleId } = await params;

  try {
    const data = await request.json();
    // El monto puede llegar como texto: convertirlo para no concatenar cadenas
    const amount = Math.round(Number(data.amount) * 100) / 100;
    const method = data.method === 'CARD' ? 'CARD' : 'CASH';

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'El monto del abono no es válido' }, { status: 400 });
    }

    // Obtener sesión de caja actual para asignar el abono
    const cashSession = await prisma.cashRegisterSession.findFirst({
      where: { userId: session.user.id, status: 'OPEN' }
    });

    if (!cashSession) {
      return NextResponse.json({ error: 'Debes abrir turno en una caja para registrar un abono' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { payments: true }
      });

      if (!sale || sale.status !== 'LAYAWAY') {
        throw new BusinessError('Apartado no válido');
      }

      const totalPaid = sale.payments.reduce((acc, p) => acc + Number(p.amount), 0);
      const remaining = Math.round((sale.total - totalPaid) * 100) / 100;

      if (amount > remaining) {
        throw new BusinessError(`El monto excede la deuda (resta $${remaining.toFixed(2)})`);
      }

      // Registrar abono
      const newPayment = await tx.payment.create({
        data: {
          saleId: sale.id,
          amount,
          method,
          sessionId: cashSession.id
        }
      });

      // Si se liquidó, cambiar estado
      const settled = totalPaid + amount >= sale.total - 0.005;
      if (settled) {
        await tx.sale.update({
          where: { id: sale.id },
          data: { status: 'COMPLETED' }
        });
      }

      return { sale, newPayment, settled };
    });

    await createAuditLog({
      userId: session.user.id,
      branchId: result.sale.branchId,
      action: 'ADD_PAYMENT',
      entity: 'SALE',
      entityId: result.sale.id,
      details: { amount, method, settled: result.settled }
    });

    return NextResponse.json({ success: true, payment: result.newPayment, settled: result.settled });
  } catch (error: any) {
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error registrando abono', details: error.message }, { status: 500 });
  }
}
