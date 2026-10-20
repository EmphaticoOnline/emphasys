import { Outlet, useLocation } from 'react-router-dom';
import { BrandContext } from './brand/BrandContext';
import { useEmpresaBrand } from './brand/useEmpresaBrand';
import BrandThemeProvider from './BrandThemeProvider';
import { resolveActiveThemeId } from './resolveActiveTheme';

/**
 * Aplica el tema que resuelve `resolveActiveThemeId`, con la marca de la
 * empresa activa (`useEmpresaBrand`; Emphasys en login y selección de empresa).
 * No monta CssBaseline: el de la raíz sigue siendo el único.
 */
export default function AppThemeGate() {
  const { pathname } = useLocation();
  const themeId = resolveActiveThemeId({ pathname });
  const brand = useEmpresaBrand();
  return (
    <BrandContext.Provider value={brand}>
      <BrandThemeProvider themeId={themeId}>
        <Outlet />
      </BrandThemeProvider>
    </BrandContext.Provider>
  );
}
