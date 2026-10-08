import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const data = await request.json();
    const { type, amount, reason } = data; // type: "IN" o "OUT"

    const activeSession = await prisma.cashRegisterSession.findFirst({
      where: { userId: session.user.id, status: 'OPEN' }
    });

    if (!activeSession) {
      return NextResponse.json({ error: 'No tienes ninguna caja abierta' }, { status: 400 });
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
    }

    const movement = await prisma.cashMovement.create({
      data: {
        type,
        amount: Number(amount),
        reason,
        sessionId: activeSession.id
      }
    });

    await createAuditLog({
      userId: session.user.id,
      branchId: (session.user as any).branchId,
      action: 'CASH_MOVEMENT',
      entity: 'CASH_SESSION',
      entityId: activeSession.id,
      details: { type, amount, reason }
    });

    return NextResponse.json(movement);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Error al registrar movimiento' }, { status: 500 });
  }
}
