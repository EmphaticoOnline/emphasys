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
  InputAdornment,
  IconButton,
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
import ArchiveIcon from '@mui/icons-material/ArchiveOutlined';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import RestoreIcon from '@mui/icons-material/UnarchiveOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  actualizarWhatsappEtiqueta,
  crearWhatsappEtiqueta,
  eliminarWhatsappEtiqueta,
  fetchWhatsappEtiquetas,
  type WhatsappEtiquetaAdmin,
} from '../../services/whatsappEtiquetasService';
import { GridContextMenu } from '../../components/grids/GridContextMenu';
import { GridContextMenuTrigger } from '../../components/grids/GridContextMenuTrigger';
import type { GridContextMenuAction } from '../../components/grids/GridContextMenu';
import { SHOW_GRID_ACTIONS } from '../../components/grids/gridUxFlags';
import { STANDARD_DATA_GRID_HEADER_HEIGHT, STANDARD_DATA_GRID_ROW_HEIGHT, standardDataGridSx } from '../../components/grids/standardDataGridSx';
import { useGridContextMenu } from '../../hooks/useGridContextMenu';
import { ConfigPageFrame, ConfigPageHeader } from '../../components/configuracion/configVisual';
import { ControlLabel, PatternDialogHeader, Section, actionIconSx, dialogContentSx, dialogPaperSx, dialogTitleSx, editorialDataGridSx, fieldsOnIvorySx, formWellSx, innerDestructiveButtonSx, innerOutlinedButtonSx, panelBarSx, rowIconSx, wellSx } from '../../components/transporte/transporteVisual';

type FormState = {
  nombre: string;
  color: string;
  activo: boolean;
};

const EMPTY_FORM: FormState = {
  nombre: '',
  color: '#25D366',
  activo: true,
};

const COLOR_REGEX = /^#([0-9A-Fa-f]{6})$/;

