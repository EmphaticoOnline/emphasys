/**
 * Roles visuales del producto. Los componentes leen estos roles;
 * no conocen paletas concretas ni el motivo por el que un tema está activo.
 */
export type EmphasysSurface = {
  background: string;
  foreground: string;
  muted: string;
  subtle: string;
  border: string;
  selection: string;
  selectionForeground: string;
  hover: string;
  accent: string;
};

export type EmphasysTokens = {
  frame: EmphasysSurface & {
    control: string;
    controlForeground: string;
    controlBorder: string;
    logoFilter: string;
    /** Texto e iconos de las opciones del menú principal. */
    itemForeground: string;
  };
  navigation: EmphasysSurface & {
    control: string;
    controlForeground: string;
    summary: string;
    track: string;
    progress: string;
  };
  documentNav: {
    background: string;
    border: string;
    foreground: string;
    selectedBackground: string;
    selectedForeground: string;
    indicator: string;
    hoverBackground: string;
    hoverForeground: string;
  };
  canvas: {
    page: string;
    sheet: string;
    border: string;
    inset: number;
    radius: number;
  };
  content: {
    background: string;
    elevated: string;
    foreground: string;
    secondary: string;
    muted: string;
    border: string;
    hover: string;
    well: string;
    card: string;
  };
  action: {
    primary: string;
    primaryForeground: string;
    primaryHover: string;
    tint: string;
    wash: string;
    hoverTint: string;
    destructive: string;
    info: string;
    disabled: string;
  };
  table: {
    headerBg: string;
    headerFg: string;
    line: string;
    cell: string;
    muted: string;
  };
  grid: {
    header: string;
    headerForeground: string;
    stripe: string;
    hover: string;
    selected: string;
    selectedHover: string;
  };
  metric: {
    amount: { background: string; foreground: string };
    applied: { background: string; foreground: string };
    available: { background: string; foreground: string };
    exhausted: { background: string; foreground: string };
    blocked: { background: string; foreground: string };
    track: string;
    progress: string;
    progressDone: string;
    caption: string;
  };
  status: {
    draft: string;
    cancellation: string;
  };
  /** Hilo de CRM > Conversaciones. El recibido “Lino” vive aquí. */
  chat: {
    well: string;
    header: string;
    received: string;
    receivedForeground: string;
    sent: string;
    sentForeground: string;
    selection: string;
    selectionBar: string;
    reply: string;
  };
};

const ROBOTO_FIGURE = {
  fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
} as const;

/**
 * Cromado del tema experimental. Fondo del sidebar y de la barra superior
 * en todas las rutas. No es el texto de contenido (#3e3428).
 */
const STRUCTURAL_CHROME = '#2c3344';

const structuralFrame = {
  background: STRUCTURAL_CHROME,
  foreground: '#f7f4ee',
  muted: 'rgba(247,244,238,0.62)',
  subtle: 'rgba(247,244,238,0.42)',
  border: 'rgba(255,255,255,0.08)',
  selection: 'rgba(255,255,255,0.10)',
  selectionForeground: '#fbf7f1',
  hover: 'rgba(255,255,255,0.06)',
  accent: '#d7cbbd',
  control: 'rgba(255,255,255,0.08)',
  controlForeground: '#f7f4ee',
  controlBorder: 'rgba(247,244,238,0.35)',
  logoFilter: 'none',
  itemForeground: '#efe6d8',
} as const;

/** Tipografía definitiva del menú principal. El resto del ERP sigue en Roboto. */
export const MAIN_NAV_TYPE = {
  fontFamily: '"Source Sans 3", system-ui, sans-serif',
  fontSize: 15,
  fontWeight: 500,
  activeFontWeight: 700,
  letterSpacing: '0.005em',
  activeLetterSpacing: '0em',
  lineHeight: 1.2,
  iconSize: 17,
  inactiveOpacity: 0.82,
  iconGap: 1,
} as const;

export const EDITORIAL_FIGURE_FAMILY =
  '"Iowan Old Style", Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif';

