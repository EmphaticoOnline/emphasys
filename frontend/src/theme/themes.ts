import type { Theme } from '@mui/material/styles';
import './augmentation.ts';
import { activeBrand } from './brand/active.ts';
import type { BrandDefinition } from './brand/types.ts';
import { createEmphasysTheme } from './createEmphasysTheme.ts';
import { buildClassicTokens, buildExperimentalTokens, classicTokens, experimentalTokens } from './tokens.ts';

export const THEME_IDS = ['classic', 'experimental'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export function isThemeId(value: unknown): value is ThemeId {
  return value === 'classic' || value === 'experimental';
}

const THEME_OPTIONS: Record<ThemeId, Parameters<typeof createEmphasysTheme>[1]> = {
  classic: { editorialFigures: false, restyleSurfaces: false },
  experimental: { editorialFigures: true, restyleSurfaces: true },
};

export const classicTheme = createEmphasysTheme(classicTokens, THEME_OPTIONS.classic);
export const experimentalTheme = createEmphasysTheme(experimentalTokens, THEME_OPTIONS.experimental);

/**
 * Temas ya construidos por marca. La clave es el objeto de marca: quien arma una
 * marca en tiempo de ejecución (p. ej. por empresa) debe conservar la misma
 * instancia mientras no cambien sus colores, para que el tema no se reconstruya.
 * La marca activa reutiliza los temas exportados arriba.
 */
const themesByBrand = new WeakMap<BrandDefinition, Partial<Record<ThemeId, Theme>>>([
  [activeBrand, { classic: classicTheme, experimental: experimentalTheme }],
]);

const buildTokens = { classic: buildClassicTokens, experimental: buildExperimentalTokens };

/** Tema MUI de `id` para `brand`, construido una sola vez por marca. */
export function getThemeById(id: ThemeId, brand: BrandDefinition = activeBrand): Theme {
  let themes = themesByBrand.get(brand);
  if (!themes) {
    themes = {};
    themesByBrand.set(brand, themes);
  }
  return (themes[id] ??= createEmphasysTheme(buildTokens[id](brand), THEME_OPTIONS[id]));
}
