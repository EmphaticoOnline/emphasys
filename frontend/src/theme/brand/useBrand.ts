import { useTheme } from '@mui/material/styles';
import { activeBrand } from './active.ts';
import { getBrandStyles, type BrandStyles } from './styles.ts';

/**
 * Marca del tema vigente y su identidad derivada (sombras, degradados, tintes).
 * Fuera de un tema de Emphasys devuelve la marca activa del build.
 */
export function useBrand(): BrandStyles {
  return useTheme().brand ?? getBrandStyles(activeBrand);
}
