import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useState, forwardRef } from 'react';
import { z } from 'zod';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { PanelTitulo } from '@/components/panel-titulo';
import { useLogin, useMe } from '@/features/auth/use-auth';
import { apiRequest } from '@/lib/api';

const loginSchema = z.object({ username_or_email: z.string().min(1), password: z.string().min(1) });
type LoginInput = z.infer<typeof loginSchema>;

const branchSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  code: z.string().min(2, 'Mínimo 2 caracteres'),
  address: z.string().min(3, 'Mínimo 3 caracteres'),
  phone: z.string().min(5, 'Mínimo 5 caracteres'),
  manager_name: z.string().optional(),
});
type BranchInput = z.infer<typeof branchSchema>;

const userSchema = z.object({
  full_name: z.string().min(2, 'Mínimo 2 caracteres'),
  username_or_email: z.string().min(3, 'Mínimo 3 caracteres'),
  password: z.string().min(8, 'Mínimo 8 caracteres').optional().or(z.literal('')),
  role_id: z.coerce.number().int().positive('Selecciona un rol'),
  branch_id: z.coerce.number().int().positive().nullable().optional(),
  is_active: z.boolean().optional(),
});
type UserInput = z.infer<typeof userSchema>;

const subSchema = z.object({
  monthly_fee: z.coerce.number().positive('Monto requerido'),
  payment_day: z.coerce.number().int().min(1).max(31),
  next_due_date: z.string().min(1, 'Fecha requerida'),
  notes: z.string().optional(),
});
type SubInput = z.infer<typeof subSchema>;

const paymentSchema = z.object({
  amount: z.coerce.number().positive('Monto requerido'),
  payment_method: z.enum(['efectivo', 'transferencia', 'tarjeta', 'otro']),
  note: z.string().optional(),
});
type PaymentInput = z.infer<typeof paymentSchema>;

const customerSchema = z.object({
  full_name: z.string().min(2),
  phone: z.string().min(5),
  email: z.string().email().optional().or(z.literal('')),
  branch_id: z.coerce.number().int().positive().optional(),
});

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

interface SubscriptionRow {
  id: number;
  branchId: number;
  branchName: string;
  branchCode: string;
  branchIsActive: boolean;
  monthlyFee: string;
  paymentDay: number;
  nextDueDate: string;
  notes: string | null;
  isPaused: boolean;
  status: 'rojo' | 'amarillo' | 'verde' | 'pausado';
}

interface PaymentRecord {
  id: number;
  subscriptionId: number;
  branchId: number;
  amount: string;
  paidAt: string;
  paymentMethod: string;
  note: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  rojo: { bg: 'bg-red-100 border-red-400', text: 'text-red-700', label: 'Vencido' },
  amarillo: { bg: 'bg-yellow-100 border-yellow-400', text: 'text-yellow-700', label: 'Próximo' },
  verde: { bg: 'bg-green-100 border-green-400', text: 'text-green-700', label: 'Al día' },
  sin_configurar: { bg: 'bg-slate-100 border-slate-300', text: 'text-slate-500', label: 'Sin configurar' },
  pausado: { bg: 'bg-orange-100 border-orange-400', text: 'text-orange-700', label: 'Pausado' },
};

const DOT_COLORS: Record<string, string> = {
  rojo: 'bg-red-500',
  amarillo: 'bg-yellow-400',
  verde: 'bg-green-500',
  sin_configurar: 'bg-slate-400',
  pausado: 'bg-orange-500',
};

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function Btn({ children, onClick, disabled, variant = 'primary', size = 'md', type = 'button', className = '' }: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'soft' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  type?: 'button' | 'submit';
  className?: string;
}) {
  const base = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-4 py-2 text-sm' };
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    soft: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-slate-600 hover:bg-slate-100',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

const Input = forwardRef<HTMLInputElement, { label?: string; error?: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ label, error, className = '', ...props }, ref) {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        {label ? <label className="text-xs font-medium text-slate-600">{label}</label> : null}
        <input ref={ref} className="vt-input" {...props} />
        {error ? <p className="text-xs text-red-500">{error}</p> : null}
      </div>
    );
  }
);

const Select = forwardRef<HTMLSelectElement, { label?: string; error?: string; className?: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ label, error, className = '', children, ...props }, ref) {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        {label ? <label className="text-xs font-medium text-slate-600">{label}</label> : null}
        <select ref={ref} className="vt-input" {...props}>{children}</select>
        {error ? <p className="text-xs text-red-500">{error}</p> : null}
      </div>
    );
  }
);

