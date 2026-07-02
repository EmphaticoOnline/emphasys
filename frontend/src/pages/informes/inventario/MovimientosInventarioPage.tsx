import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  Typography,
  TextField,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { DataGrid } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useNavigate } from 'react-router-dom';
import { resolverFolioVisual } from '../../../utils/documentos.utils';
import { apiFetch } from '../../../api/apiClient';
import {
  STANDARD_DATA_GRID_HEADER_HEIGHT,
  STANDARD_DATA_GRID_ROW_HEIGHT,
  standardDataGridSx,
} from '../../../components/grids/standardDataGridSx';
import {
  fetchMovimientosInventarioPeriodo,
  buildMovimientosPeriodoInvExportUrl,
  type MovimientosPeriodoInvParams,
  type MovimientosPeriodoInvResult,
  type MovimientoInventario,
} from '../../../services/reportesService';

const COLOR = '#7c3aed';
const fmt = (v: number) => v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCant = (v: number) => v.toLocaleString('es-MX', { maximumFractionDigits: 4 });
const fmtFecha = (iso: string) => {
  if (!iso || iso.length < 10) return iso;
  const [yr, mo, da] = iso.slice(0, 10).split('-');
  return `${da}-${mo}-${yr}`;
};

function primerDiaMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, flex: '1 1 160px', minWidth: 140, borderRadius: 2 }}>
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: `${color ?? COLOR}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon sx={{ color: color ?? COLOR, fontSize: 17 }} />
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block' }}>{label}</Typography>
          <Typography variant="subtitle2" fontWeight={700} color="text.primary" sx={{ lineHeight: 1.3 }}>{value}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

type AlmacenOpcion = { id: number; nombre: string };

function buildColumns(): GridColDef<MovimientoInventario>[] {
  return [
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 100,
      renderCell: (p: GridRenderCellParams<MovimientoInventario, string>) => fmtFecha(p.value ?? ''),
    },
    { field: 'tipo_movimiento',      headerName: 'Tipo',        width: 110 },
    { field: 'producto_clave',       headerName: 'Clave',       width: 90  },
    { field: 'producto_descripcion', headerName: 'Descripción', flex: 1, minWidth: 150 },
    { field: 'almacen',              headerName: 'Almacén',     width: 120 },
    {
      field: 'tipo_signo',
      headerName: 'E/S',
      width: 72,
      renderCell: (p: GridRenderCellParams<MovimientoInventario, string>) => {
        const esEntrada = (p.row as MovimientoInventario).signo === 1;
        return (
          <Typography variant="body2" fontWeight={700} color={esEntrada ? 'success.main' : 'error.main'}>
            {p.value}
          </Typography>
        );
      },
    },
    {
      field: 'cantidad',
      headerName: 'Cantidad',
      width: 90,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<MovimientoInventario, number>) => fmtCant(p.value ?? 0),
    },
    {
      field: 'costo_unitario',
      headerName: 'Costo',
      width: 90,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<MovimientoInventario, number | null>) =>
        p.value != null ? `$${fmt(p.value)}` : '—',
    },
    {
      field: 'valor',
      headerName: 'Valor',
      width: 110,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<MovimientoInventario, number>) => (
        <Typography variant="body2" fontWeight={600} sx={{ color: COLOR }}>
          {p.value && p.value > 0 ? `$${fmt(p.value)}` : '—'}
        </Typography>
      ),
    },
    {
      field: 'doc_serie',
      headerName: 'Documento',
      width: 110,
      renderCell: (p: GridRenderCellParams<MovimientoInventario>) => {
        const r = p.row;
        if (!r.doc_serie && !r.doc_numero && !r.doc_serie_externa && !r.doc_numero_externo) return '—';
        return resolverFolioVisual({
          serie: r.doc_serie,
          numero: r.doc_numero,
          serie_externa: r.doc_serie_externa,
          numero_externo: r.doc_numero_externo,
        }, r.doc_tipo ?? '');
      },
    },
    {
      field: 'observaciones',
      headerName: 'Obs.',
      width: 120,
      renderCell: (p: GridRenderCellParams<MovimientoInventario, string | null>) => p.value ?? '',
    },
  ];
}

export default function MovimientosInventarioPage() {
  const navigate = useNavigate();
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes());
  const [fechaFin, setFechaFin] = useState(hoy());
  const [almacen, setAlmacen] = useState<AlmacenOpcion | null>(null);
  const [almacenes, setAlmacenes] = useState<AlmacenOpcion[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null);
  const [resultado, setResultado] = useState<MovimientosPeriodoInvResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const fetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const columns = React.useMemo(buildColumns, []);

  useEffect(() => {
    apiFetch('/api/inventario/almacenes?activo=true&limit=100')
      .then((r) => r.json())
      .then((data) => {
        const items = Array.isArray(data) ? data : (data as { data?: AlmacenOpcion[] }).data ?? [];
        setAlmacenes(items);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!fechaInicio || !fechaFin) return;
    if (fetchRef.current) clearTimeout(fetchRef.current);
    fetchRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchMovimientosInventarioPeriodo({
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          almacen_id: almacen?.id ?? null,
        });
        setResultado(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al cargar movimientos';
        setError(msg);
        setSnackbarOpen(true);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => { if (fetchRef.current) clearTimeout(fetchRef.current); };
  }, [fechaInicio, fechaFin, almacen]);

  const handleExportar = async (formato: 'excel' | 'pdf') => {
    if (!resultado || exportando) return;
    setExportando(formato);
    try {
      const params: MovimientosPeriodoInvParams = {
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        almacen_id: almacen?.id ?? null,
      };
      const url = buildMovimientosPeriodoInvExportUrl(params, formato);
      const res = await apiFetch(url);
      if (!res.ok) throw new Error('Error al exportar');
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `movimientos-inventario.${formato === 'excel' ? 'xlsx' : 'pdf'}`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al exportar');
      setSnackbarOpen(true);
    } finally {
      setExportando(null);
    }
  };

  const lineas = resultado?.lineas ?? [];

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Breadcrumb */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/informes')} sx={{ color: 'text.secondary' }}>
          Informes
        </Button>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" color="text.secondary">Inventario</Typography>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" fontWeight={600}>Movimientos de Inventario</Typography>
      </Stack>

      <Box>
        <Typography variant="h6" fontWeight={700}>Movimientos de Inventario</Typography>
        <Typography variant="caption" color="text.secondary">Auditoría de entradas y salidas de inventario en un período.</Typography>
      </Box>

      {/* Filtros */}
      <Paper sx={{ px: 2, py: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField label="Fecha inicial" type="date" size="small" value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 155 }} />
          <TextField label="Fecha final" type="date" size="small" value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 155 }} />
          <Box
            component="select"
            value={almacen?.id ?? ''}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              const id = Number(e.target.value);
              setAlmacen(id ? (almacenes.find((a) => a.id === id) ?? null) : null);
            }}
            sx={{ height: 36, px: 1, borderRadius: 1, border: '1px solid', borderColor: 'divider', fontSize: '0.875rem', minWidth: 180 }}
          >
            <option value="">Todos los almacenes</option>
            {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </Box>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5, flexShrink: 0 }}>
            <Button size="small" variant="outlined" color="error" disabled={!resultado || !!exportando}
              startIcon={exportando === 'pdf' ? <CircularProgress size={14} color="inherit" /> : <PictureAsPdfIcon />}
              onClick={() => void handleExportar('pdf')}>PDF</Button>
            <Button size="small" variant="outlined" disabled={!resultado || !!exportando}
              startIcon={exportando === 'excel' ? <CircularProgress size={14} color="inherit" /> : <FileDownloadIcon />}
              onClick={() => void handleExportar('excel')}>Excel</Button>
          </Box>
        </Box>
      </Paper>

      {/* Tarjetas resumen */}
      {resultado && (
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <SummaryCard icon={TrendingUpIcon} label="Total entradas" value={fmtCant(resultado.total_entradas)} color="#16a34a" />
          <SummaryCard icon={TrendingDownIcon} label="Total salidas" value={fmtCant(resultado.total_salidas)} color="#dc2626" />
          <SummaryCard icon={AttachMoneyIcon} label="Valor total" value={`$${fmt(resultado.total_valor)}`} />
        </Box>
      )}

      {/* Tabla */}
      <Paper sx={{ p: 1.5 }}>
        {!resultado && loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Cargando…</Typography>
          </Box>
        )}
        {resultado && (
          <>
            <Box sx={{ height: 520 }}>
              <DataGrid
                density="standard"
                rows={lineas.map((l, i) => ({ ...l, _idx: i }))}
                columns={columns}
                getRowId={(row) => (row as MovimientoInventario & { _idx: number })._idx}
                rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
                columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
                disableRowSelectionOnClick
                localeText={{ ...esES.components.MuiDataGrid.defaultProps.localeText, noRowsLabel: 'Sin movimientos en el período indicado' }}
                sx={[standardDataGridSx, { border: '1px solid', borderColor: 'divider' }]}
              />
            </Box>
            {lineas.length > 0 && (
              <Box sx={{ display: 'flex', gap: 3, mt: 1.5, pt: 1.5, borderTop: '2px solid', borderColor: COLOR, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Movimientos</Typography>
                  <Typography variant="body2" fontWeight={700}>{lineas.length}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Valor Total</Typography>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ color: COLOR }}>${fmt(resultado.total_valor)}</Typography>
                </Box>
              </Box>
            )}
          </>
        )}
      </Paper>

      <Snackbar open={snackbarOpen} autoHideDuration={5000} onClose={() => setSnackbarOpen(false)}>
        <Alert severity="error" onClose={() => setSnackbarOpen(false)} sx={{ width: '100%' }}>{error}</Alert>
      </Snackbar>
    </Box>
  );
}
