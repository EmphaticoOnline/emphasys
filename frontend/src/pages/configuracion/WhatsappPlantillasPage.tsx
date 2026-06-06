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
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import AddIcon from '@mui/icons-material/Add';
import ClearIcon from '@mui/icons-material/Clear';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import {
  actualizarWhatsappPlantilla,
  crearWhatsappPlantilla,
  fetchWhatsappPlantillas,
  type PlantillaAdminPayload,
  type WhatsappPlantillaOption,
} from '../../services/whatsappPlantillasService';
import { GridContextMenu } from '../../components/grids/GridContextMenu';
import { GridContextMenuTrigger } from '../../components/grids/GridContextMenuTrigger';
import type { GridContextMenuAction } from '../../components/grids/GridContextMenu';
import { SHOW_GRID_ACTIONS } from '../../components/grids/gridUxFlags';
import { STANDARD_DATA_GRID_HEADER_HEIGHT, STANDARD_DATA_GRID_ROW_HEIGHT, standardDataGridSx } from '../../components/grids/standardDataGridSx';
import { useGridContextMenu } from '../../hooks/useGridContextMenu';

const TIPOS_PLANTILLA = [
  'envio_cotizacion',
  'envio_orden_servicio',
  'envio_cfdi',
  'envio_nota_venta',
  'reactivacion',
  'seguimiento',
] as const;

type TipoPlantilla = typeof TIPOS_PLANTILLA[number];

type FormState = {
  nombre_interno: string;
  tipo: TipoPlantilla | '';
  proveedor: string;
  provider_template_id: string;
  es_default: boolean;
  activa: boolean;
};

const EMPTY_FORM: FormState = {
  nombre_interno: '',
  tipo: '',
  proveedor: '',
  provider_template_id: '',
  es_default: false,
  activa: true,
};

