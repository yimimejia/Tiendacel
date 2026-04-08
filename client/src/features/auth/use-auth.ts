import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, setAccessToken } from '@/lib/api';

interface LoginInput {
  username_or_email: string;
  password: string;
}

export interface AuthUser {
  id: number;
  full_name: string;
  role: string;
  branch_id: number | null;
  branch_name: string | null;
  username_or_email: string;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

export function useMe() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => (await apiRequest<AuthUser>('/auth/me')).data,
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LoginInput) => (await apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input) })).data,
    onSuccess: (data) => {
      setAccessToken(data.token);
      queryClient.setQueryData(['auth', 'me'], data.user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiRequest<null>('/auth/logout', { method: 'POST' });
    },
    onSuccess: () => {
      setAccessToken(null);
      queryClient.removeQueries({ queryKey: ['auth'] });
    },
  });
}
