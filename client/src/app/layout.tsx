import { Outlet, NavLink } from 'react-router-dom';

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/sucursales', label: 'Sucursales' },
  { to: '/usuarios', label: 'Usuarios' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/reparaciones', label: 'Reparaciones' },
  { to: '/inventario', label: 'Inventario' },
  { to: '/ventas', label: 'Ventas' },
  { to: '/reportes', label: 'Reportes' },
];

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white px-6 py-4 shadow-sm">
        <h1 className="text-xl font-semibold">Vibran Tech</h1>
      </header>
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 md:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border bg-white p-3">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="rounded-xl border bg-white p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
