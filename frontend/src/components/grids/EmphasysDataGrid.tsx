import type { ReactElement } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import type { DataGridProps } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import {
  STANDARD_DATA_GRID_HEADER_HEIGHT,
  STANDARD_DATA_GRID_ROW_HEIGHT,
  standardDataGridSx,
} from './standardDataGridSx';

export type EmphasysDataGridProps<TRow> = DataGridProps<TRow> & {
  keepDefaultHeights?: boolean;
};

export function EmphasysDataGrid<TRow>(props: EmphasysDataGridProps<TRow>): ReactElement {
  const {
    keepDefaultHeights = true,
    localeText,
    sx,
    rowHeight,
    columnHeaderHeight,
    ...rest
  } = props;

  return (
    <DataGrid
      rowHeight={keepDefaultHeights ? (rowHeight ?? STANDARD_DATA_GRID_ROW_HEIGHT) : rowHeight}
      columnHeaderHeight={keepDefaultHeights ? (columnHeaderHeight ?? STANDARD_DATA_GRID_HEADER_HEIGHT) : columnHeaderHeight}
      localeText={localeText ?? esES.components.MuiDataGrid.defaultProps.localeText}
      sx={[standardDataGridSx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      {...rest}
    />
  );
}

export default EmphasysDataGrid;
