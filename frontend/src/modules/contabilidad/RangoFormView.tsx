import * as React from 'react';
import {
  Box,
  FormControl,
  FormControlLabel,
  FormLabel,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { RangoCuenta } from '../../types/rangosCuentas';
import { GRUPOS_RANGO_CUENTA, SUBGRUPOS_RESULTADOS, SUBGRUPOS_NO_RESULTADOS, subgruposValidosParaGrupo } from '../../types/rangosCuentas';
import { crearRangoCuenta, actualizarRangoCuenta } from '../../services/rangosCuentasService';
import FloatingFormActions from '../../components/FloatingFormActions';

const TODOS_LOS_SUBGRUPOS = [...SUBGRUPOS_RESULTADOS, ...SUBGRUPOS_NO_RESULTADOS];

interface FormState {
  limite_superior: string;
  naturaleza_saldo: 'D' | 'A';
  descripcion: string;
  grupo: string;
  subgrupo: string;
  activo: boolean;
}

function buildForm(rango: RangoCuenta | null): FormState {
  return {
    limite_superior: rango ? String(rango.limite_superior) : '',
    naturaleza_saldo: rango?.naturaleza_saldo ?? 'D',
    descripcion: rango?.descripcion ?? '',
    grupo: rango?.grupo ?? '',
    subgrupo: rango?.subgrupo ?? '',
    activo: rango?.activo ?? true,
  };
}

export default function RangoFormView({
  rango,
  onCancel,
  onSaved,
}: {
  rango: RangoCuenta | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(rango);
  const [form, setForm] = React.useState<FormState>(() => buildForm(rango));
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleChangeGrupo = (nuevoGrupo: string) => {
    setForm((prev) => {
      const subgruposValidos = subgruposValidosParaGrupo(nuevoGrupo);
      if (subgruposValidos.includes(prev.subgrupo)) {
        return { ...prev, grupo: nuevoGrupo };
      }
      const esGrupoDeResultados = nuevoGrupo === 'Ingresos' || nuevoGrupo === 'Egresos';
      return { ...prev, grupo: nuevoGrupo, subgrupo: esGrupoDeResultados ? '' : 'Ninguno' };
    });
  };

  const handleSave = async () => {
    const limiteSuperiorNumerico = Number(form.limite_superior);
    if (!form.limite_superior.trim() || !Number.isInteger(limiteSuperiorNumerico) || limiteSuperiorNumerico <= 0) {
      setFormError('El límite superior debe ser un número entero positivo');
      return;
    }
    if (!form.descripcion.trim()) {
      setFormError('La descripción es obligatoria');
      return;
    }
    if (!form.grupo) {
      setFormError('El grupo es obligatorio');
      return;
    }
    const subgruposValidos = subgruposValidosParaGrupo(form.grupo);
    if (!form.subgrupo || !subgruposValidos.includes(form.subgrupo)) {
      setFormError('Selecciona un subgrupo válido para el grupo elegido');
      return;
    }

    try {
      setSaving(true);
      setFormError(null);

      if (isEdit && rango) {
        await actualizarRangoCuenta(rango.id, {
          limite_superior: limiteSuperiorNumerico,
          naturaleza_saldo: form.naturaleza_saldo,
          descripcion: form.descripcion.trim(),
          grupo: form.grupo,
          subgrupo: form.subgrupo,
          activo: form.activo,
        });
      } else {
        await crearRangoCuenta({
          limite_superior: limiteSuperiorNumerico,
          naturaleza_saldo: form.naturaleza_saldo,
          descripcion: form.descripcion.trim(),
          grupo: form.grupo,
          subgrupo: form.subgrupo,
          activo: form.activo,
        });
      }
      onSaved();
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo guardar el rango');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2.5 }}>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        {isEdit ? 'Editar rango' : 'Nuevo rango'}
      </Typography>

      <Paper sx={{ p: 3, pb: '96px', maxWidth: 640 }}>
        <Stack spacing={2}>
          <FormControl>
            <FormLabel id="naturaleza-saldo-label">Naturaleza del saldo</FormLabel>
            <RadioGroup
              row
              aria-labelledby="naturaleza-saldo-label"
              value={form.naturaleza_saldo}
              onChange={(e) => handleChange('naturaleza_saldo', e.target.value as 'D' | 'A')}
            >
              <FormControlLabel value="D" control={<Radio />} label="Deudora" />
              <FormControlLabel value="A" control={<Radio />} label="Acreedora" />
            </RadioGroup>
          </FormControl>

          <TextField
            label="Descripción del rango"
            required
            value={form.descripcion}
            onChange={(e) => handleChange('descripcion', e.target.value)}
            inputProps={{ maxLength: 80 }}
            size="small"
            fullWidth
          />

          <TextField
            label="Límite superior"
            required
            value={form.limite_superior}
            onChange={(e) => handleChange('limite_superior', e.target.value.replace(/\D/g, ''))}
            inputProps={{ maxLength: 9, inputMode: 'numeric' }}
            size="small"
            fullWidth
            placeholder="Ej. 130"
            helperText="Número entero: primer segmento máximo de cuenta que cae en este rango."
          />

          <FormControl size="small" fullWidth required>
            <InputLabel id="grupo-label">Grupo</InputLabel>
            <Select
              labelId="grupo-label"
              label="Grupo"
              value={form.grupo}
              onChange={(e) => handleChangeGrupo(e.target.value)}
            >
              {GRUPOS_RANGO_CUENTA.map((g) => (
                <MenuItem key={g} value={g}>
                  {g}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth required>
            <InputLabel id="subgrupo-label">Subgrupo</InputLabel>
            <Select
              labelId="subgrupo-label"
              label="Subgrupo"
              value={form.subgrupo}
              onChange={(e) => handleChange('subgrupo', e.target.value)}
            >
              {TODOS_LOS_SUBGRUPOS.map((s) => {
                const disponible = form.grupo ? subgruposValidosParaGrupo(form.grupo).includes(s) : true;
                return (
                  <MenuItem key={s} value={s} disabled={!disponible}>
                    {s}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

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
