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
  Select,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
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
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ImageIcon from '@mui/icons-material/Image';
import CloseIcon from '@mui/icons-material/Close';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  actualizarWhatsappPlantilla,
  crearWhatsappPlantilla,
  fetchWhatsappPlantillas,
  type OrigenParametro,
  type ParametroPlantilla,
  type PlantillaAdminPayload,
  type WhatsappPlantillaOption,
} from '../../services/whatsappPlantillasService';
import { uploadArchivo } from '../../services/uploadsService';
import { GridContextMenu } from '../../components/grids/GridContextMenu';
import { GridContextMenuTrigger } from '../../components/grids/GridContextMenuTrigger';
import type { GridContextMenuAction } from '../../components/grids/GridContextMenu';
import { SHOW_GRID_ACTIONS } from '../../components/grids/gridUxFlags';
import { STANDARD_DATA_GRID_HEADER_HEIGHT, STANDARD_DATA_GRID_ROW_HEIGHT, standardDataGridSx } from '../../components/grids/standardDataGridSx';
import { useGridContextMenu } from '../../hooks/useGridContextMenu';
import { ConfigPageHeader } from '../../components/configuracion/configVisual';
import { ControlLabel, PatternDialogHeader, Pill, Section, actionIconSx, dialogContentSx, dialogPaperSx, dialogTitleSx, editorialDataGridSx, editorialTableSx, fieldsOnIvorySx, formWellSx, panelBarSx, rowIconSx, wellSx } from '../../components/transporte/transporteVisual';

const TIPOS_PLANTILLA = [
  'envio_cotizacion',
  'envio_orden_servicio',
  'envio_cfdi',
  'envio_nota_venta',
  'reactivacion',
  'seguimiento',
] as const;

type TipoPlantilla = typeof TIPOS_PLANTILLA[number];

const ORIGENES: { value: OrigenParametro; label: string }[] = [
  { value: 'manual', label: 'Manual (el usuario lo ingresa)' },
  { value: 'contacto.nombre', label: 'Nombre del contacto' },
  { value: 'contacto.telefono', label: 'Teléfono del contacto' },
  { value: 'contacto.empresa', label: 'Empresa del contacto' },
  { value: 'contacto.vendedor', label: 'Vendedor asignado al contacto' },
  { value: 'meta.formulario', label: 'Formulario de Meta' },
];

type FormState = {
  nombre_interno: string;
  tipo: TipoPlantilla | '';
  proveedor: string;
  provider_template_id: string;
  es_default: boolean;
  activa: boolean;
  contenido: string;
  configuracion_parametros: ParametroPlantilla[];
  imagen_url: string | null;
};

const EMPTY_FORM: FormState = {
  nombre_interno: '',
  tipo: '',
  proveedor: '',
  provider_template_id: '',
  es_default: false,
  activa: true,
  contenido: '',
  configuracion_parametros: [],
  imagen_url: null,
};

function extractVariableIndices(contenido: string): number[] {
  const matches = contenido.match(/\{\{(\d+)\}\}/g) ?? [];
  const indices = [...new Set(matches.map((m) => Number(m.replace(/\{\{|\}\}/g, ''))))];
  indices.sort((a, b) => a - b);
  return indices.filter((n) => n > 0);
}

