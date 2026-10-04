const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const product = await prisma.product.findFirst({
        where: {
            saleItems: { none: {} },
            purchaseOrderItems: { none: {} },
            transferItems: { none: {} }
        }
    });
    if (!product) { console.log("No product safe to delete"); return; }
    console.log("Safe to delete:", product.name);
    
    // Attempt delete
    await prisma.inventory.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
    console.log("SUCCESS!");
  } catch(e) {
    console.error("CRASH:", e);
  }
}
run();
