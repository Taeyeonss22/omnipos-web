const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const registers = await prisma.cashRegister.findMany();
  console.log("Registers:", registers.length);
}
check();
