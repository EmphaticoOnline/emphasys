import { brandElevation, brandGradients, buildBrandElevation, buildBrandGradients, type BrandElevation, type BrandGradients } from '../elevation.ts';
import { brandTints, buildBrandTints, type BrandTints } from '../tints.ts';
import { activeBrand } from './active.ts';
import { brandBlueAlpha, rgbaFromHex } from './derived.ts';
import type { BrandDefinition } from './types.ts';

/**
 * Identidad derivada de una marca, tal como la leen los componentes con
 * `useBrand()`. Los nombres coinciden con los exports estáticos que reemplaza.
 */
export type BrandStyles = {
  activeBrand: BrandDefinition;
  brandElevation: BrandElevation;
  brandGradients: BrandGradients;
  brandTints: BrandTints;
  brandBlueAlpha: (alpha: number) => string;
};

/** La marca activa reutiliza los objetos estáticos: misma identidad, mismos valores. */
const stylesByBrand = new WeakMap<BrandDefinition, BrandStyles>([
  [activeBrand, { activeBrand, brandElevation, brandGradients, brandTints, brandBlueAlpha }],
]);

/** Identidad derivada de `brand`, construida una sola vez por objeto de marca. */
export function getBrandStyles(brand: BrandDefinition): BrandStyles {
  let styles = stylesByBrand.get(brand);
  if (!styles) {
    styles = {
      activeBrand: brand,
      brandElevation: buildBrandElevation(brand),
      brandGradients: buildBrandGradients(brand),
      brandTints: buildBrandTints(brand),
      brandBlueAlpha: (alpha: number) => rgbaFromHex(brand.colors.blue.base, alpha),
    };
    stylesByBrand.set(brand, styles);
  }
  return styles;
}
