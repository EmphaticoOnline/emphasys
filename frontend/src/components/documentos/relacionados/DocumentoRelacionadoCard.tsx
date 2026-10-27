// Tarjeta de un documento relacionado (pestaña Relacionados), con el mismo
// diseño que las tarjetas del workspace del contacto. Muestra el documento
// completo; si sólo algunas partidas están vinculadas con el consultado, la
// tabla las marca.
import * as React from 'react';
import { Box, CircularProgress, Collapse, Typography, useTheme } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { DocumentoRelacionado } from '../../../types/documentoDetalle';
import type { TipoDocumento } from '../../../types/documentos.types';
import type { StatusTone } from '../../status/status.types';
import { getStatusToneColor } from '../../status/status.semantics';
import { etiquetaTipoDocumento, folioDe, useDocumentoDetalleData } from '../DocumentoDetalleContent';
import PartidasDocumentoTabla, { currency } from '../partidas/PartidasDocumentoTabla';
import { fetchAplicacionesDocumento } from '../../../services/finanzasService';
import { resolverFolioVisual } from '../../../utils/documentos.utils';
import { esCancelacionSaldoFavor } from '../aplicaciones/saldoFavor';

const dateFormatter = new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

const normalizar = (value: unknown) => String(value ?? '').trim().toLowerCase();

/** Tipos con saldo por cobrar o pagar: muestran su saldo con barra. */
const TIPOS_CON_SALDO = new Set(['factura', 'factura_compra']);

function estatusVisual(estatus: string | null | undefined): { label: string; tone: StatusTone } {
  const valor = normalizar(estatus);
  const label = estatus ? estatus.charAt(0).toUpperCase() + estatus.slice(1) : 'Sin estado';
  if (valor === 'cancelado' || valor === 'cancelada') return { label, tone: 'error' };
  if (valor === 'borrador') return { label, tone: 'draft' };
  return { label, tone: 'success' };
}

type AplicacionNota = { id: number; folio: string; monto: number; cancelacion: boolean };

/**
 * A qué documentos se aplicó una nota de crédito. Una nota generada desde una
 * factura puede aplicarse a otra; así se ve que la devolución no la liquidó.
 */
function useAplicacionesNota(documentoId: number, activo: boolean) {
  const [aplicaciones, setAplicaciones] = React.useState<AplicacionNota[] | null>(null);
  React.useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    fetchAplicacionesDocumento(documentoId)
      .then((rows) => {
        if (!vivo) return;
        setAplicaciones(rows
          .filter((row) => Number(row.documento_origen_id) === Number(documentoId))
          .map((row) => ({
            id: row.id,
            folio: resolverFolioVisual(
              { serie: row.serie, numero: row.numero, serie_externa: row.serie_externa, numero_externo: row.numero_externo },
              row.tipo_documento_destino ?? row.tipo_documento ?? '',
            ) || '—',
            monto: Number(row.monto_moneda_documento ?? row.monto ?? 0),
            // Saldo a favor cancelado: no es una aplicación a otro documento.
            cancelacion: esCancelacionSaldoFavor(row),
          })));
      })
      .catch(() => { if (vivo) setAplicaciones(null); });
    return () => { vivo = false; };
  }, [documentoId, activo]);
  return aplicaciones;
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

