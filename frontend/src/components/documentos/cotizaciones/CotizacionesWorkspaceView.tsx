// Vista alterna de Cotizaciones (lista compacta + panel de la cotización
// seleccionada). La preferencia vive en `cotizacionesWorkspaceFlag.ts` y no
// comparte llave con Facturas.
//
// No agrega lógica de negocio: crear, editar, duplicar, generar, producción,
// PDF, correo, WhatsApp, cancelar y eliminar reutilizan `gridContextMenuActions`.
// El seguimiento comercial y el cambio de estatus reutilizan los mismos
// handlers de la grilla.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import type { Contacto } from '../../../types/contactos.types';
import type { CotizacionListado } from '../../../types/cotizacion';
import type { SeguimientoChipPresentation } from '../../../hooks/useSeguimientoActividades';
import { getEstadoSeguimientoPresentation, normalizeEstadoSeguimiento } from '../../../modules/cotizaciones/estadoSeguimiento';
import { getStatusToneColor } from '../../status/status.semantics';
import type { StatusTone } from '../../status/status.types';
import type { Theme } from '@mui/material/styles';
import type { GridContextMenuAction, GridContextMenuActionItem } from '../../grids/GridContextMenu';
import { WorkspaceRowContextMenu, type WorkspaceContextItem } from '../WorkspaceRowContextMenu';
import { PopoverFiltroFacturas } from '../facturas/FacturasWorkspaceView';
import CotizacionDocumentoResumenView from './CotizacionDocumentoResumenView';
import { DocumentoHojaViewport } from '../DocumentoHojaFrame';
import { SeguimientoActividadCell } from '../../crm/SeguimientoActividadCell';
import {
  useDocumentoDetalleData,
  PartidasTab,
  RelacionadosTab,
} from '../DocumentoDetalleContent';
import { elevation } from '../../../theme/elevation';

type StatusOption = { value: string; label: string; color?: string; textColor?: string };
type FiltroCotizaciones = {
  fechaDesde: string;
  fechaHasta: string;
  clienteId: number | null;
  agenteId: number | null;
  montoMin: string;
  montoMax: string;
};
type PresentacionEstado = { label: string; color: string; textColor: string };
type SortModelItem = { field: string; sort: 'asc' | 'desc' | null | undefined };

export interface CotizacionesWorkspaceViewProps {
  rows: CotizacionListado[];
  isLoading: boolean;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onClearSearch: () => void;
  quickFilter: string;
  onQuickFilterChange: (value: string) => void;
  statusOptions: StatusOption[];
  resumenTotales: { general: number; porEstado: Record<string, number> } | null;
  filtros: FiltroCotizaciones;
  onFiltrosChange: (filtros: FiltroCotizaciones) => void;
  contactos: Contacto[];
  vendedores: Contacto[];
  mostrarAgente: boolean;
  etiquetaContacto: string;
  sortModel: readonly SortModelItem[];
  onSortModelChange: (model: SortModelItem[]) => void;
  extraActionsContent: React.ReactNode;
  onCreateDocumento: () => void;
  selectionContent?: React.ReactNode;
  selectedDocumentIds: number[];
  onSelectedDocumentIdsChange: (ids: number[]) => void;
  onChangeView: (workspace: boolean) => void;
  gridContextMenuActions: GridContextMenuAction[];
  onSelectCotizacion: (row: CotizacionListado) => void;
  onOpenSeguimiento: (event: React.MouseEvent<HTMLElement>, row: CotizacionListado) => void;
  onOpenActividadSeguimiento: (row: CotizacionListado) => void;
  presentacionEstatus: (value: unknown) => PresentacionEstado;
  resolverAgente: (agenteId: number | null | undefined) => string;
  getSeguimientoChip: (oportunidadId: number) => SeguimientoChipPresentation | undefined;
  actualizandoEstatusId: number | null;
  initialSelectedId?: number | null;
  documentoDetalleRefreshKey?: number;
  formatFolio: (row: CotizacionListado) => string;
  formatDate: (value: unknown) => string;
  currency: Intl.NumberFormat;
  rowCount: number;
  paginationModel: { page: number; pageSize: number };
  onPaginationModelChange: (model: { page: number; pageSize: number }) => void;
}

const SORT_FIELDS: Array<{ field: string; label: string }> = [
  { field: 'numero', label: 'Folio' },
  { field: 'fecha_documento', label: 'Fecha' },
  { field: 'subtotal', label: 'Subtotal' },
  { field: 'total', label: 'Total' },
];

