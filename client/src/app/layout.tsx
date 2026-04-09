import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMe, useLogout } from '@/features/auth/use-auth';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

interface MenuItem {
  to: string;
  label: string;
}

interface ImpersonatedBranch {
  branchId: number;
  branchName: string;
  branchCode: string;
}

const BRANCH_MENU: MenuItem[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/reparaciones', label: 'Trabajos pendientes' },
  { to: '/trabajos-completados', label: 'Trabajos completados' },
  { to: '/inventario', label: 'Inventario' },
  { to: '/inventario/transferencias', label: 'Transferencias' },
  { to: '/ventas', label: 'Ventas' },
  { to: '/gastos', label: 'Gastos' },
  { to: '/contabilidad', label: 'Contabilidad' },
  { to: '/reportes', label: 'Reportes' },
  { to: '/comprobantes', label: 'Comprobantes NCF' },
  { to: '/configuracion', label: 'Configuración' },
];

const ADMIN_GENERAL_MENU: MenuItem[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/usuarios', label: 'Usuarios' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/reparaciones', label: 'Trabajos pendientes' },
  { to: '/trabajos-completados', label: 'Trabajos completados' },
  { to: '/inventario', label: 'Inventario' },
  { to: '/inventario/transferencias', label: 'Transferencias' },
  { to: '/ventas', label: 'Ventas' },
  { to: '/gastos', label: 'Gastos' },
  { to: '/contabilidad', label: 'Contabilidad' },
  { to: '/reportes', label: 'Reportes' },
  { to: '/comprobantes', label: 'Comprobantes NCF' },
  { to: '/configuracion', label: 'Configuración' },
];

const ADMIN_SUPREMO_MENU_WITH_AUDIT: MenuItem[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/sucursales', label: 'Sucursales y Suscripciones' },
  { to: '/usuarios', label: 'Usuarios' },
  { to: '/auditoria', label: 'Auditoría' },
];

const TECNICO_MENU: MenuItem[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/reparaciones', label: 'Trabajos pendientes' },
  { to: '/trabajos-completados', label: 'Trabajos completados' },
  { to: '/clientes', label: 'Clientes' },
];

const CAJA_MENU: MenuItem[] = [
  { to: '/ventas', label: 'Ventas' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/trabajos-completados', label: 'Trabajos completados' },
];

const MENSAJERO_MENU: MenuItem[] = [
  { to: '/reparaciones', label: 'Trabajos pendientes' },
  { to: '/trabajos-completados', label: 'Trabajos completados' },
];

const EMPLEADO_MENU: MenuItem[] = [
  { to: '/reparaciones', label: 'Trabajos pendientes' },
  { to: '/trabajos-completados', label: 'Trabajos completados' },
];

function getMenuForRole(role: string): MenuItem[] {
  switch (role) {
    case 'admin_supremo': return ADMIN_SUPREMO_MENU_WITH_AUDIT;
    case 'administrador_general': return ADMIN_GENERAL_MENU;
    case 'encargado_sucursal': return BRANCH_MENU;
    case 'tecnico': return TECNICO_MENU;
    case 'caja_ventas': return CAJA_MENU;
    case 'mensajero': return MENSAJERO_MENU;
    case 'empleado': return EMPLEADO_MENU;
    default: return BRANCH_MENU;
  }
}

function getRoleLabel(role: string): string {
  switch (role) {
    case 'admin_supremo': return 'Admin Supremo';
    case 'administrador_general': return 'Admin General';
    case 'encargado_sucursal': return 'Encargado';
    case 'tecnico': return 'Técnico';
    case 'caja_ventas': return 'Caja / Ventas';
    case 'mensajero': return 'Mensajero';
    case 'empleado': return 'Empleado';
    default: return role;
  }
}

function PagoPendienteOverlay({ branchName }: { branchName: string }) {
  const navigate = useNavigate();
  const logoutMutation = useLogout();
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white px-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
          <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Suscripción suspendida</h1>
        <p className="mt-3 text-slate-600">
          El acceso a <strong>{branchName}</strong> ha sido suspendido por falta de pago.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Contacta al administrador para regularizar el pago y reactivar tu cuenta.
        </p>
        <button
          className="mt-8 w-full rounded-lg bg-slate-900 py-3 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
          onClick={() => logoutMutation.mutate(undefined, { onSuccess: () => navigate('/login') })}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      {open ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      )}
    </svg>
  );
}

