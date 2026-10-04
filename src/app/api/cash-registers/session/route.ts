import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET: Obtener la sesión activa del usuario
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const activeSession = await prisma.cashRegisterSession.findFirst({
      where: {
        userId: session.user.id,
        status: 'OPEN'
      },
      include: {
        register: true
      }
    });

    if (!activeSession) {
      let branchId = (session.user as any).branchId || undefined;
      if (!branchId) {
        const firstBranch = await prisma.branch.findFirst();
        if (firstBranch) branchId = firstBranch.id;
      }
      // Retornamos las cajas disponibles de la sucursal para poder abrir una
      const registers = await prisma.cashRegister.findMany({
        where: { branchId, isActive: true }
      });
      return NextResponse.json({ activeSession: null, availableRegisters: registers });
    }

    return NextResponse.json({ activeSession });
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching session' }, { status: 500 });
  }
}

// POST: Abrir una nueva sesión de caja
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await request.json();
    const { registerId, openingBalance } = data;

    // Verificar que la caja no esté abierta por otro usuario
    const existing = await prisma.cashRegisterSession.findFirst({
      where: { registerId, status: 'OPEN' }
    });

    if (existing) {
      return NextResponse.json({ error: 'Esta caja ya está abierta' }, { status: 400 });
    }

    const newSession = await prisma.cashRegisterSession.create({
      data: {
        registerId,
        userId: session.user.id,
        openingBalance: parseFloat(openingBalance || '0'),
        status: 'OPEN'
      }
    });

    return NextResponse.json(newSession, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error opening session' }, { status: 500 });
  }
}

// PUT: Cerrar (hacer corte) de caja
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await request.json();
    const { sessionId, closingBalance } = data;

    const activeSession = await prisma.cashRegisterSession.findUnique({
      where: { id: sessionId },
      include: { sales: true }
    });

    if (!activeSession || activeSession.status === 'CLOSED') {
      return NextResponse.json({ error: 'Sesión no válida o ya cerrada' }, { status: 400 });
    }

    // Calcular ventas totales en efectivo (simplificado)
    const totalCashSales = activeSession.sales.filter(s => s.status !== 'CANCELLED').reduce((acc, sale) => acc + Number(sale.total), 0);
    const expectedBalance = Number(activeSession.openingBalance) + totalCashSales;
    const difference = parseFloat(closingBalance) - expectedBalance;

    const closedSession = await prisma.cashRegisterSession.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closingTime: new Date(),
        closingBalance: parseFloat(closingBalance),
        difference: difference
      }
    });

    return NextResponse.json(closedSession);
  } catch (error) {
    return NextResponse.json({ error: 'Error closing session' }, { status: 500 });
  }
}
