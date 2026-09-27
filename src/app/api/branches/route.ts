import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const branches = await prisma.branch.findMany({
      orderBy: { name: 'asc' }
    });
    return NextResponse.json(branches);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching branches' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await request.json();
    const newBranch = await prisma.branch.create({
      data: {
        name: data.name,
        address: data.address
      }
    });
    return NextResponse.json(newBranch, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error creating branch' }, { status: 500 });
  }
}
