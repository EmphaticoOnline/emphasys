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
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { DataGrid } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/apiClient';
import { resolverFolioVisual } from '../../utils/documentos.utils';
import {
  STANDARD_DATA_GRID_HEADER_HEIGHT,
  STANDARD_DATA_GRID_ROW_HEIGHT,
  standardDataGridSx,
} from '../../components/grids/standardDataGridSx';
import {
  fetchProgramacionesPago,
  cancelarProgramacionPago,
  pagarProgramacion,
  type ProgramacionPagosParams,
} from '../../services/finanzasService';
import type { ProgramacionPago } from '../../types/finanzas';
import ProgramacionPagoDialog from '../../modules/finanzas/ProgramacionPagoDialog';

type ContactoOpcion = { id: number; nombre: string; rfc?: string | null };

const formatMXN = (v: number, moneda = 'MXN') =>
  v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
  (moneda !== 'MXN' ? ` ${moneda}` : '');

const formatFecha = (iso?: string | null): string => {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso).slice(0, 10);
  return `${m[3]}/${m[2]}/${m[1]}`;
};

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const primerDiaMes = () => hoy().slice(0, 8) + '01';

const ESTATUS_LABEL: Record<string, string> = {
  programado: 'Programado',
  pagado: 'Pagado',
  cancelado: 'Cancelado',
};

const ESTATUS_COLOR: Record<string, 'default' | 'info' | 'success' | 'error'> = {
  programado: 'info',
  pagado: 'success',
  cancelado: 'error',
};

