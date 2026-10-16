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
import { ConfigPageFrame, ConfigPageHeader } from '../../components/configuracion/configVisual';
import { ControlLabel, PanelBar, PatternDialogHeader, Pill, Section, actionIconSx, dialogContentSx, dialogPaperSx, dialogTitleSx, editorialDataGridSx, fieldsOnIvorySx, formWellSx, rowIconSx, wellSx } from '../../components/transporte/transporteVisual';

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
        <Pill active={Boolean(value)} label={value ? 'Sí' : 'No'} />
      ),
    },
    {
      field: 'requiere_referencia',
      headerName: 'Requiere ref.',
      width: 130,
      headerClassName: 'finanzas-header',
      renderCell: ({ value }) => (
        <Pill active={Boolean(value)} label={value ? 'Sí' : 'No'} />
      ),
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
          <IconButton size="small" sx={rowIconSx} onClick={() => handleOpenDialog(params.row)}>
            <EditIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      ),
    },
  ], []);

  const columns = useMemo<GridColDef<FinanzasMetodoPago>[]>(
    () => baseColumns, // Acciones visibles por renglón (sin menú contextual de tres puntos).
    [baseColumns, contextMenuTriggerColumn]
  );

  return (
    <ConfigPageFrame>
      <ConfigPageHeader
        title="Métodos de pago"
        description="Administra los métodos de pago disponibles para operaciones y programaciones."
        actions={
        <Tooltip title="Nuevo método">
          <IconButton size="small" sx={actionIconSx} onClick={() => handleOpenDialog(null)}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        }
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={wellSx}>
        <PanelBar title="Métodos registrados" meta={`${metodos.length} ${metodos.length === 1 ? 'método' : 'métodos'}`} />
        <DataGrid
          rows={metodos}
          columns={columns}
          rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
          columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
          autoHeight
          density="standard"
          loading={loading}
          disableRowSelectionOnClick
          localeText={esES.components.MuiDataGrid.defaultProps.localeText}
          initialState={{
            sorting: { sortModel: [{ field: 'clave', sort: 'asc' }] },
          }}
          sx={[
            standardDataGridSx,
            editorialDataGridSx,
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
      </Box>


      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle component="div" sx={dialogTitleSx}>
          <PatternDialogHeader
            eyebrow="Métodos de pago"
            title={form.id ? 'Editar método de pago' : 'Nuevo método de pago'}
            onCancel={handleCloseDialog}
            cancelDisabled={saving}
            onSave={handleSave}
            saving={saving}
            extra={
              <FormControlLabel
                sx={{ mr: 1 }}
                control={
                  <Switch
                    size="small"
                    checked={form.activo}
                    onChange={(e) => handleChange('activo', e.target.checked)}
                  />
                }
                label={<ControlLabel>Activo</ControlLabel>}
              />
            }
          />
        </DialogTitle>
        <DialogContent sx={dialogContentSx}>
          <Box sx={(theme) => ({ ...formWellSx(theme), ...fieldsOnIvorySx(theme) })}>
          <Section title="Método de pago" inset>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
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
                    checked={form.es_efectivo}
                    onChange={(e) => handleChange('es_efectivo', e.target.checked)}
                  />
                }
                label={<ControlLabel>Es efectivo</ControlLabel>}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.requiere_referencia}
                    onChange={(e) => handleChange('requiere_referencia', e.target.checked)}
                  />
                }
                label={<ControlLabel>Requiere referencia</ControlLabel>}
              />
            </Stack>

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
