'use client';

import { useState, useEffect } from 'react';
import { Store, Plus, Users } from 'lucide-react';

export default function SettingsPage() {
  const [branches, setBranches] = useState<any[]>([]);
  const [newBranch, setNewBranch] = useState({ name: '', address: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ firstName: '', lastName: '', email: '', password: '', roleId: '', branchId: '' });

  // Printer Settings
  const [printerSettings, setPrinterSettings] = useState({
    width: '80mm',
    header: 'Ferremix',
    footer: '¡Gracias por su compra!',
    printerName: 'printer:impresora_termica'
  });

  useEffect(() => {
    fetchBranches();
    fetchUsers();
    fetchRoles();
    const localSettings = localStorage.getItem('printerSettings');
    if (localSettings) {
      setPrinterSettings(JSON.parse(localSettings));
    }
  }, []);

  const savePrinterSettings = () => {
    localStorage.setItem('printerSettings', JSON.stringify(printerSettings));
    alert('Configuración de impresión guardada localmente.');
  };

  const fetchBranches = async () => {
    const res = await fetch('/api/branches');
    const data = await res.json();
    setBranches(data);
  };

  const fetchUsers = async () => {
    const res = await fetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
    }
  };

  const fetchRoles = async () => {
    const res = await fetch('/api/roles');
    if (res.ok) {
      const data = await res.json();
      setRoles(data);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBranch)
    });
    if (res.ok) {
      setNewBranch({ name: '', address: '' });
      setIsModalOpen(false);
      fetchBranches();
      alert('Sucursal creada exitosamente.');
    } else {
      alert('Error creando sucursal');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser)
    });
    if (res.ok) {
      setNewUser({ firstName: '', lastName: '', email: '', password: '', roleId: '', branchId: '' });
      setIsUserModalOpen(false);
      fetchUsers();
      alert('Empleado creado exitosamente.');
    } else {
      const data = await res.json();
      alert(`Error creando empleado: ${data.error}`);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Modal Nueva Sucursal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-center bg-black bg-opacity-50 sm:items-start sm:pt-10 items-center overflow-y-auto p-4">
          <div className="w-[400px] rounded-lg max-h-[90vh] overflow-y-auto bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">Nueva Sucursal / Almacén</h2>
            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre</label>
                <input type="text" required value={newBranch.name} onChange={e => setNewBranch({...newBranch, name: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black" placeholder="Ej. Sucursal Centro" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Dirección</label>
                <input type="text" value={newBranch.address} onChange={e => setNewBranch({...newBranch, address: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black" />
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-md px-4 py-2 text-gray-600 hover:bg-gray-100">Cancelar</button>
                <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nuevo Empleado */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-center bg-black bg-opacity-50 sm:items-start sm:pt-10 items-center overflow-y-auto p-4">
          <div className="w-[500px] rounded-lg max-h-[90vh] overflow-y-auto bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">Nuevo Empleado / Cajero</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre</label>
                  <input type="text" required value={newUser.firstName} onChange={e => setNewUser({...newUser, firstName: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Apellido</label>
                  <input type="text" required value={newUser.lastName} onChange={e => setNewUser({...newUser, lastName: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Usuario / PIN (Email)</label>
                  <input type="text" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black" placeholder="cajero1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                  <input type="password" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Rol</label>
                  <select required value={newUser.roleId} onChange={e => setNewUser({...newUser, roleId: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black">
                    <option value="">Selecciona rol...</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sucursal</label>
                  <select required value={newUser.branchId} onChange={e => setNewUser({...newUser, branchId: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black">
                    <option value="">Selecciona sucursal...</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsUserModalOpen(false)} className="rounded-md px-4 py-2 text-gray-600 hover:bg-gray-100">Cancelar</button>
                <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Crear Empleado</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Configuración del Sistema</h1>
          <p className="text-sm text-gray-500">Administra sucursales, almacenes y empleados.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg bg-white shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Store className="h-5 w-5 text-blue-600" /> Sucursales y Almacenes</h2>
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
              <Plus className="h-4 w-4" /> Agregar Sucursal
            </button>
          </div>
          
          <ul className="divide-y divide-gray-200 border rounded-md max-h-96 overflow-y-auto">
            {branches.map(branch => (
              <li key={branch.id} className="p-4 hover:bg-gray-50 flex justify-between items-center">
                <div>
                  <div className="font-medium text-gray-900">{branch.name}</div>
                  <div className="text-sm text-gray-500">{branch.address || 'Sin dirección registrada'}</div>
                </div>
                <button 
                  onClick={async () => {
                    const name = prompt('Nombre de la nueva caja (ej. Caja 2):');
                    if (name) {
                      const res = await fetch('/api/cash-registers', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, branchId: branch.id })
                      });
                      if (res.ok) alert('Caja creada. Ve al POS para abrirla.');
                      else alert('Error creando caja');
                    }
                  }}
                  className="text-sm text-blue-600 hover:underline border border-blue-600 px-2 py-1 rounded"
                >
                  + Añadir Caja
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg bg-white shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Users className="h-5 w-5 text-purple-600" /> Empleados</h2>
            <button onClick={() => setIsUserModalOpen(true)} className="flex items-center gap-2 text-sm text-purple-600 hover:underline">
              <Plus className="h-4 w-4" /> Agregar Empleado
            </button>
          </div>
          
          <ul className="divide-y divide-gray-200 border rounded-md max-h-96 overflow-y-auto">
            {users.map(user => (
              <li key={user.id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-900">{user.firstName} {user.lastName}</div>
                    <div className="text-sm text-gray-500">{user.email} (Rol: {user.role?.name})</div>
                  </div>
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{user.branch?.name}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow p-6 mt-6 border-t-4 border-gray-800">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">🖨️ Configuración de Ticket Local (Print Bridge)</h2>
        <p className="text-sm text-gray-500 mb-6">Estos ajustes se guardan en esta computadora para conectarse a tu impresora física USB.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Ancho del Papel</label>
            <select value={printerSettings.width} onChange={e => setPrinterSettings({...printerSettings, width: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black">
              <option value="58mm">58mm (Pequeña)</option>
              <option value="80mm">80mm (Estándar)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre de Impresora en Sistema (Ej. USB001, POS-80)</label>
            <input type="text" value={printerSettings.printerName} onChange={e => setPrinterSettings({...printerSettings, printerName: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Encabezado Comercial (Logo/Texto)</label>
            <input type="text" value={printerSettings.header} onChange={e => setPrinterSettings({...printerSettings, header: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Pie de Página (Políticas/Agradecimiento)</label>
            <input type="text" value={printerSettings.footer} onChange={e => setPrinterSettings({...printerSettings, footer: e.target.value})} className="mt-1 w-full rounded-md border border-gray-300 p-2 text-black" />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button onClick={savePrinterSettings} className="rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 font-medium">Guardar Configuración de Ticket</button>
        </div>
      </div>

      <div className="rounded-lg bg-white shadow p-6 mt-6 border-t-4 border-blue-600">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">📥 Instalador de Impresora en Cajas Nuevas</h2>
        <p className="text-sm text-gray-600 mb-4">
          Para que esta computadora o cualquier caja nueva pueda imprimir tickets físicos, sigue estos 3 rápidos pasos. 
          Solo necesitas hacerlo una vez por computadora.
        </p>
        
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 border rounded-md bg-gray-50">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 font-bold rounded-full flex items-center justify-center">1</div>
            <div>
              <h3 className="font-medium text-gray-900">Instalar Motor (Node.js)</h3>
              <p className="text-sm text-gray-500 mb-2">Motor necesario para que Windows se comunique con impresoras USB.</p>
              <a href="https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi" target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:underline">Descargar e Instalar Node.js (Windows) &rarr;</a>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 border rounded-md bg-gray-50">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 font-bold rounded-full flex items-center justify-center">2</div>
            <div>
              <h3 className="font-medium text-gray-900">Descargar Puente de Impresión</h3>
              <p className="text-sm text-gray-500 mb-2">El programa oculto que conectará CRIMEN SANTO con el papel.</p>
              <a href="/print_bridge.zip" download className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Descargar Print Bridge (.zip)
              </a>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 border rounded-md bg-gray-50">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 font-bold rounded-full flex items-center justify-center">3</div>
            <div>
              <h3 className="font-medium text-gray-900">Arrancar Puente</h3>
              <p className="text-sm text-gray-500">
                Descomprime la carpeta que descargaste en el Paso 2 (cópiala a tu Disco C: de preferencia).<br/>
                Entra a la carpeta y dale doble clic al archivo <strong>Iniciar_Impresora.bat</strong>.<br/>
                <span className="text-green-600 font-semibold text-xs uppercase mt-1 inline-block">¡Listo! La caja ya puede imprimir.</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
