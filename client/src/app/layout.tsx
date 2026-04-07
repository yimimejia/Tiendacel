import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMe, useLogout } from '@/features/auth/use-auth';
import { useState } from 'react';

interface MenuItem {
  to: string;
  label: string;
  roles?: string[];
}

const ADMIN_SUPREMO_MENU: MenuItem[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/sucursales', label: 'Sucursales y Suscripciones' },
  { to: '/usuarios', label: 'Usuarios' },
];

const BRANCH_MENU: MenuItem[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/reparaciones', label: 'Reparaciones' },
  { to: '/inventario', label: 'Inventario' },
  { to: '/inventario/transferencias', label: 'Transferencias' },
  { to: '/ventas', label: 'Ventas' },
  { to: '/reportes', label: 'Reportes' },
];

const ADMIN_GENERAL_MENU: MenuItem[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/usuarios', label: 'Usuarios' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/reparaciones', label: 'Reparaciones' },
  { to: '/inventario', label: 'Inventario' },
  { to: '/inventario/transferencias', label: 'Transferencias' },
  { to: '/ventas', label: 'Ventas' },
  { to: '/reportes', label: 'Reportes' },
  { to: '/auditoria', label: 'Auditoría' },
];

const TECNICO_MENU: MenuItem[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/reparaciones', label: 'Reparaciones' },
  { to: '/clientes', label: 'Clientes' },
];

const CAJA_MENU: MenuItem[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/ventas', label: 'Ventas' },
  { to: '/clientes', label: 'Clientes' },
];

function getMenuForRole(role: string): MenuItem[] {
  switch (role) {
    case 'admin_supremo': return ADMIN_SUPREMO_MENU;
    case 'administrador_general': return ADMIN_GENERAL_MENU;
    case 'encargado_sucursal': return BRANCH_MENU;
    case 'tecnico': return TECNICO_MENU;
    case 'caja_ventas': return CAJA_MENU;
    default: return BRANCH_MENU;
  }
}

function getSidebarTitle(role: string, branchName: string | null | undefined): string {
  if (role === 'admin_supremo') return 'Panel Supremo';
  return branchName ?? 'Mi Sucursal';
}

function getRoleLabel(role: string): string {
  switch (role) {
    case 'admin_supremo': return 'Admin Supremo';
    case 'administrador_general': return 'Admin General';
    case 'encargado_sucursal': return 'Encargado';
    case 'tecnico': return 'Técnico';
    case 'caja_ventas': return 'Caja / Ventas';
    default: return role;
  }
}

export function AppLayout() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const logoutMutation = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);

  const role = me?.role ?? '';
  const menu = getMenuForRole(role);
  const sidebarTitle = getSidebarTitle(role, (me as any)?.branch_name);

  return (
    <div className="min-h-screen text-slate-900">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[260px_1fr]">
        <aside className="border-r border-slate-200 bg-slate-900 text-white flex flex-col">
          <div className="px-5 py-5 border-b border-slate-700">
            <h1 className="text-lg font-bold tracking-tight text-white truncate">{sidebarTitle}</h1>
            <p className="mt-0.5 text-xs text-slate-400">{getRoleLabel(role)}</p>
          </div>
          <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
            {menu.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-indigo-600 font-semibold text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            {role !== 'admin_supremo' ? (
              <NavLink
                to="/consulta-reparacion"
                className="mt-3 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                Consulta pública
              </NavLink>
            ) : null}
          </nav>
          <div className="p-3 border-t border-slate-700">
            <div className="px-3 py-2 text-xs text-slate-400 truncate">{me?.full_name}</div>
            <button
              onClick={() => logoutMutation.mutate(undefined, { onSuccess: () => navigate('/login') })}
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm text-left text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </aside>

        <div className="flex flex-col min-h-screen">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{me?.full_name}</p>
                <p className="text-xs text-slate-500">{getRoleLabel(role)}{(me as any)?.branch_name ? ` · ${(me as any).branch_name}` : ''}</p>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 bg-slate-50">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
