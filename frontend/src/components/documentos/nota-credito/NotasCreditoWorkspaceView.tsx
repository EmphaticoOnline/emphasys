import { Fragment, useEffect, useMemo, useState, type ComponentProps, type MouseEvent, type ReactNode } from 'react';
import type { DocumentoRelacionado } from '../../../types/documentoDetalle';
import type { CotizacionPartida } from '../../../types/cotizacion';
import {
  Autocomplete,
  Box,
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LinkIcon from '@mui/icons-material/Link';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CancelIcon from '@mui/icons-material/Cancel';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { GridContextMenuAction, GridContextMenuActionItem } from '../../grids/GridContextMenu';
import { WorkspaceRowContextMenu, type WorkspaceContextItem } from '../WorkspaceRowContextMenu';
import { useDocumentoDetalleData } from '../DocumentoDetalleContent';
import { fetchAplicacionesDocumento } from '../../../services/finanzasService';
import { fetchConceptos } from '../../../services/conceptosService';
import { fetchContactosPaginados } from '../../../services/contactosService';
import type { AplicacionOperacion, Concepto } from '../../../types/finanzas';
import type { CotizacionListado, TratamientoImpuestos } from '../../../types/cotizacion';
import type { TipoDocumento } from '../../../types/documentos.types';
import { formatearFolioDocumento } from '../../../utils/documentos.utils';
import { estadoVisualDocumento } from '../estadoVisualDocumento';
import { getStatusToneColor } from '../../status/status.semantics';

type Props = {
  rows: CotizacionListado[];
  isLoading: boolean;
  selectedId: number | null;
  onSelect: (row: CotizacionListado) => void;
  search: string;
  onSearch: (value: string) => void;
  onCreate: () => void;
  actions: GridContextMenuAction[];
  onOpenEstatus: (event: MouseEvent<HTMLElement>, row: CotizacionListado) => void;
  tipoDocumento: TipoDocumento;
  formatFolio: (row: CotizacionListado) => string;
  formatDate: (value: string | null | undefined) => string;
  currency: Intl.NumberFormat;
  filtros: FiltroNotas;
  onFiltrosChange: (filtro: FiltroNotas) => void;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  tiposContacto: string[];
  etiquetaContacto: string;
  estatusOpciones: string[];
};

const cantidadVisible = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function tituloOrigenes(origenes: DocumentoRelacionado[]): string {
  if (origenes.length <= 1) return 'Proviene de';
  const facturas = origenes.every((doc) => String(doc.tipo_documento).includes('factura'));
  return facturas ? `Proviene de · ${origenes.length} facturas` : `Proviene de · ${origenes.length} documentos`;
}

function detalleLineas(partidas: CotizacionPartida[], origenId: number): string | undefined {
  const n = partidas.filter((partida) => Number(partida.documento_origen_id) === origenId).length;
  if (n === 0) return undefined;
  return n === 1 ? '1 línea de esta factura' : `${n} líneas de esta factura`;
}

function esAccion(action: GridContextMenuAction): action is GridContextMenuActionItem {
  return action.type !== 'separator';
}

function motivoEtiqueta(motivo: CotizacionListado['motivo_nc']): string {
  if (motivo === 'devolucion') return 'Devolución';
  if (motivo === 'bonificacion') return 'Bonificación';
  if (motivo === 'otro') return 'Otro';
  return 'Sin motivo';
}

function esCancelada(estatus: string | null | undefined): boolean {
  const valor = String(estatus ?? '').trim().toLowerCase();
  return valor === 'cancelado' || valor === 'cancelada';
}

function estatusEtiqueta(estatus: string | null | undefined): string {
  const valor = String(estatus ?? '').trim().toLowerCase();
  if (valor === 'borrador') return 'Borrador';
  if (valor === 'emitido') return 'Emitida';
  if (valor === 'timbrado') return 'Timbrada';
  if (valor === 'cancelado' || valor === 'cancelada') return 'Cancelada';
  return estatus || '—';
}

function esFiscal(tratamiento: TratamientoImpuestos | null | undefined): boolean {
  return tratamiento !== 'sin_iva';
}

type MotivoNota = 'devolucion' | 'bonificacion' | 'otro';
type FiltroAplicacionNota = '' | 'pendiente' | 'aplicada';

export type FiltroNotas = {
  estatus: string[];
  motivos: MotivoNota[];
  aplicacion: FiltroAplicacionNota;
  clienteId: number | null;
  clienteNombre: string;
  desde: string;
  hasta: string;
};

export const FILTRO_NOTAS_VACIO: FiltroNotas = {
  estatus: [],
  motivos: [],
  aplicacion: '',
  clienteId: null,
  clienteNombre: '',
  desde: '',
  hasta: '',
};

const MOTIVOS: MotivoNota[] = ['devolucion', 'bonificacion', 'otro'];

function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor];
}

function filtrosEncendidos(filtro: FiltroNotas): number {
  return [
    filtro.estatus.length > 0,
    filtro.motivos.length > 0,
    filtro.aplicacion !== '',
    filtro.clienteId != null,
    Boolean(filtro.desde || filtro.hasta),
  ].filter(Boolean).length;
}

function mensajeVacio(search: string, criterios: number): string {
  const hayBusqueda = Boolean(search.trim());
  if (hayBusqueda && criterios > 0) return 'Ninguna nota coincide con la búsqueda y los filtros.';
  if (hayBusqueda) return 'Ninguna nota coincide con la búsqueda.';
  if (criterios > 0) return 'Ninguna nota coincide con estos filtros.';
  return 'No hay notas de crédito.';
}

function esNotaCreditoCompra(tipoDocumento: TipoDocumento): boolean {
  return tipoDocumento === 'nota_credito_compra';
}

function razonEditar(row: CotizacionListado): string | null {
  const estatus = String(row.estatus_documento ?? '').trim().toLowerCase();
  if (estatus !== 'borrador') return 'Solo se puede editar una nota de crédito en borrador.';
  return null;
}

function razonEliminar(row: CotizacionListado): string | null {
  const estatus = String(row.estatus_documento ?? '').trim().toLowerCase();
  if (estatus === 'timbrado' || row.cfdi_uuid) {
    return 'No se puede eliminar una nota de crédito timbrada. Utilice la cancelación fiscal (CFDI) en su lugar.';
  }
  if (estatus !== 'borrador') {
    return 'Solo se puede eliminar una nota de crédito en borrador. Para conservar la trazabilidad, utilice la cancelación.';
  }
  return null;
}

