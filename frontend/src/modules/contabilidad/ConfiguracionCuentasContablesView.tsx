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
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import type { ConfiguracionCuentaContable } from '../../types/configuracionCuentasContables';
import { USOS_CONTABLES, USO_CONTABLE_LABELS, TIPO_ENTIDAD_LABELS } from '../../types/configuracionCuentasContables';
import {
  fetchConfiguracionesCuentasContables,
  eliminarConfiguracionCuentaContable,
} from '../../services/configuracionCuentasContablesService';
import {
  STANDARD_DATA_GRID_HEADER_HEIGHT,
  STANDARD_DATA_GRID_ROW_HEIGHT,
  standardDataGridSx,
} from '../../components/grids/standardDataGridSx';
import ConfiguracionCuentaContableFormView from './ConfiguracionCuentaContableFormView';

type Vista = 'lista' | 'formulario';

export default function ConfiguracionCuentasContablesView() {
  const [configuraciones, setConfiguraciones] = React.useState<ConfiguracionCuentaContable[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [vista, setVista] = React.useState<Vista>('lista');
  const [editando, setEditando] = React.useState<ConfiguracionCuentaContable | null>(null);
  const [aEliminar, setAEliminar] = React.useState<ConfiguracionCuentaContable | null>(null);
  const [eliminando, setEliminando] = React.useState(false);
  const [filtroUso, setFiltroUso] = React.useState<string>('');
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const loadConfiguraciones = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchConfiguracionesCuentasContables(filtroUso ? { uso_contable: filtroUso } : {});
      setConfiguraciones(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar las configuraciones contables');
      setConfiguraciones([]);
    } finally {
      setLoading(false);
    }
  }, [filtroUso]);

  React.useEffect(() => {
    void loadConfiguraciones();
  }, [loadConfiguraciones]);

  const handleNuevo = () => {
    setEditando(null);
    setVista('formulario');
  };

  const handleEditar = (config: ConfiguracionCuentaContable) => {
    setEditando(config);
    setVista('formulario');
  };

  const handleCancelarFormulario = () => {
    setVista('lista');
    setEditando(null);
  };

  const handleGuardado = async () => {
    setSnackbar({
      open: true,
      message: editando ? 'Configuración actualizada' : 'Configuración creada',
      severity: 'success',
    });
    setVista('lista');
    setEditando(null);
    await loadConfiguraciones();
  };

  const handlePedirEliminar = (config: ConfiguracionCuentaContable) => {
    setAEliminar(config);
  };

  const handleCerrarEliminar = () => {
    if (eliminando) return;
    setAEliminar(null);
  };

  const handleConfirmarEliminar = async () => {
    if (!aEliminar) return;
    try {
      setEliminando(true);
      await eliminarConfiguracionCuentaContable(aEliminar.id);
      setSnackbar({ open: true, message: 'Configuración eliminada', severity: 'success' });
      setAEliminar(null);
      await loadConfiguraciones();
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo eliminar la configuración', severity: 'error' });
      setAEliminar(null);
    } finally {
      setEliminando(false);
    }
  };

  const columns: GridColDef<ConfiguracionCuentaContable>[] = React.useMemo(
    () => [
      {
        field: 'uso_contable',
        headerName: 'Uso contable',
        flex: 1,
        minWidth: 200,
        headerClassName: 'finanzas-header',
        valueGetter: (_value, row) => USO_CONTABLE_LABELS[row.uso_contable] ?? row.uso_contable,
      },
      {
        field: 'entidad_tipo',
        headerName: 'Entidad',
        width: 170,
        headerClassName: 'finanzas-header',
        valueGetter: (_value, row) => TIPO_ENTIDAD_LABELS[row.entidad_tipo] ?? row.entidad_tipo,
      },
      {
        field: 'entidad_nombre',
        headerName: 'Valor / Nombre entidad',
        flex: 1,
        minWidth: 200,
        headerClassName: 'finanzas-header',
      },
      {
        field: 'cuenta',
        headerName: 'Cuenta contable',
        flex: 1,
        minWidth: 220,
        headerClassName: 'finanzas-header',
        valueGetter: (_value, row) => `${row.cuenta} — ${row.descripcion_cuenta}`,
      },
      {
        field: 'activa',
        headerName: 'Activa',
        width: 100,
        headerClassName: 'finanzas-header',
        renderCell: ({ value }) => <Chip label={value ? 'Sí' : 'No'} color={value ? 'success' : 'default'} size="small" />,
      },
      {
        field: 'notas',
        headerName: 'Notas',
        flex: 1,
        minWidth: 160,
        headerClassName: 'finanzas-header',
        valueGetter: (_value, row) => row.notas ?? '',
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
    ],
    []
  );

  if (vista === 'formulario') {
    return (
      <ConfiguracionCuentaContableFormView
        configuracion={editando}
        onCancel={handleCancelarFormulario}
        onSaved={handleGuardado}
      />
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: { xs: 2, md: 2.5 }, py: 2.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <TextField
          select
          label="Uso contable"
          value={filtroUso}
          onChange={(e) => setFiltroUso(e.target.value)}
          size="small"
          sx={{ minWidth: 240 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {USOS_CONTABLES.map((uso) => (
            <MenuItem key={uso} value={uso}>
              {USO_CONTABLE_LABELS[uso]}
            </MenuItem>
          ))}
        </TextField>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleNuevo}
          sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}
        >
          Nueva configuración
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <DataGrid
          rows={configuraciones}
          columns={columns}
          rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
          columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
          autoHeight
          density="standard"
          loading={loading}
          disableRowSelectionOnClick
          localeText={esES.components.MuiDataGrid.defaultProps.localeText}
          initialState={{ sorting: { sortModel: [{ field: 'uso_contable', sort: 'asc' }] } }}
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
                  No hay configuraciones contables registradas.
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

      <Dialog open={Boolean(aEliminar)} onClose={handleCerrarEliminar} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar configuración contable</DialogTitle>
        <DialogContent>
          <DialogContentText>¿Eliminar esta configuración contable?</DialogContentText>
          {aEliminar && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {USO_CONTABLE_LABELS[aEliminar.uso_contable]} — {aEliminar.entidad_nombre}
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
