import * as React from 'react';
import { Alert, Box, Button, Paper, Snackbar, Stack, TextField, Typography } from '@mui/material';
import type { ConfiguracionContableInput } from '../../types/contabilidad';
import { fetchConfiguracionContable, actualizarConfiguracionContable } from '../../services/contabilidadService';

interface FormState {
  estructura_cuentas: string;
  caracter_separador: string;
}

const emptyForm: FormState = {
  estructura_cuentas: '',
  caracter_separador: '',
};

export default function ConfiguracionTab() {
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
          Configuración contable
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
