import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'windows'; // 'windows' o 'mac'

  const fileName = type === 'windows' ? 'instalar-offline-windows.bat' : 'instalar-offline-mac.sh';
  const filePath = path.join(process.cwd(), 'scripts', fileName);

  try {
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Instalador no encontrado' }, { status: 404 });
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');

    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': type === 'windows' ? 'application/x-bat' : 'application/x-sh',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Error al descargar instalador: ' + error.message }, { status: 500 });
  }
}
