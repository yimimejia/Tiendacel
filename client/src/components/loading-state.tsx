export function LoadingState({ text = 'Cargando...' }: { text?: string }) {
  return <div className="vt-card p-4 text-sm text-slate-600">{text}</div>;
}
