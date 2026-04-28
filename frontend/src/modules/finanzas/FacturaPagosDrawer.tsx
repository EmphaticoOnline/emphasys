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
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
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
import type {
  AplicacionOperacion,
  DocumentoSaldo,
  FinanzasCuenta,
  FinanzasOperacion,
  OperacionDisponible,
} from '../../types/finanzas';
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

interface FacturaPagosDrawerProps {
  open: boolean;
  onClose: () => void;
  documentoId: number;
  contactoId: number;
  saldo: number;
}

export function FacturaPagosDrawer({ open, onClose, documentoId, contactoId, saldo }: FacturaPagosDrawerProps) {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cuentas, setCuentas] = useState<FinanzasCuenta[]>([]);
  const [saldoDocumento, setSaldoDocumento] = useState<DocumentoSaldo | null>(null);
  const [aplicaciones, setAplicaciones] = useState<AplicacionOperacion[]>([]);
  const [operacionesDisponibles, setOperacionesDisponibles] = useState<OperacionDisponibleRow[]>([]);
  const [selectedOperacionId, setSelectedOperacionId] = useState<number | null>(null);
  const [montoExistente, setMontoExistente] = useState('');
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

  const loadOperacionesDisponibles = async (saldoActual: number) => {
    if (!contactoId || saldoActual <= 0) {
      setOperacionesDisponibles([]);
      return;
    }
    const estadoCuenta = await fetchEstadoCuenta(contactoId);
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
      const [saldoData, cuentasData] = await Promise.all([
        refreshDocumentoFinanzas(),
        fetchCuentas(),
      ]);
      setCuentas(cuentasData ?? []);
      const saldoActual = Number(saldoData?.saldo ?? saldo ?? 0);
      setNuevoPago((prev) => ({
        ...prev,
        monto: saldoActual > 0 ? String(saldoActual) : '',
        cuenta_id: prev.cuenta_id || String(cuentasData?.[0]?.id ?? ''),
      }));
      await loadOperacionesDisponibles(saldoActual);
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
      return;
    }
    void loadAll();
  }, [open, documentoId, contactoId]);

  useEffect(() => {
    if (!open) return;
    setSaldoDocumento((prev) => (prev ? prev : { id: documentoId, empresa_id: 0, tipo_documento: 'factura', moneda: 'MXN', total: saldo, saldo }));
  }, [open, documentoId, saldo]);

  const handleApplyExisting = async () => {
    if (!selectedOperacion) {
      setSnackbar({ open: true, message: 'Selecciona un pago existente', severity: 'error' });
      return;
    }
    const monto = Number(montoExistente || Math.min(effectiveSaldo, selectedOperacion.disponible.monto_disponible));
    if (!monto || Number.isNaN(monto) || monto <= 0) {
      setSnackbar({ open: true, message: 'Ingresa un monto válido', severity: 'error' });
      return;
    }
    if (monto > Number(selectedOperacion.disponible.monto_disponible ?? 0)) {
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
        finanzas_operacion_id: selectedOperacion.operacion.id,
        documento_destino_id: documentoId,
        monto,
        monto_moneda_documento: monto,
        fecha_aplicacion: new Date().toISOString().slice(0, 10),
      });
      const saldoData = await refreshDocumentoFinanzas();
      await loadOperacionesDisponibles(Number(saldoData?.saldo ?? 0));
      setMontoExistente('');
      setSnackbar({ open: true, message: 'Pago aplicado correctamente', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo aplicar el pago', severity: 'error' });
    } finally {
      setApplying(false);
    }
  };

  const handleCreateAndApply = async () => {
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
      await loadOperacionesDisponibles(Number(saldoData?.saldo ?? 0));
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
              Aplicar pago
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Documento #{documentoId}
            </Typography>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>

        <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 2, p: 2, backgroundColor: '#f8fafc' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Saldo pendiente
              </Typography>
              <Typography variant="h6" fontWeight={700} color={effectiveSaldo > 0 ? '#b45309' : '#15803d'}>
                {formatter.format(effectiveSaldo)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Pagos aplicados
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
          <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={headerCellSx}>Origen</TableCell>
                  <TableCell sx={headerCellSx}>Fecha</TableCell>
                  <TableCell align="right" sx={headerCellSx}>Monto aplicado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {aplicaciones.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 2, color: 'text.secondary' }}>
                      Sin pagos aplicados
                    </TableCell>
                  </TableRow>
                )}
                {aplicaciones.map((item) => {
                  const folio = formatearFolioDocumento(item?.serie || '', item?.numero || 0);
                  const origen = item.tipo_movimiento || item.tipo_documento_origen || 'Pago';
                  return (
                    <TableRow key={item.id}>
                      <TableCell sx={bodyCellSx}>{folio ? `${origen} ${folio}` : origen}</TableCell>
                      <TableCell sx={bodyCellSx}>{formatDateShort(item.fecha_aplicacion || item.fecha_creacion)}</TableCell>
                      <TableCell align="right" sx={bodyCellSx}>{formatter.format(Number(item.monto_moneda_documento || item.monto || 0))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>

        <Divider />

        <Tabs value={tab} onChange={(_event, next) => setTab(next)}>
          <Tab label="Usar pago existente" value={0} />
          <Tab label="Registrar nuevo pago" value={1} />
        </Tabs>

        {loading ? (
          <Stack alignItems="center" py={4} spacing={1}>
            <CircularProgress size={32} />
            <Typography variant="body2">Cargando información de pagos…</Typography>
          </Stack>
        ) : tab === 0 ? (
          <Stack spacing={2}>
            <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={headerCellSx}>Fecha</TableCell>
                    <TableCell sx={headerCellSx}>Referencia</TableCell>
                    <TableCell align="right" sx={headerCellSx}>Monto</TableCell>
                    <TableCell align="right" sx={headerCellSx}>Disponible</TableCell>
                    <TableCell align="center" sx={headerCellSx}>Acción</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {operacionesDisponibles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 2, color: 'text.secondary' }}>
                        No hay cobros disponibles para este cliente
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
                    helperText={`Máximo disponible: ${formatter.format(Math.min(effectiveSaldo, Number(selectedOperacion.disponible.monto_disponible || 0)))}`}
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
          </Stack>
        ) : (
          <Stack spacing={2}>
            <TextField
              select
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
              type="date"
              value={nuevoPago.fecha}
              onChange={(event) => setNuevoPago((prev) => ({ ...prev, fecha: event.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
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