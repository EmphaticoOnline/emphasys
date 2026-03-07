import * as React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Autocomplete,
  Tabs,
  Tab,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';

import type { ProductoBasico, Producto } from '../types/producto';
import { createProducto, fetchProducto, updateProducto, obtenerCatalogosConfigurablesProducto, guardarCatalogosConfigurablesProducto, type CatalogoConfigurablesProductoRespuesta } from '../services/productosService';
import { fetchUnidades, type Unidad } from '../services/unidadesService';

const tipoProductoOptions = ['Inventariable', 'No inventariable', 'Kit'] as const;

const initialForm: ProductoBasico = {
  clave: '',
  descripcion: '',
  clasificacion: '',
  tipo_producto: 'Inventariable',
  activo: true,
  unidad_venta_id: null,
  unidad_inventario_id: null,
};

type CatalogoComercialValor = {
  id: number;
  tipo_catalogo_id: number;
  descripcion: string;
  clave: string | null;
  orden: number | null;
};

type CatalogoComercialTipo = {
  id: number;
  nombre: string | null;
  descripcion: string | null;
  valores: CatalogoComercialValor[];
};

export default function ProductoFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const isEdit = Boolean(id && id !== 'nuevo');
  const [form, setForm] = useState<ProductoBasico>(initialForm);
  const [loading, setLoading] = useState(isEdit);
  const [activeTab, setActiveTab] = useState(0);
  const [loadingUnidades, setLoadingUnidades] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );
  const [productoLoaded, setProductoLoaded] = useState<Producto | null>(null);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [comercialTipos, setComercialTipos] = useState<CatalogoComercialTipo[]>([]);
  const [comercialSeleccionados, setComercialSeleccionados] = useState<Record<number, number[]>>({});
  const [comercialLoading, setComercialLoading] = useState<boolean>(false);
  const [comercialError, setComercialError] = useState<string | null>(null);

  useEffect(() => {
    const loadUnidades = async () => {
      try {
        setLoadingUnidades(true);
        const data = await fetchUnidades();
        setUnidades(data.filter((u) => u.activo));
      } catch (e) {
        setSnackbar({ open: true, message: e instanceof Error ? e.message : 'No se pudieron cargar unidades', severity: 'error' });
      } finally {
        setLoadingUnidades(false);
      }
    };
    loadUnidades();
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    const load = async () => {
      try {
        setLoading(true);
        const producto = await fetchProducto(Number(id));
        setProductoLoaded(producto);
        setForm({
          clave: producto.clave,
          descripcion: producto.descripcion,
          clasificacion: producto.clasificacion ?? '',
          tipo_producto: (producto.tipo_producto as ProductoBasico['tipo_producto']) ?? 'Inventariable',
          activo: producto.activo,
          unidad_venta_id: producto.unidad_venta_id ?? null,
          unidad_inventario_id: producto.unidad_inventario_id ?? null,
        });
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar el producto');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEdit]);

  const buildSeleccionInicial = (
    tipos: CatalogoComercialTipo[],
    seleccionados: number[]
  ): Record<number, number[]> => {
    const setSel = new Set(seleccionados);
    return tipos.reduce<Record<number, number[]>>((acc, tipo) => {
      acc[tipo.id] = tipo.valores.filter((v) => setSel.has(v.id)).map((v) => v.id);
      return acc;
    }, {});
  };

  useEffect(() => {
    let isMounted = true;

    const loadComercial = async () => {
      setComercialLoading(true);
      try {
        const data: CatalogoConfigurablesProductoRespuesta = await obtenerCatalogosConfigurablesProducto(isEdit ? Number(id) : undefined);
        if (!isMounted) return;
        setComercialTipos(data.tipos || []);
        setComercialSeleccionados(buildSeleccionInicial(data.tipos || [], data.seleccionados || []));
        setComercialError(null);
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : 'Error al cargar catálogos comerciales';
        setComercialError(message);
        setComercialTipos([]);
        setComercialSeleccionados({});
      } finally {
        if (isMounted) setComercialLoading(false);
      }
    };

    loadComercial();

    return () => {
      isMounted = false;
    };
  }, [id, isEdit]);

  const handleChange = (field: keyof ProductoBasico, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleComercialChange = (tipoId: number, values: CatalogoComercialValor[]) => {
    setComercialSeleccionados((prev) => ({
      ...prev,
      [tipoId]: values.map((v) => v.id),
    }));
  };

  const obtenerCatalogosSeleccionados = () => {
    const todos = Object.values(comercialSeleccionados).flat();
    return Array.from(new Set(todos));
  };

  const handleSubmit = async () => {
    if (!form.clave.trim() || !form.descripcion.trim()) {
      setSnackbar({ open: true, message: 'Clave y descripción son obligatorias.', severity: 'error' });
      return;
    }
    const payload: ProductoBasico = {
      ...form,
      clave: form.clave.trim(),
      descripcion: form.descripcion.trim(),
      clasificacion: form.clasificacion?.trim() || null,
      tipo_producto: form.tipo_producto || 'Inventariable',
    };

    try {
      setSaving(true);
      let productoId = isEdit && id ? Number(id) : null;

      if (isEdit && id) {
        const actualizado = await updateProducto(Number(id), payload);
        productoId = actualizado?.id ?? productoId;
        setSnackbar({ open: true, message: 'Producto actualizado', severity: 'success' });
      } else {
        const creado = await createProducto(payload);
        productoId = creado?.id ?? null;
        setSnackbar({ open: true, message: 'Producto creado', severity: 'success' });
      }

      if (productoId && Number.isFinite(productoId)) {
        const catalogoIds = obtenerCatalogosSeleccionados();
        await guardarCatalogosConfigurablesProducto(productoId, catalogoIds);
      }
      setTimeout(() => navigate('/productos'), 300);
    } catch (e) {
      setSnackbar({ open: true, message: e instanceof Error ? e.message : 'No se pudo guardar', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const title = isEdit ? 'Editar producto' : 'Nuevo producto';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Toolbar disableGutters sx={{ justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button variant="text" startIcon={<ArrowBackIcon />} onClick={() => navigate('/productos')}>
            Volver
          </Button>
          <Box>
            <Typography variant="h5" fontWeight={700} color="#1d2f68">
              {title}
            </Typography>
            <Typography variant="body2" color="#4b5563">
              Configura los datos básicos del producto. Próximamente se añadirán tabs con más detalles.
            </Typography>
          </Box>
        </Stack>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSubmit}
          disabled={saving || loading}
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </Toolbar>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, p: 3 }}>
        {loading ? (
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <CircularProgress size={20} />
            <Typography color="text.secondary">Cargando producto...</Typography>
          </Stack>
        ) : (
          <Stack spacing={2.5}>
            <Tabs value={activeTab} onChange={handleTabChange} variant="scrollable" allowScrollButtonsMobile>
              <Tab label="General" />
              <Tab label="Comercial" />
            </Tabs>

            {activeTab === 0 && (
              <Stack spacing={2.5}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Clave"
                    value={form.clave}
                    onChange={(e) => handleChange('clave', e.target.value)}
                    required
                    fullWidth
                  />
                  <TextField
                    label="Tipo de producto"
                    select
                    value={form.tipo_producto || 'Inventariable'}
                    onChange={(e) => handleChange('tipo_producto', e.target.value)}
                    fullWidth
                  >
                    {tipoProductoOptions.map((opt) => (
                      <MenuItem key={opt} value={opt}>
                        {opt}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>

                <TextField
                  label="Descripción"
                  value={form.descripcion}
                  onChange={(e) => handleChange('descripcion', e.target.value)}
                  required
                  fullWidth
                  multiline
                  minRows={2}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Clasificación"
                    value={form.clasificacion ?? ''}
                    onChange={(e) => handleChange('clasificacion', e.target.value)}
                    fullWidth
                  />
                  <TextField
                    select
                    label="Unidad de venta"
                    value={form.unidad_venta_id ?? ''}
                    onChange={(e) => handleChange('unidad_venta_id', e.target.value === '' ? null : Number(e.target.value))}
                    fullWidth
                    disabled={loadingUnidades}
                    helperText={loadingUnidades ? 'Cargando unidades...' : 'Opcional'}
                  >
                    {unidades.map((u) => (
                      <MenuItem key={u.id} value={u.id}>
                        {u.descripcion} ({u.clave})
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>

                <TextField
                  select
                  label="Unidad de inventario"
                  value={form.unidad_inventario_id ?? ''}
                  onChange={(e) => handleChange('unidad_inventario_id', e.target.value === '' ? null : Number(e.target.value))}
                  fullWidth
                  disabled={loadingUnidades}
                  helperText={loadingUnidades ? 'Cargando unidades...' : 'Opcional'}
                >
                  {unidades.map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.descripcion} ({u.clave})
                    </MenuItem>
                  ))}
                </TextField>

                {isEdit && productoLoaded && (
                  <TextField
                    label="Existencia actual"
                    value={productoLoaded.existencia_actual ?? 0}
                    InputProps={{ readOnly: true }}
                    fullWidth
                    helperText="Solo lectura"
                  />
                )}

                <FormControlLabel
                  control={
                    <Switch
                      checked={form.activo}
                      onChange={(e) => handleChange('activo', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Activo"
                />

                <Typography variant="caption" color="text.secondary">
                  Este formulario se ampliará con pestañas internas para dimensiones, archivos, impuestos y proveedores.
                </Typography>
              </Stack>
            )}

            {activeTab === 1 && (
              <Stack spacing={2}>
                {comercialLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : comercialError ? (
                  <Typography color="#b91c1c">{comercialError}</Typography>
                ) : !comercialTipos.length ? (
                  <Typography color="#4b5563">No hay catálogos configurables para productos.</Typography>
                ) : (
                  comercialTipos.map((tipo) => {
                    const seleccionadosIds = comercialSeleccionados[tipo.id] || [];
                    const valorSeleccionado = tipo.valores.filter((v) => seleccionadosIds.includes(v.id));

                    return (
                      <Stack key={tipo.id} spacing={1}>
                        <Box>
                          <Typography variant="subtitle1" fontWeight={600} color="#1d2f68">
                            {tipo.nombre || 'Catálogo'}
                          </Typography>
                          {tipo.descripcion ? (
                            <Typography variant="body2" color="#4b5563">
                              {tipo.descripcion}
                            </Typography>
                          ) : null}
                        </Box>

                        <Autocomplete
                          multiple
                          options={tipo.valores}
                          value={valorSeleccionado}
                          getOptionLabel={(option) => option.clave || option.descripcion || ''}
                          onChange={(_, values) => handleComercialChange(tipo.id, values)}
                          renderInput={(params) => (
                            <TextField
                              {...(params as any)}
                              label={tipo.nombre || 'Valores'}
                              placeholder="Selecciona valores"
                              fullWidth
                            />
                          )}
                          noOptionsText="Sin valores"
                          disableCloseOnSelect
                        />
                      </Stack>
                    );
                  })
                )}
              </Stack>
            )}
          </Stack>
        )}
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3200}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
