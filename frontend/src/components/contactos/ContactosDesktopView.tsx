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
import type { ContactosDesktopViewProps } from './ContactosView.types';
import ContactosAdvancedFilters from './ContactosAdvancedFilters';
import ContactosListaCompacta from './ContactosListaCompacta';
import ContactoWorkspace from './ContactoWorkspace';
import CatalogoModuloToolbar from '../catalogo/CatalogoModuloToolbar';

export default function ContactosDesktopView({
  contactos,
  orderedColumns,
  rowCount,
  loading,
  paginationModel,
  density,
  sortModel,
  onSortModelChange,
  filterModel,
  onFilterModelChange,
  columnVisibilityModel,
  onColumnVisibilityModelChange,
  onPaginationModelChange,
  onColumnWidthChange,
  onColumnOrderChange,
  selectedRowIds,
  onRowSelectionModelChange,
  onRowDoubleClick,
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
  vendedores,
  origenOptions,
  tiposOpciones,
  advancedFilters,
  advancedFiltersCount,
  onToggleFilters,
  onSelectedTiposChange,
  onOrigenContactoIdChange,
  onVendedorIdChange,
  onActivoChange,
  onFechaAltaDesdeChange,
  onFechaAltaHastaChange,
  onInteresInicialChange,
  onObservacionesChange,
  onClearAdvancedFilters,
  onCreateContacto,
  viewMode,
  onViewModeChange,
  selectedContactoId,
  onSelectContacto,
  onEditContacto,
  onDeleteContacto,
  onViewActividades,
  vendedorNombre,
}: ContactosDesktopViewProps) {
  return (
    <Box sx={(theme) => ({ width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: theme.emphasys.canvas.page, ...(viewMode === 'lista' ? { overflow: 'hidden' } : {}) })}>
      {viewMode === 'tabla' ? (
      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5, px: { xs: 1.5, md: 2 }, pt: 1.5, pb: 1.5, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            size="small"
            placeholder="Buscar por empresa, contacto, email, teléfono, interés u observaciones..."
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
            helpHref="/docs/guia-contactos.html"
            onExport={onExport}
            exportLoading={Boolean(exportLoading)}
            onCreate={onCreateContacto}
          />
        </Box>

        <ContactosAdvancedFilters
          rowCount={rowCount}
          vendedores={vendedores}
          origenOptions={origenOptions}
          tiposOpciones={tiposOpciones}
          filters={advancedFilters}
          activeFiltersCount={advancedFiltersCount}
          onToggleFilters={onToggleFilters}
          onSelectedTiposChange={onSelectedTiposChange}
          onOrigenContactoIdChange={onOrigenContactoIdChange}
          onVendedorIdChange={onVendedorIdChange}
          onActivoChange={onActivoChange}
          onFechaAltaDesdeChange={onFechaAltaDesdeChange}
          onFechaAltaHastaChange={onFechaAltaHastaChange}
          onInteresInicialChange={onInteresInicialChange}
          onObservacionesChange={onObservacionesChange}
          onClearAdvancedFilters={onClearAdvancedFilters}
        />

        {viewMode === 'tabla' ? (
          <Box sx={(theme) => ({ width: '100%', backgroundColor: theme.emphasys.content.card, borderRadius: 1, border: `1px solid ${theme.emphasys.content.border}`, overflow: 'hidden' })}>
            <EmphasysDataGrid
              rows={contactos}
              columns={orderedColumns}
              rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
              columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
              autoHeight
              pagination
              paginationMode="server"
              rowCount={rowCount}
              loading={loading}
              paginationModel={paginationModel}
              pageSizeOptions={[25, 50, 100]}
              onPaginationModelChange={onPaginationModelChange}
              density={density}
              sortModel={sortModel}
              onSortModelChange={onSortModelChange}
              filterModel={filterModel}
              onFilterModelChange={onFilterModelChange}
              columnVisibilityModel={columnVisibilityModel}
              onColumnVisibilityModelChange={onColumnVisibilityModelChange}
              onColumnWidthChange={onColumnWidthChange}
              onColumnOrderChange={onColumnOrderChange}
              rowSelectionModel={selectedRowIds}
              onRowSelectionModelChange={onRowSelectionModelChange}
              onRowDoubleClick={onRowDoubleClick}
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
            <ContactosListaCompacta
              contactos={contactos}
              rowCount={rowCount}
              loading={loading}
              paginationModel={paginationModel}
              onPaginationModelChange={onPaginationModelChange}
              selectedContactoId={selectedContactoId}
              onSelectContacto={onSelectContacto}
              onEditContacto={onEditContacto}
              onDeleteContacto={onDeleteContacto}
              onViewActividades={onViewActividades}
              vendedorNombre={vendedorNombre}
              searchTerm={searchTerm}
              onSearchTermChange={onSearchTermChange}
              onClearSearch={onClearSearch}
              onCreate={onCreateContacto}
              onExport={onExport}
              exportLoading={Boolean(exportLoading)}
              filtrosActivos={advancedFiltersCount}
              panelFiltros={(
                <ContactosAdvancedFilters
                  rowCount={rowCount}
                  vendedores={vendedores}
                  origenOptions={origenOptions}
                  tiposOpciones={tiposOpciones}
                  filters={advancedFilters}
                  activeFiltersCount={advancedFiltersCount}
                  onToggleFilters={onToggleFilters}
                  onSelectedTiposChange={onSelectedTiposChange}
                  onOrigenContactoIdChange={onOrigenContactoIdChange}
                  onVendedorIdChange={onVendedorIdChange}
                  onActivoChange={onActivoChange}
                  onFechaAltaDesdeChange={onFechaAltaDesdeChange}
                  onFechaAltaHastaChange={onFechaAltaHastaChange}
                  onInteresInicialChange={onInteresInicialChange}
                  onObservacionesChange={onObservacionesChange}
                  onClearAdvancedFilters={onClearAdvancedFilters}
                  soloPanel
                />
              )}
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
              helpHref="/docs/guia-contactos.html"
            />
            <ContactoWorkspace
              contactoId={selectedContactoId}
              vendedorNombre={vendedorNombre}
              onEditar={onEditContacto}
              onEliminar={onDeleteContacto}
              onVerActividades={onViewActividades}
            />
          </Box>
      ) : null}
    </Box>
  );
}
