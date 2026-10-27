// Pestaña "Pagos y aplicaciones" de facturas (venta y compra): todo lo que
// bajó el saldo del documento —pagos, notas de crédito, ajustes de saldo y
// anticipos— con un resumen que cuadra desde el total hasta el saldo.
// Sólo cuenta lo que se APLICÓ a este documento: una nota de crédito generada
// desde la factura pero aplicada a otra aparece en Relacionados, no aquí.
import * as React from 'react';
import { Box, CircularProgress, Typography, useTheme } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import type { AplicacionOperacion } from '../../../types/finanzas';
import type { PagoAplicado } from '../../../types/documentoDetalle';
import { fetchAplicacionesDocumento } from '../../../services/finanzasService';
import { resolverFolioVisual } from '../../../utils/documentos.utils';
import { getStatusToneColor } from '../../status/status.semantics';
import type { StatusTone } from '../../status/status.types';
import { currency, encabezadoSx, FilaResumen, redondear } from '../partidas/PartidasDocumentoTabla';

type Grupo = 'pago' | 'nota_credito' | 'ajuste' | 'anticipo';

const ETIQUETA_GRUPO: Record<Grupo, string> = {
  pago: 'Pago',
  nota_credito: 'Nota de crédito',
  ajuste: 'Ajuste de saldo',
  anticipo: 'Anticipo',
};

const PLURAL_GRUPO: Record<Grupo, string> = {
  pago: 'Pagos',
  nota_credito: 'Notas de crédito',
  ajuste: 'Ajustes de saldo',
  anticipo: 'Anticipos',
};

const ORDEN_GRUPOS: Grupo[] = ['pago', 'anticipo', 'nota_credito', 'ajuste'];

const normalizar = (value: unknown) => String(value ?? '').trim().toLowerCase();

/** Clasifica una aplicación por el tipo del documento que la origina. */
function grupoDe(aplicacion: AplicacionOperacion): Grupo {
  const tipo = normalizar(aplicacion.tipo_documento_origen);
  if (tipo.startsWith('nota_credito')) return 'nota_credito';
  if (tipo.startsWith('ajuste_')) return 'ajuste';
  // Los anticipos se aplican desde el documento que los recibió (cotización, pedido, orden…).
  if (['cotizacion', 'pedido', 'orden_servicio', 'orden_compra'].includes(tipo)) return 'anticipo';
  return 'pago';
}

const dateFormatter = new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

function estatusVisual(estatus: string | null | undefined): { label: string; tone: StatusTone } {
  const valor = normalizar(estatus);
  const label = estatus ? estatus.charAt(0).toUpperCase() + estatus.slice(1) : '—';
  if (valor === 'cancelado' || valor === 'cancelada') return { label, tone: 'error' };
  if (valor === 'borrador') return { label, tone: 'draft' };
  return { label, tone: 'success' };
}

