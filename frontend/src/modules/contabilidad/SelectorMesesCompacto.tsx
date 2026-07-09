import * as React from 'react';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { NOMBRES_MESES } from '../../types/saldosCuentas';

// Mismo tratamiento visual que el segmented control de meses de Pólizas
// (verde institucional Emphasys para el mes activo, tono verdoso muy tenue
// para el resto): se parametriza el tamaño para poder usarlo un poco menos
// compacto en pantallas que no lo necesiten tan apretado como Pólizas.
const VERDE_EMPHASYS = '#006261';
const VERDE_EMPHASYS_OSCURO = '#004a49';

export function SelectorMesesCompacto({
  periodo,
  onChange,
  height = 28,
  fontSize = 12,
}: {
  periodo: number;
  onChange: (periodo: number) => void;
  height?: number;
  fontSize?: number;
}) {
  return (
    <ToggleButtonGroup
      value={periodo}
      exclusive
      onChange={(_e, value) => value && onChange(value)}
      size="small"
      sx={{
        alignSelf: 'flex-start',
        '& .MuiToggleButton-root': {
          height,
          px: 1,
          py: 0,
          fontSize,
          textTransform: 'none',
          border: '1px solid rgba(0, 98, 97, 0.18)',
          // No seleccionado: tono verdoso muy tenue (no blanco plano), con
          // hover ligeramente más marcado pero igual de sobrio.
          bgcolor: 'rgba(0, 98, 97, 0.06)',
          color: '#3f5c5b',
          '&:hover': { bgcolor: 'rgba(0, 98, 97, 0.14)' },
          '&.Mui-selected': {
            bgcolor: VERDE_EMPHASYS,
            color: '#ffffff',
            borderColor: VERDE_EMPHASYS,
            '&:hover': { bgcolor: VERDE_EMPHASYS_OSCURO },
          },
        },
      }}
    >
      {NOMBRES_MESES.map((nombre, index) => (
        <ToggleButton key={nombre} value={index + 1}>
          {nombre.slice(0, 3)}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
