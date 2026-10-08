import type { ReactNode } from 'react';
import { Box, useTheme } from '@mui/material';

// Contenedor del tab "Documento" de Facturas.
// Tiene que ser un bloque con ancho definido. Si la hoja (maxWidth + mx auto)
// es hija directa de un flex column, los márgenes automáticos anulan
// align-items: stretch y el ancho usado se calcula con el contenido.
export function DocumentoHojaViewport({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, width: '100%', display: 'block', overflowY: 'auto', boxSizing: 'border-box', p: { xs: 1.5, md: 2.25 } }}>
      {children}
    </Box>
  );
}

export default function DocumentoHojaFrame({ children }: { children: ReactNode }) {
  const tokens = useTheme().emphasys;
  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ border: `1px solid ${tokens.content.border}`, borderRadius: 2, p: 1.75, bgcolor: tokens.content.card, color: tokens.content.foreground, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </Box>
    </Box>
  );
}
