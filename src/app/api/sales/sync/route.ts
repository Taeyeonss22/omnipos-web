import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import crypto from 'crypto';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const branchId = (session.user as any).branchId;

  try {
    const { sales } = await request.json(); // array of offline sales

    if (!Array.isArray(sales) || sales.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const processedFolios: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (const pendingSale of sales) {
        // Calculate totals dynamically again for security (trust no client)
        const subtotal = pendingSale.items.reduce((acc: number, item: any) => acc + (item.quantity * item.unitPrice), 0);
        const tax = subtotal * 0.16;
        const total = subtotal + tax;

        // Generate folio if missing
        const folio = `TK-OFF-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

        // Create Sale
        const sale = await tx.sale.create({
          data: {
            folio,
            branchId,
            userId,
            sessionId: pendingSale.sessionId,
            customerId: pendingSale.customerId || null,
            subtotal,
            tax,
            discount: 0,
            total,
            status: 'COMPLETED',
            items: {
              create: pendingSale.items.map((item: any) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                subtotal: item.quantity * item.unitPrice
              }))
            },
            payments: {
              create: [
                {
                  method: pendingSale.paymentMethod,
                  amount: total
                }
              ]
            }
          }
        });

        // Deduct inventory
        for (const item of pendingSale.items) {
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
      }
    });

    await createAuditLog({
      userId,
      branchId,
      action: 'SYNC_OFFLINE_SALES',
      entity: 'SALE',
      entityId: 'BULK',
      details: { count: processedFolios.length, folios: processedFolios }
    });

    return NextResponse.json({ success: true, count: processedFolios.length, folios: processedFolios });
  } catch (error: any) {
    console.error('Offline Sync Error:', error);
    return NextResponse.json({ error: 'Error sincronizando ventas', details: error.message }, { status: 500 });
  }
}
