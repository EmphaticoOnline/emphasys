import { Box, IconButton, InputAdornment, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { GridContextMenu } from '../grids/GridContextMenu';
import { EmphasysDataGrid } from '../grids/EmphasysDataGrid';
import {
  STANDARD_DATA_GRID_HEADER_HEIGHT,
  STANDARD_DATA_GRID_ROW_HEIGHT,
  standardDataGridSx,
} from '../grids/standardDataGridSx';
import { useState } from 'react';
import type { ProductosDesktopViewProps } from './ProductosView.types';
import ProductosListaCompacta from './ProductosListaCompacta';
import ProductoWorkspace, { alternarActivoDeProducto } from './ProductoWorkspace';
import type { Producto } from '../../types/producto';
import CatalogoModuloToolbar from '../catalogo/CatalogoModuloToolbar';

export default function ProductosDesktopView({
  productos,
  columns,
  loading,
  rowCount,
  paginationModel,
  onPaginationModelChange,
  onRowClick,
  sortModel,
  onSortModelChange,
  columnVisibilityModel,
  onColumnVisibilityModelChange,
  onColumnWidthChange,
  onColumnOrderChange,
  slotProps,
  contextMenuActions,
  contextMenuPosition,
  contextMenuOpen,
  onCloseContextMenu,
  onExport,
  exportLoading,
  searchTerm,
  onSearchTermChange,
  onClearSearch,
  onCreateProducto,
  viewMode,
  onViewModeChange,
  esAdmin,
  selectedProductoId,
  onSelectProducto,
  onEditProducto,
  onDeleteProducto,
  onRefresh,
  headerExtra,
  onOpenBiblioteca,
}: ProductosDesktopViewProps) {
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const alternarActivo = async (producto: Producto) => {
    if (togglingId != null) return;
    setTogglingId(producto.id);
    try {
      const actualizado = await alternarActivoDeProducto(producto);
      onRefresh();
      return actualizado;
    } finally {
      setTogglingId(null);
    }
  };
  return (
    <Box
      sx={{
        width: '100%',
        bgcolor: (theme) => theme.emphasys.canvas.page,
        display: 'flex',
        flexDirection: 'column',
        ...(viewMode === 'lista' ? {
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        } : {}),
      }}
    >
      {viewMode === 'tabla' ? (
      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5, px: { xs: 1.5, md: 2 }, pt: 1.5, pb: 1.5, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            size="small"
            placeholder="Buscar por clave o descripción..."
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            sx={(theme) => ({ flex: 1, '& .MuiOutlinedInput-root': { backgroundColor: theme.emphasys.content.card, borderRadius: 2, '& fieldset': { borderColor: theme.emphasys.content.border } } })}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searchTerm ? (
                <InputAdornment position="end">
                  <IconButton aria-label="Borrar búsqueda" size="small" onClick={onClearSearch} edge="end">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
          <CatalogoModuloToolbar
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            helpHref="/docs/guia-productos.html"
            onExport={onExport}
            exportLoading={Boolean(exportLoading)}
            onCreate={onCreateProducto}
            {...(headerExtra ? { extra: headerExtra } : {})}
          />
        </Box>

        {viewMode === 'tabla' ? (
          <Box sx={(theme) => ({ width: '100%', backgroundColor: theme.emphasys.content.card, borderRadius: 1, border: `1px solid ${theme.emphasys.content.border}`, overflow: 'hidden' })}>
            <EmphasysDataGrid
              rows={productos}
              columns={columns}
              rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
              columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
              autoHeight
              pagination
              paginationMode="server"
              rowCount={rowCount}
              paginationModel={paginationModel}
              pageSizeOptions={[25, 50, 100]}
              onPaginationModelChange={onPaginationModelChange}
              loading={loading}
              sortModel={sortModel}
              onSortModelChange={onSortModelChange}
              columnVisibilityModel={columnVisibilityModel}
              onColumnVisibilityModelChange={onColumnVisibilityModelChange}
              onColumnWidthChange={onColumnWidthChange}
              onColumnOrderChange={onColumnOrderChange}
              onRowClick={onRowClick}
              disableRowSelectionOnClick
              {...(slotProps ? { slotProps } : {})}
              hideFooterSelectedRowCount
              sx={[
                standardDataGridSx,
                {
                  '--DataGrid-overlayHeight': '200px',
                  '& .MuiDataGrid-cell': {
                    display: 'flex',
                    alignItems: 'center',
                  },
                  '& .MuiDataGrid-row': {
                    cursor: 'default',
                  },
                },
              ]}
            />
            <GridContextMenu
              actions={contextMenuActions}
              anchorPosition={contextMenuPosition}
              open={contextMenuOpen}
              onClose={onCloseContextMenu}
            />
          </Box>
        ) : null}
      </Box>
      ) : null}
      {viewMode === 'lista' ? (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', alignItems: 'stretch', gap: 0, overflow: 'hidden' }}>
            <ProductosListaCompacta
              productos={productos}
              rowCount={rowCount}
              loading={loading}
              paginationModel={paginationModel}
              onPaginationModelChange={onPaginationModelChange}
              selectedProductoId={selectedProductoId}
              onSelectProducto={onSelectProducto}
              searchTerm={searchTerm}
              onSearchTermChange={onSearchTermChange}
              onClearSearch={onClearSearch}
              onCreate={onCreateProducto}
              onExport={onExport}
              exportLoading={Boolean(exportLoading)}
              onEditProducto={onEditProducto}
              onDeleteProducto={onDeleteProducto}
              onAlternarActivo={alternarActivo}
              togglingId={togglingId}
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
              helpHref="/docs/guia-productos.html"
              {...(onOpenBiblioteca ? { onOpenBiblioteca } : {})}
            />
            <ProductoWorkspace
              productoId={selectedProductoId}
              esAdmin={esAdmin}
              onEditar={onEditProducto}
              onEliminar={onDeleteProducto}
              onChanged={onRefresh}
              onAlternarActivo={alternarActivo}
              alternando={togglingId === selectedProductoId}
            />
          </Box>
      ) : null}
    </Box>
  );
}
