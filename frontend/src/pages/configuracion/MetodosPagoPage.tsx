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
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  InputLabel,
  FormControl,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { DataGrid, type GridColDef, type GridValueGetter } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import type { FinanzasMetodoPago } from '../../types/finanzas';
import { actualizarMetodoPago, crearMetodoPago, fetchMetodosPago } from '../../services/finanzasService';
import { GridContextMenu } from '../../components/grids/GridContextMenu';
import { GridContextMenuTrigger } from '../../components/grids/GridContextMenuTrigger';
import type { GridContextMenuAction } from '../../components/grids/GridContextMenu';
import { SHOW_GRID_ACTIONS } from '../../components/grids/gridUxFlags';
import {
  STANDARD_DATA_GRID_HEADER_HEIGHT,
  STANDARD_DATA_GRID_ROW_HEIGHT,
  standardDataGridSx,
} from '../../components/grids/standardDataGridSx';
import { useGridContextMenu } from '../../hooks/useGridContextMenu';

const FORMAS_PAGO_SAT = [
  { value: '01', label: '01 – Efectivo' },
  { value: '02', label: '02 – Cheque nominativo' },
  { value: '03', label: '03 – Transferencia electrónica' },
  { value: '04', label: '04 – Tarjeta de crédito' },
  { value: '05', label: '05 – Monedero electrónico' },
  { value: '06', label: '06 – Dinero electrónico' },
  { value: '08', label: '08 – Vales de despensa' },
  { value: '12', label: '12 – Dación en pago' },
  { value: '28', label: '28 – Tarjeta de débito' },
  { value: '29', label: '29 – Tarjeta de servicio' },
  { value: '99', label: '99 – Por definir' },
];

interface FormState {
  id?: number;
  clave: string;
  nombre: string;
  forma_pago_sat: string;
  activo: boolean;
  requiere_referencia: boolean;
  es_efectivo: boolean;
}

const emptyForm: FormState = {
  clave: '',
  nombre: '',
  forma_pago_sat: '',
  activo: true,
  requiere_referencia: false,
  es_efectivo: false,
};

