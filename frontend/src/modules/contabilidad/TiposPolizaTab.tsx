import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import type { TipoPoliza } from '../../types/tiposPoliza';
import { fetchTiposPoliza, cambiarEstadoTipoPoliza, eliminarTipoPoliza } from '../../services/tiposPolizaService';
import {
  STANDARD_DATA_GRID_HEADER_HEIGHT,
  STANDARD_DATA_GRID_ROW_HEIGHT,
  standardDataGridSx,
} from '../../components/grids/standardDataGridSx';
import TipoPolizaFormView from './TipoPolizaFormView';

type Vista = 'lista' | 'formulario';

export default function TiposPolizaTab() {
  const [tipos, setTipos] = React.useState<TipoPoliza[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [vista, setVista] = React.useState<Vista>('lista');
  const [tipoEditando, setTipoEditando] = React.useState<TipoPoliza | null>(null);
  const [tipoAEliminar, setTipoAEliminar] = React.useState<TipoPoliza | null>(null);
  const [eliminando, setEliminando] = React.useState(false);
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );

  const loadTipos = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTiposPoliza();
      setTipos(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar los tipos de póliza');
      setTipos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadTipos();
  }, [loadTipos]);

  const handleNuevo = () => {
    setTipoEditando(null);
    setVista('formulario');
  };

  const handleEditar = (tipo: TipoPoliza) => {
    setTipoEditando(tipo);
    setVista('formulario');
  };

  const handleCancelarFormulario = () => {
    setVista('lista');
    setTipoEditando(null);
  };

  const handleGuardado = async () => {
    setSnackbar({
      open: true,
      message: tipoEditando ? 'Tipo de póliza actualizado' : 'Tipo de póliza creado',
      severity: 'success',
    });
    setVista('lista');
    setTipoEditando(null);
    await loadTipos();
  };

  const handleToggleEstado = async (tipo: TipoPoliza) => {
    try {
      await cambiarEstadoTipoPoliza(tipo.id, !tipo.activo);
      setSnackbar({
        open: true,
        message: tipo.activo ? 'Tipo de póliza desactivado' : 'Tipo de póliza activado',
        severity: 'success',
      });
      await loadTipos();
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo cambiar el estado', severity: 'error' });
    }
  };

  const handlePedirEliminar = (tipo: TipoPoliza) => {
    setTipoAEliminar(tipo);
  };

  const handleCerrarEliminar = () => {
    if (eliminando) return;
    setTipoAEliminar(null);
  };

  const handleConfirmarEliminar = async () => {
    if (!tipoAEliminar) return;
    try {
      setEliminando(true);
      await eliminarTipoPoliza(tipoAEliminar.id);
      setSnackbar({ open: true, message: 'Tipo de póliza eliminado', severity: 'success' });
      setTipoAEliminar(null);
      await loadTipos();
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo eliminar el tipo de póliza', severity: 'error' });
      setTipoAEliminar(null);
    } finally {
      setEliminando(false);
    }
  };

  const columns: GridColDef<TipoPoliza>[] = React.useMemo(() => [
    { field: 'identificador', headerName: 'Identificador', flex: 1, minWidth: 200, headerClassName: 'finanzas-header' },
    { field: 'poliza_inicial', headerName: 'Póliza inicial', width: 140, headerClassName: 'finanzas-header' },
    {
      field: 'activo',
      headerName: 'Activo',
      width: 100,
      headerClassName: 'finanzas-header',
      renderCell: ({ value }) => <Chip label={value ? 'Sí' : 'No'} color={value ? 'success' : 'default'} size="small" />,
    },
    {
      field: 'acciones',
      headerName: 'Acciones',
      sortable: false,
      filterable: false,
      width: 150,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'finanzas-header',
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5} justifyContent="flex-end" width="100%">
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => handleEditar(params.row)} sx={{ color: '#1d2f68' }}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={params.row.activo ? 'Desactivar' : 'Activar'}>
            <IconButton
              size="small"
              onClick={() => handleToggleEstado(params.row)}
              sx={{ color: params.row.activo ? '#166534' : '#9ca3af' }}
            >
              {params.row.activo ? <ToggleOnIcon fontSize="small" /> : <ToggleOffIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar">
            <IconButton size="small" onClick={() => handlePedirEliminar(params.row)} sx={{ color: '#b91c1c' }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ], []);

  if (vista === 'formulario') {
    return <TipoPolizaFormView tipo={tipoEditando} onCancel={handleCancelarFormulario} onSaved={handleGuardado} />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: { xs: 2, md: 2.5 }, py: 2.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="flex-end">
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleNuevo}
          sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}
        >
          Nuevo tipo de póliza
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <DataGrid
          rows={tipos}
          columns={columns}
          rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
          columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
          autoHeight
          density="standard"
          loading={loading}
          disableRowSelectionOnClick
          localeText={esES.components.MuiDataGrid.defaultProps.localeText}
          initialState={{ sorting: { sortModel: [{ field: 'identificador', sort: 'asc' }] } }}
          sx={[
            standardDataGridSx,
            {
              '--DataGrid-overlayHeight': '200px',
              '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' },
            },
          ]}
          slots={{
            noRowsOverlay: () => (
              <Stack height="100%" alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  No hay tipos de póliza registrados.
                </Typography>
              </Stack>
            ),
          }}
          hideFooterPagination
          hideFooterSelectedRowCount
        />
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog open={Boolean(tipoAEliminar)} onClose={handleCerrarEliminar} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar tipo de póliza</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Eliminar este tipo de póliza? Solo será posible si no tiene pólizas asociadas.
          </DialogContentText>
          {tipoAEliminar && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {tipoAEliminar.identificador}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCerrarEliminar} disabled={eliminando} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmarEliminar}
            disabled={eliminando}
            color="error"
            variant="contained"
            sx={{ textTransform: 'none' }}
          >
            {eliminando ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
