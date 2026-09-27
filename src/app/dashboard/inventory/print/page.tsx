'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function PrintCountSheet() {
  const searchParams = useSearchParams();
  const location = searchParams.get('location') || '';
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    // Re-use the existing products API, optionally we could pass a location query.
    // For now, we'll fetch all and filter in memory for simplicity in this prototype.
    fetch(`/api/products`)
      .then(res => res.json())
      .then(data => {
        if (location) {
          setProducts(data.filter((p: any) => p.inventories?.[0]?.location === location));
        } else {
          setProducts(data);
        }
        // Auto-print when loaded
        setTimeout(() => window.print(), 500);
      });
  }, [location]);

  return (
    <div className="bg-white p-8 max-w-4xl mx-auto text-black">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold uppercase">Hoja de Conteo de Inventario</h1>
        {location && <h2 className="text-lg">Ubicación / Zona: <span className="font-bold">{location}</span></h2>}
        <p className="text-sm mt-2">Fecha: {new Date().toLocaleDateString()}</p>
      </div>

      <table className="w-full border-collapse border border-gray-400 text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-4 py-2 text-left">Código</th>
            <th className="border border-gray-400 px-4 py-2 text-left">Descripción</th>
            <th className="border border-gray-400 px-4 py-2 text-left w-32">Ubicación</th>
            <th className="border border-gray-400 px-4 py-2 text-center w-24">Stock Teórico</th>
            <th className="border border-gray-400 px-4 py-2 text-center w-32">Conteo Físico</th>
            <th className="border border-gray-400 px-4 py-2 text-center w-32">Diferencia</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, idx) => {
            const stock = p.inventories?.[0]?.quantity || 0;
            const loc = p.inventories?.[0]?.location || '-';
            return (
              <tr key={idx}>
                <td className="border border-gray-400 px-4 py-3">{p.code}</td>
                <td className="border border-gray-400 px-4 py-3 font-medium">{p.name}</td>
                <td className="border border-gray-400 px-4 py-3">{loc}</td>
                <td className="border border-gray-400 px-4 py-3 text-center text-gray-500">{stock}</td>
                {/* Empty cell for handwriting */}
                <td className="border border-gray-400 px-4 py-3"></td>
                <td className="border border-gray-400 px-4 py-3"></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-12 flex justify-between">
        <div className="text-center">
          <div className="w-48 border-b border-gray-600 mb-2"></div>
          <p className="text-sm">Firma de quien cuenta</p>
        </div>
        <div className="text-center">
          <div className="w-48 border-b border-gray-600 mb-2"></div>
          <p className="text-sm">Firma de Autorización</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { background-color: white !important; }
          /* Hide the standard sidebar/navbar layout when printing this specific page */
          nav, aside, header { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; }
        }
      `}</style>
    </div>
  );
}
