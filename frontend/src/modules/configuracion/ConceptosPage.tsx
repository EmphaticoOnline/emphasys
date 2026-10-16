import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { DataGrid, type GridColDef, type GridValueGetter } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import type { Concepto } from '../../types/finanzas';
import { actualizarConcepto, crearConcepto, eliminarConcepto, fetchConceptos } from '../../services/conceptosService';
import { GridContextMenu } from '../../components/grids/GridContextMenu';
import { GridContextMenuTrigger } from '../../components/grids/GridContextMenuTrigger';
import type { GridContextMenuAction } from '../../components/grids/GridContextMenu';
import { SHOW_GRID_ACTIONS } from '../../components/grids/gridUxFlags';
import { STANDARD_DATA_GRID_HEADER_HEIGHT, STANDARD_DATA_GRID_ROW_HEIGHT, standardDataGridSx } from '../../components/grids/standardDataGridSx';
import { useGridContextMenu } from '../../hooks/useGridContextMenu';
import { ConfigPageFrame, ConfigPageHeader } from '../../components/configuracion/configVisual';
import { ControlLabel, PanelBar, PatternDialogHeader, Pill, Section, actionIconSx, dialogContentSx, dialogPaperSx, dialogTitleSx, editorialDataGridSx, fieldsOnIvorySx, formWellSx, rowIconSx, wellSx } from '../../components/transporte/transporteVisual';

interface FormState {
  id?: number;
  nombre_concepto: string;
  es_gasto: boolean;
  cuenta_contable: string;
  rubro_presupuesto_id: string;
  orden: string;
  color: string;
  activo: boolean;
  observaciones: string;
}

const emptyForm: FormState = {
  nombre_concepto: '',
  es_gasto: false,
  cuenta_contable: '',
  rubro_presupuesto_id: '',
  orden: '',
  color: '#3e3428',
  activo: true,
  observaciones: '',
};

function normalizeNumber(value: string): number | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function sortConceptos(items: Concepto[]): Concepto[] {
  return [...items].sort((a, b) => {
    const ordenA = a.orden ?? Number.MAX_SAFE_INTEGER;
    const ordenB = b.orden ?? Number.MAX_SAFE_INTEGER;
    if (ordenA !== ordenB) return ordenA - ordenB;
    return (a.nombre_concepto || '').localeCompare(b.nombre_concepto || '', 'es', { sensitivity: 'base' });
  });
}