const PREVIEW_TAB_LABELS = ['Documento', 'Partidas', 'Relacionados'];

function tonoEstadoComercial(value: unknown): StatusTone {
  switch (normalizeEstadoSeguimiento(value)) {
    case 'abierta': return 'info';
    case 'pausada': return 'warning';
    case 'convertida': return 'success';
    case 'perdida': return 'error';
    case 'no seleccionada': return 'neutral';
    case 'cancelada': return 'blocked';
    default: return 'draft';
  }
}

function colorEstadoComercial(theme: Theme, value: unknown): string {
  const tono = tonoEstadoComercial(value);
  if (tono === 'neutral') return theme.palette.warning.main;
  return getStatusToneColor(theme, tono);
}

function findAction(actions: GridContextMenuAction[], id: string): GridContextMenuActionItem | null {
  const found = actions.find((action) => action.id === id);
  if (!found || found.type === 'separator') return null;
  return found;
}

function agregarAccionVisible(
  items: WorkspaceContextItem[],
  action: GridContextMenuActionItem | null,
  label?: string,
) {
  if (!action || action.hidden) return;
  const disabled = Boolean(action.disabled);
  items.push({
    id: action.id,
    label: label ?? action.label,
    icon: action.icon,
    disabled,
    onClick: disabled ? undefined : (event) => { void action.onClick?.(event); },
  });
}

function itemsMenuCotizacion(
  row: CotizacionListado,
  actions: GridContextMenuAction[],
  onOpenActividadSeguimiento: (row: CotizacionListado) => void,
): WorkspaceContextItem[] {
  const items: WorkspaceContextItem[] = [];
  actions.forEach((action) => {
    if (action.type === 'separator' || action.hidden) return;
    agregarAccionVisible(items, action);
  });
  if (row.oportunidad_id) {
    items.push({
      id: 'seguimiento-comercial',
      label: 'Seguimiento comercial',
      icon: <AssignmentOutlinedIcon fontSize="small" />,
      onClick: () => onOpenActividadSeguimiento(row),
    });
  }
  return items;
}

