import * as React from 'react';
import AddIcon from '@mui/icons-material/Add';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { catalogoOutlinedButtonSx, catalogoPrimaryButtonSx } from '../components/catalogo/catalogoSurfaces';
import ActividadesWorkspaceView from '../components/crm/ActividadesWorkspaceView';
import { guardarActividadesWorkspacePreferencia, resolveActividadesWorkspaceEnabled } from '../modules/crm/actividadesWorkspaceFlag';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import ActivityCard, { type ActividadResumen } from '../components/ActivityCard';
import { apiFetch } from '../services/apiFetch';
import { fetchUsuariosHabilitados } from '../services/usuariosService';
import { useSession } from '../session/useSession';
import { esRolAdmin } from '../session/rolScope';
import type { Usuario } from '../types/usuario';

type GrupoActividadKey = 'atrasadas' | 'hoy' | 'futuro' | 'completadas';

type GrupoTono = 'atrasada' | 'hoy' | 'futuro' | 'completada';

type GrupoActividad = {
  key: GrupoActividadKey;
  titulo: string;
  tono: GrupoTono;
  defaultOpen: boolean;
  actividades: ActividadResumen[];
};

type ActividadApiItem = {
  id: number;
  tipo_actividad: string;
  fecha_programada: string;
  estatus: string;
  descripcion: string | null;
  observaciones: string | null;
  oportunidad_id: number | null;
  cliente_nombre: string | null;
  oportunidad_folio: string | null;
  monto_oportunidad: number | string | null;
  oportunidad_fecha: string | null;
};

type ActividadesApiResponse = {
  vencidas?: ActividadApiItem[];
  hoy?: ActividadApiItem[];
  futuras?: ActividadApiItem[];
  completadas?: ActividadApiItem[];
};

type ActividadDetalle = {
  id: number;
  tipo_actividad: string;
  descripcion: string | null;
  observaciones: string | null;
  fecha_programada: string;
  oportunidad_id: number | null;
  recordatorio: boolean | null;
  recordatorio_minutos: number | null;
};

const GRUPOS_BASE: Omit<GrupoActividad, 'actividades'>[] = [
  { key: 'atrasadas', titulo: 'Atrasadas', tono: 'atrasada', defaultOpen: true },
  { key: 'hoy', titulo: 'Hoy', tono: 'hoy', defaultOpen: true },
  { key: 'futuro', titulo: 'Futuro', tono: 'futuro', defaultOpen: false },
  { key: 'completadas', titulo: 'Completadas', tono: 'completada', defaultOpen: false },
];

function buildInitialExpandedState() {
  return GRUPOS_BASE.reduce<Record<GrupoActividadKey, boolean>>((acc, grupo) => {
    acc[grupo.key] = grupo.defaultOpen;
    return acc;
  }, {} as Record<GrupoActividadKey, boolean>);
}

function getStartOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getEndOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function mapActividadApiToResumen(item: ActividadApiItem): ActividadResumen {
  const tipo = item.tipo_actividad === 'tarea' ? 'otro' : item.tipo_actividad;

  return {
    id: item.id,
    oportunidad_id: item.oportunidad_id,
    tipo: tipo === 'llamada' || tipo === 'whatsapp' || tipo === 'visita' ? tipo : 'otro',
    estatus: item.estatus,
    titulo: item.descripcion?.trim() || `Actividad de ${item.tipo_actividad}`,
    cliente_nombre: item.cliente_nombre ?? 'Sin cliente',
    fecha_programada: item.fecha_programada,
    oportunidad_folio: item.oportunidad_folio,
    monto_oportunidad: item.monto_oportunidad,
    oportunidad_fecha: item.oportunidad_fecha,
    atrasada: false,
  };
}

function groupAtrasadas(actividades: ActividadResumen[]) {
  const ahora = new Date();
  return actividades.filter((actividad) => {
    const fecha = new Date(actividad.fecha_programada);
    return actividad.estatus === 'pendiente' && !Number.isNaN(fecha.getTime()) && fecha < ahora;
  }).map((actividad) => ({ ...actividad, atrasada: true }));
}