function razonTimbrar(row: CotizacionListado): string | null {
  const estatus = String(row.estatus_documento ?? '').trim().toLowerCase();
  if (estatus === 'cancelado' || estatus === 'cancelada') return 'La nota está cancelada.';
  if (estatus === 'timbrado' || row.cfdi_uuid) return 'CFDI ya timbrado';
  return null;
}

export default function NotasCreditoWorkspaceView({
  rows,
  isLoading,
  selectedId,
  onSelect,
  search,
  onSearch,
  onCreate,
  actions,
  onOpenEstatus,
  tipoDocumento,
  formatFolio,
  formatDate,
  currency,
  filtros,
  onFiltrosChange,
  total,
  page,
  pageSize,
  onPageChange,
  tiposContacto,
  etiquetaContacto,
  estatusOpciones,
}: Props) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const compacto = useMediaQuery(theme.breakpoints.down('md'));
  const [detalleMovil, setDetalleMovil] = useState(false);
  const [anclaFiltro, setAnclaFiltro] = useState<HTMLElement | null>(null);
  const criteriosActivos = filtrosEncendidos(filtros);
  const seleccion = rows.find((row) => row.id === selectedId) ?? null;
  const [tab, setTab] = useState(0);
  const [menuFila, setMenuFila] = useState<{ top: number; left: number; rowId: number } | null>(null);
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [aplicaciones, setAplicaciones] = useState<AplicacionOperacion[]>([]);
  const [cargandoAplicaciones, setCargandoAplicaciones] = useState(false);

  const detalle = useDocumentoDetalleData(seleccion?.id ?? null, tipoDocumento, Boolean(seleccion));

  useEffect(() => {
    let cancelado = false;
    fetchConceptos()
      .then((lista) => {
        if (!cancelado) setConceptos(lista ?? []);
      })
      .catch(() => {
        if (!cancelado) setConceptos([]);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    setTab(0);
  }, [seleccion?.id]);

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
        setAplicaciones(
          (rowsAplicadas ?? []).filter((aplicacion) => Number(aplicacion.documento_origen_id) === seleccion.id),
        );
      })
      .catch(() => {
        if (!cancelado) setAplicaciones([]);
      })
      .finally(() => {
        if (!cancelado) setCargandoAplicaciones(false);
      });
    return () => {
      cancelado = true;
    };
  }, [seleccion]);

  const acciones = useMemo(
    () => actions.filter(esAccion).filter((action) => !action.hidden && action.id !== 'ver-detalle'),
    [actions],
  );
  const porId = (id: string) => acciones.find((action) => action.id === id);

  const origenes = detalle.data?.documentosOrigen ?? [];
  const partidas = detalle.data?.partidas ?? [];
  const fiscal = seleccion ? esFiscal(seleccion.tratamiento_impuestos) && !esNotaCreditoCompra(tipoDocumento) : false;
  const etiquetaContactoWorkspace = esNotaCreditoCompra(tipoDocumento) ? 'proveedor' : 'cliente';
  const motivo = seleccion?.motivo_nc ?? null;
  const tituloPartidas = motivo === 'devolucion'
    ? (partidas.length === 1 ? 'Devolución' : 'Devoluciones')
    : motivo === 'bonificacion'
      ? (partidas.length === 1 ? 'Bonificación' : 'Bonificaciones')
      : (partidas.length === 1 ? 'Concepto' : 'Conceptos');
  const muestraPartidas = motivo === 'otro' || partidas.length > 0;

  const pestanas = [
    'Origen y aplicación',
    ...(muestraPartidas ? [tituloPartidas] : []),
    ...(fiscal ? ['Fiscal'] : []),
  ];

  const iconoSx = (_tono: 'neutro' | 'info' | 'destructivo', disabled: boolean) => ({
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

  const botonAccion = (
    id: string,
    icono: ReactNode,
    tono: 'neutro' | 'info' | 'destructivo',
    razonExtra: string | null,
    presentacion?: { tooltip?: string; ariaLabel?: string; suprimirClick?: boolean },
  ) => {
    const accion = porId(id);
    if (!accion) return null;
    const disabled = Boolean(accion.disabled) || Boolean(razonExtra);
    const titulo = presentacion?.tooltip ?? razonExtra ?? accion.label;
    return (
      <Tooltip key={id} title={titulo} arrow>
        <span>
          <IconButton
            size="small"
            disabled={disabled}
            aria-label={presentacion?.ariaLabel ?? accion.label}
            onClick={presentacion?.suprimirClick ? undefined : (event) => accion.onClick?.(event)}
            sx={iconoSx(tono, disabled)}
          >
            {icono}
          </IconButton>
        </span>
      </Tooltip>
    );
  };

  const verLista = !compacto || !detalleMovil;
  const observaciones = String(detalle.data?.documento?.observaciones ?? '').trim();
  const nombreConcepto = useMemo(() => {
    const conceptoId = Number(detalle.data?.documento?.concepto_id ?? 0);
    if (!conceptoId) return '';
    return conceptos.find((concepto) => concepto.id === conceptoId)?.nombre_concepto?.trim() || '';
  }, [conceptos, detalle.data?.documento?.concepto_id]);
  const aplicadoSeleccion = seleccion ? Math.max(0, Number(seleccion.total ?? 0) - Number(seleccion.saldo ?? 0)) : 0;
  const pctSeleccion = seleccion && Number(seleccion.total) > 0
    ? Math.min(100, (aplicadoSeleccion / Number(seleccion.total)) * 100)
    : 0;
  const agotadaSeleccion = Boolean(seleccion) && Number(seleccion?.saldo ?? 0) <= 0 && !esCancelada(seleccion?.estatus_documento);
  const aplicarDeshabilitado = Boolean(porId('aplicar-saldo')?.disabled);
  const detalleDisponible = !seleccion
    ? ''
    : esCancelada(seleccion.estatus_documento)
      ? 'Nota cancelada'
      : agotadaSeleccion
        ? 'Saldo aplicado por completo'
        : aplicarDeshabilitado
          ? ''
          : 'Puede aplicarse';
  const detalleImporte = !seleccion
    ? ''
    : seleccion.tratamiento_impuestos === 'sin_iva'
      ? 'Sin IVA'
      : Number(seleccion.iva) > 0
        ? `IVA ${currency.format(Number(seleccion.iva))}`
        : '';
  const detalleAplicado = aplicaciones.length === 0
    ? (cargandoAplicaciones ? '' : 'Sin aplicaciones')
    : `${aplicaciones.length} ${aplicaciones.length === 1 ? 'aplicación' : 'aplicaciones'}`;
  const tonoDisponible = esCancelada(seleccion?.estatus_documento)
    ? tokens.metric.blocked
    : agotadaSeleccion
      ? tokens.metric.exhausted
      : tokens.metric.available;

  const panelLista = (
    <Box
      sx={{
        width: compacto ? '100%' : 348,
        flexShrink: 0,
        display: verLista ? 'flex' : 'none',
        flexDirection: 'column',
        minHeight: 0,
        flex: compacto ? 1 : undefined,
        bgcolor: tokens.workspaceRail.background,
        color: tokens.navigation.foreground,
        borderRight: compacto ? 'none' : `1px solid ${tokens.navigation.border}`,
      }}
    >
      <Box sx={{ px: 1.75, pt: 1.7, pb: 1.2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: tokens.navigation.muted }}>
              {esNotaCreditoCompra(tipoDocumento) ? 'NOTAS DE CRÉDITO DE COMPRA' : 'NOTAS DE CRÉDITO'}
            </Typography>
            <Typography sx={{ mt: 0.35, fontSize: 13, color: tokens.navigation.subtle }}>
              {total > rows.length ? `${rows.length} de ${total}` : `${rows.length} en vista`}
            </Typography>
          </Box>
          <Tooltip title="Nueva nota de crédito" arrow>
            <IconButton
              aria-label="Nueva nota de crédito"
              onClick={onCreate}
              sx={{
                width: 34,
                height: 34,
                bgcolor: tokens.navigation.control,
                color: tokens.navigation.controlForeground,
                boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
                '&:hover': { bgcolor: tokens.content.elevated },
              }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.7, mt: 1.35, alignItems: 'stretch' }}>
          <TextField
            size="small"
            fullWidth
            placeholder={`Buscar folio, ${etiquetaContactoWorkspace}…`}
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: tokens.navigation.muted }} />
                </InputAdornment>
              ),
            }}
            sx={{
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
          <Tooltip title={criteriosActivos > 0 ? `${criteriosActivos} ${criteriosActivos === 1 ? 'filtro activo' : 'filtros activos'}` : 'Filtrar'} arrow>
            <Box sx={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
              <IconButton
                aria-label="Filtrar notas"
                aria-pressed={criteriosActivos > 0}
                onClick={(event) => setAnclaFiltro(event.currentTarget)}
                sx={{
                  alignSelf: 'stretch',
                  height: 'auto',
                  minHeight: 0,
                  width: 'auto',
                  minWidth: 0,
                  px: 1,
                  py: 0,
                  borderRadius: 2,
                  bgcolor: tokens.navigation.summary,
                  color: tokens.navigation.foreground,
                  border: '1px solid',
                  borderColor: criteriosActivos > 0 ? tokens.navigation.accent : 'transparent',
                  '&:hover': { bgcolor: tokens.navigation.hover },
                }}
              >
                <FilterAltOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
              {criteriosActivos > 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
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
                    lineHeight: 1,
                  }}
                >
                  {criteriosActivos}
                </Box>
              )}
            </Box>
          </Tooltip>
        </Box>
        {criteriosActivos > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.7, px: 0.3 }}>
            <Typography sx={{ fontSize: 12, color: tokens.navigation.foreground }}>
              {criteriosActivos === 1 ? '1 filtro activo' : `${criteriosActivos} filtros activos`}
            </Typography>
            <Box
              component="button"
              type="button"
              onClick={() => onFiltrosChange(FILTRO_NOTAS_VACIO)}
              sx={{ border: 0, bgcolor: 'transparent', color: tokens.navigation.accent, font: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', p: 0 }}
            >
              Limpiar
            </Box>
          </Box>
        )}
        <PopoverFiltroNotas
          ancla={anclaFiltro}
          filtro={filtros}
          estatusOpciones={estatusOpciones}
          tiposContacto={tiposContacto}
          etiquetaContacto={etiquetaContactoWorkspace}
          onClose={() => setAnclaFiltro(null)}
          onChange={onFiltrosChange}
        />
      </Box>
      <Box sx={{
        flex: 1,
        overflow: 'auto',
        px: 1,
        pb: 1.2,
        scrollbarWidth: 'thin',
        scrollbarColor: `${tokens.navigation.progress} ${tokens.navigation.background}`,
        '&::-webkit-scrollbar': { width: 10, background: tokens.navigation.background },
        '&::-webkit-scrollbar-track': { background: tokens.navigation.background },
        '&::-webkit-scrollbar-thumb': {
          background: tokens.navigation.progress,
          borderRadius: 99,
          border: `2px solid ${tokens.navigation.background}`,
        },
      }}>
        {isLoading && rows.length === 0 ? (
          <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}>
            <CircularProgress size={22} sx={{ color: tokens.navigation.foreground }} />
          </Box>
        ) : rows.length === 0 ? (
          <Typography sx={{ px: 1.5, py: 3, fontSize: 13, color: tokens.navigation.muted }}>
            {mensajeVacio(search, criteriosActivos)}
          </Typography>
        ) : rows.map((row) => {
          const activa = row.id === seleccion?.id;
          const saldo = Number(row.saldo ?? 0);
          const total = Number(row.total ?? 0);
          const aplicado = Math.max(0, total - saldo);
          const pct = total > 0 ? Math.min(100, Math.round((aplicado / total) * 100)) : 0;
          const agotada = saldo <= 0 && !esCancelada(row.estatus_documento);
          const origenVisible = activa && !detalle.loading
            ? (origenes.length === 0 ? 'Directa' : origenes.length === 1 ? '1 origen' : `${origenes.length} orígenes`)
            : null;
          const estadoVisual = estadoVisualDocumento(row);
          return (
            <Box
              key={row.id}
              onClick={() => {
                onSelect(row);
                setDetalleMovil(true);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelect(row);
                setMenuFila({ top: event.clientY, left: event.clientX, rowId: row.id });
              }}
              sx={{
                px: 1.25,
                py: 1.05,
                mb: 0.45,
                borderRadius: 2,
                cursor: 'pointer',
                bgcolor: activa ? tokens.navigation.selection : 'transparent',
                color: activa ? tokens.navigation.selectionForeground : tokens.navigation.foreground,
                boxShadow: activa ? '0 1px 2px rgba(0,0,0,0.18)' : 'none',
                '&:hover': { bgcolor: activa ? tokens.navigation.selection : tokens.navigation.hover },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline' }}>
                <Typography variant="figure" sx={{ fontSize: 16, color: 'inherit', lineHeight: 1.1 }}>
                  {formatFolio(row)}
                </Typography>
                <Typography sx={{ fontSize: 13.5, fontWeight: 750, fontVariantNumeric: 'tabular-nums', color: 'inherit' }}>
                  {currency.format(total)}
                </Typography>
              </Box>
              <Typography variant="figure" sx={{ fontSize: 14, mt: 0.25, color: tokens.navigation.foreground, lineHeight: 1.2 }} noWrap>
                {row.nombre_cliente || 'Sin contacto'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.7, alignItems: 'center', mt: 0.3, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: 11.5, color: tokens.navigation.muted }}>
                  {motivoEtiqueta(row.motivo_nc)}
                </Typography>
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: tokens.navigation.foreground }}>
                  {estatusEtiqueta(row.estatus_documento)}
                </Typography>
                <Tooltip title={estadoVisual.label} arrow>
                  <Box
                    component="span"
                    aria-label={estadoVisual.label}
                    sx={{ width: 8, height: 8, flex: '0 0 8px', borderRadius: '50%', bgcolor: getStatusToneColor(theme, estadoVisual.tone), display: 'inline-block' }}
                  />
                </Tooltip>
                {origenVisible && (
                  <Typography sx={{ fontSize: 11.5, color: tokens.navigation.muted }}>{origenVisible}</Typography>
                )}
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 0.55 }}>
                <Typography sx={{ fontSize: 12, color: tokens.navigation.subtle }}>
                  Saldo: {currency.format(saldo)}
                </Typography>
                <Typography sx={{ fontSize: 11, color: tokens.navigation.muted }}>
                  {formatDate(row.fecha_documento)}
                </Typography>
              </Box>
              <Box sx={{ mt: 0.55, height: 3, borderRadius: 99, bgcolor: tokens.navigation.track, overflow: 'hidden' }}>
                <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: agotada ? tokens.metric.progressDone : tokens.navigation.progress }} />
              </Box>
            </Box>
          );
        })}
        {total > pageSize && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.6, pt: 0.4, pb: 0.2 }}>
            <Typography sx={{ fontSize: 12, color: tokens.navigation.muted }}>
              {page * pageSize + 1}–{Math.min(total, (page + 1) * pageSize)} de {total}
            </Typography>
            <Box sx={{ display: 'flex' }}>
              <IconButton
                aria-label="Página anterior"
                disabled={page <= 0}
                onClick={() => onPageChange(page - 1)}
                sx={{ color: tokens.navigation.foreground, p: 0.4 }}
              >
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
              <IconButton
                aria-label="Página siguiente"
                disabled={(page + 1) * pageSize >= total}
                onClick={() => onPageChange(page + 1)}
                sx={{ color: tokens.navigation.foreground, p: 0.4 }}
              >
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );

  const razonTimbradoSeleccion = seleccion ? razonTimbrar(seleccion) : null;
  const notaYaTimbrada = razonTimbradoSeleccion === 'CFDI ya timbrado';

  const contenido = !seleccion ? (
    <Box sx={{ flex: 1, display: compacto && verLista ? 'none' : 'grid', placeItems: 'center', color: tokens.content.muted, px: 3, textAlign: 'center' }}>
      <Typography>
        {rows.length > 0 ? 'Selecciona una nota de crédito.' : mensajeVacio(search, criteriosActivos)}
      </Typography>
    </Box>
  ) : (
    <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: compacto && verLista ? 'none' : 'flex', flexDirection: 'column', bgcolor: tokens.content.background }}>
      <Box sx={{ px: { xs: 1.5, md: 2.75 }, pt: compacto ? 1 : 1.6, pb: 2.6 }}>
        {compacto && (
          <Box
            component="button"
            type="button"
            onClick={() => setDetalleMovil(false)}
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, border: 0, bgcolor: 'transparent', color: tokens.content.foreground, font: 'inherit', cursor: 'pointer', mb: 0.5, p: 0 }}
          >
            <ArrowBackIcon fontSize="small" /> Notas
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: compacto ? 'column' : 'row' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: tokens.content.muted }}>
            NOTA SELECCIONADA
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.2, alignItems: 'baseline', flexWrap: 'wrap', mt: 0.35 }}>
            <Typography variant="figure" sx={{ fontSize: 32, letterSpacing: '-0.02em', lineHeight: 1, color: tokens.content.foreground }}>
              {formatFolio(seleccion)}
            </Typography>
            <Typography sx={{ fontSize: 13, color: tokens.content.muted }}>{formatDate(seleccion.fecha_documento)}</Typography>
          </Box>
          <Typography component="p" variant="figure" sx={{ display: 'block', width: '100%', m: 0, mt: 0.7, fontSize: 15, lineHeight: 1.3, color: tokens.content.foreground, overflowWrap: 'anywhere' }}>
            {seleccion.nombre_cliente || 'Sin contacto'}
          </Typography>
          {nombreConcepto && (
            <Typography component="p" variant="figure" sx={{ display: 'block', width: '100%', m: 0, mt: 0.2, fontSize: 15, lineHeight: 1.3, color: tokens.content.foreground, overflowWrap: 'anywhere' }}>
              {nombreConcepto}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 0.7, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Pastilla fondo={tokens.metric.amount.background} tinta={tokens.metric.amount.foreground}>{motivoEtiqueta(seleccion.motivo_nc)}</Pastilla>
            <Pastilla
              fondo={tokens.content.elevated}
              tinta={tokens.content.foreground}
              onClick={(event) => onOpenEstatus(event, seleccion)}
            >
              {estatusEtiqueta(seleccion.estatus_documento)}
              <ExpandMoreIcon sx={{ fontSize: 16, ml: 0.2 }} />
            </Pastilla>
            {fiscal && (
              <Pastilla fondo={tokens.metric.available.background} tinta={tokens.metric.available.foreground}>
                {seleccion.cfdi_uuid ? 'CFDI timbrado' : 'CFDI pendiente'}
              </Pastilla>
            )}
          </Box>
          {observaciones && (
            <Typography sx={{ mt: 1, fontSize: 13, color: tokens.content.secondary, maxWidth: 640 }}>{observaciones}</Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {botonAccion('aplicar-saldo', <LinkIcon fontSize="small" />, 'neutro', null)}
          {botonAccion('ver-pdf', <PrintOutlinedIcon fontSize="small" />, 'neutro', null)}
          {botonAccion('descargar-pdf', <DownloadOutlinedIcon fontSize="small" />, 'neutro', null)}
          {botonAccion(
            'timbrar',
            porId('timbrar')?.icon ?? <NotificationsActiveIcon fontSize="small" />,
            'neutro',
            razonTimbradoSeleccion,
            {
              tooltip: razonTimbradoSeleccion ?? 'Timbrar CFDI',
              ariaLabel: 'Timbrar CFDI',
              suprimirClick: notaYaTimbrada,
            },
          )}
          {botonAccion(
            'cancelar-documento',
            porId('cancelar-documento')?.icon ?? <CancelIcon fontSize="small" />,
            'neutro',
            null,
            { tooltip: 'Cancelar', ariaLabel: 'Cancelar' },
          )}
          {botonAccion('editar', <EditOutlinedIcon fontSize="small" />, 'neutro', razonEditar(seleccion))}
          {botonAccion('eliminar', <DeleteOutlineIcon fontSize="small" />, 'destructivo', razonEliminar(seleccion))}
        </Box>
        </Box>

        <Box sx={{ mt: 1.7, display: 'grid', gridTemplateColumns: compacto ? '1fr' : '1fr 1fr 1.15fr', gap: 0.8 }}>
          <Cifra etiqueta="Importe" valor={currency.format(Number(seleccion.total ?? 0))} detalle={detalleImporte} fondo={tokens.metric.amount.background} tinta={tokens.content.foreground} caption={tokens.metric.caption} />
          <Cifra etiqueta="Aplicado" valor={currency.format(aplicadoSeleccion)} detalle={detalleAplicado} fondo={tokens.metric.applied.background} tinta={tokens.content.foreground} caption={tokens.metric.caption} />
          <Cifra etiqueta="Disponible" valor={currency.format(Number(seleccion.saldo ?? 0))} detalle={detalleDisponible} fondo={tonoDisponible.background} tinta={tokens.content.foreground} caption={tokens.metric.caption} destacado />
        </Box>
        <Box sx={{ mt: 1.1, height: 4, borderRadius: 99, bgcolor: tokens.metric.track, overflow: 'hidden' }}>
          <Box sx={{ width: `${pctSeleccion}%`, height: '100%', bgcolor: agotadaSeleccion ? tokens.metric.progressDone : tokens.metric.progress }} />
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
        value={Math.min(tab, pestanas.length - 1)}
        onChange={(_, value) => setTab(value)}
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
        {pestanas.map((nombre) => <Tab key={nombre} label={nombre} />)}
      </Tabs>

      <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1.5, md: 2.25 }, bgcolor: tokens.content.well }}>
        {pestanas[Math.min(tab, pestanas.length - 1)] === 'Origen y aplicación' && (
          <ColumnasEnfrentadas
            compacto={compacto}
            tituloIzquierda={tituloOrigenes(origenes)}
            tituloDerecha="Aplicado en"
            tinta={tokens.content.muted}
            cargandoIzquierda={detalle.loading}
            cargandoDerecha={cargandoAplicaciones}
            izquierda={origenes.length === 0 ? [(
                <TarjetaQuieta key="captura-directa" titulo="Captura directa" texto="No se ha ligado a una factura." borde={tokens.content.border} fondo={tokens.content.card} tinta={tokens.content.foreground} secundaria={tokens.content.secondary} />
            )] : origenes.map((doc) => (
              <TarjetaDocumento
                key={doc.id}
                folio={formatearFolioDocumento(doc.serie ?? '', doc.numero ?? 0) || doc.tipo_documento}
                meta={[formatDate(doc.fecha_documento), estatusEtiqueta(doc.estatus_documento)].filter(Boolean).join(' · ')}
                monto={currency.format(Number(doc.total ?? 0))}
                detalle={detalleLineas(partidas, doc.id)}
                borde={tokens.content.border}
                fondo={tokens.content.card}
                tinta={tokens.content.foreground}
                secundaria={tokens.content.secondary}
                muted={tokens.content.muted}
              />
            ))}
            derecha={aplicaciones.length === 0 ? [(
              <TarjetaQuieta key="sin-aplicaciones" titulo="Sin aplicaciones" texto="El saldo aplicado a otros documentos aparece aquí." borde={tokens.content.border} fondo={tokens.content.card} tinta={tokens.content.foreground} secundaria={tokens.content.secondary} />
            )] : aplicaciones.map((aplicacion) => (
              <TarjetaDocumento
                key={aplicacion.id}
                folio={formatearFolioDocumento(aplicacion.serie ?? '', aplicacion.numero ?? 0) || 'Documento'}
                meta={formatDate(aplicacion.fecha_aplicacion)}
                monto={currency.format(Number(aplicacion.monto_moneda_documento ?? aplicacion.monto ?? 0))}
                detalle="Aplicación de saldo"
                borde={tokens.content.border}
                fondo={tokens.content.card}
                tinta={tokens.content.foreground}
                secundaria={tokens.content.secondary}
                muted={tokens.content.muted}
              />
            ))}
          />
        )}

        {muestraPartidas && pestanas[Math.min(tab, pestanas.length - 1)] === tituloPartidas && (
          <Box sx={{ display: 'grid', gap: 1 }}>
            {detalle.loading ? <CircularProgress size={18} /> : partidas.length === 0 ? (
              <TarjetaQuieta titulo="Sin partidas" texto="Esta nota no tiene partidas." borde={tokens.content.border} fondo={tokens.content.card} tinta={tokens.content.foreground} secundaria={tokens.content.secondary} />
            ) : partidas.map((partida) => {
              const origen = (detalle.data?.documentosRelacionados ?? []).find((doc) => doc.id === Number(partida.documento_origen_id ?? 0));
              const folioOrigen = origen ? (formatearFolioDocumento(origen.serie ?? '', origen.numero ?? 0) || origen.tipo_documento) : '';
              const importe = Number(partida.total_partida ?? (Number(partida.cantidad ?? 0) * Number(partida.precio_unitario ?? 0)));
              return (
                <TarjetaPartida
                  key={partida.id}
                  folio={folioOrigen}
                  fecha={origen ? formatDate(origen.fecha_documento) : ''}
                  clave={partida.producto_clave?.trim() || ''}
                  descripcion={partida.descripcion_alterna || partida.producto_descripcion || 'Partida'}
                  cantidad={cantidadVisible.format(Number(partida.cantidad ?? 0))}
                  precio={currency.format(Number(partida.precio_unitario ?? 0))}
                  importe={currency.format(importe)}
                  borde={tokens.content.border}
                  fondo={tokens.content.card}
                  tinta={tokens.content.foreground}
                  secundaria={tokens.content.secondary}
                  muted={tokens.content.muted}
                />
              );
            })}
          </Box>
        )}

        {fiscal && pestanas[Math.min(tab, pestanas.length - 1)] === 'Fiscal' && (
          <Box sx={{ display: 'grid', gap: 1, maxWidth: 560 }}>
            <TarjetaDocumento
              folio={seleccion.cfdi_uuid ? 'CFDI timbrado' : 'CFDI pendiente'}
              meta={seleccion.tratamiento_impuestos ? `Tratamiento ${seleccion.tratamiento_impuestos}` : ''}
              monto=""
              detalle={seleccion.cfdi_uuid || undefined}
              borde={tokens.content.border}
              fondo={tokens.content.card}
              tinta={tokens.content.foreground}
              secundaria={tokens.content.secondary}
              muted={tokens.content.muted}
            />
            {seleccion.cfdi_estado_sat && (
              <TarjetaQuieta titulo="Estado SAT" texto={seleccion.cfdi_estado_sat} borde={tokens.content.border} fondo={tokens.content.card} tinta={tokens.content.foreground} secundaria={tokens.content.secondary} />
            )}
          </Box>
        )}
      </Box>
      </Box>
    </Box>
  );

  const itemsMenuNota: WorkspaceContextItem[] = !menuFila || !seleccion || menuFila.rowId !== seleccion.id ? [] : [
    { id: 'aplicar-saldo', icon: <LinkIcon fontSize="small" /> },
    { id: 'ver-pdf', icon: <PrintOutlinedIcon fontSize="small" /> },
    { id: 'descargar-pdf', icon: <DownloadOutlinedIcon fontSize="small" /> },
    { id: 'timbrar', icon: porId('timbrar')?.icon ?? <NotificationsActiveIcon fontSize="small" />, label: 'Timbrar CFDI', extra: razonTimbrar(seleccion) },
    { id: 'cancelar-documento', icon: porId('cancelar-documento')?.icon ?? <CancelIcon fontSize="small" />, label: 'Cancelar' },
    { id: 'editar', icon: <EditOutlinedIcon fontSize="small" />, extra: razonEditar(seleccion) },
    { id: 'eliminar', icon: <DeleteOutlineIcon fontSize="small" />, extra: razonEliminar(seleccion) },
  ].flatMap((spec): WorkspaceContextItem[] => {
    const accion = porId(spec.id);
    if (!accion) return [];
    const disabled = Boolean(accion.disabled) || Boolean(spec.extra);
    return [{
      id: spec.id,
      label: spec.label ?? accion.label,
      icon: spec.icon,
      disabled,
      onClick: disabled ? undefined : (event) => { void accion.onClick?.(event); },
    }];
  });

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: compacto ? 'column' : 'row', overflow: 'hidden' }}>
      {panelLista}
      {contenido}
      <WorkspaceRowContextMenu
        anchorPosition={menuFila && seleccion && menuFila.rowId === seleccion.id ? { top: menuFila.top, left: menuFila.left } : null}
        items={itemsMenuNota}
        onClose={() => setMenuFila(null)}
      />
    </Box>
  );
}

