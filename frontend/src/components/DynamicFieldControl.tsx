import { Autocomplete, CircularProgress, FormControlLabel, Switch, TextField } from '@mui/material';
import type { CampoConfiguracion, CampoValorPayload, CatalogoValor } from '../types/camposDinamicos';
import { useMemo } from 'react';

type Props = {
  campo: CampoConfiguracion;
  value?: CampoValorPayload;
  options?: CatalogoValor[];
  loading?: boolean;
  disabled?: boolean;
  onChange: (value: CampoValorPayload) => void;
};

export function DynamicFieldControl({ campo, value, options = [], loading, disabled, onChange }: Props) {
  const isDisabled = Boolean(disabled);
  const isLoading = Boolean(loading);
  const commonProps = {
    label: campo.nombre,
    required: campo.obligatorio,
    disabled: isDisabled,
    fullWidth: true,
    size: 'small' as const,
  };

  const currentValue = useMemo(() => value ?? { campo_id: campo.id }, [campo.id, value]);

  if (campo.tipo_dato === 'booleano') {
    return (
      <FormControlLabel
        control={
          <Switch
            checked={Boolean(currentValue.valor_boolean)}
            onChange={(e) => onChange({ campo_id: campo.id, valor_boolean: e.target.checked })}
            disabled={isDisabled}
          />
        }
        label={campo.nombre}
      />
    );
  }

  if (campo.tipo_dato === 'fecha') {
    return (
      <TextField
        {...commonProps}
        type="date"
        value={currentValue.valor_fecha || ''}
        onChange={(e) => onChange({ campo_id: campo.id, valor_fecha: e.target.value || null })}
        InputLabelProps={{ shrink: true }}
      />
    );
  }

  if (campo.tipo_dato === 'numero') {
    return (
      <TextField
        {...commonProps}
        type="number"
        value={currentValue.valor_numero ?? ''}
        onChange={(e) => onChange({ campo_id: campo.id, valor_numero: e.target.value === '' ? null : Number(e.target.value) })}
      />
    );
  }

  if (campo.tipo_dato === 'lista') {
    return (
      <Autocomplete
        options={options}
        value={options.find((o) => o.id === currentValue.catalogo_id) || null}
  loading={isLoading}
        getOptionLabel={(opt) => opt.descripcion || ''}
        onChange={(_event, opt) => onChange({ campo_id: campo.id, catalogo_id: opt?.id ?? null })}
        renderInput={(params) => (
          <TextField
            {...(params as any)}
            {...commonProps}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={16} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        isOptionEqualToValue={(opt, val) => opt.id === val.id}
      />
    );
  }

  // texto por defecto
  return (
    <TextField
      {...commonProps}
      value={currentValue.valor_texto ?? ''}
      onChange={(e) => onChange({ campo_id: campo.id, valor_texto: e.target.value })}
    />
  );
}

export default DynamicFieldControl;
