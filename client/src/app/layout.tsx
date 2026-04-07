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
    <div className="min-h-screen text-slate-900">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[280px_1fr]">
        <aside className="border-r border-white/60 bg-white/70 p-5 backdrop-blur-xl">
          <h1 className="text-2xl font-bold tracking-tight text-indigo-700">{clientEnv.appName}</h1>
          <p className="mt-1 text-xs text-slate-500">Panel administrativo moderno</p>
          <nav className="mt-6 flex flex-col gap-1.5">
            {allowedMenu.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-xl px-3 py-2.5 text-sm transition ${isActive ? 'bg-indigo-600 font-semibold text-white shadow-sm' : 'text-slate-700 hover:bg-indigo-50'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <NavLink to="/consulta-reparacion" className="mt-2 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50">
              Consulta pública
            </NavLink>
          </nav>
        </aside>

        <div>
          <header className="sticky top-0 z-10 border-b border-white/60 bg-white/70 px-6 py-4 backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
                  className="vt-input"
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
                className="vt-btn-soft"
              >
                Cerrar sesión
              </button>
            </div>
          </header>

          <main className="p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
