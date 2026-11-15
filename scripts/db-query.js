const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- ROLES ---');
  const roles = await prisma.role.findMany();
  console.log(roles.map(r => ({ id: r.id, name: r.name, permissions: r.permissions })));

  console.log('--- SUCURSALES (BRANCHES) ---');
  const branches = await prisma.branch.findMany({ include: { cashRegisters: true } });
  console.log(branches.map(b => ({ id: b.id, name: b.name, registers: b.cashRegisters.map(c => c.name) })));

  console.log('--- USUARIOS ---');
  const users = await prisma.user.findMany({ include: { role: true, branch: true } });
  console.log(users.map(u => ({ id: u.id, email: u.email, name: `${u.firstName} ${u.lastName}`, role: u.role?.name, branch: u.branch?.name })));
}

main()
  .catch(e => {
    console.error('Error connecting to DB:', e.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
