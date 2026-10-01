import { useMemo, useRef, useState, type MouseEvent } from 'react';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CallOutlinedIcon from '@mui/icons-material/CallOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import {
  Box,
  Button,
  IconButton,
  Popover,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { catalogoOutlinedButtonSx, catalogoPrimaryButtonSx } from './catalogo/catalogoSurfaces';
import { WorkspaceRowContextMenu, type WorkspaceContextItem } from './documentos/WorkspaceRowContextMenu';

export type ActividadResumen = {
  id: number;
  oportunidad_id?: number | null;
  tipo: 'llamada' | 'whatsapp' | 'visita' | 'otro';
  estatus?: string;
  titulo: string;
  cliente_nombre: string;
  fecha_programada: string;
  oportunidad_folio?: string | null;
  monto_oportunidad?: number | string | null;
  oportunidad_fecha?: string | null;
  atrasada: boolean;
};

const LAVADOS_FILA = [
  '#f5f3ee',
  '#f0f4f0',
  '#f7f2ea',
  '#f3f1f6',
  '#f3f4ee',
  '#f0f3f6',
] as const;

const LAVADOS_FILA_HOVER = [
  '#ece9e2',
  '#e6ede6',
  '#f0e8dc',
  '#eae7ef',
  '#e8ebe2',
  '#e6ecf1',
] as const;

export type ActivityCardProps = {
  actividad: ActividadResumen;
  indice?: number;
  onCompletar: (actividad: ActividadResumen) => void;
  onReprogramar?: (actividad: ActividadResumen, nuevaFechaProgramada: string) => void;
  onCancelar?: (actividad: ActividadResumen) => void;
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

function formatearFechaCorta(valor: string | null | undefined) {
  if (!valor) return 'Sin fecha';

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return 'Sin fecha';

  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
  }).format(fecha);
}

