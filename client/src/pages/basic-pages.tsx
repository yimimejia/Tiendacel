import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState, forwardRef } from 'react';
import { z } from 'zod';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { PanelTitulo } from '@/components/panel-titulo';
import { useLogin, useMe } from '@/features/auth/use-auth';
import { apiRequest } from '@/lib/api';

const loginSchema = z.object({
  username_or_email: z.string().min(1),
  password: z.string().min(1),
});
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
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  brand: string;
  model: string;
  reported_issue: string;
  internal_status: string;
  technician_id: number | null;
  technician_name: string | null;
  assignment_status: 'asignado' | 'sin_asignar';
  received_at: string;
  delivered_at: string | null;
  is_completed: boolean;
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

const DEVICE_MODELS_BY_BRAND: Record<string, string[]> = {
  Apple: ['iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16', 'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15', 'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14', 'iPhone 13 Pro Max', 'iPhone 13', 'iPhone 12', 'iPhone 11', 'iPhone XS Max', 'iPhone XR', 'iPhone X', 'iPhone 8 Plus', 'iPhone 7 Plus', 'iPhone 6s'],
  Samsung: ['Galaxy S24 Ultra', 'Galaxy S24+', 'Galaxy S24', 'Galaxy S23 Ultra', 'Galaxy S23+', 'Galaxy S23', 'Galaxy S22 Ultra', 'Galaxy S21', 'Galaxy Note 20 Ultra', 'Galaxy A55', 'Galaxy A54', 'Galaxy A34'],
  Xiaomi: ['Xiaomi 14 Ultra', 'Xiaomi 14', 'Xiaomi 13 Pro', 'Xiaomi 13', 'Redmi Note 13 Pro+', 'Redmi Note 13', 'Redmi Note 12', 'POCO F6 Pro', 'POCO X6 Pro', 'POCO X5'],
  Huawei: ['Pura 70 Pro', 'P60 Pro', 'Mate 60 Pro', 'Mate 50 Pro', 'nova 12i', 'nova 11'],
  Motorola: ['Edge 50 Pro', 'Edge 40', 'Moto G84', 'Moto G73', 'Moto G54', 'Moto G Power'],
  Oppo: ['Find X7 Ultra', 'Reno 11', 'Reno 10', 'A98', 'A78'],
  realme: ['GT 6', 'GT 5', '12 Pro+', '11 Pro+', 'C67'],
  vivo: ['X100 Pro', 'V30', 'V29', 'Y100', 'Y36'],
};
const INVENTORY_STORAGE_KEY = 'vt_inventory_items';
type NcfStats = { current: string; rangeStart: string; rangeEnd: string; available: number; percentUsed: number };

function toDigits(value: string) {
  return (value ?? '').replace(/\D/g, '');
}

