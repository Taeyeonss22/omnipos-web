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

  const branchId = (session.user as any).branchId || undefined;

  try {
    const items = await request.json();
    
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 });
    }

    let imported = 0;
    
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        // Skip if no name
        if (!item.name) continue;

        const customer = await tx.customer.create({
          data: {
            name: item.name,
            email: item.email || null,
            phone: item.phone || null,
            rfc: item.rfc || null,
            ...(item.creditLimit && parseFloat(item.creditLimit) > 0 ? {
              credit: {
                create: {
                  creditLimit: parseFloat(item.creditLimit),
                  balance: parseFloat(item.balance || '0')
                }
              }
            } : {})
          }
        });
        imported++;
      }
    });

    await createAuditLog({
      userId: session.user.id,
      branchId: branchId,
      action: 'BULK_IMPORT_CUSTOMERS',
      entity: 'CUSTOMER',
      entityId: 'BULK',
      details: { count: imported }
    });

    return NextResponse.json({ success: true, count: imported }, { status: 201 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to import customers', details: error.message }, { status: 500 });
  }
}
