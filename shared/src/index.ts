export const APP_NAME = 'Vibran Tech';
export const APP_TECHNICAL_NAME = 'vibran-tech-system';

export const ROLES_SISTEMA = [
  'administrador_general',
  'encargado_sucursal',
  'tecnico',
  'caja_ventas',
] as const;

export type RolSistema = (typeof ROLES_SISTEMA)[number];
