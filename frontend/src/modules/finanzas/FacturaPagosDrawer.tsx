import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Dialog,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  crearAplicacion,
  eliminarAplicacion,
  fetchAplicacionesDocumento,
  fetchEstadoCuenta,
  fetchSaldoDocumento,
} from '../../services/finanzasService';
import { getDocumento } from '../../services/documentosService';
import type {
  AplicacionOperacion,
  DocumentoSaldo,
  EstadoCuentaItem,
} from '../../types/finanzas';
import type { TipoDocumento } from '../../types/documentos.types';
import { formatearFolioDocumento } from '../../utils/documentos.utils';
import DocumentosFormPage from '../../pages/DocumentosFormPage';

const formatDateShort = (value?: string | null) => {
  if (!value) return '';
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

const toCivilDate = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

type DocumentoDrawerMeta = {
  folio: string;
  fechaDocumento: string;
  contactoNombre: string;
  empresaId: number | null;
  moneda: string;
};

const ETIQUETAS_TIPO_DOCUMENTO: Record<string, string> = {
  factura: 'Factura',
  factura_compra: 'Factura de compra',
  nota_credito: 'Nota de crédito',
  nota_credito_compra: 'Nota de crédito de compra',
  pago_cliente: 'Pago',
  pago_proveedor: 'Pago',
  ajuste_cliente: 'Ajuste de saldo',
  ajuste_proveedor: 'Ajuste de saldo',
};
const etiquetaTipo = (tipo: string) => ETIQUETAS_TIPO_DOCUMENTO[String(tipo).toLowerCase()] ?? tipo;

const TIPOS_DOCUMENTO_ORIGEN_COMPATIBLES: Record<string, string[]> = {
  factura: ['nota_credito', 'pago_cliente', 'ajuste_cliente'],
  factura_compra: ['nota_credito_compra', 'pago_proveedor', 'ajuste_proveedor'],
  nota_credito: ['factura'],
  nota_credito_compra: ['factura_compra'],
};

interface FacturaPagosDrawerProps {
  open: boolean;
  onClose: () => void;
  documentoId: number;
  contactoId: number;
  saldo: number;
  tipoDocumento?: string | null;
}

export function FacturaPagosDrawer({ open, onClose, documentoId, contactoId, saldo, tipoDocumento }: FacturaPagosDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [saldoDocumento, setSaldoDocumento] = useState<DocumentoSaldo | null>(null);
  const [aplicaciones, setAplicaciones] = useState<AplicacionOperacion[]>([]);
  const [documentosDisponibles, setDocumentosDisponibles] = useState<EstadoCuentaItem[]>([]);
  const [montosDocumento, setMontosDocumento] = useState<Record<number, string>>({});
  const [applyingDocumentoId, setApplyingDocumentoId] = useState<number | null>(null);
  const [deletingAplicacionId, setDeletingAplicacionId] = useState<number | null>(null);
  const [autoApplying, setAutoApplying] = useState(false);
  const [openNuevoPago, setOpenNuevoPago] = useState(false);
  const [openNuevoAjuste, setOpenNuevoAjuste] = useState(false);
  const [documentoMeta, setDocumentoMeta] = useState<DocumentoDrawerMeta | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'success' }
  );

  const formatter = useMemo(
    () => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }),
    []
  );

  const tipoDocumentoNormalizado = String(tipoDocumento ?? '').toLowerCase();
  const esNotaCredito = tipoDocumentoNormalizado === 'nota_credito' || tipoDocumentoNormalizado === 'nota_credito_compra';
  const tipoNuevoPago = useMemo<TipoDocumento | null>(() => {
    if (esNotaCredito) return null;
    return tipoDocumentoNormalizado === 'factura_compra' ? 'pago_proveedor' : 'pago_cliente';
  }, [esNotaCredito, tipoDocumentoNormalizado]);
  const tipoNuevoAjuste = useMemo<TipoDocumento | null>(() => {
    if (esNotaCredito) return null;
    return tipoDocumentoNormalizado === 'factura_compra' ? 'ajuste_proveedor' : 'ajuste_cliente';
  }, [esNotaCredito, tipoDocumentoNormalizado]);
  const encabezadoPendientes = esNotaCredito ? 'Documentos de cargo pendientes' : 'Documentos de abono disponibles';
  const descripcionPendientes = esNotaCredito
    ? 'Selecciona un documento de cargo y aplica un monto al saldo disponible.'
    : 'Selecciona un abono y aplícalo al saldo pendiente.';
  const ariaPendientes = esNotaCredito ? 'Documentos de cargo pendientes' : 'Facturas pendientes';
  const emptyPendientes = esNotaCredito ? 'No hay documentos de cargo pendientes' : 'No hay documentos de abono disponibles';
  const etiquetaDocumento = esNotaCredito ? (tipoDocumento === 'nota_credito_compra' ? 'Nota de credito de compra' : 'Nota de credito') : 'Documento';
  const esModuloCompras = tipoDocumentoNormalizado === 'factura_compra' || tipoDocumentoNormalizado === 'nota_credito_compra' || tipoDocumentoNormalizado === 'pago_proveedor' || tipoDocumentoNormalizado === 'ajuste_proveedor';
  const etiquetaContacto = esModuloCompras ? 'Proveedor' : 'Cliente';
  const documentosCompatibles = useMemo(() => TIPOS_DOCUMENTO_ORIGEN_COMPATIBLES[tipoDocumentoNormalizado] ?? [], [tipoDocumentoNormalizado]);

  const effectiveSaldo = Number(saldoDocumento?.saldo ?? saldo ?? 0);

  const refreshDocumentoFinanzas = async () => {
    const [saldoData, aplicacionesData] = await Promise.all([
      fetchSaldoDocumento(documentoId),
      fetchAplicacionesDocumento(documentoId),
    ]);
    setSaldoDocumento(saldoData);
    setAplicaciones(aplicacionesData ?? []);
    return saldoData;
  };

  const loadDocumentosDisponibles = async (
    saldoActual: number,
    monedaSaldo: string,
    options?: { focusDocumentoId?: number | null }
  ) => {
    if (!contactoId || saldoActual <= 0) {
      setDocumentosDisponibles([]);
      return;
    }
    const estadoCuenta = await fetchEstadoCuenta(contactoId);
    const documentos = (estadoCuenta ?? [])
      .filter((item) => item.origen === 'documento' && Number(item.saldo ?? 0) > 0)
      .filter((item) => documentosCompatibles.includes(String(item.tipo ?? '').toLowerCase()))
      .filter((item) => Number(item.id) !== Number(documentoId))
      .filter((item) => String(item.moneda ?? '').trim().toUpperCase() === String(monedaSaldo).trim().toUpperCase())
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    const focusDocumentoId = Number(options?.focusDocumentoId ?? 0);
    const documentosOrdenados = focusDocumentoId > 0
      ? [
          ...documentos.filter((item) => Number(item.id) === focusDocumentoId),
          ...documentos.filter((item) => Number(item.id) !== focusDocumentoId),
        ]
      : documentos;

    setDocumentosDisponibles(documentosOrdenados);

    if (focusDocumentoId > 0) {
      const documentoCreado = documentosOrdenados.find((item) => Number(item.id) === focusDocumentoId);
      if (documentoCreado && Number(documentoCreado.saldo ?? 0) > 0) {
        const montoSugerido = Math.min(saldoActual, Number(documentoCreado.saldo ?? 0));
        setMontosDocumento((prev) => ({ ...prev, [focusDocumentoId]: montoSugerido.toFixed(2) }));
      }
    }
  };

  const loadAll = async () => {
    if (!open || !documentoId || !contactoId) return;
    try {
      setLoading(true);
      const [saldoData, documentoData] = await Promise.all([
        refreshDocumentoFinanzas(),
        tipoDocumento ? getDocumento(documentoId, tipoDocumento as TipoDocumento) : Promise.resolve(null),
      ]);
      setDocumentoMeta(documentoData ? {
        folio: formatearFolioDocumento(documentoData.documento?.serie || '', documentoData.documento?.numero || 0),
        fechaDocumento: documentoData.documento?.fecha_documento || '',
        contactoNombre: String(
          (documentoData.documento as any)?.nombre_cliente ||
          (documentoData.documento as any)?.cliente_nombre ||
          documentoData.documento?.nombre_receptor ||
          ''
        ).trim(),
        empresaId: Number(documentoData.documento?.empresa_id ?? 0) || null,
        moneda: String(documentoData.documento?.moneda || saldoData?.moneda || 'MXN'),
      } : null);
      await loadDocumentosDisponibles(Number(saldoData?.saldo ?? saldo ?? 0), saldoData?.moneda ?? saldoDocumento?.moneda ?? 'MXN');
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo cargar la información de pagos', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setMontosDocumento({});
      setDocumentosDisponibles([]);
      setDocumentoMeta(null);
      setOpenNuevoPago(false);
      setOpenNuevoAjuste(false);
      return;
    }
    void loadAll();
  }, [open, documentoId, contactoId, tipoDocumento]);

  useEffect(() => {
    if (!open) return;
    setSaldoDocumento((prev) => (prev ? prev : { id: documentoId, empresa_id: 0, tipo_documento: 'factura', moneda: 'MXN', total: saldo, saldo }));
  }, [open, documentoId, saldo]);

  const handleApplyDocumento = async (doc: EstadoCuentaItem) => {
    const raw = montosDocumento[doc.id] ?? '';

    let monto: number;

    if (raw === '' || raw === null) {
      const saldoDestino = Number(doc.saldo ?? 0);
      if (saldoDestino <= 0) {
        setSnackbar({ open: true, message: 'Saldo del documento agotado', severity: 'error' });
        return;
      }
      if (effectiveSaldo <= 0) {
        setSnackbar({ open: true, message: 'No hay saldo disponible para aplicar', severity: 'error' });
        return;
      }
      monto = Math.min(effectiveSaldo, saldoDestino);
    } else {
      monto = Number(raw);
      if (!monto || Number.isNaN(monto) || monto <= 0) {
        setSnackbar({ open: true, message: 'Ingresa un monto valido (> 0)', severity: 'error' });
        return;
      }
      if (doc.saldo !== null && monto > Number(doc.saldo)) {
        setSnackbar({ open: true, message: 'El monto excede el saldo del documento', severity: 'error' });
        return;
      }
      if (monto > effectiveSaldo) {
        setSnackbar({ open: true, message: 'El monto excede el saldo documental disponible', severity: 'error' });
        return;
      }
    }

    const documentoOrigenId = esNotaCredito ? documentoId : doc.id;
    const documentoDestinoId = esNotaCredito ? doc.id : documentoId;
    const successMessage = esNotaCredito ? 'Aplicacion registrada' : 'Abono aplicado correctamente';
    const errorMessage = esNotaCredito ? 'No se pudo aplicar la nota de credito' : 'No se pudo aplicar el documento de abono';

    try {
      setApplyingDocumentoId(doc.id);
      await crearAplicacion({
        documento_origen_id: documentoOrigenId,
        documento_destino_id: documentoDestinoId,
        monto,
        monto_moneda_documento: monto,
        fecha_aplicacion: toCivilDate(),
      });
      setSnackbar({ open: true, message: successMessage, severity: 'success' });
      setMontosDocumento((prev) => ({ ...prev, [doc.id]: '' }));
      const saldoData = await refreshDocumentoFinanzas();
      await loadDocumentosDisponibles(Number(saldoData?.saldo ?? 0), saldoData?.moneda ?? saldoDocumento?.moneda ?? 'MXN');
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || errorMessage, severity: 'error' });
    } finally {
      setApplyingDocumentoId(null);
    }
  };

  const handleAutoApplyNotaCredito = async () => {
    if (!esNotaCredito || effectiveSaldo <= 0 || documentosDisponibles.length === 0) return;
    let disponible = effectiveSaldo;
    const pendientesOrdenados = [...documentosDisponibles].sort((a, b) => a.fecha.localeCompare(b.fecha));
    try {
      setAutoApplying(true);
      for (const doc of pendientesOrdenados) {
        if (disponible <= 0) break;
        const saldoDestino = Number(doc.saldo ?? 0);
        const aplicar = Math.min(disponible, saldoDestino);
        if (aplicar <= 0) continue;
        await crearAplicacion({
          documento_origen_id: documentoId,
          documento_destino_id: doc.id,
          monto: aplicar,
          monto_moneda_documento: aplicar,
          fecha_aplicacion: toCivilDate(),
        });
        disponible -= aplicar;
      }
      const saldoData = await refreshDocumentoFinanzas();
      await loadDocumentosDisponibles(Number(saldoData?.saldo ?? 0), saldoData?.moneda ?? saldoDocumento?.moneda ?? 'MXN');
      setSnackbar({ open: true, message: 'Aplicacion automatica completada', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo aplicar automaticamente', severity: 'error' });
    } finally {
      setAutoApplying(false);
    }
  };

  const handleDeleteAplicacion = async (id: number) => {
    try {
      setDeletingAplicacionId(id);
      await eliminarAplicacion(id);
      setSnackbar({ open: true, message: 'Aplicación eliminada', severity: 'success' });
      const saldoData = await refreshDocumentoFinanzas();
      await loadDocumentosDisponibles(Number(saldoData?.saldo ?? 0), saldoData?.moneda ?? saldoDocumento?.moneda ?? 'MXN');
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo eliminar la aplicación', severity: 'error' });
    } finally {
      setDeletingAplicacionId(null);
    }
  };

  const handleNuevoPagoGuardado = async (nuevoDocumentoId: number) => {
    try {
      setOpenNuevoPago(false);
      const saldoData = await refreshDocumentoFinanzas();
      await loadDocumentosDisponibles(
        Number(saldoData?.saldo ?? saldo ?? 0),
        saldoData?.moneda ?? documentoMeta?.moneda ?? saldoDocumento?.moneda ?? 'MXN',
        { focusDocumentoId: nuevoDocumentoId }
      );
      setSnackbar({ open: true, message: 'Pago creado. Ya puedes aplicarlo desde esta misma ventana.', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'El pago se guardo, pero no se pudo refrescar la lista.', severity: 'info' });
    }
  };

  const handleNuevoAjusteGuardado = async (nuevoDocumentoId: number) => {
    try {
      setOpenNuevoAjuste(false);
      const saldoData = await refreshDocumentoFinanzas();
      await loadDocumentosDisponibles(
        Number(saldoData?.saldo ?? saldo ?? 0),
        saldoData?.moneda ?? documentoMeta?.moneda ?? saldoDocumento?.moneda ?? 'MXN',
        { focusDocumentoId: nuevoDocumentoId }
      );
      setSnackbar({ open: true, message: 'Ajuste creado. Ya puedes aplicarlo desde esta misma ventana.', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'El ajuste se guardo, pero no se pudo refrescar la lista.', severity: 'info' });
    }
  };

  const headerCellSx = {
    backgroundColor: '#1d2f68',
    color: '#fff',
    fontWeight: 600,
    fontSize: '14px',
    py: '6px',
  };

  const bodyCellSx = {
    fontSize: '14px',
    py: '6px',
    borderBottom: '1px solid #e5e7eb',
  };

  const rowBaseSx = { height: 26, '&:hover': { backgroundColor: '#eef5ff' } };

  const headerTitle = esNotaCredito
    ? `${etiquetaDocumento} ${documentoMeta?.folio || ''}`.trim()
    : `Aplicar saldo a ${documentoMeta?.folio || `documento #${documentoId}`}`;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100%', md: 760 },
          maxWidth: '100%',
        },
      }}
    >
      <Box sx={{ p: 3, height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" fontWeight={700} color="#1d2f68">
              {headerTitle}
            </Typography>
            {esNotaCredito ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.25, sm: 2 }} mt={0.5}>
                <Typography variant="body2" color="text.secondary">
                  {etiquetaContacto}: <strong>{documentoMeta?.contactoNombre || '—'}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Fecha: {documentoMeta?.fechaDocumento ? formatDateShort(documentoMeta.fechaDocumento) : '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Saldo disponible: {formatter.format(effectiveSaldo)}
                </Typography>
              </Stack>
            ) : (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.25, sm: 2 }} mt={0.5}>
                <Typography variant="body2" color="text.secondary">
                  {etiquetaContacto}: <strong>{documentoMeta?.contactoNombre || '—'}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Fecha: {documentoMeta?.fechaDocumento ? formatDateShort(documentoMeta.fechaDocumento) : '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Saldo pendiente: {formatter.format(effectiveSaldo)}
                </Typography>
              </Stack>
            )}
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>

        <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 2, p: 2, backgroundColor: '#f8fafc' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                {esNotaCredito ? 'Saldo disponible' : 'Saldo pendiente'}
              </Typography>
              <Typography variant="h6" fontWeight={700} color={effectiveSaldo > 0 ? '#b45309' : '#15803d'}>
                {formatter.format(effectiveSaldo)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                {esNotaCredito ? 'Aplicaciones registradas' : 'Pagos aplicados'}
              </Typography>
              <Typography variant="h6" fontWeight={700} color="#1d2f68">
                {aplicaciones.length}
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Stack spacing={1}>
          <Typography variant="subtitle1" fontWeight={700} color="#1d2f68">
            Aplicaciones registradas
          </Typography>
          {esNotaCredito ? (
            <Typography variant="body2" color="text.secondary">
              Documentos a los que ya se aplico esta nota de credito.
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Documentos de abono que ya fueron aplicados a este documento.
            </Typography>
          )}
          <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
            <Table size="small" aria-label="Aplicaciones registradas">
              <TableHead>
                <TableRow>
                  <TableCell sx={headerCellSx}>{esNotaCredito ? 'Documento' : 'Origen'}</TableCell>
                  <TableCell sx={headerCellSx}>Fecha</TableCell>
                  <TableCell align="right" sx={headerCellSx}>Monto aplicado</TableCell>
                  <TableCell align="center" sx={{ ...headerCellSx, width: 40 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {aplicaciones.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 2, color: 'text.secondary' }}>
                      Sin aplicaciones registradas
                    </TableCell>
                  </TableRow>
                )}
                {aplicaciones.map((item) => {
                  const folio = formatearFolioDocumento(item?.serie || '', item?.numero || 0);
                  const tipoRelacionado = item.tipo_documento || item.tipo_documento_origen || item.tipo_documento_destino || 'Documento';
                  const labelRelacionado = etiquetaTipo(tipoRelacionado);
                  return (
                    <TableRow key={item.id}>
                      <TableCell sx={bodyCellSx}>{folio ? `${labelRelacionado} ${folio}` : labelRelacionado}</TableCell>
                      <TableCell sx={bodyCellSx}>{formatDateShort(item.fecha_documento || item.fecha_aplicacion || item.fecha_creacion)}</TableCell>
                      <TableCell align="right" sx={bodyCellSx}>{formatter.format(Number(item.monto_moneda_documento || item.monto || 0))}</TableCell>
                      <TableCell align="center" sx={{ ...bodyCellSx, py: '2px', width: 40 }}>
                        <Tooltip title="Eliminar aplicación">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteAplicacion(Number(item.id))}
                              disabled={deletingAplicacionId === Number(item.id)}
                              sx={{ p: 0.25 }}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>

        <Divider />

        {loading ? (
          <Stack alignItems="center" py={4} spacing={1}>
            <CircularProgress size={32} />
            <Typography variant="body2">Cargando información de pagos…</Typography>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Stack spacing={1} mt={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} color="#1d2f68">
                    {encabezadoPendientes}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {descripcionPendientes}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  {!esNotaCredito && tipoNuevoAjuste && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setOpenNuevoAjuste(true)}
                      sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                    >
                      Nuevo ajuste
                    </Button>
                  )}
                  {!esNotaCredito && tipoNuevoPago && (
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => setOpenNuevoPago(true)}
                      sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                    >
                      Nuevo pago
                    </Button>
                  )}
                  {esNotaCredito && documentosDisponibles.length > 0 && effectiveSaldo > 0 && (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleAutoApplyNotaCredito}
                      disabled={autoApplying}
                      sx={{ textTransform: 'none' }}
                    >
                      {autoApplying ? 'Aplicando…' : 'Aplicar automaticamente'}
                    </Button>
                  )}
                </Stack>
              </Stack>
              <Box sx={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
                <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 2, maxHeight: 340, boxShadow: 'none' }}>
                  <Table size="small" stickyHeader aria-label={ariaPendientes} sx={{ width: '100%', minWidth: 0 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ ...headerCellSx, width: '24%' }}>Documento</TableCell>
                        <TableCell sx={{ ...headerCellSx, width: '16%' }}>Fecha</TableCell>
                        <TableCell align="right" sx={{ ...headerCellSx, width: '14%' }}>Total</TableCell>
                        <TableCell align="right" sx={{ ...headerCellSx, width: '14%' }}>Saldo</TableCell>
                        <TableCell sx={{ ...headerCellSx, width: '22%' }}>Monto a aplicar</TableCell>
                        <TableCell align="center" sx={{ ...headerCellSx, width: '10%' }}>Accion</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {documentosDisponibles.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                            <Stack spacing={0.5} alignItems="center">
                              <Typography variant="body1" fontWeight={600} color="#1f2937">
                                {emptyPendientes}
                              </Typography>
                              {!esNotaCredito && (tipoNuevoPago || tipoNuevoAjuste) && (
                                <Typography variant="body2" color="text.secondary">
                                  Usa los botones de arriba para crear un pago o ajuste de saldo.
                                </Typography>
                              )}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      )}
                      {documentosDisponibles.map((item, idx) => {
                        const folio = formatearFolioDocumento(item?.serie || '', item?.numero || 0);
                        const label = `${etiquetaTipo(item.tipo || 'documento')} ${folio}`.trim();
                        const backgroundColor = idx % 2 === 0 ? '#f4faf4' : '#ffffff';
                        return (
                          <TableRow key={item.id} sx={{ ...rowBaseSx, backgroundColor }}>
                            <TableCell sx={{ ...bodyCellSx, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '24%' }}>
                              {label || '—'}
                            </TableCell>
                            <TableCell sx={{ ...bodyCellSx, width: '16%' }}>{formatDateShort(item.fecha)}</TableCell>
                            <TableCell align="right" sx={{ ...bodyCellSx, width: '14%' }}>{formatter.format(Number(item.monto || 0))}</TableCell>
                            <TableCell align="right" sx={{ ...bodyCellSx, width: '14%' }}>{formatter.format(Number(item.saldo || 0))}</TableCell>
                            <TableCell sx={{ ...bodyCellSx, py: '2px', width: '22%' }}>
                              <TextField
                                size="small"
                                type="number"
                                value={montosDocumento[item.id] ?? ''}
                                onChange={(e) => setMontosDocumento((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                fullWidth
                                inputProps={{ min: 0, step: '0.01', style: { MozAppearance: 'textfield' } }}
                                sx={{
                                  '& .MuiInputBase-root': {
                                    height: 22,
                                    fontSize: '12px',
                                    px: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    backgroundColor: '#fff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 1,
                                  },
                                  '& .MuiInputBase-input': {
                                    py: 0.2,
                                    fontSize: '12px',
                                    lineHeight: 1.15,
                                    textAlign: 'right',
                                  },
                                  '& input[type=number]': {
                                    MozAppearance: 'textfield',
                                  },
                                  '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                                    WebkitAppearance: 'none',
                                    margin: 0,
                                  },
                                }}
                              />
                            </TableCell>
                            <TableCell align="center" sx={{ ...bodyCellSx, py: '2px', width: '10%' }}>
                              <Tooltip title="Aplicar monto (o saldo si esta vacio)">
                                <span>
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => handleApplyDocumento(item)}
                                    disabled={applyingDocumentoId === item.id || effectiveSaldo <= 0}
                                    sx={{ p: 0.25, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  >
                                    <LinkIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Stack>
          </Stack>
        )}

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>

        {!esNotaCredito && tipoNuevoPago && openNuevoPago ? (
          <Dialog
            open={openNuevoPago}
            onClose={() => setOpenNuevoPago(false)}
            maxWidth="lg"
            fullWidth
            fullScreen={false}
          >
            <DialogTitle sx={{ pb: 0 }}>
              {tipoNuevoPago === 'pago_proveedor' ? 'Nuevo pago a proveedor' : 'Nuevo pago de cliente'}
            </DialogTitle>
            <DialogContent sx={{ p: 0 }}>
              <DocumentosFormPage
                tipoDocumento={tipoNuevoPago}
                embedded
                initialValues={{
                  empresa_id: documentoMeta?.empresaId ?? undefined,
                  contacto_principal_id: contactoId,
                  fecha_documento: toCivilDate(),
                  moneda: documentoMeta?.moneda || saldoDocumento?.moneda || 'MXN',
                }}
                lockedFields={{ contacto_principal_id: true }}
                onEmbeddedClose={() => setOpenNuevoPago(false)}
                onEmbeddedSaved={(savedDocumentoId) => {
                  void handleNuevoPagoGuardado(savedDocumentoId);
                }}
              />
            </DialogContent>
          </Dialog>
        ) : null}

        {!esNotaCredito && tipoNuevoAjuste && openNuevoAjuste ? (
          <Dialog
            open={openNuevoAjuste}
            onClose={() => setOpenNuevoAjuste(false)}
            maxWidth="lg"
            fullWidth
            fullScreen={false}
          >
            <DialogTitle sx={{ pb: 0 }}>
              {tipoNuevoAjuste === 'ajuste_proveedor' ? 'Nuevo ajuste de saldo a proveedor' : 'Nuevo ajuste de saldo de cliente'}
            </DialogTitle>
            <DialogContent sx={{ p: 0 }}>
              <DocumentosFormPage
                tipoDocumento={tipoNuevoAjuste}
                embedded
                initialValues={{
                  empresa_id: documentoMeta?.empresaId ?? undefined,
                  contacto_principal_id: contactoId,
                  fecha_documento: toCivilDate(),
                  moneda: documentoMeta?.moneda || saldoDocumento?.moneda || 'MXN',
                }}
                lockedFields={{ contacto_principal_id: true }}
                onEmbeddedClose={() => setOpenNuevoAjuste(false)}
                onEmbeddedSaved={(savedDocumentoId) => {
                  void handleNuevoAjusteGuardado(savedDocumentoId);
                }}
              />
            </DialogContent>
          </Dialog>
        ) : null}
      </Box>
    </Drawer>
  );
}

export default FacturaPagosDrawer;