import * as React from 'react';
import AddIcon from '@mui/icons-material/Add';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ActivityCard, { type ActividadResumen } from '../components/ActivityCard';
import { apiFetch } from '../services/apiFetch';

type GrupoActividadKey = 'atrasadas' | 'hoy' | 'futuro' | 'completadas';

type GrupoActividad = {
  key: GrupoActividadKey;
  titulo: string;
  contadorColor: string;
  defaultOpen: boolean;
  actividades: ActividadResumen[];
};

type ActividadApiItem = {
  id: number;
  tipo_actividad: string;
  fecha_programada: string;
  estatus: string;
  notas: string | null;
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
  notas: string | null;
  fecha_programada: string;
  oportunidad_id: number | null;
  recordatorio: boolean | null;
  recordatorio_minutos: number | null;
};

const GRUPOS_BASE: Omit<GrupoActividad, 'actividades'>[] = [
  { key: 'atrasadas', titulo: 'Atrasadas', contadorColor: '#dc2626', defaultOpen: true },
  { key: 'hoy', titulo: 'Hoy', contadorColor: '#16a34a', defaultOpen: true },
  { key: 'futuro', titulo: 'Futuro', contadorColor: '#7c3aed', defaultOpen: false },
  { key: 'completadas', titulo: 'Completadas', contadorColor: '#64748b', defaultOpen: false },
];

function buildInitialExpandedState() {
  return GRUPOS_BASE.reduce<Record<GrupoActividadKey, boolean>>((acc, grupo) => {
    acc[grupo.key] = grupo.defaultOpen;
    return acc;
  }, {} as Record<GrupoActividadKey, boolean>);
}

function getGrupoContadorLabel(titulo: string, count: number) {
  return `${titulo} (${count})`;
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
    titulo: item.notas?.trim() || `Actividad #${item.id}`,
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

async function fetchActividades() {
  const response = await apiFetch<ActividadesApiResponse>('/api/crm/actividades');
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
      notas: actividad.notas,
      fecha_programada: actividad.fecha_programada,
      oportunidad_id: actividad.oportunidad_id,
      recordatorio: actividad.recordatorio ?? false,
      recordatorio_minutos: actividad.recordatorio ? actividad.recordatorio_minutos : null,
    },
  });
}

export default function ActividadesPage() {
  const navigate = useNavigate();
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

  const loadActividades = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchActividades();
      setActividades(data);
      setError(null);
    } catch (err) {
      setActividades([]);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las actividades');
    } finally {
      setLoading(false);
    }
  }, []);

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

    navigate(`/crm/actividades/${actividad.id}`);
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

  if (loading) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, borderColor: '#dbe3ee' }}>
          <Stack spacing={1.5} alignItems="center" justifyContent="center">
            <CircularProgress size={30} />
            <Typography sx={{ color: '#475569' }}>Cargando actividades...</Typography>
          </Stack>
        </Paper>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (actividadesVisibles.length === 0) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 3,
            borderColor: '#dbe3ee',
            textAlign: 'center',
            maxWidth: 520,
            mx: 'auto',
          }}
        >
          <Stack spacing={2} alignItems="center">
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
              No tienes actividades hoy
            </Typography>
            <Typography sx={{ color: '#475569', maxWidth: 360 }}>
              Crea una nueva actividad para empezar a organizar tu seguimiento comercial.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCrearActividad}>
              Crear actividad
            </Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, position: 'relative' }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#0f172a' }}>
            Actividades
          </Typography>
          <Typography sx={{ color: '#475569', mt: 0.75 }}>
            Revisa primero lo urgente y avanza tu bandeja de trabajo sin salir de CRM.
          </Typography>
        </Box>

        {grupos.map((grupo) => {
          const isExpanded = expanded[grupo.key];
          const count = grupo.actividades.length;

          return (
            <Paper
              key={grupo.key}
              variant="outlined"
              sx={{
                borderRadius: 3,
                borderColor: '#dbe3ee',
                overflow: 'hidden',
                backgroundColor: '#fff',
              }}
            >
              <Box
                sx={{
                  px: { xs: 2, md: 2.5 },
                  py: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  backgroundColor: '#f8fafc',
                  borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                role="button"
                tabIndex={0}
                aria-label={isExpanded ? `Colapsar ${grupo.titulo}` : `Expandir ${grupo.titulo}`}
                onClick={() => toggleGrupo(grupo.key)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleGrupo(grupo.key);
                  }
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                  <Chip
                    label={count}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      color: '#fff',
                      backgroundColor: grupo.contadorColor,
                      minWidth: 34,
                    }}
                  />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a' }}>
                    {getGrupoContadorLabel(grupo.titulo, count)}
                  </Typography>
                </Stack>

                <IconButton
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleGrupo(grupo.key);
                  }}
                  aria-label={isExpanded ? `Colapsar ${grupo.titulo}` : `Expandir ${grupo.titulo}`}
                >
                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>

              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}>
                  {count > 0 ? (
                    <Stack spacing={1.25}>
                      {grupo.actividades.map((actividad) => (
                        <ActivityCard
                          key={actividad.id}
                          actividad={actividad}
                          onCompletar={handleCompletar}
                          onReprogramar={handleReprogramar}
                          onCancelar={handleCancelar}
                          onAbrir={handleAbrir}
                        />
                      ))}
                    </Stack>
                  ) : (
                    <Typography sx={{ color: '#64748b' }}>
                      No hay actividades en esta sección.
                    </Typography>
                  )}
                </Box>
              </Collapse>
            </Paper>
          );
        })}
      </Stack>

      <Fab
        color="primary"
        aria-label="Nueva actividad"
        onClick={handleCrearActividad}
        sx={{
          position: 'sticky',
          bottom: 24,
          ml: 'auto',
          mt: 3,
          display: 'flex',
        }}
      >
        <AddIcon />
      </Fab>

      <Dialog open={cancelarDialogOpen} onClose={handleCloseCancelarDialog} fullWidth maxWidth="xs">
        <DialogTitle>Cancelar actividad</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography sx={{ color: '#475569' }}>
              ¿Estás seguro de que deseas cancelar esta actividad? Esta acción no se puede deshacer.
            </Typography>
            {cancelarError ? <Alert severity="error">{cancelarError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCancelarDialog} color="inherit" disabled={canceling}>
            Volver
          </Button>
          <Button onClick={handleConfirmCancelar} variant="contained" color="error" disabled={canceling}>
            {canceling ? 'Cancelando...' : 'Cancelar actividad'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={completarDialogOpen} onClose={handleCloseCompletarDialog} fullWidth maxWidth="sm">
        <DialogTitle>Completar actividad</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography sx={{ color: '#475569' }}>
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
            />

            {completarError ? <Alert severity="error">{completarError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCompletarDialog} color="inherit" disabled={completing}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmCompletar} variant="contained" disabled={completing}>
            {completing ? 'Guardando...' : 'Completar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}