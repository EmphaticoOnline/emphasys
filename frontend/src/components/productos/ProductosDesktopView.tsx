import { Box, Button, CircularProgress, IconButton, InputAdornment, Stack, TextField, Tooltip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import DownloadIcon from '@mui/icons-material/Download';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { GridContextMenu } from '../grids/GridContextMenu';
import { EmphasysDataGrid } from '../grids/EmphasysDataGrid';
import {
  STANDARD_DATA_GRID_HEADER_HEIGHT,
  STANDARD_DATA_GRID_ROW_HEIGHT,
  standardDataGridSx,
} from '../grids/standardDataGridSx';
import type { ProductosDesktopViewProps } from './ProductosView.types';

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
}: ProductosDesktopViewProps) {
  return (
    <Box sx={{ width: '100%', px: 3, pt: 2, pb: 0, display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            size="small"
            placeholder="Buscar por clave o descripción..."
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
            <Tooltip title="Guía de ayuda">
              <IconButton
                aria-label="Abrir guía de ayuda"
                size="small"
                onClick={() => window.open('/docs/guia-productos.html', '_blank')}
                sx={{ color: '#64748b' }}
              >
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={exportLoading ? <CircularProgress size={14} /> : <DownloadIcon />}
              onClick={onExport}
              disabled={exportLoading ?? false}
            >
              Exportar
            </Button>
            <Button
              variant="contained"
              onClick={onCreateProducto}
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

        <Box sx={{ width: '100%', backgroundColor: '#fff', borderRadius: 1, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
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
      </Box>
    </Box>
  );
}
