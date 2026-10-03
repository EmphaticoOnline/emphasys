// Vista alterna de "Facturas" (lista compacta + workspace de la factura
// seleccionada), aprobada como mockup. Vive detrás de un flag reversible
// (ver `modules/documentos/facturasWorkspaceFlag.ts`) y sólo se monta cuando
// tipoDocumento === 'factura' && modulo === 'ventas'.
//
// Principio de esta implementación: cero lógica de negocio nueva. Todo lo
// que hace algo (timbrar, cancelar, eliminar, contabilizar, aplicar pago,
// enviar correo/WhatsApp, ver/descargar PDF, editar, crear) reutiliza
// exactamente los mismos handlers/guardas/drawers/diálogos que ya usa la
// tabla actual: `gridContextMenuActions` (memo ya calculado en
// DocumentosPage a partir de la fila "activa") y `extraActionsContent`
// (acciones globales ya armadas). Esta vista sólo decide *dónde* mostrar
// cada cosa, no *si* está permitida.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Popover,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  Snackbar,
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
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
import type { Contacto } from '../../../types/contactos.types';
import type { CotizacionListado } from '../../../types/cotizacion';
import type { TipoDocumento } from '../../../types/documentos.types';
import type { DocumentoIndicatorModel } from '../indicadores';
import { estadoVisualDocumento } from '../estadoVisualDocumento';
import { getStatusToneColor } from '../../status/status.semantics';
import type { GridContextMenuAction, GridContextMenuActionItem } from '../../grids/GridContextMenu';
import { WorkspaceRowContextMenu, type WorkspaceContextItem } from '../WorkspaceRowContextMenu';
import FacturaDocumentoResumenView from './FacturaDocumentoResumenView';
import FacturaWorkspaceContabilidadTab from './FacturaWorkspaceContabilidadTab';
import { resolverFolioVisual } from '../../../utils/documentos.utils';
import {
  useDocumentoDetalleData,
  ResumenTab,
  PartidasTab,
  PagosTab,
  NotasCreditoTab,
  RelacionadosTab,
  InventarioTab,
} from '../DocumentoDetalleContent';

type StatusOption = { value: string; label: string; color?: string; textColor?: string };
type FiltroFacturas = {
  fechaDesde: string;
  fechaHasta: string;
  clienteId: number | null;
  agenteId: number | null;
  montoMin: string;
  montoMax: string;
};
const FILTRO_FACTURAS_VACIO: FiltroFacturas = {
  fechaDesde: '',
  fechaHasta: '',
  clienteId: null,
  agenteId: null,
  montoMin: '',
  montoMax: '',
};
type SortModelItem = { field: string; sort: 'asc' | 'desc' | null | undefined };
type SortModelInput = readonly SortModelItem[];

export interface FacturasWorkspaceViewProps {
  rows: CotizacionListado[];
  isLoading: boolean;
  tipoDocumento: TipoDocumento;

  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onClearSearch: () => void;

  quickFilter: string;
  onQuickFilterChange: (value: string) => void;
  statusOptions: StatusOption[];
  resumenTotales: { general: number; porEstado: Record<string, number> } | null;

  filtros: FiltroFacturas;
  onFiltrosChange: (filtros: FiltroFacturas) => void;
  contactos: Contacto[];
  vendedores: Contacto[];
  mostrarAgente: boolean;
  etiquetaContacto: string;
  soloPendientes: boolean;
  onSoloPendientes: (value: boolean) => void;
  mostrarSoloPendientes: boolean;

  sortModel: SortModelInput;
  onSortModelChange: (model: SortModelItem[]) => void;

  extraActionsContent: React.ReactNode;
  onCreateDocumento: () => void;
  selectionContent?: React.ReactNode;
  selectedDocumentIds: number[];
  onSelectedDocumentIdsChange: (ids: number[]) => void;
  onChangeView: (workspace: boolean) => void;

  indicatorsByDocumentId: Readonly<Record<number, DocumentoIndicatorModel>>;
  gridContextMenuActions: GridContextMenuAction[];
  onSelectFactura: (row: CotizacionListado) => void;
  onCartaPorte: (row: CotizacionListado) => void;
  onRegistrarMovimiento?: (row: CotizacionListado) => void;
  onAplicarSaldoExistente?: (row: CotizacionListado) => void;
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
  { field: 'total', label: 'Total' },
  { field: 'saldo', label: 'Saldo' },
];

const normalizeEstatus = (value: unknown): string => String(value ?? '').trim().toLowerCase();

function findAction(actions: GridContextMenuAction[], id: string): GridContextMenuActionItem | null {
  const found = actions.find((action) => action.id === id);
  if (!found || found.type === 'separator') return null;
  return found;
}

function agregarAccionVisible(
  items: WorkspaceContextItem[],
  action: GridContextMenuActionItem | null,
  label: string,
  icon?: React.ReactNode,
  extraDisabled = false,
) {
  if (!action || action.hidden) return;
  const disabled = Boolean(action.disabled) || extraDisabled;
  items.push({
    id: action.id,
    label,
    icon: icon ?? action.icon,
    disabled,
    onClick: disabled ? undefined : (event) => { void action.onClick?.(event); },
  });
}

