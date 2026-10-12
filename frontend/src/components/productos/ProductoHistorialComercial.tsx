import * as React from 'react';
import { Box, IconButton, Tooltip, Typography, useMediaQuery } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { TipoDocumento } from '../../types/documentos.types';
import { getDocumentoTypeConfig } from '../../modules/documentos/documentoTypeConfig';
import {
  fetchUltimasComprasProducto,
  fetchUltimasVentasProducto,
  type ProductoHistorialFila,
  type ProductoHistorialResultado,
} from '../../services/productosService';

const LIMITE = 25;
const COLUMNAS = '96px minmax(160px, 1.55fr) minmax(132px, 1.15fr) minmax(104px, 0.72fr) minmax(96px, 0.68fr) 84px minmax(112px, 0.78fr) minmax(140px, 1.2fr)';
const ANCHO_MINIMO = 760;

const fechaFormatter = new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
const importeFormatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function numero(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatCantidad(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const negativo = value < 0;
  let texto = Math.abs(value).toString();
  if (/e/i.test(texto)) texto = Math.abs(value).toFixed(12);
  const [enteraParte, fraccion = ''] = texto.split('.');
  const entera = enteraParte || '0';
  const fraccionVisible = fraccion.slice(0, 6).replace(/0+$/, '');
  const enteraMiles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cuerpo = fraccionVisible ? `${enteraMiles}.${fraccionVisible}` : enteraMiles;
  return negativo ? `-${cuerpo}` : cuerpo;
}

function formatFecha(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return fechaFormatter.format(date);
}

function formatPrecio(value: number): string {
  const negativo = value < 0;
  return `${negativo ? '-' : ''}$${formatCantidad(Math.abs(value))}`;
}

function formatImporte(value: number): string {
  return importeFormatter.format(value);
}

function etiquetaTipo(tipo: string): string | null {
  return getDocumentoTypeConfig(tipo as TipoDocumento)?.label ?? null;
}

function signoDe(fila: ProductoHistorialFila): -1 | 1 {
  return fila.signo_comercial === -1 ? -1 : 1;
}

export default function ProductoHistorialComercial({
  productoId,
  modo,
  desde,
  hasta,
  offset,
  onDesde,
  onHasta,
  onOffset,
}: {
  productoId: number;
  modo: 'compras' | 'ventas';
  desde: string;
  hasta: string;
  offset: number;
  onDesde: (valor: string) => void;
  onHasta: (valor: string) => void;
  onOffset: (valor: number) => void;
}) {
  const compacto = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const [resultado, setResultado] = React.useState<ProductoHistorialResultado | null>(null);
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const rangoInvalido = Boolean(desde && hasta && desde > hasta);
  const contactoLabel = modo === 'compras' ? 'Proveedor' : 'Cliente';

  React.useEffect(() => {
    if (rangoInvalido) {
      setCargando(false);
      setError('La fecha inicial no puede ser posterior a la final.');
      setResultado(null);
      return undefined;
    }
    let activo = true;
    setCargando(true);
    setError(null);
    setResultado(null);
    const consulta = {
      ...(desde ? { fecha_inicio: desde } : {}),
      ...(hasta ? { fecha_fin: hasta } : {}),
      limit: LIMITE,
      offset,
    };
    const pedido = modo === 'compras'
      ? fetchUltimasComprasProducto(productoId, consulta)
      : fetchUltimasVentasProducto(productoId, consulta);
    pedido
      .then((data) => {
        if (!activo) return;
        setResultado(data);
      })
      .catch((err: unknown) => {
        if (!activo) return;
        setResultado(null);
        setError(err instanceof Error ? err.message : 'No se pudo consultar el historial');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [productoId, modo, desde, hasta, offset, rangoInvalido]);

  const filas = resultado?.filas ?? [];
  const total = resultado?.total_filas ?? 0;
  const inicio = total === 0 ? 0 : offset + 1;
  const fin = total === 0 ? 0 : Math.min(offset + filas.length, total);
  const periodo = desde || hasta;
  const cantidadTotal = numero(resultado?.cantidad_total);
  const importeTotal = numero(resultado?.importe_total);

  return (
    <Box sx={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={(theme) => ({
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'stretch',
          gap: 1,
          px: 1.25,
          py: 1,
          flexShrink: 0,
          backgroundColor: theme.emphasys.content.well,
          borderBottom: `1px solid ${theme.emphasys.content.border}`,
        })}
      >
        <CifraPeriodo
          etiqueta="Cantidad"
          valor={cantidadTotal == null ? '—' : formatCantidad(cantidadTotal)}
          detalle={periodo ? 'Del período' : 'Del historial'}
        />
        <CifraPeriodo
          etiqueta="Importe"
          valor={importeTotal == null ? '—' : formatImporte(importeTotal)}
          detalle={`Antes de impuestos · ${total} ${total === 1 ? 'partida' : 'partidas'}`}
          tono={importeTotal != null && importeTotal < 0 ? 'negativo' : 'principal'}
        />
        <Box sx={{ ml: { md: 'auto' }, display: 'flex', alignItems: 'flex-end', gap: 0.75, flexWrap: 'wrap' }}>
          <CampoFecha etiqueta="Desde" value={desde} onChange={onDesde} />
          <CampoFecha etiqueta="Hasta" value={hasta} onChange={onHasta} />
          {desde || hasta ? (
            <Box
              component="button"
              type="button"
              onClick={() => {
                onDesde('');
                onHasta('');
              }}
              sx={(theme) => ({
                height: 28,
                border: 0,
                bgcolor: 'transparent',
                color: theme.emphasys.content.secondary,
                font: 'inherit',
                fontSize: 12,
                fontWeight: 650,
                cursor: 'pointer',
                px: 0.4,
              })}
            >
              Limpiar
            </Box>
          ) : null}
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {error ? (
          <Typography sx={{ px: 1.5, py: 1.5, fontSize: 13, color: (theme) => theme.emphasys.action.destructive }}>{error}</Typography>
        ) : cargando && filas.length === 0 ? (
          <Typography sx={{ px: 1.5, py: 1.5, fontSize: 13, color: (theme) => theme.emphasys.content.muted }}>Consultando movimientos…</Typography>
        ) : filas.length === 0 ? (
          <Typography sx={{ px: 1.5, py: 1.5, fontSize: 13, color: (theme) => theme.emphasys.content.muted }}>
            {modo === 'compras' ? 'Sin compras para esta consulta.' : 'Sin ventas para esta consulta.'}
          </Typography>
        ) : compacto ? (
          filas.map((fila) => <PartidaCompacta key={fila.partida_id} fila={fila} contactoLabel={contactoLabel} />)
        ) : (
          <>
            <Box
              sx={(theme) => ({
                display: 'grid',
                gridTemplateColumns: COLUMNAS,
                columnGap: 1.15,
                alignItems: 'center',
                height: 32,
                width: '100%',
                minWidth: ANCHO_MINIMO,
                px: 1.5,
                position: 'sticky',
                top: 0,
                zIndex: 1,
                boxSizing: 'border-box',
                backgroundColor: theme.emphasys.grid.header,
                color: theme.emphasys.grid.headerForeground,
                fontSize: 10.5,
                fontWeight: 650,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
              })}
            >
              <span>Fecha</span>
              <span>{contactoLabel}</span>
              <span>Documento</span>
              <span style={{ textAlign: 'right' }}>Cantidad</span>
              <span style={{ textAlign: 'right' }}>Precio</span>
              <span style={{ textAlign: 'right' }}>Descuento</span>
              <Box component="span" sx={(theme) => ({ textAlign: 'right', fontWeight: 700, borderLeft: `1px solid ${theme.emphasys.navigation.track}`, pl: 1.1 })}>
                Importe
              </Box>
              <span>Observaciones</span>
            </Box>
            {filas.map((fila, index) => (
              <PartidaEscritorio key={fila.partida_id} fila={fila} index={index} />
            ))}
          </>
        )}
      </Box>

      <Box
        sx={(theme) => ({
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 0.5,
          px: 1,
          py: 0.35,
          borderTop: `1px solid ${theme.emphasys.content.border}`,
          backgroundColor: theme.emphasys.content.well,
        })}
      >
        <Typography sx={{ fontSize: 12, color: (theme) => theme.emphasys.content.secondary, fontVariantNumeric: 'tabular-nums', mr: 0.5 }}>
          {inicio}–{fin} de {total}
        </Typography>
        <IconButton
          size="small"
          aria-label="Página anterior"
          disabled={cargando || offset <= 0}
          onClick={() => onOffset(Math.max(0, offset - LIMITE))}
          sx={{ width: 28, height: 28 }}
        >
          <ChevronLeftIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <IconButton
          size="small"
          aria-label="Página siguiente"
          disabled={cargando || offset + LIMITE >= total}
          onClick={() => onOffset(offset + LIMITE)}
          sx={{ width: 28, height: 28 }}
        >
          <ChevronRightIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
    </Box>
  );
}

function CifraPeriodo({
  etiqueta,
  valor,
  detalle,
  tono = 'principal',
}: {
  etiqueta: string;
  valor: string;
  detalle: string;
  tono?: 'principal' | 'negativo';
}) {
  return (
    <Box sx={(theme) => ({ minWidth: 148, px: 1.15, py: 0.65, borderRadius: '10px', backgroundColor: theme.emphasys.content.elevated })}>
      <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: (theme) => theme.emphasys.content.muted }}>
        {etiqueta}
      </Typography>
      <Typography
        noWrap
        sx={(theme) => ({
          fontFamily: theme.typography.figure?.fontFamily,
          fontWeight: 700,
          fontSize: 20,
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          color: tono === 'negativo' ? theme.emphasys.action.destructive : theme.emphasys.action.primary,
        })}
      >
        {valor}
      </Typography>
      <Typography sx={{ fontSize: 11, color: (theme) => theme.emphasys.content.muted }}>{detalle}</Typography>
    </Box>
  );
}

function CampoFecha({ etiqueta, value, onChange }: { etiqueta: string; value: string; onChange: (valor: string) => void }) {
  const id = React.useId();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
      <Typography component="label" htmlFor={id} sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: (theme) => theme.emphasys.content.muted }}>
        {etiqueta}
      </Typography>
      <Box
        component="input"
        id={id}
        type="date"
        aria-label={etiqueta}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        sx={(theme) => ({
          height: 28,
          border: `1px solid ${theme.emphasys.content.border}`,
          borderRadius: '8px',
          backgroundColor: theme.emphasys.content.elevated,
          color: theme.emphasys.content.foreground,
          font: 'inherit',
          fontSize: 12,
          px: 0.75,
          colorScheme: 'light',
        })}
      />
    </Box>
  );
}

