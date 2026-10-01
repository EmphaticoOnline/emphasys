import * as React from 'react';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { NOMBRES_MESES } from '../../types/saldosCuentas';
import { mesesToggleSx } from './contabilidadVisual';

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
      sx={(theme) => mesesToggleSx(theme, height, fontSize)}
    >
      {NOMBRES_MESES.map((nombre, index) => (
        <ToggleButton key={nombre} value={index + 1}>
          {nombre.slice(0, 3)}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
