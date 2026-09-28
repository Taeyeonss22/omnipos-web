import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await request.json();
    const newRegister = await prisma.cashRegister.create({
      data: {
        name: data.name,
        branchId: data.branchId
      }
    });
    return NextResponse.json(newRegister, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error creating register' }, { status: 500 });
  }
}