export default function WhatsappEtiquetasPage() {
  const [rows, setRows] = React.useState<WhatsappEtiquetaAdmin[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [estadoFilter, setEstadoFilter] = React.useState<'activas' | 'archivadas' | 'todas'>('activas');
  const [usoFilter, setUsoFilter] = React.useState<'todas' | 'con_uso' | 'sin_uso'>('todas');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<WhatsappEtiquetaAdmin | null>(null);
  const [deleteDialog, setDeleteDialog] = React.useState<{ row: WhatsappEtiquetaAdmin; blocked: boolean } | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const includeInactive = estadoFilter !== 'activas';

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchWhatsappEtiquetas(includeInactive);
      setRows(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las etiquetas');
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleEdit = (row: WhatsappEtiquetaAdmin) => {
    setEditing(row);
    setForm({
      nombre: row.nombre,
      color: row.color,
      activo: row.activo,
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
    const nombre = form.nombre.trim();
    const color = form.color.trim();

    if (!nombre) {
      setError('El nombre es obligatorio');
      return;
    }

    if (!COLOR_REGEX.test(color)) {
      setError('El color debe usar formato hexadecimal #RRGGBB');
      return;
    }

    try {
      setSaving(true);
      if (editing) {
        await actualizarWhatsappEtiqueta(editing.id, {
          nombre,
          color,
          activo: form.activo,
        });
      } else {
        await crearWhatsappEtiqueta({ nombre, color });
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setSnackbar({ open: true, message: editing ? 'Etiqueta actualizada correctamente' : 'Etiqueta creada correctamente', severity: 'success' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la etiqueta');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActivo = async (row: WhatsappEtiquetaAdmin) => {
    try {
      setError(null);
      await actualizarWhatsappEtiqueta(row.id, { activo: !row.activo });
      setSnackbar({
        open: true,
        message: row.activo ? 'Etiqueta archivada correctamente' : 'Etiqueta reactivada correctamente',
        severity: 'success',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la etiqueta');
    }
  };

  const filteredRows = React.useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (estadoFilter === 'archivadas' && row.activo) return false;
      if (estadoFilter === 'todas') {
        // no-op
      } else if (estadoFilter === 'activas' && !row.activo) {
        return false;
      }

      const usoCount = row.uso_count ?? 0;
      if (usoFilter === 'con_uso' && usoCount <= 0) return false;
      if (usoFilter === 'sin_uso' && usoCount > 0) return false;

      if (!term) return true;

      return [row.nombre, row.color, row.activo ? 'activa' : 'archivada']
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [estadoFilter, rows, search, usoFilter]);

  const handleRequestDelete = (row: WhatsappEtiquetaAdmin) => {
    setDeleteDialog({ row, blocked: (row.uso_count ?? 0) > 0 });
  };

  const handleCloseDeleteDialog = () => {
    if (deleting) return;
    setDeleteDialog(null);
  };

  const handleDelete = async () => {
    if (!deleteDialog || deleteDialog.blocked) return;

    try {
      setDeleting(true);
      await eliminarWhatsappEtiqueta(deleteDialog.row.id);
      setDeleteDialog(null);
      setSnackbar({ open: true, message: 'Etiqueta eliminada correctamente', severity: 'success' });
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar la etiqueta';
      setDeleteDialog(null);
      setSnackbar({ open: true, message, severity: 'error' });
      await load();
    } finally {
      setDeleting(false);
    }
  };

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
        label: 'Editar etiqueta',
        icon: <EditIcon fontSize="small" />,
        onClick: () => handleEdit(contextMenuRow),
      },
      {
        id: 'toggle-activo',
        label: contextMenuRow.activo ? 'Archivar' : 'Reactivar',
        icon: contextMenuRow.activo ? <ArchiveIcon fontSize="small" /> : <RestoreIcon fontSize="small" />,
        onClick: () => void handleToggleActivo(contextMenuRow),
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
        disabled: (contextMenuRow.uso_count ?? 0) > 0,
        onClick: () => handleRequestDelete(contextMenuRow),
      },
    ];
  }, [contextMenuRow]);

  const contextMenuTriggerColumn = React.useMemo<GridColDef<WhatsappEtiquetaAdmin>>(
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
      renderCell: (params: GridRenderCellParams<WhatsappEtiquetaAdmin>) => (
        <GridContextMenuTrigger onOpen={(event) => openContextMenuForRow(event, params.row)} />
      ),
    }),
    [openContextMenuForRow]
  );

  const baseColumns: GridColDef<WhatsappEtiquetaAdmin>[] = [
    {
      field: 'nombre',
      headerName: 'Nombre',
      flex: 1,
      minWidth: 180,
      renderCell: (params) => (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: params.row.color,
              flexShrink: 0,
            }}
          />
          <Typography variant="body2" fontWeight={700} noWrap sx={(theme) => ({ color: theme.emphasys.content.foreground })}>
            {params.row.nombre}
          </Typography>
        </Stack>
      ),
    },
    {
      field: 'color',
      headerName: 'Color',
      width: 130,
      renderCell: (params) => <Typography variant="body2">{params.row.color}</Typography>,
    },
    {
      field: 'uso_count',
      headerName: 'En uso',
      width: 110,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => <Typography variant="body2">{params.row.uso_count ?? 0}</Typography>,
    },
    {
      field: 'activo',
      headerName: 'Estado',
      width: 130,
      renderCell: (params) => (
        <Tooltip title={params.row.activo ? 'Archivar' : 'Reactivar'}>
          <Switch size="small" checked={Boolean(params.row.activo)} onChange={() => void handleToggleActivo(params.row)} />
        </Tooltip>
      ),
    },
    {
      field: 'actions',
      headerName: 'Acciones',
      width: 140,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<WhatsappEtiquetaAdmin>) => (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Tooltip title="Editar">
            <IconButton size="small" sx={rowIconSx} onClick={() => handleEdit(params.row)}>
              <EditIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={(params.row.uso_count ?? 0) > 0 ? 'No se puede eliminar mientras tenga asignaciones' : 'Eliminar'}>
            <span>
              <IconButton
                size="small"
                sx={rowIconSx}
                onClick={() => handleRequestDelete(params.row)}
              >
                <DeleteIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  const columns = React.useMemo<GridColDef<WhatsappEtiquetaAdmin>[]>(() => [contextMenuTriggerColumn, ...baseColumns], [contextMenuTriggerColumn]);

  return (
    <ConfigPageFrame>
      <ConfigPageHeader title="Etiquetas de WhatsApp" description="Administra el catálogo global de etiquetas usadas en conversaciones y leads." actions={<Tooltip title="Nueva etiqueta"><IconButton size="small" sx={actionIconSx} onClick={handleCreate}><AddIcon fontSize="small" /></IconButton></Tooltip>} />

      {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}

      <Box sx={wellSx}>
      <Box sx={(theme) => ({ ...(panelBarSx as (t: typeof theme) => object)(theme), ...fieldsOnIvorySx(theme), py: 1, flexWrap: 'wrap' })}>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ flex: 1, minWidth: 280 }}>
          <TextField
            size="small"
            placeholder="Buscar por nombre o color"
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
            label="Estado"
            value={estadoFilter}
            onChange={(event) => setEstadoFilter(event.target.value as 'activas' | 'archivadas' | 'todas')}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="activas">Activas</MenuItem>
            <MenuItem value="archivadas">Archivadas</MenuItem>
            <MenuItem value="todas">Todas</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Uso"
            value={usoFilter}
            onChange={(event) => setUsoFilter(event.target.value as 'todas' | 'con_uso' | 'sin_uso')}
            sx={{ minWidth: 170 }}
          >
            <MenuItem value="todas">Todas</MenuItem>
            <MenuItem value="con_uso">Con asignaciones</MenuItem>
            <MenuItem value="sin_uso">Sin asignaciones</MenuItem>
          </TextField>
        </Stack>
        <Typography variant="caption" sx={(theme) => ({ color: theme.emphasys.content.muted, maxWidth: 420 })}>
          Las archivadas dejan de aparecer al asignarlas en Leads. Solo puedes eliminar físicamente las que no tienen asignaciones.
        </Typography>
      </Box>
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
          sx={[standardDataGridSx, editorialDataGridSx]}
          pageSizeOptions={[10, 25, 50]}
          localeText={{
            ...esES.components.MuiDataGrid.defaultProps.localeText,
            noRowsLabel: loading ? 'Cargando…' : 'Sin etiquetas',
          }}
        />
      </Box>

      <GridContextMenu
        actions={contextMenuActions}
        anchorPosition={contextMenuPosition}
        open={Boolean(contextMenuRow && contextMenuPosition)}
        onClose={closeContextMenu}
      />

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle component="div" sx={dialogTitleSx}>
          <PatternDialogHeader
            eyebrow="Etiquetas de WhatsApp"
            title={editing ? 'Editar etiqueta' : 'Nueva etiqueta'}
            onCancel={handleCloseDialog}
            cancelDisabled={saving}
            onSave={() => void handleSave()}
            saving={saving}
            saveLabel={editing ? 'Guardar cambios' : 'Crear etiqueta'}
            extra={editing ? (
              <FormControlLabel
                sx={{ mr: 1 }}
                control={
                  <Switch
                    size="small"
                    checked={form.activo}
                    onChange={(event) => setForm((prev) => ({ ...prev, activo: event.target.checked }))}
                  />
                }
                label={<ControlLabel>{form.activo ? 'Etiqueta activa' : 'Etiqueta archivada'}</ControlLabel>}
              />
            ) : undefined}
          />
        </DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box sx={(theme) => ({ ...formWellSx(theme), ...fieldsOnIvorySx(theme) })}>
          <Section title="Etiqueta" inset>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            size="small"
            label="Nombre"
            value={form.nombre}
            onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
            required
            autoFocus
          />
          <TextField
            size="small"
            label="Color"
            type="color"
            value={form.color}
            onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={{ maxWidth: 160 }}
          />
          </Stack>
          </Section>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteDialog)} onClose={handleCloseDeleteDialog} fullWidth maxWidth="xs" PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle component="div" sx={dialogTitleSx}>
          <ConfigPageHeader eyebrow="Etiquetas de WhatsApp" title={deleteDialog?.blocked ? 'No se puede eliminar la etiqueta' : 'Eliminar etiqueta'} />
        </DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box sx={formWellSx}>
          <Typography variant="body2" sx={(theme) => ({ px: 0.5, color: theme.emphasys.content.secondary })}>
            {deleteDialog?.blocked
              ? `La etiqueta "${deleteDialog.row.nombre}" está asignada a ${deleteDialog.row.uso_count ?? 0} conversación${(deleteDialog.row.uso_count ?? 0) === 1 ? '' : 'es'}. Para conservar el historial, primero quita esas asignaciones o archiva la etiqueta.`
              : `La etiqueta "${deleteDialog?.row.nombre}" no tiene asignaciones y se eliminará de forma permanente. Esta acción no se puede deshacer.`}
          </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 1.5, md: 2.25 }, pb: 2 }}>
          <Button onClick={handleCloseDeleteDialog} disabled={deleting} variant="outlined" sx={innerOutlinedButtonSx}>
            {deleteDialog?.blocked ? 'Entendido' : 'Cancelar'}
          </Button>
          {!deleteDialog?.blocked ? (
            <Button onClick={() => void handleDelete()} variant="contained" disableElevation sx={innerDestructiveButtonSx} disabled={deleting}>
              Eliminar
            </Button>
          ) : null}
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
    </ConfigPageFrame>
  );
}
