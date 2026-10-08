import { useEffect, useState, type ReactNode } from 'react';
import { Box, CircularProgress, Stack, Tab, Tabs, Typography } from '@mui/material';
import DocumentoHojaFrame from './DocumentoHojaFrame';
import type { RecepcionResumenResponse, TrazabilidadOrdenCompraResponse } from '../../services/documentosService';
import { formatearFolioDocumento } from '../../utils/documentos.utils';

type Vista = 'partidas' | 'trazabilidad';

type Props = {
  detail: { data?: { documento?: any; partidas?: any[] } | null; loading: boolean };
  lines: any[];
  resumen: RecepcionResumenResponse | null;
  trazabilidad: TrazabilidadOrdenCompraResponse | null;
  trazabilidadCargando: boolean;
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

function folioDocumento(serie: string | null, numero: number | null) {
  return formatearFolioDocumento(serie ?? '', numero ?? 0);
}

function cantidad(value: number) {
  return Number(value).toLocaleString('es-MX', { maximumFractionDigits: 4 });
}

function capitalizar(value: string) {
  const texto = String(value || '').trim();
  if (!texto) return 'Borrador';
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function impuestosLinea(partida: any, currency: Intl.NumberFormat) {
  if (!Array.isArray(partida.impuestos) || partida.impuestos.length === 0) return '';
  return partida.impuestos.map((tax: any) => {
    const label = tax.nombre || tax.descripcion || tax.impuesto_id || 'Impuesto';
    const rate = tax.tasa == null || String(label).includes('%') ? '' : ` ${tax.tasa}%`;
    return `${label}${rate}: ${currency.format(Number(tax.monto || 0))}`;
  }).join(' · ');
}

export default function OrdenCompraDocumentoHoja({
  detail,
  lines,
  resumen,
  trazabilidad,
  trazabilidadCargando,
  tokens,
  currency,
  folio,
  provider,
  date,
  status,
  formatDate,
}: Props) {
  const [vista, setVista] = useState<Vista>('partidas');
  useEffect(() => { setVista('partidas'); }, [folio]);

  const documento = detail.data?.documento;
  const avancePorPartida = new Map((resumen?.partidas ?? []).map((partida) => [Number(partida.partida_oc_id), partida]));
  const tabular = { fontVariantNumeric: 'tabular-nums' as const };

  return (
    <>
      <Tabs
        value={vista}
        onChange={(_event, value: Vista) => setVista(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          px: 1.5,
          minHeight: 46,
          borderBottom: `1px solid ${tokens.content.border}`,
          '& .MuiTab-root': { minHeight: 46, textTransform: 'none', fontWeight: 650, fontSize: 14, color: tokens.content.muted },
          '& .Mui-selected': { color: tokens.content.foreground },
          '& .MuiTabs-indicator': { height: 2, borderRadius: 2, backgroundColor: tokens.content.foreground },
        }}
      >
        <Tab value="partidas" label="Partidas" />
        <Tab value="trazabilidad" label="Trazabilidad" />
      </Tabs>

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

      {vista === 'partidas' ? (
        <>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <Box sx={{ overflowY: 'auto', border: `1px solid ${tokens.content.border}` }}>
              {detail.loading ? <CircularProgress size={14} sx={{ m: 1 }} /> : lines.length === 0 ? (
                <Typography variant="caption" sx={{ display: 'block', px: 1, py: 0.75, color: tokens.content.muted }}>Sin partidas</Typography>
              ) : lines.map((partida, index) => {
                const avance = avancePorPartida.get(Number(partida.id));
                const impuestos = impuestosLinea(partida, currency);
                const ordenado = avance ? cantidad(avance.cantidad_ordenada) : '—';
                const recibido = avance ? cantidad(avance.cantidad_recibida) : '—';
                const pendiente = avance ? cantidad(avance.cantidad_pendiente) : '—';
                const pendienteActivo = Boolean(avance && avance.cantidad_pendiente > 0.000001);
                const totalLinea = Number(partida.total_partida ?? partida.subtotal_partida ?? 0);
                return (
                  <Box key={partida.id} sx={{ px: 1, py: 0.5, borderBottom: index < lines.length - 1 ? `1px solid ${tokens.content.border}` : 'none' }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Typography sx={{ fontSize: 12.5 }}>{partida.producto_descripcion || partida.descripcion_alterna || '—'}</Typography>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 700, ...tabular }}>{currency.format(totalLinea)}</Typography>
                    </Stack>
                    <Typography variant="caption" sx={{ display: 'block' }}>{partida.producto_clave || 'Sin clave'}</Typography>
                    <Typography sx={{ display: 'block', mt: 0.35, fontSize: 12, ...tabular }}>
                      Ordenado {ordenado}
                      <Box component="span" sx={{ mx: 1.25 }}>Recibido {recibido}</Box>
                      <Box component="span" sx={{ fontWeight: pendienteActivo ? 700 : 400, color: pendienteActivo ? tokens.content.foreground : tokens.content.muted }}>
                        Pendiente {pendiente}
                      </Box>
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: tokens.content.muted, ...tabular }}>
                      {currency.format(Number(partida.precio_unitario || 0))} × {cantidad(Number(partida.cantidad || 0))}
                      {impuestos ? ` · ${impuestos}` : ''}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
          <Stack alignItems="flex-end" sx={{ pt: 1, mt: 1, borderTop: `1px solid ${tokens.content.border}` }}>
            <Typography variant="caption" sx={tabular}>Subtotal {currency.format(Number(documento?.subtotal || 0))}</Typography>
            <Typography variant="caption" sx={tabular}>IVA trasladado {currency.format(Number(documento?.iva || 0))}</Typography>
            <Typography variant="figure" sx={{ fontSize: 16, borderTop: `2px solid ${tokens.content.border}`, mt: 0.25, pt: 0.25, ...tabular }}>
              Total {currency.format(Number(documento?.total || 0))}
            </Typography>
          </Stack>
        </>
      ) : (
        <Trazabilidad
          data={trazabilidad}
          cargando={trazabilidadCargando}
          tokens={tokens}
          currency={currency}
          formatDate={formatDate}
        />
      )}
      </DocumentoHojaFrame>
    </>
  );
}

function Trazabilidad({
  data,
  cargando,
  tokens,
  currency,
  formatDate,
}: {
  data: TrazabilidadOrdenCompraResponse | null;
  cargando: boolean;
  tokens: any;
  currency: Intl.NumberFormat;
  formatDate: (value: unknown) => string;
}) {
  const tabular = { fontVariantNumeric: 'tabular-nums' as const };
  if (cargando && !data) return <CircularProgress size={14} />;
  const recepciones = data?.recepciones ?? [];
  const facturas = data?.facturas ?? [];

  return (
    <Stack spacing={1.25}>
      <Seccion titulo="Recepciones" tokens={tokens}>
        {recepciones.length === 0 ? <Vacio texto="Sin recepciones" tokens={tokens} /> : recepciones.map((recepcion, index) => (
          <Box key={recepcion.id} sx={{ px: 1, py: 0.5, borderBottom: index < recepciones.length - 1 ? `1px solid ${tokens.content.border}` : 'none', opacity: recepcion.cancelada ? 0.55 : 1 }}>
            <Stack direction="row" justifyContent="space-between" spacing={1}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{folioDocumento(recepcion.serie, recepcion.numero)}</Typography>
              <Typography sx={{ fontSize: 12.5, ...tabular, textDecoration: recepcion.cancelada ? 'line-through' : 'none' }}>
                {cantidad(recepcion.unidades)} uds.
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ display: 'block', color: tokens.content.muted }}>
              {formatDate(recepcion.fecha_documento)} · {recepcion.cancelada ? 'Cancelada' : capitalizar(recepcion.estatus_documento)}
              {recepcion.cancelada ? ' · No cuenta como recibida' : ''}
            </Typography>
            <Typography sx={{ display: 'block', mt: 0.25, fontSize: 12, color: tokens.content.muted, ...tabular }}>
              {recepcion.partidas.length
                ? recepcion.partidas.map((partida) => `${partida.clave} × ${cantidad(partida.cantidad)}`).join('   ')
                : 'Sin partidas vinculadas'}
            </Typography>
          </Box>
        ))}
      </Seccion>

      <Seccion titulo="Facturas" tokens={tokens}>
        {facturas.length === 0 ? <Vacio texto="Sin facturas de compra" tokens={tokens} /> : facturas.map((factura, index) => {
          const externo = factura.serie_externa || factura.numero_externo != null
            ? folioDocumento(factura.serie_externa, factura.numero_externo)
            : '';
          const origen = factura.origen === 'recepcion'
            ? `Desde ${factura.origen_folios.map((item) => folioDocumento(item.serie, item.numero)).join(', ') || 'recepción'}`
            : 'Desde la orden';
          return (
            <Box key={factura.id} sx={{ px: 1, py: 0.5, borderBottom: index < facturas.length - 1 ? `1px solid ${tokens.content.border}` : 'none', opacity: factura.cancelada ? 0.55 : 1 }}>
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{folioDocumento(factura.serie, factura.numero)}</Typography>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, ...tabular }}>{currency.format(Number(factura.total || 0))}</Typography>
              </Stack>
              {externo ? <Typography variant="caption" sx={{ display: 'block' }}>Folio externo {externo}</Typography> : null}
              <Typography variant="caption" sx={{ display: 'block', color: tokens.content.muted }}>
                {formatDate(factura.fecha_documento)} · {factura.cancelada ? 'Cancelada' : capitalizar(factura.estatus_documento)}
              </Typography>
              <Typography sx={{ display: 'block', mt: 0.25, fontSize: 12 }}>{origen}</Typography>
            </Box>
          );
        })}
      </Seccion>
    </Stack>
  );
}

function Seccion({ titulo, tokens, children }: { titulo: string; tokens: any; children: ReactNode }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', mb: 0.5 }}>{titulo}</Typography>
      <Box sx={{ border: `1px solid ${tokens.content.border}` }}>{children}</Box>
    </Box>
  );
}

function Vacio({ texto, tokens }: { texto: string; tokens: any }) {
  return <Typography variant="caption" sx={{ display: 'block', px: 1, py: 0.75, color: tokens.content.muted }}>{texto}</Typography>;
}
