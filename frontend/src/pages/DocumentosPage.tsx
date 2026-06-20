import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  Divider,
  TextField,
  IconButton,
  Paper,
  Container,
  Grid,
  InputAdornment,
  Stack,
  Toolbar,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import type {
  GridColDef,
  GridRowParams,
  GridRenderCellParams,
  GridColumnVisibilityModel,
  GridColumnResizeParams,
  GridSortModel,
} from '@mui/x-data-grid';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import BuildIcon from '@mui/icons-material/Build';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import EmailIcon from '@mui/icons-material/Email';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import CancelIcon from '@mui/icons-material/Cancel';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import LinkIcon from '@mui/icons-material/Link';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import DonutLargeIcon from '@mui/icons-material/DonutLarge';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TableViewIcon from '@mui/icons-material/TableView';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import { Tooltip } from '@mui/material';
import Snackbar from '@mui/material/Snackbar';
import AlertSnackbar from '@mui/material/Alert';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import type { Contacto } from '../types/contactos.types';
import type { CotizacionListado, EstadoSeguimiento } from '../types/cotizacion';
import type { TipoDocumento } from '../types/documentos.types';
import type { DocumentoAnticiposDisponibles } from '../types/finanzas';
import type { TipoDocumentoEmpresa } from '../services/tiposDocumentoService';
import { fetchTiposDocumentoHabilitados } from '../services/tiposDocumentoService';
import { fetchContactos, fetchVendedores } from '../services/contactosService';
import { abrirDocumentoPdfEnNuevaVentana, cancelarDocumento, descargarDocumentoPdfEnNavegador, deleteDocumento, duplicateDocumento, duplicateDocumentos, enviarCotizacionPorCorreo, exportarDocumentos, getDocumentos, getDocumentosPaginados, timbrarDocumentoCfdi, updateDocumento, validateDeleteDocumento } from '../services/documentosService';
import { fetchAnticiposDisponiblesDocumento, fetchSaldoDocumento } from '../services/finanzasService';
import { enviarFactura } from '../services/facturasService';
import { createSeguimientoProduccion, getSeguimientoProduccionPorDocumento, type SeguimientoProduccionHistorialRow } from '../services/produccionService';
import { formatearFolioDocumento } from '../utils/documentos.utils';
import { esES } from '@mui/x-data-grid/locales';
import { useSession } from '../session/useSession';
import type { DocumentoAccion } from '../modules/documentos/documentoTypes';
import { getDocumentoTypeConfig } from '../modules/documentos/documentoTypeConfig';
import { useDocumentoConfig } from '../modules/documentos/useDocumentoConfig';
import { AnticiposAplicacionDialog } from '../modules/finanzas/AnticiposAplicacionDialog';
import { FacturaPagosDrawer } from '../modules/finanzas/FacturaPagosDrawer';
import { DocumentoWhatsappDialog } from '../modules/documentos/DocumentoWhatsappDialog';
import { GridContextMenu } from '../components/grids/GridContextMenu';
import { GridContextMenuTrigger } from '../components/grids/GridContextMenuTrigger';
import type { GridContextMenuAction } from '../components/grids/GridContextMenu';
import { SHOW_GRID_ACTIONS } from '../components/grids/gridUxFlags';
import { STANDARD_DATA_GRID_HEADER_HEIGHT, STANDARD_DATA_GRID_ROW_HEIGHT, standardDataGridSx } from '../components/grids/standardDataGridSx';
import { useGridContextMenu } from '../hooks/useGridContextMenu';
import { useDeviceProfile } from '../hooks/useDeviceProfile';
import { useGridPreferences } from '../hooks/useGridPreferences';
import {
  navigateToGeneratedDocument,
  parseGeneratedDocumentFocus,
  resolveDocumentoFormPath,
  resolveDocumentosListPath,
} from '../modules/documentos/documentoNavigation';
import DocumentosDesktopView from '../components/documentos/DocumentosDesktopView';
import DocumentosMobileView from '../components/documentos/DocumentosMobileView';
import FacturaGlobalDialog from '../modules/documentos/FacturaGlobalDialog';

const formatCivilDate = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
};

const toCivilDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatProductionDateTime = (value: string | null | undefined) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(parsed);
};

const compactEditableInputFontSize = { xs: 16, md: 13 } as const;

const compactFilterFieldSx = {
  '& .MuiInputLabel-root': { fontSize: 13 },
  '& .MuiInputBase-input': { fontSize: compactEditableInputFontSize, py: 1.15 },
  '& .MuiAutocomplete-input': { fontSize: compactEditableInputFontSize },
  '& .MuiSelect-select': { fontSize: compactEditableInputFontSize },
} as const;

function normalizeHexColor(color: string | null | undefined) {
  const raw = String(color ?? '').trim();
  const match = raw.match(/^#?([0-9A-Fa-f]{6})$/);
  if (!match) {
    return null;
  }

  return `#${match[1].toUpperCase()}`;
}

function getContrastingTextColor(color: string | null | undefined) {
  const hex = normalizeHexColor(color);
  if (!hex) {
    return '#111827';
  }

  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const transform = (channel: number) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = (0.2126 * transform(red)) + (0.7152 * transform(green)) + (0.0722 * transform(blue));

  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithDark = (luminance + 0.05) / 0.05;

  return contrastWithWhite >= contrastWithDark ? '#ffffff' : '#111827';
}
import {
  ESTADOS_SEGUIMIENTO,
  getEstadoSeguimientoPresentation,
  normalizeEstadoSeguimiento,
} from '../modules/cotizaciones/estadoSeguimiento';
import {
  getOpcionesGeneracion,
  prepararGeneracion,
  prepararGeneracionMultiple,
  generarDocumentoDesdeOrigen,
  AutorizacionRequeridaError,
  SinPermisoAutorizacionError,
  type OpcionGeneracionResponse,
  type PrepararGeneracionResponse,
  type GenerarDocumentoPayload,
} from '../services/documentGenerationService';

type DocumentosPageProps = {
  tipoDocumento?: TipoDocumento;
};

type QuickFilter = 'todos' | string;

type StatusOption = {
  value: string;
  label: string;
  color?: string;
  textColor?: string;
};

type CotizacionEstatusDocumento = 'borrador' | 'enviado' | 'en negociacion';

const FILTROS_COTIZACION_INICIALES = {
  fechaDesde: '',
  fechaHasta: '',
  clienteId: null,
  agenteId: null,
  montoMin: '',
  montoMax: '',
} satisfies {
  fechaDesde: string;
  fechaHasta: string;
  clienteId: number | null;
  agenteId: number | null;
  montoMin: string;
  montoMax: string;
};

const DOCUMENTO_ESTATUS_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  emitido: 'Emitido',
  cancelado: 'Cancelado',
  cerrado: 'Cerrado',
  timbrado: 'Timbrado',
  pagado: 'Pagado',
};

const COTIZACION_ESTATUS_LABELS: Record<CotizacionEstatusDocumento, string> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  'en negociacion': 'En negociación',
};

const COTIZACION_ESTATUS_EDITABLE_OPTIONS: StatusOption[] = [
  { value: 'en negociacion', label: 'En negociación' },
];

const normalizeDocumentoEstatus = (value: unknown): string => {
  const normalized = String(value ?? 'borrador').trim().toLowerCase();
  if (!normalized) return 'borrador';
  if (normalized === 'enviado') return 'emitido';
  return normalized;
};

const formatDocumentoEstatusLabel = (value: unknown): string => {
  const normalized = normalizeDocumentoEstatus(value);
  return DOCUMENTO_ESTATUS_LABELS[normalized] ?? String(value ?? 'Borrador');
};

const formatMotivoNcLabel = (value: unknown): string => {
  const normalized = normalizeMotivoNc(value);
  if (normalized === 'devolucion') return 'Devolución';
  if (normalized === 'bonificacion') return 'Bonificación';
  if (normalized === 'otro') return 'Otro';
  return '—';
};

const getDocumentoEstatusColor = (value: unknown): 'default' | 'info' | 'success' | 'warning' | 'error' => {
  const normalized = normalizeDocumentoEstatus(value);
  if (normalized === 'borrador') return 'default';
  if (normalized === 'emitido') return 'info';
  if (normalized === 'cancelado') return 'error';
  if (normalized === 'timbrado' || normalized === 'cerrado' || normalized === 'pagado') return 'success';
  return 'default';
};

const isFacturaTimbrada = (value: unknown): boolean => normalizeDocumentoEstatus(value) === 'timbrado';

const normalizeCotizacionEstatusDocumento = (value: unknown): CotizacionEstatusDocumento => {
  const normalized = String(value ?? 'borrador')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

  if (normalized === 'enviado') return 'enviado';
  if (normalized === 'en negociacion' || normalized === 'negociacion') return 'en negociacion';
  return 'borrador';
};

const formatCotizacionEstatusLabel = (value: unknown): string => {
  return COTIZACION_ESTATUS_LABELS[normalizeCotizacionEstatusDocumento(value)];
};

const getCotizacionEstatusPresentation = (value: unknown) => {
  const normalized = normalizeCotizacionEstatusDocumento(value);

  if (normalized === 'enviado') {
    return { value: normalized, label: COTIZACION_ESTATUS_LABELS.enviado, color: '#dbeafe', textColor: '#1d4ed8' };
  }
  if (normalized === 'en negociacion') {
    return { value: normalized, label: COTIZACION_ESTATUS_LABELS['en negociacion'], color: '#fef3c7', textColor: '#92400e' };
  }

  return { value: normalized, label: COTIZACION_ESTATUS_LABELS.borrador, color: '#f3f4f6', textColor: '#374151' };
};

const getCotizacionEstatusEditableOptions = (value: unknown): StatusOption[] => {
  return normalizeCotizacionEstatusDocumento(value) === 'enviado' ? COTIZACION_ESTATUS_EDITABLE_OPTIONS : [];
};

const normalizeTipoDocumento = (value: unknown): TipoDocumento =>
  String(value ?? 'cotizacion').trim().toLowerCase() as TipoDocumento;

const normalizeMotivoNc = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const esNotaCreditoTimbrable = (motivoNc: unknown): boolean => {
  const normalized = normalizeMotivoNc(motivoNc);
  return normalized === 'bonificacion' || normalized === 'devolucion' || normalized === 'otro';
};

const esDocumentoFiscalPorTratamiento = (tipoDocumento: TipoDocumento, tratamientoImpuestos: unknown): boolean => {
  const tipoNormalizado = normalizeTipoDocumento(tipoDocumento);
  if (tipoNormalizado !== 'factura' && tipoNormalizado !== 'nota_credito') {
    return false;
  }

  return String(tratamientoImpuestos ?? 'normal').trim().toLowerCase() !== 'sin_iva';
};

type TratamientoImpuestos = 'normal' | 'sin_iva' | 'tasa_cero' | 'exento';

const TRATAMIENTO_OPCIONES: { label: string; value: TratamientoImpuestos }[] = [
  { label: 'Operación estándar', value: 'normal' },
  { label: 'Nota de venta', value: 'sin_iva' },
  { label: 'Operación tasa cero', value: 'tasa_cero' },
  { label: 'Operación exenta', value: 'exento' },
];

const normalizarTratamiento = (value: unknown): TratamientoImpuestos => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return (['normal', 'sin_iva', 'tasa_cero', 'exento'] as const).includes(normalized as TratamientoImpuestos)
    ? (normalized as TratamientoImpuestos)
    : 'normal';
};

const puedeTimbrarCfdiDocumento = (tipoDocumento: TipoDocumento, row?: Partial<CotizacionListado> | null): boolean => {
  const tipoNormalizado = normalizeTipoDocumento(tipoDocumento);

  if (tipoNormalizado === 'pago_cliente') {
    return true;
  }

  if (!esDocumentoFiscalPorTratamiento(tipoNormalizado, row?.tratamiento_impuestos)) {
    return false;
  }

  if (tipoNormalizado === 'nota_credito') {
    return esNotaCreditoTimbrable(row?.motivo_nc);
  }

  return tipoNormalizado === 'factura';
};

