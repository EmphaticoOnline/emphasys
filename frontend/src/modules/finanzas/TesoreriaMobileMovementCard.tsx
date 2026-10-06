import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockIcon from '@mui/icons-material/Lock';
import SourceOutlinedIcon from '@mui/icons-material/SourceOutlined';
import type { FinanzasOperacion } from '../../types/finanzas';
import { origenMovimiento } from './origenMovimiento';
import { importeMovimiento, lineasMovimiento } from './tesoreriaMobilePresentacion';

const CAJA_ICONO = {
  boxSizing: 'border-box',
  width: 18,
  height: 18,
  minWidth: 18,
  minHeight: 18,
  p: 0,
  m: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
  flex: '0 0 18px',
} as const;

const GLIFO_ICONO = {
  display: 'block',
  width: 16,
  height: 16,
  fontSize: 16,
} as const;

type Props = {
  operacion: FinanzasOperacion;
  moneda: string;
  onOpen: (operacion: FinanzasOperacion) => void;
  onOpenOrigen: (ruta: string) => void;
};

function adjuntosDe(operacion: FinanzasOperacion): number {
  return Number((operacion as FinanzasOperacion & { adjuntos_count?: number }).adjuntos_count) || 0;
}

export function TesoreriaMobileMovementCard({ operacion, moneda, onOpen, onOpenOrigen }: Props) {
  const tokens = useTheme().emphasys;
  const { principal, concepto, nota } = lineasMovimiento(operacion);
  const importe = importeMovimiento(operacion, moneda);
  const estado = String(operacion.estado_conciliacion || 'pendiente');
  const conciliado = estado === 'conciliado';
  const cotejado = estado === 'cotejado';
  const tituloEstado = conciliado ? 'Conciliado' : cotejado ? 'Encontrado en banco' : '';
  const origen = origenMovimiento(operacion);
  const adjuntos = adjuntosDe(operacion);
  const muestraEstado = conciliado || cotejado;
  const muestraIndicadores = muestraEstado || adjuntos > 0 || Boolean(origen);

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`${principal}, ${importe.texto}`}
      onClick={() => onOpen(operacion)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(operacion);
        }
      }}
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.45,
        px: 2,
        py: 1.35,
        border: 0,
        borderBottom: `1px solid ${tokens.content.border}`,
        bgcolor: 'transparent',
        color: 'inherit',
        font: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        '&:active': { bgcolor: tokens.content.hover },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
        <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 15.5, fontWeight: 600, lineHeight: 1.25, color: tokens.content.foreground }}>
          {principal}
        </Typography>
        <Typography
          variant="figure"
          sx={{
            flex: '0 0 auto',
            minWidth: 104,
            textAlign: 'right',
            fontSize: 17,
            lineHeight: 1.1,
            fontWeight: 600,
            color: importe.retiro ? tokens.content.foreground : tokens.metric.applied.foreground,
          }}
        >
          {importe.texto}
        </Typography>
      </Box>

      {concepto ? (
        <Box
          component="span"
          sx={{
            alignSelf: 'flex-start',
            maxWidth: '78%',
            px: 0.75,
            py: 0.15,
            borderRadius: '6px',
            bgcolor: tokens.content.hover,
            color: tokens.content.secondary,
            fontSize: 11.5,
            fontWeight: 600,
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {concepto}
        </Box>
      ) : nota ? (
        <Typography noWrap sx={{ maxWidth: '78%', fontSize: 12.5, lineHeight: 1.3, color: tokens.content.muted }}>
          {nota}
        </Typography>
      ) : null}

      {muestraIndicadores ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', mt: 0.1 }}>
          {muestraEstado ? (
            <Tooltip title={tituloEstado} placement="top" arrow>
              <Box sx={CAJA_ICONO} aria-label={tituloEstado}>
                {conciliado
                  ? <LockIcon sx={{ ...GLIFO_ICONO, color: tokens.content.secondary }} />
                  : <CheckCircleIcon sx={{ ...GLIFO_ICONO, color: tokens.metric.exhausted.foreground }} />}
              </Box>
            </Tooltip>
          ) : null}
          {adjuntos > 0 ? (
            <Tooltip title={adjuntos === 1 ? '1 adjunto' : `${adjuntos} adjuntos`} placement="top" arrow>
              <Box sx={{ ...CAJA_ICONO, color: tokens.content.secondary }} aria-label={adjuntos === 1 ? '1 adjunto' : `${adjuntos} adjuntos`}>
                <AttachFileIcon sx={GLIFO_ICONO} />
              </Box>
            </Tooltip>
          ) : null}
          {origen ? (
            <Tooltip title={origen.titulo} placement="top" arrow>
              {origen.ruta ? (
                <Box
                  component="button"
                  type="button"
                  aria-label={origen.titulo}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenOrigen(origen.ruta!);
                  }}
                  sx={{
                    ...CAJA_ICONO,
                    border: 0,
                    bgcolor: 'transparent',
                    color: tokens.content.secondary,
                    cursor: 'pointer',
                    font: 'inherit',
                    p: 0,
                  }}
                >
                  <SourceOutlinedIcon sx={GLIFO_ICONO} />
                </Box>
              ) : (
                <Box component="span" aria-label={origen.titulo} sx={{ ...CAJA_ICONO, color: tokens.content.muted }}>
                  <SourceOutlinedIcon sx={GLIFO_ICONO} />
                </Box>
              )}
            </Tooltip>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
