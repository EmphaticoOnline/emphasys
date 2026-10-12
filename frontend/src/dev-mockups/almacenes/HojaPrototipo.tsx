import { Box } from '@mui/material';
import type { ReactNode } from 'react';

/** Misma hoja que la captura de movimientos: marfil de página y superficie beige.
 *  El listado ocupa el alto. El formulario queda tan alto como sus campos. */
export function HojaPrototipo({ children, compacta = false }: { children: ReactNode; compacta?: boolean }) {
  return (
    <Box
      sx={(theme) => ({
        height: compacta ? 'auto' : 'calc(100vh - 32px)',
        minHeight: compacta ? 'calc(100vh - 32px)' : 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.emphasys.canvas.page,
        px: { xs: 1, md: 2 },
        pt: { xs: 1, md: 1.75 },
        pb: compacta ? 2 : 0,
        overflow: compacta ? 'auto' : 'hidden',
      })}
    >
      <Box
        sx={(theme) => ({
          flex: compacta ? '0 0 auto' : 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: theme.emphasys.content.background,
          border: `1px solid ${theme.emphasys.content.border}`,
          borderBottom: compacta ? `1px solid ${theme.emphasys.content.border}` : 0,
          borderRadius: compacta ? '10px' : '10px 10px 0 0',
          overflow: 'hidden',
        })}
      >
        {children}
      </Box>
    </Box>
  );
}