export default function MetodosPagoPage() {
  const [metodos, setMetodos] = useState<FinanzasMetodoPago[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );

  const loadMetodos = async () => {
    setLoading(true);
    try {
      const data = await fetchMetodosPago(false);
      setMetodos(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar los métodos de pago');
      setMetodos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMetodos();
  }, []);

  const handleOpenDialog = (metodo?: FinanzasMetodoPago | null) => {
    if (metodo) {
      setForm({
        id: metodo.id,
        clave: metodo.clave || '',
        nombre: metodo.nombre || '',
        forma_pago_sat: metodo.forma_pago_sat || '',
        activo: Boolean(metodo.activo),
        requiere_referencia: Boolean(metodo.requiere_referencia),
        es_efectivo: Boolean(metodo.es_efectivo),
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
    if (!form.clave.trim()) {
      setFormError('La clave es obligatoria');
      return;
    }
    if (!form.nombre.trim()) {
      setFormError('El nombre es obligatorio');
      return;
    }

    const payload = {
      clave: form.clave.trim().toUpperCase(),
      nombre: form.nombre.trim(),
      forma_pago_sat: form.forma_pago_sat.trim() || null,
      activo: form.activo,
      requiere_referencia: form.requiere_referencia,
      es_efectivo: form.es_efectivo,
    };

    try {
      setSaving(true);
      setFormError(null);
      if (form.id) {
        await actualizarMetodoPago(form.id, payload);
        setSnackbar({ open: true, message: 'Método de pago actualizado', severity: 'success' });
      } else {
        await crearMetodoPago(payload);
        setSnackbar({ open: true, message: 'Método de pago creado', severity: 'success' });
      }
      setDialogOpen(false);
      await loadMetodos();
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo guardar el método de pago');
    } finally {
      setSaving(false);
    }
  };

  const {
    contextMenuRow,
    anchorPosition: contextMenuPosition,
    closeContextMenu,
    openContextMenuForRow,
    rowSlotProps,
  } = useGridContextMenu(metodos);

  const contextMenuActions = useMemo<GridContextMenuAction[]>(() => {
    if (!contextMenuRow) return [];
    return [
      {
        id: 'editar',
        label: 'Editar método de pago',
        icon: <EditIcon fontSize="small" />,
        onClick: () => handleOpenDialog(contextMenuRow),
      },
    ];
  }, [contextMenuRow]);

  const contextMenuTriggerColumn = useMemo<GridColDef<FinanzasMetodoPago>>(
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
      renderCell: (params) => (
        <GridContextMenuTrigger onOpen={(event) => openContextMenuForRow(event, params.row)} />
      ),
    }),
    [openContextMenuForRow]
  );

  const baseColumns: GridColDef<FinanzasMetodoPago>[] = useMemo(() => [
    {
      field: 'clave',
      headerName: 'Clave',
      width: 120,
      headerClassName: 'finanzas-header',
    },
    {
      field: 'nombre',
      headerName: 'Nombre',
      flex: 1.2,
      minWidth: 200,
      headerClassName: 'finanzas-header',
    },
    {
      field: 'forma_pago_sat',
      headerName: 'Forma de pago SAT',
      width: 200,
      headerClassName: 'finanzas-header',
      valueGetter: ((_, row) => {
        if (!row.forma_pago_sat) return '—';
        const found = FORMAS_PAGO_SAT.find((f) => f.value === row.forma_pago_sat);
        return found ? found.label : row.forma_pago_sat;
      }) as GridValueGetter<FinanzasMetodoPago>,
    },
    {
      field: 'es_efectivo',
      headerName: 'Efectivo',
      width: 110,
      headerClassName: 'finanzas-header',
      renderCell: ({ value }) => (
        <Chip label={value ? 'Sí' : 'No'} color={value ? 'info' : 'default'} size="small" />
      ),
    },
    {
      field: 'requiere_referencia',
      headerName: 'Requiere ref.',
      width: 130,
      headerClassName: 'finanzas-header',
      renderCell: ({ value }) => (
        <Chip label={value ? 'Sí' : 'No'} color={value ? 'warning' : 'default'} size="small" />
      ),
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
      field: 'acciones',
      headerName: 'Acciones',
      sortable: false,
      filterable: false,
      width: 90,
      align: 'right',
      headerAlign: 'right',
      headerClassName: 'finanzas-header',
      renderCell: (params) => (
        <Tooltip title="Editar">
          <IconButton size="small" onClick={() => handleOpenDialog(params.row)} sx={{ color: '#1d2f68' }}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ], []);

  const columns = useMemo<GridColDef<FinanzasMetodoPago>[]>(
    () => [contextMenuTriggerColumn, ...baseColumns],
    [baseColumns, contextMenuTriggerColumn]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            Métodos de pago
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Administra los métodos de pago disponibles para operaciones y programaciones.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog(null)}
          sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}
        >
          Nuevo método
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <DataGrid
          rows={metodos}
          columns={columns}
          rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
          columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
          autoHeight
          density="standard"
          loading={loading}
          disableRowSelectionOnClick
          columnVisibilityModel={{ menu: true, acciones: SHOW_GRID_ACTIONS }}
          {...(rowSlotProps ? { slotProps: { row: rowSlotProps } } : {})}
          localeText={esES.components.MuiDataGrid.defaultProps.localeText}
          initialState={{
            sorting: { sortModel: [{ field: 'clave', sort: 'asc' }] },
          }}
          sx={[
            standardDataGridSx,
            {
              '--DataGrid-overlayHeight': '200px',
              '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' },
            },
          ]}
          slots={{
            noRowsOverlay: () => (
              <Stack height="100%" alignItems="center" justifyContent="center" sx={{ py: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  No hay métodos de pago registrados.
                </Typography>
              </Stack>
            ),
          }}
          hideFooterPagination
          hideFooterSelectedRowCount
        />
      </Paper>

      <GridContextMenu
        actions={contextMenuActions}
        anchorPosition={contextMenuPosition}
        open={Boolean(contextMenuRow && contextMenuPosition)}
        onClose={closeContextMenu}
      />

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{form.id ? 'Editar método de pago' : 'Nuevo método de pago'}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} mt={1}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Clave"
                required
                value={form.clave}
                onChange={(e) => handleChange('clave', e.target.value)}
                inputProps={{ maxLength: 20 }}
                size="small"
                sx={{ width: { xs: '100%', sm: 160 } }}
                helperText="Ej: EFE, TRF, TC"
              />
              <TextField
                label="Nombre"
                required
                value={form.nombre}
                onChange={(e) => handleChange('nombre', e.target.value)}
                inputProps={{ maxLength: 80 }}
                size="small"
                fullWidth
              />
            </Stack>

            <FormControl size="small" fullWidth>
              <InputLabel>Forma de pago SAT</InputLabel>
              <Select
                value={form.forma_pago_sat}
                label="Forma de pago SAT"
                onChange={(e) => handleChange('forma_pago_sat', e.target.value)}
              >
                <MenuItem value=""><em>Sin asignar</em></MenuItem>
                {FORMAS_PAGO_SAT.map((f) => (
                  <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack direction="row" spacing={3} flexWrap="wrap">
              <FormControlLabel
                control={
                  <Switch
                    checked={form.activo}
                    onChange={(e) => handleChange('activo', e.target.checked)}
                  />
                }
                label="Activo"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.es_efectivo}
                    onChange={(e) => handleChange('es_efectivo', e.target.checked)}
                  />
                }
                label="Es efectivo"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.requiere_referencia}
                    onChange={(e) => handleChange('requiere_referencia', e.target.checked)}
                  />
                }
                label="Requiere referencia"
              />
            </Stack>

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
