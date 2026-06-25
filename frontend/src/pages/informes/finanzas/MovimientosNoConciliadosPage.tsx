import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { DataGrid } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../api/apiClient';
import {
  STANDARD_DATA_GRID_HEADER_HEIGHT,
  STANDARD_DATA_GRID_ROW_HEIGHT,
  standardDataGridSx,
} from '../../../components/grids/standardDataGridSx';
import {
  fetchMovimientosNoConciliados,
  buildMovimientosNoConciliadosExportUrl,
  type MovimientoNoConciliado,
  type MovimientosNoConciliadosParams,
} from '../../../services/reportesService';

type CuentaOpcion   = { id: number; identificador: string; moneda?: string };
type ContactoOpcion = { id: number; nombre: string; rfc?: string | null };

const formatMonto = (v: number, moneda = 'MXN') =>
  v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
  (moneda !== 'MXN' ? ` ${moneda}` : '');

const formatFecha = (iso: string): string => {
  if (!iso || iso.length < 10) return iso;
  const [yr, mo, da] = iso.slice(0, 10).split('-');
  return `${da}-${mo}-${yr}`;
};

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const NATURALEZA_LABEL: Record<string, string> = {
  cobro_cliente:     'Cobro cliente',
  pago_proveedor:    'Pago proveedor',
  movimiento_general: 'General',
};

const ESTADO_COLOR: Record<string, 'default' | 'warning' | 'info'> = {
  pendiente: 'warning',
  cotejado:  'info',
};

const COLUMNAS: GridColDef<MovimientoNoConciliado>[] = [
  {
    field: 'fecha',
    headerName: 'Fecha',
    width: 95,
    renderCell: (p: GridRenderCellParams<MovimientoNoConciliado, string>) => formatFecha(p.value ?? ''),
  },
  {
    field: 'cuenta_nombre',
    headerName: 'Cuenta',
    width: 150,
  },
  {
    field: 'tipo_movimiento',
    headerName: 'Tipo',
    width: 90,
    renderCell: (p: GridRenderCellParams<MovimientoNoConciliado, string>) => {
      const v = p.value ?? '';
      const color = v === 'Deposito' ? 'success.main' : 'error.main';
      return <Typography variant="body2" color={color}>{v}</Typography>;
    },
  },
  {
    field: 'naturaleza_operacion',
    headerName: 'Naturaleza',
    width: 130,
    renderCell: (p: GridRenderCellParams<MovimientoNoConciliado, string>) => (
      <Typography variant="body2" color="text.secondary">
        {NATURALEZA_LABEL[p.value ?? ''] ?? p.value}
      </Typography>
    ),
  },
  {
    field: 'contacto_nombre',
    headerName: 'Contacto',
    flex: 1,
    minWidth: 140,
    renderCell: (p: GridRenderCellParams<MovimientoNoConciliado, string | null>) => (
      <Typography variant="body2" color={p.value ? 'text.primary' : 'text.disabled'}>
        {p.value ?? '—'}
      </Typography>
    ),
  },
  {
    field: 'concepto_nombre',
    headerName: 'Concepto',
    width: 130,
    renderCell: (p: GridRenderCellParams<MovimientoNoConciliado, string | null>) => (
      <Typography variant="body2" color={p.value ? 'text.primary' : 'text.disabled'}>
        {p.value ?? '—'}
      </Typography>
    ),
  },
  {
    field: 'metodo_pago_nombre',
    headerName: 'Método',
    width: 120,
    renderCell: (p: GridRenderCellParams<MovimientoNoConciliado, string | null>) => (
      <Typography variant="body2" color={p.value ? 'text.primary' : 'text.disabled'}>
        {p.value ?? '—'}
      </Typography>
    ),
  },
  { field: 'referencia', headerName: 'Referencia', width: 110 },
  {
    field: 'monto',
    headerName: 'Monto',
    width: 130,
    align: 'right',
    headerAlign: 'right',
    renderCell: (p: GridRenderCellParams<MovimientoNoConciliado, number>) => (
      <Typography variant="body2" fontWeight={700}>
        {formatMonto(p.value ?? 0, p.row.moneda)}
      </Typography>
    ),
  },
  { field: 'moneda', headerName: 'Moneda', width: 75 },
  {
    field: 'estado_conciliacion',
    headerName: 'Estado',
    width: 105,
    renderCell: (p: GridRenderCellParams<MovimientoNoConciliado, string>) => (
      <Chip
        label={p.value ?? ''}
        color={ESTADO_COLOR[p.value ?? ''] ?? 'default'}
        size="small"
        variant="outlined"
        sx={{ textTransform: 'capitalize' }}
      />
    ),
  },
  {
    field: 'dias_sin_conciliar',
    headerName: 'Días',
    width: 70,
    align: 'right',
    headerAlign: 'right',
    renderCell: (p: GridRenderCellParams<MovimientoNoConciliado, number>) => {
      const d = p.value ?? 0;
      const color = d > 30 ? 'error.main' : d > 7 ? 'warning.main' : 'text.secondary';
      return <Typography variant="body2" color={color} fontWeight={d > 30 ? 700 : 400}>{d}</Typography>;
    },
  },
  {
    field: 'documento_folio',
    headerName: 'Folio doc.',
    width: 100,
    renderCell: (p: GridRenderCellParams<MovimientoNoConciliado, string | null>) => (
      <Typography variant="body2" color={p.value ? 'text.primary' : 'text.disabled'}>
        {p.value ?? '—'}
      </Typography>
    ),
  },
];