function itemsMenuFactura(
  row: CotizacionListado,
  actions: GridContextMenuAction[],
  tipoDocumento: TipoDocumento,
  onCartaPorte: (row: CotizacionListado) => void,
  onRegistrarMovimiento: ((row: CotizacionListado) => void) | undefined,
): WorkspaceContextItem[] {
  const estatus = normalizeEstatus(row.estatus_documento);
  const saldoPendiente = Number(row.saldo ?? 0) > 0;
  const facturaYaTimbrada = estatus === 'timbrado' || Boolean(row.cfdi_uuid);
  const esNotaDeVenta = String(row.tratamiento_impuestos ?? 'normal').trim().toLowerCase() === 'sin_iva';
  const cartaPorteDisabled = facturaYaTimbrada || esNotaDeVenta;
  const facturaEliminable = estatus === 'borrador';
  const timbrarAction = findAction(actions, 'timbrar');
  const registrarMovimientoAction = findAction(actions, 'registrar-movimiento');
  const enviarCorreoAction = findAction(actions, 'enviar-correo-factura');
  const enviarWhatsappAction = findAction(actions, 'enviar-whatsapp');
  const registrarMovimientoDisabled = !saldoPendiente
    || Boolean(registrarMovimientoAction?.disabled)
    || Boolean(row.cobro_bloqueado)
    || Number(row.contacto_principal_id ?? 0) <= 0;
  const registrarMovimientoLabel = registrarMovimientoAction?.label
    || (tipoDocumento === 'factura_compra' ? 'Registrar pago' : 'Registrar cobro');
  const items: WorkspaceContextItem[] = [{
    id: 'carta-porte',
    label: 'Carta Porte / Viaje',
    icon: <LocalShippingOutlinedIcon fontSize="small" />,
    disabled: cartaPorteDisabled,
    onClick: cartaPorteDisabled ? undefined : () => onCartaPorte(row),
  }];
  agregarAccionVisible(items, findAction(actions, 'ver-pdf'), 'Imprimir', <PrintOutlinedIcon fontSize="small" />);
  agregarAccionVisible(items, findAction(actions, 'descargar-cfdi'), 'Descargar CFDI', <FileDownloadOutlinedIcon fontSize="small" />, !row.cfdi_uuid);
  if (timbrarAction && !timbrarAction.hidden) {
    const timbrarDisabled = facturaYaTimbrada || Boolean(timbrarAction.disabled);
    items.push({
      id: timbrarAction.id,
      label: 'Timbrar CFDI',
      icon: timbrarAction.icon ?? <NotificationsActiveIcon fontSize="small" />,
      disabled: timbrarDisabled,
      onClick: timbrarDisabled ? undefined : (event) => { void timbrarAction.onClick?.(event); },
    });
  }
  if (onRegistrarMovimiento) {
    items.push({
      id: 'registrar-movimiento',
      label: registrarMovimientoLabel,
      icon: <AccountBalanceWalletIcon fontSize="small" />,
      disabled: registrarMovimientoDisabled,
      onClick: registrarMovimientoDisabled ? undefined : () => onRegistrarMovimiento(row),
    });
  }
  agregarAccionVisible(items, findAction(actions, 'generar-nota_credito'), 'Generar Nota de crédito', <AssignmentReturnOutlinedIcon fontSize="small" />);
  const correoVisible = Boolean(enviarCorreoAction && !enviarCorreoAction.hidden);
  const whatsappVisible = Boolean(enviarWhatsappAction && !enviarWhatsappAction.hidden);
  if (correoVisible && enviarCorreoAction) {
    items.push({
      id: enviarCorreoAction.id,
      label: 'Enviar por correo',
      icon: enviarCorreoAction.icon ?? <SendOutlinedIcon fontSize="small" />,
      disabled: Boolean(enviarCorreoAction.disabled),
      onClick: enviarCorreoAction.disabled ? undefined : (event) => { void enviarCorreoAction.onClick?.(event); },
    });
  }
  if (whatsappVisible && enviarWhatsappAction) {
    items.push({
      id: enviarWhatsappAction.id,
      label: 'Enviar por WhatsApp',
      icon: enviarWhatsappAction.icon ?? <SendOutlinedIcon fontSize="small" />,
      disabled: Boolean(enviarWhatsappAction.disabled),
      onClick: enviarWhatsappAction.disabled ? undefined : (event) => { void enviarWhatsappAction.onClick?.(event); },
    });
  }
  if (!correoVisible && !whatsappVisible) {
    items.push({
      id: 'enviar',
      label: 'Enviar',
      icon: <SendOutlinedIcon fontSize="small" />,
      disabled: true,
    });
  }
  agregarAccionVisible(items, findAction(actions, 'contabilizar-factura-venta'), 'Contabilizar factura');
  agregarAccionVisible(items, findAction(actions, 'cancelar-documento'), 'Cancelar');
  agregarAccionVisible(items, findAction(actions, 'emitir'), 'Emitir', <CheckCircleIcon fontSize="small" />);
  agregarAccionVisible(items, findAction(actions, 'editar'), 'Editar');
  agregarAccionVisible(items, findAction(actions, 'eliminar'), 'Eliminar', undefined, !facturaEliminable);
  return items;
}

