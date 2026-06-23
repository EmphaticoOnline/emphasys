import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Divider,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
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
  fetchHistorialPreciosCompra,
  buildHistorialPreciosExportUrl,
  type HistorialPrecioLinea,
  type HistorialPreciosParams,
  type HistorialPreciosResult,
} from '../../../services/reportesService';

type ContactoOpcion = { id: number; nombre: string; rfc?: string | null };
type ProductoOpcion = { id: number; clave: string; descripcion: string };

const formatMXN = (v: number) =>
  v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCant = (v: number) =>
  v.toLocaleString('es-MX', { maximumFractionDigits: 4 });

const formatFecha = (iso: string): string => {
  if (!iso || iso.length < 10) return iso;
  const [yr, mo, da] = iso.slice(0, 10).split('-');
  return `${da}-${mo}-${yr}`;
};

function primerDiaMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildColumns(): GridColDef<HistorialPrecioLinea>[] {
  return [
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 100,
      renderCell: (p: GridRenderCellParams<HistorialPrecioLinea, string>) => formatFecha(p.value ?? ''),
    },
    {
      field: 'proveedor_nombre',
      headerName: 'Proveedor',
      width: 160,
    },
    {
      field: '_documento',
      headerName: 'Documento',
      width: 110,
      renderCell: (p: GridRenderCellParams<HistorialPrecioLinea>) => {
        const row = p.row as HistorialPrecioLinea;
        return row.referencia_proveedor || row.folio;
      },
    },
    {
      field: 'clave',
      headerName: 'Clave',
      width: 130,
    },
    {
      field: 'descripcion',
      headerName: 'Descripción',
      flex: 1,
      minWidth: 160,
    },
    {
      field: 'cantidad',
      headerName: 'Cantidad',
      width: 90,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<HistorialPrecioLinea, number>) => formatCant(p.value ?? 0),
    },
    {
      field: 'precio_unitario',
      headerName: 'Precio unitario',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<HistorialPrecioLinea, number>) => (
        <Typography variant="body2" fontWeight={700} color="primary.main">
          {formatMXN(p.value ?? 0)}
        </Typography>
      ),
    },
    {
      field: 'subtotal',
      headerName: 'Subtotal',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<HistorialPrecioLinea, number>) => formatMXN(p.value ?? 0),
    },
  ];
}