export default function DocumentosPage({ tipoDocumento: propTipo }: DocumentosPageProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const perfilDispositivo = useDeviceProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { session } = useSession();
  const tipoDocumento = normalizeTipoDocumento(propTipo ?? params.codigo ?? 'cotizacion');
  const token = session.token;
  const empresaId = session.empresaActivaId;
  const modulo = location.pathname.startsWith('/compras') ? 'compras' : 'ventas';
  const esCotizacion = tipoDocumento === 'cotizacion';
  const esNotaCredito = tipoDocumento === 'nota_credito' || tipoDocumento === 'nota_credito_compra';
  const esFacturaVentas = tipoDocumento === 'factura' && modulo === 'ventas';
  const [openFacturaGlobal, setOpenFacturaGlobal] = useState(false);
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumentoEmpresa[]>([]);

  useEffect(() => {
    const loadTipos = async () => {
      try {
        const data = await fetchTiposDocumentoHabilitados(modulo);
        setTiposDocumento(data);
      } catch (err) {
        console.error('No se pudieron cargar los tipos de documento', err);
      }
    };
    void loadTipos();
  }, [modulo]);

  const documentoTypeConfig = useMemo(() => getDocumentoTypeConfig(tipoDocumento), [tipoDocumento]);
  const tipoDocumentoPermiteCorreo = tipoDocumento === 'cotizacion' || tipoDocumento === 'orden_servicio';
  const tipoDocumentoPermiteWhatsapp = tipoDocumento === 'cotizacion' || tipoDocumento === 'orden_servicio' || tipoDocumento === 'factura';

  const textos = useMemo(() => {
    const match = tiposDocumento.find((t) => t.codigo === tipoDocumento);
    if (match) {
      const titulo = match.nombre_plural || match.nombre || match.codigo;
      const singular = match.nombre || match.nombre_plural || match.codigo;
      return {
        titulo,
        descripcion: `Consulta y gestiona ${match.nombre_plural?.toLowerCase() || match.nombre?.toLowerCase() || 'los documentos'}.`,
        singular,
      };
    }

    const configLabel = documentoTypeConfig?.label?.trim();
    if (configLabel) {
      return {
        titulo: configLabel,
        descripcion: `Consulta y gestiona ${configLabel.toLowerCase()}.`,
        singular: configLabel,
      };
    }

    const fallbackTitulo = tipoDocumento.charAt(0).toUpperCase() + tipoDocumento.slice(1);
    return {
      titulo: fallbackTitulo,
      descripcion: 'Consulta y gestiona los documentos.',
      singular: fallbackTitulo,
    };
  }, [documentoTypeConfig, tiposDocumento, tipoDocumento]);
  const [rows, setRows] = useState<CotizacionListado[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [rowCount, setRowCount] = useState(0);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [vendedores, setVendedores] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
  const [bulkDuplicating, setBulkDuplicating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deleteBlockedDialog, setDeleteBlockedDialog] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [timbrandoId, setTimbrandoId] = useState<number | null>(null);
  const [cancelandoId, setCancelandoId] = useState<number | null>(null);
  type SnackbarSeverity = 'success' | 'error' | 'info' | 'warning';
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: SnackbarSeverity }>(
    { open: false, message: '', severity: 'success' }
  );
  const [cancelarDialog, setCancelarDialog] = useState<{
    open: boolean;
    id: number | null;
    motivoCancelacion: string;
    motivoSat: string;
    uuidSustitucion: string;
    enviando: boolean;
    error: string | null;
  }>({
    open: false,
    id: null,
    motivoCancelacion: '',
    motivoSat: '02',
    uuidSustitucion: '',
    enviando: false,
    error: null,
  });
  const [enviarDialog, setEnviarDialog] = useState<{
    open: boolean;
    id: number | null;
    email: string;
    enviando: boolean;
    error?: string | null;
  }>({ open: false, id: null, email: '', enviando: false, error: null });
  const [enviarCotizacionDialog, setEnviarCotizacionDialog] = useState<{
    open: boolean;
    id: number | null;
    email: string;
    subject: string;
    message: string;
    enviando: boolean;
    error?: string | null;
  }>({ open: false, id: null, email: '', subject: '', message: '', enviando: false, error: null });
  const [enviarWhatsappDialog, setEnviarWhatsappDialog] = useState<{
    open: boolean;
    id: number | null;
  }>({ open: false, id: null });
  const [produccionDialog, setProduccionDialog] = useState<{
    open: boolean;
    id: number | null;
    fechaPromesa: string;
    comentarios: string;
    enviando: boolean;
    error?: string | null;
  }>({ open: false, id: null, fechaPromesa: toCivilDate(), comentarios: '', enviando: false, error: null });
  const [produccionDrawer, setProduccionDrawer] = useState<{
    open: boolean;
    loading: boolean;
    documentoId: number | null;
    titulo: string;
    historial: SeguimientoProduccionHistorialRow[];
    error: string | null;
  }>({ open: false, loading: false, documentoId: null, titulo: '', historial: [], error: null });
  const [opcionesGeneracion, setOpcionesGeneracion] = useState<Record<number, OpcionGeneracionResponse[]>>({});
  const [tieneOpcionesGeneracion, setTieneOpcionesGeneracion] = useState<boolean | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuAnchorPosition, setMenuAnchorPosition] = useState<{ top: number; left: number } | null>(null);
  const [menuDocumentoId, setMenuDocumentoId] = useState<number | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [generacionDialog, setGeneracionDialog] = useState<{
    open: boolean;
    loading: boolean;
    documentoId: number | null;
    documentoIds: number[];
    tipoDestino: string | null;
    data: PrepararGeneracionResponse | null;
    cantidades: Record<number, number>;
    tratamientoImpuestos: TratamientoImpuestos;
    enviando: boolean;
  }>({ open: false, loading: false, documentoId: null, documentoIds: [], tipoDestino: null, data: null, cantidades: {}, tratamientoImpuestos: 'normal', enviando: false });
  const [aplicarAnticiposDialog, setAplicarAnticiposDialog] = useState<{
    open: boolean;
    documentoOrigenId: number | null;
    documentoDestinoId: number | null;
    documentoDestinoTipo: TipoDocumento | null;
    data: DocumentoAnticiposDisponibles | null;
    navigationPathname: string | null;
  }>({ open: false, documentoOrigenId: null, documentoDestinoId: null, documentoDestinoTipo: null, data: null, navigationPathname: null });
  const [aplicarSaldoNcDrawer, setAplicarSaldoNcDrawer] = useState<{
    open: boolean;
    documentoId: number | null;
    contactoId: number | null;
    saldo: number;
    tipoDocumento: TipoDocumento | null;
  }>({ open: false, documentoId: null, contactoId: null, saldo: 0, tipoDocumento: null });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [actualizandoEstatusId, setActualizandoEstatusId] = useState<number | null>(null);
  const [estatusMenu, setEstatusMenu] = useState<{ anchorEl: HTMLElement | null; rowId: number | null; currentValue: string }>({
    anchorEl: null,
    rowId: null,
    currentValue: 'borrador',
  });
  const [seguimientoMenu, setSeguimientoMenu] = useState<{
    anchorEl: HTMLElement | null;
    rowId: number | null;
    currentValue: EstadoSeguimiento | null;
  }>({
    anchorEl: null,
    rowId: null,
    currentValue: null,
  });
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('todos');
  const [filtrosCotizacion, setFiltrosCotizacion] = useState<{
    fechaDesde: string;
    fechaHasta: string;
    clienteId: number | null;
    agenteId: number | null;
    montoMin: string;
    montoMax: string;
  }>(FILTROS_COTIZACION_INICIALES);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [focusedDocumentId, setFocusedDocumentId] = useState<number | null>(null);
  const [highlightedDocumentId, setHighlightedDocumentId] = useState<number | null>(null);
  const gridContainerRef = React.useRef<HTMLDivElement | null>(null);
  const consumedFocusNonceRef = React.useRef<string | null>(null);

  const {
    loadingPreferences,
    sortModel,
    setSortModel,
    columnVisibilityModel,
    setColumnVisibilityModel,
    setColumnWidths,
    columnOrder,
    setColumnOrder,
    applySavedWidthsToColumns,
    persistExternalFilters,
  } = useGridPreferences<{
    search: string;
    soloPendientes: boolean;
    quickFilter: QuickFilter;
    filtrosCotizacion: typeof FILTROS_COTIZACION_INICIALES;
  }>({
    pantalla: `${modulo}.${tipoDocumento}.list`,
    perfilDispositivo,
    defaultSortModel: [],
    defaultColumnVisibilityModel: {},
    defaultColumnOrder: [],
    defaultExternalFilters: {
      search: '',
      soloPendientes: false,
      quickFilter: 'todos',
      filtrosCotizacion: FILTROS_COTIZACION_INICIALES,
    },
    onLoadExternalFilters: (value) => {
      setSearch(String(value.search ?? ''));
      setSoloPendientes(Boolean(value.soloPendientes));
      setQuickFilter((value.quickFilter as QuickFilter) ?? 'todos');
      if (value.filtrosCotizacion && typeof value.filtrosCotizacion === 'object') {
        setFiltrosCotizacion({
          ...FILTROS_COTIZACION_INICIALES,
          ...(value.filtrosCotizacion as typeof FILTROS_COTIZACION_INICIALES),
        });
      }
    },
  });

  const {
    contextMenuRow: contextMenuRow,
    anchorPosition: contextMenuPosition,
    closeContextMenu: closeGridContextMenu,
    openContextMenuForRow,
    rowSlotProps: gridContextMenuRowSlotProps,
  } = useGridContextMenu(rows, {
    onOpen: (row) => {
      setFocusedDocumentId(Number(row.id));
      setHighlightedDocumentId(null);
      if (tieneOpcionesGeneracion && token && empresaId) {
        void loadOpcionesGeneracion(Number(row.id)).catch((err) => {
          console.warn('No se pudieron precargar opciones de generación para el menú contextual', err);
        });
      }
    },
  });

  const contextMenuTriggerColumn = useMemo<GridColDef>(
    () => ({
      field: 'menu',
      headerName: '',
      width: 42,
      minWidth: 42,
      maxWidth: 42,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      disableReorder: true,
      headerAlign: 'center',
      align: 'center',
      headerClassName: 'finanzas-header',
      renderCell: (params: GridRenderCellParams) => (
        <GridContextMenuTrigger onOpen={(event) => openContextMenuForRow(event, params.row as CotizacionListado)} />
      ),
    }),
    [openContextMenuForRow]
  );

  const basePath = resolveDocumentosListPath(tipoDocumento, modulo);
  const {
    filtroAgente: configuredAgentFilter,
    mostrarSaldo: configuredShowSaldo,
    accionesDisponibles,
    contactoLabel,
    contactoTiposPermitidos,
    vendedorVisible,
  } = useDocumentoConfig(tipoDocumento);
  const generatedDocumentFocus = useMemo(() => parseGeneratedDocumentFocus(location.state), [location.state]);
  const statusField = tipoDocumento === 'cotizacion' ? 'estado_seguimiento' : 'estatus_documento';
  const sumField = 'subtotal';
  const statusOptions = useMemo<StatusOption[]>(
    () =>
      tipoDocumento === 'cotizacion'
        ? ESTADOS_SEGUIMIENTO.map((estado) => ({
            value: estado.value,
            label: estado.label,
            color: estado.color,
            textColor: estado.textColor,
          }))
        : (documentoTypeConfig?.estatusPermitidos ?? ['borrador', 'emitido', 'cancelado']).map((estatus) => ({
            value: normalizeDocumentoEstatus(estatus),
            label: formatDocumentoEstatusLabel(estatus),
          })),
    [documentoTypeConfig, tipoDocumento]
  );
  const enableFilters = statusOptions.length > 0;
  const showAgentFilter = configuredAgentFilter && vendedorVisible;
  const contactoLabelLower = contactoLabel.toLocaleLowerCase();

  const currency = useMemo(
    () =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
      }),
    []
  );

  const currencyFormatter = useCallback((value: number | string | null | undefined) => currency.format(Number(value ?? 0)), [currency]);
  const showSaldo = configuredShowSaldo;
  const isFacturaConSaldo = showSaldo;
  const hasAction = useCallback((action: DocumentoAccion) => accionesDisponibles.includes(action), [accionesDisponibles]);
  const canBulkDuplicate = true;
  const bulkNotaCreditoDestino = tipoDocumento === 'factura'
    ? 'nota_credito'
    : tipoDocumento === 'factura_compra'
      ? 'nota_credito_compra'
      : null;
  const estatusDocumentoOptions = useMemo<StatusOption[]>(
    () => (esCotizacion ? COTIZACION_ESTATUS_EDITABLE_OPTIONS : statusOptions),
    [esCotizacion, statusOptions]
  );
  const effectiveColumnVisibilityModel = useMemo<GridColumnVisibilityModel>(
    () => ({
      ...columnVisibilityModel,
      menu: true,
      ...(esCotizacion ? { estatus_documento: true } : {}),
      actions: SHOW_GRID_ACTIONS,
    }),
    [columnVisibilityModel, esCotizacion]
  );
  const vendedoresPorId = useMemo(() => {
    const map = new Map<number, string>();
    vendedores.forEach((vendedor) => {
      if (typeof vendedor.id === 'number') {
        map.set(vendedor.id, vendedor.nombre || '');
      }
    });
    return map;
  }, [vendedores]);

  const calcularEstatusFinanciero = useCallback((saldo: number, total: number) => {
    const s = Number(saldo ?? 0);
    const t = Number(total ?? 0);
    if (s === 0) return 'Pagado';
    if (s < t) return 'Parcial';
    return 'Pendiente';
  }, []);

  useEffect(() => {
    if (!enableFilters) {
      setContactos([]);
      setVendedores([]);
      setQuickFilter('todos');
      setFiltrosCotizacion(FILTROS_COTIZACION_INICIALES);
      setFiltersOpen(false);
      return;
    }

    const loadFilterData = async () => {
      try {
        const [contactosData, vendedoresData] = await Promise.all([
          fetchContactos(contactoTiposPermitidos),
          showAgentFilter ? fetchVendedores() : Promise.resolve([]),
        ]);
        setContactos(contactosData);
        setVendedores(vendedoresData);
      } catch (err) {
        console.error('No se pudieron cargar datos para filtros de documentos', err);
      }
    };

    void loadFilterData();
  }, [contactoTiposPermitidos, enableFilters, showAgentFilter]);

  const requireAuthData = () => {
    if (!token || !empresaId) {
      setError('Token o empresa activa no disponibles. Inicia sesión de nuevo.');
      return false;
    }
    return true;
  };

  const loadOpcionesGeneracion = async (documentoId: number) => {
    const cached = opcionesGeneracion[documentoId];
    if (cached) {
      return cached;
    }

    setMenuLoading(true);
    try {
      const opciones = await getOpcionesGeneracion(documentoId, token!, empresaId!);
      setOpcionesGeneracion((prev) => ({ ...prev, [documentoId]: opciones }));
      return opciones;
    } finally {
      setMenuLoading(false);
    }
  };

  const openMenuGenerar = async (documentoId: number, options?: { anchorEl?: HTMLElement | null; anchorPosition?: { top: number; left: number } | null }) => {
    if (!requireAuthData()) return;

    setMenuDocumentoId(documentoId);
    setMenuAnchor(options?.anchorEl ?? null);
    setMenuAnchorPosition(options?.anchorPosition ?? null);

    try {
      const opciones = await loadOpcionesGeneracion(documentoId);
      if (!opciones || opciones.length === 0) {
        setMenuAnchor(null);
        setMenuAnchorPosition(null);
        setMenuDocumentoId(null);
        setSnackbar({ open: true, message: 'No hay opciones de generación para este documento', severity: 'info' });
      }
    } catch (err: any) {
      setMenuAnchor(null);
      setMenuAnchorPosition(null);
      setMenuDocumentoId(null);
      setSnackbar({ open: true, message: err?.message || 'No se pudieron cargar las opciones de generación', severity: 'error' });
    }
  };

  const handleOpenMenuGenerar = async (event: React.MouseEvent<HTMLElement>, documentoId: number) => {
    event.stopPropagation();
    await openMenuGenerar(documentoId, { anchorEl: event.currentTarget, anchorPosition: null });
  };

  const handleOpenMenuGenerarDesdeContexto = async (documentoId: number) => {
    closeGridContextMenu();
    await openMenuGenerar(documentoId, { anchorEl: null, anchorPosition: contextMenuPosition });
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuAnchorPosition(null);
    setMenuDocumentoId(null);
  };

  const closeEstatusMenu = () => {
    setEstatusMenu({ anchorEl: null, rowId: null, currentValue: 'borrador' });
  };

  const closeSeguimientoMenu = () => {
    setSeguimientoMenu({ anchorEl: null, rowId: null, currentValue: null });
  };

  const handlePrepararGeneracion = async (documentoId: number, tipoDestino: string) => {
    if (!requireAuthData()) return;
    closeMenu();
    setGeneracionDialog({
      open: true,
      loading: true,
      documentoId,
      documentoIds: [documentoId],
      tipoDestino,
      data: null,
      cantidades: {},
      tratamientoImpuestos: 'normal',
      enviando: false,
    });

    try {
      const data = await prepararGeneracion(documentoId, tipoDestino as any, token!, empresaId!);
      const cantidades = data.partidas.reduce<Record<number, number>>((acc, p) => {
        acc[p.partida_id] = p.cantidad_default ?? p.cantidad_pendiente_sugerida ?? 0;
        return acc;
      }, {});
      const tratamientoInicial = normalizarTratamiento(data.documento_origen?.tratamiento_impuestos);
      setGeneracionDialog({
        open: true,
        loading: false,
        documentoId,
        documentoIds: [documentoId],
        tipoDestino,
        data,
        cantidades,
        tratamientoImpuestos: tratamientoInicial,
        enviando: false,
      });
    } catch (err: any) {
      setGeneracionDialog({
        open: false,
        loading: false,
        documentoId: null,
        documentoIds: [],
        tipoDestino: null,
        data: null,
        cantidades: {},
        tratamientoImpuestos: 'normal',
        enviando: false,
      });
      setSnackbar({ open: true, message: err?.message || 'No se pudo preparar la generación', severity: 'error' });
    }
  };

  const contextMenuGenerationActions = useMemo<GridContextMenuAction[]>(() => {
    if (!contextMenuRow || !tieneOpcionesGeneracion) {
      return [];
    }

    const rowId = Number(contextMenuRow.id);
    const opciones = opcionesGeneracion[rowId];

    if (!opciones) {
      return menuLoading
        ? [
            {
              id: 'generacion-loading',
              label: 'Cargando opciones de generación...',
              icon: <CircularProgress size={16} />,
              disabled: true,
            },
          ]
        : [];
    }

    return opciones.map((op) => {
      const esDirectaSinPermiso = op.modo_autorizacion === 'directa' && op.usuario_puede_autorizar === false;
      let label = `Generar ${op.nombre || op.tipo_documento_destino}`;
      if (op.modo_autorizacion === 'directa') {
        label = `Autorizar y generar ${op.nombre || op.tipo_documento_destino}`;
      } else if (op.modo_autorizacion === 'flujo') {
        label = `Solicitar autorización para ${op.nombre || op.tipo_documento_destino}`;
      }
      return {
        id: `generar-${op.tipo_documento_destino}`,
        label,
        icon: <NoteAddIcon fontSize="small" />,
        disabled: loading || esDirectaSinPermiso,
        tooltip: esDirectaSinPermiso ? `Requiere rol: ${op.rol_requerido ?? 'Autorizador'}` : undefined,
        onClick: () => {
          void handlePrepararGeneracion(rowId, op.tipo_documento_destino);
        },
      };
    });
  }, [contextMenuRow, handlePrepararGeneracion, loading, menuLoading, opcionesGeneracion, tieneOpcionesGeneracion]);

  const handleOpenEstatusMenu = (event: React.MouseEvent<HTMLElement>, row: CotizacionListado) => {
    event.preventDefault();
    event.stopPropagation();
    if (esCotizacion && getCotizacionEstatusEditableOptions(row.estatus_documento).length === 0) {
      return;
    }
    setEstatusMenu({
      anchorEl: event.currentTarget,
      rowId: Number(row.id),
      currentValue: esCotizacion
        ? normalizeCotizacionEstatusDocumento(row.estatus_documento)
        : normalizeDocumentoEstatus(row.estatus_documento),
    });
  };

  const handleOpenSeguimientoMenu = (event: React.MouseEvent<HTMLElement>, row: CotizacionListado) => {
    event.preventDefault();
    event.stopPropagation();
    setSeguimientoMenu({
      anchorEl: event.currentTarget,
      rowId: Number(row.id),
      currentValue: normalizeEstadoSeguimiento(row.estado_seguimiento),
    });
  };

  const handleSeleccionarEstatus = async (nextValue: string) => {
    const rowId = estatusMenu.rowId;
    if (!rowId) return;

    if (estatusMenu.currentValue === nextValue) {
      closeEstatusMenu();
      return;
    }

    if (nextValue === 'cancelado') {
      closeEstatusMenu();
      const row = rows.find((r) => Number(r.id) === rowId);
      if (row) abrirDialogoCancelar(row);
      return;
    }

    try {
      setActualizandoEstatusId(rowId);
      const updated = await updateDocumento(rowId, tipoDocumento, {
        estatus_documento: esCotizacion ? formatCotizacionEstatusLabel(nextValue) : formatDocumentoEstatusLabel(nextValue),
      });
      let saldoActualizado: number | undefined;
      if (showSaldo) {
        const saldoData = await fetchSaldoDocumento(rowId).catch(() => null);
        if (saldoData) saldoActualizado = Number(saldoData.saldo ?? 0);
      }
      setRows((prev) => prev.map((row) => {
        if (row.id !== rowId) return row;
        const merged = { ...row, ...(updated as Partial<CotizacionListado>) };
        if (saldoActualizado !== undefined) merged.saldo = saldoActualizado;
        return merged;
      }));
      setSnackbar({ open: true, message: 'Estatus actualizado', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo actualizar el estatus', severity: 'error' });
    } finally {
      setActualizandoEstatusId(null);
      closeEstatusMenu();
    }
  };

  const handleSeleccionarSeguimiento = async (nextValue: EstadoSeguimiento) => {
    const rowId = seguimientoMenu.rowId;
    if (!rowId) return;

    if (seguimientoMenu.currentValue === nextValue) {
      closeSeguimientoMenu();
      return;
    }

    try {
      setActualizandoEstatusId(rowId);
      const updated = await updateDocumento(rowId, tipoDocumento, { estado_seguimiento: nextValue });
      setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...(updated as Partial<CotizacionListado>) } : row)));
      setSnackbar({ open: true, message: 'Seguimiento actualizado', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo actualizar el seguimiento', severity: 'error' });
    } finally {
      setActualizandoEstatusId(null);
      closeSeguimientoMenu();
    }
  };

  const handleSeleccionarOpcion = async (tipoDestino: string) => {
    if (!menuDocumentoId) return;
    await handlePrepararGeneracion(menuDocumentoId, tipoDestino);
  };

  const handlePrepararConsolidacionNotaCredito = async () => {
    if (!bulkNotaCreditoDestino || selectedDocumentIds.length < 2) return;
    if (!requireAuthData()) return;

    const selectedRows = rows.filter((row) => selectedDocumentIds.includes(Number(row.id)));
    if (selectedRows.length !== selectedDocumentIds.length) {
      setSnackbar({ open: true, message: 'La selección cambió. Recarga la lista e inténtalo de nuevo.', severity: 'warning' });
      return;
    }

    const contactoBase = selectedRows[0]?.contacto_principal_id ?? null;
    const monedaBase = String(selectedRows[0]?.moneda ?? '').trim().toUpperCase();
    const inactivo = selectedRows.find((row) => ['cancelado', 'cancelada'].includes(String(row.estatus_documento ?? '').trim().toLowerCase()));
    if (inactivo) {
      setSnackbar({ open: true, message: 'Solo se pueden consolidar documentos activos.', severity: 'warning' });
      return;
    }
    const distintoContacto = selectedRows.find((row) => (row.contacto_principal_id ?? null) !== contactoBase);
    if (distintoContacto) {
      setSnackbar({ open: true, message: 'La selección debe pertenecer al mismo cliente o proveedor.', severity: 'warning' });
      return;
    }
    const distintaMoneda = selectedRows.find((row) => String(row.moneda ?? '').trim().toUpperCase() !== monedaBase);
    if (distintaMoneda) {
      setSnackbar({ open: true, message: 'La selección debe usar la misma moneda.', severity: 'warning' });
      return;
    }

    setGeneracionDialog({
      open: true,
      loading: true,
      documentoId: selectedDocumentIds[0] ?? null,
      documentoIds: selectedDocumentIds,
      tipoDestino: bulkNotaCreditoDestino,
      data: null,
      cantidades: {},
      tratamientoImpuestos: 'normal',
      enviando: false,
    });

    try {
      const data = await prepararGeneracionMultiple(selectedDocumentIds, bulkNotaCreditoDestino as any, token!, empresaId!);
      const cantidades = data.partidas.reduce<Record<number, number>>((acc, p) => {
        acc[p.partida_id] = p.cantidad_default ?? p.cantidad_pendiente_sugerida ?? 0;
        return acc;
      }, {});
      const tratamientosOrigen = Array.from(new Set((data.documentos_origen ?? []).map((doc) => normalizarTratamiento(doc.tratamiento_impuestos))));
      const tratamientoInicial = tratamientosOrigen.length === 1 ? tratamientosOrigen[0] : normalizarTratamiento(data.documento_origen?.tratamiento_impuestos);
      setGeneracionDialog({
        open: true,
        loading: false,
        documentoId: selectedDocumentIds[0] ?? null,
        documentoIds: selectedDocumentIds,
        tipoDestino: bulkNotaCreditoDestino,
        data,
        cantidades,
        tratamientoImpuestos: tratamientoInicial,
        enviando: false,
      });
    } catch (err: any) {
      setGeneracionDialog({ open: false, loading: false, documentoId: null, documentoIds: [], tipoDestino: null, data: null, cantidades: {}, tratamientoImpuestos: 'normal', enviando: false });
      setSnackbar({ open: true, message: err?.message || 'No se pudo preparar la consolidación', severity: 'error' });
    }
  };

  const handleCantidadChange = (partidaId: number, value: string) => {
    const num = Number(value);
    setGeneracionDialog((prev) => ({
      ...prev,
      cantidades: { ...prev.cantidades, [partidaId]: Number.isNaN(num) ? 0 : num },
    }));
  };

  const completeGeneratedDocumentNavigation = useCallback((options: {
    documentoId: number;
    tipoDocumento: TipoDocumento;
    pathname?: string | null;
  }) => {
    navigateToGeneratedDocument(navigate, {
      documentoId: options.documentoId,
      tipoDocumento: options.tipoDocumento,
      pathname: options.pathname ?? location.pathname,
    });
  }, [location.pathname, navigate]);

  const handlePostGeneration = useCallback(async (options: {
    documentoOrigenId: number;
    result: {
      documento_destino_id: number;
      tipo_documento_destino: TipoDocumento;
    };
    pathname?: string | null;
  }) => {
    const { documentoOrigenId, result, pathname } = options;
    if (!['factura', 'factura_compra'].includes(String(result.tipo_documento_destino ?? ''))) {
      completeGeneratedDocumentNavigation({
        documentoId: result.documento_destino_id,
        tipoDocumento: result.tipo_documento_destino,
        pathname,
      });
      return;
    }

    try {
      const anticiposData = await fetchAnticiposDisponiblesDocumento(documentoOrigenId);
      if (Number(anticiposData?.total_disponible ?? 0) > 0) {
        setAplicarAnticiposDialog({
          open: true,
          documentoOrigenId,
          documentoDestinoId: result.documento_destino_id,
          documentoDestinoTipo: result.tipo_documento_destino,
          data: anticiposData,
          navigationPathname: pathname ?? location.pathname,
        });
        return;
      }
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err?.message || 'No se pudo verificar anticipos disponibles. Puedes aplicarlos manualmente más tarde.',
        severity: 'warning',
      });
    }

    completeGeneratedDocumentNavigation({
      documentoId: result.documento_destino_id,
      tipoDocumento: result.tipo_documento_destino,
      pathname,
    });
  }, [completeGeneratedDocumentNavigation, location.pathname]);

  const handleGenerar = async () => {
    if (!generacionDialog.data || !generacionDialog.tipoDestino) return;
    if (!requireAuthData()) return;

    const partidas = generacionDialog.data.partidas
      .map((p) => ({ partida_origen_id: p.partida_id, cantidad: generacionDialog.cantidades[p.partida_id] ?? 0 }))
      .filter((p) => p.cantidad > 0);

    if (partidas.length === 0) {
      setSnackbar({ open: true, message: 'Captura al menos una cantidad mayor a cero', severity: 'warning' });
      return;
    }

    const payload: GenerarDocumentoPayload = {
      ...(generacionDialog.documentoIds.length > 1
        ? { documento_origen_ids: generacionDialog.documentoIds }
        : { documento_origen_id: generacionDialog.documentoId ?? undefined }),
      tipo_documento_destino: generacionDialog.tipoDestino as any,
      datos_encabezado: {
        fecha: toCivilDate(),
        tratamiento_impuestos: generacionDialog.tratamientoImpuestos,
      },
      partidas,
    };

    try {
      setGeneracionDialog((prev) => ({ ...prev, enviando: true }));
      const result = await generarDocumentoDesdeOrigen(payload, token!, empresaId!);
      setGeneracionDialog({ open: false, loading: false, documentoId: null, documentoIds: [], tipoDestino: null, data: null, cantidades: {}, tratamientoImpuestos: 'normal', enviando: false });
      setSnackbar({ open: true, message: 'Documento generado correctamente', severity: 'success' });
      await handlePostGeneration({
        documentoOrigenId: generacionDialog.documentoId ?? generacionDialog.documentoIds[0] ?? 0,
        result,
        pathname: location.pathname,
      });
    } catch (err: any) {
      setGeneracionDialog({ open: false, loading: false, documentoId: null, documentoIds: [], tipoDestino: null, data: null, cantidades: {}, tratamientoImpuestos: 'normal', enviando: false });
      if (err instanceof AutorizacionRequeridaError) {
        setSnackbar({ open: true, message: err.message, severity: 'info' });
        void load();
        return;
      }
      if (err instanceof SinPermisoAutorizacionError) {
        const msg = err.rol_requerido ? `${err.message} Requiere rol: ${err.rol_requerido}.` : err.message;
        setSnackbar({ open: true, message: msg, severity: 'warning' });
        return;
      }
      setSnackbar({ open: true, message: err?.message || 'No se pudo generar el documento', severity: 'error' });
    }
  };

  const load = async () => {
    if (loadingPreferences) return;
    try {
      setLoading(true);
      const result = await getDocumentosPaginados(tipoDocumento, {
        page: page + 1,
        limit: pageSize,
        search: debouncedSearch || null,
        ...(isFacturaConSaldo && soloPendientes ? { soloPendientes: true } : {}),
        ...(quickFilter !== 'todos' ? { quickFilter } : {}),
        clienteId: filtrosCotizacion.clienteId,
        agenteId: filtrosCotizacion.agenteId,
        fechaDesde: filtrosCotizacion.fechaDesde || null,
        fechaHasta: filtrosCotizacion.fechaHasta || null,
        montoMin: filtrosCotizacion.montoMin || null,
        montoMax: filtrosCotizacion.montoMax || null,
      });
      setRows(result.data);
      setRowCount(result.total);
      setError(null);

      if (result.data && result.data.length > 0 && token && empresaId) {
        try {
          const firstId = Number((result.data?.[0] as any)?.id ?? (result.data?.[0] as any)?.documento_id ?? 0);
          if (firstId) {
            const opts = await getOpcionesGeneracion(firstId, token, empresaId);
            setTieneOpcionesGeneracion((opts?.length ?? 0) > 0);
          } else {
            setTieneOpcionesGeneracion(false);
          }
        } catch (err) {
          console.warn('No se pudieron obtener opciones de generación', err);
          setTieneOpcionesGeneracion(false);
        }
      } else {
        setTieneOpcionesGeneracion(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar documentos');
    } finally {
      setLoading(false);
    }
  };

  const formatFecha = (value: any) => formatCivilDate(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [tipoDocumento, debouncedSearch, soloPendientes, quickFilter, filtrosCotizacion]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoDocumento, page, pageSize, debouncedSearch, soloPendientes, quickFilter, filtrosCotizacion, loadingPreferences]);

  const obtenerEmailDocumento = (row: any) =>
    row?.contacto_email ?? row?.email_contacto ?? row?.cliente_email ?? row?.email_cliente ?? row?.email ?? '';

  const obtenerTelefonoDocumento = useCallback((row: any) => {
    const telefonoListado = row?.cliente_telefono ?? row?.telefono_cliente ?? row?.contacto_telefono ?? row?.telefono_contacto ?? row?.telefono ?? row?.celular ?? '';
    if (telefonoListado) {
      return telefonoListado;
    }

    const contactoPrincipalId = Number(row?.contacto_principal_id ?? 0);
    const contacto = contactos.find((item) => item.id === contactoPrincipalId);
    return (
      contacto?.telefono ??
      contacto?.telefono_secundario ??
      ''
    );
  }, [contactos]);

  const documentoWhatsappActual = useMemo(() => {
    if (!enviarWhatsappDialog.id) return null;

    const row = rows.find((item) => Number(item.id) === Number(enviarWhatsappDialog.id));
    if (!row) return null;

    const tipoDocumentoMeta = tiposDocumento.find((item) => item.codigo === tipoDocumento);
    return {
      id: Number(row.id),
      tipoDocumento,
      tipoDocumentoLabel: tipoDocumentoMeta?.nombre || textos.singular,
      folio: formatearFolioDocumento(row?.serie ?? '', Number(row?.numero ?? 0)) || String(row.id),
      cliente: row?.nombre_cliente || `Sin ${contactoLabelLower}`,
      total: row?.total ?? null,
      telefono: obtenerTelefonoDocumento(row),
      plantillaDefaultId: tipoDocumentoMeta?.whatsapp_plantilla_default_id ?? null,
    };
  }, [enviarWhatsappDialog.id, rows, tipoDocumento, tiposDocumento, textos.singular, obtenerTelefonoDocumento]);

  const abrirDialogoEnviarCotizacion = (row: CotizacionListado) => {
    const folio = formatearFolioDocumento(row?.serie ?? '', Number(row?.numero ?? 0));
    const emailInicial = obtenerEmailDocumento(row);
    const esCotizacion = tipoDocumento === 'cotizacion';
    const etiquetaDocumento = esCotizacion ? 'Cotizacion' : documentoTypeConfig.label;
    const textoDocumento = esCotizacion ? 'cotizacion' : documentoTypeConfig.textos.singular;
    setEnviarCotizacionDialog({
      open: true,
      id: Number(row.id),
      email: emailInicial,
      subject: `${etiquetaDocumento} ${folio}`,
      message: `Se adjunta la ${textoDocumento} ${folio}.`,
      enviando: false,
      error: emailInicial ? null : 'El cliente no tiene correo registrado. Captura uno para continuar.',
    });
  };

  const abrirDialogoCancelar = (row: CotizacionListado) => {
    setCancelarDialog({
      open: true,
      id: Number(row.id),
      motivoCancelacion: '',
      motivoSat: '02',
      uuidSustitucion: '',
      enviando: false,
      error: null,
    });
  };

  const cerrarDialogoCancelar = () => {
    if (cancelarDialog.enviando) return;
    setCancelarDialog({
      open: false,
      id: null,
      motivoCancelacion: '',
      motivoSat: '02',
      uuidSustitucion: '',
      enviando: false,
      error: null,
    });
  };

  const confirmarCancelacion = async () => {
    const documentoId = Number(cancelarDialog.id ?? 0);
    if (!Number.isFinite(documentoId) || documentoId <= 0) return;

    const esCfdi = hasAction('timbrar');
    const motivoSat = String(cancelarDialog.motivoSat ?? '').trim();
    const uuidSustitucion = String(cancelarDialog.uuidSustitucion ?? '').trim();
    if (esCfdi && motivoSat === '01' && !uuidSustitucion) {
      setCancelarDialog((prev) => ({ ...prev, error: 'El UUID de sustitución es obligatorio cuando el motivo SAT es 01.' }));
      return;
    }

    try {
      setCancelandoId(documentoId);
      setCancelarDialog((prev) => ({ ...prev, enviando: true, error: null }));

      await cancelarDocumento(documentoId, tipoDocumento, {
        motivo_cancelacion: cancelarDialog.motivoCancelacion.trim() || null,
        motivo_sat: esCfdi ? (motivoSat || null) : null,
        uuid_sustitucion: esCfdi ? (uuidSustitucion || null) : null,
      });

      cerrarDialogoCancelar();
      setSnackbar({ open: true, message: 'Documento cancelado correctamente', severity: 'success' });
      await load();
    } catch (err: any) {
      const message = err?.message || 'No se pudo cancelar el documento';
      setCancelarDialog((prev) => ({ ...prev, enviando: false, error: message }));
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setCancelandoId(null);
    }
  };

  const abrirDialogoProduccion = (row: CotizacionListado) => {
    setProduccionDialog({
      open: true,
      id: Number(row.id),
      fechaPromesa: toCivilDate(),
      comentarios: '',
      enviando: false,
      error: null,
    });
  };

  const abrirDrawerProduccion = useCallback(async (row: CotizacionListado) => {
    const documentoId = Number(row.id);
    const titulo = formatearFolioDocumento(row?.serie ?? '', Number(row?.numero ?? 0)) || String(documentoId);

    setProduccionDrawer({
      open: true,
      loading: true,
      documentoId,
      titulo,
      historial: [],
      error: null,
    });

    try {
      const historial = await getSeguimientoProduccionPorDocumento(documentoId);
      setProduccionDrawer((prev) => ({
        ...prev,
        loading: false,
        historial,
      }));
    } catch (err: any) {
      const message = err?.message || 'No se pudo cargar el historial de producción';
      setProduccionDrawer((prev) => ({
        ...prev,
        loading: false,
        historial: [],
        error: message,
      }));
    }
  }, []);

  const cerrarDrawerProduccion = useCallback(() => {
    setProduccionDrawer({ open: false, loading: false, documentoId: null, titulo: '', historial: [], error: null });
  }, []);

  const produccionActual = useMemo(
    () => produccionDrawer.historial.find((item) => item.activo) ?? produccionDrawer.historial[0] ?? null,
    [produccionDrawer.historial]
  );

  const pendingDeleteRow = pendingDeleteId
    ? rows.find((row) => Number(row.id) === Number(pendingDeleteId)) ?? null
    : null;

  const handleRequestDelete = useCallback(async (rowId: number) => {
    if (tipoDocumento !== 'cotizacion') {
      setPendingDeleteId(rowId);
      setConfirmOpen(true);
      return;
    }

    try {
      const validation = await validateDeleteDocumento(rowId, 'cotizacion');
      if (!validation.canDelete) {
        setDeleteBlockedDialog({
          open: true,
          message: validation.message || 'No se puede eliminar la cotización porque ya generó documentos posteriores.',
        });
        return;
      }

      setPendingDeleteId(rowId);
      setConfirmOpen(true);
    } catch (err: any) {
      setDeleteBlockedDialog({
        open: true,
        message: err?.message || 'No se pudo validar la eliminación de la cotización.',
      });
    }
  }, [tipoDocumento]);

  const handleDuplicarCotizacion = async (rowId: number) => {
    try {
      setLoading(true);
      const duplicated = await duplicateDocumento(rowId, 'cotizacion');
      navigate(`/ventas/cotizacion/${duplicated.id}`);
    } catch (err: any) {
      setError(err?.message || 'No se pudo duplicar la cotización');
    } finally {
      setLoading(false);
    }
  };

  const baseColumns: GridColDef[] = useMemo(() => {
    const columns: GridColDef[] = [
      {
        field: 'folio',
        headerName: 'Folio',
        width: 160,
        headerClassName: 'finanzas-header',
        renderCell: (params: any) =>
          formatearFolioDocumento(params?.row?.serie ?? '', Number(params?.row?.numero ?? 0)),
      },
      {
        field: 'fecha_documento',
        headerName: 'Fecha',
        width: 120,
        headerClassName: 'finanzas-header',
        renderCell: (params: any) => {
          const value = params?.row?.fecha_documento;
          return formatFecha(value);
        },
      },
      { field: 'nombre_cliente', headerName: contactoLabel, flex: 1, minWidth: 220, headerClassName: 'finanzas-header' },
      ...(esNotaCredito
        ? ([{
            field: 'motivo_nc',
            headerName: 'Motivo',
            width: 130,
            headerClassName: 'finanzas-header',
            renderCell: (params: any) => (
              <Typography variant="body2" noWrap sx={{ width: '100%', color: '#374151' }}>
                {formatMotivoNcLabel(params.row?.motivo_nc)}
              </Typography>
            ),
          }] as GridColDef[])
        : []),
      ...(esCotizacion
        ? ([{
            field: 'agente_id',
            headerName: 'Agente',
            width: 180,
            headerClassName: 'finanzas-header',
            valueGetter: (_value: any, row: CotizacionListado) => vendedoresPorId.get(Number(row.agente_id ?? 0)) || '',
            renderCell: (params: any) => {
              const agenteNombre = vendedoresPorId.get(Number(params.row?.agente_id ?? 0)) || '';
              return (
                <Typography variant="body2" noWrap sx={{ color: agenteNombre ? '#111827' : '#9ca3af', width: '100%' }}>
                  {agenteNombre || 'Sin asignar'}
                </Typography>
              );
            },
          }] as GridColDef[])
        : []),
      {
        field: 'subtotal',
        headerName: 'Subtotal',
        width: 140,
        align: 'right',
        headerAlign: 'right',
        headerClassName: 'finanzas-header',
        renderCell: (params: any) => currency.format(Number(params.row.subtotal ?? 0)),
      },
      {
        field: 'iva',
        headerName: 'IVA',
        width: 120,
        align: 'right',
        headerAlign: 'right',
        headerClassName: 'finanzas-header',
        renderCell: (params: any) => currency.format(Number(params.row.iva ?? 0)),
      },
      {
        field: 'total',
        headerName: 'Total',
        width: 140,
        align: 'right',
        headerAlign: 'right',
        headerClassName: 'finanzas-header',
        renderCell: (params: any) => currency.format(Number(params.row.total ?? 0)),
      },
      ...(esCotizacion
        ? ([{
            field: 'estado_seguimiento',
            headerName: 'Seguimiento',
            width: 150,
            headerClassName: 'finanzas-header',
            renderCell: (params: any) => {
              const config = getEstadoSeguimientoPresentation(params.row?.estado_seguimiento);
              return (
                <Chip
                  label={config.label}
                  size="small"
                  clickable
                  disabled={actualizandoEstatusId === Number(params.row?.id)}
                  onClick={(event) => handleOpenSeguimientoMenu(event, params.row as CotizacionListado)}
                  deleteIcon={<ArrowDropDownIcon sx={{ fontSize: 16, color: config.textColor }} />}
                  onDelete={(event) => handleOpenSeguimientoMenu(event as unknown as React.MouseEvent<HTMLElement>, params.row as CotizacionListado)}
                  sx={{
                    bgcolor: config.color,
                    color: config.textColor,
                    borderRadius: 1,
                    fontWeight: 700,
                    fontSize: 11,
                    height: 22,
                    px: 0.5,
                    cursor: 'pointer',
                  }}
                />
              );
            },
          }] as GridColDef[])
        : []),
      ...(showSaldo
        ? ([
            {
              field: 'saldo',
              headerName: 'Saldo',
              width: 140,
              align: 'right',
              headerAlign: 'right',
              headerClassName: 'finanzas-header',
              renderCell: ({ value }: any) => (
                <Box
                  sx={{
                    color: Number(value ?? 0) === 0 ? 'success.main' : 'error.main',
                    fontWeight: 600,
                  }}
                >
                  {currencyFormatter(value)}
                </Box>
              ),
            },
            {
              field: 'estatus_financiero',
              headerName: '',
              width: 50,
              headerClassName: 'finanzas-header',
              sortable: false,
              filterable: false,
              align: 'center',
              headerAlign: 'center',
              valueGetter: (params: any) => {
                const row = params?.row ?? {};
                const saldo = Number(row.saldo ?? 0);
                const total = Number(row.total ?? 0);
                return calcularEstatusFinanciero(saldo, total);
              },
              renderCell: (params: any) => {
                const row = params?.row ?? {};
                const saldo = Number(row.saldo ?? 0);
                const total = Number(row.total ?? 0);

                if (saldo === 0) return <CheckCircleIcon fontSize="small" color="success" />;
                if (saldo < total) return <DonutLargeIcon fontSize="small" color="warning" />;
                return <RadioButtonUncheckedIcon fontSize="small" color="disabled" />;
              },
            },
          ] as GridColDef[])
        : []),
      ...(tipoDocumento === 'orden_compra'
        ? ([{
            field: 'estado_recepcion',
            headerName: 'Recepción',
            width: 130,
            headerClassName: 'finanzas-header',
            sortable: false,
            renderCell: (params: any) => {
              const estado = String(params.row?.estado_recepcion ?? 'abierta');
              const cfg: Record<string, { label: string; bgcolor: string; color: string }> = {
                abierta: { label: 'Abierta',  bgcolor: '#f1f5f9', color: '#475569' },
                parcial: { label: 'Parcial',  bgcolor: '#fef3c7', color: '#92400e' },
                cerrada: { label: 'Cerrada',  bgcolor: '#dcfce7', color: '#166534' },
              };
              const { label, bgcolor, color } = cfg[estado] ?? cfg.abierta;
              return (
                <Chip
                  label={label}
                  size="small"
                  sx={{ height: 22, fontSize: '0.72rem', px: 0.75, borderRadius: 1.5,
                        bgcolor, color, fontWeight: 700 }}
                />
              );
            },
          }] as GridColDef[])
        : []),
      {
        field: 'estado_autorizacion',
        headerName: 'Autorización',
        width: 130,
        sortable: false,
        headerClassName: 'finanzas-header',
        renderCell: (params: any) => {
          const estado = params.row?.estado_autorizacion as string | null | undefined;
          if (!estado || estado === 'no_requerida') return null;
          const MAP: Record<string, { label: string; bgcolor: string; color: string }> = {
            pendiente: { label: 'Pendiente auth.', bgcolor: '#fef3c7', color: '#92400e' },
            aprobada:  { label: 'Autorizado',      bgcolor: '#dcfce7', color: '#166534' },
            rechazada: { label: 'Rechazado',        bgcolor: '#fee2e2', color: '#991b1b' },
          };
          const cfg = MAP[estado];
          if (!cfg) return null;
          return (
            <Chip label={cfg.label} size="small"
              sx={{ height: 22, fontSize: '0.72rem', px: 0.75, borderRadius: 1.5,
                    bgcolor: cfg.bgcolor, color: cfg.color, fontWeight: 700 }} />
          );
        },
      },
      {
        field: 'estatus_documento',
        headerName: 'Estatus',
        width: 140,
        headerClassName: 'finanzas-header',
        renderCell: (params: any) => {
          const estatus = params.row?.estatus_documento || 'Borrador';
          const cotizacionConfig = esCotizacion ? getCotizacionEstatusPresentation(estatus) : null;
          const canEdit = esCotizacion ? getCotizacionEstatusEditableOptions(estatus).length > 0 : true;
          return (
            <Chip
              label={esCotizacion ? cotizacionConfig?.label : formatDocumentoEstatusLabel(estatus)}
              size="small"
              color={esCotizacion ? undefined : (getDocumentoEstatusColor(estatus) as any)}
              clickable={canEdit}
              disabled={actualizandoEstatusId === Number(params.row?.id)}
              onClick={canEdit ? (event) => handleOpenEstatusMenu(event, params.row as CotizacionListado) : undefined}
              deleteIcon={canEdit ? <ArrowDropDownIcon sx={{ fontSize: 16, color: esCotizacion ? cotizacionConfig?.textColor : undefined }} /> : undefined}
              onDelete={canEdit ? (event) => handleOpenEstatusMenu(event as unknown as React.MouseEvent<HTMLElement>, params.row as CotizacionListado) : undefined}
              sx={{
                height: 22,
                fontSize: '0.72rem',
                px: 0.75,
                borderRadius: 1.5,
                cursor: canEdit ? 'pointer' : 'default',
                ...(esCotizacion
                  ? {
                      bgcolor: cotizacionConfig?.color,
                      color: cotizacionConfig?.textColor,
                    }
                  : {}),
              }}
            />
          );
        },
      },
    ];

    columns.push({
      field: 'actions',
      headerName: 'Acciones',
  width: esCotizacion ? 440 : 270,
      sortable: false,
      filterable: false,
      headerAlign: 'center',
      headerClassName: 'finanzas-header',
      align: 'center',
      renderCell: (params: GridRenderCellParams) => {
        const documentoPuedeTimbrarCfdi = puedeTimbrarCfdiDocumento(tipoDocumento, params.row as CotizacionListado);
        const facturaTimbrada = !documentoPuedeTimbrarCfdi || isFacturaTimbrada(params.row?.estatus_documento);
        const mensajeFacturaNoTimbrada = 'La factura debe estar timbrada antes de enviarse.';
        const estatusDocumentoNormalizado = String(params.row?.estatus_documento ?? '').trim().toLowerCase();
        const documentoCancelado = estatusDocumentoNormalizado === 'cancelado' || estatusDocumentoNormalizado === 'cancelada';

        return (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <IconButton size="small" color="primary" onClick={() => navigate(`${basePath}/${params.id}`)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            disabled={deletingId === params.row.id || loading}
            onClick={async (e) => {
              e.stopPropagation();
              await handleRequestDelete(params.row.id as number);
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
          {hasAction('duplicar') && (
            <Tooltip title="Duplicar cotización">
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  disabled={loading}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDuplicarCotizacion(Number(params.row.id));
                  }}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {hasAction('enviar_produccion') && (
            <Tooltip title="Enviar a producción">
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  disabled={loading}
                  onClick={(event) => {
                    event.stopPropagation();
                    abrirDialogoProduccion(params.row as CotizacionListado);
                  }}
                >
                  <PlaylistAddCheckIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {hasAction('ver_produccion') && (
            <Tooltip title="Ver producción">
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  disabled={loading}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void abrirDrawerProduccion(params.row as CotizacionListado);
                  }}
                >
                  <BuildIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {tieneOpcionesGeneracion && (
            <Tooltip title="Generar">
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  disabled={loading || menuLoading}
                  onClick={(e) => handleOpenMenuGenerar(e, Number(params.row.id))}
                >
                  <NoteAddIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Tooltip title="Ver / Imprimir PDF">
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                abrirDocumentoPdfEnNuevaVentana(Number(params.row.id), tipoDocumento)
                  .catch((err) => {
                    setError(err?.message || 'No se pudo generar el PDF');
                  });
              }}
            >
              <PrintIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Descargar PDF">
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                descargarDocumentoPdfEnNavegador(Number(params.row.id), tipoDocumento)
                  .catch((err) => {
                    setError(err?.message || 'No se pudo descargar el PDF');
                  });
              }}
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {hasAction('enviar_email') && tipoDocumentoPermiteCorreo && (
            <Tooltip title="Enviar por correo">
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  disabled={loading}
                  onClick={(event) => {
                    event.stopPropagation();
                    abrirDialogoEnviarCotizacion(params.row as CotizacionListado);
                  }}
                >
                  <EmailIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {hasAction('aplicar_pago') && (tipoDocumento === 'factura' || tipoDocumento === 'factura_compra') && (
            <Tooltip title={Number(params.row?.saldo ?? 0) > 0 ? 'Aplicar pago' : 'Documento sin saldo pendiente'}>
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  disabled={loading || Number(params.row?.saldo ?? 0) <= 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAplicarSaldoNcDrawer({
                      open: true,
                      documentoId: Number(params.row?.id ?? 0) || null,
                      contactoId: Number(params.row?.contacto_principal_id ?? 0) || null,
                      saldo: Number(params.row?.saldo ?? 0),
                      tipoDocumento,
                    });
                  }}
                >
                  <AccountBalanceWalletIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {(tipoDocumento === 'nota_credito' || tipoDocumento === 'nota_credito_compra') && Number(params.row?.saldo ?? 0) > 0 && String(params.row?.estatus_documento ?? '').toLowerCase() !== 'cancelado' && (
            <Tooltip title={Number(params.row?.contacto_principal_id ?? 0) > 0 ? 'Aplicar saldo' : 'Documento sin contacto principal'}>
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  disabled={loading || Number(params.row?.contacto_principal_id ?? 0) <= 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAplicarSaldoNcDrawer({
                      open: true,
                      documentoId: Number(params.row?.id ?? 0) || null,
                      contactoId: Number(params.row?.contacto_principal_id ?? 0) || null,
                      saldo: Number(params.row?.saldo ?? 0),
                      tipoDocumento,
                    });
                  }}
                >
                  <LinkIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {hasAction('timbrar') && documentoPuedeTimbrarCfdi && (
            <Tooltip title="Timbrar CFDI">
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  disabled={loading || timbrandoId === params.row.id}
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      setTimbrandoId(params.row.id as number);
                      await timbrarDocumentoCfdi(Number(params.row.id), tipoDocumento);
                      await load();
                      if (tipoDocumento === 'factura') {
                        const emailInicial = obtenerEmailDocumento(params.row);
                        setEnviarDialog({ open: true, id: Number(params.row.id), email: emailInicial, enviando: false, error: null });
                      }
                    } catch (err: any) {
                      setError(err?.message || 'No se pudo timbrar el documento');
                    } finally {
                      setTimbrandoId(null);
                    }
                  }}
                >
                  <ReceiptLongIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Tooltip title={documentoCancelado ? 'Documento ya cancelado' : 'Cancelar documento'}>
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={loading || documentoCancelado || cancelandoId === Number(params.row?.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  abrirDialogoCancelar(params.row as CotizacionListado);
                }}
              >
                <CancelIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          {hasAction('enviar_email') && tipoDocumento === 'factura' && (
            <Tooltip title={facturaTimbrada ? 'Enviar por correo' : mensajeFacturaNoTimbrada}>
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  disabled={loading || (documentoPuedeTimbrarCfdi && !facturaTimbrada)}
                  onClick={(e) => {
                    e.stopPropagation();
                    const emailInicial = obtenerEmailDocumento(params.row);
                    setEnviarDialog({ open: true, id: Number(params.row.id), email: emailInicial, enviando: false, error: null });
                  }}
                >
                  <EmailIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {hasAction('enviar_whatsapp') && tipoDocumentoPermiteWhatsapp && (
            <Tooltip title={documentoPuedeTimbrarCfdi && !facturaTimbrada ? mensajeFacturaNoTimbrada : 'Enviar por WhatsApp'}>
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  disabled={loading || (documentoPuedeTimbrarCfdi && !facturaTimbrada)}
                  onClick={(e) => {
                    e.stopPropagation();
                    console.info('[CFDI WhatsApp] Abrir modal de envio', {
                      documentoId: Number(params.row.id),
                      tipoDocumento,
                      folio: formatearFolioDocumento(params.row?.serie ?? '', Number(params.row?.numero ?? 0)) || String(params.row.id),
                    });
                    setEnviarWhatsappDialog({ open: true, id: Number(params.row.id) });
                  }}
                >
                  <WhatsAppIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Stack>
      );
      },
    });

    return columns;
  }, [
    currency,
    formatFecha,
    tipoDocumento,
    loading,
    timbrandoId,
    navigate,
    basePath,
    obtenerEmailDocumento,
    deletingId,
    load,
    setError,
    setPendingDeleteId,
    setConfirmOpen,
    actualizandoEstatusId,
    menuLoading,
    handleOpenMenuGenerar,
    handleOpenEstatusMenu,
    handleOpenSeguimientoMenu,
    showSaldo,
    currencyFormatter,
    calcularEstatusFinanciero,
    tieneOpcionesGeneracion,
    contactoLabel,
    contactoLabelLower,
    vendedoresPorId,
    abrirDialogoProduccion,
    abrirDialogoCancelar,
    abrirDrawerProduccion,
    esCotizacion,
    hasAction,
    cancelandoId,
  ]);

  const columns: GridColDef[] = useMemo(
    () => applySavedWidthsToColumns([contextMenuTriggerColumn, ...baseColumns]) as GridColDef[],
    [applySavedWidthsToColumns, baseColumns, contextMenuTriggerColumn]
  );

  const orderedColumns = useMemo(() => {
    if (!columnOrder.length) {
      return columns;
    }

    const map = new Map(columns.map((column) => [column.field, column]));
    const menuColumn = map.get('menu');
    const ordered = columnOrder
      .map((field) => map.get(field))
      .filter((column): column is GridColDef => Boolean(column && column.field !== 'menu'));
    const remaining = columns.filter((column) => !columnOrder.includes(column.field) && column.field !== 'menu');

    return [...(menuColumn ? [menuColumn] : []), ...ordered, ...remaining];
  }, [columnOrder, columns]);

  const filteredRows = rows;

  useEffect(() => {
    if (!canBulkDuplicate) {
      setSelectedDocumentIds([]);
      return;
    }

    const visibleIds = new Set(filteredRows.map((row) => Number(row.id)));
    setSelectedDocumentIds((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [canBulkDuplicate, filteredRows]);

  const gridContextMenuActions = useMemo<GridContextMenuAction[]>(() => {
    if (!contextMenuRow) return [];

    const rowId = Number(contextMenuRow.id);
    const documentoPuedeTimbrarCfdi = puedeTimbrarCfdiDocumento(tipoDocumento, contextMenuRow);
    const facturaTimbrada = !documentoPuedeTimbrarCfdi || isFacturaTimbrada(contextMenuRow?.estatus_documento);
    const canApplySaldoNc =
      (tipoDocumento === 'nota_credito' || tipoDocumento === 'nota_credito_compra') &&
      Number(contextMenuRow?.saldo ?? 0) > 0 &&
      String(contextMenuRow?.estatus_documento ?? '').toLowerCase() !== 'cancelado';
    const estatusDocumentoNormalizado = String(contextMenuRow?.estatus_documento ?? '').trim().toLowerCase();
    const documentoCancelado = estatusDocumentoNormalizado === 'cancelado' || estatusDocumentoNormalizado === 'cancelada';

    return [
      {
        id: 'editar',
        label: 'Editar',
        icon: <EditIcon fontSize="small" />,
        onClick: () => {
          setFocusedDocumentId(rowId);
          setHighlightedDocumentId(null);
          navigate(resolveDocumentoFormPath(tipoDocumento, rowId, modulo));
        },
      },
      {
        id: 'duplicar',
        label: 'Duplicar',
        icon: <ContentCopyIcon fontSize="small" />,
        hidden: !hasAction('duplicar'),
        disabled: loading,
        onClick: () => {
          void handleDuplicarCotizacion(rowId);
        },
      },
      {
        id: 'separator-workflow',
        type: 'separator',
      },
      ...contextMenuGenerationActions,
      {
        id: 'enviar-produccion',
        label: 'Enviar a producción',
        icon: <PlaylistAddCheckIcon fontSize="small" />,
        hidden: !hasAction('enviar_produccion'),
        disabled: loading,
        onClick: () => abrirDialogoProduccion(contextMenuRow),
      },
      {
        id: 'ver-produccion',
        label: 'Ver producción',
        icon: <BuildIcon fontSize="small" />,
        hidden: !hasAction('ver_produccion'),
        disabled: loading,
        onClick: () => {
          void abrirDrawerProduccion(contextMenuRow);
        },
      },
      {
        id: 'aplicar-pago',
        label: 'Aplicar pago',
        icon: <AccountBalanceWalletIcon fontSize="small" />,
        hidden: !(hasAction('aplicar_pago') && (tipoDocumento === 'factura' || tipoDocumento === 'factura_compra')),
        disabled: loading || Number(contextMenuRow?.saldo ?? 0) <= 0,
        onClick: () => {
          setAplicarSaldoNcDrawer({
            open: true,
            documentoId: rowId,
            contactoId: Number(contextMenuRow?.contacto_principal_id ?? 0) || null,
            saldo: Number(contextMenuRow?.saldo ?? 0),
            tipoDocumento,
          });
        },
      },
      {
        id: 'aplicar-saldo',
        label: 'Aplicar saldo',
        icon: <LinkIcon fontSize="small" />,
        hidden: !canApplySaldoNc,
        disabled: loading || Number(contextMenuRow?.contacto_principal_id ?? 0) <= 0,
        onClick: () => {
          setAplicarSaldoNcDrawer({
            open: true,
            documentoId: rowId,
            contactoId: Number(contextMenuRow?.contacto_principal_id ?? 0) || null,
            saldo: Number(contextMenuRow?.saldo ?? 0),
            tipoDocumento,
          });
        },
      },
      {
        id: 'separator-pdf',
        type: 'separator',
      },
      {
        id: 'ver-pdf',
        label: 'Ver / Imprimir PDF',
        icon: <PrintIcon fontSize="small" />,
        onClick: () => {
          abrirDocumentoPdfEnNuevaVentana(rowId, tipoDocumento).catch((err) => {
            setError(err?.message || 'No se pudo generar el PDF');
          });
        },
      },
      {
        id: 'descargar-pdf',
        label: 'Descargar PDF',
        icon: <DownloadIcon fontSize="small" />,
        onClick: () => {
          descargarDocumentoPdfEnNavegador(rowId, tipoDocumento).catch((err) => {
            setError(err?.message || 'No se pudo descargar el PDF');
          });
        },
      },
      {
        id: 'enviar-correo-cotizacion',
        label: 'Enviar por correo',
        icon: <EmailIcon fontSize="small" />,
        hidden: !(hasAction('enviar_email') && tipoDocumentoPermiteCorreo),
        disabled: loading,
        onClick: () => abrirDialogoEnviarCotizacion(contextMenuRow),
      },
      {
        id: 'enviar-correo-factura',
        label: 'Enviar por correo',
        icon: <EmailIcon fontSize="small" />,
        hidden: !(hasAction('enviar_email') && tipoDocumento === 'factura'),
        disabled: loading || (documentoPuedeTimbrarCfdi && !facturaTimbrada),
        onClick: () => {
          const emailInicial = obtenerEmailDocumento(contextMenuRow);
          setEnviarDialog({ open: true, id: rowId, email: emailInicial, enviando: false, error: null });
        },
      },
      {
        id: 'enviar-whatsapp',
        label: 'Enviar por WhatsApp',
        icon: <WhatsAppIcon fontSize="small" />,
        hidden: !(hasAction('enviar_whatsapp') && tipoDocumentoPermiteWhatsapp),
        disabled: loading || (documentoPuedeTimbrarCfdi && !facturaTimbrada),
        onClick: () => {
          console.info('[CFDI WhatsApp] Abrir modal de envio', {
            documentoId: rowId,
            tipoDocumento,
            folio: formatearFolioDocumento(contextMenuRow?.serie ?? '', Number(contextMenuRow?.numero ?? 0)) || String(rowId),
          });
          setEnviarWhatsappDialog({ open: true, id: rowId });
        },
      },
      {
        id: 'timbrar',
        label: 'Timbrar CFDI',
        icon: <NotificationsActiveIcon fontSize="small" />,
        hidden: !(hasAction('timbrar') && documentoPuedeTimbrarCfdi),
        disabled: loading || timbrandoId === contextMenuRow.id,
        onClick: async () => {
          try {
            setTimbrandoId(rowId);
            await timbrarDocumentoCfdi(rowId, tipoDocumento);
            await load();
            if (tipoDocumento === 'factura') {
              const emailInicial = obtenerEmailDocumento(contextMenuRow);
              setEnviarDialog({ open: true, id: rowId, email: emailInicial, enviando: false, error: null });
            }
          } catch (err: any) {
            setError(err?.message || 'No se pudo timbrar el documento');
          } finally {
            setTimbrandoId(null);
          }
        },
      },
      {
        id: 'cancelar-documento',
        label: 'Cancelar documento',
        icon: <CancelIcon fontSize="small" />,
        destructive: true,
        disabled: loading || documentoCancelado || cancelandoId === rowId,
        onClick: () => abrirDialogoCancelar(contextMenuRow),
      },
      {
        id: 'separator-danger',
        type: 'separator',
      },
      {
        id: 'eliminar',
        label: 'Eliminar',
        icon: <DeleteIcon fontSize="small" />,
        shortcut: 'Del',
        destructive: true,
        disabled: deletingId === contextMenuRow.id || loading,
        onClick: () => {
          void handleRequestDelete(rowId);
        },
      },
    ];
  }, [
    abrirDialogoEnviarCotizacion,
    abrirDialogoProduccion,
    abrirDrawerProduccion,
    basePath,
    contextMenuGenerationActions,
    contextMenuRow,
    deletingId,
    handleDuplicarCotizacion,
    handleRequestDelete,
    hasAction,
    load,
    loading,
    menuLoading,
    modulo,
    navigate,
    abrirDialogoCancelar,
    obtenerEmailDocumento,
    setError,
    timbrandoId,
    tipoDocumento,
    cancelandoId,
  ]);

  const resumenTotales = useMemo(() => {
    if (!enableFilters) {
      return null;
    }

    const sum = (items: CotizacionListado[]) => items.reduce((acc, row) => acc + Number(row[sumField] ?? 0), 0);
    const porEstado = Object.fromEntries(
      statusOptions.map((status) => {
        const rowsPorEstado = filteredRows.filter((row) => {
          const rawStatus = row[statusField];
          const normalizedStatus =
            statusField === 'estado_seguimiento'
              ? normalizeEstadoSeguimiento(rawStatus)
              : normalizeDocumentoEstatus(rawStatus);

          return normalizedStatus === status.value;
        });

        return [status.value, sum(rowsPorEstado)];
      })
    );

    return {
      general: sum(filteredRows),
      porEstado,
    };
  }, [enableFilters, filteredRows, statusField, statusOptions, sumField]);

  const filtrosActivosCount = useMemo(() => {
    if (!enableFilters) return 0;

    return [
      filtrosCotizacion.fechaDesde,
      filtrosCotizacion.fechaHasta,
      filtrosCotizacion.clienteId,
      showAgentFilter ? filtrosCotizacion.agenteId : null,
      filtrosCotizacion.montoMin,
      filtrosCotizacion.montoMax,
    ].filter((value) => value !== '' && value !== null).length;
  }, [enableFilters, filtrosCotizacion, showAgentFilter]);

  const hayFiltrosActivos = filtrosActivosCount > 0;

  const handleLimpiarFiltros = useCallback(() => {
    setFiltrosCotizacion(FILTROS_COTIZACION_INICIALES);
  }, []);

  const handleAplicarFiltros = useCallback(() => {
    setFiltersOpen(false);
  }, []);

  useEffect(() => {
    persistExternalFilters({
      search,
      soloPendientes,
      quickFilter,
      filtrosCotizacion,
    });
  }, [persistExternalFilters, search, soloPendientes, quickFilter, filtrosCotizacion]);

  useEffect(() => {
    if (!generatedDocumentFocus) return;

    const expectedPath = resolveDocumentosListPath(generatedDocumentFocus.tipoDocumento, generatedDocumentFocus.modulo);
    if (location.pathname !== expectedPath) {
      navigate(expectedPath, { replace: true, state: location.state });
      return;
    }

    if (generatedDocumentFocus.tipoDocumento !== tipoDocumento) {
      return;
    }

    if (consumedFocusNonceRef.current === generatedDocumentFocus.nonce) {
      return;
    }

    consumedFocusNonceRef.current = generatedDocumentFocus.nonce;
    setSearch('');
    setQuickFilter('todos');
    setSoloPendientes(false);
    setFiltrosCotizacion(FILTROS_COTIZACION_INICIALES);
    setFiltersOpen(false);
    setFocusedDocumentId(generatedDocumentFocus.documentoId);
    setHighlightedDocumentId(generatedDocumentFocus.documentoId);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [generatedDocumentFocus, location.pathname, location.search, location.state, navigate, tipoDocumento]);

  useEffect(() => {
    if (!highlightedDocumentId) return;

    const timeoutId = window.setTimeout(() => {
      setHighlightedDocumentId((current) => (current === highlightedDocumentId ? null : current));
    }, 3600);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedDocumentId]);

  useEffect(() => {
    if (loading || !focusedDocumentId) return;
    if (!filteredRows.some((row) => Number(row.id) === focusedDocumentId)) return;

    const frameId = window.requestAnimationFrame(() => {
      const rowElement = gridContainerRef.current?.querySelector(`[data-id="${focusedDocumentId}"]`) as HTMLElement | null;
      rowElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [filteredRows, focusedDocumentId, loading]);

  const handleDuplicarSeleccionados = async () => {
    if (!canBulkDuplicate || selectedDocumentIds.length === 0) return;

    try {
      setBulkDuplicating(true);
      const duplicated = await duplicateDocumentos(selectedDocumentIds, tipoDocumento);
      setSelectedDocumentIds([]);
      setSnackbar({
        open: true,
        message: `Se duplicaron ${duplicated.ids.length} documentos`,
        severity: 'success',
      });
      await load();
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err?.message || 'No se pudieron duplicar los documentos seleccionados',
        severity: 'error',
      });
    } finally {
      setBulkDuplicating(false);
    }
  };

  const filtersContent = enableFilters ? (
    <Stack spacing={1.25}>
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} alignItems={{ xs: 'stretch', lg: 'center' }} justifyContent="space-between">
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {[{ value: 'todos', label: 'Todos' }, ...statusOptions].map((item) => {
            const selected = quickFilter === item.value;
            return (
              <Chip
                key={item.value}
                label={item.label}
                clickable
                onClick={() => setQuickFilter(item.value)}
                size="small"
                variant={selected ? 'filled' : 'outlined'}
                sx={{
                  height: 28,
                  borderRadius: 1.5,
                  fontSize: 12,
                  fontWeight: selected ? 700 : 600,
                  px: 0.35,
                  color: selected ? '#1d2f68' : '#4b5563',
                  backgroundColor: selected ? '#e8eefc' : '#fff',
                  borderColor: selected ? '#9db1ea' : '#d1d5db',
                  '&:hover': {
                    backgroundColor: selected ? '#dce6fb' : '#f8fafc',
                  },
                  '& .MuiChip-label': {
                    px: 1.2,
                  },
                }}
              />
            );
          })}
        </Stack>

        <Badge color="primary" badgeContent={hayFiltrosActivos ? filtrosActivosCount : 0} invisible={!hayFiltrosActivos}>
          <Button
            variant={filtersOpen || hayFiltrosActivos ? 'contained' : 'outlined'}
            startIcon={<FilterAltOutlinedIcon />}
            endIcon={filtersOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setFiltersOpen((prev) => !prev)}
            sx={{
              alignSelf: { xs: 'flex-start', lg: 'center' },
              minWidth: 132,
              fontWeight: 700,
              textTransform: 'none',
              backgroundColor: filtersOpen || hayFiltrosActivos ? '#1d2f68' : undefined,
              '&:hover': {
                backgroundColor: filtersOpen || hayFiltrosActivos ? '#162551' : undefined,
              },
            }}
          >
            Filtrar
          </Button>
        </Badge>
      </Stack>

      <Collapse in={filtersOpen} timeout="auto" unmountOnExit={false}>
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 1.25, sm: 1.5 },
            borderRadius: 2,
            borderColor: '#dbe3f4',
            backgroundColor: '#f8fafc',
          }}
        >
          <Stack spacing={1.25}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1f2937' }}>
              Filtros avanzados
            </Typography>

            <Grid container spacing={1.25}>
              <Grid size={{ xs: 12, sm: 6, md: 4, xl: 2 }}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DatePicker
                    label="Fecha desde"
                    value={filtrosCotizacion.fechaDesde ? dayjs(filtrosCotizacion.fechaDesde) : null}
                    onChange={(value) => setFiltrosCotizacion((prev) => ({ ...prev, fechaDesde: value ? value.format('YYYY-MM-DD') : '' }))}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                        sx: compactFilterFieldSx,
                        InputLabelProps: { shrink: true },
                        InputProps: filtrosCotizacion.fechaDesde
                          ? {
                              endAdornment: (
                                <IconButton size="small" onClick={() => setFiltrosCotizacion((prev) => ({ ...prev, fechaDesde: '' }))}>
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              ),
                            }
                          : {},
                      },
                    }}
                  />
                </LocalizationProvider>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 4, xl: 2 }}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DatePicker
                    label="Fecha hasta"
                    value={filtrosCotizacion.fechaHasta ? dayjs(filtrosCotizacion.fechaHasta) : null}
                    onChange={(value) => setFiltrosCotizacion((prev) => ({ ...prev, fechaHasta: value ? value.format('YYYY-MM-DD') : '' }))}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                        sx: compactFilterFieldSx,
                        InputLabelProps: { shrink: true },
                        InputProps: filtrosCotizacion.fechaHasta
                          ? {
                              endAdornment: (
                                <IconButton size="small" onClick={() => setFiltrosCotizacion((prev) => ({ ...prev, fechaHasta: '' }))}>
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              ),
                            }
                          : {},
                      },
                    }}
                  />
                </LocalizationProvider>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
                <Autocomplete
                  size="small"
                  options={contactos}
                  value={contactos.find((contacto) => contacto.id === filtrosCotizacion.clienteId) ?? null}
                  onChange={(_, value) => setFiltrosCotizacion((prev) => ({ ...prev, clienteId: value?.id ?? null }))}
                  getOptionLabel={(option) => option?.nombre || ''}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      label={contactoLabel}
                      placeholder="Todos"
                      InputLabelProps={{ ...(params.InputLabelProps as any), shrink: true }}
                      sx={compactFilterFieldSx}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {filtrosCotizacion.clienteId ? (
                              <IconButton size="small" onClick={() => setFiltrosCotizacion((prev) => ({ ...prev, clienteId: null }))}>
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            ) : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  sx={{ width: '100%', ...compactFilterFieldSx }}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 4, xl: 2 }}>
                <TextField
                  size="small"
                  label="Monto mínimo"
                  type="number"
                  value={filtrosCotizacion.montoMin}
                  onChange={(e) => setFiltrosCotizacion((prev) => ({ ...prev, montoMin: e.target.value }))}
                  fullWidth
                  sx={compactFilterFieldSx}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: 0, step: 0.01 }}
                  InputProps={filtrosCotizacion.montoMin ? {
                    endAdornment: (
                      <IconButton size="small" onClick={() => setFiltrosCotizacion((prev) => ({ ...prev, montoMin: '' }))}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    ),
                  } : {}}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 4, xl: 2 }}>
                <TextField
                  size="small"
                  label="Monto máximo"
                  type="number"
                  value={filtrosCotizacion.montoMax}
                  onChange={(e) => setFiltrosCotizacion((prev) => ({ ...prev, montoMax: e.target.value }))}
                  fullWidth
                  sx={compactFilterFieldSx}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: 0, step: 0.01 }}
                  InputProps={filtrosCotizacion.montoMax ? {
                    endAdornment: (
                      <IconButton size="small" onClick={() => setFiltrosCotizacion((prev) => ({ ...prev, montoMax: '' }))}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    ),
                  } : {}}
                />
              </Grid>

              {showAgentFilter && (
                <Grid size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
                  <Autocomplete
                    fullWidth
                    options={vendedores}
                    loading={loading && vendedores.length === 0}
                    getOptionLabel={(option) => option.nombre || ''}
                    value={vendedores.find((contacto) => contacto.id === filtrosCotizacion.agenteId) || null}
                    onChange={(_, value) => setFiltrosCotizacion((prev) => ({ ...prev, agenteId: value?.id ?? null }))}
                    renderOption={(props, option) => {
                      const { key, ...rest } = props;
                      return (
                        <li {...rest} key={option.id ?? key}>
                          {option.nombre || ''}
                        </li>
                      );
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...(params as any)}
                        fullWidth
                        label="Agente de ventas"
                        size="small"
                        InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                        inputProps={{ ...params.inputProps }}
                        sx={compactFilterFieldSx}
                      />
                    )}
                  />
                </Grid>
              )}
            </Grid>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
              <Button variant="text" onClick={handleLimpiarFiltros}>
                Limpiar
              </Button>
              <Button variant="contained" onClick={handleAplicarFiltros} sx={{ backgroundColor: '#1d2f68', '&:hover': { backgroundColor: '#162551' } }}>
                Aplicar filtros
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Collapse>
    </Stack>
  ) : null;

  const summaryContent = enableFilters && resumenTotales ? (
    <Box
      sx={{
        display: 'grid',
        gap: 1,
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
          lg: 'repeat(6, minmax(0, 1fr))',
        },
      }}
    >
      {[
        { label: 'Total general', value: resumenTotales.general, color: '#2563eb' },
        ...statusOptions.map((status) => ({
          label: status.label,
          value: Number(resumenTotales.porEstado[status.value] ?? 0),
          color: status.textColor || '#374151',
        })),
      ].map((item) => (
        <Paper
          key={item.label}
          variant="outlined"
          sx={{
            px: 1,
            py: 0.8,
            borderRadius: 1.5,
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
          }}
        >
          <Typography sx={{ color: '#6b7280', fontWeight: 700, mb: 0.2, fontSize: 12.5, lineHeight: 1.2 }}>
            {item.label}
          </Typography>
          <Typography sx={{ color: item.color, fontWeight: 800, lineHeight: 1.1, fontSize: { xs: 16, sm: 17, lg: 18 } }}>
            {currency.format(item.value)}
          </Typography>
        </Paper>
      ))}
    </Box>
  ) : null;

  const selectionContent = canBulkDuplicate && selectedDocumentIds.length > 0 ? (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        px: 2,
        py: 1.25,
        display: 'flex',
        alignItems: { xs: 'stretch', sm: 'center' },
        justifyContent: 'space-between',
        gap: 1,
        flexDirection: { xs: 'column', sm: 'row' },
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700, color: '#1f2937' }}>
        {selectedDocumentIds.length} documento{selectedDocumentIds.length === 1 ? '' : 's'} seleccionado{selectedDocumentIds.length === 1 ? '' : 's'}
      </Typography>
      <Stack direction="row" spacing={1}>
        <Button variant="text" onClick={() => setSelectedDocumentIds([])} disabled={bulkDuplicating}>
          Limpiar selección
        </Button>
        {bulkNotaCreditoDestino && selectedDocumentIds.length > 1 && (
          <Button
            variant="outlined"
            startIcon={<ReceiptLongIcon />}
            onClick={() => {
              void handlePrepararConsolidacionNotaCredito();
            }}
          >
            Consolidar nota de crédito
          </Button>
        )}
        <Button
          variant="contained"
          startIcon={<ContentCopyIcon />}
          onClick={() => {
            void handleDuplicarSeleccionados();
          }}
          disabled={bulkDuplicating}
          sx={{ backgroundColor: '#1d2f68', '&:hover': { backgroundColor: '#162551' } }}
        >
          Duplicar seleccionados
        </Button>
      </Stack>
    </Paper>
  ) : null;

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const exportColumns = orderedColumns
        .filter(
          (col) =>
            col.field !== 'menu' &&
            col.field !== 'actions' &&
            effectiveColumnVisibilityModel[col.field] !== false
        )
        .map((col) => ({ field: col.field, headerName: String(col.headerName ?? col.field) }));
      await exportarDocumentos({
        filters: {
          tipo_documento: tipoDocumento,
          search: debouncedSearch || null,
          soloPendientes,
          quickFilter,
          clienteId: filtrosCotizacion.clienteId,
          agenteId: filtrosCotizacion.agenteId,
          fechaDesde: filtrosCotizacion.fechaDesde || null,
          fechaHasta: filtrosCotizacion.fechaHasta || null,
          montoMin: filtrosCotizacion.montoMin || null,
          montoMax: filtrosCotizacion.montoMax || null,
        },
        columns: exportColumns,
      });
    } catch (err) {
      setSnackbar({ open: true, message: err instanceof Error ? err.message : 'No se pudo exportar', severity: 'error' });
    } finally {
      setExportLoading(false);
    }
  };

  const extraActionsContent = (
    <Stack direction="row" spacing={1}>
      {esFacturaVentas && (
        <Button
          variant="outlined"
          startIcon={<ReceiptLongIcon />}
          onClick={() => setOpenFacturaGlobal(true)}
        >
          Factura global
        </Button>
      )}
      <Button
        variant="outlined"
        startIcon={exportLoading ? <CircularProgress size={14} /> : <DownloadIcon />}
        onClick={() => void handleExport()}
        disabled={exportLoading}
      >
        Exportar
      </Button>
    </Stack>
  );

  const desktopView = (
    <DocumentosDesktopView
      title={textos.titulo}
      description={textos.descripcion}
      searchTerm={search}
      onSearchTermChange={setSearch}
      onClearSearch={() => setSearch('')}
      onRefresh={load}
      onCreateDocumento={() => navigate(`${basePath}/nuevo`)}
      isLoading={loading || loadingPreferences}
      showPendingToggle={isFacturaConSaldo}
      soloPendientes={soloPendientes}
      onSoloPendientesChange={setSoloPendientes}
      filtersContent={filtersContent}
      summaryContent={summaryContent}
      selectionContent={selectionContent}
      extraActionsContent={extraActionsContent}
      rows={filteredRows}
      columns={orderedColumns}
      canBulkDuplicate={canBulkDuplicate}
      selectedDocumentIds={selectedDocumentIds}
      onSelectedDocumentIdsChange={setSelectedDocumentIds}
      onCellClick={(params, event) => {
        if (params.field !== 'estatus_documento' && params.field !== 'estado_seguimiento') return;
        (event as any).defaultMuiPrevented = true;
        event.preventDefault();
        event.stopPropagation();
        if (params.field === 'estatus_documento') {
          handleOpenEstatusMenu(event as unknown as React.MouseEvent<HTMLElement>, params.row as CotizacionListado);
          return;
        }
        if (params.field === 'estado_seguimiento' && esCotizacion) {
          handleOpenSeguimientoMenu(event as unknown as React.MouseEvent<HTMLElement>, params.row as CotizacionListado);
          return;
        }
        if (params.field === 'actions') {
          return;
        }
      }}
      onRowClick={(params: GridRowParams, event) => {
        if ((event as any).defaultMuiPrevented) return;
        setFocusedDocumentId(Number(params.id));
        setHighlightedDocumentId(null);
        navigate(resolveDocumentoFormPath(tipoDocumento, params.id, modulo));
      }}
      slotProps={gridContextMenuRowSlotProps ? { row: gridContextMenuRowSlotProps } : undefined}
      getRowClassName={(params) => {
        const rowId = Number(params.id);
        const classNames = [];

        if (rowId === focusedDocumentId) {
          classNames.push('documento-focus-row');
        }

        if (rowId === highlightedDocumentId) {
          classNames.push('documento-focus-row--recent');
        }

        return classNames.join(' ');
      }}
      columnVisibilityModel={effectiveColumnVisibilityModel}
      sortModel={sortModel as GridSortModel}
      onSortModelChange={setSortModel}
      onColumnVisibilityModelChange={(model) => {
        const nextModel = {
          ...model,
          menu: true,
          ...(esCotizacion ? { estatus_documento: true } : {}),
          actions: SHOW_GRID_ACTIONS,
        };
        setColumnVisibilityModel(nextModel);
      }}
      onColumnWidthChange={(params: GridColumnResizeParams) => {
        setColumnWidths((prev) => ({ ...prev, [params.colDef.field]: params.width }));
      }}
      onColumnOrderChange={({ column, targetIndex }) => {
        setColumnOrder((prev) => {
          const seed = prev.length ? prev : orderedColumns.map((item) => item.field);
          const next = seed.filter((field) => field !== column.field);
          next.splice(targetIndex, 0, column.field);
          return next;
        });
      }}
      contextMenuActions={gridContextMenuActions}
      contextMenuPosition={contextMenuPosition}
      contextMenuOpen={Boolean(contextMenuRow)}
      onCloseContextMenu={closeGridContextMenu}
      rowCount={rowCount}
      paginationModel={{ page, pageSize }}
      onPaginationModelChange={(model) => {
        if (model.pageSize !== pageSize) {
          setPageSize(Math.min(model.pageSize, 100));
          setPage(0);
        } else {
          setPage(model.page);
        }
      }}
    />
  );

  const mobileView = (
    <DocumentosMobileView
      title={textos.titulo}
      description={textos.descripcion}
      searchTerm={search}
      onSearchTermChange={setSearch}
      onClearSearch={() => setSearch('')}
      onRefresh={load}
      onCreateDocumento={() => navigate(`${basePath}/nuevo`)}
      isLoading={loading}
      showPendingToggle={isFacturaConSaldo}
      soloPendientes={soloPendientes}
      onSoloPendientesChange={setSoloPendientes}
      filtersContent={filtersContent}
      summaryContent={summaryContent}
      selectionContent={selectionContent}
      extraActionsContent={extraActionsContent}
      rows={filteredRows}
      canBulkDuplicate={canBulkDuplicate}
      selectedDocumentIds={selectedDocumentIds}
      onSelectedDocumentIdsChange={setSelectedDocumentIds}
      onOpenDocumento={(id) => {
        setFocusedDocumentId(Number(id));
        setHighlightedDocumentId(null);
        navigate(resolveDocumentoFormPath(tipoDocumento, id, modulo));
      }}
      onOpenContextMenu={openContextMenuForRow}
      contextMenuActions={gridContextMenuActions}
      contextMenuPosition={contextMenuPosition}
      contextMenuOpen={Boolean(contextMenuRow)}
      onCloseContextMenu={closeGridContextMenu}
      formatFolio={(row) => formatearFolioDocumento(row?.serie ?? '', Number(row?.numero ?? 0)) || String(row.id)}
      formatDate={formatCivilDate}
      currency={currency}
    />
  );

  return (
    <>
      {isMobile ? (
        <Container maxWidth={false} sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
            {mobileView}
          </Box>
        </Container>
      ) : desktopView}

      <Dialog open={Boolean(error)} onClose={() => setError(null)} fullWidth maxWidth="xs">
        <DialogTitle>Error</DialogTitle>
        <DialogContent>
          <DialogContentText>{error}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setError(null)}>
            ENTENDIDO
          </Button>
        </DialogActions>
      </Dialog>

      <Menu
        anchorEl={estatusMenu.anchorEl}
        open={Boolean(estatusMenu.anchorEl)}
        onClose={closeEstatusMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {estatusDocumentoOptions.map((status) => (
          <MenuItem
            key={status.value}
            selected={estatusMenu.currentValue === status.value}
            disabled={actualizandoEstatusId !== null}
            onClick={() => void handleSeleccionarEstatus(status.value)}
          >
            {status.label}
          </MenuItem>
        ))}
      </Menu>

      {esCotizacion && (
        <Menu
          anchorEl={seguimientoMenu.anchorEl}
          open={Boolean(seguimientoMenu.anchorEl)}
          onClose={closeSeguimientoMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          {ESTADOS_SEGUIMIENTO.map((estado) => (
            <MenuItem
              key={estado.value}
              selected={seguimientoMenu.currentValue === estado.value}
              disabled={actualizandoEstatusId !== null}
              onClick={() => void handleSeleccionarSeguimiento(estado.value)}
            >
              {estado.label}
            </MenuItem>
          ))}
        </Menu>
      )}

      <Menu
        anchorEl={menuAnchor}
        anchorReference={menuAnchorPosition ? 'anchorPosition' : 'anchorEl'}
        {...(menuAnchorPosition ? { anchorPosition: menuAnchorPosition } : {})}
        open={Boolean(menuAnchor) || Boolean(menuAnchorPosition)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {menuLoading && (
          <MenuItem disabled>
            <ListItemIcon>
              <CircularProgress size={16} />
            </ListItemIcon>
            <ListItemText primary="Cargando opciones..." />
          </MenuItem>
        )}
        {!menuLoading && menuDocumentoId != null && (opcionesGeneracion[menuDocumentoId] || []).map((op) => (
          <MenuItem key={op.tipo_documento_destino} onClick={() => handleSeleccionarOpcion(op.tipo_documento_destino)}>
            <ListItemText primary={op.nombre || op.tipo_documento_destino} />
          </MenuItem>
        ))}
      </Menu>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <AlertSnackbar
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </AlertSnackbar>
      </Snackbar>

      <AnticiposAplicacionDialog
        open={aplicarAnticiposDialog.open}
        documentoOrigenId={aplicarAnticiposDialog.documentoOrigenId}
        documentoDestinoId={aplicarAnticiposDialog.documentoDestinoId}
        documentoDestinoTipo={aplicarAnticiposDialog.documentoDestinoTipo}
        initialData={aplicarAnticiposDialog.data}
        onClose={() => {
          const targetId = aplicarAnticiposDialog.documentoDestinoId;
          const targetType = aplicarAnticiposDialog.documentoDestinoTipo;
          const pathname = aplicarAnticiposDialog.navigationPathname;
          setAplicarAnticiposDialog({ open: false, documentoOrigenId: null, documentoDestinoId: null, documentoDestinoTipo: null, data: null, navigationPathname: null });
          if (targetId && targetType) {
            completeGeneratedDocumentNavigation({ documentoId: targetId, tipoDocumento: targetType, pathname });
          }
        }}
        onSkip={() => {
          const targetId = aplicarAnticiposDialog.documentoDestinoId;
          const targetType = aplicarAnticiposDialog.documentoDestinoTipo;
          const pathname = aplicarAnticiposDialog.navigationPathname;
          setAplicarAnticiposDialog({ open: false, documentoOrigenId: null, documentoDestinoId: null, documentoDestinoTipo: null, data: null, navigationPathname: null });
          if (targetId && targetType) {
            completeGeneratedDocumentNavigation({ documentoId: targetId, tipoDocumento: targetType, pathname });
          }
        }}
        onApplied={() => {
          const targetId = aplicarAnticiposDialog.documentoDestinoId;
          const targetType = aplicarAnticiposDialog.documentoDestinoTipo;
          const pathname = aplicarAnticiposDialog.navigationPathname;
          setSnackbar({ open: true, message: 'Anticipos aplicados correctamente', severity: 'success' });
          setAplicarAnticiposDialog({ open: false, documentoOrigenId: null, documentoDestinoId: null, documentoDestinoTipo: null, data: null, navigationPathname: null });
          if (targetId && targetType) {
            completeGeneratedDocumentNavigation({ documentoId: targetId, tipoDocumento: targetType, pathname });
          }
        }}
      />

      {aplicarSaldoNcDrawer.open && aplicarSaldoNcDrawer.documentoId && aplicarSaldoNcDrawer.contactoId && aplicarSaldoNcDrawer.tipoDocumento ? (
        <FacturaPagosDrawer
          open={aplicarSaldoNcDrawer.open}
          onClose={() => { setAplicarSaldoNcDrawer({ open: false, documentoId: null, contactoId: null, saldo: 0, tipoDocumento: null }); void load(); }}
          documentoId={aplicarSaldoNcDrawer.documentoId}
          contactoId={aplicarSaldoNcDrawer.contactoId}
          saldo={aplicarSaldoNcDrawer.saldo}
          tipoDocumento={aplicarSaldoNcDrawer.tipoDocumento}
        />
      ) : null}

      <Dialog
        open={generacionDialog.open}
        onClose={() => !generacionDialog.enviando && setGeneracionDialog({ open: false, loading: false, documentoId: null, documentoIds: [], tipoDestino: null, data: null, cantidades: {}, tratamientoImpuestos: 'normal', enviando: false })}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Generar documento</DialogTitle>
        <DialogContent>
          {generacionDialog.loading || !generacionDialog.data ? (
            <Stack alignItems="center" justifyContent="center" py={3} spacing={1}>
              <CircularProgress size={22} />
              <Typography variant="body2" color="text.secondary">
                Preparando información...
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Origen: {generacionDialog.data.es_consolidado
                  ? `${generacionDialog.data.documentos_origen.length} documentos consolidados`
                  : (generacionDialog.data.documento_origen?.folio || generacionDialog.data.documento_origen?.documento_id)} · Destino: {generacionDialog.tipoDestino}
              </Typography>
              <TextField
                select
                label="Tratamiento fiscal"
                size="small"
                value={generacionDialog.tratamientoImpuestos}
                onChange={(event) => setGeneracionDialog((prev) => ({
                  ...prev,
                  tratamientoImpuestos: normalizarTratamiento(event.target.value),
                }))}
              >
                {TRATAMIENTO_OPCIONES.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {generacionDialog.data.es_consolidado && <TableCell>Documento origen</TableCell>}
                    <TableCell>Producto</TableCell>
                    <TableCell align="right">Cant. origen</TableCell>
                    <TableCell align="right">Pendiente</TableCell>
                    <TableCell align="right">Cantidad a generar</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {generacionDialog.data.partidas.map((p) => (
                    <TableRow key={p.partida_id} hover>
                      {generacionDialog.data.es_consolidado && <TableCell>{p.documento_origen_folio || p.documento_origen_id}</TableCell>}
                      <TableCell>{p.descripcion || `Producto ${p.producto_id ?? ''}`}</TableCell>
                      <TableCell align="right">{p.cantidad_origen}</TableCell>
                      <TableCell align="right">{p.cantidad_pendiente_sugerida}</TableCell>
                      <TableCell align="right" sx={{ minWidth: 140 }}>
                        <TextField
                          size="small"
                          type="number"
                          inputProps={{ min: 0, step: 'any' }}
                          value={generacionDialog.cantidades[p.partida_id] ?? ''}
                          onChange={(e) => handleCantidadChange(p.partida_id, e.target.value)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setGeneracionDialog({ open: false, loading: false, documentoId: null, documentoIds: [], tipoDestino: null, data: null, cantidades: {}, tratamientoImpuestos: 'normal', enviando: false })}
            disabled={generacionDialog.enviando}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleGenerar}
            disabled={generacionDialog.enviando || generacionDialog.loading}
            startIcon={generacionDialog.enviando ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {generacionDialog.enviando ? 'Generando...' : 'Generar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={enviarDialog.open}
        onClose={() => !enviarDialog.enviando && setEnviarDialog({ open: false, id: null, email: '', enviando: false, error: null })}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Enviar factura por correo</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <DialogContentText sx={{ mb: 2 }}>Ingresa o ajusta el correo del cliente antes de enviar.</DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Correo electrónico"
            type="email"
            value={enviarDialog.email}
            onChange={(e) => setEnviarDialog((prev) => ({ ...prev, email: e.target.value, error: null }))}
            error={Boolean(enviarDialog.error)}
            helperText={enviarDialog.error || ' '}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setEnviarDialog({ open: false, id: null, email: '', enviando: false, error: null })}
            disabled={enviarDialog.enviando}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              const email = enviarDialog.email.trim();
              if (!email) {
                setEnviarDialog((prev) => ({ ...prev, error: 'El correo es obligatorio' }));
                return;
              }
              try {
                setEnviarDialog((prev) => ({ ...prev, enviando: true, error: null }));
                await enviarFactura(Number(enviarDialog.id), email);
                setSnackbar({ open: true, message: 'Factura enviada correctamente', severity: 'success' });
                setEnviarDialog({ open: false, id: null, email: '', enviando: false, error: null });
              } catch (err: any) {
                const msg = err?.message || 'No se pudo enviar la factura';
                setEnviarDialog((prev) => ({ ...prev, enviando: false, error: msg }));
                setSnackbar({ open: true, message: msg, severity: 'error' });
              }
            }}
            disabled={enviarDialog.enviando}
            startIcon={enviarDialog.enviando ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {enviarDialog.enviando ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={cancelarDialog.open} onClose={cerrarDialogoCancelar} fullWidth maxWidth="sm">
        <DialogTitle>Cancelar documento</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <DialogContentText>
              Captura los datos de cancelación para enviar la solicitud.
            </DialogContentText>
            <TextField
              autoFocus
              fullWidth
              label="Motivo de cancelación"
              multiline
              minRows={3}
              value={cancelarDialog.motivoCancelacion}
              onChange={(event) => setCancelarDialog((prev) => ({ ...prev, motivoCancelacion: event.target.value, error: null }))}
            />
            {hasAction('timbrar') && (
              <>
                <TextField
                  select
                  fullWidth
                  label="Motivo SAT"
                  value={cancelarDialog.motivoSat}
                  onChange={(event) => setCancelarDialog((prev) => ({ ...prev, motivoSat: event.target.value, error: null }))}
                >
                  <MenuItem value="01">01 - Comprobante emitido con errores con relación</MenuItem>
                  <MenuItem value="02">02 - Comprobante emitido con errores sin relación</MenuItem>
                  <MenuItem value="03">03 - No se llevó a cabo la operación</MenuItem>
                  <MenuItem value="04">04 - Operación nominativa relacionada en factura global</MenuItem>
                </TextField>
                {cancelarDialog.motivoSat === '01' && (
                  <TextField
                    fullWidth
                    label="UUID sustitución"
                    value={cancelarDialog.uuidSustitucion}
                    onChange={(event) => setCancelarDialog((prev) => ({ ...prev, uuidSustitucion: event.target.value, error: null }))}
                    error={Boolean(cancelarDialog.error)}
                    helperText={cancelarDialog.error || 'Obligatorio cuando el motivo SAT es 01'}
                  />
                )}
                {cancelarDialog.motivoSat !== '01' && cancelarDialog.error ? (
                  <Alert severity="error" variant="outlined">{cancelarDialog.error}</Alert>
                ) : null}
              </>
            )}
            {!hasAction('timbrar') && cancelarDialog.error ? (
              <Alert severity="error" variant="outlined">{cancelarDialog.error}</Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={cerrarDialogoCancelar} disabled={cancelarDialog.enviando}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              void confirmarCancelacion();
            }}
            disabled={cancelarDialog.enviando}
            startIcon={cancelarDialog.enviando ? <CircularProgress size={16} color="inherit" /> : <CancelIcon fontSize="small" />}
          >
            {cancelarDialog.enviando ? 'Cancelando...' : 'Cancelar documento'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={enviarCotizacionDialog.open}
        onClose={() => !enviarCotizacionDialog.enviando && setEnviarCotizacionDialog({ open: false, id: null, email: '', subject: '', message: '', enviando: false, error: null })}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{tipoDocumento === 'orden_servicio' ? 'Enviar orden de servicio por correo' : 'Enviar cotización por correo'}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <DialogContentText>
              {tipoDocumento === 'orden_servicio'
                ? 'Confirma el correo del cliente y ajusta el mensaje antes de enviar la orden de servicio en PDF.'
                : 'Confirma el correo del cliente y ajusta el mensaje antes de enviar la cotización en PDF.'}
            </DialogContentText>
            <TextField
              autoFocus
              fullWidth
              label="Correo electrónico"
              type="email"
              value={enviarCotizacionDialog.email}
              onChange={(e) => setEnviarCotizacionDialog((prev) => ({ ...prev, email: e.target.value, error: null }))}
              error={Boolean(enviarCotizacionDialog.error)}
              helperText={enviarCotizacionDialog.error || ' '}
            />
            <TextField
              fullWidth
              label="Asunto"
              value={enviarCotizacionDialog.subject}
              onChange={(e) => setEnviarCotizacionDialog((prev) => ({ ...prev, subject: e.target.value }))}
            />
            <TextField
              fullWidth
              label="Mensaje"
              multiline
              minRows={4}
              value={enviarCotizacionDialog.message}
              onChange={(e) => setEnviarCotizacionDialog((prev) => ({ ...prev, message: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setEnviarCotizacionDialog({ open: false, id: null, email: '', subject: '', message: '', enviando: false, error: null })}
            disabled={enviarCotizacionDialog.enviando}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              const email = enviarCotizacionDialog.email.trim();
              if (!email) {
                setEnviarCotizacionDialog((prev) => ({ ...prev, error: 'El correo es obligatorio' }));
                return;
              }
              try {
                setEnviarCotizacionDialog((prev) => ({ ...prev, enviando: true, error: null }));
                await enviarCotizacionPorCorreo(Number(enviarCotizacionDialog.id), {
                  to: email,
                  subject: enviarCotizacionDialog.subject.trim(),
                  message: enviarCotizacionDialog.message.trim(),
                  tipoDocumento,
                });
                await load();
                setSnackbar({ open: true, message: `${documentoTypeConfig.label} enviada correctamente`, severity: 'success' });
                setEnviarCotizacionDialog({ open: false, id: null, email: '', subject: '', message: '', enviando: false, error: null });
              } catch (err: any) {
                const msg = err?.message || `No se pudo enviar ${documentoTypeConfig.textos.singular}`;
                setEnviarCotizacionDialog((prev) => ({ ...prev, enviando: false, error: msg }));
                setSnackbar({ open: true, message: msg, severity: 'error' });
              }
            }}
            disabled={enviarCotizacionDialog.enviando}
            startIcon={enviarCotizacionDialog.enviando ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {enviarCotizacionDialog.enviando ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogActions>
      </Dialog>

      <DocumentoWhatsappDialog
        open={enviarWhatsappDialog.open}
        onClose={() => setEnviarWhatsappDialog({ open: false, id: null })}
        documento={
          documentoWhatsappActual
            ? {
                id: documentoWhatsappActual.id,
                tipoDocumento: documentoWhatsappActual.tipoDocumento,
                tipoDocumentoLabel: documentoWhatsappActual.tipoDocumentoLabel,
                folio: documentoWhatsappActual.folio,
                cliente: documentoWhatsappActual.cliente,
                total: documentoWhatsappActual.total,
              }
            : null
        }
        telefonoInicial={documentoWhatsappActual?.telefono || ''}
        plantillaDefaultId={documentoWhatsappActual?.plantillaDefaultId ?? null}
      />

      <Drawer
        anchor="right"
        open={produccionDrawer.open}
        onClose={cerrarDrawerProduccion}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 440, md: 520 },
            maxWidth: '100%',
          },
        }}
      >
        <Box sx={{ p: 3, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
            <Box>
              <Typography variant="h6" fontWeight={700} color="#1d2f68">
                Producción
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {produccionDrawer.titulo ? `Cotización ${produccionDrawer.titulo}` : 'Consulta del avance operativo'}
              </Typography>
            </Box>
            <IconButton onClick={cerrarDrawerProduccion} aria-label="Cerrar producción">
              <CloseIcon />
            </IconButton>
          </Stack>

          {produccionDrawer.loading ? (
            <Stack spacing={1.5} alignItems="center" sx={{ py: 6 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                Cargando historial...
              </Typography>
            </Stack>
          ) : produccionDrawer.error ? (
            <Alert severity="error" variant="outlined">
              {produccionDrawer.error}
            </Alert>
          ) : (
            <>
              <Box
                sx={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 2,
                  backgroundColor: '#f8fafc',
                  p: 2,
                }}
              >
                <Typography variant="overline" sx={{ color: '#6b7280', letterSpacing: 0.8 }}>
                  Estado actual
                </Typography>
                {produccionActual ? (
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    <Chip
                      size="small"
                      label={produccionActual.etapa_nombre || 'Sin etapa'}
                      sx={{
                        alignSelf: 'flex-start',
                        fontWeight: 700,
                        backgroundColor: normalizeHexColor(produccionActual.etapa_color) || '#e5e7eb',
                        color: getContrastingTextColor(produccionActual.etapa_color),
                        '& .MuiChip-label': {
                          color: getContrastingTextColor(produccionActual.etapa_color),
                        },
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      Fecha compromiso: {formatCivilDate(produccionActual.fecha_promesa)}
                    </Typography>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    No hay seguimiento de producción para esta cotización.
                  </Typography>
                )}
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle1" fontWeight={700} color="#1d2f68" sx={{ mb: 1 }}>
                  Historial de avances
                </Typography>

                {produccionDrawer.historial.length === 0 ? (
                  <Alert severity="info" variant="outlined">
                    Todavía no hay avances registrados.
                  </Alert>
                ) : (
                  <Stack spacing={1.25}>
                    {produccionDrawer.historial.map((avance) => {
                      const backgroundColor = normalizeHexColor(avance.etapa_color) || '#e5e7eb';
                      const textColor = getContrastingTextColor(avance.etapa_color);

                      return (
                        <Box
                          key={avance.id}
                          sx={{
                            border: '1px solid #e5e7eb',
                            borderLeft: `4px solid ${backgroundColor}`,
                            borderRadius: 2,
                            bgcolor: avance.activo ? '#f8fafc' : '#ffffff',
                            p: 1.5,
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                            <Chip
                              size="small"
                              label={avance.etapa_nombre || 'Sin etapa'}
                              sx={{
                                fontWeight: 700,
                                backgroundColor,
                                color: textColor,
                                '& .MuiChip-label': {
                                  color: textColor,
                                },
                              }}
                            />
                            {avance.activo ? <Chip size="small" label="Actual" color="success" variant="outlined" /> : null}
                          </Stack>

                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            {formatProductionDateTime(avance.created_at)}
                          </Typography>

                          <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: 'pre-wrap', color: '#111827' }}>
                            {avance.comentarios || 'Sin comentario'}
                          </Typography>

                          <Stack direction="row" spacing={1} sx={{ mt: 0.75 }} alignItems="center" flexWrap="wrap">
                            {avance.usuario_nombre ? (
                              <Typography variant="caption" color="text.secondary">
                                Por {avance.usuario_nombre}
                              </Typography>
                            ) : null}
                            <Typography variant="caption" color="text.secondary">
                              Compromiso: {formatCivilDate(avance.fecha_promesa)}
                            </Typography>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Box>
            </>
          )}
        </Box>
      </Drawer>

      <Dialog
        open={produccionDialog.open}
        onClose={() => !produccionDialog.enviando && setProduccionDialog({ open: false, id: null, fechaPromesa: toCivilDate(), comentarios: '', enviando: false, error: null })}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Enviar a producción</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <DialogContentText>
              Crea el seguimiento operativo en Producción para esta cotización usando la primera etapa activa disponible.
            </DialogContentText>
            <TextField
              autoFocus
              fullWidth
              label="Fecha compromiso"
              type="date"
              value={produccionDialog.fechaPromesa}
              onChange={(e) => setProduccionDialog((prev) => ({ ...prev, fechaPromesa: e.target.value, error: null }))}
              error={Boolean(produccionDialog.error)}
              helperText={produccionDialog.error || ' '}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              label="Comentario"
              multiline
              minRows={3}
              value={produccionDialog.comentarios}
              onChange={(e) => setProduccionDialog((prev) => ({ ...prev, comentarios: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setProduccionDialog({ open: false, id: null, fechaPromesa: toCivilDate(), comentarios: '', enviando: false, error: null })}
            disabled={produccionDialog.enviando}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              const fechaPromesa = produccionDialog.fechaPromesa.trim();
              if (!fechaPromesa) {
                setProduccionDialog((prev) => ({ ...prev, error: 'La fecha compromiso es obligatoria' }));
                return;
              }
              try {
                setProduccionDialog((prev) => ({ ...prev, enviando: true, error: null }));
                const response = await createSeguimientoProduccion({
                  documento_id: Number(produccionDialog.id),
                  fecha_promesa: fechaPromesa,
                  comentarios: produccionDialog.comentarios.trim() || null,
                });
                setSnackbar({
                  open: true,
                  message: response.message || (response.created ? 'Seguimiento enviado a producción' : 'El seguimiento ya existía en producción'),
                  severity: response.created ? 'success' : 'info',
                });
                setProduccionDialog({ open: false, id: null, fechaPromesa: toCivilDate(), comentarios: '', enviando: false, error: null });
              } catch (err: any) {
                const msg = err?.message || 'No se pudo enviar a producción';
                setProduccionDialog((prev) => ({ ...prev, enviando: false, error: msg }));
                setSnackbar({ open: true, message: msg, severity: 'error' });
              }
            }}
            disabled={produccionDialog.enviando}
            startIcon={produccionDialog.enviando ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {produccionDialog.enviando ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setPendingDeleteId(null);
        }}
      >
  <DialogTitle fontWeight={700}>Eliminar {textos.singular}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#374151' }}>
            ¿Eliminar {textos.singular.toLowerCase()}? Esta acción no se puede deshacer.
          </DialogContentText>
          {tipoDocumento === 'cotizacion' && pendingDeleteRow?.eliminara_oportunidad ? (
            <Alert severity="warning" variant="outlined" sx={{ mt: 2 }}>
              Esta es la última cotización de la oportunidad; también se eliminará la oportunidad.
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => {
              setConfirmOpen(false);
              setPendingDeleteId(null);
            }}
            variant="outlined"
          >
            No eliminar
          </Button>
          <Button
            onClick={async () => {
              if (!pendingDeleteId) return;
              try {
                setDeletingId(pendingDeleteId);
                await deleteDocumento(pendingDeleteId, tipoDocumento);
                setRows((prev) => prev.filter((r) => r.id !== pendingDeleteId));
                setConfirmOpen(false);
                setPendingDeleteId(null);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No se pudo eliminar el documento');
              } finally {
                setDeletingId(null);
              }
            }}
            color="error"
            variant="contained"
            disabled={deletingId !== null}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteBlockedDialog.open}
        onClose={() => setDeleteBlockedDialog({ open: false, message: '' })}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>No se puede eliminar la cotización</DialogTitle>
        <DialogContent>
          <Typography sx={{ pt: 1, color: '#475569' }}>
            {deleteBlockedDialog.message}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setDeleteBlockedDialog({ open: false, message: '' })}>
            Entendido
          </Button>
        </DialogActions>
      </Dialog>

      <FacturaGlobalDialog
        open={openFacturaGlobal}
        onClose={() => setOpenFacturaGlobal(false)}
        onGenerado={() => { setOpenFacturaGlobal(false); void load(); }}
      />
    </>
  );
}
