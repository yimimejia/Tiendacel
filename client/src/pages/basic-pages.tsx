import { PanelTitulo } from '@/components/panel-titulo';
import { useEstadoBackend } from '@/services/estado-backend';
import { useParams } from 'react-router-dom';

function BaseModulo({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <section>
      <PanelTitulo titulo={titulo} descripcion={descripcion} />
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        Estructura base lista. Este módulo se implementará en fases de negocio posteriores.
      </div>
    </section>
  );
}

export function LoginPage() {
  return (
    <section className="mx-auto mt-20 max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Acceso a Vibran Tech</h1>
      <p className="mt-1 text-sm text-slate-600">Base de autenticación lista para la siguiente fase.</p>
      <form className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Usuario</label>
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Contraseña</label>
          <input type="password" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
        </div>
        <button type="button" className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
          Ingresar
        </button>
      </form>
    </section>
  );
}

export function DashboardPage() {
  const estadoBackend = useEstadoBackend();

  return (
    <section>
      <PanelTitulo titulo="Dashboard" descripcion="Verificación técnica de frontend y backend en ejecución." />
      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold">Estado del backend</h3>
          <p className="mt-2 text-sm text-slate-600">
            {estadoBackend.isLoading
              ? 'Consultando /api/health...'
              : estadoBackend.data
                ? `Conectado: ${estadoBackend.data.mensaje}`
                : 'No disponible'}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold">Arquitectura</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>React + TypeScript + Vite + Tailwind</li>
            <li>Express + TypeScript + Drizzle + PostgreSQL</li>
            <li>Estructura modular por dominio</li>
          </ul>
        </article>
      </div>
    </section>
  );
}

export const SucursalesPage = () => <BaseModulo titulo="Sucursales" descripcion="Administración de sucursales." />;
export const UsuariosPage = () => <BaseModulo titulo="Usuarios" descripcion="Administración de usuarios y roles." />;
export const ClientesPage = () => <BaseModulo titulo="Clientes" descripcion="Gestión centralizada de clientes." />;
export const ReparacionesPage = () => <BaseModulo titulo="Reparaciones" descripcion="Recepción y seguimiento técnico." />;
export const NuevaReparacionPage = () => <BaseModulo titulo="Nueva reparación" descripcion="Formulario de recepción." />;
export const InventarioPage = () => <BaseModulo titulo="Inventario" descripcion="Stock por sucursal." />;
export const MovimientosInventarioPage = () => <BaseModulo titulo="Movimientos" descripcion="Entradas, salidas y ajustes." />;
export const TransferenciasPage = () => <BaseModulo titulo="Transferencias" descripcion="Movimientos entre sucursales." />;
export const VentasPage = () => <BaseModulo titulo="Ventas" descripcion="Registro de ventas de productos." />;
export const ReportesPage = () => <BaseModulo titulo="Reportes" descripcion="Métricas e indicadores." />;
export const ConfiguracionPage = () => <BaseModulo titulo="Configuración" descripcion="Parámetros globales." />;
export const ConsultaReparacionPage = () => <BaseModulo titulo="Consulta pública" descripcion="Consulta por número de reparación." />;

export function ClienteDetallePage() {
  const { id } = useParams();
  return <BaseModulo titulo={`Cliente ${id ?? ''}`} descripcion="Detalle e historial del cliente." />;
}

export function ReparacionDetallePage() {
  const { id } = useParams();
  return <BaseModulo titulo={`Reparación ${id ?? ''}`} descripcion="Detalle técnico y financiero de la reparación." />;
}
