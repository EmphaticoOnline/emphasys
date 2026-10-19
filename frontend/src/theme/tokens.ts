import { activeBrand } from './brand/active.ts';
import { rgbaFromHex } from './color.ts';
import type { BrandDefinition } from './brand/types.ts';
import { classicFunctionalTokens, experimentalFunctionalTokens } from './functional.ts';

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
  workspaceRail: {
    background: string;
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

/**
 * Los valores de identidad (azul, grafito, beige, marfil, tinta, acento y
 * tipografías) se derivan de la marca. Los colores funcionales
 * (destructivo, info, métricas, estados) vienen de `functional.ts` y no
 * dependen de la marca. Los neutrales del clásico siguen fijos aquí.
 */
function buildStructuralFrame(brand: BrandDefinition) {
  const { graphite, ivory } = brand.colors;
  return {
    background: graphite.chrome,
    foreground: ivory.surface,
    muted: rgbaFromHex(ivory.surface, '0.62', 'compact'),
    subtle: rgbaFromHex(ivory.surface, '0.42', 'compact'),
    border: 'rgba(255,255,255,0.08)',
    selection: 'rgba(255,255,255,0.10)',
    selectionForeground: ivory.selected,
    hover: 'rgba(255,255,255,0.06)',
    accent: graphite.accent,
    control: 'rgba(255,255,255,0.08)',
    controlForeground: ivory.surface,
    controlBorder: rgbaFromHex(ivory.surface, '0.35', 'compact'),
    logoFilter: 'none',
    itemForeground: graphite.itemForeground,
  };
}

/** Tipografía definitiva del menú principal. El resto del ERP sigue en Roboto. */
export const MAIN_NAV_TYPE = {
  fontFamily: activeBrand.typography.navigation,
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

export const EDITORIAL_FIGURE_FAMILY = activeBrand.typography.editorialFigure;

export function buildClassicTokens(brand: BrandDefinition): EmphasysTokens {
  const { blue, graphite, accent } = brand.colors;
  const functional = classicFunctionalTokens;
  /**
   * Cromado del tema experimental. Fondo del sidebar y de la barra superior
   * en todas las rutas. No es el texto de contenido (ink.primary).
   */
  const chrome = graphite.chrome;
  return {
    frame: buildStructuralFrame(brand),
    navigation: {
      background: '#ffffff',
      foreground: '#1f2937',
      muted: '#6b7280',
      subtle: '#9ca3af',
      border: '#e5e7eb',
      selection: rgbaFromHex(chrome, '0.08'),
      selectionForeground: chrome,
      hover: 'rgba(15, 23, 42, 0.04)',
      accent: chrome,
      control: chrome,
      controlForeground: '#ffffff',
      summary: '#f8fafc',
      track: '#e5e7eb',
      progress: blue.base,
    },
    workspaceRail: {
      background: '#ffffff',
    },
    documentNav: {
      background: '#f6f8fa',
      border: '#e5e7eb',
      foreground: '#4b5563',
      selectedBackground: '#ffffff',
      selectedForeground: chrome,
      indicator: accent,
      hoverBackground: '#f1f3f6',
      hoverForeground: chrome,
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
      primary: blue.base,
      primaryForeground: '#ffffff',
      primaryHover: blue.hover,
      tint: blue.tint,
      wash: blue.wash,
      hoverTint: rgbaFromHex(blue.base, '0.08'),
      destructive: functional.action.destructive,
      info: functional.action.info,
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
      header: chrome,
      headerForeground: '#ffffff',
      stripe: 'rgba(0, 120, 70, 0.05)',
      hover: 'rgba(15, 23, 42, 0.04)',
      selected: rgbaFromHex(chrome, '0.08'),
      selectedHover: rgbaFromHex(chrome, '0.12'),
    },
    metric: functional.metric,
    status: functional.status,
    chat: {
      well: '#f8fafc',
      header: '#ffffff',
      received: '#f3f4f6',
      receivedForeground: '#1f2937',
      sent: blue.base,
      sentForeground: '#ffffff',
      selection: rgbaFromHex(blue.base, '0.12'),
      selectionBar: blue.base,
      reply: blue.tint,
    },
  };
}

export function buildExperimentalTokens(brand: BrandDefinition): EmphasysTokens {
  const { graphite, beige, ivory, ink } = brand.colors;
  const functional = experimentalFunctionalTokens;
  return {
    frame: buildStructuralFrame(brand),
    navigation: {
      background: graphite.chrome,
      foreground: beige.base,
      muted: rgbaFromHex(beige.base, '0.62', 'compact'),
      subtle: rgbaFromHex(beige.base, '0.42', 'compact'),
      border: 'rgba(255,255,255,0.08)',
      selection: graphite.selection,
      selectionForeground: ivory.selected,
      hover: 'rgba(255,255,255,0.06)',
      accent: beige.base,
      control: beige.base,
      controlForeground: graphite.deep,
      summary: 'rgba(255,255,255,0.08)',
      track: 'rgba(255,255,255,0.16)',
      progress: '#a9c0d6',
    },
    workspaceRail: {
      background: graphite.raised,
    },
    documentNav: {
      background: beige.base,
      border: beige.border,
      foreground: ink.muted,
      selectedBackground: ivory.selected,
      selectedForeground: ink.primary,
      indicator: ink.primary,
      hoverBackground: beige.hover,
      hoverForeground: ink.primary,
    },
    canvas: {
      page: beige.base,
      sheet: beige.base,
      border: 'transparent',
      inset: 0,
      radius: 0,
    },
    content: {
      background: ivory.surface,
      elevated: ivory.elevated,
      foreground: ink.primary,
      secondary: ink.secondary,
      muted: ink.muted,
      border: beige.border,
      hover: beige.hover,
      well: ivory.well,
      card: '#ffffff',
    },
    action: {
      primary: graphite.raised,
      primaryForeground: beige.base,
      primaryHover: graphite.deep,
      tint: beige.tint,
      wash: beige.hover,
      hoverTint: rgbaFromHex(ink.primary, '0.08'),
      destructive: functional.action.destructive,
      info: functional.action.info,
      disabled: '#c4bdb4',
    },
    table: {
      headerBg: ivory.surface,
      headerFg: ink.muted,
      line: beige.border,
      cell: ink.primary,
      muted: '#a3988c',
    },
    grid: {
      header: graphite.raised,
      headerForeground: beige.base,
      stripe: rgbaFromHex(ink.primary, '0.04'),
      hover: rgbaFromHex(ink.primary, '0.06'),
      selected: rgbaFromHex(ink.primary, '0.08'),
      selectedHover: rgbaFromHex(ink.primary, '0.12'),
    },
    metric: functional.metric,
    status: functional.status,
    chat: {
      well: '#f7f3ec',
      header: '#f3f6f5',
      received: '#e2dfd6',
      receivedForeground: graphite.deep,
      sent: graphite.raised,
      sentForeground: beige.base,
      selection: '#e4eef4',
      selectionBar: '#3d5f86',
      reply: '#e8f0f8',
    },
  };
}

export const classicTokens: EmphasysTokens = buildClassicTokens(activeBrand);

export const experimentalTokens: EmphasysTokens = buildExperimentalTokens(activeBrand);

export const FUNCTIONAL_FONT_FAMILY = activeBrand.typography.functional;
