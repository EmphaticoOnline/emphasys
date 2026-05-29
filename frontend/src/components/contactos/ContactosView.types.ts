import type * as React from 'react';
import type {
  DataGridProps,
  GridColDef,
  GridColumnOrderChangeParams,
  GridColumnVisibilityModel,
  GridColumnWidthChangeParams,
  GridDensity,
  GridFilterModel,
  GridPaginationModel,
  GridRowId,
  GridRowParams,
  GridRowSelectionModel,
  GridSortModel,
  MuiEvent,
} from '@mui/x-data-grid';
import type { Contacto } from '../../types/contactos.types';
import type { GridContextMenuAction } from '../grids/GridContextMenu';

export type ContactoRow = Contacto & {
  vendedor_nombre?: string | null;
};

export interface ContactosViewCommonProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onClearSearch: () => void;
  tiposOpciones: string[];
  selectedTipos: string[];
  isTodosActivo: boolean;
  onToggleTipo: (tipo: string) => void;
  onCreateContacto: () => void;
}

export interface ContactosDesktopViewProps extends ContactosViewCommonProps {
  contactos: ContactoRow[];
  orderedColumns: GridColDef[];
  rowCount: number;
  loading: boolean;
  paginationModel: GridPaginationModel;
  density: GridDensity;
  sortModel: GridSortModel;
  onSortModelChange: (model: GridSortModel) => void;
  filterModel: GridFilterModel;
  onFilterModelChange: (model: GridFilterModel) => void;
  columnVisibilityModel: GridColumnVisibilityModel;
  onColumnVisibilityModelChange: (model: GridColumnVisibilityModel) => void;
  onPaginationModelChange: (model: GridPaginationModel) => void;
  onColumnWidthChange: (params: GridColumnWidthChangeParams) => void;
  onColumnOrderChange: (params: GridColumnOrderChangeParams) => void;
  selectedRowIds: GridRowSelectionModel;
  onRowSelectionModelChange: (selectionModel: GridRowSelectionModel) => void;
  onRowDoubleClick: (params: GridRowParams, event: MuiEvent<React.MouseEvent<HTMLElement>>) => void;
  slotProps?: DataGridProps['slotProps'];
  contextMenuActions: GridContextMenuAction[];
  contextMenuPosition: { top: number; left: number } | null;
  contextMenuOpen: boolean;
  onCloseContextMenu: () => void;
}

export interface ContactosMobileViewProps extends ContactosViewCommonProps {
  contactos: ContactoRow[];
  rowCount: number;
  loading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onEditContacto: (contactoId: GridRowId) => void;
  onDeleteContacto: (contactoId: GridRowId) => void;
}