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
import { Alert, Box, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import type { CotizacionDocumento, CotizacionListado, CotizacionPartida } from '../../../types/cotizacion';
import { useSession } from '../../../session/useSession';

type StatusOption = { value: string; label: string; color?: string; textColor?: string };

interface FacturaDocumentoResumenViewProps {
  row: CotizacionListado;
  documento: CotizacionDocumento | null;
  partidas: CotizacionPartida[] | null;
  partidasLoading: boolean;
  currency: Intl.NumberFormat;
  statusOption?: StatusOption | undefined;
}

const field = (label: string, value: React.ReactNode) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography
      component="span"
      sx={{ display: 'block', fontSize: 9, lineHeight: 1.3, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.3 }}
    >
      {label}
    </Typography>
    <Typography sx={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.35, overflowWrap: 'break-word' }}>
      {value ?? '—'}
    </Typography>
  </Box>
);

export default function FacturaDocumentoResumenView({
  row,
  documento,
  partidas,
  partidasLoading,
  currency,
  statusOption,
}: FacturaDocumentoResumenViewProps) {
  const { session } = useSession();
  const emisorNombre = useMemo(
    () => session.empresas?.find((e) => e.id === session.empresaActivaId)?.nombre ?? null,
    [session.empresas, session.empresaActivaId]
  );

  const folio = row.numero != null ? `${row.serie ?? ''}${row.numero}` : String(row.id);
  const timbrado = Boolean(row.cfdi_uuid);
  const estatus = String(row.estatus_documento ?? '').toLowerCase();

  const subtotal = documento?.subtotal ?? null;
  const descuento = (documento?.descuento_global ?? documento?.descuento ?? null);
  const iva = documento?.iva ?? null;
  const total = documento?.total ?? row.total ?? 0;
  const saldo = Number(row.saldo ?? 0);

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ border: '1px solid #e3e5ec', borderRadius: 2, p: 1.75, bgcolor: '#fff', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Encabezado — una sola línea */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5} sx={{ pb: 1, mb: 1, borderBottom: '2px solid #1d2f68', flexShrink: 0 }}>
          <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 800 }} noWrap>Factura {folio}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {row.fecha_documento ? new Date(row.fecha_documento).toLocaleDateString('es-MX') : '—'}
            </Typography>
          </Stack>
          {statusOption ? (
            <Chip
              label={statusOption.label}
              size="small"
              sx={{ height: 20, fontSize: 10.5, fontWeight: 700, bgcolor: statusOption.color || '#f3f4f6', color: statusOption.textColor || '#374151' }}
            />
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
            borderBottom: '1px solid #eef0f3',
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
          <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: 'primary.main', textTransform: 'uppercase', letterSpacing: 0.3, mb: 0.5, flexShrink: 0 }}>
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
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid #eef0f3', borderRadius: 1 }}>
              {partidas.map((p, idx) => (
                <Stack
                  key={p.id}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  spacing={2}
                  sx={{ px: 1, py: 0.5, borderBottom: idx < partidas.length - 1 ? '1px solid #f0f1f5' : 'none' }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12.5 }} noWrap>{p.producto_descripcion || p.descripcion_alterna || '—'}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                      {p.producto_clave ? `${p.producto_clave} · ` : ''}Cant. {Number(p.cantidad || 0)} &times; {currency.format(Number(p.precio_unitario || 0))}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {currency.format(Number(p.total_partida || 0))}
                  </Typography>
                </Stack>
              ))}
            </Box>
          )}
        </Box>

        {/* Totales */}
        <Stack alignItems="flex-end" sx={{ pt: 1, mt: 1, borderTop: '1px solid #eef0f3', flexShrink: 0 }}>
          <Box sx={{ minWidth: 200 }}>
            {subtotal != null ? (
              <Stack direction="row" justifyContent="space-between"><Typography variant="caption" color="text.secondary">Subtotal</Typography><Typography variant="caption">{currency.format(subtotal)}</Typography></Stack>
            ) : null}
            {descuento ? (
              <Stack direction="row" justifyContent="space-between"><Typography variant="caption" color="text.secondary">Descuento</Typography><Typography variant="caption">{currency.format(descuento)}</Typography></Stack>
            ) : null}
            {iva != null ? (
              <Stack direction="row" justifyContent="space-between"><Typography variant="caption" color="text.secondary">IVA</Typography><Typography variant="caption">{currency.format(iva)}</Typography></Stack>
            ) : null}
            <Stack direction="row" justifyContent="space-between" sx={{ pt: 0.25, mt: 0.25, borderTop: '2px solid #e3e5ec' }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 800 }} color="primary">Total</Typography>
              <Typography sx={{ fontSize: 13.5, fontWeight: 800 }} color="primary">{currency.format(total)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption" fontWeight={700} color="text.secondary">Saldo pendiente</Typography>
              <Typography variant="caption" fontWeight={700} color={saldo > 0 ? 'error.main' : 'success.main'}>{currency.format(saldo)}</Typography>
            </Stack>
          </Box>
        </Stack>

        {documento?.observaciones ? (
          <Box sx={{ pt: 1, mt: 1, borderTop: '1px solid #eef0f3', flexShrink: 0 }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: 'primary.main', textTransform: 'uppercase', letterSpacing: 0.3, mb: 0.25 }}>
              Observaciones
            </Typography>
            <Typography variant="body2" whiteSpace="pre-wrap">{documento.observaciones}</Typography>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
