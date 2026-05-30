import { Alert, Box, Button, CircularProgress, IconButton, InputAdornment, Paper, Stack, TextField, Toolbar, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { GridContextMenu } from '../grids/GridContextMenu';
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
  error,
  onClearError,
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
  searchTerm,
  onSearchTermChange,
  onClearSearch,
  onRefresh,
  onCreateProducto,
}: ProductosDesktopViewProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Toolbar disableGutters sx={{ justifyContent: 'space-between', alignItems: 'flex-end', pb: 1 }}>
        <Stack spacing={1} sx={{ maxWidth: 480 }}>
          <Box>
            <Typography variant="h5" fontWeight={700} color="#1d2f68">
              Productos
            </Typography>
            <Typography variant="body2" color="#4b5563">
              Gestiona el catálogo básico de productos. Existencias son solo de lectura.
            </Typography>
          </Box>
          <TextField
            size="small"
            placeholder="Buscar por clave o descripción"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
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
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignSelf: 'flex-end' }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onRefresh} disabled={loading}>
            Recargar
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
            + NUEVO
          </Button>
        </Stack>
      </Toolbar>

      {error ? (
        <Alert severity="error" onClose={onClearError}>
          {error}
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <DataGrid
          rows={productos}
          columns={columns}
          rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
          columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
          autoHeight
          density="standard"
          loading={loading}
          disableRowSelectionOnClick
          sortModel={sortModel}
          onSortModelChange={onSortModelChange}
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={onColumnVisibilityModelChange}
          onColumnWidthChange={onColumnWidthChange}
          onColumnOrderChange={onColumnOrderChange}
          onRowClick={onRowClick}
          {...(slotProps ? { slotProps } : {})}
          localeText={esES.components.MuiDataGrid.defaultProps.localeText}
          sx={[
            standardDataGridSx,
            {
              '--DataGrid-overlayHeight': '200px',
              '& .MuiDataGrid-cell': {
                display: 'flex',
                alignItems: 'center',
              },
            },
          ]}
          slots={{
            noRowsOverlay: () => (
              <Stack height="100%" alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                <Typography variant="body2" color="#4b5563">
                  {searchTerm.trim()
                    ? `No hay productos que coincidan con "${searchTerm}".`
                    : 'No hay productos registrados.'}
                </Typography>
              </Stack>
            ),
            loadingOverlay: () => (
              <Stack height="100%" alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                <CircularProgress size={22} />
                <Typography variant="body2" color="text.secondary">
                  Cargando productos...
                </Typography>
              </Stack>
            ),
          }}
          hideFooterPagination
          hideFooterSelectedRowCount
        />
      </Paper>

      <GridContextMenu
        actions={contextMenuActions}
        anchorPosition={contextMenuPosition}
        open={contextMenuOpen}
        onClose={onCloseContextMenu}
      />
    </Box>
  );
}