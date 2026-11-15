import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const session = await getServerSession(authOptions);

  const isAuthorized = 
    (session && ['ADMIN', 'MANAGER'].includes((session.user as any).role)) || 
    secret === 'omnipos-offline-secure-key-2026';

  if (!isAuthorized) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const branchId = searchParams.get('branchId');

  try {
    const [roles, users, branches, categories, products, cashRegisters, customers, inventories] = await Promise.all([
      prisma.role.findMany(),
      prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          email: true,
          password: true, // Needed to allow offline login verification
          firstName: true,
          lastName: true,
          isActive: true,
          roleId: true,
          branchId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.branch.findMany(),
      prisma.category.findMany(),
      prisma.product.findMany(),
      prisma.cashRegister.findMany({
        where: { isActive: true },
      }),
      prisma.customer.findMany(),
      prisma.inventory.findMany({
        where: branchId ? { branchId } : {},
      }),
    ]);

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      sourceBranchId: branchId || null,
      data: {
        roles,
        users,
        branches,
        categories,
        products,
        cashRegisters,
        customers,
        inventories,
      },
      counts: {
        products: products.length,
        categories: categories.length,
        users: users.length,
        branches: branches.length,
        cashRegisters: cashRegisters.length,
        customers: customers.length,
      },
    };

    const download = searchParams.get('download');
    if (download === '1') {
      return new NextResponse(JSON.stringify(exportPayload, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="catalogo_offline_${new Date().toISOString().slice(0, 10)}.json"`,
        },
      });
    }

    return NextResponse.json(exportPayload);
  } catch (error: any) {
    console.error('Error exporting offline data:', error);
    return NextResponse.json({ error: 'Error exportando catálogo offline: ' + error.message }, { status: 500 });
  }
}
