import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/app/layout';
import {
  ClienteDetallePage,
  ClientesPage,
  ConfiguracionPage,
  ConsultaReparacionPage,
  DashboardPage,
  InventarioPage,
  LoginPage,
  MovimientosInventarioPage,
  NuevaReparacionPage,
  ReparacionDetallePage,
  ReparacionesPage,
  ReportesPage,
  SucursalesPage,
  TransferenciasPage,
  UsuariosPage,
  VentasPage,
} from '@/pages/basic-pages';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/consulta-reparacion', element: <ConsultaReparacionPage /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/sucursales', element: <SucursalesPage /> },
      { path: '/usuarios', element: <UsuariosPage /> },
      { path: '/clientes', element: <ClientesPage /> },
      { path: '/clientes/:id', element: <ClienteDetallePage /> },
      { path: '/reparaciones', element: <ReparacionesPage /> },
      { path: '/reparaciones/nueva', element: <NuevaReparacionPage /> },
      { path: '/reparaciones/:id', element: <ReparacionDetallePage /> },
      { path: '/inventario', element: <InventarioPage /> },
      { path: '/inventario/movimientos', element: <MovimientosInventarioPage /> },
      { path: '/inventario/transferencias', element: <TransferenciasPage /> },
      { path: '/ventas', element: <VentasPage /> },
      { path: '/reportes', element: <ReportesPage /> },
      { path: '/configuracion', element: <ConfiguracionPage /> },
    ],
  },
]);