export function AppLayout() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const logoutMutation = useLogout();
  const [impersonated, setImpersonated] = useState<ImpersonatedBranch | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('impersonatedBranch');
    if (stored) {
      try { setImpersonated(JSON.parse(stored)); } catch {}
    }
  }, []);

  const role = me?.role ?? '';
  const isSupremo = role === 'admin_supremo';
  const isImpersonating = isSupremo && impersonated !== null;

  const branchStatusQuery = useQuery({
    queryKey: ['branch-status'],
    enabled: !!me && !isSupremo,
    queryFn: async () => (await apiRequest<{ isPaused: boolean }>('/subscriptions/branch-status')).data,
    staleTime: 20000,
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
  });

  const isPaused = !isSupremo && branchStatusQuery.data?.isPaused === true;

  const effectiveRole = isImpersonating ? 'administrador_general' : role;
  const menu = isImpersonating ? ADMIN_GENERAL_MENU : getMenuForRole(role);
  const sidebarTitle = isImpersonating
    ? impersonated.branchName
    : (isSupremo ? 'Panel Supremo' : ((me as any)?.branch_name ?? 'Mi Sucursal'));

  const handleExitImpersonation = () => {
    sessionStorage.removeItem('impersonatedBranch');
    setImpersonated(null);
    navigate('/sucursales');
    window.location.reload();
  };

  const branchName = (me as any)?.branch_name ?? 'tu sucursal';

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-slate-700 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-white truncate">{sidebarTitle}</h1>
          <p className="mt-0.5 text-xs text-slate-400">
            {isImpersonating ? 'Vista Admin · ' + impersonated.branchCode : getRoleLabel(role)}
          </p>
        </div>
        <button
          className="md:hidden ml-3 flex-shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          onClick={() => setMobileOpen(false)}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {isImpersonating ? (
        <div className="px-3 pt-3">
          <button
            onClick={handleExitImpersonation}
            className="w-full rounded-lg border border-indigo-500 bg-indigo-900/40 px-3 py-2 text-xs text-indigo-300 hover:bg-indigo-800 transition-colors text-left"
          >
            ← Salir de sucursal
          </button>
        </div>
      ) : null}
      <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
        {menu.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
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
    </div>
  );

  return (
    <>
      {isPaused ? <PagoPendienteOverlay branchName={branchName} /> : null}

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>

      <div className="min-h-screen text-slate-900">
        <div className="grid min-h-screen md:grid-cols-[260px_1fr]">
          <aside className="hidden md:flex flex-col border-r border-slate-200 bg-slate-900 text-white">
            {sidebarContent}
          </aside>

          <div className="flex flex-col min-h-screen">
            {isImpersonating ? (
              <div className="bg-indigo-700 px-4 py-2 text-xs text-indigo-100 flex items-center justify-between">
                <span>Estás viendo el panel de <strong>{impersonated.branchName}</strong> como administrador</span>
                <button onClick={handleExitImpersonation} className="underline hover:text-white ml-4 flex-shrink-0">Salir</button>
              </div>
            ) : null}
            <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    className="md:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition-colors"
                    onClick={() => setMobileOpen(true)}
                    aria-label="Abrir menú"
                  >
                    <HamburgerIcon open={false} />
                  </button>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{me?.full_name}</p>
                    <p className="text-xs text-slate-500">
                      {getRoleLabel(role)}
                      {isImpersonating ? ` · ${impersonated.branchName}` : ((me as any)?.branch_name ? ` · ${(me as any).branch_name}` : '')}
                    </p>
                  </div>
                </div>
              </div>
            </header>

            <main className="flex-1 p-4 md:p-6 bg-slate-50">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