type KpiMoneda = {
  moneda: string;
  totalPendiente: number;
  totalCotejado: number;
  cantPendiente: number;
  cantCotejado: number;
  maxDias: number;
};

export default function MovimientosNoConciliadosPage() {
  const navigate = useNavigate();

  const [fechaInicio,   setFechaInicio]   = useState('');
  const [fechaFin,      setFechaFin]      = useState('');
  const [cuenta,        setCuenta]        = useState<CuentaOpcion | null>(null);
  const [cuentas,       setCuentas]       = useState<CuentaOpcion[]>([]);
  const [contacto,      setContacto]      = useState<ContactoOpcion | null>(null);
  const [opcContactos,  setOpcContactos]  = useState<ContactoOpcion[]>([]);
  const [buscandoConts, setBuscandoConts] = useState(false);
  const [estado,        setEstado]        = useState('');
  const [tipoMov,       setTipoMov]       = useState('');
  const [naturaleza,    setNaturaleza]    = useState('');
  const [minDias,       setMinDias]       = useState('');

  const [loading,    setLoading]    = useState(false);
  const [exportando, setExportando] = useState(false);
  const [rows,       setRows]       = useState<MovimientoNoConciliado[]>([]);
  const [fechaCorte, setFechaCorte] = useState(hoy());
  const [error,      setError]      = useState<string | null>(null);
  const [snackOpen,  setSnackOpen]  = useState(false);
  const [cargado,    setCargado]    = useState(false);

  const timerConts = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiFetch('/api/finanzas/cuentas').then(async (res) => {
      if (res.ok) {
        const data = (await res.json()) as CuentaOpcion[];
        setCuentas(Array.isArray(data) ? data : []);
      }
    }).catch(() => {});
  }, []);

  const buscarContactos = useCallback((input: string) => {
    if (timerConts.current) clearTimeout(timerConts.current);
    timerConts.current = setTimeout(async () => {
      setBuscandoConts(true);
      try {
        const qs = new URLSearchParams({ limit: '40', tipos: 'cliente,proveedor,varios' });
        if (input.trim()) qs.set('search', input.trim());
        const res = await apiFetch(`/api/contactos?${qs.toString()}`);
        if (res.ok) {
          const raw = (await res.json()) as ContactoOpcion[] | { data?: ContactoOpcion[] };
          const items = Array.isArray(raw) ? raw : (raw as { data?: ContactoOpcion[] }).data ?? [];
          setOpcContactos(items);
        }
      } finally {
        setBuscandoConts(false);
      }
    }, 250);
  }, []);

  const buildParams = useCallback((): MovimientosNoConciliadosParams => {
    const p: MovimientosNoConciliadosParams = {};
    if (fechaInicio)   p.fecha_inicio    = fechaInicio;
    if (fechaFin)      p.fecha_fin       = fechaFin;
    if (cuenta)        p.cuenta_id       = cuenta.id;
    if (estado)        p.estado          = estado;
    if (tipoMov)       p.tipo_movimiento = tipoMov;
    if (naturaleza)    p.naturaleza      = naturaleza;
    if (contacto)      p.contacto_id     = contacto.id;
    const nd = Number(minDias);
    if (nd > 0)        p.min_dias        = nd;
    return p;
  }, [fechaInicio, fechaFin, cuenta, estado, tipoMov, naturaleza, contacto, minDias]);

  const cargar = useCallback(() => {
    if (fetchRef.current) clearTimeout(fetchRef.current);
    fetchRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const resultado = await fetchMovimientosNoConciliados(buildParams());
        setRows(resultado.movimientos);
        setFechaCorte(resultado.fecha_corte);
        setCargado(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al cargar el reporte';
        setError(msg);
        setSnackOpen(true);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, [buildParams]);

  useEffect(() => {
    cargar();
    return () => { if (fetchRef.current) clearTimeout(fetchRef.current); };
  }, [cargar]);

  const handleExportar = async () => {
    if (exportando) return;
    setExportando(true);
    try {
      const url = buildMovimientosNoConciliadosExportUrl(buildParams(), 'excel');
      const res = await apiFetch(url);
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? 'Error al exportar');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? 'movimientos-no-conciliados.xlsx';
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al exportar';
      setError(msg);
      setSnackOpen(true);
    } finally {
      setExportando(false);
    }
  };

  const kpisPorMoneda = useMemo<KpiMoneda[]>(() => {
    const map = new Map<string, KpiMoneda>();
    rows.forEach((r) => {
      const mon = r.moneda || 'MXN';
      if (!map.has(mon)) map.set(mon, { moneda: mon, totalPendiente: 0, totalCotejado: 0, cantPendiente: 0, cantCotejado: 0, maxDias: 0 });
      const k = map.get(mon)!;
      if (r.estado_conciliacion === 'pendiente') {
        k.totalPendiente += r.monto;
        k.cantPendiente  += 1;
      } else {
        k.totalCotejado += r.monto;
        k.cantCotejado  += 1;
      }
      if (r.dias_sin_conciliar > k.maxDias) k.maxDias = r.dias_sin_conciliar;
    });
    return Array.from(map.values()).sort((a, b) => a.moneda.localeCompare(b.moneda));
  }, [rows]);

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Breadcrumb */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/informes')}
          sx={{ color: 'text.secondary' }}>
          Informes
        </Button>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" color="text.secondary">Finanzas</Typography>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" fontWeight={600}>Movimientos No Conciliados</Typography>
      </Stack>

      <Box>
        <Typography variant="h6" fontWeight={700}>Movimientos No Conciliados</Typography>
        <Typography variant="caption" color="text.secondary">
          Operaciones bancarias pendientes o cotejadas sin conciliar. Fecha corte: {formatFecha(fechaCorte)}.
        </Typography>
      </Box>

      {/* Filtros */}
      <Paper sx={{ px: 2, py: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            label="Desde"
            type="date"
            size="small"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 150 }}
          />
          <TextField
            label="Hasta"
            type="date"
            size="small"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 150 }}
          />
          <Autocomplete<CuentaOpcion>
            options={cuentas}
            value={cuenta}
            onChange={(_, val) => setCuenta(val)}
            getOptionLabel={(o) => o.identificador}
            getOptionKey={(o) => o.id}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            sx={{ width: 190 }}
            renderInput={(p) => (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <TextField {...(p as any)} label="Cuenta" size="small" placeholder="Todas" />
            )}
          />
          <TextField
            label="Estado"
            size="small"
            select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            sx={{ width: 120 }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="pendiente">Pendiente</MenuItem>
            <MenuItem value="cotejado">Cotejado</MenuItem>
          </TextField>
          <TextField
            label="Tipo"
            size="small"
            select
            value={tipoMov}
            onChange={(e) => setTipoMov(e.target.value)}
            sx={{ width: 115 }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="Deposito">Depósito</MenuItem>
            <MenuItem value="Retiro">Retiro</MenuItem>
          </TextField>
          <TextField
            label="Naturaleza"
            size="small"
            select
            value={naturaleza}
            onChange={(e) => setNaturaleza(e.target.value)}
            sx={{ width: 155 }}
          >
            <MenuItem value="">Todas</MenuItem>
            <MenuItem value="cobro_cliente">Cobro cliente</MenuItem>
            <MenuItem value="pago_proveedor">Pago proveedor</MenuItem>
            <MenuItem value="movimiento_general">General</MenuItem>
          </TextField>
          <Autocomplete<ContactoOpcion>
            options={opcContactos}
            loading={buscandoConts}
            value={contacto}
            onChange={(_, val) => setContacto(val)}
            onInputChange={(_, input) => buscarContactos(input)}
            onOpen={() => { if (!opcContactos.length) buscarContactos(''); }}
            getOptionLabel={(o) => o.nombre}
            getOptionKey={(o) => o.id}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            sx={{ width: 200 }}
            renderOption={(props, o) => (
              <li {...props} key={o.id}>
                <Box>
                  <Typography variant="body2">{o.nombre}</Typography>
                  {o.rfc && <Typography variant="caption" color="text.secondary">{o.rfc}</Typography>}
                </Box>
              </li>
            )}
            renderInput={(p) => (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <TextField {...(p as any)} label="Contacto" size="small" placeholder="Todos" />
            )}
          />
          <TextField
            label="Antigüedad mín. (días)"
            size="small"
            type="number"
            value={minDias}
            onChange={(e) => setMinDias(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: 0 }}
            sx={{ width: 160 }}
          />
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Box sx={{ ml: 'auto', flexShrink: 0 }}>
            <Button
              size="small"
              variant="outlined"
              disabled={!cargado || exportando || rows.length === 0}
              startIcon={exportando ? <CircularProgress size={14} color="inherit" /> : <FileDownloadIcon />}
              onClick={() => void handleExportar()}
            >
              Excel
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* KPIs por moneda */}
      {kpisPorMoneda.length > 0 && (
        <Paper sx={{ p: 1.5 }}>
          {kpisPorMoneda.map((k, idx) => (
            <Box key={k.moneda}>
              {idx > 0 && <Divider sx={{ my: 1 }} />}
              <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="caption" fontWeight={700} color="text.disabled" sx={{ minWidth: 32 }}>
                  {k.moneda}
                </Typography>
                <Box>
                  <Typography variant="caption" color="text.secondary">Pendiente</Typography>
                  <Typography variant="body2" fontWeight={700} color="warning.main">
                    {formatMonto(k.totalPendiente, k.moneda)}
                  </Typography>
                  <Typography variant="caption" color="text.disabled"> ({k.cantPendiente})</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Cotejado</Typography>
                  <Typography variant="body2" fontWeight={700} color="info.main">
                    {formatMonto(k.totalCotejado, k.moneda)}
                  </Typography>
                  <Typography variant="caption" color="text.disabled"> ({k.cantCotejado})</Typography>
                </Box>
                <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">Mov. más antiguo</Typography>
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    color={k.maxDias > 30 ? 'error.main' : k.maxDias > 7 ? 'warning.main' : 'text.primary'}
                  >
                    {k.maxDias} días
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Paper>
      )}

      {/* Grid */}
      <Paper sx={{ p: 1.5 }}>
        {!cargado && loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Cargando…</Typography>
          </Box>
        )}
        {cargado && (
          <Box sx={{ height: 520 }}>
            <DataGrid
              density="standard"
              rows={rows}
              columns={COLUMNAS}
              getRowId={(row) => (row as MovimientoNoConciliado).id}
              rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
              columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
              disableRowSelectionOnClick
              localeText={{
                ...esES.components.MuiDataGrid.defaultProps.localeText,
                noRowsLabel: 'No hay movimientos pendientes de conciliación con los filtros aplicados',
              }}
              sx={[standardDataGridSx, { border: '1px solid', borderColor: 'divider' }]}
            />
          </Box>
        )}
      </Paper>

      <Snackbar open={snackOpen} autoHideDuration={5000} onClose={() => setSnackOpen(false)}>
        <Alert severity="error" onClose={() => setSnackOpen(false)} sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
