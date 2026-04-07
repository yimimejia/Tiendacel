import { useQuery } from '@tanstack/react-query';

interface EstadoBackend {
  ok: boolean;
  mensaje: string;
  fechaServidor: string | null;
}

async function obtenerEstadoBackend(): Promise<EstadoBackend> {
  const respuesta = await fetch('http://localhost:4000/api/health');

  if (!respuesta.ok) {
    throw new Error('No fue posible consultar el backend.');
  }

  return respuesta.json();
}

export function useEstadoBackend() {
  return useQuery({
    queryKey: ['estado-backend'],
    queryFn: obtenerEstadoBackend,
    staleTime: 10_000,
  });
}
