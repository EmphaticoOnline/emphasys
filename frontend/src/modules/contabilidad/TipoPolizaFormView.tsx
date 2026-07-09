import * as React from 'react';
import { Box, FormControlLabel, Paper, Stack, Switch, TextField, Typography } from '@mui/material';
import type { TipoPoliza } from '../../types/tiposPoliza';
import { crearTipoPoliza, actualizarTipoPoliza } from '../../services/tiposPolizaService';
import FloatingFormActions from '../../components/FloatingFormActions';

interface FormState {
  identificador: string;
  poliza_inicial: string;
  activo: boolean;
}

function buildForm(tipo: TipoPoliza | null): FormState {
  return {
    identificador: tipo?.identificador ?? '',
    poliza_inicial: tipo ? String(tipo.poliza_inicial) : '1',
    activo: tipo?.activo ?? true,
  };
}

export default function TipoPolizaFormView({
  tipo,
  onCancel,
  onSaved,
}: {
  tipo: TipoPoliza | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(tipo);
  const [form, setForm] = React.useState<FormState>(() => buildForm(tipo));
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.identificador.trim()) {
      setFormError('El identificador es obligatorio');
      return;
    }
    const polizaInicialNumerica = Number(form.poliza_inicial);
    if (!form.poliza_inicial.trim() || !Number.isInteger(polizaInicialNumerica) || polizaInicialNumerica <= 0) {
      setFormError('La póliza inicial debe ser un número entero mayor que cero');
      return;
    }

    try {
      setSaving(true);
      setFormError(null);

      const payload = {
        identificador: form.identificador.trim(),
        poliza_inicial: polizaInicialNumerica,
        activo: form.activo,
      };

      if (isEdit && tipo) {
        await actualizarTipoPoliza(tipo.id, payload);
      } else {
        await crearTipoPoliza(payload);
      }
      onSaved();
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo guardar el tipo de póliza');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2.5 }}>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        {isEdit ? 'Editar tipo de póliza' : 'Nuevo tipo de póliza'}
      </Typography>

      <Paper sx={{ p: 3, pb: '96px', maxWidth: 480 }}>
        <Stack spacing={2}>
          <TextField
            label="Identificador"
            required
            value={form.identificador}
            onChange={(e) => handleChange('identificador', e.target.value)}
            inputProps={{ maxLength: 50 }}
            size="small"
            fullWidth
            placeholder="Ej. Diario, Ingresos, Egresos"
          />

          <TextField
            label="Póliza inicial"
            required
            value={form.poliza_inicial}
            onChange={(e) => handleChange('poliza_inicial', e.target.value.replace(/\D/g, ''))}
            inputProps={{ maxLength: 9, inputMode: 'numeric' }}
            size="small"
            fullWidth
            helperText="Número inicial sugerido para pólizas de este tipo."
          />

          <FormControlLabel
            control={<Switch checked={form.activo} onChange={(e) => handleChange('activo', e.target.checked)} />}
            label={form.activo ? 'Activo' : 'Inactivo'}
          />

          {formError && (
            <Typography color="error" variant="body2">
              {formError}
            </Typography>
          )}
        </Stack>
      </Paper>

      <FloatingFormActions
        onBack={onCancel}
        backDisabled={saving}
        onSave={handleSave}
        saving={saving}
        saveDisabled={saving}
      />
    </Box>
  );
}
