import React from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import EmpresaImpuestosDefault from '../../modules/configuracion/EmpresaImpuestosDefault';

export default function EmpresaImpuestosDefaultPage() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" fontWeight={700} color="#1d2f68">
          Impuestos por default
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Administra los impuestos predeterminados que se aplican cuando un producto no tiene impuestos configurados.
        </Typography>
      </Stack>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
        <EmpresaImpuestosDefault />
      </Paper>
    </Box>
  );
}