function formatearMontoCompacto(valor: number | string | null | undefined) {
  const amount = Number(valor ?? 0);
  if (Number.isNaN(amount)) return '$0';

  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(amount);
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

function formatearTipoActividad(tipo: ActividadResumen['tipo']) {
  const texto = tipo === 'otro' ? 'actividad' : tipo;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function motivoBloqueo(estaCompletada: boolean) {
  return estaCompletada ? 'La actividad ya está completada' : '';
}

export default function ActivityCard({ actividad, indice = 0, onCompletar, onReprogramar, onCancelar, onAbrir }: ActivityCardProps) {
  const tokens = useTheme().emphasys;
  const filaRef = useRef<HTMLDivElement>(null);
  const [anclaPopover, setAnclaPopover] = useState<HTMLElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [fechaReprogramada, setFechaReprogramada] = useState(obtenerFechaLocalParaInput(actividad.fecha_programada));
  const estaCompletada = actividad.estatus === 'realizada';
  const esHoy = esFechaDeHoy(actividad.fecha_programada);

  const acento = actividad.atrasada
    ? tokens.action.destructive
    : estaCompletada
      ? tokens.content.muted
      : esHoy
        ? tokens.metric.applied.foreground
        : '#6a5a86';
  const colorIcono = actividad.tipo === 'llamada'
    ? tokens.action.info
    : actividad.tipo === 'whatsapp'
      ? tokens.metric.applied.foreground
      : actividad.tipo === 'visita'
        ? '#8a5a32'
        : tokens.content.secondary;
  const etiquetaFecha = useMemo(() => formatearFechaLegible(actividad.fecha_programada), [actividad.fecha_programada]);
  const etiquetaEstado = actividad.atrasada
    ? 'Atrasada'
    : estaCompletada
      ? 'Completada'
      : esHoy
        ? 'Hoy'
        : 'Pendiente';
  const bloqueo = motivoBloqueo(estaCompletada);
  const lavado = LAVADOS_FILA[indice % LAVADOS_FILA.length] ?? LAVADOS_FILA[0];
  const lavadoHover = LAVADOS_FILA_HOVER[indice % LAVADOS_FILA_HOVER.length] ?? LAVADOS_FILA_HOVER[0];

  const abrirPopover = (ancla: HTMLElement | null) => {
    if (!ancla || estaCompletada || !onReprogramar) return;
    setFechaReprogramada(obtenerFechaLocalParaInput(actividad.fecha_programada));
    setAnclaPopover(ancla);
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

  const abrirMenu = (evento: MouseEvent<HTMLElement>) => {
    evento.preventDefault();
    evento.stopPropagation();
    setMenuPos({ top: evento.clientY, left: evento.clientX });
  };

  const accionesMenu: WorkspaceContextItem[] = [
    {
      id: 'completar',
      label: 'Completar',
      icon: <CheckCircleOutlineOutlinedIcon sx={{ fontSize: 18 }} />,
      disabled: estaCompletada,
      onClick: () => onCompletar(actividad),
    },
    {
      id: 'reprogramar',
      label: 'Reprogramar',
      icon: <AccessTimeOutlinedIcon sx={{ fontSize: 18 }} />,
      disabled: estaCompletada || !onReprogramar,
      onClick: () => abrirPopover(filaRef.current),
    },
    {
      id: 'cancelar',
      label: 'Cancelar actividad',
      icon: <CancelOutlinedIcon sx={{ fontSize: 18 }} />,
      disabled: estaCompletada || !onCancelar,
      onClick: () => onCancelar?.(actividad),
    },
    {
      id: 'detalle',
      label: 'Ver detalle',
      icon: <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />,
      onClick: () => onAbrir(actividad),
    },
  ];

  const botonAccion = {
    width: 28,
    height: 28,
    color: tokens.content.secondary,
    '&:hover': { backgroundColor: tokens.content.hover, color: tokens.content.foreground },
    '&.Mui-disabled': { color: tokens.action.disabled },
  };

  return (
    <>
      <Box
        ref={filaRef}
        onContextMenu={abrirMenu}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '3px 28px minmax(0, 1fr) auto', md: '3px 28px minmax(160px, 1.4fr) minmax(180px, 1fr) auto auto' },
          alignItems: 'center',
          columnGap: 1,
          minHeight: 44,
          px: 0.75,
          py: 0.4,
          borderRadius: 1.5,
          backgroundColor: lavado,
          '&:hover': { backgroundColor: lavadoHover },
        }}
      >
        <Box sx={{ alignSelf: 'stretch', width: 3, borderRadius: 99, backgroundColor: acento }} />
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: 1.5,
            display: 'grid',
            placeItems: 'center',
            color: colorIcono,
            backgroundColor: tokens.content.well,
            flexShrink: 0,
          }}
        >
          {obtenerIconoActividad(actividad.tipo)}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: 13.5,
              fontWeight: 700,
              lineHeight: 1.2,
              color: estaCompletada ? tokens.content.secondary : tokens.content.foreground,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {actividad.titulo}
          </Typography>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: tokens.content.muted,
              lineHeight: 1.2,
            }}
          >
            {formatearTipoActividad(actividad.tipo)}
            <Box component="span" sx={{ color: acento, ml: 0.75 }}>{etiquetaEstado}</Box>
          </Typography>
        </Box>

        <Box sx={{ minWidth: 0, display: { xs: 'none', md: 'block' } }}>
          <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 650, color: tokens.content.foreground, lineHeight: 1.25 }}>
            {actividad.cliente_nombre}
          </Typography>
          <Typography noWrap sx={{ fontSize: 11.5, color: tokens.content.muted, lineHeight: 1.25 }}>
            {etiquetaFecha}
            {' · '}
            {actividad.oportunidad_folio || 'Sin folio'}
            {' · '}
            {formatearMontoCompacto(actividad.monto_oportunidad)}
            {' · '}
            {formatearFechaCorta(actividad.oportunidad_fecha)}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0} alignItems="center" sx={{ flexShrink: 0 }}>
          <Tooltip title={estaCompletada ? bloqueo : 'Completar actividad'}>
            <span>
              <IconButton
                size="small"
                onClick={() => onCompletar(actividad)}
                aria-label="Completar actividad"
                disabled={estaCompletada}
                sx={{ ...botonAccion, color: estaCompletada ? tokens.action.disabled : tokens.metric.applied.foreground }}
              >
                <CheckCircleOutlineOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={estaCompletada ? bloqueo : 'Reprogramar actividad'}>
            <span>
              <IconButton
                size="small"
                onClick={(evento) => abrirPopover(evento.currentTarget)}
                aria-label="Reprogramar actividad"
                disabled={estaCompletada || !onReprogramar}
                sx={{ ...botonAccion, display: { xs: 'none', sm: 'inline-flex' } }}
              >
                <AccessTimeOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={estaCompletada ? bloqueo : 'Cancelar actividad'}>
            <span>
              <IconButton
                size="small"
                onClick={() => onCancelar?.(actividad)}
                aria-label="Cancelar actividad"
                disabled={estaCompletada || !onCancelar}
                sx={{
                  ...botonAccion,
                  display: { xs: 'none', sm: 'inline-flex' },
                  color: estaCompletada ? tokens.action.disabled : tokens.action.destructive,
                }}
              >
                <CancelOutlinedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Ver detalle">
            <IconButton size="small" onClick={() => onAbrir(actividad)} aria-label="Ver detalle" sx={botonAccion}>
              <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Más acciones">
            <IconButton size="small" onClick={abrirMenu} aria-label="Más acciones" sx={{ ...botonAccion, display: { xs: 'inline-flex', sm: 'none' } }}>
              <MoreVertIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Stack>
        <Typography
          noWrap
          sx={{
            display: { xs: 'block', md: 'none' },
            gridColumn: '3 / -1',
            gridRow: 2,
            fontSize: 11.5,
            color: tokens.content.muted,
            mt: -0.25,
            pb: 0.25,
          }}
        >
          {actividad.cliente_nombre}
          {' · '}
          {etiquetaFecha}
          {' · '}
          {formatearMontoCompacto(actividad.monto_oportunidad)}
        </Typography>
      </Box>

      <WorkspaceRowContextMenu
        anchorPosition={menuPos}
        items={accionesMenu}
        onClose={() => setMenuPos(null)}
      />

      <Popover
        open={!estaCompletada && Boolean(anclaPopover)}
        anchorEl={anclaPopover}
        onClose={cerrarPopover}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Stack spacing={1.25} sx={{ p: 1.5, width: 280 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: tokens.content.foreground }}>
            Reprogramar actividad
          </Typography>
          <TextField
            label="Nueva fecha"
            type="datetime-local"
            size="small"
            value={fechaReprogramada}
            onChange={(evento) => setFechaReprogramada(evento.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: tokens.content.well,
                '& fieldset': { borderColor: tokens.content.border },
              },
            }}
          />
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button size="small" onClick={cerrarPopover} sx={catalogoOutlinedButtonSx}>
              Cancelar
            </Button>
            <Button size="small" variant="contained" onClick={confirmarReprogramacion} disabled={!fechaReprogramada} sx={catalogoPrimaryButtonSx}>
              Guardar
            </Button>
          </Stack>
        </Stack>
      </Popover>
    </>
  );
}