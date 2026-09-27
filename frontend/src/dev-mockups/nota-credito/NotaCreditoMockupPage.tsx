import { useEffect, useState } from 'react';
import { Box, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import NotaCreditoCaptura from './NotaCreditoCaptura';
import type { Escena } from './datos';

const NAVY = '#1d2f68';

export default function NotaCreditoMockupPage() {
  const [escena, setEscena] = useState<Escena>('nueva');

  useEffect(() => {
    const previo = document.title;
    document.title = 'Nota de crédito · prototipo';
    return () => {
      document.title = previo;
    };
  }, []);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#eef1f4' }}>
      <Box sx={{ flexShrink: 0, bgcolor: '#fff', borderBottom: '1px solid #d7dde7' }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={2}
          useFlexGap
          flexWrap="wrap"
          sx={{ maxWidth: 1320, mx: 'auto', px: { xs: 1.5, md: 3 }, py: 1.15 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: NAVY }}>
              Prototipo visual
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#64748b' }}>
              Sin datos reales. El motivo se cambia en la cabecera.
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <ToggleButtonGroup
            exclusive
            size="small"
            value={escena}
            aria-label="Escena del prototipo"
            onChange={(_, value: Escena | null) => {
              if (value) setEscena(value);
            }}
            sx={{
              '& .MuiToggleButton-root': {
                textTransform: 'none',
                fontWeight: 600,
                fontSize: 13,
                px: 1.5,
                color: '#334155',
                borderColor: '#d7dde7',
                '&.Mui-selected': {
                  bgcolor: NAVY,
                  color: '#fff',
                  '&:hover': { bgcolor: '#162551' },
                },
              },
            }}
          >
            <ToggleButton value="nueva">Nueva</ToggleButton>
            <ToggleButton value="editar">Editar NC-004</ToggleButton>
            <ToggleButton value="desde-factura">Desde factura A-007</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: 1320,
          mx: 'auto',
          px: { xs: 1.5, md: 3 },
          pt: { xs: 2, md: 2.5 },
          pb: 1.5,
        }}
      >
        <NotaCreditoCaptura key={escena} escena={escena} />
      </Box>
    </Box>
  );
}
