import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogTitle,
  DialogContent,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
  Autocomplete,
  Tooltip,
  MenuItem,
} from '@mui/material';
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import {
  fetchCamposConfiguracion,
  crearCampoConfiguracion,
  actualizarCampoConfiguracion,
  eliminarCampoConfiguracion,
  fetchEntidadesTipos,
  fetchTiposDocumento,
  fetchCatalogosTipos,
  type EntidadTipo,
  type CatalogoTipo,
  type TipoDocumento,
} from '../services/camposDinamicosService';
import type { CampoConfiguracion, TipoDatoCampo } from '../types/camposDinamicos';

type FormState = {
  nombre: string;
  clave: string;
  entidad_tipo_id: number | null;
  tipo_documento: string;
  tipo_dato: CampoConfiguracion['tipo_dato'];
  tipo_control: string;
  catalogo_tipo_id: number | null;
  campo_padre_id: number | null;
  orden: string;
  obligatorio: boolean;
  activo: boolean;
};

const TIPO_DATO_OPCIONES: { value: TipoDatoCampo; label: string }[] = [
  { value: 'texto', label: 'texto' },
  { value: 'numero', label: 'numero' },
  { value: 'fecha', label: 'fecha' },
  { value: 'booleano', label: 'boolean' },
  { value: 'lista', label: 'lista' },
];

const inferTipoControl = (tipoDato: TipoDatoCampo | null | undefined): string => {
  switch (tipoDato) {
    case 'lista':
      return 'select';
    case 'fecha':
      return 'date';
    case 'booleano':
      return 'checkbox';
    case 'numero':
    case 'texto':
    default:
      return 'input';
  }
};

const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const emptyForm = (): FormState => ({
  nombre: '',
  clave: '',
  entidad_tipo_id: null,
  tipo_documento: '',
  tipo_dato: 'texto',
  tipo_control: inferTipoControl('texto'),
  catalogo_tipo_id: null,
  campo_padre_id: null,
  orden: '',
  obligatorio: false,
  activo: true,
});

