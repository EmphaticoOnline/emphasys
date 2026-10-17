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

/**
 * Alertas de éxito, advertencia y error usadas en componentes (chips de
 * estado, validaciones, conteos de errores). Son las escalas de Tailwind
 * (green / amber / orange / emerald / blue / sky / red) que ya usaba el código, con su número de tono, para
 * conservar cada valor exacto. No son `palette.success/warning/error` de MUI,
 * que tienen otros valores (ver `feedbackTokens`).
 */
export const alertColors = {
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
  },
  /** Naranja: atención que no llega a error (excede, inválido, pausada, hoy). */
  caution: {
    50: '#fff7ed',
    100: '#ffedd5',
    300: '#fdba74',
    700: '#c2410c',
    800: '#9a3412',
  },
  /** Emerald: seguimiento positivo en CRM (al día, convertida, realizada). */
  positive: {
    50: '#ecfdf5',
    200: '#a7f3d0',
    700: '#047857',
    800: '#065f46',
  },
  /** Azul: información y estados en curso (pendiente, abierta, enviada). */
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  /** Sky: estado abierto de cotización. */
  open: {
    100: '#e0f2fe',
    800: '#075985',
  },
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
  },
} as const;

/**
 * Colores contables: expresan signo o resultado, no error ni éxito. Aunque
 * algunos valores coinciden con `alertColors`, su significado es otro y se
 * mantienen separados.
 */
export const accountingColors = {
  /** Estado de cuenta: cargo / saldo deudor. */
  debit: '#dc2626',
  /** Estado de cuenta: abono / saldo a favor. */
  credit: '#16a34a',
  /** Estado de cuenta: importe o saldo en cero. */
  zero: '#111827',
  /** Estado de cuenta: movimiento cancelado. */
  cancelled: '#9ca3af',
  /** Importe negativo en vistas SAT (auxiliares, balanza). */
  negativeAmount: '#b91c1c',
  /** Panel de resultado: utilidad del periodo o balance cuadrado. */
  favorable: { surface: '#ecfdf5', border: '#166534', text: '#166534' },
  /** Panel de resultado: pérdida del periodo o balance con diferencia. */
  unfavorable: { surface: '#fef2f2', border: '#b91c1c', text: '#b91c1c' },
} as const;

/** Dirección de movimientos de inventario (Kardex, Movimientos de inventario). */
export const inventoryFlowColors = {
  inbound: '#16a34a',
  outbound: '#dc2626',
} as const;

/**
 * Acentos decorativos por módulo. Identifican visualmente un grupo de
 * pantallas; no son marca ni estado. Los informes de inventario concatenan
 * un sufijo alfa (`${accent}18`), por eso el valor es hex de 6 dígitos.
 */
export const moduleAccents = {
  inventoryReports: '#7c3aed',
} as const;

/** Colores de marcas de terceros. Nunca se derivan de la marca propia. */
export const thirdPartyColors = {
  whatsapp: '#25D366',
  excel: '#217346',
  excelHover: '#1a5c38',
  /** Botón de exportar PDF. */
  pdf: '#d9622b',
  pdfHover: '#bf5321',
  /** Palomitas de estado de mensaje de WhatsApp: leído y entregado. */
  whatsappRead: '#4fc3f7',
  whatsappDelivered: '#9e9e9e',
} as const;

/** Hover de botones destructivos sin rol en `EmphasysTokens` (tema experimental). */
export const destructiveHoverColors = {
  experimental: '#743f39',
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
  /**
   * Tarjetas KPI de resumen en informes, por posición (1.ª, 2.ª, …). Coincide
   * con el azul y el acento Emphasys, pero no los sigue: es categórica.
   */
  reportKpis: ['#1d2f68', '#006261', '#7c3aed', '#b45309', '#0369a1'],
  /** Lavado de filas de actividad, por índice; y su versión al pasar el cursor. */
  activityRows: ['#f5f3ee', '#f0f4f0', '#f7f2ea', '#f3f1f6', '#f3f4ee', '#f0f3f6'],
  activityRowsHover: ['#ece9e2', '#e6ede6', '#f0e8dc', '#eae7ef', '#e8ebe2', '#e6ecf1'],
  /** Avatares de leads, elegidos por hash del id. */
  avatars: ['#1d2f68', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#0369a1', '#4d7c0f', '#a21caf'],
} as const satisfies Record<string, readonly string[]>;

/** Acentos de tarjetas de actividad: próxima (sin vencer) y visita. */
export const activityAccents = {
  upcoming: '#6a5a86',
  visit: '#8a5a32',
} as const;
