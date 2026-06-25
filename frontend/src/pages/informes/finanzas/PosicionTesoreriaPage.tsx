import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
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
  fetchPosicionTesoreria,
  buildPosicionTesoreriaExportUrl,
  type CuentaTesoreria,
  type PosicionTesoreriaResult,
} from '../../../services/reportesService';

const formatMXN = (v: number) =>
  v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatFecha = (iso: string): string => {
  if (!iso || iso.length < 10) return iso;
  const [yr, mo, da] = iso.slice(0, 10).split('-');
  return `${da}-${mo}-${yr}`;
};

const COLUMNAS: GridColDef<CuentaTesoreria>[] = [
  { field: 'identificador', headerName: 'Cuenta',    flex: 1, minWidth: 150 },
  { field: 'tipo_cuenta',   headerName: 'Tipo',      width: 130 },
  { field: 'moneda',        headerName: 'Moneda',    width: 80  },
  {
    field: 'saldo',
    headerName: 'Saldo actual',
    width: 140,
    align: 'right',
    headerAlign: 'right',
    renderCell: (p: GridRenderCellParams<CuentaTesoreria, number>) => (
      <Typography variant="body2" fontWeight={700} color={(p.value ?? 0) < 0 ? 'error.main' : 'text.primary'}>
        {formatMXN(p.value ?? 0)}
      </Typography>
    ),
  },
  {
    field: 'saldo_conciliado',
    headerName: 'Conciliado',
    width: 130,
    align: 'right',
    headerAlign: 'right',
    renderCell: (p: GridRenderCellParams<CuentaTesoreria, number>) => (
      <Typography variant="body2" color="text.secondary">{formatMXN(p.value ?? 0)}</Typography>
    ),
  },
  {
    field: 'fecha_ultima_conciliacion',
    headerName: 'Última conc.',
    width: 115,
    renderCell: (p: GridRenderCellParams<CuentaTesoreria, string | null>) =>
      p.value ? formatFecha(p.value) : <Typography variant="body2" color="text.disabled">—</Typography>,
  },
  {
    field: 'es_cuenta_efectivo',
    headerName: 'Efectivo',
    width: 80,
    align: 'center',
    headerAlign: 'center',
    renderCell: (p: GridRenderCellParams<CuentaTesoreria, boolean>) =>
      p.value ? <Chip label="Sí" size="small" color="success" variant="outlined" /> : null,
  },
];

export default function PosicionTesoreriaPage() {
  const navigate = useNavigate();

  const [loading,    setLoading]    = useState(false);
  const [exportando, setExportando] = useState(false);
  const [resultado,  setResultado]  = useState<PosicionTesoreriaResult | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchPosicionTesoreria()
      .then(setResultado)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Error al cargar posición de tesorería');
        setSnackbarOpen(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleExportar = async () => {
    if (exportando) return;
    setExportando(true);
    try {
      const url = buildPosicionTesoreriaExportUrl('excel');
      const res = await apiFetch(url);
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? 'Error al exportar');
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = 'posicion-tesoreria.xlsx';
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

  const cuentas = resultado?.cuentas ?? [];
  const totales = resultado?.totales_por_moneda ?? [];

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/informes')}
          sx={{ color: 'text.secondary' }}>
          Informes
        </Button>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" color="text.secondary">Finanzas</Typography>
        <Typography color="text.disabled">/</Typography>
        <Typography variant="body2" fontWeight={600}>Posición de Tesorería</Typography>
      </Stack>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Posición de Tesorería</Typography>
          <Typography variant="caption" color="text.secondary">
            Saldos actuales de todas las cuentas bancarias y de efectivo.
            {resultado && ` Consulta al ${formatFecha(resultado.fecha_consulta)}.`}
          </Typography>
        </Box>
        <Button
          size="small" variant="outlined"
          disabled={!resultado || exportando}
          startIcon={exportando ? <CircularProgress size={14} color="inherit" /> : <FileDownloadIcon />}
          onClick={() => void handleExportar()}
        >
          Excel
        </Button>
      </Box>

      {loading && !resultado && (
        <Paper sx={{ p: 2, position: 'relative', overflow: 'hidden' }}>
          <LinearProgress />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Cargando…</Typography>
          </Box>
        </Paper>
      )}

      {resultado && totales.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {totales.map((t) => (
            <Card key={t.moneda} variant="outlined" sx={{ minWidth: 200 }}>
              <CardContent sx={{ pb: '12px !important', pt: 1.5, px: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <AccountBalanceIcon fontSize="small" color="primary" />
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    {t.moneda} — {t.cantidad_cuentas} cuenta{t.cantidad_cuentas !== 1 ? 's' : ''}
                  </Typography>
                </Box>
                <Typography variant="h6" fontWeight={700} color={t.saldo < 0 ? 'error.main' : 'text.primary'}>
                  {formatMXN(t.saldo)}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Conciliado: {formatMXN(t.saldo_conciliado)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {resultado && (
        <Paper sx={{ p: 1.5 }}>
          <Box sx={{ height: 480 }}>
            <DataGrid
              density="standard"
              rows={cuentas}
              columns={COLUMNAS}
              getRowId={(row) => (row as CuentaTesoreria).id}
              rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
              columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
              disableRowSelectionOnClick
              localeText={{
                ...esES.components.MuiDataGrid.defaultProps.localeText,
                noRowsLabel: 'No hay cuentas activas',
              }}
              sx={[standardDataGridSx, { border: '1px solid', borderColor: 'divider' }]}
            />
          </Box>
        </Paper>
      )}

      <Snackbar open={snackbarOpen} autoHideDuration={5000} onClose={() => setSnackbarOpen(false)}>
        <Alert severity="error" onClose={() => setSnackbarOpen(false)} sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
