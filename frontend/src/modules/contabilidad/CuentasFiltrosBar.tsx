import * as React from 'react';
import { FormControl, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import { SubVistaSaldosToggle, BotonNuevaCuenta } from './cuentaAcciones';
import type { SubVista } from './CuentasTab';

interface CuentasFiltrosBarProps {
  ejercicio: number | null;
  ejercicios: number[];
  onEjercicioChange: (ejercicio: number) => void;
  localizarCuenta: string;
  onLocalizarCuentaChange: (valor: string) => void;
  buscarDescripcion: string;
  onBuscarDescripcionChange: (valor: string) => void;
  subVista: SubVista;
  onSubVistaChange: (valor: SubVista) => void;
  onNueva: () => void;
}

// Barra de filtros compartida entre Saldos por mes y Saldos por año: mismo
// layout, alturas y tamaños en ambas vistas, para que se sientan como
// variantes de una sola pantalla y no dos pantallas distintas.
export default function CuentasFiltrosBar({
  ejercicio,
  ejercicios,
  onEjercicioChange,
  localizarCuenta,
  onLocalizarCuentaChange,
  buscarDescripcion,
  onBuscarDescripcionChange,
  subVista,
  onSubVistaChange,
  onNueva,
}: CuentasFiltrosBarProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      justifyContent="space-between"
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel id="ejercicio-cuentas-label" sx={{ fontSize: 13 }}>Ejercicio</InputLabel>
          <Select
            labelId="ejercicio-cuentas-label"
            label="Ejercicio"
            value={ejercicio ?? ''}
            onChange={(e) => onEjercicioChange(Number(e.target.value))}
            sx={{ fontSize: 13, '& .MuiSelect-select': { py: 0.65 } }}
          >
            {ejercicios.map((anio) => (
              <MenuItem key={anio} value={anio} sx={{ fontSize: 13 }}>
                {anio}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Localizar cuenta"
          placeholder="Ej. 101 0001"
          size="small"
          value={localizarCuenta}
          onChange={(e) => onLocalizarCuentaChange(e.target.value)}
          sx={{ minWidth: 190, '& .MuiInputBase-input': { fontSize: 13, py: 0.65 }, '& .MuiInputLabel-root': { fontSize: 13 } }}
        />
        <TextField
          label="Buscar descripción"
          placeholder="Ej. Bancos"
          size="small"
          value={buscarDescripcion}
          onChange={(e) => onBuscarDescripcionChange(e.target.value)}
          sx={{ minWidth: 190, '& .MuiInputBase-input': { fontSize: 13, py: 0.65 }, '& .MuiInputLabel-root': { fontSize: 13 } }}
        />
      </Stack>

      <Stack direction="row" spacing={1.5} alignItems="center">
        <SubVistaSaldosToggle subVista={subVista} onChange={onSubVistaChange} />
        <BotonNuevaCuenta onClick={onNueva} />
      </Stack>
    </Stack>
  );
}
