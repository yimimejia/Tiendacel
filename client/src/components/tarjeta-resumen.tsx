interface TarjetaResumenProps {
  etiqueta: string;
  valor: string;
  cambio?: string;
}

export function TarjetaResumen({ etiqueta, valor, cambio }: TarjetaResumenProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{etiqueta}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{valor}</p>
      {cambio ? <p className="mt-1 text-xs text-emerald-600">{cambio}</p> : null}
    </article>
  );
}