export default function FacturasWorkspaceView({
  rows,
  isLoading,
  tipoDocumento,
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
  soloPendientes,
  onSoloPendientes,
  mostrarSoloPendientes,
  sortModel,
  onSortModelChange,
  extraActionsContent,
  onCreateDocumento,
  selectionContent,
  selectedDocumentIds,
  onSelectedDocumentIdsChange,
  onChangeView,
  indicatorsByDocumentId,
  gridContextMenuActions,
  onSelectFactura,
  onCartaPorte,
  onRegistrarMovimiento,
  initialSelectedId = null,
  documentoDetalleRefreshKey = 0,
  formatFolio,
  formatDate,
  currency,
  rowCount,
  paginationModel,
  onPaginationModelChange,
}: FacturasWorkspaceViewProps) {
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
  const [reconcileSnackbar, setReconcileSnackbar] = useState<{
    open: boolean;
    title: string;
    message: string;
    severity: 'success' | 'warning' | 'error';
  }>({ open: false, title: '', message: '', severity: 'success' });
  const activatedRowIdRef = useRef<number | null>(null);

  // Si la fila seleccionada deja de existir (recarga, filtro nuevo), cae a la primera visible.
  useEffect(() => {
    if (rows.length === 0) {
      setSelectedId(null);
      setDetalleMovil(false);
      return;
    }
    if (!rows.some((row) => row.id === selectedId)) {
      setSelectedId(rows[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const selectedRow = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);

  useEffect(() => {
    if (!selectedRow || activatedRowIdRef.current === selectedRow.id) return;
    activatedRowIdRef.current = selectedRow.id;
    onSelectFactura(selectedRow);
  }, [onSelectFactura, selectedRow]);

  useEffect(() => {
    setPreviewTab(0);
  }, [selectedId]);

  const handleSelect = (row: CotizacionListado) => {
    setSelectedId(row.id);
    setDetalleMovil(true);
  };

  // Se carga siempre (no sólo fuera del tab "Documento"): es un fetch JSON
  // liviano —el mismo que ya usan Resumen/Partidas/Pagos/…—, no la
  // generación de PDF. El tab "Documento" también lo consume (para
  // partidas/receptor/fiscales), pero pinta el encabezado de inmediato con
  // los datos síncronos de `row` mientras tanto.
  const detalle = useDocumentoDetalleData(selectedRow?.id ?? null, tipoDocumento, Boolean(selectedRow), documentoDetalleRefreshKey);
  const handleReconcile = async () => {
    const result = await detalle.handleReconcile();
    const estado = normalizeEstatus(result?.cancelacion_estado);
    const toast = estado === 'cancelada'
      ? { title: 'Cancelación confirmada', message: 'El SAT reporta el CFDI como cancelado.', severity: 'success' as const }
      : estado === 'pendiente'
        ? { title: 'Estado consultado', message: 'El SAT continúa reportando el CFDI como vigente.', severity: 'warning' as const }
        : estado === 'requiere_reconciliacion'
          ? { title: 'Estado no concluyente', message: 'No fue posible confirmar todavía el estado de la cancelación.', severity: 'warning' as const }
          : { title: 'No se pudo consultar el estado', message: 'Intenta nuevamente.', severity: 'error' as const };
    setReconcileSnackbar({ open: true, ...toast });
  };
  const formatterMXN = useMemo(
    () => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }),
    []
  );

  const verLista = !compacto || !detalleMovil;
  const criteriosLista = [
    filtros.fechaDesde,
    filtros.fechaHasta,
    filtros.clienteId,
    mostrarAgente ? filtros.agenteId : null,
    filtros.montoMin,
    filtros.montoMax,
  ].filter((value) => value !== '' && value !== null).length
    + (quickFilter !== 'todos' ? 1 : 0)
    + (mostrarSoloPendientes && soloPendientes ? 1 : 0);

  return (
    <Box sx={{ flex: 1, minHeight: compacto ? 'calc(100dvh - 112px)' : 0, display: 'flex', flexDirection: compacto ? 'column' : 'row', overflow: 'hidden' }}>
      <Box sx={{
        width: compacto ? '100%' : 372,
        flexShrink: 0,
        display: verLista ? 'flex' : 'none',
        flexDirection: 'column',
        minHeight: 0,
        bgcolor: tokens.navigation.background,
        color: tokens.navigation.foreground,
        borderRight: compacto ? 'none' : `1px solid ${tokens.navigation.border}`,
      }}>
        <Box sx={{ px: 1.75, pt: 1.7, pb: 1.1, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: tokens.navigation.muted }}>
                FACTURAS
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
                  onClick={(e) => setGlobalMenuAnchor(e.currentTarget)}
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
              <Tooltip title="Nueva factura">
                <IconButton
                  size="small"
                  aria-label="Nueva factura"
                  onClick={onCreateDocumento}
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor: tokens.navigation.control,
                    color: tokens.navigation.controlForeground,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
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
            placeholder="Buscar folio, cliente, RFC…"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
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
            <IconButton size="small" onClick={(e) => setSortMenuAnchor(e.currentTarget)} sx={{ color: tokens.navigation.foreground }}>
              <SwapVertIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={sortMenuAnchor} open={Boolean(sortMenuAnchor)} onClose={() => setSortMenuAnchor(null)}>
            {SORT_FIELDS.map((sf) => {
              const current = sortModel.find((s) => s.field === sf.field);
              return (
                <MenuItem
                  key={sf.field}
                  onClick={() => {
                    const nextDir: 'asc' | 'desc' = current?.sort === 'asc' ? 'desc' : 'asc';
                    onSortModelChange([{ field: sf.field, sort: nextDir }]);
                    setSortMenuAnchor(null);
                  }}
                >
                  {sf.label} {current ? (current.sort === 'asc' ? '▲' : '▼') : ''}
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
          vendedores={vendedores}
          mostrarAgente={mostrarAgente}
          etiquetaContacto={etiquetaContacto}
          onClose={() => setAnclaFiltro(null)}
          onChange={onFiltrosChange}
          statusOptions={statusOptions}
          quickFilter={quickFilter}
          onQuickFilter={onQuickFilterChange}
          soloPendientes={soloPendientes}
          onSoloPendientes={onSoloPendientes}
          mostrarSoloPendientes={mostrarSoloPendientes}
          resumen={resumenTotales}
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
              {searchTerm || criteriosLista > 0 ? 'Ninguna factura coincide con la búsqueda.' : 'Sin facturas en esta vista.'}
            </Typography>
          ) : (
            rows.map((row) => {
              const estatus = normalizeEstatus(row.estatus_documento);
              const option = statusOptions.find((o) => o.value === estatus);
              const saldo = Number(row.saldo ?? 0);
              const totalFila = Number(row.total ?? 0);
              const aplicado = Math.max(0, totalFila - saldo);
              const pct = totalFila > 0 ? Math.min(100, Math.round((aplicado / totalFila) * 100)) : 0;
              const selected = row.id === selectedId;
              const checked = selectedDocumentIds.includes(row.id);
              const estadoVisual = estadoVisualDocumento(row);
              return (
                <Box
                  key={row.id}
                  onClick={() => handleSelect(row)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedId(row.id);
                    onSelectFactura(row);
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
                          {currency.format(totalFila)}
                        </Typography>
                      </Box>
                      <Typography variant="figure" sx={{ fontSize: 14, mt: 0.25, color: tokens.navigation.foreground, lineHeight: 1.2 }} noWrap>
                        {row.nombre_cliente || 'Sin contacto'}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.7, alignItems: 'center', mt: 0.3 }}>
                        <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: tokens.navigation.foreground }}>
                          {option?.label || estatus || 'Sin estado'}
                        </Typography>
                        <Tooltip title={estadoVisual.label} arrow>
                          <Box component="span" aria-label={estadoVisual.label} sx={{ width: 8, height: 8, flex: '0 0 8px', borderRadius: '50%', bgcolor: getStatusToneColor(theme, estadoVisual.tone), display: 'inline-block' }} />
                        </Tooltip>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 0.55 }}>
                        <Typography sx={{ fontSize: 12, color: tokens.navigation.subtle }}>Saldo: {currency.format(saldo)}</Typography>
                        <Typography sx={{ fontSize: 11, color: tokens.navigation.muted }}>{formatDate(row.fecha_documento)}</Typography>
                      </Box>
                      <Box sx={{ mt: 0.55, height: 3, borderRadius: 99, bgcolor: tokens.navigation.track, overflow: 'hidden' }}>
                        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: saldo <= 0 ? tokens.metric.progressDone : tokens.navigation.progress }} />
                      </Box>
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
            ? itemsMenuFactura(selectedRow, gridContextMenuActions, tipoDocumento, onCartaPorte, onRegistrarMovimiento)
            : []}
          onClose={() => setMenuFila(null)}
        />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: compacto && verLista ? 'none' : 'flex', flexDirection: 'column', bgcolor: tokens.content.background }}>
        {selectedRow ? (
          <FacturaWorkspacePanel
            key={selectedRow.id}
            row={selectedRow}
            tipoDocumento={tipoDocumento}
            statusOptions={statusOptions}
            indicators={indicatorsByDocumentId[selectedRow.id]}
            currency={currency}
            formatDate={formatDate}
            gridContextMenuActions={gridContextMenuActions}
            previewTab={previewTab}
            onPreviewTabChange={setPreviewTab}
            detalle={detalle}
            onReconcile={handleReconcile}
            formatterMXN={formatterMXN}
            enviarMenuAnchor={enviarMenuAnchor}
            setEnviarMenuAnchor={setEnviarMenuAnchor}
            onCartaPorte={onCartaPorte}
            onRegistrarMovimiento={onRegistrarMovimiento}
            compacto={compacto}
            onVolver={() => setDetalleMovil(false)}
          />
        ) : (
          <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, px: 3, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: tokens.content.foreground }}>
              {rows.length > 0 ? 'Selecciona una factura' : 'Sin facturas en esta vista'}
            </Typography>
            <Typography sx={{ mt: 0.6, fontSize: 13, color: tokens.content.muted, maxWidth: 360 }}>
              {rows.length > 0
                ? 'El documento, sus partidas, pagos y contabilidad aparecen aquí.'
                : 'Ajusta la búsqueda o crea una factura nueva.'}
            </Typography>
          </Stack>
        )}
      </Box>
      <Snackbar
        open={reconcileSnackbar.open}
        autoHideDuration={5000}
        onClose={() => setReconcileSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setReconcileSnackbar((prev) => ({ ...prev, open: false }))}
          severity={reconcileSnackbar.severity}
          variant="filled"
          sx={{
            bgcolor: tokens.content.foreground,
            color: tokens.content.background,
            borderLeft: `4px solid ${reconcileSnackbar.severity === 'error' ? tokens.action.destructive : reconcileSnackbar.severity === 'warning' ? tokens.status.cancellation : tokens.metric.applied.foreground}`,
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: 12.5 }}>{reconcileSnackbar.title}</Typography>
          <Typography sx={{ fontSize: 12 }}>{reconcileSnackbar.message}</Typography>
        </Alert>
      </Snackbar>
    </Box>
  );
}

