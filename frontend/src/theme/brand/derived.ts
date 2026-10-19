import { activeBrand } from './active.ts';

/**
 * Colores derivados de la marca activa. Producen el mismo string que el código
 * escribía a mano (`rgba(29, 47, 104, 0.06)`, con espacios) para el default de
 * Emphasys, y siguen a una marca futura.
 */
export function rgbaFromHex(hex: string, alpha: number): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) throw new Error(`Se esperaba un hex de 6 dígitos: ${hex}`);
  const value = Number.parseInt(match[1]!, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

/** Azul de la marca activa con transparencia (sombras y bordes suaves). */
export const brandBlueAlpha = (alpha: number): string => rgbaFromHex(activeBrand.colors.blue.base, alpha);
