import { useQuery } from '@tanstack/react-query';
import { clientEnv } from '@/config/env';

interface EstadoBackend {
  success: boolean;
  message: string;
  data: {
    fechaServidor: string | null;
  };
}

async function obtenerEstadoBackend(): Promise<EstadoBackend> {
  const respuesta = await fetch(`${clientEnv.apiUrl}/health`);

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
