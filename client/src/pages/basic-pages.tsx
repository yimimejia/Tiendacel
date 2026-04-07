import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { PanelTitulo } from '@/components/panel-titulo';
import { useLogin, useMe } from '@/features/auth/use-auth';
import { apiRequest } from '@/lib/api';

const loginSchema = z.object({ username_or_email: z.string().min(3), password: z.string().min(6) });
type LoginInput = z.infer<typeof loginSchema>;

const branchSchema = z.object({ name: z.string().min(2), code: z.string().min(2), address: z.string().min(3), phone: z.string().min(5) });
const customerSchema = z.object({ full_name: z.string().min(2), phone: z.string().min(5), email: z.string().email().optional().or(z.literal('')) });

interface RepairItem {
  id: number;
  repair_number: string;
  branch_id: number;
  brand: string;
  model: string;
  internal_status: string;
  technician_id: number | null;
  technician_name: string | null;
  assignment_status: 'asignado' | 'sin_asignar';
}

interface AssignableTech {
  id: number;
  full_name: string;
}

function Table({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-3 py-2 text-left">ID</th>
            <th className="px-3 py-2 text-left">Nombre</th>
            <th className="px-3 py-2 text-left">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={String(item.id)} className="border-t">
              <td className="px-3 py-2">#{String(item.id)}</td>
              <td className="px-3 py-2">{String(item.name ?? item.full_name ?? item.username_or_email ?? '-')}</td>
              <td className="px-3 py-2 text-xs text-slate-500">{JSON.stringify(item).slice(0, 120)}...</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  return (
    <section className="mx-auto mt-20 max-w-md rounded-xl border bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Iniciar sesión</h1>
      <form
        className="mt-4 space-y-3"
        onSubmit={form.handleSubmit((values) => loginMutation.mutate(values, { onSuccess: () => navigate('/dashboard') }))}
      >
        <input className="w-full rounded border px-3 py-2" placeholder="Usuario o correo" {...form.register('username_or_email')} />
        <input className="w-full rounded border px-3 py-2" type="password" placeholder="Contraseña" {...form.register('password')} />
        {loginMutation.error ? <ErrorState message={loginMutation.error.message} /> : null}
        <button className="w-full rounded bg-blue-600 py-2 text-white" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </section>
  );
}

export function DashboardPage() {
  const me = useMe();
  const branches = useQuery({ queryKey: ['branches'], queryFn: async () => (await apiRequest<any[]>('/branches')).data });
  const customers = useQuery({ queryKey: ['customers'], queryFn: async () => (await apiRequest<any[]>('/customers')).data });
  const users = useQuery({
    queryKey: ['users'],
    enabled: me.data?.role === 'administrador_general',
    queryFn: async () => (await apiRequest<any[]>('/users')).data,
  });

  if (branches.isLoading || customers.isLoading || me.isLoading) return <LoadingState />;

  return (
    <section>
      <PanelTitulo titulo="Dashboard" descripcion="Resumen general conectado al backend." />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded border bg-white p-4">Sucursales: {branches.data?.length ?? 0}</div>
        <div className="rounded border bg-white p-4">Clientes: {customers.data?.length ?? 0}</div>
        <div className="rounded border bg-white p-4">Usuarios: {users.data?.length ?? (me.data?.role === 'administrador_general' ? 0 : 'N/A')}</div>
      </div>
    </section>
  );
}

export function SucursalesPage() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['branches'], queryFn: async () => (await apiRequest<any[]>('/branches')).data });
  const form = useForm<z.infer<typeof branchSchema>>({ resolver: zodResolver(branchSchema) });
  const mutation = useMutation({
    mutationFn: async (payload: z.infer<typeof branchSchema>) => apiRequest('/branches', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });

  if (list.isLoading) return <LoadingState />;
  if (list.error) return <ErrorState message={(list.error as Error).message} />;

  return (
    <section className="space-y-4">
      <PanelTitulo titulo="Sucursales" descripcion="Alta y listado de sucursales." />
      <form className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-4" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        <input className="rounded border px-2 py-1" placeholder="Nombre" {...form.register('name')} />
        <input className="rounded border px-2 py-1" placeholder="Código" {...form.register('code')} />
        <input className="rounded border px-2 py-1" placeholder="Dirección" {...form.register('address')} />
        <input className="rounded border px-2 py-1" placeholder="Teléfono" {...form.register('phone')} />
        <button className="rounded bg-slate-900 px-3 py-2 text-white md:col-span-4" disabled={mutation.isPending}>Crear sucursal</button>
      </form>
      {mutation.error ? <ErrorState message={(mutation.error as Error).message} /> : null}
      {(list.data ?? []).length === 0 ? <EmptyState message="No hay sucursales." /> : <Table rows={(list.data ?? []) as Record<string, unknown>[]} />}
    </section>
  );
}

