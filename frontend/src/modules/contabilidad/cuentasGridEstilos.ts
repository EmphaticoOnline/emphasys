import type { Theme } from '@mui/material/styles';
import type { SystemStyleObject } from '@mui/system';
import { filaLocalizadaSx, filaSeleccionadaSx } from './contabilidadVisual';

// Densidad compartida entre Saldos por mes y Saldos por año. Se define aquí
// (no en standardDataGridSx, que es global) para no afectar el resto de
// grillas del ERP. Los colores salen de theme.emphasys.

export const CUENTAS_GRID_ROW_HEIGHT = 30;

export const cuentasSinFocoDeCeldaSx: SystemStyleObject<Theme> = {
  '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
  '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': { outline: 'none' },
};

export const cuentasGridDensidadSx: SystemStyleObject<Theme> = {
  fontSize: 13,
  '& .MuiDataGrid-cell': {
    display: 'flex',
    alignItems: 'center',
    fontVariantNumeric: 'tabular-nums',
  },
  '& .MuiDataGrid-row': { cursor: 'pointer' },
};

export const cuentasFilaSeleccionadaSx = filaSeleccionadaSx;
export const cuentasFilaLocalizadaSx = filaLocalizadaSx;
