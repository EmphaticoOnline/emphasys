import { useState } from 'react';
import { Box, ButtonBase, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import type { TratamientoImpuestos } from '../../types/cotizacion';

export const TRATAMIENTO_OPCIONES: { label: string; value: TratamientoImpuestos }[] = [
  { label: 'Operación estándar', value: 'normal' },
  { label: 'Nota de venta', value: 'sin_iva' },
  { label: 'Operación tasa cero', value: 'tasa_cero' },
  { label: 'Operación exenta', value: 'exento' },
];

export const TRATAMIENTO_ABREVIATURA: Record<TratamientoImpuestos, string> = {
  normal: 'EST',
  sin_iva: 'NV',
  tasa_cero: 'T0',
  exento: 'EX',
};

type TratamientoFiscalControlProps = {
  value: TratamientoImpuestos | null | undefined;
  onChange: (value: TratamientoImpuestos) => void;
  disabled?: boolean;
  mostrarEtiqueta?: boolean;
};

export default function TratamientoFiscalControl({ value, onChange, disabled = false, mostrarEtiqueta = true }: TratamientoFiscalControlProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const actual = value || 'normal';
  const etiqueta = TRATAMIENTO_OPCIONES.find((opt) => opt.value === actual)?.label ?? '';

  return (
    <Box sx={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: mostrarEtiqueta ? 0.3 : 0 }}>
      {mostrarEtiqueta && <Typography sx={{ fontSize: 9.5, color: 'rgba(0,0,0,0.6)', pl: 0.25, lineHeight: 1 }}>Tratamiento</Typography>}
      <Box sx={{ height: 34, display: 'flex', alignItems: 'center' }}>
        <Tooltip title={etiqueta}>
          <span>
            <ButtonBase
              onClick={(event) => setAnchor(event.currentTarget)}
              disabled={disabled}
              sx={{
                height: 26,
                gap: 0.4,
                pl: 1.1,
                pr: 0.6,
                borderRadius: 999,
                bgcolor: '#eef2ff',
                border: '1px solid #c9d2e8',
                '&.Mui-disabled': { opacity: 0.7 },
              }}
            >
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: 'primary.main', fontFamily: 'monospace' }}>
                {TRATAMIENTO_ABREVIATURA[actual]}
              </Typography>
              <ArrowDropDownIcon sx={{ fontSize: 17, color: 'primary.main' }} />
            </ButtonBase>
          </span>
        </Tooltip>
      </Box>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {TRATAMIENTO_OPCIONES.map((opt) => (
          <MenuItem
            key={opt.value}
            selected={actual === opt.value}
            onClick={() => {
              onChange(opt.value);
              setAnchor(null);
            }}
            sx={{ gap: 1 }}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#5b6479', fontFamily: 'monospace', width: 24, flexShrink: 0 }}>
              {TRATAMIENTO_ABREVIATURA[opt.value]}
            </Typography>
            <Typography sx={{ fontSize: 12.5 }}>{opt.label}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
