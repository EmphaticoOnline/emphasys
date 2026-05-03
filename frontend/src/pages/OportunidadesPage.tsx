import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CloseIcon from '@mui/icons-material/Close';
import EditCalendarOutlinedIcon from '@mui/icons-material/EditCalendarOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { DataGrid, type GridColDef, type GridColumnResizeParams, type GridColumnVisibilityModel, type GridRenderCellParams } from '@mui/x-data-grid';
import { esES } from '@mui/x-data-grid/locales';
import { apiFetch } from '../services/apiFetch';

const COLUMN_VISIBILITY_STORAGE_KEY = 'oportunidades_column_visibility';
const COLUMN_WIDTHS_STORAGE_KEY = 'oportunidades_column_widths';

const DEFAULT_COLUMN_WIDTHS = {
  folio: 150,
  contacto_nombre: 220,
  vendedor_nombre: 180,
  estatus: 185,
  monto_estimado: 150,
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
  monto_estimado: number;
  fecha_estimada_cierre: string;
  fecha_creacion: string;
};

type OportunidadStatus = 'abierta' | 'pausada' | 'ganada' | 'perdida' | 'cancelada';

type StatusFilter = 'todas' | 'abiertas' | 'pausadas' | 'ganadas' | 'perdidas' | 'canceladas';

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
  monto_estimado: number | string | null;
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

type OportunidadUpdatePayload = {
  fecha_estimada_cierre?: string | null;
  fecha_reactivacion_estimada?: string | null;
  observaciones?: string;
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

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
});

