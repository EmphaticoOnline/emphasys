import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
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
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
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
  fetchVencimientosProveedores,
  buildVencimientosProveedoresExportUrl,
  type VencimientoProveedor,
  type VencimientosProveedoresParams,
  type VencimientosProveedoresResult,
} from '../../../services/reportesService';

type ContactoOpcion = { id: number; nombre: string; rfc?: string | null };

const formatMXN = (v: number) =>
  v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatFecha = (iso: string): string => {
  if (!iso || iso.length < 10) return iso;
  const [yr, mo, da] = iso.slice(0, 10).split('-');
  return `${da}-${mo}-${yr}`;
};

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function buildColumns(): GridColDef<VencimientoProveedor>[] {
  return [
    {
      field: 'fecha_vencimiento',
      headerName: 'Vencimiento',
      width: 110,
      renderCell: (p: GridRenderCellParams<VencimientoProveedor, string>) => formatFecha(p.value ?? ''),
    },
    {
      field: 'dias',
      headerName: 'Días',
      width: 70,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<VencimientoProveedor, number>) => {
        const v = p.value ?? 0;
        const color = v < 0 ? 'error.main' : v === 0 ? 'warning.main' : 'text.primary';
        return (
          <Typography variant="body2" fontWeight={v <= 0 ? 700 : 400} color={color}>
            {v}
          </Typography>
        );
      },
    },
    {
      field: 'proveedor_nombre',
      headerName: 'Proveedor',
      flex: 1,
      minWidth: 160,
    },
    {
      field: 'folio',
      headerName: 'Documento',
      width: 110,
    },
    {
      field: 'referencia_proveedor',
      headerName: 'Ref. Proveedor',
      width: 120,
      renderCell: (p: GridRenderCellParams<VencimientoProveedor, string>) =>
        p.value ? (
          <Typography variant="body2" color="text.secondary">
            {p.value}
          </Typography>
        ) : null,
    },
    {
      field: 'total',
      headerName: 'Total',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<VencimientoProveedor, number>) => formatMXN(p.value ?? 0),
    },
    {
      field: 'saldo',
      headerName: 'Saldo',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<VencimientoProveedor, number>) => {
        const row = p.row as VencimientoProveedor;
        return (
          <Typography variant="body2" fontWeight={700} color={row.dias < 0 ? 'error.main' : 'text.primary'}>
            {formatMXN(p.value ?? 0)}
          </Typography>
        );
      },
    },
  ];
}

export default function VencimientosProveedoresPage() {
  const navigate = useNavigate();

  const [proveedor, setProveedor] = useState<ContactoOpcion | null>(null);
  const [opciones, setOpciones] = useState<ContactoOpcion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [moneda, setMoneda] = useState('MXN');
  const [fechaCorte, setFechaCorte] = useState(hoy());

  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null);
  const [resultado, setResultado] = useState<VencimientosProveedoresResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const buildParams = (): VencimientosProveedoresParams => ({
    ...(fechaCorte ? { fecha_corte: fechaCorte } : {}),
    ...(proveedor ? { contacto_id: proveedor.id } : {}),
    ...(moneda.trim() ? { moneda: moneda.trim() } : {}),
  });

  useEffect(() => {
    if (fetchRef.current) clearTimeout(fetchRef.current);
    fetchRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchVencimientosProveedores(buildParams());
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
  }, [proveedor, fechaCorte, moneda]);

  const handleExportar = async (formato: 'excel' | 'pdf') => {
    if (exportando) return;
    setExportando(formato);
    try {
      const url = buildVencimientosProveedoresExportUrl(buildParams(), formato);
      const res = await apiFetch(url);
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? 'Error al exportar');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const ext = formato === 'excel' ? 'xlsx' : formato;
      const filename = match?.[1] ?? `vencimientos-proveedores.${ext}`;
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
  const rows = resultado?.vencimientos ?? [];

  const totalPendiente = rows.reduce((s, v) => s + v.saldo, 0);
  const totalVencido   = rows.filter((v) => v.dias < 0).reduce((s, v) => s + v.saldo, 0);
  const totalHoy       = rows.filter((v) => v.dias === 0).reduce((s, v) => s + v.saldo, 0);
  const totalProx7     = rows.filter((v) => v.dias >= 1 && v.dias <= 7).reduce((s, v) => s + v.saldo, 0);
  const totalProx30    = rows.filter((v) => v.dias >= 8 && v.dias <= 30).reduce((s, v) => s + v.saldo, 0);

  const kpis = [
    { label: 'Vencido',        valor: totalVencido,  color: 'error.main'   },
    { label: 'Vence hoy',      valor: totalHoy,      color: 'warning.main' },
    { label: 'Próx. 7 días',   valor: totalProx7,    color: 'text.primary' },
    { label: 'Próx. 30 días',  valor: totalProx30,   color: 'text.primary' },
    { label: 'Total pendiente', valor: totalPendiente, color: 'text.primary' },
  ];

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
        <Typography variant="body2" fontWeight={600}>Vencimientos de Proveedores</Typography>
      </Stack>

      <Box>
        <Typography variant="h6" fontWeight={700}>Vencimientos de Proveedores</Typography>
        <Typography variant="caption" color="text.secondary">
          Facturas de compra pendientes de pago ordenadas por fecha de vencimiento.
        </Typography>
      </Box>

      {/* Filtros */}
      <Paper sx={{ px: 2, py: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            label="Fecha de corte"
            type="date"
            size="small"
            value={fechaCorte}
            onChange={(e) => setFechaCorte(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 155 }}
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
            sx={{ width: 240 }}
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
              <TextField {...(inputProps as any)} label="Proveedor" size="small" placeholder="Todos" />
            )}
          />
          <TextField
            label="Moneda"
            size="small"
            select
            value={moneda}
            onChange={(e) => setMoneda(e.target.value)}
            sx={{ width: 110 }}
          >
            <MenuItem value=""><em>Todas</em></MenuItem>
            <MenuItem value="MXN">MXN</MenuItem>
            <MenuItem value="USD">USD</MenuItem>
            <MenuItem value="EUR">EUR</MenuItem>
          </TextField>
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
      {resultado && (
        <Paper sx={{ p: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Fecha de corte</Typography>
              <Typography variant="body2" fontWeight={600}>{formatFecha(resultado.fecha_corte)}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
            {kpis.map((k) => (
              <Box key={k.label}>
                <Typography variant="caption" color="text.secondary">{k.label}</Typography>
                <Typography variant="body2" fontWeight={700} color={k.color}>
                  {formatMXN(k.valor)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>
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
              getRowId={(row) => (row as VencimientoProveedor).id}
              rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
              columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
              disableRowSelectionOnClick
              getRowClassName={(params) => {
                const row = params.row as VencimientoProveedor;
                if (row.dias < 0) return 'fila-vencida';
                if (row.dias === 0) return 'fila-hoy';
                return '';
              }}
              localeText={{
                ...esES.components.MuiDataGrid.defaultProps.localeText,
                noRowsLabel: 'No hay facturas pendientes de pago con fecha de vencimiento',
              }}
              sx={[
                standardDataGridSx,
                {
                  border: '1px solid',
                  borderColor: 'divider',
                  '& .fila-vencida': { bgcolor: '#fff5f5' },
                  '& .fila-hoy':    { bgcolor: '#fffbeb' },
                },
              ]}
            />
          </Box>
        )}

        {resultado && !loading && rows.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            No hay facturas de proveedor pendientes de pago al {formatFecha(resultado.fecha_corte)}.
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
