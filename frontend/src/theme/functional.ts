import type { EmphasysTokens } from './tokens.ts';

/**
 * Capa funcional: colores con significado operativo, contable o de terceros.
 * No dependen de `BrandDefinition`; una marca white label nunca los cambia.
 *
 * Fuera de esta capa y de la marca quedan los colores que vienen de la base
 * de datos (estados de documento, etapas de producción, etiquetas, formatos
 * de impresión): son datos del usuario, no tema.
 */

type FeedbackColor = { main: string; light: string; dark: string; contrastText: string };

/**
 * Estados de retroalimentación de MUI (`palette.success/warning/error/info`).
 * Hoy el tema los toma de los defaults de MUI 7 y esta tabla los registra;
 * `brandParity.test.ts` exige que el tema generado coincida con ella.
 *
 * No se pasan a `createTheme` a propósito: hacerlo reordena las claves de
 * `palette` (y con ello el orden de las variantes `color=` que genera MUI)
 * aunque los valores sean idénticos.
 */
export const feedbackTokens: Record<'success' | 'warning' | 'error' | 'info', FeedbackColor> = {
  success: { main: '#2e7d32', light: '#4caf50', dark: '#1b5e20', contrastText: '#fff' },
  warning: { main: '#ed6c02', light: '#ff9800', dark: '#e65100', contrastText: '#fff' },
  error: { main: '#d32f2f', light: '#ef5350', dark: '#c62828', contrastText: '#fff' },
  info: { main: '#0288d1', light: '#03a9f4', dark: '#01579b', contrastText: '#fff' },
};

/** Roles funcionales que `EmphasysTokens` expone; cada tema tiene su versión. */
export type FunctionalTokens = {
  action: Pick<EmphasysTokens['action'], 'destructive' | 'info'>;
  status: EmphasysTokens['status'];
  metric: EmphasysTokens['metric'];
};

const status: EmphasysTokens['status'] = {
  draft: '#facc15',
  cancellation: '#d97706',
};

export const classicFunctionalTokens: FunctionalTokens = {
  action: {
    destructive: '#b91c1c',
    info: '#1d2f68',
  },
  status,
  metric: {
    amount: { background: '#f8fafc', foreground: '#1d2f68' },
    applied: { background: '#f8fafc', foreground: '#1f2937' },
    available: { background: '#f8fafc', foreground: '#1d2f68' },
    exhausted: { background: '#f8fafc', foreground: '#1f2937' },
    blocked: { background: '#f8fafc', foreground: '#1f2937' },
    track: '#e5e7eb',
    progress: '#1d2f68',
    progressDone: '#1f2937',
    caption: '#6b7280',
  },
};

export const experimentalFunctionalTokens: FunctionalTokens = {
  action: {
    destructive: '#8a4d45',
    info: '#3d5f86',
  },
  status,
  metric: {
    amount: { background: '#efe4d4', foreground: '#3e3428' },
    applied: { background: '#e3ebe3', foreground: '#3f6b52' },
    available: { background: '#e3eaf2', foreground: '#3d5f86' },
    exhausted: { background: '#dce8df', foreground: '#3f6b52' },
    blocked: { background: '#f0e4e0', foreground: '#8a4d45' },
    track: '#e4ddd2',
    progress: '#8fa4bf',
    progressDone: '#7d9b86',
    caption: '#5e584f',
  },
};

/** Antigüedad de saldos (Cartera vencida): verde → naranja → rojo → morado. */
export const agingBucketColors: Readonly<Record<'0-30' | '31-60' | '61-90' | '90+', string>> = {
  '0-30': '#388e3c',
  '31-60': '#f57c00',
  '61-90': '#d32f2f',
  '90+': '#7b1fa2',
};

/** Colores de marcas de terceros. Nunca se derivan de la marca propia. */
export const thirdPartyColors = {
  whatsapp: '#25D366',
  excel: '#217346',
  excelHover: '#1a5c38',
} as const;

/**
 * Paletas categóricas: distinguen series, meses o personas. No son colores
 * de marca aunque alguno coincida (p. ej. el primer avatar es el azul Emphasys).
 */
export const categoricalPalettes = {
  /** Series de informes de ventas (origen de contacto, vendedor). */
  series: ['#3d5f86', '#3f6b52', '#8a6232', '#5c5348', '#4e6f78', '#6a7354', '#7a5648', '#3c4149'],
  /** Un color fijo por mes, enero → diciembre. */
  months: [
    '#3d5f86', '#6b86a8', '#4e8784', '#5f8a68', '#86965a', '#b39552',
    '#c27f4e', '#ad6250', '#96586a', '#775f92', '#59658f', '#7b7266',
  ],
  /** Avatares de leads, elegidos por hash del id. */
  avatars: ['#1d2f68', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#0369a1', '#4d7c0f', '#a21caf'],
} as const satisfies Record<string, readonly string[]>;