const PREVIEW_TAB_LABELS = ['Documento', 'Resumen', 'Partidas', 'Pagos', 'Contabilidad', 'Notas de crédito', 'Relacionados', 'Inventario'];

function FacturaWorkspacePanel({
  row,
  tipoDocumento,
  statusOptions,
  indicators,
  currency,
  formatDate,
  gridContextMenuActions,
  previewTab,
  onPreviewTabChange,
  detalle,
  onReconcile,
  formatterMXN,
  enviarMenuAnchor,
  setEnviarMenuAnchor,
  onCartaPorte,
  onRegistrarMovimiento,
  compacto,
  onVolver,
}: {
  row: CotizacionListado;
  tipoDocumento: TipoDocumento;
  statusOptions: StatusOption[];
  indicators: DocumentoIndicatorModel | undefined;
  currency: Intl.NumberFormat;
  formatDate: (value: unknown) => string;
  gridContextMenuActions: GridContextMenuAction[];
  previewTab: number;
  onPreviewTabChange: (tab: number) => void;
  detalle: ReturnType<typeof useDocumentoDetalleData>;
  onReconcile: () => Promise<void>;
  formatterMXN: Intl.NumberFormat;
  enviarMenuAnchor: HTMLElement | null;
  setEnviarMenuAnchor: (el: HTMLElement | null) => void;
  onCartaPorte: (row: CotizacionListado) => void;
  onRegistrarMovimiento: ((row: CotizacionListado) => void) | undefined;
  compacto: boolean;
  onVolver: () => void;
}) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const estatus = normalizeEstatus(row.estatus_documento);
  const option = statusOptions.find((o) => o.value === estatus);
  const saldo = Number(row.saldo ?? 0);

  const editarAction = findAction(gridContextMenuActions, 'editar');
  const emitirAction = findAction(gridContextMenuActions, 'emitir');
  const timbrarAction = findAction(gridContextMenuActions, 'timbrar');
  const registrarMovimientoAction = findAction(gridContextMenuActions, 'registrar-movimiento');
  const generarNotaCreditoAction = findAction(gridContextMenuActions, 'generar-nota_credito');
  const contabilizarAction = findAction(gridContextMenuActions, 'contabilizar-factura-venta');
  const cancelarAction = findAction(gridContextMenuActions, 'cancelar-documento');
  const eliminarAction = findAction(gridContextMenuActions, 'eliminar');
  const verPdfAction = findAction(gridContextMenuActions, 'ver-pdf');
  const descargarCfdiAction = findAction(gridContextMenuActions, 'descargar-cfdi');
  const enviarCorreoAction = findAction(gridContextMenuActions, 'enviar-correo-factura');
  const enviarWhatsappAction = findAction(gridContextMenuActions, 'enviar-whatsapp');

  const saldoPendiente = Number(row.saldo ?? 0) > 0;
  const registrarMovimientoLabel = registrarMovimientoAction?.label
    || (tipoDocumento === 'factura_compra' ? 'Registrar pago' : 'Registrar cobro');
  const registrarMovimientoDisabled = !saldoPendiente
    || Boolean(registrarMovimientoAction?.disabled)
    || Boolean(row.cobro_bloqueado)
    || Number(row.contacto_principal_id ?? 0) <= 0;
  const registrarMovimientoTooltip = !saldoPendiente
    ? 'La factura ya está liquidada.'
    : row.cobro_bloqueado
      ? 'Saldo suspendido por cancelación pendiente. No admite nuevas aplicaciones.'
      : Number(row.contacto_principal_id ?? 0) <= 0
        ? 'Documento sin contacto principal.'
        : registrarMovimientoLabel;
  const facturaYaTimbrada = estatus === 'timbrado' || Boolean(row.cfdi_uuid);
  // Las facturas con tratamiento sin_iva son notas de venta: no son CFDI
  // fiscales timbrables y tampoco pueden iniciar Carta Porte / Viaje.
  const esNotaDeVenta = String(row.tratamiento_impuestos ?? 'normal').trim().toLowerCase() === 'sin_iva';
  const folio = resolverFolioVisual(row, tipoDocumento) || String(row.id);
  const cartaPorteDisabled = facturaYaTimbrada || esNotaDeVenta;
  const timbrarDisabled = facturaYaTimbrada || Boolean(timbrarAction?.hidden) || Boolean(timbrarAction?.disabled);


  // La regla de eliminación de facturas es estrictamente el estado Borrador;
  // el backend permanece como autoridad final.
  const facturaEliminable = estatus === 'borrador';

  const runButtonAction = (action: GridContextMenuActionItem | null) => (event: React.MouseEvent<HTMLButtonElement>) => {
    void action?.onClick?.(event);
  };
  const runMenuItemAction = (action: GridContextMenuActionItem | null, closeMenu: () => void) => (event: React.MouseEvent<HTMLLIElement>) => {
    closeMenu();
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
  const estadoVisual = estadoVisualDocumento(row);
  const totalDocumento = Number(row.total ?? 0);
  const aplicadoDocumento = Math.max(0, totalDocumento - saldo);
  const pctDocumento = totalDocumento > 0 ? Math.min(100, Math.round((aplicadoDocumento / totalDocumento) * 100)) : 0;
  const renderActionButton = (
    action: GridContextMenuActionItem | null,
    caption: string,
    options?: { disabled?: boolean; icon?: React.ReactNode }
  ) => {
    if (!action || action.hidden) return null;
    const disabled = Boolean(action.disabled) || Boolean(options?.disabled);
    return (
      <Tooltip title={caption} arrow>
        <span>
          <IconButton
            size="small"
            aria-label={caption}
            disabled={disabled}
            onClick={runButtonAction(action)}
            sx={iconoSx(disabled)}
          >
            {options?.icon ?? action.icon}
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
            <ArrowBackIcon fontSize="small" /> Facturas
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: compacto ? 'column' : 'row' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: tokens.content.muted }}>
              {esNotaDeVenta ? 'NOTA DE VENTA SELECCIONADA' : 'FACTURA SELECCIONADA'}
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
            <Box sx={{ display: 'flex', gap: 0.7, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 26, px: 1.05, borderRadius: 99, bgcolor: tokens.metric.amount.background, color: tokens.content.foreground, fontSize: 12, fontWeight: 700 }}>
                {option?.label || estatus || 'Sin estado'}
              </Box>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, height: 26, px: 1.05, borderRadius: 99, bgcolor: tokens.content.elevated, color: tokens.content.foreground, fontSize: 12, fontWeight: 650 }}>
                <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getStatusToneColor(theme, estadoVisual.tone) }} />
                {estadoVisual.label}
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '100%' }}>
            <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap" sx={{ justifyContent: 'flex-end' }}>
              <Tooltip title={cartaPorteDisabled && facturaYaTimbrada ? 'Carta Porte / Viaje no disponible: factura timbrada' : cartaPorteDisabled ? 'Carta Porte / Viaje no disponible: nota de venta' : 'Carta Porte / Viaje'} arrow>
                <span>
                  <IconButton
                    size="small"
                    aria-label="Carta Porte / Viaje"
                    onClick={() => row && onCartaPorte(row)}
                    disabled={!row || cartaPorteDisabled}
                    sx={iconoSx(!row || cartaPorteDisabled)}
                  >
                    <LocalShippingOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              {renderActionButton(verPdfAction, 'Imprimir', { icon: <PrintOutlinedIcon fontSize="small" /> })}
              {renderActionButton(descargarCfdiAction, 'Descargar CFDI', {
                disabled: !row.cfdi_uuid,
                icon: <FileDownloadOutlinedIcon fontSize="small" />,
              })}
              {timbrarAction && !timbrarAction.hidden ? (
                <Tooltip title={timbrarDisabled ? 'CFDI ya timbrado' : 'Timbrar CFDI'} arrow>
                  <span>
                    <IconButton
                      size="small"
                      aria-label="Timbrar CFDI"
                      disabled={timbrarDisabled}
                      onClick={facturaYaTimbrada ? undefined : runButtonAction(timbrarAction)}
                      sx={iconoSx(timbrarDisabled)}
                    >
                      {timbrarAction.icon ?? <NotificationsActiveIcon fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
              ) : null}
              {onRegistrarMovimiento ? (
                <Tooltip
                  title={registrarMovimientoTooltip}
                  arrow
                >
                  <span>
                    <IconButton
                      size="small"
                      aria-label={registrarMovimientoLabel}
                      disabled={registrarMovimientoDisabled}
                      onClick={() => onRegistrarMovimiento(row)}
                      sx={iconoSx(registrarMovimientoDisabled)}
                    >
                      <AccountBalanceWalletIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              ) : null}
              {renderActionButton(generarNotaCreditoAction, 'Generar Nota de crédito', {
                icon: <AssignmentReturnOutlinedIcon fontSize="small" />,
              })}
              <Tooltip title="Enviar" arrow>
                <span>
                  <IconButton
                    size="small"
                    aria-label="Enviar"
                    disabled={Boolean(
                      (!enviarCorreoAction || enviarCorreoAction.hidden || enviarCorreoAction.disabled)
                      && (!enviarWhatsappAction || enviarWhatsappAction.hidden || enviarWhatsappAction.disabled)
                    )}
                    onClick={(e: React.MouseEvent<HTMLElement>) => setEnviarMenuAnchor(e.currentTarget)}
                    sx={iconoSx(Boolean(
                      (!enviarCorreoAction || enviarCorreoAction.hidden || enviarCorreoAction.disabled)
                      && (!enviarWhatsappAction || enviarWhatsappAction.hidden || enviarWhatsappAction.disabled)
                    ))}
                  >
                    <SendOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Menu anchorEl={enviarMenuAnchor} open={Boolean(enviarMenuAnchor)} onClose={() => setEnviarMenuAnchor(null)}>
                {enviarCorreoAction && !enviarCorreoAction.hidden ? (
                  <MenuItem disabled={Boolean(enviarCorreoAction.disabled)} onClick={runMenuItemAction(enviarCorreoAction, () => setEnviarMenuAnchor(null))}>
                    Enviar por correo
                  </MenuItem>
                ) : null}
                {enviarWhatsappAction && !enviarWhatsappAction.hidden ? (
                  <MenuItem disabled={Boolean(enviarWhatsappAction.disabled)} onClick={runMenuItemAction(enviarWhatsappAction, () => setEnviarMenuAnchor(null))}>
                    Enviar por WhatsApp
                  </MenuItem>
                ) : null}
              </Menu>
              {renderActionButton(contabilizarAction, 'Contabilizar factura')}
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap" sx={{ justifyContent: 'flex-end' }}>
              {renderActionButton(cancelarAction, 'Cancelar')}
              {renderActionButton(emitirAction, 'Emitir', { icon: <CheckCircleIcon fontSize="small" /> })}
              {renderActionButton(editarAction, 'Editar')}
              {renderActionButton(eliminarAction, 'Eliminar', { disabled: !facturaEliminable })}
            </Stack>
          </Box>
        </Box>
      </Box>

      <Box sx={{ px: { xs: 1.5, md: 2.75 }, pb: 1.6, flexShrink: 0 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: compacto ? '1fr' : '1fr 1fr 1.15fr', gap: 0.8 }}>
          <Box sx={{ px: 1.4, py: 1.1, borderRadius: 2, bgcolor: tokens.metric.amount.background, color: tokens.content.foreground }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: tokens.metric.caption }}>TOTAL</Typography>
            <Typography variant="figure" sx={{ fontSize: 22, lineHeight: 1.15, color: 'inherit' }}>{currency.format(totalDocumento)}</Typography>
          </Box>
          <Box sx={{ px: 1.4, py: 1.1, borderRadius: 2, bgcolor: tokens.metric.applied.background, color: tokens.content.foreground }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: tokens.metric.caption }}>APLICADO</Typography>
            <Typography variant="figure" sx={{ fontSize: 22, lineHeight: 1.15, color: 'inherit' }}>{currency.format(aplicadoDocumento)}</Typography>
          </Box>
          <Box sx={{ px: 1.4, py: 1.1, borderRadius: 2, bgcolor: saldo > 0 ? tokens.metric.blocked.background : tokens.metric.available.background, color: tokens.content.foreground }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: tokens.metric.caption }}>SALDO</Typography>
            <Typography variant="figure" sx={{ fontSize: 22, lineHeight: 1.15, color: 'inherit' }}>{currency.format(saldo)}</Typography>
          </Box>
        </Box>
        <Box sx={{ mt: 1.1, height: 4, borderRadius: 99, bgcolor: tokens.metric.track, overflow: 'hidden' }}>
          <Box sx={{ width: `${pctDocumento}%`, height: '100%', bgcolor: saldo <= 0 ? tokens.metric.progressDone : tokens.metric.progress }} />
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
        onChange={(_e, v) => onPreviewTabChange(v)}
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

      <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 1.5, md: 2.25 } }}>
        {previewTab === 0 ? (
          <FacturaDocumentoResumenView
            row={row}
            documento={detalle.data?.documento ?? null}
            partidas={detalle.data?.partidas ?? null}
            partidasLoading={detalle.loading}
            currency={currency}
            statusOption={option}
            onReconcile={onReconcile}
            reconciling={detalle.reconciling}
          />
        ) : previewTab === 4 ? (
          <FacturaWorkspaceContabilidadTab accounting={indicators?.accounting} />
        ) : detalle.loading ? (
          <Stack alignItems="center" py={6}><CircularProgress size={26} /></Stack>
        ) : detalle.error ? (
          <Alert severity="error">{detalle.error}</Alert>
        ) : !detalle.data ? null : previewTab === 1 ? (
          <ResumenTab
            documento={detalle.data.documento}
            partidas={detalle.data.partidas}
            formatter={formatterMXN}
            tipoDocumento={tipoDocumento}
            folio={folio}
            reconciling={detalle.reconciling}
            reconciliationMessage={null}
            onReconcile={onReconcile}
          />
        ) : previewTab === 2 ? (
          <PartidasTab partidas={detalle.data.partidas} formatter={formatterMXN} />
        ) : previewTab === 3 ? (
          <PagosTab pagos={detalle.data.pagos} formatter={formatterMXN} />
        ) : previewTab === 5 ? (
          <NotasCreditoTab notasCredito={detalle.data.notasCredito} formatter={formatterMXN} />
        ) : previewTab === 6 ? (
          <RelacionadosTab documentosRelacionados={detalle.data.documentosRelacionados} formatter={formatterMXN} />
        ) : (
          <InventarioTab movimientos={detalle.data.movimientosInventario} />
        )}
      </Box>
      </Box>
    </>
  );
}

