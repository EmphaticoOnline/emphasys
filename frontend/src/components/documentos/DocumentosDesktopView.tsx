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
import { catalogoOutlinedButtonSx, catalogoPrimaryButtonSx, catalogoSearchSx } from '../catalogo/catalogoSurfaces';
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
  viewToggleContent,
  rows,
  columns,
  canBulkDuplicate,
  selectedDocumentIds,
  onSelectedDocumentIdsChange,
  onCellClick,
  onRowClick,
  slotProps,
  getRowClassName,
  rowAppearanceSx,
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
  surface = 'legacy',
}: DocumentosDesktopViewProps) {
  const theme = useTheme();
  const catalog = surface === 'catalog';
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
            sx={catalog
              ? (fieldTheme) => ({
                  flex: 1,
                  ...(typeof catalogoSearchSx === 'function' ? catalogoSearchSx(fieldTheme) : {}),
                })
              : { flex: 1 }}
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
            {viewToggleContent}
            {extraActionsContent}
            {isTablet ? (
              <Button
                variant="outlined"
                startIcon={<FilterAltOutlinedIcon />}
                onClick={() => setFiltersSummaryDrawerOpen(true)}
                sx={catalog ? catalogoOutlinedButtonSx : { textTransform: 'none', fontWeight: 700 }}
              >
                Filtros y Resumen
              </Button>
            ) : null}
            <Button
              variant="contained"
              onClick={onCreateDocumento}
              sx={catalog ? catalogoPrimaryButtonSx : {
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
              <Box sx={{ width: 44, height: 5, borderRadius: 999, backgroundColor: catalog ? theme.emphasys.content.border : '#cbd5e1' }} />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={800} color={catalog ? theme.emphasys.content.foreground : '#1d2f68'}>
                  Filtros y Resumen
                </Typography>
                <Typography variant="body2" color={catalog ? theme.emphasys.content.secondary : '#4b5563'}>
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
                <Typography variant="subtitle2" fontWeight={800} color={catalog ? theme.emphasys.content.foreground : '#1f2937'}>
                  Filtros
                </Typography>
                {filtersContent}
              </Stack>
            ) : null}

            {summaryContent ? (
              <>
                <Divider />
                <Stack spacing={1.25}>
                  <Typography variant="subtitle2" fontWeight={800} color={catalog ? theme.emphasys.content.foreground : '#1f2937'}>
                    Resumen
                  </Typography>
                  {summaryContent}
                </Stack>
              </>
            ) : null}
          </Box>
        </Drawer>

        {/* Grid */}
        <Box sx={{
          width: '100%',
          backgroundColor: catalog ? theme.emphasys.content.card : '#fff',
          borderRadius: catalog ? 2 : 1,
          border: `1px solid ${catalog ? theme.emphasys.content.border : '#e5e7eb'}`,
          overflow: 'hidden',
        }}>
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
              catalog
                ? {
                    width: '100%',
                    '--DataGrid-overlayHeight': '200px',
                    '& .MuiDataGrid-cell': {
                      display: 'flex',
                      alignItems: 'center',
                      borderColor: theme.emphasys.content.border,
                    },
                    '& .MuiDataGrid-footerContainer': {
                      borderTop: `1px solid ${theme.emphasys.content.border}`,
                      backgroundColor: theme.emphasys.content.card,
                      color: theme.emphasys.content.secondary,
                      minHeight: 44,
                    },
                    '& .MuiTablePagination-root, & .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                      color: theme.emphasys.content.secondary,
                    },
                    '& .MuiTablePagination-selectIcon': {
                      color: theme.emphasys.content.muted,
                    },
                    '& .documento-focus-row': {
                      backgroundColor: `${theme.emphasys.grid.selected} !important`,
                    },
                    '& .documento-focus-row.Mui-selected': {
                      backgroundColor: `${theme.emphasys.grid.selectedHover} !important`,
                    },
                    '& .documento-focus-row.Mui-selected:hover': {
                      backgroundColor: `${theme.emphasys.grid.selectedHover} !important`,
                    },
                    '& .documento-focus-row .MuiDataGrid-cell': {
                      borderTop: `1px solid ${theme.emphasys.content.border}`,
                      borderBottom: `1px solid ${theme.emphasys.content.border}`,
                    },
                    '& .documento-focus-row .MuiDataGrid-cell:first-of-type': {
                      borderLeft: `3px solid ${theme.emphasys.content.foreground}`,
                    },
                    '& .documento-focus-row--recent': {
                      animation: 'documentoFocusPulse 2.4s ease-out 1',
                    },
                    '@keyframes documentoFocusPulse': {
                      '0%': { backgroundColor: theme.emphasys.action.tint },
                      '100%': { backgroundColor: theme.emphasys.grid.selected },
                    },
                  }
                : {
                    width: '100%',
                    '--DataGrid-overlayHeight': '200px',
                    '& .MuiDataGrid-cell': {
                      display: 'flex',
                      alignItems: 'center',
                    },
                    '& .documento-focus-row': {
                      backgroundColor: 'rgba(29, 47, 104, 0.10) !important',
                    },
                    '& .documento-focus-row.Mui-selected': {
                      backgroundColor: 'rgba(29, 47, 104, 0.16) !important',
                    },
                    '& .documento-focus-row.Mui-selected:hover': {
                      backgroundColor: 'rgba(29, 47, 104, 0.20) !important',
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
              ...(Array.isArray(rowAppearanceSx) ? rowAppearanceSx : rowAppearanceSx ? [rowAppearanceSx] : []),
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
