import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const saleId = params.id;

  try {
    const data = await request.json();
    const { amount, method } = data;
    
    // Obtener sesión de caja actual para asignar el abono
    const cashSession = await prisma.cashRegisterSession.findFirst({
      where: { userId: session.user.id, status: 'OPEN' }
    });
    
    if (!cashSession) {
      return NextResponse.json({ error: 'Debes abrir turno en una caja para registrar un abono' }, { status: 400 });
    }

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { payments: true }
    });

    if (!sale || sale.status !== 'LAYAWAY') {
      return NextResponse.json({ error: 'Apartado no válido' }, { status: 404 });
    }

    const totalPaid = sale.payments.reduce((acc, p) => acc + p.amount, 0);
    const remaining = sale.total - totalPaid;
    
    if (amount > remaining) {
      return NextResponse.json({ error: 'El monto excede la deuda' }, { status: 400 });
    }

    // Registrar abono
    const newPayment = await prisma.payment.create({
      data: {
        saleId: sale.id,
        amount: amount,
        method: method || 'CASH',
        sessionId: cashSession.id
      }
    });
    
    // Si se liquidó, cambiar estado
    if (totalPaid + amount >= sale.total) {
      await prisma.sale.update({
        where: { id: sale.id },
        data: { status: 'COMPLETED' }
      });
    }

    await createAuditLog({
      userId: session.user.id,
      branchId: sale.branchId,
      action: 'ADD_PAYMENT',
      entity: 'SALE',
      entityId: sale.id,
      details: { amount, method }
    });

    return NextResponse.json({ success: true, payment: newPayment });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error registrando abono', details: error.message }, { status: 500 });
  }
}
