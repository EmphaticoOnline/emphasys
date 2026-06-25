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
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, type GridColDef, type GridRowSelectionModel } from '@mui/x-data-grid';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import LockIcon from '@mui/icons-material/Lock';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { FinanzasCuenta, MovimientoConciliacion } from '../../types/finanzas';
import {
  fetchCuentas,
  fetchConciliacionMovimientos,
  cotejarMovimientosSvc,
  cerrarConciliacion,
} from '../../services/finanzasService';

const fmt = (n: number, moneda = 'MXN') =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda }).format(n);

export default function ConciliacionBancariaPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [cuentas, setCuentas] = useState<FinanzasCuenta[]>([]);
  const [cuentaId, setCuentaId] = useState<number | ''>(() => {
    const p = searchParams.get('cuenta_id');
    return p ? Number(p) : '';
  });
  const [fechaCorte, setFechaCorte] = useState<string>(() => new Date().toISOString().split('T')[0] ?? '');
  const [saldoBanco, setSaldoBanco] = useState('0');

  const [movimientos, setMovimientos] = useState<MovimientoConciliacion[]>([]);
  const [saldoSistema, setSaldoSistema] = useState(0);
  const [moneda, setMoneda] = useState('MXN');
  const [seleccionados, setSeleccionados] = useState<GridRowSelectionModel>([]);

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [confirmarCerrar, setConfirmarCerrar] = useState(false);
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
      setMoneda(res.moneda);
      setSeleccionados([]);
    } catch (err: any) {
      setSnackbar({ open: true, msg: err.message || 'Error al cargar movimientos', sev: 'error' });
    } finally {
      setCargando(false);
    }
  }, [cuentaId, fechaCorte]);

  useEffect(() => { void cargar(); }, [cargar]);

  const kpis = useMemo(() => {
    const sel = new Set(seleccionados.map(Number));
    let totalPend = 0;
    let totalCotej = 0;
    let totalSel = 0;
    for (const m of movimientos) {
      const monto = Number(m.monto);
      const signed = m.tipo_movimiento === 'Deposito' ? monto : -monto;
      if (m.estado_conciliacion === 'pendiente') totalPend += monto;
      else totalCotej += monto;
      if (sel.has(m.id)) totalSel += signed;
    }
    return { totalPend, totalCotej, totalSel, count: sel.size };
  }, [movimientos, seleccionados]);

  const saldoBancoNum = parseFloat(saldoBanco) || 0;
  const diferencia = saldoBancoNum - saldoSistema;

  const handleCotejar = async (estado: 'pendiente' | 'cotejado') => {
    if (seleccionados.length === 0) return;
    setGuardando(true);
    try {
      const res = await cotejarMovimientosSvc(seleccionados.map(Number), estado);
      setSnackbar({
        open: true,
        msg: `${res.updated} operación(es) marcadas como ${estado}.`,
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
      const operacionIds = movimientos
        .filter((m) => m.estado_conciliacion === 'cotejado')
        .map((m) => m.id);
      const res = await cerrarConciliacion({
        cuenta_id: Number(cuentaId),
        fecha_corte: fechaCorte,
        saldo_banco: saldoBancoNum,
        operacion_ids: operacionIds,
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
        width: 110,
        renderCell: ({ value }) => (
          <Chip
            label={value}
            size="small"
            color={value === 'cotejado' ? 'info' : 'default'}
            sx={{ fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}
          />
        ),
      },
      { field: 'fecha', headerName: 'Fecha', width: 100 },
      { field: 'tipo_movimiento', headerName: 'Tipo', width: 90 },
      {
        field: 'monto',
        headerName: 'Monto',
        width: 140,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ row }) => (
          <Typography
            variant="body2"
            color={row.tipo_movimiento === 'Deposito' ? 'success.main' : 'error.main'}
            fontWeight={600}
          >
            {row.tipo_movimiento === 'Deposito' ? '+' : '-'}
            {fmt(Number(row.monto), row.cuenta_moneda)}
          </Typography>
        ),
      },
      { field: 'referencia', headerName: 'Referencia', width: 130 },
      { field: 'contacto_nombre', headerName: 'Contacto', flex: 1, minWidth: 140 },
      { field: 'concepto_nombre', headerName: 'Concepto', flex: 1, minWidth: 140 },
      { field: 'documento_folio', headerName: 'Documento', width: 110 },
      {
        field: 'dias_sin_conciliar',
        headerName: 'Días',
        width: 75,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ value }) => {
          const n = Number(value);
          const color = n > 30 ? 'error.main' : n > 7 ? 'warning.main' : 'text.secondary';
          return (
            <Typography variant="body2" color={color} fontWeight={n > 30 ? 700 : 400}>
              {n}
            </Typography>
          );
        },
      },
      { field: 'observaciones', headerName: 'Observaciones', flex: 1, minWidth: 150 },
    ],
    []
  );

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton onClick={() => navigate('/finanzas')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight={700} color="text.primary">
          Conciliación Bancaria
        </Typography>
      </Stack>

      {/* Filtros */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-end" flexWrap="wrap">
          <Box sx={{ minWidth: 220 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
              Cuenta financiera *
            </Typography>
            <Select
              value={cuentaId}
              onChange={(e) => setCuentaId(e.target.value as number)}
              displayEmpty
              fullWidth
              size="small"
            >
              <MenuItem value="">
                <em>Seleccionar...</em>
              </MenuItem>
              {cuentas.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.identificador}
                </MenuItem>
              ))}
            </Select>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
              Fecha de corte *
            </Typography>
            <TextField
              type="date"
              value={fechaCorte}
              onChange={(e) => setFechaCorte(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
              Saldo banco
            </Typography>
            <TextField
              type="number"
              value={saldoBanco}
              onChange={(e) => setSaldoBanco(e.target.value)}
              size="small"
              sx={{ width: 180 }}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
            />
          </Box>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => void cargar()}
            disabled={!cuentaId || !fechaCorte || cargando}
            size="small"
            sx={{ textTransform: 'none', borderRadius: 999 }}
          >
            Actualizar
          </Button>
        </Stack>
      </Paper>

      {/* KPIs */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
        <KpiCard label="Saldo banco" value={fmt(saldoBancoNum, moneda)} color="#1d2f68" />
        <KpiCard label="Saldo sistema" value={fmt(saldoSistema, moneda)} color="#006261" />
        <KpiCard
          label="Diferencia"
          value={fmt(diferencia, moneda)}
          color={Math.abs(diferencia) < 0.01 ? '#15803d' : '#b45309'}
          highlight={Math.abs(diferencia) >= 0.01}
        />
        <KpiCard
          label="Pendiente"
          value={`${movimientos.filter((m) => m.estado_conciliacion === 'pendiente').length} mov — ${fmt(kpis.totalPend, moneda)}`}
          color="#64748b"
        />
        <KpiCard
          label="Cotejado"
          value={`${movimientos.filter((m) => m.estado_conciliacion === 'cotejado').length} mov — ${fmt(kpis.totalCotej, moneda)}`}
          color="#0ea5e9"
        />
      </Stack>

      {/* Barra de acciones */}
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Typography variant="body2" color="text.secondary">
          {kpis.count > 0 ? `${kpis.count} seleccionados` : 'Selecciona operaciones para cotejar'}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined"
          startIcon={<CheckCircleOutlineIcon />}
          onClick={() => void handleCotejar('cotejado')}
          disabled={kpis.count === 0 || guardando}
          size="small"
          sx={{ textTransform: 'none', borderRadius: 999 }}
        >
          Marcar cotejado
        </Button>
        <Button
          variant="outlined"
          startIcon={<RadioButtonUncheckedIcon />}
          onClick={() => void handleCotejar('pendiente')}
          disabled={kpis.count === 0 || guardando}
          size="small"
          sx={{ textTransform: 'none', borderRadius: 999 }}
        >
          Volver a pendiente
        </Button>
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
      </Stack>

      {/* Grid */}
      <Box sx={{ flex: 1, minHeight: 400 }}>
        {cargando ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
            <CircularProgress />
          </Box>
        ) : !cuentaId ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <Typography color="text.secondary">Selecciona una cuenta y fecha de corte para cargar los movimientos.</Typography>
          </Box>
        ) : (
          <DataGrid
            rows={movimientos}
            columns={columns}
            checkboxSelection
            rowSelectionModel={seleccionados}
            onRowSelectionModelChange={setSeleccionados}
            getRowId={(r) => r.id}
            density="compact"
            disableRowSelectionOnClick={false}
            sx={{
              border: 'none',
              '& .MuiDataGrid-columnHeader': { bgcolor: '#f8fafc' },
            }}
            initialState={{
              pagination: { paginationModel: { pageSize: 100 } },
            }}
            pageSizeOptions={[25, 50, 100]}
          />
        )}
      </Box>

      {/* Dialog confirmar cierre */}
      <Dialog
        open={confirmarCerrar}
        onClose={() => setConfirmarCerrar(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle fontWeight={700}>¿Cerrar conciliación?</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>
              Se marcarán como <strong>conciliadas</strong> todas las operaciones en estado{' '}
              <strong>cotejado</strong> con fecha ≤ {fechaCorte} en esta cuenta.
            </Typography>
            {Math.abs(diferencia) >= 0.01 && (
              <Alert severity="warning">
                Hay una diferencia de{' '}
                <strong>{fmt(diferencia, moneda)}</strong> entre el saldo banco (
                {fmt(saldoBancoNum, moneda)}) y el saldo sistema ({fmt(saldoSistema, moneda)}).
                Se registrará esta diferencia en el snapshot de conciliación.
              </Alert>
            )}
            <Typography variant="body2" color="text.secondary">
              Esta acción no se puede revertir desde esta pantalla.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setConfirmarCerrar(false)}
            sx={{ textTransform: 'none' }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleCerrar()}
            disabled={guardando}
            sx={{
              textTransform: 'none',
              bgcolor: '#1d2f68',
              '&:hover': { bgcolor: '#162551' },
            }}
          >
            {guardando ? (
              <CircularProgress size={18} sx={{ color: 'white' }} />
            ) : (
              'Confirmar cierre'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.sev}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
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
}: {
  label: string;
  value: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 2,
        flex: 1,
        minWidth: 150,
        borderColor: highlight ? color : 'divider',
        borderWidth: highlight ? 2 : 1,
      }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={600}>
        {label}
      </Typography>
      <Typography variant="subtitle1" fontWeight={700} color={color} noWrap>
        {value}
      </Typography>
    </Paper>
  );
}
