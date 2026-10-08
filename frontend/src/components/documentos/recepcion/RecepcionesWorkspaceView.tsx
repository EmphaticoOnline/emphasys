import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Box, IconButton, Stack, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import type { Contacto } from '../../../types/contactos.types';
import type { CotizacionListado } from '../../../types/cotizacion';
import type { GridContextMenuAction, GridContextMenuActionItem } from '../../grids/GridContextMenu';
import { DocumentoHojaViewport } from '../DocumentoHojaFrame';
import { useDocumentoDetalleData } from '../DocumentoDetalleContent';
import { getRecepcionResumen, type RecepcionResumenResponse } from '../../../services/documentosService';
import { formatearFolioDocumento } from '../../../utils/documentos.utils';
import type { StatusTone } from '../../status/status.types';
import RecepcionDocumentoResumenView from './RecepcionDocumentoResumenView';
import RecepcionWorkspaceRail from './RecepcionWorkspaceRail';

type FiltroLista = {
  fechaDesde: string;
  fechaHasta: string;
  clienteId: number | null;
  agenteId: number | null;
  montoMin: string;
  montoMax: string;
};
type StatusOption = { value: string; label: string; color?: string; textColor?: string };
type SortItem = { field: string; sort: 'asc' | 'desc' | null | undefined };

export type RecepcionesWorkspaceViewProps = {
  rows: CotizacionListado[];
  isLoading: boolean;
  selectedId: number | null;
  onSelect: (row: CotizacionListado) => void;
  search: string;
  onSearch: (value: string) => void;
  onCreate: () => void;
  onOpen: (row: CotizacionListado) => void;
  onRefresh: () => Promise<void>;
  onExport: () => void;
  exportLoading: boolean;
  actions: GridContextMenuAction[];
  title: string;
  formatFolio: (row: CotizacionListado) => string;
  formatDate: (value: unknown) => string;
  currency: Intl.NumberFormat;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  statusOptions?: StatusOption[];
  quickFilter?: string;
  onQuickFilter?: (value: string) => void;
  filtros?: FiltroLista;
  onFiltrosChange?: (filtros: FiltroLista) => void;
  contactos?: Contacto[];
  etiquetaContacto?: string;
  resumen?: { general: number; porEstado: Record<string, number> } | null;
  sortModel?: readonly SortItem[];
  onSortModelChange?: (model: SortItem[]) => void;
  selectedIds?: number[];
  onSelectedIdsChange?: (ids: number[]) => void;
  selectionContent?: ReactNode;
  extraActionsContent?: ReactNode;
  documentoDetalleRefreshKey?: number;
};

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

function formatoCantidad(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('es-MX', { maximumFractionDigits: 4 });
}

function esAccion(action: GridContextMenuAction): action is GridContextMenuActionItem {
  return action.type !== 'separator' && !action.hidden;
}

function esGenerarFacturaCompra(action: GridContextMenuActionItem): boolean {
  if (action.id === 'generar-factura_compra') return true;
  const label = action.label.toLowerCase();
  return label.startsWith('generar') && label.includes('factura') && !label.includes('recepci');
}

function captionAccion(action: GridContextMenuActionItem): string {
  if (action.id === 'editar') return 'Editar';
  if (action.id === 'ver-pdf') return 'Ver / Imprimir PDF';
  if (action.id === 'descargar-pdf') return 'Descargar PDF';
  if (action.id === 'cancelar-documento') return 'Cancelar';
  if (action.id === 'eliminar') return 'Eliminar';
  return action.label;
}

function iconoAccion(action: GridContextMenuActionItem) {
  if (esGenerarFacturaCompra(action)) return <ReceiptLongOutlinedIcon fontSize="small" />;
  return action.icon;
}

function AccionesRecepcion({ actions, tokens }: { actions: GridContextMenuAction[]; tokens: ReturnType<typeof useTheme>['emphasys'] }) {
  const visibles = actions.filter(esAccion);
  const grupos = [
    visibles.filter((action) => action.id === 'editar' || esGenerarFacturaCompra(action)),
    visibles.filter((action) => action.id === 'ver-pdf' || action.id === 'descargar-pdf'),
    visibles.filter((action) => action.id === 'cancelar-documento' || action.id === 'eliminar'),
  ].filter((grupo) => grupo.length > 0);
  const sx = (disabled: boolean) => ({
    width: 34,
    height: 34,
    borderRadius: '10px',
    bgcolor: disabled ? tokens.action.disabled : tokens.action.primary,
    color: tokens.action.primaryForeground,
    '&:hover': { bgcolor: disabled ? tokens.action.disabled : tokens.action.primaryHover },
    '&.Mui-disabled': { bgcolor: tokens.action.disabled, color: tokens.action.primaryForeground },
  });

  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ justifyContent: 'flex-end' }}>
      {grupos.map((grupo, index) => (
        <Stack
          key={grupo.map((action) => action.id).join('-')}
          direction="row"
          spacing={0.5}
          sx={{ pl: index ? 1 : 0, ml: index ? 0.5 : 0, borderLeft: index ? `1px solid ${tokens.content.border}` : 'none' }}
        >
          {grupo.map((action) => {
            const disabled = Boolean(action.disabled);
            const caption = captionAccion(action);
            return (
              <Tooltip key={action.id} title={caption} arrow>
                <span>
                  <IconButton
                    size="small"
                    aria-label={caption}
                    disabled={disabled}
                    onClick={(event) => { void action.onClick?.(event); }}
                    sx={sx(disabled)}
                  >
                    {iconoAccion(action)}
                  </IconButton>
                </span>
              </Tooltip>
            );
          })}
        </Stack>
      ))}
    </Stack>
  );
}

