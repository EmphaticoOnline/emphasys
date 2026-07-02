import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import InventoryIcon from '@mui/icons-material/Inventory';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
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
  fetchExistenciasPorAlmacen,
  buildExistenciasExportUrl,
  type ExistenciasPorAlmacenParams,
  type ExistenciasPorAlmacenResult,
  type ExistenciaPorAlmacen,
} from '../../../services/reportesService';

const COLOR = '#7c3aed';

const fmt = (v: number) => v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCant = (v: number) => v.toLocaleString('es-MX', { maximumFractionDigits: 4 });

function SummaryCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, flex: '1 1 160px', minWidth: 140, borderRadius: 2 }}>
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: `${COLOR}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon sx={{ color: COLOR, fontSize: 17 }} />
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block' }}>{label}</Typography>
          <Typography variant="subtitle2" fontWeight={700} color="text.primary" sx={{ lineHeight: 1.3 }}>{value}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function buildColumns(): GridColDef<ExistenciaPorAlmacen>[] {
  return [
    { field: 'clave',             headerName: 'Clave',        width: 100 },
    { field: 'descripcion',       headerName: 'Descripción',  flex: 1, minWidth: 180 },
    { field: 'familia',           headerName: 'Familia',      width: 110 },
    { field: 'almacen',           headerName: 'Almacén',      width: 130 },
    {
      field: 'existencia',
      headerName: 'Existencia',
      width: 100,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<ExistenciaPorAlmacen, number>) => {
        const val = p.value ?? 0;
        const row = p.row;
        const bajo = row.minimo_inventario > 0 && val < row.minimo_inventario;
        return (
          <Typography variant="body2" fontWeight={bajo ? 700 : 400} color={bajo ? 'error.main' : 'text.primary'}>
            {fmtCant(val)}
          </Typography>
        );
      },
    },
    {
      field: 'minimo_inventario',
      headerName: 'Mínimo',
      width: 90,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<ExistenciaPorAlmacen, number>) =>
        (p.value ?? 0) > 0 ? fmtCant(p.value!) : '—',
    },
    {
      field: 'diferencia_minimo',
      headerName: 'Dif. vs Mín.',
      width: 100,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<ExistenciaPorAlmacen, number>) => {
        const v = p.value ?? 0;
        return (
          <Typography variant="body2" color={v < 0 ? 'error.main' : 'success.main'}>
            {fmtCant(v)}
          </Typography>
        );
      },
    },
    {
      field: 'costo_unitario',
      headerName: 'Costo',
      width: 100,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<ExistenciaPorAlmacen, number>) =>
        (p.value ?? 0) > 0 ? `$${fmt(p.value!)}` : '—',
    },
    {
      field: 'valor_inventario',
      headerName: 'Valor Inv.',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<ExistenciaPorAlmacen, number>) => (
        <Typography variant="body2" fontWeight={700} color={`${COLOR}`}>
          ${fmt(p.value ?? 0)}
        </Typography>
      ),
    },
    {
      field: 'ultima_fecha',
      headerName: 'Últ. Movim.',
      width: 110,
      renderCell: (p: GridRenderCellParams<ExistenciaPorAlmacen, string | null>) => {
        if (!p.value) return '—';
        const [yr, mo, da] = p.value.slice(0, 10).split('-');
        return `${da}-${mo}-${yr}`;
      },
    },
  ];
}

function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type AlmacenOpcion = { id: number; nombre: string };
type ProductoOpcion = { id: number; clave: string; descripcion: string };

export default function ExistenciasPorAlmacenPage() {
  const navigate = useNavigate();
  const [soloConExistencia, setSoloConExistencia] = useState(true);
  const [soloBajoMinimo, setSoloBajoMinimo] = useState(false);
  const [almacen, setAlmacen] = useState<AlmacenOpcion | null>(null);
  const [almacenes, setAlmacenes] = useState<AlmacenOpcion[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null);
  const [resultado, setResultado] = useState<ExistenciasPorAlmacenResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const fetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cargar almacenes al montar
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
    const params: ExistenciasPorAlmacenParams = {
      almacen_id: almacen?.id ?? null,
      solo_con_existencia: soloConExistencia,
      solo_bajo_minimo: soloBajoMinimo,
    };
    if (fetchRef.current) clearTimeout(fetchRef.current);
    fetchRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchExistenciasPorAlmacen(params);
        setResultado(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al cargar existencias';
        setError(msg);
        setSnackbarOpen(true);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => { if (fetchRef.current) clearTimeout(fetchRef.current); };
  }, [almacen, soloConExistencia, soloBajoMinimo]);

  const handleExportar = async (formato: 'excel' | 'pdf') => {
    if (!resultado || exportando) return;
    setExportando(formato);
    try {
      const params: ExistenciasPorAlmacenParams = {
        almacen_id: almacen?.id ?? null,
        solo_con_existencia: soloConExistencia,
        solo_bajo_minimo: soloBajoMinimo,
      };
      const url = buildExistenciasExportUrl(params, formato);
      const res = await apiFetch(url);
      if (!res.ok) throw new Error('Error al exportar');
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `existencias-por-almacen.${formato === 'excel' ? 'xlsx' : 'pdf'}`;
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
  const totalValor = resultado?.total_valor ?? 0;
  const bajoMinimo = lineas.filter((l) => l.minimo_inventario > 0 && l.existencia < l.minimo_inventario).length;
  const columns = React.useMemo(buildColumns, []);

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
        <Typography variant="body2" fontWeight={600}>Existencias por Almacén</Typography>
      </Stack>

      <Box>
        <Typography variant="h6" fontWeight={700}>Existencias por Almacén</Typography>
        <Typography variant="caption" color="text.secondary">Inventario actual por producto y almacén con valor económico.</Typography>
      </Box>

      {/* Filtros */}
      <Paper sx={{ px: 2, py: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
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
          <FormControlLabel
            sx={{ mr: 0 }}
            control={<Checkbox size="small" checked={soloConExistencia} onChange={(e) => setSoloConExistencia(e.target.checked)} />}
            label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>Solo con existencia</Typography>}
          />
          <FormControlLabel
            sx={{ mr: 0 }}
            control={<Checkbox size="small" checked={soloBajoMinimo} onChange={(e) => setSoloBajoMinimo(e.target.checked)} />}
            label={<Typography variant="body2" sx={{ fontSize: '0.82rem' }}>Solo bajo mínimo</Typography>}
          />
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
          <SummaryCard icon={InventoryIcon} label="Productos / almacén" value={String(lineas.length)} />
          <SummaryCard icon={AttachMoneyIcon} label="Valor total inventario" value={`$${fmt(totalValor)}`} />
          <SummaryCard icon={WarningAmberIcon} label="Bajo mínimo" value={bajoMinimo > 0 ? String(bajoMinimo) : '✓ Ninguno'} />
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
                rows={lineas}
                columns={columns}
                getRowId={(row) => `${(row as ExistenciaPorAlmacen).producto_id}-${(row as ExistenciaPorAlmacen).almacen_id}`}
                rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
                columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
                disableRowSelectionOnClick
                getRowClassName={(params) => {
                  const row = params.row as ExistenciaPorAlmacen;
                  return row.minimo_inventario > 0 && row.existencia < row.minimo_inventario ? 'row-bajo-minimo' : '';
                }}
                localeText={{ ...esES.components.MuiDataGrid.defaultProps.localeText, noRowsLabel: 'Sin existencias con los filtros indicados' }}
                sx={[standardDataGridSx, { border: '1px solid', borderColor: 'divider', '& .row-bajo-minimo': { bgcolor: 'error.50' } }]}
              />
            </Box>
            {lineas.length > 0 && (
              <Box sx={{ display: 'flex', gap: 3, mt: 1.5, pt: 1.5, borderTop: '2px solid', borderColor: COLOR, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Registros</Typography>
                  <Typography variant="body2" fontWeight={700}>{lineas.length}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Valor Total</Typography>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ color: COLOR }}>${fmt(totalValor)}</Typography>
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
