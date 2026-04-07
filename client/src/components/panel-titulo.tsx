import type { ReactNode } from 'react';

interface PanelTituloProps {
  titulo: string;
  descripcion: string;
  accion?: ReactNode;
}

export function PanelTitulo({ titulo, descripcion, accion }: PanelTituloProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-white/60 bg-white/70 p-4 backdrop-blur md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">{titulo}</h2>
        <p className="text-sm text-slate-600">{descripcion}</p>
      </div>
      {accion}
    </div>
  );
}
