import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import { TIPOS_PRECIO_LISTA, type TipoPrecioLista } from '../../constants/precios';
import {
  createPrecioLista,
  deletePrecioLista,
  fetchPreciosListas,
  updatePrecioLista,
  type PrecioLista,
} from '../../services/preciosListasService';

type FormState = {
  nombre: string;
  tipo_precio: TipoPrecioLista;
  orden: string;
  es_default: boolean;
  activo: boolean;
};

const EMPTY_FORM: FormState = {
  nombre: '',
  tipo_precio: TIPOS_PRECIO_LISTA[0],
  orden: '',
  es_default: false,
  activo: true,
};

function normalizeOrden(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) {
    throw new Error('El orden debe ser un número entero');
  }
  return parsed;
}

function sortRows(rows: PrecioLista[]) {
  return [...rows].sort((left, right) => {
    const leftOrden = left.orden ?? Number.MAX_SAFE_INTEGER;
    const rightOrden = right.orden ?? Number.MAX_SAFE_INTEGER;
    if (leftOrden !== rightOrden) {
      return leftOrden - rightOrden;
    }
    return left.nombre.localeCompare(right.nombre, 'es', { sensitivity: 'base' });
  });
}

export default function ListasPreciosPage() {
  const [rows, setRows] = React.useState<PrecioLista[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PrecioLista | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [snackbar, setSnackbar] = React.useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchPreciosListas(true);
      setRows(sortRows(data));
      setError(null);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'No se pudieron cargar las listas de precios';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return rows;
    }

    return rows.filter((row) => (
      [row.nombre, row.tipo_precio, row.orden ?? '', row.es_default ? 'default' : '', row.activo ? 'activa' : 'inactiva']
        .map((value) => String(value).toLowerCase())
        .some((value) => value.includes(term))
    ));
  }, [rows, search]);

  const closeDialog = React.useCallback(() => {
    if (saving) {
      return;
    }
    setDialogOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }, [saving]);

  const openCreateDialog = React.useCallback(() => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const handleEdit = React.useCallback((row: PrecioLista) => {
    setEditing(row);
    setForm({
      nombre: row.nombre,
      tipo_precio: row.tipo_precio,
      orden: row.orden === null || row.orden === undefined ? '' : String(row.orden),
      es_default: row.es_default,
      activo: row.activo,
    });
    setDialogOpen(true);
  }, []);

  const handleSave = React.useCallback(async () => {
    const nombre = form.nombre.trim();
    if (!nombre) {
      setSnackbar({ open: true, message: 'El nombre es obligatorio', severity: 'warning' });
      return;
    }

    try {
      const orden = normalizeOrden(form.orden);
      setSaving(true);
      if (editing) {
        const updated = await updatePrecioLista(editing.id, {
          nombre,
          tipo_precio: form.tipo_precio,
          orden,
          es_default: form.es_default,
          activo: form.activo,
        });
        setRows((prev) => sortRows(prev.map((row) => (row.id === updated.id ? updated : row))));
      } else {
        const created = await createPrecioLista({
          nombre,
          tipo_precio: form.tipo_precio,
          orden,
          es_default: form.es_default,
          activo: form.activo,
        });
        setRows((prev) => sortRows([...prev, created]));
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setSnackbar({
        open: true,
        message: editing ? 'Lista de precios actualizada' : 'Lista de precios creada',
        severity: 'success',
      });
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'No se pudo guardar la lista de precios';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  }, [editing, form]);

  const handleToggleActivo = React.useCallback(async (row: PrecioLista) => {
    try {
      setSaving(true);
      const updated = row.activo
        ? await deletePrecioLista(row.id)
        : await updatePrecioLista(row.id, { activo: true });

      setRows((prev) => sortRows(prev.map((item) => (item.id === updated.id ? updated : item))));
      setSnackbar({
        open: true,
        message: updated.activo ? 'Lista de precios activada' : 'Lista de precios desactivada',
        severity: 'success',
      });
    } catch (toggleError) {
      const message = toggleError instanceof Error ? toggleError.message : 'No se pudo actualizar el estado';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  }, []);

  const columns = React.useMemo<GridColDef<PrecioLista>[]>(() => [
    {
      field: 'orden',
      headerName: 'Orden',
      width: 100,
      type: 'number',
      headerClassName: 'finanzas-header',
      renderCell: (params: GridRenderCellParams<PrecioLista, number | null>) => params.value ?? '',
    },
    {
      field: 'nombre',
      headerName: 'Nombre',
      flex: 1,
      minWidth: 220,
      headerClassName: 'finanzas-header',
      renderCell: (params: GridRenderCellParams<PrecioLista, string>) => (
        <Typography variant="body2" fontWeight={600} noWrap title={params.value || ''}>
          {params.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'tipo_precio',
      headerName: 'Tipo precio',
      width: 140,
      headerClassName: 'finanzas-header',
    },
    {
      field: 'es_default',
      headerName: 'Default',
      width: 120,
      headerClassName: 'finanzas-header',
      renderCell: (params: GridRenderCellParams<PrecioLista, boolean>) => (
        <Chip
          size="small"
          label={params.row.es_default ? 'Sí' : 'No'}
          color={params.row.es_default ? 'primary' : 'default'}
          variant={params.row.es_default ? 'filled' : 'outlined'}
        />
      ),
    },
    {
      field: 'activo',
      headerName: 'Activa',
      width: 120,
      headerClassName: 'finanzas-header',
      renderCell: (params: GridRenderCellParams<PrecioLista, boolean>) => (
        <Chip
          size="small"
          label={params.row.activo ? 'Activa' : 'Inactiva'}
          color={params.row.activo ? 'success' : 'default'}
          variant={params.row.activo ? 'filled' : 'outlined'}
        />
      ),
    },
    {
      field: 'acciones',
      headerName: 'Acciones',
      width: 130,
      sortable: false,
      filterable: false,
      headerClassName: 'finanzas-header',
      renderCell: (params: GridRenderCellParams<PrecioLista>) => (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Tooltip title="Editar">
            <IconButton size="small" color="primary" onClick={() => handleEdit(params.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={params.row.activo ? 'Desactivar' : 'Activar'}>
            <IconButton
              size="small"
              color={params.row.activo ? 'warning' : 'success'}
              onClick={() => void handleToggleActivo(params.row)}
            >
              {params.row.activo ? <ToggleOffIcon fontSize="small" /> : <ToggleOnIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ], [handleEdit, handleToggleActivo]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Toolbar disableGutters sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Stack spacing={0.5}>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            Listas de precios
          </Typography>
          <Typography variant="body2" color="#4b5563">
            Administra catálogos de listas de precios por empresa y prepara el ordenamiento futuro.
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1}>
          <IconButton color="primary" onClick={() => void load()} disabled={loading || saving}>
            <RefreshIcon />
          </IconButton>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
            Nueva lista
          </Button>
        </Stack>
      </Toolbar>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <TextField
        size="small"
        placeholder="Buscar por orden, nombre, tipo o estado..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', width: '100%' }}>
        <DataGrid
          rows={filteredRows}
          columns={columns}
          autoHeight
          density="standard"
          rowHeight={42}
          columnHeaderHeight={52}
          getRowId={(row) => row.id}
          loading={loading || saving}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            sorting: {
              sortModel: [
                { field: 'orden', sort: 'asc' },
                { field: 'nombre', sort: 'asc' },
              ],
            },
          }}
          localeText={{
            ...esES.components.MuiDataGrid.defaultProps.localeText,
            noRowsLabel: loading ? 'Cargando listas de precios...' : 'No hay listas de precios registradas.',
          }}
          sx={{
            width: '100%',
            '--DataGrid-overlayHeight': '200px',
            '& .MuiDataGrid-cell': {
              display: 'flex',
              alignItems: 'center',
            },
            '& .MuiDataGrid-row:nth-of-type(even)': {
              backgroundColor: 'rgba(0, 120, 70, 0.05)',
            },
            '& .finanzas-header': {
              backgroundColor: '#1d2f68 !important',
              color: '#ffffff !important',
              fontWeight: 600,
            },
            '& .finanzas-header .MuiDataGrid-columnHeaderTitle': {
              color: '#ffffff !important',
              fontWeight: 600,
            },
            '& .finanzas-header .MuiDataGrid-sortIcon': {
              color: '#ffffff !important',
            },
            '& .finanzas-header .MuiDataGrid-menuIcon': {
              color: '#ffffff !important',
            },
            '& .finanzas-header:hover .MuiDataGrid-menuIcon': {
              color: '#ffffff !important',
            },
            '& .finanzas-header .MuiIconButton-root': {
              color: '#ffffff !important',
            },
            '& .MuiDataGrid-columnSeparator': {
              color: 'rgba(255,255,255,0.25) !important',
            },
          }}
        />
      </Paper>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? 'Editar lista de precios' : 'Nueva lista de precios'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Nombre"
            value={form.nombre}
            onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
            autoFocus
          />
          <TextField
            select
            label="Tipo precio"
            value={form.tipo_precio}
            onChange={(event) => setForm((prev) => ({ ...prev, tipo_precio: event.target.value as TipoPrecioLista }))}
          >
            {TIPOS_PRECIO_LISTA.map((tipoPrecio) => (
              <MenuItem key={tipoPrecio} value={tipoPrecio}>
                {tipoPrecio}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Orden"
            type="number"
            value={form.orden}
            onChange={(event) => setForm((prev) => ({ ...prev, orden: event.target.value }))}
            helperText="Opcional. Deja preparada la secuencia visual del catálogo."
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Default
            </Typography>
            <Switch
              checked={form.es_default}
              onChange={(event) => setForm((prev) => ({ ...prev, es_default: event.target.checked }))}
            />
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Activa
            </Typography>
            <Switch
              checked={form.activo}
              onChange={(event) => setForm((prev) => ({ ...prev, activo: event.target.checked }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void handleSave()} variant="contained" disabled={saving}>
            {editing ? 'Guardar cambios' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}