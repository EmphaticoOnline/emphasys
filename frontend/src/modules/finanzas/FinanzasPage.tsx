import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import AddIcon from '@mui/icons-material/Add';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { CuentasSidebar } from './CuentasSidebar';
import { MovimientosTable } from './MovimientosTable';
import { OperacionDialog } from './OperacionDialog';
import { TransferenciaDialog } from './TransferenciaDialog';
import { ConciliacionDialog } from './ConciliacionDialog';
import { NuevaCuentaDialog } from './NuevaCuentaDialog';
import { OperacionDetalleDrawer } from './OperacionDetalleDrawer';
import { useSession } from '../../session/useSession';
import type { FinanzasCuenta, FinanzasOperacion, TransferenciaUpdatePayload } from '../../types/finanzas';
import {
  actualizarCuenta,
  eliminarCuenta,
  eliminarOperacion,
  eliminarTransferencia,
  fetchCuentas,
  fetchOperaciones,
  recalcularSaldos,
} from '../../services/finanzasService';

export function FinanzasPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const tokens = theme.emphasys;
  const compacto = useMediaQuery(theme.breakpoints.down('md'));
  const { session } = useSession();
  const esAdmin = Boolean(session.user?.es_superadmin);
  const [cuentas, setCuentas] = useState<FinanzasCuenta[]>([]);
  const [selectedCuentaId, setSelectedCuentaId] = useState<number | null>(null);
  const [operaciones, setOperaciones] = useState<FinanzasOperacion[]>([]);
  const [loadingCuentas, setLoadingCuentas] = useState(true);
  const [loadingOps, setLoadingOps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'success' }
  );

  const [operacionDialog, setOperacionDialog] = useState<{ open: boolean; operacion?: FinanzasOperacion | null }>(
    { open: false, operacion: null }
  );
  const [transferenciaOpen, setTransferenciaOpen] = useState(false);
  const [transferenciaEdit, setTransferenciaEdit] = useState<TransferenciaUpdatePayload | null>(null);
  const [conciliacionOpen, setConciliacionOpen] = useState(false);
  const [cuentaDialog, setCuentaDialog] = useState<{ open: boolean; cuenta?: FinanzasCuenta | null }>({ open: false, cuenta: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; operacion: FinanzasOperacion | null }>({ open: false, operacion: null });
  const [detalleOperacionId, setDetalleOperacionId] = useState<number | null>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [recalcularDialogOpen, setRecalcularDialogOpen] = useState(false);
  const [recalculando, setRecalculando] = useState(false);

  const selectedCuenta = useMemo(() => cuentas.find((c) => c.id === selectedCuentaId) || null, [cuentas, selectedCuentaId]);
  const monedaCuenta = selectedCuenta?.moneda || 'MXN';
  const formatoMoneda = useMemo(
    () => new Intl.NumberFormat('es-MX', { style: 'currency', currency: monedaCuenta }),
    [monedaCuenta],
  );
  const resumenMovimientos = useMemo(() => {
    let depositos = 0;
    let retiros = 0;
    for (const operacion of operaciones) {
      const monto = Math.abs(Number(operacion.monto) || 0);
      if (operacion.tipo_movimiento === 'Deposito') depositos += monto;
      else retiros += monto;
    }
    return { depositos, retiros, total: operaciones.length };
  }, [operaciones]);

  const loadCuentas = async () => {
    try {
      setLoadingCuentas(true);
      const data = await fetchCuentas();
      setCuentas(data);
      if (!selectedCuentaId && data.length > 0) {
        setSelectedCuentaId(data[0]?.id ?? null);
      } else if (selectedCuentaId && !data.some((c) => c.id === selectedCuentaId)) {
        setSelectedCuentaId(data[0]?.id ?? null);
      }
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar las cuentas');
    } finally {
      setLoadingCuentas(false);
    }
  };

  const loadOperaciones = async (cuentaId: number | null) => {
    if (!cuentaId) return;
    try {
      setLoadingOps(true);
      const data = await fetchOperaciones(cuentaId);
      setOperaciones(data);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar los movimientos');
    } finally {
      setLoadingOps(false);
    }
  };

  useEffect(() => {
    void loadCuentas();
  }, []);

  useEffect(() => {
    void loadOperaciones(selectedCuentaId);
  }, [selectedCuentaId]);

  const handleDeleteCuenta = async (cuenta: FinanzasCuenta) => {
    const confirmed = window.confirm(`¿Eliminar la cuenta "${cuenta.identificador}"?`);
    if (!confirmed) return;
    try {
      await eliminarCuenta(cuenta.id);
      setSnackbar({ open: true, message: 'Cuenta eliminada', severity: 'success' });
      await loadCuentas();
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo eliminar', severity: 'error' });
    }
  };

  const requestDeleteOperacion = (operacion: FinanzasOperacion) => {
    setConfirmDelete({ open: true, operacion });
  };

  const handleDeleteOperacion = async (operacion: FinanzasOperacion) => {
    try {
      if (operacion.es_transferencia && operacion.transferencia_id) {
        await eliminarTransferencia(operacion.transferencia_id);
        setSnackbar({ open: true, message: 'Transferencia eliminada', severity: 'success' });
      } else {
        await eliminarOperacion(operacion.id);
        setSnackbar({ open: true, message: 'Operación eliminada', severity: 'success' });
      }
      await loadOperaciones(selectedCuentaId);
      await loadCuentas();
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo eliminar la operación', severity: 'error' });
    }
  };

  const confirmDeleteOperacion = async () => {
    if (!confirmDelete.operacion) return;
    await handleDeleteOperacion(confirmDelete.operacion);
    setConfirmDelete({ open: false, operacion: null });
  };

  const handleCuentaGuardada = async (cuenta: FinanzasCuenta) => {
    await loadCuentas();
    setSelectedCuentaId(cuenta.id);
    setSnackbar({ open: true, message: cuentaDialog.cuenta ? 'Cuenta actualizada' : 'Cuenta creada', severity: 'success' });
    setCuentaDialog({ open: false, cuenta: null });
  };

  const handleEditarCuenta = (cuenta: FinanzasCuenta) => {
    setCuentaDialog({ open: true, cuenta });
  };

  const handleOperacionGuardada = async () => {
    await loadOperaciones(selectedCuentaId);
    await loadCuentas();
    setSnackbar({ open: true, message: 'Operación registrada', severity: 'success' });
  };

  const handleTransferenciaGuardada = async () => {
    await loadOperaciones(selectedCuentaId);
    await loadCuentas();
    setSnackbar({ open: true, message: transferenciaEdit ? 'Transferencia actualizada' : 'Transferencia registrada', severity: 'success' });
    setTransferenciaEdit(null);
  };

  const handleConciliacionGuardada = async () => {
    await loadOperaciones(selectedCuentaId);
    await loadCuentas();
    setSnackbar({ open: true, message: 'Conciliación guardada', severity: 'success' });
  };

  const handleRecalcularSaldos = async () => {
    if (recalculando) return;
    setRecalculando(true);
    try {
      const resultado = await recalcularSaldos();
      setRecalcularDialogOpen(false);
      // loadCuentas conserva selectedCuentaId si la cuenta sigue existiendo (ver arriba).
      await loadCuentas();
      await loadOperaciones(selectedCuentaId);
      setSnackbar({
        open: true,
        message: `Saldos recalculados correctamente. Se procesaron ${resultado.cuentas_procesadas} cuentas y ${resultado.operaciones_procesadas} operaciones.`,
        severity: 'success',
      });
    } catch (err: any) {
      // Dejamos el diálogo abierto: el proceso no terminó, no debe aparentar éxito.
      setSnackbar({ open: true, message: err?.message || 'No se pudieron recalcular los saldos', severity: 'error' });
    } finally {
      setRecalculando(false);
    }
  };

  const accionSx = { textTransform: 'none', borderRadius: '10px' } as const;

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: compacto ? 'column' : 'row', overflow: 'hidden' }}>
      <CuentasSidebar
        cuentas={cuentas}
        selectedId={selectedCuentaId}
        onSelect={setSelectedCuentaId}
        onNew={() => setCuentaDialog({ open: true, cuenta: null })}
        onEdit={handleEditarCuenta}
        onDelete={handleDeleteCuenta}
        loading={loadingCuentas}
        onRecalcularSaldos={esAdmin ? () => setRecalcularDialogOpen(true) : undefined}
      />

      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: tokens.content.background, overflow: 'hidden' }}>
        <Box sx={{ px: { xs: 1.5, md: 2.75 }, pt: 1.6, pb: 1.4 }}>
          <Typography sx={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: tokens.content.muted }}>
            TESORERÍA
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: compacto ? 'column' : 'row', mt: 0.35 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="figure" sx={{ fontSize: { xs: 26, md: 32 }, letterSpacing: '-0.02em', lineHeight: 1, color: tokens.content.foreground }}>
                {selectedCuenta?.identificador || 'Sin cuenta'}
              </Typography>
              <Typography sx={{ mt: 0.7, fontSize: 13, color: tokens.content.secondary }}>
                {selectedCuenta
                  ? 'Movimientos, saldo y conciliación de la cuenta seleccionada.'
                  : 'Selecciona o registra una cuenta para ver sus movimientos.'}
              </Typography>
              {selectedCuenta && (
                <Box sx={{ display: 'flex', gap: 0.7, mt: 1, flexWrap: 'wrap' }}>
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 26, px: 1.05, borderRadius: 99, bgcolor: tokens.metric.amount.background, color: tokens.metric.amount.foreground, fontSize: 12, fontWeight: 700 }}>
                    {selectedCuenta.moneda || 'MXN'}
                  </Box>
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 26, px: 1.05, borderRadius: 99, bgcolor: tokens.content.elevated, color: tokens.content.foreground, fontSize: 12, fontWeight: 700, border: `1px solid ${tokens.content.border}` }}>
                    {selectedCuenta.tipo_cuenta}
                  </Box>
                  {selectedCuenta.cuenta_cerrada && (
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 26, px: 1.05, borderRadius: 99, bgcolor: tokens.metric.blocked.background, color: tokens.metric.blocked.foreground, fontSize: 12, fontWeight: 700 }}>
                      Cerrada
                    </Box>
                  )}
                </Box>
              )}
            </Box>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ justifyContent: 'flex-end' }}>
              <Tooltip title="Volver a cargar cuentas y movimientos" arrow>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={() => {
                    void loadCuentas();
                    void loadOperaciones(selectedCuentaId);
                  }}
                  sx={accionSx}
                >
                  Actualizar
                </Button>
              </Tooltip>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setOperacionDialog({ open: true, operacion: null })}
                disabled={!selectedCuentaId}
                sx={accionSx}
              >
                Nueva operación
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CompareArrowsIcon />}
                onClick={() => setTransferenciaOpen(true)}
                disabled={cuentas.length < 2}
                sx={accionSx}
              >
                Transferencia
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CalendarMonthIcon />}
                onClick={() => navigate('/finanzas/programacion-pagos')}
                sx={accionSx}
              >
                Programación
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CheckCircleIcon />}
                onClick={() => {
                  const url = selectedCuentaId
                    ? `/finanzas/conciliacion-bancaria?cuenta_id=${selectedCuentaId}`
                    : '/finanzas/conciliacion-bancaria';
                  navigate(url);
                }}
                disabled={!selectedCuentaId}
                sx={accionSx}
              >
                Conciliar
              </Button>
            </Stack>
          </Box>

          {error && (
            <Alert severity="error" onClose={() => setError(null)} sx={{ mt: 1.5 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ mt: 1.7, display: 'grid', gridTemplateColumns: compacto ? '1fr' : '1.15fr 1fr 1fr', gap: 0.8 }}>
            <Box sx={{ bgcolor: tokens.metric.amount.background, borderRadius: 2, px: 1.4, py: 1.05 }}>
              <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.metric.caption }}>Saldo actual</Typography>
              <Typography variant="figure" sx={{ mt: 0.25, fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1.05, color: tokens.content.foreground }}>
                {formatoMoneda.format(Number(selectedCuenta?.saldo || 0))}
              </Typography>
              <Typography sx={{ mt: 0.3, fontSize: 12, color: tokens.metric.caption }}>
                {selectedCuenta ? selectedCuenta.identificador : 'Sin cuenta seleccionada'}
              </Typography>
            </Box>
            <Box sx={{ bgcolor: tokens.metric.applied.background, borderRadius: 2, px: 1.4, py: 1.05 }}>
              <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.metric.caption }}>Depósitos</Typography>
              <Typography variant="figure" sx={{ mt: 0.25, fontSize: 20, letterSpacing: '-0.02em', lineHeight: 1.05, color: tokens.content.foreground }}>
                {formatoMoneda.format(resumenMovimientos.depositos)}
              </Typography>
              <Typography sx={{ mt: 0.3, fontSize: 12, color: tokens.metric.caption }}>En los movimientos cargados</Typography>
            </Box>
            <Box sx={{ bgcolor: tokens.metric.blocked.background, borderRadius: 2, px: 1.4, py: 1.05 }}>
              <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.metric.caption }}>Retiros</Typography>
              <Typography variant="figure" sx={{ mt: 0.25, fontSize: 20, letterSpacing: '-0.02em', lineHeight: 1.05, color: tokens.content.foreground }}>
                {formatoMoneda.format(resumenMovimientos.retiros)}
              </Typography>
              <Typography sx={{ mt: 0.3, fontSize: 12, color: tokens.metric.caption }}>
                {resumenMovimientos.total === 1 ? '1 movimiento' : `${resumenMovimientos.total} movimientos`}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          mx: { xs: 1, md: 1.75 },
          mb: { xs: 1, md: 1.75 },
          bgcolor: tokens.content.well,
          borderRadius: 3,
          border: `1px solid ${tokens.content.border}`,
          overflow: 'hidden',
        }}>
          <Box sx={{ px: 1.5, py: 1.1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap', borderBottom: `1px solid ${tokens.content.border}` }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.content.foreground }}>
              Movimientos
            </Typography>
            <TextField
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar contacto, concepto, referencia o monto"
              size="small"
              onKeyDown={(event) => event.stopPropagation()}
              sx={{
                minWidth: { xs: '100%', sm: 280 },
                maxWidth: 360,
                '& .MuiOutlinedInput-root': {
                  bgcolor: tokens.content.elevated,
                  borderRadius: 2,
                  '& fieldset': { borderColor: tokens.content.border },
                },
                '& .MuiOutlinedInput-input': { fontSize: 13, py: 0.85 },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: tokens.content.muted }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda" disabled={!searchTerm}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {!selectedCuentaId && !loadingCuentas ? (
              <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', px: 3, textAlign: 'center' }}>
                <Typography sx={{ color: tokens.content.muted, fontSize: 14 }}>
                  No hay una cuenta seleccionada.
                </Typography>
              </Box>
            ) : (
              <MovimientosTable
                operaciones={operaciones}
                loading={loadingOps}
                moneda={monedaCuenta}
                onEdit={(op) => setOperacionDialog({ open: true, operacion: op })}
                onDelete={requestDeleteOperacion}
                onEditTransferencia={(op) => {
                  if (op.transferencia_id) {
                    setTransferenciaEdit({
                      id: op.transferencia_id,
                      cuenta_origen_id: op.transferencia_cuenta_origen || op.cuenta_id,
                      cuenta_destino_id: op.transferencia_cuenta_destino || op.cuenta_id,
                      monto: Number(op.monto),
                      fecha: op.fecha,
                      referencia: op.referencia || null,
                      observaciones: op.observaciones || null,
                    });
                    setTransferenciaOpen(true);
                  }
                }}
                onDeleteTransferencia={(op) => requestDeleteOperacion(op)}
                onView={(op) => {
                  setDetalleOperacionId(op.id);
                  setDetalleOpen(true);
                }}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                showToolbar={false}
              />
            )}
          </Box>
        </Box>
      </Box>

      <OperacionDialog
        open={operacionDialog.open}
        cuentas={cuentas}
        defaultCuentaId={selectedCuentaId}
        operacion={operacionDialog.operacion ?? null}
        onClose={() => setOperacionDialog({ open: false, operacion: null })}
        onSaved={handleOperacionGuardada}
      />

      <TransferenciaDialog
        open={transferenciaOpen}
        cuentas={cuentas}
        defaultOrigenId={selectedCuentaId}
        transferencia={transferenciaEdit}
        onClose={() => {
          setTransferenciaOpen(false);
          setTransferenciaEdit(null);
        }}
        onSaved={handleTransferenciaGuardada}
      />

      <ConciliacionDialog
        open={conciliacionOpen}
        cuentaId={selectedCuentaId}
        onClose={() => setConciliacionOpen(false)}
        onSaved={handleConciliacionGuardada}
      />

      <OperacionDetalleDrawer
        open={detalleOpen}
        operacionId={detalleOperacionId}
        onClose={() => setDetalleOpen(false)}
      />

      <NuevaCuentaDialog
        open={cuentaDialog.open}
        cuenta={cuentaDialog.cuenta || null}
        onClose={() => setCuentaDialog({ open: false, cuenta: null })}
        onSaved={handleCuentaGuardada}
      />

      <Dialog
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, operacion: null })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>¿Eliminar la operación?</DialogTitle>
        <DialogContent sx={{ pb: 0 }}>
          <Typography variant="body2" color="text.secondary">
            Esta acción eliminará {confirmDelete.operacion?.es_transferencia ? 'la transferencia y sus movimientos asociados' : 'el movimiento seleccionado'}.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button onClick={() => setConfirmDelete({ open: false, operacion: null })} sx={{ textTransform: 'none' }}>
            No eliminar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDeleteOperacion}
            sx={{ textTransform: 'none', borderRadius: 999 }}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={recalcularDialogOpen}
        onClose={() => {
          if (!recalculando) setRecalcularDialogOpen(false);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>Recalcular saldos de Finanzas</DialogTitle>
        <DialogContent sx={{ pb: 0 }}>
          <Typography variant="body2" color="text.secondary">
            Esta operación volverá a calcular el saldo histórico de todas las operaciones financieras y el saldo
            actual de cada cuenta, tomando como base el saldo inicial y los movimientos registrados. No se
            eliminarán operaciones. ¿Deseas continuar?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button onClick={() => setRecalcularDialogOpen(false)} disabled={recalculando} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleRecalcularSaldos}
            disabled={recalculando}
            startIcon={recalculando ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{ textTransform: 'none', borderRadius: 999 }}
          >
            Recalcular
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default FinanzasPage;
