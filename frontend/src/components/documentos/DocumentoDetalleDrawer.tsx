import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { getDocumentoDetalle } from '../../services/documentosService';
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

const formatDateShort = (value?: string | null) => {
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

const etiquetaTipoDocumento = (tipo?: string | null): string => {
  if (!tipo) return 'Documento';
  const config = getDocumentoTypeConfig(tipo as TipoDocumento);
  return resolveDocumentoTextos(tipo as TipoDocumento, config).singular || tipo;
};

const folioDe = (serie?: string | null, numero?: number | null): string => {
  if (numero === null || numero === undefined) return '—';
  return formatearFolioDocumento(serie || '', numero);
};

const headerCellSx = {
  backgroundColor: '#1d2f68',
  color: '#fff',
  fontWeight: 600,
  fontSize: '13px',
  py: '6px',
};

const bodyCellSx = {
  fontSize: '13px',
  py: '6px',
  borderBottom: '1px solid #e5e7eb',
};

function EmptyState({ mensaje }: { mensaje: string }) {
  return (
    <Box sx={{ py: 4, textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        {mensaje}
      </Typography>
    </Box>
  );
}

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  if (value !== index) return null;
  return (
    <Box role="tabpanel" sx={{ pt: 2 }}>
      {children}
    </Box>
  );
}

interface DocumentoDetalleDrawerProps {
  open: boolean;
  documentoId: number | null;
  tipoDocumento: TipoDocumento;
  onClose: () => void;
}

export default function DocumentoDetalleDrawer({ open, documentoId, tipoDocumento, onClose }: DocumentoDetalleDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DocumentoDetalleResponse | null>(null);
  const [tab, setTab] = useState(0);

  const formatter = useMemo(
    () => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }),
    []
  );

  useEffect(() => {
    if (!open || !documentoId) {
      setData(null);
      setError(null);
      setTab(0);
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
  }, [open, documentoId, tipoDocumento]);

  const documento = data?.documento as any;
  const folio = documento ? folioDe(documento.serie, documento.numero) : '—';
  const nombreContacto = documento?.cliente_nombre || documento?.nombre_receptor || '—';

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{ '& .MuiDrawer-paper': { width: { xs: '100%', md: 820 }, maxWidth: '100%' } }}
    >
      <Box sx={{ p: 3, height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h6" fontWeight={700} color="#1d2f68">
              {etiquetaTipoDocumento(tipoDocumento)} {folio}
            </Typography>
            {documento && (
              <Typography variant="body2" color="text.secondary">
                {nombreContacto}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>

        {loading && (
          <Stack alignItems="center" py={4} spacing={1}>
            <CircularProgress size={32} />
            <Typography variant="body2">Cargando detalle del documento…</Typography>
          </Stack>
        )}

        {!loading && error && <Alert severity="error">{error}</Alert>}

        {!loading && !error && data && (
          <>
            <Tabs
              value={tab}
              onChange={(_e, value) => setTab(value)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ borderBottom: '1px solid #e5e7eb', minHeight: 36 }}
            >
              <Tab label="Resumen" sx={{ minHeight: 36 }} />
              <Tab label="Partidas" sx={{ minHeight: 36 }} />
              <Tab label="Pagos" sx={{ minHeight: 36 }} />
              <Tab label="Notas de crédito" sx={{ minHeight: 36 }} />
              <Tab label="Relacionados" sx={{ minHeight: 36 }} />
              <Tab label="Inventario" sx={{ minHeight: 36 }} />
            </Tabs>

            <TabPanel value={tab} index={0}>
              <ResumenTab documento={documento} formatter={formatter} tipoDocumento={tipoDocumento} folio={folio} />
            </TabPanel>
            <TabPanel value={tab} index={1}>
              <PartidasTab partidas={data.partidas} formatter={formatter} />
            </TabPanel>
            <TabPanel value={tab} index={2}>
              <PagosTab pagos={data.pagos} formatter={formatter} />
            </TabPanel>
            <TabPanel value={tab} index={3}>
              <NotasCreditoTab notasCredito={data.notasCredito} formatter={formatter} />
            </TabPanel>
            <TabPanel value={tab} index={4}>
              <RelacionadosTab documentosRelacionados={data.documentosRelacionados} formatter={formatter} />
            </TabPanel>
            <TabPanel value={tab} index={5}>
              <InventarioTab movimientos={data.movimientosInventario} />
            </TabPanel>
          </>
        )}
      </Box>
    </Drawer>
  );
}

function ResumenTab({
  documento,
  formatter,
  tipoDocumento,
  folio,
}: {
  documento: any;
  formatter: Intl.NumberFormat;
  tipoDocumento: TipoDocumento;
  folio: string;
}) {
  if (!documento) return <EmptyState mensaje="Sin información del documento." />;

  const campos: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'Tipo de documento', value: etiquetaTipoDocumento(tipoDocumento) },
    { label: 'Folio', value: folio },
    { label: 'Cliente / Proveedor', value: documento.cliente_nombre || documento.nombre_receptor || '—' },
    { label: 'Fecha', value: formatDateShort(documento.fecha_documento) },
    { label: 'Agente', value: documento.agente_nombre || '—' },
    { label: 'Estatus', value: <Chip size="small" label={documento.estatus_documento || '—'} /> },
    { label: 'Subtotal', value: formatter.format(Number(documento.subtotal || 0)) },
    { label: 'IVA', value: formatter.format(Number(documento.iva || 0)) },
    { label: 'Total', value: formatter.format(Number(documento.total || 0)) },
  ];

  if (documento.saldo !== null && documento.saldo !== undefined) {
    campos.push({ label: 'Saldo', value: formatter.format(Number(documento.saldo || 0)) });
  }

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

function PartidasTab({ partidas, formatter }: { partidas: DocumentoDetalleResponse['partidas']; formatter: Intl.NumberFormat }) {
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
            <TableCell align="right" sx={headerCellSx}>IVA</TableCell>
            <TableCell align="right" sx={headerCellSx}>Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {partidas.map((partida: any) => {
            const ivaMonto = Array.isArray(partida.impuestos)
              ? partida.impuestos.reduce((sum: number, imp: any) => sum + Number(imp.monto || 0), 0)
              : 0;
            return (
              <TableRow key={partida.id}>
                <TableCell sx={bodyCellSx}>{partida.producto_clave || '—'}</TableCell>
                <TableCell sx={bodyCellSx}>
                  {partida.producto_descripcion || partida.descripcion_alterna || '—'}
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
                <TableCell align="right" sx={bodyCellSx}>{formatter.format(ivaMonto)}</TableCell>
                <TableCell align="right" sx={bodyCellSx}>{formatter.format(Number(partida.total_partida || 0))}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function PagosTab({ pagos, formatter }: { pagos: PagoAplicado[]; formatter: Intl.NumberFormat }) {
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

const MOTIVO_NC_LABEL: Record<string, string> = {
  devolucion: 'Devolución',
  bonificacion: 'Bonificación',
  otro: 'Otro',
};

function NotasCreditoTab({ notasCredito, formatter }: { notasCredito: NotaCreditoAplicada[]; formatter: Intl.NumberFormat }) {
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

function RelacionadosTab({
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

function InventarioTab({ movimientos }: { movimientos: MovimientoInventarioDocumento[] }) {
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
