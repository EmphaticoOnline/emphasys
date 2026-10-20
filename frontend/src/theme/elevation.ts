import { activeBrand } from './brand/active.ts';
import { rgbaFromHex } from './brand/derived.ts';
import type { BrandDefinition } from './brand/types.ts';

/**
 * Tokens de elevación (sombras), en dos capas. Ver
 * docs/white-label-elevacion-audit.md.
 *
 * - `elevation`: sombras **estructurales**, de valor fijo. Usan negro,
 *   slate-900 o la tinta `#0f1626`, no representan identidad y no cambian con
 *   la marca. Se guardan como string literal porque varias usan un formato
 *   compacto (`rgba(0,0,0,0.35)`) que debe conservarse byte a byte.
 * - `brandElevation`: sombras **de identidad**, teñidas con el grafito, la
 *   tinta beige o el azul de la marca. Se derivan con `rgbaFromHex`; para
 *   Emphasys producen exactamente el string que hoy escriben los componentes.
 *
 * - `surfaceGradients` / `brandGradients`: degradados, con la misma división
 *   (estructurales fijos; el inicio de la barra de actualización sigue al azul
 *   de la marca y su final queda fijo).
 *
 * No se unifican sombras parecidas: cada token reproduce un valor actual.
 */
export const elevation = {
  /** Control sobre el rail de navegación (botón "Nuevo …" sobre `navigation.control`). */
  railControl: '0 1px 2px rgba(0,0,0,0.35)',
  /** Elemento seleccionado en el rail de navegación (`navigation.selection`). */
  railSelection: '0 1px 2px rgba(0,0,0,0.18)',
  /** Sombra mínima de tarjeta, base slate-900. */
  hairline: '0 1px 2px rgba(15, 23, 42, 0.04)',
  /** Sombra mínima de tarjeta, base negra (convive con `hairline`; no se unifican). */
  hairlineBlack: '0 1px 2px rgba(0,0,0,0.04)',
  /** Tarjeta de lista móvil. */
  card: '0 8px 20px rgba(15, 23, 42, 0.05)',
  /** Botón flotante móvil secundario ("atrás"). */
  floatingButton: '0 6px 18px rgba(15, 23, 42, 0.08)',
  /** Menú contextual de grids. */
  gridMenu: '0 14px 34px rgba(15, 23, 42, 0.14)',
  /** Resumen flotante de documento. */
  floatingSummary: '0 12px 30px rgba(15, 23, 42, 0.12)',
  /** Resumen flotante arrastrable, en reposo. */
  draggable: '0 12px 32px rgba(15,22,38,0.18)',
  /** Resumen flotante arrastrable, mientras se arrastra. */
  dragging: '0 20px 46px rgba(15,22,38,0.30)',
  /** Drawer de actualización. */
  drawer: '0 18px 48px rgba(15, 23, 42, 0.18)',
  /** Botón de cierre del drawer de actualización. */
  drawerButton: '0 2px 8px rgba(15, 23, 42, 0.08)',
  /** Tarjeta de estatus activa (se combina con un anillo de color de estado). */
  statusCard: '0 8px 18px rgba(15, 23, 42, 0.08)',
  /** Tarjeta de estatus en reposo. */
  statusCardRest: '0 8px 18px rgba(15, 23, 42, 0.06)',
  /** Línea inferior sutil. */
  underline: '0 1px 0 rgba(20,28,46,0.03)',
} as const;

export type BrandElevation = {
  /** Superficie flotante: menús contextuales, FAB, acciones flotantes (grafito). */
  floating: string;
  /** Botón flotante móvil secundario sobre grafito. */
  floatingStrong: string;
  /** Diálogo del tema experimental (tinta beige). */
  dialog: string;
  /** Panel elevado (tinta beige). */
  panel: string;
  /** Desplegable de búsqueda (tinta beige). */
  dropdown: string;
  /** Resplandor de la acción primaria: FAB primario móvil (azul). */
  primaryGlow: string;
  /** Resplandor de un control activo: botón de filtros (azul). */
  activeGlow: string;
};

/** Sombras de identidad de una marca. */
export function buildBrandElevation(brand: BrandDefinition): BrandElevation {
  const { graphite, ink, blue } = brand.colors;
  return {
    floating: `0 16px 40px ${rgbaFromHex(graphite.deep, 0.18)}`,
    floatingStrong: `0 8px 18px ${rgbaFromHex(graphite.deep, 0.22)}`,
    dialog: `0 18px 48px ${rgbaFromHex(ink.primary, 0.16)}`,
    panel: `0 10px 28px ${rgbaFromHex(ink.primary, 0.08)}`,
    dropdown: `0 8px 24px ${rgbaFromHex(ink.primary, 0.12)}`,
    primaryGlow: `0 10px 24px ${rgbaFromHex(blue.base, 0.28)}`,
    activeGlow: `0 6px 16px ${rgbaFromHex(blue.base, 0.16)}`,
  };
}

/** Sombras de identidad de la marca activa. */
export const brandElevation: BrandElevation = buildBrandElevation(activeBrand);

/**
 * Degradados y patrones de superficie **estructurales**, de valor fijo.
 * Los dos degradados que ya usan tokens del tema (`grid.hover` / `grid.stripe`
 * como capa) no se tocan.
 */
export const surfaceGradients = {
  /** Fondo del panel de filtros avanzados. */
  header: 'linear-gradient(180deg, #fbfcff 0%, #f6f8fd 100%)',
  /** Rayado de sección deshabilitada (gray-500 con alfa). */
  disabledHatch:
    'repeating-linear-gradient(135deg, rgba(107,114,128,0.05) 0px, rgba(107,114,128,0.05) 6px, transparent 6px, transparent 12px)',
  /** Final de la barra de actualización: azul 500 de Tailwind, fijo (D-E2). */
  updateBarEnd: '#3b82f6',
} as const;

export type BrandGradients = {
  /** Barra superior del drawer de actualización: azul de marca → `updateBarEnd`. */
  updateBar: string;
};

/** Degradados de identidad de una marca: solo el inicio sigue a la marca. */
export function buildBrandGradients(brand: BrandDefinition): BrandGradients {
  return {
    updateBar: `linear-gradient(90deg, ${brand.colors.blue.base} 0%, ${surfaceGradients.updateBarEnd} 100%)`,
  };
}

/** Degradados de identidad de la marca activa. */
export const brandGradients: BrandGradients = buildBrandGradients(activeBrand);
