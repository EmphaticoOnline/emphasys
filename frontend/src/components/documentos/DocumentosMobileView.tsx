import * as React from 'react';
import { Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Divider, Drawer, Fab, FormControlLabel, IconButton, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import { GridContextMenu } from '../grids/GridContextMenu';
import type { CotizacionListado } from '../../types/cotizacion';
import type { DocumentosMobileViewProps } from './DocumentosView.types';
import DocumentoStatusIndicators from './indicadores/DocumentoStatusIndicators';

function hasValue(value?: string | number | null) {
  return value != null && String(value).trim() !== '';
}

function getStatusColor(status?: string | null) {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (normalized === 'timbrado' || normalized === 'activo' || normalized === 'pagado') return 'success';
  if (normalized === 'cancelado' || normalized === 'rechazado') return 'error';
  if (normalized === 'borrador') return 'default';
  return 'primary';
}

function getSubtitle(row: CotizacionListado) {
  if (hasValue(row.nombre_cliente)) return String(row.nombre_cliente);
  if (hasValue(row.producto_resumen)) return String(row.producto_resumen);
  return '';
}

function toggleSelected(ids: number[], id: number, checked: boolean) {
  if (checked) {
    return ids.includes(id) ? ids : [...ids, id];
  }

  return ids.filter((currentId) => currentId !== id);
}

export default function DocumentosMobileView({
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
  tipoDocumento,
  indicatorsByDocumentId,
  showSaldo,
  canBulkDuplicate,
  selectedDocumentIds,
  onSelectedDocumentIdsChange,
  onOpenDocumento,
  onOpenContextMenu,
  contextMenuActions,
  contextMenuPosition,
  contextMenuOpen,
  onCloseContextMenu,
  formatFolio,
  formatDate,
  currency,
}: DocumentosMobileViewProps) {
  const [panelOpen, setPanelOpen] = React.useState(false);

  return (
    <Box sx={{ width: '100%', px: 2, py: 0, display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5, pb: 10 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, position: 'sticky', top: 72, zIndex: 2, py: 1, backgroundColor: '#eef1f4' }}>
          <Box>
            <Typography variant="h5" fontWeight={600} color="#1d2f68">{title}</Typography>
            <Typography variant="body2" color="#4b5563">{description}</Typography>
          </Box>

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

          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="outlined"
              startIcon={<FilterAltOutlinedIcon />}
              onClick={() => setPanelOpen(true)}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderColor: '#c7d2e5',
                color: '#1d2f68',
                backgroundColor: '#ffffff',
                '&:hover': { borderColor: '#9db1ea', backgroundColor: '#f8fafc' },
              }}
            >
              Filtros y Resumen
            </Button>
            {extraActionsContent}
          </Stack>

          {selectionContent}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {isLoading ? (
            <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          ) : rows.length === 0 ? (
            <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 2, backgroundColor: '#fff', px: 2, py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="#4b5563">No hay documentos registrados.</Typography>
            </Box>
          ) : (
            rows.map((row) => {
              const rowId = Number(row.id);
              const subtitle = getSubtitle(row);
              const isSelected = selectedDocumentIds.includes(rowId);
              const saldo = Number(row.saldo ?? 0);
              const detailItems: Array<{ label: string; value: string | number | null | undefined; color?: string }> = [
                { label: 'Fecha', value: formatDate(row.fecha_documento) },
                { label: 'Total', value: currency.format(Number(row.total ?? 0)) },
                // Misma regla que la columna "Saldo" de la grilla desktop: rojo si hay
                // saldo pendiente, verde si está en cero. Solo se muestra para los tipos
                // de documento que también muestran saldo en desktop (showSaldo).
                ...(showSaldo
                  ? [{
                      label: 'Saldo',
                      value: currency.format(saldo),
                      color: saldo === 0 ? 'success.main' : 'error.main',
                    }]
                  : []),
                { label: 'Producto', value: row.producto_resumen },
              ].filter((item) => hasValue(item.value));

              return (
                <Card
                  key={row.id}
                  variant="outlined"
                  sx={{
                    borderColor: isSelected ? '#9db1ea' : '#e5e7eb',
                    borderRadius: 2.5,
                    backgroundColor: '#ffffff',
                    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.05)',
                  }}
                >
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                      <Box sx={{ minWidth: 0, flex: 1 }} onClick={() => onOpenDocumento(rowId)}>
                        <Typography variant="subtitle1" fontWeight={700} color="#1d2f68" sx={{ lineHeight: 1.2 }}>
                          {formatFolio(row)}
                        </Typography>
                        {subtitle ? (
                          <Typography variant="body2" color="#4b5563" sx={{ mt: 0.25, wordBreak: 'break-word', lineHeight: 1.3 }}>
                            {subtitle}
                          </Typography>
                        ) : null}
                      </Box>
                      <Stack direction="row" spacing={0.25} alignItems="center">
                        {canBulkDuplicate ? (
                          <Checkbox
                            checked={isSelected}
                            onChange={(event) => onSelectedDocumentIdsChange(toggleSelected(selectedDocumentIds, rowId, event.target.checked))}
                            onClick={(event) => event.stopPropagation()}
                            size="small"
                          />
                        ) : null}
                        <IconButton
                          size="small"
                          aria-label="Abrir acciones"
                          onClick={(event) => onOpenContextMenu(event, row)}
                          sx={{ mt: -0.25, mr: -0.5 }}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Chip label={String(row.estatus_documento ?? 'Sin estatus')} size="small" color={getStatusColor(row.estatus_documento)} />
                      {hasValue(row.estado_seguimiento) ? (
                        <Chip label={String(row.estado_seguimiento)} size="small" variant="outlined" />
                      ) : null}
                    </Box>

                    {tipoDocumento === 'factura' && indicatorsByDocumentId?.[rowId] ? (
                      <DocumentoStatusIndicators {...indicatorsByDocumentId[rowId]} maxVisible={3} />
                    ) : null}

                    {detailItems.length > 0 ? (
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.75 }}>
                        {detailItems.map((item) => (
                          <Box key={`${row.id}-${item.label}`} sx={{ minWidth: 0 }}>
                            <Typography variant="caption" color="#6b7280" sx={{ display: 'block', lineHeight: 1.1 }}>
                              {item.label}
                            </Typography>
                            <Typography
                              variant="body2"
                              color={item.color ?? '#111827'}
                              fontWeight={item.color ? 600 : 400}
                              sx={{ lineHeight: 1.25, wordBreak: 'break-word' }}
                            >
                              {String(item.value)}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })
          )}
        </Box>

        <Fab
          color="primary"
          aria-label="Nuevo documento"
          onClick={onCreateDocumento}
          sx={{
            position: 'fixed',
            right: 20,
            bottom: 20,
            backgroundColor: '#1d2f68',
            color: '#ffffff',
            boxShadow: '0 10px 24px rgba(29, 47, 104, 0.28)',
            '&:hover': { backgroundColor: '#162551' },
          }}
        >
          <AddIcon />
        </Fab>

        <Drawer
          anchor="bottom"
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
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
                  Consulta filtros, totales y acciones auxiliares.
                </Typography>
              </Box>
              <IconButton aria-label="Cerrar panel" onClick={() => setPanelOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>

            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={onRefresh}
              disabled={isLoading}
              sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
            >
              Recargar
            </Button>

            <Divider />

            <Stack spacing={1.25}>
              <Typography variant="subtitle2" fontWeight={800} color="#1f2937">
                Filtros
              </Typography>

              {showPendingToggle ? (
                <FormControlLabel
                  control={<Checkbox checked={soloPendientes} onChange={(event) => onSoloPendientesChange(event.target.checked)} />}
                  label="Solo pendientes"
                />
              ) : null}

              {filtersContent}
            </Stack>

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

        <GridContextMenu
          actions={contextMenuActions}
          anchorPosition={contextMenuPosition}
          open={contextMenuOpen}
          onClose={onCloseContextMenu}
        />
      </Box>
    </Box>
  );
}
