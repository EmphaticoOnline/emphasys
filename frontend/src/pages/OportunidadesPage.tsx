import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import AddTaskOutlinedIcon from '@mui/icons-material/AddTaskOutlined';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditCalendarOutlinedIcon from '@mui/icons-material/EditCalendarOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { LocalizationProvider, DatePicker, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { DataGrid, type GridColDef, type GridColumnResizeParams, type GridColumnVisibilityModel, type GridRenderCellParams } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../services/apiFetch';
import { eliminarOportunidad as eliminarOportunidadService } from '../services/oportunidadesService';
import { loadSession } from '../session/sessionStorage';
import { GridContextMenu } from '../components/grids/GridContextMenu';
import { GridContextMenuTrigger } from '../components/grids/GridContextMenuTrigger';
import type { GridContextMenuAction } from '../components/grids/GridContextMenu';
import { SHOW_GRID_ACTIONS } from '../components/grids/gridUxFlags';
import { useGridContextMenu } from '../hooks/useGridContextMenu';
import { useDeviceProfile } from '../hooks/useDeviceProfile';
import { useGridPreferences } from '../hooks/useGridPreferences';
import ActividadSeguimientoDrawer from '../components/crm/ActividadSeguimientoDrawer';

dayjs.locale('es');

const DEFAULT_COLUMN_WIDTHS = {
  folio: 150,
  contacto_nombre: 220,
  vendedor_nombre: 180,
  estatus: 185,
  monto_oportunidad: 170,
  fecha_cotizacion: 160,
  fecha_estimada_cierre: 190,
  fecha_reactivacion_estimada: 165,
  fecha_creacion: 150,
  observaciones: 150,
} satisfies Record<string, number>;

type OportunidadColumnField = keyof typeof DEFAULT_COLUMN_WIDTHS;

type Oportunidad = {
  id: number;
  folio: string;
  cotizacion_principal_id: number | null;
  contacto_nombre: string;
  vendedor_nombre: string;
  estatus: string;
  has_factura_activa: boolean;
  comentarios_no_cierre: string;
  fecha_reactivacion_estimada: string;
  observaciones: string;
  monto_oportunidad: number;
  fecha_cotizacion: string;
  fecha_estimada_cierre: string;
  fecha_creacion: string;
};

type OportunidadStatus = 'abierta' | 'pausada' | 'convertida' | 'perdida' | 'cancelada';

type StatusFilter = 'todas' | 'abiertas' | 'pausadas' | 'convertidas' | 'perdidas' | 'canceladas';

type AdvancedFilters = {
  fecha_creacion_desde: string;
  fecha_creacion_hasta: string;
  fecha_cierre_desde: string;
  fecha_cierre_hasta: string;
  vendedor: string;
  cliente: string;
  monto_min: string;
  monto_max: string;
};

type OportunidadApiResponse = {
  id: number;
  folio: string | null;
  cotizacion_principal_id?: number | null;
  contacto_nombre: string | null;
  vendedor_nombre: string | null;
  estatus: string | null;
  has_factura_activa?: boolean | null;
  comentarios_no_cierre?: string | null;
  fecha_reactivacion_estimada?: string | null;
  observaciones?: string | null;
  monto_oportunidad?: number | string | null;
  fecha_cotizacion?: string | null;
  fecha_estimada_cierre: string | null;
  fecha_creacion: string | null;
};

type StatusMenuState = {
  anchorEl: HTMLElement | null;
  row: Oportunidad | null;
};

type CancelDialogState = {
  open: boolean;
  row: Oportunidad | null;
  motivo: string;
  error: string | null;
};

type ConversionLockDialogState = {
  open: boolean;
  title: string;
  message: string;
};

type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
};

type EditableDateField = 'fecha_estimada_cierre' | 'fecha_reactivacion_estimada';

type DateDialogState = {
  open: boolean;
  rowId: number | null;
  field: EditableDateField;
  label: string;
  value: string;
};

type ObservacionesDialogState = {
  open: boolean;
  rowId: number | null;
  value: string;
};

type DeleteDialogState = {
  open: boolean;
  row: Oportunidad | null;
};

type OportunidadUpdatePayload = {
  fecha_estimada_cierre?: string | null;
  fecha_reactivacion_estimada?: string | null;
  observaciones?: string;
};

type TipoActividad = 'llamada' | 'whatsapp' | 'visita' | 'tarea';

type Actividad = {
  id: number;
  tipo_actividad: TipoActividad;
  fecha_programada: string;
  estatus: 'pendiente' | 'realizada' | 'cancelada' | string;
  notas: string | null;
  oportunidad_id: number | null;
  descripcion?: string | null;
  observaciones?: string | null;
  resultado?: string | null;
  fecha_realizacion?: string | null;
};

type ActividadesPendientesAgrupadas = {
  vencidas: Actividad[];
  hoy: Actividad[];
  futuras: Actividad[];
};

type SeguimientoResumen = {
  pendingCount: number;
  overdueCount: number;
  todayCount: number;
};

const INITIAL_ADVANCED_FILTERS: AdvancedFilters = {
  fecha_creacion_desde: '',
  fecha_creacion_hasta: '',
  fecha_cierre_desde: '',
  fecha_cierre_hasta: '',
  vendedor: '',
  cliente: '',
  monto_min: '',
  monto_max: '',
};

const EMPTY_CONVERSION_LOCK_DIALOG: ConversionLockDialogState = {
  open: false,
  title: 'No se puede cambiar el estatus',
  message: '',
};

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('es-MX', {
  style: 'percent',
  maximumFractionDigits: 1,
});

const OPORTUNIDAD_STATUS_LABELS: Record<OportunidadStatus, string> = {
  abierta: 'Abierta',
  pausada: 'Pausada',
  convertida: 'Convertida',
  perdida: 'Perdida',
  cancelada: 'Cancelada',
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeStatus(value: string): OportunidadStatus {
  const normalized = normalizeText(value);
  if (normalized === 'pausada') return 'pausada';
  if (normalized === 'convertida' || normalized === 'ganada' || normalized === 'ganado') return 'convertida';
  if (normalized === 'perdida' || normalized === 'perdido') return 'perdida';
  if (normalized === 'cancelada') return 'cancelada';
  return 'abierta';
}

function isOpenStatus(estatus: string): boolean {
  return normalizeStatus(estatus) === 'abierta';
}

function isExtendedPipelineStatus(estatus: string): boolean {
  const normalized = normalizeStatus(estatus);
  return normalized === 'abierta' || normalized === 'pausada';
}

function getQuickBucket(estatus: string): Exclude<StatusFilter, 'todas' | 'canceladas'> | 'otras' {
  const normalized = normalizeStatus(estatus);
  if (normalized === 'convertida') return 'convertidas';
  if (normalized === 'perdida') return 'perdidas';
  if (normalized === 'pausada') return 'pausadas';
  if (normalized === 'abierta') return 'abiertas';
  return 'otras';
}

function formatDate(value: string): string {
  const rawValue = value?.trim();
  if (!rawValue) return 'Sin fecha';

  const normalizedValue = rawValue.includes('T') ? rawValue : `${rawValue}T00:00:00`;
  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsedDate);
}

function formatDateTime(value: string): string {
  const rawValue = value?.trim();
  if (!rawValue) return 'Sin fecha';

  const parsedDate = new Date(rawValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsedDate);
}

