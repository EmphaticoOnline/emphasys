import * as React from 'react';
import { Box, Button, Checkbox, CircularProgress, Divider, Drawer, FormControlLabel, IconButton, InputAdornment, Paper, Stack, TextField, Toolbar, Typography } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { DataGrid } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import { GridContextMenu } from '../grids/GridContextMenu';
import {
  STANDARD_DATA_GRID_HEADER_HEIGHT,
  STANDARD_DATA_GRID_ROW_HEIGHT,
  standardDataGridSx,
} from '../grids/standardDataGridSx';
import { SHOW_GRID_ACTIONS } from '../grids/gridUxFlags';
import type { DocumentosDesktopViewProps } from './DocumentosView.types';

export default function DocumentosDesktopView({
  title,
  description,
  searchTerm,
  onSearchTermChange,
  onClearSearch,
  onRefresh,
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
}: DocumentosDesktopViewProps) {
  const theme = useTheme();
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const [filtersSummaryDrawerOpen, setFiltersSummaryDrawerOpen] = React.useState(false);
  const showInlineFiltersSummary = !isTablet;

  return (
    <>
      <Toolbar disableGutters sx={{ justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Stack spacing={0.5}>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            {title}
          </Typography>
          <Typography variant="body2" color="#4b5563">
            {description}
          </Typography>
        </Stack>
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
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onRefresh} disabled={isLoading}>
            Recargar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onCreateDocumento}
            sx={{ textTransform: 'uppercase', fontWeight: 700, backgroundColor: '#1d2f68', '&:hover': { backgroundColor: '#162551' } }}
          >
            Nuevo
          </Button>
        </Stack>
      </Toolbar>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Buscar folio, cliente, RFC, teléfono, correo, concepto, producto..."
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
                <IconButton size="small" onClick={onClearSearch} aria-label="Limpiar búsqueda">
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
        {showPendingToggle ? (
          <FormControlLabel
            control={<Checkbox checked={soloPendientes} onChange={(event) => onSoloPendientesChange(event.target.checked)} />}
            label="Solo pendientes"
          />
        ) : null}
      </Stack>

      {showInlineFiltersSummary ? filtersContent : null}
      {showInlineFiltersSummary ? summaryContent : null}
      {selectionContent}

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
              control={<Checkbox checked={soloPendientes} onChange={(event) => onSoloPendientesChange(event.target.checked)} />}
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

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', width: '100%' }}>
        <Box>
          <DataGrid
            rows={rows}
            columns={columns}
            checkboxSelection={canBulkDuplicate}
            autoHeight
            density="standard"
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
            localeText={esES.components.MuiDataGrid.defaultProps.localeText}
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
                  '0%': {
                    backgroundColor: 'rgba(56, 189, 248, 0.24)',
                  },
                  '100%': {
                    backgroundColor: 'rgba(29, 47, 104, 0.10)',
                  },
                },
              },
            ]}
            hideFooterPagination
            hideFooterSelectedRowCount
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
      </Paper>
    </>
  );
}