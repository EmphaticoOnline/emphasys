import './augmentation';
import { createEmphasysTheme } from './createEmphasysTheme';
import { classicTokens, experimentalTokens } from './tokens';

export const classicTheme = createEmphasysTheme(classicTokens, {
  editorialFigures: false,
  restyleSurfaces: false,
});
export const experimentalTheme = createEmphasysTheme(experimentalTokens, {
  editorialFigures: true,
  restyleSurfaces: true,
});

export const THEME_IDS = ['classic', 'experimental'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export function isThemeId(value: unknown): value is ThemeId {
  return value === 'classic' || value === 'experimental';
}

export function getThemeById(id: ThemeId) {
  return id === 'experimental' ? experimentalTheme : classicTheme;
}
