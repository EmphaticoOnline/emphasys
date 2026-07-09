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
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import type { RangoCuenta } from '../../types/rangosCuentas';
import { NATURALEZA_SALDO_LABEL } from '../../types/rangosCuentas';
import { fetchRangosCuentas, eliminarRangoCuenta } from '../../services/rangosCuentasService';
import {
  STANDARD_DATA_GRID_HEADER_HEIGHT,
  STANDARD_DATA_GRID_ROW_HEIGHT,
  standardDataGridSx,
} from '../../components/grids/standardDataGridSx';
import RangoFormView from './RangoFormView';

type Vista = 'lista' | 'formulario';

export default function RangosTab() {
  const [rangos, setRangos] = React.useState<RangoCuenta[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [vista, setVista] = React.useState<Vista>('lista');
  const [rangoEditando, setRangoEditando] = React.useState<RangoCuenta | null>(null);
  const [rangoAEliminar, setRangoAEliminar] = React.useState<RangoCuenta | null>(null);
  const [eliminando, setEliminando] = React.useState(false);
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );

  const loadRangos = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRangosCuentas();
      setRangos(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar los rangos de cuentas');
      setRangos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRangos();
  }, [loadRangos]);

  const handleNuevo = () => {
    setRangoEditando(null);
    setVista('formulario');
  };

  const handleEditar = (rango: RangoCuenta) => {
    setRangoEditando(rango);
    setVista('formulario');
  };

  const handleCancelarFormulario = () => {
    setVista('lista');
    setRangoEditando(null);
  };

  const handleGuardado = async () => {
    setSnackbar({
      open: true,
      message: rangoEditando ? 'Rango actualizado' : 'Rango creado',
      severity: 'success',
    });
    setVista('lista');
    setRangoEditando(null);
    await loadRangos();
  };

  const handlePedirEliminar = (rango: RangoCuenta) => {
    setRangoAEliminar(rango);
  };

  const handleCerrarEliminar = () => {
    if (eliminando) return;
    setRangoAEliminar(null);
  };

  const handleConfirmarEliminar = async () => {
    if (!rangoAEliminar) return;
    try {
      setEliminando(true);
      await eliminarRangoCuenta(rangoAEliminar.id);
      setSnackbar({ open: true, message: 'Rango eliminado', severity: 'success' });
      setRangoAEliminar(null);
      await loadRangos();
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo eliminar el rango', severity: 'error' });
      setRangoAEliminar(null);
    } finally {
      setEliminando(false);
    }
  };

  const columns: GridColDef<RangoCuenta>[] = React.useMemo(() => [
    { field: 'limite_superior', headerName: 'Límite superior', width: 130, headerClassName: 'finanzas-header' },
    { field: 'descripcion', headerName: 'Descripción', flex: 1.2, minWidth: 200, headerClassName: 'finanzas-header' },
    {
      field: 'naturaleza_saldo',
      headerName: 'Naturaleza',
      width: 130,
      headerClassName: 'finanzas-header',
      renderCell: ({ value }) => NATURALEZA_SALDO_LABEL[value as 'D' | 'A'] ?? value,
    },
    { field: 'grupo', headerName: 'Grupo', flex: 1, minWidth: 160, headerClassName: 'finanzas-header' },
    { field: 'subgrupo', headerName: 'Subgrupo', flex: 1.2, minWidth: 200, headerClassName: 'finanzas-header' },
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
      width: 110,
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
    return <RangoFormView rango={rangoEditando} onCancel={handleCancelarFormulario} onSaved={handleGuardado} />;
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
          Nuevo rango
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <DataGrid
          rows={rangos}
          columns={columns}
          getRowId={(row) => row.id}
          rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
          columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
          autoHeight
          density="standard"
          loading={loading}
          disableRowSelectionOnClick
          localeText={esES.components.MuiDataGrid.defaultProps.localeText}
          initialState={{ sorting: { sortModel: [{ field: 'limite_superior', sort: 'asc' }] } }}
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
                  No hay rangos de cuentas registrados.
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

      <Dialog open={Boolean(rangoAEliminar)} onClose={handleCerrarEliminar} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar rango de cuenta</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Eliminar este rango? Esta acción solo será posible si el rango no está asignado a ninguna cuenta contable.
          </DialogContentText>
          {rangoAEliminar && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {rangoAEliminar.limite_superior} — {rangoAEliminar.descripcion}
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
