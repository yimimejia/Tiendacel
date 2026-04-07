export function LoadingState({ text = 'Cargando...' }: { text?: string }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">{text}</div>;
}
