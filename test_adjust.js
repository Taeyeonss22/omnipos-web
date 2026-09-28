const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const branch = await prisma.branch.findFirst();
  const product = await prisma.product.findFirst({ include: { inventories: true } });
  
  if (!product || !branch) {
      console.log("No data");
      return;
  }
  
  console.log("Before:", product.inventories[0].quantity);
  
  const delta = 10;
  await prisma.inventory.upsert({
      where: { branchId_productId: { branchId: branch.id, productId: product.id } },
      update: { quantity: { increment: delta } },
      create: {
        branchId: branch.id,
        productId: product.id,
        quantity: delta,
        minStock: 5
      }
    });
    
  const after = await prisma.product.findFirst({ where: { id: product.id }, include: { inventories: true } });
  console.log("After:", after.inventories[0].quantity);
}
run();
