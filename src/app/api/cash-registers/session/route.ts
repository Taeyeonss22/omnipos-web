import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveBranchId } from '@/lib/session';

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
      const branchId = await resolveBranchId(session);
      // Retornamos las cajas disponibles de la sucursal para poder abrir una
      const registers = await prisma.cashRegister.findMany({
        where: { branchId, isActive: true }
      });
      return NextResponse.json({ activeSession: null, availableRegisters: registers });
    }

    return NextResponse.json({ activeSession });
  } catch (error: any) {
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

    if (!registerId) {
      return NextResponse.json({ error: 'No hay ninguna caja seleccionada. Crea una caja en Configuración.' }, { status: 400 });
    }

    const opening = parseFloat(openingBalance || '0');
    if (!Number.isFinite(opening) || opening < 0) {
      return NextResponse.json({ error: 'El fondo inicial no es válido' }, { status: 400 });
    }

    const register = await prisma.cashRegister.findUnique({ where: { id: registerId } });
    if (!register || !register.isActive) {
      return NextResponse.json({ error: 'La caja seleccionada no existe o está inactiva' }, { status: 400 });
    }

    // El usuario no puede tener dos turnos abiertos al mismo tiempo
    const userOpen = await prisma.cashRegisterSession.findFirst({
      where: { userId: session.user.id, status: 'OPEN' }
    });
    if (userOpen) {
      return NextResponse.json({ error: 'Ya tienes un turno abierto' }, { status: 400 });
    }

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
        openingBalance: opening,
        status: 'OPEN'
      }
    });

    return NextResponse.json(newSession, { status: 201 });
  } catch (error: any) {
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

    const declared = parseFloat(closingBalance);
    if (!Number.isFinite(declared) || declared < 0) {
      return NextResponse.json({ error: 'El monto declarado no es válido' }, { status: 400 });
    }

    const activeSession = await prisma.cashRegisterSession.findUnique({
      where: { id: sessionId },
      include: {
        sales: { include: { payments: true } },
        payments: { include: { sale: { select: { status: true } } } },
        creditPayments: true,
        CashMovement: true
      }
    });

    if (!activeSession || activeSession.status === 'CLOSED') {
      return NextResponse.json({ error: 'Sesión no válida o ya cerrada' }, { status: 400 });
    }

    // Solo el dueño del turno (o un admin/gerente) puede hacer el corte
    const role = session.user.role;
    if (activeSession.userId !== session.user.id && role !== 'ADMIN' && role !== 'MANAGER') {
      return NextResponse.json({ error: 'No puedes cerrar el turno de otro usuario' }, { status: 403 });
    }

    // Calcular efectivo usando pagos reales en lugar del total del ticket (para soportar apartados).
    // Los pagos de ventas CANCELADAS no cuentan: ese dinero se devolvió al cliente.
    let totalCashSales = 0;

    if (activeSession.payments.length > 0 || activeSession.creditPayments.length > 0) {
      const directPayments = activeSession.payments
        .filter(p => p.method === 'CASH' && p.sale?.status !== 'CANCELLED')
        .reduce((acc, p) => acc + Number(p.amount), 0);
      const creditCash = activeSession.creditPayments
        .filter(p => p.method === 'CASH')
        .reduce((acc, p) => acc + Number(p.amount), 0);
      totalCashSales = directPayments + creditCash;
    } else {
      // Sistema viejo: sumar el total de la venta si el metodo era CASH (asumido si no hay pagos)
      totalCashSales = activeSession.sales.filter(s => s.status !== 'CANCELLED').reduce((acc, sale) => acc + Number(sale.total), 0);
    }
    const totalIncomes = activeSession.CashMovement.filter(m => m.type === 'IN').reduce((acc, m) => acc + m.amount, 0);
    const totalExpenses = activeSession.CashMovement.filter(m => m.type === 'OUT').reduce((acc, m) => acc + m.amount, 0);
    const expectedBalance = Number(activeSession.openingBalance) + totalCashSales + totalIncomes - totalExpenses;
    const difference = Math.round((declared - expectedBalance) * 100) / 100;

    const closedSession = await prisma.cashRegisterSession.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closingTime: new Date(),
        closingBalance: declared,
        difference: difference
      }
    });

    return NextResponse.json({ ...closedSession, expectedBalance });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error closing session: ' + (error.message || String(error)) }, { status: 500 });
  }
}
