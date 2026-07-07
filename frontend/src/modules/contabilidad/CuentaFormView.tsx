import * as React from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { Cuenta, NivelCuentaInfo } from '../../types/contabilidad';
import { crearCuenta, actualizarCuenta, validarNuevaCuenta, fetchConfiguracionContable } from '../../services/contabilidadService';
import FloatingFormActions from '../../components/FloatingFormActions';
import {
  limpiarCuentaInput,
  parseEstructuraCuentas,
  capacidadMaximaDigitos,
  aplicarMascaraCuenta,
} from '../../utils/cuentaContableMask';

interface FormState {
  cuenta: string;
  descripcion: string;
  afectable: boolean;
  rango_cuenta_id: string;
  subgrupo: string;
  codigo_agrupador_sat: string;
  rubro_presupuesto: string;
  no_considerar_presupuesto: boolean;
  observaciones: string;
  activa: boolean;
}

function buildForm(cuenta: Cuenta | null): FormState {
  return {
    cuenta: cuenta?.cuenta ?? '',
    descripcion: cuenta?.descripcion ?? '',
    afectable: cuenta?.afectable ?? true,
    rango_cuenta_id: cuenta?.rango_cuenta_id ? String(cuenta.rango_cuenta_id) : '',
    subgrupo: cuenta?.subgrupo ?? '',
    codigo_agrupador_sat: cuenta?.codigo_agrupador_sat ?? '',
    rubro_presupuesto: cuenta?.rubro_presupuesto ?? '',
    no_considerar_presupuesto: cuenta?.no_considerar_presupuesto ?? true,
    observaciones: cuenta?.observaciones ?? '',
    activa: cuenta?.activa ?? true,
  };
}

