import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import crypto from 'crypto';
import { resolveBranchId } from '@/lib/session';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const branchId = await resolveBranchId(session);
  if (!branchId) return NextResponse.json({ error: 'No hay ninguna sucursal registrada' }, { status: 400 });

  try {
    const { sales } = await request.json(); // array of offline sales

    if (!Array.isArray(sales) || sales.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const processedFolios: string[] = [];
    const syncedIds: string[] = [];

    // Turnos del usuario: solo se aceptan ventas ligadas a un turno propio
    const userSessions = await prisma.cashRegisterSession.findMany({
      where: { userId },
      select: { id: true }
    });
    const ownSessionIds = new Set(userSessions.map(s => s.id));

    await prisma.$transaction(async (tx) => {
      for (const pendingSale of sales) {
        const normalizedItems = (pendingSale.items || []).map((item: any) => {
          const productId = item.product?.id || item.productId;
          const unitPrice = Number(item.product?.price ?? item.unitPrice ?? 0);
          const quantity = Number(item.quantity ?? 1);
          const subtotal = item.subtotal !== undefined ? Number(item.subtotal) : quantity * unitPrice;
          return { productId, quantity, unitPrice, subtotal };
        }).filter((item: any) => Boolean(item.productId));

        if (normalizedItems.length === 0) {
          if (pendingSale.id) syncedIds.push(String(pendingSale.id));
          continue;
        }

        // Folio determinístico a partir del id local: si el navegador reintenta
        // el envío (p. ej. se perdió la respuesta), la venta NO se duplica.
        const folio = pendingSale.id
          ? `TK-OFF-${String(pendingSale.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase()}`
          : `TK-OFF-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
        const alreadySynced = await tx.sale.findUnique({ where: { folio }, select: { id: true } });
        if (alreadySynced) {
          if (pendingSale.id) syncedIds.push(String(pendingSale.id));
          continue;
        }

        const sessionId = pendingSale.sessionId && ownSessionIds.has(pendingSale.sessionId)
          ? pendingSale.sessionId
          : null;

        const subtotal = normalizedItems.reduce((acc: number, item: any) => acc + item.subtotal, 0);
        const tax = 0;
        const total = subtotal + tax;

        // Create Sale
        const sale = await tx.sale.create({
          data: {
            folio,
            branchId,
            userId,
            sessionId,
            customerId: pendingSale.customerId || null,
            subtotal,
            tax,
            discount: 0,
            total,
            status: 'COMPLETED',
            // Conservar la hora real en que se cobró sin internet
            ...(pendingSale.timestamp ? { createdAt: new Date(Number(pendingSale.timestamp)) } : {}),
            items: {
              create: normalizedItems.map((item: any) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                subtotal: item.subtotal
              }))
            },
            payments: {
              create: [
                {
                  method: pendingSale.paymentMethod || 'CASH',
                  amount: total,
                  sessionId
                }
              ]
            }
          }
        });

        // Deduct inventory
        for (const item of normalizedItems) {
          const inv = await tx.inventory.findUnique({
            where: { branchId_productId: { branchId, productId: item.productId } }
          });
          if (inv) {
            await tx.inventory.update({
              where: { branchId_productId: { branchId, productId: item.productId } },
              data: { quantity: { decrement: item.quantity } }
            });
          }
        }

        // Handle Credit
        if (pendingSale.paymentMethod === 'CREDIT' && pendingSale.customerId) {
          const credit = await tx.customerCredit.findUnique({ where: { customerId: pendingSale.customerId } });
          if (credit) {
            await tx.customerCredit.update({
              where: { customerId: pendingSale.customerId },
              data: { balance: { increment: total } }
            });
          }
        }

        processedFolios.push(sale.folio);
        if (pendingSale.id) syncedIds.push(String(pendingSale.id));
      }
    }, { timeout: 30000 });

    await createAuditLog({
      userId,
      branchId,
      action: 'SYNC_OFFLINE_SALES',
      entity: 'SALE',
      entityId: 'BULK',
      details: { count: processedFolios.length, folios: processedFolios }
    });

    return NextResponse.json({ success: true, count: processedFolios.length, folios: processedFolios, syncedIds });
  } catch (error: any) {
    console.error('Offline Sync Error:', error);
    return NextResponse.json({ error: 'Error sincronizando ventas', details: error.message }, { status: 500 });
  }
}