function buildNcfStats(current: string, end: string, usedRaw?: number): NcfStats {
  const currentDigits = toDigits(current);
  const endDigits = toDigits(end);
  const currentNum = Number(currentDigits || 0);
  const endNum = Number(endDigits || 0);
  const hasRange = currentNum > 0 && endNum >= currentNum;
  const available = hasRange ? endNum - currentNum + 1 : 0;
  const used = Number.isFinite(Number(usedRaw)) && Number(usedRaw) >= 0 ? Number(usedRaw) : 0;
  const total = used + available;
  const percentUsed = total > 0 ? Number(((used / total) * 100).toFixed(2)) : 0;

  return {
    current: current ?? '',
    rangeStart: current ?? '',
    rangeEnd: end ?? '',
    available,
    percentUsed,
  };
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
          <form className="space-y-4" onSubmit={form.handleSubmit((v) => loginMutation.mutate(v, {
            onSuccess: (data) => {
              const role = data.user.role;
              if (role === 'caja_ventas') {
                navigate('/ventas');
                return;
              }
              navigate('/dashboard');
            },
          }))}>
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

type DashboardStats = {
  customers: number;
  activeRepairs: number;
  deliveredRepairs: number;
  totalRepairs: number;
  salesToday: number;
  revenueToday: number;
};

function StatCard({ label, value, color = 'slate' }: { label: string; value: string | number; color?: string }) {
  const borderColor = color === 'green' ? 'border-l-green-500' : color === 'blue' ? 'border-l-blue-500' : color === 'orange' ? 'border-l-orange-400' : color === 'purple' ? 'border-l-purple-500' : 'border-l-slate-400';
  const textColor = color === 'green' ? 'text-green-600' : color === 'blue' ? 'text-blue-600' : color === 'orange' ? 'text-orange-500' : color === 'purple' ? 'text-purple-600' : 'text-slate-800';
  return (
    <Card className={`p-5 border-l-4 ${borderColor}`}>
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${textColor}`}>{value}</p>
    </Card>
  );
}

const WORKER_ONLY_ROLES = ['mensajero', 'empleado', 'tecnico'];

export function DashboardPage() {
  const me = useMe();
  const role = me.data?.role ?? '';
  const isWorker = WORKER_ONLY_ROLES.includes(role);

  const subscriptions = useQuery({
    queryKey: ['subscriptions'],
    enabled: role === 'admin_supremo',
    queryFn: async () => (await apiRequest<SubscriptionRow[]>('/subscriptions')).data,
    staleTime: 30000,
  });

  const branchStats = useQuery({
    queryKey: ['dashboard-stats'],
    enabled: !isWorker && role !== 'admin_supremo',
    queryFn: async () => (await apiRequest<DashboardStats>('/dashboard/stats')).data,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const lowStockQuery = useQuery({
    queryKey: ['low-stock'],
    enabled: !isWorker && role !== 'admin_supremo',
    queryFn: async () => (await apiRequest<{ id: number; name: string; sku: string | null; current_stock: number; minimum_stock: number }[]>('/dashboard/low-stock')).data,
    staleTime: 60000,
  });

  const myStats = useQuery({
    queryKey: ['my-stats'],
    enabled: isWorker,
    queryFn: async () => (await apiRequest<{ myPending: number; myCompleted: number; myTotal: number }>('/dashboard/my-stats')).data,
    staleTime: 30000,
    refetchInterval: 60000,
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
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Al día</p>
              <p className="text-3xl font-bold text-green-600">{ok}</p>
            </Card>
            <Card className="p-5 border-l-4 border-l-yellow-400">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Pago próximo</p>
              <p className="text-3xl font-bold text-yellow-600">{upcoming}</p>
            </Card>
            <Card className="p-5 border-l-4 border-l-red-500">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Vencidos</p>
              <p className="text-3xl font-bold text-red-600">{overdue}</p>
            </Card>
          </div>
        )}
        <p className="text-sm text-slate-500">Ve a <strong>Sucursales y Suscripciones</strong> para gestionar pagos.</p>
      </section>
    );
  }

  if (isWorker) {
    const s = myStats.data;
    return (
      <section className="space-y-5">
        <PanelTitulo titulo={`Bienvenido, ${me.data?.full_name?.split(' ')[0] ?? 'usuario'}`} descripcion="Resumen de tus trabajos asignados." />
        {myStats.isLoading ? <LoadingState /> : (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
            <Card className="p-5 border-l-4 border-l-orange-500">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Pendientes</p>
              <p className="text-3xl font-bold text-orange-600">{s?.myPending ?? 0}</p>
              <p className="text-xs text-slate-400 mt-1">trabajos asignados</p>
            </Card>
            <Card className="p-5 border-l-4 border-l-green-500">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Completados</p>
              <p className="text-3xl font-bold text-green-600">{s?.myCompleted ?? 0}</p>
              <p className="text-xs text-slate-400 mt-1">trabajos completados</p>
            </Card>
            <Card className="p-5 border-l-4 border-l-blue-500 col-span-2 md:col-span-1">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total</p>
              <p className="text-3xl font-bold text-blue-600">{s?.myTotal ?? 0}</p>
              <p className="text-xs text-slate-400 mt-1">trabajos en total</p>
            </Card>
          </div>
        )}
        <Card className="p-5">
          <p className="text-sm text-slate-600 mb-3">Acceso rápido</p>
          <div className="flex gap-3 flex-wrap">
            <a href="/reparaciones" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              Ver mis trabajos pendientes
            </a>
            <a href="/trabajos-completados" className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">
              Buscar trabajos completados
            </a>
          </div>
        </Card>
      </section>
    );
  }

  const stats = branchStats.data;
  const fmt = (n: number) => n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <section className="space-y-5">
      <PanelTitulo titulo="Dashboard" descripcion="Métricas de tu sucursal hoy." />
      {branchStats.isLoading ? <LoadingState /> : (
        <>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <StatCard label="Clientes" value={stats?.customers ?? 0} color="blue" />
            <StatCard label="Reparaciones activas" value={stats?.activeRepairs ?? 0} color="orange" />
            <StatCard label="Ventas hoy" value={stats?.salesToday ?? 0} color="green" />
            <StatCard label="Ingresos hoy" value={`RD$ ${fmt(stats?.revenueToday ?? 0)}`} color="purple" />
          </div>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-2">
            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Reparaciones entregadas</p>
              <p className="text-2xl font-bold text-slate-700">{stats?.deliveredRepairs ?? 0}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total reparaciones</p>
              <p className="text-2xl font-bold text-slate-700">{stats?.totalRepairs ?? 0}</p>
            </Card>
          </div>

          {(lowStockQuery.data?.length ?? 0) > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="text-red-500">⚠</span> Productos agotados o con stock bajo
                <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">{lowStockQuery.data!.length}</span>
              </h3>
              <div className="divide-y divide-slate-100">
                {lowStockQuery.data!.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <div className="min-w-0">
                      <span className="font-medium text-slate-800 truncate">{p.name}</span>
                      {p.sku && <span className="ml-2 text-xs text-slate-400">{p.sku}</span>}
                    </div>
                    <span className={`ml-3 font-bold px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${p.current_stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {p.current_stock === 0 ? 'Agotado' : `${p.current_stock} restantes`}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
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
  const [assignBranchId, setAssignBranchId] = useState<number | null>(null);
  const [assignUserId, setAssignUserId] = useState<number | null>(null);
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
  const usersQuery = useQuery({
    queryKey: ['users-admin-general'],
    enabled: role === 'admin_supremo',
    queryFn: async () => (await apiRequest<any[]>('/users')).data,
    staleTime: 30000,
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
  const assignMutation = useMutation({
    mutationFn: async ({ branchId, userId }: { branchId: number; userId: number }) =>
      apiRequest(`/branches/${branchId}/assign-access`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }),
    onSuccess: () => {
      setAssignBranchId(null);
      setAssignUserId(null);
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
                  <Btn
                    size="sm"
                    variant="soft"
                    onClick={() => {
                      setAssignBranchId(sub.branchId);
                      setAssignUserId(null);
                    }}
                  >
                    Asignar
                  </Btn>
                </div>
              </div>
            );
          })}
        </div>

        {assignBranchId ? (
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Asignar acceso de sucursal</h3>
            <Select label="Usuario administrador general" value={assignUserId ?? ''} onChange={(e) => setAssignUserId(Number(e.target.value))}>
              <option value="">Selecciona usuario</option>
              {(usersQuery.data ?? [])
                .filter((u: any) => u.role_name === 'administrador_general')
                .map((u: any) => <option key={u.id} value={u.id}>{u.full_name} ({u.username_or_email})</option>)}
            </Select>
            {assignMutation.error ? <ErrorState message={(assignMutation.error as Error).message} /> : null}
            <div className="flex gap-2">
              <Btn
                onClick={() => assignUserId && assignMutation.mutate({ branchId: assignBranchId, userId: assignUserId })}
                disabled={!assignUserId || assignMutation.isPending}
              >
                {assignMutation.isPending ? 'Asignando...' : 'Guardar asignación'}
              </Btn>
              <Btn variant="soft" onClick={() => setAssignBranchId(null)}>Cancelar</Btn>
            </div>
          </Card>
        ) : null}

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
  const [impersonatedBranchId, setImpersonatedBranchId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('impersonatedBranch');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { branchId?: number };
      setImpersonatedBranchId(parsed.branchId ?? null);
    } catch {
      setImpersonatedBranchId(null);
    }
  }, []);

  const isImpersonating = role === 'admin_supremo' && impersonatedBranchId !== null;
  const effectiveRole = isImpersonating ? 'administrador_general' : role;
  const effectiveBranchId = isImpersonating ? impersonatedBranchId : (me.data?.branch_id ?? null);

  const list = useQuery({
    queryKey: ['users', effectiveRole, effectiveBranchId],
    queryFn: async () => {
      const query = isImpersonating && effectiveBranchId ? `?branch_id=${effectiveBranchId}` : '';
      return (await apiRequest<any[]>(`/users${query}`)).data;
    },
    staleTime: 30000,
  });
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: async () => (await apiRequest<any[]>('/roles')).data, staleTime: 300000 });
  const branchesQuery = useQuery({ queryKey: ['branches'], queryFn: async () => (await apiRequest<any[]>('/branches')).data, staleTime: 60000 });

  const createForm = useForm<UserInput>({ resolver: zodResolver(userSchema) });
  const editForm = useForm<UserInput>({ resolver: zodResolver(userSchema) });

  const createMutation = useMutation({
    mutationFn: async (v: UserInput) => apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify(v),
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
      body: JSON.stringify(data),
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
  const myBranchId = effectiveBranchId;
  const isSupremo = effectiveRole === 'admin_supremo';
  const visibleBranches = isSupremo ? allBranches : allBranches.filter((b: any) => b.id === myBranchId);

  const allowedRoles = isSupremo
    ? allRoles
    : allRoles.filter((r: any) => ['encargado_sucursal', 'tecnico', 'caja_ventas', 'mensajero', 'empleado'].includes(r.name));

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
      mensajero: 'Mensajero',
      empleado: 'Empleado',
    };
    return map[roleName] ?? roleName;
  };

  if (list.isLoading || me.isLoading) return <LoadingState />;
  if (list.error) return <ErrorState message={(list.error as Error).message} />;

  const users = list.data ?? [];
  const normalizeUserPayload = (v: UserInput) => ({
    ...v,
    password: v.password || undefined,
    branch_id: isSupremo ? (v.branch_id || null) : myBranchId,
  });

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <PanelTitulo titulo="Usuarios" descripcion="Gestión de usuarios del sistema." />
        <Btn onClick={() => { setShowCreate(!showCreate); setEditingId(null); }}>+ Nuevo usuario</Btn>
      </div>

      {showCreate ? (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Crear usuario</h3>
          <form onSubmit={createForm.handleSubmit((v) => createMutation.mutate(normalizeUserPayload(v) as UserInput))} className="grid gap-3 md:grid-cols-2">
            <Input label="Nombre completo" {...createForm.register('full_name')} error={createForm.formState.errors.full_name?.message} />
            <Input label="Usuario / Correo" {...createForm.register('username_or_email')} error={createForm.formState.errors.username_or_email?.message} />
            <Input label="Contraseña (mín. 8 caracteres)" type="password" {...createForm.register('password')} error={createForm.formState.errors.password?.message} />
            <Select label="Rol" {...createForm.register('role_id')} error={createForm.formState.errors.role_id?.message}>
              <option value="">Selecciona rol</option>
              {allowedRoles.map((r: any) => <option key={r.id} value={r.id}>{getRoleDisplay(r.name)}</option>)}
            </Select>
            <Select label="Sucursal" defaultValue={isSupremo ? '' : String(myBranchId ?? '')} {...createForm.register('branch_id')} disabled={!isSupremo} error={createForm.formState.errors.branch_id?.message}>
              {isSupremo ? <option value="">Sin sucursal (global)</option> : null}
              {visibleBranches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
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
              <form onSubmit={editForm.handleSubmit((v) => updateMutation.mutate({ id: editingId, data: normalizeUserPayload(v) }))} className="grid gap-3 md:grid-cols-2">
                <Input label="Nombre completo" defaultValue={u.full_name} {...editForm.register('full_name')} error={editForm.formState.errors.full_name?.message} />
                <Input label="Usuario / Correo" defaultValue={u.username_or_email} {...editForm.register('username_or_email')} error={editForm.formState.errors.username_or_email?.message} />
                <Select label="Rol" defaultValue={u.role_id} {...editForm.register('role_id')} error={editForm.formState.errors.role_id?.message}>
                  <option value="">Selecciona rol</option>
                  {allowedRoles.map((r: any) => <option key={r.id} value={r.id}>{getRoleDisplay(r.name)}</option>)}
                </Select>
                <Select label="Sucursal" defaultValue={u.branch_id ?? (isSupremo ? '' : myBranchId ?? '')} disabled={!isSupremo} {...editForm.register('branch_id')} error={editForm.formState.errors.branch_id?.message}>
                  {isSupremo ? <option value="">Sin sucursal (global)</option> : null}
                  {visibleBranches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
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
                      variant="ghost"
                      disabled={resetPassMutation.isPending}
                      onClick={() => {
                        const password = window.prompt(`Nueva contraseña para ${u.full_name} (mín. 8 caracteres):`);
                        if (!password || password.length < 8) return;
                        resetPassMutation.mutate({ id: u.id, password });
                      }}
                    >
                      Cambiar clave
                    </Btn>
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

const PENDING_STATUSES_LIST = ['Recibido', 'Pendiente', 'En diagnóstico', 'Esperando aprobación', 'En reparación', 'Reparado', 'Listo para entregar'];

function RepairStatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    'Recibido': 'bg-slate-100 text-slate-700',
    'Pendiente': 'bg-yellow-100 text-yellow-700',
    'En diagnóstico': 'bg-blue-100 text-blue-700',
    'Esperando aprobación': 'bg-orange-100 text-orange-700',
    'En reparación': 'bg-indigo-100 text-indigo-700',
    'Reparado': 'bg-teal-100 text-teal-700',
    'Listo para entregar': 'bg-green-100 text-green-700',
    'Entregado': 'bg-green-200 text-green-800',
    'Cancelado': 'bg-red-100 text-red-700',
    'No reparable': 'bg-gray-200 text-gray-700',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colorMap[status] ?? 'bg-slate-100 text-slate-600'}`}>{status}</span>;
}

export function ReparacionesPage() {
  const me = useMe();
  const queryClient = useQueryClient();
  const role = me.data?.role ?? '';
  const myBranchId = me.data?.branch_id ?? null;

  const [viewProblem, setViewProblem] = useState<RepairItem | null>(null);
  const [assignRepairModal, setAssignRepairModal] = useState<RepairItem | null>(null);
  const [statusRepair, setStatusRepair] = useState<RepairItem | null>(null);

  const getEffectiveBranchId = () => {
    try {
      const stored = sessionStorage.getItem('impersonatedBranch');
      if (stored) return JSON.parse(stored)?.branchId ?? null;
    } catch {}
    return myBranchId;
  };

  const repairsQuery = useQuery({
    queryKey: ['repairs', 'pending'],
    queryFn: async () => (await apiRequest<RepairItem[]>('/repairs?filter=pending')).data,
    staleTime: 20000,
  });

  const effectiveBranchId = getEffectiveBranchId();

  const techniciansQuery = useQuery({
    queryKey: ['repairs-technicians', assignRepairModal?.branch_id ?? effectiveBranchId],
    enabled: Boolean(assignRepairModal) && ['admin_supremo', 'administrador_general', 'encargado_sucursal'].includes(role),
    queryFn: async () => {
      const bid = assignRepairModal?.branch_id ?? effectiveBranchId;
      return (await apiRequest<AssignableTech[]>(`/repairs/assignable-technicians${bid ? `?branch_id=${bid}` : ''}`)).data;
    },
    staleTime: 60000,
  });

  const takeWorkMutation = useMutation({
    mutationFn: async (repairId: number) => apiRequest(`/repairs/${repairId}/take-work`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repairs'] }),
  });

  const assignMutation = useMutation({
    mutationFn: async ({ repairId, technician_id }: { repairId: number; technician_id: number | null }) =>
      apiRequest(`/repairs/${repairId}/assignment`, { method: 'PATCH', body: JSON.stringify({ technician_id }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['repairs'] }); setAssignRepairModal(null); },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ repairId, status }: { repairId: number; status: string }) =>
      apiRequest(`/repairs/${repairId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['repairs'] }); setStatusRepair(null); },
  });

  if (repairsQuery.isLoading || me.isLoading) return <LoadingState />;
  if (repairsQuery.error) return <ErrorState message={(repairsQuery.error as Error).message} />;

  const repairs = repairsQuery.data ?? [];
  const isManager = ['admin_supremo', 'administrador_general', 'encargado_sucursal'].includes(role);
  const canWork = ['tecnico', 'mensajero', 'empleado', 'encargado_sucursal'].includes(role);

  return (
    <section className="space-y-5">
      <PanelTitulo titulo="Trabajos pendientes" descripcion="Reparaciones activas en tu sucursal." />

      {viewProblem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewProblem(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 text-lg">Detalle del trabajo</h3>
            <p className="text-xs text-slate-500 font-mono">Orden: {viewProblem.repair_number}</p>
            <p className="text-sm"><span className="text-slate-500">Equipo:</span> <strong>{viewProblem.brand} {viewProblem.model}</strong></p>
            <p className="text-sm"><span className="text-slate-500">Cliente:</span> <strong>{viewProblem.customer_name}</strong> {viewProblem.customer_phone && <span className="text-slate-400">· {viewProblem.customer_phone}</span>}</p>
            <p className="text-sm"><span className="text-slate-500">Problema reportado:</span></p>
            <p className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap">{viewProblem.reported_issue}</p>
            <p className="text-xs text-slate-400">Recibido: {new Date(viewProblem.received_at).toLocaleString('es-DO')}</p>
            <button onClick={() => setViewProblem(null)} className="mt-2 w-full py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200">Cerrar</button>
          </div>
        </div>
      )}

      {assignRepairModal && isManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAssignRepairModal(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800">Asignar empleado</h3>
            <p className="text-xs text-slate-500">Orden: <strong>{assignRepairModal.repair_number}</strong> · {assignRepairModal.brand} {assignRepairModal.model}</p>
            {techniciansQuery.isLoading ? <LoadingState /> : (
              <select defaultValue={assignRepairModal.technician_id ?? ''}
                onChange={e => {
                  const v = e.target.value;
                  assignMutation.mutate({ repairId: assignRepairModal.id, technician_id: v ? Number(v) : null });
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Sin asignar</option>
                {(techniciansQuery.data ?? []).map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            )}
            <button onClick={() => setAssignRepairModal(null)} className="w-full py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200">Cancelar</button>
          </div>
        </div>
      )}

      {statusRepair && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setStatusRepair(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800">Actualizar estado</h3>
            <p className="text-xs text-slate-500">{statusRepair.repair_number} · {statusRepair.brand} {statusRepair.model}</p>
            <div className="space-y-2">
              {PENDING_STATUSES_LIST.map(s => (
                <button key={s} disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate({ repairId: statusRepair.id, status: s })}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${statusRepair.internal_status === s ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50'}`}>
                  {s}
                </button>
              ))}
              <button disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ repairId: statusRepair.id, status: 'Entregado' })}
                className="w-full text-left px-3 py-2 rounded-lg text-sm border border-green-500 bg-green-50 text-green-700 hover:bg-green-100 transition-colors font-medium">
                Marcar como entregado/completado
              </button>
            </div>
            <button onClick={() => setStatusRepair(null)} className="w-full py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200">Cancelar</button>
          </div>
        </div>
      )}

      {repairs.length === 0 ? <EmptyState message="No hay trabajos pendientes." /> : (
        <div className="space-y-3">
          {repairs.map((repair) => (
            <Card key={repair.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{repair.repair_number}</span>
                    <RepairStatusBadge status={repair.internal_status} />
                  </div>
                  <p className="font-semibold text-slate-800">{repair.brand} {repair.model}</p>
                  <p className="text-sm text-slate-600">Cliente: <span className="font-medium">{repair.customer_name}</span>{repair.customer_phone ? ` · ${repair.customer_phone}` : ''}</p>
                  <p className="text-sm text-slate-500 truncate max-w-xs">Problema: {repair.reported_issue}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <span className="text-xs text-slate-400">Responsable:</span>
                    {repair.technician_name
                      ? <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{repair.technician_name}</span>
                      : <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Ninguno</span>}
                  </div>
                  <p className="text-xs text-slate-400">Recibido: {new Date(repair.received_at).toLocaleDateString('es-DO')}</p>
                </div>
                <div className="flex flex-wrap gap-2 items-start">
                  <button onClick={() => setViewProblem(repair)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200">
                    Ver problema
                  </button>
                  {isManager && (
                    <button onClick={() => setAssignRepairModal(repair)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200">
                      Asignar
                    </button>
                  )}
                  {(canWork || isManager) && (
                    <button onClick={() => setStatusRepair(repair)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200">
                      Estado
                    </button>
                  )}
                  {canWork && !isManager && repair.assignment_status === 'sin_asignar' && (
                    <Btn size="sm" variant="soft" disabled={takeWorkMutation.isPending} onClick={() => takeWorkMutation.mutate(repair.id)}>
                      Tomar
                    </Btn>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

interface RepairInvoiceData {
  repair: RepairItem;
  customer: { id: number; full_name: string; phone: string; email: string; address: string } | null;
  sale: { id: number; sale_number: string; total: string; tax_amount: string; discount_amount: string; payment_method: string; ncf: string | null; created_at: string; cashier_name: string } | null;
  sale_items: { product_name: string; quantity: string; unit_price: string; subtotal: string }[];
}

function RepairInvoiceModal({ repairId, onClose }: { repairId: number; onClose: () => void }) {
  const invoiceQuery = useQuery({
    queryKey: ['repair-invoice', repairId],
    queryFn: async () => (await apiRequest<RepairInvoiceData>(`/repairs/${repairId}/invoice`)).data,
    staleTime: 60000,
  });

  const data = invoiceQuery.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 pt-5 pb-4 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-lg">Detalle del trabajo</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
        </div>
        <div className="p-6 space-y-5">
          {invoiceQuery.isLoading ? <LoadingState /> : invoiceQuery.isError ? <ErrorState message="Error cargando detalle" /> : data && (
            <>
              <div className="flex items-start gap-3 flex-wrap">
                <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">{data.repair.repair_number}</span>
                <RepairStatusBadge status={data.repair.internal_status} />
              </div>

              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Equipo</p>
                <p className="font-semibold text-slate-800 text-base">{data.repair.brand} {data.repair.model}</p>
                <p className="text-sm text-slate-600">Problema: {data.repair.reported_issue}</p>
                <p className="text-xs text-slate-400">Recibido: {new Date(data.repair.received_at).toLocaleString('es-DO')}</p>
                {data.repair.delivered_at && <p className="text-xs text-slate-400">Entregado: {new Date(data.repair.delivered_at).toLocaleString('es-DO')}</p>}
                {data.repair.technician_name && <p className="text-xs text-slate-400">Técnico: {data.repair.technician_name}</p>}
              </div>

              {data.customer && (
                <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Cliente</p>
                  <p className="font-semibold text-slate-800">{data.customer.full_name}</p>
                  {data.customer.phone && (
                    <div className="flex items-center gap-2">
                      <a href={`tel:${data.customer.phone}`} className="text-sm text-blue-600 hover:underline font-medium">
                        📞 {data.customer.phone}
                      </a>
                      <a href={`https://wa.me/1${data.customer.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full hover:bg-green-600">
                        WhatsApp
                      </a>
                    </div>
                  )}
                  {data.customer.email && <p className="text-sm text-slate-500">{data.customer.email}</p>}
                  {data.customer.address && <p className="text-xs text-slate-400">{data.customer.address}</p>}
                </div>
              )}

              {data.sale ? (
                <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Factura</p>
                    {data.sale.ncf && <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{data.sale.ncf}</span>}
                  </div>
                  <p className="text-xs text-slate-500">No. {data.sale.sale_number} · {new Date(data.sale.created_at).toLocaleString('es-DO')}</p>

                  {data.sale_items.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500 mb-2">Artículos:</p>
                      {data.sale_items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-slate-700">{item.product_name} <span className="text-slate-400">×{item.quantity}</span></span>
                          <span className="font-medium text-slate-800">RD$ {parseFloat(item.subtotal).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-slate-200 pt-2 space-y-1 text-sm">
                    {parseFloat(data.sale.discount_amount) > 0 && (
                      <div className="flex justify-between text-slate-500">
                        <span>Descuento</span>
                        <span>-RD$ {parseFloat(data.sale.discount_amount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {parseFloat(data.sale.tax_amount) > 0 && (
                      <div className="flex justify-between text-slate-500">
                        <span>ITBIS</span>
                        <span>RD$ {parseFloat(data.sale.tax_amount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>Total</span>
                      <span>RD$ {parseFloat(data.sale.total).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <p className="text-xs text-slate-400 capitalize">Pago: {data.sale.payment_method} · Cajero: {data.sale.cashier_name}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-lg p-4 text-center text-sm text-slate-400 italic">
                  Sin factura de venta registrada para esta reparación.
                </div>
              )}
            </>
          )}
        </div>
        <div className="border-t border-slate-200 px-6 py-4">
          <button onClick={onClose} className="w-full py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export function TrabajosCompletadosPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [selectedRepairId, setSelectedRepairId] = useState<number | null>(null);

  const completedQuery = useQuery({
    queryKey: ['repairs-completed', query],
    queryFn: async () => {
      const params = query ? `?search=${encodeURIComponent(query)}` : '';
      return (await apiRequest<RepairItem[]>(`/repairs/completed${params}`)).data;
    },
    staleTime: 30000,
  });

  const handleSearch = () => setQuery(search.trim());

  return (
    <section className="space-y-5">
      <PanelTitulo titulo="Trabajos completados" descripcion="Todos los trabajos entregados. Toca un trabajo para ver su factura y datos del cliente." />

      {selectedRepairId && <RepairInvoiceModal repairId={selectedRepairId} onClose={() => setSelectedRepairId(null)} />}

      <Card className="p-4">
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar por cliente, modelo, problema, orden..."
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Buscar
          </button>
        </div>
        {query && (
          <div className="flex items-center gap-2 mt-2">
            <p className="text-xs text-slate-400">Resultados para: <strong>{query}</strong></p>
            <button onClick={() => { setQuery(''); setSearch(''); }} className="text-xs text-red-500 hover:underline">Limpiar</button>
          </div>
        )}
      </Card>

      {completedQuery.isLoading ? <LoadingState /> : completedQuery.isError ? <ErrorState message="Error cargando trabajos" /> :
        (completedQuery.data ?? []).length === 0 ? (
          <EmptyState message={query ? `No se encontraron resultados para "${query}".` : 'No hay trabajos completados aún.'} />
        ) : (
          <div className="space-y-3">
            {(completedQuery.data ?? []).map(repair => (
              <button key={repair.id} onClick={() => setSelectedRepairId(repair.id)} className="w-full text-left">
                <Card className="p-4 hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-colors cursor-pointer">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{repair.repair_number}</span>
                        <RepairStatusBadge status={repair.internal_status} />
                      </div>
                      <p className="font-semibold text-slate-800">{repair.brand} {repair.model}</p>
                      <p className="text-sm text-slate-600">
                        <span className="font-medium">{repair.customer_name}</span>
                        {repair.customer_phone ? <span className="text-slate-400"> · {repair.customer_phone}</span> : ''}
                      </p>
                      <p className="text-xs text-slate-400 truncate">Problema: {repair.reported_issue}</p>
                      {repair.delivered_at && <p className="text-xs text-slate-400">Entregado: {new Date(repair.delivered_at).toLocaleDateString('es-DO')}</p>}
                    </div>
                    <span className="text-xs text-blue-600 font-medium whitespace-nowrap">Ver factura →</span>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )
      }
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
export function InventarioPage() {
  const me = useMe();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<{ name: string; cost: number; price: number; stock: number; photo_files?: FileList }>({
    defaultValues: { name: '', cost: 0, price: 0, stock: 1 },
  });

  const role = me.data?.role ?? '';
  const invBranchId = (() => {
    if (role === 'admin_supremo') {
      try {
        const stored = sessionStorage.getItem('impersonatedBranch');
        if (stored) return JSON.parse(stored)?.branchId ?? null;
      } catch {}
      return null;
    }
    return me.data?.branch_id ?? null;
  })();

  const productsQuery = useQuery({
    queryKey: ['products', invBranchId],
    enabled: me.data !== undefined && Boolean(invBranchId),
    queryFn: async () => {
      const suffix = invBranchId ? `?branch_id=${invBranchId}` : '';
      return (await apiRequest<any[]>(`/products${suffix}`)).data;
    },
    staleTime: 10000,
  });

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      const suffix = invBranchId ? `?branch_id=${invBranchId}` : '';
      return apiRequest(`/products${suffix}`, { method: 'POST', body: JSON.stringify(payload) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products', invBranchId] }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...payload }: any) => {
      const suffix = invBranchId ? `?branch_id=${invBranchId}` : '';
      return apiRequest(`/products/${id}${suffix}`, { method: 'PUT', body: JSON.stringify(payload) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products', invBranchId] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const suffix = invBranchId ? `?branch_id=${invBranchId}` : '';
      return apiRequest(`/products/${id}${suffix}`, { method: 'DELETE' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products', invBranchId] }),
  });

  const onSubmit = form.handleSubmit(async (v) => {
    if (!v.name?.trim()) { setFormError('El nombre del producto es obligatorio.'); return; }
    if (v.cost < 0 || v.price <= 0 || v.stock < 0) { setFormError('Precio debe ser mayor a 0. Costo y stock no pueden ser negativos.'); return; }
    setFormError(null);

    const photos = await Promise.all(
      Array.from(v.photo_files ?? []).map(
        (file) => new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(file);
        }),
      ),
    );

    const payload = { name: v.name.trim(), cost: v.cost, sale_price: v.price, stock: v.stock, photos: photos.length ? photos : undefined };
    if (editingId) {
      await updateMut.mutateAsync({ id: editingId, ...payload });
    } else {
      await createMut.mutateAsync(payload);
    }
    setEditingId(null);
    form.reset({ name: '', cost: 0, price: 0, stock: 1 });
  });

  const items = (productsQuery.data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    cost: Number(p.cost ?? 0),
    price: Number(p.sale_price ?? 0),
    stock: Number(p.stock ?? 0),
    photos: Array.isArray(p.photos) ? p.photos : [],
  }));
  const filteredItems = items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));

  if (!invBranchId && role === 'admin_supremo') {
    return (
      <section className="space-y-5">
        <PanelTitulo titulo="Inventario" descripcion="Catálogo completo con fotos, acciones y vista tipo tienda." />
        <Card className="p-5"><p className="text-slate-500 text-sm">Para gestionar el inventario como Admin Supremo, primero usa <strong>Entrar</strong> en una sucursal desde la pantalla de Sucursales.</p></Card>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <PanelTitulo titulo="Inventario" descripcion="Catálogo completo con fotos, acciones y vista tipo tienda." />
      <Card className="p-5">
        <form className="grid gap-3 md:grid-cols-4" onSubmit={onSubmit}>
          <Input label="Producto" {...form.register('name')} />
          <Input label="Costo" type="number" step="0.01" {...form.register('cost', { valueAsNumber: true })} />
          <Input label="Precio venta" type="number" step="0.01" {...form.register('price', { valueAsNumber: true })} />
          <Input label="Stock" type="number" {...form.register('stock', { valueAsNumber: true })} />
          <Input label="Fotos del producto" type="file" accept="image/*" multiple className="md:col-span-2" {...form.register('photo_files')} />
          {formError ? <p className="text-sm text-red-600 md:col-span-4">{formError}</p> : null}
          <div className="md:col-span-4 flex gap-2 items-center">
            <Btn type="submit" disabled={createMut.isPending || updateMut.isPending}>{editingId ? 'Guardar cambios' : 'Agregar al inventario'}</Btn>
            {editingId ? <Btn type="button" variant="soft" onClick={() => { setEditingId(null); form.reset({ name: '', cost: 0, price: 0, stock: 1 }); }}>Cancelar</Btn> : null}
          </div>
        </form>
      </Card>
      <Card className="p-5">
        <Input label="Buscar producto" placeholder="Busca por nombre..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>
      {productsQuery.isLoading ? <LoadingState /> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <div className="h-48 bg-slate-100 flex items-center justify-center">
              {item.photos?.length ? <img src={item.photos[0]} alt={item.name} className="h-full w-full object-cover" /> : <span className="text-slate-400 text-sm">Sin foto</span>}
            </div>
            <div className="p-4 space-y-2">
              <p className="font-semibold">{item.name}</p>
              <p className="text-sm text-slate-500">Stock: {item.stock}</p>
              <p className="text-sm">Costo: <strong>RD$ {item.cost.toFixed(2)}</strong></p>
              <p className="text-sm">Precio: <strong>RD$ {item.price.toFixed(2)}</strong></p>
              <p className="text-sm text-emerald-700">Ganancia: RD$ {(item.price - item.cost).toFixed(2)}</p>
              <div className="flex gap-2 pt-2">
                <Btn size="sm" variant="soft" onClick={() => { setEditingId(item.id); form.reset({ name: item.name, cost: item.cost, price: item.price, stock: item.stock }); setFormError(null); }}>Editar</Btn>
                <Btn size="sm" variant="danger" onClick={() => deleteMut.mutate(item.id)} disabled={deleteMut.isPending}>Eliminar</Btn>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {filteredItems.length === 0 && !productsQuery.isLoading ? <Card className="p-5"><p className="text-sm text-slate-400">No hay productos registrados.</p></Card> : null}
      <Card className="p-5 overflow-x-auto">
        <h3 className="font-semibold mb-2">Resumen tabular</h3>
        {filteredItems.length === 0 ? <p className="text-sm text-slate-400">No hay productos registrados.</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="pb-2">Producto</th><th className="pb-2">Costo</th><th className="pb-2">Precio</th><th className="pb-2">Ganancia</th><th className="pb-2">Stock</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="py-2">{item.name}</td>
                  <td className="py-2">RD$ {item.cost.toFixed(2)}</td>
                  <td className="py-2">RD$ {item.price.toFixed(2)}</td>
                  <td className="py-2 text-emerald-700 font-medium">RD$ {(item.price - item.cost).toFixed(2)}</td>
                  <td className="py-2">{item.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </section>
  );
}
export const MovimientosInventarioPage = () => <Pendiente titulo="Movimientos de inventario" />;

type TransferRow = {
  id: number; origin_branch_id: number; destination_branch_id: number;
  status: string; note: string | null; created_at: string;
  origin_name?: string; destination_name?: string; creator_name?: string;
};

interface TransferItem { product_id: string; product_name: string; quantity: string; }

export function TransferenciasPage() {
  const me = useMe();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState('');
  const [destBranchId, setDestBranchId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [items, setItems] = useState<TransferItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedQty, setSelectedQty] = useState('1');

  const transfers = useQuery({
    queryKey: ['inventory-transfers'],
    queryFn: async () => (await apiRequest<TransferRow[]>('/inventory/transfers')).data,
    staleTime: 30000,
  });

  const branches = useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await apiRequest<any[]>('/branches')).data,
    staleTime: 60000,
  });

  const productsQuery = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => (await apiRequest<any[]>('/products')).data,
    staleTime: 60000,
    enabled: showForm,
  });

  const createMutation = useMutation({
    mutationFn: async () => apiRequest('/inventory/transfers', {
      method: 'POST',
      body: JSON.stringify({
        destination_branch_id: parseInt(destBranchId),
        note,
        items: items.map(i => ({ product_id: parseInt(i.product_id), quantity: parseFloat(i.quantity) })),
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-transfers'] });
      setShowForm(false);
      setNote('');
      setDestBranchId('');
      setItems([]);
      setFormError(null);
    },
    onError: (e: any) => setFormError(e?.message ?? 'Error al crear transferencia'),
  });

  const addItem = () => {
    if (!selectedProduct) return;
    const prod = (productsQuery.data ?? []).find((p: any) => String(p.id) === selectedProduct);
    if (!prod) return;
    const qty = parseFloat(selectedQty) || 1;
    const existing = items.find(i => i.product_id === selectedProduct);
    if (existing) {
      setItems(items.map(i => i.product_id === selectedProduct ? { ...i, quantity: String(parseFloat(i.quantity) + qty) } : i));
    } else {
      setItems([...items, { product_id: selectedProduct, product_name: prod.name, quantity: String(qty) }]);
    }
    setSelectedProduct('');
    setSelectedQty('1');
  };

  const removeItem = (pid: string) => setItems(items.filter(i => i.product_id !== pid));

  const statusLabel: Record<string, string> = {
    creada: 'Creada', en_transito: 'En tránsito', recibida: 'Recibida', cancelada: 'Cancelada',
  };
  const statusColor: Record<string, string> = {
    creada: 'bg-blue-100 text-blue-700',
    en_transito: 'bg-yellow-100 text-yellow-700',
    recibida: 'bg-green-100 text-green-700',
    cancelada: 'bg-red-100 text-red-700',
  };

  const myBranchId = me.data?.branch_id;
  const otherBranches = (branches.data ?? []).filter((b: any) => b.id !== myBranchId);
  const canCreate = ['administrador_general', 'encargado_sucursal'].includes(me.data?.role ?? '');

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <PanelTitulo titulo="Transferencias de inventario" descripcion="Solicitudes de traslado entre sucursales." />
        {canCreate && (
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            {showForm ? 'Cancelar' : '+ Nueva transferencia'}
          </button>
        )}
      </div>

      {showForm && (
        <Card className="p-5 space-y-4">
          <p className="font-medium text-slate-700">Nueva solicitud de transferencia</p>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div>
            <label className="block text-sm text-slate-600 mb-1">Sucursal destino</label>
            <select value={destBranchId} onChange={e => setDestBranchId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecciona sucursal...</option>
              {otherBranches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">Productos a transferir</p>
            <div className="flex gap-2 flex-wrap">
              <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
                className="flex-1 min-w-[160px] border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecciona producto...</option>
                {(productsQuery.data ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" min="0.01" step="0.01" value={selectedQty} onChange={e => setSelectedQty(e.target.value)}
                className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Cant." />
              <button onClick={addItem}
                className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800">
                Agregar
              </button>
            </div>
            {items.length > 0 && (
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.product_id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-3 py-2 text-sm">
                    <span className="text-slate-700 flex-1">{item.product_name}</span>
                    <span className="font-medium text-slate-800">×{item.quantity}</span>
                    <button onClick={() => removeItem(item.product_id)} className="text-red-500 hover:text-red-700 ml-2">✕</button>
                  </div>
                ))}
              </div>
            )}
            {items.length === 0 && <p className="text-xs text-slate-400 italic">Sin productos agregados (opcional).</p>}
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">Nota (opcional)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Descripción de la transferencia..." />
          </div>
          <button onClick={() => { if (!destBranchId) { setFormError('Selecciona la sucursal destino'); return; } createMutation.mutate(); }}
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {createMutation.isPending ? 'Enviando...' : 'Crear transferencia'}
          </button>
        </Card>
      )}

      {transfers.isLoading ? <LoadingState /> : transfers.isError ? <ErrorState message="Error cargando transferencias" /> :
        (transfers.data ?? []).length === 0 ? (
          <EmptyState message="No hay transferencias registradas." />
        ) : (
          <div className="space-y-3">
            {(transfers.data ?? []).map((t: any) => (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-slate-800 text-sm">Transferencia #{t.id}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[t.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {statusLabel[t.status] ?? t.status}
                      </span>
                    </div>
                    {(t.origin_name || t.destination_name) && (
                      <p className="text-xs text-slate-500">{t.origin_name ?? '?'} → {t.destination_name ?? '?'}</p>
                    )}
                    {t.note && <p className="text-xs text-slate-500 italic">{t.note}</p>}
                    {Array.isArray(t.items) && t.items.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {t.items.map((item: any, idx: number) => (
                          <span key={idx} className="bg-slate-100 text-slate-700 rounded px-2 py-0.5 text-xs">
                            {item.product_name} ×{item.quantity}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-slate-400">{new Date(t.created_at).toLocaleString('es-DO')}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      }
    </section>
  );
}

export function GastosPage() {
  const me = useMe();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('general');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [reference, setReference] = useState('');
  const [fromCash, setFromCash] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [days, setDays] = useState('30');

  const role = me.data?.role ?? '';
  const canCreate = ['administrador_general', 'encargado_sucursal', 'admin_supremo', 'caja_ventas'].includes(role);

  const expensesQuery = useQuery({
    queryKey: ['expenses', days],
    queryFn: async () => (await apiRequest<any[]>(`/expenses?days=${days}`)).data,
    staleTime: 30000,
  });

  const createMutation = useMutation({
    mutationFn: async () => apiRequest('/expenses', {
      method: 'POST',
      body: JSON.stringify({ amount: parseFloat(amount), category, description, payment_method: paymentMethod, reference: reference || null, from_cash: fromCash }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      setShowForm(false);
      setAmount('');
      setDescription('');
      setReference('');
      setFromCash(false);
      setFormError(null);
    },
    onError: (e: any) => setFormError(e?.message ?? 'Error al registrar gasto'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const totalGastos = (expensesQuery.data ?? []).reduce((sum: number, g: any) => sum + parseFloat(g.amount ?? '0'), 0);

  const CATEGORIES = ['general', 'alquiler', 'nomina', 'servicios', 'insumos', 'reparaciones', 'comisiones', 'otros'];
  const PAYMENT_METHODS = ['efectivo', 'tarjeta', 'transferencia', 'cheque'];

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <PanelTitulo titulo="Gastos" descripcion="Registro y control de gastos de la sucursal." />
        {canCreate && (
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            {showForm ? 'Cancelar' : '+ Registrar gasto'}
          </button>
        )}
      </div>

      {showForm && canCreate && (
        <Card className="p-5 space-y-4">
          <p className="font-medium text-slate-700">Nuevo gasto</p>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Monto (RD$) <span className="text-red-500">*</span></label>
              <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Categoría</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-600 mb-1">Descripción <span className="text-red-500">*</span></label>
              <input value={description} onChange={e => setDescription(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Detalles del gasto..." />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Método de pago</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Referencia / No. comprobante</label>
              <input value={reference} onChange={e => setReference(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Opcional..." />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={fromCash} onChange={e => setFromCash(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
            <span className="text-sm text-slate-700 font-medium">Este gasto salió de la caja</span>
            <span className="text-xs text-slate-400">(se descontará del cuadre de caja)</span>
          </label>
          <button onClick={() => { if (!amount || !description) { setFormError('El monto y la descripción son obligatorios'); return; } createMutation.mutate(); }}
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {createMutation.isPending ? 'Guardando...' : 'Registrar gasto'}
          </button>
        </Card>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm text-slate-600">Período:</label>
        {['7', '30', '60', '90'].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${days === d ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {d} días
          </button>
        ))}
      </div>

      {!expensesQuery.isLoading && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
          <Card className="p-4">
            <p className="text-xs text-slate-500">Total gastos ({days} días)</p>
            <p className="text-2xl font-bold text-red-600 mt-1">RD$ {totalGastos.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-slate-400 mt-1">{(expensesQuery.data ?? []).length} registro(s)</p>
          </Card>
        </div>
      )}

      {expensesQuery.isLoading ? <LoadingState /> : expensesQuery.isError ? <ErrorState message="Error cargando gastos" /> :
        (expensesQuery.data ?? []).length === 0 ? <EmptyState message="No hay gastos en este período." /> : (
          <div className="space-y-2">
            {(expensesQuery.data ?? []).map((g: any) => (
              <Card key={g.id} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 capitalize">{g.category}</span>
                      <span className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 capitalize">{g.payment_method}</span>
                      {g.from_cash && <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 font-medium">💵 Salió de caja</span>}
                    </div>
                    <p className="text-sm font-medium text-slate-800 mt-1">{g.description}</p>
                    {g.reference && <p className="text-xs text-slate-400">Ref: {g.reference}</p>}
                    <p className="text-xs text-slate-400">{new Date(g.created_at).toLocaleString('es-DO')} · {g.creator_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-red-600">RD$ {parseFloat(g.amount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                    {canCreate && (
                      <button onClick={() => deleteMutation.mutate(g.id)} disabled={deleteMutation.isPending}
                        className="text-slate-400 hover:text-red-500 transition-colors text-xs">✕</button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      }
    </section>
  );
}

export function ContabilidadPage() {
  const [days, setDays] = useState('30');

  const salesQuery = useQuery({
    queryKey: ['accounting-sales', days],
    queryFn: async () => (await apiRequest<any>(`/dashboard/reports/sales?days=${days}`)).data,
    staleTime: 60000,
  });

  const expensesQuery = useQuery({
    queryKey: ['accounting-expenses', days],
    queryFn: async () => (await apiRequest<any[]>(`/expenses?days=${days}`)).data,
    staleTime: 60000,
  });

  const totalSales = salesQuery.data?.totals?.revenue ?? 0;
  const totalExpenses = (expensesQuery.data ?? []).reduce((sum: number, g: any) => sum + parseFloat(g.amount ?? '0'), 0);
  const balance = totalSales - totalExpenses;

  const expensesByCategory = (expensesQuery.data ?? []).reduce((acc: Record<string, number>, g: any) => {
    const cat = g.category ?? 'general';
    acc[cat] = (acc[cat] ?? 0) + parseFloat(g.amount ?? '0');
    return acc;
  }, {});

  return (
    <section className="space-y-5">
      <PanelTitulo titulo="Contabilidad" descripcion="Resumen financiero: ingresos vs. gastos." />

      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm text-slate-600">Período:</label>
        {['7', '30', '60', '90'].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${days === d ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {d} días
          </button>
        ))}
      </div>

      {(salesQuery.isLoading || expensesQuery.isLoading) ? <LoadingState /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="p-4 border-l-4 border-l-green-500">
              <p className="text-xs text-slate-500">Ingresos (ventas)</p>
              <p className="text-xl font-bold text-green-600 mt-1">RD$ {totalSales.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-slate-400">{salesQuery.data?.totals?.sales ?? 0} ventas</p>
            </Card>
            <Card className="p-4 border-l-4 border-l-red-500">
              <p className="text-xs text-slate-500">Gastos</p>
              <p className="text-xl font-bold text-red-600 mt-1">RD$ {totalExpenses.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-slate-400">{(expensesQuery.data ?? []).length} registros</p>
            </Card>
            <Card className={`p-4 border-l-4 ${balance >= 0 ? 'border-l-blue-500' : 'border-l-orange-500'}`}>
              <p className="text-xs text-slate-500">Balance neto</p>
              <p className={`text-xl font-bold mt-1 ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                RD$ {balance.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-400">{balance >= 0 ? 'Ganancia' : 'Déficit'}</p>
            </Card>
          </div>

          {Object.keys(expensesByCategory).length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Gastos por categoría</h3>
              <div className="space-y-2">
                {Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]).map(([cat, total]) => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-slate-600">{cat}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-slate-100 rounded-full h-2">
                        <div className="bg-red-400 h-2 rounded-full" style={{ width: `${Math.min(100, (total / totalExpenses) * 100)}%` }} />
                      </div>
                      <span className="font-medium text-slate-800 w-28 text-right">RD$ {total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {(salesQuery.data?.byDay ?? []).length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Ingresos por día</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {(salesQuery.data?.byDay ?? []).map((d: any) => (
                  <div key={d.date} className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">{d.date}</span>
                    <span className="font-medium text-green-700">RD$ {parseFloat(d.revenue ?? '0').toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}
const DENOMINACIONES = [
  { label: 'Billetes', items: [2000, 1000, 500, 200, 100, 50] },
  { label: 'Monedas', items: [25, 10, 5, 1, 0.50, 0.25] },
];

function AperturaCajaModal({ onOpened }: { onOpened: () => void }) {
  const [openingBalance, setOpeningBalance] = useState('');
  const [error, setError] = useState<string | null>(null);

  const openMutation = useMutation({
    mutationFn: async () => apiRequest('/caja/open-session', {
      method: 'POST',
      body: JSON.stringify({ opening_balance: parseFloat(openingBalance || '0') }),
    }),
    onSuccess: () => onOpened(),
    onError: (e: any) => setError(e?.message ?? 'Error al abrir caja'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 space-y-5">
        <div className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-3xl">💵</div>
          <h2 className="text-xl font-bold text-slate-900">Apertura de caja</h2>
          <p className="text-sm text-slate-500 mt-1">Ingresa el fondo inicial antes de comenzar a vender.</p>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Fondo inicial (RD$)</label>
          <input
            type="number" min="0" step="0.01" value={openingBalance}
            onChange={e => setOpeningBalance(e.target.value)}
            autoFocus
            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
            placeholder="0.00" />
          <p className="text-xs text-slate-400 mt-1 text-center">Puede ser RD$ 0 si la caja comienza vacía.</p>
        </div>
        <button
          onClick={() => { setError(null); openMutation.mutate(); }}
          disabled={openMutation.isPending}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
          {openMutation.isPending ? 'Abriendo...' : 'Abrir caja'}
        </button>
      </div>
    </div>
  );
}

function CuadreCajaModal({ onClose, onCuadreGuardado }: { onClose: () => void; onCuadreGuardado?: () => void }) {
  const qc = useQueryClient();
  const [denomCounts, setDenomCounts] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ['caja-summary'],
    queryFn: async () => (await apiRequest<{
      cashSales: number; cashExpenses: number; since: string;
      openingBalance: number; sessionOpenedAt: string | null;
    }>('/caja/summary')).data,
    staleTime: 5000,
  });

  const setDenom = (denom: number, val: string) =>
    setDenomCounts(prev => ({ ...prev, [denom]: val }));

  const allDenoms = DENOMINACIONES.flatMap(g => g.items);
  const actualCash = allDenoms.reduce((sum, d) => {
    const qty = parseInt(denomCounts[d] || '0') || 0;
    return sum + qty * d;
  }, 0);

  const cashSales = summaryQuery.data?.cashSales ?? 0;
  const cashExpenses = summaryQuery.data?.cashExpenses ?? 0;
  const openingBal = summaryQuery.data?.openingBalance ?? 0;
  const expected = openingBal + cashSales - cashExpenses;
  const difference = actualCash - expected;
  const anyEntered = allDenoms.some(d => parseInt(denomCounts[d] || '0') > 0);

  const diffColor = !anyEntered ? 'text-slate-400'
    : Math.abs(difference) < 0.01 ? 'text-green-600'
    : difference > 0 ? 'text-yellow-600'
    : 'text-red-600';

  const diffLabel = !anyEntered ? 'Ingresa las denominaciones para ver el resultado'
    : Math.abs(difference) < 0.01 ? '✓ Cuadre exacto'
    : difference > 0 ? `⚠ Sobrante RD$ ${difference.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`
    : `✗ Faltante RD$ ${Math.abs(difference).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

  const saveMutation = useMutation({
    mutationFn: async () => apiRequest('/caja/sessions', {
      method: 'POST',
      body: JSON.stringify({
        actual_cash: actualCash,
        notes: notes || null,
        denomination_breakdown: Object.fromEntries(
          allDenoms.filter(d => parseInt(denomCounts[d] || '0') > 0)
            .map(d => [String(d), parseInt(denomCounts[d])])
        ),
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caja-sessions'] });
      qc.invalidateQueries({ queryKey: ['my-caja-session'] });
      setSuccess(true);
      onCuadreGuardado?.();
    },
    onError: (e: any) => setError(e?.message ?? 'Error al guardar cuadre'),
  });

  const fmt = (n: number) => `RD$ ${n.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl">✓</div>
          <h2 className="text-xl font-bold text-slate-900">Cuadre guardado</h2>
          <p className="text-slate-600 text-sm">La caja ha sido cerrada y el cuadre registrado.</p>
          <button onClick={onClose} className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-700">Cerrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-y-auto max-h-[97vh]">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">⚖ Cuadre de caja</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1.5">
            <p className="font-semibold text-slate-700 text-xs uppercase tracking-wide mb-2">Resumen del período</p>
            {summaryQuery.data?.sessionOpenedAt && (
              <div className="flex justify-between text-xs text-slate-400">
                <span>Desde apertura</span>
                <span>{new Date(summaryQuery.data.sessionOpenedAt).toLocaleString('es-DO')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Fondo inicial</span>
              <span className="font-medium">{summaryQuery.isLoading ? '...' : fmt(openingBal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">+ Ventas efectivo</span>
              <span className="font-medium text-green-600">{summaryQuery.isLoading ? '...' : fmt(cashSales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">− Gastos de caja</span>
              <span className="font-medium text-red-500">{summaryQuery.isLoading ? '...' : fmt(cashExpenses)}</span>
            </div>
            <div className="flex justify-between font-bold border-t border-slate-200 pt-1.5">
              <span>Efectivo esperado</span>
              <span>{fmt(expected)}</span>
            </div>
          </div>

          {DENOMINACIONES.map(grupo => (
            <div key={grupo.label}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{grupo.label}</p>
              <div className="space-y-1.5">
                {grupo.items.map(denom => {
                  const qty = parseInt(denomCounts[denom] || '0') || 0;
                  const subtotal = qty * denom;
                  return (
                    <div key={denom} className="flex items-center gap-3">
                      <span className="w-20 text-right text-sm font-medium text-slate-700 shrink-0">
                        RD$ {denom % 1 === 0 ? denom.toLocaleString('es-DO') : denom.toFixed(2)}
                      </span>
                      <span className="text-slate-400 text-sm shrink-0">×</span>
                      <input
                        type="number" min="0" step="1"
                        value={denomCounts[denom] ?? ''}
                        onChange={e => setDenom(denom, e.target.value)}
                        className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0" />
                      <span className="text-slate-400 text-sm shrink-0">=</span>
                      <span className={`flex-1 text-right text-sm font-semibold ${subtotal > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                        {subtotal > 0 ? fmt(subtotal) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className={`rounded-xl p-4 text-center border-2 ${
            !anyEntered ? 'border-slate-200 bg-slate-50'
            : Math.abs(difference) < 0.01 ? 'border-green-300 bg-green-50'
            : difference > 0 ? 'border-yellow-300 bg-yellow-50'
            : 'border-red-300 bg-red-50'
          }`}>
            <p className="text-xs text-slate-500 mb-1">Total contado</p>
            <p className="text-2xl font-bold text-slate-900">{fmt(actualCash)}</p>
            <p className={`text-sm font-semibold mt-1 ${diffColor}`}>{diffLabel}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Opcional..." />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3 border-t border-slate-100 pt-4">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
          <button
            onClick={() => { if (!anyEntered) { setError('Ingresa al menos una denominación'); return; } setError(null); saveMutation.mutate(); }}
            disabled={saveMutation.isPending}
            className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-700 disabled:opacity-50">
            {saveMutation.isPending ? 'Guardando...' : 'Cerrar caja y guardar cuadre'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function VentasPage() {
  const me = useMe();
  const queryClient = useQueryClient();

  const myCajaSession = useQuery({
    queryKey: ['my-caja-session'],
    queryFn: async () => (await apiRequest<any>('/caja/my-session')).data,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  const [cart, setCart] = useState<Array<{
    id: number;
    product_id: number;
    codigo: string;
    nombre: string;
    cantidad: number;
    precio_unitario: number;
    itbis_aplica: boolean;
    itbis_tasa: number;
    precio_incluye_itbis: boolean;
    subtotal: number;
    itbis_monto: number;
    total_linea: number;
  }>>([]);
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [showCuadreModal, setShowCuadreModal] = useState(false);
  const hasOpenSession = myCajaSession.data != null;
  const sessionLoading = myCajaSession.isLoading;
  const [orderSequence, setOrderSequence] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [mixedMethod, setMixedMethod] = useState('tarjeta');
  const [cashAmount, setCashAmount] = useState(0);
  const [showPayModal, setShowPayModal] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [productSearch, setProductSearch] = useState('');
  const [saleType, setSaleType] = useState('contado');
  const [seller, setSeller] = useState('');
  const [customerSearch, setCustomerSearch] = useState('PORTADOR');
  const [comprobanteType, setComprobanteType] = useState('B02');
  const salesForm = useForm<{ description: string; qty: number; price: number }>({ defaultValues: { description: '', qty: 1, price: 0 } });
  const repairForm = useForm<{
    customer_name: string;
    customer_phone: string;
    contact_phone: string;
    brand: string;
    model: string;
    issue: string;
    requires_evaluation: boolean;
    total: number;
    advance: number;
    assigned_to?: string;
    custom_brand?: string;
    custom_model?: string;
  }>({
    defaultValues: {
      customer_name: '',
      customer_phone: '',
      contact_phone: '',
      brand: '',
      model: '',
      issue: '',
      requires_evaluation: false,
      total: 0,
      advance: 0,
      assigned_to: '',
      custom_brand: '',
      custom_model: '',
    },
  });

  const posRole = me.data?.role ?? '';
  const posBranchId = (() => {
    if (posRole === 'admin_supremo') {
      try {
        const stored = sessionStorage.getItem('impersonatedBranch');
        if (stored) return JSON.parse(stored)?.branchId ?? null;
      } catch {}
      return null;
    }
    return me.data?.branch_id ?? null;
  })();

  const repairQueryClient = useQueryClient();
  const createRepairMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiRequest<{ repair_number: string; customer_name: string }>('/repairs', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return res.data;
    },
    onSuccess: () => {
      repairQueryClient.invalidateQueries({ queryKey: ['repairs'] });
    },
  });

  const printRepairInvoice = async (repairNumber: string, customerName: string, total: number, advance: number, branchCode: string) => {
    const pending = Math.max(0, total - advance);
    const invoiceHtml = `
      <html>
        <head>
          <title>Factura de reparación</title>
          <style>
            body{font-family: Arial, sans-serif; font-size:16px; width:80mm; margin:0; padding:14px 12px; font-weight:700; line-height:1.25;}
            h1,h2,p{margin:0 0 6px 0; font-weight:700;}
            .center{text-align:center;}
            .row{display:flex; justify-content:space-between; gap:10px;}
            .divider{border-top:1px dashed #000; margin:8px 0;}
            .title{font-size:28px; font-weight:900;}
          </style>
        </head>
        <body>
          <div class="center">
            <h2 class="title">Factura</h2>
            <p>Recepción de reparación</p>
          </div>
          <div class="divider"></div>
          <p><strong>Cliente:</strong> ${customerName || '—'}</p>
          <p><strong>Código de reparación:</strong> ${repairNumber}</p>
          <p><strong>Código de equipo:</strong> ${repairNumber}</p>
          <p><strong>Sucursal:</strong> ${branchCode || ''}</p>
          <div class="divider"></div>
          <div class="row"><span>Total reparación</span><strong>RD$ ${total.toFixed(2)}</strong></div>
          <div class="row"><span>Abono</span><strong>RD$ ${advance.toFixed(2)}</strong></div>
          <div class="row"><span>Restante</span><strong>RD$ ${pending.toFixed(2)}</strong></div>
          <div class="divider"></div>
          <p class="center">No somos responsables del equipo</p>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank', 'width=380,height=700');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 350);
  };

  const assignable = useQuery({
    queryKey: ['repairs', 'assignable-techs', posBranchId],
    enabled: showRepairModal && Boolean(posBranchId),
    queryFn: async () => (await apiRequest<AssignableTech[]>('/repairs/assignable-technicians')).data,
  });
  const branchSettingsQuery = useQuery({
    queryKey: ['branch-settings-pos', posBranchId],
    enabled: me.data !== undefined,
    queryFn: async () => {
      const suffix = posBranchId ? `?branch_id=${posBranchId}` : '';
      return (await apiRequest<any>(`/branch-settings${suffix}`)).data;
    },
    staleTime: 30000,
  });

  const posProductsQuery = useQuery({
    queryKey: ['products', posBranchId],
    enabled: me.data !== undefined && Boolean(posBranchId),
    queryFn: async () => {
      const suffix = posBranchId ? `?branch_id=${posBranchId}` : '';
      return (await apiRequest<any[]>(`/products${suffix}`)).data ?? [];
    },
    staleTime: 15000,
  });

  const ncfSequencesQuery = useQuery({
    queryKey: ['ncf-sequences', posBranchId],
    enabled: me.data !== undefined && Boolean(posBranchId),
    queryFn: async () => {
      const suffix = posBranchId ? `?branch_id=${posBranchId}` : '';
      return (await apiRequest<any[]>(`/ncf${suffix}`)).data ?? [];
    },
    staleTime: 10000,
  });

  const ALL_NCF_TYPES = [
    { code: 'B01', label: 'Crédito Fiscal' },
    { code: 'B02', label: 'Consumidor Final' },
    { code: 'B03', label: 'Nota de Débito' },
    { code: 'B04', label: 'Nota de Crédito' },
    { code: 'B11', label: 'Comprobante de Compras' },
    { code: 'B12', label: 'Registro Único de Ingresos' },
    { code: 'B13', label: 'Gastos Menores' },
    { code: 'B14', label: 'Régimen Especial' },
    { code: 'B15', label: 'Gubernamental' },
    { code: 'B16', label: 'Comprobante para Exportaciones' },
  ];

  useEffect(() => {
    const seqs = ncfSequencesQuery.data as any[] ?? [];
    if (seqs.length === 0) return;
    const currentExists = seqs.some((s: any) => s.type === comprobanteType && s.is_active && !s.is_exhausted);
    if (!currentExists) {
      const first = seqs.find((s: any) => s.is_active && !s.is_exhausted);
      if (first) setComprobanteType(first.type);
    }
  }, [ncfSequencesQuery.data]);

  const selectedNcfSeq = (ncfSequencesQuery.data as any[])?.find((s: any) => s.type === comprobanteType);
  const previewNcf = selectedNcfSeq
    ? (selectedNcfSeq.is_exhausted ? 'AGOTADO' : selectedNcfSeq.next_ncf)
    : (ncfSequencesQuery.isPending ? 'Cargando...' : 'Sin configurar');
  const comprobanteLabel = ALL_NCF_TYPES.find((t) => t.code === comprobanteType)?.label ?? comprobanteType;
  const brandOptions = Object.keys(DEVICE_MODELS_BY_BRAND);
  const selectedBrand = repairForm.watch('brand');
  const selectedModel = repairForm.watch('model');
  const requiresEvaluation = repairForm.watch('requires_evaluation');
  const totalRepair = Number(repairForm.watch('total') ?? 0);
  const advanceRepair = Number(repairForm.watch('advance') ?? 0);
  const pendingRepair = Math.max(0, totalRepair - advanceRepair);
  const repairOrderCode = `${(selectedBrand || 'EQ').slice(0, 2).toUpperCase()}-${String(orderSequence).padStart(6, '0')}`;
  const isPresetBrand = selectedBrand && selectedBrand in DEVICE_MODELS_BY_BRAND;
  const modelsForBrand = isPresetBrand ? DEVICE_MODELS_BY_BRAND[selectedBrand] : [];


  const ITBIS_RATE = 0.18;
  const subtotalBruto = cart.reduce((acc, item) => acc + Number(item.total_linea ?? 0), 0);
  const subtotalNeto = cart.reduce((acc, item) => acc + Number(item.subtotal ?? 0), 0);
  const itbisTotal = cart.reduce((acc, item) => acc + Number(item.itbis_monto ?? 0), 0);
  const totalVenta = subtotalBruto;
  const mixedRemaining = Math.max(0, totalVenta - cashAmount);
  const inventoryItems = (posProductsQuery.data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    price: Number(p.sale_price ?? 0),
    stock: Number(p.stock ?? 0),
    photos: Array.isArray(p.photos) ? p.photos : [],
    photo: undefined,
    sku: p.sku ?? `P-${p.id}`,
    itbis_aplica: Boolean(p.itbis_aplica ?? true),
    itbis_tasa: Number(p.itbis_tasa ?? 0.18),
    precio_incluye_itbis: Boolean(p.precio_incluye_itbis ?? true),
  }));
  const visibleProducts = inventoryItems.filter((item) => item.name.toLowerCase().includes(productSearch.toLowerCase()));

  const buildCartLine = (payload: { id: number; code: string; name: string; qty: number; price: number; itbis_aplica?: boolean; itbis_tasa?: number; precio_incluye_itbis?: boolean; }) => {
    const tasa = payload.itbis_tasa ?? ITBIS_RATE;
    const aplica = payload.itbis_aplica ?? true;
    const incluye = payload.precio_incluye_itbis ?? true;
    const totalLinea = payload.qty * payload.price;
    let subtotal = totalLinea;
    let itbisMonto = 0;
    if (aplica) {
      if (incluye) {
        subtotal = totalLinea / (1 + tasa);
        itbisMonto = totalLinea - subtotal;
      } else {
        subtotal = totalLinea;
        itbisMonto = totalLinea * tasa;
      }
    }
    return {
      id: Date.now() + Math.floor(Math.random() * 1000),
      product_id: payload.id,
      codigo: payload.code,
      nombre: payload.name,
      cantidad: payload.qty,
      precio_unitario: payload.price,
      itbis_aplica: aplica,
      itbis_tasa: tasa,
      precio_incluye_itbis: incluye,
      subtotal,
      itbis_monto: itbisMonto,
      total_linea: aplica && incluye ? totalLinea : subtotal + itbisMonto,
    };
  };

  const addProductToCart = (product: { id: number; name: string; price: number; sku?: string; itbis_aplica?: boolean; itbis_tasa?: number; precio_incluye_itbis?: boolean; }) => {
    setCart((prev) => {
      const existing = prev.find((it) => it.product_id === product.id);
      if (existing) {
        return prev.map((it) => (it.product_id === product.id ? buildCartLine({
          id: it.product_id,
          code: it.codigo,
          name: it.nombre,
          qty: it.cantidad + 1,
          price: it.precio_unitario,
          itbis_aplica: it.itbis_aplica,
          itbis_tasa: it.itbis_tasa,
          precio_incluye_itbis: it.precio_incluye_itbis,
        }) : it));
      }
      return [...prev, buildCartLine({
        id: product.id,
        code: product.sku ?? `P-${product.id}`,
        name: product.name,
        qty: 1,
        price: Number(product.price),
        itbis_aplica: product.itbis_aplica,
        itbis_tasa: product.itbis_tasa,
        precio_incluye_itbis: product.precio_incluye_itbis,
      })];
    });
  };

  const handlePrintInvoice = async () => {
    if (cart.length === 0) {
      window.alert('No puedes registrar una venta con el carrito vacío.');
      return;
    }
    const settings = branchSettingsQuery.data ?? {};
    let ncfLabel = '--';
    try {
      const body: any = { type: comprobanteType };
      if (posBranchId) body.branch_id = posBranchId;
      const res = await apiRequest<{ ncf: string }>('/ncf/next', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      ncfLabel = res.data?.ncf ?? '--';
    } catch (err: any) {
      window.alert(`Error al emitir NCF: ${err.message || 'No hay secuencia disponible para este tipo de comprobante. Configure la secuencia en el panel de Comprobantes.'}`);
      return;
    }
    const negocio = settings.business_name || settings.fiscal_name || me.data?.branch_name || 'Mi Negocio';
    const subtotalNeto = cart.reduce((acc, line) => acc + Number(line.subtotal ?? line.precio_unitario * line.cantidad), 0);
    const itbisTotal = cart.reduce((acc, line) => acc + Number(line.itbis_monto ?? 0), 0);
    const totalVenta = cart.reduce((acc, line) => acc + Number(line.total_linea ?? line.precio_unitario * line.cantidad), 0);
    const invoiceHtml = `
      <html>
        <head>
          <title>Factura</title>
          <style>
            body{font-family: Arial, sans-serif; font-size:12px; width:80mm; margin:0; padding:10px; font-weight:700;}
            h1,h2,p{margin:0 0 4px 0; font-weight:700;}
            .center{text-align:center;}
            .row{display:flex; justify-content:space-between; gap:10px;}
            .divider{border-top:1px dashed #000; margin:8px 0;}
            table{width:100%; border-collapse:collapse;}
            td,th{vertical-align:top; padding:2px 0; font-weight:700;}
            .title{font-size:22px; font-weight:900;}
          </style>
        </head>
        <body>
          <div class="center">
            <h2 class="title">${negocio}</h2>
            <p>${settings.fiscal_name ?? negocio}</p>
            <p>RNC: ${settings.rnc ?? '-'}</p>
            <p>${settings.phone ?? ''}</p>
            <p>${settings.address ?? ''}</p>
          </div>
          <div class="divider"></div>
          <p><strong>NCF:</strong> ${ncfLabel}</p>
          <p><strong>Comprobante:</strong> ${comprobanteLabel}</p>
          <p><strong>Cliente:</strong> ${customerSearch || 'PÚBLICO EN GENERAL'}</p>
          <p><strong>Vendedor:</strong> ${(seller || me.data?.full_name) ?? ''}</p>
          <div class="divider"></div>
          <table>
            <tr><th>Cant.</th><th style="width:48%">Producto</th><th style="text-align:right">Total</th></tr>
            ${cart.map((item) => `<tr><td>${item.cantidad}</td><td>${item.nombre}</td><td style="text-align:right">RD$ ${Number(item.total_linea ?? 0).toFixed(2)}</td></tr>`).join('')}
          </table>
          <div class="divider"></div>
          <div class="row"><span>Subtotal (sin ITBIS)</span><strong>RD$ ${subtotalNeto.toFixed(2)}</strong></div>
          <div class="row"><span>ITBIS (18%)</span><strong>RD$ ${itbisTotal.toFixed(2)}</strong></div>
          <div class="row"><span>Total</span><strong>RD$ ${totalVenta.toFixed(2)}</strong></div>
          ${paymentMethod === 'mixto'
            ? `<div class="row"><span>Efectivo</span><strong>RD$ ${cashAmount.toFixed(2)}</strong></div>
               <div class="row"><span>${mixedMethod.charAt(0).toUpperCase() + mixedMethod.slice(1)}</span><strong>RD$ ${mixedRemaining.toFixed(2)}</strong></div>`
            : `<div class="row"><span>Forma de pago</span><strong>${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}</strong></div>
               ${receivedAmount > 0 ? `<div class="row"><span>Recibido</span><strong>RD$ ${receivedAmount.toFixed(2)}</strong></div><div class="row"><span>Vuelto</span><strong>RD$ ${Math.max(0, receivedAmount - totalVenta).toFixed(2)}</strong></div>` : ''}`
          }
          <div class="divider"></div>
          <p class="center">${settings.invoice_footer ?? 'Gracias por su compra.'}</p>
        </body>
      </html>
    `;
    try {
      await apiRequest('/dashboard/sales', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map((line) => ({
            product_id: line.product_id,
            quantity: line.cantidad,
            unit_price: line.precio_unitario,
            subtotal: Number(line.total_linea ?? 0),
          })),
          total: totalVenta,
          subtotal: subtotalNeto,
          tax_amount: itbisTotal,
          discount: 0,
          payment_method: paymentMethod === 'mixto' ? 'mixto' : paymentMethod,
          ncf: ncfLabel !== '--' ? ncfLabel : null,
        }),
      });
    } catch (saveErr: any) {
      console.error('Error guardando venta en BD:', saveErr);
    }

    const printWindow = window.open('', '_blank', 'width=380,height=700');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 350);
    setCart([]);
    const firstAvailableNcf = (ncfSequencesQuery.data as any[] ?? []).find((s: any) => s.is_active && !s.is_exhausted)?.type ?? 'B02';
    setComprobanteType(firstAvailableNcf);
    setCashAmount(0);
    setReceivedAmount(0);
    queryClient.invalidateQueries({ queryKey: ['ncf-sequences', posBranchId] });
    queryClient.invalidateQueries({ queryKey: ['products', posBranchId] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['low-stock'] });
  };

  return (
    <section className="space-y-5">
      {!sessionLoading && !hasOpenSession && (
        <AperturaCajaModal onOpened={() => {
          queryClient.invalidateQueries({ queryKey: ['my-caja-session'] });
          queryClient.invalidateQueries({ queryKey: ['caja-summary'] });
        }} />
      )}
      {showCuadreModal && (
        <CuadreCajaModal
          onClose={() => setShowCuadreModal(false)}
          onCuadreGuardado={() => {
            queryClient.invalidateQueries({ queryKey: ['my-caja-session'] });
            queryClient.invalidateQueries({ queryKey: ['caja-summary'] });
            setShowCuadreModal(false);
          }}
        />
      )}
      <Card className="p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">POS Vendedor</h2>
          {myCajaSession.data && (
            <p className="text-xs text-green-600 mt-0.5">
              Caja abierta · {myCajaSession.data.opener_name} · {new Date(myCajaSession.data.opened_at).toLocaleString('es-DO')} · Fondo: RD$ {parseFloat(myCajaSession.data.opening_balance).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="soft" onClick={() => setShowRepairModal(true)}>+ Añadir equipo para reparar</Btn>
          <Btn variant="soft" onClick={() => setShowCuadreModal(true)}>⚖ Cuadrar caja</Btn>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="p-5 space-y-4">
          <h3 className="text-2xl font-semibold text-slate-800">Punto de venta</h3>
          <div className="grid gap-3 md:grid-cols-4">
            <Select label="Tipo de venta" value={saleType} onChange={(e) => setSaleType(e.target.value)}>
              <option value="contado">Contado</option>
              <option value="credito">Crédito</option>
            </Select>
            <Select label="Vendedor" value={seller} onChange={(e) => setSeller(e.target.value)}>
              <option value="">Seleccionar...</option>
              <option value={me.data?.full_name ?? ''}>{me.data?.full_name ?? 'Vendedor actual'}</option>
            </Select>
            <Input label="Cliente" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
            <Select label="Forma de pago" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="mixto">Mixto (efectivo + otra forma)</option>
            </Select>
          </div>
          {paymentMethod === 'mixto' && (
            <div className="grid gap-3 sm:grid-cols-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
              <Input
                label="Monto pagado en efectivo"
                type="number"
                step="0.01"
                min={0}
                value={cashAmount}
                onChange={(e) => setCashAmount(Number(e.target.value))}
              />
              <Select label="El resto fue pagado por" value={mixedMethod} onChange={(e) => setMixedMethod(e.target.value)}>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
              </Select>
              <div className="flex flex-col justify-end">
                <p className="text-xs text-slate-500 mb-1">Resto por {mixedMethod}</p>
                <p className="rounded-lg border border-indigo-300 bg-white px-3 py-2 font-bold text-indigo-700">
                  RD$ {mixedRemaining.toFixed(2)}
                </p>
              </div>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <Select label="Tipo de comprobante" value={comprobanteType} onChange={(e) => setComprobanteType(e.target.value)}>
              {(ncfSequencesQuery.data as any[] ?? []).length === 0 ? (
                <option value="">Sin comprobantes configurados</option>
              ) : (ncfSequencesQuery.data as any[] ?? []).map((seq: any) => {
                const label = ALL_NCF_TYPES.find((t) => t.code === seq.type)?.label ?? seq.type;
                const isAvailable = seq.is_active && !seq.is_exhausted;
                return (
                  <option key={seq.type} value={seq.type} disabled={!isAvailable}>
                    {seq.type} — {label}{seq.is_exhausted ? ' (Agotado)' : ` (${seq.remaining} disp.)`}
                  </option>
                );
              })}
            </Select>
          </div>
          <Input label="Buscar producto por código, nombre o código de barras..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleProducts.map((product) => {
              const outOfStock = product.stock <= 0;
              return (
                <Card key={product.id} className={`p-3 border ${outOfStock ? 'border-red-200 opacity-70' : 'border-slate-200'}`}>
                  <div className="h-24 bg-slate-100 rounded-lg mb-2 overflow-hidden flex items-center justify-center">
                    {product.photos?.[0] || product.photo ? <img src={product.photos?.[0] ?? product.photo} alt={product.name} className="h-full w-full object-cover" /> : <span className="text-slate-400 text-xs">Sin foto</span>}
                  </div>
                  <p className="font-medium text-sm">{product.name}</p>
                  <p className={`text-xs font-medium ${outOfStock ? 'text-red-600' : 'text-slate-500'}`}>
                    {outOfStock ? 'Sin existencias' : `Stock: ${product.stock}`}
                  </p>
                  <p className="font-semibold text-indigo-700">RD$ {Number(product.price).toFixed(2)}</p>
                  <Btn className="mt-2 w-full" size="sm" onClick={() => { if (!outOfStock) addProductToCart(product); }} disabled={outOfStock}>
                    {outOfStock ? 'Agotado' : 'Agregar'}
                  </Btn>
                </Card>
              );
            })}
          </div>
          {visibleProducts.length === 0 ? <p className="text-sm text-slate-400">No hay productos disponibles en inventario.</p> : null}
        </Card>

        <Card className="p-5 space-y-3 h-fit">
          <p className={`rounded-lg border px-3 py-2 text-sm ${selectedNcfSeq?.is_low ? 'border-amber-400 bg-amber-50' : selectedNcfSeq?.is_exhausted ? 'border-red-400 bg-red-50' : 'border-indigo-200'}`}>
            <strong>NCF:</strong> {previewNcf}
            {selectedNcfSeq?.is_low && !selectedNcfSeq?.is_exhausted ? <span className="ml-2 text-amber-600 text-xs font-semibold">⚠ {selectedNcfSeq.remaining} restantes</span> : null}
            {selectedNcfSeq?.is_exhausted ? <span className="ml-2 text-red-600 text-xs font-semibold">✗ Secuencia agotada</span> : null}
          </p>
          <h3 className="text-2xl font-semibold">🛒 Resumen de compra</h3>
            <p className="text-sm text-slate-500">{cart.length === 0 ? 'El carrito está vacío — selecciona productos arriba' : `${cart.length} línea(s) en carrito`}</p>
          {cart.length > 0 ? (
            <div className="rounded-lg border border-slate-200 p-3 space-y-2 text-sm">
              {cart.map((line) => (
                <div key={line.id} className="border-b border-slate-100 pb-2 last:border-0 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{line.nombre}</p>
                    <p className="text-xs text-slate-500">Cant. {line.cantidad} · RD$ {Number(line.precio_unitario ?? 0).toFixed(2)}</p>
                  </div>
                  <p className="text-sm font-semibold whitespace-nowrap">RD$ {Number(line.total_linea ?? 0).toFixed(2)}</p>
                </div>
              ))}
            </div>
          ) : null}
          <div className="space-y-1 text-lg">
            <p className="flex justify-between"><span>Subtotal (sin ITBIS)</span><strong>RD$ {subtotalNeto.toFixed(2)}</strong></p>
            <p className="flex justify-between"><span>ITBIS (18%)</span><strong>RD$ {itbisTotal.toFixed(2)}</strong></p>
            <p className="flex justify-between"><span>Descuento</span><strong>RD$ 0.00</strong></p>
            <hr className="my-2" />
            <p className="flex justify-between text-2xl"><span>Total</span><strong>RD$ {totalVenta.toFixed(2)}</strong></p>
            <p className="flex justify-between"><span>Balance pendiente</span><strong>RD$ {paymentMethod === 'mixto' ? mixedRemaining.toFixed(2) : '0.00'}</strong></p>
            <p className="flex justify-between"><span>Estado</span><strong>{saleType === 'credito' ? 'Crédito' : 'Contado'}</strong></p>
          </div>
          <Btn
            className="w-full"
            onClick={() => {
              if (cart.length === 0) { window.alert('El carrito está vacío.'); return; }
              setReceivedAmount(paymentMethod === 'mixto' ? cashAmount : 0);
              setShowPayModal(true);
            }}
          >
            ✅ Registrar Venta
          </Btn>
        </Card>
      </div>

      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-slate-700">Agregar línea manual (opcional)</h3>
        <form className="grid gap-3 md:grid-cols-4" onSubmit={salesForm.handleSubmit((v) => {
          setCart((prev) => [...prev, buildCartLine({
            id: Date.now(),
            code: `MAN-${Date.now()}`,
            name: v.description,
            qty: v.qty,
            price: v.price,
            itbis_aplica: true,
            itbis_tasa: ITBIS_RATE,
            precio_incluye_itbis: true,
          })]);
          salesForm.reset({ description: '', qty: 1, price: 0 });
        })}>
          <Input label="Descripción" {...salesForm.register('description')} />
          <Input label="Cantidad" type="number" {...salesForm.register('qty', { valueAsNumber: true })} />
          <Input label="Precio unitario" type="number" step="0.01" {...salesForm.register('price', { valueAsNumber: true })} />
          <div className="md:pt-6"><Btn type="submit">Agregar</Btn></div>
        </form>
      </Card>

      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            <h3 className="text-xl font-bold text-slate-900">Confirmar cobro</h3>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal (sin ITBIS)</span><span>RD$ {subtotalNeto.toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-600"><span>ITBIS</span><span>RD$ {itbisTotal.toFixed(2)}</span></div>
              <div className="border-t border-slate-200 pt-2 flex justify-between text-lg font-bold text-slate-900">
                <span>Total a cobrar</span><span>RD$ {totalVenta.toFixed(2)}</span>
              </div>
              {paymentMethod === 'mixto' && (
                <div className="border-t border-slate-200 pt-2 space-y-1 text-xs text-slate-500">
                  <div className="flex justify-between"><span>Efectivo</span><span>RD$ {cashAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>{mixedMethod.charAt(0).toUpperCase() + mixedMethod.slice(1)}</span><span>RD$ {mixedRemaining.toFixed(2)}</span></div>
                </div>
              )}
            </div>
            {paymentMethod !== 'mixto' && (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  ¿Con cuánto paga el cliente?
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={receivedAmount || ''}
                  onChange={(e) => setReceivedAmount(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 text-2xl font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                  autoFocus
                />
              </div>
            )}
            {paymentMethod !== 'mixto' && receivedAmount > 0 && (
              <div className={`rounded-xl p-4 text-center ${receivedAmount >= totalVenta ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                {receivedAmount >= totalVenta ? (
                  <>
                    <p className="text-xs text-green-600 font-medium uppercase tracking-wide mb-1">Vuelto a entregar</p>
                    <p className="text-4xl font-black text-green-700">RD$ {(receivedAmount - totalVenta).toFixed(2)}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-red-600 font-medium uppercase tracking-wide mb-1">Falta por pagar</p>
                    <p className="text-4xl font-black text-red-700">RD$ {(totalVenta - receivedAmount).toFixed(2)}</p>
                  </>
                )}
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button
                className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                onClick={() => setShowPayModal(false)}
              >
                Cancelar
              </button>
              <button
                className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                disabled={paymentMethod !== 'mixto' && receivedAmount < totalVenta}
                onClick={async () => {
                  setShowPayModal(false);
                  await handlePrintInvoice();
                }}
              >
                Confirmar y Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {showRepairModal ? (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-center p-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] overflow-y-auto">
          <Card className="w-full max-w-2xl p-6 space-y-3 max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto">
            <h3 className="text-lg font-semibold">Recepción de equipo para reparación</h3>
            <form
              autoComplete="off"
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
              onSubmit={repairForm.handleSubmit(async (v) => {
                const brand = v.brand === 'nuevo' ? (v.custom_brand || v.brand) : v.brand;
                const model = v.model === 'nuevo' ? (v.custom_model || v.model) : v.model;
                const payload: Record<string, unknown> = {
                  customer_name: v.customer_name,
                  customer_phone: v.customer_phone,
                  contact_phone: v.contact_phone || null,
                  brand,
                  model,
                  issue: v.issue,
                  requires_evaluation: v.requires_evaluation,
                  total: v.total ?? 0,
                  advance: v.advance ?? 0,
                  assigned_to: v.assigned_to ? Number(v.assigned_to) : null,
                };
                if (posBranchId) payload.branch_id = posBranchId;
                try {
                  const result = await createRepairMutation.mutateAsync(payload);
                  await printRepairInvoice(
                    result?.repair_number ?? '',
                    v.customer_name,
                    Number(v.total ?? 0),
                    Number(v.advance ?? 0),
                    me.data?.branch_name ?? '',
                  );
                  repairForm.reset();
                  setOrderSequence((prev) => prev + 1);
                  setShowRepairModal(false);
                } catch (err: any) {
                  window.alert(`❌ Error al guardar: ${err?.message ?? 'Error desconocido'}`);
                }
              })}
            >
              <div className="md:col-span-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
                Orden de trabajo: <strong>{repairOrderCode}</strong>
              </div>
              <Input label="Nombre cliente" autoComplete="off" {...repairForm.register('customer_name')} />
              <Input label="Teléfono cliente" autoComplete="off" {...repairForm.register('customer_phone')} />
              <Input label="Teléfono contacto alterno" autoComplete="off" {...repairForm.register('contact_phone')} />
              <Select label="Marca" {...repairForm.register('brand')}>
                <option value="">Selecciona marca</option>
                {brandOptions.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                <option value="nuevo">Nuevo</option>
              </Select>
              {selectedBrand === 'nuevo' ? <Input label="Nueva marca" autoComplete="off" {...repairForm.register('custom_brand')} /> : null}
              {isPresetBrand ? (
                <Select label="Modelo" {...repairForm.register('model')}>
                  <option value="">Selecciona modelo</option>
                  {modelsForBrand.map((model) => <option key={model} value={model}>{model}</option>)}
                  <option value="nuevo">Nuevo</option>
                </Select>
              ) : (
                <Input label="Modelo" autoComplete="off" {...repairForm.register('model')} />
              )}
              {selectedModel === 'nuevo' ? <Input label="Nuevo modelo" autoComplete="off" {...repairForm.register('custom_model')} /> : null}
              <Input label="Problema reportado" autoComplete="off" className="md:col-span-2" {...repairForm.register('issue')} />
              <label className="md:col-span-2 flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" {...repairForm.register('requires_evaluation')} />
                Requiere evaluación (se recibe sin costo inicial)
              </label>
              <Input
                label="Total reparación"
                type="number"
                step="0.01"
                disabled={requiresEvaluation}
                {...repairForm.register('total', { valueAsNumber: true })}
              />
              <Input
                label="Abono"
                type="number"
                step="0.01"
                disabled={requiresEvaluation}
                {...repairForm.register('advance', { valueAsNumber: true })}
              />
              <Input label="Restante" value={requiresEvaluation ? 'En evaluación' : `RD$ ${pendingRepair.toFixed(2)}`} readOnly />
              <Select label="Asignar a" className="md:col-span-2" {...repairForm.register('assigned_to')}>
                <option value="">Selecciona empleado</option>
                {(assignable.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
              </Select>
              <div className="md:col-span-2 flex justify-end gap-2">
                <Btn type="button" variant="ghost" onClick={() => setShowRepairModal(false)}>Cancelar</Btn>
                <Btn type="submit" disabled={createRepairMutation.isPending}>
                  {createRepairMutation.isPending ? 'Guardando...' : 'Guardar recepción'}
                </Btn>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
export function HistorialCuadresPage() {
  const sessionsQuery = useQuery({
    queryKey: ['caja-sessions'],
    queryFn: async () => (await apiRequest<any[]>('/caja/sessions')).data,
    staleTime: 30000,
  });

  const fmt = (n: string | number) => `RD$ ${parseFloat(String(n)).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

  function statusBadge(status: string, difference: string) {
    const diff = parseFloat(difference);
    if (Math.abs(diff) < 0.01) return <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full px-2.5 py-0.5">✓ Exacto</span>;
    if (diff > 0) return <span className="inline-flex items-center gap-1 text-xs font-semibold bg-yellow-100 text-yellow-700 rounded-full px-2.5 py-0.5">⚠ Sobrante</span>;
    return <span className="inline-flex items-center gap-1 text-xs font-semibold bg-red-100 text-red-700 rounded-full px-2.5 py-0.5">✗ Faltante</span>;
  }

  return (
    <section className="space-y-5">
      <PanelTitulo titulo="Historial de cuadres" descripcion="Registro de todos los cuadres de caja realizados." />

      {sessionsQuery.isLoading ? <LoadingState /> : sessionsQuery.isError ? <ErrorState message="Error cargando historial" /> :
        (sessionsQuery.data ?? []).length === 0 ? <EmptyState message="No hay cuadres registrados aún." /> : (
          <div className="space-y-3">
            {(sessionsQuery.data ?? []).map((s: any) => {
              const diff = parseFloat(s.difference);
              const rowBg = Math.abs(diff) < 0.01 ? '' : diff > 0 ? 'border-l-4 border-l-yellow-400' : 'border-l-4 border-l-red-400';
              return (
                <Card key={s.id} className={`p-4 ${rowBg}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {statusBadge(s.status, s.difference)}
                        <span className="text-xs text-slate-500">{new Date(s.created_at).toLocaleString('es-DO')}</span>
                        <span className="text-xs text-slate-400">· {s.creator_name}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 mt-2 text-sm">
                        <div>
                          <p className="text-xs text-slate-400">Fondo inicial</p>
                          <p className="font-medium">{fmt(s.opening_balance)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Esperado</p>
                          <p className="font-medium">{fmt(s.expected_cash)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Contado</p>
                          <p className="font-medium">{fmt(s.actual_cash)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Diferencia</p>
                          <p className={`font-bold ${Math.abs(diff) < 0.01 ? 'text-green-600' : diff > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {diff >= 0 ? '+' : ''}{fmt(s.difference)}
                          </p>
                        </div>
                      </div>
                      {s.notes && <p className="text-xs text-slate-500 mt-1 italic">"{s.notes}"</p>}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      }
    </section>
  );
}

type ReportDay = { date: string; salesCount: number; revenue: number; itemsSold: number };
type ReportTotals = { sales: number; revenue: number };

export function ReportesPage() {
  const [days, setDays] = useState(30);
  const fmt = (n: number) => n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const report = useQuery({
    queryKey: ['reports-sales', days],
    queryFn: async () => (await apiRequest<{ days: number; totals: ReportTotals; byDay: ReportDay[] }>(`/dashboard/reports/sales?days=${days}`)).data,
    staleTime: 60000,
  });

  const data = report.data;

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <PanelTitulo titulo="Reportes de ventas" descripcion="Resumen de ingresos y ventas del período." />
        <div className="flex gap-2">
          {[7, 14, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${days === d ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {report.isLoading ? <LoadingState /> : report.isError ? <ErrorState message="Error cargando reporte" /> : (
        <>
          <div className="grid gap-4 grid-cols-2">
            <Card className="p-5 border-l-4 border-l-green-500">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Ventas en {days} días</p>
              <p className="text-3xl font-bold text-green-600">{data?.totals.sales ?? 0}</p>
            </Card>
            <Card className="p-5 border-l-4 border-l-purple-500">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Ingresos en {days} días</p>
              <p className="text-2xl font-bold text-purple-600">RD$ {fmt(data?.totals.revenue ?? 0)}</p>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-sm font-medium text-slate-700">Desglose por día</p>
            </div>
            {(data?.byDay ?? []).length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">Sin ventas en el período seleccionado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                      <th className="px-4 py-3 font-medium">Fecha</th>
                      <th className="px-4 py-3 font-medium text-right">Ventas</th>
                      <th className="px-4 py-3 font-medium text-right">Artículos</th>
                      <th className="px-4 py-3 font-medium text-right">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.byDay.map(row => (
                      <tr key={row.date} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-600">{row.date}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{row.salesCount}</td>
                        <td className="px-4 py-2.5 text-right">{row.itemsSold}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-green-700">RD$ {fmt(row.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </section>
  );
}

type AuditLogRow = {
  id: number; action: string; entity: string; entity_id: string;
  description: string; created_at: string; user_name: string;
};

export function AuditoriaPage() {
  const [limit, setLimit] = useState(50);

  const logs = useQuery({
    queryKey: ['audit-logs', limit],
    queryFn: async () => (await apiRequest<AuditLogRow[]>(`/dashboard/audit-logs?limit=${limit}`)).data,
    staleTime: 30000,
  });

  const actionColor: Record<string, string> = {
    login: 'bg-blue-100 text-blue-700',
    create: 'bg-green-100 text-green-700',
    update: 'bg-yellow-100 text-yellow-700',
    delete: 'bg-red-100 text-red-700',
    seed_inicial: 'bg-slate-100 text-slate-600',
  };

  const getActionColor = (action: string) => {
    for (const key of Object.keys(actionColor)) {
      if (action.includes(key)) return actionColor[key];
    }
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <PanelTitulo titulo="Auditoría" descripcion="Registro de actividades del sistema." />
        <div className="flex gap-2">
          {[25, 50, 100, 200].map(l => (
            <button key={l} onClick={() => setLimit(l)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${limit === l ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {logs.isLoading ? <LoadingState /> : logs.isError ? <ErrorState message="Error cargando auditoría" /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Acción</th>
                  <th className="px-4 py-3 font-medium">Entidad</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {(logs.data ?? []).length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Sin registros de auditoría.</td></tr>
                ) : (logs.data ?? []).map(log => (
                  <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap text-xs">{new Date(log.created_at).toLocaleString('es-DO')}</td>
                    <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">{log.user_name}</td>
                    <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>{log.action}</span></td>
                    <td className="px-4 py-2.5 text-slate-600">{log.entity}{log.entity_id ? ` #${log.entity_id}` : ''}</td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-xs truncate">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}

export function HistorialVentasPage() {
  const salesQuery = useQuery({
    queryKey: ['sales-history'],
    queryFn: async () => (await apiRequest<any[]>('/dashboard/sales')).data ?? [],
    staleTime: 30000,
  });

  const fmt = (n: string | number) => `RD$ ${parseFloat(String(n)).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;

  return (
    <section className="space-y-5">
      <PanelTitulo titulo="Historial de ventas" descripcion="Listado de ventas registradas." />
      {salesQuery.isLoading ? <LoadingState /> : salesQuery.isError ? <ErrorState message="Error cargando historial de ventas" /> : (
        <Card className="overflow-hidden">
          {(salesQuery.data ?? []).length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No hay ventas registradas.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">No.</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 font-medium">Pago</th>
                    <th className="px-4 py-3 font-medium">Cajero</th>
                  </tr>
                </thead>
                <tbody>
                  {(salesQuery.data ?? []).map((sale: any) => (
                    <tr key={sale.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap text-xs">{new Date(sale.created_at).toLocaleString('es-DO')}</td>
                      <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap font-mono text-xs">{sale.sale_number}</td>
                      <td className="px-4 py-2.5 text-slate-600">{sale.customer_name ?? 'Público en general'}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-green-700">{fmt(sale.total)}</td>
                      <td className="px-4 py-2.5 text-slate-600 capitalize">{sale.payment_method}</td>
                      <td className="px-4 py-2.5 text-slate-600">{sale.cashier_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </section>
  );
}
export const ConsultaReparacionPage = () => <Pendiente titulo="Consulta pública" />;
export const ReparacionDetallePage = () => <Pendiente titulo="Detalle de reparación" />;

export function ConfiguracionPage() {
  const me = useMe();
  const queryClient = useQueryClient();
  const role = me.data?.role ?? '';
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const branchesQuery = useQuery({
    queryKey: ['branches-config'],
    enabled: ['admin_supremo', 'administrador_general'].includes(role),
    queryFn: async () => (await apiRequest<any[]>('/branches')).data,
    staleTime: 60000,
  });

  useEffect(() => {
    if (!['admin_supremo', 'administrador_general'].includes(role)) return;
    if (selectedBranchId) return;
    const branchId = me.data?.branch_id ?? branchesQuery.data?.[0]?.id ?? null;
    if (branchId) setSelectedBranchId(branchId);
  }, [role, me.data?.branch_id, branchesQuery.data, selectedBranchId]);

  const branchSettingsQuery = useQuery({
    queryKey: ['branch-settings', selectedBranchId, role],
    enabled: ['admin_supremo', 'administrador_general'].includes(role) ? Boolean(selectedBranchId) : true,
    queryFn: async () => {
      const suffix = ['admin_supremo', 'administrador_general'].includes(role) && selectedBranchId ? `?branch_id=${selectedBranchId}` : '';
      try {
        return (await apiRequest<any>(`/branch-settings${suffix}`)).data;
      } catch {
        return null;
      }
    },
    staleTime: 30000,
  });

  const [formState, setFormState] = useState<Record<string, any>>({});
  useEffect(() => {
    const source = branchSettingsQuery.data;
    if (!source) return;
    setFormState({
      business_name: source.business_name ?? me?.data?.branch_name ?? 'Mi Negocio',
      fiscal_name: source.fiscal_name ?? `${me?.data?.branch_name ?? 'Mi Negocio'} SRL`,
      rnc: source.rnc ?? '',
      phone: source.phone ?? '',
      address: source.address ?? '',
      invoice_footer: source.invoice_footer ?? 'Gracias por su compra.',
      ncf_cf_start: source.feature_flags?.ncf?.consumidor_final?.range_start ?? '',
      ncf_cf_end: source.feature_flags?.ncf?.consumidor_final?.range_end ?? '',
      ncf_fiscal_current: source.feature_flags?.ncf?.credito_fiscal?.current ?? '',
      ncf_fiscal_start: source.feature_flags?.ncf?.credito_fiscal?.range_start ?? '',
      ncf_fiscal_end: source.feature_flags?.ncf?.credito_fiscal?.range_end ?? '',
      ncf_gov_current: source.feature_flags?.ncf?.gubernamental?.current ?? '',
      ncf_gov_start: source.feature_flags?.ncf?.gubernamental?.range_start ?? '',
      ncf_gov_end: source.feature_flags?.ncf?.gubernamental?.range_end ?? '',
      ncf_special_current: source.feature_flags?.ncf?.regimen_especial?.current ?? '',
      ncf_special_start: source.feature_flags?.ncf?.regimen_especial?.range_start ?? '',
      ncf_special_end: source.feature_flags?.ncf?.regimen_especial?.range_end ?? '',
    });
  }, [branchSettingsQuery.data, me?.data?.branch_name]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        branch_id: ['admin_supremo', 'administrador_general'].includes(role) ? selectedBranchId : undefined,
        business_name: formState.business_name ?? null,
        fiscal_name: formState.fiscal_name ?? null,
        rnc: formState.rnc ?? null,
        phone: formState.phone ?? null,
        address: formState.address ?? null,
        invoice_footer: formState.invoice_footer ?? null,
        feature_flags: {
          ncf: {
            consumidor_final: { current: formState.ncf_cf_start ?? null, range_start: formState.ncf_cf_start ?? null, range_end: formState.ncf_cf_end ?? null },
            credito_fiscal: { current: formState.ncf_fiscal_start ?? null, range_start: formState.ncf_fiscal_start ?? null, range_end: formState.ncf_fiscal_end ?? null },
            gubernamental: { current: formState.ncf_gov_start ?? null, range_start: formState.ncf_gov_start ?? null, range_end: formState.ncf_gov_end ?? null },
            regimen_especial: { current: formState.ncf_special_start ?? null, range_start: formState.ncf_special_start ?? null, range_end: formState.ncf_special_end ?? null },
          },
        },
      };
      return apiRequest('/branch-settings', { method: 'PUT', body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch-settings'] });
    },
  });

  if (branchSettingsQuery.isLoading || branchesQuery.isLoading) return <LoadingState />;
  if (branchSettingsQuery.error) return <ErrorState message={(branchSettingsQuery.error as Error).message} />;
  return (
    <section className="space-y-5">
      <PanelTitulo titulo="Configuración" descripcion="Datos de factura y parámetros por sucursal." />
      {['admin_supremo', 'administrador_general'].includes(role) ? (
        <Card className="p-5">
          <Select label="Sucursal a configurar" value={selectedBranchId ?? ''} onChange={(e) => setSelectedBranchId(Number(e.target.value))}>
            <option value="">Selecciona sucursal</option>
            {(branchesQuery.data ?? []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Card>
      ) : null}
      <Card className="p-5 grid gap-3 md:grid-cols-2">
        <Input label="Nombre comercial" value={formState.business_name ?? ''} onChange={(e) => setFormState((s) => ({ ...s, business_name: e.target.value }))} />
        <Input label="Nombre fiscal" value={formState.fiscal_name ?? ''} onChange={(e) => setFormState((s) => ({ ...s, fiscal_name: e.target.value }))} />
        <Input label="RNC" value={formState.rnc ?? ''} onChange={(e) => setFormState((s) => ({ ...s, rnc: e.target.value }))} />
        <Input label="Teléfono" value={formState.phone ?? ''} onChange={(e) => setFormState((s) => ({ ...s, phone: e.target.value }))} />
        <Input label="Dirección" className="md:col-span-2" value={formState.address ?? ''} onChange={(e) => setFormState((s) => ({ ...s, address: e.target.value }))} />
        <Input label="Pie de factura" className="md:col-span-2" value={formState.invoice_footer ?? ''} onChange={(e) => setFormState((s) => ({ ...s, invoice_footer: e.target.value }))} />
      </Card>
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-2">Preview factura/ticket</h3>
        <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm bg-slate-50">
          <p className="font-semibold">{formState.business_name ?? 'Mi Negocio'}</p>
          <p>{formState.fiscal_name ?? 'Mi Negocio SRL'}</p>
          <p>RNC: {formState.rnc ?? '-'}</p>
          <p>Tel: {formState.phone ?? '-'}</p>
          <p>{formState.address ?? '-'}</p>
          <hr className="my-2" />
          <p className="mt-2">{formState.invoice_footer ?? 'Gracias por su compra.'}</p>
        </div>
        <div className="mt-4 flex justify-end">
          <Btn onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
          </Btn>
        </div>
        {saveMutation.error ? <div className="mt-3"><ErrorState message={(saveMutation.error as Error).message} /></div> : null}
      </Card>
    </section>
  );
}

const NCF_TYPE_LIST = [
  { code: 'B01', label: 'Crédito Fiscal' },
  { code: 'B02', label: 'Consumidor Final' },
  { code: 'B03', label: 'Nota de Débito' },
  { code: 'B04', label: 'Nota de Crédito' },
  { code: 'B11', label: 'Comprobante de Compras' },
  { code: 'B12', label: 'Registro Único de Ingresos' },
  { code: 'B13', label: 'Gastos Menores' },
  { code: 'B14', label: 'Régimen Especial' },
  { code: 'B15', label: 'Gubernamental' },
  { code: 'B16', label: 'Comprobante para Exportaciones' },
];

export function NcfPage() {
  const me = useMe();
  const queryClient = useQueryClient();
  const role = me.data?.role ?? '';
  const isSupremo = role === 'admin_supremo';

  const [localBranchId, setLocalBranchId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editSeq, setEditSeq] = useState<any>(null);
  const [formType, setFormType] = useState('B02');
  const [formFrom, setFormFrom] = useState(1);
  const [formTo, setFormTo] = useState(1000);
  const [formThreshold, setFormThreshold] = useState(10);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [extendId, setExtendId] = useState<number | null>(null);
  const [extendTo, setExtendTo] = useState<number>(0);

  const activeBranchId = (() => {
    if (isSupremo) {
      if (localBranchId) return localBranchId;
      try {
        const imp = sessionStorage.getItem('impersonatedBranch');
        if (imp) return JSON.parse(imp).branchId;
      } catch {}
      return null;
    }
    return me.data?.branch_id ?? null;
  })();

  const branchesQuery = useQuery({
    queryKey: ['branches-for-ncf'],
    enabled: isSupremo,
    queryFn: async () => (await apiRequest<any[]>('/branches')).data ?? [],
    staleTime: 60000,
  });

  const sequencesQuery = useQuery({
    queryKey: ['ncf-sequences', activeBranchId],
    enabled: Boolean(activeBranchId),
    queryFn: async () => (await apiRequest<any[]>(`/ncf?branch_id=${activeBranchId}`)).data ?? [],
    staleTime: 10000,
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('/ncf', { method: 'POST', body: JSON.stringify({ ...data, branch_id: activeBranchId }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ncf-sequences', activeBranchId] }); setShowForm(false); setEditSeq(null); },
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => apiRequest(`/ncf/${id}`, { method: 'PATCH', body: JSON.stringify({ ...data, branch_id: activeBranchId }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ncf-sequences', activeBranchId] }); setExtendId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/ncf/${id}?branch_id=${activeBranchId}`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ncf-sequences', activeBranchId] }); setConfirmDelete(null); },
  });

  const openCreate = () => {
    setEditSeq(null);
    setFormType('B02');
    setFormFrom(1);
    setFormTo(1000);
    setFormThreshold(10);
    setShowForm(true);
  };

  const handleSave = () => {
    upsertMutation.mutate({ type: formType, sequence_from: formFrom, sequence_to: formTo, alert_threshold: formThreshold });
  };

  const sequences: any[] = sequencesQuery.data ?? [];

  const getStatusBadge = (seq: any) => {
    if (!seq.is_active) return <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-500 font-semibold">Inactivo</span>;
    if (seq.is_exhausted) return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 font-semibold">Agotado</span>;
    if (seq.is_low) return <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 font-semibold">Bajo ({seq.remaining})</span>;
    return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 font-semibold">Activo</span>;
  };

  const needsBranchSelect = isSupremo && !activeBranchId;

  return (
    <section className="space-y-5">
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Comprobantes NCF</h2>
          {isSupremo && (
            <div className="mt-2 min-w-[240px]">
              <Select label="Sucursal" value={localBranchId ?? ''} onChange={(e) => setLocalBranchId(Number(e.target.value))}>
                <option value="">Seleccionar sucursal...</option>
                {(branchesQuery.data ?? []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </div>
          )}
        </div>
        {!needsBranchSelect && <Btn onClick={openCreate}>+ Nueva secuencia NCF</Btn>}
      </Card>

      {needsBranchSelect ? (
        <Card className="p-8 text-center">
          <p className="text-slate-500">Selecciona una sucursal arriba para ver y configurar sus comprobantes NCF.</p>
        </Card>
      ) : (
        <>
          {showForm && (
            <Card className="p-5 space-y-4">
              <h3 className="font-semibold text-slate-800 text-lg">{editSeq ? 'Editar secuencia NCF' : 'Nueva secuencia NCF'}</h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <Select label="Tipo de comprobante" value={formType} onChange={(e) => setFormType(e.target.value)} disabled={Boolean(editSeq)}>
                  {NCF_TYPE_LIST.map((t) => <option key={t.code} value={t.code}>{t.code} — {t.label}</option>)}
                </Select>
                <Input label="Secuencia desde" type="number" min={1} value={formFrom} onChange={(e) => setFormFrom(Number(e.target.value))} disabled={Boolean(editSeq)} />
                <Input label="Secuencia hasta" type="number" min={1} value={formTo} onChange={(e) => setFormTo(Number(e.target.value))} />
                <Input label="Alerta cuando queden" type="number" min={1} value={formThreshold} onChange={(e) => setFormThreshold(Number(e.target.value))} />
              </div>
              {editSeq && <p className="text-xs text-slate-500">El tipo y secuencia inicial no se pueden cambiar. Usa el botón "Extender" para ampliar el rango.</p>}
              <div className="flex gap-3">
                <Btn onClick={handleSave} disabled={upsertMutation.isPending}>{upsertMutation.isPending ? 'Guardando...' : 'Guardar'}</Btn>
                <Btn variant="soft" onClick={() => { setShowForm(false); setEditSeq(null); }}>Cancelar</Btn>
              </div>
              {upsertMutation.error ? <ErrorState message={(upsertMutation.error as Error).message} /> : null}
            </Card>
          )}

          {extendId !== null && (
            <Card className="p-5 space-y-4">
              <h3 className="font-semibold text-slate-800 text-lg">Extender secuencia hasta...</h3>
              <Input label="Nueva secuencia hasta" type="number" min={1} value={extendTo} onChange={(e) => setExtendTo(Number(e.target.value))} />
              <div className="flex gap-3">
                <Btn onClick={() => patchMutation.mutate({ id: extendId, sequence_to: extendTo })} disabled={patchMutation.isPending}>
                  {patchMutation.isPending ? 'Guardando...' : 'Extender rango'}
                </Btn>
                <Btn variant="soft" onClick={() => setExtendId(null)}>Cancelar</Btn>
              </div>
              {patchMutation.error ? <ErrorState message={(patchMutation.error as Error).message} /> : null}
            </Card>
          )}

          {confirmDelete !== null && (
            <Card className="p-5 space-y-4 border border-red-200 bg-red-50">
              <h3 className="font-semibold text-red-800">¿Eliminar esta secuencia NCF?</h3>
              <p className="text-sm text-red-700">Esta acción es permanente. Los NCF ya emitidos no se verán afectados.</p>
              <div className="flex gap-3">
                <Btn onClick={() => deleteMutation.mutate(confirmDelete!)} disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
                </Btn>
                <Btn variant="soft" onClick={() => setConfirmDelete(null)}>Cancelar</Btn>
              </div>
            </Card>
          )}

          {sequencesQuery.isPending ? (
            <Card className="p-8 text-center"><p className="text-slate-500">Cargando secuencias NCF...</p></Card>
          ) : sequences.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-slate-500 mb-3">No hay secuencias NCF configuradas para esta sucursal.</p>
              <Btn onClick={openCreate}>+ Configurar primer tipo de comprobante</Btn>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sequences.map((seq: any) => {
                const ncfType = NCF_TYPE_LIST.find((t) => t.code === seq.type);
                const rangeTotal = seq.sequence_to - seq.sequence_from + 1;
                const pctUsed = rangeTotal > 0 ? Math.round(((seq.current_sequence - seq.sequence_from) / rangeTotal) * 100) : 100;
                return (
                  <Card key={seq.id} className={`p-4 space-y-3 ${!seq.is_active ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-900 text-xl font-mono">{seq.type}</p>
                        <p className="text-sm text-slate-600">{ncfType?.label ?? seq.label}</p>
                      </div>
                      {getStatusBadge(seq)}
                    </div>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Próximo NCF</span>
                        <strong className="font-mono text-indigo-700">{seq.next_ncf}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Disponibles</span>
                        <strong>{seq.remaining.toLocaleString()} de {rangeTotal.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Rango</span>
                        <span className="font-mono text-xs text-slate-500">{seq.type}{String(seq.sequence_from).padStart(8, '0')}→{seq.type}{String(seq.sequence_to).padStart(8, '0')}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
                        <div
                          className={`h-2 rounded-full transition-all ${pctUsed >= 95 ? 'bg-red-500' : pctUsed >= 75 ? 'bg-amber-400' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(100, pctUsed)}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 text-right">{pctUsed}% utilizado · Alerta a {seq.alert_threshold} restantes</p>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Btn size="sm" variant="soft" onClick={() => {
                        setExtendTo(seq.sequence_to);
                        setExtendId(seq.id);
                      }}>Extender</Btn>
                      <Btn size="sm" variant="soft" onClick={() => patchMutation.mutate({ id: seq.id, is_active: !seq.is_active })}>
                        {seq.is_active ? 'Desactivar' : 'Activar'}
                      </Btn>
                      <Btn size="sm" variant="soft" onClick={() => setConfirmDelete(seq.id)}>Eliminar</Btn>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
