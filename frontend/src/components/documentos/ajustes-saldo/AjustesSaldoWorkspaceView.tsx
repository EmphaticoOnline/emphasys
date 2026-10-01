import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import {
  Autocomplete,
  Box,
  Checkbox,
  CircularProgress,
  IconButton,
  InputAdornment,
  Popover,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import SearchIcon from '@mui/icons-material/Search';
import type { GridContextMenuAction, GridContextMenuActionItem } from '../../grids/GridContextMenu';
import { WorkspaceRowContextMenu, type WorkspaceContextItem } from '../WorkspaceRowContextMenu';
import { useDocumentoDetalleData } from '../DocumentoDetalleContent';
import { getStatusToneColor } from '../../status/status.semantics';
import type { StatusTone } from '../../status/status.types';
import { fetchAplicacionesDocumento } from '../../../services/finanzasService';
import { formatearFolioDocumento } from '../../../utils/documentos.utils';
import type { AplicacionOperacion } from '../../../types/finanzas';
import type { Contacto } from '../../../types/contactos.types';
import type { CotizacionDocumento, CotizacionListado } from '../../../types/cotizacion';
import type { TipoDocumento } from '../../../types/documentos.types';

type FiltroAjustes = {
  fechaDesde: string;
  fechaHasta: string;
  clienteId: number | null;
  agenteId: number | null;
  montoMin: string;
  montoMax: string;
};

const FILTRO_AJUSTES_VACIO: FiltroAjustes = {
  fechaDesde: '',
  fechaHasta: '',
  clienteId: null,
  agenteId: null,
  montoMin: '',
  montoMax: '',
};

type EstadoOpcion = { value: string; label: string };

type Props = {
  rows: CotizacionListado[];
  isLoading: boolean;
  selectedId: number | null;
  highlightedId: number | null;
  onSelect: (row: CotizacionListado) => void;
  search: string;
  onSearch: (value: string) => void;
  onCreate: () => void;
  onExport: () => void;
  exportLoading: boolean;
  actions: GridContextMenuAction[];
  onOpenEstatus: (event: MouseEvent<HTMLElement>, row: CotizacionListado) => void;
  tipoDocumento: TipoDocumento;
  formatFolio: (row: CotizacionListado) => string;
  formatDate: (value: string | null | undefined) => string;
  currency: Intl.NumberFormat;
  quickFilter: string;
  onQuickFilter: (value: string) => void;
  statusOptions: EstadoOpcion[];
  soloPendientes: boolean;
  onSoloPendientes: (value: boolean) => void;
  filtros: FiltroAjustes;
  onFiltrosChange: (filtro: FiltroAjustes) => void;
  contactos: Contacto[];
  etiquetaContacto: string;
  resumen: { general: number; porEstado: Record<string, number> } | null;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  selectedIds: number[];
  onSelectedIdsChange: (ids: number[]) => void;
  onDuplicateSelected: () => void;
  duplicating: boolean;
};

type DocumentoAjuste = CotizacionDocumento & {
  cliente_nombre?: string | null;
  estado_autorizacion?: string | null;
  descuento_global?: number | null;
};

const ORDEN_ACCIONES = ['ver-pdf', 'descargar-pdf', 'cancelar-documento', 'editar', 'eliminar'];

function esAccion(action: GridContextMenuAction): action is GridContextMenuActionItem {
  return action.type !== 'separator';
}

function estatusEtiqueta(estatus: string | null | undefined): string {
  const valor = String(estatus ?? '').trim().toLowerCase();
  if (valor === 'borrador') return 'Borrador';
  if (valor === 'emitido') return 'Emitido';
  if (valor === 'cancelado' || valor === 'cancelada') return 'Cancelado';
  return estatus || '—';
}

function esCancelado(estatus: string | null | undefined): boolean {
  const valor = String(estatus ?? '').trim().toLowerCase();
  return valor === 'cancelado' || valor === 'cancelada';
}

function tonoEstatus(estatus: string | null | undefined): StatusTone {
  const valor = String(estatus ?? '').trim().toLowerCase();
  if (valor === 'cancelado' || valor === 'cancelada') return 'error';
  if (valor === 'emitido') return 'success';
  return 'draft';
}

function autorizacionEtiqueta(estado: string | null | undefined): string | null {
  if (!estado || estado === 'no_requerida') return null;
  if (estado === 'pendiente') return 'Pendiente de autorización';
  if (estado === 'aprobada') return 'Autorizado';
  if (estado === 'rechazada') return 'Rechazado';
  return estado;
}

function filtrosAvanzadosActivos(filtro: FiltroAjustes): number {
  return [filtro.fechaDesde, filtro.fechaHasta, filtro.clienteId, filtro.montoMin, filtro.montoMax]
    .filter((value) => value !== '' && value !== null).length;
}

function mensajeVacio(search: string, criterios: number, soloPendientes: boolean): string {
  const hayBusqueda = Boolean(search.trim());
  if (hayBusqueda && (criterios > 0 || soloPendientes)) return 'Ningún ajuste coincide con la búsqueda y los filtros.';
  if (hayBusqueda) return 'Ningún ajuste coincide con la búsqueda.';
  if (criterios > 0 || soloPendientes) return 'Ningún ajuste coincide con estos filtros.';
  return 'No hay ajustes de saldo.';
}

export default function AjustesSaldoWorkspaceView(props: Props) {
  const {
    rows, isLoading, selectedId, highlightedId, onSelect, search, onSearch, onCreate, onExport, exportLoading,
    actions, onOpenEstatus, tipoDocumento, formatFolio, formatDate, currency, quickFilter, onQuickFilter,
    statusOptions, soloPendientes, onSoloPendientes, filtros, onFiltrosChange, contactos, etiquetaContacto,
    resumen, total, page, pageSize, onPageChange, selectedIds, onSelectedIdsChange, onDuplicateSelected, duplicating,
  } = props;
  const theme = useTheme();
  const tokens = theme.emphasys;
  const compacto = useMediaQuery(theme.breakpoints.down('md'));
  const [detalleMovil, setDetalleMovil] = useState(false);
  const [anclaFiltro, setAnclaFiltro] = useState<HTMLElement | null>(null);
  const [tab, setTab] = useState(0);
  const [menuFila, setMenuFila] = useState<{ top: number; left: number; rowId: number } | null>(null);
  const [aplicaciones, setAplicaciones] = useState<AplicacionOperacion[]>([]);
  const [cargandoAplicaciones, setCargandoAplicaciones] = useState(false);

  const criteriosActivos = filtrosAvanzadosActivos(filtros) + (soloPendientes ? 1 : 0) + (quickFilter !== 'todos' ? 1 : 0);
  const seleccion = rows.find((row) => row.id === selectedId) ?? null;
  const detalle = useDocumentoDetalleData(
    seleccion?.id ?? null,
    tipoDocumento,
    Boolean(seleccion),
    seleccion ? Math.abs(Number(seleccion.saldo ?? 0) * 100) : 0,
  );
  const documento = (detalle.data?.documento ?? null) as DocumentoAjuste | null;

  useEffect(() => { setTab(0); }, [seleccion?.id]);

  useEffect(() => {
    if (rows.length === 0) {
      setDetalleMovil(false);
      return;
    }
    if (selectedId && rows.some((row) => row.id === selectedId)) return;
    const primera = rows[0];
    if (primera) onSelect(primera);
  }, [rows, selectedId, onSelect]);

  useEffect(() => {
    if (!seleccion) {
      setAplicaciones([]);
      return;
    }
    let cancelado = false;
    setCargandoAplicaciones(true);
    fetchAplicacionesDocumento(seleccion.id)
      .then((rowsAplicadas) => {
        if (cancelado) return;
        setAplicaciones((rowsAplicadas ?? []).filter((aplicacion) => Number(aplicacion.documento_origen_id) === seleccion.id));
      })
      .catch(() => { if (!cancelado) setAplicaciones([]); })
      .finally(() => { if (!cancelado) setCargandoAplicaciones(false); });
    return () => { cancelado = true; };
  }, [seleccion]);

  const acciones = useMemo(
    () => actions.filter(esAccion).filter((action) => !action.hidden && action.id !== 'ver-detalle'),
    [actions],
  );
  const porId = (id: string) => acciones.find((action) => action.id === id);
  const accionesOrdenadas = useMemo(() => {
    const conocidas = ORDEN_ACCIONES.map((id) => porId(id)).filter((action): action is GridContextMenuActionItem => Boolean(action));
    const resto = acciones.filter((action) => !ORDEN_ACCIONES.includes(action.id));
    return [...conocidas, ...resto];
  }, [acciones]);

  const iconoSx = (disabled: boolean) => ({
    width: 34,
    height: 34,
    borderRadius: '10px',
    bgcolor: disabled ? tokens.action.disabled : tokens.action.primary,
    color: tokens.action.primaryForeground,
    '&:hover': { bgcolor: disabled ? tokens.action.disabled : tokens.action.primaryHover },
    '&.Mui-disabled': {
      bgcolor: tokens.action.disabled,
      color: tokens.action.primaryForeground,
    },
  });

  const botonAccion = (accion: GridContextMenuActionItem) => {
    const disabled = Boolean(accion.disabled);
    return (
      <Tooltip key={accion.id} title={accion.label} arrow>
        <span>
          <IconButton size="small" disabled={disabled} aria-label={accion.label} onClick={(event) => accion.onClick?.(event)} sx={iconoSx(disabled)}>
            {accion.icon ?? <EditOutlinedIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
    );
  };

  const verLista = !compacto || !detalleMovil;
  const aplicadoSeleccion = seleccion ? Math.max(0, Number(seleccion.total ?? 0) - Number(seleccion.saldo ?? 0)) : 0;
  const pctSeleccion = seleccion && Number(seleccion.total) > 0 ? Math.min(100, (aplicadoSeleccion / Number(seleccion.total)) * 100) : 0;
  const agotadaSeleccion = Boolean(seleccion) && Number(seleccion?.saldo ?? 0) <= 0 && !esCancelado(seleccion?.estatus_documento);
  const tonoDisponible = esCancelado(seleccion?.estatus_documento) ? tokens.metric.blocked : agotadaSeleccion ? tokens.metric.exhausted : tokens.metric.available;
  const autorizacion = autorizacionEtiqueta(documento?.estado_autorizacion ?? seleccion?.estado_autorizacion);
  const observaciones = String(documento?.observaciones ?? '').trim();
  const moneda = String(documento?.moneda || seleccion?.moneda || 'MXN');
  const tipoCambio = Number(documento?.tipo_cambio ?? 1);
  const descuento = Number(documento?.descuento_global ?? seleccion?.descuento_global ?? 0);
  const vacio = mensajeVacio(search, filtrosAvanzadosActivos(filtros) + (quickFilter !== 'todos' ? 1 : 0), soloPendientes);
  const editar = porId('editar');
  const eliminar = porId('eliminar');

  const alternarSeleccion = (id: number) => {
    onSelectedIdsChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  };

  const panelLista = (
    <Box sx={{
      width: compacto ? '100%' : 372,
      flexShrink: 0,
      display: verLista ? 'flex' : 'none',
      flexDirection: 'column',
      minHeight: 0,
      flex: compacto ? 1 : undefined,
      bgcolor: tokens.navigation.background,
      color: tokens.navigation.foreground,
      borderRight: compacto ? 'none' : `1px solid ${tokens.navigation.border}`,
    }}>
      <Box sx={{ px: 1.75, pt: 1.7, pb: 1.1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: tokens.navigation.muted }}>AJUSTES DE SALDO</Typography>
            <Typography sx={{ mt: 0.35, fontSize: 13, color: tokens.navigation.subtle }}>
              {total > rows.length ? `${rows.length} de ${total}` : `${rows.length} en vista`}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.6 }}>
            <Tooltip title="Exportar" arrow>
              <span>
                <IconButton aria-label="Exportar ajustes" onClick={onExport} disabled={exportLoading} sx={{ width: 34, height: 34, color: tokens.navigation.foreground, border: `1px solid ${tokens.navigation.border}`, '&:hover': { bgcolor: tokens.navigation.hover } }}>
                  {exportLoading ? <CircularProgress size={16} sx={{ color: tokens.navigation.foreground }} /> : <DownloadOutlinedIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Nuevo ajuste" arrow>
              <IconButton aria-label="Nuevo ajuste" onClick={onCreate} sx={{ width: 34, height: 34, bgcolor: tokens.navigation.control, color: tokens.navigation.controlForeground, boxShadow: '0 1px 2px rgba(0,0,0,0.35)', '&:hover': { bgcolor: tokens.content.elevated } }}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.7, mt: 1.35, alignItems: 'stretch' }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Buscar folio, cliente…"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: tokens.navigation.muted }} /></InputAdornment> }}
            sx={{
              '& .MuiOutlinedInput-root': { color: tokens.navigation.foreground, bgcolor: tokens.navigation.summary, borderRadius: 2, '& fieldset': { borderColor: 'transparent' } },
              '& .MuiOutlinedInput-input': { fontSize: 13, py: 0.9 },
              '& .MuiOutlinedInput-input::placeholder': { color: tokens.navigation.muted, opacity: 1 },
            }}
          />
          <Tooltip title={criteriosActivos > 0 ? `${criteriosActivos} ${criteriosActivos === 1 ? 'filtro activo' : 'filtros activos'}` : 'Filtrar'} arrow>
            <Box sx={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
              <IconButton aria-label="Filtrar ajustes" aria-pressed={criteriosActivos > 0} onClick={(event) => setAnclaFiltro(event.currentTarget)} sx={{ alignSelf: 'stretch', width: 40, borderRadius: 2, bgcolor: tokens.navigation.summary, color: tokens.navigation.foreground, border: '1px solid', borderColor: criteriosActivos > 0 ? tokens.navigation.accent : 'transparent', '&:hover': { bgcolor: tokens.navigation.hover } }}>
                <FilterAltOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
              {criteriosActivos > 0 && (
                <Box sx={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, px: 0.4, borderRadius: 99, bgcolor: tokens.navigation.accent, color: tokens.frame.background, fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{criteriosActivos}</Box>
              )}
            </Box>
          </Tooltip>
        </Box>
        <PopoverFiltroAjustes
          ancla={anclaFiltro}
          filtro={filtros}
          contactos={contactos}
          etiquetaContacto={etiquetaContacto}
          onClose={() => setAnclaFiltro(null)}
          onChange={onFiltrosChange}
          statusOptions={statusOptions}
          quickFilter={quickFilter}
          onQuickFilter={onQuickFilter}
          soloPendientes={soloPendientes}
          onSoloPendientes={onSoloPendientes}
          resumen={resumen}
          currency={currency}
        />
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', px: 1, pb: 1.2, scrollbarWidth: 'thin', scrollbarColor: `${tokens.navigation.progress} ${tokens.navigation.background}`, '&::-webkit-scrollbar': { width: 10, background: tokens.navigation.background }, '&::-webkit-scrollbar-thumb': { background: tokens.navigation.progress, borderRadius: 99, border: `2px solid ${tokens.navigation.background}` } }}>
        {isLoading && rows.length === 0 ? (
          <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}><CircularProgress size={22} sx={{ color: tokens.navigation.foreground }} /></Box>
        ) : rows.length === 0 ? (
          <Typography sx={{ px: 1.5, py: 3, fontSize: 13, color: tokens.navigation.muted }}>{vacio}</Typography>
        ) : rows.map((row) => {
          const activa = row.id === seleccion?.id;
          const saldo = Number(row.saldo ?? 0);
          const totalAjuste = Number(row.total ?? 0);
          const aplicado = Math.max(0, totalAjuste - saldo);
          const pct = totalAjuste > 0 ? Math.min(100, Math.round((aplicado / totalAjuste) * 100)) : 0;
          const agotada = saldo <= 0 && !esCancelado(row.estatus_documento);
          const tono = tonoEstatus(row.estatus_documento);
          return (
            <Box key={row.id} onClick={() => { onSelect(row); setDetalleMovil(true); }} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onSelect(row); setMenuFila({ top: event.clientY, left: event.clientX, rowId: row.id }); }} sx={{ px: 1, py: 1.05, mb: 0.45, borderRadius: 2, cursor: 'pointer', display: 'flex', gap: 0.4, bgcolor: activa ? tokens.navigation.selection : 'transparent', color: activa ? tokens.navigation.selectionForeground : tokens.navigation.foreground, boxShadow: row.id === highlightedId ? `inset 0 0 0 1px ${tokens.navigation.accent}` : activa ? '0 1px 2px rgba(0,0,0,0.18)' : 'none', '&:hover': { bgcolor: activa ? tokens.navigation.selection : tokens.navigation.hover } }}>
              <Checkbox size="small" checked={selectedIds.includes(row.id)} onClick={(event) => event.stopPropagation()} onChange={() => alternarSeleccion(row.id)} inputProps={{ 'aria-label': `Seleccionar ${formatFolio(row)}` }} sx={{ p: 0.3, mt: -0.2, color: tokens.navigation.muted, '&.Mui-checked': { color: activa ? tokens.navigation.selectionForeground : tokens.navigation.foreground } }} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline' }}>
                  <Typography variant="figure" sx={{ fontSize: 16, color: 'inherit', lineHeight: 1.1 }}>{formatFolio(row)}</Typography>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 750, fontVariantNumeric: 'tabular-nums', color: 'inherit' }}>{currency.format(totalAjuste)}</Typography>
                </Box>
                <Typography variant="figure" sx={{ fontSize: 14, mt: 0.25, color: tokens.navigation.foreground, lineHeight: 1.2 }} noWrap>{row.nombre_cliente || 'Sin contacto'}</Typography>
                <Box sx={{ display: 'flex', gap: 0.7, alignItems: 'center', mt: 0.3 }}>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: tokens.navigation.foreground }}>{estatusEtiqueta(row.estatus_documento)}</Typography>
                  <Box component="span" aria-label={estatusEtiqueta(row.estatus_documento)} sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getStatusToneColor(theme, tono) }} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 0.55 }}>
                  <Typography sx={{ fontSize: 12, color: tokens.navigation.subtle }}>Saldo: {currency.format(saldo)}</Typography>
                  <Typography sx={{ fontSize: 11, color: tokens.navigation.muted }}>{formatDate(row.fecha_documento)}</Typography>
                </Box>
                <Box sx={{ mt: 0.55, height: 3, borderRadius: 99, bgcolor: tokens.navigation.track, overflow: 'hidden' }}>
                  <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: agotada ? tokens.metric.progressDone : tokens.navigation.progress }} />
                </Box>
              </Box>
            </Box>
          );
        })}
        {total > pageSize && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.6, pt: 0.4 }}>
            <Typography sx={{ fontSize: 12, color: tokens.navigation.muted }}>{page * pageSize + 1}–{Math.min(total, (page + 1) * pageSize)} de {total}</Typography>
            <Box>
              <IconButton aria-label="Página anterior" disabled={page <= 0} onClick={() => onPageChange(page - 1)} sx={{ color: tokens.navigation.foreground, p: 0.4 }}><ChevronLeftIcon fontSize="small" /></IconButton>
              <IconButton aria-label="Página siguiente" disabled={(page + 1) * pageSize >= total} onClick={() => onPageChange(page + 1)} sx={{ color: tokens.navigation.foreground, p: 0.4 }}><ChevronRightIcon fontSize="small" /></IconButton>
            </Box>
          </Box>
        )}
      </Box>
      {selectedIds.length > 0 && (
        <Box sx={{ px: 1.4, py: 1, borderTop: `1px solid ${tokens.navigation.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography sx={{ fontSize: 12, color: tokens.navigation.foreground }}>{selectedIds.length} seleccionado{selectedIds.length === 1 ? '' : 's'}</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box component="button" type="button" onClick={() => onSelectedIdsChange([])} disabled={duplicating} sx={{ border: 0, bgcolor: 'transparent', color: tokens.navigation.subtle, font: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Limpiar</Box>
            <Box component="button" type="button" onClick={onDuplicateSelected} disabled={duplicating} sx={{ border: 0, bgcolor: 'transparent', color: tokens.navigation.accent, font: 'inherit', fontSize: 12, fontWeight: 750, cursor: 'pointer' }}>{duplicating ? 'Duplicando…' : 'Duplicar'}</Box>
          </Box>
        </Box>
      )}
    </Box>
  );

  const contenido = !seleccion ? (
    <Box sx={{ flex: 1, display: compacto && verLista ? 'none' : 'grid', placeItems: 'center', px: 3, textAlign: 'center' }}>
      <Box>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: tokens.content.foreground }}>{rows.length > 0 ? 'Selecciona un ajuste' : vacio}</Typography>
        <Typography sx={{ mt: 0.6, fontSize: 13, color: tokens.content.muted, maxWidth: 360 }}>
          {rows.length > 0 ? 'El documento y sus aplicaciones aparecen aquí.' : 'Ajusta la búsqueda o crea un ajuste nuevo.'}
        </Typography>
      </Box>
    </Box>
  ) : (
    <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: compacto && verLista ? 'none' : 'flex', flexDirection: 'column', bgcolor: tokens.content.background }}>
      <Box sx={{ px: { xs: 1.5, md: 2.75 }, pt: compacto ? 1 : 1.6, pb: 2.2 }}>
        {compacto && (
          <Box component="button" type="button" onClick={() => setDetalleMovil(false)} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, border: 0, bgcolor: 'transparent', color: tokens.content.foreground, font: 'inherit', cursor: 'pointer', mb: 0.5, p: 0 }}>
            <ArrowBackIcon fontSize="small" /> Ajustes
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: compacto ? 'column' : 'row' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: tokens.content.muted }}>AJUSTE SELECCIONADO</Typography>
            <Box sx={{ display: 'flex', gap: 1.2, alignItems: 'baseline', flexWrap: 'wrap', mt: 0.35 }}>
              <Typography variant="figure" sx={{ fontSize: 32, letterSpacing: '-0.02em', lineHeight: 1, color: tokens.content.foreground }}>{formatFolio(seleccion)}</Typography>
              <Typography sx={{ fontSize: 13, color: tokens.content.muted }}>{formatDate(seleccion.fecha_documento)}</Typography>
            </Box>
            <Typography component="p" variant="figure" sx={{ display: 'block', m: 0, mt: 0.7, fontSize: 15, lineHeight: 1.3, color: tokens.content.foreground }}>
              {seleccion.nombre_cliente || documento?.cliente_nombre || 'Sin contacto'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.7, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Pastilla fondo={tokens.metric.amount.background} tinta={tokens.content.foreground}>{moneda}</Pastilla>
              <Pastilla fondo={tokens.content.elevated} tinta={tokens.content.foreground} onClick={(event) => onOpenEstatus(event, seleccion)}>
                {estatusEtiqueta(seleccion.estatus_documento)}
                <ExpandMoreIcon sx={{ fontSize: 16, ml: 0.2 }} />
              </Pastilla>
              {autorizacion && <Pastilla fondo={tokens.metric.applied.background} tinta={tokens.metric.applied.foreground}>{autorizacion}</Pastilla>}
            </Box>
            {observaciones && <Typography sx={{ mt: 1, fontSize: 13, color: tokens.content.secondary, maxWidth: 640 }}>{observaciones}</Typography>}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {accionesOrdenadas.filter((accion) => accion.id !== 'editar' && accion.id !== 'eliminar').map((accion) => botonAccion(accion))}
            {editar && botonAccion(editar)}
            {eliminar && botonAccion(eliminar)}
          </Box>
        </Box>
        <Box sx={{ mt: 1.7, display: 'grid', gridTemplateColumns: compacto ? '1fr' : '1fr 1fr 1.15fr', gap: 0.8 }}>
          <Cifra etiqueta="Importe" valor={currency.format(Number(seleccion.total ?? 0))} detalle={Number(seleccion.iva) > 0 ? `IVA ${currency.format(Number(seleccion.iva))}` : 'Sin IVA'} fondo={tokens.metric.amount.background} tinta={tokens.content.foreground} caption={tokens.metric.caption} />
          <Cifra etiqueta="Aplicado" valor={currency.format(aplicadoSeleccion)} detalle={cargandoAplicaciones ? '' : aplicaciones.length === 0 ? 'Sin aplicaciones' : `${aplicaciones.length} ${aplicaciones.length === 1 ? 'aplicación' : 'aplicaciones'}`} fondo={tokens.metric.applied.background} tinta={tokens.content.foreground} caption={tokens.metric.caption} />
          <Cifra etiqueta="Disponible" valor={currency.format(Number(seleccion.saldo ?? 0))} detalle={esCancelado(seleccion.estatus_documento) ? 'Ajuste cancelado' : agotadaSeleccion ? 'Saldo aplicado por completo' : 'Puede aplicarse'} fondo={tonoDisponible.background} tinta={tokens.content.foreground} caption={tokens.metric.caption} destacado />
        </Box>
        <Box sx={{ mt: 1.1, height: 4, borderRadius: 99, bgcolor: tokens.metric.track, overflow: 'hidden' }}>
          <Box sx={{ width: `${pctSeleccion}%`, height: '100%', bgcolor: agotadaSeleccion ? tokens.metric.progressDone : tokens.metric.progress }} />
        </Box>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', mx: { xs: 1, md: 1.75 }, mb: { xs: 1, md: 1.75 }, bgcolor: tokens.content.well, borderRadius: 3, border: `1px solid ${tokens.content.border}`, overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ px: 1.5, minHeight: 46, borderBottom: `1px solid ${tokens.content.border}`, '& .MuiTab-root': { minHeight: 46, textTransform: 'none', fontWeight: 650, fontSize: 14, color: tokens.content.muted }, '& .Mui-selected': { color: tokens.content.foreground }, '& .MuiTabs-indicator': { height: 2, backgroundColor: tokens.content.foreground } }}>
          <Tab label="Documento" />
          <Tab label="Aplicaciones" />
        </Tabs>
        <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1.5, md: 2.25 } }}>
          {tab === 0 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: compacto ? '1fr' : '1fr 1fr', gap: 0.8, maxWidth: 760 }}>
              {detalle.loading && !documento ? <CircularProgress size={18} /> : (
                <>
                  <Dato etiqueta={etiquetaContacto} valor={seleccion.nombre_cliente || documento?.cliente_nombre || 'Sin contacto'} />
                  <Dato etiqueta="Fecha" valor={formatDate(documento?.fecha_documento || seleccion.fecha_documento)} />
                  <Dato etiqueta="Moneda" valor={moneda === 'MXN' ? 'MXN' : `${moneda} · TC ${tipoCambio}`} />
                  <Dato etiqueta="Subtotal" valor={currency.format(Number(documento?.subtotal ?? seleccion.subtotal ?? 0))} />
                  <Dato etiqueta="Descuento global" valor={`${descuento}%`} />
                  <Dato etiqueta="IVA" valor={currency.format(Number(documento?.iva ?? seleccion.iva ?? 0))} />
                  <Dato etiqueta="Total" valor={currency.format(Number(documento?.total ?? seleccion.total ?? 0))} />
                  <Dato etiqueta="Saldo" valor={currency.format(Number(documento?.saldo ?? seleccion.saldo ?? 0))} />
                  <Dato etiqueta="Autorización" valor={autorizacion || 'No requerida'} />
                  <Dato etiqueta="Observaciones" valor={observaciones || 'Sin observaciones'} />
                </>
              )}
              {detalle.error && <Typography sx={{ fontSize: 13, color: tokens.action.destructive }}>{detalle.error}</Typography>}
            </Box>
          )}
          {tab === 1 && (
            <Box sx={{ display: 'grid', gap: 1, maxWidth: 720 }}>
              {cargandoAplicaciones ? <CircularProgress size={18} /> : aplicaciones.length === 0 ? (
                <TarjetaQuieta titulo="Sin aplicaciones" texto="Los documentos compensados con este ajuste aparecen aquí." />
              ) : aplicaciones.map((aplicacion) => (
                <TarjetaDocumento
                  key={aplicacion.id}
                  folio={formatearFolioDocumento(aplicacion.serie ?? '', aplicacion.numero ?? 0) || 'Documento'}
                  meta={[formatDate(aplicacion.fecha_aplicacion || aplicacion.fecha_documento), aplicacion.tipo_documento_destino || aplicacion.tipo_documento].filter(Boolean).join(' · ')}
                  monto={currency.format(Number(aplicacion.monto_moneda_documento ?? aplicacion.monto ?? 0))}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );

  const itemsMenuAjuste: WorkspaceContextItem[] = !menuFila || !seleccion || menuFila.rowId !== seleccion.id ? [] : (() => {
    const aItem = (accion: GridContextMenuActionItem): WorkspaceContextItem => ({
      id: accion.id,
      label: accion.label,
      icon: accion.icon ?? <EditOutlinedIcon fontSize="small" />,
      disabled: Boolean(accion.disabled),
      onClick: accion.disabled ? undefined : (event) => { void accion.onClick?.(event); },
    });
    return [
      ...accionesOrdenadas.filter((accion) => accion.id !== 'editar' && accion.id !== 'eliminar').map(aItem),
      ...(editar ? [aItem(editar)] : []),
      ...(eliminar ? [aItem(eliminar)] : []),
    ];
  })();

  return (
    <Box sx={{ flex: 1, minHeight: compacto ? 'calc(100dvh - 112px)' : 0, display: 'flex', flexDirection: compacto ? 'column' : 'row', overflow: 'hidden' }}>
      {panelLista}
      {contenido}
      <WorkspaceRowContextMenu
        anchorPosition={menuFila && seleccion && menuFila.rowId === seleccion.id ? { top: menuFila.top, left: menuFila.left } : null}
        items={itemsMenuAjuste}
        onClose={() => setMenuFila(null)}
      />
    </Box>
  );
}

function Pastilla({ children, fondo, tinta, onClick }: { children: ReactNode; fondo: string; tinta: string; onClick?: (event: MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <Box component={onClick ? 'button' : 'span'} type={onClick ? 'button' : undefined} onClick={onClick} sx={{ display: 'inline-flex', alignItems: 'center', height: 26, px: 1.05, borderRadius: 99, border: '1px solid transparent', bgcolor: fondo, color: tinta, font: 'inherit', fontSize: 12, fontWeight: 700, cursor: onClick ? 'pointer' : 'default' }}>
      {children}
    </Box>
  );
}

function Cifra({ etiqueta, valor, detalle, fondo, tinta, caption, destacado }: { etiqueta: string; valor: string; detalle: string; fondo: string; tinta: string; caption: string; destacado?: boolean }) {
  return (
    <Box sx={{ bgcolor: fondo, borderRadius: 2, px: 1.4, py: 1.05 }}>
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: caption }}>{etiqueta}</Typography>
      <Typography variant="figure" sx={{ mt: 0.25, fontSize: destacado ? 26 : 20, letterSpacing: '-0.02em', lineHeight: 1.05, color: tinta }}>{valor}</Typography>
      {detalle ? <Typography sx={{ mt: 0.3, fontSize: 12, color: caption }}>{detalle}</Typography> : <Box sx={{ mt: 0.3, height: 18 }} />}
    </Box>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const tokens = useTheme().emphasys;
  return (
    <Box sx={{ bgcolor: tokens.content.card, border: `1px solid ${tokens.content.border}`, borderRadius: 1.5, px: 1.3, py: 1 }}>
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.metric.caption }}>{etiqueta}</Typography>
      <Typography sx={{ mt: 0.3, fontSize: 14, fontWeight: 650, color: tokens.content.foreground, overflowWrap: 'anywhere' }}>{valor}</Typography>
    </Box>
  );
}

function TarjetaDocumento({ folio, meta, monto }: { folio: string; meta: string; monto: string }) {
  const tokens = useTheme().emphasys;
  return (
    <Box sx={{ border: `1px solid ${tokens.content.border}`, borderRadius: 1.5, bgcolor: tokens.content.card, px: 1.4, py: 1.1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
        <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: tokens.content.foreground }}>{folio}</Typography>
        <Typography variant="figure" sx={{ fontSize: 18, color: tokens.content.foreground }}>{monto}</Typography>
      </Box>
      {meta ? <Typography sx={{ fontSize: 12, color: tokens.content.muted, mt: 0.25 }}>{meta}</Typography> : null}
    </Box>
  );
}

function TarjetaQuieta({ titulo, texto }: { titulo: string; texto: string }) {
  const tokens = useTheme().emphasys;
  return (
    <Box sx={{ border: `1px solid ${tokens.content.border}`, borderRadius: 1.5, bgcolor: tokens.content.card, px: 1.4, py: 1.15 }}>
      <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: tokens.content.foreground }}>{titulo}</Typography>
      <Typography sx={{ mt: 0.35, fontSize: 13, color: tokens.content.secondary }}>{texto}</Typography>
    </Box>
  );
}

function PopoverFiltroAjustes({
  ancla, filtro, contactos, etiquetaContacto, onClose, onChange, statusOptions, quickFilter, onQuickFilter, soloPendientes, onSoloPendientes, resumen, currency,
}: {
  ancla: HTMLElement | null;
  filtro: FiltroAjustes;
  contactos: Contacto[];
  etiquetaContacto: string;
  onClose: () => void;
  onChange: (filtro: FiltroAjustes) => void;
  statusOptions: EstadoOpcion[];
  quickFilter: string;
  onQuickFilter: (value: string) => void;
  soloPendientes: boolean;
  onSoloPendientes: (value: boolean) => void;
  resumen: { general: number; porEstado: Record<string, number> } | null;
  currency: Intl.NumberFormat;
}) {
  const tokens = useTheme().emphasys;
  const contacto = contactos.find((item) => item.id === filtro.clienteId) ?? null;
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
  };
  return (
    <Popover open={Boolean(ancla)} anchorEl={ancla} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} slotProps={{ paper: { sx: { mt: 0.75, p: 1.5, width: 320, borderRadius: 2, bgcolor: tokens.content.card, color: tokens.content.foreground, border: `1px solid ${tokens.content.border}`, boxShadow: '0 16px 40px rgba(44, 49, 56, 0.18)', maxHeight: 'min(70vh, 560px)', overflow: 'auto' } } }}>
      <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: tokens.content.muted }}>FILTROS</Typography>
      <Box sx={{ display: 'grid', gap: 1.1, mt: 1.2 }}>
        <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 0.4, cursor: 'pointer', color: tokens.content.foreground }}>
          <Checkbox size="small" checked={soloPendientes} onChange={(event) => onSoloPendientes(event.target.checked)} sx={{ p: 0.4, color: tokens.content.muted, '&.Mui-checked': { color: tokens.content.foreground } }} />
          <Typography sx={{ fontSize: 13, fontWeight: 650 }}>Solo pendientes</Typography>
        </Box>
        <Box sx={{ display: 'grid', gap: 0.35 }}>
          {[{ value: 'todos', label: 'Todos' }, ...statusOptions].map((estado) => {
            const activo = quickFilter === estado.value;
            const monto = estado.value === 'todos' ? resumen?.general : resumen?.porEstado[estado.value];
            return (
              <Box key={estado.value} component="button" type="button" onClick={() => onQuickFilter(estado.value)} sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, border: 0, textAlign: 'left', cursor: 'pointer', borderRadius: 1.5, px: 1, py: 0.55, font: 'inherit', color: tokens.content.foreground, bgcolor: activo ? tokens.action.wash : 'transparent', '&:hover': { bgcolor: activo ? tokens.action.wash : tokens.content.hover } }}>
                <Typography sx={{ fontSize: 13, fontWeight: activo ? 750 : 600 }}>{estado.label}</Typography>
                <Typography sx={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: tokens.content.secondary }}>{monto == null ? '—' : currency.format(monto)}</Typography>
              </Box>
            );
          })}
        </Box>
        <TextField size="small" type="date" label="Fecha desde" value={filtro.fechaDesde} onChange={(event) => onChange({ ...filtro, fechaDesde: event.target.value })} InputLabelProps={{ shrink: true }} sx={campoSx} />
        <TextField size="small" type="date" label="Fecha hasta" value={filtro.fechaHasta} onChange={(event) => onChange({ ...filtro, fechaHasta: event.target.value })} InputLabelProps={{ shrink: true }} sx={campoSx} />
        <Autocomplete size="small" options={contactos} value={contacto} onChange={(_, value) => onChange({ ...filtro, clienteId: value?.id ?? null })} getOptionLabel={(option) => option.nombre || ''} isOptionEqualToValue={(option, value) => option.id === value.id} renderInput={(params) => <TextField {...(params as object)} label={etiquetaContacto} placeholder="Todos" sx={campoSx} />} />
        <TextField size="small" type="number" label="Monto mínimo" value={filtro.montoMin} onChange={(event) => onChange({ ...filtro, montoMin: event.target.value })} inputProps={{ min: 0, step: 0.01 }} sx={campoSx} />
        <TextField size="small" type="number" label="Monto máximo" value={filtro.montoMax} onChange={(event) => onChange({ ...filtro, montoMax: event.target.value })} inputProps={{ min: 0, step: 0.01 }} sx={campoSx} />
        <Box component="button" type="button" onClick={() => { onChange({ ...FILTRO_AJUSTES_VACIO, agenteId: filtro.agenteId }); onSoloPendientes(false); onQuickFilter('todos'); }} sx={{ justifySelf: 'start', border: 0, bgcolor: 'transparent', color: tokens.content.foreground, font: 'inherit', fontSize: 13, fontWeight: 750, cursor: 'pointer', p: 0 }}>
          Limpiar filtros
        </Box>
      </Box>
    </Popover>
  );
}
