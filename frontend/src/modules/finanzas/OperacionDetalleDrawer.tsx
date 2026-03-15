import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
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
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import LinkIcon from '@mui/icons-material/Link';
import {
  crearAplicacion,
  eliminarAplicacion,
  fetchAplicacionesPorOperacion,
  fetchEstadoCuenta,
  fetchOperacionDetalle,
  fetchOperacionDisponible,
} from '../../services/finanzasService';
import type { AplicacionOperacion, EstadoCuentaItem, FinanzasOperacion, OperacionDisponible } from '../../types/finanzas';
import { formatearFolioDocumento } from '../../utils/documentos.utils';

const compatibilidadNaturaleza: Record<string, string[]> = {
  cobro_cliente: ['factura', 'nota_credito'],
  pago_proveedor: ['factura_compra', 'nota_credito_compra'],
  movimiento_general: [],
};

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

interface OperacionDetalleDrawerProps {
  operacionId: number | null;
  open: boolean;
  onClose: () => void;
}

export function OperacionDetalleDrawer({ operacionId, open, onClose }: OperacionDetalleDrawerProps) {
  const [operacion, setOperacion] = useState<FinanzasOperacion | null>(null);
  const [disponible, setDisponible] = useState<OperacionDisponible | null>(null);
  const [aplicaciones, setAplicaciones] = useState<AplicacionOperacion[]>([]);
  const [estadoCuenta, setEstadoCuenta] = useState<EstadoCuentaItem[]>([]);
  const [montos, setMontos] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [autoApplying, setAutoApplying] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'success' }
  );

  const formatter = useMemo(
    () => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }),
    []
  );

  const headerCellSx = {
    backgroundColor: '#1d2f68',
    color: '#fff',
    fontWeight: 600,
    fontSize: '13px',
    py: '4px',
    position: 'relative' as const,
    borderBottom: '1px solid #d6e2f0',
    pr: '12px',
  };

  const bodyCellSx = {
    fontSize: '12px',
    py: '2px',
    borderBottom: '1px solid #e5e7eb',
  };

  const rowBaseSx = { height: 26, '&:hover': { backgroundColor: '#e8f5e9' } };
  const fetchAll = async (id: number) => {
    try {
      setLoading(true);
      const [op, disp, apps] = await Promise.all([
        fetchOperacionDetalle(id),
        fetchOperacionDisponible(id),
        fetchAplicacionesPorOperacion(id),
      ]);
      setOperacion(op);
      setDisponible(disp);
      setAplicaciones(apps ?? []);
      if (op.contacto_id) {
        const estado = await fetchEstadoCuenta(op.contacto_id);
        setEstadoCuenta((estado ?? []).filter((item) => item.origen === 'documento'));
      } else {
        setEstadoCuenta([]);
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo cargar el detalle', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !operacionId) {
      setOperacion(null);
      setAplicaciones([]);
      setEstadoCuenta([]);
      setDisponible(null);
      setMontos({});
      return;
    }
    void fetchAll(operacionId);
  }, [open, operacionId]);

  const handleDeleteAplicacion = async (id: number) => {
    if (!operacionId) return;
    try {
      await eliminarAplicacion(id);
      setSnackbar({ open: true, message: 'Aplicación eliminada', severity: 'success' });
      await fetchAll(operacionId);
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo eliminar', severity: 'error' });
    }
  };

  const handleAplicar = async (doc: EstadoCuentaItem) => {
    if (!operacionId || !disponible) return;
    const raw = montos[doc.id] ?? '';

    let monto: number;

    if (raw === '' || raw === null) {
      const saldoFactura = Number(doc.saldo ?? 0);
      const disponibleMovimiento = Number(disponible.monto_disponible ?? 0);
      if (saldoFactura <= 0) {
        setSnackbar({ open: true, message: 'Saldo del documento agotado', severity: 'error' });
        return;
      }
      if (disponibleMovimiento <= 0) {
        setSnackbar({ open: true, message: 'No hay disponible para aplicar', severity: 'error' });
        return;
      }
      monto = Math.min(saldoFactura, disponibleMovimiento);
    } else {
      monto = Number(raw);
      if (!monto || Number.isNaN(monto) || monto <= 0) {
        setSnackbar({ open: true, message: 'Ingresa un monto válido (> 0)', severity: 'error' });
        return;
      }
      if (doc.saldo !== null && monto > doc.saldo) {
        setSnackbar({ open: true, message: 'El monto excede el saldo del documento', severity: 'error' });
        return;
      }
      if (monto > disponible.monto_disponible) {
        setSnackbar({ open: true, message: 'El monto excede el disponible del pago', severity: 'error' });
        return;
      }
    }
    try {
      setApplyingId(doc.id);
      await crearAplicacion({
        finanzas_operacion_id: operacionId,
        documento_destino_id: doc.id,
        monto,
        monto_moneda_documento: monto,
        fecha_aplicacion: new Date().toISOString().slice(0, 10),
      });
      setSnackbar({ open: true, message: 'Aplicación registrada', severity: 'success' });
      setMontos((prev) => ({ ...prev, [doc.id]: '' }));
      await fetchAll(operacionId);
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo aplicar el pago', severity: 'error' });
    } finally {
      setApplyingId(null);
    }
  };

  const facturasPendientes = useMemo(
    () => {
      const base = estadoCuenta.filter((item) => item.origen === 'documento' && (item.saldo ?? 0) > 0);
      const naturaleza = operacion?.naturaleza_operacion;
      if (!naturaleza) return base;
      if (naturaleza === 'movimiento_general') return [];
      const permitidos = compatibilidadNaturaleza[naturaleza] ?? [];
      return base.filter((item) => permitidos.includes(item.tipo));
    },
    [estadoCuenta, operacion?.naturaleza_operacion]
  );

  const esMovimientoGeneral = operacion?.naturaleza_operacion === 'movimiento_general';

  const handleAplicarAutomatico = async () => {
    if (!operacionId || !disponible || esMovimientoGeneral) return;
    let available = disponible.monto_disponible;
    const pendientesOrdenados = [...facturasPendientes].sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (available <= 0 || pendientesOrdenados.length === 0) return;
    try {
      setAutoApplying(true);
      for (const doc of pendientesOrdenados) {
        if (available <= 0) break;
        const saldo = doc.saldo ?? 0;
        const aplicar = Math.min(available, saldo);
        if (aplicar <= 0) continue;
        await crearAplicacion({
          finanzas_operacion_id: operacionId,
          documento_destino_id: doc.id,
          monto: aplicar,
          monto_moneda_documento: aplicar,
          fecha_aplicacion: new Date().toISOString().slice(0, 10),
        });
        available -= aplicar;
      }
      await fetchAll(operacionId);
      setSnackbar({ open: true, message: 'Aplicación automática completada', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo aplicar automáticamente', severity: 'error' });
    } finally {
      setAutoApplying(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100%', md: '70vw' },
          maxWidth: 1200,
        },
      }}
    >
      <Box
        sx={{
          p: 3,
          height: '100%',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          fontSize: '0.85rem',
          '& .MuiTypography-root': { fontSize: '0.85rem' },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={700} color="#1d2f68" sx={{ fontSize: '1.05rem' }}>
            Detalle del movimiento
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>

        {loading && (
          <Stack alignItems="center" py={4} spacing={1}>
            <CircularProgress size={32} />
            <Typography variant="body2">Cargando…</Typography>
          </Stack>
        )}

        {!loading && operacion && disponible && (
          <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 2, p: 2, background: '#f8fafc' }}>
            <Typography variant="subtitle2" color="text.secondary">
              Resumen
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mt={1} flexWrap="wrap">
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Tipo de movimiento
                </Typography>
                <Chip label={operacion.tipo_movimiento} color={operacion.tipo_movimiento === 'Deposito' ? 'success' : 'error'} size="small" sx={{ fontSize: '0.8rem', height: 24 }} />
              </Stack>
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Fecha
                </Typography>
                <Typography variant="body1" fontWeight={700} color="#1d2f68">
                  {formatDateShort(operacion.fecha)}
                </Typography>
              </Stack>
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Monto
                </Typography>
                <Typography variant="body1" fontWeight={700} color="#1d2f68">
                  {formatter.format(Number(operacion.monto || 0))}
                </Typography>
              </Stack>
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Disponible para aplicar
                </Typography>
                <Typography variant="body1" fontWeight={700} color="#006261">
                  {formatter.format(Number(disponible.monto_disponible || 0))}
                </Typography>
              </Stack>
            </Stack>
          </Box>
        )}

        <Divider />

        <Stack spacing={1}>
          <Typography variant="subtitle1" fontWeight={700} color="#1d2f68" sx={{ fontSize: '0.98rem' }}>
            Aplicaciones existentes
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
            Documentos que ya están ligados a este movimiento.
          </Typography>
          <Box sx={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
            <TableContainer
              sx={{
                border: '1px solid #e5e7eb',
                borderRadius: 2,
                overflow: 'hidden',
                boxShadow: 'none',
              }}
            >
              <Table size="small" stickyHeader aria-label="Aplicaciones existentes" sx={{ width: '100%', minWidth: 0 }}>
              <TableHead>
                <TableRow>
                    <TableCell sx={{ ...headerCellSx, width: '30%' }}>Folio</TableCell>
                    <TableCell sx={{ ...headerCellSx, width: '20%' }}>Fecha</TableCell>
                    <TableCell align="right" sx={{ ...headerCellSx, width: '30%' }}>Monto aplicado</TableCell>
                    <TableCell align="center" sx={{ ...headerCellSx, width: '20%', pr: '8px' }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(aplicaciones ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 2, fontStyle: 'italic', color: 'text.secondary' }}>
                      Sin aplicaciones registradas
                    </TableCell>
                  </TableRow>
                )}
                {(aplicaciones ?? []).map((row, idx) => {
                  const folio = formatearFolioDocumento(row?.serie || '', row?.numero || 0);
                  const tipo = row?.tipo_documento ? `${row.tipo_documento.charAt(0).toUpperCase()}${row.tipo_documento.slice(1)}` : '';
                  const label = `${tipo} ${folio}`.trim();
                  const backgroundColor = idx % 2 === 0 ? '#f4faf4' : '#ffffff';
                  return (
                    <TableRow key={row.id} sx={{ ...rowBaseSx, backgroundColor }} className="erp-row">
                      <TableCell sx={{ ...bodyCellSx, width: '30%' }}>
                        {label || '—'}
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, width: '20%' }}>
                        {formatDateShort(row.fecha_documento)}
                      </TableCell>
                      <TableCell align="right" sx={{ ...bodyCellSx, width: '30%' }}>
                        {formatter.format(Number(row.monto_moneda_documento) || 0)}
                      </TableCell>
                      <TableCell align="center" sx={{ ...bodyCellSx, py: '2px', width: '20%' }}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteAplicacion(row.id)}
                          sx={{ p: 0.25, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
        </Stack>

        <Stack spacing={1} mt={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="subtitle1" fontWeight={700} color="#1d2f68" sx={{ fontSize: '0.98rem' }}>
                Facturas pendientes
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                Selecciona una factura y aplica un monto al documento.
              </Typography>
            </Box>
            {!esMovimientoGeneral && disponible && facturasPendientes.length > 0 && disponible.monto_disponible > 0 && (
              <Button
                variant="contained"
                size="small"
                onClick={handleAplicarAutomatico}
                disabled={autoApplying}
                sx={{ textTransform: 'none' }}
              >
                {autoApplying ? 'Aplicando…' : 'Aplicar automáticamente'}
              </Button>
            )}
          </Stack>
          {esMovimientoGeneral ? (
            <Alert severity="info">Este movimiento no permite aplicar documentos.</Alert>
          ) : (
            <Box sx={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
              <TableContainer
                sx={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 2,
                  maxHeight: 340,
                  boxShadow: 'none',
                }}
              >
                <Table size="small" stickyHeader aria-label="Facturas pendientes" sx={{ width: '100%', minWidth: 0 }}>
                <TableHead>
                  <TableRow>
                      <TableCell sx={{ ...headerCellSx, width: '22%' }}>Folio</TableCell>
                      <TableCell sx={{ ...headerCellSx, width: '16%' }}>Fecha</TableCell>
                      <TableCell align="right" sx={{ ...headerCellSx, width: '16%' }}>Total</TableCell>
                      <TableCell align="right" sx={{ ...headerCellSx, width: '16%' }}>Saldo</TableCell>
                      <TableCell sx={{ ...headerCellSx, width: '20%' }}>Monto a aplicar</TableCell>
                      <TableCell align="center" sx={{ ...headerCellSx, width: '10%', pr: '8px' }}>Acción</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {facturasPendientes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 2, fontStyle: 'italic', color: 'text.secondary' }}>
                        No hay facturas pendientes
                      </TableCell>
                    </TableRow>
                  )}
                  {facturasPendientes.map((row, idx) => {
                    const folio = formatearFolioDocumento(row?.serie || '', row?.numero || 0);
                    const tipo = row?.tipo ? `${row.tipo.charAt(0).toUpperCase()}${row.tipo.slice(1)}` : '';
                    const label = `${tipo} ${folio}`.trim();
                    const backgroundColor = idx % 2 === 0 ? '#f4faf4' : '#ffffff';
                    return (
                      <TableRow key={row.id} sx={{ ...rowBaseSx, backgroundColor }}>
                        <TableCell
                          sx={{ ...bodyCellSx, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '22%' }}
                        >
                          {label || '—'}
                        </TableCell>
                        <TableCell sx={{ ...bodyCellSx, width: '16%' }}>
                          {formatDateShort(row.fecha)}
                        </TableCell>
                        <TableCell align="right" sx={{ ...bodyCellSx, width: '16%' }}>
                          {formatter.format(row.monto || 0)}
                        </TableCell>
                        <TableCell align="right" sx={{ ...bodyCellSx, width: '16%' }}>
                          {formatter.format(row.saldo || 0)}
                        </TableCell>
                        <TableCell sx={{ ...bodyCellSx, py: '2px', width: '20%' }}>
                          <TextField
                            size="small"
                            type="number"
                            value={montos[row.id] ?? ''}
                            onChange={(e) => setMontos((prev) => ({ ...prev, [row.id]: e.target.value }))}
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
                          <Tooltip title="Aplicar monto (o saldo si está vacío)">
                            <span>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleAplicar(row)}
                                disabled={applyingId === row.id}
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
          )}
        </Stack>
      </Box>

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
    </Drawer>
  );
}

export default OperacionDetalleDrawer;
