// Vista documental ligera del tab "Documento" del workspace de Cotizaciones.
// No genera el PDF: usa los datos de la lista y el detalle que ya carga el
// workspace. No muestra saldo ni datos de CFDI.
import React, { useMemo } from 'react';
import { HojaFilasDescuentoGlobal, HojaPartidasLista } from '../partidas/HojaPartidas';
import { Alert, Box, CircularProgress, Stack, Typography, useTheme } from '@mui/material';
import DocumentoHojaFrame from '../DocumentoHojaFrame';
import type { CotizacionDocumento, CotizacionListado, CotizacionPartida } from '../../../types/cotizacion';
import { useSession } from '../../../session/useSession';
import { resolverFolioVisual } from '../../../utils/documentos.utils';

type PresentacionEstado = { label: string; color: string; textColor: string };

interface CotizacionDocumentoResumenViewProps {
  row: CotizacionListado;
  documento: CotizacionDocumento | null;
  partidas: CotizacionPartida[] | null;
  partidasLoading: boolean;
  currency: Intl.NumberFormat;
  formatDate: (value: unknown) => string;
  agenteNombre: string;
  presentacionEstatus: PresentacionEstado;
  presentacionSeguimiento: PresentacionEstado;
}

export default function CotizacionDocumentoResumenView({
  row,
  documento,
  partidas,
  partidasLoading,
  currency,
  formatDate,
  agenteNombre,
  presentacionEstatus,
  presentacionSeguimiento,
}: CotizacionDocumentoResumenViewProps) {
  const tokens = useTheme().emphasys;
  const { session } = useSession();
  const field = (label: string, value: React.ReactNode) => (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        component="span"
        sx={{ display: 'block', fontSize: 9, lineHeight: 1.3, color: tokens.content.muted, textTransform: 'uppercase', letterSpacing: 0.3 }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.35, overflowWrap: 'break-word', color: tokens.content.foreground }}>
        {value || '—'}
      </Typography>
    </Box>
  );
  const emisorNombre = useMemo(
    () => session.empresas?.find((empresa) => empresa.id === session.empresaActivaId)?.nombre ?? null,
    [session.empresas, session.empresaActivaId]
  );
  const folio = resolverFolioVisual(row, 'cotizacion') || String(row.id);
  const estatus = String(row.estatus_documento ?? '').trim().toLowerCase();
  const subtotal = documento?.subtotal ?? row.subtotal;
  // descuento_global es un porcentaje; su monto se calcula contra la suma de partidas.
  const descuentoGlobal = documento?.descuento_global ?? row.descuento_global ?? null;
  const iva = documento?.iva ?? row.iva;
  const total = documento?.total ?? row.total ?? 0;

  return (
    <DocumentoHojaFrame>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5} sx={{ pb: 1, mb: 1, borderBottom: `2px solid ${tokens.content.foreground}`, flexShrink: 0 }}>
        <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 0 }}>
          <Typography variant="figure" sx={{ fontSize: 18, color: tokens.content.foreground }} noWrap>{folio}</Typography>
          <Typography variant="caption" sx={{ color: tokens.content.muted }} noWrap>
            {formatDate(row.fecha_documento) || '—'}
          </Typography>
        </Stack>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 22, px: 1, borderRadius: 99, bgcolor: presentacionSeguimiento.color, color: presentacionSeguimiento.textColor, fontSize: 11, fontWeight: 700 }}>
          {presentacionSeguimiento.label}
        </Box>
      </Stack>

      {estatus === 'cancelado' || estatus === 'cancelada' ? (
        <Alert severity="info" sx={{ py: 0, mb: 1, flexShrink: 0, '& .MuiAlert-message': { fontSize: 12.5 } }}>
          Cotización cancelada.
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))',
          gap: 1,
          py: 1,
          mb: 1,
          borderBottom: `1px solid ${tokens.content.border}`,
          flexShrink: 0,
        }}
      >
        {field('Emisor', emisorNombre)}
        {field('Cliente', documento?.nombre_receptor || row.nombre_cliente)}
        {field('Agente', agenteNombre || 'Sin asignar')}
        {field('Estado', presentacionEstatus.label)}
        {field('Seguimiento', presentacionSeguimiento.label)}
        {field('Vigencia', formatDate(row.fecha_vencimiento))}
        {field('Moneda', documento?.moneda || row.moneda || 'MXN')}
      </Box>

      <Box sx={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column' }}>
        <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: tokens.content.muted, textTransform: 'uppercase', letterSpacing: 0.3, mb: 0.5, flexShrink: 0 }}>
          Partidas
        </Typography>
        {partidasLoading ? (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1, flexShrink: 0 }}>
            <CircularProgress size={14} />
            <Typography variant="body2" color="text.secondary">Cargando partidas…</Typography>
          </Stack>
        ) : !partidas || partidas.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>Sin partidas.</Typography>
        ) : (
          <HojaPartidasLista partidas={partidas} />
        )}
      </Box>

      <Box sx={{ minWidth: 200, alignSelf: 'flex-end', flexShrink: 0, pt: 1, mt: 1, borderTop: `1px solid ${tokens.content.border}` }}>
        <HojaFilasDescuentoGlobal partidas={partidas ?? []} totales={{ subtotal, descuento_global: descuentoGlobal }} />
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="caption" color="text.secondary">Subtotal</Typography>
          <Typography variant="caption">{currency.format(Number(subtotal || 0))}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="caption" color="text.secondary">IVA</Typography>
          <Typography variant="caption">{currency.format(Number(iva || 0))}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between" sx={{ pt: 0.25, mt: 0.25, borderTop: `2px solid ${tokens.content.border}` }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.content.foreground }}>Total</Typography>
          <Typography variant="figure" sx={{ fontSize: 16, color: tokens.content.foreground }}>{currency.format(Number(total || 0))}</Typography>
        </Stack>
      </Box>

      {documento?.observaciones ? (
        <Box sx={{ pt: 1, mt: 1, borderTop: `1px solid ${tokens.content.border}`, flexShrink: 0 }}>
          <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: tokens.content.muted, textTransform: 'uppercase', letterSpacing: 0.3, mb: 0.25 }}>
            Observaciones
          </Typography>
          <Typography variant="body2" whiteSpace="pre-wrap">{documento.observaciones}</Typography>
        </Box>
      ) : null}
    </DocumentoHojaFrame>
  );
}
