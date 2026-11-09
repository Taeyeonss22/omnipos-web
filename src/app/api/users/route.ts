import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const users = await prisma.user.findMany({
      // Nunca enviar el hash de la contraseña al navegador
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        roleId: true,
        branchId: true,
        createdAt: true,
        role: true,
        branch: true
      }
    });
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Solo el administrador puede crear empleados' }, { status: 403 });

  try {
    const data = await request.json();
    const { email, password, firstName, lastName, roleId, branchId } = data;

    if (!email || !password || !firstName || !lastName || !roleId) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        roleId,
        branchId: branchId || null
      }
    });

    return NextResponse.json({ message: 'User created successfully', id: newUser.id }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un empleado con ese usuario/email' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create user', details: error.message }, { status: 500 });
  }
}
