import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import {
  createCatalogoValor,
  fetchCatalogoTipo,
  fetchCatalogos,
  updateCatalogoValor,
  deleteCatalogoValor,
  type CatalogoValor,
} from '../services/catalogosService';

function useTipoCatalogo(tipoId: number | null) {
  const [nombre, setNombre] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tipoId) return;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchCatalogoTipo(tipoId);
        setNombre(data.nombre || 'Catálogo');
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo obtener el catálogo');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tipoId]);

  return { nombre, loading, error };
}

export default function CatalogoValoresPage() {
  const { tipo_catalogo_id, id } = useParams();
  const navigate = useNavigate();
  const tipoId = tipo_catalogo_id ? Number(tipo_catalogo_id) : id ? Number(id) : null;

  const [rows, setRows] = useState<CatalogoValor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogoValor | null>(null);
  const [form, setForm] = useState<{ clave: string; descripcion: string; orden: string; activo: boolean; catalogo_padre_id: number | null }>({
    clave: '',
    descripcion: '',
    orden: '',
    activo: true,
    catalogo_padre_id: null,
  });
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<CatalogoValor | null>(null);
  const [parentOptions, setParentOptions] = useState<CatalogoValor[]>([]);
  const [parentOptionsLoading, setParentOptionsLoading] = useState(false);

  const { nombre: tituloCatalogo, loading: loadingTipo, error: errorTipo } = useTipoCatalogo(tipoId);

  const loadData = async () => {
    if (!tipoId) {
      setError('Tipo de catálogo requerido');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await fetchCatalogos(tipoId);
      setRows(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar catálogos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoId]);

  const resetForm = () => {
    setForm({ clave: '', descripcion: '', orden: '', activo: true, catalogo_padre_id: null });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (row: CatalogoValor) => {
    setEditing(row);
    setForm({
      clave: row.clave || '',
      descripcion: row.descripcion || '',
      orden: row.orden !== null && row.orden !== undefined ? String(row.orden) : '',
      activo: row.activo !== null && row.activo !== undefined ? Boolean(row.activo) : true,
      catalogo_padre_id: row.catalogo_padre_id ?? null,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!tipoId) return;
    if (!form.descripcion.trim()) {
      setError('La descripción es obligatoria');
      return;
    }
    if (editing && form.catalogo_padre_id === editing.id) {
      setError('Un registro no puede ser su propio padre');
      return;
    }
    try {
      const payload = {
        tipo_catalogo_id: tipoId,
        clave: form.clave.trim() || null,
        descripcion: form.descripcion.trim(),
        orden: form.orden ? Number(form.orden) : null,
        catalogo_padre_id: form.catalogo_padre_id ?? null,
        activo: form.activo,
      };
      if (editing) {
        await updateCatalogoValor(editing.id, payload);
      } else {
        await createCatalogoValor(payload);
      }
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    }
  };

  const parentLookup = useMemo(() => {
    const map: Record<number, CatalogoValor> = {};
    rows.forEach((r) => {
      map[r.id] = r;
    });
    return map;
  }, [rows]);

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'clave',
        headerName: 'Clave',
        width: 140,
        renderCell: (params: GridRenderCellParams<CatalogoValor>) => params.row.clave || '—',
      },
      {
        field: 'descripcion',
        headerName: 'Descripción',
        flex: 1,
        minWidth: 200,
      },
      {
        field: 'padre',
        headerName: 'Padre',
        flex: 1,
        minWidth: 200,
        renderCell: (params: GridRenderCellParams<CatalogoValor>) => {
          const parentName = params.row.catalogo_padre_nombre
            || parentLookup[params.row.catalogo_padre_id || 0]?.descripcion;
          return parentName || '—';
        },
      },
      {
        field: 'orden',
        headerName: 'Orden',
        width: 100,
        renderCell: (params: GridRenderCellParams<CatalogoValor>) =>
          params.row.orden === null || params.row.orden === undefined ? '—' : params.row.orden,
        align: 'center',
        headerAlign: 'center',
      },
      {
        field: 'activo',
        headerName: 'Activo',
        width: 120,
        renderCell: (params: GridRenderCellParams<CatalogoValor>) => (
          <Chip
            size="small"
            label={params.row.activo ? 'Activo' : 'Inactivo'}
            color={params.row.activo ? 'success' : 'default'}
            variant={params.row.activo ? 'filled' : 'outlined'}
          />
        ),
      },
      {
        field: 'actions',
        headerName: 'Acciones',
        width: 140,
        sortable: false,
        filterable: false,
        renderCell: (params: GridRenderCellParams<CatalogoValor>) => (
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton size="small" onClick={() => handleToggleActivo(params.row)} color={params.row.activo ? 'success' : 'default'}>
              {params.row.activo ? <ToggleOnIcon fontSize="small" /> : <ToggleOffIcon fontSize="small" />}
            </IconButton>
            <IconButton size="small" color="primary" onClick={() => openEdit(params.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error" onClick={() => openDeleteConfirm(params.row)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ),
      },
    ],
    [parentLookup]
  );

  useEffect(() => {
    if (!dialogOpen) return;

    const parentTipoId = editing?.catalogo_padre_tipo_catalogo_id ?? null;
    const targetTipoId = parentTipoId ?? tipoId;

    if (!targetTipoId) {
      setParentOptions([]);
      return;
    }

    const load = async () => {
      try {
        setParentOptionsLoading(true);
        const baseList = targetTipoId === tipoId ? rows : await fetchCatalogos(targetTipoId);

        let list = baseList.filter((r) => r.activo ?? true);
        if (editing) {
          list = list.filter((r) => r.id !== editing.id);
        }

        if (form.catalogo_padre_id) {
          const currentParent = baseList.find((r) => r.id === form.catalogo_padre_id);
          if (currentParent && !list.find((r) => r.id === currentParent.id)) {
            list = [...list, currentParent];
          }
        }

        setParentOptions(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar los padres');
      } finally {
        setParentOptionsLoading(false);
      }
    };

    load();
  }, [dialogOpen, editing, rows, tipoId, form.catalogo_padre_id]);

  const handleToggleActivo = async (row: CatalogoValor) => {
    try {
      await updateCatalogoValor(row.id, { activo: !row.activo });
      loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar');
    }
  };

  const openDeleteConfirm = (row: CatalogoValor) => {
    setToDelete(row);
    setConfirmDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteCatalogoValor(toDelete.id);
      setConfirmDeleteOpen(false);
      setToDelete(null);
      loadData();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Este elemento del catálogo ya está siendo utilizado y no puede eliminarse. Puede desactivarlo si desea que no vuelva a utilizarse.'
      );
    }
  };

  const handleCloseDeleteConfirm = () => {
    setConfirmDeleteOpen(false);
    setToDelete(null);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            {loadingTipo ? 'Cargando…' : tituloCatalogo || 'Catálogo configurable'}
          </Typography>
          <Typography variant="body2" color="#4b5563">
            Administra los valores del catálogo.
          </Typography>
          {errorTipo ? (
            <Typography variant="caption" color="error">
              {errorTipo}
            </Typography>
          ) : null}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => navigate(-1)}>
            Volver
          </Button>
          <Button
            variant="contained"
            onClick={openCreate}
            disabled={!tipoId}
            startIcon={<AddIcon />}
          >
            Nuevo
          </Button>
        </Stack>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Box
        sx={{
          width: '100%',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 1.5,
          boxShadow: '0px 6px 16px rgba(0,0,0,0.04)',
          '& .MuiDataGrid-root': {
            border: 'none',
          },
        }}
      >
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          density="compact"
          autoHeight
          getRowId={(row) => row.id}
          disableRowSelectionOnClick
          hideFooterPagination={rows.length < 50}
          pageSizeOptions={[10, 25, 50, 100]}
          localeText={{ noRowsLabel: loading ? 'Cargando…' : 'Sin registros' }}
          sx={{
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: '#f6f8fa',
              borderBottom: '1px solid #e5e7eb',
              fontWeight: 700,
            },
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solid #f0f1f3',
            },
            '& .MuiDataGrid-row:nth-of-type(odd)': {
              backgroundColor: '#f9fafb',
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: '#eef2f7',
            },
          }}
        />
      </Box>

      <Dialog open={confirmDeleteOpen} onClose={handleCloseDeleteConfirm} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar valor</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Eliminar "{toDelete?.descripcion || 'este elemento'}" del catálogo?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDeleteConfirm} color="inherit" variant="outlined">
            No eliminar
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Editar valor' : 'Nuevo valor'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Clave"
            value={form.clave}
            onChange={(e) => setForm((f) => ({ ...f, clave: e.target.value }))}
            size="small"
          />
          <TextField
            label="Descripción"
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
            required
            size="small"
          />
          <Autocomplete
            options={parentOptions}
            getOptionLabel={(option) => option.descripcion || ''}
            value={parentOptions.find((opt) => opt.id === form.catalogo_padre_id) || null}
            onChange={(_, value) => setForm((f) => ({ ...f, catalogo_padre_id: value?.id ?? null }))}
            isOptionEqualToValue={(opt, val) => opt.id === val.id}
            renderInput={(params) => (
              <TextField
                {...(params as any)}
                label="Padre"
                placeholder="Sin padre"
                size="small"
              />
            )}
          />
          <TextField
            label="Orden"
            type="number"
            value={form.orden}
            onChange={(e) => setForm((f) => ({ ...f, orden: e.target.value }))}
            size="small"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={form.activo}
                onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
              />
            }
            label="Activo"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
