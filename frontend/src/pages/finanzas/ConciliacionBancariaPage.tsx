import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { DataGrid, type GridColDef, type GridRowSelectionModel } from '@mui/x-data-grid';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { esES } from '@mui/x-data-grid/locales';
import { STANDARD_DATA_GRID_HEADER_HEIGHT, STANDARD_DATA_GRID_ROW_HEIGHT, standardDataGridSx } from '../../components/grids/standardDataGridSx';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HistoryIcon from '@mui/icons-material/History';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import LockIcon from '@mui/icons-material/Lock';
import UndoIcon from '@mui/icons-material/Undo';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type { FinanzasCuenta, HistorialConciliacion, MovimientoConciliacion } from '../../types/finanzas';
import { resolverFolioVisual } from '../../utils/documentos.utils';
import {
  fetchCuentas,
  fetchConciliacionMovimientos,
  fetchHistorialConciliaciones,
  fetchMovimientosConciliacion,
  cotejarMovimientosSvc,
  cerrarConciliacion,
  deshacerConciliacionSvc,
} from '../../services/finanzasService';
import { HistorialConciliacionesDialog } from '../../modules/finanzas/HistorialConciliacionesDialog';
import { ImportarEstadoCuentaDialog } from '../../modules/finanzas/ImportarEstadoCuentaDialog';
import { useSession } from '../../session/useSession';

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

const claveSaldoBanco = (empresaId: number | null, cuenta: number | '') =>
  `emphasys.conciliacion.saldoBanco.${empresaId ?? 'sin-empresa'}.${cuenta || 'sin-cuenta'}`;

const leerSaldoBanco = (empresaId: number | null, cuenta: number | '') => {
  if (!cuenta) return '0.00';
  try {
    return sessionStorage.getItem(claveSaldoBanco(empresaId, cuenta)) ?? '0.00';
  } catch {
    return '0.00';
  }
};

const guardarSaldoBanco = (empresaId: number | null, cuenta: number | '', valor: string) => {
  if (!cuenta) return;
  try {
    sessionStorage.setItem(claveSaldoBanco(empresaId, cuenta), valor);
  } catch {
    /* el navegador puede bloquear el almacenamiento de sesión */
  }
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  cotejado: 'Encontrado en banco',
  conciliado: 'Conciliado',
};

