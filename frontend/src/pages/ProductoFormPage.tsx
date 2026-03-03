import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
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
import { createProducto, fetchProducto, updateProducto } from '../services/productosService';

const tipoProductoOptions = ['Inventariable', 'No inventariable', 'Kit'] as const;

const initialForm: ProductoBasico = {
  clave: '',
  descripcion: '',
  clasificacion: '',
  tipo_producto: 'Inventariable',
  precio_publico: null,
  activo: true,
};

export default function ProductoFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const isEdit = Boolean(id && id !== 'nuevo');
  const [form, setForm] = useState<ProductoBasico>(initialForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );
  const [productoLoaded, setProductoLoaded] = useState<Producto | null>(null);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
      }),
    []
  );

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
          precio_publico: producto.precio_publico ?? null,
          activo: producto.activo,
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

  const handleChange = (field: keyof ProductoBasico, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
      precio_publico: form.precio_publico ?? null,
    };

    try {
      setSaving(true);
      if (isEdit && id) {
        await updateProducto(Number(id), payload);
        setSnackbar({ open: true, message: 'Producto actualizado', severity: 'success' });
      } else {
        await createProducto(payload);
        setSnackbar({ open: true, message: 'Producto creado', severity: 'success' });
      }
      setTimeout(() => navigate('/productos'), 300);
    } catch (e) {
      setSnackbar({ open: true, message: e instanceof Error ? e.message : 'No se pudo guardar', severity: 'error' });
    } finally {
      setSaving(false);
    }
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
                label="Precio público"
                value={form.precio_publico ?? ''}
                onChange={(e) => handleChange('precio_publico', e.target.value === '' ? null : Number(e.target.value))}
                type="number"
                inputProps={{ min: 0, step: '0.01' }}
                fullWidth
                helperText={form.precio_publico ? formatter.format(Number(form.precio_publico)) : 'Opcional'}
              />
            </Stack>

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
