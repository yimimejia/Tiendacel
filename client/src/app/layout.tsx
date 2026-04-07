import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMe, useLogout } from '@/features/auth/use-auth';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useState } from 'react';
import { clientEnv } from '@/config/env';

const menu = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/sucursales', label: 'Sucursales', roles: ['administrador_general'] },
  { to: '/usuarios', label: 'Usuarios', roles: ['administrador_general'] },
  { to: '/clientes', label: 'Clientes' },
  { to: '/reparaciones', label: 'Reparaciones' },
  { to: '/inventario', label: 'Inventario' },
  { to: '/inventario/transferencias', label: 'Transferencias' },
  { to: '/ventas', label: 'Ventas' },
  { to: '/reportes', label: 'Reportes' },
  { to: '/auditoria', label: 'Auditoría', roles: ['administrador_general'] },
];

export function AppLayout() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const logoutMutation = useLogout();

  const allowedMenu = menu.filter((item) => !item.roles || item.roles.includes(me?.role ?? ''));
  const [search, setSearch] = useState('');
  const searchQuery = useQuery({
    queryKey: ['global-search', search],
    queryFn: async () => (await apiRequest<any>(`/search/global?q=${encodeURIComponent(search)}`)).data,
    enabled: search.length >= 2,
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[260px_1fr]">
        <aside className="border-r bg-white p-4">
          <h1 className="text-xl font-semibold">{clientEnv.appName}</h1>
          <p className="mt-1 text-xs text-slate-500">Panel administrativo</p>
          <nav className="mt-6 flex flex-col gap-1">
            {allowedMenu.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-blue-50 font-semibold text-blue-700' : 'hover:bg-slate-100'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <NavLink to="/consulta-reparacion" className="mt-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50">
              Consulta pública
            </NavLink>
          </nav>
        </aside>

        <div>
          <header className="flex flex-col gap-3 border-b bg-white px-6 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold">{me?.full_name}</p>
              <p className="text-xs text-slate-500">
                Rol: {me?.role} {me?.branch_id ? `• Sucursal: ${me.branch_id}` : ''}
              </p>
            </div>
            <div className="flex w-full max-w-xl flex-col gap-1 md:w-auto">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Búsqueda global (cliente, reparación, producto, venta...)"
                className="rounded-lg border px-3 py-2 text-sm"
              />
              {searchQuery.data ? (
                <p className="text-xs text-slate-500">
                  Resultados: {(searchQuery.data.customers?.length ?? 0) + (searchQuery.data.devices?.length ?? 0) + (searchQuery.data.products?.length ?? 0) + (searchQuery.data.sales?.length ?? 0)}
                </p>
              ) : null}
            </div>
            <button
              onClick={() =>
                logoutMutation.mutate(undefined, {
                  onSuccess: () => navigate('/login'),
                })
              }
              className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
            >
              Cerrar sesión
            </button>
          </header>

          <main className="p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
