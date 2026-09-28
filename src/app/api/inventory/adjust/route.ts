import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'MANAGER'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let branchId = (session.user as any).branchId || undefined;
  if (!branchId) {
    const firstBranch = await prisma.branch.findFirst();
    if (firstBranch) branchId = firstBranch.id;
  }

  try {
    const data = await request.json();
    const { productId, newQuantity, reason, snapshotStock } = data;

    if (!productId || newQuantity === undefined || !reason || snapshotStock === undefined) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const delta = parseInt(newQuantity) - parseInt(snapshotStock);

    const inventory = await prisma.inventory.upsert({
      where: { branchId_productId: { branchId, productId } },
      update: { quantity: { increment: delta } }, // ¡La magia del delta para ventas concurrentes!
      create: {
        branchId,
        productId,
        quantity: parseInt(newQuantity), // Si no existía, tomamos el físico
        minStock: 5
      }
    });

    await createAuditLog({
      userId: session.user.id,
      branchId: branchId,
      action: 'INVENTORY_ADJUSTMENT',
      entity: 'INVENTORY',
      entityId: inventory.id,
      details: { newQuantity, reason, productId }
    });

    return NextResponse.json(inventory, { status: 200 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Error ajustando inventario', details: error.message }, { status: 500 });
  }
}
