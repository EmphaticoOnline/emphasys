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
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import type { CotizacionListado } from '../../../types/cotizacion';
import type { TipoDocumento } from '../../../types/documentos.types';
import type { DocumentoIndicatorModel } from '../indicadores';
import { DocumentoStatusIndicators } from '../indicadores';
import type { GridContextMenuAction, GridContextMenuActionItem } from '../../grids/GridContextMenu';
import FacturaDocumentoResumenView from './FacturaDocumentoResumenView';
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

  filtersContent: React.ReactNode;
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  hayFiltrosActivos: boolean;
  filtrosActivosCount: number;

  sortModel: SortModelInput;
  onSortModelChange: (model: SortModelItem[]) => void;

  extraActionsContent: React.ReactNode;
  onCreateDocumento: () => void;

  indicatorsByDocumentId: Readonly<Record<number, DocumentoIndicatorModel>>;
  gridContextMenuActions: GridContextMenuAction[];
  onSelectFactura: (event: React.MouseEvent<HTMLElement>, row: CotizacionListado) => void;

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

function estatusChipSx(option: StatusOption | undefined) {
  if (!option) return {};
  return {
    backgroundColor: option.color || '#f3f4f6',
    color: option.textColor || '#374151',
    fontWeight: 700,
  };
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
  filtersContent,
  filtersOpen,
  onFiltersOpenChange,
  hayFiltrosActivos,
  filtrosActivosCount,
  sortModel,
  onSortModelChange,
  extraActionsContent,
  onCreateDocumento,
  indicatorsByDocumentId,
  gridContextMenuActions,
  onSelectFactura,
  formatFolio,
  formatDate,
  currency,
  rowCount,
  paginationModel,
  onPaginationModelChange,
}: FacturasWorkspaceViewProps) {
  const [selectedId, setSelectedId] = useState<number | null>(rows[0]?.id ?? null);
  const [estadoMenuAnchor, setEstadoMenuAnchor] = useState<HTMLElement | null>(null);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<HTMLElement | null>(null);
  const [globalMenuAnchor, setGlobalMenuAnchor] = useState<HTMLElement | null>(null);
  const [documentoMenuAnchor, setDocumentoMenuAnchor] = useState<HTMLElement | null>(null);
  const [enviarMenuAnchor, setEnviarMenuAnchor] = useState<HTMLElement | null>(null);
  const [previewTab, setPreviewTab] = useState(0);

  // Si la fila seleccionada deja de existir (recarga, filtro nuevo), cae a la primera visible.
  useEffect(() => {
    if (rows.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!rows.some((row) => row.id === selectedId)) {
      setSelectedId(rows[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const selectedRow = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId]);

  useEffect(() => {
    setPreviewTab(0);
  }, [selectedId]);

  const handleSelect = (event: React.MouseEvent<HTMLElement>, row: CotizacionListado) => {
    setSelectedId(row.id);
    onSelectFactura(event, row);
  };

  // Se carga siempre (no sólo fuera del tab "Documento"): es un fetch JSON
  // liviano —el mismo que ya usan Resumen/Partidas/Pagos/…—, no la
  // generación de PDF. El tab "Documento" también lo consume (para
  // partidas/receptor/fiscales), pero pinta el encabezado de inmediato con
  // los datos síncronos de `row` mientras tanto.
  const detalle = useDocumentoDetalleData(selectedRow?.id ?? null, tipoDocumento, Boolean(selectedRow));
  const formatterMXN = useMemo(
    () => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }),
    []
  );

  const estatusActivoOption = quickFilter === 'todos' ? null : statusOptions.find((o) => o.value === quickFilter) ?? null;

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 180px)', minHeight: 560, border: '1px solid #e3e5ec', borderRadius: 2, overflow: 'hidden', bgcolor: '#fff' }}>
      {/* ===== Panel izquierdo: colección ===== */}
      <Box sx={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e3e5ec' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.75, height: 52, flexShrink: 0 }}>
          <Typography variant="body2" color="text.secondary" noWrap>
            <b>{rowCount}</b> facturas
            {resumenTotales ? <> &middot; <b>{currency.format(resumenTotales.general)}</b></> : null}
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Tooltip title="Acciones de la colección">
              <IconButton
                size="small"
                onClick={(e) => setGlobalMenuAnchor(e.currentTarget)}
                sx={{ border: '1.5px solid', borderColor: 'primary.main', color: 'primary.main' }}
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
                onClick={onCreateDocumento}
                sx={{ bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ px: 1.75, pb: 1, flexShrink: 0 }}>
          <TextField
            size="small"
            placeholder="Buscar folio, cliente, RFC…"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: 'text.disabled' }} />,
              endAdornment: searchTerm ? (
                <IconButton size="small" onClick={onClearSearch}><CloseIcon fontSize="small" /></IconButton>
              ) : null,
            }}
            sx={{ flex: 1, '& .MuiInputBase-root': { fontSize: 13 } }}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={(e) => setEstadoMenuAnchor(e.currentTarget)}
            endIcon={<ExpandMoreIcon fontSize="small" />}
            sx={{ textTransform: 'none', whiteSpace: 'nowrap', px: 1, fontWeight: 700, fontSize: 12 }}
          >
            {estatusActivoOption?.label ?? 'Todos'}
          </Button>
          <Menu anchorEl={estadoMenuAnchor} open={Boolean(estadoMenuAnchor)} onClose={() => setEstadoMenuAnchor(null)}>
            <MenuItem
              selected={quickFilter === 'todos'}
              onClick={() => { onQuickFilterChange('todos'); setEstadoMenuAnchor(null); }}
              sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, minWidth: 220 }}
            >
              <span>Todos</span>
              <Typography variant="caption" color="text.secondary">
                {resumenTotales ? currency.format(resumenTotales.general) : ''}
              </Typography>
            </MenuItem>
            {statusOptions.map((option) => (
              <MenuItem
                key={option.value}
                selected={quickFilter === option.value}
                onClick={() => { onQuickFilterChange(option.value); setEstadoMenuAnchor(null); }}
                sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}
              >
                <span>{option.label}</span>
                <Typography variant="caption" color="text.secondary">
                  {resumenTotales ? currency.format(resumenTotales.porEstado[option.value] ?? 0) : ''}
                </Typography>
              </MenuItem>
            ))}
          </Menu>

          <Tooltip title="Ordenar">
            <IconButton size="small" onClick={(e) => setSortMenuAnchor(e.currentTarget)}>
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
            <Badge color="primary" badgeContent={hayFiltrosActivos ? filtrosActivosCount : 0} invisible={!hayFiltrosActivos}>
              <IconButton size="small" onClick={() => onFiltersOpenChange(true)}>
                <FilterAltOutlinedIcon fontSize="small" />
              </IconButton>
            </Badge>
          </Tooltip>
        </Stack>

        <Divider />

        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {isLoading && rows.length === 0 ? (
            <Stack alignItems="center" py={4}><CircularProgress size={24} /></Stack>
          ) : rows.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
              Sin resultados.
            </Typography>
          ) : (
            rows.map((row) => {
              const estatus = normalizeEstatus(row.estatus_documento);
              const option = statusOptions.find((o) => o.value === estatus);
              const saldo = Number(row.saldo ?? 0);
              const selected = row.id === selectedId;
              return (
                <Box
                  key={row.id}
                  onClick={(e) => handleSelect(e, row)}
                  sx={{
                    px: 1.75,
                    py: 0.85,
                    borderBottom: '1px solid #eef0f3',
                    cursor: 'pointer',
                    bgcolor: selected ? '#eef1fb' : 'transparent',
                    borderLeft: selected ? '3px solid' : '3px solid transparent',
                    borderLeftColor: selected ? 'primary.main' : 'transparent',
                    '&:hover': { bgcolor: selected ? '#eef1fb' : '#f8f9fc' },
                  }}
                >
                  <Stack direction="row" spacing={0.75} alignItems="baseline">
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: option?.color || '#9ca3af', flexShrink: 0 }} />
                    <Typography variant="body2" fontWeight={700} noWrap>{formatFolio(row)}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1, minWidth: 0 }}>
                      {row.nombre_cliente || '—'}
                    </Typography>
                    <Typography variant="body2" fontWeight={700} noWrap>{currency.format(Number(row.total ?? 0))}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="space-between" sx={{ pl: 1.75, mt: 0.25 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Typography variant="caption" color="text.disabled">{formatDate(row.fecha_documento)}</Typography>
                      {option ? <Chip label={option.label} size="small" sx={{ height: 18, fontSize: 10, ...estatusChipSx(option) }} /> : null}
                    </Stack>
                    <Typography variant="caption" fontWeight={700} color={saldo > 0 ? 'error.main' : 'success.main'}>
                      Saldo: {currency.format(saldo)}
                    </Typography>
                  </Stack>
                </Box>
              );
            })
          )}
        </Box>

        <Divider />
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 0.75, flexShrink: 0 }}>
          <IconButton
            size="small"
            disabled={paginationModel.page <= 0}
            onClick={() => onPaginationModelChange({ ...paginationModel, page: paginationModel.page - 1 })}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <Typography variant="caption" color="text.secondary">
            Página {paginationModel.page + 1} de {Math.max(1, Math.ceil(rowCount / Math.max(1, paginationModel.pageSize)))}
          </Typography>
          <IconButton
            size="small"
            disabled={(paginationModel.page + 1) * paginationModel.pageSize >= rowCount}
            onClick={() => onPaginationModelChange({ ...paginationModel, page: paginationModel.page + 1 })}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      {/* ===== Drawer de filtros (contenido real, reusado tal cual) ===== */}
      <Drawer anchor="left" open={filtersOpen} onClose={() => onFiltersOpenChange(false)} sx={{ '& .MuiDrawer-paper': { width: 380, maxWidth: '90%' } }}>
        <Box sx={{ p: 2.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight={800}>Filtros</Typography>
            <IconButton size="small" onClick={() => onFiltersOpenChange(false)}><CloseIcon fontSize="small" /></IconButton>
          </Stack>
          {filtersContent}
        </Box>
      </Drawer>

      {/* ===== Panel derecho: workspace ===== */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {selectedRow ? (
          <FacturaWorkspacePanel
            key={selectedRow.id}
            row={selectedRow}
            tipoDocumento={tipoDocumento}
            statusOptions={statusOptions}
            indicators={indicatorsByDocumentId[selectedRow.id]}
            currency={currency}
            gridContextMenuActions={gridContextMenuActions}
            previewTab={previewTab}
            onPreviewTabChange={setPreviewTab}
            detalle={detalle}
            formatterMXN={formatterMXN}
            documentoMenuAnchor={documentoMenuAnchor}
            setDocumentoMenuAnchor={setDocumentoMenuAnchor}
            enviarMenuAnchor={enviarMenuAnchor}
            setEnviarMenuAnchor={setEnviarMenuAnchor}
          />
        ) : (
          <Stack alignItems="center" justifyContent="center" sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary">Selecciona una factura de la lista.</Typography>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

const PREVIEW_TAB_LABELS = ['Documento', 'Resumen', 'Partidas', 'Pagos', 'Notas de crédito', 'Relacionados', 'Inventario'];

function FacturaWorkspacePanel({
  row,
  tipoDocumento,
  statusOptions,
  indicators,
  currency,
  gridContextMenuActions,
  previewTab,
  onPreviewTabChange,
  detalle,
  formatterMXN,
  documentoMenuAnchor,
  setDocumentoMenuAnchor,
  enviarMenuAnchor,
  setEnviarMenuAnchor,
}: {
  row: CotizacionListado;
  tipoDocumento: TipoDocumento;
  statusOptions: StatusOption[];
  indicators: DocumentoIndicatorModel | undefined;
  currency: Intl.NumberFormat;
  gridContextMenuActions: GridContextMenuAction[];
  previewTab: number;
  onPreviewTabChange: (tab: number) => void;
  detalle: ReturnType<typeof useDocumentoDetalleData>;
  formatterMXN: Intl.NumberFormat;
  documentoMenuAnchor: HTMLElement | null;
  setDocumentoMenuAnchor: (el: HTMLElement | null) => void;
  enviarMenuAnchor: HTMLElement | null;
  setEnviarMenuAnchor: (el: HTMLElement | null) => void;
}) {
  const estatus = normalizeEstatus(row.estatus_documento);
  const option = statusOptions.find((o) => o.value === estatus);
  const saldo = Number(row.saldo ?? 0);

  const editarAction = findAction(gridContextMenuActions, 'editar');
  const timbrarAction = findAction(gridContextMenuActions, 'timbrar');
  const aplicarPagoAction = findAction(gridContextMenuActions, 'aplicar-pago');
  const contabilizarAction = findAction(gridContextMenuActions, 'contabilizar-factura-venta');
  const cancelarAction = findAction(gridContextMenuActions, 'cancelar-documento');
  const eliminarAction = findAction(gridContextMenuActions, 'eliminar');
  const verPdfAction = findAction(gridContextMenuActions, 'ver-pdf');
  const descargarPdfAction = findAction(gridContextMenuActions, 'descargar-pdf');
  const enviarCorreoAction = findAction(gridContextMenuActions, 'enviar-correo-factura');
  const enviarWhatsappAction = findAction(gridContextMenuActions, 'enviar-whatsapp');

  // Acción primaria contextual: la más urgente para el estado real de la
  // factura. Reutiliza el mismo `onClick`/`disabled` de la acción real — sólo
  // decide cuál mostrar en primer plano.
  let primaryAction: GridContextMenuActionItem | null = null;
  let primaryLabel = '';
  if (timbrarAction && !timbrarAction.hidden) {
    primaryAction = timbrarAction;
    primaryLabel = 'Timbrar CFDI';
  } else if (aplicarPagoAction && !aplicarPagoAction.hidden && saldo > 0) {
    primaryAction = aplicarPagoAction;
    primaryLabel = 'Registrar pago';
  } else if (estatus === 'borrador' && editarAction) {
    primaryAction = editarAction;
    primaryLabel = 'Editar factura';
  }

  // "Eliminar" siempre visible (requisito del mockup aprobado). La acción
  // real no calcula de antemano si es eliminable para facturas (hoy sólo
  // abre el diálogo de confirmación y el backend rechaza si no procede) —
  // aquí sólo se añade una señal visual best-effort, reflejando la misma
  // regla que ya aplica el backend (`assertFacturaEliminable`: bloquea si
  // está timbrada o tiene pagos activos). El clic, cuando está habilitado,
  // sigue disparando exactamente `handleRequestDelete` sin cambios.
  const facturaEliminable = !row.cfdi_uuid && !row.tiene_aplicaciones_saldo_activas;

  const runButtonAction = (action: GridContextMenuActionItem | null) => (event: React.MouseEvent<HTMLButtonElement>) => {
    void action?.onClick?.(event);
  };
  const runMenuItemAction = (action: GridContextMenuActionItem | null, closeMenu: () => void) => (event: React.MouseEvent<HTMLLIElement>) => {
    closeMenu();
    void action?.onClick?.(event);
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, height: 44, flexShrink: 0, bgcolor: 'primary.main', color: '#fff' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography variant="body1" fontWeight={800} noWrap>Factura {row.numero != null ? `${row.serie ?? ''}${row.numero}` : row.id}</Typography>
          {option ? <Chip label={option.label} size="small" sx={{ height: 20, fontSize: 10.5, ...estatusChipSx(option) }} /> : null}
          {indicators ? (
            <Box sx={{ '& .MuiChip-root, & button': { color: '#fff' } }}>
              <DocumentoStatusIndicators
                {...(indicators.financial ? { financial: indicators.financial } : {})}
                {...(indicators.cfdi ? { cfdi: indicators.cfdi } : {})}
                {...(indicators.accounting ? { accounting: indicators.accounting } : {})}
                maxVisible={2}
              />
            </Box>
          ) : null}
        </Stack>
        <Stack direction="row" spacing={0.75} alignItems="baseline">
          <Typography variant="caption" sx={{ opacity: 0.75, textTransform: 'uppercase', fontWeight: 700 }}>Saldo</Typography>
          <Typography variant="body2" fontWeight={800} sx={{ color: saldo > 0 ? '#ff9a95' : '#7fe6a3' }}>
            {currency.format(saldo)}
          </Typography>
        </Stack>
      </Box>

      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        justifyContent="flex-end"
        sx={{ px: 2.5, height: 40, flexShrink: 0, bgcolor: 'primary.main', borderBottom: '1px solid rgba(255,255,255,0.16)' }}
      >
        {primaryAction ? (
          <Button
            size="small"
            variant="outlined"
            disabled={Boolean(primaryAction.disabled)}
            onClick={runButtonAction(primaryAction)}
            sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.65)', textTransform: 'none', fontWeight: 700, '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.12)' } }}
          >
            {primaryLabel}
          </Button>
        ) : null}

        <Button
          size="small"
          variant="outlined"
          endIcon={<ExpandMoreIcon fontSize="small" />}
          startIcon={<DescriptionOutlinedIcon fontSize="small" />}
          onClick={(e) => setDocumentoMenuAnchor(e.currentTarget)}
          sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.55)', textTransform: 'none' }}
        >
          Documento
        </Button>
        <Menu anchorEl={documentoMenuAnchor} open={Boolean(documentoMenuAnchor)} onClose={() => setDocumentoMenuAnchor(null)}>
          {verPdfAction ? <MenuItem onClick={runMenuItemAction(verPdfAction, () => setDocumentoMenuAnchor(null))}>Ver / Imprimir PDF</MenuItem> : null}
          {descargarPdfAction ? <MenuItem onClick={runMenuItemAction(descargarPdfAction, () => setDocumentoMenuAnchor(null))}>Descargar PDF</MenuItem> : null}
        </Menu>

        <Button
          size="small"
          variant="outlined"
          endIcon={<ExpandMoreIcon fontSize="small" />}
          startIcon={<SendOutlinedIcon fontSize="small" />}
          onClick={(e) => setEnviarMenuAnchor(e.currentTarget)}
          sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.55)', textTransform: 'none' }}
        >
          Enviar
        </Button>
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

        {editarAction ? (
          <Button size="small" variant="outlined" disabled={Boolean(editarAction.disabled)} onClick={runButtonAction(editarAction)}
            sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.55)', textTransform: 'none' }}>
            Editar
          </Button>
        ) : null}

        {eliminarAction ? (
          <Tooltip title={facturaEliminable ? '' : 'No disponible: la factura ya está timbrada o tiene pagos aplicados'}>
            <span>
              <Button
                size="small"
                variant="outlined"
                disabled={Boolean(eliminarAction.disabled) || !facturaEliminable}
                onClick={runButtonAction(eliminarAction)}
                sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.55)', textTransform: 'none', '&.Mui-disabled': { color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.25)' } }}
              >
                Eliminar
              </Button>
            </span>
          </Tooltip>
        ) : null}

        {cancelarAction && !cancelarAction.hidden ? (
          <Button size="small" variant="outlined" disabled={Boolean(cancelarAction.disabled)} onClick={runButtonAction(cancelarAction)}
            sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.55)', textTransform: 'none' }}>
            Cancelar
          </Button>
        ) : null}

        {contabilizarAction && !contabilizarAction.hidden ? (
          <Button size="small" variant="outlined" disabled={Boolean(contabilizarAction.disabled)} onClick={runButtonAction(contabilizarAction)}
            sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.55)', textTransform: 'none' }}>
            {contabilizarAction.label}
          </Button>
        ) : null}
      </Stack>

      <Tabs
        value={previewTab}
        onChange={(_e, v) => onPreviewTabChange(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ px: 2.5, minHeight: 34, borderBottom: '1px solid #e3e5ec', '& .MuiTab-root': { minHeight: 34, textTransform: 'none', fontWeight: 700, fontSize: 12.5 } }}
      >
        {PREVIEW_TAB_LABELS.map((label) => <Tab key={label} label={label} />)}
      </Tabs>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
        {previewTab === 0 ? (
          <FacturaDocumentoResumenView
            row={row}
            documento={detalle.data?.documento ?? null}
            partidas={detalle.data?.partidas ?? null}
            partidasLoading={detalle.loading}
            currency={currency}
            statusOption={option}
          />
        ) : detalle.loading ? (
          <Stack alignItems="center" py={6}><CircularProgress size={26} /></Stack>
        ) : detalle.error ? (
          <Alert severity="error">{detalle.error}</Alert>
        ) : !detalle.data ? null : previewTab === 1 ? (
          <ResumenTab
            documento={detalle.data.documento}
            formatter={formatterMXN}
            tipoDocumento={tipoDocumento}
            folio={row.numero != null ? `${row.serie ?? ''}${row.numero}` : String(row.id)}
            reconciling={detalle.reconciling}
            reconciliationMessage={detalle.reconciliationMessage}
            onReconcile={async () => { await detalle.handleReconcile(); }}
          />
        ) : previewTab === 2 ? (
          <PartidasTab partidas={detalle.data.partidas} formatter={formatterMXN} />
        ) : previewTab === 3 ? (
          <PagosTab pagos={detalle.data.pagos} formatter={formatterMXN} />
        ) : previewTab === 4 ? (
          <NotasCreditoTab notasCredito={detalle.data.notasCredito} formatter={formatterMXN} />
        ) : previewTab === 5 ? (
          <RelacionadosTab documentosRelacionados={detalle.data.documentosRelacionados} formatter={formatterMXN} />
        ) : (
          <InventarioTab movimientos={detalle.data.movimientosInventario} />
        )}
      </Box>
    </>
  );
}
