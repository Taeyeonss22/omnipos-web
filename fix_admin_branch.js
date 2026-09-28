const fs = require('fs');

function fixFile(file) {
    let code = fs.readFileSync(file, 'utf8');
    
    // Replace branchId definition
    if (code.includes('const branchId = (session.user as any).branchId || undefined;')) {
        code = code.replace(
            'const branchId = (session.user as any).branchId || undefined;',
            `let branchId = (session.user as any).branchId || undefined;
  if (!branchId) {
    const firstBranch = await prisma.branch.findFirst();
    if (firstBranch) branchId = firstBranch.id;
  }`
        );
        fs.writeFileSync(file, code);
        console.log('Fixed', file);
    }
}

fixFile('src/app/api/inventory/adjust/route.ts');
fixFile('src/app/api/products/route.ts');
fixFile('src/app/api/purchases/route.ts');
fixFile('src/app/api/sales/route.ts');