function toDateTimeLocalValue(value: Date): string {
  const offset = value.getTimezoneOffset();
  const localDate = new Date(value.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}

function normalizeOportunidad(item: OportunidadApiResponse): Oportunidad {
  const estatus = item.estatus?.trim() || 'abierta';

  return {
    id: Number(item.id),
    folio: item.folio?.trim() || `OP-${String(item.id).padStart(5, '0')}`,
    cotizacion_principal_id: item.cotizacion_principal_id ?? null,
    contacto_nombre: item.contacto_nombre?.trim() || 'Sin contacto',
    vendedor_nombre: item.vendedor_nombre?.trim() || 'Sin vendedor',
    estatus,
    has_factura_activa: Boolean(item.has_factura_activa ?? false),
    comentarios_no_cierre: item.comentarios_no_cierre?.trim() || '',
    fecha_reactivacion_estimada: item.fecha_reactivacion_estimada || '',
    observaciones: item.observaciones?.trim() || '',
    monto_oportunidad: Number(item.monto_oportunidad ?? 0),
    fecha_cotizacion: item.fecha_cotizacion || item.fecha_creacion || '',
    fecha_estimada_cierre: item.fecha_estimada_cierre || '',
    fecha_creacion: item.fecha_creacion || '',
  };
}

async function updateOportunidad(id: number, payload: OportunidadUpdatePayload) {
  console.info('Actualizacion local de oportunidad pendiente de endpoint backend', { id, payload });
  return payload;
}

function getStatusLabel(estatus: string): string {
  return OPORTUNIDAD_STATUS_LABELS[normalizeStatus(estatus)];
}

function getStatusPresentation(estatus: string) {
  const normalized = normalizeStatus(estatus);

  if (normalized === 'convertida') {
    return { label: OPORTUNIDAD_STATUS_LABELS.convertida, backgroundColor: '#dcfce7', textColor: '#166534', borderColor: '#86efac' };
  }
  if (normalized === 'perdida') {
    return { label: OPORTUNIDAD_STATUS_LABELS.perdida, backgroundColor: '#fee2e2', textColor: '#b91c1c', borderColor: '#fecaca' };
  }
  if (normalized === 'pausada') {
    return { label: OPORTUNIDAD_STATUS_LABELS.pausada, backgroundColor: '#ffedd5', textColor: '#c2410c', borderColor: '#fdba74' };
  }
  if (normalized === 'cancelada') {
    return { label: OPORTUNIDAD_STATUS_LABELS.cancelada, backgroundColor: '#f1f5f9', textColor: '#475569', borderColor: '#cbd5e1' };
  }

  return { label: OPORTUNIDAD_STATUS_LABELS.abierta, backgroundColor: '#eff6ff', textColor: '#1e40af', borderColor: '#bfdbfe' };
}

function getStatusChipColor(estatus: string): 'primary' | 'warning' | 'success' | 'error' | 'default' {
  const bucket = getQuickBucket(estatus);
  if (bucket === 'convertidas') return 'success';
  if (bucket === 'perdidas') return 'error';
  if (bucket === 'pausadas') return 'warning';
  if (bucket === 'abiertas') return 'primary';
  return 'default';
}

function getStatusIndicatorColor(estatus: string): string {
  const bucket = getQuickBucket(estatus);
  if (bucket === 'convertidas') return '#2e7d32';
  if (bucket === 'perdidas') return '#d32f2f';
  if (bucket === 'pausadas') return '#ed6c02';
  if (bucket === 'abiertas') return '#1976d2';
  return '#94a3b8';
}

function getAllowedTransitions(currentStatus: string, row: Oportunidad): OportunidadStatus[] {
  const normalized = normalizeStatus(currentStatus);

  if (normalized === 'abierta') return ['pausada', 'perdida', 'cancelada'];
  if (normalized === 'pausada') return ['abierta', 'perdida', 'cancelada'];
  if (normalized === 'convertida') return ['perdida', 'cancelada'];
  if (normalized === 'perdida') return ['abierta', 'cancelada'];
  if (normalized === 'cancelada') return ['abierta', 'perdida'];

  return [];
}

function isConvertedStatusChangeLocked(row: Oportunidad, nextStatus: OportunidadStatus): boolean {
  return normalizeStatus(row.estatus) === 'convertida'
    && row.has_factura_activa
    && nextStatus !== 'convertida';
}

function getConvertedStatusLockMessage(nextStatus: OportunidadStatus): string {
  const destino = nextStatus === 'cancelada' ? 'cancelada' : 'perdida';
  return `Esta oportunidad ya fue convertida porque existe una factura activa generada desde una de sus cotizaciones. Por integridad comercial, no es posible cambiarla a ${destino} mientras esa factura siga vigente.`;
}

function isConvertedStatusLockError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.trim().toLowerCase();

  return normalized.includes('no se puede cambiar la oportunidad a')
    && normalized.includes('factura activa');
}

function getConvertedStatusLockErrorMessage(error: unknown, nextStatus: OportunidadStatus): string {
  const message = error instanceof Error ? error.message.trim() : String(error ?? '').trim();
  return message || getConvertedStatusLockMessage(nextStatus);
}

async function persistOportunidadStatusChange(payload: {
  id: number;
  estatus: OportunidadStatus;
  comentarios_no_cierre?: string;
}) {
  const body = {
    estatus: payload.estatus,
    ...(payload.comentarios_no_cierre ? { comentarios_no_cierre: payload.comentarios_no_cierre } : {}),
  };

  return apiFetch<OportunidadApiResponse>(`/api/crm/oportunidades/${payload.id}`, {
    method: 'PATCH',
    body: body as any,
  });
}

async function fetchOportunidadesList() {
  return apiFetch<OportunidadApiResponse[]>('/api/crm/oportunidades');
}

async function fetchActividadesPendientesUsuario() {
  return apiFetch<ActividadesPendientesAgrupadas>('/api/crm/actividades');
}

function getDeleteOportunidadErrorMessage(error: unknown) {
  const fallbackMessage = 'No se pudo eliminar la oportunidad.';

  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  const normalizedMessage = normalizeText(error.message);

  if (normalizedMessage.includes('documentos posteriores') || normalizedMessage.includes('documentos derivados')) {
    return 'No se puede eliminar porque ya existen documentos derivados (facturas u otros).';
  }

  return error.message || fallbackMessage;
}

