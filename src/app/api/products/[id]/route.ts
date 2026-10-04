import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/audit';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'MANAGER'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'No tienes permisos para eliminar productos' }, { status: 403 });
  }

  const productId = (await Promise.resolve(params)).id;

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        inventories: true,
        saleItems: { take: 1 },
        purchaseOrderItems: { take: 1 },
        transferItems: { take: 1 }
      }
    });

    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    // Proteger integridad referencial: No borrar si ya tiene ventas o compras
    if (product.saleItems.length > 0 || product.purchaseOrderItems.length > 0 || product.transferItems.length > 0) {
      return NextResponse.json({ 
        error: 'No se puede eliminar porque este artículo ya tiene historial de ventas, compras o traspasos. Te recomendamos desactivarlo (función próximamente) o poner su stock en 0.' 
      }, { status: 400 });
    }

    // Borrar de inventario primero (por llaves foráneas)
    await prisma.inventory.deleteMany({
      where: { productId }
    });

    // Borrar producto
    await prisma.product.delete({
      where: { id: productId }
    });

    await createAuditLog({
      userId: session.user.id,
      branchId: (session.user as any).branchId,
      action: 'DELETE_PRODUCT',
      entity: 'PRODUCT',
      entityId: productId,
      details: { code: product.code, name: product.name }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'CRASH: ' + error.message }, { status: 500 });
  }
}
