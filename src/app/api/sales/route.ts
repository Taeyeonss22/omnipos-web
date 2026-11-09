import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { BusinessError, makeFolio, resolveBranchId } from '@/lib/session';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const branchId = await resolveBranchId(session);
  const role = session.user.role;

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(`${startDate}T00:00:00`);
    }
    if (endDate) {
      dateFilter.lte = new Date(`${endDate}T23:59:59.999`);
    }

    const filter: any = (role === 'ADMIN' || !branchId) ? {} : { branchId };
    if (startDate || endDate) {
      filter.createdAt = dateFilter;
    }
    if (status) {
      filter.status = status;
    }

    // Los apartados activos se listan completos (no solo los últimos 100),
    // para que un apartado viejo no "desaparezca" de la pantalla de abonos.
    const take = status === 'LAYAWAY' ? undefined : (startDate || endDate) ? 500 : 100;

    const sales = await prisma.sale.findMany({
      where: filter,
      include: {
        user: { select: { firstName: true, lastName: true } },
        items: { include: { product: true } },
        payments: true,
        customer: true
      },
      orderBy: { createdAt: 'desc' },
      take
    });
    return NextResponse.json(sales);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const branchId = await resolveBranchId(session);
  if (!branchId) {
    return NextResponse.json({ error: 'No hay ninguna sucursal registrada' }, { status: 400 });
  }

  try {
    const data = await request.json();
    const { items, paymentMethod, customerId, sessionId, status, paymentAmount } = data;
    // items: Array of { product: {id}, quantity } (o { productId, quantity })

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'La venta no tiene artículos' }, { status: 400 });
    }

    const saleStatus = status === 'LAYAWAY' ? 'LAYAWAY' : 'COMPLETED';
    const method = paymentMethod || 'CASH';

    // El turno debe existir, estar abierto y pertenecer al usuario
    const cashSession = sessionId
      ? await prisma.cashRegisterSession.findFirst({ where: { id: sessionId, userId, status: 'OPEN' } })
      : null;
    if (!cashSession) {
      return NextResponse.json({ error: 'No tienes un turno de caja abierto. Abre la caja para cobrar.' }, { status: 400 });
    }

    // Normalizar y agrupar artículos (cantidad entera, distinta de cero)
    const qtyByProduct = new Map<string, number>();
    for (const item of items) {
      const productId = item?.product?.id || item?.productId;
      const quantity = Math.trunc(Number(item?.quantity));
      if (!productId || !Number.isFinite(quantity) || quantity === 0) continue;
      qtyByProduct.set(productId, (qtyByProduct.get(productId) || 0) + quantity);
    }
    for (const [id, q] of qtyByProduct) if (q === 0) qtyByProduct.delete(id);
    if (qtyByProduct.size === 0) {
      return NextResponse.json({ error: 'La venta no tiene artículos válidos' }, { status: 400 });
    }

    // Los precios SIEMPRE se toman de la base de datos, nunca del navegador
    const products = await prisma.product.findMany({ where: { id: { in: [...qtyByProduct.keys()] } } });
    if (products.length !== qtyByProduct.size) {
      return NextResponse.json({ error: 'Algún producto del carrito ya no existe. Recarga el catálogo.' }, { status: 400 });
    }

    const lines = products.map(p => {
      const quantity = qtyByProduct.get(p.id)!;
      return { productId: p.id, name: p.name, quantity, unitPrice: p.price, subtotal: round2(quantity * p.price) };
    });

    const subtotal = round2(lines.reduce((acc, l) => acc + l.subtotal, 0));
    const tax = 0;
    const total = round2(subtotal + tax);

    if (saleStatus === 'LAYAWAY' && total <= 0) {
      return NextResponse.json({ error: 'Un apartado debe tener un total mayor a cero' }, { status: 400 });
    }

    let amountPaid = total;
    if (saleStatus === 'LAYAWAY') {
      amountPaid = round2(Number(paymentAmount ?? 0));
      if (!Number.isFinite(amountPaid) || amountPaid < 0 || amountPaid > total) {
        return NextResponse.json({ error: 'El anticipo no es válido' }, { status: 400 });
      }
      if (!customerId) {
        return NextResponse.json({ error: 'Un apartado requiere un cliente' }, { status: 400 });
      }
    }

    // Transacción ACID: Todo o nada
    const sale = await prisma.$transaction(async (tx) => {
      // 1. Crear la venta
      const newSale = await tx.sale.create({
        data: {
          folio: makeFolio('V'),
          branchId,
          userId,
          customerId: customerId || null,
          sessionId: cashSession.id,
          subtotal,
          tax,
          discount: 0,
          total,
          status: saleStatus,
          items: {
            create: lines.map(l => ({
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              subtotal: l.subtotal,
            })),
          },
          ...(amountPaid !== 0 ? {
            payments: {
              create: [{
                method,
                amount: amountPaid,
                sessionId: cashSession.id,
              }]
            }
          } : {})
        },
        include: {
          items: {
            include: { product: true }
          }
        }
      });

      // 2. Afectar inventario
      for (const line of lines) {
        // Se permite vender aunque el sistema marque 0 piezas (la prenda puede
        // estar físicamente en tienda); el stock queda en negativo y el POS
        // avisa al cajero antes de agregarla. Si el producto no tenía registro
        // de inventario en la sucursal, se crea. Las devoluciones (cantidad
        // negativa) regresan las piezas al inventario.
        await tx.inventory.upsert({
          where: { branchId_productId: { branchId, productId: line.productId } },
          update: { quantity: { decrement: line.quantity } },
          create: { branchId, productId: line.productId, quantity: -line.quantity, minStock: 0 }
        });
      }

      // 3. Afectar Crédito si aplica
      if (method === 'CREDIT') {
        if (!customerId) throw new BusinessError('Se requiere seleccionar un cliente para pago a crédito');

        const customer = await tx.customer.findUnique({ where: { id: customerId }, include: { credit: true } });
        if (!customer || !customer.credit) throw new BusinessError('El cliente no tiene línea de crédito activa');

        const newBalance = Number(customer.credit.balance) + amountPaid;
        if (newBalance > Number(customer.credit.creditLimit)) {
          throw new BusinessError('Límite de crédito excedido');
        }

        await tx.customerCredit.update({
          where: { customerId: customer.id },
          data: { balance: { increment: amountPaid } }
        });
      }

      return newSale;
    });

    // Auditoría (fuera de la transacción para no bloquearla)
    await createAuditLog({
      userId,
      branchId,
      action: saleStatus === 'LAYAWAY' ? 'CREATE_LAYAWAY' : 'CREATE_SALE',
      entity: 'SALE',
      entityId: sale.id,
      details: { folio: sale.folio, total: sale.total }
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error: any) {
    if (error instanceof BusinessError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error in POS Transaction:', error);
    return NextResponse.json({ error: error.message || 'Transaction failed' }, { status: 500 });
  }
}