export default function CamposConfiguracionPage() {
  const [rows, setRows] = useState<CampoConfiguracion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [entidades, setEntidades] = useState<EntidadTipo[]>([]);
  const [catalogosTipos, setCatalogosTipos] = useState<CatalogoTipo[]>([]);
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CampoConfiguracion | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CampoConfiguracion | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetchCamposConfiguracion({ incluirInactivos: true });
      setRows(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los campos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        setLoadingOptions(true);
        const [entidadesResp, catalogosResp, tiposDocResp] = await Promise.all([
          fetchEntidadesTipos(),
          fetchCatalogosTipos(),
          fetchTiposDocumento(),
        ]);
        setEntidades(entidadesResp);
        setCatalogosTipos(catalogosResp);
        setTiposDocumento(tiposDocResp);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar opciones');
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
  }, []);

  const entidadOptions = useMemo(
    () => entidades.map((e) => ({ id: e.id, label: e.nombre || e.codigo || String(e.id) })),
    [entidades]
  );

  const entidadesMap = useMemo(() => new Map(entidades.map((e) => [e.id, e])), [entidades]);

  const tipoDocumentoOptions = useMemo(() => {
    const map = new Map<string, TipoDocumento>();
    tiposDocumento.forEach((t) => map.set(t.codigo, t));
    rows.forEach((r) => {
      if (r.tipo_documento && !map.has(r.tipo_documento)) {
        map.set(r.tipo_documento, {
          codigo: r.tipo_documento,
          nombre: r.tipo_documento,
          nombre_plural: null,
          icono: null,
        });
      }
    });
    return Array.from(map.values());
  }, [tiposDocumento, rows]);

  const catalogoTipoOptions = useMemo(() => {
    const entidadId = form.entidad_tipo_id;
    const list = catalogosTipos.filter((c) => !entidadId || c.entidad_tipo_id === entidadId);
    return list.map((c) => ({ id: c.id, label: c.nombre ?? 'Sin nombre', entidad_tipo_id: c.entidad_tipo_id }));
  }, [catalogosTipos, form.entidad_tipo_id]);

  const parentOptions = useMemo(() => {
    const entidadId = form.entidad_tipo_id;
    const tipoDoc = form.tipo_documento.trim().toLowerCase() || null;
    const base = rows.filter((r) => {
      if (!r.activo) return false;
      if (entidadId && r.entidad_tipo_id !== entidadId) return false;
      const rowTipo = r.tipo_documento ? r.tipo_documento.toLowerCase() : null;
      if (rowTipo !== tipoDoc) return false;
      if (editing && r.id === editing.id) return false;
      return true;
    });

    if (editing?.campo_padre_id) {
      const currentParent = rows.find((r) => r.id === editing.campo_padre_id);
      if (currentParent && !base.find((r) => r.id === currentParent.id)) {
        base.push(currentParent);
      }
    }
    return base;
  }, [rows, form.entidad_tipo_id, form.tipo_documento, editing]);

  const columns: GridColDef[] = [
    { field: 'nombre', headerName: 'Nombre', flex: 1, minWidth: 160 },
    { field: 'clave', headerName: 'Clave', width: 140, renderCell: (p) => p.row.clave || '—' },
    {
      field: 'entidad',
      headerName: 'Entidad',
      width: 170,
      renderCell: (params: GridRenderCellParams<CampoConfiguracion>) =>
        entidadesMap.get(params.row.entidad_tipo_id)?.nombre || params.row.entidad_tipo_codigo || '—',
    },
    { field: 'tipo_documento', headerName: 'Tipo doc.', width: 120, renderCell: (p) => p.row.tipo_documento || '—' },
    {
      field: 'tipo_dato',
      headerName: 'Tipo dato',
      width: 110,
      renderCell: (p) => TIPO_DATO_OPCIONES.find((o) => o.value === p.row.tipo_dato)?.label || p.row.tipo_dato,
    },
    {
      field: 'catalogo_tipo_id',
      headerName: 'Catálogo',
      width: 170,
      renderCell: (p) => p.row.catalogo_tipo_nombre || '—',
    },
    {
      field: 'campo_padre_id',
      headerName: 'Campo padre',
      flex: 1,
      minWidth: 160,
      renderCell: (params: GridRenderCellParams<CampoConfiguracion>) => {
        const padre = rows.find((r) => r.id === params.row.campo_padre_id);
        return padre?.nombre || '—';
      },
    },
    {
      field: 'orden',
      headerName: 'Orden',
      width: 90,
      renderCell: (p) => (p.row.orden === null || p.row.orden === undefined ? '—' : p.row.orden),
      align: 'center',
      headerAlign: 'center',
    },
    {
      field: 'obligatorio',
      headerName: 'Obligatorio',
      width: 110,
      renderCell: (p) => (p.row.obligatorio ? 'Sí' : 'No'),
      align: 'center',
      headerAlign: 'center',
    },
    {
      field: 'activo',
      headerName: 'Activo',
      width: 90,
      renderCell: (p) => (p.row.activo ? 'Sí' : 'No'),
      align: 'center',
      headerAlign: 'center',
    },
    {
      field: 'actions',
      headerName: 'Acciones',
      width: 110,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<CampoConfiguracion>) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Editar">
            <IconButton size="small" color="primary" onClick={() => handleEdit(params.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar">
            <IconButton size="small" color="error" onClick={() => setConfirmDelete(params.row)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  const handleEdit = (row: CampoConfiguracion) => {
    setEditing(row);
    const inferredControl = inferTipoControl(row.tipo_dato);
    setForm({
      nombre: row.nombre || '',
      clave: row.clave || slugify(row.nombre || ''),
      entidad_tipo_id: row.entidad_tipo_id ?? null,
      tipo_documento: row.tipo_documento || '',
      tipo_dato: row.tipo_dato,
      tipo_control: row.tipo_control || inferredControl,
      catalogo_tipo_id: row.catalogo_tipo_id ?? null,
      campo_padre_id: row.campo_padre_id ?? null,
      orden: row.orden !== null && row.orden !== undefined ? String(row.orden) : '',
      obligatorio: Boolean(row.obligatorio),
      activo: Boolean(row.activo),
    });
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    if (!form.entidad_tipo_id) {
      setError('La entidad es obligatoria');
      return;
    }
    try {
      setSaving(true);
      const payload: Partial<CampoConfiguracion> = {
        nombre: form.nombre.trim(),
        clave: form.clave.trim() || slugify(form.nombre),
        entidad_tipo_id: form.entidad_tipo_id,
        tipo_documento: form.tipo_documento.trim() || null,
        tipo_dato: form.tipo_dato,
        tipo_control: inferTipoControl(form.tipo_dato),
        catalogo_tipo_id: form.tipo_dato === 'lista' ? form.catalogo_tipo_id ?? null : null,
        campo_padre_id: form.campo_padre_id ?? null,
        orden: form.orden ? Number(form.orden) : null,
        obligatorio: form.obligatorio,
        activo: form.activo,
      };

      if (editing) {
        await actualizarCampoConfiguracion(editing.id, payload);
      } else {
        await crearCampoConfiguracion(payload);
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm());
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await eliminarCampoConfiguracion(confirmDelete.id);
      setConfirmDelete(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            Campos configurables
          </Typography>
          <Typography variant="body2" color="#4b5563">
            Administra los campos dinámicos y sus dependencias.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
          Nuevo campo
        </Button>
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}

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
          rows={rows}
          columns={columns}
          loading={loading}
          density="compact"
          autoHeight
          getRowId={(row) => row.id}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50, 100]}
          localeText={{ noRowsLabel: loading ? 'Cargando…' : 'Sin registros' }}
        />
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Editar campo' : 'Nuevo campo'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Nombre"
            value={form.nombre}
            onChange={(e) => {
              const value = e.target.value;
              setForm((f) => ({
                ...f,
                nombre: value,
                clave: slugify(value),
                tipo_control: inferTipoControl(f.tipo_dato),
              }));
            }}
            required
            size="small"
          />
          <TextField
            label="Clave"
            value={form.clave}
            InputProps={{ readOnly: true }}
            helperText="Se genera automáticamente a partir del nombre"
            size="small"
          />
          <Autocomplete
            options={entidadOptions}
            getOptionLabel={(opt) => opt.label}
            value={entidadOptions.find((o) => o.id === form.entidad_tipo_id) ?? null}
            onChange={(_, value) =>
              setForm((f) => ({
                ...f,
                entidad_tipo_id: value?.id ?? null,
                catalogo_tipo_id: null,
                campo_padre_id: null,
              }))
            }
            renderInput={(params) => (
              <TextField
                {...(params as any)}
                label="Dónde aparece el campo"
                required
                size="small"
                helperText="Selecciona la entidad donde aplicará el campo"
              />
            )}
            loading={loadingOptions}
            loadingText="Cargando entidades..."
            noOptionsText={loadingOptions ? 'Cargando...' : 'Sin entidades disponibles'}
          />
          <TextField
            select
            label="Documento"
            size="small"
            value={form.tipo_documento}
            onChange={(e) => setForm((f) => ({ ...f, tipo_documento: e.target.value, campo_padre_id: null }))}
            helperText="Selecciona un tipo existente"
            SelectProps={{ displayEmpty: true }}
          >
            <MenuItem value="" disabled>
              {loadingOptions ? 'Cargando tipos...' : 'Selecciona un documento'}
            </MenuItem>
            {tipoDocumentoOptions.map((doc) => (
              <MenuItem key={doc.codigo} value={doc.codigo}>
                {doc.nombre || doc.codigo}
              </MenuItem>
            ))}
          </TextField>
          <Autocomplete
            options={TIPO_DATO_OPCIONES}
            getOptionLabel={(opt) => opt?.label ?? ''}
            value={TIPO_DATO_OPCIONES.find((o) => o.value === form.tipo_dato) || TIPO_DATO_OPCIONES[0]}
            onChange={(_, value) =>
              setForm((f) => ({
                ...f,
                tipo_dato: value?.value || 'texto',
                tipo_control: inferTipoControl(value?.value || 'texto'),
                catalogo_tipo_id: value?.value === 'lista' ? f.catalogo_tipo_id : null,
              }))
            }
            renderInput={(params) => <TextField {...(params as any)} label="Tipo de información" required size="small" />}
          />
          {form.tipo_dato === 'lista' ? (
            <Autocomplete
              options={catalogoTipoOptions}
              getOptionLabel={(opt) => opt?.label ?? ''}
              value={catalogoTipoOptions.find((o) => o.id === form.catalogo_tipo_id) || null}
              onChange={(_, value) => setForm((f) => ({ ...f, catalogo_tipo_id: value?.id ?? null }))}
              renderInput={(params) => (
                <TextField
                  {...(params as any)}
                  label="Catálogo"
                  size="small"
                  helperText={form.entidad_tipo_id ? 'Catálogo asociado a la entidad' : 'Selecciona primero la entidad'}
                />
              )}
              disabled={!catalogoTipoOptions.length}
              loading={loadingOptions}
              loadingText="Cargando catálogos..."
              noOptionsText={form.entidad_tipo_id ? 'Sin catálogos para la entidad' : 'Seleccione entidad'}
            />
          ) : null}
          <Autocomplete
            options={parentOptions}
            getOptionLabel={(opt) => opt.nombre || ''}
            value={parentOptions.find((o) => o.id === form.campo_padre_id) || null}
            onChange={(_, value) => setForm((f) => ({ ...f, campo_padre_id: value?.id ?? null }))}
            renderInput={(params) => (
              <TextField
                {...(params as any)}
                label="Campo padre"
                placeholder={form.entidad_tipo_id ? 'Seleccione un padre' : 'Seleccione entidad y tipo de documento'}
                size="small"
                helperText="Permite que este campo dependa de otro (ejemplo: Modelo depende de Marca)."
              />
            )}
            loading={false}
            disabled={!form.entidad_tipo_id}
          />
          <TextField
            label="Orden"
            type="number"
            value={form.orden}
            onChange={(e) => setForm((f) => ({ ...f, orden: e.target.value }))}
            size="small"
            helperText="Define la posición del campo dentro del formulario."
          />
          <FormControlLabel
            control={<Checkbox checked={form.obligatorio} onChange={(e) => setForm((f) => ({ ...f, obligatorio: e.target.checked }))} />}
            label="Obligatorio"
          />
          <FormControlLabel
            control={<Checkbox checked={form.activo} onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))} />}
            label="Activo"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit" variant="outlined" disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar campo</DialogTitle>
        <DialogContent>
          <Typography>¿Eliminar "{confirmDelete?.nombre}"?</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDelete(null)} color="inherit" variant="outlined">
            Cancelar
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}