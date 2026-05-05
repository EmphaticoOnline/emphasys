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
  Fab,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ActivityCard, { type ActividadResumen } from '../components/ActivityCard';
import { apiFetch } from '../services/apiFetch';

type GrupoActividadKey = 'atrasadas' | 'hoy' | 'pendientes' | 'futuro' | 'completadas';

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
};

type ActividadesApiResponse = {
  vencidas?: ActividadApiItem[];
  hoy?: ActividadApiItem[];
  futuras?: ActividadApiItem[];
};

const GRUPOS_BASE: Omit<GrupoActividad, 'actividades'>[] = [
  { key: 'atrasadas', titulo: 'Atrasadas', contadorColor: '#dc2626', defaultOpen: true },
  { key: 'hoy', titulo: 'Hoy', contadorColor: '#16a34a', defaultOpen: true },
  { key: 'pendientes', titulo: 'Pendientes', contadorColor: '#2563eb', defaultOpen: false },
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
    titulo: item.notas?.trim() || `Actividad #${item.id}`,
    cliente_nombre: item.cliente_nombre ?? 'Sin cliente',
    fecha_programada: item.fecha_programada,
    atrasada: false,
  };
}

function groupAtrasadas(actividades: ActividadResumen[]) {
  const inicioHoy = getStartOfDay(new Date());
  return actividades.filter((actividad) => {
    const fecha = new Date(actividad.fecha_programada);
    return !Number.isNaN(fecha.getTime()) && fecha < inicioHoy;
  }).map((actividad) => ({ ...actividad, atrasada: true }));
}

function groupHoy(actividades: ActividadResumen[]) {
  const inicioHoy = getStartOfDay(new Date());
  const finHoy = getEndOfDay(new Date());
  return actividades.filter((actividad) => {
    const fecha = new Date(actividad.fecha_programada);
    return !Number.isNaN(fecha.getTime()) && fecha >= inicioHoy && fecha <= finHoy;
  });
}

function groupPendientes(actividades: ActividadResumen[]) {
  return [];
}

function groupFuturo(actividades: ActividadResumen[]) {
  const finHoy = getEndOfDay(new Date());
  return actividades.filter((actividad) => {
    const fecha = new Date(actividad.fecha_programada);
    return !Number.isNaN(fecha.getTime()) && fecha > finHoy;
  });
}

async function fetchActividades() {
  const response = await apiFetch<ActividadesApiResponse>('/api/crm/actividades');
  return [
    ...(response.vencidas ?? []),
    ...(response.hoy ?? []),
    ...(response.futuras ?? []),
  ].map(mapActividadApiToResumen);
}

export default function ActividadesPage() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = React.useState<Record<GrupoActividadKey, boolean>>(buildInitialExpandedState);
  const [actividades, setActividades] = React.useState<ActividadResumen[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchActividades();
        if (!mounted) return;
        setActividades(data);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        setActividades([]);
        setError(err instanceof Error ? err.message : 'No se pudieron cargar las actividades');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const grupos = React.useMemo<GrupoActividad[]>(() => {
    const actividadesAtrasadas = groupAtrasadas(actividades);
    const actividadesHoy = groupHoy(actividades);
    const actividadesPendientes = groupPendientes(actividades);
    const actividadesFuturo = groupFuturo(actividades);

    const groupedActividades: Record<GrupoActividadKey, ActividadResumen[]> = {
      atrasadas: actividadesAtrasadas,
      hoy: actividadesHoy,
      pendientes: actividadesPendientes,
      futuro: actividadesFuturo,
      completadas: [],
    };

    return GRUPOS_BASE.map((grupo) => ({
      ...grupo,
      actividades: groupedActividades[grupo.key] ?? [],
    }));
  }, [actividades]);

  const actividadesActivas = React.useMemo(() => {
    return grupos
      .filter((grupo) => grupo.key !== 'completadas')
      .flatMap((grupo) => grupo.actividades);
  }, [grupos]);

  const toggleGrupo = (grupoKey: GrupoActividadKey) => {
    setExpanded((prev) => ({
      ...prev,
      [grupoKey]: !prev[grupoKey],
    }));
  };

  const handleCompletar = (actividad: ActividadResumen) => {
    setActividades((prev) => prev.filter((item) => item !== actividad));
  };

  const handleReprogramar = (actividad: ActividadResumen, nuevaFechaProgramada: string) => {
    setActividades((prev) => {
      return prev.map((item) => {
        if (item !== actividad) return item;
        return {
          ...item,
          fecha_programada: nuevaFechaProgramada,
          atrasada: false,
        };
      });
    });
  };

  const handleAbrir = (actividad: ActividadResumen) => {
    if (!actividad.id) {
      return;
    }

    navigate(`/crm/actividades/${actividad.id}`);
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

  if (actividadesActivas.length === 0) {
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
                  onClick={() => toggleGrupo(grupo.key)}
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
    </Box>
  );
}