function groupHoy(actividades: ActividadResumen[]) {
  const finHoy = getEndOfDay(new Date());
  const ahora = new Date();
  return actividades.filter((actividad) => {
    const fecha = new Date(actividad.fecha_programada);
    return actividad.estatus === 'pendiente' && !Number.isNaN(fecha.getTime()) && fecha >= ahora && fecha <= finHoy;
  });
}

function groupFuturo(actividades: ActividadResumen[]) {
  const finHoy = getEndOfDay(new Date());
  return actividades.filter((actividad) => {
    const fecha = new Date(actividad.fecha_programada);
    return actividad.estatus === 'pendiente' && !Number.isNaN(fecha.getTime()) && fecha > finHoy;
  });
}

function groupCompletadas(actividades: ActividadResumen[]) {
  return actividades.filter((actividad) => actividad.estatus === 'realizada');
}

async function fetchActividades(usuarioAsignadoId?: number | null) {
  const query = usuarioAsignadoId ? `?usuario_asignado_id=${usuarioAsignadoId}` : '';
  const response = await apiFetch<ActividadesApiResponse>(`/api/crm/actividades${query}`);
  return [
    ...(response.vencidas ?? []),
    ...(response.hoy ?? []),
    ...(response.futuras ?? []),
    ...(response.completadas ?? []),
  ].map(mapActividadApiToResumen);
}

async function completarActividad(actividadId: number, resultado: string) {
  return apiFetch(`/api/crm/actividades/${actividadId}`, {
    method: 'PATCH',
    body: {
      estatus: 'realizada',
      resultado,
    },
  });
}

async function cancelarActividad(actividadId: number) {
  return apiFetch(`/api/crm/actividades/${actividadId}`, {
    method: 'PATCH',
    body: { estatus: 'cancelada' },
  });
}

async function fetchActividadDetalle(actividadId: number) {
  return apiFetch<ActividadDetalle>(`/api/crm/actividades/${actividadId}`);
}

async function actualizarActividad(actividadId: number, actividad: ActividadDetalle) {
  return apiFetch(`/api/crm/actividades/${actividadId}`, {
    method: 'PUT',
    body: {
      tipo_actividad: actividad.tipo_actividad,
      descripcion: actividad.descripcion,
      observaciones: actividad.observaciones,
      fecha_programada: actividad.fecha_programada,
      oportunidad_id: actividad.oportunidad_id,
      recordatorio: actividad.recordatorio ?? false,
      recordatorio_minutos: actividad.recordatorio ? actividad.recordatorio_minutos : null,
    },
  });
}

