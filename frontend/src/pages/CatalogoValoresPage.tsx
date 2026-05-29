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
import { fetchCamposConfiguracion } from '../services/camposDinamicosService';
import type { CampoConfiguracion } from '../types/camposDinamicos';
import { fetchPreciosListas, type PrecioLista } from '../services/preciosListasService';
import { GridContextMenu } from '../components/grids/GridContextMenu';
import { GridContextMenuTrigger } from '../components/grids/GridContextMenuTrigger';
import type { GridContextMenuAction } from '../components/grids/GridContextMenu';
import { SHOW_GRID_ACTIONS } from '../components/grids/gridUxFlags';
import { STANDARD_DATA_GRID_HEADER_HEIGHT, STANDARD_DATA_GRID_ROW_HEIGHT, standardDataGridSx } from '../components/grids/standardDataGridSx';
import { useGridContextMenu } from '../hooks/useGridContextMenu';

function useTipoCatalogo(tipoId: number | null) {
  const [tipo, setTipo] = useState<{ id: number; nombre: string | null; entidad_tipo_id: number; entidad_tipo_codigo: string | null } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tipoId) return;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchCatalogoTipo(tipoId);
        setTipo(data);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo obtener el catálogo');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tipoId]);

  return { tipo, nombre: tipo?.nombre || '', loading, error };
}