export default function CotizacionesWorkspaceView({
  rows,
  isLoading,
  searchTerm,
  onSearchTermChange,
  onClearSearch,
  quickFilter,
  onQuickFilterChange,
  statusOptions,
  resumenTotales,
  filtros,
  onFiltrosChange,
  contactos,
  vendedores,
  mostrarAgente,
  etiquetaContacto,
  sortModel,
  onSortModelChange,
  extraActionsContent,
  onCreateDocumento,
  selectionContent,
  selectedDocumentIds,
  onSelectedDocumentIdsChange,
  onChangeView,
  gridContextMenuActions,
  onSelectCotizacion,
  onOpenSeguimiento,
  onOpenActividadSeguimiento,
  presentacionEstatus,
  resolverAgente,
  getSeguimientoChip,
  actualizandoEstatusId,
  initialSelectedId = null,
  documentoDetalleRefreshKey = 0,
  formatFolio,
  formatDate,
  currency,
  rowCount,
  paginationModel,
  onPaginationModelChange,
}: CotizacionesWorkspaceViewProps) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const compacto = useMediaQuery(theme.breakpoints.down('md'));
  const [detalleMovil, setDetalleMovil] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    if (initialSelectedId && rows.some((row) => row.id === initialSelectedId)) {
      return initialSelectedId;
    }
    return rows[0]?.id ?? null;
  });
  const [sortMenuAnchor, setSortMenuAnchor] = useState<HTMLElement | null>(null);
  const [anclaFiltro, setAnclaFiltro] = useState<HTMLElement | null>(null);
  const [globalMenuAnchor, setGlobalMenuAnchor] = useState<HTMLElement | null>(null);
  const [enviarMenuAnchor, setEnviarMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuFila, setMenuFila] = useState<{ top: number; left: number; rowId: number } | null>(null);
  const [previewTab, setPreviewTab] = useState(0);
  const activatedRowIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedId(null);
      setDetalleMovil(false);
      return;
    }
    if (initialSelectedId) {
      setSelectedId(rows.some((row) => row.id === initialSelectedId) ? initialSelectedId : null);
    } else if (!rows.some((row) => row.id === selectedId)) {
      setSelectedId(rows[0]?.id ?? null);
    }
    // La selección solo se corrige cuando cambia el conjunto visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const selectedRow = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);

  useEffect(() => {
    if (!selectedRow || activatedRowIdRef.current === selectedRow.id) return;
    activatedRowIdRef.current = selectedRow.id;
    onSelectCotizacion(selectedRow);
  }, [onSelectCotizacion, selectedRow]);

  useEffect(() => {
    setPreviewTab(0);
  }, [selectedId]);

  const handleSelect = (row: CotizacionListado) => {
    setSelectedId(row.id);
    setDetalleMovil(true);
  };

  const detalle = useDocumentoDetalleData(selectedRow?.id ?? null, 'cotizacion', Boolean(selectedRow), documentoDetalleRefreshKey);
  const verLista = !compacto || !detalleMovil;
  const criteriosLista = [
    filtros.fechaDesde,
    filtros.fechaHasta,
    filtros.clienteId,
    mostrarAgente ? filtros.agenteId : null,
    filtros.montoMin,
    filtros.montoMax,
  ].filter((value) => value !== '' && value !== null).length + (quickFilter !== 'todos' ? 1 : 0);

  return (
    <Box sx={{ flex: 1, minHeight: compacto ? 'calc(100dvh - 112px)' : 0, display: 'flex', flexDirection: compacto ? 'column' : 'row', overflow: 'hidden' }}>
      <Box sx={{
        width: compacto ? '100%' : 372,
        flexShrink: 0,
        display: verLista ? 'flex' : 'none',
        flexDirection: 'column',
        minHeight: 0,
        bgcolor: tokens.workspaceRail.background,
        color: tokens.navigation.foreground,
        borderRight: compacto ? 'none' : `1px solid ${tokens.navigation.border}`,
      }}>
        <Box sx={{ px: 1.75, pt: 1.7, pb: 1.1, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: tokens.navigation.muted }}>
                COTIZACIONES
              </Typography>
              <Typography sx={{ mt: 0.35, fontSize: 13, color: tokens.navigation.subtle }} noWrap>
                {rowCount} en vista{resumenTotales ? ` · ${currency.format(resumenTotales.general)}` : ''}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.6} alignItems="center">
              <Button
                size="small"
                variant="outlined"
                onClick={() => onChangeView(false)}
                sx={{
                  textTransform: 'none',
                  fontSize: 11,
                  color: tokens.navigation.foreground,
                  borderColor: tokens.navigation.border,
                  '&:hover': { borderColor: tokens.navigation.foreground, bgcolor: tokens.navigation.hover },
                }}
              >
                Vista clásica
              </Button>
              <Tooltip title="Acciones de la colección">
                <IconButton
                  size="small"
                  aria-label="Acciones de la colección"
                  onClick={(event) => setGlobalMenuAnchor(event.currentTarget)}
                  sx={{
                    width: 34,
                    height: 34,
                    color: tokens.navigation.foreground,
                    border: `1px solid ${tokens.navigation.border}`,
                    '&:hover': { bgcolor: tokens.navigation.hover },
                  }}
                >
                  <MoreHorizIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Menu anchorEl={globalMenuAnchor} open={Boolean(globalMenuAnchor)} onClose={() => setGlobalMenuAnchor(null)}>
                <Box sx={{ px: 1.5, pt: 0.5, pb: 1, minWidth: 260 }} onClick={() => setGlobalMenuAnchor(null)}>
                  {extraActionsContent}
                </Box>
              </Menu>
              <Tooltip title="Nueva cotización">
                <IconButton
                  size="small"
                  aria-label="Nueva cotización"
                  onClick={onCreateDocumento}
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor: tokens.navigation.control,
                    color: tokens.navigation.controlForeground,
                    boxShadow: elevation.railControl,
                    '&:hover': { bgcolor: tokens.content.elevated, color: tokens.content.foreground },
                  }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mt: 1.35 }}>
            <TextField
              size="small"
              placeholder="Buscar folio, cliente…"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: tokens.navigation.muted }} />
                  </InputAdornment>
                ),
                endAdornment: searchTerm ? (
                  <IconButton size="small" onClick={onClearSearch} sx={{ color: tokens.navigation.muted }}><CloseIcon fontSize="small" /></IconButton>
                ) : null,
              }}
              sx={{
                flex: 1,
                '& .MuiOutlinedInput-root': {
                  color: tokens.navigation.foreground,
                  bgcolor: tokens.navigation.summary,
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'transparent' },
                },
                '& .MuiOutlinedInput-input': { fontSize: 13, py: 0.9 },
                '& .MuiOutlinedInput-input::placeholder': { color: tokens.navigation.muted, opacity: 1 },
              }}
            />
            <Tooltip title="Ordenar">
              <IconButton size="small" onClick={(event) => setSortMenuAnchor(event.currentTarget)} sx={{ color: tokens.navigation.foreground }}>
                <SwapVertIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Menu anchorEl={sortMenuAnchor} open={Boolean(sortMenuAnchor)} onClose={() => setSortMenuAnchor(null)}>
              {SORT_FIELDS.map((field) => {
                const current = sortModel.find((item) => item.field === field.field);
                return (
                  <MenuItem
                    key={field.field}
                    onClick={() => {
                      const nextDir: 'asc' | 'desc' = current?.sort === 'asc' ? 'desc' : 'asc';
                      onSortModelChange([{ field: field.field, sort: nextDir }]);
                      setSortMenuAnchor(null);
                    }}
                  >
                    {field.label} {current ? (current.sort === 'asc' ? '▲' : '▼') : ''}
                  </MenuItem>
                );
              })}
            </Menu>
            <Tooltip title="Filtros">
              <Box sx={{ position: 'relative', flexShrink: 0 }}>
                <IconButton
                  size="small"
                  aria-label="Filtros"
                  onClick={(event) => setAnclaFiltro(event.currentTarget)}
                  sx={{ color: tokens.navigation.foreground }}
                >
                  <FilterAltOutlinedIcon fontSize="small" />
                </IconButton>
                {criteriosLista > 0 && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      minWidth: 16,
                      height: 16,
                      px: 0.4,
                      borderRadius: 99,
                      bgcolor: tokens.navigation.accent,
                      color: tokens.frame.background,
                      fontSize: 10,
                      fontWeight: 800,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    {criteriosLista}
                  </Box>
                )}
              </Box>
            </Tooltip>
          </Stack>
        </Box>

        <PopoverFiltroFacturas
          ancla={anclaFiltro}
          filtro={filtros}
          contactos={contactos}
          vendedores={vendedores}
          mostrarAgente={mostrarAgente}
          etiquetaContacto={etiquetaContacto}
          onClose={() => setAnclaFiltro(null)}
          onChange={onFiltrosChange}
          statusOptions={statusOptions}
          quickFilter={quickFilter}
          onQuickFilter={onQuickFilterChange}
          soloPendientes={false}
          onSoloPendientes={() => undefined}
          mostrarSoloPendientes={false}
          resumen={resumenTotales}
          currency={currency}
        />

        <Box sx={{
          px: 1,
          pb: 0.5,
          '& .MuiPaper-root': {
            bgcolor: tokens.navigation.summary,
            color: tokens.navigation.foreground,
            borderColor: tokens.navigation.border,
          },
          '& .MuiTypography-root': { color: tokens.navigation.foreground },
          '& .MuiButton-root': { color: tokens.navigation.foreground },
        }}>
          {selectionContent}
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', px: 1, pb: 1.2, scrollbarWidth: 'thin', scrollbarColor: `${tokens.navigation.progress} ${tokens.navigation.background}` }}>
          {isLoading && rows.length === 0 ? (
            <Stack alignItems="center" py={4}><CircularProgress size={24} sx={{ color: tokens.navigation.foreground }} /></Stack>
          ) : rows.length === 0 ? (
            <Typography sx={{ px: 1.5, py: 3, fontSize: 13, color: tokens.navigation.muted, textAlign: 'center' }}>
              {searchTerm || criteriosLista > 0 ? 'Ninguna cotización coincide con la búsqueda.' : 'Sin cotizaciones en esta vista.'}
            </Typography>
          ) : (
            rows.map((row) => {
              const seguimiento = getEstadoSeguimientoPresentation(row.estado_seguimiento);
              const colorSeguimiento = colorEstadoComercial(theme, row.estado_seguimiento);
              const selected = row.id === selectedId;
              const checked = selectedDocumentIds.includes(row.id);
              const agente = resolverAgente(row.agente_id);
              return (
                <Box
                  key={row.id}
                  onClick={() => handleSelect(row)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedId(row.id);
                    onSelectCotizacion(row);
                    setMenuFila({ top: event.clientY, left: event.clientX, rowId: row.id });
                  }}
                  sx={{
                    px: 1,
                    py: 1.05,
                    mb: 0.45,
                    borderRadius: 2,
                    cursor: 'pointer',
                    bgcolor: selected ? tokens.navigation.selection : 'transparent',
                    color: selected ? tokens.navigation.selectionForeground : tokens.navigation.foreground,
                    boxShadow: selected ? elevation.railSelection : 'none',
                    '&:hover': { bgcolor: selected ? tokens.navigation.selection : tokens.navigation.hover },
                  }}
                >
                  <Stack direction="row" spacing={0.4} alignItems="flex-start">
                    <Checkbox
                      size="small"
                      checked={checked}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...selectedDocumentIds, row.id]
                          : selectedDocumentIds.filter((id) => id !== row.id);
                        onSelectedDocumentIdsChange(next);
                      }}
                      inputProps={{ 'aria-label': `Seleccionar ${formatFolio(row)}` }}
                      sx={{ p: 0.3, mt: -0.2, color: tokens.navigation.muted, '&.Mui-checked': { color: selected ? tokens.navigation.selectionForeground : tokens.navigation.foreground } }}
                    />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline' }}>
                        <Typography variant="figure" sx={{ fontSize: 16, color: 'inherit', lineHeight: 1.1 }}>{formatFolio(row)}</Typography>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 750, fontVariantNumeric: 'tabular-nums', color: 'inherit' }}>
                          {currency.format(Number(row.total ?? 0))}
                        </Typography>
                      </Box>
                      <Typography
                        variant="figure"
                        sx={{
                          fontSize: 14,
                          mt: 0.25,
                          color: tokens.navigation.foreground,
                          lineHeight: 1.25,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          wordBreak: 'break-word',
                        }}
                      >
                        {row.nombre_cliente || 'Sin contacto'}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.7, alignItems: 'center', mt: 0.3 }}>
                        <Box
                          component="button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(row.id);
                            onSelectCotizacion(row);
                            onOpenSeguimiento(event, row);
                          }}
                          sx={{
                            border: 0,
                            p: 0,
                            bgcolor: 'transparent',
                            color: 'inherit',
                            font: 'inherit',
                            fontSize: 11.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {seguimiento.label}
                        </Box>
                        <Tooltip title={seguimiento.label} arrow>
                          <Box component="span" aria-label={seguimiento.label} sx={{ width: 8, height: 8, flex: '0 0 8px', borderRadius: '50%', bgcolor: colorSeguimiento, display: 'inline-block' }} />
                        </Tooltip>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 0.45, gap: 1 }}>
                        <Typography sx={{ fontSize: 12, color: tokens.navigation.subtle }} noWrap>
                          {agente || 'Sin agente'}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: tokens.navigation.muted }}>{formatDate(row.fecha_documento)}</Typography>
                      </Box>
                      <Box sx={{ mt: 0.55, height: 3, borderRadius: 99, bgcolor: tokens.navigation.track }} />
                    </Box>
                  </Stack>
                </Box>
              );
            })
          )}
        </Box>

        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 0.75, flexShrink: 0, borderTop: `1px solid ${tokens.navigation.border}` }}>
          <IconButton
            size="small"
            aria-label="Página anterior"
            disabled={paginationModel.page <= 0}
            onClick={() => onPaginationModelChange({ ...paginationModel, page: paginationModel.page - 1 })}
            sx={{ color: tokens.navigation.foreground }}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <Typography sx={{ fontSize: 12, color: tokens.navigation.muted }}>
            Página {paginationModel.page + 1} de {Math.max(1, Math.ceil(rowCount / Math.max(1, paginationModel.pageSize)))}
          </Typography>
          <IconButton
            size="small"
            aria-label="Página siguiente"
            disabled={(paginationModel.page + 1) * paginationModel.pageSize >= rowCount}
            onClick={() => onPaginationModelChange({ ...paginationModel, page: paginationModel.page + 1 })}
            sx={{ color: tokens.navigation.foreground }}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Stack>
        <WorkspaceRowContextMenu
          anchorPosition={menuFila && selectedRow && menuFila.rowId === selectedRow.id ? { top: menuFila.top, left: menuFila.left } : null}
          items={menuFila && selectedRow && menuFila.rowId === selectedRow.id
            ? itemsMenuCotizacion(selectedRow, gridContextMenuActions, onOpenActividadSeguimiento)
            : []}
          onClose={() => setMenuFila(null)}
        />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: compacto && verLista ? 'none' : 'flex', flexDirection: 'column', bgcolor: tokens.content.background }}>
        {selectedRow ? (
          <CotizacionWorkspacePanel
            key={selectedRow.id}
            row={selectedRow}
            currency={currency}
            formatDate={formatDate}
            formatFolio={formatFolio}
            gridContextMenuActions={gridContextMenuActions}
            previewTab={previewTab}
            onPreviewTabChange={setPreviewTab}
            detalle={detalle}
            enviarMenuAnchor={enviarMenuAnchor}
            setEnviarMenuAnchor={setEnviarMenuAnchor}
            onOpenSeguimiento={onOpenSeguimiento}
            onOpenActividadSeguimiento={onOpenActividadSeguimiento}
            presentacionEstatus={presentacionEstatus}
            agenteNombre={resolverAgente(selectedRow.agente_id)}
            seguimientoChip={selectedRow.oportunidad_id ? getSeguimientoChip(selectedRow.oportunidad_id) : undefined}
            actualizando={actualizandoEstatusId === selectedRow.id}
            compacto={compacto}
            onVolver={() => setDetalleMovil(false)}
          />
        ) : (
          <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, px: 3, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: tokens.content.foreground }}>
              {rows.length > 0 ? 'Selecciona una cotización' : 'Sin cotizaciones en esta vista'}
            </Typography>
            <Typography sx={{ mt: 0.6, fontSize: 13, color: tokens.content.muted, maxWidth: 360 }}>
              {rows.length > 0
                ? 'El documento, sus partidas y sus relacionados aparecen aquí.'
                : 'Ajusta la búsqueda o crea una cotización nueva.'}
            </Typography>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

