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
import { DataGrid } from '@mui/x-data-grid';
import type {
  GridColDef,
  GridRowParams,
  GridRenderCellParams,
  GridColumnVisibilityModel,
  GridColumnResizeParams,
} from '@mui/x-data-grid';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import EmailIcon from '@mui/icons-material/Email';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
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
import type { TipoDocumentoEmpresa } from '../services/tiposDocumentoService';
import { fetchTiposDocumentoHabilitados } from '../services/tiposDocumentoService';
import { fetchContactos, fetchVendedores } from '../services/contactosService';
import { abrirDocumentoPdfEnNuevaVentana, deleteDocumento, enviarCotizacionPorCorreo, getDocumentos, updateDocumento } from '../services/documentosService';
import { timbrarFactura, enviarFactura } from '../services/facturasService';
import { formatearFolioDocumento } from '../utils/documentos.utils';
import { esES } from '@mui/x-data-grid/locales';
import { useSession } from '../session/useSession';
import { getDocumentoTypeConfig } from '../modules/documentos/documentoTypeConfig';
import {
  ESTADOS_SEGUIMIENTO,
  getEstadoSeguimientoPresentation,
  normalizeEstadoSeguimiento,
} from '../modules/cotizaciones/estadoSeguimiento';
import {
  getOpcionesGeneracion,
  prepararGeneracion,
  generarDocumentoDesdeOrigen,
  type OpcionGeneracionResponse,
  type PrepararGeneracionResponse,
  type GenerarDocumentoPayload,
} from '../services/documentGenerationService';

type DocumentosPageProps = {
  tipoDocumento?: TipoDocumento;
};

const TIPOS_CONTACTO_COTIZACION = ['Cliente', 'Lead'];

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

const getDocumentoEstatusColor = (value: unknown): 'default' | 'info' | 'success' | 'warning' | 'error' => {
  const normalized = normalizeDocumentoEstatus(value);
  if (normalized === 'borrador') return 'default';
  if (normalized === 'emitido') return 'info';
  if (normalized === 'cancelado') return 'error';
  if (normalized === 'timbrado' || normalized === 'cerrado' || normalized === 'pagado') return 'success';
  return 'default';
};

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