function syncParametros(
  current: ParametroPlantilla[],
  indices: number[]
): ParametroPlantilla[] {
  const byVar = new Map(current.map((p) => [p.variable, p]));
  return indices.map((v) =>
    byVar.get(v) ?? { variable: v, label: `Variable ${v}`, origen: 'manual' as OrigenParametro }
  );
}

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
  const [imageViewerOpen, setImageViewerOpen] = React.useState(false);
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
    const indices = extractVariableIndices(row.contenido ?? '');
    const configActual = Array.isArray(row.configuracion_parametros) ? row.configuracion_parametros : [];
    setForm({
      nombre_interno: row.nombre_interno,
      tipo: row.tipo as TipoPlantilla,
      proveedor: row.proveedor,
      provider_template_id: row.provider_template_id,
      es_default: row.es_default,
      activa: row.activa,
      contenido: row.contenido ?? '',
      configuracion_parametros: syncParametros(configActual, indices),
      imagen_url: row.imagen_url ?? null,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleContenidoChange = (value: string) => {
    const indices = extractVariableIndices(value);
    setForm((prev) => ({
      ...prev,
      contenido: value,
      configuracion_parametros: syncParametros(prev.configuracion_parametros, indices),
    }));
  };

  const handleParamChange = (variable: number, field: 'label' | 'origen', value: string) => {
    setForm((prev) => ({
      ...prev,
      configuracion_parametros: prev.configuracion_parametros.map((p) =>
        p.variable === variable ? { ...p, [field]: value } : p
      ),
    }));
  };

  const handleImagenChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Selecciona un archivo de imagen'); return; }
    try {
      setSaving(true);
      const uploaded = await uploadArchivo(file);
      setForm((prev) => ({ ...prev, imagen_url: uploaded.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la imagen');
    } finally { setSaving(false); }
  };

  const handleSave = async () => {
    const nombre_interno = form.nombre_interno.trim();
    const proveedor = form.proveedor.trim();
    const provider_template_id = form.provider_template_id.trim();

    if (!nombre_interno) { setError('El nombre interno es obligatorio'); return; }
    if (!form.tipo) { setError('El tipo es obligatorio'); return; }
    if (!proveedor) { setError('El proveedor es obligatorio'); return; }
    if (!provider_template_id) { setError('El ID de plantilla del proveedor es obligatorio'); return; }

    const payload: PlantillaAdminPayload = {
      nombre_interno,
      tipo: form.tipo,
      proveedor,
      provider_template_id,
      es_default: form.es_default,
      activa: form.activa,
      contenido: form.contenido.trim() || null,
      configuracion_parametros: form.configuracion_parametros.length > 0 ? form.configuracion_parametros : null,
      imagen_url: form.imagen_url,
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
    { field: 'nombre_interno', headerName: 'Nombre interno', flex: 1, minWidth: 180 },
    {
      field: 'tipo',
      headerName: 'Tipo',
      width: 200,
      renderCell: (params) => <Pill active label={params.row.tipo} />,
    },
    { field: 'proveedor', headerName: 'Proveedor', width: 120 },
    { field: 'provider_template_id', headerName: 'ID en proveedor', flex: 1, minWidth: 180 },
    {
      field: 'es_default',
      headerName: 'Default',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) =>
        params.row.es_default ? <Pill active label="Default" /> : null,
    },
    {
      field: 'activa',
      headerName: 'Estado',
      width: 120,
      renderCell: (params) => (
        <Tooltip title={params.row.activa ? 'Desactivar' : 'Activar'}>
          <Switch size="small" checked={params.row.activa} onChange={() => void handleToggleActiva(params.row)} />
        </Tooltip>
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
            <IconButton size="small" sx={rowIconSx} onClick={() => handleEdit(params.row)}>
              <EditIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  const columns = React.useMemo<GridColDef<WhatsappPlantillaOption>[]>(
    () => [contextMenuTriggerColumn, ...baseColumns],
    [contextMenuTriggerColumn]
  );

  const detectedIndices = extractVariableIndices(form.contenido);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <ConfigPageHeader
        title="Plantillas de WhatsApp"
        description="Administra los registros de plantillas por empresa y tipo."
        actions={<Tooltip title="Nueva plantilla"><IconButton size="small" sx={actionIconSx} onClick={handleCreate}><AddIcon fontSize="small" /></IconButton></Tooltip>}
      />

      {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}

      <Box sx={wellSx}>
      <Box sx={(theme) => ({ ...(panelBarSx as (t: typeof theme) => object)(theme), ...fieldsOnIvorySx(theme), py: 1, flexWrap: 'wrap' })}>
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
      <Typography sx={(theme) => ({ fontSize: 12, fontWeight: 600, color: theme.emphasys.content.muted })}>
        {filteredRows.length} {filteredRows.length === 1 ? 'plantilla' : 'plantillas'}
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

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle component="div" sx={dialogTitleSx}>
          <PatternDialogHeader
            eyebrow="Plantillas de WhatsApp"
            title={editing ? 'Editar plantilla' : 'Nueva plantilla'}
            onCancel={handleCloseDialog}
            cancelDisabled={saving}
            onSave={() => void handleSave()}
            saving={saving}
            saveLabel={editing ? 'Guardar cambios' : 'Crear plantilla'}
            extra={editing ? (
              <FormControlLabel
                sx={{ mr: 1 }}
                control={
                  <Switch
                    size="small"
                    checked={form.activa}
                    onChange={(event) => setForm((prev) => ({ ...prev, activa: event.target.checked }))}
                  />
                }
                label={<ControlLabel>{form.activa ? 'Activa' : 'Inactiva'}</ControlLabel>}
              />
            ) : undefined}
          />
        </DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box sx={(theme) => ({ ...formWellSx(theme), ...fieldsOnIvorySx(theme) })}>
          <Section title="Plantilla" inset>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
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

          </Stack>
          </Section>
          <Section title="Imagen predeterminada (opcional)" inset>
          <Box>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              {form.imagen_url ? (
                <Box
                  component="img"
                  src={form.imagen_url}
                  alt="Vista previa de la plantilla"
                  onClick={() => setImageViewerOpen(true)}
                  sx={{
                    width: 112,
                    height: 84,
                    objectFit: 'contain',
                    borderRadius: 1,
                    border: (theme) => `1px solid ${theme.emphasys.content.border}`,
                    backgroundColor: (theme) => theme.emphasys.content.card,
                    cursor: 'pointer',
                    transition: 'box-shadow 0.2s ease',
                    '&:hover': { boxShadow: 2 },
                  }}
                />
              ) : <ImageIcon sx={(theme) => ({ fontSize: 48, color: theme.emphasys.content.muted })} />}
              <Tooltip title="Reemplazar imagen">
                <IconButton component="label" sx={rowIconSx} disabled={saving} aria-label="Reemplazar imagen">
                  <EditOutlinedIcon sx={{ fontSize: 17 }} />
                  <input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImagenChange} />
                </IconButton>
              </Tooltip>
              {form.imagen_url ? (
                <Tooltip title="Eliminar imagen">
                  <IconButton sx={rowIconSx} disabled={saving} onClick={() => setForm((prev) => ({ ...prev, imagen_url: null }))} aria-label="Eliminar imagen">
                    <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Stack>
          </Box>
          </Section>
          <Section title="Contenido" inset>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            size="small"
            label="ID de plantilla en proveedor"
            value={form.provider_template_id}
            onChange={(event) => setForm((prev) => ({ ...prev, provider_template_id: event.target.value }))}
            required
          />

          <TextField
            size="small"
            label="Contenido (opcional)"
            value={form.contenido}
            onChange={(event) => handleContenidoChange(event.target.value)}
            multiline
            minRows={3}
            maxRows={8}
            placeholder={'Hola {{1}}, tu cotización {{2}} está lista.'}
            helperText="Usa {{1}}, {{2}}, etc. para definir variables. Detectarán automáticamente los parámetros de abajo."
          />

          </Stack>
          </Section>

          {detectedIndices.length > 0 && (
            <Section title="Configuración de parámetros" inset>
              <Box
                sx={(theme) => ({
                  border: `1px solid ${theme.emphasys.content.border}`,
                  borderRadius: 1.5,
                  overflow: 'hidden',
                })}
              >
                <Table size="small" sx={editorialTableSx}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 80 }}>Variable</TableCell>
                      <TableCell>Etiqueta</TableCell>
                      <TableCell sx={{ width: 260 }}>Origen</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {form.configuracion_parametros.map((param) => (
                      <TableRow key={param.variable}>
                        <TableCell>
                          <Chip size="small" label={`{{${param.variable}}}`} variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            value={param.label}
                            onChange={(e) => handleParamChange(param.variable, 'label', e.target.value)}
                            placeholder={`Etiqueta para la variable ${param.variable}`}
                            variant="standard"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            size="small"
                            fullWidth
                            value={param.origen}
                            onChange={(e) => handleParamChange(param.variable, 'origen', e.target.value)}
                          >
                            {ORIGENES.map((o) => (
                              <MenuItem key={o.value} value={o.value}>
                                {o.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Section>
          )}

          <Section title="Uso" inset>
          <FormControlLabel
            control={
              <Switch
                checked={form.es_default}
                onChange={(event) => setForm((prev) => ({ ...prev, es_default: event.target.checked }))}
              />
            }
            label={<ControlLabel>Plantilla default para este tipo</ControlLabel>}
          />
          </Section>
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={imageViewerOpen} onClose={() => setImageViewerOpen(false)} maxWidth="lg" fullWidth PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle component="div" sx={dialogTitleSx}>
          <PatternDialogHeader eyebrow="Plantillas de WhatsApp" title="Vista previa de la imagen" onCancel={() => setImageViewerOpen(false)} />
        </DialogTitle>
        <DialogContent sx={{ ...dialogContentSx, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
          {form.imagen_url ? (
            <Box
              component="img"
              src={form.imagen_url}
              alt="Imagen predeterminada ampliada"
              sx={{ display: 'block', maxWidth: '100%', maxHeight: '70vh', width: 'auto', height: 'auto', objectFit: 'contain' }}
            />
          ) : null}
        </DialogContent>
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