export default function ActividadesPage() {
  const tokens = useTheme().emphasys;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useSession();
  const esAdmin = Boolean(session.user?.es_superadmin) || esRolAdmin(session.roles);
  const [workspaceEnabled, setWorkspaceEnabled] = React.useState(() =>
    resolveActividadesWorkspaceEnabled(session.empresaActivaId, session.user?.id ?? null)
  );
  const usuarioDesdeUrl = React.useMemo(() => {
    const raw = searchParams.get('usuario');
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);
  const [usuarioSeleccionadoId, setUsuarioSeleccionadoId] = React.useState<number | null>(esAdmin ? usuarioDesdeUrl : null);
  const empresaAnteriorRef = React.useRef<number | null>(session.empresaActivaId);
  const [usuariosEmpresa, setUsuariosEmpresa] = React.useState<Usuario[]>([]);
  const [usuariosLoading, setUsuariosLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Record<GrupoActividadKey, boolean>>(buildInitialExpandedState);
  const [actividades, setActividades] = React.useState<ActividadResumen[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [completarDialogOpen, setCompletarDialogOpen] = React.useState(false);
  const [actividadPorCompletar, setActividadPorCompletar] = React.useState<ActividadResumen | null>(null);
  const [resultadoCompletar, setResultadoCompletar] = React.useState('');
  const [completing, setCompleting] = React.useState(false);
  const [completarError, setCompletarError] = React.useState<string | null>(null);

  const [cancelarDialogOpen, setCancelarDialogOpen] = React.useState(false);
  const [actividadPorCancelar, setActividadPorCancelar] = React.useState<ActividadResumen | null>(null);
  const [canceling, setCanceling] = React.useState(false);
  const [cancelarError, setCancelarError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const cambioEmpresa = empresaAnteriorRef.current !== null
      && empresaAnteriorRef.current !== session.empresaActivaId;
    empresaAnteriorRef.current = session.empresaActivaId;

    if (cambioEmpresa) {
      setUsuarioSeleccionadoId(null);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('usuario');
      setSearchParams(nextParams, { replace: true });
    } else {
      setUsuarioSeleccionadoId(esAdmin ? usuarioDesdeUrl : null);
    }

    if (!esAdmin || !session.empresaActivaId) {
      setUsuariosEmpresa([]);
      return undefined;
    }

    let active = true;
    setUsuariosLoading(true);
    void fetchUsuariosHabilitados()
      .then((usuarios) => {
        if (active) setUsuariosEmpresa(usuarios);
      })
      .catch(() => {
        if (active) setUsuariosEmpresa([]);
      })
      .finally(() => {
        if (active) setUsuariosLoading(false);
      });

    return () => {
      active = false;
    };
  }, [esAdmin, session.empresaActivaId, searchParams, setSearchParams, usuarioDesdeUrl]);

  const loadActividades = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchActividades(usuarioSeleccionadoId);
      setActividades(data);
      setError(null);
    } catch (err) {
      setActividades([]);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las actividades');
    } finally {
      setLoading(false);
    }
  }, [usuarioSeleccionadoId]);

  React.useEffect(() => {
    let mounted = true;

    const load = async () => {
      await loadActividades();
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [loadActividades]);

  const grupos = React.useMemo<GrupoActividad[]>(() => {
    const actividadesAtrasadas = groupAtrasadas(actividades);
    const actividadesHoy = groupHoy(actividades);
    const actividadesFuturo = groupFuturo(actividades);
    const actividadesCompletadas = groupCompletadas(actividades);

    const groupedActividades: Record<GrupoActividadKey, ActividadResumen[]> = {
      atrasadas: actividadesAtrasadas,
      hoy: actividadesHoy,
      futuro: actividadesFuturo,
      completadas: actividadesCompletadas,
    };

    return GRUPOS_BASE.map((grupo) => ({
      ...grupo,
      actividades: groupedActividades[grupo.key] ?? [],
    }));
  }, [actividades]);

  const actividadesVisibles = React.useMemo(() => {
    return grupos.flatMap((grupo) => grupo.actividades);
  }, [grupos]);

  const toggleGrupo = (grupoKey: GrupoActividadKey) => {
    setExpanded((prev) => ({
      ...prev,
      [grupoKey]: !prev[grupoKey],
    }));
  };

  const handleCompletar = (actividad: ActividadResumen) => {
    setActividadPorCompletar(actividad);
    setResultadoCompletar('');
    setCompletarError(null);
    setCompletarDialogOpen(true);
  };

  const handleReprogramar = (actividad: ActividadResumen, nuevaFechaProgramada: string) => {
    void (async () => {
      try {
        setError(null);
        const actividadDetalle = await fetchActividadDetalle(actividad.id);
        await actualizarActividad(actividad.id, {
          ...actividadDetalle,
          fecha_programada: nuevaFechaProgramada,
        });
        await loadActividades();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo reprogramar la actividad');
      }
    })();
  };

  const handleCancelar = (actividad: ActividadResumen) => {
    setActividadPorCancelar(actividad);
    setCancelarError(null);
    setCancelarDialogOpen(true);
  };

  const handleCloseCancelarDialog = () => {
    if (canceling) return;
    setCancelarDialogOpen(false);
    setActividadPorCancelar(null);
    setCancelarError(null);
  };

  const handleConfirmCancelar = async () => {
    if (!actividadPorCancelar?.id) return;

    try {
      setCanceling(true);
      setCancelarError(null);
      await cancelarActividad(actividadPorCancelar.id);
      handleCloseCancelarDialog();
      await loadActividades();
    } catch (err) {
      setCancelarError(err instanceof Error ? err.message : 'No se pudo cancelar la actividad.');
    } finally {
      setCanceling(false);
    }
  };

  const handleAbrir = (actividad: ActividadResumen) => {
    if (!actividad.id) {
      return;
    }

    navigate(`/crm/actividades/${actividad.id}`, {
      state: {
        returnTo: `${location.pathname}${location.search}`,
      },
    });
  };

  const handleCloseCompletarDialog = () => {
    if (completing) {
      return;
    }

    setCompletarDialogOpen(false);
    setActividadPorCompletar(null);
    setResultadoCompletar('');
    setCompletarError(null);
  };

  const handleConfirmCompletar = async () => {
    if (!actividadPorCompletar?.id) {
      return;
    }

    const resultado = resultadoCompletar.trim();

    if (!resultado) {
      setCompletarError('El resultado es obligatorio.');
      return;
    }

    try {
      setCompleting(true);
      setCompletarError(null);
      await completarActividad(actividadPorCompletar.id, resultado);
      handleCloseCompletarDialog();
      await loadActividades();
    } catch (err) {
      setCompletarError(err instanceof Error ? err.message : 'No se pudo completar la actividad.');
    } finally {
      setCompleting(false);
    }
  };

  const handleCrearActividad = () => {
    console.info('Crear nueva actividad');
  };

  const cambiarVistaWorkspace = (valor: boolean) => {
    setWorkspaceEnabled(valor);
    guardarActividadesWorkspacePreferencia(session.empresaActivaId, session.user?.id ?? null, valor);
    const next = new URLSearchParams(searchParams);
    next.delete('vistaActividades');
    setSearchParams(next, { replace: true });
  };

  const handleUsuarioChange = (nextId: number | null) => {
    setUsuarioSeleccionadoId(nextId);
    const nextParams = new URLSearchParams(searchParams);
    if (nextId === null) nextParams.delete('usuario');
    else nextParams.set('usuario', String(nextId));
    setSearchParams(nextParams);
  };

  const colorGrupo = (tono: GrupoTono) => {
    if (tono === 'atrasada') return tokens.action.destructive;
    if (tono === 'hoy') return tokens.metric.applied.foreground;
    if (tono === 'futuro') return '#6a5a86';
    return tokens.content.muted;
  };

  const selectorUsuario = esAdmin ? (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        height: 32,
        minWidth: 0,
        maxWidth: { xs: 240, sm: 320 },
        pl: 1.25,
        pr: 0.75,
        borderRadius: 2,
        border: `1px solid ${tokens.content.border}`,
        backgroundColor: tokens.content.elevated,
      }}
    >
      <Typography
        component="span"
        sx={{
          flexShrink: 0,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          lineHeight: '16px',
          textTransform: 'uppercase',
          color: tokens.content.muted,
        }}
      >
        Bandeja
      </Typography>
      <TextField
        select
        value={usuarioSeleccionadoId === null ? '' : String(usuarioSeleccionadoId)}
        onChange={(event) => handleUsuarioChange(event.target.value === '' ? null : Number(event.target.value))}
        disabled={usuariosLoading}
        variant="standard"
        sx={{
          m: 0,
          minWidth: 0,
          flex: 1,
          '& .MuiInputBase-root': {
            margin: 0,
            padding: 0,
            fontSize: 13,
            fontWeight: 650,
            lineHeight: '16px',
            color: tokens.content.foreground,
          },
          '& .MuiSelect-select': {
            padding: '0 22px 0 0 !important',
            minHeight: '0 !important',
            height: 16,
            lineHeight: '16px',
            display: 'flex',
            alignItems: 'center',
          },
          '& .MuiSelect-icon': {
            right: 0,
            top: 'calc(50% - 0.5em)',
            color: tokens.content.muted,
          },
          '& .MuiInput-underline:before, & .MuiInput-underline:after': { display: 'none' },
        }}
      >
        <MenuItem value="">Mis actividades</MenuItem>
        {usuariosEmpresa.map((usuario) => (
          <MenuItem key={usuario.id} value={String(usuario.id)}>
            {usuario.nombre}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  ) : null;

  const accionNueva = (
    <Tooltip title="Nueva actividad">
      <IconButton
        aria-label="Nueva actividad"
        onClick={handleCrearActividad}
        sx={{
          width: 34,
          height: 34,
          flexShrink: 0,
          backgroundColor: tokens.action.primary,
          color: tokens.action.primaryForeground,
          '&:hover': { backgroundColor: tokens.action.primaryHover },
        }}
      >
        <AddIcon sx={{ fontSize: 20 }} />
      </IconButton>
    </Tooltip>
  );

  const encabezado = (
    <Stack
      direction="row"
      spacing={1.25}
      justifyContent="space-between"
      alignItems="center"
      sx={{
        px: { xs: 1.5, md: 2 },
        py: 1.25,
        flexShrink: 0,
        borderBottom: `1px solid ${tokens.content.border}`,
        backgroundColor: tokens.content.background,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 700, lineHeight: '32px', color: tokens.content.foreground, letterSpacing: '-0.01em', flexShrink: 0 }}>
          Actividades
        </Typography>
        {selectorUsuario}
      </Stack>
      <Button
        size="small"
        onClick={() => cambiarVistaWorkspace(true)}
        sx={{ textTransform: 'none', fontSize: 12, color: tokens.content.secondary, flexShrink: 0 }}
      >
        Workspace
      </Button>
      {accionNueva}
    </Stack>
  );

  if (workspaceEnabled) {
    return (
      <>
        <ActividadesWorkspaceView
          grupos={grupos}
          expanded={expanded}
          onToggleGrupo={(key) => toggleGrupo(key as GrupoActividadKey)}
          loading={loading}
          error={error}
          esAdmin={esAdmin}
          usuarios={usuariosEmpresa}
          usuariosLoading={usuariosLoading}
          usuarioSeleccionadoId={usuarioSeleccionadoId}
          onUsuarioChange={handleUsuarioChange}
          onCrear={handleCrearActividad}
          onCompletar={handleCompletar}
          onReprogramar={handleReprogramar}
          onCancelar={handleCancelar}
          onGuardado={() => { void loadActividades(); }}
          onVistaClasica={() => cambiarVistaWorkspace(false)}
        />
        <Dialog open={cancelarDialogOpen} onClose={handleCloseCancelarDialog} fullWidth maxWidth="xs">
          <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Cancelar actividad</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <Typography sx={{ color: tokens.content.secondary }}>
                ¿Estás seguro de que deseas cancelar esta actividad? Esta acción no se puede deshacer.
              </Typography>
              {cancelarError ? <Alert severity="error">{cancelarError}</Alert> : null}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, gap: 1, borderTop: `1px solid ${tokens.content.border}` }}>
            <Button onClick={handleCloseCancelarDialog} disabled={canceling} sx={catalogoOutlinedButtonSx}>
              Volver
            </Button>
            <Button
              onClick={handleConfirmCancelar}
              variant="contained"
              disabled={canceling}
              sx={[
                catalogoPrimaryButtonSx,
                { backgroundColor: tokens.action.destructive, '&:hover': { backgroundColor: '#743f39' } },
              ]}
            >
              {canceling ? 'Cancelando...' : 'Cancelar actividad'}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={completarDialogOpen} onClose={handleCloseCompletarDialog} fullWidth maxWidth="sm">
          <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Completar actividad</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <Typography sx={{ color: tokens.content.secondary }}>
                Captura un resultado corto para marcar la actividad como realizada.
              </Typography>
              <TextField
                label="Resultado"
                value={resultadoCompletar}
                onChange={(event) => setResultadoCompletar(event.target.value)}
                fullWidth
                multiline
                minRows={3}
                autoFocus
                disabled={completing}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: tokens.content.well,
                    '& fieldset': { borderColor: tokens.content.border },
                  },
                }}
              />
              {completarError ? <Alert severity="error">{completarError}</Alert> : null}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, gap: 1, borderTop: `1px solid ${tokens.content.border}` }}>
            <Button onClick={handleCloseCompletarDialog} disabled={completing} sx={catalogoOutlinedButtonSx}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmCompletar} variant="contained" disabled={completing} sx={catalogoPrimaryButtonSx}>
              {completing ? 'Guardando...' : 'Completar'}
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {encabezado}
        <Stack spacing={1.5} alignItems="center" justifyContent="center" sx={{ flex: 1, color: tokens.content.secondary }}>
          <CircularProgress size={28} sx={{ color: tokens.content.foreground }} />
          <Typography sx={{ color: tokens.content.secondary }}>Cargando actividades...</Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {encabezado}
        <Box sx={{ p: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      </Box>
    );
  }

  if (actividadesVisibles.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {encabezado}
        <Paper
          variant="outlined"
          sx={{
            m: 2,
            p: { xs: 3, md: 4 },
            borderRadius: 2,
            borderColor: tokens.content.border,
            backgroundColor: tokens.content.elevated,
            textAlign: 'center',
            maxWidth: 520,
          }}
        >
          <Stack spacing={1.5} alignItems="center">
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: tokens.content.foreground }}>
              No tienes actividades hoy
            </Typography>
            <Typography sx={{ color: tokens.content.secondary, maxWidth: 360 }}>
              Crea una nueva actividad para empezar a organizar tu seguimiento comercial.
            </Typography>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%', backgroundColor: tokens.content.background }}>
      {encabezado}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: { xs: 1, md: 1.5 }, py: 1 }}>
        {grupos.map((grupo) => {
          const isExpanded = expanded[grupo.key];
          const count = grupo.actividades.length;
          const tono = colorGrupo(grupo.tono);

          return (
            <Box key={grupo.key} sx={{ mb: 1.25 }}>
              <Box
                sx={{
                  px: 0.5,
                  py: 0.45,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  width: '100%',
                  cursor: 'pointer',
                  userSelect: 'none',
                  borderRadius: 1.5,
                  '&:hover': { backgroundColor: tokens.content.hover },
                }}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? `Colapsar ${grupo.titulo}` : `Expandir ${grupo.titulo}`}
                onClick={() => toggleGrupo(grupo.key)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleGrupo(grupo.key);
                  }
                }}
              >
                <Box sx={{ display: 'inline-flex', color: tokens.content.foreground, flexShrink: 0 }}>
                  {isExpanded ? <ExpandMoreIcon sx={{ fontSize: 18 }} /> : <ChevronRightIcon sx={{ fontSize: 18 }} />}
                </Box>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: tono, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.content.foreground }}>
                  {grupo.titulo}
                </Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: tono, fontVariantNumeric: 'tabular-nums' }}>
                  {count}
                </Typography>
              </Box>

              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <Box sx={{ pt: 0.25, pb: 0.5 }}>
                  {count > 0 ? (
                    <Stack spacing={0.35}>
                      {grupo.actividades.map((actividad, indice) => (
                        <ActivityCard
                          key={actividad.id}
                          actividad={actividad}
                          indice={indice}
                          onCompletar={handleCompletar}
                          onReprogramar={handleReprogramar}
                          onCancelar={handleCancelar}
                          onAbrir={handleAbrir}
                        />
                      ))}
                    </Stack>
                  ) : (
                    <Typography sx={{ px: 1, py: 0.75, color: tokens.content.muted, fontSize: 13 }}>
                      No hay actividades en esta sección.
                    </Typography>
                  )}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Box>

      <Dialog open={cancelarDialogOpen} onClose={handleCloseCancelarDialog} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Cancelar actividad</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Typography sx={{ color: tokens.content.secondary }}>
              ¿Estás seguro de que deseas cancelar esta actividad? Esta acción no se puede deshacer.
            </Typography>
            {cancelarError ? <Alert severity="error">{cancelarError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, borderTop: `1px solid ${tokens.content.border}` }}>
          <Button onClick={handleCloseCancelarDialog} disabled={canceling} sx={catalogoOutlinedButtonSx}>
            Volver
          </Button>
          <Button
            onClick={handleConfirmCancelar}
            variant="contained"
            disabled={canceling}
            sx={[
              catalogoPrimaryButtonSx,
              { backgroundColor: tokens.action.destructive, '&:hover': { backgroundColor: '#743f39' } },
            ]}
          >
            {canceling ? 'Cancelando...' : 'Cancelar actividad'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={completarDialogOpen} onClose={handleCloseCompletarDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Completar actividad</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Typography sx={{ color: tokens.content.secondary }}>
              Captura un resultado corto para marcar la actividad como realizada.
            </Typography>
            <TextField
              label="Resultado"
              value={resultadoCompletar}
              onChange={(event) => setResultadoCompletar(event.target.value)}
              fullWidth
              multiline
              minRows={3}
              autoFocus
              disabled={completing}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: tokens.content.well,
                  '& fieldset': { borderColor: tokens.content.border },
                },
              }}
            />
            {completarError ? <Alert severity="error">{completarError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, borderTop: `1px solid ${tokens.content.border}` }}>
          <Button onClick={handleCloseCompletarDialog} disabled={completing} sx={catalogoOutlinedButtonSx}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmCompletar} variant="contained" disabled={completing} sx={catalogoPrimaryButtonSx}>
            {completing ? 'Guardando...' : 'Completar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
