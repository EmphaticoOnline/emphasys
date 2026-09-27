import type { Theme } from '@mui/material/styles';
import type { SystemStyleObject } from '@mui/system';

export const STANDARD_DATA_GRID_HEADER_HEIGHT = 38;
export const STANDARD_DATA_GRID_ROW_HEIGHT = 34;

export const standardDataGridSx = (theme: Theme): SystemStyleObject<Theme> => ({
  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: theme.emphasys.grid.header,
    color: theme.emphasys.grid.headerForeground,
    fontSize: 13,
    minHeight: STANDARD_DATA_GRID_HEADER_HEIGHT,
    maxHeight: STANDARD_DATA_GRID_HEADER_HEIGHT,
    borderBottom: 'none',
  },
  // MUI aplica la clase `MuiDataGrid-row--borderBottom` al contenedor de
  // encabezados de forma incondicional (ver useGridColumnHeaders.js), lo
  // que le mete `border-bottom: 1px solid var(--DataGrid-rowBorderColor)`
  // a cada celda de encabezado. Ese color por defecto es un gris casi
  // blanco (lighten(divider, 0.88) en tema claro), que contra el azul
  // institucional se ve como una línea blanca separando el encabezado de
  // la primera fila. El selector de MUI son dos clases encadenadas
  // (mayor especificidad que un solo `.MuiDataGrid-columnHeader`), así
  // que hace falta !important para ganarle sin importar el orden de las
  // reglas en la hoja de estilos.
  '& .MuiDataGrid-columnHeader': {
    backgroundColor: theme.emphasys.grid.header,
    color: theme.emphasys.grid.headerForeground,
    borderBottom: 'none !important',
  },
  '& .MuiDataGrid-row--borderBottom .MuiDataGrid-filler, & .MuiDataGrid-row--borderBottom .MuiDataGrid-scrollbarFiller': {
    borderBottom: 'none !important',
  },
  '& .MuiDataGrid-cell': {
    display: 'flex',
    alignItems: 'center',
  },
  '& .MuiDataGrid-columnHeaderTitle': {
    color: theme.emphasys.grid.headerForeground,
    fontSize: 13,
    fontWeight: 600,
  },
  '& .MuiDataGrid-sortIcon': {
    color: theme.emphasys.grid.headerForeground,
  },
  '& .MuiDataGrid-menuIcon': {
    color: theme.emphasys.grid.headerForeground,
  },
  '& .MuiDataGrid-iconButtonContainer .MuiSvgIcon-root': {
    color: theme.emphasys.grid.headerForeground,
  },
  '& .MuiDataGrid-columnHeader .MuiSvgIcon-root': {
    color: theme.emphasys.grid.headerForeground,
  },
  // GridIconButtonContainer default: visibility:hidden; width:0.
  // Restore visibility for sorted/filtered columns and on hover.
  '& .MuiDataGrid-columnHeader--sorted .MuiDataGrid-iconButtonContainer': {
    visibility: 'visible',
    width: 'auto',
  },
  '& .MuiDataGrid-columnHeader--filtered .MuiDataGrid-iconButtonContainer': {
    visibility: 'visible',
    width: 'auto',
  },
  '& .MuiDataGrid-columnHeader:hover .MuiDataGrid-iconButtonContainer': {
    visibility: 'visible',
    width: 'auto',
  },
  // Ensure sort button is fully opaque when column is sorted.
  '& .MuiDataGrid-columnHeader--sorted .MuiDataGrid-sortButton': {
    opacity: 1,
  },
  '& .MuiDataGrid-columnSeparator': {
    color: 'rgba(255,255,255,0.25)',
  },
  '& .MuiDataGrid-row:nth-of-type(even)': {
    backgroundColor: theme.emphasys.grid.stripe,
  },
  '& .MuiDataGrid-row:hover': {
    backgroundColor: theme.emphasys.grid.hover,
  },
  '& .MuiDataGrid-row.Mui-selected': {
    backgroundColor: theme.emphasys.grid.selected,
  },
  '& .MuiDataGrid-row.Mui-selected:hover': {
    backgroundColor: theme.emphasys.grid.selectedHover,
  },
  '& .finanzas-header': {
    backgroundColor: `${theme.emphasys.grid.header} !important`,
    color: `${theme.emphasys.grid.headerForeground} !important`,
    fontWeight: 600,
  },
  '& .finanzas-header .MuiDataGrid-columnHeaderTitle': {
    color: `${theme.emphasys.grid.headerForeground} !important`,
    fontWeight: 600,
  },
  '& .finanzas-header .MuiDataGrid-sortIcon': {
    color: `${theme.emphasys.grid.headerForeground} !important`,
  },
  '& .finanzas-header .MuiDataGrid-menuIcon': {
    color: `${theme.emphasys.grid.headerForeground} !important`,
  },
  '& .finanzas-header:hover .MuiDataGrid-menuIcon': {
    color: `${theme.emphasys.grid.headerForeground} !important`,
  },
  '& .finanzas-header .MuiIconButton-root': {
    color: `${theme.emphasys.grid.headerForeground} !important`,
  },
  '& .finanzas-header .MuiSvgIcon-root': {
    color: `${theme.emphasys.grid.headerForeground} !important`,
  },
});