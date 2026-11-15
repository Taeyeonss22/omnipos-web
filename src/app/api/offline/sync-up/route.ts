import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'MANAGER'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sessions = [], sales = [], movements = [] } = body;

    let syncedSessionsCount = 0;
    let syncedSalesCount = 0;
    let syncedMovementsCount = 0;

    await prisma.$transaction(async (tx) => {
      // 1. Sincronizar Sesiones de Caja (Turnos y Cortes Z)
      for (const s of sessions) {
        const exists = await tx.cashRegisterSession.findUnique({ where: { id: s.id } });
        if (!exists) {
          await tx.cashRegisterSession.create({
            data: {
              id: s.id,
              registerId: s.registerId,
              userId: s.userId,
              openingTime: new Date(s.openingTime),
              closingTime: s.closingTime ? new Date(s.closingTime) : null,
              openingBalance: Number(s.openingBalance || 0),
              closingBalance: s.closingBalance !== null ? Number(s.closingBalance) : null,
              difference: s.difference !== null ? Number(s.difference) : null,
              status: s.status || 'CLOSED',
            },
          });
          syncedSessionsCount++;
        }
      }

      // 2. Sincronizar Ventas y sus Pagos / Artículos
      for (const sale of sales) {
        const exists = await tx.sale.findUnique({ where: { id: sale.id } });
        if (!exists) {
          const createdSale = await tx.sale.create({
            data: {
              id: sale.id,
              folio: sale.folio,
              branchId: sale.branchId,
              userId: sale.userId,
              customerId: (sale.customerId && sale.customerId.trim() !== '') ? sale.customerId : null,
              sessionId: sale.sessionId || null,
              subtotal: Number(sale.subtotal || 0),
              tax: Number(sale.tax || 0),
              discount: Number(sale.discount || 0),
              total: Number(sale.total || 0),
              status: sale.status || 'COMPLETED',
              createdAt: new Date(sale.createdAt),
              updatedAt: new Date(sale.updatedAt || sale.createdAt),
              items: {
                create: (sale.items || []).map((i: any) => ({
                  productId: i.productId,
                  quantity: Number(i.quantity),
                  unitPrice: Number(i.unitPrice),
                  subtotal: Number(i.subtotal),
                })),
              },
              payments: {
                create: (sale.payments || []).map((p: any) => ({
                  method: p.method || 'CASH',
                  amount: Number(p.amount),
                  sessionId: p.sessionId || sale.sessionId || null,
                  createdAt: new Date(p.createdAt || sale.createdAt),
                })),
              },
            },
          });

          // Descontar inventario en la sucursal
          for (const item of sale.items || []) {
            if (!sale.branchId || !item.productId) continue;
            const inv = await tx.inventory.findUnique({
              where: { branchId_productId: { branchId: sale.branchId, productId: item.productId } },
            });
            if (inv) {
              await tx.inventory.update({
                where: { id: inv.id },
                data: { quantity: { decrement: Number(item.quantity) } },
              });
            } else {
              await tx.inventory.create({
                data: {
                  branchId: sale.branchId,
                  productId: item.productId,
                  quantity: -Number(item.quantity),
                },
              });
            }
          }

          syncedSalesCount++;
        }
      }

      // 3. Sincronizar Movimientos de Caja (Retiros e Ingresos)
      for (const m of movements) {
        const exists = await tx.cashMovement.findUnique({ where: { id: m.id } });
        if (!exists) {
          await tx.cashMovement.create({
            data: {
              id: m.id,
              type: m.type,
              amount: Number(m.amount),
              reason: m.reason,
              sessionId: m.sessionId,
              createdAt: new Date(m.createdAt),
            },
          });
          syncedMovementsCount++;
        }
      }
    });

    await createAuditLog({
      userId: session.user.id,
      branchId: (session.user as any).branchId || undefined,
      action: 'SYNC_OFFLINE_STORE',
      entity: 'STORE',
      entityId: 'OFFLINE_UPLOAD',
      details: { syncedSessionsCount, syncedSalesCount, syncedMovementsCount },
    });

    return NextResponse.json({
      success: true,
      message: 'Sincronización a la nube completada exitosamente.',
      synced: {
        sessions: syncedSessionsCount,
        sales: syncedSalesCount,
        movements: syncedMovementsCount,
      },
    });
  } catch (error: any) {
    console.error('Error syncing up offline data:', error);
    return NextResponse.json({ error: 'Error al sincronizar a la nube: ' + error.message }, { status: 500 });
  }
}
