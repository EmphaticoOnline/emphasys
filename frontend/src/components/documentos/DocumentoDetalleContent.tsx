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
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { descargarAcuseCancelacionXml, getDocumentoDetalle, reconciliarCancelacionDocumento } from '../../services/documentosService';
import type {
  DocumentoDetalleResponse,
  DocumentoRelacionado,
  MovimientoInventarioDocumento,
} from '../../types/documentoDetalle';
import type { TipoDocumento } from '../../types/documentos.types';
import { formatearFolioDocumento, resolverFolioVisual } from '../../utils/documentos.utils';
import { getDocumentoTypeConfig, resolveDocumentoTextos } from '../../modules/documentos/documentoTypeConfig';
import { summarizeDocumentTaxes } from '../../utils/documentTaxSummary';
import { alertColors } from '../../theme/functional';
import { neutralColors } from '../../theme/structural';
import { useBrand } from '../../theme/brand/useBrand';

import PartidasDocumentoTabla, { type TotalesDocumento } from './partidas/PartidasDocumentoTabla';
import DocumentoRelacionadoCard from './relacionados/DocumentoRelacionadoCard';

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

/** Tipos sin configuración de formulario propia (se generan desde otros workspaces). */
const ETIQUETAS_TIPO_SIN_CONFIG: Record<string, string> = {
  ajuste_favor_cliente: 'Cancelación de saldo a favor',
  ajuste_favor_proveedor: 'Cancelación de saldo a favor',
};

export const etiquetaTipoDocumento = (tipo?: string | null): string => {
  if (!tipo) return 'Documento';
  const sinConfig = ETIQUETAS_TIPO_SIN_CONFIG[String(tipo).toLowerCase()];
  if (sinConfig) return sinConfig;
  const config = getDocumentoTypeConfig(tipo as TipoDocumento);
  if (config?.label) return config.label;
  const singular = resolveDocumentoTextos(tipo as TipoDocumento, config).singular || tipo;
  return singular.charAt(0).toUpperCase() + singular.slice(1);
};

export const folioDe = (
  serie?: string | null,
  numero?: number | null,
  externo?: { tipo?: string | null | undefined; serie_externa?: string | null | undefined; numero_externo?: number | null | undefined },
): string => {
  if (numero === null || numero === undefined) return '—';
  // En compras, folio del proveedor con fallback al interno.
  return externo
    ? resolverFolioVisual({ serie: serie ?? null, numero, serie_externa: externo.serie_externa ?? null, numero_externo: externo.numero_externo ?? null }, externo.tipo ?? '')
    : formatearFolioDocumento(serie || '', numero);
};

export const headerCellSx = {
  backgroundColor: 'primary.main',
  color: 'primary.contrastText',
  fontWeight: 600,
  fontSize: '13px',
  py: '6px',
};

