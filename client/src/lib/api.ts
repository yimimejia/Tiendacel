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

async function safeParseResponse(response: Response) {
  const raw = await response.text();
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
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

  const payload = await safeParseResponse(response);

  if (!response.ok) {
    const apiMessage = payload && typeof payload.message === 'string' ? payload.message : null;
    throw new Error(apiMessage ?? `Error HTTP ${response.status}: ${response.statusText || 'Solicitud fallida'}`);
  }

  if (!payload) {
    return {
      success: true,
      message: 'Operación completada correctamente',
      data: null as T,
    };
  }

  return payload as unknown as ApiResponse<T>;
}
