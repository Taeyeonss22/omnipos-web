import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';
import { resolveBranchId } from '@/lib/session';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'MANAGER'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const branchId = await resolveBranchId(session);
  if (!branchId) {
    return NextResponse.json({ error: 'No hay ninguna sucursal registrada' }, { status: 400 });
  }

  try {
    const data = await request.json();
    const { productId, newQuantity, reason, snapshotStock } = data;

    if (!productId || newQuantity === undefined || !reason || snapshotStock === undefined) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const target = parseInt(newQuantity, 10);
    const snapshot = parseInt(snapshotStock, 10);
    if (!Number.isFinite(target) || target < 0 || !Number.isFinite(snapshot)) {
      return NextResponse.json({ error: 'La cantidad capturada no es válida' }, { status: 400 });
    }

    const delta = target - snapshot;

    const inventory = await prisma.inventory.upsert({
      where: { branchId_productId: { branchId, productId } },
      update: { quantity: { increment: delta } }, // ¡La magia del delta para ventas concurrentes!
      create: {
        branchId,
        productId,
        quantity: target, // Si no existía, tomamos el físico
        minStock: 5
      }
    });

    await createAuditLog({
      userId: session.user.id,
      branchId: branchId,
      action: 'INVENTORY_ADJUSTMENT',
      entity: 'INVENTORY',
      entityId: inventory.id,
      details: { newQuantity: target, previous: snapshot, delta, reason, productId }
    });

    return NextResponse.json(inventory, { status: 200 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Error ajustando inventario', details: error.message }, { status: 500 });
  }
}
