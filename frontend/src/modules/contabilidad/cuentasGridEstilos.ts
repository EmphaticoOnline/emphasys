import type { Theme } from '@mui/material/styles';
import type { SystemStyleObject } from '@mui/system';

// Densidad y colores compartidos entre Saldos por mes y Saldos por año, para
// que ambas grillas de Cuentas se sientan como variantes de una sola
// pantalla. Se define aquí (no en standardDataGridSx, que es global a toda
// la app) para no afectar Pólizas, Rangos, Tipos de póliza ni el resto de
// grillas del ERP.

export const CUENTAS_GRID_ROW_HEIGHT = 30;

const AZUL_EMPHASYS = '#1d2f68';
const AZUL_EMPHASYS_HOVER = '#28407e';

// Quitar el recuadro de foco por celda (outline azul de MUI DataGrid al dar
// clic/tab sobre una celda individual): la selección visual debe ser por fila
// completa (".fila-seleccionada"), no por celda.
export const cuentasSinFocoDeCeldaSx: SystemStyleObject<Theme> = {
  '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': { outline: 'none' },
  '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': { outline: 'none' },
};

// Densidad compacta (tipografía y padding), igual en ambas vistas.
export const cuentasGridDensidadSx: SystemStyleObject<Theme> = {
  fontSize: 12,
  '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' },
  '& .MuiDataGrid-row': { cursor: 'pointer' },
};

// Selección por renglón completo en azul Emphasys con texto e iconos en
// blanco. Necesita !important porque: (a) la zebra de standardDataGridSx usa
// ":nth-of-type(even)", con la misma especificidad que un simple selector de
// clase, y (b) las celdas de Cuenta/Descripción fijan su propio color
// (afectable vs. no afectable) vía sx inline que hay que sobreescribir.
export const cuentasFilaSeleccionadaSx: SystemStyleObject<Theme> = {
  '& .MuiDataGrid-row.fila-seleccionada': {
    backgroundColor: `${AZUL_EMPHASYS} !important`,
  },
  '& .MuiDataGrid-row.fila-seleccionada:hover': {
    backgroundColor: `${AZUL_EMPHASYS_HOVER} !important`,
  },
  '& .MuiDataGrid-row.fila-seleccionada .MuiDataGrid-cell': {
    color: '#ffffff !important',
  },
  '& .MuiDataGrid-row.fila-seleccionada .MuiIconButton-root': {
    color: '#ffffff !important',
  },
};

export const cuentasFilaLocalizadaSx: SystemStyleObject<Theme> = {
  '& .MuiDataGrid-row.fila-localizada': {
    backgroundColor: '#fef3c7',
    transition: 'background-color 0.3s ease',
  },
  '& .MuiDataGrid-row.fila-localizada:hover': {
    backgroundColor: '#fde68a',
  },
};