export default function CuentaFormView({
  cuenta,
  onCancel,
  onSaved,
}: {
  cuenta: Cuenta | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(cuenta);
  const [form, setForm] = React.useState<FormState>(() => buildForm(cuenta));
  const [segmentLengths, setSegmentLengths] = React.useState<number[]>([]);
  const [caracterSeparador, setCaracterSeparador] = React.useState<string>('-');
  const [descripcionesFaltantes, setDescripcionesFaltantes] = React.useState<Record<string, string>>({});
  const [validacion, setValidacion] = React.useState<{ cuentas: NivelCuentaInfo[]; cuentaExistente: boolean } | null>(null);
  const [validando, setValidando] = React.useState(false);
  const [errorValidacion, setErrorValidacion] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  React.useEffect(() => {
    if (isEdit) return;
    fetchConfiguracionContable()
      .then((configuracion) => {
        const segmentos = parseEstructuraCuentas(configuracion.estructura_cuentas);
        setSegmentLengths(segmentos);
        setCaracterSeparador(configuracion.caracter_separador);
        setForm((prev) => {
          const digitos = limpiarCuentaInput(prev.cuenta);
          return { ...prev, cuenta: aplicarMascaraCuenta(digitos, segmentos, configuracion.caracter_separador) };
        });
      })
      .catch(() => {
        // Si falla la carga de configuración, el campo cae a captura libre;
        // el backend igual valida y formatea la cuenta al guardar.
      });
  }, [isEdit]);

  const handleChangeCuenta = (valorCrudo: string) => {
    const digitos = limpiarCuentaInput(valorCrudo);
    const maxDigitos = capacidadMaximaDigitos(segmentLengths) || digitos.length;
    const limitado = digitos.slice(0, maxDigitos);
    const formateada = segmentLengths.length
      ? aplicarMascaraCuenta(limitado, segmentLengths, caracterSeparador)
      : limitado;
    handleChange('cuenta', formateada);
  };

  React.useEffect(() => {
    if (isEdit) return;
    if (!form.cuenta) {
      setValidacion(null);
      setErrorValidacion(null);
      return;
    }

    let cancelado = false;
    setValidando(true);
    const timeout = setTimeout(() => {
      validarNuevaCuenta(form.cuenta)
        .then((resp) => {
          if (cancelado) return;
          if (!resp.valida) {
            setValidacion(null);
            setErrorValidacion(resp.message || 'La cuenta no coincide con la estructura configurada');
            return;
          }
          setErrorValidacion(null);
          setValidacion({ cuentas: resp.cuentas ?? [], cuentaExistente: Boolean(resp.cuenta_existente) });
          setDescripcionesFaltantes((prev) => {
            const next: Record<string, string> = {};
            (resp.cuentas ?? []).forEach((nivelInfo) => {
              if (!nivelInfo.es_cuenta_final && !nivelInfo.existe) {
                next[nivelInfo.cuenta] = prev[nivelInfo.cuenta] ?? '';
              }
            });
            return next;
          });
        })
        .catch(() => {
          if (!cancelado) setErrorValidacion('No se pudo validar la cuenta');
        })
        .finally(() => {
          if (!cancelado) setValidando(false);
        });
    }, 400);

    return () => {
      cancelado = true;
      clearTimeout(timeout);
    };
  }, [form.cuenta, isEdit]);

  const cuentasFaltantesIntermedias = React.useMemo(
    () => (validacion?.cuentas ?? []).filter((n) => !n.es_cuenta_final && !n.existe),
    [validacion]
  );

  const handleSave = async () => {
    if (!form.descripcion.trim()) {
      setFormError('La descripción es obligatoria');
      return;
    }

    if (!isEdit) {
      if (!form.cuenta) {
        setFormError('El número de cuenta es obligatorio');
        return;
      }
      if (errorValidacion) {
        setFormError(errorValidacion);
        return;
      }
      if (!validacion) {
        setFormError('Espera a que se valide el número de cuenta');
        return;
      }
      if (validacion.cuentaExistente) {
        setFormError('La cuenta contable ya existe.');
        return;
      }
      for (const nivelInfo of cuentasFaltantesIntermedias) {
        if (!descripcionesFaltantes[nivelInfo.cuenta]?.trim()) {
          setFormError(`Captura la descripción de la cuenta ${nivelInfo.cuenta}`);
          return;
        }
      }
    }

    const rangoCuentaId = form.rango_cuenta_id ? Number(form.rango_cuenta_id) : null;

    try {
      setSaving(true);
      setFormError(null);

      if (isEdit && cuenta) {
        await actualizarCuenta(cuenta.id, {
          descripcion: form.descripcion.trim(),
          afectable: form.afectable,
          rango_cuenta_id: rangoCuentaId,
          subgrupo: form.subgrupo.trim() || null,
          codigo_agrupador_sat: form.codigo_agrupador_sat.trim() || null,
          rubro_presupuesto: form.rubro_presupuesto.trim() || null,
          no_considerar_presupuesto: form.no_considerar_presupuesto,
          observaciones: form.observaciones.trim() || null,
        });
      } else {
        await crearCuenta({
          cuenta: form.cuenta,
          descripcion: form.descripcion.trim(),
          afectable: form.afectable,
          rango_cuenta_id: rangoCuentaId,
          subgrupo: form.subgrupo.trim() || null,
          codigo_agrupador_sat: form.codigo_agrupador_sat.trim() || null,
          rubro_presupuesto: form.rubro_presupuesto.trim() || null,
          no_considerar_presupuesto: form.no_considerar_presupuesto,
          observaciones: form.observaciones.trim() || null,
          activa: form.activa,
          descripciones_faltantes: descripcionesFaltantes,
        });
      }
      onSaved();
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo guardar la cuenta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2.5 }}>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        {isEdit ? 'Editar cuenta' : 'Nueva cuenta'}
      </Typography>

      <Paper sx={{ p: 3, pb: '96px', maxWidth: 640 }}>
        <Stack spacing={2}>
          <TextField
            label="Cuenta"
            required
            value={form.cuenta}
            onChange={(e) => handleChangeCuenta(e.target.value)}
            inputProps={{ maxLength: 32, inputMode: 'numeric' }}
            size="small"
            fullWidth
            disabled={isEdit}
            helperText={
              isEdit
                ? 'El número de cuenta no se puede modificar.'
                : 'Captura solo los dígitos de la cuenta. El sistema aplicará automáticamente la estructura configurada.'
            }
          />

          {!isEdit && form.cuenta && (
            <Box>
              {validando && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="text.secondary">
                    Validando cuenta...
                  </Typography>
                </Stack>
              )}

              {!validando && errorValidacion && <Alert severity="error">{errorValidacion}</Alert>}

              {!validando && validacion && validacion.cuentaExistente && (
                <Alert severity="error">La cuenta contable ya existe.</Alert>
              )}

              {!validando && validacion && !validacion.cuentaExistente && (
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {validacion.cuentas.map((n) => (
                      <Chip
                        key={n.cuenta}
                        label={`${n.cuenta}${n.existe ? ' (existente)' : ' (nueva)'}`}
                        size="small"
                        color={n.existe ? 'default' : n.es_cuenta_final ? 'primary' : 'warning'}
                        variant={n.es_cuenta_final ? 'filled' : 'outlined'}
                      />
                    ))}
                  </Stack>

                  {cuentasFaltantesIntermedias.length > 0 && (
                    <Alert severity="info">
                      Se crearán automáticamente las cuentas intermedias faltantes. Captura una descripción para cada una.
                    </Alert>
                  )}

                  {cuentasFaltantesIntermedias.map((n) => (
                    <TextField
                      key={n.cuenta}
                      label={`Descripción para ${n.cuenta}`}
                      required
                      size="small"
                      fullWidth
                      value={descripcionesFaltantes[n.cuenta] ?? ''}
                      onChange={(e) =>
                        setDescripcionesFaltantes((prev) => ({ ...prev, [n.cuenta]: e.target.value }))
                      }
                    />
                  ))}
                </Stack>
              )}
            </Box>
          )}

          <TextField
            label="Descripción"
            required
            value={form.descripcion}
            onChange={(e) => handleChange('descripcion', e.target.value)}
            inputProps={{ maxLength: 200 }}
            size="small"
            fullWidth
          />

          <FormControlLabel
            control={<Switch checked={form.afectable} onChange={(e) => handleChange('afectable', e.target.checked)} />}
            label={form.afectable ? 'Afectable' : 'No afectable (cuenta acumulativa)'}
          />

          <TextField
            label="Rango de cuenta (ID)"
            helperText="Aún no hay catálogo de rangos disponible; captura el ID si ya lo conoces."
            value={form.rango_cuenta_id}
            onChange={(e) => handleChange('rango_cuenta_id', e.target.value.replace(/\D/g, ''))}
            size="small"
            fullWidth
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Subgrupo"
              value={form.subgrupo}
              onChange={(e) => handleChange('subgrupo', e.target.value)}
              inputProps={{ maxLength: 60 }}
              size="small"
              fullWidth
            />
            <TextField
              label="Código agrupador SAT"
              value={form.codigo_agrupador_sat}
              onChange={(e) => handleChange('codigo_agrupador_sat', e.target.value)}
              inputProps={{ maxLength: 10 }}
              size="small"
              fullWidth
            />
          </Stack>

          <TextField
            label="Rubro de presupuesto"
            value={form.rubro_presupuesto}
            onChange={(e) => handleChange('rubro_presupuesto', e.target.value)}
            inputProps={{ maxLength: 80 }}
            size="small"
            fullWidth
          />

          <FormControlLabel
            control={
              <Switch
                checked={form.no_considerar_presupuesto}
                onChange={(e) => handleChange('no_considerar_presupuesto', e.target.checked)}
              />
            }
            label="No considerar en presupuesto"
          />

          <TextField
            label="Observaciones"
            size="small"
            value={form.observaciones}
            onChange={(e) => handleChange('observaciones', e.target.value)}
            fullWidth
            multiline
            minRows={2}
            inputProps={{ maxLength: 500 }}
          />

          {!isEdit && (
            <FormControlLabel
              control={<Switch checked={form.activa} onChange={(e) => handleChange('activa', e.target.checked)} />}
              label={form.activa ? 'Activa' : 'Inactiva'}
            />
          )}

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
