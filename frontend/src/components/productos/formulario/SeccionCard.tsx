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
        borderColor: (theme) => theme.emphasys.content.border,
        backgroundColor: (theme) => theme.emphasys.content.card,
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
        sx={(theme) => ({ px: 2, py: 1.25, borderBottom: `1px solid ${theme.emphasys.content.border}` })}
        spacing={1}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2" fontWeight={700} fontSize={13.5} sx={{ color: (theme) => theme.emphasys.content.foreground }}>
              {titulo}
            </Typography>
            {badge}
          </Stack>
          {subtitulo && (
            <Typography variant="caption" fontSize={11.5} sx={{ color: (theme) => theme.emphasys.content.muted }}>
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