export default function ConciliacionBancariaPage() {
  const navigate = useNavigate();
  const tokens = useTheme().emphasys;
  const { session } = useSession();
  const [searchParams] = useSearchParams();

  const [cuentas, setCuentas] = useState<FinanzasCuenta[]>([]);
  const [cuentaId] = useState<number | ''>(() => {
    const p = searchParams.get('cuenta_id');
    return p ? Number(p) : '';
  });
  const [fechaCorte, setFechaCorte] = useState<string>(() => toCivilDate());
  const [saldoBanco, setSaldoBanco] = useState(() => leerSaldoBanco(session.empresaActivaId, cuentaId));

  const [movimientos, setMovimientos] = useState<MovimientoConciliacion[]>([]);
  const [saldoSistema, setSaldoSistema] = useState(0);
  const [saldoConciliadoAnterior, setSaldoConciliadoAnterior] = useState(0);
  const [totalDepositosCotejados, setTotalDepositosCotejados] = useState(0);
  const [totalRetirosCotejados, setTotalRetirosCotejados] = useState(0);
  const [saldoConciliadoCalculado, setSaldoConciliadoCalculado] = useState(0);
  const [moneda, setMoneda] = useState('MXN');
  const [conciliacionExistente, setConciliacionExistente] = useState(false);
  const [conciliacionExistenteId, setConciliacionExistenteId] = useState<number | null>(null);
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
  const [conciliacionSeleccionada, setConciliacionSeleccionada] = useState<HistorialConciliacion | null>(null);
  const [movimientosHistorial, setMovimientosHistorial] = useState<MovimientoConciliacion[]>([]);
  const [cargandoMovimientosHistorial, setCargandoMovimientosHistorial] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [deshaciendo, setDeshaciendo] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);
  const fechaInicializadaRef = useRef(false);

  const [procesandoFila, setProcesandoFila] = useState<Set<number>>(new Set());

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    msg: string;
    sev: 'success' | 'error' | 'info';
  }>({ open: false, msg: '', sev: 'success' });

  useEffect(() => {
    setSaldoBanco(leerSaldoBanco(session.empresaActivaId, cuentaId));
  }, [session.empresaActivaId, cuentaId]);

  useEffect(() => {
    fetchCuentas().then(setCuentas).catch(console.error);
  }, []);

  useEffect(() => {
    if (!cuentaId || fechaInicializadaRef.current) return;
    fechaInicializadaRef.current = true;
    void fetchHistorialConciliaciones(Number(cuentaId)).then((data) => {
      const ultima = data.filter((item) => item.estatus === 'cerrada').map((item) => item.fecha_corte.slice(0, 10)).sort().at(-1);
      if (!ultima || ultima < toCivilDate()) return;
      const siguiente = new Date(`${ultima}T12:00:00`);
      siguiente.setDate(siguiente.getDate() + 1);
      setFechaCorte(toCivilDate(siguiente));
    }).catch(() => undefined);
  }, [cuentaId]);

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
      setConciliacionExistente(res.conciliacion_existente);
      setConciliacionExistenteId(res.conciliacion_id);
      setSeleccionados([]);
    } catch (err: any) {
      setSnackbar({ open: true, msg: err.message || 'Error al cargar movimientos', sev: 'error' });
    } finally {
      setCargando(false);
    }
  }, [cuentaId, fechaCorte]);

  useEffect(() => { void cargar(); }, [cargar]);

  const cargarHistorial = useCallback(async (trasEliminarId?: number) => {
    if (!cuentaId) return;
    setCargandoHistorial(true);
    try {
      const data = await fetchHistorialConciliaciones(Number(cuentaId));
      setHistorial(data);
      setConciliacionSeleccionada((actual) => {
        if (trasEliminarId != null) {
          return data.find((item) => item.estatus === 'cerrada')
            ?? data.find((item) => item.id !== trasEliminarId)
            ?? null;
        }
        return data.find((item) => item.id === actual?.id) ?? data[0] ?? null;
      });
    } catch (err: any) {
      setSnackbar({ open: true, msg: err.message || 'Error al cargar historial', sev: 'error' });
    } finally {
      setCargandoHistorial(false);
    }
  }, [cuentaId]);

  useEffect(() => {
    if (!conciliacionSeleccionada) { setMovimientosHistorial([]); return; }
    setCargandoMovimientosHistorial(true);
    void fetchMovimientosConciliacion(conciliacionSeleccionada.id)
      .then(setMovimientosHistorial)
      .catch(() => setMovimientosHistorial([]))
      .finally(() => setCargandoMovimientosHistorial(false));
  }, [conciliacionSeleccionada]);

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
      const eliminadaId = conciliacionADeshacer.id;
      const res = await deshacerConciliacionSvc(eliminadaId, { motivo: motivoAnulacion });
      setSnackbar({ open: true, msg: `Conciliación #${res.conciliacion_id} eliminada correctamente.`, sev: 'success' });
      setDeshacerDialogOpen(false);
      setConciliacionADeshacer(null);
      void cargarHistorial(eliminadaId);
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

  const handleToggleFila = useCallback(async (row: MovimientoConciliacion) => {
    if (row.estado_conciliacion === 'conciliado') return;
    const nuevoEstado: 'pendiente' | 'cotejado' =
      row.estado_conciliacion === 'cotejado' ? 'pendiente' : 'cotejado';
    setProcesandoFila((prev) => new Set(prev).add(row.id));
    try {
      await cotejarMovimientosSvc([row.id], nuevoEstado);
      await cargar();
    } catch (err: any) {
      setSnackbar({ open: true, msg: err.message || 'Error al actualizar estado', sev: 'error' });
    } finally {
      setProcesandoFila((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  }, [cargar]);

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
        field: '__toggle',
        headerName: '',
        width: 40,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: ({ row }) => {
          const cerrado = row.estado_conciliacion === 'conciliado';
          const esCotejado = row.estado_conciliacion === 'cotejado';
          const cargandoFila = procesandoFila.has(row.id);
          const titulo = cerrado
            ? 'Conciliado. Esta conciliación ya está cerrada'
            : esCotejado
              ? 'Encontrado en banco. Clic para volver a pendiente'
              : 'Pendiente. Clic para marcar encontrado en banco';
          return (
            <Tooltip title={titulo} placement="right" arrow>
              <span>
                <IconButton
                  size="small"
                  aria-label={titulo}
                  disabled={cargandoFila}
                  onClick={(e) => { e.stopPropagation(); if (!cerrado) void handleToggleFila(row); }}
                  sx={{ p: 0.25 }}
                >
                  {cargandoFila
                    ? <CircularProgress size={14} />
                    : cerrado
                      ? <LockIcon sx={{ fontSize: 16, color: tokens.content.secondary }} />
                      : esCotejado
                        ? <CheckCircleIcon sx={{ fontSize: 18, color: tokens.metric.exhausted.foreground }} />
                        : <RadioButtonUncheckedIcon sx={{ fontSize: 18, color: tokens.content.muted }} />
                  }
                </IconButton>
              </span>
            </Tooltip>
          );
        },
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
      { field: 'referencia', headerName: 'Referencia', flex: 1.1, minWidth: 160 },
      { field: 'contacto_nombre', headerName: 'Contacto', flex: 1.4, minWidth: 180 },
      { field: 'concepto_nombre', headerName: 'Concepto', flex: 1.4, minWidth: 180 },
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
      { field: 'observaciones', headerName: 'Observaciones', flex: 1.6, minWidth: 200 },
    ],
    [handleToggleFila, procesandoFila, tokens]
  );

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: { xs: 1.5, md: 2.75 }, py: 1.6, display: 'flex', flexDirection: 'column', gap: 1.5, bgcolor: tokens.content.background }}>
      <Box
        component="button"
        type="button"
        onClick={() => navigate(cuentaId ? `/finanzas?cuenta_id=${cuentaId}` : '/finanzas')}
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, border: 0, bgcolor: 'transparent', color: tokens.content.foreground, font: 'inherit', cursor: 'pointer', p: 0, width: 'fit-content' }}
      >
        <ArrowBackIcon fontSize="small" /> Tesorería
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: tokens.content.muted }}>
            CONCILIACIÓN
          </Typography>
          <Typography variant="figure" sx={{ mt: 0.35, fontSize: { xs: 26, md: 32 }, letterSpacing: '-0.02em', lineHeight: 1, color: tokens.content.foreground }}>
            {cuentaSeleccionada?.identificador || 'Sin cuenta seleccionada'}
          </Typography>
        </Box>
      </Box>

      {/* Filtros */}
      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 3, bgcolor: tokens.content.elevated, border: `1px solid ${tokens.content.border}` }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-end' }} flexWrap="wrap">
          <Box sx={{ width: 280 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.content.secondary, mb: 0.4 }}>
              Fecha de corte
            </Typography>
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
              <DatePicker
                value={fechaCorte ? dayjs(fechaCorte) : null}
                onChange={(value) => setFechaCorte(value?.isValid() ? value.format('YYYY-MM-DD') : '')}
                format="DD/MM/YYYY"
                slotProps={{
                  textField: {
                    fullWidth: true,
                    sx: {
                      '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root, & .MuiPickersInputBase-root': {
                        bgcolor: tokens.metric.amount.background,
                        borderRadius: 1,
                        color: tokens.content.foreground,
                        '& fieldset': { borderColor: tokens.action.primary, borderWidth: 1.5 },
                        '&:hover fieldset': { borderColor: tokens.action.primaryHover },
                        '&.Mui-focused fieldset': { borderColor: tokens.action.primary, borderWidth: 1.5 },
                      },
                      '& .MuiOutlinedInput-input, & .MuiPickersSectionList-root, & .MuiPickersInputBase-sectionsContainer': {
                        fontSize: 22,
                        fontWeight: 500,
                        fontFamily: 'Iowan Old Style, Palatino, Georgia, serif',
                        lineHeight: 1.2,
                        paddingTop: '10px',
                        paddingBottom: '10px',
                      },
                    },
                  },
                  openPickerButton: {
                    sx: {
                      color: tokens.action.primary,
                      '&:hover': { bgcolor: tokens.action.hoverTint, color: tokens.action.primaryHover },
                    },
                  },
                  desktopPaper: {
                    sx: {
                      bgcolor: tokens.content.elevated,
                      color: tokens.content.foreground,
                      border: `1px solid ${tokens.content.border}`,
                      '& .MuiPickersCalendarHeader-label, & .MuiPickersArrowSwitcher-button, & .MuiDayCalendar-weekDayLabel': {
                        color: tokens.content.foreground,
                      },
                      '& .MuiPickersArrowSwitcher-button:hover': { bgcolor: tokens.metric.amount.background },
                      '& .MuiPickersDay-root': {
                        color: tokens.content.foreground,
                        '&:hover': { bgcolor: tokens.metric.amount.background },
                        '&.MuiPickersDay-today': { borderColor: tokens.action.primary },
                        '&.Mui-selected': {
                          bgcolor: tokens.action.primary,
                          color: tokens.action.primaryForeground,
                          '&:hover, &:focus': { bgcolor: tokens.action.primaryHover },
                        },
                      },
                    },
                  },
                }}
              />
            </LocalizationProvider>
          </Box>

          <Box sx={{ minWidth: 220 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.content.secondary, mb: 0.4 }}>
              Saldo banco
            </Typography>
            <TextField
              value={saldoBanco}
              onChange={(e) => {
                const valor = e.target.value.replace(/[^\d.,]/g, '');
                setSaldoBanco(valor);
                guardarSaldoBanco(session.empresaActivaId, cuentaId, valor);
              }}
              onFocus={(e) => {
                const n = parseSaldo(e.target.value);
                const valor = n === 0 ? '' : String(n);
                setSaldoBanco(valor);
                guardarSaldoBanco(session.empresaActivaId, cuentaId, valor);
              }}
              onBlur={() => {
                const valor = fmtSaldoDisplay(saldoBanco);
                setSaldoBanco(valor);
                guardarSaldoBanco(session.empresaActivaId, cuentaId, valor);
              }}
              placeholder="0.00"
              sx={{
                width: 220,
                '& .MuiOutlinedInput-root': {
                  bgcolor: tokens.metric.amount.background,
                  borderRadius: 1,
                  '& fieldset': { borderColor: tokens.action.primary, borderWidth: 1.5 },
                  '&:hover fieldset': { borderColor: tokens.action.primaryHover },
                  '&.Mui-focused fieldset': { borderColor: tokens.action.primary, borderWidth: 1.5 },
                },
              }}
              inputProps={{ inputMode: 'decimal', style: { fontSize: 22, fontWeight: 500, textAlign: 'right', fontFamily: 'Iowan Old Style, Palatino, Georgia, serif', paddingTop: 10, paddingBottom: 10 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography sx={{ fontSize: 18, color: tokens.content.secondary }}>$</Typography>
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Box sx={{ ml: 'auto !important', alignSelf: 'flex-end', pb: 0.25, display: 'flex', gap: 0.75 }}>
            <Tooltip title="Historial" arrow>
              <span>
                <IconButton aria-label="Historial" onClick={handleAbrirHistorial} disabled={!cuentaId} sx={iconoAccionSx(tokens, !cuentaId)}>
                  <HistoryIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Importar estado de cuenta" arrow>
              <span>
                <IconButton aria-label="Importar estado de cuenta" onClick={() => setImportarOpen(true)} disabled={!cuentaId} sx={iconoAccionSx(tokens, !cuentaId)}>
                  <UploadFileIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Stack>
      </Paper>

      {/* KPIs */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
        <KpiCard label="Saldo banco" value={fmt(saldoBancoNum, moneda)} fondo={tokens.metric.amount.background} tinta={tokens.content.foreground} caption={tokens.metric.caption} />
        <KpiCard label="Saldo conciliado anterior" value={fmt(saldoConciliadoAnterior, moneda)} fondo={tokens.content.elevated} tinta={tokens.content.foreground} caption={tokens.metric.caption} />
        <KpiCard label="Depósitos encontrados" value={`+${fmt(totalDepositosCotejados, moneda)}`} fondo={tokens.metric.applied.background} tinta={tokens.content.foreground} caption={tokens.metric.caption} />
        <KpiCard label="Retiros encontrados" value={`−${fmt(totalRetirosCotejados, moneda)}`} fondo={tokens.metric.blocked.background} tinta={tokens.content.foreground} caption={tokens.metric.caption} />
        <KpiCard label="Saldo conciliado" value={fmt(saldoConciliadoCalculado, moneda)} fondo={tokens.metric.available.background} tinta={tokens.content.foreground} caption={tokens.metric.caption} />
        <KpiCard
          label="Diferencia"
          value={cuadra && cuentaId ? 'Cuadra' : fmt(diferencia, moneda)}
          fondo={cuadra && cuentaId ? tokens.metric.exhausted.background : tokens.metric.blocked.background}
          tinta={tokens.content.foreground}
          caption={tokens.metric.caption}
          destacado
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
        {conciliacionExistente && (
          <Alert severity="warning" sx={{ py: 0.5 }}>
            Ya existe un cierre histórico para esta cuenta y fecha
            {conciliacionExistenteId ? ` (#${conciliacionExistenteId})` : ''}. Puedes cambiar la fecha para cerrar una nueva conciliación.
          </Alert>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
          El círculo marca pendiente y la paloma verde, encontrado en banco. Al cerrar, solo esos quedan conciliados.
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
            {kpis.count > 0
              ? `${kpis.count} seleccionado${kpis.count !== 1 ? 's' : ''}`
              : 'Selecciona operaciones para actuar'}
          </Typography>
          <Box sx={{ flex: 1 }} />

          <Tooltip title="Marcar la selección como encontrado en banco" arrow>
            <span>
              <IconButton
                aria-label="Marcar la selección como encontrado en banco"
                onClick={() => void handleCotejar('cotejado')}
                disabled={kpis.count === 0 || guardando}
                sx={iconoAccionSx(tokens, kpis.count === 0 || guardando)}
              >
                <CheckCircleIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Regresar la selección a pendiente" arrow>
            <span>
              <IconButton
                aria-label="Regresar la selección a pendiente"
                onClick={() => void handleCotejar('pendiente')}
                disabled={kpis.count === 0 || guardando}
                sx={iconoAccionSx(tokens, kpis.count === 0 || guardando)}
              >
                <RadioButtonUncheckedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip
            arrow
            title={
              cotejadosCount === 0
                ? 'Cerrar conciliación. No hay movimientos encontrados en banco'
                : `Cerrar conciliación. Conciliará ${cotejadosCount} movimiento(s) encontrado(s) en banco`
            }
          >
            <span>
              <IconButton
                aria-label="Cerrar conciliación"
                onClick={() => setConfirmarCerrar(true)}
                disabled={!cuentaId || !fechaCorte || guardando}
                sx={iconoAccionSx(tokens, !cuentaId || !fechaCorte || guardando)}
              >
                {guardando ? <CircularProgress size={16} sx={{ color: tokens.action.primaryForeground }} /> : <LockIcon fontSize="small" />}
              </IconButton>
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
            onRowSelectionModelChange={(selection) => {
              setSeleccionados(selection);
            }}
            isRowSelectable={(params) => params.row.estado_conciliacion !== 'conciliado'}
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
                '& .row-cotejado': { bgcolor: tokens.metric.available.background },
              },
            ]}
            initialState={{
              pagination: { paginationModel: { pageSize: 100 } },
            }}
            pageSizeOptions={[25, 50, 100]}
          />
        )}
      </Box>
      <ImportarEstadoCuentaDialog open={importarOpen} cuentas={cuentas} cuentaId={cuentaId} onClose={() => { setImportarOpen(false); void cargar(); }} onCancelar={() => setImportarOpen(false)} onImported={() => setSnackbar({ open: true, msg: 'Estado de cuenta importado correctamente', sev: 'success' })} />

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
            sx={{ textTransform: 'none' }}
          >
            {guardando ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Confirmar cierre'}
          </Button>
        </DialogActions>
      </Dialog>

      <HistorialConciliacionesDialog
        open={historialOpen}
        onClose={() => setHistorialOpen(false)}
        cuentaNombre={cuentaSeleccionada?.identificador}
        moneda={moneda}
        historial={historial}
        cargando={cargandoHistorial}
        seleccionada={conciliacionSeleccionada}
        onSeleccionar={setConciliacionSeleccionada}
        movimientos={movimientosHistorial}
        cargandoMovimientos={cargandoMovimientosHistorial}
        onEliminar={handleAbrirDeshacer}
      />

      {/* Dialog — Confirmar deshacer conciliación */}
      <Dialog
        open={deshacerDialogOpen}
        onClose={() => !deshaciendo && setDeshacerDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle fontWeight={700}>¿Eliminar conciliación?</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            {conciliacionADeshacer && (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                Esta acción eliminará la conciliación del{' '}
                <strong>{formatFecha(conciliacionADeshacer.fecha_corte)}</strong>.
                Los <strong>{conciliacionADeshacer.cantidad_movimientos} movimiento(s)</strong> conciliados
                volverán a <em>Encontrado en banco</em>, y el saldo conciliado de la cuenta regresará a{' '}
                <strong>
                  {conciliacionADeshacer.saldo_conciliado_anterior != null
                    ? fmt(conciliacionADeshacer.saldo_conciliado_anterior, moneda)
                    : '—'}
                </strong>.
                Sus movimientos volverán a <em>Encontrado en banco</em> y el saldo conciliado se restaurará al cierre anterior.
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
            No eliminar
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
              : 'Eliminar'}
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

function KpiCard({
  label,
  value,
  fondo,
  tinta,
  caption,
  destacado = false,
}: {
  label: string;
  value: string;
  fondo: string;
  tinta: string;
  caption: string;
  destacado?: boolean;
}) {
  return (
    <Box
      sx={{
        bgcolor: fondo,
        borderRadius: 2,
        px: 1.4,
        py: 1.05,
        flex: 1,
        minWidth: 140,
      }}
    >
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: caption }}>
        {label}
      </Typography>
      <Typography variant="figure" noWrap sx={{ mt: 0.25, fontSize: destacado ? 22 : 18, letterSpacing: '-0.02em', lineHeight: 1.05, color: tinta }}>
        {value}
      </Typography>
    </Box>
  );
}