export default function RecepcionesWorkspaceView(props: RecepcionesWorkspaceViewProps) {
  const {
    rows,
    isLoading,
    selectedId,
    onSelect,
    onOpen,
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
    statusOptions = [],
    quickFilter = 'todos',
    onQuickFilter = () => undefined,
    filtros = { fechaDesde: '', fechaHasta: '', clienteId: null, agenteId: null, montoMin: '', montoMax: '' },
    onFiltrosChange = () => undefined,
    contactos = [],
    etiquetaContacto = 'Proveedor',
    resumen = null,
    sortModel = [],
    onSortModelChange = () => undefined,
    selectedIds = [],
    onSelectedIdsChange = () => undefined,
    selectionContent,
    extraActionsContent,
    documentoDetalleRefreshKey = 0,
  } = props;
  const theme = useTheme();
  const tokens = theme.emphasys;
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [detalleMovil, setDetalleMovil] = useState(false);
  const [recepcionResumen, setRecepcionResumen] = useState<RecepcionResumenResponse | null>(null);
  const seleccion = useMemo(
    () => rows.find((row) => Number(row.id) === Number(selectedId)) ?? rows[0] ?? null,
    [rows, selectedId],
  );
  const detail = useDocumentoDetalleData(seleccion?.id ?? null, 'recepcion', Boolean(seleccion), documentoDetalleRefreshKey);

  useEffect(() => {
    if (!selectedId && rows[0]) onSelect(rows[0]);
  }, [onSelect, rows, selectedId]);

  useEffect(() => {
    const id = Number(seleccion?.id ?? 0);
    if (!id) {
      setRecepcionResumen(null);
      return;
    }
    let cancelado = false;
    setRecepcionResumen(null);
    getRecepcionResumen(id)
      .then((value) => {
        if (!cancelado) setRecepcionResumen(value);
      })
      .catch(() => {
        if (!cancelado) setRecepcionResumen(null);
      });
    return () => {
      cancelado = true;
    };
  }, [seleccion?.id, documentoDetalleRefreshKey]);

  const detalleActual = Number(detail.data?.documento?.id) === Number(seleccion?.id) ? detail.data : null;
  const partidas = detalleActual?.partidas ?? null;
  const cantidadEstaRecepcion = partidas
    ? partidas.reduce((sum, partida) => sum + Number(partida.cantidad ?? 0), 0)
    : null;
  const folioOrigen = useMemo(() => {
    const relacionados = detalleActual?.documentosRelacionados ?? [];
    const origenes = detalleActual?.documentosOrigen ?? [];
    const origen = [...origenes, ...relacionados].find((doc) => (
      String(doc.tipo_documento).toLowerCase() === 'orden_compra' && doc.relacion !== 'destino'
    )) ?? origenes[0] ?? relacionados.find((doc) => doc.relacion === 'origen') ?? null;
    if (origen?.numero != null) {
      const folio = formatearFolioDocumento(origen.serie ?? '', Number(origen.numero));
      if (folio) return folio;
    }
    const traza = (detalleActual?.documento as { documento_trazabilidad?: { tipo_documento?: string; folio?: string } | null } | undefined)?.documento_trazabilidad;
    const folioTraza = String(traza?.folio ?? '').trim();
    if (!folioTraza) return null;
    const tipoTraza = String(traza?.tipo_documento ?? '').toLowerCase();
    if (tipoTraza && tipoTraza !== 'orden_compra') return null;
    return folioTraza;
  }, [detalleActual]);
  const estatus = normalizarEstatus(seleccion?.estatus_documento);
  const statusOption = statusOptions.find((option) => option.value === estatus);
  const estado = statusOption?.label || (estatus === 'emitido' ? 'Emitido' : estatus === 'cancelado' ? 'Cancelado' : 'Borrador');
  const metricas = [
    ['ESTA RECEPCIÓN', formatoCantidad(cantidadEstaRecepcion), tokens.metric.amount],
    ['RECIBIDO ACUMULADO', formatoCantidad(recepcionResumen ? Number(recepcionResumen.total_recibido) : null), tokens.metric.applied],
    ['PENDIENTE POR RECIBIR', formatoCantidad(recepcionResumen ? Number(recepcionResumen.total_pendiente) : null), Number(recepcionResumen?.total_pendiente ?? 0) > 0 ? tokens.metric.blocked : tokens.metric.available],
  ] as const;

  return (
    <Box sx={{ height: { md: 'calc(100vh - 86px)', xs: 'auto' }, minHeight: 560, display: 'flex', bgcolor: tokens.canvas.page }}>
      <RecepcionWorkspaceRail
        rows={rows}
        isLoading={isLoading}
        selectedId={seleccion?.id ?? null}
        onSelect={onSelect}
        onOpenDetail={() => setDetalleMovil(true)}
        onEditar={onOpen}
        search={search}
        onSearch={onSearch}
        onRefresh={onRefresh}
        actions={actions}
        formatFolio={formatFolio}
        formatDate={formatDate}
        currency={currency}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={onPageChange}
        compacto={mobile}
        oculto={mobile && detalleMovil}
        statusOptions={statusOptions}
        quickFilter={quickFilter}
        onQuickFilter={onQuickFilter}
        filtros={filtros}
        onFiltrosChange={onFiltrosChange}
        contactos={contactos}
        etiquetaContacto={etiquetaContacto}
        resumen={resumen}
        sortModel={sortModel}
        onSortModelChange={onSortModelChange}
        selectedIds={selectedIds}
        onSelectedIdsChange={onSelectedIdsChange}
        selectionContent={selectionContent}
        extraActionsContent={extraActionsContent}
      />
      <Box sx={{ flex: 1, minWidth: 0, display: mobile && !detalleMovil ? 'none' : 'flex', flexDirection: 'column', overflow: 'auto', bgcolor: tokens.content.background }}>
        {seleccion ? (
          <>
            <Box sx={{ px: { xs: 1.5, md: 2.75 }, pt: mobile ? 1 : 1.6, pb: 1.4, flexShrink: 0 }}>
              {mobile ? (
                <Box
                  component="button"
                  type="button"
                  onClick={() => setDetalleMovil(false)}
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, border: 0, bgcolor: 'transparent', color: tokens.content.foreground, font: 'inherit', cursor: 'pointer', mb: 0.5, p: 0 }}
                >
                  <ArrowBackIcon fontSize="small" /> Recepciones
                </Box>
              ) : null}
              <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: mobile ? 'column' : 'row' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: tokens.content.muted }}>
                    RECEPCIÓN SELECCIONADA
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1.2, alignItems: 'baseline', flexWrap: 'wrap', mt: 0.35 }}>
                    <Typography variant="figure" sx={{ fontSize: mobile ? 26 : 32, letterSpacing: '-0.02em', lineHeight: 1, color: tokens.content.foreground }}>
                      {formatFolio(seleccion)}
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: tokens.content.muted }}>{formatDate(seleccion.fecha_documento)}</Typography>
                  </Box>
                  <Typography component="p" variant="figure" sx={{ display: 'block', m: 0, mt: 0.7, fontSize: 15, lineHeight: 1.3, color: tokens.content.foreground }}>
                    {seleccion.nombre_cliente || 'Sin proveedor'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.7, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 26, px: 1.05, borderRadius: 99, bgcolor: tokens.metric.amount.background, color: tokens.content.foreground, fontSize: 12, fontWeight: 700 }}>
                      {estado}
                    </Box>
                    {folioOrigen ? (
                      <Typography sx={{ fontSize: 12, color: tokens.content.muted }}>
                        Origen: {folioOrigen}
                      </Typography>
                    ) : null}
                  </Box>
                </Box>
                <AccionesRecepcion actions={actions} tokens={tokens} />
              </Box>
            </Box>
            <Box sx={{ px: { xs: 1.5, md: 2.75 }, pb: 1.6, flexShrink: 0 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 0.8 }}>
                {metricas.map(([label, value, tone]) => (
                  <Box key={label} sx={{ px: 1.4, py: 1.1, borderRadius: 2, bgcolor: tone.background, color: tokens.content.foreground }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: tokens.metric.caption }}>{label}</Typography>
                    <Typography variant="figure" sx={{ fontSize: 22, lineHeight: 1.15, color: 'inherit' }}>{value}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            <DocumentoHojaViewport>
              <RecepcionDocumentoResumenView
                row={seleccion}
                documento={detalleActual?.documento ?? null}
                partidas={partidas}
                partidasLoading={!detalleActual || detail.loading}
                currency={currency}
                formatDate={formatDate}
                folio={formatFolio(seleccion)}
                proveedor={seleccion.nombre_cliente || 'Sin proveedor'}
                folioOrigen={folioOrigen}
                statusOption={statusOption ? { ...statusOption, label: estado } : { value: estatus, label: estado }}
                estadoTono={tonoEstatus(seleccion.estatus_documento)}
              />
            </DocumentoHojaViewport>
          </>
        ) : null}
      </Box>
    </Box>
  );
}
