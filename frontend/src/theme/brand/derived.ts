import { rgbaFromHex } from '../color.ts';
import { activeBrand } from './active.ts';

export { rgbaFromHex, type RgbaFormat } from '../color.ts';

/**
 * Colores derivados de la marca activa. Producen el mismo string que el código
 * escribía a mano (`rgba(29, 47, 104, 0.06)`, con espacios) para el default de
 * Emphasys, y siguen a una marca futura.
 *
 * Azul de la marca activa con transparencia (sombras y bordes suaves).
 */
export const brandBlueAlpha = (alpha: number): string => rgbaFromHex(activeBrand.colors.blue.base, alpha);
