import * as React from 'react';
import { Box, CircularProgress, Collapse, IconButton, Typography, useTheme } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { CotizacionListado, CotizacionPartida } from '../../../types/cotizacion';
import type { AplicacionOperacion } from '../../../types/finanzas';
import { fetchAplicacionesDocumento } from '../../../services/finanzasService';
import { resolverFolioVisual, folioDocumento } from '../../../utils/documentos.utils';
import { getStatusToneColor } from '../../status/status.semantics';
import { useDocumentoDetalleData } from '../DocumentoDetalleContent';
import type { TipoDocumento } from '../../../types/documentos.types';
import { estadoVisualDocumento } from '../estadoVisualDocumento';
import type { EstatusMovimiento, MovimientoContactoConfig } from './movimientosContacto.config';
import { separarAplicaciones } from '../aplicaciones/saldoFavor';
import PartidasDocumentoTabla, {
  currency, encabezadoSx, FilaResumen, percent, porcentajeValido, quantity, redondear,
} from '../partidas/PartidasDocumentoTabla';

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

type TotalesRespaldo = Partial<Pick<CotizacionListado, 'descuento_global' | 'subtotal' | 'total'>>;

/** Partidas de cualquier documento; `respaldo` sólo se usa si el detalle no trae totales. */
function PartidasMovimiento({ documentoId, tipoDocumento, respaldo }: { documentoId: number; tipoDocumento: TipoDocumento; respaldo?: TotalesRespaldo }) {
  const detalle = useDocumentoDetalleData(documentoId, tipoDocumento, true);
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

  const documento = detalle.data?.documento;
  return (
    <PartidasDocumentoTabla
      partidas={partidas}
      totales={{
        descuento_global: documento?.descuento_global ?? respaldo?.descuento_global ?? null,
        subtotal: documento?.subtotal ?? respaldo?.subtotal ?? null,
        total: documento?.total ?? respaldo?.total ?? null,
      }}
    />
  );
}

const normalizar = (value: unknown) => String(value ?? '').trim().toLowerCase();

/** Estatus del documento al que se aplicó el pago, con la semántica de su workspace. */
function estatusDocumentoAplicado(aplicacion: AplicacionOperacion, tipo: string): EstatusMovimiento {
  const fila = {
    estatus_documento: aplicacion.estatus_documento ?? '',
    tratamiento_impuestos: aplicacion.tratamiento_impuestos ?? null,
    cfdi_uuid: aplicacion.cfdi_uuid ?? null,
    cfdi_estado_sat: aplicacion.cfdi_estado_sat ?? null,
    cfdi_fecha_cancelacion: aplicacion.cfdi_fecha_cancelacion ?? null,
    cfdi_cancelacion_estado: aplicacion.cfdi_cancelacion_estado ?? null,
  } as Parameters<typeof estadoVisualDocumento>[0];
  // Factura de venta: mismo punto y etiqueta que Facturas Workspace.
  if (tipo === 'factura') return estadoVisualDocumento(fila);
  const estatus = normalizar(aplicacion.estatus_documento);
  if (estatus === 'cancelado' || estatus === 'cancelada') return { label: 'Cancelada', tone: 'error' };
  if (estatus === 'borrador') return { label: 'Borrador', tone: 'draft' };
  if (estatus === 'emitido') return { label: tipo === 'factura_compra' ? 'Confirmada' : 'Emitida', tone: 'success' };
  return { label: aplicacion.estatus_documento || 'Sin estado', tone: 'neutral' };
}

function EstatusPunto({ estatus }: { estatus: EstatusMovimiento }) {
  const theme = useTheme();
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, whiteSpace: 'nowrap' }}>
      <Box component="span" sx={{ width: 8, height: 8, flex: '0 0 8px', borderRadius: '50%', bgcolor: getStatusToneColor(theme, estatus.tone) }} />
      <Typography component="span" sx={{ fontSize: 12.5, fontWeight: 700, color: theme.emphasys.content.secondary }}>{estatus.label}</Typography>
    </Box>
  );
}

