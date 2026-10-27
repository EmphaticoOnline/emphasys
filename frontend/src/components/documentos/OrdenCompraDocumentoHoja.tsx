import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import DocumentoHojaFrame from './DocumentoHojaFrame';
import { HojaFilasDescuentoGlobal, HojaPartidasLista } from './partidas/HojaPartidas';
import type { RecepcionResumenResponse } from '../../services/documentosService';

type Props = {
  detail: { data?: { documento?: any; partidas?: any[] } | null; loading: boolean };
  lines: any[];
  resumen: RecepcionResumenResponse | null;
  tokens: any;
  currency: Intl.NumberFormat;
  folio: string;
  provider: string;
  date: string;
  status: string;
  formatDate: (value: unknown) => string;
};

const ETIQUETA_RECEPCION: Record<string, string> = {
  abierta: 'Abierta',
  parcial: 'Parcial',
  cerrada: 'Cerrada',
};

export function etiquetaEstadoRecepcion(estado: string | null | undefined) {
  return ETIQUETA_RECEPCION[String(estado ?? 'abierta').toLowerCase()] ?? 'Abierta';
}

function cantidad(value: number) {
  return Number(value).toLocaleString('es-MX', { maximumFractionDigits: 4 });
}

export default function OrdenCompraDocumentoHoja({
  detail,
  lines,
  resumen,
  tokens,
  currency,
  folio,
  provider,
  date,
  status,
}: Props) {

  const documento = detail.data?.documento;
  const avancePorPartida = new Map((resumen?.partidas ?? []).map((partida) => [Number(partida.partida_oc_id), partida]));
  const tabular = { fontVariantNumeric: 'tabular-nums' as const };

  return (
    <>
      <DocumentoHojaFrame>
      <Stack direction="row" justifyContent="space-between" sx={{ pb: 1, mb: 1, borderBottom: `2px solid ${tokens.content.foreground}` }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="baseline">
            <Typography variant="figure" sx={{ fontSize: 18 }}>{folio}</Typography>
            <Typography variant="caption">{date}</Typography>
          </Stack>
          <Typography sx={{ mt: 0.6, fontSize: 15, fontFamily: 'Instrument Serif, Georgia, serif' }}>{provider}</Typography>
        </Box>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, height: 22, px: 1, borderRadius: 99, bgcolor: tokens.metric.amount.background, color: tokens.content.foreground, fontSize: 11, fontWeight: 700 }}>
          <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: tokens.metric.exhausted.foreground }} />
          {status}
        </Box>
      </Stack>

      <>
          <Box sx={{ flex: '1 0 auto' }}>
            {detail.loading ? <CircularProgress size={14} sx={{ m: 1 }} /> : lines.length === 0 ? (
              <Typography variant="caption" sx={{ display: 'block', px: 1, py: 0.75, color: tokens.content.muted }}>Sin partidas</Typography>
            ) : (
              // Importe sin IVA (cantidad × precio − descuento); el IVA va en los totales.
              <HojaPartidasLista
                partidas={lines}
                extra={(partida) => {
                  const avance = avancePorPartida.get(Number(partida.id));
                  const pendienteActivo = Boolean(avance && avance.cantidad_pendiente > 0.000001);
                  return (
                    <Typography sx={{ display: 'block', mt: 0.25, fontSize: 12, ...tabular }}>
                      Ordenado {avance ? cantidad(avance.cantidad_ordenada) : '—'}
                      <Box component="span" sx={{ mx: 1.25 }}>Recibido {avance ? cantidad(avance.cantidad_recibida) : '—'}</Box>
                      <Box component="span" sx={{ fontWeight: pendienteActivo ? 700 : 400, color: pendienteActivo ? tokens.content.foreground : tokens.content.muted }}>
                        Pendiente {avance ? cantidad(avance.cantidad_pendiente) : '—'}
                      </Box>
                    </Typography>
                  );
                }}
              />
            )}
          </Box>
          <Stack alignItems="flex-end" sx={{ pt: 1, mt: 1, borderTop: `1px solid ${tokens.content.border}` }}>
            <Box sx={{ minWidth: 220 }}>
              <HojaFilasDescuentoGlobal partidas={lines} totales={{ subtotal: documento?.subtotal ?? null, descuento_global: documento?.descuento_global ?? null }} />
            </Box>
            <Typography variant="caption" sx={tabular}>Subtotal {currency.format(Number(documento?.subtotal || 0))}</Typography>
            <Typography variant="caption" sx={tabular}>IVA trasladado {currency.format(Number(documento?.iva || 0))}</Typography>
            <Typography variant="figure" sx={{ fontSize: 16, borderTop: `2px solid ${tokens.content.border}`, mt: 0.25, pt: 0.25, ...tabular }}>
              Total {currency.format(Number(documento?.total || 0))}
            </Typography>
          </Stack>
        {documento?.observaciones ? (
          <Box sx={{ pt: 1, mt: 1, borderTop: `1px solid ${tokens.content.border}` }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: tokens.content.muted, textTransform: 'uppercase', letterSpacing: 0.3, mb: 0.25 }}>
              Observaciones
            </Typography>
            <Typography variant="body2" whiteSpace="pre-wrap">{documento.observaciones}</Typography>
          </Box>
        ) : null}
      </>
      </DocumentoHojaFrame>
    </>
  );
}
