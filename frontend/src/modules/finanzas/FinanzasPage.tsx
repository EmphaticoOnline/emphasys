import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
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
import type { FinanzasCuenta, FinanzasOperacion, TransferenciaUpdatePayload } from '../../types/finanzas';
import {
  actualizarCuenta,
  eliminarCuenta,
  eliminarOperacion,
  eliminarTransferencia,
  fetchCuentas,
  fetchOperaciones,
} from '../../services/finanzasService';

export function FinanzasPage() {
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

  const selectedCuenta = useMemo(() => cuentas.find((c) => c.id === selectedCuentaId) || null, [cuentas, selectedCuentaId]);

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

  return (
    <Box sx={{ width: '100%', px: { xs: 2, md: 2 }, py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            Finanzas
          </Typography>
          <Typography variant="body2" color="#4b5563">
            Control de cuentas, movimientos y conciliaciones bancarias.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              void loadCuentas();
              void loadOperaciones(selectedCuentaId);
            }}
            sx={{ textTransform: 'none', borderRadius: 999 }}
          >
            Actualizar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOperacionDialog({ open: true, operacion: null })}
            disabled={!selectedCuentaId}
            sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}
          >
            Nueva operación
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<CompareArrowsIcon />}
            onClick={() => setTransferenciaOpen(true)}
            disabled={cuentas.length < 2}
            sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#006261', '&:hover': { bgcolor: '#014c4c' } }}
          >
            Transferencia
          </Button>
          <Button
            variant="contained"
            startIcon={<CheckCircleIcon />}
            onClick={() => setConciliacionOpen(true)}
            disabled={!selectedCuentaId}
            sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#0ea5e9', '&:hover': { bgcolor: '#0284c7' } }}
          >
            Conciliar
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          alignItems: 'stretch',
        }}
      >
        <CuentasSidebar
          cuentas={cuentas}
          selectedId={selectedCuentaId}
          onSelect={setSelectedCuentaId}
          onNew={() => setCuentaDialog({ open: true, cuenta: null })}
          onEdit={handleEditarCuenta}
          onDelete={handleDeleteCuenta}
          loading={loadingCuentas}
        />

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              border: '1px solid #e5e7eb',
              background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="subtitle1" fontWeight={700} color="#1d2f68">
                  Movimientos — {selectedCuenta?.identificador || 'Sin cuenta seleccionada'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Saldo actual:{' '}
                  <Typography component="span" fontWeight={600} color="#1d2f68">
                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: selectedCuenta?.moneda || 'MXN' }).format(Number(selectedCuenta?.saldo || 0))}
                  </Typography>
                </Typography>
              </Box>

              <TextField
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar contacto, concepto, referencia o monto"
                size="small"
                onKeyDown={(event) => event.stopPropagation()}
                sx={{ minWidth: { xs: '100%', sm: 320 }, maxWidth: 360 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
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
          </Paper>

          <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
            <MovimientosTable
              operaciones={operaciones}
              loading={loadingOps}
              initialBalance={selectedCuenta?.saldo_inicial || 0}
              moneda={selectedCuenta?.moneda || 'MXN'}
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
