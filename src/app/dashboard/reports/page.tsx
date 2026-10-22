'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  Calendar,
  Printer,
  Download,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Users,
  ArrowDownUp,
  Package,
  CreditCard,
  Banknote,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  Award,
  BarChart3,
} from 'lucide-react';

type ReportTab = 'summary' | 'products' | 'cashiers' | 'movements' | 'zreports' | 'inventory' | 'tickets';

function getLocalYYYYMMDD(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ReportsPage() {
  const todayStr = getLocalYYYYMMDD(new Date());
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [activePreset, setActivePreset] = useState<string>('today');
  const [activeTab, setActiveTab] = useState<ReportTab>('summary');

  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [productSearch, setProductSearch] = useState<string>('');
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'low'>('all');

  const fetchReports = useCallback(async (start: string, end: string) => {
    setIsLoading(true);
    try {
      const tzOffset = new Date().getTimezoneOffset();
      const res = await fetch(
        `/api/reports?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}&tzOffset=${tzOffset}`
      );
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (error) {
      console.error('Error cargando reportes:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports(startDate, endDate);
  }, [fetchReports, startDate, endDate]);

  const applyPreset = (preset: string) => {
    setActivePreset(preset);
    const now = new Date();
    const end = getLocalYYYYMMDD(now);

    if (preset === 'today') {
      setStartDate(end);
      setEndDate(end);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = getLocalYYYYMMDD(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === '7days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      setStartDate(getLocalYYYYMMDD(d));
      setEndDate(end);
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(getLocalYYYYMMDD(firstDay));
      setEndDate(end);
    } else if (preset === 'lastMonth') {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(getLocalYYYYMMDD(firstDayLastMonth));
      setEndDate(getLocalYYYYMMDD(lastDayLastMonth));
    }
  };

  const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const escapeCell = (val: string | number) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const csvContent =
      '\uFEFF' +
      [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}_${startDate}_a_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportActiveTab = () => {
    if (!reportData) return;

    if (activeTab === 'summary') {
      downloadCSV(
        'Reporte_Ventas_Por_Dia',
        ['Fecha', 'Tickets', 'Articulos Vendidos', 'Efectivo', 'Tarjeta', 'Transferencia', 'Credito', 'Venta Total', 'Costo Total', 'Utilidad Bruta'],
        (reportData.dailySales || []).map((d: any) => [
          d.date,
          d.tickets,
          d.itemsSold,
          d.cash.toFixed(2),
          d.card.toFixed(2),
          d.transfer.toFixed(2),
          d.credit.toFixed(2),
          d.revenue.toFixed(2),
          d.cost.toFixed(2),
          d.profit.toFixed(2),
        ])
      );
    } else if (activeTab === 'products') {
      downloadCSV(
        'Reporte_Productos_Vendidos',
        ['Codigo', 'Producto', 'Categoria', 'Unidades Vendidas', 'Precio Venta', 'Costo Unit.', 'Ingreso Total', 'Costo Total', 'Utilidad Generada'],
        (reportData.topProducts || []).map((p: any) => [
          p.code,
          p.name,
          p.category,
          p.quantity,
          p.price.toFixed(2),
          p.unitCost.toFixed(2),
          p.revenue.toFixed(2),
          p.cost.toFixed(2),
          p.profit.toFixed(2),
        ])
      );
    } else if (activeTab === 'cashiers') {
      downloadCSV(
        'Reporte_Desempeno_Cajeros',
        ['Cajero', 'Tickets Cobrados', 'Articulos Vendidos', 'Tickets Cancelados', 'Total Vendido'],
        (reportData.cashiers || []).map((c: any) => [
          c.name,
          c.tickets,
          c.itemsSold,
          c.cancelled,
          c.revenue.toFixed(2),
        ])
      );
    } else if (activeTab === 'movements') {
      downloadCSV(
        'Reporte_Ingresos_Egresos_Caja',
        ['Fecha y Hora', 'Tipo', 'Caja', 'Cajero', 'Motivo', 'Monto'],
        (reportData.cashMovements || []).map((m: any) => [
          new Date(m.createdAt).toLocaleString(),
          m.type === 'OUT' ? 'RETIRO / GASTO' : 'INGRESO EXTRA',
          m.register,
          m.cashier,
          m.reason,
          m.amount.toFixed(2),
        ])
      );
    } else if (activeTab === 'zreports') {
      downloadCSV(
        'Reporte_Cortes_Z',
        ['Caja', 'Cajero', 'Apertura', 'Cierre', 'Fondo Inicial', 'Ventas', 'Ingresos Extra', 'Retiros/Gastos', 'Declarado', 'Diferencia'],
        (reportData.zReports || []).map((z: any) => [
          z.register,
          z.cashier,
          new Date(z.openedAt).toLocaleString(),
          z.closedAt ? new Date(z.closedAt).toLocaleString() : '',
          z.openingBalance.toFixed(2),
          z.totalSales.toFixed(2),
          (z.incomes || 0).toFixed(2),
          (z.expenses || 0).toFixed(2),
          z.closingBalance.toFixed(2),
          z.difference.toFixed(2),
        ])
      );
    } else if (activeTab === 'inventory') {
      downloadCSV(
        'Reporte_Valoracion_Inventario',
        ['Codigo', 'Producto', 'Categoria', 'Sucursal', 'Existencia', 'Stock Minimo', 'Costo Unit.', 'Precio Venta', 'Valor Costo Total', 'Valor Venta Total', 'Utilidad Proyectada'],
        (reportData.inventory?.items || []).map((i: any) => [
          i.code,
          i.name,
          i.category,
          i.branch,
          i.quantity,
          i.minStock,
          i.cost.toFixed(2),
          i.price.toFixed(2),
          i.totalCostVal.toFixed(2),
          i.totalRetailVal.toFixed(2),
          i.expectedProfit.toFixed(2),
        ])
      );
    } else if (activeTab === 'tickets') {
      downloadCSV(
        'Reporte_Detalle_Tickets',
        ['Folio', 'Fecha y Hora', 'Cajero', 'Cliente', 'Metodo Pago', 'Estado', 'Cant. Articulos', 'Detalle Articulos', 'Total Venta', 'Costo', 'Utilidad'],
        (reportData.salesList || []).map((s: any) => [
          s.folio,
          new Date(s.createdAt).toLocaleString(),
          s.cashier,
          s.customer,
          s.method,
          s.status,
          s.itemsCount,
          s.itemsSummary,
          s.total.toFixed(2),
          s.cost.toFixed(2),
          (s.total - s.cost).toFixed(2),
        ])
      );
    }
  };

  const handlePrintZ = async (session: any) => {
    try {
      const localSettingsRaw = localStorage.getItem('printerSettings');
      let localSettings = {
        header: 'CRIMEN SANTO',
        footer: '',
        width: '80mm',
        printerName: 'printer:impresora_termica',
      };
      if (localSettingsRaw) {
        localSettings = JSON.parse(localSettingsRaw);
      }

      await fetch('http://127.0.0.1:8080/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folio: `CORTE-Z-${session.id.slice(0, 6).toUpperCase()}`,
          branchName: localSettings.header,
          date: session.closedAt || new Date().toISOString(),
          cashier: session.cashier,
          items: [
            { quantity: 1, product: 'Fondo Inicial', subtotal: session.openingBalance },
            { quantity: 1, product: 'Ventas Totales', subtotal: session.totalSales },
            ...(session.incomes > 0 ? [{ quantity: 1, product: 'Ingresos Extra', subtotal: session.incomes }] : []),
            ...(session.expenses > 0 ? [{ quantity: 1, product: 'Retiros / Gastos', subtotal: -session.expenses }] : []),
          ],
          subtotal: session.totalSales,
          tax: 0,
          total: session.closingBalance || 0,
          method: 'Z-REPORT',
          footer: `Declarado: $${session.closingBalance.toFixed(2)}\nDiferencia: $${session.difference.toFixed(2)}\nCorte Z Reimpreso`,
          width: localSettings.width,
          printerName: localSettings.printerName,
        }),
      });
      alert(`Imprimiendo Corte Z para la caja ${session.register}...`);
    } catch (err) {
      console.warn('Print bridge no disponible:', err);
      alert('Error: No se pudo contactar a la impresora local (Print Bridge).');
    }
  };

  const summary = reportData?.summary || {
    grossSales: 0,
    totalCost: 0,
    grossProfit: 0,
    netProfitAfterExpenses: 0,
    profitMargin: 0,
    ticketsCount: 0,
    cancelledCount: 0,
    avgTicket: 0,
    totalItemsSold: 0,
    returnsTotal: 0,
    returnsCount: 0,
    totalIncomes: 0,
    totalExpenses: 0,
    totalCreditPaymentsReceived: 0,
    paymentBreakdown: { CASH: 0, CARD: 0, TRANSFER: 0, CREDIT: 0 },
  };

  const filteredProducts = (reportData?.topProducts || []).filter(
    (p: any) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.code.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(productSearch.toLowerCase())
  );

  const filteredInventory = (reportData?.inventory?.items || []).filter((i: any) =>
    inventoryFilter === 'low' ? i.isLowStock : true
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Encabezado y Controles de Fecha */}
      <div className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm border border-gray-200 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-blue-600" />
            Centro de Reportes e Inteligencia POS
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Consulta ventas por rango de fechas, utilidades, productos más vendidos, cortes Z y valoración de inventario.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportActiveTab}
            disabled={isLoading || !reportData}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar Reporte a Excel (CSV)
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Selector de Fechas y Atajos Rápidos */}
      <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-200 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500 mr-1">Periodo:</span>
          {[
            { id: 'today', label: 'Hoy' },
            { id: 'yesterday', label: 'Ayer' },
            { id: '7days', label: 'Últimos 7 días' },
            { id: 'month', label: 'Este Mes' },
            { id: 'lastMonth', label: 'Mes Anterior' },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activePreset === preset.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600">Desde:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setActivePreset('custom');
              }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-900 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600">Hasta:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setActivePreset('custom');
              }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-900 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            onClick={() => fetchReports(startDate, endDate)}
            className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-black"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Consultar
          </button>
        </div>
      </div>

      {/* Tarjetas de Indicadores Principales (KPIs) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-200 border-l-4 border-l-blue-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-gray-500">Ventas Netas</span>
            <DollarSign className="h-5 w-5 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-gray-900">
            ${summary.grossSales.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {summary.ticketsCount} tickets cobrados · Promedio: ${summary.avgTicket.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-200 border-l-4 border-l-emerald-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-gray-500">Utilidad Bruta (Ganancia)</span>
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-600">
            ${summary.grossProfit.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Costo mercancía: ${summary.totalCost.toFixed(2)} ({summary.profitMargin.toFixed(1)}% margen)
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-200 border-l-4 border-l-purple-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-gray-500">Efectivo Real vs Gastos</span>
            <Banknote className="h-5 w-5 text-purple-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-gray-900">
            ${(summary.paymentBreakdown?.CASH || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Retiros/Gastos: <span className="text-red-600 font-semibold">-${summary.totalExpenses.toFixed(2)}</span> · Ingresos: <span className="text-green-600 font-semibold">+${summary.totalIncomes.toFixed(2)}</span>
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-200 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-gray-500">Artículos Desplazados</span>
            <ShoppingBag className="h-5 w-5 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-gray-900">{summary.totalItemsSold} pzas</p>
          <p className="mt-1 text-xs text-gray-500">
            Cancelados: {summary.cancelledCount} tks · Devoluciones: {summary.returnsCount}
          </p>
        </div>
      </div>

      {/* Pestañas de los Reportes Más Utilizados en POS */}
      <div className="border-b border-gray-200 bg-white rounded-t-xl px-4 pt-3 shadow-sm overflow-x-auto">
        <nav className="-mb-px flex space-x-6 min-w-max">
          {[
            { id: 'summary', label: '1. Ventas por Día y Métodos de Pago', icon: Calendar },
            { id: 'products', label: '2. Productos Más Vendidos y Utilidad', icon: Award },
            { id: 'tickets', label: '3. Detalle de Tickets Emitidos', icon: Receipt },
            { id: 'cashiers', label: '4. Ventas por Cajero', icon: Users },
            { id: 'movements', label: '5. Retiros y Gastos de Caja', icon: ArrowDownUp },
            { id: 'zreports', label: '6. Historial de Cortes Z', icon: Printer },
            { id: 'inventory', label: '7. Valoración de Inventario y Stock Bajo', icon: Package },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ReportTab)}
                className={`flex items-center gap-2 border-b-2 pb-3 pt-1 text-sm font-bold transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Contenido de la Pestaña Activa */}
      {isLoading ? (
        <div className="rounded-b-xl bg-white p-12 text-center shadow-sm border border-t-0 border-gray-200">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-blue-600 mb-3" />
          <p className="text-gray-600 font-medium">Generando reportes del periodo seleccionado...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* TAB 1: RESUMEN DIARIO, MÉTODOS DE PAGO Y CATEGORÍAS */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* Desglose por Método de Pago y Categorías */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
                  <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    Ingresos por Método de Pago
                  </h3>
                  <div className="space-y-3">
                    {[
                      { key: 'CASH', label: 'Efectivo en Caja', color: 'bg-green-500', amount: summary.paymentBreakdown?.CASH || 0 },
                      { key: 'CARD', label: 'Tarjeta (Débito / Crédito)', color: 'bg-blue-500', amount: summary.paymentBreakdown?.CARD || 0 },
                      { key: 'TRANSFER', label: 'Transferencia Bancaria', color: 'bg-indigo-500', amount: summary.paymentBreakdown?.TRANSFER || 0 },
                      { key: 'CREDIT', label: 'Crédito de Clientes (Fiado)', color: 'bg-amber-500', amount: summary.paymentBreakdown?.CREDIT || 0 },
                    ].map((m) => {
                      const pct = summary.grossSales > 0 ? Math.max(0, Math.min(100, (m.amount / summary.grossSales) * 100)) : 0;
                      return (
                        <div key={m.key} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-gray-700">{m.label}</span>
                            <span className="font-bold text-gray-900">
                              ${m.amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({pct.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                            <div className={`h-full ${m.color}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {summary.totalCreditPaymentsReceived > 0 && (
                      <div className="pt-3 border-t flex justify-between text-sm">
                        <span className="text-gray-600">Abonos de clientes a crédito recibidos en el periodo:</span>
                        <span className="font-bold text-emerald-600">+${summary.totalCreditPaymentsReceived.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ventas por Categoría */}
                <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
                  <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    Ventas y Ganancia por Categoría
                  </h3>
                  <div className="overflow-x-auto max-h-60">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                        <tr>
                          <th className="px-3 py-2">Categoría</th>
                          <th className="px-3 py-2 text-center">Unidades</th>
                          <th className="px-3 py-2 text-right">Ventas</th>
                          <th className="px-3 py-2 text-right">Utilidad</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(reportData?.categories || []).length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-gray-400">
                              Sin ventas en este rango de fechas.
                            </td>
                          </tr>
                        ) : (
                          reportData.categories.map((cat: any) => (
                            <tr key={cat.name} className="hover:bg-gray-50">
                              <td className="px-3 py-2.5 font-medium text-gray-900">{cat.name}</td>
                              <td className="px-3 py-2.5 text-center">{cat.quantity}</td>
                              <td className="px-3 py-2.5 text-right font-semibold">${cat.revenue.toFixed(2)}</td>
                              <td className="px-3 py-2.5 text-right font-bold text-emerald-600">${cat.profit.toFixed(2)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Tabla de Desglose Día por Día */}
              <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
                <div className="border-b bg-gray-50 p-4 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    Desglose de Ventas Día por Día ({startDate} a {endDate})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-100 text-xs uppercase text-gray-700">
                      <tr>
                        <th className="px-6 py-3">Fecha</th>
                        <th className="px-6 py-3 text-center">Tickets</th>
                        <th className="px-6 py-3 text-center">Piezas</th>
                        <th className="px-6 py-3 text-right">Efectivo</th>
                        <th className="px-6 py-3 text-right">Tarjeta</th>
                        <th className="px-6 py-3 text-right">Transferencia</th>
                        <th className="px-6 py-3 text-right">Venta Total</th>
                        <th className="px-6 py-3 text-right">Costo</th>
                        <th className="px-6 py-3 text-right">Utilidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(reportData?.dailySales || []).length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-10 text-center text-gray-400">
                            No hay ventas registradas en las fechas seleccionadas.
                          </td>
                        </tr>
                      ) : (
                        reportData.dailySales.map((d: any) => (
                          <tr key={d.date} className="hover:bg-gray-50">
                            <td className="px-6 py-3.5 font-bold text-gray-900">{d.date}</td>
                            <td className="px-6 py-3.5 text-center">{d.tickets}</td>
                            <td className="px-6 py-3.5 text-center">{d.itemsSold}</td>
                            <td className="px-6 py-3.5 text-right">${d.cash.toFixed(2)}</td>
                            <td className="px-6 py-3.5 text-right">${d.card.toFixed(2)}</td>
                            <td className="px-6 py-3.5 text-right">${d.transfer.toFixed(2)}</td>
                            <td className="px-6 py-3.5 text-right font-bold text-blue-600">${d.revenue.toFixed(2)}</td>
                            <td className="px-6 py-3.5 text-right text-gray-500">${d.cost.toFixed(2)}</td>
                            <td className="px-6 py-3.5 text-right font-bold text-emerald-600">${d.profit.toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCTOS MÁS VENDIDOS Y UTILIDAD */}
          {activeTab === 'products' && (
            <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
              <div className="border-b bg-gray-50 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-500" />
                  Ranking de Productos Vendidos y Margen de Ganancia
                </h3>
                <input
                  type="text"
                  placeholder="Filtrar por código, nombre o categoría..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full sm:w-80 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-100 text-xs uppercase text-gray-700">
                    <tr>
                      <th className="px-6 py-3">#</th>
                      <th className="px-6 py-3">Código</th>
                      <th className="px-6 py-3">Producto</th>
                      <th className="px-6 py-3">Categoría</th>
                      <th className="px-6 py-3 text-center">Cant. Vendida</th>
                      <th className="px-6 py-3 text-right">Ingreso Total</th>
                      <th className="px-6 py-3 text-right">Costo Total</th>
                      <th className="px-6 py-3 text-right">Ganancia Neta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-gray-400">
                          No se encontraron productos vendidos en este periodo.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p: any, idx: number) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3.5 font-bold text-gray-400">{idx + 1}</td>
                          <td className="px-6 py-3.5 font-mono text-xs text-gray-700">{p.code}</td>
                          <td className="px-6 py-3.5 font-bold text-gray-900">{p.name}</td>
                          <td className="px-6 py-3.5">{p.category}</td>
                          <td className="px-6 py-3.5 text-center font-black text-blue-600">{p.quantity}</td>
                          <td className="px-6 py-3.5 text-right font-semibold text-gray-900">${p.revenue.toFixed(2)}</td>
                          <td className="px-6 py-3.5 text-right text-gray-500">${p.cost.toFixed(2)}</td>
                          <td className="px-6 py-3.5 text-right font-bold text-emerald-600">${p.profit.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: DETALLE DE TICKETS DEL PERIODO */}
          {activeTab === 'tickets' && (
            <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
              <div className="border-b bg-gray-50 p-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-blue-600" />
                  Listado de Tickets Emitidos en el Periodo ({(reportData?.salesList || []).length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-100 text-xs uppercase text-gray-700">
                    <tr>
                      <th className="px-6 py-3">Folio</th>
                      <th className="px-6 py-3">Fecha y Hora</th>
                      <th className="px-6 py-3">Cajero</th>
                      <th className="px-6 py-3">Método</th>
                      <th className="px-6 py-3">Artículos</th>
                      <th className="px-6 py-3">Estado</th>
                      <th className="px-6 py-3 text-right">Total</th>
                      <th className="px-6 py-3 text-right">Utilidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(reportData?.salesList || []).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-gray-400">
                          No hay tickets en este rango de fechas.
                        </td>
                      </tr>
                    ) : (
                      reportData.salesList.map((s: any) => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3.5 font-bold text-gray-900">{s.folio}</td>
                          <td className="px-6 py-3.5 text-xs">{new Date(s.createdAt).toLocaleString()}</td>
                          <td className="px-6 py-3.5">{s.cashier}</td>
                          <td className="px-6 py-3.5 font-semibold">{s.method}</td>
                          <td className="px-6 py-3.5 max-w-xs truncate" title={s.itemsSummary}>
                            {s.itemsSummary}
                          </td>
                          <td className="px-6 py-3.5">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                                s.status === 'COMPLETED'
                                  ? 'bg-green-100 text-green-800'
                                  : s.status === 'CANCELLED'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {s.status}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-right font-bold text-gray-900">${s.total.toFixed(2)}</td>
                          <td className="px-6 py-3.5 text-right font-bold text-emerald-600">
                            {s.status === 'CANCELLED' ? '$0.00' : `$${(s.total - s.cost).toFixed(2)}`}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: DESEMPEÑO POR CAJERO */}
          {activeTab === 'cashiers' && (
            <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
              <div className="border-b bg-gray-50 p-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Ventas y Productividad por Cajero / Vendedor
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-100 text-xs uppercase text-gray-700">
                    <tr>
                      <th className="px-6 py-3">Cajero / Usuario</th>
                      <th className="px-6 py-3 text-center">Tickets Cobrados</th>
                      <th className="px-6 py-3 text-center">Artículos Vendidos</th>
                      <th className="px-6 py-3 text-center">Cancelaciones</th>
                      <th className="px-6 py-3 text-right">Ticket Promedio</th>
                      <th className="px-6 py-3 text-right">Total Cobrado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(reportData?.cashiers || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-gray-400">
                          Sin actividad de cajeros en este periodo.
                        </td>
                      </tr>
                    ) : (
                      reportData.cashiers.map((c: any) => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-bold text-gray-900">{c.name}</td>
                          <td className="px-6 py-4 text-center font-semibold">{c.tickets}</td>
                          <td className="px-6 py-4 text-center">{c.itemsSold}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`font-bold ${c.cancelled > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              {c.cancelled}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            ${c.tickets > 0 ? (c.revenue / c.tickets).toFixed(2) : '0.00'}
                          </td>
                          <td className="px-6 py-4 text-right font-black text-emerald-600">${c.revenue.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: FLUJO DE CAJA (RETIROS / GASTOS E INGRESOS) */}
          {activeTab === 'movements' && (
            <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
              <div className="border-b bg-gray-50 p-4 flex items-center justify-between">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <ArrowDownUp className="h-5 w-5 text-blue-600" />
                  Auditoría de Retiros de Efectivo (Gastos) e Ingresos Extra
                </h3>
                <div className="flex gap-4 text-sm">
                  <span className="font-bold text-green-600">Ingresos: +${summary.totalIncomes.toFixed(2)}</span>
                  <span className="font-bold text-red-600">Retiros/Gastos: -${summary.totalExpenses.toFixed(2)}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-100 text-xs uppercase text-gray-700">
                    <tr>
                      <th className="px-6 py-3">Fecha y Hora</th>
                      <th className="px-6 py-3">Tipo</th>
                      <th className="px-6 py-3">Caja / Cajero</th>
                      <th className="px-6 py-3">Concepto / Motivo</th>
                      <th className="px-6 py-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(reportData?.cashMovements || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-gray-400">
                          No se registraron retiros ni ingresos extra en este periodo.
                        </td>
                      </tr>
                    ) : (
                      reportData.cashMovements.map((m: any) => (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3.5">{new Date(m.createdAt).toLocaleString()}</td>
                          <td className="px-6 py-3.5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                m.type === 'OUT' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {m.type === 'OUT' ? 'RETIRO / GASTO' : 'INGRESO EXTRA'}
                            </span>
                          </td>
                          <td className="px-6 py-3.5">
                            <div className="font-medium text-gray-900">{m.register}</div>
                            <div className="text-xs text-gray-500">{m.cashier}</div>
                          </td>
                          <td className="px-6 py-3.5 font-medium text-gray-800">{m.reason}</td>
                          <td
                            className={`px-6 py-3.5 text-right font-bold ${
                              m.type === 'OUT' ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {m.type === 'OUT' ? '-' : '+'}${m.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: HISTORIAL DE CORTES Z */}
          {activeTab === 'zreports' && (
            <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
              <div className="border-b p-4 bg-gray-50 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-600" />
                <h2 className="font-bold text-gray-800">Historial de Cortes Z en el Periodo</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-500">
                  <thead className="bg-gray-100 text-xs uppercase text-gray-700">
                    <tr>
                      <th className="px-6 py-3">Caja / Cajero</th>
                      <th className="px-6 py-3">Fecha y Hora (Cierre)</th>
                      <th className="px-6 py-3 text-right">Fondo Inicial</th>
                      <th className="px-6 py-3 text-right">Ventas</th>
                      <th className="px-6 py-3 text-right">Retiros / Ingresos</th>
                      <th className="px-6 py-3 text-right">Declarado</th>
                      <th className="px-6 py-3 text-right">Diferencia</th>
                      <th className="px-6 py-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(reportData?.zReports || []).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-gray-400">
                          No hay cortes de caja cerrados en este rango de fechas.
                        </td>
                      </tr>
                    ) : (
                      reportData.zReports.map((session: any) => (
                        <tr key={session.id} className="bg-white hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{session.register}</div>
                            <div className="text-xs text-gray-500">Cajero: {session.cashier}</div>
                          </td>
                          <td className="px-6 py-4">
                            {session.closedAt ? new Date(session.closedAt).toLocaleString() : '-'}
                          </td>
                          <td className="px-6 py-4 text-right">${session.openingBalance.toFixed(2)}</td>
                          <td className="px-6 py-4 text-right font-medium text-green-600">
                            ${session.totalSales.toFixed(2)}{' '}
                            <span className="text-xs text-gray-400">({session.salesCount} tks)</span>
                          </td>
                          <td className="px-6 py-4 text-right text-xs">
                            <span className="text-green-600">+${(session.incomes || 0).toFixed(2)}</span> /{' '}
                            <span className="text-red-600">-${(session.expenses || 0).toFixed(2)}</span>
                          </td>
                          <td className="px-6 py-4 text-right font-semibold">${session.closingBalance.toFixed(2)}</td>
                          <td className="px-6 py-4 text-right">
                            <span
                              className={`font-bold ${
                                session.difference < 0
                                  ? 'text-red-600'
                                  : session.difference > 0
                                  ? 'text-blue-600'
                                  : 'text-gray-500'
                              }`}
                            >
                              ${session.difference.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handlePrintZ(session)}
                              className="text-blue-600 hover:text-blue-900 font-medium flex items-center justify-center gap-1 mx-auto"
                            >
                              <Printer className="h-4 w-4" /> Re-imprimir
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: VALORACIÓN DE INVENTARIO Y STOCK BAJO */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-200">
                  <span className="text-xs font-bold uppercase text-gray-500">Unidades Totales en Tienda</span>
                  <p className="mt-1 text-2xl font-black text-gray-900">
                    {reportData?.inventory?.summary?.totalUnits || 0} pzas
                  </p>
                </div>
                <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-200">
                  <span className="text-xs font-bold uppercase text-gray-500">Valor en Costo (Inversión)</span>
                  <p className="mt-1 text-2xl font-black text-blue-600">
                    ${(reportData?.inventory?.summary?.totalCostValue || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-200">
                  <span className="text-xs font-bold uppercase text-gray-500">Valor Precio Venta</span>
                  <p className="mt-1 text-2xl font-black text-emerald-600">
                    ${(reportData?.inventory?.summary?.totalRetailValue || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-200">
                  <span className="text-xs font-bold uppercase text-gray-500">Productos por Agotarse</span>
                  <p className="mt-1 text-2xl font-black text-red-600">
                    {reportData?.inventory?.summary?.lowStockCount || 0} alertas
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
                <div className="border-b bg-gray-50 p-4 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    Estado y Valoración del Inventario Actual
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setInventoryFilter('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        inventoryFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      Todos ({(reportData?.inventory?.items || []).length})
                    </button>
                    <button
                      onClick={() => setInventoryFilter('low')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                        inventoryFilter === 'low' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700'
                      }`}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Stock Bajo / Agotados ({reportData?.inventory?.summary?.lowStockCount || 0})
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-100 text-xs uppercase text-gray-700 sticky top-0">
                      <tr>
                        <th className="px-6 py-3">Código</th>
                        <th className="px-6 py-3">Producto</th>
                        <th className="px-6 py-3">Categoría</th>
                        <th className="px-6 py-3 text-center">Existencia</th>
                        <th className="px-6 py-3 text-right">Costo Unit.</th>
                        <th className="px-6 py-3 text-right">Precio Venta</th>
                        <th className="px-6 py-3 text-right">Valor Costo Total</th>
                        <th className="px-6 py-3 text-right">Valor Venta Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredInventory.map((item: any) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 font-mono text-xs">{item.code}</td>
                          <td className="px-6 py-3 font-bold text-gray-900">{item.name}</td>
                          <td className="px-6 py-3">{item.category}</td>
                          <td className="px-6 py-3 text-center">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-black ${
                                item.quantity <= 0
                                  ? 'bg-red-100 text-red-800'
                                  : item.isLowStock
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {item.quantity}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right">${item.cost.toFixed(2)}</td>
                          <td className="px-6 py-3 text-right">${item.price.toFixed(2)}</td>
                          <td className="px-6 py-3 text-right font-medium">${item.totalCostVal.toFixed(2)}</td>
                          <td className="px-6 py-3 text-right font-bold text-emerald-600">${item.totalRetailVal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
