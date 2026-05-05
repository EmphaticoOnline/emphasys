import { useMemo, useState, type MouseEvent } from 'react';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import CallOutlinedIcon from '@mui/icons-material/CallOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Popover,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

export type ActividadResumen = {
  id: number;
  oportunidad_id?: number | null;
  tipo: 'llamada' | 'whatsapp' | 'visita' | 'otro';
  titulo: string;
  cliente_nombre: string;
  fecha_programada: string;
  atrasada: boolean;
};

export type ActivityCardProps = {
  actividad: ActividadResumen;
  onCompletar: (actividad: ActividadResumen) => void;
  onReprogramar?: (actividad: ActividadResumen, nuevaFechaProgramada: string) => void;
  onAbrir: (actividad: ActividadResumen) => void;
};

function obtenerFechaLocalParaInput(valor: string) {
  if (!valor) return '';

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';

  const desfase = fecha.getTimezoneOffset();
  const fechaLocal = new Date(fecha.getTime() - desfase * 60000);
  return fechaLocal.toISOString().slice(0, 16);
}

function formatearFechaLegible(valor: string) {
  if (!valor) return 'Sin fecha programada';

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    return 'Sin fecha programada';
  }

  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha);
}

function esFechaDeHoy(valor: string) {
  if (!valor) return false;

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return false;

  const hoy = new Date();
  return (
    fecha.getFullYear() === hoy.getFullYear()
    && fecha.getMonth() === hoy.getMonth()
    && fecha.getDate() === hoy.getDate()
  );
}

function obtenerColorBorde(actividad: ActividadResumen) {
  if (actividad.atrasada) {
    return '#dc2626';
  }

  if (esFechaDeHoy(actividad.fecha_programada)) {
    return '#16a34a';
  }

  return '#cbd5e1';
}

function obtenerIconoActividad(tipo: ActividadResumen['tipo']) {
  switch (tipo) {
    case 'llamada':
      return <CallOutlinedIcon fontSize="small" />;
    case 'whatsapp':
      return <WhatsAppIcon fontSize="small" />;
    case 'visita':
      return <PlaceOutlinedIcon fontSize="small" />;
    default:
      return <EventRepeatOutlinedIcon fontSize="small" />;
  }
}

function obtenerColorIcono(tipo: ActividadResumen['tipo']) {
  switch (tipo) {
    case 'llamada':
      return '#1d4ed8';
    case 'whatsapp':
      return '#15803d';
    case 'visita':
      return '#c2410c';
    default:
      return '#475569';
  }
}

export default function ActivityCard({ actividad, onCompletar, onReprogramar, onAbrir }: ActivityCardProps) {
  const [anclaPopover, setAnclaPopover] = useState<HTMLElement | null>(null);
  const [fechaReprogramada, setFechaReprogramada] = useState(obtenerFechaLocalParaInput(actividad.fecha_programada));

  const colorBorde = useMemo(() => obtenerColorBorde(actividad), [actividad]);
  const colorIcono = useMemo(() => obtenerColorIcono(actividad.tipo), [actividad.tipo]);
  const etiquetaFecha = useMemo(() => formatearFechaLegible(actividad.fecha_programada), [actividad.fecha_programada]);

  const abrirPopover = (evento: MouseEvent<HTMLElement>) => {
    setFechaReprogramada(obtenerFechaLocalParaInput(actividad.fecha_programada));
    setAnclaPopover(evento.currentTarget);
  };

  const cerrarPopover = () => {
    setAnclaPopover(null);
  };

  const confirmarReprogramacion = () => {
    if (onReprogramar && fechaReprogramada) {
      onReprogramar(actividad, new Date(fechaReprogramada).toISOString());
    }
    cerrarPopover();
  };

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          p: 1.25,
          borderRadius: 2,
          border: '1px solid #e2e8f0',
          borderLeft: `4px solid ${colorBorde}`,
          backgroundColor: '#ffffff',
          minHeight: 88,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            color: colorIcono,
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            flexShrink: 0,
          }}
        >
          {obtenerIconoActividad(actividad.tipo)}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 800,
              color: '#0f172a',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {actividad.cliente_nombre}
          </Typography>

          <Typography
            variant="body2"
            sx={{
              color: '#334155',
              lineHeight: 1.25,
              mt: 0.25,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {actividad.titulo}
          </Typography>

          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5, color: '#64748b', minWidth: 0 }}>
            <AccessTimeOutlinedIcon sx={{ fontSize: 15 }} />
            <Typography variant="caption" sx={{ fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {etiquetaFecha}
            </Typography>
          </Stack>
        </Box>

        <Stack direction="row" spacing={0.25} alignItems="center" sx={{ flexShrink: 0 }}>
          <Tooltip title="Completar">
            <IconButton size="small" color="success" onClick={() => onCompletar(actividad)} aria-label="Completar actividad">
              <CheckCircleOutlineOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Reprogramar">
            <IconButton size="small" color="warning" onClick={abrirPopover} aria-label="Reprogramar actividad">
              <AccessTimeOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Abrir">
            <IconButton size="small" color="primary" onClick={() => onAbrir(actividad)} aria-label="Abrir actividad">
              <ArrowForwardOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      <Popover
        open={Boolean(anclaPopover)}
        anchorEl={anclaPopover}
        onClose={cerrarPopover}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Stack spacing={1.25} sx={{ p: 1.5, width: 260 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
            Reprogramar actividad
          </Typography>

          <TextField
            label="Nueva fecha"
            type="datetime-local"
            size="small"
            value={fechaReprogramada}
            onChange={(evento) => setFechaReprogramada(evento.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button size="small" color="inherit" onClick={cerrarPopover}>
              Cancelar
            </Button>
            <Button size="small" variant="contained" onClick={confirmarReprogramacion} disabled={!fechaReprogramada}>
              Guardar
            </Button>
          </Stack>
        </Stack>
      </Popover>
    </>
  );
}