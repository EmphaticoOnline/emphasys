import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
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
  fetchCarteraVencida,
  buildCarteraVencidaExportUrl,
  type CarteraVencidaRow,
  type CarteraVencidaResumenRow,
  type TotalCarteraMoneda,
  type CarteraVencidaResult,
  type CarteraVencidaParams,
} from '../../../services/reportesService';

const formatNum = (v: number) =>
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

const BUCKET_COLOR: Record<string, string> = {
  '0-30':  '#388e3c',
  '31-60': '#f57c00',
  '61-90': '#d32f2f',
  '90+':   '#7b1fa2',
};

const BUCKETS: Array<{ key: keyof TotalCarteraMoneda; label: string }> = [
  { key: 'bucket_0_30',    label: '0-30 días'  },
  { key: 'bucket_31_60',   label: '31-60 días' },
  { key: 'bucket_61_90',   label: '61-90 días' },
  { key: 'bucket_90_plus', label: '90+ días'   },
];

function buildDetalleColumns(): GridColDef<CarteraVencidaRow>[] {
  return [
    { field: 'contacto_nombre', headerName: 'Cliente',   flex: 1, minWidth: 150 },
    { field: 'folio',           headerName: 'Documento', width: 110 },
    { field: 'tipo_documento',  headerName: 'Tipo',      width: 130 },
    {
      field: 'fecha_documento',
      headerName: 'Fecha',
      width: 100,
      renderCell: (p: GridRenderCellParams<CarteraVencidaRow, string>) => formatFecha(p.value ?? ''),
    },
    { field: 'moneda', headerName: 'Moneda', width: 80 },
    {
      field: 'saldo',
      headerName: 'Saldo',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<CarteraVencidaRow, number>) => (
        <Typography variant="body2" fontWeight={700}>{formatNum(p.value ?? 0)}</Typography>
      ),
    },
    {
      field: 'dias',
      headerName: 'Días vencido',
      width: 100,
      align: 'right',
      headerAlign: 'right',
    },
    {
      field: 'bucket',
      headerName: 'Antigüedad',
      width: 110,
      renderCell: (p: GridRenderCellParams<CarteraVencidaRow, string>) => {
        const color: string = BUCKET_COLOR[p.value ?? ''] ?? 'text.primary';
        return (
          <Typography variant="caption" fontWeight={700} color={color}>
            {p.value}
          </Typography>
        );
      },
    },
  ];
}

function buildResumenColumns(): GridColDef<CarteraVencidaResumenRow>[] {
  const montoCol = (field: keyof TotalCarteraMoneda, headerName: string): GridColDef<CarteraVencidaResumenRow> => ({
    field,
    headerName,
    width: 120,
    align: 'right',
    headerAlign: 'right',
    renderCell: (p: GridRenderCellParams<CarteraVencidaResumenRow, number>) => {
      const v = p.value ?? 0;
      const bucketKey = (field as string).replace('bucket_', '').replace('_', '-').replace('plus', '+');
      const color: string = BUCKET_COLOR[bucketKey] ?? 'text.primary';
      return v > 0 ? (
        <Typography variant="body2" fontWeight={600} color={color}>{formatNum(v)}</Typography>
      ) : (
        <Typography variant="body2" color="text.disabled">—</Typography>
      );
    },
  });

  return [
    { field: 'contacto_nombre', headerName: 'Cliente', flex: 1, minWidth: 150 },
    { field: 'moneda',          headerName: 'Moneda',  width: 80 },
    montoCol('bucket_0_30',    '0-30 días'),
    montoCol('bucket_31_60',   '31-60 días'),
    montoCol('bucket_61_90',   '61-90 días'),
    montoCol('bucket_90_plus', '90+ días'),
    {
      field: 'total',
      headerName: 'Total',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p: GridRenderCellParams<CarteraVencidaResumenRow, number>) => (
        <Typography variant="body2" fontWeight={700}>{formatNum(p.value ?? 0)}</Typography>
      ),
    },
  ];
}

type Vista = 'detalle' | 'resumen';

