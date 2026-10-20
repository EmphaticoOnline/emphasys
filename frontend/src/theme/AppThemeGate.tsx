import { Outlet, useLocation } from 'react-router-dom';
import BrandThemeProvider from './BrandThemeProvider';
import { resolveActiveThemeId } from './resolveActiveTheme';

/**
 * Aplica el tema que resuelve `resolveActiveThemeId`, con la marca activa.
 * No monta CssBaseline: el de la raíz sigue siendo el único.
 */
export default function AppThemeGate() {
  const { pathname } = useLocation();
  const themeId = resolveActiveThemeId({ pathname });
  return (
    <BrandThemeProvider themeId={themeId}>
      <Outlet />
    </BrandThemeProvider>
  );
}
