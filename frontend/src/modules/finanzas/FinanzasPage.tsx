import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { CuentasSidebar } from './CuentasSidebar';
import { MovimientosTable } from './MovimientosTable';
import { BuscadorMovimientos } from './BuscadorMovimientos';
import { movimientoEditableEnLinea, type CapturaInline } from './FilaCapturaMovimiento';
import { movimientoDuplicable, movimientoEliminable, movimientoMovible, netoSeleccion, todasCumplen } from './seleccionMovimientos';
import { OperacionDialog } from './OperacionDialog';
import { ConciliacionDialog } from './ConciliacionDialog';
import { NuevaCuentaDialog } from './NuevaCuentaDialog';
import { OperacionDetalleDrawer } from './OperacionDetalleDrawer';
import { TesoreriaMobileView } from './TesoreriaMobileView';
import { useTesoreriaAccounts } from './useTesoreriaAccounts';
import { useTesoreriaMovements } from './useTesoreriaMovements';
import { useDeviceProfile } from '../../hooks/useDeviceProfile';
import { useSession } from '../../session/useSession';
import type { FinanzasCuenta, FinanzasOperacion } from '../../types/finanzas';
import {
  actualizarOperacion,
  cotejarMovimientosSvc,
  crearOperacion,
  eliminarCuenta,
  eliminarOperacion,
  eliminarTransferencia,
  recalcularSaldos,
} from '../../services/finanzasService';
import { validarOperacionGeneral } from './capturaMovimientoLogica';

