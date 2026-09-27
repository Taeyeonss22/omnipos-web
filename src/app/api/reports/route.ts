import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'MANAGER'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const branchId = (session.user as any).branchId || undefined;

  try {
    // 1. Obtener Cortes Z (Sesiones de caja cerradas)
    const sessions = await prisma.cashRegisterSession.findMany({
      where: {
        register: { branchId },
        status: 'CLOSED' // Solo cortes finalizados
      },
      include: {
        user: true,
        register: true,
        sales: true
      },
      orderBy: { closingTime: 'desc' },
      take: 20
    });

    // 2. Calcular totales generales del día (Omitido por simplicidad, los sacaremos de las sesiones)
    const reports = sessions.map(s => {
      const totalSales = s.sales.reduce((acc, sale) => acc + Number(sale.total), 0);
      return {
        id: s.id,
        cashier: s.user.name,
        register: s.register.name,
        openedAt: s.openingTime,
        closedAt: s.closingTime,
        openingBalance: Number(s.openingBalance),
        closingBalance: Number(s.closingBalance),
        difference: Number(s.difference),
        totalSales,
        salesCount: s.sales.length
      };
    });

    return NextResponse.json(reports);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching reports' }, { status: 500 });
  }
}