function CotizacionWorkspacePanel({
  row,
  currency,
  formatDate,
  formatFolio,
  gridContextMenuActions,
  previewTab,
  onPreviewTabChange,
  detalle,
  enviarMenuAnchor,
  setEnviarMenuAnchor,
  onOpenSeguimiento,
  onOpenActividadSeguimiento,
  presentacionEstatus,
  agenteNombre,
  seguimientoChip,
  actualizando,
  compacto,
  onVolver,
}: {
  row: CotizacionListado;
  currency: Intl.NumberFormat;
  formatDate: (value: unknown) => string;
  formatFolio: (row: CotizacionListado) => string;
  gridContextMenuActions: GridContextMenuAction[];
  previewTab: number;
  onPreviewTabChange: (tab: number) => void;
  detalle: ReturnType<typeof useDocumentoDetalleData>;
  enviarMenuAnchor: HTMLElement | null;
  setEnviarMenuAnchor: (el: HTMLElement | null) => void;
  onOpenSeguimiento: (event: React.MouseEvent<HTMLElement>, row: CotizacionListado) => void;
  onOpenActividadSeguimiento: (row: CotizacionListado) => void;
  presentacionEstatus: (value: unknown) => PresentacionEstado;
  agenteNombre: string;
  seguimientoChip: SeguimientoChipPresentation | undefined;
  actualizando: boolean;
  compacto: boolean;
  onVolver: () => void;
}) {
  const tokens = useTheme().emphasys;
  const theme = useTheme();
  const seguimiento = getEstadoSeguimientoPresentation(row.estado_seguimiento);
  const colorSeguimiento = colorEstadoComercial(theme, row.estado_seguimiento);
  const estatusDocumento = presentacionEstatus(row.estatus_documento);
  const editarAction = findAction(gridContextMenuActions, 'editar');
  const duplicarAction = findAction(gridContextMenuActions, 'duplicar');
  const verDetalleAction = findAction(gridContextMenuActions, 'ver-detalle');
  const produccionAction = findAction(gridContextMenuActions, 'enviar-produccion');
  const verProduccionAction = findAction(gridContextMenuActions, 'ver-produccion');
  const cancelarAction = findAction(gridContextMenuActions, 'cancelar-documento');
  const eliminarAction = findAction(gridContextMenuActions, 'eliminar');
  const verPdfAction = findAction(gridContextMenuActions, 'ver-pdf');
  const descargarPdfAction = findAction(gridContextMenuActions, 'descargar-pdf');
  const enviarCorreoAction = findAction(gridContextMenuActions, 'enviar-correo-cotizacion');
  const enviarWhatsappAction = findAction(gridContextMenuActions, 'enviar-whatsapp');
  const accionesGenerar = gridContextMenuActions.filter(
    (action): action is GridContextMenuActionItem => action.type !== 'separator' && action.id.startsWith('generar-') && !action.hidden,
  );
  const folio = formatFolio(row);
  const subtotal = Number(row.subtotal ?? 0);
  const iva = Number(row.iva ?? 0);
  const total = Number(row.total ?? 0);

  const runButtonAction = (action: GridContextMenuActionItem | null) => (event: React.MouseEvent<HTMLButtonElement>) => {
    void action?.onClick?.(event);
  };
  const iconoSx = (disabled: boolean) => ({
    width: 34,
    height: 34,
    borderRadius: '10px',
    bgcolor: disabled ? tokens.action.disabled : tokens.action.primary,
    color: tokens.action.primaryForeground,
    '&:hover': { bgcolor: disabled ? tokens.action.disabled : tokens.action.primaryHover },
    '&.Mui-disabled': { bgcolor: tokens.action.disabled, color: tokens.action.primaryForeground },
  });
  const renderActionButton = (
    action: GridContextMenuActionItem | null,
    caption: string,
    icon?: React.ReactNode,
  ) => {
    if (!action || action.hidden) return null;
    const disabled = Boolean(action.disabled);
    return (
      <Tooltip title={caption} arrow>
        <span>
          <IconButton size="small" aria-label={caption} disabled={disabled} onClick={runButtonAction(action)} sx={iconoSx(disabled)}>
            {icon ?? action.icon}
          </IconButton>
        </span>
      </Tooltip>
    );
  };

  return (
    <>
      <Box sx={{ px: { xs: 1.5, md: 2.75 }, pt: compacto ? 1 : 1.6, pb: 1.4, flexShrink: 0 }}>
        {compacto && (
          <Box
            component="button"
            type="button"
            onClick={onVolver}
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, border: 0, bgcolor: 'transparent', color: tokens.content.foreground, font: 'inherit', cursor: 'pointer', mb: 0.5, p: 0 }}
          >
            <ArrowBackIcon fontSize="small" /> Cotizaciones
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 220, flex: '1 1 240px' }}>
            <Typography sx={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: tokens.content.muted }}>
              COTIZACIÓN SELECCIONADA
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.2, alignItems: 'baseline', flexWrap: 'wrap', mt: 0.35 }}>
              <Typography variant="figure" sx={{ fontSize: compacto ? 26 : 32, letterSpacing: '-0.02em', lineHeight: 1, color: tokens.content.foreground }}>
                {folio}
              </Typography>
              <Typography sx={{ fontSize: 13, color: tokens.content.muted }}>{formatDate(row.fecha_documento)}</Typography>
              <Typography sx={{ fontSize: 12, color: tokens.content.muted }}>id {row.id}</Typography>
            </Box>
            <Typography component="p" variant="figure" sx={{ display: 'block', m: 0, mt: 0.7, fontSize: 15, lineHeight: 1.3, color: tokens.content.foreground }}>
              {row.nombre_cliente || 'Sin contacto'}
            </Typography>
            <Typography sx={{ mt: 0.35, fontSize: 12.5, color: tokens.content.muted }}>
              {agenteNombre || 'Sin agente'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.7, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Box
                component="button"
                type="button"
                disabled={actualizando}
                onClick={(event) => onOpenSeguimiento(event, row)}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.7,
                  height: 26,
                  px: 1.05,
                  borderRadius: 99,
                  border: 0,
                  bgcolor: tokens.content.elevated,
                  color: tokens.content.foreground,
                  font: 'inherit',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: actualizando ? 'default' : 'pointer',
                }}
              >
                <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colorSeguimiento }} />
                {seguimiento.label}
              </Box>
              <SeguimientoActividadCell
                hasOportunidad={Boolean(row.oportunidad_id)}
                presentation={seguimientoChip}
                onOpen={row.oportunidad_id ? () => onOpenActividadSeguimiento(row) : undefined}
              />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flex: '1 1 280px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '100%' }}>
            <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap" sx={{ justifyContent: 'flex-end' }}>
              {renderActionButton(verPdfAction, 'Imprimir', <PrintOutlinedIcon fontSize="small" />)}
              {renderActionButton(descargarPdfAction, 'Descargar PDF', <FileDownloadOutlinedIcon fontSize="small" />)}
              {(enviarCorreoAction && !enviarCorreoAction.hidden) || (enviarWhatsappAction && !enviarWhatsappAction.hidden) ? (
                <>
                  <Tooltip title="Enviar" arrow>
                    <span>
                      <IconButton
                        size="small"
                        aria-label="Enviar"
                        onClick={(event) => setEnviarMenuAnchor(event.currentTarget)}
                        sx={iconoSx(false)}
                      >
                        <SendOutlinedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Menu anchorEl={enviarMenuAnchor} open={Boolean(enviarMenuAnchor)} onClose={() => setEnviarMenuAnchor(null)}>
                    {enviarCorreoAction && !enviarCorreoAction.hidden ? (
                      <MenuItem
                        disabled={Boolean(enviarCorreoAction.disabled)}
                        onClick={(event) => {
                          setEnviarMenuAnchor(null);
                          void enviarCorreoAction.onClick?.(event);
                        }}
                      >
                        Enviar por correo
                      </MenuItem>
                    ) : null}
                    {enviarWhatsappAction && !enviarWhatsappAction.hidden ? (
                      <MenuItem
                        disabled={Boolean(enviarWhatsappAction.disabled)}
                        onClick={(event) => {
                          setEnviarMenuAnchor(null);
                          void enviarWhatsappAction.onClick?.(event);
                        }}
                      >
                        Enviar por WhatsApp
                      </MenuItem>
                    ) : null}
                  </Menu>
                </>
              ) : null}
              {renderActionButton(duplicarAction, 'Duplicar', <ContentCopyIcon fontSize="small" />)}
              {accionesGenerar.map((action) => (
                <React.Fragment key={action.id}>
                  {renderActionButton(action, action.label)}
                </React.Fragment>
              ))}
              {renderActionButton(produccionAction, 'Enviar a producción')}
              {renderActionButton(verProduccionAction, 'Ver producción')}
              {renderActionButton(verDetalleAction, 'Ver detalle')}
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap" sx={{ justifyContent: 'flex-end' }}>
              {renderActionButton(cancelarAction, 'Cancelar')}
              {renderActionButton(editarAction, 'Editar')}
              {renderActionButton(eliminarAction, 'Eliminar')}
            </Stack>
          </Box>
        </Box>
      </Box>

      <Box sx={{ px: { xs: 1.5, md: 2.75 }, pb: 1.6, flexShrink: 0 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: compacto ? '1fr' : 'repeat(3, 1fr)', gap: 0.8 }}>
          {([
            ['SUBTOTAL', currency.format(subtotal), tokens.metric.amount.background],
            ['IVA', currency.format(iva), tokens.metric.applied.background],
            ['TOTAL', currency.format(total), tokens.metric.available.background],
          ] as const).map(([label, value, background]) => (
            <Box key={label} sx={{ px: 1.4, py: 1.1, borderRadius: 2, bgcolor: background, color: tokens.content.foreground }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: tokens.metric.caption }}>{label}</Typography>
              <Typography variant="figure" sx={{ fontSize: 22, lineHeight: 1.15, color: 'inherit' }}>{value}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        mx: { xs: 1, md: 1.75 },
        mb: { xs: 1, md: 1.75 },
        bgcolor: tokens.content.well,
        borderRadius: 3,
        border: `1px solid ${tokens.content.border}`,
        overflow: 'hidden',
      }}>
        <Tabs
          value={previewTab}
          onChange={(_event, value) => onPreviewTabChange(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1.5,
            minHeight: 46,
            borderBottom: `1px solid ${tokens.content.border}`,
            '& .MuiTab-root': { minHeight: 46, textTransform: 'none', fontWeight: 650, fontSize: 14, color: tokens.content.muted },
            '& .Mui-selected': { color: tokens.content.foreground },
            '& .MuiTabs-indicator': { height: 2, borderRadius: 2, backgroundColor: tokens.content.foreground },
          }}
        >
          {PREVIEW_TAB_LABELS.map((label) => <Tab key={label} label={label} />)}
        </Tabs>
        <DocumentoHojaViewport>
          {previewTab === 0 ? (
            <CotizacionDocumentoResumenView
              row={row}
              documento={detalle.data?.documento ?? null}
              partidas={detalle.data?.partidas ?? null}
              partidasLoading={detalle.loading}
              currency={currency}
              formatDate={formatDate}
              agenteNombre={agenteNombre}
              presentacionEstatus={estatusDocumento}
              presentacionSeguimiento={seguimiento}
            />
          ) : detalle.loading ? (
            <Stack alignItems="center" py={6}><CircularProgress size={26} /></Stack>
          ) : detalle.error ? (
            <Alert severity="error">{detalle.error}</Alert>
          ) : !detalle.data ? null : previewTab === 1 ? (
            <PartidasTab partidas={detalle.data.partidas} documento={detalle.data.documento} />
          ) : (
            <RelacionadosTab documentosRelacionados={detalle.data.documentosRelacionados} formatter={currency} />
          )}
        </DocumentoHojaViewport>
      </Box>
    </>
  );
}