function Pastilla({ children, fondo, tinta, onClick }: { children: ReactNode; fondo: string; tinta: string; onClick?: (event: MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <Box
      component={onClick ? 'button' : 'span'}
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 26,
        px: 1.05,
        borderRadius: 99,
        border: 0,
        bgcolor: fondo,
        color: tinta,
        font: 'inherit',
        fontSize: 12,
        fontWeight: 700,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {children}
    </Box>
  );
}

function Cifra({ etiqueta, valor, detalle, fondo, tinta, caption, destacado }: { etiqueta: string; valor: string; detalle: string; fondo: string; tinta: string; caption: string; destacado?: boolean }) {
  return (
    <Box sx={{ bgcolor: fondo, borderRadius: 2, px: 1.4, py: 1.05 }}>
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: caption }}>{etiqueta}</Typography>
      <Typography variant="figure" sx={{ mt: 0.25, fontSize: destacado ? 26 : 20, letterSpacing: '-0.02em', lineHeight: 1.05, color: tinta }}>
        {valor}
      </Typography>
      {detalle ? <Typography sx={{ mt: 0.3, fontSize: 12, color: caption }}>{detalle}</Typography> : <Box sx={{ mt: 0.3, height: 18 }} />}
    </Box>
  );
}

function ColumnasEnfrentadas({
  compacto,
  tituloIzquierda,
  tituloDerecha,
  tinta,
  cargandoIzquierda,
  cargandoDerecha,
  izquierda,
  derecha,
}: {
  compacto: boolean;
  tituloIzquierda: string;
  tituloDerecha: string;
  tinta: string;
  cargandoIzquierda: boolean;
  cargandoDerecha: boolean;
  izquierda: ReactNode[];
  derecha: ReactNode[];
}) {
  const tituloSx = { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: tinta, px: 0.3 };
  const celda = (nodo: ReactNode | undefined, cargando: boolean) => (
    <Box sx={{ display: 'flex', alignItems: 'stretch', minWidth: 0 }}>
      {cargando ? <CircularProgress size={18} /> : nodo ?? null}
    </Box>
  );

  if (compacto) {
    return (
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <Typography sx={tituloSx}>{tituloIzquierda}</Typography>
        {cargandoIzquierda ? <CircularProgress size={18} /> : izquierda}
        <Typography sx={{ ...tituloSx, mt: 1 }}>{tituloDerecha}</Typography>
        {cargandoDerecha ? <CircularProgress size={18} /> : derecha}
      </Box>
    );
  }

  const filas = Math.max(izquierda.length, derecha.length);
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1.5, rowGap: 1, alignItems: 'stretch' }}>
      <Typography sx={tituloSx}>{tituloIzquierda}</Typography>
      <Typography sx={tituloSx}>{tituloDerecha}</Typography>
      {Array.from({ length: filas }, (_, indice) => (
        <Fragment key={indice}>
          {celda(izquierda[indice], cargandoIzquierda && indice === 0)}
          {celda(derecha[indice], cargandoDerecha && indice === 0)}
        </Fragment>
      ))}
    </Box>
  );
}