export const bodyCellSx = {
  fontSize: '13px',
  py: '6px',
  borderBottom: `1px solid ${neutralColors.gray[200]}`,
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
  enabled: boolean,
  refreshKey = 0
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DocumentoDetalleResponse | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationMessage, setReconciliationMessage] = useState<string | null>(null);
  const [reconciliationRefreshKey, setReconciliationRefreshKey] = useState(0);

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
  }, [enabled, documentoId, tipoDocumento, refreshKey, reconciliationRefreshKey]);

  const handleReconcile = async () => {
    if (!documentoId || reconciling) return;
    setReconciling(true);
    setReconciliationMessage(null);
    try {
      const result = await reconciliarCancelacionDocumento(documentoId);
      setReconciliationMessage(result.message);
      setReconciliationRefreshKey((value) => value + 1);
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
  const { activeBrand } = useBrand();
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
    campos.push({ label: 'Saldo', value: formatter.format(Number(documento.saldo || 0)) });
  }
  const cancelacionEstado = String(documento.cfdi_cancelacion_estado ?? '').trim().toLowerCase();
  const cancelacionRelevante = Boolean(
    documento.cfdi_cancelacion_intento_id
    || ['solicitada', 'pendiente', 'requiere_reconciliacion', 'cancelada', 'rechazada', 'error'].includes(cancelacionEstado)
  );
  const puedeReconciliar = ['solicitada', 'pendiente', 'error', 'requiere_reconciliacion'].includes(cancelacionEstado);
  const labelEstadoCancelacion = cancelacionEstado === 'error'
    ? 'Requiere reconciliación'
    : cancelacionEstado
      ? cancelacionEstado.replaceAll('_', ' ').replace(/^./, (value: string) => value.toUpperCase())
    : '—';
  const proveedor = String(documento.cfdi_cancelacion_proveedor ?? '').trim();
  // Saldo guardado vs. calculado con las aplicaciones: sólo se avisa si difieren
  // (durante una cancelación pendiente el saldo se suspende a propósito).
  const saldoDescuadrado = documento.saldo != null && documento.saldo_registrado != null
    && !['solicitada', 'pendiente'].includes(cancelacionEstado)
    && Math.abs(Number(documento.saldo_registrado) - Number(documento.saldo)) > 0.005;

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 1.5,
          border: `1px solid ${neutralColors.gray[200]}`,
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
      {saldoDescuadrado ? (
        <Alert severity="warning">
          El saldo registrado ({formatter.format(Number(documento.saldo_registrado))}) no coincide con el calculado a partir de sus aplicaciones ({formatter.format(Number(documento.saldo))}).
        </Alert>
      ) : null}
      {cancelacionRelevante ? (
        <Box sx={{ border: `1px solid ${alertColors.warning[500]}`, borderRadius: 2, p: 2, bgcolor: alertColors.warning[50] }}>
          <Typography variant="subtitle2" fontWeight={700} color={alertColors.warning[800]} sx={{ mb: 1 }}>
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
          {['solicitada', 'pendiente'].includes(cancelacionEstado) ? (
            <>
              <Alert severity="warning" sx={{ mt: 1.5 }}>
                Saldo suspendido por cancelación pendiente. Saldo previo: {formatter.format(Number(documento.saldo_registrado || 0))}.
                No admite nuevas aplicaciones.
              </Alert>
              <Typography variant="body2" sx={{ mt: 1.5 }}>
                La factura permanece timbrada hasta que el SAT confirme la cancelación.
              </Typography>
            </>
          ) : cancelacionEstado === 'error' ? (
            <Typography variant="body2" sx={{ mt: 1.5 }}>
              El estado de la cancelación necesita volver a consultarse.
            </Typography>
          ) : null}
          {cancelacionEstado === 'cancelada' ? (
            documento.cfdi_tiene_acuse_cancelacion ? (
              <Button
                variant="outlined"
                startIcon={<DownloadOutlinedIcon />}
                onClick={() => { void descargarAcuseCancelacionXml(documento.id); }}
                sx={{ mt: 1.5 }}
              >
                Descargar acuse de cancelación
              </Button>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                Acuse no disponible
              </Typography>
            )
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
              {reconciling ? 'Consultando SAT…' : 'Reconciliar estado'}
            </Button>
          ) : null}
        </Box>
      ) : null}
      {documento.observaciones ? (
        <Box>
          <Typography variant="subtitle2" fontWeight={700} color={activeBrand.colors.blue.base}>
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

export function PartidasTab({ partidas, documento }: {
  partidas: DocumentoDetalleResponse['partidas'];
  /** Totales del documento para el resumen (descuento global, subtotal, total). */
  documento?: TotalesDocumento | null;
  formatter?: Intl.NumberFormat;
}) {
  if (!partidas || partidas.length === 0) return <EmptyState mensaje="Este documento no tiene partidas." />;

  return (
    <Box sx={(theme) => ({ border: `1px solid ${theme.emphasys.content.border}`, borderRadius: 2, bgcolor: theme.emphasys.content.card, px: 2, pt: 1.5, pb: 1 })}>
      <PartidasDocumentoTabla partidas={partidas} totales={documento ?? null} />
    </Box>
  );
}

export function RelacionadosTab({
  documentosRelacionados,
}: {
  documentosRelacionados: DocumentoRelacionado[];
  formatter?: Intl.NumberFormat;
}) {
  if (!documentosRelacionados || documentosRelacionados.length === 0) {
    return <EmptyState mensaje="Este documento no tiene documentos relacionados." />;
  }

  // Una tarjeta por documento, expandida por default: los relacionados de un
  // documento son pocos y lo útil es ver sus partidas.
  return (
    <Stack spacing={1.25}>
      {documentosRelacionados.map((doc) => <DocumentoRelacionadoCard key={doc.id} doc={doc} />)}
    </Stack>
  );
}

export function InventarioTab({ movimientos }: { movimientos: MovimientoInventarioDocumento[] }) {
  if (!movimientos || movimientos.length === 0) {
    return <EmptyState mensaje="Este documento no generó movimientos de inventario." />;
  }

  return (
    <TableContainer sx={{ border: `1px solid ${neutralColors.gray[200]}`, borderRadius: 2 }}>
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