export default function OportunidadesPage() {
  const { id: oportunidadIdParam } = useParams();
  const perfilDispositivo = useDeviceProfile();
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMenu, setStatusMenu] = useState<StatusMenuState>({ anchorEl: null, row: null });
  const [cancelDialog, setCancelDialog] = useState<CancelDialogState>({ open: false, row: null, motivo: '', error: null });
  const [conversionLockDialog, setConversionLockDialog] = useState<ConversionLockDialogState>(EMPTY_CONVERSION_LOCK_DIALOG);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [savingOperacionId, setSavingOperacionId] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', severity: 'info' });
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({ open: false, row: null });
  const [dateDialog, setDateDialog] = useState<DateDialogState>({
    open: false,
    rowId: null,
    field: 'fecha_estimada_cierre',
    label: 'Fecha estimada de cierre',
    value: '',
  });
  const [observacionesDialog, setObservacionesDialog] = useState<ObservacionesDialogState>({ open: false, rowId: null, value: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState<StatusFilter>('todas');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>(INITIAL_ADVANCED_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AdvancedFilters>(INITIAL_ADVANCED_FILTERS);
  const [seguimientoDrawerOpen, setSeguimientoDrawerOpen] = useState(false);
  const [seguimientoOportunidadId, setSeguimientoOportunidadId] = useState<number | null>(null);
  const [seguimientoResumenByOportunidad, setSeguimientoResumenByOportunidad] = useState<Record<number, SeguimientoResumen>>({});
  const [loadingSeguimientoResumen, setLoadingSeguimientoResumen] = useState(false);

  const {
    loadingPreferences,
    sortModel,
    setSortModel,
    columnVisibilityModel,
    setColumnVisibilityModel,
    columnWidths,
    setColumnWidths,
    persistExternalFilters,
  } = useGridPreferences<{
    searchTerm: string;
    filtroEstatus: StatusFilter;
    appliedFilters: AdvancedFilters;
  }>({
    pantalla: 'crm.oportunidades.list',
    perfilDispositivo,
    defaultSortModel: [{ field: 'fecha_creacion', sort: 'desc' }],
    defaultColumnVisibilityModel: {},
    defaultExternalFilters: {
      searchTerm: '',
      filtroEstatus: 'todas',
      appliedFilters: INITIAL_ADVANCED_FILTERS,
    },
    onLoadExternalFilters: (value) => {
      setSearchTerm(String(value.searchTerm ?? ''));
      setFiltroEstatus((value.filtroEstatus as StatusFilter) ?? 'todas');
      if (value.appliedFilters && typeof value.appliedFilters === 'object') {
        const merged = { ...INITIAL_ADVANCED_FILTERS, ...(value.appliedFilters as AdvancedFilters) };
        setAppliedFilters(merged);
        setDraftFilters(merged);
      }
    },
  });

  useEffect(() => {
    let isMounted = true;

    const loadOportunidades = async () => {
      try {
        setLoading(true);
        const data = await fetchOportunidadesList();
        if (!isMounted) return;
        setOportunidades(Array.isArray(data) ? data.map(normalizeOportunidad) : []);
        setError(null);
      } catch (err) {
        console.error('Error al cargar oportunidades:', err);
        if (!isMounted) return;
        setOportunidades([]);
        setError(err instanceof Error ? err.message : 'No se pudieron cargar las oportunidades');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadOportunidades();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    persistExternalFilters({
      searchTerm,
      filtroEstatus,
      appliedFilters,
    });
  }, [persistExternalFilters, searchTerm, filtroEstatus, appliedFilters]);

  const loadSeguimientoResumen = useCallback(async () => {
    setLoadingSeguimientoResumen(true);

    try {
      const data = await fetchActividadesPendientesUsuario();
      const nextSummary: Record<number, SeguimientoResumen> = {};

      const register = (items: Actividad[], kind: 'vencidas' | 'hoy' | 'futuras') => {
        for (const actividad of items) {
          const oportunidadId = actividad.oportunidad_id;

          if (!oportunidadId || actividad.estatus !== 'pendiente') {
            continue;
          }

          const current = nextSummary[oportunidadId] ?? {
            pendingCount: 0,
            overdueCount: 0,
            todayCount: 0,
          };

          current.pendingCount += 1;

          if (kind === 'vencidas') {
            current.overdueCount += 1;
          }

          if (kind === 'hoy') {
            current.todayCount += 1;
          }

          nextSummary[oportunidadId] = current;
        }
      };

      register(Array.isArray(data?.vencidas) ? data.vencidas : [], 'vencidas');
      register(Array.isArray(data?.hoy) ? data.hoy : [], 'hoy');
      register(Array.isArray(data?.futuras) ? data.futuras : [], 'futuras');

      setSeguimientoResumenByOportunidad(nextSummary);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'No se pudo cargar el resumen de seguimiento.',
        severity: 'error',
      });
    } finally {
      setLoadingSeguimientoResumen(false);
    }
  }, []);

  useEffect(() => {
    void loadSeguimientoResumen();
  }, [loadSeguimientoResumen]);

  const vendedoresOptions = useMemo(
    () => Array.from(new Set(oportunidades.map((item) => item.vendedor_nombre))).sort((a, b) => a.localeCompare(b)),
    [oportunidades]
  );
  const clientesOptions = useMemo(
    () => Array.from(new Set(oportunidades.map((item) => item.contacto_nombre))).sort((a, b) => a.localeCompare(b)),
    [oportunidades]
  );

  const filteredOportunidades = useMemo(() => {
    const query = normalizeText(searchTerm);
    const montoMin = appliedFilters.monto_min === '' ? null : Number(appliedFilters.monto_min);
    const montoMax = appliedFilters.monto_max === '' ? null : Number(appliedFilters.monto_max);

    let result = oportunidades;

    if (query) {
      result = result.filter((item) => (
        normalizeText(item.folio).includes(query) || normalizeText(item.contacto_nombre).includes(query)
      ));
    }

    if (filtroEstatus !== 'todas') {
      result = result.filter((item) => {
        if (filtroEstatus === 'abiertas') return isOpenStatus(item.estatus);
        if (filtroEstatus === 'pausadas') return normalizeText(item.estatus) === 'pausada';
        if (filtroEstatus === 'convertidas') return normalizeStatus(item.estatus) === 'convertida';
        if (filtroEstatus === 'perdidas') return normalizeText(item.estatus) === 'perdida';
        if (filtroEstatus === 'canceladas') return normalizeText(item.estatus) === 'cancelada';
        return true;
      });
    }

    if (appliedFilters.fecha_creacion_desde) {
      const desde = new Date(appliedFilters.fecha_creacion_desde).getTime();
      if (!Number.isNaN(desde)) {
        result = result.filter((item) => {
          const fecha = new Date(item.fecha_creacion).getTime();
          return !Number.isNaN(fecha) && fecha >= desde;
        });
      }
    }

    if (appliedFilters.fecha_creacion_hasta) {
      const hasta = new Date(appliedFilters.fecha_creacion_hasta).getTime();
      if (!Number.isNaN(hasta)) {
        result = result.filter((item) => {
          const fecha = new Date(item.fecha_creacion).getTime();
          return !Number.isNaN(fecha) && fecha <= hasta;
        });
      }
    }

    if (appliedFilters.fecha_cierre_desde) {
      const desde = new Date(appliedFilters.fecha_cierre_desde).getTime();
      if (!Number.isNaN(desde)) {
        result = result.filter((item) => {
          const fecha = new Date(item.fecha_estimada_cierre).getTime();
          return !Number.isNaN(fecha) && fecha >= desde;
        });
      }
    }

    if (appliedFilters.fecha_cierre_hasta) {
      const hasta = new Date(appliedFilters.fecha_cierre_hasta).getTime();
      if (!Number.isNaN(hasta)) {
        result = result.filter((item) => {
          const fecha = new Date(item.fecha_estimada_cierre).getTime();
          return !Number.isNaN(fecha) && fecha <= hasta;
        });
      }
    }

    if (appliedFilters.vendedor) {
      result = result.filter((item) => item.vendedor_nombre === appliedFilters.vendedor);
    }

    if (appliedFilters.cliente) {
      result = result.filter((item) => item.contacto_nombre === appliedFilters.cliente);
    }

    if (appliedFilters.monto_min !== '') {
      if (!Number.isNaN(montoMin as number) && montoMin !== null) {
        result = result.filter((item) => item.monto_oportunidad >= montoMin);
      }
    }

    if (appliedFilters.monto_max !== '') {
      if (!Number.isNaN(montoMax as number) && montoMax !== null) {
        result = result.filter((item) => item.monto_oportunidad <= montoMax);
      }
    }

    return result;
  }, [oportunidades, searchTerm, filtroEstatus, appliedFilters]);

  const totals = useMemo(() => {
    const sumMonto = (items: Oportunidad[]) => items.reduce((acc, item) => acc + item.monto_oportunidad, 0);
    const abiertas = filteredOportunidades.filter((item) => normalizeText(item.estatus) === 'abierta');
    const pausadas = filteredOportunidades.filter((item) => normalizeText(item.estatus) === 'pausada');
    const convertidas = filteredOportunidades.filter((item) => normalizeStatus(item.estatus) === 'convertida');
    const perdidas = filteredOportunidades.filter((item) => normalizeText(item.estatus) === 'perdida');
    const canceladas = filteredOportunidades.filter((item) => normalizeText(item.estatus) === 'cancelada');
    const pipelineExtendido = filteredOportunidades.filter((item) => isExtendedPipelineStatus(item.estatus));

    return {
      pipelineActivo: {
        monto: sumMonto(abiertas),
        cantidad: abiertas.length,
      },
      pipelineExtendido: {
        monto: sumMonto(pipelineExtendido),
        cantidad: pipelineExtendido.length,
      },
      abiertas: {
        monto: sumMonto(abiertas),
        cantidad: abiertas.length,
      },
      pausadas: {
        monto: sumMonto(pausadas),
        cantidad: pausadas.length,
      },
      convertidas: {
        monto: sumMonto(convertidas),
        cantidad: convertidas.length,
      },
      perdidas: {
        monto: sumMonto(perdidas),
        cantidad: perdidas.length,
      },
      canceladas: {
        monto: sumMonto(canceladas),
        cantidad: canceladas.length,
      },
    };
  }, [filteredOportunidades]);

  const commercialSummary = useMemo(() => {
    const cierreCountBase = totals.convertidas.cantidad + totals.perdidas.cantidad;
    const cierreMontoBase = totals.convertidas.monto + totals.perdidas.monto;
    const tasaCierre = cierreCountBase > 0 ? totals.convertidas.cantidad / cierreCountBase : null;
    const conversionMonetaria = cierreMontoBase > 0 ? totals.convertidas.monto / cierreMontoBase : null;
    const ticketPromedioConvertida = totals.convertidas.cantidad > 0 ? totals.convertidas.monto / totals.convertidas.cantidad : 0;
    const forecastEsperado = totals.pipelineExtendido.monto * (tasaCierre ?? 0);

    return {
      tasaCierre,
      conversionMonetaria,
      ticketPromedioConvertida,
      forecastEsperado,
    };
  }, [totals]);

  const activeAdvancedFiltersCount = Object.values(appliedFilters).filter((value) => value !== '').length;

  const selectedOportunidad = useMemo(
    () => oportunidades.find((item) => item.id === seguimientoOportunidadId) ?? null,
    [oportunidades, seguimientoOportunidadId]
  );

  const seguimientoTarget = useMemo(() => {
    if (!selectedOportunidad) {
      return null;
    }

    const statusPresentation = getStatusPresentation(selectedOportunidad.estatus);

    return {
      kind: 'oportunidad' as const,
      id: selectedOportunidad.id,
      title: selectedOportunidad.folio || 'Sin folio',
      subtitle: selectedOportunidad.contacto_nombre || 'Sin cliente',
      montoLabel: 'Monto oportunidad',
      montoValor: Number(selectedOportunidad.monto_oportunidad ?? 0),
      statusChip: {
        label: getStatusLabel(selectedOportunidad.estatus),
        backgroundColor: statusPresentation.backgroundColor,
        textColor: statusPresentation.textColor,
        borderColor: statusPresentation.borderColor,
      },
    };
  }, [selectedOportunidad]);

  useEffect(() => {
    if (!oportunidadIdParam || loading || !oportunidades.length) {
      return;
    }

    const oportunidadId = Number(oportunidadIdParam);
    if (!Number.isInteger(oportunidadId) || oportunidadId <= 0) {
      return;
    }

    const oportunidad = oportunidades.find((item) => item.id === oportunidadId);
    if (!oportunidad) {
      return;
    }

    setSeguimientoOportunidadId(oportunidad.id);
    setSeguimientoDrawerOpen(true);
  }, [loading, oportunidadIdParam, oportunidades]);

  const openSeguimientoDrawer = useCallback((oportunidad: Oportunidad) => {
    setSeguimientoOportunidadId(oportunidad.id);
    setSeguimientoDrawerOpen(true);
  }, []);

  const closeSeguimientoDrawer = useCallback(() => {
    setSeguimientoDrawerOpen(false);
  }, []);

  const closeStatusMenu = useCallback(() => {
    setStatusMenu({ anchorEl: null, row: null });
  }, []);

  const openConversionLockDialog = useCallback((nextStatus: OportunidadStatus) => {
    setConversionLockDialog({
      open: true,
      title: 'No se puede cambiar el estatus',
      message: getConvertedStatusLockMessage(nextStatus),
    });
  }, []);

  const handleOpenStatusMenu = useCallback((event: MouseEvent<HTMLElement>, row: Oportunidad) => {
    event.preventDefault();
    event.stopPropagation();

    if (updatingStatusId === row.id) {
      return;
    }

    const transitions = getAllowedTransitions(row.estatus, row);
    if (transitions.length === 0) {
      setSnackbar({
        open: true,
        message: 'No hay transiciones disponibles para este estatus.',
        severity: 'info',
      });
      return;
    }

    setStatusMenu({ anchorEl: event.currentTarget, row });
  }, [updatingStatusId]);

  const applyStatusChange = useCallback(async (row: Oportunidad, nextStatus: OportunidadStatus, motivo?: string) => {
    setUpdatingStatusId(row.id);

    try {
      const payload: {
        id: number;
        estatus: OportunidadStatus;
        comentarios_no_cierre?: string;
      } = {
        id: row.id,
        estatus: nextStatus,
      };

      if (nextStatus === 'cancelada') {
        payload.comentarios_no_cierre = (motivo ?? '').trim();
      }

      const response = await persistOportunidadStatusChange(payload);

      const updatedRow = normalizeOportunidad({
        ...row,
        ...response,
        comentarios_no_cierre: response.comentarios_no_cierre ?? null,
      });

      setOportunidades((prev) => prev.map((item) => {
        if (item.id !== row.id) return item;

        return { ...item, ...updatedRow };
      }));

      setSnackbar({
        open: true,
        message: `Estatus actualizado a ${getStatusLabel(updatedRow.estatus)}.`,
        severity: 'success',
      });
    } catch (err) {
      if (isConvertedStatusLockError(err)) {
        setConversionLockDialog({
          open: true,
          title: 'No se puede cambiar el estatus',
          message: getConvertedStatusLockErrorMessage(err, nextStatus),
        });
        return;
      }

      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'No se pudo actualizar el estatus de la oportunidad.',
        severity: 'error',
      });
    } finally {
      setUpdatingStatusId(null);
    }
  }, []);

  const handleSelectStatus = useCallback(async (nextStatus: OportunidadStatus) => {
    const row = statusMenu.row;
    closeStatusMenu();

    if (!row) return;

    if (isConvertedStatusChangeLocked(row, nextStatus)) {
      openConversionLockDialog(nextStatus);
      return;
    }

    if (nextStatus === 'cancelada') {
      setCancelDialog({ open: true, row, motivo: '', error: null });
      return;
    }

    await applyStatusChange(row, nextStatus);
  }, [applyStatusChange, closeStatusMenu, openConversionLockDialog, statusMenu.row]);

  const handleConfirmCancelacion = useCallback(async () => {
    const row = cancelDialog.row;
    const motivo = cancelDialog.motivo.trim();

    if (!row) return;

    if (!motivo) {
      setCancelDialog((prev) => ({ ...prev, error: 'Debes capturar un motivo de cancelacion.' }));
      return;
    }

    setCancelDialog({ open: false, row: null, motivo: '', error: null });
    await applyStatusChange(row, 'cancelada', motivo);
  }, [applyStatusChange, cancelDialog.motivo, cancelDialog.row]);

  const applyOperationalUpdate = useCallback(async (rowId: number, payload: OportunidadUpdatePayload) => {
    setSavingOperacionId(rowId);

    try {
      const response = await updateOportunidad(rowId, payload);

      setOportunidades((prev) => prev.map((item) => {
        if (item.id !== rowId) return item;

        return {
          ...item,
          ...(response.fecha_estimada_cierre !== undefined ? { fecha_estimada_cierre: response.fecha_estimada_cierre ?? '' } : {}),
          ...(response.fecha_reactivacion_estimada !== undefined ? { fecha_reactivacion_estimada: response.fecha_reactivacion_estimada ?? '' } : {}),
          ...(response.observaciones !== undefined ? { observaciones: response.observaciones } : {}),
        };
      }));

      setSnackbar({ open: true, message: 'Oportunidad actualizada', severity: 'success' });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'No se pudo actualizar la oportunidad.',
        severity: 'error',
      });
    } finally {
      setSavingOperacionId(null);
    }
  }, []);

  const handleOpenDateDialog = useCallback((row: Oportunidad, field: EditableDateField) => {
    if (field === 'fecha_reactivacion_estimada' && normalizeStatus(row.estatus) !== 'pausada') {
      return;
    }

    setDateDialog({
      open: true,
      rowId: row.id,
      field,
      label: field === 'fecha_estimada_cierre' ? 'Fecha estimada de cierre' : 'Fecha de reactivacion',
      value: field === 'fecha_estimada_cierre' ? row.fecha_estimada_cierre : row.fecha_reactivacion_estimada,
    });
  }, []);

  const handleSaveDateField = useCallback(async () => {
    if (!dateDialog.rowId) return;

    const payload = dateDialog.field === 'fecha_estimada_cierre'
      ? { fecha_estimada_cierre: dateDialog.value || null }
      : { fecha_reactivacion_estimada: dateDialog.value || null };

    setDateDialog((prev) => ({ ...prev, open: false }));
    await applyOperationalUpdate(dateDialog.rowId, payload);
  }, [applyOperationalUpdate, dateDialog.field, dateDialog.rowId, dateDialog.value]);

  const handleOpenObservacionesDialog = useCallback((row: Oportunidad) => {
    setObservacionesDialog({
      open: true,
      rowId: row.id,
      value: row.observaciones,
    });
  }, []);

  const handleSaveObservaciones = useCallback(async () => {
    if (!observacionesDialog.rowId) return;

    const rowId = observacionesDialog.rowId;
    const value = observacionesDialog.value;
    setObservacionesDialog({ open: false, rowId: null, value: '' });
    await applyOperationalUpdate(rowId, { observaciones: value });
  }, [applyOperationalUpdate, observacionesDialog.rowId, observacionesDialog.value]);

  const getColumnWidth = useCallback(
    (field: OportunidadColumnField) => columnWidths[field] ?? DEFAULT_COLUMN_WIDTHS[field],
    [columnWidths]
  );

  const handleOpenRealizarActividadDialog = useCallback((actividad: Actividad) => {
    setRealizarActividadDialog({
      open: true,
      actividad,
      resultado: '',
      error: null,
    });
  }, []);

  const getSeguimientoChipPresentation = useCallback((oportunidadId: number) => {
    if (loadingSeguimientoResumen) {
      return {
        label: '...',
        backgroundColor: '#f8fafc',
        textColor: '#64748b',
        borderColor: '#cbd5e1',
      };
    }

    const summary = seguimientoResumenByOportunidad[oportunidadId];

    if (!summary || summary.pendingCount === 0) {
      return {
        label: 'Al dia',
        backgroundColor: '#ecfdf5',
        textColor: '#047857',
        borderColor: '#a7f3d0',
      };
    }

    if (summary.overdueCount > 0) {
      return {
        label: `Vencida (${summary.overdueCount})`,
        backgroundColor: '#fef2f2',
        textColor: '#b91c1c',
        borderColor: '#fecaca',
      };
    }

    if (summary.todayCount > 0) {
      return {
        label: 'Hoy',
        backgroundColor: '#fff7ed',
        textColor: '#b45309',
        borderColor: '#fdba74',
      };
    }

    return {
      label: `Pendiente (${summary.pendingCount})`,
      backgroundColor: '#eff6ff',
      textColor: '#1d4ed8',
      borderColor: '#bfdbfe',
    };
  }, [loadingSeguimientoResumen, seguimientoResumenByOportunidad]);

  const {
    contextMenuRow,
    anchorPosition: contextMenuPosition,
    closeContextMenu,
    openContextMenuForRow,
    rowSlotProps,
  } = useGridContextMenu(filteredOportunidades);

  const contextMenuActions = useMemo<GridContextMenuAction[]>(() => {
    if (!contextMenuRow) return [];

    return [
      {
        id: 'abrir-seguimiento',
        label: 'Abrir seguimiento',
        icon: <AssignmentOutlinedIcon fontSize="small" />,
        onClick: () => openSeguimientoDrawer(contextMenuRow),
      },
      {
        id: 'separator-primary',
        type: 'separator',
      },
      {
        id: 'eliminar',
        label: 'Eliminar oportunidad',
        icon: <DeleteOutlineIcon fontSize="small" />,
        destructive: true,
        disabled: savingOperacionId === contextMenuRow.id,
        onClick: () => handleOpenDeleteDialog(contextMenuRow),
      },
    ];
  }, [contextMenuRow, handleOpenDeleteDialog, openSeguimientoDrawer, savingOperacionId]);

  const contextMenuTriggerColumn = useMemo<GridColDef<Oportunidad>>(
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
      resizable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams<Oportunidad>) => (
        <GridContextMenuTrigger onOpen={(event) => openContextMenuForRow(event, params.row)} />
      ),
    }),
    [openContextMenuForRow]
  );

  const baseColumns = useMemo<GridColDef<Oportunidad>[]>(() => [
    {
      field: 'folio',
      headerName: 'Folio',
      width: getColumnWidth('folio'),
      minWidth: 100,
      resizable: true,
      sortable: true,
      renderCell: (params: GridRenderCellParams<Oportunidad, string>) => {
        const indicatorColor = getStatusIndicatorColor(params.row.estatus);

        return (
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', minWidth: 0, gap: 1 }}>
            <Box
              sx={{
                width: 4,
                alignSelf: 'stretch',
                borderRadius: 999,
                backgroundColor: indicatorColor,
                flexShrink: 0,
              }}
            />
            <Typography variant="body2" fontWeight={700} noWrap sx={{ fontSize: 14.5, minWidth: 0 }}>
              {params.value || '—'}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: 'contacto_nombre',
      headerName: 'Contacto',
      width: getColumnWidth('contacto_nombre'),
      minWidth: 140,
      resizable: true,
      sortable: true,
      renderCell: (params: GridRenderCellParams<Oportunidad, string>) => (
        <Typography variant="body2" fontWeight={600} noWrap title={params.value || ''} sx={{ fontSize: 14.5 }}>
          {params.value || 'Sin contacto'}
        </Typography>
      ),
    },
    {
      field: 'vendedor_nombre',
      headerName: 'Vendedor',
      width: getColumnWidth('vendedor_nombre'),
      minWidth: 120,
      resizable: true,
      sortable: true,
      renderCell: (params: GridRenderCellParams<Oportunidad, string>) => (
        <Typography variant="body2" noWrap title={params.value || ''} sx={{ fontSize: 14.5 }}>
          {params.value || 'Sin vendedor'}
        </Typography>
      ),
    },
    {
      field: 'seguimiento',
      headerName: 'Seguimiento',
      width: 120,
      minWidth: 110,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams<Oportunidad>) => {
        const presentation = getSeguimientoChipPresentation(params.row.id);

        return (
          <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center" sx={{ width: '100%' }}>
            <Chip
              size="small"
              label={presentation.label}
              sx={{
                maxWidth: 110,
                fontWeight: 700,
                bgcolor: presentation.backgroundColor,
                color: presentation.textColor,
                border: '1px solid',
                borderColor: presentation.borderColor,
                '& .MuiChip-label': {
                  px: 1,
                },
              }}
            />
            <Tooltip title="Ver seguimiento">
              <IconButton
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  openSeguimientoDrawer(params.row);
                }}
                sx={{ color: '#1d2f68' }}
              >
                <AssignmentOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        );
      },
    },
    {
      field: 'acciones',
      headerName: 'Acciones',
      width: 90,
      minWidth: 84,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params: GridRenderCellParams<Oportunidad>) => {
        const deletingThisRow = savingOperacionId === params.row.id;

        return (
          <Tooltip title="Eliminar oportunidad">
            <span>
              <IconButton
                size="small"
                color="error"
                onClick={(event) => {
                  event.stopPropagation();
                  handleOpenDeleteDialog(params.row);
                }}
                disabled={deletingThisRow}
                aria-label={`Eliminar oportunidad ${params.row.folio}`}
              >
                {deletingThisRow ? <CircularProgress size={18} color="inherit" /> : <DeleteOutlineIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        );
      },
    },
    {
      field: 'estatus',
      headerName: 'Estatus',
      width: getColumnWidth('estatus'),
      minWidth: 120,
      resizable: true,
      sortable: true,
      renderCell: (params: GridRenderCellParams<Oportunidad, string>) => {
        const presentation = getStatusPresentation(params.value || 'abierta');
        const transitions = getAllowedTransitions(params.row.estatus, params.row);
        const disabled = updatingStatusId === params.row.id || transitions.length === 0;

        return (
          <Chip
            label={presentation.label}
            clickable={!disabled}
            disabled={disabled}
            onClick={(event: MouseEvent<HTMLElement>) => handleOpenStatusMenu(event, params.row)}
            deleteIcon={updatingStatusId === params.row.id ? <CircularProgress size={14} /> : <ArrowDropDownIcon sx={{ fontSize: 16, color: presentation.textColor }} />}
            {...(!disabled ? {
              onDelete: (event: MouseEvent<HTMLElement>) => handleOpenStatusMenu(event, params.row),
            } : {})}
            sx={{
              borderRadius: 1,
              fontWeight: 700,
              fontSize: 12.5,
              height: 28,
              px: 0.75,
              textTransform: 'capitalize',
              bgcolor: presentation.backgroundColor,
              color: presentation.textColor,
              border: '1px solid',
              borderColor: presentation.borderColor,
              '& .MuiChip-deleteIcon': {
                color: presentation.textColor,
              },
            }}
          />
        );
      },
    },
    {
      field: 'monto_oportunidad',
      headerName: 'Monto oportunidad',
      width: getColumnWidth('monto_oportunidad'),
      minWidth: 140,
      resizable: true,
      sortable: true,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams<Oportunidad, number>) => (
        <Box sx={{ width: '100%', textAlign: 'right' }}>
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: 14.5, color: '#0f766e' }}>
            {currencyFormatter.format(Number(params.value ?? 0))}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'fecha_cotizacion',
      headerName: 'Fecha cotización',
      width: getColumnWidth('fecha_cotizacion'),
      minWidth: 140,
      resizable: true,
      sortable: true,
      renderCell: (params: GridRenderCellParams<Oportunidad, string>) => (
        <Typography variant="body2" sx={{ fontSize: 14.5 }}>
          {formatDate(params.value || '')}
        </Typography>
      ),
    },
    {
      field: 'fecha_estimada_cierre',
      headerName: 'Fecha estimada de cierre',
      width: getColumnWidth('fecha_estimada_cierre'),
      minWidth: 130,
      resizable: true,
      sortable: true,
      renderCell: (params: GridRenderCellParams<Oportunidad, string>) => (
        <ButtonBase
          onClick={() => handleOpenDateDialog(params.row, 'fecha_estimada_cierre')}
          disabled={savingOperacionId === params.row.id}
          sx={{ width: '100%', justifyContent: 'flex-start', borderRadius: 1, px: 0.5, py: 0.25 }}
        >
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
            {savingOperacionId === params.row.id ? <CircularProgress size={14} /> : <EditCalendarOutlinedIcon sx={{ fontSize: 16, color: '#64748b' }} />}
            <Typography variant="body2" sx={{ fontSize: 14.5 }}>
              {formatDate(params.value || '')}
            </Typography>
          </Stack>
        </ButtonBase>
      ),
    },
    {
      field: 'fecha_reactivacion_estimada',
      headerName: 'Fecha reactivación',
      width: getColumnWidth('fecha_reactivacion_estimada'),
      minWidth: 120,
      resizable: true,
      sortable: true,
      renderCell: (params: GridRenderCellParams<Oportunidad, string>) => {
        const isPausada = normalizeStatus(params.row.estatus) === 'pausada';

        if (!isPausada) {
          return (
            <Typography variant="body2" sx={{ fontSize: 13.5, color: '#94a3b8' }}>
              No aplica
            </Typography>
          );
        }

        return (
          <ButtonBase
            onClick={() => handleOpenDateDialog(params.row, 'fecha_reactivacion_estimada')}
            disabled={savingOperacionId === params.row.id}
            sx={{ width: '100%', justifyContent: 'flex-start', borderRadius: 1, px: 0.5, py: 0.25 }}
          >
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
              {savingOperacionId === params.row.id ? <CircularProgress size={14} /> : <EditCalendarOutlinedIcon sx={{ fontSize: 16, color: '#c2410c' }} />}
              <Typography variant="body2" sx={{ fontSize: 14.5 }}>
                {formatDate(params.value || '')}
              </Typography>
            </Stack>
          </ButtonBase>
        );
      },
    },
    {
      field: 'fecha_creacion',
      headerName: 'Fecha de creación',
      width: getColumnWidth('fecha_creacion'),
      minWidth: 120,
      resizable: true,
      sortable: true,
      renderCell: (params: GridRenderCellParams<Oportunidad, string>) => (
        <Typography variant="body2" sx={{ fontSize: 14.5 }}>
          {formatDate(params.value || '')}
        </Typography>
      ),
    },
    {
      field: 'observaciones',
      headerName: 'Observaciones',
      width: getColumnWidth('observaciones'),
      minWidth: 100,
      resizable: true,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Oportunidad, string>) => (
        <ButtonBase
          onClick={() => handleOpenObservacionesDialog(params.row)}
          disabled={savingOperacionId === params.row.id}
          sx={{ width: '100%', justifyContent: 'flex-start', borderRadius: 1, px: 0.5, py: 0.25 }}
        >
          <Stack direction="row" spacing={0.75} alignItems="center">
            {savingOperacionId === params.row.id ? <CircularProgress size={14} /> : <EditNoteOutlinedIcon sx={{ fontSize: 16, color: '#64748b' }} />}
            <Typography variant="body2" sx={{ fontSize: 13.5, color: params.row.observaciones ? '#0f172a' : '#94a3b8' }}>
              {params.row.observaciones ? 'Editar nota' : 'Agregar nota'}
            </Typography>
          </Stack>
        </ButtonBase>
      ),
    },
  ], [getColumnWidth, getSeguimientoChipPresentation, handleOpenDateDialog, handleOpenObservacionesDialog, handleOpenStatusMenu, openSeguimientoDrawer, savingOperacionId, updatingStatusId]);

  const columns = useMemo<GridColDef<Oportunidad>[]>(
    () => [contextMenuTriggerColumn, ...baseColumns],
    [baseColumns, contextMenuTriggerColumn]
  );

  const effectiveColumnVisibilityModel = useMemo<GridColumnVisibilityModel>(
    () => ({
      ...columnVisibilityModel,
      menu: true,
      acciones: SHOW_GRID_ACTIONS,
    }),
    [columnVisibilityModel]
  );


  const handleAplicarFiltros = () => {
    setAppliedFilters(draftFilters);
  };

  const handleLimpiarFiltros = () => {
    setSearchTerm('');
    setFiltroEstatus('todas');
    setDraftFilters(INITIAL_ADVANCED_FILTERS);
    setAppliedFilters(INITIAL_ADVANCED_FILTERS);
  };

  function handleOpenDeleteDialog(row: Oportunidad) {
    setDeleteDialog({ open: true, row });
  }

  const handleCloseDeleteDialog = () => {
    if (savingOperacionId !== null) {
      return;
    }

    setDeleteDialog({ open: false, row: null });
  };

  const handleConfirmDelete = async () => {
    const row = deleteDialog.row;

    if (!row) {
      return;
    }

    setSavingOperacionId(row.id);

    try {
      await eliminarOportunidadService(row.id);
      setOportunidades((prev) => prev.filter((item) => item.id !== row.id));
      setError(null);
      setDeleteDialog({ open: false, row: null });

      try {
        const data = await fetchOportunidadesList();
        setOportunidades(Array.isArray(data) ? data.map(normalizeOportunidad) : []);
      } catch (refreshError) {
        console.error('Error al refrescar oportunidades despues de eliminar:', refreshError);
      }

      try {
        await loadSeguimientoResumen();
      } catch (summaryError) {
        console.error('Error al refrescar seguimiento despues de eliminar:', summaryError);
      }

      setSnackbar({ open: true, message: 'Oportunidad eliminada correctamente', severity: 'success' });
    } catch (err) {
      setSnackbar({
        open: true,
        message: getDeleteOportunidadErrorMessage(err),
        severity: 'error',
      });
    } finally {
      setSavingOperacionId(null);
    }
  };

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      <Stack spacing={2}>
        {loading ? (
          <Paper variant="outlined" sx={{ p: 4, borderRadius: 2, borderColor: '#dbe3ee' }}>
            <Stack spacing={1.5} alignItems="center" justifyContent="center">
              <CircularProgress size={30} />
              <Typography sx={{ color: '#475569' }}>Cargando oportunidades...</Typography>
            </Stack>
          </Paper>
        ) : null}

        {!loading && error ? (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: '#fecaca', backgroundColor: '#fef2f2' }}>
            <Typography sx={{ color: '#b91c1c', fontWeight: 600 }}>No se pudieron cargar las oportunidades.</Typography>
            <Typography sx={{ color: '#7f1d1d', mt: 0.5 }}>{error}</Typography>
          </Paper>
        ) : null}

        {!loading ? (
          <>
            <PaperCard>
              <Stack spacing={0.55}>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 0.75,
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      md: 'repeat(3, minmax(0, 1fr))',
                      lg: 'repeat(6, minmax(0, 1fr))',
                    },
                  }}
                >
                  {[
                    {
                      value: 'todas' as const,
                      label: 'Pipeline extendido',
                      monto: currencyFormatter.format(totals.pipelineExtendido.monto),
                      count: totals.pipelineExtendido.cantidad,
                      backgroundColor: '#eff6ff',
                      borderColor: '#bfdbfe',
                      labelColor: '#1d4ed8',
                      amountColor: '#1e3a8a',
                    },
                    {
                      value: 'abiertas' as const,
                      label: 'Abiertas',
                      monto: currencyFormatter.format(totals.abiertas.monto),
                      count: totals.abiertas.cantidad,
                      backgroundColor: '#f8fafc',
                      borderColor: '#cbd5e1',
                      labelColor: '#475569',
                      amountColor: '#1e40af',
                    },
                    {
                      value: 'pausadas' as const,
                      label: 'Pausadas',
                      monto: currencyFormatter.format(totals.pausadas.monto),
                      count: totals.pausadas.cantidad,
                      backgroundColor: '#fff7ed',
                      borderColor: '#fdba74',
                      labelColor: '#c2410c',
                      amountColor: '#9a3412',
                    },
                    {
                      value: 'convertidas' as const,
                      label: 'Convertidas',
                      monto: currencyFormatter.format(totals.convertidas.monto),
                      count: totals.convertidas.cantidad,
                      backgroundColor: '#ecfdf5',
                      borderColor: '#a7f3d0',
                      labelColor: '#047857',
                      amountColor: '#065f46',
                    },
                    {
                      value: 'perdidas' as const,
                      label: 'Perdidas',
                      monto: currencyFormatter.format(totals.perdidas.monto),
                      count: totals.perdidas.cantidad,
                      backgroundColor: '#fef2f2',
                      borderColor: '#fecaca',
                      labelColor: '#b91c1c',
                      amountColor: '#991b1b',
                    },
                    {
                      value: 'canceladas' as const,
                      label: 'Canceladas',
                      monto: currencyFormatter.format(totals.canceladas.monto),
                      count: totals.canceladas.cantidad,
                      backgroundColor: '#f8fafc',
                      borderColor: '#cbd5e1',
                      labelColor: '#64748b',
                      amountColor: '#334155',
                    },
                  ].map((item) => (
                    <Box
                      component="button"
                      key={item.label}
                      type="button"
                      onClick={() => setFiltroEstatus(item.value)}
                      sx={{
                        border: '1px solid',
                        borderColor: filtroEstatus === item.value ? item.labelColor : item.borderColor,
                        borderRadius: 1.5,
                        px: 0.75,
                        py: 0.3,
                        background: item.backgroundColor,
                        boxShadow: filtroEstatus === item.value ? `0 0 0 1px ${item.labelColor} inset, 0 8px 18px rgba(15, 23, 42, 0.08)` : 'none',
                        transform: filtroEstatus === item.value ? 'translateY(-1px)' : 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                        appearance: 'none',
                        outline: 'none',
                        minWidth: 0,
                        '&:hover': {
                          borderColor: item.labelColor,
                          boxShadow: `0 0 0 1px ${item.labelColor} inset, 0 8px 18px rgba(15, 23, 42, 0.06)`,
                        },
                      }}
                    >
                      <Typography sx={{ fontSize: 10, fontWeight: 800, color: item.labelColor, textTransform: 'uppercase', letterSpacing: 0.4, lineHeight: 1.1 }}>
                        {item.label} ({item.count})
                      </Typography>
                      <Typography sx={{ mt: 0.1, fontSize: 14, lineHeight: 1.02, fontWeight: 800, color: item.amountColor }}>
                        {item.monto}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gap: 0.65,
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      lg: 'repeat(4, minmax(0, 1fr))',
                    },
                  }}
                >
                  {[
                    {
                      label: 'Tasa de cierre',
                      value:
                        commercialSummary.tasaCierre == null
                          ? '—'
                          : percentFormatter.format(commercialSummary.tasaCierre),
                      helper: 'basado en cierres',
                      backgroundColor: '#fcfdff',
                      borderColor: '#e2e8f0',
                      labelColor: '#64748b',
                      valueColor: '#0f172a',
                    },
                    {
                      label: 'Conversion $',
                      value:
                        commercialSummary.conversionMonetaria == null
                          ? '—'
                          : percentFormatter.format(commercialSummary.conversionMonetaria),
                      helper: 'convertidas vs perdidas',
                      backgroundColor: '#fcfdff',
                      borderColor: '#e2e8f0',
                      labelColor: '#64748b',
                      valueColor: '#0f172a',
                    },
                    {
                      label: 'Ticket promedio convertido',
                      value: currencyFormatter.format(commercialSummary.ticketPromedioConvertida),
                      helper: 'ticket promedio',
                      backgroundColor: '#fcfdff',
                      borderColor: '#e2e8f0',
                      labelColor: '#64748b',
                      valueColor: '#0f172a',
                    },
                    {
                      label: 'Forecast esperado',
                      value: currencyFormatter.format(commercialSummary.forecastEsperado),
                      helper: 'sobre pipeline extendido',
                      backgroundColor: '#eff6ff',
                      borderColor: '#bfdbfe',
                      labelColor: '#1d4ed8',
                      valueColor: '#1e3a8a',
                    },
                  ].map((item) => (
                    <Box
                      key={item.label}
                      sx={{
                        border: '1px solid',
                        borderColor: item.borderColor,
                        borderRadius: 1.5,
                        px: { xs: 0.75, sm: 0.8 },
                        py: { xs: 0.28, sm: 0.32 },
                        backgroundColor: item.backgroundColor,
                        minWidth: 0,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '0 5px' }}>
                        <Typography sx={{ fontSize: 9, fontWeight: 800, color: item.labelColor, textTransform: 'uppercase', letterSpacing: 0.32, lineHeight: 1.15 }}>
                          {item.label}
                        </Typography>
                        <Typography sx={{ fontSize: 9, color: '#94a3b8', fontWeight: 500, lineHeight: 1.15 }}>
                          {item.helper}
                        </Typography>
                      </Box>
                      <Typography sx={{ mt: 0.06, fontSize: { xs: 12.5, sm: 13 }, lineHeight: 1.02, fontWeight: 800, color: item.valueColor }}>
                        {item.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                <Stack
                  direction={{ xs: 'column', lg: 'row' }}
                  spacing={0.65}
                  alignItems={{ xs: 'stretch', lg: 'center' }}
                  justifyContent="space-between"
                >
                  <TextField
                    placeholder="Buscar cliente o folio..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    size="small"
                    sx={{
                      width: { xs: '100%', lg: 340 },
                      '& .MuiOutlinedInput-root': {
                        minHeight: 38,
                      },
                      '& .MuiOutlinedInput-input': {
                        py: 1,
                      },
                    }}
                  />

                  <Button
                    variant={filtersOpen || activeAdvancedFiltersCount > 0 ? 'contained' : 'outlined'}
                    color={activeAdvancedFiltersCount > 0 ? 'primary' : 'inherit'}
                    startIcon={
                      <Badge color="info" badgeContent={activeAdvancedFiltersCount} invisible={!activeAdvancedFiltersCount}>
                        <FilterAltOutlinedIcon />
                      </Badge>
                    }
                    endIcon={filtersOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    onClick={() => setFiltersOpen((prev) => !prev)}
                    sx={{
                      alignSelf: { xs: 'flex-start', lg: 'center' },
                      minWidth: 132,
                      minHeight: 38,
                      fontWeight: 700,
                      textTransform: 'none',
                      py: 0.75,
                      boxShadow: filtersOpen || activeAdvancedFiltersCount > 0 ? '0 6px 16px rgba(29, 47, 104, 0.16)' : 'none',
                    }}
                  >
                    {activeAdvancedFiltersCount > 0 ? `Filtrar (${activeAdvancedFiltersCount})` : 'Filtrar'}
                  </Button>
                </Stack>

                <Collapse in={filtersOpen} timeout="auto" unmountOnExit={false}>
                  <Box
                    sx={{
                      border: '1px solid #dbe2f0',
                      borderRadius: 2,
                      px: { xs: 1.25, sm: 1.5 },
                      py: 1.25,
                      background: 'linear-gradient(180deg, #fbfcff 0%, #f6f8fd 100%)',
                    }}
                  >
                    <Stack spacing={1.25}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1d2f68' }}>
                          Filtros avanzados
                        </Typography>
                        {activeAdvancedFiltersCount ? (
                          <Chip size="small" color="primary" variant="filled" label={`${activeAdvancedFiltersCount} activos`} />
                        ) : null}
                      </Stack>

                      <Grid container spacing={1.25}>
                        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                          <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DatePicker
                              label="Creación desde"
                              value={draftFilters.fecha_creacion_desde ? dayjs(draftFilters.fecha_creacion_desde) : null}
                              onChange={(val) => setDraftFilters((prev) => ({ ...prev, fecha_creacion_desde: val ? val.format('YYYY-MM-DD') : '' }))}
                              slotProps={{
                                textField: {
                                  size: 'small',
                                  fullWidth: true,
                                  InputProps: draftFilters.fecha_creacion_desde ? {
                                    endAdornment: (
                                      <IconButton size="small" onClick={() => setDraftFilters((prev) => ({ ...prev, fecha_creacion_desde: '' }))}>
                                        <CloseIcon fontSize="small" />
                                      </IconButton>
                                    ),
                                  } : {},
                                },
                              }}
                            />
                          </LocalizationProvider>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                          <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DatePicker
                              label="Creación hasta"
                              value={draftFilters.fecha_creacion_hasta ? dayjs(draftFilters.fecha_creacion_hasta) : null}
                              onChange={(val) => setDraftFilters((prev) => ({ ...prev, fecha_creacion_hasta: val ? val.format('YYYY-MM-DD') : '' }))}
                              slotProps={{
                                textField: {
                                  size: 'small',
                                  fullWidth: true,
                                  InputProps: draftFilters.fecha_creacion_hasta ? {
                                    endAdornment: (
                                      <IconButton size="small" onClick={() => setDraftFilters((prev) => ({ ...prev, fecha_creacion_hasta: '' }))}>
                                        <CloseIcon fontSize="small" />
                                      </IconButton>
                                    ),
                                  } : {},
                                },
                              }}
                            />
                          </LocalizationProvider>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                          <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DatePicker
                              label="Cierre desde"
                              value={draftFilters.fecha_cierre_desde ? dayjs(draftFilters.fecha_cierre_desde) : null}
                              onChange={(val) => setDraftFilters((prev) => ({ ...prev, fecha_cierre_desde: val ? val.format('YYYY-MM-DD') : '' }))}
                              slotProps={{
                                textField: {
                                  size: 'small',
                                  fullWidth: true,
                                  InputProps: draftFilters.fecha_cierre_desde ? {
                                    endAdornment: (
                                      <IconButton size="small" onClick={() => setDraftFilters((prev) => ({ ...prev, fecha_cierre_desde: '' }))}>
                                        <CloseIcon fontSize="small" />
                                      </IconButton>
                                    ),
                                  } : {},
                                },
                              }}
                            />
                          </LocalizationProvider>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                          <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DatePicker
                              label="Cierre hasta"
                              value={draftFilters.fecha_cierre_hasta ? dayjs(draftFilters.fecha_cierre_hasta) : null}
                              onChange={(val) => setDraftFilters((prev) => ({ ...prev, fecha_cierre_hasta: val ? val.format('YYYY-MM-DD') : '' }))}
                              slotProps={{
                                textField: {
                                  size: 'small',
                                  fullWidth: true,
                                  InputProps: draftFilters.fecha_cierre_hasta ? {
                                    endAdornment: (
                                      <IconButton size="small" onClick={() => setDraftFilters((prev) => ({ ...prev, fecha_cierre_hasta: '' }))}>
                                        <CloseIcon fontSize="small" />
                                      </IconButton>
                                    ),
                                  } : {},
                                },
                              }}
                            />
                          </LocalizationProvider>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                          <Autocomplete
                            size="small"
                            options={clientesOptions}
                            value={draftFilters.cliente || null}
                            onChange={(_, value) => setDraftFilters((prev) => ({ ...prev, cliente: value ?? '' }))}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                size="small"
                                fullWidth
                                label="Cliente"
                                placeholder="Todos"
                                InputLabelProps={params.InputLabelProps as any}
                                InputProps={{
                                  ...params.InputProps,
                                  endAdornment: (
                                    <>
                                      {draftFilters.cliente ? (
                                        <IconButton size="small" onClick={() => setDraftFilters((prev) => ({ ...prev, cliente: '' }))}>
                                          <CloseIcon fontSize="small" />
                                        </IconButton>
                                      ) : null}
                                      {params.InputProps.endAdornment}
                                    </>
                                  ),
                                }}
                              />
                            )}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                          <Autocomplete
                            size="small"
                            options={vendedoresOptions}
                            value={draftFilters.vendedor || null}
                            onChange={(_, value) => setDraftFilters((prev) => ({ ...prev, vendedor: value ?? '' }))}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                size="small"
                                fullWidth
                                label="Vendedor"
                                placeholder="Todos"
                                InputLabelProps={params.InputLabelProps as any}
                                InputProps={{
                                  ...params.InputProps,
                                  endAdornment: (
                                    <>
                                      {draftFilters.vendedor ? (
                                        <IconButton size="small" onClick={() => setDraftFilters((prev) => ({ ...prev, vendedor: '' }))}>
                                          <CloseIcon fontSize="small" />
                                        </IconButton>
                                      ) : null}
                                      {params.InputProps.endAdornment}
                                    </>
                                  ),
                                }}
                              />
                            )}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                          <TextField
                            size="small"
                            fullWidth
                            label="Monto mínimo"
                            type="number"
                            value={draftFilters.monto_min}
                            onChange={(event) => setDraftFilters((prev) => ({ ...prev, monto_min: event.target.value }))}
                            {...(draftFilters.monto_min ? {
                              InputProps: {
                                endAdornment: (
                                  <IconButton size="small" onClick={() => setDraftFilters((prev) => ({ ...prev, monto_min: '' }))}>
                                    <CloseIcon fontSize="small" />
                                  </IconButton>
                                ),
                              },
                            } : {})}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                          <TextField
                            size="small"
                            fullWidth
                            label="Monto máximo"
                            type="number"
                            value={draftFilters.monto_max}
                            onChange={(event) => setDraftFilters((prev) => ({ ...prev, monto_max: event.target.value }))}
                            {...(draftFilters.monto_max ? {
                              InputProps: {
                                endAdornment: (
                                  <IconButton size="small" onClick={() => setDraftFilters((prev) => ({ ...prev, monto_max: '' }))}>
                                    <CloseIcon fontSize="small" />
                                  </IconButton>
                                ),
                              },
                            } : {})}
                          />
                        </Grid>
                      </Grid>

                      <Stack direction="row" justifyContent="flex-end" spacing={1}>
                        <Button variant="outlined" onClick={handleLimpiarFiltros}>
                          Limpiar
                        </Button>
                        <Button variant="contained" onClick={handleAplicarFiltros} sx={{ backgroundColor: '#1d2f68', '&:hover': { backgroundColor: '#162551' } }}>
                          Aplicar filtros
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                </Collapse>
              </Stack>
            </PaperCard>

            <PaperCard>
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  position: 'relative',
                  overflow: 'visible',
                }}
              >
                <DataGrid
                  rows={filteredOportunidades}
                  columns={columns}
                  getRowId={(row) => row.id}
                  columnVisibilityModel={effectiveColumnVisibilityModel}
                  sortModel={sortModel}
                  columnHeaderHeight={34}
                  rowHeight={40}
                  loading={loading || loadingPreferences}
                  disableRowSelectionOnClick
                  {...(rowSlotProps ? { slotProps: { row: rowSlotProps } } : {})}
                  hideFooterPagination
                  onSortModelChange={(model) => setSortModel(model)}
                  onColumnVisibilityModelChange={(model) => {
                    const nextModel = {
                      ...model,
                      menu: true,
                      acciones: SHOW_GRID_ACTIONS,
                    };
                    setColumnVisibilityModel(nextModel);
                  }}
                  onColumnWidthChange={(params: GridColumnResizeParams) => {
                    setColumnWidths((prev) => ({ ...prev, [params.colDef.field]: params.width }));
                  }}
                  localeText={{
                    ...esES.components.MuiDataGrid.defaultProps.localeText,
                    noRowsLabel: 'No hay oportunidades que coincidan con los filtros actuales.',
                  }}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    '& .MuiDataGrid-columnHeaders': {
                      fontSize: 12.5,
                      minHeight: 34,
                      color: '#ffffff',
                    },
                    '& .MuiDataGrid-columnHeader': {
                      backgroundColor: '#1d2f68',
                      color: '#ffffff',
                    },
                    '& .MuiDataGrid-columnHeaderTitle': {
                      fontWeight: 600,
                      color: '#ffffff',
                    },
                    '& .MuiDataGrid-sortIcon': {
                      color: '#ffffff',
                    },
                    '& .MuiDataGrid-menuIcon': {
                      color: '#ffffff',
                    },
                    '& .MuiDataGrid-iconButtonContainer .MuiSvgIcon-root': {
                      color: '#ffffff',
                    },
                    '& .MuiDataGrid-columnHeader .MuiSvgIcon-root': {
                      color: '#ffffff',
                    },
                    '& .MuiDataGrid-columnSeparator': {
                      color: 'rgba(255,255,255,0.25)',
                    },
                    '& .MuiDataGrid-cell': {
                      fontSize: 14.5,
                      display: 'flex',
                      alignItems: 'center',
                      py: 0.9,
                      px: 1,
                      borderTop: '1px solid #f1f5f9',
                    },
                    '& .MuiDataGrid-row': {
                      minHeight: 40,
                      transition: 'all 0.2s ease',
                    },
                    '& .MuiDataGrid-row:nth-of-type(even)': {
                      backgroundColor: 'rgba(0, 120, 70, 0.05)',
                    },
                    '& .MuiDataGrid-row:hover': {
                      backgroundColor: 'rgba(15, 23, 42, 0.04)',
                    },
                    '& .MuiDataGrid-row.Mui-selected': {
                      backgroundColor: 'rgba(29, 47, 104, 0.08)',
                    },
                    '& .MuiDataGrid-row.Mui-selected:hover': {
                      backgroundColor: 'rgba(29, 47, 104, 0.12)',
                    },
                  }}
                />
              </Box>
            </PaperCard>

            <GridContextMenu
              actions={contextMenuActions}
              anchorPosition={contextMenuPosition}
              open={Boolean(contextMenuRow && contextMenuPosition)}
              onClose={closeContextMenu}
            />

            <ActividadSeguimientoDrawer
              open={seguimientoDrawerOpen}
              onClose={closeSeguimientoDrawer}
              target={seguimientoTarget}
              onActivitiesChanged={loadSeguimientoResumen}
            />

            <Menu
              anchorEl={statusMenu.anchorEl}
              open={Boolean(statusMenu.anchorEl && statusMenu.row)}
              onClose={closeStatusMenu}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
              {statusMenu.row ? getAllowedTransitions(statusMenu.row.estatus, statusMenu.row).map((status) => (
                <MenuItem
                  key={status}
                  onClick={() => {
                    void handleSelectStatus(status);
                  }}
                  disabled={status === 'convertida' || updatingStatusId === statusMenu.row?.id}
                >
                  {getStatusLabel(status)}
                </MenuItem>
              )) : null}
            </Menu>

            <Dialog open={cancelDialog.open} onClose={() => setCancelDialog({ open: false, row: null, motivo: '', error: null })} fullWidth maxWidth="sm">
              <DialogTitle>Cancelar oportunidad</DialogTitle>
              <DialogContent>
                <Stack spacing={1.5} sx={{ pt: 1 }}>
                  <Typography variant="body2" sx={{ color: '#475569' }}>
                    Captura el motivo de cancelacion para registrar el cambio de estatus.
                  </Typography>
                  <TextField
                    autoFocus
                    label="Motivo"
                    multiline
                    minRows={4}
                    value={cancelDialog.motivo}
                    onChange={(event) => setCancelDialog((prev) => ({ ...prev, motivo: event.target.value, error: null }))}
                    error={Boolean(cancelDialog.error)}
                    helperText={cancelDialog.error || undefined}
                    fullWidth
                  />
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setCancelDialog({ open: false, row: null, motivo: '', error: null })}>Cancelar</Button>
                <Button variant="contained" color="error" onClick={() => { void handleConfirmCancelacion(); }} disabled={updatingStatusId === cancelDialog.row?.id}>
                  Confirmar
                </Button>
              </DialogActions>
            </Dialog>

            <Dialog
              open={conversionLockDialog.open}
              onClose={() => setConversionLockDialog(EMPTY_CONVERSION_LOCK_DIALOG)}
              fullWidth
              maxWidth="sm"
            >
              <DialogTitle>{conversionLockDialog.title}</DialogTitle>
              <DialogContent>
                <Typography variant="body1" sx={{ color: '#475569', pt: 1 }}>
                  {conversionLockDialog.message}
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button variant="contained" onClick={() => setConversionLockDialog(EMPTY_CONVERSION_LOCK_DIALOG)}>
                  Entendido
                </Button>
              </DialogActions>
            </Dialog>


            <Dialog
              open={dateDialog.open}
              onClose={() => setDateDialog((prev) => ({ ...prev, open: false }))}
              fullWidth
              maxWidth="xs"
            >
              <DialogTitle>{dateDialog.label}</DialogTitle>
              <DialogContent>
                <Stack spacing={1.5} sx={{ pt: 1 }}>
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker
                      label={dateDialog.label}
                      value={dateDialog.value ? dayjs(dateDialog.value) : null}
                      onChange={(value) => setDateDialog((prev) => ({ ...prev, value: value ? value.format('YYYY-MM-DD') : '' }))}
                      slotProps={{
                        textField: {
                          size: 'small',
                          fullWidth: true,
                        },
                      }}
                    />
                  </LocalizationProvider>
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setDateDialog((prev) => ({ ...prev, open: false }))}>Cancelar</Button>
                <Button variant="contained" onClick={() => { void handleSaveDateField(); }} disabled={savingOperacionId === dateDialog.rowId}>
                  Guardar
                </Button>
              </DialogActions>
            </Dialog>

            <Dialog
              open={observacionesDialog.open}
              onClose={() => setObservacionesDialog({ open: false, rowId: null, value: '' })}
              fullWidth
              maxWidth="sm"
            >
              <DialogTitle>Observaciones</DialogTitle>
              <DialogContent>
                <Stack spacing={1.5} sx={{ pt: 1 }}>
                  <TextField
                    autoFocus
                    label="Observaciones"
                    multiline
                    minRows={5}
                    value={observacionesDialog.value}
                    onChange={(event) => setObservacionesDialog((prev) => ({ ...prev, value: event.target.value }))}
                    fullWidth
                  />
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setObservacionesDialog({ open: false, rowId: null, value: '' })}>Cancelar</Button>
                <Button variant="contained" onClick={() => { void handleSaveObservaciones(); }} disabled={savingOperacionId === observacionesDialog.rowId}>
                  Guardar
                </Button>
              </DialogActions>
            </Dialog>

            <Dialog
              open={deleteDialog.open}
              onClose={handleCloseDeleteDialog}
              fullWidth
              maxWidth="xs"
            >
              <DialogTitle>Eliminar oportunidad</DialogTitle>
              <DialogContent>
                <Stack spacing={1.5} sx={{ pt: 1 }}>
                  <Typography>¿Deseas eliminar esta oportunidad?</Typography>
                  {deleteDialog.row?.cotizacion_principal_id ? (
                    <Alert severity="warning" variant="outlined">
                      Si tiene cotización asociada, también será eliminada.
                    </Alert>
                  ) : null}
                  <Typography sx={{ color: '#b91c1c', fontWeight: 600 }}>
                    Esta acción no se puede deshacer.
                  </Typography>
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleCloseDeleteDialog} disabled={savingOperacionId !== null}>Cancelar</Button>
                <Button variant="contained" color="error" onClick={() => { void handleConfirmDelete(); }} disabled={savingOperacionId !== null}>
                  {savingOperacionId !== null ? 'Eliminando...' : 'Eliminar'}
                </Button>
              </DialogActions>
            </Dialog>

            <Snackbar
              open={snackbar.open}
              autoHideDuration={4000}
              onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
              <Alert onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>
                {snackbar.message}
              </Alert>
            </Snackbar>
          </>
        ) : null}
      </Stack>
    </Container>
  );
}

function PaperCard({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        width: '100%',
        position: 'relative',
        overflow: 'visible',
        border: '1px solid #e5e7eb',
        borderRadius: 2,
        p: 1.5,
        backgroundColor: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      {children}
    </Box>
  );
}