function TarjetaDocumento({ folio, meta, monto, detalle, borde, fondo, tinta, secundaria, muted }: { folio: string; meta: string; monto: string; detalle?: string | undefined; borde: string; fondo: string; tinta: string; secundaria: string; muted: string }) {
  return (
    <Box sx={{ flex: 1, alignSelf: 'stretch', border: `1px solid ${borde}`, borderRadius: 1.5, bgcolor: fondo, px: 1.4, py: 1.1, boxShadow: '0 1px 0 rgba(20,28,46,0.03)', width: '100%', boxSizing: 'border-box' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
        <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: tinta }}>{folio}</Typography>
        {monto ? <Typography variant="figure" sx={{ fontSize: 18, color: tinta }}>{monto}</Typography> : null}
      </Box>
      {meta ? <Typography sx={{ fontSize: 12, color: muted, mt: 0.25 }}>{meta}</Typography> : null}
      {detalle ? <Typography sx={{ fontSize: 12.5, color: secundaria, mt: 0.35 }}>{detalle}</Typography> : null}
    </Box>
  );
}

function TarjetaPartida({
  folio,
  fecha,
  clave,
  descripcion,
  cantidad,
  precio,
  importe,
  borde,
  fondo,
  tinta,
  secundaria,
  muted,
}: {
  folio: string;
  fecha: string;
  clave: string;
  descripcion: string;
  cantidad: string;
  precio: string;
  importe: string;
  borde: string;
  fondo: string;
  tinta: string;
  secundaria: string;
  muted: string;
}) {
  return (
    <Box sx={{ border: `1px solid ${borde}`, borderRadius: 1.5, bgcolor: fondo, px: 1.4, py: 1.15 }}>
      {(folio || fecha) && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline' }}>
          {folio ? <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: tinta }}>{folio}</Typography> : <span />}
          {fecha ? <Typography sx={{ fontSize: 12.5, color: muted }}>{fecha}</Typography> : null}
        </Box>
      )}
      {clave ? (
        <Typography sx={{ mt: folio || fecha ? 0.45 : 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: secundaria }}>
          {clave}
        </Typography>
      ) : null}
      <Typography sx={{ mt: 0.25, fontSize: 14, fontWeight: 650, color: tinta }}>{descripcion}</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 0.8 }}>
        <Typography sx={{ fontSize: 12.5, color: secundaria }}>Cantidad {cantidad}</Typography>
        <Typography sx={{ fontSize: 12.5, color: secundaria }}>Precio {precio}</Typography>
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: tinta }}>Importe {importe}</Typography>
      </Box>
    </Box>
  );
}

