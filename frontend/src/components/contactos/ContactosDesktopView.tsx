import { Box, Button, CircularProgress, IconButton, InputAdornment, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import DownloadIcon from '@mui/icons-material/Download';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
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
    <Box sx={{ width: '100%', px: 3, pt: 2, pb: 0, display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            size="small"
            placeholder="Buscar por empresa, contacto, email, teléfono, interés u observaciones..."
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            sx={{ flex: 1 }}
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
          <Stack direction="row" spacing={1}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={viewMode}
              onChange={(_, value) => {
                if (value) onViewModeChange(value);
              }}
            >
              <ToggleButton value="lista" aria-label="Vista de lista">
                <Tooltip title="Vista de lista">
                  <ViewListOutlinedIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="tabla" aria-label="Vista de tabla">
                <Tooltip title="Vista de tabla">
                  <TableChartOutlinedIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
            <Tooltip title="Guía de ayuda">
              <IconButton
                aria-label="Abrir guía de ayuda"
                size="small"
                onClick={() => window.open('/docs/guia-contactos.html', '_blank')}
                sx={{ color: '#64748b' }}
              >
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={exportLoading ? <CircularProgress size={14} /> : <DownloadIcon />}
              onClick={onExport}
              disabled={Boolean(exportLoading)}
            >
              Exportar
            </Button>
            <Button
              variant="contained"
              onClick={onCreateContacto}
              sx={{
                textTransform: 'uppercase',
                fontWeight: 700,
                backgroundColor: '#1d2f68',
                color: '#ffffff',
                '&:hover': { backgroundColor: '#162551' },
              }}
            >
              + Nuevo
            </Button>
          </Stack>
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
        ) : (
          <Box sx={{ width: '100%', display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
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
            />
            <ContactoWorkspace
              contactoId={selectedContactoId}
              vendedorNombre={vendedorNombre}
              onEditar={onEditContacto}
              onEliminar={onDeleteContacto}
              onVerActividades={onViewActividades}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