export default function DocumentosPage({ tipoDocumento: propTipo }: DocumentosPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { session } = useSession();
  const tipoDocumento = (propTipo ?? (params.codigo as TipoDocumento)) || 'cotizacion';
  const token = session.token;
  const empresaId = session.empresaActivaId;
  const modulo = location.pathname.startsWith('/compras') ? 'compras' : 'ventas';
  const esCotizacion = tipoDocumento === 'cotizacion';
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

    const fallbackTitulo = tipoDocumento.charAt(0).toUpperCase() + tipoDocumento.slice(1);
    return {
      titulo: fallbackTitulo,
      descripcion: 'Consulta y gestiona los documentos.',
      singular: fallbackTitulo,
    };
  }, [tiposDocumento, tipoDocumento]);
  const [rows, setRows] = useState<CotizacionListado[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [vendedores, setVendedores] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [timbrandoId, setTimbrandoId] = useState<number | null>(null);
  const [columnVisibilityModel, setColumnVisibilityModel] = useState<GridColumnVisibilityModel>({});
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  type SnackbarSeverity = 'success' | 'error' | 'info' | 'warning';
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: SnackbarSeverity }>(
    { open: false, message: '', severity: 'success' }
  );
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
  const [opcionesGeneracion, setOpcionesGeneracion] = useState<Record<number, OpcionGeneracionResponse[]>>({});
  const [tieneOpcionesGeneracion, setTieneOpcionesGeneracion] = useState<boolean | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuDocumentoId, setMenuDocumentoId] = useState<number | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [generacionDialog, setGeneracionDialog] = useState<{
    open: boolean;
    loading: boolean;
    documentoId: number | null;
    tipoDestino: string | null;
    data: PrepararGeneracionResponse | null;
    cantidades: Record<number, number>;
    enviando: boolean;
  }>({ open: false, loading: false, documentoId: null, tipoDestino: null, data: null, cantidades: {}, enviando: false });
  const [search, setSearch] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(false);
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

  const STORAGE_KEY = `documentos-${tipoDocumento}-grid-preferencias`;
  const basePath = `/ventas/${tipoDocumento}`;
  const documentoTypeConfig = useMemo(() => getDocumentoTypeConfig(tipoDocumento), [tipoDocumento]);
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
  const showAgentFilter = tipoDocumento === 'cotizacion';

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
  const showSaldo = tipoDocumento === 'factura' || tipoDocumento === 'factura_compra';
  const isFacturaConSaldo = showSaldo;
  const estatusDocumentoOptions = useMemo<StatusOption[]>(
    () => (esCotizacion ? COTIZACION_ESTATUS_EDITABLE_OPTIONS : statusOptions),
    [esCotizacion, statusOptions]
  );
  const effectiveColumnVisibilityModel = useMemo<GridColumnVisibilityModel>(
    () => (esCotizacion ? { ...columnVisibilityModel, estatus_documento: true } : columnVisibilityModel),
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
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.columnVisibilityModel) setColumnVisibilityModel(parsed.columnVisibilityModel);
      if (parsed?.columnWidths) setColumnWidths(parsed.columnWidths);
    } catch (err) {
      console.warn('No se pudo leer preferencias de columnas', err);
    }
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
          fetchContactos(TIPOS_CONTACTO_COTIZACION),
          showAgentFilter ? fetchVendedores() : Promise.resolve([]),
        ]);
        setContactos(contactosData);
        setVendedores(vendedoresData);
      } catch (err) {
        console.error('No se pudieron cargar datos para filtros de documentos', err);
      }
    };

    void loadFilterData();
  }, [enableFilters, showAgentFilter]);

  const requireAuthData = () => {
    if (!token || !empresaId) {
      setError('Token o empresa activa no disponibles. Inicia sesión de nuevo.');
      return false;
    }
    return true;
  };

  const handleOpenMenuGenerar = async (event: React.MouseEvent<HTMLElement>, documentoId: number) => {
    event.stopPropagation();
    if (!requireAuthData()) return;

    const cached = opcionesGeneracion[documentoId];
    setMenuDocumentoId(documentoId);
    setMenuAnchor(event.currentTarget);

    if (cached) {
      if (cached.length === 0) {
        setMenuAnchor(null);
        setMenuDocumentoId(null);
        setSnackbar({ open: true, message: 'No hay opciones de generación para este documento', severity: 'info' });
      }
      return;
    }

    try {
      setMenuLoading(true);
      const opciones = await getOpcionesGeneracion(documentoId, token!, empresaId!);
      setOpcionesGeneracion((prev) => ({ ...prev, [documentoId]: opciones }));
      if (!opciones || opciones.length === 0) {
        setMenuAnchor(null);
        setMenuDocumentoId(null);
        setSnackbar({ open: true, message: 'No hay opciones de generación para este documento', severity: 'info' });
      }
    } catch (err: any) {
      setMenuAnchor(null);
      setMenuDocumentoId(null);
      setSnackbar({ open: true, message: err?.message || 'No se pudieron cargar las opciones de generación', severity: 'error' });
    } finally {
      setMenuLoading(false);
    }
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuDocumentoId(null);
  };

  const closeEstatusMenu = () => {
    setEstatusMenu({ anchorEl: null, rowId: null, currentValue: 'borrador' });
  };

  const closeSeguimientoMenu = () => {
    setSeguimientoMenu({ anchorEl: null, rowId: null, currentValue: null });
  };

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

    try {
      setActualizandoEstatusId(rowId);
      const updated = await updateDocumento(rowId, tipoDocumento, {
        estatus_documento: esCotizacion ? formatCotizacionEstatusLabel(nextValue) : formatDocumentoEstatusLabel(nextValue),
      });
      setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...(updated as Partial<CotizacionListado>) } : row)));
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
    if (!requireAuthData()) return;
    closeMenu();
    setGeneracionDialog({
      open: true,
      loading: true,
      documentoId: menuDocumentoId,
      tipoDestino,
      data: null,
      cantidades: {},
      enviando: false,
    });

    try {
      const data = await prepararGeneracion(menuDocumentoId, tipoDestino as any, token!, empresaId!);
      const cantidades = data.partidas.reduce<Record<number, number>>((acc, p) => {
        acc[p.partida_id] = p.cantidad_default ?? p.cantidad_pendiente_sugerida ?? 0;
        return acc;
      }, {});
      setGeneracionDialog({
        open: true,
        loading: false,
        documentoId: menuDocumentoId,
        tipoDestino,
        data,
        cantidades,
        enviando: false,
      });
    } catch (err: any) {
      setGeneracionDialog({
        open: false,
        loading: false,
        documentoId: null,
        tipoDestino: null,
        data: null,
        cantidades: {},
        enviando: false,
      });
      setSnackbar({ open: true, message: err?.message || 'No se pudo preparar la generación', severity: 'error' });
    }
  };

  const handleCantidadChange = (partidaId: number, value: string) => {
    const num = Number(value);
    setGeneracionDialog((prev) => ({
      ...prev,
      cantidades: { ...prev.cantidades, [partidaId]: Number.isNaN(num) ? 0 : num },
    }));
  };

  const handleGenerar = async () => {
    if (!generacionDialog.data || !generacionDialog.documentoId || !generacionDialog.tipoDestino) return;
    if (!requireAuthData()) return;

    const partidas = generacionDialog.data.partidas
      .map((p) => ({ partida_origen_id: p.partida_id, cantidad: generacionDialog.cantidades[p.partida_id] ?? 0 }))
      .filter((p) => p.cantidad > 0);

    if (partidas.length === 0) {
      setSnackbar({ open: true, message: 'Captura al menos una cantidad mayor a cero', severity: 'warning' });
      return;
    }

    const payload: GenerarDocumentoPayload = {
      documento_origen_id: generacionDialog.documentoId,
      tipo_documento_destino: generacionDialog.tipoDestino as any,
      partidas,
    };

    try {
      setGeneracionDialog((prev) => ({ ...prev, enviando: true }));
      const result = await generarDocumentoDesdeOrigen(payload, token!, empresaId!);
      setGeneracionDialog({ open: false, loading: false, documentoId: null, tipoDestino: null, data: null, cantidades: {}, enviando: false });
      setSnackbar({ open: true, message: 'Documento generado correctamente', severity: 'success' });
      navigate(`/documentos/${result.documento_destino_id}`);
    } catch (err: any) {
      setGeneracionDialog((prev) => ({ ...prev, enviando: false }));
      setSnackbar({ open: true, message: err?.message || 'No se pudo generar el documento', severity: 'error' });
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      const data = await getDocumentos(tipoDocumento);
      setRows(data);
      setError(null);

      // Detectar si existen opciones de generación para el tipo de documento (basado en el primer documento)
      if (data && data.length > 0 && token && empresaId) {
        try {
          const firstId = Number((data?.[0] as any)?.id ?? (data?.[0] as any)?.documento_id ?? 0);
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

  const formatFecha = (value: any) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const day = d.toLocaleString('es-MX', { day: '2-digit' });
    const month = d.toLocaleString('es-MX', { month: 'short' }).replace('.', '').toUpperCase();
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  useEffect(() => {
    load();
  }, [tipoDocumento]);

  const obtenerEmailDocumento = (row: any) =>
    row?.contacto_email ?? row?.email_contacto ?? row?.cliente_email ?? row?.email_cliente ?? row?.email ?? '';

  const abrirDialogoEnviarCotizacion = (row: CotizacionListado) => {
    const folio = formatearFolioDocumento(row?.serie ?? '', Number(row?.numero ?? 0));
    const emailInicial = obtenerEmailDocumento(row);
    setEnviarCotizacionDialog({
      open: true,
      id: Number(row.id),
      email: emailInicial,
      subject: `Cotizacion ${folio}`,
      message: `Se adjunta la cotizacion ${folio}.`,
      enviando: false,
      error: emailInicial ? null : 'El cliente no tiene correo registrado. Captura uno para continuar.',
    });
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
      { field: 'nombre_cliente', headerName: 'Cliente', flex: 1, minWidth: 220, headerClassName: 'finanzas-header' },
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
  width: esCotizacion ? 340 : 270,
      sortable: false,
      filterable: false,
      headerAlign: 'center',
      headerClassName: 'finanzas-header',
      align: 'center',
      renderCell: (params: GridRenderCellParams) => (
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
              setPendingDeleteId(params.row.id as number);
              setConfirmOpen(true);
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
          {tieneOpcionesGeneracion && (
            <Tooltip title="Generar">
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  disabled={loading || menuLoading}
                  onClick={(e) => handleOpenMenuGenerar(e, Number(params.row.id))}
                >
                  <AutoAwesomeIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Tooltip title="Descargar PDF">
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
              <PictureAsPdfIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {tipoDocumento === 'cotizacion' && (
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
          {tipoDocumento === 'factura' && (
            <Tooltip title={Number(params.row?.saldo ?? 0) > 0 ? 'Aplicar pago' : 'Factura sin saldo pendiente'}>
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  disabled={loading || Number(params.row?.saldo ?? 0) <= 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`${basePath}/${params.id}?abrirPagos=1`);
                  }}
                >
                  <AccountBalanceWalletIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {tipoDocumento === 'factura' && (
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
                      await timbrarFactura(Number(params.row.id));
                      await load();
                      const emailInicial = obtenerEmailDocumento(params.row);
                      setEnviarDialog({ open: true, id: Number(params.row.id), email: emailInicial, enviando: false, error: null });
                    } catch (err: any) {
                      setError(err?.message || 'No se pudo timbrar la factura');
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
          {tipoDocumento === 'factura' && (
            <Tooltip title="Enviar factura por correo">
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  disabled={loading}
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
        </Stack>
      ),
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
    vendedoresPorId,
    esCotizacion,
  ]);

  const columns: GridColDef[] = useMemo(
    () =>
      baseColumns.map((col) =>
        columnWidths[col.field] != null ? { ...col, width: Number(columnWidths[col.field]) } : col
      ) as GridColDef[],
    [baseColumns, columnWidths]
  );

  const filteredRows = useMemo(() => {
    let result = [...rows];

    if (isFacturaConSaldo && soloPendientes) {
      result = result.filter((row) => Number(row?.saldo ?? 0) > 0);
    }

    if (enableFilters) {
      if (quickFilter !== 'todos') {
        result = result.filter((row) => {
          const rawStatus = row[statusField];
          const normalizedStatus =
            statusField === 'estado_seguimiento'
              ? normalizeEstadoSeguimiento(rawStatus)
              : normalizeDocumentoEstatus(rawStatus);

          return normalizedStatus === quickFilter;
        });
      }

      if (filtrosCotizacion.clienteId) {
        result = result.filter((row) => row.contacto_principal_id === filtrosCotizacion.clienteId);
      }

      if (showAgentFilter && filtrosCotizacion.agenteId) {
        result = result.filter((row) => Number(row.agente_id ?? 0) === filtrosCotizacion.agenteId);
      }

      if (filtrosCotizacion.fechaDesde) {
        const desde = dayjs(filtrosCotizacion.fechaDesde).startOf('day');
        result = result.filter((row) => dayjs(row.fecha_documento).startOf('day').isAfter(desde.subtract(1, 'millisecond')));
      }

      if (filtrosCotizacion.fechaHasta) {
        const hasta = dayjs(filtrosCotizacion.fechaHasta).endOf('day');
        result = result.filter((row) => dayjs(row.fecha_documento).endOf('day').isBefore(hasta.add(1, 'millisecond')));
      }

      const montoMin = filtrosCotizacion.montoMin === '' ? null : Number(filtrosCotizacion.montoMin);
      const montoMax = filtrosCotizacion.montoMax === '' ? null : Number(filtrosCotizacion.montoMax);

      if (montoMin !== null && !Number.isNaN(montoMin)) {
        result = result.filter((row) => Number(row.total ?? 0) >= montoMin);
      }

      if (montoMax !== null && !Number.isNaN(montoMax)) {
        result = result.filter((row) => Number(row.total ?? 0) <= montoMax);
      }
    }

    const q = search.trim().toLowerCase();
    if (!q) return result;

    return result.filter((row) => {
      const folio = `${row?.serie ?? ''}${row?.numero ?? ''}`.toLowerCase();
  const folioAlt = String((row as any)?.folio ?? '').toLowerCase();
  const cliente = String((row as any)?.nombre_cliente ?? (row as any)?.cliente_nombre ?? '').toLowerCase();
      const subtotal = String(row?.subtotal ?? '').toLowerCase();
      const total = String(row?.total ?? '').toLowerCase();
      const saldo = String(row?.saldo ?? '').toLowerCase();
      const fecha = String(row?.fecha_documento ?? '').toLowerCase();
      const status = String(row?.[statusField] ?? '').toLowerCase();

      return (
        folio.includes(q) ||
        folioAlt.includes(q) ||
        cliente.includes(q) ||
        subtotal.includes(q) ||
        total.includes(q) ||
        saldo.includes(q) ||
        fecha.includes(q) ||
        status.includes(q)
      );
    });
  }, [rows, search, soloPendientes, isFacturaConSaldo, enableFilters, quickFilter, filtrosCotizacion, showAgentFilter, statusField]);

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

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
      <Toolbar disableGutters sx={{ justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Stack spacing={0.5}>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            {textos.titulo}
          </Typography>
          <Typography variant="body2" color="#4b5563">
            {textos.descripcion}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          {false && tipoDocumento === 'cotizacion' && (
            <Button variant="outlined" startIcon={<TableViewIcon />} onClick={() => navigate('/ventas/cotizaciones-grid')}>
              Vista Excel
            </Button>
          )}
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            Recargar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate(`${basePath}/nuevo`)}
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
          placeholder="Buscar folio, cliente, monto, referencia..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment:
              search && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
          }}
        />
        {isFacturaConSaldo && (
          <FormControlLabel
            control={<Checkbox checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} />}
            label="Solo pendientes"
          />
        )}
      </Stack>

      {enableFilters && (
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
                            sx: {
                              '& .MuiInputLabel-root': { fontSize: 13 },
                              '& .MuiInputBase-input': { fontSize: 13, py: 1.15 },
                            },
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
                            sx: {
                              '& .MuiInputLabel-root': { fontSize: 13 },
                              '& .MuiInputBase-input': { fontSize: 13, py: 1.15 },
                            },
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
                          label="Cliente"
                          placeholder="Todos"
                          InputLabelProps={{ ...(params.InputLabelProps as any), shrink: true }}
                          sx={{
                            '& .MuiInputLabel-root': { fontSize: 13 },
                            '& .MuiInputBase-input': { fontSize: 13, py: 1.15 },
                          }}
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
                      sx={{ width: '100%', '& .MuiAutocomplete-input': { fontSize: 13 } }}
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
                      sx={{
                        '& .MuiInputLabel-root': { fontSize: 13 },
                        '& .MuiInputBase-input': { fontSize: 13, py: 1.15 },
                      }}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ min: 0, step: 0.01, style: { fontSize: 13 } }}
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
                      sx={{
                        '& .MuiInputLabel-root': { fontSize: 13 },
                        '& .MuiInputBase-input': { fontSize: 13, py: 1.15 },
                      }}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ min: 0, step: 0.01, style: { fontSize: 13 } }}
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
                            inputProps={{ ...params.inputProps, style: { fontSize: 13 } }}
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
      )}

      {enableFilters && resumenTotales && (
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
      )}

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

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', width: '100%' }}>
        <DataGrid
          rows={filteredRows}
          columns={columns}
          autoHeight
          density="standard"
          rowHeight={42}
          columnHeaderHeight={52}
          loading={loading}
          disableRowSelectionOnClick
          // @ts-expect-error Deshabilitamos el reordenamiento para mantener el orden fijo de columnas
          disableColumnReorder
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
            }
          }}
          onRowClick={(params: GridRowParams, event) => {
            if ((event as any).defaultMuiPrevented) return;
            navigate(`${basePath}/${params.id}`);
          }}
          columnVisibilityModel={effectiveColumnVisibilityModel}
          onColumnVisibilityModelChange={(model) => {
            const nextModel = esCotizacion ? { ...model, estatus_documento: true } : model;
            setColumnVisibilityModel(nextModel);
            const current = {
              columnVisibilityModel: nextModel,
              columnWidths,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
          }}
          onColumnWidthChange={(params: GridColumnResizeParams) => {
            setColumnWidths((prev) => {
              const next = { ...prev, [params.colDef.field]: params.width };
              localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                  columnVisibilityModel,
                  columnWidths: next,
                })
              );
              return next;
            });
          }}
          localeText={esES.components.MuiDataGrid.defaultProps.localeText}
          sx={{
            width: '100%',
            '--DataGrid-overlayHeight': '200px',
            '& .MuiDataGrid-cell': {
              display: 'flex',
              alignItems: 'center',
            },
            '& .MuiDataGrid-row:nth-of-type(even)': {
              backgroundColor: 'rgba(0, 120, 70, 0.05)',
            },
            '& .finanzas-header': {
              backgroundColor: '#1d2f68 !important',
              color: '#ffffff !important',
              fontWeight: 600,
            },
            '& .finanzas-header .MuiDataGrid-columnHeaderTitle': {
              color: '#ffffff !important',
              fontWeight: 600,
            },
            '& .finanzas-header .MuiDataGrid-sortIcon': {
              color: '#ffffff !important',
            },
            '& .finanzas-header .MuiDataGrid-menuIcon': {
              color: '#ffffff !important',
            },
            '& .finanzas-header:hover .MuiDataGrid-menuIcon': {
              color: '#ffffff !important',
            },
            '& .finanzas-header .MuiIconButton-root': {
              color: '#ffffff !important',
            },
            '& .MuiDataGrid-columnSeparator': {
              color: 'rgba(255,255,255,0.25) !important',
            },
          }}
          hideFooterPagination
          hideFooterSelectedRowCount
          slots={{
            noRowsOverlay: () => (
              <Stack height="100%" alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {loading ? 'Cargando documentos...' : 'No hay documentos registrados.'}
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
      </Paper>

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

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
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

      <Dialog
        open={generacionDialog.open}
        onClose={() => !generacionDialog.enviando && setGeneracionDialog({ open: false, loading: false, documentoId: null, tipoDestino: null, data: null, cantidades: {}, enviando: false })}
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
                Origen: {generacionDialog.data.documento_origen.folio || generacionDialog.data.documento_origen.documento_id} · Destino: {generacionDialog.tipoDestino}
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Producto</TableCell>
                    <TableCell align="right">Cant. origen</TableCell>
                    <TableCell align="right">Pendiente</TableCell>
                    <TableCell align="right">Cantidad a generar</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {generacionDialog.data.partidas.map((p) => (
                    <TableRow key={p.partida_id} hover>
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
            onClick={() => setGeneracionDialog({ open: false, loading: false, documentoId: null, tipoDestino: null, data: null, cantidades: {}, enviando: false })}
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

      <Dialog
        open={enviarCotizacionDialog.open}
        onClose={() => !enviarCotizacionDialog.enviando && setEnviarCotizacionDialog({ open: false, id: null, email: '', subject: '', message: '', enviando: false, error: null })}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Enviar cotización por correo</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <DialogContentText>
              Confirma el correo del cliente y ajusta el mensaje antes de enviar la cotización en PDF.
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
                });
                await load();
                setSnackbar({ open: true, message: 'Cotización enviada correctamente', severity: 'success' });
                setEnviarCotizacionDialog({ open: false, id: null, email: '', subject: '', message: '', enviando: false, error: null });
              } catch (err: any) {
                const msg = err?.message || 'No se pudo enviar la cotización';
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
      </Box>
    </Container>
  );
}