function normalizarTexto(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function resolveConfiguredParentTipoId(
  campos: CampoConfiguracion[],
  tipoCatalogoId: number
): number | null {
  const childFields = campos.filter(
    (campo) =>
      campo.tipo_dato === 'lista'
      && campo.catalogo_tipo_id === tipoCatalogoId
      && campo.campo_padre_id !== null
  );

  if (!childFields.length) return null;

  const fieldsById = new Map(childFields.map((campo) => [campo.id, campo]));
  campos.forEach((campo) => {
    fieldsById.set(campo.id, campo);
  });

  const parentTipoIds = Array.from(
    new Set(
      childFields
        .map((campo) => fieldsById.get(campo.campo_padre_id as number)?.catalogo_tipo_id ?? null)
        .filter((catalogoTipoId): catalogoTipoId is number => typeof catalogoTipoId === 'number' && Number.isFinite(catalogoTipoId))
    )
  );

  return parentTipoIds.length === 1 ? parentTipoIds[0] : null;
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
  const [form, setForm] = useState<{ clave: string; descripcion: string; orden: string; activo: boolean; catalogo_padre_id: number | null; precio_lista_id: number | null }>({
    clave: '',
    descripcion: '',
    orden: '',
    activo: true,
    catalogo_padre_id: null,
    precio_lista_id: null,
  });
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<CatalogoValor | null>(null);
  const [parentOptions, setParentOptions] = useState<CatalogoValor[]>([]);
  const [listasPrecioVenta, setListasPrecioVenta] = useState<PrecioLista[]>([]);
  const [parentOptionsLoading, setParentOptionsLoading] = useState(false);
  const [configuredParentTipoId, setConfiguredParentTipoId] = useState<number | null>(null);
  const [configuredParentTipoLoading, setConfiguredParentTipoLoading] = useState(false);

  const { tipo: tipoCatalogoActual, nombre: tituloCatalogo, loading: loadingTipo, error: errorTipo } = useTipoCatalogo(tipoId);

  const esClasificacionComercialContacto = useMemo(() => {
    const nombre = tipoCatalogoActual?.nombre || '';
    return tipoCatalogoActual?.entidad_tipo_codigo === 'CONTACTO' && normalizarTexto(nombre).includes('clasificacion');
  }, [tipoCatalogoActual]);

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

  useEffect(() => {
    if (!esClasificacionComercialContacto) {
      setListasPrecioVenta([]);
      return;
    }

    let cancelled = false;

    const loadListas = async () => {
      try {
        const data = await fetchPreciosListas(false);
        if (cancelled) return;
        setListasPrecioVenta(data.filter((item) => item.tipo_precio === 'VENTA' && item.activo));
      } catch (e) {
        if (cancelled) return;
        setListasPrecioVenta([]);
        setError(e instanceof Error ? e.message : 'No se pudieron cargar las listas de precios');
      }
    };

    void loadListas();

    return () => {
      cancelled = true;
    };
  }, [esClasificacionComercialContacto]);

  useEffect(() => {
    if (!dialogOpen || !tipoId) {
      setConfiguredParentTipoId(null);
      setConfiguredParentTipoLoading(false);
      return;
    }

    let cancelled = false;

    const loadConfiguredParentTipo = async () => {
      try {
        setConfiguredParentTipoLoading(true);
        setConfiguredParentTipoId(null);
        const campos = await fetchCamposConfiguracion({ incluirInactivos: true });
        if (cancelled) return;
        setConfiguredParentTipoId(resolveConfiguredParentTipoId(campos, tipoId));
      } catch (e) {
        if (cancelled) return;
        setConfiguredParentTipoId(null);
        setError(e instanceof Error ? e.message : 'No se pudo resolver la configuración del catálogo padre');
      } finally {
        if (!cancelled) {
          setConfiguredParentTipoLoading(false);
        }
      }
    };

    void loadConfiguredParentTipo();

    return () => {
      cancelled = true;
    };
  }, [dialogOpen, tipoId]);

  const resetForm = () => {
    setForm({ clave: '', descripcion: '', orden: '', activo: true, catalogo_padre_id: null, precio_lista_id: null });
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
      precio_lista_id: row.precio_lista_id ?? null,
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
        precio_lista_id: esClasificacionComercialContacto ? form.precio_lista_id ?? null : null,
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

  const {
    contextMenuRow,
    anchorPosition: contextMenuPosition,
    closeContextMenu,
    openContextMenuForRow,
    rowSlotProps,
  } = useGridContextMenu(rows);

  const contextMenuActions = useMemo<GridContextMenuAction[]>(() => {
    if (!contextMenuRow) return [];

    return [
      {
        id: 'toggle-activo',
        label: contextMenuRow.activo ? 'Desactivar' : 'Activar',
        icon: contextMenuRow.activo ? <ToggleOnIcon fontSize="small" /> : <ToggleOffIcon fontSize="small" />,
        onClick: () => void handleToggleActivo(contextMenuRow),
      },
      {
        id: 'editar',
        label: 'Editar valor',
        icon: <EditIcon fontSize="small" />,
        onClick: () => openEdit(contextMenuRow),
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
        onClick: () => openDeleteConfirm(contextMenuRow),
      },
    ];
  }, [contextMenuRow]);

  const contextMenuTriggerColumn = useMemo<GridColDef>(
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
      renderCell: (params: GridRenderCellParams<CatalogoValor>) => (
        <GridContextMenuTrigger onOpen={(event) => openContextMenuForRow(event, params.row)} />
      ),
    }),
    [openContextMenuForRow]
  );

  const baseColumns: GridColDef[] = useMemo(
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

  const columns = useMemo<GridColDef[]>(() => [contextMenuTriggerColumn, ...baseColumns], [baseColumns, contextMenuTriggerColumn]);

  useEffect(() => {
    if (!dialogOpen) return;

    if (configuredParentTipoLoading) {
      setParentOptions([]);
      return;
    }

    const parentTipoId = editing?.catalogo_padre_tipo_catalogo_id ?? configuredParentTipoId ?? null;
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
  }, [dialogOpen, editing, rows, tipoId, form.catalogo_padre_id, configuredParentTipoId, configuredParentTipoLoading]);

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
          {esClasificacionComercialContacto ? (
            <Typography variant="body2" color="#2563eb">
              Cada clasificación comercial puede asociarse a una lista de precios de venta.
            </Typography>
          ) : null}
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
          rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
          columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
          loading={loading}
          density="standard"
          autoHeight
          getRowId={(row) => row.id}
          disableRowSelectionOnClick
          columnVisibilityModel={{ menu: true, actions: SHOW_GRID_ACTIONS }}
          {...(rowSlotProps ? { slotProps: { row: rowSlotProps } } : {})}
          hideFooterPagination={rows.length < 50}
          pageSizeOptions={[10, 25, 50, 100]}
          localeText={{ noRowsLabel: loading ? 'Cargando…' : 'Sin registros' }}
          sx={[
            standardDataGridSx,
            {
              '& .MuiDataGrid-cell': {
                borderBottom: '1px solid #f0f1f3',
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
            loading={parentOptionsLoading || configuredParentTipoLoading}
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
          {esClasificacionComercialContacto ? (
            <Autocomplete
              options={listasPrecioVenta}
              loading={loading}
              getOptionLabel={(option) => option.nombre || ''}
              value={listasPrecioVenta.find((item) => item.id === form.precio_lista_id) || null}
              onChange={(_, value) => setForm((f) => ({ ...f, precio_lista_id: value?.id ?? null }))}
              isOptionEqualToValue={(opt, val) => opt.id === val.id}
              renderInput={(params) => (
                <TextField
                  {...(params as any)}
                  label="Lista de precios asociada"
                  size="small"
                  helperText="Opcional. Se usará cuando un contacto tenga esta clasificación comercial."
                />
              )}
              noOptionsText="No hay listas de precios de venta activas"
            />
          ) : null}
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
