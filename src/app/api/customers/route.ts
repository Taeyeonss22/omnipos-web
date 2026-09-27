import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const customers = await prisma.customer.findMany({
      include: {
        credit: true
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(customers);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching customers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await request.json();
    const { name, email, phone, rfc, creditLimit } = data;

    const newCustomer = await prisma.customer.create({
      data: {
        name,
        email,
        phone,
        rfc,
        ...(creditLimit && parseFloat(creditLimit) > 0 ? {
          credit: {
            create: {
              creditLimit: parseFloat(creditLimit),
              balance: 0
            }
          }
        } : {})
      },
      include: { credit: true }
    });

    return NextResponse.json(newCustomer, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error creating customer' }, { status: 500 });
  }
}
