import * as React from 'react';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import AddTaskOutlinedIcon from '@mui/icons-material/AddTaskOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import CloseIcon from '@mui/icons-material/Close';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Popover,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../services/apiFetch';
import { loadSession } from '../../session/sessionStorage';

dayjs.locale('es');

type TipoActividad = 'llamada' | 'whatsapp' | 'visita' | 'tarea';

type Actividad = {
  id: number;
  tipo_actividad: TipoActividad;
  fecha_programada: string;
  estatus: 'pendiente' | 'realizada' | 'cancelada' | string;
  notas: string | null;
  contacto_id: number | null;
  oportunidad_id: number | null;
  cliente_nombre: string | null;
  resultado?: string | null;
  fecha_realizacion?: string | null;
};

type CrearActividadPayload = {
  usuario_asignado_id: number;
  tipo_actividad: TipoActividad;
  fecha_programada: string;
  notas: string | null;
  contacto_id?: number | null;
  oportunidad_id?: number | null;
  recordatorio: boolean;
  recordatorio_minutos: number | null;
};

type CreateActividadDialogState = {
  open: boolean;
  tipo_actividad: TipoActividad;
  fecha_programada: string;
  notas: string;
  recordatorio: boolean;
  recordatorio_minutos: string;
};

type RealizarActividadDialogState = {
  open: boolean;
  actividad: Actividad | null;
  resultado: string;
  error: string | null;
};

type SeguimientoStatusChip = {
  label: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
};

export type SeguimientoTarget = {
  kind: 'oportunidad' | 'contacto';
  id: number;
  title: string;
  subtitle: string;
  montoLabel?: string;
  montoValor?: number | null;
  statusChip?: SeguimientoStatusChip | null;
};

type ActividadSeguimientoDrawerProps = {
  open: boolean;
  onClose: () => void;
  target: SeguimientoTarget | null;
  onActivitiesChanged?: () => Promise<void> | void;
};

const ACTIVIDAD_OPTIONS: Array<{ value: TipoActividad; label: string }> = [
  { value: 'llamada', label: 'Llamada' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'visita', label: 'Visita' },
  { value: 'tarea', label: 'Tarea' },
];

const EMPTY_CREATE_ACTIVIDAD_DIALOG: CreateActividadDialogState = {
  open: false,
  tipo_actividad: 'llamada',
  fecha_programada: '',
  notas: '',
  recordatorio: false,
  recordatorio_minutos: '',
};

const EMPTY_REALIZAR_ACTIVIDAD_DIALOG: RealizarActividadDialogState = {
  open: false,
  actividad: null,
  resultado: '',
  error: null,
};

function normalizeActividadSearchValue(value: string | null | undefined) {
  return (value ?? '').trim().toLocaleLowerCase();
}

