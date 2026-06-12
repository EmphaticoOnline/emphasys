import type { SystemStyleObject, Theme } from '@mui/material/styles';

export const STANDARD_DATA_GRID_HEADER_HEIGHT = 38;
export const STANDARD_DATA_GRID_ROW_HEIGHT = 34;

export const standardDataGridSx: SystemStyleObject<Theme> = {
  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: '#1d2f68',
    color: '#ffffff',
    fontSize: 13,
    minHeight: STANDARD_DATA_GRID_HEADER_HEIGHT,
    maxHeight: STANDARD_DATA_GRID_HEADER_HEIGHT,
  },
  '& .MuiDataGrid-columnHeader': {
    backgroundColor: '#1d2f68',
    color: '#ffffff',
  },
  '& .MuiDataGrid-cell': {
    display: 'flex',
    alignItems: 'center',
  },
  '& .MuiDataGrid-columnHeaderTitle': {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 600,
  },
  '& .MuiDataGrid-sortIcon': {
    color: '#ffffff',
  },
  '& .MuiDataGrid-menuIcon': {
    color: '#ffffff',
  },
  '& .MuiDataGrid-iconButtonContainer .MuiSvgIcon-root': {
    color: '#ffffff',
  },
  '& .MuiDataGrid-columnHeader .MuiSvgIcon-root': {
    color: '#ffffff',
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
    backgroundColor: 'rgba(0, 120, 70, 0.05)',
  },
  '& .MuiDataGrid-row:hover': {
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
  },
  '& .MuiDataGrid-row.Mui-selected': {
    backgroundColor: 'rgba(29, 47, 104, 0.08)',
  },
  '& .MuiDataGrid-row.Mui-selected:hover': {
    backgroundColor: 'rgba(29, 47, 104, 0.12)',
  },
  '& .finanzas-header': {
    backgroundColor: '#1d2f68 !important',
    color: '#ffffff !important',
    fontWeight: 600,
  },
  '& .finanzas-header .MuiDataGrid-columnHeaderTitle': {
    color: '#ffffff !important',
    fontWeight: 600,
  },
  '& .finanzas-header .MuiDataGrid-sortIcon': {
    color: '#ffffff !important',
  },
  '& .finanzas-header .MuiDataGrid-menuIcon': {
    color: '#ffffff !important',
  },
  '& .finanzas-header:hover .MuiDataGrid-menuIcon': {
    color: '#ffffff !important',
  },
  '& .finanzas-header .MuiIconButton-root': {
    color: '#ffffff !important',
  },
  '& .finanzas-header .MuiSvgIcon-root': {
    color: '#ffffff !important',
  },
};