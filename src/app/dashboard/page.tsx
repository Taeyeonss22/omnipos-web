import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ShoppingCart, Users, Package, AlertCircle } from 'lucide-react';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const branchId = (session?.user as any)?.branchId;

  // Estadísticas rápidas
  const totalProducts = await prisma.product.count();
  
  // Para la demo, traemos algunos datos
  // Si no hay branchId (ej. Admin Principal), filtramos globalmente o por la primera sucursal
  const inventoryWhere = branchId ? { branchId, quantity: { lte: 10 } } : { quantity: { lte: 10 } };
  const lowStockItems = await prisma.inventory.count({
    where: inventoryWhere
  });

  const activeCashesWhere = branchId ? { register: { branchId }, status: 'OPEN' } : { status: 'OPEN' };
  const activeCashes = await prisma.cashRegisterSession.count({
    where: activeCashesWhere
  });

  const stats = [
    { name: 'Total Productos', value: totalProducts, icon: Package, color: 'text-blue-600', bg: 'bg-blue-100' },
    { name: 'Cajas Abiertas', value: activeCashes, icon: ShoppingCart, color: 'text-green-600', bg: 'bg-green-100' },
    { name: 'Alertas de Stock', value: lowStockItems, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Bienvenido, {session?.user?.name}</h1>
        <p className="text-sm text-gray-500">Resumen de tu sucursal para el día de hoy.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="overflow-hidden rounded-lg bg-white p-5 shadow">
              <div className="flex items-center gap-4">
                <div className={`rounded-md p-3 ${stat.bg}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                  <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Acciones Rápidas</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <a
            href="/dashboard/pos"
            className="flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            Abrir Punto de Venta
          </a>
          {/* Aquí podemos agregar más acciones rápidas según el rol */}
        </div>
      </div>
    </div>
  );
}
