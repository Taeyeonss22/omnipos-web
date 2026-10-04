import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let branchId = (session.user as any).branchId || undefined;
  if (!branchId) {
    const firstBranch = await prisma.branch.findFirst();
    if (firstBranch) branchId = firstBranch.id;
  }
  const role = (session.user as any).role;

  try {
    const filter = (role === 'ADMIN' || !branchId) ? {} : { branchId };
    const sales = await prisma.sale.findMany({
      where: filter,
      include: {
        user: { select: { firstName: true, lastName: true } },
        items: { include: { product: true } },
        payments: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    return NextResponse.json(sales);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  let branchId = (session.user as any).branchId || undefined;
  if (!branchId) {
    const firstBranch = await prisma.branch.findFirst();
    if (firstBranch) branchId = firstBranch.id;
  }

  try {
    const data = await request.json();
    const { items, paymentMethod, customerId, sessionId } = data; 
    // items: Array of { productId, quantity, unitPrice, subtotal }
    
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Sale must have items' }, { status: 400 });
    }

    const subtotal = items.reduce((acc: number, item: any) => acc + item.subtotal, 0);
    const tax = 0;
    const total = subtotal + tax;
    const folio = `V-${Date.now().toString().slice(-6)}`;

    // Transacción ACID: Todo o nada
    const sale = await prisma.$transaction(async (tx) => {
      // 1. Crear la venta
      const newSale = await tx.sale.create({
        data: {
          folio,
          branchId,
          userId,
          customerId,
          sessionId,
          subtotal,
          tax,
          discount: 0,
          total,
          status: 'COMPLETED',
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            })),
          },
          payments: {
            create: [{
              method: paymentMethod || 'CASH',
              amount: total,
            }]
          }
        },
        include: {
          items: {
            include: { product: true }
          }
        }
      });

      // 2. Descontar Inventario
      for (const item of items) {
        const inventory = await tx.inventory.findUnique({
          where: { branchId_productId: { branchId, productId: item.productId } }
        });

        if (!inventory || inventory.quantity < item.quantity) {
          throw new Error(`Stock insuficiente para el producto ID: ${item.productId}`);
        }

        await tx.inventory.update({
          where: { id: inventory.id },
          data: { quantity: { decrement: item.quantity } }
        });
      }

      // 3. Afectar Crédito si aplica
      if (paymentMethod === 'CREDIT') {
        if (!customerId) throw new Error('Se requiere seleccionar un cliente para pago a crédito');
        
        const customer = await tx.customer.findUnique({ where: { id: customerId }, include: { credit: true } });
        if (!customer || !customer.credit) throw new Error('El cliente no tiene línea de crédito activa');
        
        const newBalance = Number(customer.credit.balance) + total;
        if (newBalance > Number(customer.credit.creditLimit)) {
          throw new Error('Límite de crédito excedido');
        }

        await tx.customerCredit.update({
          where: { customerId: customer.id },
          data: { balance: newBalance }
        });
      }

      return newSale;
    });

    // 3. Auditoría (fuera de la transacción para no bloquearla, pero asumiendo éxito)
    await createAuditLog({
      userId,
      branchId,
      action: 'CREATE_SALE',
      entity: 'SALE',
      entityId: sale.id,
      details: { folio: sale.folio, total: sale.total }
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error: any) {
    console.error('Error in POS Transaction:', error);
    return NextResponse.json({ error: error.message || 'Transaction failed' }, { status: 500 });
  }
}