export default function PagosAplicacionesTab({
  documentoId,
  total,
  pagos,
  refreshKey = 0,
}: {
  documentoId: number;
  /** Cambia para volver a consultar (p. ej. después de registrar un ajuste). */
  refreshKey?: number;
  /** Total con IVA: es lo que se cobra o paga. */
  total: number;
  /** Pagos del detalle, para mostrar cuenta, forma de pago y referencia. */
  pagos?: PagoAplicado[] | null;
}) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const [aplicaciones, setAplicaciones] = React.useState<AplicacionOperacion[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let vivo = true;
    setAplicaciones(null);
    setError(null);
    fetchAplicacionesDocumento(documentoId)
      .then((rows) => { if (vivo) setAplicaciones(rows); })
      .catch((err: any) => { if (vivo) setError(err?.message || 'No se pudieron cargar las aplicaciones.'); });
    return () => { vivo = false; };
  }, [documentoId, refreshKey]);

  if (error) return <Typography variant="body2" sx={{ py: 2, color: tokens.content.muted }}>{error}</Typography>;
  if (!aplicaciones) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} /></Box>;

  // Sólo lo aplicado A este documento.
  const recibidas = aplicaciones.filter((aplicacion) => Number(aplicacion.documento_destino_id) === Number(documentoId));
  if (recibidas.length === 0) {
    return <Typography variant="body2" sx={{ py: 2, color: tokens.content.muted }}>Este documento aún no tiene pagos ni aplicaciones.</Typography>;
  }

  const pagoPorAplicacion = new Map((pagos ?? []).map((pago) => [Number(pago.id), pago]));
  const filas = recibidas.map((aplicacion) => {
    const grupo = grupoDe(aplicacion);
    const tipoContraparte = aplicacion.tipo_documento_origen ?? aplicacion.tipo_documento ?? '';
    const folio = resolverFolioVisual(
      { serie: aplicacion.serie, numero: aplicacion.numero, serie_externa: aplicacion.serie_externa, numero_externo: aplicacion.numero_externo },
      tipoContraparte,
    ) || '—';
    const pago = grupo === 'pago' ? pagoPorAplicacion.get(Number(aplicacion.id)) : undefined;
    const detalle = grupo === 'pago'
      ? [pago?.metodo_pago_nombre, pago?.cuenta_identificador, pago?.referencia ? `Ref. ${pago.referencia}` : null].filter(Boolean).join(' · ')
      : grupo === 'anticipo'
        ? `Recibido en ${folio}`
        : '';
    return {
      id: aplicacion.id,
      grupo,
      folio: grupo === 'anticipo' ? 'Anticipo' : folio,
      detalle,
      fecha: formatDate(aplicacion.fecha_aplicacion),
      estatus: estatusVisual(aplicacion.estatus_documento),
      monto: Number(aplicacion.monto_moneda_documento ?? aplicacion.monto ?? 0),
    };
  });

  const porGrupo = new Map<Grupo, number>();
  filas.forEach((fila) => porGrupo.set(fila.grupo, redondear((porGrupo.get(fila.grupo) ?? 0) + fila.monto)));
  const aplicado = redondear(filas.reduce((acc, fila) => acc + fila.monto, 0));
  const saldo = redondear(total - aplicado);

  const celdaSx = (t: Theme) => ({
    py: 0.9,
    borderBottom: `1px solid ${t.emphasys.content.border}`,
    fontSize: 13.5,
    color: t.emphasys.content.foreground,
    fontVariantNumeric: 'tabular-nums',
  });
  const titulos = ['Tipo', 'Documento', 'Aplicado el', 'Estatus', 'Importe'];

  return (
    <Box sx={{ border: `1px solid ${tokens.content.border}`, borderRadius: 2, bgcolor: tokens.content.card, px: 2, pt: 1.5, pb: 1 }}>
      {/* Escritorio */}
      <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: 'max-content minmax(0, 1fr) max-content max-content max-content' }}>
        {titulos.map((titulo, index) => (
          <Typography
            key={titulo}
            sx={(t) => ({ ...encabezadoSx(t), pb: 0.75, pl: index === 0 ? 0 : 3, borderBottom: `1px solid ${t.emphasys.content.border}`, textAlign: index === titulos.length - 1 ? 'right' : 'left', whiteSpace: 'nowrap' })}
          >
            {titulo}
          </Typography>
        ))}
        {filas.map((fila) => (
          <React.Fragment key={fila.id}>
            <Box sx={(t) => ({ ...celdaSx(t), fontWeight: 600, whiteSpace: 'nowrap' })}>{ETIQUETA_GRUPO[fila.grupo]}</Box>
            <Box sx={(t) => ({ ...celdaSx(t), pl: 3, minWidth: 0 })}>
              <Typography component="span" sx={{ fontSize: 13.5, fontWeight: 600 }}>{fila.folio}</Typography>
              {fila.detalle ? <Typography component="span" sx={{ display: 'block', fontSize: 12, color: tokens.content.muted }}>{fila.detalle}</Typography> : null}
            </Box>
            <Box sx={(t) => ({ ...celdaSx(t), pl: 3, whiteSpace: 'nowrap' })}>{fila.fecha}</Box>
            <Box sx={(t) => ({ ...celdaSx(t), pl: 3, whiteSpace: 'nowrap' })}>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }}>
                <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getStatusToneColor(theme, fila.estatus.tone) }} />
                <Typography component="span" sx={{ fontSize: 12.5, fontWeight: 700, color: tokens.content.secondary }}>{fila.estatus.label}</Typography>
              </Box>
            </Box>
            <Box sx={(t) => ({ ...celdaSx(t), pl: 3, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 })}>−{currency.format(fila.monto)}</Box>
          </React.Fragment>
        ))}
      </Box>

      {/* Móvil */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {filas.map((fila) => (
          <Box key={fila.id} sx={celdaSx}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{ETIQUETA_GRUPO[fila.grupo]} · {fila.folio}</Typography>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>−{currency.format(fila.monto)}</Typography>
            </Box>
            <Typography sx={{ fontSize: 12.5, color: tokens.content.muted }}>
              {fila.fecha} · {fila.estatus.label}{fila.detalle ? ` · ${fila.detalle}` : ''}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Resumen: total → lo aplicado por tipo → saldo */}
      <Box sx={{ ml: { xs: 0, md: 'auto' }, width: { xs: '100%', md: 340 }, pt: 1 }}>
        <FilaResumen label="Total del documento" value={currency.format(total)} />
        {ORDEN_GRUPOS.filter((grupo) => porGrupo.has(grupo)).map((grupo) => (
          <FilaResumen key={grupo} label={PLURAL_GRUPO[grupo]} value={`−${currency.format(porGrupo.get(grupo) ?? 0)}`} />
        ))}
        <FilaResumen label="Saldo" value={currency.format(saldo)} fuerte />
      </Box>
    </Box>
  );
}