export default function CarteraVencidaPage() {
  const navigate = useNavigate();

  const [fechaBase,     setFechaBase]     = useState(hoy());
  const [tipoDocumento, setTipoDocumento] = useState<'' | 'factura' | 'factura_compra'>('');
  const [vista,         setVista]         = useState<Vista>('detalle');

  const [loading,    setLoading]    = useState(false);
  const [exportando, setExportando] = useState(false);
  const [resultado,  setResultado]  = useState<CarteraVencidaResult | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const fetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildParams = (): CarteraVencidaParams => ({
    fecha_base: fechaBase,
    ...(tipoDocumento ? { tipo_documento: tipoDocumento } : {}),
  });

  useEffect(() => {
    if (fetchRef.current) clearTimeout(fetchRef.current);
    fetchRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCarteraVencida(buildParams());
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
  }, [fechaBase, tipoDocumento]);

  const handleExportar = async () => {
    if (exportando) return;
    setExportando(true);
    try {
      const url = buildCarteraVencidaExportUrl(buildParams(), 'excel', vista);
      const res = await apiFetch(url);
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? 'Error al exportar');
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `cartera-vencida-${vista}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al exportar');
      setSnackbarOpen(true);
    } finally {
      setExportando(false);
    }
  };

  const detalleColumns = useMemo(() => buildDetalleColumns(), []);
  const resumenColumns  = useMemo(() => buildResumenColumns(), []);

  const detalleRows = resultado?.detalle ?? [];
  const resumenRows = resultado?.resumen ?? [];
  const totales     = resultado?.totales ?? [];

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
        <Typography variant="body2" fontWeight={600}>Cartera Vencida</Typography>
      </Stack>

      <Box>
        <Typography variant="h6" fontWeight={700}>Cartera Vencida (Aging)</Typography>
        <Typography variant="caption" color="text.secondary">
          Antigüedad de saldos vencidos por cobrar, agrupados por moneda. Totales no mezclan divisas.
        </Typography>
      </Box>

      {/* Filtros */}
      <Paper sx={{ px: 2, py: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            label="Fecha base"
            type="date"
            size="small"
            value={fechaBase}
            onChange={(e) => setFechaBase(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 155 }}
          />
          <TextField
            label="Tipo de documento"
            size="small"
            select
            value={tipoDocumento}
            onChange={(e) => setTipoDocumento(e.target.value as '' | 'factura' | 'factura_compra')}
            sx={{ width: 180 }}
          >
            <MenuItem value=""><em>Todos</em></MenuItem>
            <MenuItem value="factura">Facturas de venta</MenuItem>
            <MenuItem value="factura_compra">Facturas de compra</MenuItem>
          </TextField>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <ButtonGroup size="small" variant="outlined">
            <Button
              variant={vista === 'detalle' ? 'contained' : 'outlined'}
              onClick={() => setVista('detalle')}
            >
              Detalle
            </Button>
            <Button
              variant={vista === 'resumen' ? 'contained' : 'outlined'}
              onClick={() => setVista('resumen')}
            >
              Resumen
            </Button>
          </ButtonGroup>
          <Box sx={{ ml: 'auto', flexShrink: 0 }}>
            <Button
              size="small" variant="outlined"
              disabled={!resultado || exportando}
              startIcon={exportando ? <CircularProgress size={14} color="inherit" /> : <FileDownloadIcon />}
              onClick={() => void handleExportar()}
            >
              Excel
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Totales por moneda */}
      {resultado && totales.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {totales.map((t) => (
            <Paper key={t.moneda} sx={{ p: 1.5, flex: '1 1 340px', minWidth: 300 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                {/* Encabezado de moneda + fecha */}
                <Box sx={{ minWidth: 120 }}>
                  <Typography variant="caption" color="text.secondary">Moneda</Typography>
                  <Typography variant="body2" fontWeight={700} color="primary.main">{t.moneda}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    al {formatFecha(resultado.fecha_base)}
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
                {BUCKETS.map((b) => (
                  <Box key={b.key}>
                    <Typography variant="caption" color="text.secondary">{b.label}</Typography>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      color={BUCKET_COLOR[b.label.replace(' días', '')] ?? 'text.primary'}
                    >
                      {formatNum(t[b.key] as number)}
                    </Typography>
                  </Box>
                ))}
                <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">Total vencido</Typography>
                  <Typography variant="body2" fontWeight={700}>{formatNum(t.total)}</Typography>
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      )}

      {/* Grid */}
      <Paper sx={{ p: 1.5 }}>
        {!resultado && loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Cargando…</Typography>
          </Box>
        )}
        {resultado && (
          <Box sx={{ height: 520 }}>
            {vista === 'detalle' ? (
              <DataGrid
                density="standard"
                rows={detalleRows}
                columns={detalleColumns}
                getRowId={(row) => (row as CarteraVencidaRow).documento_id}
                rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
                columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
                disableRowSelectionOnClick
                localeText={{
                  ...esES.components.MuiDataGrid.defaultProps.localeText,
                  noRowsLabel: 'No hay documentos vencidos con saldo pendiente',
                }}
                sx={[standardDataGridSx, { border: '1px solid', borderColor: 'divider' }]}
              />
            ) : (
              <DataGrid
                density="standard"
                rows={resumenRows}
                columns={resumenColumns}
                getRowId={(row) => {
                  const r = row as CarteraVencidaResumenRow;
                  return String(r.contacto_id ?? '__sin__') + '_' + r.moneda;
                }}
                rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
                columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
                disableRowSelectionOnClick
                localeText={{
                  ...esES.components.MuiDataGrid.defaultProps.localeText,
                  noRowsLabel: 'No hay documentos vencidos con saldo pendiente',
                }}
                sx={[standardDataGridSx, { border: '1px solid', borderColor: 'divider' }]}
              />
            )}
          </Box>
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
