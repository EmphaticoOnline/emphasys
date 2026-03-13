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
  color: '#1d2f68',
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
        color: concepto.color || '#1d2f68',
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

  const columns: GridColDef<Concepto>[] = useMemo(() => [
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
        <Chip label={value ? 'Sí' : 'No'} color={value ? 'primary' : 'default'} size="small" />
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
            <IconButton size="small" onClick={() => handleOpenDialog(params.row)} sx={{ color: '#1d2f68' }}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar">
            <IconButton size="small" color="error" onClick={() => handleDelete(params.row)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ], []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            Conceptos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Administra el catálogo de conceptos financieros por empresa.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog(null)}
          sx={{
            textTransform: 'none',
            borderRadius: 999,
            bgcolor: '#1d2f68',
            '&:hover': { bgcolor: '#162551' },
          }}
        >
          Nuevo concepto
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <DataGrid
          rows={conceptos}
          columns={columns}
          autoHeight
          density="compact"
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
          sx={{
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
      </Paper>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{form.id ? 'Editar concepto' : 'Nuevo concepto'}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} mt={1}>
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
              <FormControlLabel
                control={<Switch checked={form.activo} onChange={(e) => handleChange('activo', e.target.checked)} />}
                label={form.activo ? 'Activo' : 'Inactivo'}
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
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog} disabled={saving} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            variant="contained"
            sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
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
    </Box>
  );
}
