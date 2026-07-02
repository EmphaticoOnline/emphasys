import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import InventoryIcon from '@mui/icons-material/Inventory';
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
  fetchInventarioValorizado,
  buildInventarioValorizadoExportUrl,
  type InventarioValorizadoParams,
  type InventarioValorizadoResult,
  type InventarioValorizadoLinea,
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

type AlmacenOpcion = { id: number; nombre: string };

function buildColumns(): GridColDef<InventarioValorizadoLinea>[] {
  return [
    { field: 'clave',       headerName: 'Clave',       width: 100 },
    { field: 'descripcion', headerName: 'Descripción', flex: 1, minWidth: 180 },
    { field: 'familia',     headerName: 'Familia',     width: 100 },
    { field: 'almacen',     headerName: 'Almacén',     width: 130 },
    {
      field: 'existencia',
      headerName: 'Existencia',
      width: 100,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<InventarioValorizadoLinea, number>) => fmtCant(p.value ?? 0),
    },
    {
      field: 'costo_promedio',
      headerName: 'C. Promedio',
      width: 110,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<InventarioValorizadoLinea, number>) =>
        (p.value ?? 0) > 0 ? `$${fmt(p.value!)}` : '—',
    },
    {
      field: 'ultimo_costo',
      headerName: 'Último Costo',
      width: 110,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<InventarioValorizadoLinea, number>) =>
        (p.value ?? 0) > 0 ? `$${fmt(p.value!)}` : '—',
    },
    {
      field: 'costo_valuacion',
      headerName: 'C. Valuación',
      width: 110,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<InventarioValorizadoLinea, number>) =>
        (p.value ?? 0) > 0 ? `$${fmt(p.value!)}` : '—',
    },
    {
      field: 'tipo_costo',
      headerName: 'Tipo',
      width: 80,
      renderCell: (p: GridRenderCellParams<InventarioValorizadoLinea, string>) => (
        <Typography variant="caption" color="text.secondary">{p.value}</Typography>
      ),
    },
    {
      field: 'valor_inventario',
      headerName: 'Valor Inv.',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<InventarioValorizadoLinea, number>) => (
        <Typography variant="body2" fontWeight={700} sx={{ color: COLOR }}>
          ${fmt(p.value ?? 0)}
        </Typography>
      ),
    },
  ];
}

export default function InventarioValorizadoPage() {
  const navigate = useNavigate();
  const [almacen, setAlmacen] = useState<AlmacenOpcion | null>(null);
  const [almacenes, setAlmacenes] = useState<AlmacenOpcion[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null);
  const [resultado, setResultado] = useState<InventarioValorizadoResult | null>(null);
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
    if (fetchRef.current) clearTimeout(fetchRef.current);
    fetchRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchInventarioValorizado({ almacen_id: almacen?.id ?? null });
        setResultado(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al cargar inventario valorizado';
        setError(msg);
        setSnackbarOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (fetchRef.current) clearTimeout(fetchRef.current); };
  }, [almacen]);

  const handleExportar = async (formato: 'excel' | 'pdf') => {
    if (!resultado || exportando) return;
    setExportando(formato);
    try {
      const params: InventarioValorizadoParams = { almacen_id: almacen?.id ?? null };
      const url = buildInventarioValorizadoExportUrl(params, formato);
      const res = await apiFetch(url);
      if (!res.ok) throw new Error('Error al exportar');
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `inventario-valorizado.${formato === 'excel' ? 'xlsx' : 'pdf'}`;
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
        <Typography variant="body2" fontWeight={600}>Inventario Valorizado</Typography>
      </Stack>

      <Box>
        <Typography variant="h6" fontWeight={700}>Inventario Valorizado</Typography>
        <Typography variant="caption" color="text.secondary">
          Valor económico del inventario actual. Usa costo promedio → último costo → costo estándar según disponibilidad.
        </Typography>
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
          <SummaryCard icon={AttachMoneyIcon} label="Valor total inventario" value={`$${fmt(resultado.total_valor)}`} />
          <SummaryCard icon={InventoryIcon} label="Unidades totales" value={fmtCant(resultado.total_unidades)} />
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
                getRowId={(row) => `${(row as InventarioValorizadoLinea).producto_id}-${(row as InventarioValorizadoLinea).almacen_id}`}
                rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
                columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
                disableRowSelectionOnClick
                localeText={{ ...esES.components.MuiDataGrid.defaultProps.localeText, noRowsLabel: 'Sin existencias para valorizar con los filtros indicados' }}
                sx={[standardDataGridSx, { border: '1px solid', borderColor: 'divider' }]}
              />
            </Box>
            {lineas.length > 0 && (
              <Box sx={{ display: 'flex', gap: 3, mt: 1.5, pt: 1.5, borderTop: '2px solid', borderColor: COLOR, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Registros</Typography>
                  <Typography variant="body2" fontWeight={700}>{lineas.length}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Unidades Totales</Typography>
                  <Typography variant="body2" fontWeight={700}>{fmtCant(resultado.total_unidades)}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">Valor Total Inventario</Typography>
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