export default function WhatsappPlantillasPage() {
  const [rows, setRows] = React.useState<WhatsappPlantillaOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [tipoFilter, setTipoFilter] = React.useState<TipoPlantilla | 'todos'>('todos');
  const [estadoFilter, setEstadoFilter] = React.useState<'activas' | 'inactivas' | 'todas'>('activas');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<WhatsappPlantillaOption | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchWhatsappPlantillas(true);
      setRows(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las plantillas');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleEdit = (row: WhatsappPlantillaOption) => {
    setEditing(row);
    setForm({
      nombre_interno: row.nombre_interno,
      tipo: row.tipo as TipoPlantilla,
      proveedor: row.proveedor,
      provider_template_id: row.provider_template_id,
      es_default: row.es_default,
      activa: row.activa,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    const nombre_interno = form.nombre_interno.trim();
    const proveedor = form.proveedor.trim();
    const provider_template_id = form.provider_template_id.trim();

    if (!nombre_interno) {
      setError('El nombre interno es obligatorio');
      return;
    }
    if (!form.tipo) {
      setError('El tipo es obligatorio');
      return;
    }
    if (!proveedor) {
      setError('El proveedor es obligatorio');
      return;
    }
    if (!provider_template_id) {
      setError('El ID de plantilla del proveedor es obligatorio');
      return;
    }

    const payload: PlantillaAdminPayload = {
      nombre_interno,
      tipo: form.tipo,
      proveedor,
      provider_template_id,
      es_default: form.es_default,
      activa: form.activa,
    };

    try {
      setSaving(true);
      if (editing) {
        await actualizarWhatsappPlantilla(editing.id, payload);
      } else {
        await crearWhatsappPlantilla(payload);
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setSnackbar({
        open: true,
        message: editing ? 'Plantilla actualizada correctamente' : 'Plantilla creada correctamente',
        severity: 'success',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la plantilla');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActiva = async (row: WhatsappPlantillaOption) => {
    try {
      setError(null);
      await actualizarWhatsappPlantilla(row.id, { activa: !row.activa });
      setSnackbar({
        open: true,
        message: row.activa ? 'Plantilla desactivada' : 'Plantilla activada',
        severity: 'success',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la plantilla');
    }
  };

  const filteredRows = React.useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (estadoFilter === 'activas' && !row.activa) return false;
      if (estadoFilter === 'inactivas' && row.activa) return false;
      if (tipoFilter !== 'todos' && row.tipo !== tipoFilter) return false;
      if (!term) return true;
      return [row.nombre_interno, row.tipo, row.proveedor, row.provider_template_id]
        .some((v) => v.toLowerCase().includes(term));
    });
  }, [rows, search, estadoFilter, tipoFilter]);

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
        label: 'Editar plantilla',
        icon: <EditIcon fontSize="small" />,
        onClick: () => handleEdit(contextMenuRow),
      },
      {
        id: 'toggle-activa',
        label: contextMenuRow.activa ? 'Desactivar' : 'Activar',
        onClick: () => void handleToggleActiva(contextMenuRow),
      },
    ];
  }, [contextMenuRow]);

  const contextMenuTriggerColumn = React.useMemo<GridColDef<WhatsappPlantillaOption>>(
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
      renderCell: (params: GridRenderCellParams<WhatsappPlantillaOption>) => (
        <GridContextMenuTrigger onOpen={(event) => openContextMenuForRow(event, params.row)} />
      ),
    }),
    [openContextMenuForRow]
  );

  const baseColumns: GridColDef<WhatsappPlantillaOption>[] = [
    {
      field: 'nombre_interno',
      headerName: 'Nombre interno',
      flex: 1,
      minWidth: 180,
    },
    {
      field: 'tipo',
      headerName: 'Tipo',
      width: 200,
      renderCell: (params) => (
        <Chip size="small" label={params.row.tipo} variant="outlined" />
      ),
    },
    {
      field: 'proveedor',
      headerName: 'Proveedor',
      width: 120,
    },
    {
      field: 'provider_template_id',
      headerName: 'ID en proveedor',
      flex: 1,
      minWidth: 180,
    },
    {
      field: 'es_default',
      headerName: 'Default',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) =>
        params.row.es_default ? (
          <Chip size="small" label="Default" color="primary" variant="filled" />
        ) : null,
    },
    {
      field: 'activa',
      headerName: 'Estado',
      width: 120,
      renderCell: (params) => (
        <Chip
          size="small"
          label={params.row.activa ? 'Activa' : 'Inactiva'}
          color={params.row.activa ? 'success' : 'default'}
          variant={params.row.activa ? 'filled' : 'outlined'}
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Acciones',
      width: 110,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<WhatsappPlantillaOption>) => (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Tooltip title="Editar">
            <IconButton size="small" color="primary" onClick={() => handleEdit(params.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={params.row.activa ? 'Desactivar' : 'Activar'}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={params.row.activa}
                  onChange={() => void handleToggleActiva(params.row)}
                />
              }
              label=""
              sx={{ m: 0 }}
            />
          </Tooltip>
        </Stack>
      ),
    },
  ];

  const columns = React.useMemo<GridColDef<WhatsappPlantillaOption>[]>(
    () => [contextMenuTriggerColumn, ...baseColumns],
    [contextMenuTriggerColumn]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            Plantillas de WhatsApp
          </Typography>
          <Typography variant="body2" color="#4b5563">
            Administra los registros de plantillas por empresa y tipo.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
          Nueva plantilla
        </Button>
      </Stack>

      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
        <TextField
          size="small"
          placeholder="Buscar por nombre, tipo o ID"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ minWidth: 260 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" edge="end" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
        <TextField
          select
          size="small"
          label="Tipo"
          value={tipoFilter}
          onChange={(event) => setTipoFilter(event.target.value as TipoPlantilla | 'todos')}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="todos">Todos los tipos</MenuItem>
          {TIPOS_PLANTILLA.map((t) => (
            <MenuItem key={t} value={t}>{t}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Estado"
          value={estadoFilter}
          onChange={(event) => setEstadoFilter(event.target.value as 'activas' | 'inactivas' | 'todas')}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="activas">Activas</MenuItem>
          <MenuItem value="inactivas">Inactivas</MenuItem>
          <MenuItem value="todas">Todas</MenuItem>
        </TextField>
      </Stack>

      {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}

      <Box
        sx={{
          width: '100%',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 1.5,
          boxShadow: '0px 6px 16px rgba(0,0,0,0.04)',
          '& .MuiDataGrid-root': { border: 'none' },
        }}
      >
        <DataGrid
          rows={filteredRows}
          columns={columns}
          rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
          columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
          loading={loading}
          autoHeight
          density="standard"
          disableRowSelectionOnClick
          getRowId={(row) => row.id}
          columnVisibilityModel={{ menu: true, actions: SHOW_GRID_ACTIONS }}
          {...(rowSlotProps ? { slotProps: { row: rowSlotProps } } : {})}
          sx={standardDataGridSx}
          pageSizeOptions={[10, 25, 50]}
          localeText={{
            ...esES.components.MuiDataGrid.defaultProps.localeText,
            noRowsLabel: loading ? 'Cargando…' : 'Sin plantillas',
          }}
        />
      </Box>

      <GridContextMenu
        actions={contextMenuActions}
        anchorPosition={contextMenuPosition}
        open={Boolean(contextMenuRow && contextMenuPosition)}
        onClose={closeContextMenu}
      />

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Editar plantilla' : 'Nueva plantilla'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            size="small"
            label="Nombre interno"
            value={form.nombre_interno}
            onChange={(event) => setForm((prev) => ({ ...prev, nombre_interno: event.target.value }))}
            required
            autoFocus
          />
          <TextField
            select
            size="small"
            label="Tipo"
            value={form.tipo}
            onChange={(event) => setForm((prev) => ({ ...prev, tipo: event.target.value as TipoPlantilla }))}
            required
          >
            {TIPOS_PLANTILLA.map((t) => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Proveedor"
            value={form.proveedor}
            onChange={(event) => setForm((prev) => ({ ...prev, proveedor: event.target.value }))}
            required
          />
          <TextField
            size="small"
            label="ID de plantilla en proveedor"
            value={form.provider_template_id}
            onChange={(event) => setForm((prev) => ({ ...prev, provider_template_id: event.target.value }))}
            required
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.es_default}
                onChange={(event) => setForm((prev) => ({ ...prev, es_default: event.target.checked }))}
              />
            }
            label="Plantilla default para este tipo"
          />
          {editing ? (
            <FormControlLabel
              control={
                <Switch
                  checked={form.activa}
                  onChange={(event) => setForm((prev) => ({ ...prev, activa: event.target.checked }))}
                />
              }
              label={form.activa ? 'Activa' : 'Inactiva'}
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void handleSave()} variant="contained" disabled={saving}>
            {editing ? 'Guardar cambios' : 'Crear plantilla'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
