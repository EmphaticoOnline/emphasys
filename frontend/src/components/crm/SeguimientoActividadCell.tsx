import * as React from 'react';
import { Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import type { SeguimientoChipPresentation } from '../../hooks/useSeguimientoActividades';

type SeguimientoActividadCellProps = {
  hasOportunidad: boolean;
  presentation?: SeguimientoChipPresentation | undefined;
  onOpen?: (() => void) | undefined;
  /** Override opcional de tipografía/proporciones. Por defecto usa el estilo compacto validado en Cotizaciones. */
  chipSx?: SxProps<Theme>;
  chipSize?: 'small' | 'medium';
};

// Estilo compacto del chip de "Seguimiento", validado visualmente en la grilla de
// Cotizaciones. Es el default para que Oportunidades y Cotizaciones se vean idénticas.
const DEFAULT_SEGUIMIENTO_CHIP_SX = {
  borderRadius: 1,
  fontWeight: 700,
  fontSize: 11,
  height: 22,
  px: 0.5,
};

/**
 * Chip de estado de seguimiento (Al día / Sin actividad / Vencida / Pendiente hoy) + botón
 * para abrir el drawer de actividades de la oportunidad asociada. Usado tanto en
 * OportunidadesPage como en la grilla de cotizaciones de DocumentosPage.
 */
export function SeguimientoActividadCell({ hasOportunidad, presentation, onOpen, chipSx, chipSize = 'small' }: SeguimientoActividadCellProps) {
  if (!hasOportunidad || !presentation || !onOpen) {
    return (
      <Stack direction="row" alignItems="center" justifyContent="center" sx={{ width: '100%' }}>
        <Typography variant="caption" color="text.disabled" noWrap>
          Sin oportunidad
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center" sx={{ width: '100%' }}>
      <Chip
        size={chipSize}
        label={presentation.label}
        sx={{
          maxWidth: 110,
          ...DEFAULT_SEGUIMIENTO_CHIP_SX,
          bgcolor: presentation.backgroundColor,
          color: presentation.textColor,
          borderColor: presentation.borderColor,
          ...chipSx,
        }}
      />
      <Tooltip title="Ver seguimiento">
        <IconButton
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          sx={{ color: '#1d2f68' }}
        >
          <AssignmentOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
