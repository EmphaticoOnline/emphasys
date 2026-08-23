// Contenido reutilizable de "detalle de documento" (Resumen/Partidas/Pagos/
// Notas de crédito/Relacionados/Inventario), extraído mecánicamente de
// DocumentoDetalleDrawer.tsx para poder usarse tanto dentro del Drawer actual
// como en el nuevo workspace de Facturas. No se cambió ninguna lógica: mismos
// campos, mismo fetch, mismo formato. DocumentoDetalleDrawer sigue
// funcionando exactamente igual, ahora importando estas piezas en vez de
// definirlas inline.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import { getDocumentoDetalle, reconciliarCancelacionDocumento } from '../../services/documentosService';
import type {
  DocumentoDetalleResponse,
  DocumentoRelacionado,
  MovimientoInventarioDocumento,
  NotaCreditoAplicada,
  PagoAplicado,
} from '../../types/documentoDetalle';
import type { TipoDocumento } from '../../types/documentos.types';
import { formatearFolioDocumento } from '../../utils/documentos.utils';
import { getDocumentoTypeConfig, resolveDocumentoTextos } from '../../modules/documentos/documentoTypeConfig';
import { summarizeDocumentTaxes } from '../../utils/documentTaxSummary';

export const formatDateShort = (value?: string | null) => {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
};

export const etiquetaTipoDocumento = (tipo?: string | null): string => {
  if (!tipo) return 'Documento';
  const config = getDocumentoTypeConfig(tipo as TipoDocumento);
  return resolveDocumentoTextos(tipo as TipoDocumento, config).singular || tipo;
};

export const folioDe = (serie?: string | null, numero?: number | null): string => {
  if (numero === null || numero === undefined) return '—';
  return formatearFolioDocumento(serie || '', numero);
};

export const headerCellSx = {
  backgroundColor: '#1d2f68',
  color: '#fff',
  fontWeight: 600,
  fontSize: '13px',
  py: '6px',
};

export const bodyCellSx = {
  fontSize: '13px',
  py: '6px',
  borderBottom: '1px solid #e5e7eb',
};