const OPORTUNIDAD_STATUS_LABELS: Record<OportunidadStatus, string> = {
  abierta: 'Abierta',
  pausada: 'Pausada',
  ganada: 'Ganada',
  perdida: 'Perdida',
  cancelada: 'Cancelada',
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeStatus(value: string): OportunidadStatus {
  const normalized = normalizeText(value);
  if (normalized === 'pausada') return 'pausada';
  if (normalized === 'ganada') return 'ganada';
  if (normalized === 'perdida') return 'perdida';
  if (normalized === 'cancelada') return 'cancelada';
  return 'abierta';
}

function isOpenStatus(estatus: string): boolean {
  const normalized = normalizeText(estatus);
  return normalized === 'abierta' || normalized === 'pausada';
}

function getQuickBucket(estatus: string): Exclude<StatusFilter, 'todas' | 'canceladas'> | 'otras' {
  const normalized = normalizeText(estatus);
  if (normalized === 'ganada') return 'ganadas';
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

function formatMetric(monto: number, cantidad: number): string {
  return `${currencyFormatter.format(monto)} • ${cantidad} oportunidades`;
}

function normalizeOportunidad(item: OportunidadApiResponse): Oportunidad {
  const estatus = normalizeStatus(item.estatus?.trim().toLowerCase() || 'abierta');

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
    monto_estimado: Number(item.monto_estimado ?? 0),
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

  if (normalized === 'ganada') {
    return { label: OPORTUNIDAD_STATUS_LABELS.ganada, backgroundColor: '#dcfce7', textColor: '#166534', borderColor: '#86efac' };
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
  if (bucket === 'ganadas') return 'success';
  if (bucket === 'perdidas') return 'error';
  if (bucket === 'pausadas') return 'warning';
  if (bucket === 'abiertas') return 'primary';
  return 'default';
}

function getStatusIndicatorColor(estatus: string): string {
  const bucket = getQuickBucket(estatus);
  if (bucket === 'ganadas') return '#2e7d32';
  if (bucket === 'perdidas') return '#d32f2f';
  if (bucket === 'pausadas') return '#ed6c02';
  if (bucket === 'abiertas') return '#1976d2';
  return '#94a3b8';
}

function getAllowedTransitions(currentStatus: string, row: Oportunidad): OportunidadStatus[] {
  const normalized = normalizeStatus(currentStatus);

  if (normalized === 'abierta') return ['pausada', 'perdida', 'cancelada'];
  if (normalized === 'pausada') return ['abierta', 'perdida', 'cancelada'];
  if (normalized === 'ganada') return row.has_factura_activa ? [] : ['perdida', 'cancelada'];
  if (normalized === 'perdida') return ['abierta', 'cancelada'];
  if (normalized === 'cancelada') return ['abierta', 'perdida'];

  return [];
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

export default function OportunidadesPage() {
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMenu, setStatusMenu] = useState<StatusMenuState>({ anchorEl: null, row: null });
  const [cancelDialog, setCancelDialog] = useState<CancelDialogState>({ open: false, row: null, motivo: '', error: null });
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [savingOperacionId, setSavingOperacionId] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', severity: 'info' });
  const [dateDialog, setDateDialog] = useState<DateDialogState>({
    open: false,
    rowId: null,
    field: 'fecha_estimada_cierre',
    label: 'Fecha estimada de cierre',
    value: '',
  });
  const [observacionesDialog, setObservacionesDialog] = useState<ObservacionesDialogState>({ open: false, rowId: null, value: '' });
  const [columnVisibilityModel, setColumnVisibilityModel] = useState<GridColumnVisibilityModel>({});
  const [columnWidths, setColumnWidths] = useState<Partial<Record<OportunidadColumnField, number>>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState<StatusFilter>('todas');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>(INITIAL_ADVANCED_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AdvancedFilters>(INITIAL_ADVANCED_FILTERS);

  useEffect(() => {
    let isMounted = true;

    const loadOportunidades = async () => {
      try {
        setLoading(true);
        const data = await apiFetch<OportunidadApiResponse[]>('/api/crm/oportunidades');
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
    const saved = localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY);
    if (!saved) return;

    try {
      setColumnVisibilityModel(JSON.parse(saved) as GridColumnVisibilityModel);
    } catch (err) {
      console.warn('No se pudo restaurar la visibilidad de columnas de oportunidades', err);
    }
  }, []);

  useEffect(() => {
    const savedWidths = localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
    if (!savedWidths) return;

    try {
      setColumnWidths(JSON.parse(savedWidths) as Partial<Record<OportunidadColumnField, number>>);
    } catch (err) {
      console.warn('No se pudo restaurar el ancho de columnas de oportunidades', err);
    }
  }, []);

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
        if (filtroEstatus === 'ganadas') return normalizeText(item.estatus) === 'ganada';
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
        result = result.filter((item) => item.monto_estimado >= montoMin);
      }
    }

    if (appliedFilters.monto_max !== '') {
      if (!Number.isNaN(montoMax as number) && montoMax !== null) {
        result = result.filter((item) => item.monto_estimado <= montoMax);
      }
    }

    return result;
  }, [oportunidades, searchTerm, filtroEstatus, appliedFilters]);

  const totals = useMemo(() => {
    const sumMonto = (items: Oportunidad[]) => items.reduce((acc, item) => acc + item.monto_estimado, 0);
    const abiertas = filteredOportunidades.filter((item) => normalizeText(item.estatus) === 'abierta');
    const pausadas = filteredOportunidades.filter((item) => normalizeText(item.estatus) === 'pausada');
    const ganadas = filteredOportunidades.filter((item) => normalizeText(item.estatus) === 'ganada');
    const perdidas = filteredOportunidades.filter((item) => normalizeText(item.estatus) === 'perdida');
    const canceladas = filteredOportunidades.filter((item) => normalizeText(item.estatus) === 'cancelada');

    return {
      pipeline: {
        monto: sumMonto(filteredOportunidades),
        cantidad: filteredOportunidades.length,
      },
      abiertas: {
        monto: sumMonto(abiertas),
        cantidad: abiertas.length,
      },
      pausadas: {
        monto: sumMonto(pausadas),
        cantidad: pausadas.length,
      },
      ganadas: {
        monto: sumMonto(ganadas),
        cantidad: ganadas.length,
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

  const activeAdvancedFiltersCount = Object.values(appliedFilters).filter((value) => value !== '').length;

  const closeStatusMenu = useCallback(() => {
    setStatusMenu({ anchorEl: null, row: null });
  }, []);

  const handleOpenStatusMenu = useCallback((event: MouseEvent<HTMLElement>, row: Oportunidad) => {
    event.preventDefault();
    event.stopPropagation();

    if (updatingStatusId === row.id) {
      return;
    }

    if (normalizeStatus(row.estatus) === 'ganada' && row.has_factura_activa) {
      setSnackbar({
        open: true,
        message: 'No se puede cambiar una oportunidad ganada mientras su cotizacion principal tenga una factura activa.',
        severity: 'warning',
      });
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

    if (nextStatus === 'cancelada') {
      setCancelDialog({ open: true, row, motivo: '', error: null });
      return;
    }

    await applyStatusChange(row, nextStatus);
  }, [applyStatusChange, closeStatusMenu, statusMenu.row]);

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

  const columns = useMemo<GridColDef<Oportunidad>[]>(() => [
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
      field: 'monto_estimado',
      headerName: 'Monto estimado',
      width: getColumnWidth('monto_estimado'),
      minWidth: 120,
      resizable: true,
      sortable: true,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams<Oportunidad, number>) => (
        <Box sx={{ width: '100%', textAlign: 'right' }}>
          <Typography variant="body2" fontWeight={700} sx={{ fontSize: 14.5 }}>
            {currencyFormatter.format(Number(params.value ?? 0))}
          </Typography>
        </Box>
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
  ], [getColumnWidth, handleOpenDateDialog, handleOpenObservacionesDialog, handleOpenStatusMenu, savingOperacionId, updatingStatusId]);

  const handleAplicarFiltros = () => {
    setAppliedFilters(draftFilters);
  };

  const handleLimpiarFiltros = () => {
    setSearchTerm('');
    setFiltroEstatus('todas');
    setDraftFilters(INITIAL_ADVANCED_FILTERS);
    setAppliedFilters(INITIAL_ADVANCED_FILTERS);
  };

  return (
    <Container maxWidth={false} sx={{ py: 2 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#0f172a' }}>
            Oportunidades de venta
          </Typography>
          <Typography sx={{ color: '#475569', mt: 0.75 }}>
            Consulta y da seguimiento a tus oportunidades de venta.
          </Typography>
        </Box>

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
              <Stack spacing={1}>
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
                      label: 'Total pipeline',
                      monto: currencyFormatter.format(totals.pipeline.monto),
                      cantidad: `${totals.pipeline.cantidad} oportunidades`,
                      backgroundColor: '#eff6ff',
                      borderColor: '#bfdbfe',
                      labelColor: '#1d4ed8',
                      amountColor: '#1e3a8a',
                    },
                    {
                      value: 'abiertas' as const,
                      label: 'Abiertas',
                      monto: currencyFormatter.format(totals.abiertas.monto),
                      cantidad: `${totals.abiertas.cantidad} oportunidades`,
                      backgroundColor: '#f8fafc',
                      borderColor: '#cbd5e1',
                      labelColor: '#475569',
                      amountColor: '#1e40af',
                    },
                    {
                      value: 'pausadas' as const,
                      label: 'Pausadas',
                      monto: currencyFormatter.format(totals.pausadas.monto),
                      cantidad: `${totals.pausadas.cantidad} oportunidades`,
                      backgroundColor: '#fff7ed',
                      borderColor: '#fdba74',
                      labelColor: '#c2410c',
                      amountColor: '#9a3412',
                    },
                    {
                      value: 'ganadas' as const,
                      label: 'Ganadas',
                      monto: currencyFormatter.format(totals.ganadas.monto),
                      cantidad: `${totals.ganadas.cantidad} oportunidades`,
                      backgroundColor: '#ecfdf5',
                      borderColor: '#a7f3d0',
                      labelColor: '#047857',
                      amountColor: '#065f46',
                    },
                    {
                      value: 'perdidas' as const,
                      label: 'Perdidas',
                      monto: currencyFormatter.format(totals.perdidas.monto),
                      cantidad: `${totals.perdidas.cantidad} oportunidades`,
                      backgroundColor: '#fef2f2',
                      borderColor: '#fecaca',
                      labelColor: '#b91c1c',
                      amountColor: '#991b1b',
                    },
                    {
                      value: 'canceladas' as const,
                      label: 'Canceladas',
                      monto: currencyFormatter.format(totals.canceladas.monto),
                      cantidad: `${totals.canceladas.cantidad} oportunidades`,
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
                        px: 0.9,
                        py: 0.5,
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
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: item.labelColor, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        {item.label}
                      </Typography>
                      <Typography sx={{ mt: 0.15, fontSize: 18, lineHeight: 1.02, fontWeight: 800, color: item.amountColor }}>
                        {item.monto}
                      </Typography>
                      <Typography sx={{ mt: 0.02, fontSize: 10.5, color: '#64748b', fontWeight: 500 }}>
                        {item.cantidad}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                <Stack
                  direction={{ xs: 'column', lg: 'row' }}
                  spacing={0.75}
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
                  columnVisibilityModel={columnVisibilityModel}
                  columnHeaderHeight={34}
                  rowHeight={40}
                  loading={loading}
                  disableRowSelectionOnClick
                  hideFooterPagination
                  onColumnVisibilityModelChange={(model) => {
                    setColumnVisibilityModel(model);
                    localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(model));
                  }}
                  onColumnWidthChange={(params: GridColumnResizeParams) => {
                    setColumnWidths((prev) => {
                      const next = { ...prev, [params.colDef.field]: params.width };
                      localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(next));
                      return next;
                    });
                  }}
                  initialState={{
                    sorting: {
                      sortModel: [{ field: 'fecha_creacion', sort: 'desc' }],
                    },
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
                      backgroundColor: '#1e2a5a',
                      color: '#ffffff',
                    },
                    '& .MuiDataGrid-columnHeaderTitle': {
                      fontWeight: 700,
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
                      backgroundColor: 'rgba(0,0,0,0.04)',
                    },
                  }}
                />
              </Box>
            </PaperCard>

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
                  disabled={status === 'ganada' || updatingStatusId === statusMenu.row?.id}
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