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
import { GridContextMenu } from '../../components/grids/GridContextMenu';
import { GridContextMenuTrigger } from '../../components/grids/GridContextMenuTrigger';
import type { GridContextMenuAction } from '../../components/grids/GridContextMenu';
import { SHOW_GRID_ACTIONS } from '../../components/grids/gridUxFlags';
import { STANDARD_DATA_GRID_HEADER_HEIGHT, standardDataGridSx } from '../../components/grids/standardDataGridSx';
import { ConfigPageFrame, ConfigPageHeader } from '../../components/configuracion/configVisual';
import { CircularProgress, FormControlLabel } from '@mui/material';
import { CloseRounded, SaveOutlined } from '@mui/icons-material';
import { catalogoSearchSx } from '../../components/catalogo/catalogoSurfaces';
import { PanelBar, Pill, Section, actionIconSx, dialogPaperSx, editorialDataGridSx, fieldsOnIvorySx, formWellSx, rowIconSx, wellSx } from '../../components/transporte/transporteVisual';
import { useGridContextMenu } from '../../hooks/useGridContextMenu';

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

  const {
    contextMenuRow,
    anchorPosition: contextMenuPosition,
    closeContextMenu,
    openContextMenuForRow,
    rowSlotProps,
  } = useGridContextMenu(filteredRows);

  const contextMenuActions = React.useMemo<GridContextMenuAction[]>(() => {
    if (!contextMenuRow) return [];

    return [
      {
        id: 'editar',
        label: 'Editar lista',
        icon: <EditIcon fontSize="small" />,
        onClick: () => handleEdit(contextMenuRow),
      },
      {
        id: 'toggle-activo',
        label: contextMenuRow.activo ? 'Desactivar' : 'Activar',
        icon: contextMenuRow.activo ? <ToggleOffIcon fontSize="small" /> : <ToggleOnIcon fontSize="small" />,
        onClick: () => void handleToggleActivo(contextMenuRow),
      },
    ];
  }, [contextMenuRow, handleEdit, handleToggleActivo]);

  const contextMenuTriggerColumn = React.useMemo<GridColDef<PrecioLista>>(
    () => ({
      field: 'menu',
      headerName: '',
      width: 42,
      minWidth: 42,
      maxWidth: 42,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      disableReorder: true,
      align: 'center',
      headerAlign: 'center',
      headerClassName: 'finanzas-header',
      renderCell: (params: GridRenderCellParams<PrecioLista>) => (
        <GridContextMenuTrigger onOpen={(event) => openContextMenuForRow(event, params.row)} />
      ),
    }),
    [openContextMenuForRow]
  );

  const baseColumns = React.useMemo<GridColDef<PrecioLista>[]>(() => [
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
        <Pill active={params.row.es_default} label={params.row.es_default ? 'Sí' : 'No'} />
      ),
    },
    {
      field: 'acciones',
      headerName: 'Acciones',
      width: 120,
      sortable: false,
      filterable: false,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'finanzas-header',
      renderCell: (params: GridRenderCellParams<PrecioLista>) => (
        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end" width="100%">
          <Tooltip title="Editar">
            <IconButton size="small" sx={rowIconSx} onClick={() => handleEdit(params.row)}>
              <EditIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={params.row.activo ? 'Desactivar' : 'Activar'}>
            <Switch size="small" checked={params.row.activo} disabled={saving} onChange={() => void handleToggleActivo(params.row)} />
          </Tooltip>
        </Stack>
      ),
    },
  ], [handleEdit, handleToggleActivo, saving]);

  // Acciones visibles por renglón (sin menú contextual de tres puntos).
  const columns = baseColumns;

  return (
    <ConfigPageFrame>
      <ConfigPageHeader
        title="Listas de precios"
        description="Administra catálogos de listas de precios de venta y compra por empresa."
        actions={<Stack direction="row" spacing={0.5}><Tooltip title="Recargar"><span><IconButton size="small" sx={actionIconSx} onClick={() => void load()} disabled={loading || saving}><RefreshIcon fontSize="small" /></IconButton></span></Tooltip><Tooltip title="Nueva lista"><IconButton size="small" sx={actionIconSx} onClick={openCreateDialog}><AddIcon fontSize="small" /></IconButton></Tooltip></Stack>}
      />
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Box sx={wellSx}>
      <PanelBar title={
        <Box sx={{ minWidth: { sm: 320 } }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Buscar por orden, nombre, tipo o estado..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={catalogoSearchSx}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      }>
        <Typography sx={(theme) => ({ fontSize: 12, fontWeight: 600, color: theme.emphasys.content.muted })}>
          {filteredRows.length} {filteredRows.length === 1 ? 'lista' : 'listas'}
        </Typography>
      </PanelBar>
        <DataGrid
          rows={filteredRows}
          columns={columns}
          autoHeight
          density="standard"
          rowHeight={42}
          columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
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
          sx={[
            standardDataGridSx,
            editorialDataGridSx,
            {
              width: '100%',
              '--DataGrid-overlayHeight': '200px',
              '& .MuiDataGrid-cell': {
                display: 'flex',
                alignItems: 'center',
              },
            },
          ]}
        />

      </Box>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle component="div" sx={{ px: { xs: 1.5, md: 2.25 }, pt: 2, pb: 1.5 }}>
          <ConfigPageHeader
            eyebrow="Listas de precios"
            title={editing ? 'Editar lista de precios' : 'Nueva lista de precios'}
            actions={
              <Stack direction="row" spacing={0.5} alignItems="center">
                <FormControlLabel
                  sx={{ mr: 1 }}
                  control={<Switch size="small" checked={form.activo} onChange={(event) => setForm((prev) => ({ ...prev, activo: event.target.checked }))} />}
                  label={<Typography sx={{ fontSize: 13, fontWeight: 600 }}>Activa</Typography>}
                />
                <Tooltip title="Cancelar">
                  <span>
                    <IconButton size="small" sx={actionIconSx} onClick={closeDialog} disabled={saving}><CloseRounded fontSize="small" /></IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={editing ? 'Guardar cambios' : 'Guardar'}>
                  <span>
                    <IconButton size="small" sx={actionIconSx} onClick={() => void handleSave()} disabled={saving}>
                      {saving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlined fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            }
          />
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 1.5, md: 2.25 }, pb: { xs: 1.5, md: 2.25 } }}>
          <Box sx={(theme) => ({ ...formWellSx(theme), ...fieldsOnIvorySx(theme) })}>
          <Section title="Lista de precios" inset>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
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
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
              Default
            </Typography>
            <Switch
              checked={form.es_default}
              onChange={(event) => setForm((prev) => ({ ...prev, es_default: event.target.checked }))}
            />
          </Stack>
          </Stack>
          </Section>
          </Box>
        </DialogContent>
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
    </ConfigPageFrame>
  );
}