function PopoverFiltroNotas({
  ancla,
  filtro,
  estatusOpciones,
  tiposContacto,
  etiquetaContacto,
  onClose,
  onChange,
}: {
  ancla: HTMLElement | null;
  filtro: FiltroNotas;
  estatusOpciones: string[];
  tiposContacto: string[];
  etiquetaContacto: string;
  onClose: () => void;
  onChange: (filtro: FiltroNotas) => void;
}) {
  const tokens = useTheme().emphasys;
  const activos = filtrosEncendidos(filtro);
  const cambiar = (parcial: Partial<FiltroNotas>) => onChange({ ...filtro, ...parcial });
  const elegirAplicacion = (siguiente: Exclude<FiltroAplicacionNota, ''>) => {
    cambiar({ aplicacion: filtro.aplicacion === siguiente ? '' : siguiente });
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
            width: 312,
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: 'min(70vh, 560px)',
            overflow: 'auto',
            bgcolor: tokens.content.card,
            color: tokens.content.foreground,
            border: `1px solid ${tokens.content.border}`,
            borderRadius: 2,
            boxShadow: '0 16px 40px rgba(44, 49, 56, 0.18)',
          },
        },
      }}
    >
      <Box sx={{ px: 1.6, pt: 1.4, pb: 1.6, display: 'flex', flexDirection: 'column', gap: 1.45 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 14, fontWeight: 750, color: tokens.content.foreground }}>Filtrar</Typography>
          <Box
            component="button"
            type="button"
            disabled={activos === 0}
            onClick={() => onChange(FILTRO_NOTAS_VACIO)}
            sx={{
              border: 0,
              bgcolor: 'transparent',
              p: 0,
              font: 'inherit',
              fontSize: 12,
              fontWeight: 700,
              cursor: activos === 0 ? 'default' : 'pointer',
              color: activos === 0 ? tokens.content.muted : tokens.content.foreground,
            }}
          >
            Limpiar
          </Box>
        </Box>

        <GrupoFiltro titulo="Estatus" tinta={tokens.content.muted}>
          {estatusOpciones.map((clave) => (
            <OpcionFiltro
              key={clave}
              activo={filtro.estatus.includes(clave)}
              onClick={() => cambiar({ estatus: alternar(filtro.estatus, clave) })}
              borde={tokens.content.border}
              tinta={tokens.content.secondary}
              fondo={tokens.content.card}
              activoFondo={tokens.content.foreground}
              activoTinta={tokens.content.background}
            >
              {estatusEtiqueta(clave)}
            </OpcionFiltro>
          ))}
        </GrupoFiltro>

        <GrupoFiltro titulo="Motivo" tinta={tokens.content.muted}>
          {MOTIVOS.map((motivo) => (
            <OpcionFiltro
              key={motivo}
              activo={filtro.motivos.includes(motivo)}
              onClick={() => cambiar({ motivos: alternar(filtro.motivos, motivo) })}
              borde={tokens.content.border}
              tinta={tokens.content.secondary}
              fondo={tokens.content.card}
              activoFondo={tokens.content.foreground}
              activoTinta={tokens.content.background}
            >
              {motivoEtiqueta(motivo)}
            </OpcionFiltro>
          ))}
        </GrupoFiltro>

        <GrupoFiltro titulo="Aplicación" tinta={tokens.content.muted}>
          <OpcionFiltro
            activo={filtro.aplicacion === 'pendiente'}
            onClick={() => elegirAplicacion('pendiente')}
            borde={tokens.content.border}
            tinta={tokens.content.secondary}
            fondo={tokens.content.card}
            activoFondo={tokens.content.foreground}
            activoTinta={tokens.content.background}
          >
            Por aplicar
          </OpcionFiltro>
          <OpcionFiltro
            activo={filtro.aplicacion === 'aplicada'}
            onClick={() => elegirAplicacion('aplicada')}
            borde={tokens.content.border}
            tinta={tokens.content.secondary}
            fondo={tokens.content.card}
            activoFondo={tokens.content.foreground}
            activoTinta={tokens.content.background}
          >
            Totalmente aplicada
          </OpcionFiltro>
        </GrupoFiltro>

        <Box>
          <Typography sx={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.content.muted, mb: 0.7 }}>
            {etiquetaContacto}
          </Typography>
          <BuscadorCliente
            clienteId={filtro.clienteId}
            clienteNombre={filtro.clienteNombre}
            tiposContacto={tiposContacto}
            placeholder={`Buscar ${etiquetaContacto.toLocaleLowerCase('es-MX')}`}
            activo={Boolean(ancla)}
            onChange={(cliente) => cambiar({
              clienteId: cliente?.id ?? null,
              clienteNombre: cliente?.nombre ?? '',
            })}
          />
        </Box>

        <Box>
          <Typography sx={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.content.muted, mb: 0.7 }}>
            Fecha
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.8 }}>
            <TextField
              label="Desde"
              type="date"
              size="small"
              value={filtro.desde}
              onChange={(event) => cambiar({ desde: event.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={campoFechaSx(tokens.content.foreground, tokens.content.border)}
            />
            <TextField
              label="Hasta"
              type="date"
              size="small"
              value={filtro.hasta}
              onChange={(event) => cambiar({ hasta: event.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={campoFechaSx(tokens.content.foreground, tokens.content.border)}
            />
          </Box>
        </Box>
      </Box>
    </Popover>
  );
}

type OpcionCliente = { id: number; nombre: string };

function BuscadorCliente({
  clienteId,
  clienteNombre,
  tiposContacto,
  placeholder,
  activo,
  onChange,
}: {
  clienteId: number | null;
  clienteNombre: string;
  tiposContacto: string[];
  placeholder: string;
  activo: boolean;
  onChange: (cliente: OpcionCliente | null) => void;
}) {
  const tokens = useTheme().emphasys;
  const [texto, setTexto] = useState(clienteNombre);
  const [opciones, setOpciones] = useState<OpcionCliente[]>([]);
  const [cargando, setCargando] = useState(false);
  const tiposClave = tiposContacto.join('|');
  const seleccionado = clienteId != null ? { id: clienteId, nombre: clienteNombre || 'Cliente' } : null;

  useEffect(() => {
    setTexto(clienteNombre);
  }, [clienteNombre]);

  useEffect(() => {
    if (!activo) return undefined;
    let cancelado = false;
    const timer = window.setTimeout(() => {
      setCargando(true);
      fetchContactosPaginados({
        page: 1,
        limit: 20,
        ...(texto.trim() ? { search: texto.trim() } : {}),
        ...(tiposContacto.length > 0 ? { tipos: tiposContacto } : {}),
      })
        .then((respuesta) => {
          if (cancelado) return;
          setOpciones((respuesta.data ?? []).map((contacto) => ({
            id: contacto.id,
            nombre: contacto.nombre?.trim() || 'Sin nombre',
          })));
        })
        .catch(() => {
          if (!cancelado) setOpciones([]);
        })
        .finally(() => {
          if (!cancelado) setCargando(false);
        });
    }, 280);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [activo, texto, tiposClave, tiposContacto]);

  const opcionesVisibles = seleccionado && !opciones.some((opcion) => opcion.id === seleccionado.id)
    ? [seleccionado, ...opciones]
    : opciones;

  return (
    <Autocomplete
      size="small"
      options={opcionesVisibles}
      loading={cargando}
      value={seleccionado}
      inputValue={texto}
      onInputChange={(_, value) => setTexto(value)}
      onChange={(_, value) => onChange(value)}
      getOptionLabel={(opcion) => opcion.nombre}
      isOptionEqualToValue={(opcion, valor) => opcion.id === valor.id}
      filterOptions={(opcionesActuales) => opcionesActuales}
      noOptionsText={cargando ? 'Buscando…' : 'Sin coincidencias'}
      clearText="Quitar cliente"
      slotProps={{ popper: { disablePortal: true } }}
      renderInput={(params) => {
        const { InputLabelProps: _etiqueta, ...resto } = params;
        const campo = {
          ...resto,
          placeholder,
          sx: campoFechaSx(tokens.content.foreground, tokens.content.border),
        };
        return <TextField {...(campo as ComponentProps<typeof TextField>)} />;
      }}
    />
  );
}

function GrupoFiltro({ titulo, tinta, children }: { titulo: string; tinta: string; children: ReactNode }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: tinta, mb: 0.7 }}>
        {titulo}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>{children}</Box>
    </Box>
  );
}

function OpcionFiltro({
  activo,
  onClick,
  children,
  borde,
  tinta,
  fondo,
  activoFondo,
  activoTinta,
}: {
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
  borde: string;
  tinta: string;
  fondo: string;
  activoFondo: string;
  activoTinta: string;
}) {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      sx={{
        border: `1px solid ${activo ? 'transparent' : borde}`,
        bgcolor: activo ? activoFondo : fondo,
        color: activo ? activoTinta : tinta,
        borderRadius: 99,
        px: 1.05,
        py: 0.4,
        font: 'inherit',
        fontSize: 12.5,
        fontWeight: 650,
        cursor: 'pointer',
        lineHeight: 1.2,
      }}
    >
      {children}
    </Box>
  );
}

function campoFechaSx(tinta: string, borde: string) {
  return {
    '& .MuiInputBase-root': { fontSize: 13, color: tinta },
    '& .MuiInputLabel-root': { fontSize: 13, color: tinta },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: borde },
  };
}

function TarjetaQuieta({ titulo, texto, borde, fondo, tinta, secundaria }: { titulo: string; texto: string; borde: string; fondo: string; tinta: string; secundaria: string }) {
  return (
    <Box sx={{ flex: 1, alignSelf: 'stretch', border: `1px solid ${borde}`, borderRadius: 1.5, bgcolor: fondo, px: 1.4, py: 1.15, width: '100%', boxSizing: 'border-box' }}>
      <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: tinta }}>{titulo}</Typography>
      <Typography sx={{ fontSize: 12.5, color: secundaria, mt: 0.35 }}>{texto}</Typography>
    </Box>
  );
}
