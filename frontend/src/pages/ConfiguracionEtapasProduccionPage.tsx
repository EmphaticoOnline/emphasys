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
  Paper,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Toolbar,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import {
  createEtapaProduccion,
  deleteEtapaProduccion,
  listEtapasProduccion,
  updateEtapaProduccion,
  type EtapaProduccion,
} from '../services/produccionService';
import { GridContextMenu } from '../components/grids/GridContextMenu';
import { GridContextMenuTrigger } from '../components/grids/GridContextMenuTrigger';
import type { GridContextMenuAction } from '../components/grids/GridContextMenu';
import { SHOW_GRID_ACTIONS } from '../components/grids/gridUxFlags';
import { STANDARD_DATA_GRID_HEADER_HEIGHT, standardDataGridSx } from '../components/grids/standardDataGridSx';
import { useGridContextMenu } from '../hooks/useGridContextMenu';
import { ConfigPageFrame, ConfigPageHeader } from '../components/configuracion/configVisual';
import { catalogoSearchSx } from '../components/catalogo/catalogoSurfaces';
import { ControlLabel, PanelBar, PatternDialogHeader, Pill, Section, actionIconSx, dialogContentSx, dialogPaperSx, dialogTitleSx, editorialDataGridSx, fieldsOnIvorySx, formWellSx, innerDestructiveButtonSx, innerOutlinedButtonSx, innerPrimaryButtonSx, rowIconSx, wellSx } from '../components/transporte/transporteVisual';

type FormState = {
  nombre: string;
  orden: string;
  color: string;
  activo: boolean;
};

const EMPTY_FORM: FormState = {
  nombre: '',
  orden: '1',
  color: '#1D4ED8',
  activo: true,
};

const COLOR_REGEX = /^#([0-9A-Fa-f]{6})$/;

function sortEtapas(rows: EtapaProduccion[]) {
  return [...rows].sort((left, right) => {
    if (left.orden !== right.orden) {
      return left.orden - right.orden;
    }

    return left.id - right.id;
  });
}