function PhoneRepairLogo() {
  return (
    <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-20 h-20">
      <circle cx="40" cy="40" r="40" fill="#4F46E5" />
      <rect x="24" y="14" width="26" height="44" rx="4" fill="white" opacity="0.15" stroke="white" strokeWidth="2.5" />
      <rect x="27" y="20" width="20" height="28" rx="2" fill="white" opacity="0.25" />
      <circle cx="37" cy="53" r="2" fill="white" opacity="0.7" />
      <line x1="33" y1="17" x2="41" y2="17" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <circle cx="55" cy="27" r="10" fill="#FBBF24" />
      <path d="M52 24 L55 22 L58 24 L58 27 L55 30 L52 27 Z" fill="#78350F" opacity="0.3" />
      <path d="M50.5 30.5 L53 28 L55 30 L57 28 L59.5 30.5" stroke="#1E1B4B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M55 22 L55 20" stroke="#1E1B4B" strokeWidth="2" strokeLinecap="round" />
      <path d="M58.6 23.4 L60 22" stroke="#1E1B4B" strokeWidth="2" strokeLinecap="round" />
      <path d="M60 27 L62 27" stroke="#1E1B4B" strokeWidth="2" strokeLinecap="round" />
      <path d="M51.4 23.4 L50 22" stroke="#1E1B4B" strokeWidth="2" strokeLinecap="round" />
      <path d="M50 27 L48 27" stroke="#1E1B4B" strokeWidth="2" strokeLinecap="round" />
      <circle cx="55" cy="27" r="2.5" fill="#1E1B4B" />
      <path d="M33 34 L41 34" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M33 38 L39 38" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M33 42 L37 42" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-slate-100">
      <section className="w-full max-w-sm px-4">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <PhoneRepairLogo />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-slate-500">Accede a tu panel de gestión</p>
        </div>
        <Card className="p-6">
          <form className="space-y-4" onSubmit={form.handleSubmit((v) => loginMutation.mutate(v, { onSuccess: () => navigate('/dashboard') }))}>
            <Input label="Usuario o correo" placeholder="usuario" {...form.register('username_or_email')} />
            <Input label="Contraseña" type="password" placeholder="••••••••" {...form.register('password')} />
            {loginMutation.error ? <ErrorState message={loginMutation.error.message} /> : null}
            <Btn type="submit" disabled={loginMutation.isPending} className="w-full mt-1">
              {loginMutation.isPending ? 'Ingresando...' : 'Ingresar'}
            </Btn>
          </form>
        </Card>
      </section>
    </div>
  );
}

export function DashboardPage() {
  const me = useMe();
  const role = me.data?.role ?? '';

  const subscriptions = useQuery({
    queryKey: ['subscriptions'],
    enabled: role === 'admin_supremo',
    queryFn: async () => (await apiRequest<SubscriptionRow[]>('/subscriptions')).data,
    staleTime: 30000,
  });

  const branches = useQuery({
    queryKey: ['branches'],
    enabled: role !== 'admin_supremo',
    queryFn: async () => (await apiRequest<any[]>('/branches')).data,
    staleTime: 60000,
  });

  const customers = useQuery({
    queryKey: ['customers-count'],
    enabled: role !== 'admin_supremo',
    queryFn: async () => (await apiRequest<any[]>('/customers')).data,
    staleTime: 60000,
  });

  if (me.isLoading) return <LoadingState />;

  if (role === 'admin_supremo') {
    const subs = subscriptions.data ?? [];
    const overdue = subs.filter((s) => s.status === 'rojo').length;
    const upcoming = subs.filter((s) => s.status === 'amarillo').length;
    const ok = subs.filter((s) => s.status === 'verde').length;
    return (
      <section className="space-y-5">
        <PanelTitulo titulo="Dashboard" descripcion="Vista general de suscripciones." />
        {subscriptions.isLoading ? <LoadingState /> : (
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-5 border-l-4 border-l-green-500">
              <p className="text-sm text-slate-500">Al día</p>
              <p className="text-3xl font-bold text-green-600">{ok}</p>
            </Card>
            <Card className="p-5 border-l-4 border-l-yellow-400">
              <p className="text-sm text-slate-500">Pago próximo</p>
              <p className="text-3xl font-bold text-yellow-600">{upcoming}</p>
            </Card>
            <Card className="p-5 border-l-4 border-l-red-500">
              <p className="text-sm text-slate-500">Vencidos</p>
              <p className="text-3xl font-bold text-red-600">{overdue}</p>
            </Card>
          </div>
        )}
        <p className="text-sm text-slate-500">Ve a <strong>Sucursales y Suscripciones</strong> para gestionar pagos.</p>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <PanelTitulo titulo="Dashboard" descripcion="Resumen general." />
      {branches.isLoading || customers.isLoading ? <LoadingState /> : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <p className="text-sm text-slate-500">Sucursales visibles</p>
            <p className="text-3xl font-bold text-slate-900">{branches.data?.length ?? 0}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-slate-500">Clientes</p>
            <p className="text-3xl font-bold text-slate-900">{customers.data?.length ?? 0}</p>
          </Card>
        </div>
      )}
    </section>
  );
}

