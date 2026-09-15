import type { ReactNode } from 'react';
import { Box, Divider, LinearProgress, Stack, Typography } from '@mui/material';
import type { LiquidacionConfig } from './liquidacionDocumento.copy';
import { LIQUIDACION_AMBER, LIQUIDACION_BORDER, LIQUIDACION_LABEL, LIQUIDACION_NAVY, fieldLabelSx } from './liquidacionDocumento.styles';

type Props = {
  config: LiquidacionConfig;
  monto: number;
  totalAplicado: number;
  saldoPorAplicar: number;
  exceso: number;
  tieneExceso: boolean;
  faltaCuenta: boolean;
  formatter: Intl.NumberFormat;
  horizontalStats?: boolean;
  actions?: ReactNode;
};

function cifraColor(opts: { warning?: boolean; ok?: boolean; danger?: boolean }) {
  if (opts.danger) return 'error.main';
  if (opts.warning) return LIQUIDACION_AMBER;
  if (opts.ok) return 'success.main';
  return LIQUIDACION_NAVY;
}

function Cifra({
  label,
  value,
  warning,
  ok,
  danger,
}: {
  label: string;
  value: string;
  warning?: boolean;
  ok?: boolean;
  danger?: boolean;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={fieldLabelSx}>{label}</Typography>
      <Typography
        sx={{
          fontSize: 16,
          fontWeight: 700,
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
          color: cifraColor({ warning, ok, danger }),
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export default function LiquidacionResumenFooter({
  config,
  monto,
  totalAplicado,
  saldoPorAplicar,
  exceso,
  tieneExceso,
  faltaCuenta,
  formatter,
  horizontalStats,
  actions,
}: Props) {
  const disponible = tieneExceso ? 0 : saldoPorAplicar;
  const usoPct = monto > 0
    ? Math.min(100, Math.round((Math.min(totalAplicado, monto) / monto) * 1000) / 10)
    : 0;
  const estado = tieneExceso
    ? { label: config.textos.estadoExceso, color: 'error.main' }
    : faltaCuenta
      ? { label: config.textos.estadoFaltaCuenta, color: LIQUIDACION_AMBER }
      : { label: config.textos.estadoListo, color: 'success.main' };
  const ayuda = tieneExceso
    ? config.textos.exceso(formatter.format(exceso))
    : faltaCuenta
      ? config.textos.ayudaFaltaCuenta
      : disponible > 0.009
        ? config.textos.ayudaDisponible
        : config.textos.ayudaCubierto;

  return (
    <Box
      sx={{
        bgcolor: '#fff',
        border: `1px solid ${LIQUIDACION_BORDER}`,
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        sx={{ px: 1.5, py: 0.85, borderBottom: `1px solid ${LIQUIDACION_BORDER}` }}
      >
        <Typography sx={{ color: LIQUIDACION_NAVY, fontSize: 13, fontWeight: 600 }}>
          Liquidación
        </Typography>
        <Typography sx={{ ml: 'auto', fontSize: 12, fontWeight: 600, color: estado.color }}>
          {estado.label}
        </Typography>
      </Stack>

      <Stack spacing={1.25} sx={{ p: 1.25 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: horizontalStats ? { xs: '1fr 1fr', sm: 'repeat(3, minmax(0, 1fr))' } : '1fr',
            gap: 1.15,
          }}
        >
          <Cifra label={config.textos.monto} value={formatter.format(monto)} />
          <Cifra
            label="Total aplicado"
            value={formatter.format(totalAplicado)}
            danger={tieneExceso}
          />
          <Cifra
            label={config.textos.saldoPorAplicar}
            value={formatter.format(disponible)}
            danger={tieneExceso}
            warning={!tieneExceso && disponible > 0.009}
            ok={!tieneExceso && disponible <= 0.009}
          />
        </Box>

        {tieneExceso ? (
          <Cifra label="Exceso" value={formatter.format(exceso)} danger />
        ) : null}

        <Box>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography sx={{ fontSize: 12, color: LIQUIDACION_LABEL }}>
              {tieneExceso ? 'Aplicado supera el monto' : 'Uso del monto'}
            </Typography>
            <Typography sx={{ fontSize: 12, color: LIQUIDACION_LABEL, fontVariantNumeric: 'tabular-nums' }}>
              {formatter.format(totalAplicado)} / {formatter.format(monto)}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={tieneExceso ? 100 : usoPct}
            sx={{
              height: 6,
              borderRadius: 999,
              bgcolor: '#e8edf3',
              '& .MuiLinearProgress-bar': {
                borderRadius: 999,
                bgcolor: tieneExceso ? 'warning.main' : LIQUIDACION_NAVY,
              },
            }}
          />
        </Box>

        {actions ? (
          <>
            <Divider />
            <Stack spacing={0.75}>
              {actions}
              <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.4 }}>
                {ayuda}
              </Typography>
            </Stack>
          </>
        ) : (
          <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.4 }}>
            {ayuda}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
