import * as React from 'react';
import { Box, Button, Checkbox, CircularProgress, Divider, Drawer, FormControlLabel, IconButton, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import { GridContextMenu } from '../grids/GridContextMenu';
import { EmphasysDataGrid } from '../grids/EmphasysDataGrid';
import {
  STANDARD_DATA_GRID_HEADER_HEIGHT,
  STANDARD_DATA_GRID_ROW_HEIGHT,
  standardDataGridSx,
} from '../grids/standardDataGridSx';
import type { DocumentosDesktopViewProps } from './DocumentosView.types';

export default function DocumentosDesktopView({
  searchTerm,
  onSearchTermChange,
  onClearSearch,
  onCreateDocumento,
  isLoading,
  showPendingToggle,
  soloPendientes,
  onSoloPendientesChange,
  filtersContent,
  summaryContent,
  selectionContent,
  extraActionsContent,
  rows,
  columns,
  canBulkDuplicate,
  selectedDocumentIds,
  onSelectedDocumentIdsChange,
  onCellClick,
  onRowClick,
  slotProps,
  getRowClassName,
  columnVisibilityModel,
  sortModel,
  onSortModelChange,
  onColumnVisibilityModelChange,
  onColumnWidthChange,
  onColumnOrderChange,
  contextMenuActions,
  contextMenuPosition,
  contextMenuOpen,
  onCloseContextMenu,
  rowCount,
  paginationModel,
  onPaginationModelChange,
}: DocumentosDesktopViewProps) {
  const theme = useTheme();
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const [filtersSummaryDrawerOpen, setFiltersSummaryDrawerOpen] = React.useState(false);
  const showInlineFiltersSummary = !isTablet;

  return (
    <Box sx={{ width: '100%', px: 3, pt: 2, pb: 0, display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>

        {/* Toolbar: búsqueda + toggle + acciones */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            size="small"
            placeholder="Buscar folio, cliente, RFC, teléfono, correo, concepto, producto..."
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
                  <IconButton size="small" onClick={onClearSearch} aria-label="Limpiar búsqueda">
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
          {showPendingToggle ? (
            <FormControlLabel
              control={
                <Checkbox
                  checked={soloPendientes}
                  onChange={(event) => onSoloPendientesChange(event.target.checked)}
                  size="small"
                />
              }
              label="Solo pendientes"
              sx={{ mr: 0, whiteSpace: 'nowrap' }}
            />
          ) : null}
          <Stack direction="row" spacing={1}>
            {extraActionsContent}
            {isTablet ? (
              <Button
                variant="outlined"
                startIcon={<FilterAltOutlinedIcon />}
                onClick={() => setFiltersSummaryDrawerOpen(true)}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Filtros y Resumen
              </Button>
            ) : null}
            <Button
              variant="contained"
              onClick={onCreateDocumento}
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

        {showInlineFiltersSummary ? filtersContent : null}
        {showInlineFiltersSummary ? summaryContent : null}
        {selectionContent}

        {/* Drawer para tablet: filtros y resumen */}
        <Drawer
          anchor="bottom"
          open={filtersSummaryDrawerOpen}
          onClose={() => setFiltersSummaryDrawerOpen(false)}
          PaperProps={{
            sx: {
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: '82vh',
              pb: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            },
          }}
        >
          <Box sx={{ px: 2, pt: 1.25, pb: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Box sx={{ width: 44, height: 5, borderRadius: 999, backgroundColor: '#cbd5e1' }} />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={800} color="#1d2f68">
                  Filtros y Resumen
                </Typography>
                <Typography variant="body2" color="#4b5563">
                  Consulta filtros y totales sin salir del grid.
                </Typography>
              </Box>
              <IconButton aria-label="Cerrar panel" onClick={() => setFiltersSummaryDrawerOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>

            {showPendingToggle ? (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={soloPendientes}
                    onChange={(event) => onSoloPendientesChange(event.target.checked)}
                  />
                }
                label="Solo pendientes"
              />
            ) : null}

            {filtersContent ? (
              <Stack spacing={1.25}>
                <Typography variant="subtitle2" fontWeight={800} color="#1f2937">
                  Filtros
                </Typography>
                {filtersContent}
              </Stack>
            ) : null}

            {summaryContent ? (
              <>
                <Divider />
                <Stack spacing={1.25}>
                  <Typography variant="subtitle2" fontWeight={800} color="#1f2937">
                    Resumen
                  </Typography>
                  {summaryContent}
                </Stack>
              </>
            ) : null}
          </Box>
        </Drawer>

        {/* Grid */}
        <Box sx={{ width: '100%', backgroundColor: '#fff', borderRadius: 1, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <EmphasysDataGrid
            rows={rows}
            columns={columns}
            checkboxSelection={canBulkDuplicate}
            autoHeight
            rowHeight={STANDARD_DATA_GRID_ROW_HEIGHT}
            columnHeaderHeight={STANDARD_DATA_GRID_HEADER_HEIGHT}
            loading={isLoading}
            disableRowSelectionOnClick
            rowSelectionModel={selectedDocumentIds}
            onRowSelectionModelChange={(selectionModel) => {
              onSelectedDocumentIdsChange(
                selectionModel
                  .map((value) => Number(value))
                  .filter((value) => Number.isInteger(value) && value > 0)
              );
            }}
            sortModel={sortModel}
            onSortModelChange={onSortModelChange}
            onCellClick={onCellClick}
            onRowClick={onRowClick}
            {...(slotProps ? { slotProps } : {})}
            {...(getRowClassName ? { getRowClassName } : {})}
            columnVisibilityModel={columnVisibilityModel}
            onColumnVisibilityModelChange={onColumnVisibilityModelChange}
            onColumnWidthChange={onColumnWidthChange}
            onColumnOrderChange={onColumnOrderChange}
            pagination
            paginationMode="server"
            rowCount={rowCount}
            paginationModel={paginationModel}
            pageSizeOptions={[25, 50, 100]}
            onPaginationModelChange={onPaginationModelChange}
            hideFooterSelectedRowCount
            sx={[
              standardDataGridSx,
              {
                width: '100%',
                '--DataGrid-overlayHeight': '200px',
                '& .MuiDataGrid-cell': {
                  display: 'flex',
                  alignItems: 'center',
                },
                '& .documento-focus-row': {
                  backgroundColor: 'rgba(29, 47, 104, 0.10) !important',
                },
                '& .documento-focus-row .MuiDataGrid-cell': {
                  borderTop: '1px solid rgba(29, 47, 104, 0.24)',
                  borderBottom: '1px solid rgba(29, 47, 104, 0.24)',
                },
                '& .documento-focus-row .MuiDataGrid-cell:first-of-type': {
                  borderLeft: '3px solid #1d2f68',
                },
                '& .documento-focus-row--recent': {
                  animation: 'documentoFocusPulse 2.4s ease-out 1',
                },
                '@keyframes documentoFocusPulse': {
                  '0%': { backgroundColor: 'rgba(56, 189, 248, 0.24)' },
                  '100%': { backgroundColor: 'rgba(29, 47, 104, 0.10)' },
                },
              },
            ]}
            slots={{
              noRowsOverlay: () => (
                <Stack height="100%" alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    {isLoading ? 'Cargando documentos...' : 'No hay documentos registrados.'}
                  </Typography>
                </Stack>
              ),
              loadingOverlay: () => (
                <Stack height="100%" alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                  <CircularProgress size={22} />
                  <Typography variant="body2" color="text.secondary">
                    Cargando documentos...
                  </Typography>
                </Stack>
              ),
            }}
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
