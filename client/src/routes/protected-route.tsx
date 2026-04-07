import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useMe } from '@/features/auth/use-auth';
import { LoadingState } from '@/components/loading-state';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { data, isLoading, isError } = useMe();

  if (isLoading) return <LoadingState text="Validando sesión..." />;
  if (isError || !data) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
