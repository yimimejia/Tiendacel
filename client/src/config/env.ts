const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const getApiUrl = () => {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`;
  }

  return 'http://localhost:4000/api';
};

export const clientEnv = {
  apiUrl: getApiUrl(),
  appName: import.meta.env.VITE_APP_NAME || 'Vibran Tech',
  publicBaseUrl: import.meta.env.VITE_PUBLIC_BASE_URL || '/',
};
