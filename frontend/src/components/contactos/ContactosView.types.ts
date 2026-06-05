import type * as React from 'react';
import type {
  DataGridProps,
  GridColDef,
  GridColumnOrderChangeParams,
  GridColumnVisibilityModel,
  GridColumnResizeParams,
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

export type ContactoActivoFilter = 'todos' | 'activos' | 'inactivos';

export type ContactoOrigenOption = {
  id: number;
  clave: string | null;
  descripcion: string;
  label: string;
};

export type ContactosAdvancedFiltersState = {
  selectedTipos: string[];
  origenContactoId: number | null;
  vendedorId: number | null;
  activo: ContactoActivoFilter;
  fechaAltaDesde: string;
  fechaAltaHasta: string;
  interesInicial: string;
  observaciones: string;
  filtersOpen: boolean;
};

export type ContactoRow = Contacto & {
  vendedor_nombre?: string | null;
};

export interface ContactosViewCommonProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onClearSearch: () => void;
  onCreateContacto: () => void;
  rowCount: number;
  vendedores: Contacto[];
  origenOptions: ContactoOrigenOption[];
  tiposOpciones: string[];
  advancedFilters: ContactosAdvancedFiltersState;
  advancedFiltersCount: number;
  onToggleFilters: () => void;
  onSelectedTiposChange: (tipos: string[]) => void;
  onOrigenContactoIdChange: (value: number | null) => void;
  onVendedorIdChange: (value: number | null) => void;
  onActivoChange: (value: ContactoActivoFilter) => void;
  onFechaAltaDesdeChange: (value: string) => void;
  onFechaAltaHastaChange: (value: string) => void;
  onInteresInicialChange: (value: string) => void;
  onObservacionesChange: (value: string) => void;
  onClearAdvancedFilters: () => void;
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
  onColumnWidthChange: (params: GridColumnResizeParams) => void;
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
  loading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onEditContacto: (contactoId: GridRowId) => void;
  onViewActividades: (contacto: ContactoRow) => void;
  onDeleteContacto: (contactoId: GridRowId) => void;
}