export default function DocumentoRelacionadoCard({ doc }: { doc: DocumentoRelacionado }) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  // Expandida por default: lo útil de Relacionados es ver las partidas.
  const [expandido, setExpandido] = React.useState(true);
  const detalle = useDocumentoDetalleData(doc.id, doc.tipo_documento as TipoDocumento, expandido);
  const cuerpoId = `relacionado-${doc.id}`;

  const tipo = normalizar(doc.tipo_documento);
  const esNotaCredito = tipo.startsWith('nota_credito');
  const aplicacionesNota = useAplicacionesNota(doc.id, esNotaCredito);
  const aplicadasNota = (aplicacionesNota ?? []).filter((aplicacion) => !aplicacion.cancelacion);
  const canceladoNota = (aplicacionesNota ?? []).filter((aplicacion) => aplicacion.cancelacion).reduce((acc, aplicacion) => acc + aplicacion.monto, 0);
  const textoAplicada = !esNotaCredito || aplicacionesNota === null
    ? null
    : [
      aplicadasNota.length === 0 ? 'Sin aplicar' : aplicadasNota.map((aplicacion) => `${aplicacion.folio} · ${currency.format(aplicacion.monto)}`).join(', '),
      canceladoNota > 0 ? `Saldo cancelado ${currency.format(canceladoNota)}` : null,
    ].filter(Boolean).join(' · ');
  const cancelado = ['cancelado', 'cancelada'].includes(normalizar(doc.estatus_documento));
  const estatus = estatusVisual(doc.estatus_documento);
  const folio = folioDe(doc.serie, doc.numero, { tipo: doc.tipo_documento, serie_externa: doc.serie_externa, numero_externo: doc.numero_externo });
  const subtotal = Number(doc.subtotal ?? doc.total ?? 0);
  const documento = detalle.data?.documento;
  const total = Number(documento?.total ?? doc.total ?? 0);
  const saldo = TIPOS_CON_SALDO.has(tipo) && documento?.saldo != null ? Number(documento.saldo) : null;
  const pagado = saldo !== null && total > 0 ? Math.min(100, Math.round((Math.max(0, total - saldo) / total) * 100)) : 0;
  const vinculadas = React.useMemo(
    () => (doc.vinculo === 'partida' ? new Set((doc.partidas ?? []).map((partida) => partida.partida_id)) : null),
    [doc.vinculo, doc.partidas],
  );

  const columnas = ['minmax(190px, 1.5fr)', 'minmax(110px, 1fr)', 'minmax(120px, 1fr)', saldo !== null ? 'minmax(120px, 1fr)' : null, textoAplicada ? 'minmax(160px, 1.4fr)' : null, 'auto']
    .filter(Boolean)
    .join(' ');
  const toggle = () => setExpandido((value) => !value);

  return (
    <Box
      sx={{
        borderRadius: 2.5,
        border: `1px solid ${tokens.content.border}`,
        bgcolor: tokens.content.background,
        overflow: 'hidden',
        // Los cancelados siguen en la cadena pero no cuentan.
        opacity: cancelado ? 0.6 : 1,
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={expandido}
        aria-controls={cuerpoId}
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
          gridTemplateColumns: { xs: '1fr 1fr', md: columnas },
          gap: { xs: 1.25, md: 2 },
          alignItems: 'center',
          '&:focus-visible': { outline: `2px solid ${tokens.action.primary}`, outlineOffset: -2 },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: tokens.content.muted }} noWrap>
            {etiquetaTipoDocumento(doc.tipo_documento)}
          </Typography>
          <Typography variant="figure" sx={{ display: 'block', fontSize: { xs: 18, md: 19 }, lineHeight: 1.1, color: tokens.content.foreground, textDecoration: cancelado ? 'line-through' : 'none' }}>
            {folio}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.5 }}>
            <Box component="span" sx={{ width: 8, height: 8, flex: '0 0 8px', borderRadius: '50%', bgcolor: getStatusToneColor(theme, estatus.tone) }} />
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.content.secondary }} noWrap>{estatus.label}</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gridColumn: { xs: '2 / 3', md: '-2 / -1' }, gridRow: 1 }}>
          <ExpandMoreIcon fontSize="small" sx={{ color: tokens.content.muted, transition: 'transform 160ms ease', transform: expandido ? 'rotate(180deg)' : 'none' }} />
        </Box>

        <Dato label="Fecha">{formatDate(doc.fecha_documento)}</Dato>
        <Dato label="Subtotal">
          <Typography variant="figure" component="span" sx={{ fontSize: 16, color: 'inherit' }}>{currency.format(subtotal)}</Typography>
        </Dato>
        {saldo !== null ? (
          <Box sx={{ minWidth: 0 }}>
            <Dato label="Saldo pendiente">
              <Typography variant="figure" component="span" sx={{ fontSize: 16, color: 'inherit' }}>{currency.format(saldo)}</Typography>
            </Dato>
            <Box sx={{ mt: 0.6, height: 3, borderRadius: 99, bgcolor: tokens.metric.track, overflow: 'hidden' }} aria-hidden>
              <Box sx={{ width: `${pagado}%`, height: '100%', bgcolor: saldo <= 0 ? tokens.metric.progressDone : tokens.metric.progress }} />
            </Box>
          </Box>
        ) : null}
        {textoAplicada ? (
          <Dato label="Aplicada a">
            <Box component="span" sx={{ display: 'block', whiteSpace: 'normal' }}>{textoAplicada}</Box>
          </Dato>
        ) : null}
      </Box>

      <Collapse in={expandido} timeout="auto" unmountOnExit>
        <Box id={cuerpoId} sx={{ px: { xs: 1.5, md: 2 }, pt: 0.5, pb: 1.25, borderTop: `1px solid ${tokens.content.border}`, bgcolor: tokens.content.well }}>
          {detalle.loading && !detalle.data ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={18} /></Box>
          ) : detalle.error ? (
            <Typography variant="body2" sx={{ py: 1.5, color: tokens.content.muted }}>{detalle.error}</Typography>
          ) : (
            <PartidasDocumentoTabla
              partidas={detalle.data?.partidas ?? []}
              totales={documento ?? { subtotal: doc.subtotal ?? null, total: doc.total }}
              vinculadas={vinculadas}
            />
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
