import { useState, type ReactNode } from 'react';
import {
  Box,
  Checkbox,
  CircularProgress,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import type { Contacto } from '../../../types/contactos.types';
import type { CotizacionListado } from '../../../types/cotizacion';
import type { GridContextMenuAction } from '../../grids/GridContextMenu';
import { getStatusToneColor } from '../../status/status.semantics';
import type { StatusTone } from '../../status/status.types';
import { WorkspaceRowContextMenu } from '../WorkspaceRowContextMenu';
import { PopoverFiltroFacturas } from '../facturas/FacturasWorkspaceView';

type StatusOption = { value: string; label: string; color?: string; textColor?: string };
type FiltroLista = {
  fechaDesde: string;
  fechaHasta: string;
  clienteId: number | null;
  agenteId: number | null;
  montoMin: string;
  montoMax: string;
};
type SortItem = { field: string; sort: 'asc' | 'desc' | null | undefined };

const SORT_FIELDS: Array<{ field: string; label: string }> = [
  { field: 'numero', label: 'Folio' },
  { field: 'fecha_documento', label: 'Fecha' },
  { field: 'total', label: 'Total' },
];

const normalizarEstatus = (value: unknown): string => {
  const normalized = String(value ?? 'borrador').trim().toLowerCase();
  if (!normalized) return 'borrador';
  if (normalized === 'enviado') return 'emitido';
  if (normalized === 'cancelada') return 'cancelado';
  return normalized;
};

const tonoEstatus = (value: unknown): StatusTone => {
  const normalized = normalizarEstatus(value);
  if (normalized === 'cancelado') return 'error';
  if (normalized === 'emitido' || normalized === 'cerrado') return 'success';
  return 'draft';
};

export type RecepcionWorkspaceRailProps = {
  rows: CotizacionListado[];
  isLoading: boolean;
  selectedId: number | null;
  onSelect: (row: CotizacionListado) => void;
  onOpenDetail: () => void;
  onEditar?: (row: CotizacionListado) => void;
  search: string;
  onSearch: (value: string) => void;
  onRefresh: () => Promise<void>;
  actions: GridContextMenuAction[];
  formatFolio: (row: CotizacionListado) => string;
  formatDate: (value: unknown) => string;
  currency: Intl.NumberFormat;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  compacto: boolean;
  oculto: boolean;
  statusOptions: StatusOption[];
  quickFilter: string;
  onQuickFilter: (value: string) => void;
  filtros: FiltroLista;
  onFiltrosChange: (filtros: FiltroLista) => void;
  contactos: Contacto[];
  etiquetaContacto: string;
  resumen: { general: number; porEstado: Record<string, number> } | null;
  sortModel: readonly SortItem[];
  onSortModelChange: (model: SortItem[]) => void;
  selectedIds: number[];
  onSelectedIdsChange: (ids: number[]) => void;
  selectionContent?: ReactNode;
  extraActionsContent?: ReactNode;
};

export default function RecepcionWorkspaceRail({
  rows,
  isLoading,
  selectedId,
  onSelect,
  onOpenDetail,
  onEditar,
  search,
  onSearch,
  onRefresh,
  actions,
  formatFolio,
  formatDate,
  currency,
  total,
  page,
  pageSize,
  onPageChange,
  compacto,
  oculto,
  statusOptions,
  quickFilter,
  onQuickFilter,
  filtros,
  onFiltrosChange,
  contactos,
  etiquetaContacto,
  resumen,
  sortModel,
  onSortModelChange,
  selectedIds,
  onSelectedIdsChange,
  selectionContent,
  extraActionsContent,
}: RecepcionWorkspaceRailProps) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const [refreshing, setRefreshing] = useState(false);
  const [globalMenuAnchor, setGlobalMenuAnchor] = useState<HTMLElement | null>(null);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<HTMLElement | null>(null);
  const [anclaFiltro, setAnclaFiltro] = useState<HTMLElement | null>(null);
  const [menuFila, setMenuFila] = useState<{ top: number; left: number; rowId: number } | null>(null);

  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const criteriosLista = [
    filtros.fechaDesde,
    filtros.fechaHasta,
    filtros.clienteId,
    filtros.montoMin,
    filtros.montoMax,
  ].filter((value) => value !== '' && value !== null).length + (quickFilter !== 'todos' ? 1 : 0);

  const actualizar = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const iconoBorde = {
    width: 34,
    height: 34,
    color: tokens.navigation.foreground,
    border: `1px solid ${tokens.navigation.border}`,
    '&:hover': { bgcolor: tokens.navigation.hover },
  };

  return (
    <Box sx={{
      width: compacto ? '100%' : 372,
      flexShrink: 0,
      display: oculto ? 'none' : 'flex',
      flexDirection: 'column',
      minHeight: 0,
      bgcolor: tokens.workspaceRail.background,
      color: tokens.navigation.foreground,
      borderRight: { xs: 'none', md: `1px solid ${tokens.navigation.border}` },
    }}>
      <Box sx={{ px: 1.75, pt: 1.7, pb: 1.1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: tokens.navigation.muted }}>
              RECEPCIONES
            </Typography>
            <Typography sx={{ mt: 0.35, fontSize: 13, color: tokens.navigation.subtle }} noWrap>
              {total} en vista{resumen ? ` · ${currency.format(resumen.general)}` : ''}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.6} alignItems="center">
            <Tooltip title="Actualizar">
              <span>
                <IconButton
                  size="small"
                  aria-label="Actualizar"
                  disabled={refreshing}
                  onClick={() => { void actualizar(); }}
                  sx={iconoBorde}
                >
                  {refreshing ? <CircularProgress size={16} sx={{ color: tokens.navigation.foreground }} /> : <RefreshIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Acciones de la colección">
              <IconButton
                size="small"
                aria-label="Acciones de la colección"
                onClick={(event) => setGlobalMenuAnchor(event.currentTarget)}
                sx={iconoBorde}
              >
                <MoreHorizIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Menu anchorEl={globalMenuAnchor} open={Boolean(globalMenuAnchor)} onClose={() => setGlobalMenuAnchor(null)}>
              <Box sx={{ px: 1.5, pt: 0.5, pb: 1, minWidth: 260 }} onClick={() => setGlobalMenuAnchor(null)}>
                {extraActionsContent}
              </Box>
            </Menu>
          </Stack>
        </Box>

        <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mt: 1.35 }}>
          <TextField
            size="small"
            placeholder="Buscar folio, proveedor…"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: tokens.navigation.muted }} />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <IconButton size="small" aria-label="Limpiar búsqueda" onClick={() => onSearch('')} sx={{ color: tokens.navigation.muted }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
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
            <IconButton size="small" aria-label="Ordenar" onClick={(event) => setSortMenuAnchor(event.currentTarget)} sx={{ color: tokens.navigation.foreground }}>
              <SwapVertIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={sortMenuAnchor} open={Boolean(sortMenuAnchor)} onClose={() => setSortMenuAnchor(null)}>
            {SORT_FIELDS.map((campo) => {
              const current = sortModel.find((item) => item.field === campo.field);
              return (
                <MenuItem
                  key={campo.field}
                  onClick={() => {
                    const nextDir: 'asc' | 'desc' = current?.sort === 'asc' ? 'desc' : 'asc';
                    onSortModelChange([{ field: campo.field, sort: nextDir }]);
                    setSortMenuAnchor(null);
                  }}
                >
                  {campo.label} {current ? (current.sort === 'asc' ? '▲' : '▼') : ''}
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
        <PopoverFiltroFacturas
          ancla={anclaFiltro}
          filtro={filtros}
          contactos={contactos}
          vendedores={[]}
          mostrarAgente={false}
          etiquetaContacto={etiquetaContacto}
          onClose={() => setAnclaFiltro(null)}
          onChange={onFiltrosChange}
          statusOptions={statusOptions}
          quickFilter={quickFilter}
          onQuickFilter={onQuickFilter}
          soloPendientes={false}
          onSoloPendientes={() => undefined}
          mostrarSoloPendientes={false}
          resumen={resumen}
          currency={currency}
        />
      </Box>

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

      <Box sx={{
        flex: 1,
        overflowY: 'auto',
        px: 1,
        pb: 1.2,
        scrollbarWidth: 'thin',
        scrollbarColor: `${tokens.navigation.progress} ${tokens.navigation.background}`,
      }}>
        {isLoading && rows.length === 0 ? (
          <Stack alignItems="center" py={4}><CircularProgress size={24} sx={{ color: tokens.navigation.foreground }} /></Stack>
        ) : rows.length === 0 ? (
          <Typography sx={{ px: 1.5, py: 3, fontSize: 13, color: tokens.navigation.muted, textAlign: 'center' }}>
            {search || criteriosLista > 0 ? 'Ninguna recepción coincide con la búsqueda.' : 'Sin recepciones en esta vista.'}
          </Typography>
        ) : rows.map((row) => {
          const estatus = normalizarEstatus(row.estatus_documento);
          const option = statusOptions.find((item) => item.value === estatus);
          const selected = Number(row.id) === Number(selectedId);
          const checked = selectedIds.includes(Number(row.id));
          const tono = tonoEstatus(row.estatus_documento);
          const estado = option?.label || (estatus === 'emitido' ? 'Emitido' : estatus === 'cancelado' ? 'Cancelado' : 'Borrador');
          return (
            <Box
              key={row.id}
              onClick={() => { onSelect(row); onOpenDetail(); }}
              onDoubleClick={() => { onSelect(row); onEditar?.(row); }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelect(row);
                setMenuFila({ top: event.clientY, left: event.clientX, rowId: Number(row.id) });
              }}
              sx={{
                px: 1,
                py: 1.05,
                mb: 0.45,
                borderRadius: 2,
                cursor: 'pointer',
                bgcolor: selected ? tokens.navigation.selection : 'transparent',
                color: selected ? tokens.navigation.selectionForeground : tokens.navigation.foreground,
                boxShadow: selected ? '0 1px 2px rgba(0,0,0,0.18)' : 'none',
                '&:hover': { bgcolor: selected ? tokens.navigation.selection : tokens.navigation.hover },
              }}
            >
              <Stack direction="row" spacing={0.4} alignItems="flex-start">
                <Checkbox
                  size="small"
                  checked={checked}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    const id = Number(row.id);
                    onSelectedIdsChange(event.target.checked
                      ? [...selectedIds, id]
                      : selectedIds.filter((item) => item !== id));
                  }}
                  inputProps={{ 'aria-label': `Seleccionar ${formatFolio(row)}` }}
                  sx={{ p: 0.3, mt: -0.2, color: tokens.navigation.muted, '&.Mui-checked': { color: selected ? tokens.navigation.selectionForeground : tokens.navigation.foreground } }}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 0.5, alignItems: 'center' }}>
                    <Typography variant="figure" sx={{ fontSize: 16, color: 'inherit', lineHeight: 1.1 }}>{formatFolio(row)}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.15, flexShrink: 0 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 750, fontVariantNumeric: 'tabular-nums', color: 'inherit' }}>
                        {currency.format(Number(row.total ?? 0))}
                      </Typography>
                      <IconButton
                        size="small"
                        aria-label={`Acciones de ${formatFolio(row)}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(row);
                          setMenuFila({ top: event.clientY, left: event.clientX, rowId: Number(row.id) });
                        }}
                        sx={{
                          width: 28,
                          height: 28,
                          p: 0.25,
                          color: 'inherit',
                          '&:hover': { bgcolor: selected ? 'rgba(255,255,255,0.14)' : tokens.navigation.hover },
                        }}
                      >
                        <MoreVertIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography variant="figure" sx={{ fontSize: 14, mt: 0.25, color: tokens.navigation.foreground, lineHeight: 1.2 }} noWrap>
                    {row.nombre_cliente || 'Sin proveedor'}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 0.7, alignItems: 'center', mt: 0.3 }}>
                    <Box sx={{ display: 'flex', gap: 0.7, alignItems: 'center', minWidth: 0 }}>
                      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: tokens.navigation.foreground }}>
                        {estado}
                      </Typography>
                      <Tooltip title={estado} arrow>
                        <Box component="span" aria-label={estado} sx={{ width: 8, height: 8, flex: '0 0 8px', borderRadius: '50%', bgcolor: getStatusToneColor(theme, tono), display: 'inline-block' }} />
                      </Tooltip>
                    </Box>
                    <Typography sx={{ fontSize: 11, color: tokens.navigation.muted, flexShrink: 0 }}>{formatDate(row.fecha_documento)}</Typography>
                  </Box>
                </Box>
              </Stack>
            </Box>
          );
        })}
      </Box>

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 0.75, flexShrink: 0, borderTop: `1px solid ${tokens.navigation.border}` }}>
        <IconButton
          size="small"
          aria-label="Página anterior"
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
          sx={{ color: tokens.navigation.foreground }}
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ fontSize: 12, color: tokens.navigation.muted }}>
          Página {page + 1} de {pageCount}
        </Typography>
        <IconButton
          size="small"
          aria-label="Página siguiente"
          disabled={page + 1 >= pageCount}
          onClick={() => onPageChange(page + 1)}
          sx={{ color: tokens.navigation.foreground }}
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Stack>
      <WorkspaceRowContextMenu
        anchorPosition={menuFila && Number(selectedId) === menuFila.rowId ? { top: menuFila.top, left: menuFila.left } : null}
        items={menuFila && Number(selectedId) === menuFila.rowId
          ? actions.filter((action) => action.type !== 'separator' && !action.hidden).map((action) => ({
            id: action.id,
            label: action.label,
            icon: action.icon,
            disabled: action.disabled,
            onClick: (event) => { void action.onClick?.(event); },
          }))
          : []}
        onClose={() => setMenuFila(null)}
      />
    </Box>
  );
}
