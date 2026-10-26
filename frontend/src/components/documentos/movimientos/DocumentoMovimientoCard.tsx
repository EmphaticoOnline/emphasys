import * as React from 'react';
import { Box, CircularProgress, Collapse, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { CotizacionListado } from '../../../types/cotizacion';
import { resolverFolioVisual } from '../../../utils/documentos.utils';
import { getStatusToneColor } from '../../status/status.semantics';
import { useDocumentoDetalleData } from '../DocumentoDetalleContent';
import type { MovimientoContactoConfig } from './movimientosContacto.config';

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
const quantity = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 });
const dateFormatter = new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : dateFormatter.format(date);
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={(theme) => ({ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.emphasys.content.muted })}>
        {label}
      </Typography>
      <Box sx={(theme) => ({ mt: 0.25, fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: theme.emphasys.content.foreground, whiteSpace: 'nowrap' })}>
        {children}
      </Box>
    </Box>
  );
}

const partidasGrid = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 90px 130px 130px', columnGap: 2 } as const;

function PartidasMovimiento({ documentoId, config }: { documentoId: number; config: MovimientoContactoConfig }) {
  const detalle = useDocumentoDetalleData(documentoId, config.tipoDocumento, true);
  const partidas = detalle.data?.partidas ?? [];

  if (detalle.loading && !detalle.data) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={18} /></Box>;
  }
  if (detalle.error || partidas.length === 0) {
    return (
      <Typography variant="body2" sx={(theme) => ({ py: 1.5, color: theme.emphasys.content.muted })}>
        {detalle.error || 'Este documento no tiene partidas.'}
      </Typography>
    );
  }

  return (
    <Box>
      <Box sx={(theme) => ({ ...partidasGrid, display: { xs: 'none', md: 'grid' }, pb: 0.75, borderBottom: `1px solid ${theme.emphasys.content.border}` })}>
        {['Producto', 'Cantidad', 'Precio', 'Importe'].map((titulo, index) => (
          <Typography key={titulo} sx={(theme) => ({ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.emphasys.content.muted, textAlign: index === 0 ? 'left' : 'right' })}>
            {titulo}
          </Typography>
        ))}
      </Box>
      {partidas.map((partida) => {
        const descripcion = partida.producto_descripcion || partida.descripcion_alterna || 'Sin descripción';
        const cantidad = quantity.format(Number(partida.cantidad || 0));
        const precio = currency.format(Number(partida.precio_unitario || 0));
        const importe = currency.format(Number(partida.subtotal_partida ?? Number(partida.cantidad || 0) * Number(partida.precio_unitario || 0)));
        return (
          <Box
            key={partida.id}
            sx={(theme) => ({
              py: 0.9,
              borderBottom: `1px solid ${theme.emphasys.content.border}`,
              '&:last-of-type': { borderBottom: 0 },
              fontSize: 13.5,
              color: theme.emphasys.content.foreground,
              fontVariantNumeric: 'tabular-nums',
            })}
          >
            {/* Escritorio: columnas */}
            <Box sx={{ ...partidasGrid, display: { xs: 'none', md: 'grid' }, alignItems: 'baseline' }}>
              <Box sx={{ minWidth: 0 }}>
                {partida.producto_clave ? (
                  <Typography component="span" sx={(theme) => ({ fontSize: 12, fontWeight: 700, color: theme.emphasys.content.muted, mr: 1 })}>
                    {partida.producto_clave}
                  </Typography>
                ) : null}
                <Typography component="span" sx={{ fontSize: 13.5 }}>{descripcion}</Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>{cantidad}</Box>
              <Box sx={{ textAlign: 'right' }}>{precio}</Box>
              <Box sx={{ textAlign: 'right', fontWeight: 700 }}>{importe}</Box>
            </Box>
            {/* Móvil: apilado */}
            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{descripcion}</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 0.3, gap: 1 }}>
                <Typography sx={(theme) => ({ fontSize: 12.5, color: theme.emphasys.content.muted })}>
                  {partida.producto_clave ? `${partida.producto_clave} · ` : ''}{cantidad} × {precio}
                </Typography>
                <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{importe}</Typography>
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

type DocumentoMovimientoCardProps = {
  row: CotizacionListado;
  config: MovimientoContactoConfig;
  onAbrir: (row: CotizacionListado) => void;
};

/**
 * Tarjeta de un documento comercial/financiero (factura, cotización y, a futuro,
 * pedidos, órdenes de compra, pagos, notas de crédito…). Lo específico de cada
 * tipo vive en MovimientoContactoConfig.
 */
export default function DocumentoMovimientoCard({ row, config, onAbrir }: DocumentoMovimientoCardProps) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const [expandido, setExpandido] = React.useState(false);
  const partidasId = `partidas-${config.tipoDocumento}-${row.id}`;

  const folio = resolverFolioVisual(row, config.tipoDocumento) || `#${row.id}`;
  const estatus = config.estatus(row);
  const total = Number(row.total ?? 0);
  const saldo = Number(row.saldo ?? 0);
  const pagado = total > 0 ? Math.min(100, Math.round((Math.max(0, total - saldo) / total) * 100)) : 0;
  const fecha = formatDate(row.fecha_documento);
  const vencimiento = config.mostrarVencimiento ? formatDate(row.fecha_vencimiento) : null;

  const columnasEscritorio = [
    'minmax(170px, 1.4fr)',
    'minmax(110px, 1fr)',
    vencimiento ? 'minmax(110px, 1fr)' : null,
    'minmax(120px, 1fr)',
    config.mostrarSaldo ? 'minmax(120px, 1fr)' : null,
    'auto',
  ].filter(Boolean).join(' ');

  const toggle = () => setExpandido((value) => !value);

  return (
    <Box
      sx={{
        borderRadius: 2.5,
        border: `1px solid ${tokens.content.border}`,
        bgcolor: tokens.content.background,
        overflow: 'hidden',
        transition: 'border-color 120ms ease',
        '&:hover': { borderColor: tokens.content.muted },
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={expandido}
        aria-controls={partidasId}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggle();
          }
        }}
        sx={{
          px: { xs: 1.5, md: 2 },
          py: { xs: 1.25, md: 1.5 },
          cursor: 'pointer',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: columnasEscritorio },
          gap: { xs: 1.25, md: 2 },
          alignItems: 'center',
          '&:focus-visible': { outline: `2px solid ${tokens.action.primary}`, outlineOffset: -2 },
        }}
      >
        {/* Folio + estatus */}
        <Box sx={{ minWidth: 0, gridColumn: { xs: '1 / 2', md: 'auto' } }}>
          <Typography variant="figure" sx={{ display: 'block', fontSize: { xs: 18, md: 19 }, lineHeight: 1.1, color: tokens.content.foreground }}>
            {folio}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.5 }}>
            <Box component="span" sx={{ width: 8, height: 8, flex: '0 0 8px', borderRadius: '50%', bgcolor: getStatusToneColor(theme, estatus.tone) }} />
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.content.secondary }} noWrap>
              {estatus.label}
            </Typography>
          </Box>
        </Box>

        {/* Acciones (en móvil van arriba a la derecha) */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.25, gridColumn: { xs: '2 / 3', md: '-2 / -1' }, gridRow: { xs: 1, md: 1 } }}>
          <Tooltip title="Abrir documento">
            <IconButton
              size="small"
              aria-label={`Abrir ${folio}`}
              onClick={(event) => {
                event.stopPropagation();
                onAbrir(row);
              }}
              sx={{ color: tokens.content.muted }}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <ExpandMoreIcon
            fontSize="small"
            sx={{ color: tokens.content.muted, transition: 'transform 160ms ease', transform: expandido ? 'rotate(180deg)' : 'none' }}
          />
        </Box>

        <Dato label="Fecha">{fecha || '—'}</Dato>
        {vencimiento ? <Dato label="Vencimiento">{vencimiento}</Dato> : null}
        <Dato label="Total">
          <Typography variant="figure" component="span" sx={{ fontSize: 16, color: 'inherit' }}>{currency.format(total)}</Typography>
        </Dato>
        {config.mostrarSaldo ? (
          <Box sx={{ minWidth: 0 }}>
            <Dato label="Saldo pendiente">
              <Typography variant="figure" component="span" sx={{ fontSize: 16, color: 'inherit' }}>{currency.format(saldo)}</Typography>
            </Dato>
            <Box sx={{ mt: 0.6, height: 3, borderRadius: 99, bgcolor: tokens.metric.track, overflow: 'hidden' }} aria-hidden>
              <Box sx={{ width: `${pagado}%`, height: '100%', bgcolor: saldo <= 0 ? tokens.metric.progressDone : tokens.metric.progress }} />
            </Box>
          </Box>
        ) : null}
      </Box>

      <Collapse in={expandido} timeout="auto" unmountOnExit>
        <Box id={partidasId} sx={{ px: { xs: 1.5, md: 2 }, pt: 0.5, pb: 1.25, borderTop: `1px solid ${tokens.content.border}`, bgcolor: tokens.content.well }}>
          <PartidasMovimiento documentoId={row.id} config={config} />
        </Box>
      </Collapse>
    </Box>
  );
}
