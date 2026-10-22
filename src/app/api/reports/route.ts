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
  const role = (session.user as any).role;
  const filterBranch = (role === 'ADMIN' || !branchId) ? undefined : branchId;

  const { searchParams } = new URL(request.url);
  const startDateParam = searchParams.get('startDate'); // YYYY-MM-DD
  const endDateParam = searchParams.get('endDate');     // YYYY-MM-DD
  const tzOffsetParam = searchParams.get('tzOffset');   // minutes from getTimezoneOffset(), e.g. 360 for UTC-6

  // Construir rango de fechas preciso respetando la zona horaria del navegador del usuario
  let startDate: Date;
  let endDate: Date;
  const tzOffsetMin = tzOffsetParam !== null ? parseInt(tzOffsetParam, 10) : 360;

  if (startDateParam && endDateParam) {
    const [sy, sm, sd] = startDateParam.split('-').map(Number);
    const [ey, em, ed] = endDateParam.split('-').map(Number);
    startDate = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0, 0) + tzOffsetMin * 60000);
    endDate = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999) + tzOffsetMin * 60000);
  } else {
    const now = new Date();
    endDate = now;
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  try {
    // 1. Obtener todas las ventas dentro del rango de fechas
    const sales = await prisma.sale.findMany({
      where: {
        ...(filterBranch ? { branchId: filterBranch } : {}),
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        customer: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              include: { category: true },
            },
          },
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Obtener abonos de clientes a crédito en el rango
    const creditPayments = await prisma.creditPayment.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
        ...(filterBranch ? { session: { register: { branchId: filterBranch } } } : {}),
      },
      include: {
        credit: { include: { customer: true } },
      },
      orderBy: { date: 'desc' },
    });

    // 3. Obtener Movimientos de Caja (Ingresos / Retiros) en el rango
    const cashMovements = await prisma.cashMovement.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(filterBranch ? { session: { register: { branchId: filterBranch } } } : {}),
      },
      include: {
        session: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            register: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 4. Obtener Cortes Z (Sesiones cerradas en el rango o abiertas)
    const sessions = await prisma.cashRegisterSession.findMany({
      where: {
        ...(filterBranch ? { register: { branchId: filterBranch } } : {}),
        status: 'CLOSED',
        closingTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        user: true,
        register: true,
        sales: { where: { status: { not: 'CANCELLED' } } },
        payments: true,
        creditPayments: true,
        CashMovement: true,
      },
      orderBy: { closingTime: 'desc' },
    });

    // 5. Obtener Inventario para Valoración y Alertas de Stock
    const inventories = await prisma.inventory.findMany({
      where: filterBranch ? { branchId: filterBranch } : {},
      include: {
        product: { include: { category: true } },
        branch: true,
      },
    });

    // --- PROCESAMIENTO Y AGREGACIÓN DE MÉTRICAS ---
    const validSales = sales.filter((s) => s.status !== 'CANCELLED');
    const cancelledSales = sales.filter((s) => s.status === 'CANCELLED');

    let grossSales = 0;
    let totalCost = 0;
    let totalItemsSold = 0;
    let returnsTotal = 0;
    let returnsCount = 0;

    const paymentBreakdown: Record<string, number> = {
      CASH: 0,
      CARD: 0,
      TRANSFER: 0,
      CREDIT: 0,
    };

    const dailyMap: Record<
      string,
      {
        date: string;
        tickets: number;
        itemsSold: number;
        revenue: number;
        cost: number;
        profit: number;
        cash: number;
        card: number;
        transfer: number;
        credit: number;
      }
    > = {};

    const productMap: Record<
      string,
      {
        id: string;
        code: string;
        name: string;
        category: string;
        quantity: number;
        revenue: number;
        cost: number;
        profit: number;
        price: number;
        unitCost: number;
      }
    > = {};

    const categoryMap: Record<
      string,
      {
        name: string;
        quantity: number;
        revenue: number;
        cost: number;
        profit: number;
      }
    > = {};

    const cashierMap: Record<
      string,
      {
        id: string;
        name: string;
        tickets: number;
        itemsSold: number;
        revenue: number;
        cancelled: number;
      }
    > = {};

    // Contabilizar canceladas por cajero
    for (const cSale of cancelledSales) {
      const cId = cSale.userId;
      const cName = cSale.user ? `${cSale.user.firstName} ${cSale.user.lastName}`.trim() : 'Cajero';
      if (!cashierMap[cId]) {
        cashierMap[cId] = { id: cId, name: cName, tickets: 0, itemsSold: 0, revenue: 0, cancelled: 0 };
      }
      cashierMap[cId].cancelled += 1;
    }

    for (const sale of validSales) {
      const saleTotal = Number(sale.total || 0);
      grossSales += saleTotal;

      if (saleTotal < 0) {
        returnsTotal += Math.abs(saleTotal);
        returnsCount += 1;
      }

      // Día local basado en tzOffsetMin
      const localTime = new Date(new Date(sale.createdAt).getTime() - tzOffsetMin * 60000);
      const dayKey = localTime.toISOString().slice(0, 10);

      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = {
          date: dayKey,
          tickets: 0,
          itemsSold: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          cash: 0,
          card: 0,
          transfer: 0,
          credit: 0,
        };
      }
      dailyMap[dayKey].tickets += 1;
      dailyMap[dayKey].revenue += saleTotal;

      // Pagos de la venta
      if (sale.payments && sale.payments.length > 0) {
        for (const p of sale.payments) {
          const method = (p.method || 'CASH').toUpperCase();
          const amt = Number(p.amount || 0);
          paymentBreakdown[method] = (paymentBreakdown[method] || 0) + amt;
          if (method === 'CASH') dailyMap[dayKey].cash += amt;
          else if (method === 'CARD') dailyMap[dayKey].card += amt;
          else if (method === 'TRANSFER') dailyMap[dayKey].transfer += amt;
          else if (method === 'CREDIT') dailyMap[dayKey].credit += amt;
        }
      } else {
        paymentBreakdown.CASH += saleTotal;
        dailyMap[dayKey].cash += saleTotal;
      }

      // Cajero
      const cId = sale.userId;
      const cName = sale.user ? `${sale.user.firstName} ${sale.user.lastName}`.trim() : 'Cajero';
      if (!cashierMap[cId]) {
        cashierMap[cId] = { id: cId, name: cName, tickets: 0, itemsSold: 0, revenue: 0, cancelled: 0 };
      }
      cashierMap[cId].tickets += 1;
      cashierMap[cId].revenue += saleTotal;

      // Artículos de la venta
      let saleCost = 0;
      for (const item of sale.items) {
        const qty = Number(item.quantity || 0);
        const itemSubtotal = Number(item.subtotal || 0);
        const unitCost = Number(item.product?.cost || 0);
        const itemCost = qty * unitCost;
        const itemProfit = itemSubtotal - itemCost;

        totalItemsSold += qty;
        totalCost += itemCost;
        saleCost += itemCost;

        dailyMap[dayKey].itemsSold += qty;
        cashierMap[cId].itemsSold += qty;

        const pId = item.productId;
        const pCode = item.product?.code || 'S/C';
        const pName = item.product?.name || 'Producto Eliminado';
        const catName = item.product?.category?.name || 'Sin Categoría';

        if (!productMap[pId]) {
          productMap[pId] = {
            id: pId,
            code: pCode,
            name: pName,
            category: catName,
            quantity: 0,
            revenue: 0,
            cost: 0,
            profit: 0,
            price: Number(item.product?.price || item.unitPrice || 0),
            unitCost,
          };
        }
        productMap[pId].quantity += qty;
        productMap[pId].revenue += itemSubtotal;
        productMap[pId].cost += itemCost;
        productMap[pId].profit += itemProfit;

        if (!categoryMap[catName]) {
          categoryMap[catName] = {
            name: catName,
            quantity: 0,
            revenue: 0,
            cost: 0,
            profit: 0,
          };
        }
        categoryMap[catName].quantity += qty;
        categoryMap[catName].revenue += itemSubtotal;
        categoryMap[catName].cost += itemCost;
        categoryMap[catName].profit += itemProfit;
      }

      dailyMap[dayKey].cost += saleCost;
      dailyMap[dayKey].profit += saleTotal - saleCost;
    }

    // Movimientos de caja (Egresos e Ingresos extras)
    const totalIncomes = cashMovements
      .filter((m) => m.type === 'IN')
      .reduce((acc, m) => acc + Number(m.amount || 0), 0);
    const totalExpenses = cashMovements
      .filter((m) => m.type === 'OUT')
      .reduce((acc, m) => acc + Number(m.amount || 0), 0);

    // Abonos de crédito recibidos en el periodo
    const totalCreditPaymentsReceived = creditPayments.reduce(
      (acc, cp) => acc + Number(cp.amount || 0),
      0
    );

    const grossProfit = grossSales - totalCost;
    const netProfitAfterExpenses = grossProfit - totalExpenses;
    const profitMargin = grossSales > 0 ? (grossProfit / grossSales) * 100 : 0;
    const avgTicket = validSales.length > 0 ? grossSales / validSales.length : 0;

    // Formatear Cortes Z
    const zReports = sessions.map((s) => {
      const sSalesTotal = s.sales.reduce((acc, sale) => acc + Number(sale.total), 0);
      const sIncomes = s.CashMovement.filter((m) => m.type === 'IN').reduce((acc, m) => acc + Number(m.amount), 0);
      const sExpenses = s.CashMovement.filter((m) => m.type === 'OUT').reduce((acc, m) => acc + Number(m.amount), 0);
      return {
        id: s.id,
        cashier: `${s.user.firstName} ${s.user.lastName}`.trim() || s.user.email,
        register: s.register.name,
        openedAt: s.openingTime,
        closedAt: s.closingTime,
        openingBalance: Number(s.openingBalance),
        closingBalance: Number(s.closingBalance || 0),
        difference: Number(s.difference || 0),
        totalSales: sSalesTotal,
        incomes: sIncomes,
        expenses: sExpenses,
        salesCount: s.sales.length,
      };
    });

    // Resumen de Inventario actual
    let totalInventoryUnits = 0;
    let totalInventoryCostValue = 0;
    let totalInventoryRetailValue = 0;

    const inventoryReport = inventories.map((inv) => {
      const qty = Number(inv.quantity || 0);
      const cost = Number(inv.product?.cost || 0);
      const price = Number(inv.product?.price || 0);
      const totalCostVal = qty * cost;
      const totalRetailVal = qty * price;

      if (qty > 0) {
        totalInventoryUnits += qty;
        totalInventoryCostValue += totalCostVal;
        totalInventoryRetailValue += totalRetailVal;
      }

      return {
        id: inv.id,
        code: inv.product?.code || '',
        name: inv.product?.name || '',
        category: inv.product?.category?.name || 'General',
        branch: inv.branch?.name || 'Principal',
        quantity: qty,
        minStock: Number(inv.minStock || 0),
        cost,
        price,
        totalCostVal,
        totalRetailVal,
        expectedProfit: totalRetailVal - totalCostVal,
        isLowStock: qty <= Number(inv.minStock || 5),
      };
    });

    // Lista de tickets detallados para exportar o auditar
    const salesList = sales.map((s) => ({
      id: s.id,
      folio: s.folio,
      createdAt: s.createdAt,
      cashier: s.user ? `${s.user.firstName} ${s.user.lastName}`.trim() : 'Cajero',
      customer: s.customer?.name || 'Público en General',
      status: s.status,
      method: s.payments?.[0]?.method || 'CASH',
      itemsCount: s.items.reduce((acc, i) => acc + i.quantity, 0),
      itemsSummary: s.items.map((i) => `${i.quantity}x ${i.product?.name || 'Prod'}`).join(', '),
      subtotal: Number(s.subtotal),
      total: Number(s.total),
      cost: s.items.reduce((acc, i) => acc + i.quantity * Number(i.product?.cost || 0), 0),
    }));

    return NextResponse.json({
      summary: {
        grossSales,
        totalCost,
        grossProfit,
        netProfitAfterExpenses,
        profitMargin,
        ticketsCount: validSales.length,
        cancelledCount: cancelledSales.length,
        CancelledTotal: cancelledSales.reduce((acc, s) => acc + Number(s.total || 0), 0),
        avgTicket,
        totalItemsSold,
        returnsTotal,
        returnsCount,
        totalIncomes,
        totalExpenses,
        totalCreditPaymentsReceived,
        paymentBreakdown,
      },
      dailySales: Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date)),
      topProducts: Object.values(productMap).sort((a, b) => b.quantity - a.quantity),
      categories: Object.values(categoryMap).sort((a, b) => b.revenue - a.revenue),
      cashiers: Object.values(cashierMap).sort((a, b) => b.revenue - a.revenue),
      cashMovements: cashMovements.map((m) => ({
        id: m.id,
        type: m.type,
        amount: Number(m.amount),
        reason: m.reason,
        createdAt: m.createdAt,
        register: m.session?.register?.name || 'Caja',
        cashier: m.session?.user ? `${m.session.user.firstName} ${m.session.user.lastName}`.trim() : 'Cajero',
      })),
      zReports,
      salesList,
      inventory: {
        summary: {
          totalUnits: totalInventoryUnits,
          totalCostValue: totalInventoryCostValue,
          totalRetailValue: totalInventoryRetailValue,
          expectedProfit: totalInventoryRetailValue - totalInventoryCostValue,
          lowStockCount: inventoryReport.filter((i) => i.isLowStock).length,
        },
        items: inventoryReport.sort((a, b) => a.quantity - b.quantity),
      },
    });
  } catch (error: any) {
    console.error('Error in /api/reports:', error);
    return NextResponse.json({ error: 'Error generando reportes: ' + error.message }, { status: 500 });
  }
}
