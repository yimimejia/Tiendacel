import { clientEnv } from '@/config/env';

const API_URL = clientEnv.apiUrl;

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: { page: number; limit: number; total: number };
}

export function getAccessToken() {
  return localStorage.getItem('access_token');
}

export function setAccessToken(token: string | null) {
  if (!token) {
    localStorage.removeItem('access_token');
    return;
  }
  localStorage.setItem('access_token', token);
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const token = getAccessToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message ?? 'Error en solicitud al servidor');
  }

  return payload;
}