export default function ConceptosPage() {
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );

  const loadConceptos = async () => {
    setLoading(true);
    try {
      const data = await fetchConceptos();
      setConceptos(sortConceptos(data));
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar los conceptos');
      setConceptos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConceptos();
  }, []);

  const handleOpenDialog = (concepto?: Concepto | null) => {
    if (concepto) {
      setForm({
        id: concepto.id,
        nombre_concepto: concepto.nombre_concepto || '',
        es_gasto: Boolean(concepto.es_gasto),
        cuenta_contable: concepto.cuenta_contable || '',
        rubro_presupuesto_id: concepto.rubro_presupuesto_id ? String(concepto.rubro_presupuesto_id) : '',
        orden: concepto.orden !== undefined && concepto.orden !== null ? String(concepto.orden) : '',
        color: concepto.color || '#3e3428',
        activo: Boolean(concepto.activo),
        observaciones: concepto.observaciones || '',
      });
    } else {
      setForm(emptyForm);
    }
    setFormError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setFormError(null);
  };

  const handleChange = (field: keyof FormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.nombre_concepto.trim()) {
      setFormError('El nombre del concepto es obligatorio');
      return;
    }

    const payload: Partial<Concepto> = {
      nombre_concepto: form.nombre_concepto.trim(),
      es_gasto: form.es_gasto,
      cuenta_contable: form.cuenta_contable.trim() || null,
      rubro_presupuesto_id: normalizeNumber(form.rubro_presupuesto_id),
      orden: normalizeNumber(form.orden),
      color: form.color?.trim() || null,
      activo: form.activo,
      observaciones: form.observaciones.trim() || null,
    };

    try {
      setSaving(true);
      setFormError(null);
      if (form.id) {
        await actualizarConcepto(form.id, payload);
        setSnackbar({ open: true, message: 'Concepto actualizado', severity: 'success' });
      } else {
        await crearConcepto(payload);
        setSnackbar({ open: true, message: 'Concepto creado', severity: 'success' });
      }
      setDialogOpen(false);
      await loadConceptos();
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo guardar el concepto');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (concepto: Concepto) => {
    const confirmed = window.confirm(`¿Eliminar el concepto "${concepto.nombre_concepto}"?`);
    if (!confirmed) return;
    try {
      await eliminarConcepto(concepto.id);
      setSnackbar({ open: true, message: 'Concepto eliminado', severity: 'success' });
      await loadConceptos();
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo eliminar el concepto', severity: 'error' });
    }
  };

  const {
    contextMenuRow,
    anchorPosition: contextMenuPosition,
    closeContextMenu,
    openContextMenuForRow,
    rowSlotProps,
  } = useGridContextMenu(conceptos);

  const contextMenuActions = useMemo<GridContextMenuAction[]>(() => {
    if (!contextMenuRow) return [];

    return [
      {
        id: 'editar',
        label: 'Editar concepto',
        icon: <EditIcon fontSize="small" />,
        onClick: () => handleOpenDialog(contextMenuRow),
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
        onClick: () => void handleDelete(contextMenuRow),
      },
    ];
  }, [contextMenuRow]);

  const contextMenuTriggerColumn = useMemo<GridColDef<Concepto>>(
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
      renderCell: (params) => <GridContextMenuTrigger onOpen={(event) => openContextMenuForRow(event, params.row)} />,
    }),
    [openContextMenuForRow]
  );

  const baseColumns: GridColDef<Concepto>[] = useMemo(() => [
    {
      field: 'nombre_concepto',
      headerName: 'Nombre del concepto',
      flex: 1.2,
      minWidth: 220,
      headerClassName: 'finanzas-header',
    },
    {
      field: 'cuenta_contable',
      headerName: 'Cuenta contable',
      flex: 1,
      minWidth: 180,
      headerClassName: 'finanzas-header',
      valueGetter: ((_, row) => row.cuenta_contable || '—') as GridValueGetter<Concepto>,
    },
    {
      field: 'rubro_presupuesto_id',
      headerName: 'Rubro presupuesto',
      width: 150,
      headerClassName: 'finanzas-header',
      valueGetter: ((_, row) => row.rubro_presupuesto_id ?? '—') as GridValueGetter<Concepto>,
    },
    {
      field: 'activo',
      headerName: 'Activo',
      width: 110,
      headerClassName: 'finanzas-header',
      renderCell: ({ value }) => (
        <Pill active={Boolean(value)} label={value ? 'Sí' : 'No'} />
      ),
    },
    {
      field: 'orden',
      headerName: 'Orden',
      width: 110,
      headerClassName: 'finanzas-header',
      valueGetter: ((_, row) => row.orden ?? '—') as GridValueGetter<Concepto>,
    },
    {
      field: 'acciones',
      headerName: 'Acciones',
      sortable: false,
      filterable: false,
      width: 120,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'finanzas-header',
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5} justifyContent="flex-end" width="100%">
          <Tooltip title="Editar">
            <IconButton size="small" sx={rowIconSx} onClick={() => handleOpenDialog(params.row)}>
              <EditIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar">
            <IconButton size="small" sx={rowIconSx} onClick={() => handleDelete(params.row)}>
              <DeleteIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ], []);

  // Acciones visibles por renglón (sin menú contextual de tres puntos).
  const columns = baseColumns;

  return (
    <ConfigPageFrame>
      <ConfigPageHeader
        title="Conceptos"
        description="Administra el catálogo de conceptos financieros por empresa."
        actions={<Tooltip title="Nuevo concepto"><IconButton size="small" sx={actionIconSx} onClick={() => handleOpenDialog(null)}><AddIcon fontSize="small" /></IconButton></Tooltip>}
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={wellSx}>
        <PanelBar title="Conceptos registrados" meta={`${conceptos.length} ${conceptos.length === 1 ? 'concepto' : 'conceptos'}`} />
        <DataGrid
          rows={conceptos}
          columns={columns}
          rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
          columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
          autoHeight
          density="standard"
          loading={loading}
          disableRowSelectionOnClick
          localeText={esES.components.MuiDataGrid.defaultProps.localeText}
          initialState={{
            sorting: {
              sortModel: [
                { field: 'orden', sort: 'asc' },
                { field: 'nombre_concepto', sort: 'asc' },
              ],
            },
          }}
          sx={[
            standardDataGridSx,
            editorialDataGridSx,
            {
              '--DataGrid-overlayHeight': '200px',
              '& .MuiDataGrid-cell': {
                display: 'flex',
                alignItems: 'center',
              },
            },
          ]}
          slots={{
            noRowsOverlay: () => (
              <Stack height="100%" alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  No hay conceptos registrados.
                </Typography>
              </Stack>
            ),
          }}
          hideFooterPagination
          hideFooterSelectedRowCount
        />
      </Box>


      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle component="div" sx={dialogTitleSx}>
          <PatternDialogHeader
            eyebrow="Conceptos"
            title={form.id ? 'Editar concepto' : 'Nuevo concepto'}
            onCancel={handleCloseDialog}
            cancelDisabled={saving}
            onSave={handleSave}
            saving={saving}
            extra={
              <FormControlLabel
                sx={{ mr: 1 }}
                control={<Switch size="small" checked={form.activo} onChange={(e) => handleChange('activo', e.target.checked)} />}
                label={<ControlLabel>{form.activo ? 'Activo' : 'Inactivo'}</ControlLabel>}
              />
            }
          />
        </DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box sx={(theme) => ({ ...formWellSx(theme), ...fieldsOnIvorySx(theme) })}>
          <Section title="Concepto" inset>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              label="Nombre del concepto"
              required
              value={form.nombre_concepto}
              onChange={(e) => handleChange('nombre_concepto', e.target.value)}
              inputProps={{ maxLength: 80 }}
              size="small"
              fullWidth
            />

            <TextField
              label="Cuenta contable"
              value={form.cuenta_contable}
              onChange={(e) => handleChange('cuenta_contable', e.target.value)}
              size="small"
              fullWidth
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Rubro presupuesto"
                value={form.rubro_presupuesto_id}
                onChange={(e) => handleChange('rubro_presupuesto_id', e.target.value)}
                size="small"
                type="number"
                fullWidth
              />
              <TextField
                label="Orden"
                value={form.orden}
                onChange={(e) => handleChange('orden', e.target.value)}
                size="small"
                type="number"
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <TextField
                label="Color"
                type="color"
                value={form.color}
                onChange={(e) => handleChange('color', e.target.value)}
                size="small"
                sx={{ width: { xs: '100%', sm: 180 } }}
              />
            </Stack>

            <TextField
              label="Observaciones"
              size="small"
              value={form.observaciones}
              onChange={(e) => handleChange('observaciones', e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />

            {formError && (
              <Typography color="error" variant="body2">
                {formError}
              </Typography>
            )}
          </Stack>
          </Section>
          </Box>
        </DialogContent>
      </Dialog>

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
    </ConfigPageFrame>
  );
}
