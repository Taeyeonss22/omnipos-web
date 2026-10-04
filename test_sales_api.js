const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
  try {
    const user = await prisma.user.findFirst();
    const branch = await prisma.branch.findFirst();
    const session = await prisma.cashRegisterSession.findFirst();
    const product = await prisma.product.findFirst();
    
    if(!user || !branch || !session || !product) {
        console.log("Missing data");
        return;
    }
    
    const sale = await prisma.sale.create({
        data: {
          folio: "TEST-123",
          branchId: branch.id,
          userId: user.id,
          sessionId: session.id,
          subtotal: 100,
          tax: 0,
          discount: 0,
          total: 100,
          status: 'COMPLETED',
          items: {
            create: [
              {
                productId: product.id,
                quantity: 1,
                unitPrice: 100,
                subtotal: 100,
              }
            ]
          },
          payments: {
            create: [{
              method: 'CASH',
              amount: 100,
            }]
          }
        },
    });
    console.log("Success:", sale.id);
    
    // Check inventory decrement
    const inventory = await prisma.inventory.findFirst({
        where: { branchId: branch.id, productId: product.id }
    });
    
    await prisma.inventory.update({
        where: { id: inventory.id },
        data: { quantity: { decrement: 1 } }
    });
    console.log("Inventory decremented successfully!");
    
  } catch(e) {
      console.error(e);
  }
}
test();
