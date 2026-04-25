import { Autocomplete, Box, CircularProgress, FormControlLabel, Popover, Switch, TextField } from '@mui/material';
import type { CampoConfiguracion, CampoValorPayload, CatalogoValor } from '../types/camposDinamicos';
import { useMemo, useState } from 'react';
import { HexColorPicker } from 'react-colorful';

type PropsCampos = {
  campo: CampoConfiguracion;
  value?: CampoValorPayload;
  options?: CatalogoValor[];
  loading?: boolean;
  disabled?: boolean;
  onChange: (value: CampoValorPayload) => void;
};

type TipoControlDinamico = 'boolean' | 'text' | 'number' | 'color';

type PropsDirectos = {
  label: string;
  type: TipoControlDinamico;
  value?: string | number | boolean | null;
  disabled?: boolean;
  onChange: (value: string | number | boolean | null) => void;
};

type Props = PropsCampos | PropsDirectos;

function esPropsCampos(props: Props): props is PropsCampos {
  return 'campo' in props;
}

const COLOR_POR_DEFECTO = '#000000';

function normalizarColorHex(value: string | null | undefined): string {
  const raw = (value ?? '').trim().toLowerCase();
  const hex = raw.startsWith('#') ? raw.slice(1) : raw;

  if (/^[0-9a-f]{3}$/.test(hex)) {
    return `#${hex
      .split('')
      .map((char) => `${char}${char}`)
      .join('')}`;
  }

  if (/^[0-9a-f]{6}$/.test(hex)) {
    return `#${hex}`;
  }

  if (/^[0-9a-f]{8}$/.test(hex)) {
    return `#${hex.slice(0, 6)}`;
  }

  return COLOR_POR_DEFECTO;
}

function CampoColorDirecto({ label, value, disabled, onChange }: Omit<PropsDirectos, 'type'>) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const colorActual = normalizarColorHex(typeof value === 'string' ? value : null);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (disabled) return;
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleColorChange = (nextColor: string) => {
    onChange(normalizarColorHex(nextColor));
  };

  const handleInputChange = (nextValue: string) => {
    onChange(normalizarColorHex(nextValue));
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <TextField
        label={label}
        value={colorActual}
        onChange={(e) => handleInputChange(e.target.value)}
        disabled={Boolean(disabled)}
        fullWidth
        size="small"
        InputLabelProps={{ shrink: true }}
        inputProps={{ maxLength: 9 }}
        InputProps={{
          startAdornment: (
            <Box
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={`Seleccionar ${label}`}
              onClick={handleOpen}
              onKeyDown={(event) => {
                if (disabled) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setAnchorEl(event.currentTarget as HTMLElement);
                }
              }}
              sx={{
                width: 24,
                height: 24,
                borderRadius: 0.75,
                border: '1px solid #d1d5db',
                backgroundColor: colorActual,
                cursor: disabled ? 'not-allowed' : 'pointer',
                mr: 1.25,
                flexShrink: 0,
              }}
            />
          ),
        }}
      />

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <Box sx={{ p: 2 }}>
          <HexColorPicker color={colorActual} onChange={handleColorChange} />
        </Box>
      </Popover>
    </Box>
  );
}

function DynamicFieldControlDirecto({ label, type, value, disabled, onChange }: PropsDirectos) {
  if (type === 'boolean') {
    return (
      <FormControlLabel
        control={
          <Switch
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            disabled={Boolean(disabled)}
          />
        }
        label={label}
      />
    );
  }

  if (type === 'number') {
    return (
      <TextField
        label={label}
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        disabled={Boolean(disabled)}
        fullWidth
        size="small"
      />
    );
  }

  if (type === 'color') {
    return <CampoColorDirecto label={label} value={value} disabled={disabled} onChange={onChange} />;
  }

  return (
    <TextField
      label={label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={Boolean(disabled)}
      fullWidth
      size="small"
    />
  );
}

export function DynamicFieldControl(props: Props) {
  if (!esPropsCampos(props)) {
    return <DynamicFieldControlDirecto {...props} />;
  }

  const { campo, value, options = [], loading, disabled, onChange } = props;
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
