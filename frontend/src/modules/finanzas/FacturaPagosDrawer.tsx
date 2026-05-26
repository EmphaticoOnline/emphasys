import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  MenuItem,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LinkIcon from '@mui/icons-material/Link';
import {
  crearAplicacion,
  crearOperacion,
  fetchAplicacionesDocumento,
  fetchCuentas,
  fetchEstadoCuenta,
  fetchOperacionDetalle,
  fetchOperacionDisponible,
  fetchSaldoDocumento,
} from '../../services/finanzasService';
import { getDocumento } from '../../services/documentosService';
import type {
  AplicacionOperacion,
  DocumentoSaldo,
  EstadoCuentaItem,
  FinanzasCuenta,
  FinanzasOperacion,
  OperacionDisponible,
} from '../../types/finanzas';
import type { TipoDocumento } from '../../types/documentos.types';
import { formatearFolioDocumento } from '../../utils/documentos.utils';

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const formatDateShort = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split('-');
    const month = MONTHS_SHORT[Number(m) - 1] || m;
    return `${d}-${month}-${y}`;
  }
  if (Number.isNaN(parsed.getTime())) return value;
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = MONTHS_SHORT[parsed.getMonth()] || String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}-${month}-${year}`;
};

type OperacionDisponibleRow = {
  operacion: FinanzasOperacion;
  disponible: OperacionDisponible;
};

type DocumentoDrawerMeta = {
  folio: string;
  fechaDocumento: string;
  contactoNombre: string;
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
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cuentas, setCuentas] = useState<FinanzasCuenta[]>([]);
  const [saldoDocumento, setSaldoDocumento] = useState<DocumentoSaldo | null>(null);
  const [aplicaciones, setAplicaciones] = useState<AplicacionOperacion[]>([]);
  const [operacionesDisponibles, setOperacionesDisponibles] = useState<OperacionDisponibleRow[]>([]);
  const [documentosDisponibles, setDocumentosDisponibles] = useState<EstadoCuentaItem[]>([]);
  const [selectedOperacionId, setSelectedOperacionId] = useState<number | null>(null);
  const [montoExistente, setMontoExistente] = useState('');
  const [montosDocumento, setMontosDocumento] = useState<Record<number, string>>({});
  const [applyingDocumentoId, setApplyingDocumentoId] = useState<number | null>(null);
  const [autoApplying, setAutoApplying] = useState(false);
  const [documentoMeta, setDocumentoMeta] = useState<DocumentoDrawerMeta | null>(null);
  const [nuevoPago, setNuevoPago] = useState({
    cuenta_id: '',
    fecha: new Date().toISOString().slice(0, 10),
    monto: '',
    referencia: '',
    observaciones: '',
  });
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'success' }
  );

  const formatter = useMemo(
    () => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }),
    []
  );

  const esNotaCredito = String(tipoDocumento ?? '').toLowerCase() === 'nota_credito' || String(tipoDocumento ?? '').toLowerCase() === 'nota_credito_compra';
  const tituloTipo = esNotaCredito ? 'Tipo: Nota de crédito' : 'Tipo de movimiento';
  const valorTipo = esNotaCredito ? 'Nota de crédito' : 'Depósito';
  const encabezadoPendientes = esNotaCredito ? 'Documentos de cargo pendientes' : 'Facturas pendientes';
  const descripcionPendientes = esNotaCredito
    ? 'Selecciona un documento de cargo y aplica un monto al saldo disponible.'
    : 'Selecciona una factura y aplica un monto al documento.';
  const ariaPendientes = esNotaCredito ? 'Documentos de cargo pendientes' : 'Facturas pendientes';
  const emptyPendientes = esNotaCredito ? 'No hay documentos de cargo pendientes' : 'No hay facturas pendientes';
  const candidatosCargo = useMemo(
    () => (esNotaCredito ? documentosDisponibles : []),
    [documentosDisponibles, esNotaCredito]
  );
  const etiquetaDocumento = esNotaCredito ? (tipoDocumento === 'nota_credito_compra' ? 'Nota de credito de compra' : 'Nota de credito') : 'Documento';
  const etiquetaContacto = tipoDocumento === 'nota_credito_compra' ? 'Proveedor' : 'Cliente';

  const selectedOperacion = useMemo(
    () => operacionesDisponibles.find((item) => item.operacion.id === selectedOperacionId) || null,
    [operacionesDisponibles, selectedOperacionId]
  );

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

  const loadOperacionesDisponibles = async (saldoActual: number, monedaSaldo: string) => {
    if (!contactoId || saldoActual <= 0) {
      setOperacionesDisponibles([]);
      setDocumentosDisponibles([]);
      return;
    }
    const estadoCuenta = await fetchEstadoCuenta(contactoId);
    if (esNotaCredito) {
      const documentos = (estadoCuenta ?? [])
        .filter((item) => item.origen === 'documento' && Number(item.saldo ?? 0) > 0)
        .filter((item) => ['factura', 'factura_compra'].includes(String(item.tipo ?? '').toLowerCase()))
        .filter((item) => Number(item.id) !== Number(documentoId))
        .filter((item) => String(item.moneda ?? '').trim().toUpperCase() === String(monedaSaldo).trim().toUpperCase());

      setDocumentosDisponibles(documentos);
      return;
    }

    const operaciones = (estadoCuenta ?? []).filter((item) => item.origen === 'operacion' && item.tipo === 'Deposito');
    const operationIds = Array.from(new Set(operaciones.map((item) => item.id)));

    const rows = await Promise.all(
      operationIds.map(async (operacionId) => {
        try {
          const [operacion, disponible] = await Promise.all([
            fetchOperacionDetalle(operacionId),
            fetchOperacionDisponible(operacionId),
          ]);
          if (operacion.naturaleza_operacion !== 'cobro_cliente') return null;
          if (Number(disponible?.monto_disponible ?? 0) <= 0) return null;
          return { operacion, disponible };
        } catch {
          return null;
        }
      })
    );

    const filtered = rows
      .filter((item): item is OperacionDisponibleRow => Boolean(item))
      .sort((a, b) => a.operacion.fecha.localeCompare(b.operacion.fecha));

    setOperacionesDisponibles(filtered);

    if (!filtered.some((item) => item.operacion.id === selectedOperacionId)) {
      setSelectedOperacionId(filtered[0]?.operacion.id ?? null);
      setMontoExistente('');
    }
  };

  const loadAll = async () => {
    if (!open || !documentoId || !contactoId) return;
    try {
      setLoading(true);
      const [saldoData, cuentasData, documentoData] = await Promise.all([
        refreshDocumentoFinanzas(),
        fetchCuentas(),
        tipoDocumento ? getDocumento(documentoId, tipoDocumento as TipoDocumento) : Promise.resolve(null),
      ]);
      setCuentas(cuentasData ?? []);
      setDocumentoMeta(documentoData ? {
        folio: formatearFolioDocumento(documentoData.documento?.serie || '', documentoData.documento?.numero || 0),
        fechaDocumento: documentoData.documento?.fecha_documento || '',
        contactoNombre: String((documentoData.documento as any)?.nombre_cliente || documentoData.documento?.nombre_receptor || '').trim(),
      } : null);
      const saldoActual = Number(saldoData?.saldo ?? saldo ?? 0);
      setNuevoPago((prev) => ({
        ...prev,
        monto: saldoActual > 0 ? String(saldoActual) : '',
        cuenta_id: prev.cuenta_id || String(cuentasData?.[0]?.id ?? ''),
      }));
      await loadOperacionesDisponibles(saldoActual, saldoData?.moneda ?? saldoDocumento?.moneda ?? 'MXN');
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo cargar la información de pagos', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setTab(0);
      setSelectedOperacionId(null);
      setMontoExistente('');
      setMontosDocumento({});
      setOperacionesDisponibles([]);
      setDocumentosDisponibles([]);
      setDocumentoMeta(null);
      return;
    }
    void loadAll();
  }, [open, documentoId, contactoId, tipoDocumento]);

  useEffect(() => {
    if (!open) return;
    setSaldoDocumento((prev) => (prev ? prev : { id: documentoId, empresa_id: 0, tipo_documento: 'factura', moneda: 'MXN', total: saldo, saldo }));
  }, [open, documentoId, saldo]);

  const handleApplyExisting = async () => {
    if (!selectedOperacion) {
      setSnackbar({ open: true, message: 'Selecciona un pago existente', severity: 'error' });
      return;
    }
    const disponibleOrigen = Number(selectedOperacion?.disponible.monto_disponible ?? 0);
    const monto = Number(montoExistente || Math.min(effectiveSaldo, disponibleOrigen));
    if (!monto || Number.isNaN(monto) || monto <= 0) {
      setSnackbar({ open: true, message: 'Ingresa un monto válido', severity: 'error' });
      return;
    }
    if (monto > disponibleOrigen) {
      setSnackbar({ open: true, message: 'El monto excede el disponible del pago', severity: 'error' });
      return;
    }
    if (monto > effectiveSaldo) {
      setSnackbar({ open: true, message: 'El monto excede el saldo de la factura', severity: 'error' });
      return;
    }

    try {
      setApplying(true);
      await crearAplicacion({
        finanzas_operacion_id: selectedOperacion?.operacion.id ?? 0,
        documento_destino_id: documentoId,
        monto,
        monto_moneda_documento: monto,
        fecha_aplicacion: new Date().toISOString().slice(0, 10),
      });
      const saldoData = await refreshDocumentoFinanzas();
      await loadOperacionesDisponibles(Number(saldoData?.saldo ?? 0), saldoData?.moneda ?? saldoDocumento?.moneda ?? 'MXN');
      setMontoExistente('');
      setSnackbar({ open: true, message: 'Pago aplicado correctamente', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo aplicar el pago', severity: 'error' });
    } finally {
      setApplying(false);
    }
  };

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
        setSnackbar({ open: true, message: 'El monto excede el saldo disponible de la nota de credito', severity: 'error' });
        return;
      }
    }

    try {
      setApplyingDocumentoId(doc.id);
      await crearAplicacion({
        documento_origen_id: documentoId,
        documento_destino_id: doc.id,
        monto,
        monto_moneda_documento: monto,
        fecha_aplicacion: new Date().toISOString().slice(0, 10),
      });
      setSnackbar({ open: true, message: 'Aplicacion registrada', severity: 'success' });
      setMontosDocumento((prev) => ({ ...prev, [doc.id]: '' }));
      const saldoData = await refreshDocumentoFinanzas();
      await loadOperacionesDisponibles(Number(saldoData?.saldo ?? 0), saldoData?.moneda ?? saldoDocumento?.moneda ?? 'MXN');
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo aplicar la nota de credito', severity: 'error' });
    } finally {
      setApplyingDocumentoId(null);
    }
  };

  const handleAutoApplyNotaCredito = async () => {
    if (!esNotaCredito || effectiveSaldo <= 0 || candidatosCargo.length === 0) return;
    let disponible = effectiveSaldo;
    const pendientesOrdenados = [...candidatosCargo].sort((a, b) => a.fecha.localeCompare(b.fecha));
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
          fecha_aplicacion: new Date().toISOString().slice(0, 10),
        });
        disponible -= aplicar;
      }
      const saldoData = await refreshDocumentoFinanzas();
      await loadOperacionesDisponibles(Number(saldoData?.saldo ?? 0), saldoData?.moneda ?? saldoDocumento?.moneda ?? 'MXN');
      setSnackbar({ open: true, message: 'Aplicacion automatica completada', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo aplicar automaticamente', severity: 'error' });
    } finally {
      setAutoApplying(false);
    }
  };

  const handleCreateAndApply = async () => {
    if (esNotaCredito) {
      setSnackbar({ open: true, message: 'En notas de credito se aplica contra documentos de cargo existentes.', severity: 'info' });
      return;
    }
    const monto = Number(nuevoPago.monto);
    if (!nuevoPago.cuenta_id || !nuevoPago.fecha || !monto || Number.isNaN(monto) || monto <= 0) {
      setSnackbar({ open: true, message: 'Completa cuenta, fecha y monto válidos', severity: 'error' });
      return;
    }
    if (monto > effectiveSaldo) {
      setSnackbar({ open: true, message: 'El monto excede el saldo de la factura', severity: 'error' });
      return;
    }

    try {
      setCreating(true);
      const operacion = await crearOperacion({
        cuenta_id: Number(nuevoPago.cuenta_id),
        fecha: nuevoPago.fecha,
        tipo_movimiento: 'Deposito',
        naturaleza_operacion: 'cobro_cliente',
        contacto_id: contactoId,
        referencia: nuevoPago.referencia || null,
        observaciones: nuevoPago.observaciones || null,
        monto,
      });

      await crearAplicacion({
        finanzas_operacion_id: operacion.id,
        documento_destino_id: documentoId,
        monto,
        monto_moneda_documento: monto,
        fecha_aplicacion: nuevoPago.fecha,
      });

      const saldoData = await refreshDocumentoFinanzas();
      await loadOperacionesDisponibles(Number(saldoData?.saldo ?? 0), saldoData?.moneda ?? saldoDocumento?.moneda ?? 'MXN');
      setNuevoPago((prev) => ({
        ...prev,
        monto: Number(saldoData?.saldo ?? 0) > 0 ? String(Number(saldoData?.saldo ?? 0)) : '',
        referencia: '',
        observaciones: '',
      }));
      setSnackbar({ open: true, message: 'Pago registrado y aplicado', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo registrar y aplicar el pago', severity: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const headerCellSx = {
    backgroundColor: '#1d2f68',
    color: '#fff',
    fontWeight: 600,
    fontSize: '13px',
    py: '6px',
  };

  const bodyCellSx = {
    fontSize: '12px',
    py: '6px',
    borderBottom: '1px solid #e5e7eb',
  };

  const rowBaseSx = { height: 26, '&:hover': { backgroundColor: '#eef5ff' } };

  const headerTitle = esNotaCredito
    ? `${etiquetaDocumento} ${documentoMeta?.folio || ''}`.trim()
    : 'Aplicar pago';

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
                  {etiquetaContacto}: {documentoMeta?.contactoNombre || '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Fecha: {documentoMeta?.fechaDocumento ? formatDateShort(documentoMeta.fechaDocumento) : '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Saldo disponible: {formatter.format(effectiveSaldo)}
                </Typography>
              </Stack>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary">
                  Documento #{documentoId}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {tituloTipo}: {valorTipo}
                </Typography>
              </>
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
          ) : null}
          <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
            <Table size="small" aria-label="Aplicaciones registradas">
              <TableHead>
                <TableRow>
                  <TableCell sx={headerCellSx}>{esNotaCredito ? 'Documento' : 'Origen'}</TableCell>
                  <TableCell sx={headerCellSx}>Fecha</TableCell>
                  <TableCell align="right" sx={headerCellSx}>Monto aplicado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {aplicaciones.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 2, color: 'text.secondary' }}>
                      Sin aplicaciones registradas
                    </TableCell>
                  </TableRow>
                )}
                {aplicaciones.map((item) => {
                  const folio = formatearFolioDocumento(item?.serie || '', item?.numero || 0);
                  const tipoRelacionado = esNotaCredito
                    ? item.tipo_documento || item.tipo_documento_destino || item.tipo_documento_origen || 'Documento'
                    : item.tipo_movimiento || item.tipo_documento_origen || 'Pago';
                  return (
                    <TableRow key={item.id}>
                      <TableCell sx={bodyCellSx}>{folio ? `${tipoRelacionado} ${folio}` : tipoRelacionado}</TableCell>
                      <TableCell sx={bodyCellSx}>{formatDateShort(item.fecha_documento || item.fecha_aplicacion || item.fecha_creacion)}</TableCell>
                      <TableCell align="right" sx={bodyCellSx}>{formatter.format(Number(item.monto_moneda_documento || item.monto || 0))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>

        <Divider />

        {!esNotaCredito ? (
          <Tabs value={tab} onChange={(_event, next) => setTab(next)}>
            <Tab label="Usar pago existente" value={0} />
            <Tab label="Registrar nuevo pago" value={1} />
          </Tabs>
        ) : null}

        {loading ? (
          <Stack alignItems="center" py={4} spacing={1}>
            <CircularProgress size={32} />
            <Typography variant="body2">Cargando información de pagos…</Typography>
          </Stack>
        ) : tab === 0 ? (
          <Stack spacing={2}>
            {esNotaCredito ? (
              <Stack spacing={1} mt={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700} color="#1d2f68">
                      {encabezadoPendientes}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Aplica la nota de credito contra los documentos de cargo pendientes.
                    </Typography>
                  </Box>
                  {candidatosCargo.length > 0 && effectiveSaldo > 0 && (
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
                        {candidatosCargo.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 2, fontStyle: 'italic', color: 'text.secondary' }}>
                              {emptyPendientes}
                            </TableCell>
                          </TableRow>
                        )}
                        {candidatosCargo.map((item, idx) => {
                          const folio = formatearFolioDocumento(item?.serie || '', item?.numero || 0);
                          const label = `${item.tipo || 'Documento'} ${folio}`.trim();
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
            ) : (
              <>
                <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={headerCellSx}>Fecha</TableCell>
                        <TableCell sx={headerCellSx}>Referencia</TableCell>
                        <TableCell align="right" sx={headerCellSx}>Monto</TableCell>
                        <TableCell align="right" sx={headerCellSx}>Disponible</TableCell>
                        <TableCell align="center" sx={headerCellSx}>Accion</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {operacionesDisponibles.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 2, color: 'text.secondary' }}>
                            {emptyPendientes}
                          </TableCell>
                        </TableRow>
                      )}
                      {operacionesDisponibles.map((item) => (
                        <TableRow key={item.operacion.id} selected={selectedOperacionId === item.operacion.id}>
                          <TableCell sx={bodyCellSx}>{formatDateShort(item.operacion.fecha)}</TableCell>
                          <TableCell sx={bodyCellSx}>{item.operacion.referencia || '—'}</TableCell>
                          <TableCell align="right" sx={bodyCellSx}>{formatter.format(Number(item.operacion.monto || 0))}</TableCell>
                          <TableCell align="right" sx={bodyCellSx}>{formatter.format(Number(item.disponible.monto_disponible || 0))}</TableCell>
                          <TableCell align="center" sx={bodyCellSx}>
                            <Button size="small" variant={selectedOperacionId === item.operacion.id ? 'contained' : 'outlined'} onClick={() => setSelectedOperacionId(item.operacion.id)}>
                              Seleccionar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {selectedOperacion && (
                  <Box sx={{ border: '1px solid #dbe3f4', borderRadius: 2, p: 2, backgroundColor: '#f8fafc' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }}>
                      <TextField
                        label="Monto a aplicar"
                        type="number"
                        value={montoExistente}
                        onChange={(event) => setMontoExistente(event.target.value)}
                        fullWidth
                        inputProps={{ min: 0, step: '0.01' }}
                        helperText={`Maximo disponible: ${formatter.format(Math.min(effectiveSaldo, Number(selectedOperacion?.disponible.monto_disponible || 0)))}`}
                      />
                      <Button
                        variant="contained"
                        startIcon={<CheckCircleOutlineIcon />}
                        onClick={handleApplyExisting}
                        disabled={applying || effectiveSaldo <= 0}
                        sx={{ minWidth: 180, textTransform: 'none', borderRadius: 999, bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}
                      >
                        {applying ? 'Aplicando…' : 'Aplicar pago'}
                      </Button>
                    </Stack>
                  </Box>
                )}
              </>
            )}
          </Stack>
        ) : (
          !esNotaCredito ? (
          <Stack spacing={2}>
            <TextField
              label="Cuenta"
              value={nuevoPago.cuenta_id}
              onChange={(event) => setNuevoPago((prev) => ({ ...prev, cuenta_id: event.target.value }))}
              fullWidth
            >
              {cuentas.map((cuenta) => (
                <MenuItem key={cuenta.id} value={String(cuenta.id)}>
                  {cuenta.identificador}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Fecha"
              value={nuevoPago.fecha}
            />
            <TextField
              label="Monto"
              type="number"
              value={nuevoPago.monto}
              onChange={(event) => setNuevoPago((prev) => ({ ...prev, monto: event.target.value }))}
              inputProps={{ min: 0, step: '0.01' }}
              fullWidth
            />
            <TextField
              label="Referencia"
              value={nuevoPago.referencia}
              onChange={(event) => setNuevoPago((prev) => ({ ...prev, referencia: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Observaciones"
              value={nuevoPago.observaciones}
              onChange={(event) => setNuevoPago((prev) => ({ ...prev, observaciones: event.target.value }))}
              multiline
              minRows={3}
              fullWidth
            />
            <Button
              variant="contained"
              onClick={handleCreateAndApply}
              disabled={creating || effectiveSaldo <= 0}
              sx={{ alignSelf: 'flex-start', textTransform: 'none', borderRadius: 999, bgcolor: '#006261', '&:hover': { bgcolor: '#014c4c' } }}
            >
              {creating ? 'Registrando…' : 'Registrar y aplicar'}
            </Button>
          </Stack>
          ) : null
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
      </Box>
    </Drawer>
  );
}

export default FacturaPagosDrawer;