export function EmptyState({ mensaje }: { mensaje: string }) {
  return (
    <Box sx={{ py: 4, textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        {mensaje}
      </Typography>
    </Box>
  );
}

// Hook de datos: mismo useEffect/estado que vivía inline en el Drawer,
// parametrizado por `enabled` en vez de `open` (el Drawer sigue pasando
// `open`; el workspace nuevo puede pasar `true` siempre que haya un
// documentoId, sin concepto de "abierto/cerrado").
export function useDocumentoDetalleData(
  documentoId: number | null,
  tipoDocumento: TipoDocumento,
  enabled: boolean
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DocumentoDetalleResponse | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationMessage, setReconciliationMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!enabled || !documentoId) {
      setData(null);
      setError(null);
      setReconciliationMessage(null);
      return;
    }
    let cancelado = false;
    setLoading(true);
    setError(null);
    getDocumentoDetalle(documentoId, tipoDocumento)
      .then((resultado) => {
        if (!cancelado) setData(resultado);
      })
      .catch((err: any) => {
        if (!cancelado) setError(err?.message || 'No se pudo cargar el detalle del documento');
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [enabled, documentoId, tipoDocumento, refreshKey]);

  const handleReconcile = async () => {
    if (!documentoId || reconciling) return;
    setReconciling(true);
    setReconciliationMessage(null);
    try {
      const result = await reconciliarCancelacionDocumento(documentoId);
      setReconciliationMessage(result.message);
      setRefreshKey((value) => value + 1);
      return result;
    } catch (err: any) {
      setReconciliationMessage(err?.message || 'No se pudo reconciliar el estado de cancelación.');
      return undefined;
    } finally {
      setReconciling(false);
    }
  };

  return { data, loading, error, reconciling, reconciliationMessage, handleReconcile };
}

export function ResumenTab({
  documento,
  partidas,
  formatter,
  tipoDocumento,
  folio,
  reconciling,
  reconciliationMessage,
  onReconcile,
}: {
  documento: any;
  partidas?: DocumentoDetalleResponse['partidas'];
  formatter: Intl.NumberFormat;
  tipoDocumento: TipoDocumento;
  folio: string;
  reconciling: boolean;
  reconciliationMessage: string | null;
  onReconcile: () => Promise<void>;
}) {
  if (!documento) return <EmptyState mensaje="Sin información del documento." />;

  const impuestosResumen = summarizeDocumentTaxes(partidas);
  const retenciones = impuestosResumen.retenciones || Number(documento.retencion_iva ?? 0) + Number(documento.retencion_isr ?? 0);

  const campos: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'Tipo de documento', value: etiquetaTipoDocumento(tipoDocumento) },
    { label: 'Folio', value: folio },
    { label: 'Cliente / Proveedor', value: documento.cliente_nombre || documento.nombre_receptor || '—' },
    { label: 'Fecha', value: formatDateShort(documento.fecha_documento) },
    { label: 'Agente', value: documento.agente_nombre || '—' },
    { label: 'Estatus', value: <Chip size="small" label={documento.estatus_documento || '—'} /> },
    { label: 'Subtotal', value: formatter.format(Number(documento.subtotal || 0)) },
    { label: 'IVA trasladado', value: formatter.format(Number(documento.iva || 0)) },
    ...(retenciones > 0 ? [{ label: 'Retenciones', value: `-${formatter.format(retenciones)}` }] : []),
    ...impuestosResumen.lineas
      .filter((impuesto) => {
        const texto = `${impuesto.id} ${impuesto.nombre}`.toLowerCase();
        return !texto.includes('iva') || !['traslado', 'retencion'].includes(impuesto.tipo);
      })
      .map((impuesto) => ({
        label: impuesto.nombre,
        value: `${impuesto.tipo === 'retencion' ? '-' : ''}${formatter.format(impuesto.monto)}`,
      })),
    { label: 'Total', value: formatter.format(Number(documento.total || 0)) },
  ];

  if (documento.saldo !== null && documento.saldo !== undefined) {
    campos.push({ label: 'Saldo operativo', value: formatter.format(Number(documento.saldo || 0)) });
  }
  if (documento.saldo_registrado !== null && documento.saldo_registrado !== undefined) {
    campos.push({ label: 'Saldo registrado', value: formatter.format(Number(documento.saldo_registrado || 0)) });
  }
  const cancelacionEstado = String(documento.cfdi_cancelacion_estado ?? '').trim().toLowerCase();
  const cancelacionRelevante = Boolean(
    documento.cfdi_cancelacion_intento_id
    || ['solicitada', 'pendiente', 'requiere_reconciliacion', 'cancelada', 'rechazada', 'error'].includes(cancelacionEstado)
  );
  const puedeReconciliar = ['solicitada', 'pendiente', 'requiere_reconciliacion'].includes(cancelacionEstado);
  const labelEstadoCancelacion = cancelacionEstado
    ? cancelacionEstado.replaceAll('_', ' ').replace(/^./, (value: string) => value.toUpperCase())
    : '—';
  const proveedor = String(documento.cfdi_cancelacion_proveedor ?? '').trim();

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 1.5,
          border: '1px solid #e5e7eb',
          borderRadius: 2,
          p: 2,
        }}
      >
        {campos.map((campo) => (
          <Box key={campo.label}>
            <Typography variant="caption" color="text.secondary">
              {campo.label}
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {campo.value}
            </Typography>
          </Box>
        ))}
      </Box>
      {cancelacionRelevante ? (
        <Box sx={{ border: '1px solid #f59e0b', borderRadius: 2, p: 2, bgcolor: '#fffbeb' }}>
          <Typography variant="subtitle2" fontWeight={700} color="#92400e" sx={{ mb: 1 }}>
            CANCELACIÓN CFDI
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
            <Typography variant="body2"><strong>Estado:</strong> {labelEstadoCancelacion}</Typography>
            <Typography variant="body2"><strong>Proveedor:</strong> {proveedor ? proveedor.replace(/^./, (value) => value.toUpperCase()) : '—'}</Typography>
            <Typography variant="body2"><strong>Estado proveedor:</strong> {documento.cfdi_cancelacion_proveedor_status || '—'}</Typography>
            <Typography variant="body2"><strong>Fecha de solicitud:</strong> {formatDateShort(documento.cfdi_cancelacion_fecha_solicitud)}</Typography>
            <Typography variant="body2"><strong>Última consulta:</strong> {formatDateShort(documento.cfdi_cancelacion_fecha_ultima_consulta)}</Typography>
            <Typography variant="body2"><strong>Intento:</strong> {documento.cfdi_cancelacion_intento_id || '—'}</Typography>
          </Box>
          {puedeReconciliar ? (
            <>
              <Alert severity="warning" sx={{ mt: 1.5 }}>
                Saldo suspendido por cancelación pendiente. Saldo previo: {formatter.format(Number(documento.saldo_registrado || 0))}.
                No admite nuevas aplicaciones.
              </Alert>
              <Typography variant="body2" sx={{ mt: 1.5 }}>
                La factura permanece timbrada hasta que el PAC o el SAT confirmen la cancelación.
              </Typography>
            </>
          ) : null}
          {reconciliationMessage ? <Alert severity="info" sx={{ mt: 1.5 }}>{reconciliationMessage}</Alert> : null}
          {puedeReconciliar ? (
            <Button
              variant="outlined"
              color="warning"
              startIcon={reconciling ? <CircularProgress size={16} color="inherit" /> : <SyncOutlinedIcon />}
              disabled={reconciling}
              onClick={() => { void onReconcile(); }}
              sx={{ mt: 1.5 }}
            >
              {reconciling ? 'Reconciliando…' : 'Reconciliar estado'}
            </Button>
          ) : null}
        </Box>
      ) : null}
      {documento.observaciones ? (
        <Box>
          <Typography variant="subtitle2" fontWeight={700} color="#1d2f68">
            Observaciones
          </Typography>
          <Typography variant="body2" whiteSpace="pre-wrap">
            {documento.observaciones}
          </Typography>
        </Box>
      ) : null}
    </Stack>
  );
}

