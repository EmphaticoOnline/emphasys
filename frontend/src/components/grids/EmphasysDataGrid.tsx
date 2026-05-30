import type { ReactElement } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import type { DataGridProps, GridValidRowModel } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import {
  STANDARD_DATA_GRID_HEADER_HEIGHT,
  STANDARD_DATA_GRID_ROW_HEIGHT,
  standardDataGridSx,
} from './standardDataGridSx';

export type EmphasysDataGridProps<TRow extends GridValidRowModel> = DataGridProps<TRow> & {
  keepDefaultHeights?: boolean;
};

export function EmphasysDataGrid<TRow extends GridValidRowModel>(props: EmphasysDataGridProps<TRow>): ReactElement {
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
      {...(keepDefaultHeights
        ? {
            rowHeight: rowHeight ?? STANDARD_DATA_GRID_ROW_HEIGHT,
            columnHeaderHeight: columnHeaderHeight ?? STANDARD_DATA_GRID_HEADER_HEIGHT,
          }
        : {
            ...(rowHeight !== undefined ? { rowHeight } : {}),
            ...(columnHeaderHeight !== undefined ? { columnHeaderHeight } : {}),
          })}
      localeText={localeText ?? esES.components.MuiDataGrid.defaultProps.localeText}
      sx={[standardDataGridSx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      {...rest}
    />
  );
}

export default EmphasysDataGrid;
