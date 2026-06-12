import type * as React from 'react';
import type {
  DataGridProps,
  GridColumnOrderChangeParams,
  GridColDef,
  GridColumnResizeParams,
  GridColumnVisibilityModel,
  GridRowParams,
  GridSortModel,
} from '@mui/x-data-grid';
import type { CotizacionListado } from '../../types/cotizacion';
import type { GridContextMenuAction } from '../grids/GridContextMenu';

export interface DocumentosViewCommonProps {
  title: string;
  description: string;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onClearSearch: () => void;
  onRefresh: () => void;
  onCreateDocumento: () => void;
  isLoading: boolean;
  showPendingToggle: boolean;
  soloPendientes: boolean;
  onSoloPendientesChange: (checked: boolean) => void;
  filtersContent?: React.ReactNode;
  summaryContent?: React.ReactNode;
  selectionContent?: React.ReactNode;
  extraActionsContent?: React.ReactNode;
}

export interface DocumentosDesktopViewProps extends DocumentosViewCommonProps {
  rows: CotizacionListado[];
  columns: GridColDef[];
  canBulkDuplicate: boolean;
  selectedDocumentIds: number[];
  onSelectedDocumentIdsChange: (ids: number[]) => void;
  onCellClick: NonNullable<DataGridProps['onCellClick']>;
  onRowClick: NonNullable<DataGridProps['onRowClick']>;
  slotProps?: DataGridProps['slotProps'];
  getRowClassName?: DataGridProps['getRowClassName'];
  columnVisibilityModel: GridColumnVisibilityModel;
  sortModel: GridSortModel;
  onSortModelChange: (model: GridSortModel) => void;
  onColumnVisibilityModelChange: (model: GridColumnVisibilityModel) => void;
  onColumnWidthChange: (params: GridColumnResizeParams) => void;
  onColumnOrderChange: (params: GridColumnOrderChangeParams) => void;
  contextMenuActions: GridContextMenuAction[];
  contextMenuPosition: { top: number; left: number } | null;
  contextMenuOpen: boolean;
  onCloseContextMenu: () => void;
  rowCount: number;
  paginationModel: { page: number; pageSize: number };
  onPaginationModelChange: (model: { page: number; pageSize: number }) => void;
}

export interface DocumentosMobileViewProps extends DocumentosViewCommonProps {
  rows: CotizacionListado[];
  canBulkDuplicate: boolean;
  selectedDocumentIds: number[];
  onSelectedDocumentIdsChange: (ids: number[]) => void;
  onOpenDocumento: (id: number) => void;
  onOpenContextMenu: (event: React.MouseEvent<HTMLElement>, row: CotizacionListado) => void;
  contextMenuActions: GridContextMenuAction[];
  contextMenuPosition: { top: number; left: number } | null;
  contextMenuOpen: boolean;
  onCloseContextMenu: () => void;
  formatFolio: (row: CotizacionListado) => string;
  formatDate: (value: string) => string;
  currency: Intl.NumberFormat;
}