export function PartidasTab({ partidas, formatter }: { partidas: DocumentoDetalleResponse['partidas']; formatter: Intl.NumberFormat }) {
  if (!partidas || partidas.length === 0) return <EmptyState mensaje="Este documento no tiene partidas." />;

  return (
    <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={headerCellSx}>Clave / Producto</TableCell>
            <TableCell sx={headerCellSx}>Descripción</TableCell>
            <TableCell align="right" sx={headerCellSx}>Cantidad</TableCell>
            <TableCell sx={headerCellSx}>Unidad</TableCell>
            <TableCell align="right" sx={headerCellSx}>Precio unitario</TableCell>
            <TableCell align="right" sx={headerCellSx}>Descuento</TableCell>
            <TableCell align="right" sx={headerCellSx}>Impuestos</TableCell>
            <TableCell align="right" sx={headerCellSx}>Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {partidas.map((partida: any) => {
            return (
              <TableRow key={partida.id}>
                <TableCell sx={bodyCellSx}>{partida.producto_clave || '—'}</TableCell>
                <TableCell sx={bodyCellSx}>
                  {partida.producto_descripcion || partida.descripcion_alterna || '—'}
                  {Array.isArray(partida.especificaciones) && partida.especificaciones.length ? (
                    <Box component="ul" sx={{ my: .5, pl: 2.5 }}>
                      {partida.especificaciones.map((spec: any, index: number) => (
                        <Typography component="li" variant="caption" color="text.secondary" key={spec.id ?? index} sx={{ whiteSpace: 'pre-wrap' }}>
                          {spec.contenido}
                        </Typography>
                      ))}
                    </Box>
                  ) : null}
                  {partida.observaciones ? (
                    <Typography variant="caption" display="block" color="text.secondary">
                      {partida.observaciones}
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell align="right" sx={bodyCellSx}>{Number(partida.cantidad || 0)}</TableCell>
                <TableCell sx={bodyCellSx}>{partida.unidad || '—'}</TableCell>
                <TableCell align="right" sx={bodyCellSx}>{formatter.format(Number(partida.precio_unitario || 0))}</TableCell>
                <TableCell align="right" sx={bodyCellSx}>{formatter.format(Number(partida.descuento || 0))}</TableCell>
                <TableCell align="right" sx={bodyCellSx}>
                  {Array.isArray(partida.impuestos) && partida.impuestos.length ? (
                    <Stack spacing={0.25} alignItems="flex-end">
                      {partida.impuestos.map((impuesto: any) => (
                        <Typography key={`${impuesto.tipo}:${impuesto.impuesto_id}`} variant="caption" whiteSpace="nowrap">
                          {impuesto.nombre || impuesto.impuesto_id}: {String(impuesto.tipo ?? '').toLowerCase() === 'retencion' ? '-' : ''}{formatter.format(Number(impuesto.monto || 0))}
                        </Typography>
                      ))}
                    </Stack>
                  ) : formatter.format(0)}
                </TableCell>
                <TableCell align="right" sx={bodyCellSx}>{formatter.format(Number(partida.total_partida || 0))}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function PagosTab({ pagos, formatter }: { pagos: PagoAplicado[]; formatter: Intl.NumberFormat }) {
  if (!pagos || pagos.length === 0) return <EmptyState mensaje="Este documento aún no tiene pagos aplicados." />;

  return (
    <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={headerCellSx}>Folio del pago</TableCell>
            <TableCell sx={headerCellSx}>Fecha</TableCell>
            <TableCell sx={headerCellSx}>Cuenta</TableCell>
            <TableCell sx={headerCellSx}>Forma de pago</TableCell>
            <TableCell align="right" sx={headerCellSx}>Importe aplicado</TableCell>
            <TableCell align="right" sx={headerCellSx}>Saldo insoluto</TableCell>
            <TableCell sx={headerCellSx}>Estatus</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pagos.map((pago) => (
            <TableRow key={pago.id}>
              <TableCell sx={bodyCellSx}>{folioDe(pago.documento_pago_serie, pago.documento_pago_numero)}</TableCell>
              <TableCell sx={bodyCellSx}>{formatDateShort(pago.fecha_pago || pago.fecha_aplicacion)}</TableCell>
              <TableCell sx={bodyCellSx}>{pago.cuenta_identificador || '—'}</TableCell>
              <TableCell sx={bodyCellSx}>{pago.metodo_pago_nombre || '—'}</TableCell>
              <TableCell align="right" sx={bodyCellSx}>{formatter.format(Number(pago.monto_moneda_documento || 0))}</TableCell>
              <TableCell align="right" sx={bodyCellSx}>
                {pago.imp_saldo_insoluto !== null && pago.imp_saldo_insoluto !== undefined
                  ? formatter.format(Number(pago.imp_saldo_insoluto))
                  : '—'}
              </TableCell>
              <TableCell sx={bodyCellSx}>
                <Chip size="small" label={pago.documento_pago_estatus || '—'} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export const MOTIVO_NC_LABEL: Record<string, string> = {
  devolucion: 'Devolución',
  bonificacion: 'Bonificación',
  otro: 'Otro',
};

export function NotasCreditoTab({ notasCredito, formatter }: { notasCredito: NotaCreditoAplicada[]; formatter: Intl.NumberFormat }) {
  if (!notasCredito || notasCredito.length === 0) {
    return <EmptyState mensaje="Este documento no tiene notas de crédito asociadas." />;
  }

  return (
    <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={headerCellSx}>Folio</TableCell>
            <TableCell sx={headerCellSx}>Fecha</TableCell>
            <TableCell sx={headerCellSx}>Motivo</TableCell>
            <TableCell align="right" sx={headerCellSx}>Total</TableCell>
            <TableCell align="right" sx={headerCellSx}>Importe aplicado</TableCell>
            <TableCell sx={headerCellSx}>Estatus</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {notasCredito.map((nc) => (
            <TableRow key={nc.id}>
              <TableCell sx={bodyCellSx}>{folioDe(nc.documento_nc_serie, nc.documento_nc_numero)}</TableCell>
              <TableCell sx={bodyCellSx}>{formatDateShort(nc.documento_nc_fecha)}</TableCell>
              <TableCell sx={bodyCellSx}>{nc.motivo_nc ? MOTIVO_NC_LABEL[nc.motivo_nc] ?? nc.motivo_nc : '—'}</TableCell>
              <TableCell align="right" sx={bodyCellSx}>{formatter.format(Number(nc.documento_nc_total || 0))}</TableCell>
              <TableCell align="right" sx={bodyCellSx}>{formatter.format(Number(nc.monto_moneda_documento || 0))}</TableCell>
              <TableCell sx={bodyCellSx}>
                <Chip size="small" label={nc.documento_nc_estatus || '—'} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function RelacionadosTab({
  documentosRelacionados,
  formatter,
}: {
  documentosRelacionados: DocumentoRelacionado[];
  formatter: Intl.NumberFormat;
}) {
  if (!documentosRelacionados || documentosRelacionados.length === 0) {
    return <EmptyState mensaje="Este documento no tiene documentos relacionados." />;
  }

  return (
    <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={headerCellSx}>Tipo</TableCell>
            <TableCell sx={headerCellSx}>Folio</TableCell>
            <TableCell sx={headerCellSx}>Fecha</TableCell>
            <TableCell sx={headerCellSx}>Estatus</TableCell>
            <TableCell align="right" sx={headerCellSx}>Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {documentosRelacionados.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell sx={bodyCellSx}>{etiquetaTipoDocumento(doc.tipo_documento)}</TableCell>
              <TableCell sx={bodyCellSx}>{folioDe(doc.serie, doc.numero)}</TableCell>
              <TableCell sx={bodyCellSx}>{formatDateShort(doc.fecha_documento)}</TableCell>
              <TableCell sx={bodyCellSx}>
                <Chip size="small" label={doc.estatus_documento || '—'} />
              </TableCell>
              <TableCell align="right" sx={bodyCellSx}>{formatter.format(Number(doc.total || 0))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function InventarioTab({ movimientos }: { movimientos: MovimientoInventarioDocumento[] }) {
  if (!movimientos || movimientos.length === 0) {
    return <EmptyState mensaje="Este documento no generó movimientos de inventario." />;
  }

  return (
    <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={headerCellSx}>Fecha</TableCell>
            <TableCell sx={headerCellSx}>Tipo de movimiento</TableCell>
            <TableCell sx={headerCellSx}>Almacén</TableCell>
            <TableCell sx={headerCellSx}>Producto</TableCell>
            <TableCell align="right" sx={headerCellSx}>Cantidad</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {movimientos.map((mov, idx) => {
            const cantidad = Number(mov.cantidad || 0);
            const almacen = cantidad < 0
              ? mov.almacen_origen_nombre || mov.almacen_destino_nombre
              : mov.almacen_destino_nombre || mov.almacen_origen_nombre;
            return (
              <TableRow key={`${mov.movimiento_id}-${idx}`}>
                <TableCell sx={bodyCellSx}>{formatDateShort(mov.fecha)}</TableCell>
                <TableCell sx={bodyCellSx}>{mov.tipo_movimiento}</TableCell>
                <TableCell sx={bodyCellSx}>{almacen || '—'}</TableCell>
                <TableCell sx={bodyCellSx}>
                  {mov.producto_clave || mov.producto_descripcion
                    ? `${mov.producto_clave || ''} ${mov.producto_descripcion || ''}`.trim()
                    : '—'}
                </TableCell>
                <TableCell align="right" sx={bodyCellSx}>{cantidad > 0 ? `+${cantidad}` : cantidad}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