function PopoverFiltroFacturas({
  ancla,
  filtro,
  contactos,
  vendedores,
  mostrarAgente,
  etiquetaContacto,
  onClose,
  onChange,
  statusOptions,
  quickFilter,
  onQuickFilter,
  soloPendientes,
  onSoloPendientes,
  mostrarSoloPendientes,
  resumen,
  currency,
}: {
  ancla: HTMLElement | null;
  filtro: FiltroFacturas;
  contactos: Contacto[];
  vendedores: Contacto[];
  mostrarAgente: boolean;
  etiquetaContacto: string;
  onClose: () => void;
  onChange: (filtro: FiltroFacturas) => void;
  statusOptions: StatusOption[];
  quickFilter: string;
  onQuickFilter: (value: string) => void;
  soloPendientes: boolean;
  onSoloPendientes: (value: boolean) => void;
  mostrarSoloPendientes: boolean;
  resumen: { general: number; porEstado: Record<string, number> } | null;
  currency: Intl.NumberFormat;
}) {
  const tokens = useTheme().emphasys;
  const contacto = contactos.find((item) => item.id === filtro.clienteId) ?? null;
  const agente = vendedores.find((item) => item.id === filtro.agenteId) ?? null;
  const campoSx = {
    '& .MuiInputLabel-root': { color: tokens.content.muted },
    '& .MuiInputLabel-root.Mui-focused': { color: tokens.content.foreground },
    '& .MuiOutlinedInput-root': {
      color: tokens.content.foreground,
      bgcolor: tokens.content.elevated,
      '& fieldset': { borderColor: tokens.content.border },
      '&:hover fieldset': { borderColor: tokens.content.foreground },
      '&.Mui-focused fieldset': { borderColor: tokens.content.foreground },
    },
    '& .MuiOutlinedInput-input::placeholder': { color: tokens.content.muted, opacity: 1 },
  };
  return (
    <Popover
      open={Boolean(ancla)}
      anchorEl={ancla}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: {
          sx: {
            mt: 0.75,
            p: 1.5,
            width: 320,
            borderRadius: 2,
            bgcolor: tokens.content.card,
            color: tokens.content.foreground,
            border: `1px solid ${tokens.content.border}`,
            boxShadow: '0 16px 40px rgba(44, 49, 56, 0.18)',
            maxHeight: 'min(70vh, 560px)',
            overflow: 'auto',
          },
        },
      }}
    >
      <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: tokens.content.muted }}>FILTROS</Typography>
      <Box sx={{ display: 'grid', gap: 1.1, mt: 1.2 }}>
        {mostrarSoloPendientes && (
          <Box
            component="label"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.4, cursor: 'pointer', color: tokens.content.foreground }}
          >
            <Checkbox
              size="small"
              checked={soloPendientes}
              onChange={(event) => onSoloPendientes(event.target.checked)}
              sx={{ p: 0.4, color: tokens.content.muted, '&.Mui-checked': { color: tokens.content.foreground } }}
            />
            <Typography sx={{ fontSize: 13, fontWeight: 650 }}>Solo pendientes</Typography>
          </Box>
        )}
        <Box sx={{ display: 'grid', gap: 0.35 }}>
          {[{ value: 'todos', label: 'Todos' }, ...statusOptions].map((estado) => {
            const activo = quickFilter === estado.value;
            const monto = estado.value === 'todos' ? resumen?.general : resumen?.porEstado[estado.value];
            return (
              <Box
                key={estado.value}
                component="button"
                type="button"
                onClick={() => onQuickFilter(estado.value)}
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 1,
                  border: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: 1.5,
                  px: 1,
                  py: 0.55,
                  font: 'inherit',
                  color: tokens.content.foreground,
                  bgcolor: activo ? tokens.action.wash : 'transparent',
                  '&:hover': { bgcolor: activo ? tokens.action.wash : tokens.content.hover },
                }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: activo ? 750 : 600 }}>{estado.label}</Typography>
                <Typography sx={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: tokens.content.secondary }}>
                  {monto == null ? '—' : currency.format(monto)}
                </Typography>
              </Box>
            );
          })}
        </Box>
        <TextField size="small" type="date" label="Fecha desde" value={filtro.fechaDesde} onChange={(event) => onChange({ ...filtro, fechaDesde: event.target.value })} InputLabelProps={{ shrink: true }} sx={campoSx} />
        <TextField size="small" type="date" label="Fecha hasta" value={filtro.fechaHasta} onChange={(event) => onChange({ ...filtro, fechaHasta: event.target.value })} InputLabelProps={{ shrink: true }} sx={campoSx} />
        <Autocomplete
          size="small"
          options={contactos}
          value={contacto}
          onChange={(_, value) => onChange({ ...filtro, clienteId: value?.id ?? null })}
          getOptionLabel={(option) => option.nombre || ''}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderInput={(params) => (
            <TextField {...(params as object)} label={etiquetaContacto} placeholder="Todos" sx={campoSx} />
          )}
        />
        {mostrarAgente && (
          <Autocomplete
            size="small"
            options={vendedores}
            value={agente}
            onChange={(_, value) => onChange({ ...filtro, agenteId: value?.id ?? null })}
            getOptionLabel={(option) => option.nombre || ''}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField {...(params as object)} label="Agente de ventas" placeholder="Todos" sx={campoSx} />
            )}
          />
        )}
        <TextField size="small" type="number" label="Monto mínimo" value={filtro.montoMin} onChange={(event) => onChange({ ...filtro, montoMin: event.target.value })} inputProps={{ min: 0, step: 0.01 }} sx={campoSx} />
        <TextField size="small" type="number" label="Monto máximo" value={filtro.montoMax} onChange={(event) => onChange({ ...filtro, montoMax: event.target.value })} inputProps={{ min: 0, step: 0.01 }} sx={campoSx} />
        <Box
          component="button"
          type="button"
          onClick={() => {
            onChange(FILTRO_FACTURAS_VACIO);
            onSoloPendientes(false);
            onQuickFilter('todos');
          }}
          sx={{ justifySelf: 'start', border: 0, bgcolor: 'transparent', color: tokens.content.foreground, font: 'inherit', fontSize: 13, fontWeight: 750, cursor: 'pointer', p: 0 }}
        >
          Limpiar filtros
        </Box>
      </Box>
    </Popover>
  );
}
