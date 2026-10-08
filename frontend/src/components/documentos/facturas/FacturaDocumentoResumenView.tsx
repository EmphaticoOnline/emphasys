// Vista documental LIGERA del tab "Documento" del workspace de Facturas.
// A propósito NO genera ni embebe el PDF real (eso tarda ~3s y hacía sentir
// lento el cambio entre facturas) — es una representación HTML/React con los
// datos ya disponibles en frontend, pensada para consulta rápida. El PDF
// real sigue intacto y se sigue usando tal cual en "Documento ▾ → Ver /
// Imprimir PDF / Descargar PDF".
//
// Fuentes de datos (ninguna nueva, todas ya cargadas por otras partes de la
// app):
//   - `row` (CotizacionListado): datos síncronos ya presentes en la lista
//     (folio, cliente, total, saldo, estatus, UUID, fecha de timbrado) — se
//     usan para que el encabezado aparezca de inmediato, sin esperar nada.
//   - `documento`/`partidas` (CotizacionDocumento / CotizacionPartida[]):
//     vienen del mismo fetch de detalle que ya usan las demás pestañas
//     (Resumen/Partidas/...), así que no se agrega ninguna llamada nueva —
//     solo se muestran en cuanto llegan (`partidasLoading` cubre ese
//     instante breve).
//   - Nombre del emisor: `session.empresas` (ya cargado al iniciar sesión,
//     usado hoy por el selector de empresa del topbar) — no se agrega fetch.
//
// Densidad: pensada para que una factura de 1-3 partidas quepa sin scroll
// dentro del alto del workspace. Todo el bloque (encabezado, datos
// generales, totales, fiscales) es de altura fija y compacta; solo la lista
// de Partidas es flexible y con scroll interno propio cuando hay muchas.
import React, { useMemo } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography, useTheme } from '@mui/material';
import DocumentoHojaFrame from '../DocumentoHojaFrame';
import { estadoVisualDocumento } from '../estadoVisualDocumento';
import { getStatusToneColor } from '../../status/status.semantics';
import type { CotizacionDocumento, CotizacionListado, CotizacionPartida } from '../../../types/cotizacion';
import { useSession } from '../../../session/useSession';
import { summarizeDocumentTaxes } from '../../../utils/documentTaxSummary';
import { resolverFolioVisual } from '../../../utils/documentos.utils';

type StatusOption = { value: string; label: string; color?: string; textColor?: string };

interface FacturaDocumentoResumenViewProps {
  row: CotizacionListado;
  documento: CotizacionDocumento | null;
  partidas: CotizacionPartida[] | null;
  partidasLoading: boolean;
  currency: Intl.NumberFormat;
  statusOption?: StatusOption | undefined;
  onReconcile?: () => Promise<void>;
  reconciling?: boolean;
}

