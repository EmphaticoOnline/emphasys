import type { EmphasysTokens } from './tokens.ts';
import { rgbaFromHex } from './color.ts';
import { neutralColors } from './structural.ts';

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
    /** Detalle de un error bajo su mensaje principal (`error[700]`). */
    900: '#7f1d1d',
  },
} as const;

/**
 * Tintes funcionales: colores de `alertColors` con transparencia. Se derivan de
 * su tono para seguirlo y reproducen el string que escribía el código.
 */
export const alertTints = {
  /** Hover de botón destructivo (texto `alertColors.error[600]` / `[700]`). */
  errorHover: rgbaFromHex(alertColors.error[600], '0.08'),
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
  /** Punto separador dorado entre datos de partida en el formulario de documentos. */
  documentSeparator: '#c8a25a',
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

/** Indicador de entorno en el cromado: producción, advertencia (pruebas) y por defecto. */
export const environmentColors = {
  productionBackground: '#b3261e',
  productionBorder: '#ffb4ab',
  warningBackground: '#ffc857',
  warningText: '#4a2b00',
  warningBorder: '#ffe08a',
  defaultText: '#e8edf7',
  /** Fondo y borde del indicador por defecto (velo blanco sobre el cromado). */
  defaultBackground: 'rgba(255,255,255,0.16)',
  defaultBorder: 'rgba(255,255,255,0.28)',
} as const;

/**
 * Chip de tipo de actividad en la lista de pendientes (índigo). El fondo coincide
 * con el tinte de marca, pero aquí es índigo-50 y no sigue a la marca.
 */
export const activityTypeChipColors = {
  pendingBackground: '#eef2ff',
  pendingText: '#3730a3',
} as const;

/**
 * Punto de estado por bucket de oportunidades. Convertida, perdida y pausada
 * significan éxito, error y advertencia: usan los mismos valores de MUI.
 */
export const opportunityBucketColors = {
  convertidas: feedbackTokens.success.main,
  perdidas: feedbackTokens.error.main,
  pausadas: feedbackTokens.warning.main,
  abiertas: '#1976d2',
} as const;

/** Escala de temperatura de leads (frío → muy caliente). No son estados de error. */
export const temperatureColors = {
  frio: '#607d8b',
  tibio: '#1976d2',
  caliente: '#ed6c02',
  muy_caliente: '#d32f2f',
} as const;

/** Chip "datos fiscales completos / incompletos" del formulario de documentos (verde y ámbar propios). */
export const fiscalStatusColors = {
  completeBackground: '#e8f4ee',
  completeText: '#1c6b47',
  incompleteBackground: '#fdf3e3',
  incompleteText: '#9a5b00',
  /** Borde del chip cuando lo lleva (resumen flotante de factura). */
  completeBorder: '#c9e3d5',
  incompleteBorder: '#ecd9b4',
} as const;

/**
 * Indicador de imagen de partida: con imagen propia (éxito, mismo valor de MUI),
 * con archivo del producto o sin imagen.
 */
export const attachmentIndicatorColors = {
  withImage: feedbackTokens.success.main,
  productFile: '#1565c0',
  none: '#6b7280',
} as const;

/** Caja de anticipos del documento: borde con anticipos registrados, borde sin ellos y fondo. */
export const advanceBoxColors = {
  registeredBorder: '#9db4ff',
  idleBorder: '#d7deed',
  surface: '#f7faff',
} as const;

/**
 * Tonos de los conceptos del resumen financiero del formulario de documentos.
 * Los importes negativos conservan sus tres tonos actuales: ámbar para descuento
 * de partidas y retenciones, naranja para descuento global y ámbar propio para la
 * retención en el panel de impuestos. Unificarlos es una decisión pendiente.
 */
export const documentSummaryTones = {
  gross: neutralColors.slate[700],
  itemDiscount: alertColors.warning[700],
  globalDiscount: alertColors.caution[800],
  /** Descuento combinado (partidas + global) del resumen flotante. */
  discount: alertColors.caution[800],
  net: alertColors.info[700],
  tax: '#0f766e',
  withholding: alertColors.warning[700],
  total: neutralColors.gray[900],
  /** Retención en el panel de impuestos y en partidas. */
  withholdingInline: '#9a5b00',
} as const;

/**
 * Saldos e importes con signo en pantallas que no dependen del tema. Usan los
 * mismos valores de `palette` de MUI que antes (`error/success/warning.main`)
 * pero nombran el significado, para que el signo no siga a una futura
 * personalización de `palette.error`. Varios roles comparten valor a propósito.
 */
export const balanceColors = {
  /** Saldo a cargo / por pagar. */
  due: feedbackTokens.error.main,
  /** Saldo a favor. */
  inFavor: feedbackTokens.success.main,
  /** Saldo liquidado (cero). */
  settled: feedbackTokens.success.main,
  /** Cobro suspendido. */
  onHold: feedbackTokens.warning.main,
  /** Importe o saldo negativo (déficit). */
  negative: feedbackTokens.error.main,
  /** Importe o existencia positiva. */
  positive: feedbackTokens.success.main,
  /** Pendiente de recibir (OC). Ver D5 en la auditoría de fuentes de signo. */
  outstanding: feedbackTokens.error.main,
} as const;

/**
 * Flujo de efectivo e inventario en informes sin tema: depósito/entrada y
 * retiro/salida. Mismos valores de `palette` de MUI que antes. Distinto de
 * `inventoryFlowColors` (Kardex) y de `inflowColor`/`outflowColor` (tema):
 * ver D2 en la auditoría de fuentes de signo.
 */
export const cashFlowColors = {
  inflow: feedbackTokens.success.main,
  outflow: feedbackTokens.error.main,
} as const;

/** Vencimiento de documentos y pagos: vencido y vence hoy. Mismos valores de `palette` de MUI. */
export const dueDateColors = {
  overdue: feedbackTokens.error.main,
  dueToday: feedbackTokens.warning.main,
} as const;

/**
 * Variación de precio o costo en el historial: sube, baja, máximo y mínimo del
 * periodo. Mismos valores de `palette` de MUI. Ventas usa la misma lectura que
 * compras (subir en rojo); ver D9 en la auditoría de fuentes de signo.
 */
export const priceVarianceColors = {
  up: feedbackTokens.error.main,
  down: feedbackTokens.success.main,
  max: feedbackTokens.error.main,
  min: feedbackTokens.success.main,
} as const;

// ── Restos R1.1: funcionales y CRM (docs/white-label-restos-r1-audit.md) ─────

/** Importe monetario en CRM (oportunidades y seguimiento de actividad): teal-700. */
export const crmAccents = {
  amount: '#0f766e',
} as const;

/**
 * Chips de filtro de leads en móvil (ventana de WhatsApp, oportunidad). El texto
 * y el fondo activo comparten valor pero son roles distintos.
 */
export const leadFilterChipColors = {
  foreground: '#0f766e',
  activeBackground: '#0f766e',
  surface: '#f0fdfa',
  border: '#99f6e4',
} as const;

/** Resaltado de búsqueda en la conversación: coincidencia actual y resto. */
export const searchHighlightColors = {
  current: '#facc15',
  match: '#fef08a',
} as const;

/** Tono de estado de actividad sobre el rail del workspace de actividades. */
export const activityRailTones = {
  overdue: '#e7b2ab',
  today: '#b7d4c4',
  upcoming: '#c9c0dc',
} as const;

/** Chip del modo de autorización "Flujo" (violeta). */
export const authorizationModeColors = {
  flowBackground: '#ede9fe',
  flowText: '#6d28d9',
} as const;

/** Punto de estado de afectación de un movimiento de inventario. */
export const inventoryAffectationColors = {
  applied: '#4ade80',
  reverted: '#f87171',
} as const;

/** Fondo de fila en alerta. Mismo valor, roles distintos: no se unifican. */
export const alertRowColors = {
  /** Fila vencida en los informes de vencimientos. */
  overdue: '#fff5f5',
  /** Producto bajo mínimo. */
  belowMinimum: '#fff5f5',
} as const;

// ── Restos R1.2: categóricos ──────────────────────────────────────────────────

/** Fondo de cada sección en el editor y diálogo de Carta Porte: un color por sección. */
export const cartaPorteSectionColors = {
  ruta: '#e4eef6',
  unidad: '#e5f0e8',
  operador: '#f8efe4',
  generales: '#f3ecf6',
  mercancias: '#e8f2f0',
} as const;

// ── Restos R1.4 ───────────────────────────────────────────────────────────────

/** Chip de prioridad de lead: texto de prioridad "Media" (las demás usan `palette`). */
export const leadPriorityColors = {
  mediumText: '#7c5a00',
} as const;

// ── Blancos W3: contraste sobre colores de estado y de terceros ───────────────

/**
 * Texto o icono blanco sobre un color funcional o de tercero. Fijo y sin marca.
 * Cada rol conserva su escritura (`'#fff'`, `'#ffffff'` o `'white'`): no se
 * unifican. Ver docs/white-label-blancos-audit.md (rol E).
 */
export const onStatusColors = {
  /** Sobre el indicador de entorno de producción. */
  environmentProduction: '#fff',
  /** Sobre el avatar verde de WhatsApp. */
  whatsapp: 'white',
  /** Sobre el chip de filtro de leads activo (`leadFilterChipColors.activeBackground`). */
  leadFilterChip: '#ffffff',
  /** Sobre el chip "Finalizadas" activo de leads. */
  leadViewToggle: '#ffffff',
  /** Sobre el color de temperatura del prospecto. */
  temperature: '#fff',
} as const;

// ── Blancos W4: contraste sobre colores que vienen de BD (D-B3) ───────────────

/**
 * Foreground blanco sobre un color guardado en BD. Solo se extrae el rol del
 * blanco: el color de fondo sigue siendo dato (`tag.color`, `etapa_color`) y
 * sus fallbacks quedan literales. Cada rol conserva su escritura.
 */
export const dataColorContrast = {
  /** Texto e icono de borrar del chip sobre el color de una etiqueta de conversación. */
  tagChipForeground: '#fff',
  /** Opción clara del contraste calculado contra el color de etapa (la oscura es `neutralColors.gray[900]`). */
  stageLight: '#ffffff',
} as const;
