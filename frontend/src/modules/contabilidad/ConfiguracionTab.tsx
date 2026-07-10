import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import type { ConfiguracionContableInput } from '../../types/contabilidad';
import { fetchConfiguracionContable, actualizarConfiguracionContable } from '../../services/contabilidadService';
import { fetchTiposPoliza } from '../../services/tiposPolizaService';
import type { TipoPoliza } from '../../types/tiposPoliza';
import ConfiguracionCuentasContablesView from './ConfiguracionCuentasContablesView';

const BRAND = '#1d2f68';

type Seccion = 'estructura-cuentas' | 'cuentas-automaticas' | 'tipos-automaticos';

function esSeccionValida(valor: string | null): valor is Seccion {
  return valor === 'estructura-cuentas' || valor === 'cuentas-automaticas' || valor === 'tipos-automaticos';
}

interface FormState {
  estructura_cuentas: string;
  caracter_separador: string;
}

const emptyForm: FormState = {
  estructura_cuentas: '',
  caracter_separador: '',
};

function EstructuraCuentasSection() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );

  const loadConfiguracion = React.useCallback(async () => {
    setLoading(true);
    try {
      const configuracion = await fetchConfiguracionContable();
      setForm({
        estructura_cuentas: configuracion.estructura_cuentas,
        caracter_separador: configuracion.caracter_separador,
      });
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar la configuración contable');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadConfiguracion();
  }, [loadConfiguracion]);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.estructura_cuentas.trim()) {
      setFormError('La estructura de cuentas es obligatoria');
      return;
    }
    const separadorValido = form.caracter_separador.length === 1;
    if (!separadorValido) {
      setFormError('El carácter separador debe ser exactamente un carácter');
      return;
    }

    const payload: ConfiguracionContableInput = {
      estructura_cuentas: form.estructura_cuentas.trim(),
      caracter_separador: form.caracter_separador,
    };

    try {
      setSaving(true);
      setFormError(null);
      await actualizarConfiguracionContable(payload);
      setSnackbar({ open: true, message: 'Configuración contable guardada', severity: 'success' });
      await loadConfiguracion();
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo guardar la configuración contable');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2.5 }}>
      <Paper sx={{ p: 3, maxWidth: 520 }}>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
          Estructura de cuentas
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Parámetros generales del módulo de contabilidad.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Stack spacing={2}>
          <TextField
            label="Estructura de cuentas"
            placeholder="3-4-3"
            helperText="Longitudes de cada segmento del número de cuenta, separadas por guion. Ejemplo: 3-4-3, 3-4-3-3, 4-3-3."
            value={form.estructura_cuentas}
            onChange={(e) => handleChange('estructura_cuentas', e.target.value)}
            size="small"
            fullWidth
            disabled={loading}
            inputProps={{ maxLength: 30 }}
          />

          <TextField
            label="Carácter separador"
            helperText="Un solo carácter: guion, punto, espacio u otro. Se usa para separar visualmente los segmentos de la cuenta."
            value={form.caracter_separador}
            onChange={(e) => handleChange('caracter_separador', e.target.value.slice(0, 1))}
            size="small"
            fullWidth
            disabled={loading}
            inputProps={{ maxLength: 1 }}
          />

          {formError && (
            <Typography color="error" variant="body2">
              {formError}
            </Typography>
          )}

          <Box>
            <Button
              onClick={handleSave}
              disabled={saving || loading}
              variant="contained"
              sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </Box>
        </Stack>
      </Paper>

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

function CuentasAutomaticasSection() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box sx={{ px: { xs: 2, md: 2.5 }, pt: 2.5 }}>
        <Typography variant="h6" fontWeight={600}>
          Cuentas automáticas
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Define qué cuentas contables usará el sistema al contabilizar clientes, proveedores, productos, bancos,
          conceptos, impuestos e inventarios.
        </Typography>
      </Box>
      <ConfiguracionCuentasContablesView />
    </Box>
  );
}

interface TiposAutomaticosFormState {
  tipo_poliza_venta_factura_id: string;
  tipo_poliza_venta_cancelacion_id: string;
}

const emptyTiposAutomaticosForm: TiposAutomaticosFormState = {
  tipo_poliza_venta_factura_id: '',
  tipo_poliza_venta_cancelacion_id: '',
};