export const classicTokens: EmphasysTokens = {
  frame: { ...structuralFrame },
  navigation: {
    background: '#ffffff',
    foreground: '#1f2937',
    muted: '#6b7280',
    subtle: '#9ca3af',
    border: '#e5e7eb',
    selection: 'rgba(44, 51, 68, 0.08)',
    selectionForeground: STRUCTURAL_CHROME,
    hover: 'rgba(15, 23, 42, 0.04)',
    accent: STRUCTURAL_CHROME,
    control: STRUCTURAL_CHROME,
    controlForeground: '#ffffff',
    summary: '#f8fafc',
    track: '#e5e7eb',
    progress: '#1d2f68',
  },
  documentNav: {
    background: '#f6f8fa',
    border: '#e5e7eb',
    foreground: '#4b5563',
    selectedBackground: '#ffffff',
    selectedForeground: STRUCTURAL_CHROME,
    indicator: '#006261',
    hoverBackground: '#f1f3f6',
    hoverForeground: STRUCTURAL_CHROME,
  },
  canvas: {
    page: '#eef1f4',
    sheet: '#ffffff',
    border: '#e5e7eb',
    inset: 2,
    radius: 2,
  },
  content: {
    background: '#ffffff',
    elevated: '#ffffff',
    foreground: '#1f2937',
    secondary: '#4b5563',
    muted: '#6b7280',
    border: '#e5e7eb',
    hover: '#f7f9fc',
    well: '#ffffff',
    card: '#ffffff',
  },
  action: {
    primary: '#1d2f68',
    primaryForeground: '#ffffff',
    primaryHover: '#162551',
    tint: '#eef2ff',
    wash: '#e7eef8',
    hoverTint: 'rgba(29, 47, 104, 0.08)',
    destructive: '#b91c1c',
    info: '#1d2f68',
    disabled: '#c9d2e8',
  },
  table: {
    headerBg: '#f8fafc',
    headerFg: '#8b93a7',
    line: '#e5eaf1',
    cell: '#334155',
    muted: '#94a3b8',
  },
  grid: {
    header: STRUCTURAL_CHROME,
    headerForeground: '#ffffff',
    stripe: 'rgba(0, 120, 70, 0.05)',
    hover: 'rgba(15, 23, 42, 0.04)',
    selected: 'rgba(44, 51, 68, 0.08)',
    selectedHover: 'rgba(44, 51, 68, 0.12)',
  },
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
  status: {
    draft: '#facc15',
    cancellation: '#d97706',
  },
  chat: {
    well: '#f8fafc',
    header: '#ffffff',
    received: '#f3f4f6',
    receivedForeground: '#1f2937',
    sent: '#1d2f68',
    sentForeground: '#ffffff',
    selection: 'rgba(29, 47, 104, 0.12)',
    selectionBar: '#1d2f68',
    reply: '#eef2ff',
  },
};

export const experimentalTokens: EmphasysTokens = {
  frame: { ...structuralFrame },
  navigation: {
    background: '#3c4149',
    foreground: '#f4f0e8',
    muted: 'rgba(244,240,232,0.62)',
    subtle: 'rgba(244,240,232,0.42)',
    border: 'rgba(255,255,255,0.08)',
    selection: '#5e6672',
    selectionForeground: '#fbf7f1',
    hover: 'rgba(255,255,255,0.06)',
    accent: '#f4f0e8',
    control: '#f4f0e8',
    controlForeground: '#2c3138',
    summary: 'rgba(255,255,255,0.08)',
    track: 'rgba(255,255,255,0.16)',
    progress: '#a9c0d6',
  },
  documentNav: {
    background: '#f4f0e8',
    border: '#e4ddd2',
    foreground: '#7a7268',
    selectedBackground: '#fbf7f1',
    selectedForeground: '#3e3428',
    indicator: '#3e3428',
    hoverBackground: '#efe8dc',
    hoverForeground: '#3e3428',
  },
  canvas: {
    page: '#f4f0e8',
    sheet: '#f4f0e8',
    border: 'transparent',
    inset: 0,
    radius: 0,
  },
  content: {
    background: '#f4f0e8',
    elevated: '#fbf7f1',
    foreground: '#3e3428',
    secondary: '#5c5348',
    muted: '#7a7268',
    border: '#e4ddd2',
    hover: '#efe8dc',
    well: '#fffcf8',
    card: '#ffffff',
  },
  action: {
    primary: '#3c4149',
    primaryForeground: '#f4f0e8',
    primaryHover: '#2c3138',
    tint: '#efe4d4',
    wash: '#efe8dc',
    hoverTint: 'rgba(62, 52, 40, 0.08)',
    destructive: '#8a4d45',
    info: '#3d5f86',
    disabled: '#c4bdb4',
  },
  table: {
    headerBg: '#f7f4ee',
    headerFg: '#7a7268',
    line: '#e4ddd2',
    cell: '#3e3428',
    muted: '#a3988c',
  },
  grid: {
    header: '#3c4149',
    headerForeground: '#f4f0e8',
    stripe: 'rgba(62, 52, 40, 0.04)',
    hover: 'rgba(62, 52, 40, 0.06)',
    selected: 'rgba(62, 52, 40, 0.08)',
    selectedHover: 'rgba(62, 52, 40, 0.12)',
  },
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
  status: {
    draft: '#facc15',
    cancellation: '#d97706',
  },
  chat: {
    well: '#f7f3ec',
    header: '#f3f6f5',
    received: '#e2dfd6',
    receivedForeground: '#2c3138',
    sent: '#3c4149',
    sentForeground: '#f4f0e8',
    selection: '#e4eef4',
    selectionBar: '#3d5f86',
    reply: '#e8f0f8',
  },
};

export const FUNCTIONAL_FONT_FAMILY = ROBOTO_FIGURE.fontFamily;