export default function ConfiguracionEtapasProduccionPage() {
  const [rows, setRows] = React.useState<EtapaProduccion[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<EtapaProduccion | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [deleteDialog, setDeleteDialog] = React.useState<{ row: EtapaProduccion; blockedMessage: string | null } | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await listEtapasProduccion(true);
      setRows(sortEtapas(data));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar las etapas';
      setSnackbar({ open: true, message, severity: 'error' });
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
      [row.orden, row.nombre, row.color, row.activo ? 'activa' : 'inactiva']
        .map((value) => String(value ?? '').toLowerCase())
        .some((value) => value.includes(term))
    ));
  }, [rows, search]);

  const openCreateDialog = React.useCallback(() => {
    const nextOrden = rows.length > 0 ? Math.max(...rows.map((row) => Number(row.orden) || 0)) + 1 : 1;
    setEditing(null);
    setForm({
      nombre: '',
      orden: String(nextOrden),
      color: '#1D4ED8',
      activo: true,
    });
    setDialogOpen(true);
  }, [rows]);

  const closeDialog = React.useCallback(() => {
    if (saving) {
      return;
    }

    setDialogOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }, [saving]);

  const handleEdit = React.useCallback((row: EtapaProduccion) => {
    setEditing(row);
    setForm({
      nombre: row.nombre,
      orden: String(row.orden),
      color: row.color || '#1D4ED8',
      activo: row.activo,
    });
    setDialogOpen(true);
  }, []);

  const handleSave = React.useCallback(async () => {
    const nombre = form.nombre.trim();
    const orden = Number(form.orden);
    const color = form.color.trim().toUpperCase();

    if (!nombre) {
      setSnackbar({ open: true, message: 'El nombre es obligatorio', severity: 'warning' });
      return;
    }

    if (!Number.isInteger(orden) || orden <= 0) {
      setSnackbar({ open: true, message: 'El orden debe ser mayor a cero', severity: 'warning' });
      return;
    }

    if (color && !COLOR_REGEX.test(color)) {
      setSnackbar({ open: true, message: 'El color debe usar formato #RRGGBB', severity: 'warning' });
      return;
    }

    try {
      setSaving(true);
      if (editing) {
        const updated = await updateEtapaProduccion(editing.id, {
          nombre,
          orden,
          color: color || null,
          activo: form.activo,
        });
        setRows((prev) => sortEtapas(prev.map((row) => (row.id === updated.id ? updated : row))));
      } else {
        const created = await createEtapaProduccion({
          nombre,
          orden,
          color: color || null,
          activo: form.activo,
        });
        setRows((prev) => sortEtapas([...prev, created]));
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setSnackbar({
        open: true,
        message: editing ? 'Etapa actualizada correctamente' : 'Etapa creada correctamente',
        severity: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar la etapa';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  }, [editing, form]);

  const handleRequestDelete = React.useCallback((row: EtapaProduccion) => {
    setDeleteDialog({ row, blockedMessage: null });
  }, []);

  const handleCloseDeleteDialog = React.useCallback(() => {
    if (deleting) {
      return;
    }

    setDeleteDialog(null);
  }, [deleting]);

  const handleDelete = React.useCallback(async () => {
    if (!deleteDialog) {
      return;
    }

    try {
      setDeleting(true);
      await deleteEtapaProduccion(deleteDialog.row.id);
      setRows((prev) => prev.filter((row) => row.id !== deleteDialog.row.id));
      setDeleteDialog(null);
      setSnackbar({ open: true, message: 'Etapa eliminada correctamente', severity: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar la etapa';
      setDeleteDialog((prev) => (prev ? { ...prev, blockedMessage: message } : prev));
    } finally {
      setDeleting(false);
    }
  }, [deleteDialog]);

  const handleDeactivateFromDeleteDialog = React.useCallback(async () => {
    if (!deleteDialog || !deleteDialog.row.activo) {
      setDeleteDialog(null);
      return;
    }

    try {
      setDeleting(true);
      const updated = await updateEtapaProduccion(deleteDialog.row.id, { activo: false });
      setRows((prev) => sortEtapas(prev.map((row) => (row.id === updated.id ? updated : row))));
      setDeleteDialog(null);
      setSnackbar({ open: true, message: 'Etapa desactivada correctamente', severity: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo desactivar la etapa';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setDeleting(false);
    }
  }, [deleteDialog]);

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
        label: 'Editar etapa',
        icon: <EditIcon fontSize="small" />,
        onClick: () => handleEdit(contextMenuRow),
      },
      {
        id: 'separator-primary',
        type: 'separator',
      },
      {
        id: 'eliminar',
        label: 'Eliminar',
        icon: <DeleteIcon fontSize="small" />,
        destructive: true,
        onClick: () => handleRequestDelete(contextMenuRow),
      },
    ];
  }, [contextMenuRow, handleEdit, handleRequestDelete]);

  const contextMenuTriggerColumn = React.useMemo<GridColDef<EtapaProduccion>>(
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
      headerClassName: 'finanzas-header',
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams<EtapaProduccion>) => (
        <GridContextMenuTrigger onOpen={(event) => openContextMenuForRow(event, params.row)} />
      ),
    }),
    [openContextMenuForRow]
  );

  const baseColumns = React.useMemo<GridColDef<EtapaProduccion>[]>(() => [
    {
      field: 'orden',
      headerName: 'Orden',
      headerClassName: 'finanzas-header',
      width: 110,
      type: 'number',
    },
    {
      field: 'nombre',
      headerName: 'Nombre',
      headerClassName: 'finanzas-header',
      flex: 1,
      minWidth: 220,
      renderCell: (params: GridRenderCellParams<EtapaProduccion, string>) => (
        <Typography variant="body2" fontWeight={600} noWrap title={params.value || ''}>
          {params.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'color',
      headerName: 'Color',
      headerClassName: 'finanzas-header',
      minWidth: 180,
      flex: 0.7,
      renderCell: (params: GridRenderCellParams<EtapaProduccion, string | null>) => (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              border: (theme) => `1px solid ${theme.emphasys.content.border}`,
              backgroundColor: params.row.color || '#E5E7EB',
              flexShrink: 0,
            }}
          />
        </Stack>
      ),
    },
    {
      field: 'activo',
      headerName: 'Activa',
      headerClassName: 'finanzas-header',
      width: 120,
      renderCell: (params: GridRenderCellParams<EtapaProduccion, boolean>) => (
        <Pill active={params.row.activo} label={params.row.activo ? 'Activa' : 'Inactiva'} />
      ),
    },
    {
      field: 'acciones',
      headerName: 'Acciones',
      headerClassName: 'finanzas-header',
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<EtapaProduccion>) => (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Tooltip title="Editar">
            <IconButton size="small" sx={rowIconSx} onClick={() => handleEdit(params.row)}>
              <EditIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar">
            <IconButton size="small" sx={rowIconSx} onClick={() => handleRequestDelete(params.row)}>
              <DeleteIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ], [handleEdit, handleRequestDelete]);

  const columns = React.useMemo<GridColDef<EtapaProduccion>[]>(() => [contextMenuTriggerColumn, ...baseColumns], [baseColumns, contextMenuTriggerColumn]);

  return (
    <ConfigPageFrame>
      <ConfigPageHeader title="Etapas de producción" description="Personaliza las etapas operativas que usa Producción para la empresa activa." actions={<Stack direction="row" spacing={0.5}><Tooltip title="Recargar"><span><IconButton size="small" sx={actionIconSx} onClick={() => void load()} disabled={loading || saving || deleting}><RefreshIcon fontSize="small" /></IconButton></span></Tooltip><Tooltip title="Nueva etapa"><IconButton size="small" sx={actionIconSx} onClick={openCreateDialog}><AddIcon fontSize="small" /></IconButton></Tooltip></Stack>} />

      <Box sx={wellSx}>
      <PanelBar title={
        <Box sx={{ minWidth: { sm: 320 } }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Buscar por orden, nombre, color o estado..."
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
          {filteredRows.length} {filteredRows.length === 1 ? 'etapa' : 'etapas'}
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
          loading={loading || saving || deleting}
          disableRowSelectionOnClick
          columnVisibilityModel={{ menu: true, acciones: SHOW_GRID_ACTIONS }}
          {...(rowSlotProps ? { slotProps: { row: rowSlotProps } } : {})}
          hideFooterPagination
          hideFooterSelectedRowCount
          localeText={{
            ...esES.components.MuiDataGrid.defaultProps.localeText,
            noRowsLabel: loading ? 'Cargando etapas...' : 'No hay etapas configuradas.',
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

      <GridContextMenu
        actions={contextMenuActions}
        anchorPosition={contextMenuPosition}
        open={Boolean(contextMenuRow && contextMenuPosition)}
        onClose={closeContextMenu}
      />

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle component="div" sx={dialogTitleSx}>
          <PatternDialogHeader
            eyebrow="Etapas de producción"
            title={editing ? 'Editar etapa de producción' : 'Nueva etapa de producción'}
            onCancel={closeDialog}
            cancelDisabled={saving}
            onSave={() => void handleSave()}
            saving={saving}
            saveLabel={editing ? 'Guardar cambios' : 'Guardar'}
            extra={
              <FormControlLabel
                sx={{ mr: 1 }}
                control={(
                  <Switch
                    size="small"
                    checked={form.activo}
                    onChange={(event) => setForm((prev) => ({ ...prev, activo: event.target.checked }))}
                  />
                )}
                label={<ControlLabel>Activa</ControlLabel>}
              />
            }
          />
        </DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box sx={(theme) => ({ ...formWellSx(theme), ...fieldsOnIvorySx(theme) })}>
          <Section title="Etapa" inset>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            label="Nombre"
            value={form.nombre}
            onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
            autoFocus
          />
          <TextField
            label="Orden"
            type="number"
            value={form.orden}
            onChange={(event) => setForm((prev) => ({ ...prev, orden: event.target.value }))}
            inputProps={{ min: 1 }}
          />
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              label="Selector"
              type="color"
              value={COLOR_REGEX.test(form.color) ? form.color : '#1D4ED8'}
              onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value.toUpperCase() }))}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 120 }}
            />
            <TextField
              label="Color"
              value={form.color}
              onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value.toUpperCase() }))}
              placeholder="#1D4ED8"
              fullWidth
            />
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: (theme) => `1px solid ${theme.emphasys.content.border}`,
                backgroundColor: COLOR_REGEX.test(form.color) ? form.color : '#E5E7EB',
                flexShrink: 0,
              }}
            />
          </Stack>
          </Stack>
          </Section>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteDialog)} onClose={handleCloseDeleteDialog} maxWidth="xs" fullWidth PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle component="div" sx={dialogTitleSx}>
          <ConfigPageHeader eyebrow="Etapas de producción" title={deleteDialog?.blockedMessage ? 'No se puede eliminar la etapa' : 'Eliminar etapa'} />
        </DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box sx={formWellSx}>
          <Typography variant="body2" sx={(theme) => ({ px: 0.5, color: theme.emphasys.content.secondary })}>
            {deleteDialog?.blockedMessage
              ? deleteDialog.blockedMessage
              : `La etapa "${deleteDialog?.row.nombre}" se eliminará de forma permanente si aún no ha sido usada en Producción.`}
          </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 1.5, md: 2.25 }, pb: 2 }}>
          <Button onClick={handleCloseDeleteDialog} disabled={deleting} variant="outlined" sx={innerOutlinedButtonSx}>
            {deleteDialog?.blockedMessage ? 'Cancelar' : 'Cerrar'}
          </Button>
          {deleteDialog?.blockedMessage && deleteDialog.row.activo ? (
            <Button onClick={() => void handleDeactivateFromDeleteDialog()} variant="contained" disableElevation sx={innerPrimaryButtonSx} disabled={deleting}>
              Desactivar
            </Button>
          ) : null}
          {!deleteDialog?.blockedMessage ? (
            <Button onClick={() => void handleDelete()} variant="contained" disableElevation sx={innerDestructiveButtonSx} disabled={deleting}>
              Eliminar
            </Button>
          ) : null}
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
    </ConfigPageFrame>
  );
}