function TiposAutomaticosSection() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tiposPoliza, setTiposPoliza] = React.useState<TipoPoliza[]>([]);
  const [form, setForm] = React.useState<TiposAutomaticosFormState>(emptyTiposAutomaticosForm);
  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );

  const loadDatos = React.useCallback(async () => {
    setLoading(true);
    try {
      const [configuracion, tipos] = await Promise.all([fetchConfiguracionContable(), fetchTiposPoliza(true)]);
      setTiposPoliza(tipos);
      setForm({
        tipo_poliza_venta_factura_id:
          configuracion.tipo_poliza_venta_factura_id != null ? String(configuracion.tipo_poliza_venta_factura_id) : '',
        tipo_poliza_venta_cancelacion_id:
          configuracion.tipo_poliza_venta_cancelacion_id != null
            ? String(configuracion.tipo_poliza_venta_cancelacion_id)
            : '',
      });
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar la configuración de tipos automáticos');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadDatos();
  }, [loadDatos]);

  const handleSave = async () => {
    const payload: ConfiguracionContableInput = {
      tipo_poliza_venta_factura_id: form.tipo_poliza_venta_factura_id
        ? Number(form.tipo_poliza_venta_factura_id)
        : null,
      tipo_poliza_venta_cancelacion_id: form.tipo_poliza_venta_cancelacion_id
        ? Number(form.tipo_poliza_venta_cancelacion_id)
        : null,
    };

    try {
      setSaving(true);
      await actualizarConfiguracionContable(payload);
      setSnackbar({ open: true, message: 'Configuración de tipos automáticos guardada', severity: 'success' });
      await loadDatos();
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err?.message || 'No se pudo guardar la configuración de tipos automáticos',
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2.5 }}>
      <Paper sx={{ p: 3, maxWidth: 560 }}>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
          Tipos automáticos
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Define qué tipo de póliza debe usar el motor de contabilización automática, para que ya no se pregunte en
          cada operación.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Typography variant="subtitle2" fontWeight={700} color={BRAND} sx={{ mb: 1.5 }}>
          Ventas
        </Typography>

        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="body2">Factura de venta</Typography>
            <Select
              size="small"
              displayEmpty
              value={form.tipo_poliza_venta_factura_id}
              disabled={loading}
              onChange={(e) => setForm((prev) => ({ ...prev, tipo_poliza_venta_factura_id: e.target.value }))}
            >
              <MenuItem value="">
                <em>Sin configurar</em>
              </MenuItem>
              {tiposPoliza.map((tipo) => (
                <MenuItem key={tipo.id} value={String(tipo.id)}>
                  {tipo.identificador}
                </MenuItem>
              ))}
            </Select>
            <Typography variant="caption" color="text.secondary">
              Tipo de póliza usado al contabilizar la emisión de una factura de venta, individual o en lote.
            </Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="body2">Cancelación de factura de venta</Typography>
            <Select
              size="small"
              displayEmpty
              value={form.tipo_poliza_venta_cancelacion_id}
              disabled={loading}
              onChange={(e) => setForm((prev) => ({ ...prev, tipo_poliza_venta_cancelacion_id: e.target.value }))}
            >
              <MenuItem value="">
                <em>Sin configurar</em>
              </MenuItem>
              {tiposPoliza.map((tipo) => (
                <MenuItem key={tipo.id} value={String(tipo.id)}>
                  {tipo.identificador}
                </MenuItem>
              ))}
            </Select>
            <Typography variant="caption" color="text.secondary">
              Tipo de póliza usado al generar la reversa por cancelación de una factura de venta ya contabilizada.
            </Typography>
          </Stack>

          {tiposPoliza.length === 0 && !loading && (
            <Alert severity="info">No hay tipos de póliza activos. Créalos primero en la pestaña "Tipos de póliza".</Alert>
          )}

          <Box>
            <Button
              onClick={handleSave}
              disabled={saving || loading}
              variant="contained"
              sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#1d2f68', '&:hover': { bgcolor: '#162551' } }}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </Box>
        </Stack>
      </Paper>

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

export default function ConfiguracionTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const seccionParam = searchParams.get('seccion');
  const seccion: Seccion = esSeccionValida(seccionParam) ? seccionParam : 'estructura-cuentas';

  const handleChangeSeccion = (_event: React.SyntheticEvent, nueva: Seccion) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nueva === 'estructura-cuentas') {
        next.delete('seccion');
      } else {
        next.set('seccion', nueva);
      }
      return next;
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: { xs: 2, md: 2.5 }, pt: 2 }}>
        <Tabs
          value={seccion}
          onChange={handleChangeSeccion}
          sx={{
            minHeight: 32,
            borderBottom: '1px solid',
            borderColor: 'divider',
            '& .MuiTab-root': { minHeight: 32, textTransform: 'none', fontWeight: 600, fontSize: 13, py: 0.5 },
            '& .Mui-selected': { color: BRAND },
            '& .MuiTabs-indicator': { backgroundColor: BRAND },
          }}
        >
          <Tab value="estructura-cuentas" label="Estructura de cuentas" />
          <Tab value="cuentas-automaticas" label="Cuentas automáticas" />
          <Tab value="tipos-automaticos" label="Tipos automáticos" />
        </Tabs>
      </Box>

      {seccion === 'estructura-cuentas' && <EstructuraCuentasSection />}
      {seccion === 'cuentas-automaticas' && <CuentasAutomaticasSection />}
      {seccion === 'tipos-automaticos' && <TiposAutomaticosSection />}
    </Box>
  );
}
