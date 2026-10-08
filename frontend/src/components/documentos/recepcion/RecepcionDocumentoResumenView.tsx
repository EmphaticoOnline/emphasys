import { Box, CircularProgress, Stack, Typography, useTheme } from '@mui/material';
import DocumentoHojaFrame from '../DocumentoHojaFrame';
import { getStatusToneColor } from '../../status/status.semantics';
import type { CotizacionDocumento, CotizacionListado, CotizacionPartida } from '../../../types/cotizacion';
import type { StatusTone } from '../../status/status.types';

type StatusOption = { value: string; label: string; color?: string; textColor?: string };

function formatoCantidad(value: number): string {
  return Number(value).toLocaleString('es-MX', { maximumFractionDigits: 4 });
}

function etiquetaImpuesto(tax: { nombre?: string | null; descripcion?: string | null; impuesto_id?: string | null; tasa?: number | null; monto?: number | null }, currency: Intl.NumberFormat): string {
  const label = tax.nombre || tax.descripcion || tax.impuesto_id || 'Impuesto';
  const rate = tax.tasa == null || String(label).includes('%') ? '' : ` ${tax.tasa}%`;
  return `${label}${rate}: ${currency.format(Number(tax.monto || 0))}`;
}

export default function RecepcionDocumentoResumenView({
  row,
  documento,
  partidas,
  partidasLoading,
  currency,
  formatDate,
  folio,
  proveedor,
  folioOrigen,
  statusOption,
  estadoTono,
}: {
  row: CotizacionListado;
  documento: CotizacionDocumento | null;
  partidas: CotizacionPartida[] | null;
  partidasLoading: boolean;
  currency: Intl.NumberFormat;
  formatDate: (value: unknown) => string;
  folio: string;
  proveedor: string;
  folioOrigen: string | null;
  statusOption?: StatusOption | undefined;
  estadoTono: StatusTone;
}) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const subtotal = Number(documento?.subtotal ?? row.subtotal ?? 0);
  const iva = Number(documento?.iva ?? row.iva ?? 0);
  const total = Number(documento?.total ?? row.total ?? 0);
  const observaciones = String(documento?.observaciones ?? '').trim();
  const field = (label: string, value: string) => (
    <Box sx={{ minWidth: 0 }}>
      <Typography component="span" sx={{ display: 'block', fontSize: 9, lineHeight: 1.3, color: tokens.content.muted, textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.35, overflowWrap: 'break-word', color: tokens.content.foreground }}>
        {value}
      </Typography>
    </Box>
  );

  return (
    <DocumentoHojaFrame>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5} sx={{ pb: 1, mb: 1, borderBottom: `2px solid ${tokens.content.foreground}`, flexShrink: 0 }}>
        <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: tokens.content.muted }} noWrap>
            RECEPCIÓN
          </Typography>
          <Typography variant="figure" sx={{ fontSize: 18, color: tokens.content.foreground }} noWrap>
            {folio}
          </Typography>
          <Typography variant="caption" sx={{ color: tokens.content.muted }} noWrap>
            {formatDate(row.fecha_documento)}
          </Typography>
        </Stack>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, height: 22, px: 1, borderRadius: 99, bgcolor: tokens.metric.amount.background, color: tokens.content.foreground, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
          <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: getStatusToneColor(theme, estadoTono) }} />
          {statusOption?.label || 'Borrador'}
        </Box>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1, py: 1, mb: 1, borderBottom: `1px solid ${tokens.content.border}`, flexShrink: 0 }}>
        {field('Proveedor', proveedor)}
        {folioOrigen ? field('Origen', folioOrigen) : null}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: tokens.content.muted, textTransform: 'uppercase', letterSpacing: 0.3, mb: 0.5, flexShrink: 0 }}>
          Partidas recibidas
        </Typography>
        {partidasLoading ? (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1, flexShrink: 0 }}>
            <CircularProgress size={14} />
            <Typography variant="body2" color="text.secondary">Cargando partidas…</Typography>
          </Stack>
        ) : !partidas || partidas.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>Sin partidas.</Typography>
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', border: `1px solid ${tokens.content.border}`, borderRadius: 1 }}>
            {partidas.map((partida, index) => {
              const impuestos = Array.isArray(partida.impuestos) ? partida.impuestos : [];
              const totalLinea = Number(partida.total_partida ?? partida.subtotal_partida ?? 0);
              return (
                <Stack
                  key={partida.id}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  spacing={2}
                  sx={{ px: 1, py: 0.5, borderBottom: index < partidas.length - 1 ? `1px solid ${tokens.content.border}` : 'none' }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12.5, color: tokens.content.foreground }} noWrap>
                      {partida.producto_descripcion || partida.descripcion_alterna || '—'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                      {partida.producto_clave ? `${partida.producto_clave} · ` : ''}
                      Cant. {formatoCantidad(Number(partida.cantidad || 0))} × {currency.format(Number(partida.precio_unitario || 0))}
                    </Typography>
                    {impuestos.length > 0 ? (
                      <Typography variant="caption" sx={{ display: 'block', color: tokens.content.muted }}>
                        {impuestos.map((tax) => etiquetaImpuesto(tax, currency)).join(' · ')}
                      </Typography>
                    ) : null}
                  </Box>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', color: tokens.content.foreground }}>
                    {currency.format(totalLinea)}
                  </Typography>
                </Stack>
              );
            })}
          </Box>
        )}
      </Box>

      <Stack alignItems="flex-end" sx={{ pt: 1, mt: 1, borderTop: `1px solid ${tokens.content.border}`, flexShrink: 0 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ minWidth: 200 }}>
          <Typography variant="caption" color="text.secondary">Subtotal</Typography>
          <Typography variant="caption">{currency.format(subtotal)}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between" sx={{ minWidth: 200 }}>
          <Typography variant="caption" color="text.secondary">IVA</Typography>
          <Typography variant="caption">{currency.format(iva)}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between" sx={{ minWidth: 200, pt: 0.25, mt: 0.25, borderTop: `2px solid ${tokens.content.border}` }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.content.foreground }}>Total</Typography>
          <Typography variant="figure" sx={{ fontSize: 16, color: tokens.content.foreground }}>{currency.format(total)}</Typography>
        </Stack>
      </Stack>

      {observaciones ? (
        <Box sx={{ pt: 1, mt: 1, borderTop: `1px solid ${tokens.content.border}`, flexShrink: 0 }}>
          <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: tokens.content.muted, textTransform: 'uppercase', letterSpacing: 0.3, mb: 0.25 }}>
            Observaciones
          </Typography>
          <Typography variant="body2" whiteSpace="pre-wrap">{observaciones}</Typography>
        </Box>
      ) : null}
    </DocumentoHojaFrame>
  );
}