function ChevronExpandir({ expandido }: { expandido: boolean }) {
  return (
    <ExpandMoreIcon
      fontSize="small"
      sx={(theme) => ({ color: theme.emphasys.content.muted, transition: 'transform 160ms ease', transform: expandido ? 'rotate(180deg)' : 'none' })}
    />
  );
}

/** Documentos a los que se aplicó un pago (misma consulta que el workspace de Pagos). */
/** `monto: null` omite la fila del monto (p. ej. en notas de crédito, cuyo total ya se muestra arriba). */
type TextosAplicaciones = { monto: string | null; saldo: string; vacio: string };

const TEXTOS_PAGO: TextosAplicaciones = {
  monto: 'Monto del pago',
  saldo: 'Por aplicar',
  vacio: 'Este pago aún no se ha aplicado a ningún documento.',
};

function AplicacionesMovimiento({ row, textos = TEXTOS_PAGO }: { row: CotizacionListado; textos?: TextosAplicaciones }) {
  const [aplicaciones, setAplicaciones] = React.useState<AplicacionOperacion[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [expandidas, setExpandidas] = React.useState<Set<number>>(() => new Set());

  React.useEffect(() => {
    let activo = true;
    fetchAplicacionesDocumento(row.id)
      .then((rows) => {
        if (activo) setAplicaciones((rows ?? []).filter((aplicacion) => Number(aplicacion.documento_origen_id) === row.id));
      })
      .catch((err: unknown) => {
        if (activo) setError(err instanceof Error ? err.message : 'No se pudieron cargar las aplicaciones');
      });
    return () => {
      activo = false;
    };
  }, [row.id]);

  if (!aplicaciones && !error) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={18} /></Box>;
  }

  const alternar = (id: number) => setExpandidas((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const total = Number(row.total ?? 0);
  const porAplicar = Number(row.saldo ?? 0);
  // Lo cancelado como saldo a favor no es una aplicación: va aparte en el resumen.
  const { aplicadas, canceladas, montoCancelado } = separarAplicaciones(aplicaciones ?? []);
  const aplicado = redondear(Math.max(0, total - porAplicar - montoCancelado));
  const foliosCancelados = canceladas.map((aplicacion) => resolverFolioVisual(aplicacion, normalizar(aplicacion.tipo_documento_destino))).filter(Boolean).join(', ');
  const filas = aplicadas.map((aplicacion) => {
    const tipo = normalizar(aplicacion.tipo_documento_destino || aplicacion.tipo_documento);
    return {
      id: aplicacion.id,
      documentoId: Number(aplicacion.documento_contraparte_id ?? aplicacion.documento_destino_id ?? 0),
      tipo,
      // Mismo algoritmo de folio que Facturas Workspace (folio externo en compras).
      folio: resolverFolioVisual(aplicacion, tipo) || 'Documento',
      fecha: formatDate(aplicacion.fecha_documento) || '—',
      estatus: estatusDocumentoAplicado(aplicacion, tipo),
      fechaAplicacion: formatDate(aplicacion.fecha_aplicacion) || '—',
      monto: currency.format(Number(aplicacion.monto_moneda_documento ?? aplicacion.monto ?? 0)),
    };
  });
  const celdaSx = (theme: Theme) => ({
    py: 0.9,
    borderBottom: `1px solid ${theme.emphasys.content.border}`,
    fontSize: 13.5,
    color: theme.emphasys.content.foreground,
    fontVariantNumeric: 'tabular-nums',
    cursor: 'pointer',
  });
  const titulos = ['Documento', 'Fecha', 'Estatus', 'Fecha de aplicación', 'Aplicado'];
  const panelSx = (theme: Theme) => ({
    px: { xs: 1.25, md: 2 },
    pt: 0.5,
    pb: 1,
    mb: 0.5,
    borderRadius: 2,
    border: `1px solid ${theme.emphasys.content.border}`,
    bgcolor: theme.emphasys.content.background,
  });

  return (
    <Box>
      {error || filas.length === 0 ? (
        <Typography variant="body2" sx={(theme) => ({ py: 1.5, color: theme.emphasys.content.muted })}>
          {error || textos.vacio}
        </Typography>
      ) : (
        <>
          {/* Escritorio: tabla; cada documento se expande para ver sus partidas */}
          <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: 'minmax(0, 1fr) repeat(4, max-content) 40px', alignItems: 'stretch' }}>
            {titulos.map((titulo, index) => (
              <Typography
                key={titulo}
                sx={(theme) => ({ ...encabezadoSx(theme), pb: 0.75, pl: index === 0 ? 0 : 3, borderBottom: `1px solid ${theme.emphasys.content.border}`, textAlign: index === titulos.length - 1 ? 'right' : 'left', whiteSpace: 'nowrap' })}
              >
                {titulo}
              </Typography>
            ))}
            <Box sx={(theme) => ({ borderBottom: `1px solid ${theme.emphasys.content.border}` })} />
            {filas.map((fila) => {
              const abierta = expandidas.has(fila.id);
              return (
                <React.Fragment key={fila.id}>
                  {/* display: contents deja las celdas en la cuadrícula y el clic sigue llegando aquí */}
                  <Box sx={{ display: 'contents' }} onClick={() => alternar(fila.id)}>
                    <Box sx={(theme) => ({ ...celdaSx(theme), fontWeight: 700 })}>{fila.folio}</Box>
                    <Box sx={(theme) => ({ ...celdaSx(theme), pl: 3, whiteSpace: 'nowrap' })}>{fila.fecha}</Box>
                    <Box sx={(theme) => ({ ...celdaSx(theme), pl: 3 })}><EstatusPunto estatus={fila.estatus} /></Box>
                    <Box sx={(theme) => ({ ...celdaSx(theme), pl: 3, whiteSpace: 'nowrap' })}>{fila.fechaAplicacion}</Box>
                    <Box sx={(theme) => ({ ...celdaSx(theme), pl: 3, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 })}>{fila.monto}</Box>
                    <Box sx={(theme) => ({ ...celdaSx(theme), py: 0.4, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' })}>
                      <IconButton
                        size="small"
                        aria-expanded={abierta}
                        aria-label={`${abierta ? 'Ocultar' : 'Ver'} partidas de ${fila.folio}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          alternar(fila.id);
                        }}
                      >
                        <ChevronExpandir expandido={abierta} />
                      </IconButton>
                    </Box>
                  </Box>
                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <Collapse in={abierta} timeout="auto" unmountOnExit>
                      <Box sx={(theme) => ({ ...panelSx(theme), mt: 0.75 })}>
                        <PartidasMovimiento documentoId={fila.documentoId} tipoDocumento={fila.tipo} />
                      </Box>
                    </Collapse>
                  </Box>
                </React.Fragment>
              );
            })}
          </Box>

          {/* Móvil: apiladas */}
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            {filas.map((fila) => {
              const abierta = expandidas.has(fila.id);
              return (
                <Box key={fila.id} sx={(theme) => ({ borderBottom: `1px solid ${theme.emphasys.content.border}` })}>
                  <Box
                    role="button"
                    tabIndex={0}
                    aria-expanded={abierta}
                    onClick={() => alternar(fila.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        alternar(fila.id);
                      }
                    }}
                    sx={{ py: 0.9, cursor: 'pointer', display: 'flex', gap: 1, alignItems: 'flex-start' }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{fila.folio}</Typography>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fila.monto}</Typography>
                      </Box>
                      <Box sx={{ mt: 0.3 }}><EstatusPunto estatus={fila.estatus} /></Box>
                      <Typography sx={(theme) => ({ fontSize: 12.5, mt: 0.2, color: theme.emphasys.content.muted })}>
                        Fecha {fila.fecha} · Aplicado {fila.fechaAplicacion}
                      </Typography>
                    </Box>
                    <Box sx={{ pt: 0.25 }}><ChevronExpandir expandido={abierta} /></Box>
                  </Box>
                  <Collapse in={abierta} timeout="auto" unmountOnExit>
                    <Box sx={panelSx}>
                      <PartidasMovimiento documentoId={fila.documentoId} tipoDocumento={fila.tipo} />
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </Box>
        </>
      )}

      <Box sx={{ ml: { xs: 0, md: 'auto' }, width: { xs: '100%', md: 340 }, pt: 1 }}>
        {textos.monto ? <FilaResumen label={textos.monto} value={currency.format(total)} /> : null}
        <FilaResumen label="Aplicado" value={currency.format(aplicado)} />
        {montoCancelado > 0 ? (
          <FilaResumen label={`Saldo cancelado${foliosCancelados ? ` (${foliosCancelados})` : ''}`} value={currency.format(montoCancelado)} />
        ) : null}
        <FilaResumen label={textos.saldo} value={currency.format(porAplicar)} fuerte />
      </Box>
    </Box>
  );
}

const TEXTOS_NOTA_CREDITO: TextosAplicaciones = {
  // El total de la nota ya aparece en el resumen de sus partidas, justo arriba.
  monto: null,
  saldo: 'Disponible',
  vacio: 'Esta nota aún no se ha aplicado a ningún documento.',
};

function TituloSeccion({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={(theme) => ({ ...encabezadoSx(theme), fontSize: 11.5, color: theme.emphasys.content.secondary, pt: 1.25, pb: 0.5 })}>
      {children}
    </Typography>
  );
}

/**
 * Detalle de una nota de crédito según su motivo (mismas reglas que el
 * workspace de Notas de crédito):
 *  - devolución: productos devueltos de la factura origen (cantidad × precio);
 *  - bonificación: monto bonificado por partida de la factura origen;
 *  - otro: conceptos libres, sin factura origen (se muestran como partidas).
 * En los tres casos después se listan los documentos a los que se aplicó.
 */
function NotaCreditoMovimiento({ row, tipoDocumento }: { row: CotizacionListado; tipoDocumento: TipoDocumento }) {
  const motivo = normalizar(row.motivo_nc);
  const ligadaAFactura = motivo === 'devolucion' || motivo === 'bonificacion';

  return (
    <Box>
      <TituloSeccion>
        {motivo === 'devolucion' ? 'Productos devueltos' : motivo === 'bonificacion' ? 'Bonificaciones' : 'Conceptos'}
      </TituloSeccion>
      {ligadaAFactura
        ? <PartidasNotaCreditoOrigen row={row} tipoDocumento={tipoDocumento} devolucion={motivo === 'devolucion'} />
        : <PartidasMovimiento documentoId={row.id} tipoDocumento={tipoDocumento} respaldo={row} />}
      <TituloSeccion>Aplicada a</TituloSeccion>
      <AplicacionesMovimiento row={row} textos={TEXTOS_NOTA_CREDITO} />
    </Box>
  );
}

/** Partidas de devolución/bonificación, cada una con la factura de la que proviene. */
function PartidasNotaCreditoOrigen({ row, tipoDocumento, devolucion }: { row: CotizacionListado; tipoDocumento: TipoDocumento; devolucion: boolean }) {
  const detalle = useDocumentoDetalleData(row.id, tipoDocumento, true);
  const partidas = detalle.data?.partidas ?? [];

  if (detalle.loading && !detalle.data) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={18} /></Box>;
  }
  if (detalle.error || partidas.length === 0) {
    return (
      <Typography variant="body2" sx={(theme) => ({ py: 1.5, color: theme.emphasys.content.muted })}>
        {detalle.error || 'Esta nota no tiene partidas.'}
      </Typography>
    );
  }

  const documentos = [...(detalle.data?.documentosOrigen ?? []), ...(detalle.data?.documentosRelacionados ?? [])];
  const documento = detalle.data?.documento;
  const filas = partidas.map((partida) => {
    const origen = documentos.find((doc) => doc.id === Number(partida.documento_origen_id ?? 0));
    return {
      id: partida.id,
      factura: origen ? (folioDocumento(origen) || '—') : '—',
      fechaFactura: origen ? formatDate(origen.fecha_documento) : null,
      clave: partida.producto_clave,
      descripcion: partida.producto_descripcion || partida.descripcion_alterna || 'Sin descripción',
      cantidad: quantity.format(Number(partida.cantidad || 0)),
      precio: currency.format(Number(partida.precio_unitario || 0)),
      importe: currency.format(Number(partida.subtotal_partida ?? Number(partida.cantidad || 0) * Number(partida.precio_unitario || 0))),
    };
  });
  const subtotal = Number(documento?.subtotal ?? row.subtotal ?? 0);
  const total = Number(documento?.total ?? row.total ?? subtotal);
  const impuestos = redondear(total - subtotal);

  const titulos = devolucion
    ? ['Factura', 'Producto', 'Cantidad', 'Precio', 'Importe']
    : ['Factura', 'Producto', 'Importe bonificado'];
  const columnas = devolucion
    ? 'max-content minmax(0, 1fr) repeat(3, max-content)'
    : 'max-content minmax(0, 1fr) max-content';
  const celdaSx = (theme: Theme) => ({
    py: 0.9,
    borderBottom: `1px solid ${theme.emphasys.content.border}`,
    fontSize: 13.5,
    color: theme.emphasys.content.foreground,
    fontVariantNumeric: 'tabular-nums',
  });
  const numeroSx = (theme: Theme) => ({ ...celdaSx(theme), pl: 3, textAlign: 'right' as const, whiteSpace: 'nowrap' as const });

  return (
    <Box>
      {/* Escritorio: tabla */}
      <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: columnas, alignItems: 'stretch' }}>
        {titulos.map((titulo, index) => (
          <Typography
            key={titulo}
            sx={(theme) => ({ ...encabezadoSx(theme), pb: 0.75, pl: index === 0 ? 0 : 3, borderBottom: `1px solid ${theme.emphasys.content.border}`, textAlign: index < 2 ? 'left' : 'right', whiteSpace: 'nowrap' })}
          >
            {titulo}
          </Typography>
        ))}
        {filas.map((fila) => (
          <React.Fragment key={fila.id}>
            <Box sx={(theme) => ({ ...celdaSx(theme), whiteSpace: 'nowrap' })}>
              <Typography component="span" sx={{ fontSize: 13.5, fontWeight: 700 }}>{fila.factura}</Typography>
              {fila.fechaFactura ? (
                <Typography component="span" sx={(theme) => ({ fontSize: 12, color: theme.emphasys.content.muted, ml: 0.75 })}>{fila.fechaFactura}</Typography>
              ) : null}
            </Box>
            <Box sx={(theme) => ({ ...celdaSx(theme), pl: 3, minWidth: 0 })}>
              {fila.clave ? (
                <Typography component="span" sx={(theme) => ({ fontSize: 12, fontWeight: 700, color: theme.emphasys.content.muted, mr: 1 })}>{fila.clave}</Typography>
              ) : null}
              <Typography component="span" sx={{ fontSize: 13.5 }}>{fila.descripcion}</Typography>
            </Box>
            {devolucion ? (
              <>
                <Box sx={numeroSx}>{fila.cantidad}</Box>
                <Box sx={numeroSx}>{fila.precio}</Box>
              </>
            ) : null}
            <Box sx={(theme) => ({ ...numeroSx(theme), fontWeight: 700 })}>{fila.importe}</Box>
          </React.Fragment>
        ))}
      </Box>

      {/* Móvil: apiladas */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {filas.map((fila) => (
          <Box key={fila.id} sx={celdaSx}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{fila.descripcion}</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 0.3, gap: 1 }}>
              <Typography sx={(theme) => ({ fontSize: 12.5, color: theme.emphasys.content.muted })}>
                {devolucion ? `${fila.cantidad} × ${fila.precio}` : 'Bonificado'}
              </Typography>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{fila.importe}</Typography>
            </Box>
            <Typography sx={(theme) => ({ fontSize: 12.5, mt: 0.2, color: theme.emphasys.content.muted })}>
              Factura {fila.factura}{fila.fechaFactura ? ` · ${fila.fechaFactura}` : ''}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ ml: { xs: 0, md: 'auto' }, width: { xs: '100%', md: 340 }, pt: 1 }}>
        <FilaResumen label="Subtotal" value={currency.format(subtotal)} />
        {Math.abs(impuestos) >= 0.01 ? <FilaResumen label="Impuestos" value={currency.format(impuestos)} /> : null}
        <FilaResumen label="Total" value={currency.format(total)} fuerte />
      </Box>
    </Box>
  );
}

type DocumentoMovimientoCardProps = {
  row: CotizacionListado;
  config: MovimientoContactoConfig;
};

/**
 * Tarjeta de un documento comercial/financiero (factura, cotización y, a futuro,
 * pedidos, órdenes de compra, pagos, notas de crédito…). Lo específico de cada
 * tipo vive en MovimientoContactoConfig.
 */
export default function DocumentoMovimientoCard({ row, config }: DocumentoMovimientoCardProps) {
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
  const vendedor = row.agente_nombre?.trim() || null;
  const datoExtra = config.datoExtra?.(row) ?? null;
  const descuentoGlobalPct = porcentajeValido(row.descuento_global);
  // subtotal ya trae aplicado el descuento global: s = base · (1 − g)
  const descuentoGlobalMonto = descuentoGlobalPct > 0 && descuentoGlobalPct < 100
    ? redondear(Number(row.subtotal ?? 0) * descuentoGlobalPct / (100 - descuentoGlobalPct))
    : 0;

  const columnasEscritorio = [
    'minmax(170px, 1.4fr)',
    'minmax(110px, 1fr)',
    vencimiento ? 'minmax(110px, 1fr)' : null,
    datoExtra ? 'minmax(110px, 1fr)' : null,
    vendedor ? 'minmax(140px, 1.2fr)' : null,
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

        {/* Indicador para expandir partidas (en móvil va arriba a la derecha) */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.25, gridColumn: { xs: '2 / 3', md: '-2 / -1' }, gridRow: { xs: 1, md: 1 } }}>
          <ExpandMoreIcon
            fontSize="small"
            sx={{ color: tokens.content.muted, transition: 'transform 160ms ease', transform: expandido ? 'rotate(180deg)' : 'none' }}
          />
        </Box>

        <Dato label="Fecha">{fecha || '—'}</Dato>
        {vencimiento ? <Dato label="Vencimiento">{vencimiento}</Dato> : null}
        {datoExtra ? <Dato label={datoExtra.label}>{datoExtra.valor}</Dato> : null}
        {vendedor ? (
          <Dato label="Vendedor">
            <Box component="span" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }} title={vendedor}>{vendedor}</Box>
          </Dato>
        ) : null}
        <Box sx={{ minWidth: 0 }}>
          <Dato label={config.etiquetaTotal}>
            <Typography variant="figure" component="span" sx={{ fontSize: 16, color: 'inherit' }}>{currency.format(total)}</Typography>
          </Dato>
          {descuentoGlobalPct > 0 ? (
            <Typography sx={{ fontSize: 11.5, color: tokens.content.muted, mt: 0.2, whiteSpace: 'nowrap' }}>
              Desc. global {percent.format(descuentoGlobalPct)}%{descuentoGlobalMonto > 0 ? ` · −${currency.format(descuentoGlobalMonto)}` : ''}
            </Typography>
          ) : null}
        </Box>
        {config.mostrarSaldo ? (
          <Box sx={{ minWidth: 0 }}>
            <Dato label={config.etiquetaSaldo}>
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
          {config.contenido === 'aplicaciones'
            ? <AplicacionesMovimiento row={row} />
            : config.contenido === 'nota_credito'
              ? <NotaCreditoMovimiento row={row} tipoDocumento={config.tipoDocumento} />
              : <PartidasMovimiento documentoId={row.id} tipoDocumento={config.tipoDocumento} respaldo={row} />}
        </Box>
      </Collapse>
    </Box>
  );
}
