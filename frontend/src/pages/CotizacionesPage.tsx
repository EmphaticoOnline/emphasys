import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRowParams, GridRenderCellParams } from '@mui/x-data-grid';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import type { CotizacionListado } from '../types/cotizacion';
import { deleteCotizacion, getCotizaciones, downloadCotizacionPdf } from '../services/cotizacionesService';
import { esES } from '@mui/x-data-grid/locales';

export default function CotizacionesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CotizacionListado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const currency = useMemo(
    () =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
      }),
    []
  );

  const load = async () => {
    try {
      setLoading(true);
      const data = await getCotizaciones();
      setRows(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar cotizaciones');
    } finally {
      setLoading(false);
    }
  };

  const formatFecha = (value: any) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const day = d.toLocaleString('es-MX', { day: '2-digit' });
    const month = d.toLocaleString('es-MX', { month: 'short' }).replace('.', '').toUpperCase();
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  useEffect(() => {
    load();
  }, []);

  const columns: GridColDef[] = [
    { field: 'serie', headerName: 'Serie', width: 100 },
    { field: 'numero', headerName: 'Número', width: 110 },
    {
      field: 'fecha_documento',
      headerName: 'Fecha',
      width: 120,
      renderCell: (params: any) => {
        const value = params?.row?.fecha_documento;
        return formatFecha(value);
      },
    },
    { field: 'nombre_cliente', headerName: 'Cliente', flex: 1, minWidth: 220 },
    {
      field: 'subtotal',
      headerName: 'Subtotal',
      width: 140,
      align: 'right',
      headerAlign: 'right',
  renderCell: (params: any) => currency.format(Number(params.row.subtotal ?? 0)),
    },
    {
      field: 'iva',
      headerName: 'IVA',
      width: 120,
      align: 'right',
      headerAlign: 'right',
  renderCell: (params: any) => currency.format(Number(params.row.iva ?? 0)),
    },
    {
      field: 'total',
      headerName: 'Total',
      width: 140,
      align: 'right',
      headerAlign: 'right',
  renderCell: (params: any) => currency.format(Number(params.row.total ?? 0)),
    },
    {
      field: 'estatus_documento',
      headerName: 'Estatus',
      width: 140,
      renderCell: (params: any) => {
        const estatus = params.row?.estatus_documento || 'Borrador';
        const color = estatus === 'Borrador' ? 'default' : estatus === 'Enviado' ? 'info' : 'success';
        return <Chip label={estatus} size="small" color={color as any} />;
      },
    },
    {
      field: 'pdf',
      headerName: 'PDF',
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <IconButton
          size="small"
          color="primary"
          onClick={(e) => {
            e.stopPropagation();
            downloadCotizacionPdf(Number(params.row.id))
              .then((blob) => {
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                setTimeout(() => URL.revokeObjectURL(url), 10_000);
              })
              .catch((err) => {
                setError(err?.message || 'No se pudo generar el PDF');
              });
          }}
        >
          <PictureAsPdfIcon fontSize="small" />
        </IconButton>
      ),
    },
    {
      field: 'actions',
      headerName: 'Acciones',
      width: 150,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <IconButton size="small" color="primary" onClick={() => navigate(`/cotizaciones/${params.id}`)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            disabled={deletingId === params.row.id || loading}
            onClick={async (e) => {
              e.stopPropagation();
              setPendingDeleteId(params.row.id as number);
              setConfirmOpen(true);
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Toolbar disableGutters sx={{ justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Stack spacing={0.5}>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            Cotizaciones
          </Typography>
          <Typography variant="body2" color="#4b5563">
            Consulta y gestiona las cotizaciones de venta.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            Recargar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/cotizaciones/nuevo')}
            sx={{ textTransform: 'uppercase', fontWeight: 700, backgroundColor: '#1d2f68', '&:hover': { backgroundColor: '#162551' } }}
          >
            Nueva
          </Button>
        </Stack>
      </Toolbar>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          autoHeight
          density="compact"
          loading={loading}
          disableRowSelectionOnClick
          onRowClick={(params: GridRowParams) => navigate(`/cotizaciones/${params.id}`)}
          localeText={esES.components.MuiDataGrid.defaultProps.localeText}
          sx={{
            '& .MuiDataGrid-columnHeaders': { backgroundColor: '#f6f8fa' },
            '& .MuiDataGrid-columnHeader': { userSelect: 'none', color: '#1d2f68', fontWeight: 700 },
            '& .MuiDataGrid-columnHeaderTitle': { color: '#1d2f68', fontWeight: 700 },
            '& .MuiDataGrid-virtualScrollerRenderZone .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: '#f7fbfa' },
            '& .MuiDataGrid-row.Mui-hovered': { backgroundColor: '#eef7f4' },
          }}
          hideFooterPagination
          hideFooterSelectedRowCount
          slots={{
            noRowsOverlay: () => (
              <Stack height="100%" alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {loading ? 'Cargando cotizaciones...' : 'No hay cotizaciones registradas.'}
                </Typography>
              </Stack>
            ),
            loadingOverlay: () => (
              <Stack height="100%" alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                <CircularProgress size={22} />
                <Typography variant="body2" color="text.secondary">
                  Cargando cotizaciones...
                </Typography>
              </Stack>
            ),
          }}
        />
      </Paper>

      <Dialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setPendingDeleteId(null);
        }}
      >
        <DialogTitle fontWeight={700}>Eliminar cotización</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#374151' }}>
            ¿Eliminar cotización? Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => {
              setConfirmOpen(false);
              setPendingDeleteId(null);
            }}
            variant="outlined"
          >
            No eliminar
          </Button>
          <Button
            onClick={async () => {
              if (!pendingDeleteId) return;
              try {
                setDeletingId(pendingDeleteId);
                await deleteCotizacion(pendingDeleteId);
                setRows((prev) => prev.filter((r) => r.id !== pendingDeleteId));
                setConfirmOpen(false);
                setPendingDeleteId(null);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No se pudo eliminar la cotización');
              } finally {
                setDeletingId(null);
              }
            }}
            color="error"
            variant="contained"
            disabled={deletingId !== null}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
