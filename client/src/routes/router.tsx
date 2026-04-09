import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/app/layout';
import { useMe } from '@/features/auth/use-auth';
import {
  AuditoriaPage,
  ClienteDetallePage,
  ClientesPage,
  ConfiguracionPage,
  ConsultaReparacionPage,
  ContabilidadPage,
  DashboardPage,
  GastosPage,
  InventarioPage,
  LoginPage,
  MovimientosInventarioPage,
  NcfPage,
  NuevaReparacionPage,
  ReparacionDetallePage,
  ReparacionesPage,
  ReportesPage,
  SucursalesPage,
  TrabajosCompletadosPage,
  TransferenciasPage,
  UsuariosPage,
  VentasPage,
} from '@/pages/basic-pages';
import { ProtectedRoute } from './protected-route';

const WORKER_ROLES = ['mensajero', 'empleado', 'tecnico'];

function DefaultRedirect() {
  const me = useMe();
  const role = me.data?.role ?? '';
  if (WORKER_ROLES.includes(role)) return <Navigate to="/reparaciones" replace />;
  return <Navigate to="/dashboard" replace />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/consulta-reparacion', element: <ConsultaReparacionPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DefaultRedirect /> },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/sucursales', element: <SucursalesPage /> },
      { path: '/usuarios', element: <UsuariosPage /> },
      { path: '/clientes', element: <ClientesPage /> },
      { path: '/clientes/:id', element: <ClienteDetallePage /> },
      { path: '/reparaciones', element: <ReparacionesPage /> },
      { path: '/reparaciones/nueva', element: <NuevaReparacionPage /> },
      { path: '/reparaciones/:id', element: <ReparacionDetallePage /> },
      { path: '/trabajos-completados', element: <TrabajosCompletadosPage /> },
      { path: '/inventario', element: <InventarioPage /> },
      { path: '/inventario/movimientos', element: <MovimientosInventarioPage /> },
      { path: '/inventario/transferencias', element: <TransferenciasPage /> },
      { path: '/ventas', element: <VentasPage /> },
      { path: '/gastos', element: <GastosPage /> },
      { path: '/contabilidad', element: <ContabilidadPage /> },
      { path: '/reportes', element: <ReportesPage /> },
      { path: '/auditoria', element: <AuditoriaPage /> },
      { path: '/comprobantes', element: <NcfPage /> },
      { path: '/configuracion', element: <ConfiguracionPage /> },
    ],
  },
]);
