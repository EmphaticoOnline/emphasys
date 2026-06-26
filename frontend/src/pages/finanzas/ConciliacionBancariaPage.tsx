import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid, type GridColDef, type GridRowSelectionModel } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import { STANDARD_DATA_GRID_HEADER_HEIGHT, STANDARD_DATA_GRID_ROW_HEIGHT, standardDataGridSx } from '../../components/grids/standardDataGridSx';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HistoryIcon from '@mui/icons-material/History';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import LockIcon from '@mui/icons-material/Lock';
import RefreshIcon from '@mui/icons-material/Refresh';
import UndoIcon from '@mui/icons-material/Undo';
import type { FinanzasCuenta, HistorialConciliacion, MovimientoConciliacion } from '../../types/finanzas';
import { resolverFolioVisual } from '../../utils/documentos.utils';
import {
  fetchCuentas,
  fetchConciliacionMovimientos,
  fetchHistorialConciliaciones,
  cotejarMovimientosSvc,
  cerrarConciliacion,
  deshacerConciliacionSvc,
} from '../../services/finanzasService';

const fmt = (n: number, moneda = 'MXN') =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda }).format(n);

const toCivilDate = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatFecha = (value: string | null | undefined): string => {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return String(value).slice(0, 10);
};

const parseSaldo = (v: string): number =>
  parseFloat(v.replace(/,/g, '').replace(/[^\d.]/g, '')) || 0;

