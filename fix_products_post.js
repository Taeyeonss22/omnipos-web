const fs = require('fs');
let code = fs.readFileSync('src/app/api/products/route.ts', 'utf8');

// POST
code = code.replace(
  "export async function POST(request: Request) {\n  const session = await getServerSession(authOptions);\n  if (!session || !['ADMIN', 'MANAGER'].includes((session.user as any).role)) {\n    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });\n  }",
  "export async function POST(request: Request) {\n  const session = await getServerSession(authOptions);\n  if (!session || !['ADMIN', 'MANAGER'].includes((session.user as any).role)) {\n    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });\n  }\n\n  let branchId = (session.user as any).branchId || undefined;\n  if (!branchId) {\n    const firstBranch = await prisma.branch.findFirst();\n    if (firstBranch) branchId = firstBranch.id;\n  }"
);
code = code.replace("branchId: (session.user as any).branchId,", "branchId,");
code = code.replace("branchId: (session.user as any).branchId,", "branchId,"); // second time

// PUT
code = code.replace(
  "export async function PUT(request: Request) {\n  const session = await getServerSession(authOptions);\n  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });\n\n  const branchId = (session.user as any).branchId || undefined;",
  "export async function PUT(request: Request) {\n  const session = await getServerSession(authOptions);\n  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });\n\n  let branchId = (session.user as any).branchId || undefined;\n  if (!branchId) {\n    const firstBranch = await prisma.branch.findFirst();\n    if (firstBranch) branchId = firstBranch.id;\n  }"
);

fs.writeFileSync('src/app/api/products/route.ts', code);