export default function FacturaDocumentoResumenView({
  row,
  documento,
  partidas,
  partidasLoading,
  currency,
  statusOption,
  onReconcile,
  reconciling = false,
}: FacturaDocumentoResumenViewProps) {
  const theme = useTheme();
  const tokens = theme.emphasys;
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
        {value ?? '—'}
      </Typography>
    </Box>
  );
  const emisorNombre = useMemo(
    () => session.empresas?.find((e) => e.id === session.empresaActivaId)?.nombre ?? null,
    [session.empresas, session.empresaActivaId]
  );

  const folio = resolverFolioVisual(row, 'factura') || String(row.id);
  const esNotaDeVenta = String(row.tratamiento_impuestos ?? 'normal').trim().toLowerCase() === 'sin_iva';
  const timbrado = Boolean(row.cfdi_uuid);
  const estatus = String(row.estatus_documento ?? '').toLowerCase();

  const subtotal = documento?.subtotal ?? null;
  const descuento = (documento?.descuento_global ?? documento?.descuento ?? null);
  const iva = documento?.iva ?? null;
  const impuestosResumen = useMemo(() => summarizeDocumentTaxes(partidas), [partidas]);
  const retenciones = impuestosResumen.retenciones || Number(documento?.retencion_iva ?? 0) + Number(documento?.retencion_isr ?? 0);
  const impuestosAdicionales = impuestosResumen.lineas.filter((impuesto) => {
    const texto = `${impuesto.id} ${impuesto.nombre}`.toLowerCase();
    return !texto.includes('iva') || !['traslado', 'retencion'].includes(impuesto.tipo);
  });
  const total = documento?.total ?? row.total ?? 0;
  const saldo = Number(row.saldo ?? 0);
  const cancelacionEstado = String(documento?.cfdi_cancelacion_estado ?? row.cfdi_cancelacion_estado ?? '').trim().toLowerCase();
  const cancelacionRelevante = ['solicitada', 'pendiente', 'error', 'requiere_reconciliacion', 'cancelada', 'rechazada'].includes(cancelacionEstado);
  const puedeReconciliar = ['solicitada', 'pendiente', 'error', 'requiere_reconciliacion'].includes(cancelacionEstado);
  const cancelacionError = cancelacionEstado === 'error' || cancelacionEstado === 'requiere_reconciliacion';
  const cancelacionLabel = cancelacionEstado === 'error' || cancelacionEstado === 'requiere_reconciliacion'
    ? 'Requiere reconciliación'
    : cancelacionEstado === 'pendiente' || cancelacionEstado === 'solicitada'
      ? 'Pendiente'
      : cancelacionEstado === 'cancelada'
        ? 'Cancelada'
        : cancelacionEstado === 'rechazada' ? 'Rechazada' : '';

  return (
    <DocumentoHojaFrame>

        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5} sx={{ pb: 1, mb: 1, borderBottom: `2px solid ${tokens.content.foreground}`, flexShrink: 0 }}>
          <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 0 }}>
            <Typography variant="figure" sx={{ fontSize: 18, color: tokens.content.foreground }} noWrap>{esNotaDeVenta ? `Nota de venta · ${folio}` : folio}</Typography>
            <Typography variant="caption" sx={{ color: tokens.content.muted }} noWrap>
              {row.fecha_documento ? new Date(row.fecha_documento).toLocaleDateString('es-MX') : '—'}
            </Typography>
          </Stack>
          {statusOption ? (
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, height: 22, px: 1, borderRadius: 99, bgcolor: tokens.metric.amount.background, color: tokens.content.foreground, fontSize: 11, fontWeight: 700 }}>
              <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: getStatusToneColor(theme, estadoVisualDocumento(row).tone) }} />
              {statusOption.label}
            </Box>
          ) : null}
        </Stack>

        {estatus === 'cancelado' ? (
          <Alert severity="error" sx={{ py: 0, mb: 1, flexShrink: 0, '& .MuiAlert-message': { fontSize: 12.5 } }}>
            CFDI cancelado ante el SAT — este documento ya no tiene efectos fiscales.
          </Alert>
        ) : null}

        {/* Datos generales: emisor, receptor y fiscales en una sola cuadrícula compacta */}
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
          {field('Receptor', documento?.nombre_receptor || row.nombre_cliente)}
          {field('RFC receptor', documento?.rfc_receptor)}
          {field('Régimen fiscal', documento?.regimen_fiscal_receptor)}
          {field('Uso de CFDI', documento?.uso_cfdi)}
          {timbrado ? (
            <>
              {field('Forma de pago', documento?.forma_pago)}
              {field('Método de pago', documento?.metodo_pago)}
              {field('Fecha de timbrado', row.cfdi_fecha_timbrado ? new Date(row.cfdi_fecha_timbrado).toLocaleDateString('es-MX') : '—')}
              {field('Estado SAT', documento?.cfdi_estado_sat)}
              <Box sx={{ gridColumn: '1 / -1', minWidth: 0 }}>
                {field('Folio fiscal (UUID)', (
                  <Typography component="span" sx={{ fontSize: 11, fontWeight: 600, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {row.cfdi_uuid}
                  </Typography>
                ))}
              </Box>
            </>
          ) : (
            <Box sx={{ gridColumn: '1 / -1' }}>
              {field('CFDI', 'Sin timbrar — no cuenta con folio fiscal (UUID)')}
            </Box>
          )}
        </Box>

        {/* Partidas — única zona con scroll interno */}
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', border: `1px solid ${tokens.content.border}`, borderRadius: 1 }}>
              {partidas.map((p, idx) => (
                <Stack
                  key={p.id}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  spacing={2}
                  sx={{ px: 1, py: 0.5, borderBottom: idx < partidas.length - 1 ? `1px solid ${tokens.content.border}` : 'none' }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12.5 }} noWrap>{p.producto_descripcion || p.descripcion_alterna || '—'}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                      {p.producto_clave ? `${p.producto_clave} · ` : ''}Cant. {Number(p.cantidad || 0)} &times; {currency.format(Number(p.precio_unitario || 0))}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {currency.format(Number(p.subtotal_partida || 0))}
                  </Typography>
                </Stack>
              ))}
            </Box>
          )}
        </Box>

        {/* Cancelación y totales: ambas columnas permanecen ancladas en la franja inferior. */}
        <Stack direction="row" alignItems="flex-end" justifyContent="space-between" spacing={2} sx={{ pt: 1, mt: 1, borderTop: `1px solid ${tokens.content.border}`, flexShrink: 0 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {cancelacionRelevante ? (
              <Box sx={{ maxWidth: 360, pr: 1 }}>
                <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: tokens.status.cancellation, textTransform: 'uppercase' }}>CANCELACIÓN CFDI</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: tokens.metric.blocked.foreground }}>Estado: {cancelacionLabel}</Typography>
                {cancelacionError ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>El estado de la cancelación necesita volver a consultarse.</Typography>
                ) : cancelacionEstado === 'cancelada' || cancelacionEstado === 'rechazada' ? null : (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>La cancelación aún no ha sido confirmada por el SAT.</Typography>
                )}
                {documento?.cfdi_cancelacion_proveedor_status ? <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Estado proveedor: {documento.cfdi_cancelacion_proveedor_status}</Typography> : null}
                {puedeReconciliar && onReconcile ? (
                  <Button size="small" variant="outlined" onClick={() => { void onReconcile(); }} disabled={reconciling} startIcon={reconciling ? <CircularProgress size={14} /> : undefined} sx={{ mt: 0.75, color: tokens.metric.blocked.foreground, borderColor: tokens.status.cancellation }}>
                    {reconciling ? 'Reconciliando…' : 'Reconciliar estado'}
                  </Button>
                ) : null}
              </Box>
            ) : null}
          </Box>
          <Box sx={{ minWidth: 200, flexShrink: 0 }}>
            {subtotal != null ? (
              <Stack direction="row" justifyContent="space-between"><Typography variant="caption" color="text.secondary">Subtotal</Typography><Typography variant="caption">{currency.format(subtotal)}</Typography></Stack>
            ) : null}
            {descuento ? (
              <Stack direction="row" justifyContent="space-between"><Typography variant="caption" color="text.secondary">Descuento</Typography><Typography variant="caption">{currency.format(descuento)}</Typography></Stack>
            ) : null}
            {iva != null ? (
              <Stack direction="row" justifyContent="space-between"><Typography variant="caption" color="text.secondary">IVA trasladado</Typography><Typography variant="caption">{currency.format(iva)}</Typography></Stack>
            ) : null}
            {retenciones > 0 ? (
              <Stack direction="row" justifyContent="space-between"><Typography variant="caption" color="text.secondary">Retenciones</Typography><Typography variant="caption">-{currency.format(retenciones)}</Typography></Stack>
            ) : null}
            {impuestosAdicionales.map((impuesto) => (
              <Stack key={`${impuesto.tipo}:${impuesto.id}`} direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">{impuesto.nombre}</Typography>
                <Typography variant="caption">{impuesto.tipo === 'retencion' ? '-' : ''}{currency.format(impuesto.monto)}</Typography>
              </Stack>
            ))}
            <Stack direction="row" justifyContent="space-between" sx={{ pt: 0.25, mt: 0.25, borderTop: `2px solid ${tokens.content.border}` }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.content.foreground }}>Total</Typography>
              <Typography variant="figure" sx={{ fontSize: 16, color: tokens.content.foreground }}>{currency.format(total)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption" fontWeight={700} sx={{ color: tokens.content.muted }}>Saldo pendiente</Typography>
              <Typography variant="caption" fontWeight={700} sx={{ color: saldo > 0 ? tokens.metric.blocked.foreground : tokens.metric.applied.foreground }}>{currency.format(saldo)}</Typography>
            </Stack>
          </Box>
        </Stack>

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