const fmtSaldoDisplay = (v: string): string => {
  const n = parseSaldo(v);
  if (n === 0 && v.trim() === '') return '';
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const ESTADO_CHIP: Record<string, string> = {
  pendiente: 'Pendiente',
  cotejado: 'En banco',
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  cotejado: 'Encontrado en banco',
  conciliado: 'Conciliado',
};

export default function ConciliacionBancariaPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [cuentas, setCuentas] = useState<FinanzasCuenta[]>([]);
  const [cuentaId, setCuentaId] = useState<number | ''>(() => {
    const p = searchParams.get('cuenta_id');
    return p ? Number(p) : '';
  });
  const [fechaCorte, setFechaCorte] = useState<string>(() => toCivilDate());
  const [saldoBanco, setSaldoBanco] = useState('0.00');

  const [movimientos, setMovimientos] = useState<MovimientoConciliacion[]>([]);
  const [saldoSistema, setSaldoSistema] = useState(0);
  const [saldoConciliadoAnterior, setSaldoConciliadoAnterior] = useState(0);
  const [totalDepositosCotejados, setTotalDepositosCotejados] = useState(0);
  const [totalRetirosCotejados, setTotalRetirosCotejados] = useState(0);
  const [saldoConciliadoCalculado, setSaldoConciliadoCalculado] = useState(0);
  const [moneda, setMoneda] = useState('MXN');
  const [seleccionados, setSeleccionados] = useState<GridRowSelectionModel>([]);

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [confirmarCerrar, setConfirmarCerrar] = useState(false);

  // Historial y deshacer
  const [historialOpen, setHistorialOpen] = useState(false);
  const [historial, setHistorial] = useState<HistorialConciliacion[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [deshacerDialogOpen, setDeshacerDialogOpen] = useState(false);
  const [conciliacionADeshacer, setConciliacionADeshacer] = useState<HistorialConciliacion | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [deshaciendo, setDeshaciendo] = useState(false);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    msg: string;
    sev: 'success' | 'error' | 'info';
  }>({ open: false, msg: '', sev: 'success' });

  useEffect(() => {
    fetchCuentas().then(setCuentas).catch(console.error);
  }, []);

  const cargar = useCallback(async () => {
    if (!cuentaId || !fechaCorte) return;
    setCargando(true);
    try {
      const res = await fetchConciliacionMovimientos(Number(cuentaId), fechaCorte);
      setMovimientos(res.movimientos);
      setSaldoSistema(res.saldo_sistema);
      setSaldoConciliadoAnterior(res.saldo_conciliado_anterior);
      setTotalDepositosCotejados(res.total_depositos_cotejados);
      setTotalRetirosCotejados(res.total_retiros_cotejados);
      setSaldoConciliadoCalculado(res.saldo_conciliado_calculado);
      setMoneda(res.moneda);
      setSeleccionados([]);
    } catch (err: any) {
      setSnackbar({ open: true, msg: err.message || 'Error al cargar movimientos', sev: 'error' });
    } finally {
      setCargando(false);
    }
  }, [cuentaId, fechaCorte]);

  useEffect(() => { void cargar(); }, [cargar]);

  const cargarHistorial = useCallback(async () => {
    if (!cuentaId) return;
    setCargandoHistorial(true);
    try {
      const data = await fetchHistorialConciliaciones(Number(cuentaId));
      setHistorial(data);
    } catch (err: any) {
      setSnackbar({ open: true, msg: err.message || 'Error al cargar historial', sev: 'error' });
    } finally {
      setCargandoHistorial(false);
    }
  }, [cuentaId]);

  const handleAbrirHistorial = () => {
    setHistorialOpen(true);
    void cargarHistorial();
  };

  const handleAbrirDeshacer = (c: HistorialConciliacion) => {
    setConciliacionADeshacer(c);
    setMotivoAnulacion('');
    setDeshacerDialogOpen(true);
  };

  const handleDeshacer = async () => {
    if (!conciliacionADeshacer || motivoAnulacion.trim().length < 5) return;
    setDeshaciendo(true);
    try {
      const res = await deshacerConciliacionSvc(conciliacionADeshacer.id, { motivo: motivoAnulacion });
      setSnackbar({ open: true, msg: `Conciliación #${res.conciliacion_id} deshecha correctamente.`, sev: 'success' });
      setDeshacerDialogOpen(false);
      setConciliacionADeshacer(null);
      void cargarHistorial();
      void cargar();
    } catch (err: any) {
      setSnackbar({ open: true, msg: err.message || 'Error al deshacer la conciliación', sev: 'error' });
    } finally {
      setDeshaciendo(false);
    }
  };

  const kpis = useMemo(() => {
    const sel = new Set(seleccionados.map(Number));
    return { count: sel.size };
  }, [seleccionados]);

  const saldoBancoNum = useMemo(() => parseSaldo(saldoBanco), [saldoBanco]);
  const diferencia = saldoBancoNum - saldoConciliadoCalculado;
  const cuadra = Math.abs(diferencia) < 0.01;

  const pendientesCount = movimientos.filter((m) => m.estado_conciliacion === 'pendiente').length;
  const cotejadosCount = movimientos.filter((m) => m.estado_conciliacion === 'cotejado').length;
  const cuentaSeleccionada = cuentas.find((c) => c.id === Number(cuentaId));

  const handleCotejar = async (estado: 'pendiente' | 'cotejado') => {
    if (seleccionados.length === 0) return;
    setGuardando(true);
    try {
      const res = await cotejarMovimientosSvc(seleccionados.map(Number), estado);
      setSnackbar({
        open: true,
        msg: `${res.updated} operación(es) marcada(s) como ${ESTADO_LABEL[estado] ?? estado}.`,
        sev: 'success',
      });
      await cargar();
    } catch (err: any) {
      setSnackbar({ open: true, msg: err.message || 'Error al actualizar estado', sev: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  const handleCerrar = async () => {
    setConfirmarCerrar(false);
    if (!cuentaId) return;
    setGuardando(true);
    try {
      const res = await cerrarConciliacion({
        cuenta_id: Number(cuentaId),
        fecha_corte: fechaCorte,
        saldo_banco: saldoBancoNum,
        observaciones: null,
      });
      setSnackbar({
        open: true,
        msg: `Conciliación #${res.conciliacion_id} cerrada. ${res.operaciones_conciliadas} operación(es) conciliadas.`,
        sev: 'success',
      });
      await cargar();
    } catch (err: any) {
      setSnackbar({ open: true, msg: err.message || 'Error al cerrar la conciliación', sev: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  const columns: GridColDef<MovimientoConciliacion>[] = useMemo(
    () => [
      {
        field: 'estado_conciliacion',
        headerName: 'Estado',
        width: 120,
        renderCell: ({ value }) => (
          <Chip
            label={ESTADO_CHIP[value as string] ?? value}
            size="small"
            color={value === 'cotejado' ? 'info' : 'default'}
            sx={{ fontSize: 11, fontWeight: 600 }}
          />
        ),
      },
      {
        field: 'fecha',
        headerName: 'Fecha',
        width: 100,
        renderCell: ({ value }) => formatFecha(value as string),
      },
      {
        field: 'tipo_movimiento',
        headerName: 'Tipo',
        width: 90,
        renderCell: ({ value }) => (value === 'Deposito' ? 'Depósito' : value) as string,
      },
      {
        field: 'monto',
        headerName: 'Monto',
        width: 145,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => (
          <Typography
            sx={{ fontSize: 13 }}
            color={row.tipo_movimiento === 'Deposito' ? 'success.main' : 'error.main'}
            fontWeight={600}
          >
            {row.tipo_movimiento === 'Deposito' ? '+' : '−'}
            {fmt(Number(row.monto), row.cuenta_moneda)}
          </Typography>
        ),
      },
      { field: 'referencia', headerName: 'Referencia', width: 130 },
      { field: 'contacto_nombre', headerName: 'Contacto', flex: 1, minWidth: 140 },
      { field: 'concepto_nombre', headerName: 'Concepto', flex: 1, minWidth: 130 },
      {
        field: 'documento_serie',
        headerName: 'Documento',
        width: 110,
        renderCell: ({ row }) => {
          const folio = row.documento_tipo_documento
            ? resolverFolioVisual(
                {
                  serie: row.documento_serie,
                  numero: row.documento_numero,
                  serie_externa: row.documento_serie_externa,
                  numero_externo: row.documento_numero_externo,
                },
                row.documento_tipo_documento
              )
            : null;
          return (
            <Typography sx={{ fontSize: 13 }} color={folio ? 'text.primary' : 'text.disabled'}>
              {folio ?? '—'}
            </Typography>
          );
        },
      },
      {
        field: 'dias_sin_conciliar',
        headerName: 'Días',
        width: 68,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ value }) => {
          const n = Number(value);
          const color = n > 30 ? 'error.main' : n > 7 ? 'warning.main' : 'text.secondary';
          return (
            <Typography sx={{ fontSize: 13 }} color={color} fontWeight={n > 30 ? 700 : 400}>
              {n}
            </Typography>
          );
        },
      },
      { field: 'observaciones', headerName: 'Observaciones', flex: 1, minWidth: 140 },
    ],
    []
  );

  return (
    <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
      {/* Encabezado */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton onClick={() => navigate('/finanzas')} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="h6" fontWeight={700} color="text.primary">
          Conciliación Bancaria
        </Typography>
        {cuentaSeleccionada && (
          <Chip
            label={cuentaSeleccionada.identificador}
            size="small"
            variant="outlined"
            sx={{ ml: 0.5 }}
          />
        )}
      </Stack>

      {/* Filtros */}
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" flexWrap="wrap">
          <Box sx={{ minWidth: 200 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.25}>
              Cuenta financiera *
            </Typography>
            <Select
              value={cuentaId}
              onChange={(e) => setCuentaId(e.target.value as number)}
              displayEmpty
              fullWidth
              size="small"
              sx={{ fontSize: 13 }}
            >
              <MenuItem value=""><em>Seleccionar...</em></MenuItem>
              {cuentas.map((c) => (
                <MenuItem key={c.id} value={c.id} sx={{ fontSize: 13 }}>
                  {c.identificador}
                </MenuItem>
              ))}
            </Select>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.25}>
              Fecha de corte *
            </Typography>
            <TextField
              type="date"
              value={fechaCorte}
              onChange={(e) => setFechaCorte(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              inputProps={{ style: { fontSize: 13 } }}
            />
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.25}>
              Saldo banco *
            </Typography>
            <TextField
              value={saldoBanco}
              onChange={(e) => setSaldoBanco(e.target.value.replace(/[^\d.,]/g, ''))}
              onFocus={(e) => {
                const n = parseSaldo(e.target.value);
                setSaldoBanco(n === 0 ? '' : String(n));
              }}
              onBlur={() => setSaldoBanco(fmtSaldoDisplay(saldoBanco))}
              size="small"
              sx={{ width: 175 }}
              inputProps={{ inputMode: 'decimal', style: { fontSize: 13, textAlign: 'right' } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography variant="caption" color="text.secondary">$</Typography>
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Box sx={{ ml: 'auto !important', alignSelf: 'flex-end', pb: 0.25, display: 'flex', gap: 0.5 }}>
            <Tooltip title="Ver historial de conciliaciones">
              <span>
                <Button
                  onClick={handleAbrirHistorial}
                  disabled={!cuentaId}
                  size="small"
                  startIcon={<HistoryIcon fontSize="small" />}
                  sx={{ textTransform: 'none', fontSize: 12 }}
                >
                  Historial
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Recargar movimientos de la cuenta">
              <span>
                <IconButton
                  onClick={() => void cargar()}
                  disabled={!cuentaId || !fechaCorte || cargando}
                  size="small"
                  color="primary"
                >
                  {cargando ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Stack>
      </Paper>

      {/* KPIs */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
        <KpiCard label="Saldo banco" value={fmt(saldoBancoNum, moneda)} color="#1d2f68" />
        <KpiCard label="Saldo conciliado anterior" value={fmt(saldoConciliadoAnterior, moneda)} color="#475569" />
        <KpiCard label="Depósitos encontrados" value={`+${fmt(totalDepositosCotejados, moneda)}`} color="#15803d" />
        <KpiCard label="Retiros encontrados" value={`−${fmt(totalRetirosCotejados, moneda)}`} color="#b91c1c" />
        <KpiCard label="Saldo conciliado" value={fmt(saldoConciliadoCalculado, moneda)} color="#006261" />
        <KpiCard
          label="Diferencia"
          value={cuadra && cuentaId ? '✓ Cuadra' : fmt(diferencia, moneda)}
          color={cuadra && cuentaId ? '#15803d' : '#b45309'}
          highlight={!cuadra && Boolean(cuentaId)}
          success={cuadra && Boolean(cuentaId)}
        />
      </Stack>

      {/* Alerta diferencia */}
      {cuentaId && movimientos.length > 0 && (
        cuadra ? (
          <Alert severity="success" sx={{ py: 0.5 }}>
            La conciliación cuadra: saldo banco coincide con el saldo conciliado calculado.
            {cotejadosCount > 0 && ` Hay ${cotejadosCount} movimiento(s) listo(s) para cerrar.`}
            {pendientesCount > 0 && ` Quedan ${pendientesCount} movimiento(s) pendientes de revisar.`}
          </Alert>
        ) : (
          <Alert severity="warning" sx={{ py: 0.5 }}>
            Diferencia de <strong>{fmt(diferencia, moneda)}</strong> entre saldo banco (
            {fmt(saldoBancoNum, moneda)}) y saldo conciliado ({fmt(saldoConciliadoCalculado, moneda)}).
            {pendientesCount > 0 && ` Hay ${pendientesCount} movimiento(s) pendientes de revisar.`}
          </Alert>
        )
      )}

      {/* Instrucción + barra de acciones */}
      <Stack spacing={0.75}>
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
          Selecciona los movimientos que aparecen en tu estado de cuenta del banco y márcalos como{' '}
          <strong>Encontrado en banco</strong>. Al cerrar, todos los movimientos en ese estado quedarán{' '}
          <strong>conciliados</strong> permanentemente — los pendientes no se verán afectados.
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
            {kpis.count > 0
              ? `${kpis.count} seleccionado${kpis.count !== 1 ? 's' : ''}`
              : 'Selecciona operaciones para actuar'}
          </Typography>
          <Box sx={{ flex: 1 }} />

          <Tooltip title="Confirma que los movimientos seleccionados aparecen en el estado de cuenta del banco">
            <span>
              <Button
                variant="outlined"
                startIcon={<CheckCircleOutlineIcon />}
                onClick={() => void handleCotejar('cotejado')}
                disabled={kpis.count === 0 || guardando}
                size="small"
                sx={{ textTransform: 'none', borderRadius: 999 }}
              >
                Encontrado en banco
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="Regresa los movimientos seleccionados al estado Pendiente">
            <span>
              <Button
                variant="outlined"
                startIcon={<RadioButtonUncheckedIcon />}
                onClick={() => void handleCotejar('pendiente')}
                disabled={kpis.count === 0 || guardando}
                size="small"
                sx={{ textTransform: 'none', borderRadius: 999 }}
              >
                Marcar pendiente
              </Button>
            </span>
          </Tooltip>

          <Tooltip
            title={
              cotejadosCount === 0
                ? 'No hay movimientos marcados como "Encontrado en banco"'
                : `Conciliará permanentemente ${cotejadosCount} movimiento(s) marcado(s) como encontrado en banco`
            }
          >
            <span>
              <Button
                variant="contained"
                startIcon={guardando ? undefined : <LockIcon />}
                onClick={() => setConfirmarCerrar(true)}
                disabled={!cuentaId || !fechaCorte || guardando}
                size="small"
                sx={{
                  textTransform: 'none',
                  borderRadius: 999,
                  bgcolor: '#1d2f68',
                  '&:hover': { bgcolor: '#162551' },
                }}
              >
                {guardando ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'Cerrar conciliación'}
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Grilla */}
      <Box sx={{ flex: 1, minHeight: 300 }}>
        {cargando ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 250 }}>
            <CircularProgress />
          </Box>
        ) : !cuentaId ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <Typography color="text.secondary" variant="body2">
              Selecciona una cuenta y fecha de corte para cargar los movimientos.
            </Typography>
          </Box>
        ) : (
          <DataGrid
            rows={movimientos}
            columns={columns}
            checkboxSelection
            rowSelectionModel={seleccionados}
            onRowSelectionModelChange={setSeleccionados}
            getRowId={(r) => r.id}
            rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
            columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
            disableRowSelectionOnClick={false}
            localeText={esES.components.MuiDataGrid.defaultProps.localeText}
            getRowClassName={(params) =>
              params.row.estado_conciliacion === 'cotejado' ? 'row-cotejado' : ''
            }
            sx={[
              standardDataGridSx,
              {
                fontSize: 13,
                border: 'none',
                '& .row-cotejado': { bgcolor: '#f0f9ff' },
              },
            ]}
            initialState={{
              pagination: { paginationModel: { pageSize: 100 } },
            }}
            pageSizeOptions={[25, 50, 100]}
          />
        )}
      </Box>

      {/* Diálogo confirmar cierre */}
      <Dialog open={confirmarCerrar} onClose={() => setConfirmarCerrar(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>¿Cerrar conciliación?</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Typography variant="body2">
              Se conciliarán permanentemente los{' '}
              <strong>{cotejadosCount} movimiento(s)</strong> actualmente marcados como{' '}
              <em>Encontrado en banco</em> con fecha ≤ {formatFecha(fechaCorte)}.
              Los movimientos <em>pendientes</em> ({pendientesCount}) no se verán afectados.
            </Typography>

            {cuadra ? (
              <Alert severity="success" sx={{ py: 0.5 }}>
                La conciliación cuadra correctamente — diferencia $0.00.
              </Alert>
            ) : (
              <Alert severity="warning">
                Existe una diferencia de <strong>{fmt(diferencia, moneda)}</strong> entre saldo banco (
                {fmt(saldoBancoNum, moneda)}) y saldo conciliado calculado ({fmt(saldoConciliadoCalculado, moneda)}).
                Se registrará esta diferencia en el snapshot de conciliación.
              </Alert>
            )}

            <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
              Esta acción no se puede revertir desde esta pantalla.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setConfirmarCerrar(false)} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleCerrar()}
            disabled={guardando}
            sx={{ textTransform: 'none', bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}
          >
            {guardando ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Confirmar cierre'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog — Historial de conciliaciones */}
      <Dialog
        open={historialOpen}
        onClose={() => setHistorialOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle fontWeight={700} sx={{ pb: 1 }}>
          Historial de conciliaciones
          {cuentaSeleccionada && (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              — {cuentaSeleccionada.identificador}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {cargandoHistorial ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : historial.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <Typography color="text.secondary" variant="body2">
                No hay conciliaciones registradas para esta cuenta.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Fecha corte','Saldo banco','Saldo conc. anterior','Depósitos enc.','Retiros enc.','Saldo conciliado','Diferencia','Movs.','Fecha cierre','Estatus','Motivo','Acción']
                      .map((h) => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap', color: '#475569' }}>
                          {h}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {historial.map((c, idx) => (
                    <tr
                      key={c.id}
                      style={{
                        backgroundColor: c.estatus === 'anulada' ? '#fafafa' : idx % 2 === 0 ? '#fff' : '#f8fafc',
                        borderBottom: '1px solid #f1f5f9',
                        opacity: c.estatus === 'anulada' ? 0.65 : 1,
                      }}
                    >
                      <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>{formatFecha(c.fecha_corte)}</td>
                      <td style={{ padding: '7px 12px', whiteSpace: 'nowrap', textAlign: 'right' }}>{fmt(c.saldo_banco, moneda)}</td>
                      <td style={{ padding: '7px 12px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {c.saldo_conciliado_anterior != null ? fmt(c.saldo_conciliado_anterior, moneda) : '—'}
                      </td>
                      <td style={{ padding: '7px 12px', whiteSpace: 'nowrap', textAlign: 'right', color: '#15803d' }}>
                        {c.total_depositos_cotejados != null ? `+${fmt(c.total_depositos_cotejados, moneda)}` : '—'}
                      </td>
                      <td style={{ padding: '7px 12px', whiteSpace: 'nowrap', textAlign: 'right', color: '#b91c1c' }}>
                        {c.total_retiros_cotejados != null ? `−${fmt(c.total_retiros_cotejados, moneda)}` : '—'}
                      </td>
                      <td style={{ padding: '7px 12px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {c.saldo_conciliado_calculado != null ? fmt(c.saldo_conciliado_calculado, moneda) : '—'}
                      </td>
                      <td style={{ padding: '7px 12px', whiteSpace: 'nowrap', textAlign: 'right',
                        color: c.diferencia != null && Math.abs(c.diferencia) < 0.01 ? '#15803d' : '#b45309' }}>
                        {c.diferencia != null ? fmt(c.diferencia, moneda) : '—'}
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center' }}>{c.cantidad_movimientos}</td>
                      <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>{formatFecha(c.fecha_conciliacion)}</td>
                      <td style={{ padding: '7px 12px' }}>
                        <Chip
                          label={c.estatus === 'cerrada' ? 'Cerrada' : 'Anulada'}
                          size="small"
                          color={c.estatus === 'cerrada' ? 'success' : 'default'}
                          sx={{ fontSize: 11, fontWeight: 600 }}
                        />
                      </td>
                      <td style={{ padding: '7px 12px', maxWidth: 180, color: '#64748b' }}>
                        {c.motivo_anulacion ?? '—'}
                      </td>
                      <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>
                        {c.es_ultima_reversible ? (
                          <Tooltip title="Deshacer esta conciliación">
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              startIcon={<UndoIcon />}
                              onClick={() => handleAbrirDeshacer(c)}
                              sx={{ textTransform: 'none', fontSize: 12 }}
                            >
                              Deshacer
                            </Button>
                          </Tooltip>
                        ) : c.estatus === 'cerrada' ? (
                          <Tooltip title="Solo se puede deshacer la conciliación cerrada más reciente">
                            <span>
                              <Button
                                size="small"
                                variant="outlined"
                                disabled
                                sx={{ textTransform: 'none', fontSize: 12 }}
                              >
                                Deshacer
                              </Button>
                            </span>
                          </Tooltip>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setHistorialOpen(false)} sx={{ textTransform: 'none' }}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog — Confirmar deshacer conciliación */}
      <Dialog
        open={deshacerDialogOpen}
        onClose={() => !deshaciendo && setDeshacerDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle fontWeight={700}>¿Deshacer conciliación?</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            {conciliacionADeshacer && (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                Esta acción deshará la conciliación del{' '}
                <strong>{formatFecha(conciliacionADeshacer.fecha_corte)}</strong>.
                Los <strong>{conciliacionADeshacer.cantidad_movimientos} movimiento(s)</strong> conciliados
                volverán a <em>Encontrado en banco</em>, y el saldo conciliado de la cuenta regresará a{' '}
                <strong>
                  {conciliacionADeshacer.saldo_conciliado_anterior != null
                    ? fmt(conciliacionADeshacer.saldo_conciliado_anterior, moneda)
                    : '—'}
                </strong>.
                La conciliación quedará marcada como <em>Anulada</em> para auditoría.
              </Alert>
            )}

            <Divider />

            <TextField
              label="Motivo de anulación"
              value={motivoAnulacion}
              onChange={(e) => setMotivoAnulacion(e.target.value)}
              multiline
              minRows={2}
              fullWidth
              required
              size="small"
              inputProps={{ maxLength: 500 }}
              helperText={
                motivoAnulacion.trim().length > 0 && motivoAnulacion.trim().length < 5
                  ? 'El motivo debe tener al menos 5 caracteres.'
                  : `${motivoAnulacion.length}/500`
              }
              error={motivoAnulacion.trim().length > 0 && motivoAnulacion.trim().length < 5}
            />

            <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
              Esta acción no se puede revertir desde esta pantalla.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setDeshacerDialogOpen(false)}
            disabled={deshaciendo}
            sx={{ textTransform: 'none' }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => void handleDeshacer()}
            disabled={deshaciendo || motivoAnulacion.trim().length < 5}
            startIcon={deshaciendo ? undefined : <UndoIcon />}
            sx={{ textTransform: 'none' }}
          >
            {deshaciendo
              ? <CircularProgress size={18} sx={{ color: 'white' }} />
              : 'Confirmar — Deshacer conciliación'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notificaciones */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.sev} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function KpiCard({
  label,
  value,
  color,
  highlight = false,
  success = false,
}: {
  label: string;
  value: string;
  color: string;
  highlight?: boolean;
  success?: boolean;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        borderRadius: 2,
        flex: 1,
        minWidth: 130,
        borderColor: highlight ? '#b45309' : success ? '#15803d' : 'divider',
        borderWidth: highlight || success ? 2 : 1,
        bgcolor: success ? '#f0fdf4' : highlight ? '#fffbeb' : undefined,
      }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
        {label}
      </Typography>
      <Typography fontWeight={700} color={color} noWrap sx={{ fontSize: 13, mt: 0.25 }}>
        {value}
      </Typography>
    </Paper>
  );
}
