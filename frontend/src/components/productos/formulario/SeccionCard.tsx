import * as React from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';

type SeccionCardProps = {
  id: string;
  titulo: string;
  subtitulo?: string;
  badge?: React.ReactNode;
  accion?: React.ReactNode;
  reservado?: boolean;
  children: React.ReactNode;
};

/**
 * Tarjeta blanca compacta usada por cada sección del documento continuo de
 * ProductoFormPage. `id` se usa como ancla de scroll desde el índice lateral
 * (SeccionesIndice hace document.getElementById(id)?.scrollIntoView(...)).
 */
export default function SeccionCard({ id, titulo, subtitulo, badge, accion, reservado, children }: SeccionCardProps) {
  return (
    <Paper
      id={id}
      variant="outlined"
      sx={{
        borderRadius: 1.5,
        borderColor: '#e5e7eb',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        scrollMarginTop: 12,
        ...(reservado
          ? {
              backgroundImage:
                'repeating-linear-gradient(135deg, rgba(107,114,128,0.05) 0px, rgba(107,114,128,0.05) 6px, transparent 6px, transparent 12px)',
              borderStyle: 'dashed',
            }
          : {}),
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1.25, borderBottom: '1px solid #e5e7eb' }}
        spacing={1}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2" fontWeight={700} color="#111827" fontSize={13.5}>
              {titulo}
            </Typography>
            {badge}
          </Stack>
          {subtitulo && (
            <Typography variant="caption" color="#6b7280" fontSize={11.5}>
              {subtitulo}
            </Typography>
          )}
        </Box>
        {accion && <Box sx={{ flexShrink: 0 }}>{accion}</Box>}
      </Stack>
      <Box sx={{ p: 2 }}>{children}</Box>
    </Paper>
  );
}
