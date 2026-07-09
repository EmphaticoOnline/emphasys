import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  Typography,
} from '@mui/material';
import type { Cuenta } from '../../types/contabilidad';
import { fetchCuentas, eliminarCuenta } from '../../services/contabilidadService';
import CuentaFormView from './CuentaFormView';
import SaldosMesView from './SaldosMesView';
import SaldosAnioView from './SaldosAnioView';

type Vista = 'lista' | 'formulario';
export type SubVista = 'saldos-mes' | 'saldos-anio';

export default function CuentasTab() {
  const [cuentas, setCuentas] = React.useState<Cuenta[]>([]);
  const [vista, setVista] = React.useState<Vista>('lista');
  const [subVista, setSubVista] = React.useState<SubVista>('saldos-mes');
  const [cuentaEditando, setCuentaEditando] = React.useState<Cuenta | null>(null);
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );
  const [cuentaAEliminar, setCuentaAEliminar] = React.useState<Cuenta | null>(null);
  const [eliminando, setEliminando] = React.useState(false);

  // Solo se usa para alimentar el lookup de "cuenta completa" (activa, etc.)
  // que necesitan las acciones dentro de Saldos por mes, cuyo endpoint de
  // saldos no trae todos los campos de Cuenta. Saldos por año ya trae
  // Cuenta[] completo por su cuenta, así que no depende de este estado.
  const loadCuentas = React.useCallback(async () => {
    try {
      const data = await fetchCuentas(true);
      setCuentas(data);
    } catch (err: any) {
      setCuentas([]);
      setSnackbar({ open: true, message: err?.message || 'No se pudieron cargar las cuentas contables', severity: 'error' });
    }
  }, []);

  React.useEffect(() => {
    void loadCuentas();
  }, [loadCuentas]);

  const handleNueva = () => {
    setCuentaEditando(null);
    setVista('formulario');
  };

  const handleEditar = (cuenta: Cuenta) => {
    setCuentaEditando(cuenta);
    setVista('formulario');
  };

  const handleCancelarFormulario = () => {
    setVista('lista');
    setCuentaEditando(null);
  };

  const handleGuardado = async () => {
    setSnackbar({
      open: true,
      message: cuentaEditando ? 'Cuenta actualizada' : 'Cuenta creada',
      severity: 'success',
    });
    setVista('lista');
    setCuentaEditando(null);
    await loadCuentas();
  };

  const handlePedirEliminar = (cuenta: Cuenta) => {
    setCuentaAEliminar(cuenta);
  };

  const handleCerrarEliminar = () => {
    if (eliminando) return;
    setCuentaAEliminar(null);
  };

  const handleConfirmarEliminar = async () => {
    if (!cuentaAEliminar) return;
    try {
      setEliminando(true);
      await eliminarCuenta(cuentaAEliminar.id);
      setSnackbar({ open: true, message: 'Cuenta eliminada', severity: 'success' });
      setCuentaAEliminar(null);
      await loadCuentas();
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo eliminar la cuenta', severity: 'error' });
      setCuentaAEliminar(null);
    } finally {
      setEliminando(false);
    }
  };

  if (vista === 'formulario') {
    return <CuentaFormView cuenta={cuentaEditando} onCancel={handleCancelarFormulario} onSaved={handleGuardado} />;
  }

  const accionesCuenta = {
    onNueva: handleNueva,
    onEditar: handleEditar,
    onPedirEliminar: handlePedirEliminar,
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, px: { xs: 2, md: 2.5 }, py: 1.5 }}>
      {subVista === 'saldos-mes' && (
        <SaldosMesView
          cuentasCompletas={cuentas}
          subVista={subVista}
          onSubVistaChange={setSubVista}
          {...accionesCuenta}
        />
      )}
      {subVista === 'saldos-anio' && (
        <SaldosAnioView subVista={subVista} onSubVistaChange={setSubVista} {...accionesCuenta} />
      )}

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

      <Dialog open={Boolean(cuentaAEliminar)} onClose={handleCerrarEliminar} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar cuenta contable</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Eliminar esta cuenta contable? Esta acción solo será posible si la cuenta no tiene movimientos, saldos ni
            subcuentas.
          </DialogContentText>
          {cuentaAEliminar && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {cuentaAEliminar.cuenta} — {cuentaAEliminar.descripcion}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCerrarEliminar} disabled={eliminando} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmarEliminar}
            disabled={eliminando}
            color="error"
            variant="contained"
            sx={{ textTransform: 'none' }}
          >
            {eliminando ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
