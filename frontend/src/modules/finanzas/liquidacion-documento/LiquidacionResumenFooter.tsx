import type { ReactNode } from 'react';
import { Box, Divider, LinearProgress, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { EmphasysTokens } from '../../../theme/tokens';
import type { LiquidacionConfig } from './liquidacionDocumento.copy';
import { fieldLabelSx } from './liquidacionDocumento.styles';

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

function cifraColor(tokens: EmphasysTokens, opts: { warning?: boolean | undefined; ok?: boolean | undefined; danger?: boolean | undefined }) {
  if (opts.danger) return tokens.action.destructive;
  if (opts.warning) return tokens.status.cancellation;
  if (opts.ok) return tokens.metric.applied.foreground;
  return tokens.content.foreground;
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
  const tokens = useTheme().emphasys;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={fieldLabelSx}>{label}</Typography>
      <Typography
        variant="figure"
        sx={{
          fontSize: 20,
          lineHeight: 1.15,
          color: cifraColor(tokens, { warning, ok, danger }),
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
  const tokens = useTheme().emphasys;
  const disponible = tieneExceso ? 0 : saldoPorAplicar;
  const usoPct = monto > 0
    ? Math.min(100, Math.round((Math.min(totalAplicado, monto) / monto) * 1000) / 10)
    : 0;
  const estado = tieneExceso
    ? { label: config.textos.estadoExceso, color: tokens.action.destructive }
    : faltaCuenta
      ? { label: config.textos.estadoFaltaCuenta, color: tokens.status.cancellation }
      : { label: config.textos.estadoListo, color: tokens.metric.applied.foreground };
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
        bgcolor: tokens.content.card,
        border: `1px solid ${tokens.content.border}`,
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        sx={{ px: 1.5, py: 0.85, borderBottom: `1px solid ${tokens.content.border}` }}
      >
        <Typography sx={{ color: tokens.content.foreground, fontSize: 13, fontWeight: 700 }}>
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
            <Typography sx={{ fontSize: 12, color: tokens.metric.caption }}>
              {tieneExceso ? 'Aplicado supera el monto' : 'Uso del monto'}
            </Typography>
            <Typography sx={{ fontSize: 12, color: tokens.metric.caption, fontVariantNumeric: 'tabular-nums' }}>
              {formatter.format(totalAplicado)} / {formatter.format(monto)}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={tieneExceso ? 100 : usoPct}
            sx={{
              height: 6,
              borderRadius: 999,
              bgcolor: tokens.metric.track,
              '& .MuiLinearProgress-bar': {
                borderRadius: 999,
                bgcolor: tieneExceso ? tokens.action.destructive : tokens.metric.progress,
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
