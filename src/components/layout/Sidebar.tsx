'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  Truck,
  Settings,
  LogOut,
  Receipt
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  userRole: string;
}

export default function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
    { name: 'Caja / POS', href: '/dashboard/pos', icon: ShoppingCart, roles: ['ADMIN', 'CASHIER'] },
    { name: 'Inventario', href: '/dashboard/inventory', icon: Package, roles: ['ADMIN', 'MANAGER'] },
    { name: 'Compras', href: '/dashboard/purchases', icon: Truck, roles: ['ADMIN', 'MANAGER'] },
    { name: 'Traspasos', href: '/dashboard/transfers', icon: Truck, roles: ['ADMIN', 'MANAGER'] },
    { name: 'Clientes', href: '/dashboard/customers', icon: Users, roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
    { name: 'Reportes', href: '/dashboard/reports', icon: Receipt, roles: ['ADMIN', 'MANAGER'] },
    { name: 'Configuración', href: '/dashboard/settings', icon: Settings, roles: ['ADMIN'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(userRole));

  return (
    <div className="flex w-64 flex-col border-r bg-white">
      <div className="flex h-20 items-center gap-3 border-b px-6">
        <img src="/logo.jpg" alt="Logo" className="h-10 w-10 rounded-md object-contain bg-black" />
        <h1 className="text-xl font-bold text-gray-900 tracking-tight uppercase">CRIMEN SANTO</h1>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {filteredMenu.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive 
                  ? "bg-blue-50 text-blue-700" 
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <LogOut className="h-5 w-5" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
