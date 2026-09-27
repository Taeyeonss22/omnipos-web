const fs = require('fs');
const file = 'src/app/dashboard/pos/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Rename handleCloseRegister to handleCloseRegisterClick
code = code.replace(
  "const handleCloseRegister = async () => {",
  "const handleCloseRegisterClick = () => {\n    if (!isOnline) return alert('Debes estar conectado a internet para cerrar la caja y hacer el corte Z.');\n    if (pendingCount > 0) return alert('Aún tienes ventas pendientes de sincronizar. Espera a que termine antes de cerrar.');\n    setIsCloseModalOpen(true);\n  };\n\n  const processCloseRegister = async (totalAmount: number, breakdown: any) => {"
);

// 2. Replace the prompt and closingBalance definition
code = code.replace(
  "const closingBalance = prompt('Ingresa el monto total final en caja para el corte:');\n    if (!closingBalance) return;",
  ""
);

// 3. Replace closingBalance variable inside JSON.stringify
code = code.replace(
  "body: JSON.stringify({ sessionId: cashSession.id, closingBalance }),",
  "body: JSON.stringify({ sessionId: cashSession.id, closingBalance: totalAmount }),"
);

// 4. Replace the items array in the Z report to include breakdown
const oldItemsStr = "items: [\n                { quantity: 1, product: 'Fondo Inicial', subtotal: cashSession.openingBalance },\n                { quantity: 1, product: 'Ventas Efectivo', subtotal: parseFloat(closingBalance) - cashSession.openingBalance }\n              ],";
const newItemsStr = `items: [
                { quantity: 1, product: 'FONDO INICIAL', subtotal: cashSession.openingBalance },
                { quantity: 1, product: 'VENTAS EFECTIVO', subtotal: totalAmount - cashSession.openingBalance },
                { quantity: breakdown.b1000, product: 'Billetes $1000', subtotal: breakdown.b1000 * 1000 },
                { quantity: breakdown.b500, product: 'Billetes $500', subtotal: breakdown.b500 * 500 },
                { quantity: breakdown.b200, product: 'Billetes $200', subtotal: breakdown.b200 * 200 },
                { quantity: breakdown.b100, product: 'Billetes $100', subtotal: breakdown.b100 * 100 },
                { quantity: breakdown.b50, product: 'Billetes $50', subtotal: breakdown.b50 * 50 },
                { quantity: breakdown.b20, product: 'Billetes $20', subtotal: breakdown.b20 * 20 },
                { quantity: breakdown.m10, product: 'Monedas $10', subtotal: breakdown.m10 * 10 },
                { quantity: breakdown.m5, product: 'Monedas $5', subtotal: breakdown.m5 * 5 },
                { quantity: breakdown.m2, product: 'Monedas $2', subtotal: breakdown.m2 * 2 },
                { quantity: breakdown.m1, product: 'Monedas $1', subtotal: breakdown.m1 * 1 },
                { quantity: breakdown.m05, product: 'Monedas $0.50', subtotal: breakdown.m05 * 0.5 },
              ].filter(i => i.quantity > 0),`;
code = code.replace(oldItemsStr, newItemsStr);

// 5. Fix parseFloat(closingBalance)
code = code.replaceAll("parseFloat(closingBalance)", "totalAmount");

// 6. Fix footer to include signature line
code = code.replace(
  "footer: `Diferencia (Sobrante/Faltante): $${data.difference.toFixed(2)}`,",
  "footer: `Declarado: $${totalAmount.toFixed(2)}\\nDiferencia (Sobrante/Faltante): $${data.difference.toFixed(2)}\\n\\nFirma del Cajero:\\n\\n_________________________`, "
);

// 7. Add setIsCloseModalOpen(false);
code = code.replace(
  "alert(`Caja cerrada exitosamente. Diferencia: $${data.difference}`);",
  "alert(`Caja cerrada exitosamente. Diferencia: $${data.difference}`);\n        setIsCloseModalOpen(false);"
);

// 8. Find button onClick={handleCloseRegister} and change it to handleCloseRegisterClick
code = code.replace(
  "onClick={handleCloseRegister}",
  "onClick={handleCloseRegisterClick}"
);

// 9. Add the modal at the bottom
const modalTag = `
      <CloseRegisterModal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        onConfirm={(total, breakdown) => processCloseRegister(total, breakdown)}
      />
      <TicketPreviewModal`;
code = code.replace("<TicketPreviewModal", modalTag);

fs.writeFileSync(file, code);
console.log("Patched!");