function buildColumns(
  onEdit: (row: ProgramacionPago) => void,
  onCancel: (row: ProgramacionPago) => void,
  onPagar: (row: ProgramacionPago) => void,
  pagandoId: number | null
): GridColDef<ProgramacionPago>[] {
  return [
    {
      field: 'fecha_programada',
      headerName: 'Fecha',
      width: 100,
      renderCell: (p: GridRenderCellParams<ProgramacionPago, string>) =>
        formatFecha(p.value),
    },
    {
      field: 'proveedor_nombre',
      headerName: 'Proveedor',
      flex: 1,
      minWidth: 150,
      renderCell: (p: GridRenderCellParams<ProgramacionPago, string>) => (
        <Typography variant="body2">{p.value ?? '—'}</Typography>
      ),
    },
    {
      field: 'folios_resumen',
      headerName: 'Facturas',
      width: 160,
      renderCell: (p: GridRenderCellParams<ProgramacionPago>) => {
        const folios = p.row.folios_resumen ?? '';
        if (!folios) return <Typography variant="body2" color="text.disabled">—</Typography>;
        return (
          <Typography variant="body2" title={folios} noWrap>
            {folios}
          </Typography>
        );
      },
    },
    {
      field: 'documento_fecha_vencimiento',
      headerName: 'Vence',
      width: 95,
      renderCell: (p: GridRenderCellParams<ProgramacionPago, string>) => {
        const fv = p.value;
        if (!fv) return <Typography variant="caption" color="text.disabled">—</Typography>;
        const dias = Math.round((new Date(fv).getTime() - new Date(hoy()).getTime()) / 86400000);
        const color = dias < 0 ? 'error.main' : dias === 0 ? 'warning.main' : 'text.secondary';
        return (
          <Typography variant="body2" color={color}>
            {formatFecha(fv)}
          </Typography>
        );
      },
    },
    {
      field: 'monto_programado',
      headerName: 'Monto',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<ProgramacionPago, number>) => (
        <Typography variant="body2" fontWeight={700}>
          {formatMXN(p.value ?? 0, p.row.moneda)}
        </Typography>
      ),
    },
    { field: 'moneda', headerName: 'Moneda', width: 75 },
    {
      field: 'cuenta_identificador',
      headerName: 'Cuenta',
      width: 130,
      renderCell: (p: GridRenderCellParams<ProgramacionPago, string>) => (
        <Typography variant="body2" color={p.value ? 'text.primary' : 'text.disabled'}>
          {p.value ?? 'Sin especificar'}
        </Typography>
      ),
    },
    {
      field: 'metodo_pago_nombre',
      headerName: 'Método',
      width: 130,
      renderCell: (p: GridRenderCellParams<ProgramacionPago, string>) => (
        <Typography variant="body2" color={p.value ? 'text.primary' : 'text.disabled'}>
          {p.value ?? 'Sin especificar'}
        </Typography>
      ),
    },
    { field: 'referencia', headerName: 'Referencia', width: 110 },
    {
      field: 'estatus',
      headerName: 'Estatus',
      width: 110,
      renderCell: (p: GridRenderCellParams<ProgramacionPago, string>) => (
        <Chip
          label={ESTATUS_LABEL[p.value ?? ''] ?? p.value}
          color={ESTATUS_COLOR[p.value ?? ''] ?? 'default'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: '_acciones',
      headerName: '',
      width: 115,
      sortable: false,
      renderCell: (p: GridRenderCellParams<ProgramacionPago>) => {
        if (p.row.estatus !== 'programado') return null;
        return (
          <Stack direction="row" spacing={0.5}>
            <Button
              size="small"
              title="Editar"
              onClick={(e) => { e.stopPropagation(); onEdit(p.row); }}
              sx={{ minWidth: 0, p: 0.5 }}
            >
              <EditOutlinedIcon fontSize="small" />
            </Button>
            <Button
              size="small"
              color="success"
              title="Pagar"
              disabled={pagandoId !== null}
              onClick={(e) => { e.stopPropagation(); onPagar(p.row); }}
              sx={{ minWidth: 0, p: 0.5 }}
            >
              {pagandoId === p.row.id
                ? <CircularProgress size={14} color="success" />
                : <CheckCircleOutlinedIcon fontSize="small" />}
            </Button>
            <Button
              size="small"
              color="error"
              title="Cancelar"
              onClick={(e) => { e.stopPropagation(); onCancel(p.row); }}
              sx={{ minWidth: 0, p: 0.5 }}
            >
              <CancelOutlinedIcon fontSize="small" />
            </Button>
          </Stack>
        );
      },
    },
  ];
}

export default function ProgramacionPagosPage() {
  const navigate = useNavigate();

  const [proveedor, setProveedor] = useState<ContactoOpcion | null>(null);
  const [opciones, setOpciones] = useState<ContactoOpcion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes());
  const [fechaFin, setFechaFin] = useState('');
  const [estatus, setEstatus] = useState('programado');
  const [moneda, setMoneda] = useState('');

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ProgramacionPago[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editandoProgramacion, setEditandoProgramacion] = useState<ProgramacionPago | null>(null);
  const [pagandoId, setPagandoId] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscarProveedores = useCallback((input: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const qs = new URLSearchParams({ limit: '40', tipos: 'proveedor,varios' });
        if (input.trim()) qs.set('search', input.trim());
        const res = await apiFetch(`/api/contactos?${qs.toString()}`);
        if (res.ok) {
          const raw = (await res.json()) as ContactoOpcion[] | { data?: ContactoOpcion[]; items?: ContactoOpcion[] };
          const items = Array.isArray(raw)
            ? raw
            : (raw as { data?: ContactoOpcion[] }).data ?? (raw as { items?: ContactoOpcion[] }).items ?? [];
          setOpciones(items);
        }
      } finally {
        setBuscando(false);
      }
    }, 250);
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: ProgramacionPagosParams = {};
      if (fechaInicio) params.fecha_inicio = fechaInicio;
      if (fechaFin) params.fecha_fin = fechaFin;
      if (proveedor) params.proveedor_id = proveedor.id;
      if (estatus) params.estatus = estatus;
      if (moneda) params.moneda = moneda;
      const data = await fetchProgramacionesPago(params);
      setRows(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cargar programaciones';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin, proveedor, estatus, moneda]);

  useEffect(() => {
    if (fetchRef.current) clearTimeout(fetchRef.current);
    fetchRef.current = setTimeout(() => { void cargar(); }, 400);
    return () => { if (fetchRef.current) clearTimeout(fetchRef.current); };
  }, [cargar]);

  const handlePagar = useCallback(async (prog: ProgramacionPago) => {
    const monto = prog.monto_programado.toLocaleString('es-MX', { minimumFractionDigits: 2 });
    const proveedor = prog.proveedor_nombre ?? 'este proveedor';
    const cnt = prog.numero_facturas ?? 1;
    const facturaDesc = cnt === 1
      ? `la factura ${prog.folios_resumen ?? prog.documento_folio ?? `Doc #${prog.documento_id}`}`
      : `${cnt} facturas (${prog.folios_resumen ?? ''})`;
    if (!confirm(
      `Se registrará un pago real de ${prog.moneda} $${monto} al proveedor "${proveedor}" y se aplicará a ${facturaDesc}.\n\n¿Deseas continuar?`
    )) return;
    setPagandoId(prog.id);
    try {
      await pagarProgramacion(prog.id);
      setSnackbarMsg('Pago registrado correctamente');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      void cargar();
    } catch (err) {
      setSnackbarMsg(err instanceof Error ? err.message : 'No se pudo registrar el pago');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setPagandoId(null);
    }
  }, [cargar]);

  const handleCancelar = useCallback(async (prog: ProgramacionPago) => {
    if (!confirm(`¿Cancelar la programación de $${prog.monto_programado.toLocaleString('es-MX')} para ${prog.proveedor_nombre ?? 'este proveedor'}?`)) return;
    try {
      await cancelarProgramacionPago(prog.id);
      setSnackbarMsg('Programación cancelada');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      void cargar();
    } catch (err) {
      setSnackbarMsg(err instanceof Error ? err.message : 'No se pudo cancelar');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  }, [cargar]);

  const handleEdit = useCallback((prog: ProgramacionPago) => {
    setEditandoProgramacion(prog);
    setDialogOpen(true);
  }, []);

  const handleNueva = () => {
    setEditandoProgramacion(null);
    setDialogOpen(true);
  };

  const handleSaved = () => {
    setSnackbarMsg('Programación guardada');
    setSnackbarSeverity('success');
    setSnackbarOpen(true);
    void cargar();
  };

  const columns = useMemo(() => buildColumns(handleEdit, handleCancelar, handlePagar, pagandoId), [handleEdit, handleCancelar, handlePagar, pagandoId]);

  // KPIs por moneda sobre las filas visibles
  type KpiMoneda = { moneda: string; totalProgramado: number; totalVencido: number; totalHoy: number; proximos7: number };
  const kpisPorMoneda = useMemo<KpiMoneda[]>(() => {
    const map = new Map<string, KpiMoneda>();
    const dHoy = hoy();
    rows.forEach((r) => {
      const mon = r.moneda || 'MXN';
      if (!map.has(mon)) map.set(mon, { moneda: mon, totalProgramado: 0, totalVencido: 0, totalHoy: 0, proximos7: 0 });
      const k = map.get(mon)!;
      if (r.estatus === 'programado') {
        k.totalProgramado += r.monto_programado;
        if (r.documento_fecha_vencimiento && r.documento_fecha_vencimiento < dHoy) k.totalVencido += r.monto_programado;
        if (r.fecha_programada === dHoy) k.totalHoy += r.monto_programado;
        const diff = Math.round((new Date(r.fecha_programada).getTime() - new Date(dHoy).getTime()) / 86400000);
        if (diff >= 1 && diff <= 7) k.proximos7 += r.monto_programado;
      }
    });
    return Array.from(map.values()).sort((a, b) => a.moneda.localeCompare(b.moneda));
  }, [rows]);

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Breadcrumb */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/finanzas')}
          sx={{ color: 'text.secondary' }}>
          Finanzas
        </Button>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" fontWeight={600}>Programación de Pagos</Typography>
      </Stack>

      <Box>
        <Typography variant="h6" fontWeight={700}>Programación de Pagos a Proveedores</Typography>
        <Typography variant="caption" color="text.secondary">
          Planifica pagos futuros sobre facturas de compra pendientes. El pago real se registra al ejecutar (Fase 3.2B).
        </Typography>
      </Box>

      {/* Filtros */}
      <Paper sx={{ px: 2, py: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
        <Box sx={{
          display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap',
          '& .MuiInputBase-input': { fontSize: 13 },
          '& .MuiInputLabel-root': { fontSize: 13 },
          '& .MuiSelect-select': { fontSize: 13 },
        }}>
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
          <Autocomplete<ContactoOpcion>
            options={opciones}
            loading={buscando}
            value={proveedor}
            onChange={(_, val) => setProveedor(val)}
            onInputChange={(_, input) => buscarProveedores(input)}
            onOpen={() => { if (!opciones.length) buscarProveedores(''); }}
            getOptionLabel={(o) => o.nombre}
            getOptionKey={(o) => o.id}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            sx={{ width: 220 }}
            renderOption={(props, o) => (
              <li {...props} key={o.id}>
                <Box>
                  <Typography variant="body2">{o.nombre}</Typography>
                  {o.rfc && <Typography variant="caption" color="text.secondary">{o.rfc}</Typography>}
                </Box>
              </li>
            )}
            renderInput={(p) => (
              <TextField {...(p as any)} label="Proveedor" size="small" placeholder="Todos" />
            )}
          />
          <TextField
            label="Estatus"
            size="small"
            select
            value={estatus}
            onChange={(e) => setEstatus(e.target.value)}
            sx={{ width: 140 }}
            SelectProps={{ displayEmpty: true }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="programado">Programado</MenuItem>
            <MenuItem value="pagado">Pagado</MenuItem>
            <MenuItem value="cancelado">Cancelado</MenuItem>
          </TextField>
          <TextField
            label="Moneda"
            size="small"
            select
            value={moneda}
            onChange={(e) => setMoneda(e.target.value)}
            sx={{ width: 100 }}
          >
            <MenuItem value="">Todas</MenuItem>
            <MenuItem value="MXN">MXN</MenuItem>
            <MenuItem value="USD">USD</MenuItem>
            <MenuItem value="EUR">EUR</MenuItem>
          </TextField>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Box sx={{ ml: 'auto', flexShrink: 0 }}>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleNueva}
              sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}
            >
              Nueva programación
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
                  <Typography variant="caption" color="text.secondary">Vencido</Typography>
                  <Typography variant="body2" fontWeight={700} color="error.main">
                    {formatMXN(k.totalVencido, k.moneda)}
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">Pago hoy</Typography>
                  <Typography variant="body2" fontWeight={700} color="warning.main">
                    {formatMXN(k.totalHoy, k.moneda)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Próx. 7 días</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {formatMXN(k.proximos7, k.moneda)}
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">Total programado</Typography>
                  <Typography variant="body2" fontWeight={700} color="primary.main">
                    {formatMXN(k.totalProgramado, k.moneda)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.disabled">
              {rows.length} registro{rows.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Tabla */}
      <Paper sx={{ p: 1.5 }}>
        {!rows.length && loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Cargando…</Typography>
          </Box>
        ) : (
          <Box sx={{ height: 520 }}>
            <DataGrid
              density="standard"
              rows={rows}
              columns={columns}
              getRowId={(row) => (row as ProgramacionPago).id}
              rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
              columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
              disableRowSelectionOnClick
              getRowClassName={(params) => {
                const r = params.row as ProgramacionPago;
                if (r.estatus === 'cancelado') return 'fila-cancelada';
                if (r.estatus === 'pagado') return 'fila-pagada';
                if (r.documento_fecha_vencimiento && r.documento_fecha_vencimiento < hoy()) return 'fila-vencida';
                return '';
              }}
              localeText={{
                ...esES.components.MuiDataGrid.defaultProps.localeText,
                noRowsLabel: 'No hay programaciones en el período seleccionado',
              }}
              sx={[
                standardDataGridSx,
                {
                  border: '1px solid',
                  borderColor: 'divider',
                  '& .fila-vencida': { bgcolor: '#fff5f5' },
                  '& .fila-cancelada': { opacity: 0.5 },
                  '& .fila-pagada': { bgcolor: '#f0fff4' },
                },
              ]}
            />
          </Box>
        )}
        {error && !loading && (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </Paper>

      <ProgramacionPagoDialog
        open={dialogOpen}
        programacion={editandoProgramacion}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
      />

      <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={() => setSnackbarOpen(false)}>
        <Alert severity={snackbarSeverity} onClose={() => setSnackbarOpen(false)} sx={{ width: '100%' }}>
          {snackbarMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
