import { ThemeProvider } from '@mui/material/styles';
import { Outlet, useLocation } from 'react-router-dom';
import { resolveActiveThemeId } from './resolveActiveTheme';
import { getThemeById } from './themes';

/**
 * Aplica el tema que resuelve `resolveActiveThemeId`.
 * No monta CssBaseline: el de la raíz sigue siendo el único.
 */
export default function AppThemeGate() {
  const { pathname } = useLocation();
  const themeId = resolveActiveThemeId({ pathname });
  return (
    <ThemeProvider theme={getThemeById(themeId)}>
      <Outlet />
    </ThemeProvider>
  );
}