export function UsuariosPage() {
  const list = useQuery({ queryKey: ['users'], queryFn: async () => (await apiRequest<any[]>('/users')).data });
  if (list.isLoading) return <LoadingState />;
  if (list.error) return <ErrorState message={(list.error as Error).message} />;
  return (
    <section>
      <PanelTitulo titulo="Usuarios" descripcion="Listado de usuarios del sistema." />
      {(list.data ?? []).length === 0 ? <EmptyState message="No hay usuarios." /> : <Table rows={(list.data ?? []) as Record<string, unknown>[]} />}
    </section>
  );
}

export function ClientesPage() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['customers'], queryFn: async () => (await apiRequest<any[]>('/customers')).data });
  const form = useForm<z.infer<typeof customerSchema>>({ resolver: zodResolver(customerSchema) });
  const mutation = useMutation({
    mutationFn: async (payload: z.infer<typeof customerSchema>) => apiRequest('/customers', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  if (list.isLoading) return <LoadingState />;
  if (list.error) return <ErrorState message={(list.error as Error).message} />;

  return (
    <section className="space-y-4">
      <PanelTitulo titulo="Clientes" descripcion="Listado y creación de clientes." />
      <form className="grid gap-2 rounded-xl border bg-white p-4 md:grid-cols-3" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        <input className="rounded border px-2 py-1" placeholder="Nombre completo" {...form.register('full_name')} />
        <input className="rounded border px-2 py-1" placeholder="Teléfono" {...form.register('phone')} />
        <input className="rounded border px-2 py-1" placeholder="Correo (opcional)" {...form.register('email')} />
        <button className="rounded bg-slate-900 px-3 py-2 text-white md:col-span-3" disabled={mutation.isPending}>Crear cliente</button>
      </form>
      {mutation.error ? <ErrorState message={(mutation.error as Error).message} /> : null}
      {(list.data ?? []).length === 0 ? <EmptyState message="No hay clientes." /> : <Table rows={(list.data ?? []) as Record<string, unknown>[]} />}
    </section>
  );
}

export function ClienteDetallePage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ['customers', id], queryFn: async () => (await apiRequest<any>(`/customers/${id}`)).data });
  const alertMutation = useMutation({
    mutationFn: async (alert_note: string) => apiRequest(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify({ alert_note }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers', id] }),
  });

  if (detail.isLoading) return <LoadingState />;
  if (detail.error) return <ErrorState message={(detail.error as Error).message} />;

  const customer = detail.data;
  const phoneDigits = String(customer.phone ?? '').replace(/\D/g, '');
  const quickMessage = `Hola ${customer.full_name}, te contactamos de Vibran Tech.`;

  return (
    <section className="space-y-4">
      <PanelTitulo titulo={`Cliente #${id}`} descripcion="Detalle, alerta interna y acceso rápido a WhatsApp." />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded border bg-white p-4">
          <p><strong>Nombre:</strong> {customer.full_name}</p>
          <p><strong>Teléfono:</strong> {customer.phone}</p>
          <p><strong>Correo:</strong> {customer.email ?? '-'}</p>
          <p><strong>Total reparaciones:</strong> {customer.summary?.total_repairs ?? 0}</p>
          <p><strong>Total compras:</strong> {customer.summary?.total_sales ?? 0}</p>
        </div>
        <div className="rounded border bg-white p-4">
          <label className="mb-2 block text-sm font-medium">Alerta interna del cliente</label>
          <textarea defaultValue={customer.alert_note ?? ''} id="alert_note" className="h-28 w-full rounded border p-2 text-sm" />
          <button
            className="mt-2 rounded bg-slate-900 px-3 py-2 text-sm text-white"
            onClick={() => {
              const value = (document.getElementById('alert_note') as HTMLTextAreaElement)?.value ?? '';
              alertMutation.mutate(value);
            }}
          >
            Guardar alerta
          </button>
          <div className="mt-3 flex gap-2">
            <a className="rounded border px-3 py-2 text-sm" href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(quickMessage)}`} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
            <button className="rounded border px-3 py-2 text-sm" onClick={() => navigator.clipboard.writeText(quickMessage)}>Copiar mensaje</button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ReparacionesPage() {
  const me = useMe();
  const queryClient = useQueryClient();
  const repairsQuery = useQuery({ queryKey: ['repairs'], queryFn: async () => (await apiRequest<RepairItem[]>('/repairs')).data });
  const techniciansQuery = useQuery({
    queryKey: ['repairs-technicians', me.data?.branch_id],
    enabled: me.data?.role === 'administrador_general' || me.data?.role === 'encargado_sucursal',
    queryFn: async () =>
      (await apiRequest<AssignableTech[]>(`/repairs/assignable-technicians${me.data?.role === 'administrador_general' && me.data?.branch_id ? `?branch_id=${me.data.branch_id}` : ''}`)).data,
  });

  const takeWorkMutation = useMutation({
    mutationFn: async (repairId: number) => apiRequest(`/repairs/${repairId}/take-work`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repairs'] }),
  });

  const assignMutation = useMutation({
    mutationFn: async ({ repairId, technician_id }: { repairId: number; technician_id: number | null }) =>
      apiRequest(`/repairs/${repairId}/assignment`, { method: 'PATCH', body: JSON.stringify({ technician_id }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repairs'] }),
  });

  if (repairsQuery.isLoading || me.isLoading) return <LoadingState />;
  if (repairsQuery.error) return <ErrorState message={(repairsQuery.error as Error).message} />;

  const repairs = repairsQuery.data ?? [];

  return (
    <section className="space-y-4">
      <PanelTitulo titulo="Reparaciones" descripcion="Asignación por técnico, trabajos sin asignar y toma de trabajo." />
      {repairs.length === 0 ? <EmptyState message="No hay reparaciones." /> : null}
      {repairs.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Equipo</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Asignación</th>
                <th className="px-3 py-2 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {repairs.map((repair) => (
                <tr key={repair.id} className="border-t align-top">
                  <td className="px-3 py-2 font-medium">{repair.repair_number}</td>
                  <td className="px-3 py-2">{repair.brand} {repair.model}</td>
                  <td className="px-3 py-2">{repair.internal_status}</td>
                  <td className="px-3 py-2">
                    {repair.technician_name ? (
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{repair.technician_name}</span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-3 py-2 space-y-2">
                    {me.data?.role === 'tecnico' && repair.assignment_status === 'sin_asignar' ? (
                      <button
                        className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                        onClick={() => takeWorkMutation.mutate(repair.id)}
                        disabled={takeWorkMutation.isPending}
                      >
                        Tomar trabajo
                      </button>
                    ) : null}

                    {(me.data?.role === 'administrador_general' || me.data?.role === 'encargado_sucursal') ? (
                      <div className="flex flex-wrap gap-2">
                        <select
                          className="rounded border px-2 py-1 text-xs"
                          defaultValue={repair.technician_id ?? ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            assignMutation.mutate({ repairId: repair.id, technician_id: value ? Number(value) : null });
                          }}
                        >
                          <option value="">Sin asignar</option>
                          {(techniciansQuery.data ?? []).map((tech) => (
                            <option key={tech.id} value={tech.id}>{tech.full_name}</option>
                          ))}
                        </select>
                        {repair.technician_id ? (
                          <button
                            className="rounded border px-2 py-1 text-xs hover:bg-slate-50"
                            onClick={() => assignMutation.mutate({ repairId: repair.id, technician_id: null })}
                          >
                            Quitar asignación
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function Pendiente({ titulo }: { titulo: string }) {
  return <EmptyState message={`${titulo}: pendiente de backend completo para este módulo.`} />;
}

export const NuevaReparacionPage = () => <Pendiente titulo="Nueva reparación" />;
export const InventarioPage = () => <Pendiente titulo="Inventario" />;
export const MovimientosInventarioPage = () => <Pendiente titulo="Movimientos de inventario" />;
export const TransferenciasPage = () => <Pendiente titulo="Transferencias" />;
export const VentasPage = () => <Pendiente titulo="Ventas" />;
export const ReportesPage = () => <Pendiente titulo="Reportes" />;
export function ConfiguracionPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: async () => (await apiRequest<any[]>('/settings')).data });
  const saveMutation = useMutation({
    mutationFn: async (payload: { key: string; value: string; description?: string }) => apiRequest('/settings', { method: 'PUT', body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  if (settingsQuery.isLoading) return <LoadingState />;
  if (settingsQuery.error) return <ErrorState message={(settingsQuery.error as Error).message} />;

  return (
    <section className="space-y-4">
      <PanelTitulo titulo="Configuración" descripcion="Ajustes globales del negocio." />
      {(settingsQuery.data ?? []).map((setting) => (
        <div key={setting.key} className="rounded border bg-white p-4">
          <p className="text-sm font-semibold">{setting.key}</p>
          <p className="text-xs text-slate-500">{setting.description}</p>
          <input
            defaultValue={setting.value}
            className="mt-2 w-full rounded border px-2 py-1"
            onBlur={(e) => saveMutation.mutate({ key: setting.key, value: e.target.value, description: setting.description ?? undefined })}
          />
        </div>
      ))}
    </section>
  );
}
export const AuditoriaPage = () => <Pendiente titulo="Auditoría" />;
export const ConsultaReparacionPage = () => <Pendiente titulo="Consulta pública" />;
export const ReparacionDetallePage = () => <Pendiente titulo="Detalle de reparación" />;