function datosPartida(fila: ProductoHistorialFila) {
  const signo = signoDe(fila);
  const esNota = signo === -1;
  const cantidad = numero(fila.cantidad);
  const precio = numero(fila.precio_unitario);
  const descuento = numero(fila.descuento);
  const subtotal = numero(fila.subtotal_partida);
  const cantidadComercial = cantidad == null ? null : cantidad * signo;
  const importeComercial = subtotal == null ? null : subtotal * signo;
  const observaciones = (fila.observaciones ?? '').trim();
  const folio = (fila.folio ?? '').trim() || '—';
  const tipo = etiquetaTipo(fila.tipo_documento);
  const contacto = (fila.contacto_nombre ?? '').trim() || '—';
  const unidad = (fila.unidad ?? '').trim();
  return { esNota, cantidadComercial, precio, descuento, importeComercial, observaciones, folio, tipo, contacto, unidad };
}

function PartidaEscritorio({ fila, index }: { fila: ProductoHistorialFila; index: number }) {
  const datos = datosPartida(fila);
  return (
    <Box
      sx={(theme) => ({
        display: 'grid',
        gridTemplateColumns: COLUMNAS,
        columnGap: 1.15,
        alignItems: 'center',
        minHeight: 32,
        width: '100%',
        minWidth: ANCHO_MINIMO,
        px: 1.5,
        boxSizing: 'border-box',
        backgroundColor: index % 2 === 0 ? theme.emphasys.content.elevated : theme.emphasys.action.wash,
        borderBottom: `1px solid ${theme.emphasys.content.border}`,
        boxShadow: datos.esNota ? `inset 3px 0 0 ${theme.emphasys.metric.blocked.foreground}` : 'none',
      })}
    >
      <Typography noWrap sx={{ fontSize: 12, lineHeight: 1.2, color: (theme) => theme.emphasys.content.secondary, fontVariantNumeric: 'tabular-nums' }}>
        {formatFecha(fila.fecha_documento)}
      </Typography>
      <Typography noWrap sx={{ fontSize: 12.5, lineHeight: 1.2, fontWeight: 650, color: (theme) => theme.emphasys.content.foreground }}>
        {datos.contacto}
      </Typography>
      <Documento fila={datos} />
      <Cantidad datos={datos} />
      <Typography sx={(theme) => ({ textAlign: 'right', fontFamily: theme.typography.figure?.fontFamily, fontSize: 13, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', color: datos.precio == null ? theme.emphasys.table.muted : theme.emphasys.content.foreground })}>
        {datos.precio == null ? '—' : formatPrecio(datos.precio)}
      </Typography>
      <Typography sx={(theme) => ({ textAlign: 'right', fontFamily: theme.typography.figure?.fontFamily, fontSize: 13, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', color: datos.descuento == null ? theme.emphasys.table.muted : theme.emphasys.content.secondary })}>
        {datos.descuento == null ? '—' : `${formatCantidad(datos.descuento)}%`}
      </Typography>
      <Typography
        sx={(theme) => ({
          textAlign: 'right',
          fontFamily: theme.typography.figure?.fontFamily,
          fontWeight: 700,
          fontSize: 15,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          color: datos.esNota ? theme.emphasys.action.destructive : theme.emphasys.action.primary,
          borderLeft: `1px solid ${theme.emphasys.content.border}`,
          pl: 1.1,
        })}
      >
        {datos.importeComercial == null ? '—' : formatImporte(datos.importeComercial)}
      </Typography>
      <Observacion texto={datos.observaciones} />
    </Box>
  );
}

function PartidaCompacta({ fila, contactoLabel }: { fila: ProductoHistorialFila; contactoLabel: string }) {
  const datos = datosPartida(fila);
  return (
    <Box
      sx={(theme) => ({
        px: 1.35,
        py: 0.9,
        borderBottom: `1px solid ${theme.emphasys.content.border}`,
        backgroundColor: theme.emphasys.content.elevated,
        boxShadow: datos.esNota ? `inset 3px 0 0 ${theme.emphasys.metric.blocked.foreground}` : 'none',
      })}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline' }}>
        <Typography sx={{ fontSize: 12, color: (theme) => theme.emphasys.content.secondary }}>{formatFecha(fila.fecha_documento)}</Typography>
        {datos.tipo ? (
          <Typography sx={(theme) => ({ fontSize: 11, fontWeight: 700, color: datos.esNota ? theme.emphasys.metric.blocked.foreground : theme.emphasys.content.muted })}>
            {datos.tipo}
          </Typography>
        ) : null}
      </Box>
      <Typography sx={{ mt: 0.2, fontSize: 13.5, fontWeight: 700, color: (theme) => theme.emphasys.content.foreground }}>{datos.contacto}</Typography>
      <Typography sx={{ fontSize: 11, color: (theme) => theme.emphasys.content.muted }}>{contactoLabel}</Typography>
      <Typography noWrap sx={(theme) => ({ mt: 0.35, fontFamily: theme.typography.figure?.fontFamily, fontSize: 15, color: theme.emphasys.content.foreground })}>
        {datos.folio}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mt: 0.75 }}>
        <Dato etiqueta="Cantidad" valor={datos.cantidadComercial == null ? '—' : `${formatCantidad(datos.cantidadComercial)}${datos.unidad ? ` ${datos.unidad}` : ''}`} tono={datos.esNota ? 'negativo' : 'fuerte'} />
        <Dato etiqueta="Precio" valor={datos.precio == null ? '—' : formatPrecio(datos.precio)} />
        <Dato etiqueta="Descuento" valor={datos.descuento == null ? '—' : `${formatCantidad(datos.descuento)}%`} />
        <Dato etiqueta="Importe" valor={datos.importeComercial == null ? '—' : formatImporte(datos.importeComercial)} tono={datos.esNota ? 'negativo' : 'fuerte'} />
      </Box>
      <Typography sx={{ mt: 0.55, fontSize: 12, color: (theme) => (datos.observaciones ? theme.emphasys.content.secondary : theme.emphasys.table.muted) }}>
        {datos.observaciones || '—'}
      </Typography>
    </Box>
  );
}

function Documento({ fila }: { fila: ReturnType<typeof datosPartida> }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.7, minWidth: 0 }}>
      <Typography noWrap sx={(theme) => ({ fontFamily: theme.typography.figure?.fontFamily, fontSize: 13.5, lineHeight: 1.15, color: theme.emphasys.content.foreground })}>
        {fila.folio}
      </Typography>
      {fila.tipo ? (
        <Typography noWrap sx={(theme) => ({ fontSize: 11, lineHeight: 1, fontWeight: fila.esNota ? 700 : 500, color: fila.esNota ? theme.emphasys.metric.blocked.foreground : theme.emphasys.content.muted })}>
          {fila.tipo}
        </Typography>
      ) : null}
    </Box>
  );
}

function Cantidad({ datos }: { datos: ReturnType<typeof datosPartida> }) {
  return (
    <Typography noWrap sx={(theme) => ({ textAlign: 'right', fontSize: 14, lineHeight: 1.15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: datos.esNota ? theme.emphasys.action.destructive : theme.emphasys.content.foreground })}>
      <Box component="span" sx={(theme) => ({ fontFamily: theme.typography.figure?.fontFamily })}>
        {datos.cantidadComercial == null ? '—' : formatCantidad(datos.cantidadComercial)}
      </Box>
      {datos.unidad && datos.cantidadComercial != null ? (
        <Box component="span" sx={(theme) => ({ ml: 0.45, fontWeight: 550, fontSize: 11, color: theme.emphasys.content.muted })}>
          {datos.unidad}
        </Box>
      ) : null}
    </Typography>
  );
}

function Observacion({ texto }: { texto: string }) {
  if (!texto) {
    return <Typography sx={{ fontSize: 12, lineHeight: 1.2, color: (theme) => theme.emphasys.table.muted }}>—</Typography>;
  }
  return (
    <Tooltip title={texto} placement="top-start">
      <Typography noWrap sx={{ fontSize: 12, lineHeight: 1.2, color: (theme) => theme.emphasys.content.secondary }}>
        {texto}
      </Typography>
    </Tooltip>
  );
}

function Dato({ etiqueta, valor, tono = 'normal' }: { etiqueta: string; valor: string; tono?: 'normal' | 'fuerte' | 'negativo' }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: (theme) => theme.emphasys.content.muted }}>
        {etiqueta}
      </Typography>
      <Typography
        noWrap
        sx={(theme) => ({
          fontFamily: theme.typography.figure?.fontFamily,
          fontSize: tono === 'normal' ? 13 : 15,
          fontWeight: tono === 'normal' ? 500 : 700,
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
          color: tono === 'negativo' ? theme.emphasys.action.destructive : tono === 'fuerte' ? theme.emphasys.action.primary : theme.emphasys.content.foreground,
        })}
      >
        {valor}
      </Typography>
    </Box>
  );
}
