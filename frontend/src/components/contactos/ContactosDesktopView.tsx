import { Box, Button, IconButton, InputAdornment, Stack, TextField, Typography } from '@mui/material';
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
}: ContactosDesktopViewProps) {
  return (
    <Box sx={{ width: '100%', px: 3, py: 0, display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 260 }}>
            <Box>
              <Typography variant="h5" fontWeight={600} color="#1d2f68">Contactos</Typography>
              <Typography variant="body2" color="#4b5563">Gestiona y consulta tus contactos registrados.</Typography>
            </Box>
            <TextField
              size="small"
              placeholder="Buscar por empresa, contacto, email, teléfono, interés u observaciones"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              sx={{ maxWidth: 360 }}
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
          </Box>
          <Button
            variant="contained"
            onClick={onCreateContacto}
            sx={{
              textTransform: 'uppercase',
              fontWeight: 700,
              backgroundColor: '#1d2f68',
              color: '#ffffff',
              '&:hover': { backgroundColor: '#162551' },
              alignSelf: 'flex-end',
            }}
          >
            + NUEVO
          </Button>
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

        <Box sx={{ width: '100%', backgroundColor: '#fff', borderRadius: 1, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
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
      </Box>
    </Box>
  );
}