function matchesActividadSearch(actividad: Actividad, normalizedSearchTerm: string) {
  if (!normalizedSearchTerm) {
    return true;
  }

  return [actividad.notas, actividad.resultado, actividad.cliente_nombre].some((value) =>
    normalizeActividadSearchValue(value).includes(normalizedSearchTerm)
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function defaultProgrammedDateTime(): string {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  const timezoneOffset = date.getTimezoneOffset();
  return new Date(date.getTime() - timezoneOffset * 60000).toISOString().slice(0, 16);
}

function formatTipoActividadLabel(tipo: string): string {
  const option = ACTIVIDAD_OPTIONS.find((item) => item.value === tipo);
  return option?.label || tipo;
}

function getActividadDuePresentation(fechaProgramada: string) {
  const date = new Date(fechaProgramada);

  if (Number.isNaN(date.getTime())) {
    return {
      label: 'Sin fecha',
      color: '#475569',
      accentColor: '#94a3b8',
      backgroundColor: '#f8fafc',
      borderColor: '#cbd5e1',
    };
  }

  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();

  if (date < now) {
    return {
      label: 'Vencida',
      color: '#b91c1c',
      accentColor: '#dc2626',
      backgroundColor: '#fef2f2',
      borderColor: '#fecaca',
    };
  }

  if (isSameDay) {
    return {
      label: 'Hoy',
      color: '#b45309',
      accentColor: '#f59e0b',
      backgroundColor: '#fff7ed',
      borderColor: '#fdba74',
    };
  }

  return {
    label: 'Pendiente',
    color: '#1d4ed8',
    accentColor: '#2563eb',
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  };
}

async function fetchActividades(target: SeguimientoTarget) {
  const params = new URLSearchParams(
    target.kind === 'oportunidad'
      ? { oportunidad_id: String(target.id) }
      : { contacto_id: String(target.id) }
  );

  return apiFetch<Actividad[]>(`/api/crm/actividades?${params.toString()}`);
}

async function createActividad(payload: CrearActividadPayload) {
  return apiFetch<Actividad>('/api/crm/actividades', {
    method: 'POST',
    body: payload as any,
  });
}

async function realizarActividad(actividadId: number, resultado: string) {
  return apiFetch<Actividad>(`/api/crm/actividades/${actividadId}`, {
    method: 'PATCH',
    body: {
      estatus: 'realizada',
      resultado,
    } as any,
  });
}

async function reagendarActividad(actividad: Actividad, nuevaFecha: string) {
  return apiFetch<Actividad>(`/api/crm/actividades/${actividad.id}`, {
    method: 'PUT',
    body: {
      tipo_actividad: actividad.tipo_actividad,
      notas: actividad.notas,
      fecha_programada: new Date(nuevaFecha).toISOString(),
      oportunidad_id: actividad.oportunidad_id,
      recordatorio: false,
      recordatorio_minutos: null,
    } as any,
  });
}

async function cancelarActividad(actividadId: number) {
  return apiFetch<Actividad>(`/api/crm/actividades/${actividadId}`, {
    method: 'PATCH',
    body: { estatus: 'cancelada' } as any,
  });
}

function obtenerFechaLocalParaInput(valor: string) {
  if (!valor) return '';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  const desfase = fecha.getTimezoneOffset();
  return new Date(fecha.getTime() - desfase * 60000).toISOString().slice(0, 16);
}

export default function ActividadSeguimientoDrawer({ open, onClose, target, onActivitiesChanged }: ActividadSeguimientoDrawerProps) {
  const navigate = useNavigate();
  const session = React.useMemo(() => loadSession(), []);
  const sessionUserId = session.user?.id ?? null;
  const [seguimientoSearchTerm, setSeguimientoSearchTerm] = React.useState('');
  const [actividades, setActividades] = React.useState<Actividad[]>([]);
  const [loadingActividadesTargetId, setLoadingActividadesTargetId] = React.useState<number | null>(null);
  const [savingActividad, setSavingActividad] = React.useState(false);
  const [createActividadDialog, setCreateActividadDialog] = React.useState<CreateActividadDialogState>(EMPTY_CREATE_ACTIVIDAD_DIALOG);
  const [realizarActividadDialog, setRealizarActividadDialog] = React.useState<RealizarActividadDialogState>(EMPTY_REALIZAR_ACTIVIDAD_DIALOG);

  const [reagendarAnchorEl, setReagendarAnchorEl] = React.useState<HTMLElement | null>(null);
  const [actividadPorReagendar, setActividadPorReagendar] = React.useState<Actividad | null>(null);
  const [nuevaFechaReagendar, setNuevaFechaReagendar] = React.useState('');
  const [savingReagendar, setSavingReagendar] = React.useState(false);

  const [cancelarDialog, setCancelarDialog] = React.useState<{ open: boolean; actividad: Actividad | null; error: string | null }>({ open: false, actividad: null, error: null });
  const [savingCancelar, setSavingCancelar] = React.useState(false);

  const normalizedSeguimientoSearchTerm = React.useMemo(
    () => normalizeActividadSearchValue(seguimientoSearchTerm),
    [seguimientoSearchTerm]
  );

  const filteredActividades = React.useMemo(
    () => actividades.filter((actividad) => matchesActividadSearch(actividad, normalizedSeguimientoSearchTerm)),
    [actividades, normalizedSeguimientoSearchTerm]
  );

  const actividadesPendientes = React.useMemo(
    () => filteredActividades.filter((actividad) => actividad.estatus === 'pendiente'),
    [filteredActividades]
  );

  const actividadesRealizadas = React.useMemo(
    () => filteredActividades.filter((actividad) => actividad.estatus === 'realizada'),
    [filteredActividades]
  );

  const showNoSearchMatches = Boolean(target && normalizedSeguimientoSearchTerm.length > 0 && filteredActividades.length === 0);

  const notifyActivitiesChanged = React.useCallback(async () => {
    await Promise.resolve(onActivitiesChanged?.());
  }, [onActivitiesChanged]);

  const loadActividades = React.useCallback(async () => {
    if (!target) {
      setActividades([]);
      return;
    }

    setLoadingActividadesTargetId(target.id);

    try {
      const data = await fetchActividades(target);
      setActividades(Array.isArray(data) ? data : []);
    } finally {
      setLoadingActividadesTargetId((current) => (current === target.id ? null : current));
    }
  }, [target]);

  React.useEffect(() => {
    if (!open || !target) {
      return;
    }

    setSeguimientoSearchTerm('');
    void loadActividades();
  }, [loadActividades, open, target]);

  React.useEffect(() => {
    if (!open) {
      setCreateActividadDialog(EMPTY_CREATE_ACTIVIDAD_DIALOG);
      setRealizarActividadDialog(EMPTY_REALIZAR_ACTIVIDAD_DIALOG);
    }
  }, [open]);

  const openCreateActividadDialog = React.useCallback(() => {
    setCreateActividadDialog({
      open: true,
      tipo_actividad: 'llamada',
      fecha_programada: defaultProgrammedDateTime(),
      notas: '',
      recordatorio: false,
      recordatorio_minutos: '',
    });
  }, []);

  const closeCreateActividadDialog = React.useCallback(() => {
    setCreateActividadDialog(EMPTY_CREATE_ACTIVIDAD_DIALOG);
  }, []);

  const closeRealizarActividadDialog = React.useCallback(() => {
    setRealizarActividadDialog(EMPTY_REALIZAR_ACTIVIDAD_DIALOG);
  }, []);

  const handleGuardarActividad = React.useCallback(async () => {
    if (!target) {
      return;
    }

    if (!sessionUserId) {
      return;
    }

    if (!createActividadDialog.fecha_programada) {
      return;
    }

    const recordatorioMinutos = createActividadDialog.recordatorio_minutos.trim();

    if (createActividadDialog.recordatorio) {
      const minutos = Number(recordatorioMinutos);

      if (!recordatorioMinutos || !Number.isInteger(minutos) || minutos <= 0) {
        return;
      }
    }

    setSavingActividad(true);

    try {
      await createActividad({
        usuario_asignado_id: sessionUserId,
        tipo_actividad: createActividadDialog.tipo_actividad,
        fecha_programada: new Date(createActividadDialog.fecha_programada).toISOString(),
        notas: createActividadDialog.notas.trim() || null,
        contacto_id: target.kind === 'contacto' ? target.id : undefined,
        oportunidad_id: target.kind === 'oportunidad' ? target.id : null,
        recordatorio: createActividadDialog.recordatorio,
        recordatorio_minutos: createActividadDialog.recordatorio ? Number(recordatorioMinutos) : null,
      });

      closeCreateActividadDialog();
      await loadActividades();
      await notifyActivitiesChanged();
    } finally {
      setSavingActividad(false);
    }
  }, [closeCreateActividadDialog, createActividadDialog, loadActividades, notifyActivitiesChanged, sessionUserId, target]);

  const handleOpenRealizarActividadDialog = React.useCallback((actividad: Actividad) => {
    setRealizarActividadDialog({
      open: true,
      actividad,
      resultado: '',
      error: null,
    });
  }, []);

  const handleReagendarClick = React.useCallback((actividad: Actividad, event: React.MouseEvent<HTMLElement>) => {
    setActividadPorReagendar(actividad);
    setNuevaFechaReagendar(obtenerFechaLocalParaInput(actividad.fecha_programada));
    setReagendarAnchorEl(event.currentTarget);
  }, []);

  const handleCloseReagendar = React.useCallback(() => {
    setReagendarAnchorEl(null);
    setActividadPorReagendar(null);
    setNuevaFechaReagendar('');
  }, []);

  const handleConfirmReagendar = React.useCallback(async () => {
    if (!actividadPorReagendar || !nuevaFechaReagendar) return;

    setSavingReagendar(true);
    try {
      await reagendarActividad(actividadPorReagendar, nuevaFechaReagendar);
      handleCloseReagendar();
      await loadActividades();
      await notifyActivitiesChanged();
    } finally {
      setSavingReagendar(false);
    }
  }, [actividadPorReagendar, nuevaFechaReagendar, handleCloseReagendar, loadActividades, notifyActivitiesChanged]);

  const handleCancelarClick = React.useCallback((actividad: Actividad) => {
    setCancelarDialog({ open: true, actividad, error: null });
  }, []);

  const handleCloseCancelar = React.useCallback(() => {
    if (savingCancelar) return;
    setCancelarDialog({ open: false, actividad: null, error: null });
  }, [savingCancelar]);

  const handleConfirmCancelar = React.useCallback(async () => {
    if (!cancelarDialog.actividad) return;

    setSavingCancelar(true);
    try {
      await cancelarActividad(cancelarDialog.actividad.id);
      setCancelarDialog({ open: false, actividad: null, error: null });
      await loadActividades();
      await notifyActivitiesChanged();
    } catch (err) {
      setCancelarDialog((prev) => ({ ...prev, error: err instanceof Error ? err.message : 'No se pudo cancelar la actividad.' }));
    } finally {
      setSavingCancelar(false);
    }
  }, [cancelarDialog.actividad, loadActividades, notifyActivitiesChanged]);

  const handleVerDetalle = React.useCallback((actividad: Actividad) => {
    navigate(`/crm/actividades/${actividad.id}`, {
      state: {
        returnTo: '/contactos',
        openDrawerContactoId: target?.id,
      },
    });
  }, [navigate, target]);

  const completeActividad = React.useCallback(async (openNextDialog: boolean) => {
    const actividad = realizarActividadDialog.actividad;
    const resultado = realizarActividadDialog.resultado.trim();

    if (!actividad) {
      return;
    }

    if (!resultado) {
      setRealizarActividadDialog((prev) => ({ ...prev, error: 'El resultado es obligatorio.' }));
      return;
    }

    setSavingActividad(true);

    try {
      await realizarActividad(actividad.id, resultado);
      closeRealizarActividadDialog();
      await loadActividades();
      await notifyActivitiesChanged();

      if (openNextDialog) {
        openCreateActividadDialog();
      }
    } finally {
      setSavingActividad(false);
    }
  }, [closeRealizarActividadDialog, loadActividades, notifyActivitiesChanged, openCreateActividadDialog, realizarActividadDialog]);

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 420, md: 460 },
            maxWidth: '100vw',
          },
        }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5} sx={{ p: 2.5, borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" sx={{ color: '#64748b', fontWeight: 700 }}>
                Seguimiento
              </Typography>
              <Typography variant="h6" sx={{ color: '#0f172a', fontWeight: 800, lineHeight: 1.15 }}>
                {target?.title || 'Sin selección'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#475569', mt: 0.5 }}>
                {target?.subtitle || 'Sin información disponible'}
              </Typography>
              {target?.montoValor != null || target?.statusChip ? (
                <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                  {target?.montoValor != null ? (
                    <Box>
                      <Typography variant="caption" sx={{ display: 'block', color: '#0f766e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                        {target.montoLabel || 'Monto'}
                      </Typography>
                      <Typography variant="body1" sx={{ color: '#0f766e', fontWeight: 700 }}>
                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(target.montoValor ?? 0))}
                      </Typography>
                    </Box>
                  ) : null}
                  {target?.statusChip ? (
                    <Chip
                      size="small"
                      label={target.statusChip.label}
                      sx={{
                        fontWeight: 700,
                        bgcolor: target.statusChip.backgroundColor,
                        color: target.statusChip.textColor,
                        border: '1px solid',
                        borderColor: target.statusChip.borderColor,
                      }}
                    />
                  ) : null}
                </Stack>
              ) : null}
            </Box>

            <IconButton onClick={onClose} size="small">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Box sx={{ p: 2.5, overflowY: 'auto', flex: 1 }}>
            <Stack spacing={2.5}>
              {target && loadingActividadesTargetId === target.id ? (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ color: '#64748b' }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2">Cargando actividades...</Typography>
                </Stack>
              ) : null}

              {!target ? (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: '#dbe3ee', backgroundColor: '#ffffff' }}>
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    Selecciona un registro para ver su seguimiento.
                  </Typography>
                </Paper>
              ) : null}

              {target ? (
                <Box sx={{ position: 'sticky', top: 0, zIndex: 1, pt: 0.25, pb: 1.25, backgroundColor: '#f8fafc' }}>
                  <TextField
                    value={seguimientoSearchTerm}
                    onChange={(event) => setSeguimientoSearchTerm(event.target.value)}
                    placeholder="Buscar en actividades"
                    size="small"
                    fullWidth
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchOutlinedIcon sx={{ fontSize: 18, color: '#64748b' }} />
                        </InputAdornment>
                      ),
                      endAdornment: seguimientoSearchTerm ? (
                        <InputAdornment position="end">
                          <IconButton size="small" edge="end" aria-label="Limpiar búsqueda" onClick={() => setSeguimientoSearchTerm('')}>
                            <CloseIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </InputAdornment>
                      ) : undefined,
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { backgroundColor: '#ffffff' } }}
                  />
                </Box>
              ) : null}

              {showNoSearchMatches ? (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: '#dbe3ee', backgroundColor: '#ffffff' }}>
                  <Typography variant="body2" sx={{ color: '#475569' }}>
                    No se encontraron actividades.
                  </Typography>
                </Paper>
              ) : null}

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
                  Actividades pendientes
                </Typography>
                <Stack spacing={2}>
                  {actividadesPendientes.length === 0 && target && !normalizedSeguimientoSearchTerm && loadingActividadesTargetId !== target.id ? (
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: '#dbe3ee', backgroundColor: '#ffffff' }}>
                      <Stack spacing={1.5}>
                        <Typography variant="body2" sx={{ color: '#475569' }}>
                          Sin actividades pendientes. Programa la siguiente acción.
                        </Typography>
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<AddTaskOutlinedIcon />}
                          onClick={openCreateActividadDialog}
                          sx={{ fontWeight: 700, textTransform: 'none', backgroundColor: '#1d2f68', '&:hover': { backgroundColor: '#162551' } }}
                        >
                          Programar siguiente actividad
                        </Button>
                      </Stack>
                    </Paper>
                  ) : null}

                  {actividadesPendientes.map((actividad) => {
                    const duePresentation = getActividadDuePresentation(actividad.fecha_programada);

                    return (
                      <Paper
                        key={actividad.id}
                        variant="outlined"
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          borderColor: duePresentation.borderColor,
                          borderLeft: `4px solid ${duePresentation.accentColor}`,
                          backgroundColor: '#ffffff',
                        }}
                      >
                        <Stack spacing={1.5}>
                          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" useFlexGap flexWrap="wrap">
                            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                              <Chip size="small" label={formatTipoActividadLabel(actividad.tipo_actividad)} sx={{ fontWeight: 700, bgcolor: '#eef2ff', color: '#3730a3' }} />
                              <Chip
                                size="small"
                                label={duePresentation.label}
                                sx={{
                                  fontWeight: 700,
                                  bgcolor: duePresentation.backgroundColor,
                                  color: duePresentation.color,
                                  border: '1px solid',
                                  borderColor: duePresentation.borderColor,
                                }}
                              />
                            </Stack>
                            <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600 }}>
                              {formatDateTime(actividad.fecha_programada)}
                            </Typography>
                          </Stack>
                          <Typography variant="body2" sx={{ color: '#334155' }}>
                            {actividad.notas || 'Sin notas'}
                          </Typography>
                          <Stack direction="row" spacing={0.25} alignItems="center">
                            <Tooltip title="Completar actividad">
                              <IconButton size="small" color="success" onClick={() => handleOpenRealizarActividadDialog(actividad)} aria-label="Completar actividad">
                                <CheckCircleOutlineOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reagendar actividad">
                              <IconButton size="small" color="warning" onClick={(event) => handleReagendarClick(actividad, event)} aria-label="Reagendar actividad">
                                <AccessTimeOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Cancelar actividad">
                              <IconButton size="small" color="error" onClick={() => handleCancelarClick(actividad)} aria-label="Cancelar actividad">
                                <CancelOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Ver detalle">
                              <IconButton size="small" color="primary" onClick={() => handleVerDetalle(actividad)} aria-label="Ver detalle">
                                <VisibilityOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>

              {target && actividadesPendientes.length > 0 && loadingActividadesTargetId !== target.id ? (
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<AddTaskOutlinedIcon />}
                  onClick={openCreateActividadDialog}
                  sx={{ fontWeight: 700, textTransform: 'none', backgroundColor: '#1d2f68', '&:hover': { backgroundColor: '#162551' } }}
                >
                  Programar siguiente actividad
                </Button>
              ) : null}

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
                  Historial
                </Typography>
                <Stack spacing={2}>
                  {actividadesRealizadas.length === 0 && target && !normalizedSeguimientoSearchTerm && loadingActividadesTargetId !== target.id ? (
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: '#dbe3ee', backgroundColor: '#ffffff' }}>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        Sin actividades realizadas.
                      </Typography>
                    </Paper>
                  ) : null}

                  {actividadesRealizadas.map((actividad) => (
                    <Paper key={actividad.id} variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: '#bbf7d0', backgroundColor: '#ffffff' }}>
                      <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" useFlexGap flexWrap="wrap">
                          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                            <Chip size="small" label={formatTipoActividadLabel(actividad.tipo_actividad)} sx={{ fontWeight: 700, bgcolor: '#ecfdf5', color: '#047857' }} />
                            <Chip
                              size="small"
                              icon={<CheckCircleOutlineIcon />}
                              label="Realizada"
                              sx={{
                                fontWeight: 700,
                                bgcolor: '#f0fdf4',
                                color: '#15803d',
                                border: '1px solid',
                                borderColor: '#86efac',
                                '& .MuiChip-icon': { color: '#16a34a' },
                              }}
                            />
                          </Stack>
                          <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600 }}>
                            {formatDateTime(actividad.fecha_realizacion || actividad.fecha_programada)}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ color: '#0f172a' }}>
                          {actividad.resultado || 'Sin resultado'}
                        </Typography>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Box>
      </Drawer>

      <Popover
        open={Boolean(reagendarAnchorEl)}
        anchorEl={reagendarAnchorEl}
        onClose={handleCloseReagendar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Stack spacing={1.25} sx={{ p: 1.5, width: 260 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
            Reagendar actividad
          </Typography>
          <TextField
            label="Nueva fecha"
            type="datetime-local"
            size="small"
            value={nuevaFechaReagendar}
            onChange={(event) => setNuevaFechaReagendar(event.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button size="small" color="inherit" onClick={handleCloseReagendar} disabled={savingReagendar}>
              Cancelar
            </Button>
            <Button size="small" variant="contained" onClick={() => { void handleConfirmReagendar(); }} disabled={!nuevaFechaReagendar || savingReagendar}>
              {savingReagendar ? 'Guardando...' : 'Guardar'}
            </Button>
          </Stack>
        </Stack>
      </Popover>

      <Dialog open={cancelarDialog.open} onClose={handleCloseCancelar} fullWidth maxWidth="xs">
        <DialogTitle>Cancelar actividad</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography sx={{ color: '#475569' }}>
              ¿Estás seguro de que deseas cancelar esta actividad? Esta acción no se puede deshacer.
            </Typography>
            {cancelarDialog.error ? <Alert severity="error">{cancelarDialog.error}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCancelar} color="inherit" disabled={savingCancelar}>
            Volver
          </Button>
          <Button onClick={() => { void handleConfirmCancelar(); }} variant="contained" color="error" disabled={savingCancelar}>
            {savingCancelar ? 'Cancelando...' : 'Cancelar actividad'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createActividadDialog.open} onClose={closeCreateActividadDialog} fullWidth maxWidth="sm">
        <DialogTitle>Programar actividad</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            {target ? (
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                {target.title} · {target.subtitle}
              </Typography>
            ) : null}

            <TextField
              select
              label="Tipo de actividad"
              value={createActividadDialog.tipo_actividad}
              onChange={(event) => {
                const nextValue = event.target.value as TipoActividad;
                setCreateActividadDialog((prev) => ({ ...prev, tipo_actividad: nextValue }));
              }}
              fullWidth
              size="small"
            >
              {ACTIVIDAD_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
              <DateTimePicker
                label="Fecha programada"
                value={createActividadDialog.fecha_programada ? dayjs(createActividadDialog.fecha_programada) : null}
                onChange={(value) => setCreateActividadDialog((prev) => ({
                  ...prev,
                  fecha_programada: value ? value.format('YYYY-MM-DDTHH:mm') : '',
                }))}
                format="DD/MM/YYYY HH:mm"
                ampm
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: 'small',
                  },
                  popper: {
                    placement: 'bottom-start',
                  },
                }}
              />
            </LocalizationProvider>

            <FormControlLabel
              control={(
                <Checkbox
                  checked={createActividadDialog.recordatorio}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setCreateActividadDialog((prev) => ({
                      ...prev,
                      recordatorio: checked,
                      recordatorio_minutos: checked ? prev.recordatorio_minutos : '',
                    }));
                  }}
                  size="small"
                />
              )}
              label="Generar recordatorio"
            />

            {createActividadDialog.recordatorio ? (
              <TextField
                label="Minutos antes"
                value={createActividadDialog.recordatorio_minutos}
                onChange={(event) => setCreateActividadDialog((prev) => ({ ...prev, recordatorio_minutos: event.target.value }))}
                fullWidth
                size="small"
                type="number"
                inputProps={{ min: 1 }}
              />
            ) : null}

            <TextField
              label="Notas"
              multiline
              minRows={4}
              value={createActividadDialog.notas}
              onChange={(event) => setCreateActividadDialog((prev) => ({ ...prev, notas: event.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCreateActividadDialog}>Cancelar</Button>
          <Button variant="contained" onClick={() => { void handleGuardarActividad(); }} disabled={savingActividad}>
            {savingActividad ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={realizarActividadDialog.open} onClose={closeRealizarActividadDialog} fullWidth maxWidth="sm">
        <DialogTitle>Marcar actividad como realizada</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            {realizarActividadDialog.actividad ? (
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                {formatTipoActividadLabel(realizarActividadDialog.actividad.tipo_actividad)} · {formatDateTime(realizarActividadDialog.actividad.fecha_programada)}
              </Typography>
            ) : null}

            <TextField
              autoFocus
              label="Resultado"
              multiline
              minRows={4}
              value={realizarActividadDialog.resultado}
              onChange={(event) => setRealizarActividadDialog((prev) => ({ ...prev, resultado: event.target.value, error: null }))}
              error={Boolean(realizarActividadDialog.error)}
              helperText={realizarActividadDialog.error || undefined}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRealizarActividadDialog}>Cancelar</Button>
          <Button variant="outlined" onClick={() => { void completeActividad(true); }} disabled={savingActividad}>
            {savingActividad ? 'Guardando...' : 'Completar y programar siguiente'}
          </Button>
          <Button variant="contained" onClick={() => { void completeActividad(false); }} disabled={savingActividad}>
            {savingActividad ? 'Guardando...' : 'Completar'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}