function SubscriptionDetail({ branchId, onClose, initialTab = 'pago' }: { branchId: number; onClose: () => void; initialTab?: 'pago' | 'editar' }) {
  const queryClient = useQueryClient();
  const me = useMe();
  const historyQuery = useQuery({
    queryKey: ['sub-history', branchId],
    queryFn: async () => (await apiRequest<{ subscription: SubscriptionRow; payments: PaymentRecord[] }>(`/subscriptions/${branchId}/payments`)).data,
    staleTime: 10000,
  });

  const subForm = useForm<SubInput>({ resolver: zodResolver(subSchema) });
  const payForm = useForm<PaymentInput>({ resolver: zodResolver(paymentSchema), defaultValues: { payment_method: 'efectivo' } });

  const subMutation = useMutation({
    mutationFn: async (v: SubInput) => apiRequest(`/subscriptions/${branchId}`, {
      method: 'POST',
      body: JSON.stringify({ ...v, branch_id: branchId }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['sub-history', branchId] });
    },
  });

  const payMutation = useMutation({
    mutationFn: async (v: PaymentInput) => apiRequest(`/subscriptions/${branchId}/payments`, {
      method: 'POST',
      body: JSON.stringify(v),
    }),
    onSuccess: () => {
      payForm.reset({ payment_method: 'efectivo' });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['sub-history', branchId] });
    },
  });

  const deletePayMutation = useMutation({
    mutationFn: async (paymentId: number) => apiRequest(`/subscriptions/payments/${paymentId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['sub-history', branchId] });
    },
  });

  const sub = historyQuery.data?.subscription;
  const payments = historyQuery.data?.payments ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">
            {sub ? sub.branchName : 'Suscripción'}
          </h2>
          <Btn variant="ghost" size="sm" onClick={onClose}>✕ Cerrar</Btn>
        </div>

        <div className="p-6 space-y-6">
          {historyQuery.isLoading ? <LoadingState /> : null}

          {sub ? (
            <div className="grid gap-3 text-sm">
              <div className="flex gap-4">
                <span className="text-slate-500">Estado:</span>
                <span className={`font-semibold ${STATUS_COLORS[sub.status]?.text}`}>
                  {STATUS_COLORS[sub.status]?.label}
                </span>
              </div>
              <div className="flex gap-4">
                <span className="text-slate-500">Próximo vencimiento:</span>
                <span className="font-medium">{sub.nextDueDate}</span>
              </div>
              <div className="flex gap-4">
                <span className="text-slate-500">Cuota mensual:</span>
                <span className="font-medium">${Number(sub.monthlyFee).toFixed(2)}</span>
              </div>
              {sub.notes ? <p className="text-slate-500 text-xs italic">{sub.notes}</p> : null}
            </div>
          ) : null}

          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Configurar suscripción</h3>
            <form onSubmit={subForm.handleSubmit((v) => subMutation.mutate(v))} className="grid gap-3 md:grid-cols-2">
              <Input
                label="Cuota mensual ($)"
                type="number"
                step="0.01"
                placeholder="50.00"
                defaultValue={sub?.monthlyFee}
                {...subForm.register('monthly_fee')}
                error={subForm.formState.errors.monthly_fee?.message}
              />
              <Input
                label="Día de pago (1-31)"
                type="number"
                min={1}
                max={31}
                defaultValue={sub?.paymentDay ?? 1}
                {...subForm.register('payment_day')}
                error={subForm.formState.errors.payment_day?.message}
              />
              <Input
                label="Próxima fecha de pago"
                type="date"
                defaultValue={sub?.nextDueDate}
                {...subForm.register('next_due_date')}
                error={subForm.formState.errors.next_due_date?.message}
                className="md:col-span-2"
              />
              <Input label="Notas (opcional)" placeholder="..." defaultValue={sub?.notes ?? ''} {...subForm.register('notes')} className="md:col-span-2" />
              {subMutation.error ? <ErrorState message={(subMutation.error as Error).message} /> : null}
              <Btn type="submit" disabled={subMutation.isPending} size="sm">
                {subMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
              </Btn>
            </form>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Registrar pago</h3>
            <form onSubmit={payForm.handleSubmit((v) => payMutation.mutate(v))} className="grid gap-3 md:grid-cols-3">
              <Input label="Monto ($)" type="number" step="0.01" placeholder="50.00" {...payForm.register('amount')} error={payForm.formState.errors.amount?.message} />
              <Select label="Método" {...payForm.register('payment_method')}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="otro">Otro</option>
              </Select>
              <Input label="Nota (opcional)" placeholder="..." {...payForm.register('note')} />
              {payMutation.error ? <ErrorState message={(payMutation.error as Error).message} /> : null}
              <Btn type="submit" disabled={payMutation.isPending} size="sm">
                {payMutation.isPending ? 'Registrando...' : 'Registrar pago'}
              </Btn>
            </form>
          </div>

          {payments.length > 0 ? (
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Historial de pagos</h3>
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-2.5 text-sm">
                    <div>
                      <span className="font-semibold text-green-700">${Number(p.amount).toFixed(2)}</span>
                      <span className="ml-2 text-slate-500">{p.paymentMethod}</span>
                      {p.note ? <span className="ml-2 text-slate-400 text-xs">— {p.note}</span> : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{new Date(p.paidAt).toLocaleDateString()}</span>
                      <Btn variant="danger" size="sm" disabled={deletePayMutation.isPending} onClick={() => deletePayMutation.mutate(p.id)}>✕</Btn>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center pt-2">Sin pagos registrados.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function SucursalesPage() {
  const me = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = me.data?.role ?? '';
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<'pago' | 'editar'>('pago');
  const [showCreate, setShowCreate] = useState(false);

  const subscriptions = useQuery({
    queryKey: ['subscriptions'],
    enabled: role === 'admin_supremo',
    queryFn: async () => (await apiRequest<SubscriptionRow[]>('/subscriptions')).data,
    staleTime: 30000,
  });

  const branches = useQuery({
    queryKey: ['branches'],
    enabled: role !== 'admin_supremo',
    queryFn: async () => (await apiRequest<any[]>('/branches')).data,
    staleTime: 60000,
  });

  const form = useForm<BranchInput>({ resolver: zodResolver(branchSchema) });
  const createMutation = useMutation({
    mutationFn: async (v: BranchInput) => apiRequest('/branches', { method: 'POST', body: JSON.stringify(v) }),
    onSuccess: () => {
      form.reset();
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async ({ branchId, pause }: { branchId: number; pause: boolean }) =>
      apiRequest(`/subscriptions/${branchId}/pause`, { method: 'PATCH', body: JSON.stringify({ pause }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });

  const handleEnter = (sub: SubscriptionRow) => {
    sessionStorage.setItem('impersonatedBranch', JSON.stringify({
      branchId: sub.branchId,
      branchName: sub.branchName,
      branchCode: sub.branchCode,
    }));
    navigate('/dashboard');
    window.location.reload();
  };

  if (me.isLoading) return <LoadingState />;

  if (role === 'admin_supremo') {
    const subs = subscriptions.data ?? [];
    return (
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <PanelTitulo titulo="Sucursales y Suscripciones" descripcion="Gestiona el estado de pago de cada cliente." />
          <Btn onClick={() => setShowCreate(!showCreate)}>+ Nueva sucursal</Btn>
        </div>

        {showCreate ? (
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Crear nueva sucursal</h3>
            <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="grid gap-3 md:grid-cols-3">
              <Input label="Nombre" placeholder="Cruz Technology" {...form.register('name')} error={form.formState.errors.name?.message} />
              <Input label="Código" placeholder="CRUZ01" {...form.register('code')} error={form.formState.errors.code?.message} />
              <Input label="Teléfono" placeholder="+1 809 000 0000" {...form.register('phone')} error={form.formState.errors.phone?.message} />
              <Input label="Dirección" placeholder="Calle..." {...form.register('address')} error={form.formState.errors.address?.message} className="md:col-span-2" />
              <Input label="Responsable (opcional)" placeholder="Nombre del encargado" {...form.register('manager_name')} />
              {createMutation.error ? <div className="md:col-span-3"><ErrorState message={(createMutation.error as Error).message} /></div> : null}
              <div className="md:col-span-3 flex gap-2">
                <Btn type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creando...' : 'Crear sucursal'}</Btn>
                <Btn variant="soft" onClick={() => setShowCreate(false)}>Cancelar</Btn>
              </div>
            </form>
          </Card>
        ) : null}

        {subscriptions.isLoading ? <LoadingState /> : null}

        {subs.length === 0 && !subscriptions.isLoading ? (
          <EmptyState message="No hay sucursales registradas." />
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subs.map((sub) => {
            const sc = STATUS_COLORS[sub.status];
            const dotColor = DOT_COLORS[sub.status];
            const isPausing = pauseMutation.isPending;
            return (
              <div key={sub.branchId} className={`rounded-xl border-2 ${sc.bg} p-4 flex flex-col gap-3`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
                      <h3 className="font-semibold text-slate-900 truncate">{sub.branchName}</h3>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">Código: {sub.branchCode}</p>
                  </div>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${sc.text} bg-white/60`}>
                    {sc.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Vencimiento</p>
                    <p className="font-medium">{sub.nextDueDate ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Cuota mensual</p>
                    <p className="font-medium">${Number(sub.monthlyFee).toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-black/5">
                  <Btn
                    size="sm"
                    variant="primary"
                    onClick={() => { setSelectedBranchId(sub.branchId); setDetailTab('pago'); }}
                  >
                    Registrar pago
                  </Btn>
                  <Btn
                    size="sm"
                    variant="soft"
                    onClick={() => { setSelectedBranchId(sub.branchId); setDetailTab('editar'); }}
                  >
                    Editar
                  </Btn>
                  <Btn
                    size="sm"
                    variant={sub.isPaused ? 'primary' : 'danger'}
                    disabled={isPausing}
                    onClick={() => pauseMutation.mutate({ branchId: sub.branchId, pause: !sub.isPaused })}
                  >
                    {sub.isPaused ? 'Reanudar' : 'Pausar'}
                  </Btn>
                  <Btn
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEnter(sub)}
                  >
                    Entrar →
                  </Btn>
                </div>
              </div>
            );
          })}
        </div>

        {selectedBranchId !== null ? (
          <SubscriptionDetail
            branchId={selectedBranchId}
            initialTab={detailTab}
            onClose={() => setSelectedBranchId(null)}
          />
        ) : null}
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <PanelTitulo titulo="Sucursales" descripcion="Listado de sucursales." />
        {(role === 'administrador_general') ? (
          <Btn onClick={() => setShowCreate(!showCreate)}>+ Nueva sucursal</Btn>
        ) : null}
      </div>
      {showCreate ? (
        <Card className="p-5">
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="grid gap-3 md:grid-cols-3">
            <Input label="Nombre" {...form.register('name')} error={form.formState.errors.name?.message} />
            <Input label="Código" {...form.register('code')} error={form.formState.errors.code?.message} />
            <Input label="Teléfono" {...form.register('phone')} error={form.formState.errors.phone?.message} />
            <Input label="Dirección" {...form.register('address')} error={form.formState.errors.address?.message} className="md:col-span-2" />
            <Input label="Responsable" {...form.register('manager_name')} />
            {createMutation.error ? <div className="md:col-span-3"><ErrorState message={(createMutation.error as Error).message} /></div> : null}
            <div className="md:col-span-3 flex gap-2">
              <Btn type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creando...' : 'Crear'}</Btn>
              <Btn variant="soft" onClick={() => setShowCreate(false)}>Cancelar</Btn>
            </div>
          </form>
        </Card>
      ) : null}
      {branches.isLoading ? <LoadingState /> : null}
      {branches.error ? <ErrorState message={(branches.error as Error).message} /> : null}
      <div className="space-y-2">
        {(branches.data ?? []).map((b: any) => (
          <Card key={b.id} className="px-5 py-4">
            <p className="font-semibold">{b.name}</p>
            <p className="text-xs text-slate-500">{b.address} · {b.phone}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function UsuariosPage() {
  const queryClient = useQueryClient();
  const me = useMe();
  const role = me.data?.role ?? '';
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const list = useQuery({ queryKey: ['users'], queryFn: async () => (await apiRequest<any[]>('/users')).data, staleTime: 30000 });
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: async () => (await apiRequest<any[]>('/roles')).data, staleTime: 300000 });
  const branchesQuery = useQuery({ queryKey: ['branches'], queryFn: async () => (await apiRequest<any[]>('/branches')).data, staleTime: 60000 });

  const createForm = useForm<UserInput>({ resolver: zodResolver(userSchema) });
  const editForm = useForm<UserInput>({ resolver: zodResolver(userSchema) });

  const createMutation = useMutation({
    mutationFn: async (v: UserInput) => apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify({ ...v, password: v.password || undefined, branch_id: v.branch_id || null }),
    }),
    onSuccess: () => {
      createForm.reset();
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<UserInput> }) => apiRequest(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...data, branch_id: data.branch_id || null }),
    }),
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) =>
      apiRequest(`/users/${id}/toggle-status`, { method: 'PATCH', body: JSON.stringify({ is_active }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const resetPassMutation = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) =>
      apiRequest(`/users/${id}/reset-password`, { method: 'PATCH', body: JSON.stringify({ password }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const allRoles: any[] = rolesQuery.data ?? [];
  const allBranches: any[] = branchesQuery.data ?? [];

  const allowedRoles = role === 'admin_supremo'
    ? allRoles
    : allRoles.filter((r: any) => !['admin_supremo'].includes(r.name));

  const getBranchName = (branchId: number | null) => {
    if (!branchId) return '-';
    return allBranches.find((b: any) => b.id === branchId)?.name ?? `#${branchId}`;
  };

  const getRoleDisplay = (roleName: string) => {
    const map: Record<string, string> = {
      admin_supremo: 'Admin Supremo',
      administrador_general: 'Admin General',
      encargado_sucursal: 'Encargado',
      tecnico: 'Técnico',
      caja_ventas: 'Caja / Ventas',
    };
    return map[roleName] ?? roleName;
  };

  if (list.isLoading || me.isLoading) return <LoadingState />;
  if (list.error) return <ErrorState message={(list.error as Error).message} />;

  const users = list.data ?? [];

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <PanelTitulo titulo="Usuarios" descripcion="Gestión de usuarios del sistema." />
        <Btn onClick={() => { setShowCreate(!showCreate); setEditingId(null); }}>+ Nuevo usuario</Btn>
      </div>

      {showCreate ? (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Crear usuario</h3>
          <form onSubmit={createForm.handleSubmit((v) => createMutation.mutate(v))} className="grid gap-3 md:grid-cols-2">
            <Input label="Nombre completo" {...createForm.register('full_name')} error={createForm.formState.errors.full_name?.message} />
            <Input label="Usuario / Correo" {...createForm.register('username_or_email')} error={createForm.formState.errors.username_or_email?.message} />
            <Input label="Contraseña (mín. 8 caracteres)" type="password" {...createForm.register('password')} error={createForm.formState.errors.password?.message} />
            <Select label="Rol" {...createForm.register('role_id')} error={createForm.formState.errors.role_id?.message}>
              <option value="">Selecciona rol</option>
              {allowedRoles.map((r: any) => <option key={r.id} value={r.id}>{getRoleDisplay(r.name)}</option>)}
            </Select>
            <Select label="Sucursal" {...createForm.register('branch_id')} error={createForm.formState.errors.branch_id?.message}>
              <option value="">Sin sucursal (global)</option>
              {allBranches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
            {createMutation.error ? <div className="md:col-span-2"><ErrorState message={(createMutation.error as Error).message} /></div> : null}
            <div className="md:col-span-2 flex gap-2">
              <Btn type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creando...' : 'Crear usuario'}</Btn>
              <Btn variant="soft" onClick={() => setShowCreate(false)}>Cancelar</Btn>
            </div>
          </form>
        </Card>
      ) : null}

      {editingId !== null ? (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Editar usuario #{editingId}</h3>
          {(() => {
            const u = users.find((u: any) => u.id === editingId);
            if (!u) return null;
            return (
              <form onSubmit={editForm.handleSubmit((v) => updateMutation.mutate({ id: editingId, data: v }))} className="grid gap-3 md:grid-cols-2">
                <Input label="Nombre completo" defaultValue={u.full_name} {...editForm.register('full_name')} error={editForm.formState.errors.full_name?.message} />
                <Input label="Usuario / Correo" defaultValue={u.username_or_email} {...editForm.register('username_or_email')} error={editForm.formState.errors.username_or_email?.message} />
                <Select label="Rol" defaultValue={u.role_id} {...editForm.register('role_id')} error={editForm.formState.errors.role_id?.message}>
                  <option value="">Selecciona rol</option>
                  {allowedRoles.map((r: any) => <option key={r.id} value={r.id}>{getRoleDisplay(r.name)}</option>)}
                </Select>
                <Select label="Sucursal" defaultValue={u.branch_id ?? ''} {...editForm.register('branch_id')} error={editForm.formState.errors.branch_id?.message}>
                  <option value="">Sin sucursal (global)</option>
                  {allBranches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
                {updateMutation.error ? <div className="md:col-span-2"><ErrorState message={(updateMutation.error as Error).message} /></div> : null}
                <div className="md:col-span-2 flex flex-wrap gap-2">
                  <Btn type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}</Btn>
                  <Btn variant="soft" onClick={() => setEditingId(null)}>Cancelar</Btn>
                </div>
              </form>
            );
          })()}
        </Card>
      ) : null}

      {users.length === 0 ? <EmptyState message="No hay usuarios." /> : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500 text-left">
              <th className="pb-2 pr-4 font-medium">Nombre</th>
              <th className="pb-2 pr-4 font-medium">Usuario</th>
              <th className="pb-2 pr-4 font-medium">Rol</th>
              <th className="pb-2 pr-4 font-medium">Sucursal</th>
              <th className="pb-2 pr-4 font-medium">Estado</th>
              <th className="pb-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 pr-4 font-medium text-slate-900">{u.full_name}</td>
                <td className="py-3 pr-4 text-slate-600">{u.username_or_email}</td>
                <td className="py-3 pr-4">
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{getRoleDisplay(u.role_name)}</span>
                </td>
                <td className="py-3 pr-4 text-slate-500 text-xs">{getBranchName(u.branch_id)}</td>
                <td className="py-3 pr-4">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {u.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="py-3">
                  <div className="flex gap-1.5 flex-wrap">
                    <Btn size="sm" variant="soft" onClick={() => { setEditingId(u.id); setShowCreate(false); }}>Editar</Btn>
                    <Btn
                      size="sm"
                      variant={u.is_active ? 'danger' : 'soft'}
                      disabled={toggleMutation.isPending}
                      onClick={() => toggleMutation.mutate({ id: u.id, is_active: !u.is_active })}
                    >
                      {u.is_active ? 'Desactivar' : 'Activar'}
                    </Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ClientesPage() {
  const queryClient = useQueryClient();
  const me = useMe();
  const role = me.data?.role ?? '';
  const [showCreate, setShowCreate] = useState(false);
  const branches = useQuery({ queryKey: ['branches'], enabled: ['admin_supremo', 'administrador_general'].includes(role), queryFn: async () => (await apiRequest<any[]>('/branches')).data, staleTime: 60000 });
  const list = useQuery({ queryKey: ['customers'], queryFn: async () => (await apiRequest<any[]>('/customers')).data, staleTime: 30000 });
  const form = useForm<z.infer<typeof customerSchema>>({ resolver: zodResolver(customerSchema) });
  const mutation = useMutation({
    mutationFn: async (v: z.infer<typeof customerSchema>) =>
      apiRequest('/customers', { method: 'POST', body: JSON.stringify({ ...v, branch_id: v.branch_id ? Number(v.branch_id) : undefined }) }),
    onSuccess: () => { form.reset(); setShowCreate(false); queryClient.invalidateQueries({ queryKey: ['customers'] }); },
  });

  if (list.isLoading || me.isLoading) return <LoadingState />;
  if (list.error) return <ErrorState message={(list.error as Error).message} />;

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <PanelTitulo titulo="Clientes" descripcion="Listado y creación de clientes." />
        <Btn onClick={() => setShowCreate(!showCreate)}>+ Nuevo cliente</Btn>
      </div>
      {showCreate ? (
        <Card className="p-5">
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="grid gap-3 md:grid-cols-3">
            <Input label="Nombre completo" {...form.register('full_name')} error={form.formState.errors.full_name?.message} />
            <Input label="Teléfono" {...form.register('phone')} error={form.formState.errors.phone?.message} />
            <Input label="Correo (opcional)" {...form.register('email')} error={form.formState.errors.email?.message} />
            {['admin_supremo', 'administrador_general'].includes(role) ? (
              <Select label="Sucursal" {...form.register('branch_id')}>
                <option value="">Selecciona sucursal</option>
                {(branches.data ?? []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            ) : null}
            {mutation.error ? <div className="md:col-span-3"><ErrorState message={(mutation.error as Error).message} /></div> : null}
            <div className="md:col-span-3 flex gap-2">
              <Btn type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Creando...' : 'Crear cliente'}</Btn>
              <Btn variant="soft" onClick={() => setShowCreate(false)}>Cancelar</Btn>
            </div>
          </form>
        </Card>
      ) : null}
      {(list.data ?? []).length === 0 ? <EmptyState message="No hay clientes." /> : (
        <div className="space-y-2">
          {(list.data ?? []).map((c: any) => (
            <Card key={c.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="font-medium text-slate-900">{c.full_name}</p>
                <p className="text-xs text-slate-500">{c.phone}{c.email ? ` · ${c.email}` : ''}</p>
              </div>
              <a href={`/clientes/${c.id}`} className="text-xs text-indigo-600 hover:underline">Ver detalle</a>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

export function ClienteDetallePage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ['customers', id], queryFn: async () => (await apiRequest<any>(`/customers/${id}`)).data, staleTime: 30000 });
  const alertMutation = useMutation({
    mutationFn: async (alert_note: string) => apiRequest(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify({ alert_note }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers', id] }),
  });

  if (detail.isLoading) return <LoadingState />;
  if (detail.error) return <ErrorState message={(detail.error as Error).message} />;

  const customer = detail.data;
  const phoneDigits = String(customer.phone ?? '').replace(/\D/g, '');
  const quickMessage = `Hola ${customer.full_name}, te contactamos sobre tu reparación.`;

  return (
    <section className="space-y-5">
      <PanelTitulo titulo={`Cliente: ${customer.full_name}`} descripcion="Detalle del cliente." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <p><strong>Nombre:</strong> {customer.full_name}</p>
          <p><strong>Teléfono:</strong> {customer.phone}</p>
          <p><strong>Correo:</strong> {customer.email ?? '-'}</p>
          <p><strong>Total reparaciones:</strong> {customer.summary?.total_repairs ?? 0}</p>
          <p><strong>Total compras:</strong> {customer.summary?.total_sales ?? 0}</p>
          <div className="mt-3 flex gap-2">
            <a className="vt-btn-soft text-xs" href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(quickMessage)}`} target="_blank" rel="noreferrer">WhatsApp</a>
            <button className="vt-btn-soft text-xs" onClick={() => navigator.clipboard.writeText(quickMessage)}>Copiar mensaje</button>
          </div>
        </Card>
        <Card className="p-5">
          <label className="mb-2 block text-sm font-medium">Alerta interna</label>
          <textarea defaultValue={customer.alert_note ?? ''} id="alert_note" className="h-28 w-full rounded-lg border border-slate-200 p-2 text-sm" />
          {alertMutation.isSuccess ? <p className="text-xs text-green-600 mt-1">Guardado.</p> : null}
          <Btn size="sm" className="mt-2" onClick={() => {
            const value = (document.getElementById('alert_note') as HTMLTextAreaElement)?.value ?? '';
            alertMutation.mutate(value);
          }}>Guardar alerta</Btn>
        </Card>
      </div>
    </section>
  );
}

export function ReparacionesPage() {
  const me = useMe();
  const queryClient = useQueryClient();
  const role = me.data?.role ?? '';
  const repairsQuery = useQuery({ queryKey: ['repairs'], queryFn: async () => (await apiRequest<RepairItem[]>('/repairs')).data, staleTime: 30000 });
  const techniciansQuery = useQuery({
    queryKey: ['repairs-technicians'],
    enabled: ['admin_supremo', 'administrador_general', 'encargado_sucursal'].includes(role),
    queryFn: async () => (await apiRequest<AssignableTech[]>('/repairs/assignable-technicians')).data,
    staleTime: 60000,
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
  const isManager = ['admin_supremo', 'administrador_general', 'encargado_sucursal'].includes(role);

  return (
    <section className="space-y-5">
      <PanelTitulo titulo="Reparaciones" descripcion="Gestión de reparaciones y asignación de técnicos." />
      {repairs.length === 0 ? <EmptyState message="No hay reparaciones." /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 text-left">
                <th className="pb-2 pr-4 font-medium">#</th>
                <th className="pb-2 pr-4 font-medium">Equipo</th>
                <th className="pb-2 pr-4 font-medium">Estado</th>
                <th className="pb-2 pr-4 font-medium">Técnico</th>
                {isManager || role === 'tecnico' ? <th className="pb-2 font-medium">Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {repairs.map((repair) => (
                <tr key={repair.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 pr-4 font-mono text-xs">{repair.repair_number}</td>
                  <td className="py-3 pr-4">{repair.brand} {repair.model}</td>
                  <td className="py-3 pr-4">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{repair.internal_status}</span>
                  </td>
                  <td className="py-3 pr-4">
                    {repair.technician_name
                      ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">{repair.technician_name}</span>
                      : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">Sin asignar</span>}
                  </td>
                  {isManager ? (
                    <td className="py-3">
                      <select
                        className="vt-input text-xs py-1"
                        defaultValue={repair.technician_id ?? ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          assignMutation.mutate({ repairId: repair.id, technician_id: value ? Number(value) : null });
                        }}
                      >
                        <option value="">Sin asignar</option>
                        {(techniciansQuery.data ?? []).map((tech) => <option key={tech.id} value={tech.id}>{tech.full_name}</option>)}
                      </select>
                    </td>
                  ) : null}
                  {role === 'tecnico' && repair.assignment_status === 'sin_asignar' ? (
                    <td className="py-3">
                      <Btn size="sm" variant="soft" disabled={takeWorkMutation.isPending} onClick={() => takeWorkMutation.mutate(repair.id)}>
                        Tomar trabajo
                      </Btn>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Pendiente({ titulo }: { titulo: string }) {
  return (
    <section className="space-y-5">
      <PanelTitulo titulo={titulo} descripcion="Módulo en desarrollo." />
      <Card className="p-10 text-center text-slate-400">
        <p className="text-2xl mb-2">🚧</p>
        <p className="text-sm">Este módulo estará disponible próximamente.</p>
      </Card>
    </section>
  );
}

export const NuevaReparacionPage = () => <Pendiente titulo="Nueva reparación" />;
export const InventarioPage = () => <Pendiente titulo="Inventario" />;
export const MovimientosInventarioPage = () => <Pendiente titulo="Movimientos de inventario" />;
export const TransferenciasPage = () => <Pendiente titulo="Transferencias" />;
export const VentasPage = () => <Pendiente titulo="Ventas" />;
export const ReportesPage = () => <Pendiente titulo="Reportes" />;
export const AuditoriaPage = () => <Pendiente titulo="Auditoría" />;
export const ConsultaReparacionPage = () => <Pendiente titulo="Consulta pública" />;
export const ReparacionDetallePage = () => <Pendiente titulo="Detalle de reparación" />;

export function ConfiguracionPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: async () => (await apiRequest<any[]>('/settings')).data, staleTime: 60000 });
  const saveMutation = useMutation({
    mutationFn: async (payload: { key: string; value: string; description?: string }) => apiRequest('/settings', { method: 'PUT', body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  if (settingsQuery.isLoading) return <LoadingState />;
  if (settingsQuery.error) return <ErrorState message={(settingsQuery.error as Error).message} />;

  return (
    <section className="space-y-5">
      <PanelTitulo titulo="Configuración" descripcion="Ajustes globales del negocio." />
      {(settingsQuery.data ?? []).map((setting: any) => (
        <Card key={setting.key} className="p-5">
          <p className="text-sm font-semibold">{setting.key}</p>
          <p className="text-xs text-slate-500">{setting.description}</p>
          <input
            defaultValue={setting.value}
            className="vt-input mt-2"
            onBlur={(e) => saveMutation.mutate({ key: setting.key, value: e.target.value, description: setting.description ?? undefined })}
          />
        </Card>
      ))}
    </section>
  );
}