export function FinanzasPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const tokens = theme.emphasys;
  const compacto = useMediaQuery(theme.breakpoints.down('md'));
  const esMovil = useDeviceProfile() === 'mobile';
  const { session } = useSession();
  const esAdmin = Boolean(session.user?.es_superadmin);
  const {
    cuentas,
    selectedCuentaId,
    selectedCuenta,
    loadingCuentas,
    error,
    setError,
    monedaCuenta,
    formatoMoneda,
    aplicarCuenta,
    loadCuentas,
    searchParams,
  } = useTesoreriaAccounts();
  const {
    operaciones,
    loadingOps,
    loadOperaciones,
    movQuery,
    setMovQuery,
    movFiltros,
    setMovFiltros,
    operacionesVisibles,
  } = useTesoreriaMovements(selectedCuentaId, setError);
  const [vistaMovil, setVistaMovil] = useState<'cuentas' | 'cuenta'>(() => {
    const cuentaEnUrl = Number(searchParams.get('cuenta_id'));
    return Number.isFinite(cuentaEnUrl) && cuentaEnUrl > 0 ? 'cuenta' : 'cuentas';
  });
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>(
    { open: false, message: '', severity: 'success' }
  );

  const [operacionDialog, setOperacionDialog] = useState<{ open: boolean; operacion?: FinanzasOperacion | null }>(
    { open: false, operacion: null }
  );
  const [conciliacionOpen, setConciliacionOpen] = useState(false);
  const [cuentaDialog, setCuentaDialog] = useState<{ open: boolean; cuenta?: FinanzasCuenta | null }>({ open: false, cuenta: null });
  const [captura, setCaptura] = useState<CapturaInline | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; operaciones: FinanzasOperacion[] }>({ open: false, operaciones: [] });
  const [seleccionadas, setSeleccionadas] = useState<FinanzasOperacion[]>([]);
  const [moverDialog, setMoverDialog] = useState<{ open: boolean; operaciones: FinanzasOperacion[]; cuentaId: number | '' }>({ open: false, operaciones: [], cuentaId: '' });
  const [accionSeleccion, setAccionSeleccion] = useState(false);
  const [detalleOperacionId, setDetalleOperacionId] = useState<number | null>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [recalcularDialogOpen, setRecalcularDialogOpen] = useState(false);
  const [recalculando, setRecalculando] = useState(false);

  useEffect(() => {
    setCaptura(null);
    setSeleccionadas([]);
  }, [selectedCuentaId]);

  const alCambiarSeleccion = useCallback((filas: FinanzasOperacion[]) => {
    setSeleccionadas(filas);
  }, []);
  const netoSeleccionado = useMemo(() => netoSeleccion(seleccionadas), [seleccionadas]);
  const colorSeleccionado = netoSeleccionado > 0
    ? tokens.metric.applied.foreground
    : netoSeleccionado < 0
      ? tokens.action.destructive
      : tokens.action.primary;
  const cuentasDestino = useMemo(
    () => cuentas.filter((cuenta) => cuenta.id !== selectedCuentaId && !cuenta.cuenta_cerrada && cuenta.moneda === monedaCuenta),
    [cuentas, monedaCuenta, selectedCuentaId],
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
  const todasLasCuentas = selectedCuentaId === null;
  const saldoTotal = useMemo(
    () => cuentas.reduce((total, cuenta) => total + Number(cuenta.saldo ?? 0), 0),
    [cuentas],
  );

  const handleDeleteCuenta = async (cuenta: FinanzasCuenta) => {
    const confirmed = window.confirm(`¿Eliminar la cuenta "${cuenta.identificador}"?`);
    if (!confirmed) return;
    try {
      await eliminarCuenta(cuenta.id);
      if (cuenta.id === selectedCuentaId) setVistaMovil('cuentas');
      setSnackbar({ open: true, message: 'Cuenta eliminada', severity: 'success' });
      await loadCuentas();
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo eliminar', severity: 'error' });
    }
  };

  const recargarMovimientos = async () => {
    await loadOperaciones(selectedCuentaId);
    await loadCuentas();
  };

  const requestDeleteOperacion = (operacion: FinanzasOperacion) => {
    if (!movimientoEliminable(operacion)) return;
    setConfirmDelete({ open: true, operaciones: [operacion] });
  };

  const requestDeleteSeleccion = (filas: FinanzasOperacion[]) => {
    if (!todasCumplen(filas, movimientoEliminable)) return;
    setConfirmDelete({ open: true, operaciones: filas });
  };

  const confirmDeleteOperacion = async () => {
    const pendientes = confirmDelete.operaciones;
    if (!pendientes.length || !todasCumplen(pendientes, movimientoEliminable)) {
      setConfirmDelete({ open: false, operaciones: [] });
      return;
    }
    const transferencias = new Set<number>();
    setAccionSeleccion(true);
    try {
      for (const operacion of pendientes) {
        if (operacion.es_transferencia && operacion.transferencia_id) {
          if (transferencias.has(operacion.transferencia_id)) continue;
          transferencias.add(operacion.transferencia_id);
          await eliminarTransferencia(operacion.transferencia_id);
        } else {
          await eliminarOperacion(operacion.id);
        }
      }
      setSnackbar({
        open: true,
        message: pendientes.length === 1 ? 'Movimiento eliminado' : `${pendientes.length} movimientos eliminados`,
        severity: 'success',
      });
      setConfirmDelete({ open: false, operaciones: [] });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo eliminar', severity: 'error' });
      setConfirmDelete({ open: false, operaciones: [] });
    } finally {
      setAccionSeleccion(false);
      await recargarMovimientos();
    }
  };

  const duplicarSeleccion = async (filas: FinanzasOperacion[]) => {
    if (!todasCumplen(filas, movimientoDuplicable) || accionSeleccion) return;
    setAccionSeleccion(true);
    let hechas = 0;
    try {
      for (const operacion of filas) {
        const resultado = validarOperacionGeneral(operacion);
        if (!resultado.ok) throw new Error(resultado.mensaje);
        await crearOperacion(resultado.payload);
        hechas += 1;
      }
      setSnackbar({
        open: true,
        message: hechas === 1 ? 'Movimiento duplicado' : `${hechas} movimientos duplicados`,
        severity: 'success',
      });
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: hechas
          ? `Se duplicaron ${hechas}. ${err?.message || 'No se pudo continuar.'}`
          : err?.message || 'No se pudo duplicar',
        severity: 'error',
      });
    } finally {
      setAccionSeleccion(false);
      await recargarMovimientos();
    }
  };

  const abrirMoverSeleccion = (filas: FinanzasOperacion[]) => {
    const destino = cuentasDestino[0];
    if (!todasCumplen(filas, movimientoMovible) || !destino) return;
    setMoverDialog({ open: true, operaciones: filas, cuentaId: destino.id });
  };

  const confirmarMoverSeleccion = async () => {
    if (!moverDialog.cuentaId || !todasCumplen(moverDialog.operaciones, movimientoMovible) || accionSeleccion) return;
    setAccionSeleccion(true);
    let hechas = 0;
    try {
      for (const operacion of moverDialog.operaciones) {
        const resultado = validarOperacionGeneral(operacion, Number(moverDialog.cuentaId));
        if (!resultado.ok) throw new Error(resultado.mensaje);
        await actualizarOperacion(operacion.id, resultado.payload);
        hechas += 1;
      }
      setSnackbar({
        open: true,
        message: hechas === 1 ? 'Movimiento movido de cuenta' : `${hechas} movimientos movidos de cuenta`,
        severity: 'success',
      });
      setMoverDialog({ open: false, operaciones: [], cuentaId: '' });
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: hechas
          ? `Se movieron ${hechas}. ${err?.message || 'No se pudo continuar.'}`
          : err?.message || 'No se pudo mover',
        severity: 'error',
      });
    } finally {
      setAccionSeleccion(false);
      await recargarMovimientos();
    }
  };

  const marcarSeleccion = async (filas: FinanzasOperacion[], estado: 'pendiente' | 'cotejado') => {
    const origen = estado === 'cotejado' ? 'pendiente' : 'cotejado';
    if (!todasCumplen(filas, (fila) => String(fila.estado_conciliacion || 'pendiente').toLowerCase() === origen) || accionSeleccion) return;
    setAccionSeleccion(true);
    try {
      await cotejarMovimientosSvc(filas.map((fila) => fila.id), estado);
      setSnackbar({
        open: true,
        message: estado === 'cotejado' ? 'Marcados como encontrados en banco' : 'Marcados como pendientes',
        severity: 'success',
      });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo actualizar el estado', severity: 'error' });
    } finally {
      setAccionSeleccion(false);
      await recargarMovimientos();
    }
  };

  const handleCuentaGuardada = async (cuenta: FinanzasCuenta) => {
    await loadCuentas();
    aplicarCuenta(cuenta.id);
    setVistaMovil('cuenta');
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

  const abrirNuevaOperacion = () => {
    setOperacionDialog({ open: false, operacion: null });
    setCaptura({ tipo: 'nueva', token: Date.now() });
  };

  const abrirEdicionOperacion = (op: FinanzasOperacion) => {
    if (!movimientoEditableEnLinea(op)) return;
    setOperacionDialog({ open: false, operacion: null });
    setCaptura({ tipo: 'edicion', operacion: op });
  };

  const handleCapturaGuardada = async (detalle?: { transferencia: boolean }) => {
    const edicion = captura?.tipo === 'edicion';
    setCaptura(null);
    await loadOperaciones(selectedCuentaId);
    await loadCuentas();
    const mensaje = detalle?.transferencia
      ? (edicion ? 'Transferencia actualizada' : 'Transferencia registrada')
      : (edicion ? 'Operación actualizada' : 'Operación registrada');
    setSnackbar({ open: true, message: mensaje, severity: 'success' });
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

  const vistaEscritorio = (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: compacto ? 'column' : 'row', overflow: 'hidden' }}>
      <CuentasSidebar
        cuentas={cuentas}
        selectedId={selectedCuentaId}
        onSelect={aplicarCuenta}
        onSelectTodas={() => { aplicarCuenta(null); setVistaMovil('cuentas'); }}
        onNew={() => setCuentaDialog({ open: true, cuenta: null })}
        onEdit={handleEditarCuenta}
        onDelete={handleDeleteCuenta}
        loading={loadingCuentas}
        onRecalcularSaldos={esAdmin ? () => setRecalcularDialogOpen(true) : undefined}
      />

      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: tokens.content.background, overflow: 'hidden' }}>
        <Box sx={{ px: { xs: 1.25, md: 1.75 }, pt: 1, pb: 0.75 }}>
          <Typography sx={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: tokens.content.muted }}>
            TESORERÍA
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: compacto ? 'column' : 'row', mt: 0.35 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="figure" sx={{ fontSize: { xs: 26, md: 32 }, letterSpacing: '-0.02em', lineHeight: 1, color: tokens.content.foreground }}>
                {selectedCuenta?.identificador || 'Todas las cuentas'}
              </Typography>
              <Typography sx={{ mt: 0.4, fontSize: 12, color: tokens.content.secondary }}>
                {selectedCuenta
                  ? 'Movimientos, saldo y conciliación de la cuenta seleccionada.'
                  : 'Movimientos consolidados de todas las cuentas.'}
              </Typography>
              {selectedCuenta && (
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.6, flexWrap: 'wrap' }}>
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 20, px: 0.8, borderRadius: 99, bgcolor: tokens.metric.amount.background, color: tokens.metric.amount.foreground, fontSize: 11, fontWeight: 700 }}>
                    {selectedCuenta.moneda || 'MXN'}
                  </Box>
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 20, px: 0.8, borderRadius: 99, bgcolor: tokens.content.elevated, color: tokens.content.foreground, fontSize: 11, fontWeight: 700, border: `1px solid ${tokens.content.border}` }}>
                    {selectedCuenta.tipo_cuenta}
                  </Box>
                  {selectedCuenta.cuenta_cerrada && (
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 20, px: 0.8, borderRadius: 99, bgcolor: tokens.metric.blocked.background, color: tokens.metric.blocked.foreground, fontSize: 11, fontWeight: 700 }}>
                      Cerrada
                    </Box>
                  )}
                </Box>
              )}
            </Box>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
              <Tooltip title="Nueva operación" arrow>
                <span>
                  <IconButton
                    aria-label="Nueva operación"
                    onClick={abrirNuevaOperacion}
                    disabled={cuentas.length === 0}
                    sx={iconoAccionSx(tokens, !selectedCuentaId)}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Programación de pagos" arrow>
                <span>
                  <IconButton
                    aria-label="Programación de pagos"
                    onClick={() => navigate('/finanzas/programacion-pagos')}
                    sx={iconoAccionSx(tokens, false)}
                  >
                    <CalendarMonthIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Conciliar" arrow>
                <span>
                  <IconButton
                    aria-label="Conciliar"
                    onClick={() => {
                      if (!selectedCuentaId) return;
                      navigate(`/finanzas/conciliacion-bancaria?cuenta_id=${selectedCuentaId}`);
                    }}
                    disabled={!selectedCuentaId}
                    sx={iconoAccionSx(tokens, !selectedCuentaId)}
                  >
                    <CheckCircleIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Box>

          {error && (
            <Alert severity="error" onClose={() => setError(null)} sx={{ mt: 1.5 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: compacto ? '1fr 1fr' : '1.15fr 1fr 1fr 1fr', gap: 0.6 }}>
            <Box sx={{ bgcolor: tokens.metric.amount.background, borderRadius: 1.5, px: 1.1, py: 0.7 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.metric.caption }}>{todasLasCuentas ? 'Saldo total' : 'Saldo actual'}</Typography>
              <Typography variant="figure" sx={{ mt: 0.15, fontSize: 22, letterSpacing: '-0.02em', lineHeight: 1.05, color: tokens.content.foreground }}>
                {formatoMoneda.format(todasLasCuentas ? saldoTotal : Number(selectedCuenta?.saldo || 0))}
              </Typography>
            </Box>
            <Box sx={{ bgcolor: tokens.metric.applied.background, borderRadius: 1.5, px: 1.1, py: 0.7 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.metric.caption }}>Depósitos</Typography>
              <Typography variant="figure" sx={{ mt: 0.15, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.05, color: tokens.content.foreground }}>
                {formatoMoneda.format(resumenMovimientos.depositos)}
              </Typography>
            </Box>
            <Box sx={{ bgcolor: tokens.metric.blocked.background, borderRadius: 1.5, px: 1.1, py: 0.7 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.metric.caption }}>Retiros</Typography>
              <Typography variant="figure" sx={{ mt: 0.15, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.05, color: tokens.content.foreground }}>
                {formatoMoneda.format(resumenMovimientos.retiros)}
              </Typography>
              <Typography sx={{ mt: 0.15, fontSize: 11, color: tokens.metric.caption }}>
                {resumenMovimientos.total === 1 ? '1 movimiento' : `${resumenMovimientos.total} movimientos`}
              </Typography>
            </Box>
            <Box sx={{ bgcolor: tokens.content.elevated, border: `1px solid ${tokens.content.border}`, borderRadius: 1.5, px: 1.1, py: 0.7 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.metric.caption }}>Seleccionado</Typography>
              <Typography variant="figure" sx={{ mt: 0.15, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.05, color: colorSeleccionado }}>
                {formatoMoneda.format(netoSeleccionado)}
              </Typography>
              <Typography sx={{ mt: 0.15, fontSize: 11, color: tokens.metric.caption }}>
                {seleccionadas.length === 1 ? '1 movimiento' : `${seleccionadas.length} movimientos`}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          mx: { xs: 1, md: 1.25 },
          mb: { xs: 1, md: 1 },
          bgcolor: tokens.content.well,
          borderRadius: 3,
          border: `1px solid ${tokens.content.border}`,
          overflow: 'hidden',
        }}>
          <Box sx={{ px: 1.1, py: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', borderBottom: `1px solid ${tokens.content.border}` }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.content.foreground }}>
              Movimientos
            </Typography>
            <BuscadorMovimientos
              operaciones={operaciones}
              query={movQuery}
              setQuery={setMovQuery}
              filtros={movFiltros}
              setFiltros={setMovFiltros}
            />
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {!selectedCuentaId && cuentas.length === 0 && !loadingCuentas ? (
              <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', px: 3, textAlign: 'center' }}>
                <Typography sx={{ color: tokens.content.muted, fontSize: 14 }}>
                  No hay una cuenta seleccionada.
                </Typography>
              </Box>
            ) : (
              <MovimientosTable
                operaciones={operacionesVisibles}
                omitirBusquedaInterna
                loading={loadingOps}
                moneda={monedaCuenta}
                cuentaId={selectedCuentaId}
                cuentas={cuentas}
                mostrarCuenta={todasLasCuentas}
                captura={captura}
                onCapturaGuardada={handleCapturaGuardada}
                onCapturaCancelada={() => setCaptura(null)}
                onCapturaError={(mensaje) => setSnackbar({ open: true, message: mensaje, severity: 'error' })}
                onEdit={abrirEdicionOperacion}
                onEdicionAvanzada={(op) => {
                  setCaptura(null);
                  setOperacionDialog({ open: true, operacion: op });
                }}
                onAdjuntosActualizados={() => { void loadOperaciones(selectedCuentaId); }}
                onDelete={requestDeleteOperacion}
                onSeleccionChange={alCambiarSeleccion}
                onEliminarSeleccion={requestDeleteSeleccion}
                onDuplicarSeleccion={(filas) => { void duplicarSeleccion(filas); }}
                onMoverSeleccion={abrirMoverSeleccion}
                onMarcarSeleccion={(filas, estado) => { void marcarSeleccion(filas, estado); }}
                hayOtraCuenta={cuentasDestino.length > 0}
                onView={(op) => {
                  setDetalleOperacionId(op.id);
                  setDetalleOpen(true);
                }}
                showToolbar={false}
              />
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <>
      {esMovil ? (
        <TesoreriaMobileView
          vista={vistaMovil}
          onVista={setVistaMovil}
          cuentas={cuentas}
          loadingCuentas={loadingCuentas}
          selectedCuenta={selectedCuenta}
          operaciones={operaciones}
          operacionesVisibles={operacionesVisibles}
          loadingOps={loadingOps}
          formatoMoneda={formatoMoneda}
          error={error}
          onDismissError={() => setError(null)}
          onSelectCuenta={aplicarCuenta}
          onSelectTodas={() => { aplicarCuenta(null); setVistaMovil('cuenta'); }}
          onNuevaCuenta={() => setCuentaDialog({ open: true, cuenta: null })}
          onEditarCuenta={handleEditarCuenta}
          onEliminarCuenta={(cuenta) => { void handleDeleteCuenta(cuenta); }}
          onRecalcularSaldos={esAdmin ? () => setRecalcularDialogOpen(true) : undefined}
          onProgramacionPagos={() => navigate('/finanzas/programacion-pagos')}
          onOpenDetalle={(operacion) => {
            setDetalleOperacionId(operacion.id);
            setDetalleOpen(true);
          }}
          onOpenOrigen={(ruta) => navigate(ruta)}
          onRefresh={async (cuentaId) => {
            if (cuentaId > 0 && cuentaId !== selectedCuentaId) aplicarCuenta(cuentaId);
            await loadOperaciones(cuentaId > 0 ? cuentaId : selectedCuentaId);
            await loadCuentas();
          }}
          onAviso={(message, severity) => setSnackbar({ open: true, message, severity })}
          query={movQuery}
          setQuery={setMovQuery}
          filtros={movFiltros}
          setFiltros={setMovFiltros}
        />
      ) : vistaEscritorio}

      <OperacionDialog
        open={operacionDialog.open}
        cuentas={cuentas}
        defaultCuentaId={selectedCuentaId}
        operacion={operacionDialog.operacion ?? null}
        onClose={() => setOperacionDialog({ open: false, operacion: null })}
        onSaved={handleOperacionGuardada}
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
        onClose={() => { if (!accionSeleccion) setConfirmDelete({ open: false, operaciones: [] }); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          {confirmDelete.operaciones.length > 1 ? `¿Eliminar ${confirmDelete.operaciones.length} movimientos?` : '¿Eliminar la operación?'}
        </DialogTitle>
        <DialogContent sx={{ pb: 0 }}>
          <Typography variant="body2" color="text.secondary">
            {confirmDelete.operaciones.length > 1
              ? `Se eliminarán ${confirmDelete.operaciones.length} movimientos.`
              : 'Esta acción eliminará el movimiento seleccionado.'}
            {confirmDelete.operaciones.some((op) => op.es_transferencia) ? ' Las transferencias se eliminan completas, en las dos cuentas.' : ''}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button onClick={() => setConfirmDelete({ open: false, operaciones: [] })} disabled={accionSeleccion} sx={{ textTransform: 'none' }}>
            No eliminar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => { void confirmDeleteOperacion(); }}
            disabled={accionSeleccion}
            sx={{ textTransform: 'none', borderRadius: 999 }}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={moverDialog.open}
        onClose={() => { if (!accionSeleccion) setMoverDialog({ open: false, operaciones: [], cuentaId: '' }); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>Mover a otra cuenta</DialogTitle>
        <DialogContent sx={{ pb: 0 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {moverDialog.operaciones.length === 1
              ? 'El movimiento conservará fecha, monto, contacto y referencia. Quedará en la cuenta destino de esta empresa.'
              : `${moverDialog.operaciones.length} movimientos conservarán sus datos y pasarán a la cuenta destino.`}
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel id="cuenta-destino-label">Cuenta destino</InputLabel>
            <Select
              labelId="cuenta-destino-label"
              label="Cuenta destino"
              value={moverDialog.cuentaId}
              onChange={(event) => setMoverDialog((prev) => ({ ...prev, cuentaId: Number(event.target.value) }))}
            >
              {cuentasDestino.map((cuenta) => (
                <MenuItem key={cuenta.id} value={cuenta.id}>{cuenta.identificador}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button onClick={() => setMoverDialog({ open: false, operaciones: [], cuentaId: '' })} disabled={accionSeleccion} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => { void confirmarMoverSeleccion(); }}
            disabled={accionSeleccion || !moverDialog.cuentaId}
            sx={{ textTransform: 'none', borderRadius: 999 }}
          >
            Mover
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
        <DialogTitle sx={{ pb: 1 }}>Recalcular saldos de Tesorería</DialogTitle>
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
    </>
  );
}

function iconoAccionSx(tokens: { action: { disabled: string; primary: string; primaryForeground: string; primaryHover: string } }, disabled: boolean) {
  return {
    width: 34,
    height: 34,
    borderRadius: '10px',
    bgcolor: disabled ? tokens.action.disabled : tokens.action.primary,
    color: tokens.action.primaryForeground,
    '&:hover': { bgcolor: disabled ? tokens.action.disabled : tokens.action.primaryHover },
    '&.Mui-disabled': { bgcolor: tokens.action.disabled, color: tokens.action.primaryForeground },
  };
}

export default FinanzasPage;
