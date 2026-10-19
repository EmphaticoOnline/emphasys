import { activeBrand } from './active.ts';

/**
 * Escritura del `rgba`: `spaced` → `rgba(29, 47, 104, 0.06)`; `compact` →
 * `rgba(29,47,104,0.05)`. Ambas conviven en el código y se conservan tal cual.
 * Un alfa en string (`'0.10'`) se escribe sin normalizar.
 */
export type RgbaFormat = 'spaced' | 'compact';

/**
 * Colores derivados de la marca activa. Producen el mismo string que el código
 * escribía a mano (`rgba(29, 47, 104, 0.06)`, con espacios) para el default de
 * Emphasys, y siguen a una marca futura.
 */
export function rgbaFromHex(hex: string, alpha: number | string, format: RgbaFormat = 'spaced'): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) throw new Error(`Se esperaba un hex de 6 dígitos: ${hex}`);
  if (typeof alpha === 'string' && !/^(?:0|1|0?\.\d+)$/.test(alpha)) throw new Error(`Alfa no válida: ${alpha}`);
  const value = Number.parseInt(match[1]!, 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
  return `rgba(${channels.join(format === 'compact' ? ',' : ', ')})`;
}

/** Azul de la marca activa con transparencia (sombras y bordes suaves). */
export const brandBlueAlpha = (alpha: number): string => rgbaFromHex(activeBrand.colors.blue.base, alpha);
