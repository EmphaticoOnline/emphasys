import { activeBrand } from './brand/active.ts';
import { rgbaFromHex } from './brand/derived.ts';
import type { BrandDefinition } from './brand/types.ts';

/**
 * Tintes de marca: colores de la marca con transparencia, nombrados por rol.
 * Ver docs/white-label-tintes-alfa-audit.md (bloque T1).
 *
 * Cada token reproduce byte a byte el literal que reemplaza para Emphasys,
 * incluido su formato: con o sin espacios y el alfa tal como estaba escrita
 * (`'0.10'`, no `0.1`). Con otra marca, siguen a su azul, beige o acento.
 *
 * No se unifican valores: roles distintos con el mismo valor (por ejemplo
 * `focusRow` y `focusPulseEnd`) son tokens separados.
 */
export type BrandTints = {
  // Azul: fila enfocada del grid de documentos (`DocumentosDesktopView`).
  /** Fila del documento recién abierto. */
  focusRow: string;
  /** Fila enfocada y seleccionada. */
  focusRowSelected: string;
  /** Fila enfocada y seleccionada, con hover. */
  focusRowSelectedHover: string;
  /** Bordes superior e inferior de la fila enfocada. */
  focusRowBorder: string;
  /** Final del pulso de "reciente". */
  focusPulseEnd: string;
  // Azul: grid de oportunidades.
  /** Fila seleccionada. */
  gridRowSelected: string;
  /** Fila seleccionada con hover. */
  gridRowSelectedHover: string;
  // Azul: partidas de cotización.
  /** Partida activa. */
  activeItem: string;
  /** Partida activa con hover. */
  activeItemHover: string;
  // Azul: drawer de actualización.
  /** Borde del drawer. */
  drawerBorder: string;
  /** Fondo del icono. */
  iconWash: string;
  // Azul: otros.
  /** Fondo de nota con borde de marca (reportes con IA). */
  noteSurface: string;
  /** Borde de botón delineado con texto en azul de marca (resumen flotante). */
  outlineButtonBorder: string;
  // Beige sobre cromado grafito (tesorería).
  /** Separador de columna sobre encabezado grafito. */
  onChromeSeparator: string;
  /** Icono atenuado sobre grafito. */
  onChromeMutedIcon: string;
  // Acento.
  /** Fondo de etiqueta con texto en el acento de marca. */
  accentWash: string;
};

export function buildBrandTints(brand: BrandDefinition): BrandTints {
  const { blue, beige, accent } = brand.colors;
  return {
    focusRow: rgbaFromHex(blue.base, '0.10'),
    focusRowSelected: rgbaFromHex(blue.base, '0.16'),
    focusRowSelectedHover: rgbaFromHex(blue.base, '0.20'),
    focusRowBorder: rgbaFromHex(blue.base, '0.24'),
    focusPulseEnd: rgbaFromHex(blue.base, '0.10'),
    gridRowSelected: rgbaFromHex(blue.base, '0.08'),
    gridRowSelectedHover: rgbaFromHex(blue.base, '0.12'),
    activeItem: rgbaFromHex(blue.base, '0.06'),
    activeItemHover: rgbaFromHex(blue.base, '0.08'),
    drawerBorder: rgbaFromHex(blue.base, '0.16'),
    iconWash: rgbaFromHex(blue.base, '0.08'),
    noteSurface: rgbaFromHex(blue.base, '0.05', 'compact'),
    outlineButtonBorder: rgbaFromHex(blue.base, '0.5', 'compact'),
    onChromeSeparator: rgbaFromHex(beige.base, '0.55'),
    onChromeMutedIcon: rgbaFromHex(beige.base, '0.72', 'compact'),
    accentWash: rgbaFromHex(accent, '0.1', 'compact'),
  };
}

/** Tintes de la marca activa. */
export const brandTints: BrandTints = buildBrandTints(activeBrand);
