import type { ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { useActiveBrand } from './brand/BrandContext';
import { getThemeById, type ThemeId } from './themes';

/** Aplica el tema `themeId` construido con la marca de `BrandContext`. */
export default function BrandThemeProvider({ themeId, children }: { themeId: ThemeId; children: ReactNode }) {
  const brand = useActiveBrand();
  return <ThemeProvider theme={getThemeById(themeId, brand)}>{children}</ThemeProvider>;
}