export default function HistorialPreciosCompraPage() {
  const navigate = useNavigate();

  const [fechaInicio, setFechaInicio] = useState(primerDiaMes());
  const [fechaFin, setFechaFin]       = useState(hoy());
  const [producto, setProducto]       = useState<ProductoOpcion | null>(null);
  const [proveedor, setProveedor]     = useState<ContactoOpcion | null>(null);
  const [opcionesProducto, setOpcionesProducto] = useState<ProductoOpcion[]>([]);
  const [opcionesProveedor, setOpcionesProveedor] = useState<ContactoOpcion[]>([]);
  const [buscandoProducto, setBuscandoProducto] = useState(false);
  const [buscandoProveedor, setBuscandoProveedor] = useState(false);

  const [loading, setLoading]     = useState(false);
  const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null);
  const [resultado, setResultado] = useState<HistorialPreciosResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const fetchRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productoTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const proveedorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscarProductos = useCallback((input: string) => {
    if (productoTimer.current) clearTimeout(productoTimer.current);
    productoTimer.current = setTimeout(async () => {
      setBuscandoProducto(true);
      try {
        const qs = new URLSearchParams({ page: '1', limit: '40' });
        if (input.trim()) qs.set('search', input.trim());
        const res = await apiFetch(`/api/productos?${qs.toString()}`);
        if (res.ok) {
          const raw = (await res.json()) as ProductoOpcion[] | { data?: ProductoOpcion[] };
          const items = Array.isArray(raw) ? raw : ((raw as { data?: ProductoOpcion[] }).data ?? []);
          setOpcionesProducto(items);
        }
      } finally {
        setBuscandoProducto(false);
      }
    }, 250);
  }, []);

  const buscarProveedores = useCallback((input: string) => {
    if (proveedorTimer.current) clearTimeout(proveedorTimer.current);
    proveedorTimer.current = setTimeout(async () => {
      setBuscandoProveedor(true);
      try {
        const qs = new URLSearchParams({ limit: '40', tipos: 'proveedor,varios' });
        if (input.trim()) qs.set('search', input.trim());
        const res = await apiFetch(`/api/contactos?${qs.toString()}`);
        if (res.ok) {
          const raw = (await res.json()) as ContactoOpcion[] | { data?: ContactoOpcion[] };
          const items = Array.isArray(raw) ? raw : ((raw as { data?: ContactoOpcion[] }).data ?? []);
          setOpcionesProveedor(items);
        }
      } finally {
        setBuscandoProveedor(false);
      }
    }, 250);
  }, []);

  const buildParams = (): HistorialPreciosParams => ({
    fecha_inicio: fechaInicio,
    fecha_fin:    fechaFin,
    ...(producto  ? { producto_id:  producto.id  } : {}),
    ...(proveedor ? { contacto_id: proveedor.id } : {}),
  });

  useEffect(() => {
    if (!fechaInicio || !fechaFin) return;
    if (fetchRef.current) clearTimeout(fetchRef.current);
    fetchRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchHistorialPreciosCompra(buildParams());
        setResultado(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al generar el reporte';
        setError(msg);
        setSnackbarOpen(true);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => { if (fetchRef.current) clearTimeout(fetchRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaInicio, fechaFin, producto, proveedor]);

  const handleExportar = async (formato: 'excel' | 'pdf') => {
    if (exportando) return;
    setExportando(formato);
    try {
      const url = buildHistorialPreciosExportUrl(buildParams(), formato);
      const res = await apiFetch(url);
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? 'Error al exportar');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const ext = formato === 'excel' ? 'xlsx' : formato;
      const filename = match?.[1] ?? `historial-precios-compra.${ext}`;
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
      setSnackbarOpen(true);
    } finally {
      setExportando(null);
    }
  };

  const columns = useMemo(() => buildColumns(), []);
  const rows    = resultado?.lineas ?? [];
  const resumen = resultado?.resumen;

  const varPct      = resumen?.variacion_pct ?? null;
  const varTexto    = varPct === null ? 'N/A' : `${varPct >= 0 ? '+' : ''}${varPct.toFixed(2)} %`;
  const varColor    = varPct === null ? 'text.secondary' : varPct > 0 ? 'error.main' : varPct < 0 ? 'success.main' : 'text.primary';
  const VarIcon     = varPct !== null && varPct < 0 ? TrendingDownIcon : TrendingUpIcon;
  const varIconColor = varPct === null ? 'text.secondary' : varPct > 0 ? 'error.main' : varPct < 0 ? 'success.main' : 'text.secondary';

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Breadcrumb */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/informes')}
          sx={{ color: 'text.secondary' }}>
          Informes
        </Button>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" color="text.secondary">Compras</Typography>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" fontWeight={600}>Historial de Precios de Compra</Typography>
      </Stack>

      <Box>
        <Typography variant="h6" fontWeight={700}>Historial de Precios de Compra</Typography>
        <Typography variant="caption" color="text.secondary">
          Evolución de costos unitarios en facturas de compra. Compara proveedores y analiza variaciones de precio.
        </Typography>
      </Box>

      {/* Filtros */}
      <Paper sx={{ px: 2, py: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            label="Fecha inicial"
            type="date"
            size="small"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 155 }}
          />
          <TextField
            label="Fecha final"
            type="date"
            size="small"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 155 }}
          />
          <Autocomplete<ProductoOpcion>
            options={opcionesProducto}
            loading={buscandoProducto}
            value={producto}
            onChange={(_, val) => setProducto(val)}
            onInputChange={(_, input) => buscarProductos(input)}
            onOpen={() => { if (!opcionesProducto.length) buscarProductos(''); }}
            getOptionLabel={(o) => `${o.clave} — ${o.descripcion}`}
            getOptionKey={(o) => o.id}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            sx={{ width: 240 }}
            renderOption={(props, o) => (
              <li {...props} key={o.id}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{o.clave}</Typography>
                  <Typography variant="caption" color="text.secondary">{o.descripcion}</Typography>
                </Box>
              </li>
            )}
            renderInput={(inputProps) => (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <TextField {...(inputProps as any)} label="Producto (todos)" size="small" />
            )}
          />
          <Autocomplete<ContactoOpcion>
            options={opcionesProveedor}
            loading={buscandoProveedor}
            value={proveedor}
            onChange={(_, val) => setProveedor(val)}
            onInputChange={(_, input) => buscarProveedores(input)}
            onOpen={() => { if (!opcionesProveedor.length) buscarProveedores(''); }}
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
            renderInput={(inputProps) => (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <TextField {...(inputProps as any)} label="Proveedor (todos)" size="small" />
            )}
          />
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5, flexShrink: 0 }}>
            <Button
              size="small" variant="outlined" color="error"
              disabled={!resultado || !!exportando}
              startIcon={exportando === 'pdf' ? <CircularProgress size={14} color="inherit" /> : <PictureAsPdfIcon />}
              onClick={() => void handleExportar('pdf')}
            >
              PDF
            </Button>
            <Button
              size="small" variant="outlined"
              disabled={!resultado || !!exportando}
              startIcon={exportando === 'excel' ? <CircularProgress size={14} color="inherit" /> : <FileDownloadIcon />}
              onClick={() => void handleExportar('excel')}
            >
              Excel
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* KPIs */}
      {resumen && (
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {[
            { label: 'Último costo',    valor: formatMXN(resumen.ultimo_costo),   color: '#1d2f68', bold: true },
            { label: 'Costo mínimo',    valor: formatMXN(resumen.costo_min),      color: 'success.main', bold: false },
            { label: 'Costo máximo',    valor: formatMXN(resumen.costo_max),      color: 'error.main', bold: false },
            { label: 'Promedio ponder.', valor: formatMXN(resumen.costo_promedio), color: 'text.primary', bold: false },
          ].map((k) => (
            <Paper
              key={k.label}
              variant="outlined"
              sx={{ p: 1.5, flex: '1 1 140px', minWidth: 130, borderRadius: 2 }}
            >
              <Typography variant="caption" color="text.secondary" display="block">{k.label}</Typography>
              <Typography variant="subtitle2" fontWeight={700} color={k.color}>
                {k.valor}
              </Typography>
            </Paper>
          ))}

          {/* Variación */}
          <Paper variant="outlined" sx={{ p: 1.5, flex: '1 1 140px', minWidth: 130, borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block">Variación período</Typography>
            <Stack direction="row" alignItems="center" spacing={0.5} mt={0.25}>
              <VarIcon sx={{ fontSize: 16, color: varIconColor }} />
              <Typography variant="subtitle2" fontWeight={700} color={varColor}>
                {varTexto}
              </Typography>
            </Stack>
            {resumen.primer_costo !== null && varPct !== null && (
              <Typography variant="caption" color="text.disabled" display="block">
                {formatMXN(resumen.primer_costo)} → {formatMXN(resumen.ultimo_costo)}
              </Typography>
            )}
          </Paper>

          {/* Registros */}
          <Paper variant="outlined" sx={{ p: 1.5, flex: '0 1 100px', minWidth: 90, borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block">Registros</Typography>
            <Typography variant="subtitle2" fontWeight={700}>{rows.length}</Typography>
          </Paper>
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
          <Box sx={{ height: 520 }}>
            <DataGrid
              density="standard"
              rows={rows}
              columns={columns}
              getRowId={(row) => (row as HistorialPrecioLinea).id}
              rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
              columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
              disableRowSelectionOnClick
              localeText={{
                ...esES.components.MuiDataGrid.defaultProps.localeText,
                noRowsLabel: 'No hay compras en el período indicado',
              }}
              sx={[standardDataGridSx, { border: '1px solid', borderColor: 'divider' }]}
            />
          </Box>
        )}

        {resultado && !loading && rows.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            No hay facturas de compra en el período {formatFecha(fechaInicio)} – {formatFecha(fechaFin)}.
          </Typography>
        )}
      </Paper>

      <Snackbar open={snackbarOpen} autoHideDuration={5000} onClose={() => setSnackbarOpen(false)}>
        <Alert severity="error" onClose={() => setSnackbarOpen(false)} sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
