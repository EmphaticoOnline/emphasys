import type {
  DataGridProps,
  GridColDef,
  GridColumnOrderChangeParams,
  GridColumnResizeParams,
  GridColumnVisibilityModel,
  GridRowId,
  GridRowParams,
  GridSortModel,
} from '@mui/x-data-grid';
import type { Producto } from '../../types/producto';
import type { GridContextMenuAction } from '../grids/GridContextMenu';

export interface ProductosViewCommonProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onClearSearch: () => void;
  onRefresh: () => void;
  onCreateProducto: () => void;
}

export interface ProductosDesktopViewProps extends ProductosViewCommonProps {
  productos: Producto[];
  columns: GridColDef[];
  loading: boolean;
  error: string | null;
  onClearError: () => void;
  onRowClick: (params: GridRowParams) => void;
  sortModel: GridSortModel;
  onSortModelChange: (model: GridSortModel) => void;
  columnVisibilityModel: GridColumnVisibilityModel;
  onColumnVisibilityModelChange: (model: GridColumnVisibilityModel) => void;
  onColumnWidthChange: (params: GridColumnResizeParams) => void;
  onColumnOrderChange: (params: GridColumnOrderChangeParams) => void;
  slotProps?: DataGridProps['slotProps'];
  contextMenuActions: GridContextMenuAction[];
  contextMenuPosition: { top: number; left: number } | null;
  contextMenuOpen: boolean;
  onCloseContextMenu: () => void;
  onExport: () => void;
  exportLoading?: boolean;
}

export interface ProductosMobileViewProps extends ProductosViewCommonProps {
  productos: Producto[];
  loading: boolean;
  error: string | null;
  onClearError: () => void;
  onEditProducto: (productoId: GridRowId) => void;
  onDeleteProducto: (producto: Producto) => void;
}