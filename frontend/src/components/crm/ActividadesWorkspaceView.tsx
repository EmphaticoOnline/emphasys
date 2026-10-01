import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  IconButton,
  MenuItem,
  Popover,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { ActividadResumen } from '../ActivityCard';
import { WorkspaceRowContextMenu, type WorkspaceContextItem } from '../documentos/WorkspaceRowContextMenu';
import { catalogoOutlinedButtonSx, catalogoPrimaryButtonSx } from '../catalogo/catalogoSurfaces';
import ActividadFormPage from '../../pages/ActividadFormPage';
import type { Usuario } from '../../types/usuario';

export type GrupoWorkspace = {
  key: string;
  titulo: string;
  tono: 'atrasada' | 'hoy' | 'futuro' | 'completada';
  actividades: ActividadResumen[];
};

type Props = {
  grupos: GrupoWorkspace[];
  expanded: Record<string, boolean>;
  onToggleGrupo: (key: string) => void;
  loading: boolean;
  error: string | null;
  esAdmin: boolean;
  usuarios: Usuario[];
  usuariosLoading: boolean;
  usuarioSeleccionadoId: number | null;
  onUsuarioChange: (id: number | null) => void;
  onCrear: () => void;
  onCompletar: (actividad: ActividadResumen) => void;
  onReprogramar: (actividad: ActividadResumen, nuevaFechaProgramada: string) => void;
  onCancelar: (actividad: ActividadResumen) => void;
  onGuardado: () => void;
  onVistaClasica: () => void;
};

function fechaCorta(valor: string) {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha);
}

function fechaInput(valor: string) {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function etiquetaTipo(tipo: ActividadResumen['tipo']) {
  const texto = tipo === 'otro' ? 'actividad' : tipo;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default function ActividadesWorkspaceView({
  grupos,
  expanded,
  onToggleGrupo,
  loading,
  error,
  esAdmin,
  usuarios,
  usuariosLoading,
  usuarioSeleccionadoId,
  onUsuarioChange,
  onCrear,
  onCompletar,
  onReprogramar,
  onCancelar,
  onGuardado,
  onVistaClasica,
}: Props) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const compacto = useMediaQuery(theme.breakpoints.down('md'));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detalleMovil, setDetalleMovil] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [reprogramarPos, setReprogramarPos] = useState<{ top: number; left: number } | null>(null);
  const [fechaReprogramada, setFechaReprogramada] = useState('');

  const visibles = useMemo(() => grupos.flatMap((grupo) => grupo.actividades), [grupos]);
  const seleccion = visibles.find((actividad) => actividad.id === selectedId) ?? null;
  const completada = seleccion?.estatus === 'realizada';

  useEffect(() => {
    if (visibles.length === 0) {
      setSelectedId(null);
      setDetalleMovil(false);
      return;
    }
    if (!visibles.some((actividad) => actividad.id === selectedId)) {
      setSelectedId(visibles[0]?.id ?? null);
    }
  }, [visibles, selectedId]);

  const colorEstado = (tono: GrupoWorkspace['tono']) => {
    if (tono === 'atrasada') return '#e7b2ab';
    if (tono === 'hoy') return '#b7d4c4';
    if (tono === 'futuro') return '#c9c0dc';
    return tokens.navigation.muted;
  };

  const tonoDe = (actividad: ActividadResumen): GrupoWorkspace['tono'] => {
    if (actividad.estatus === 'realizada') return 'completada';
    if (actividad.atrasada) return 'atrasada';
    const fecha = new Date(actividad.fecha_programada);
    const fin = new Date();
    fin.setHours(23, 59, 59, 999);
    if (!Number.isNaN(fecha.getTime()) && fecha <= fin) return 'hoy';
    return 'futuro';
  };

  const elegir = (actividad: ActividadResumen) => {
    setSelectedId(actividad.id);
    if (compacto) setDetalleMovil(true);
  };

  const abrirMenu = (evento: MouseEvent<HTMLElement>, actividad: ActividadResumen) => {
    evento.preventDefault();
    evento.stopPropagation();
    setSelectedId(actividad.id);
    setMenuPos({ top: evento.clientY, left: evento.clientX });
  };

  const menuItems: WorkspaceContextItem[] = seleccion ? [
    {
      id: 'completar',
      label: 'Completar',
      icon: <CheckCircleOutlineOutlinedIcon sx={{ fontSize: 18 }} />,
      disabled: completada,
      onClick: () => onCompletar(seleccion),
    },
    {
      id: 'reprogramar',
      label: 'Reprogramar',
      icon: <AccessTimeOutlinedIcon sx={{ fontSize: 18 }} />,
      disabled: completada,
      onClick: (evento) => {
        setFechaReprogramada(fechaInput(seleccion.fecha_programada));
        setReprogramarPos({ top: evento.clientY, left: evento.clientX });
      },
    },
    {
      id: 'cancelar',
      label: 'Cancelar actividad',
      icon: <CancelOutlinedIcon sx={{ fontSize: 18 }} />,
      disabled: completada,
      onClick: () => onCancelar(seleccion),
    },
  ] : [];

  const verLista = !compacto || !detalleMovil;
  const firmaDetalle = seleccion ? `${seleccion.id}:${seleccion.estatus}:${seleccion.fecha_programada}` : '';

  return (
    <Box sx={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: compacto ? 'column' : 'row', overflow: 'hidden' }}>
      <Box sx={{
        width: compacto ? '100%' : 372,
        flexShrink: 0,
        display: verLista ? 'flex' : 'none',
        flexDirection: 'column',
        minHeight: 0,
        bgcolor: tokens.navigation.background,
        color: tokens.navigation.foreground,
        borderRight: compacto ? 'none' : `1px solid ${tokens.navigation.border}`,
      }}>
        <Box sx={{ px: 1.75, pt: 1.5, pb: 1.1, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: tokens.navigation.muted }}>
                ACTIVIDADES
              </Typography>
              <Typography sx={{ mt: 0.35, fontSize: 13, color: tokens.navigation.subtle }} noWrap>
                {loading ? 'Cargando…' : `${visibles.length} en bandeja`}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.6} alignItems="center">
              <Button
                size="small"
                onClick={onVistaClasica}
                sx={{
                  textTransform: 'none',
                  fontSize: 11,
                  minWidth: 0,
                  px: 1,
                  color: tokens.navigation.foreground,
                  borderColor: tokens.navigation.border,
                  '&:hover': { borderColor: tokens.navigation.foreground, bgcolor: tokens.navigation.hover },
                }}
                variant="outlined"
              >
                Vista clásica
              </Button>
              <Tooltip title="Nueva actividad">
                <IconButton
                  aria-label="Nueva actividad"
                  onClick={onCrear}
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor: tokens.navigation.control,
                    color: tokens.navigation.controlForeground,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
                    '&:hover': { bgcolor: tokens.content.elevated, color: tokens.content.foreground },
                  }}
                >
                  <AddIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
          {esAdmin ? (
            <Box sx={{
              mt: 1.25,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              height: 32,
              minWidth: 0,
              pl: 1.1,
              pr: 0.5,
              borderRadius: 2,
              bgcolor: tokens.navigation.summary,
            }}>
              <Typography component="span" sx={{ flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', lineHeight: '16px', color: tokens.navigation.muted }}>
                BANDEJA
              </Typography>
              <TextField
                select
                value={usuarioSeleccionadoId === null ? '' : String(usuarioSeleccionadoId)}
                onChange={(event) => onUsuarioChange(event.target.value === '' ? null : Number(event.target.value))}
                disabled={usuariosLoading}
                variant="standard"
                sx={{
                  m: 0,
                  minWidth: 0,
                  flex: 1,
                  '& .MuiInputBase-root': { margin: 0, padding: 0, fontSize: 13, fontWeight: 650, lineHeight: '16px', color: tokens.navigation.foreground },
                  '& .MuiSelect-select': {
                    padding: '0 22px 0 0 !important',
                    minHeight: '0 !important',
                    height: 16,
                    lineHeight: '16px',
                    display: 'flex',
                    alignItems: 'center',
                  },
                  '& .MuiSelect-icon': { right: 0, top: 'calc(50% - 0.5em)', color: tokens.navigation.muted },
                  '& .MuiInput-underline:before, & .MuiInput-underline:after': { display: 'none' },
                }}
              >
                <MenuItem value="">Mis actividades</MenuItem>
                {usuarios.map((usuario) => (
                  <MenuItem key={usuario.id} value={String(usuario.id)}>{usuario.nombre}</MenuItem>
                ))}
              </TextField>
            </Box>
          ) : null}
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1, pb: 1.2, scrollbarWidth: 'thin' }}>
          {loading ? (
            <Stack alignItems="center" py={4}><CircularProgress size={22} sx={{ color: tokens.navigation.foreground }} /></Stack>
          ) : error ? (
            <Box sx={{ px: 1, py: 2 }}><Alert severity="error">{error}</Alert></Box>
          ) : visibles.length === 0 ? (
            <Typography sx={{ px: 1.5, py: 3, fontSize: 13, color: tokens.navigation.muted, textAlign: 'center' }}>
              No tienes actividades hoy
            </Typography>
          ) : grupos.map((grupo) => {
            const abierto = expanded[grupo.key] !== false;
            const tono = colorEstado(grupo.tono);
            return (
              <Box key={grupo.key} sx={{ mb: 0.75 }}>
                <Box
                  role="button"
                  tabIndex={0}
                  aria-expanded={abierto}
                  aria-label={abierto ? `Colapsar ${grupo.titulo}` : `Expandir ${grupo.titulo}`}
                  onClick={() => onToggleGrupo(grupo.key)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onToggleGrupo(grupo.key);
                    }
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.6,
                    px: 0.75,
                    py: 0.55,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    userSelect: 'none',
                    '&:hover': { bgcolor: tokens.navigation.hover },
                  }}
                >
                  <Box sx={{ display: 'inline-flex', color: tokens.navigation.foreground }}>
                    {abierto ? <ExpandMoreIcon sx={{ fontSize: 18 }} /> : <ChevronRightIcon sx={{ fontSize: 18 }} />}
                  </Box>
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: tono, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {grupo.titulo}
                  </Typography>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: tono, fontVariantNumeric: 'tabular-nums' }}>
                    {grupo.actividades.length}
                  </Typography>
                </Box>
                <Collapse in={abierto} timeout="auto" unmountOnExit>
                  {grupo.actividades.length === 0 ? (
                    <Typography sx={{ px: 1.25, py: 0.6, fontSize: 12, color: tokens.navigation.muted }}>
                      No hay actividades en esta sección.
                    </Typography>
                  ) : grupo.actividades.map((actividad) => {
                    const selected = actividad.id === selectedId;
                    const tonoFila = colorEstado(tonoDe(actividad));
                    return (
                      <Box
                        key={actividad.id}
                        onClick={() => elegir(actividad)}
                        onContextMenu={(evento) => abrirMenu(evento, actividad)}
                        sx={{
                          px: 1,
                          py: 0.7,
                          mb: 0.25,
                          borderRadius: 1.5,
                          cursor: 'pointer',
                          bgcolor: selected ? tokens.navigation.selection : 'transparent',
                          color: selected ? tokens.navigation.selectionForeground : tokens.navigation.foreground,
                          '&:hover': { bgcolor: selected ? tokens.navigation.selection : tokens.navigation.hover },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                          <Typography variant="figure" noWrap sx={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 1.15, color: 'inherit' }}>
                            {actividad.titulo}
                          </Typography>
                          <Typography sx={{ flexShrink: 0, fontSize: 11, color: selected ? 'inherit' : tokens.navigation.subtle, fontVariantNumeric: 'tabular-nums' }}>
                            {fechaCorta(actividad.fecha_programada)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.2, minWidth: 0 }}>
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: tonoFila, flexShrink: 0 }} />
                          <Typography noWrap sx={{ fontSize: 12, color: selected ? 'inherit' : tokens.navigation.muted }}>
                            {etiquetaTipo(actividad.tipo)}
                            {' · '}
                            {actividad.cliente_nombre}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Collapse>
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: compacto && verLista ? 'none' : 'flex', flexDirection: 'column', bgcolor: tokens.content.background }}>
        {seleccion ? (
          <>
            <Box sx={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: { xs: 1, md: 1.5 },
              minHeight: 40,
              borderBottom: `1px solid ${tokens.content.border}`,
            }}>
              {compacto ? (
                <IconButton size="small" aria-label="Volver a la lista" onClick={() => setDetalleMovil(false)} sx={{ color: tokens.content.foreground }}>
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
              ) : null}
              <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.2, color: tokens.content.foreground }}>
                {seleccion.titulo}
              </Typography>
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                {([
                  {
                    id: 'completar',
                    label: completada ? 'La actividad ya está completada' : 'Completar actividad',
                    icon: <CheckCircleOutlineOutlinedIcon fontSize="small" />,
                    disabled: completada,
                    onClick: () => onCompletar(seleccion),
                  },
                  {
                    id: 'reprogramar',
                    label: completada ? 'La actividad ya está completada' : 'Reprogramar actividad',
                    icon: <AccessTimeOutlinedIcon fontSize="small" />,
                    disabled: completada,
                    onClick: (evento: MouseEvent<HTMLButtonElement>) => {
                      const rect = evento.currentTarget.getBoundingClientRect();
                      setFechaReprogramada(fechaInput(seleccion.fecha_programada));
                      setReprogramarPos({ top: rect.bottom, left: rect.right });
                    },
                  },
                  {
                    id: 'cancelar',
                    label: completada ? 'La actividad ya está completada' : 'Cancelar actividad',
                    icon: <CancelOutlinedIcon fontSize="small" />,
                    disabled: completada,
                    onClick: () => onCancelar(seleccion),
                  },
                ] as const).map((accion) => (
                  <Tooltip key={accion.id} title={accion.label} arrow>
                    <span>
                      <IconButton
                        size="small"
                        aria-label={accion.label}
                        disabled={accion.disabled}
                        onClick={accion.onClick}
                        sx={{
                          width: 34,
                          height: 34,
                          borderRadius: '10px',
                          bgcolor: accion.disabled ? tokens.action.disabled : tokens.action.primary,
                          color: tokens.action.primaryForeground,
                          '&:hover': { bgcolor: accion.disabled ? tokens.action.disabled : tokens.action.primaryHover },
                          '&.Mui-disabled': { bgcolor: tokens.action.disabled, color: tokens.action.primaryForeground },
                        }}
                      >
                        {accion.icon}
                      </IconButton>
                    </span>
                  </Tooltip>
                ))}
              </Stack>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <ActividadFormPage
                key={firmaDetalle}
                embedded
                actividadId={seleccion.id}
                onSaved={onGuardado}
              />
            </Box>
          </>
        ) : (
          <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, px: 3 }}>
            <Typography sx={{ color: tokens.content.secondary, textAlign: 'center' }}>
              {loading ? 'Cargando actividades…' : 'Selecciona una actividad para ver su detalle.'}
            </Typography>
          </Stack>
        )}
      </Box>

      <WorkspaceRowContextMenu anchorPosition={menuPos} items={menuItems} onClose={() => setMenuPos(null)} />

      <Popover
        open={Boolean(reprogramarPos) && !completada}
        anchorReference="anchorPosition"
        anchorPosition={reprogramarPos ?? undefined}
        onClose={() => setReprogramarPos(null)}
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
          />
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button size="small" onClick={() => setReprogramarPos(null)} sx={catalogoOutlinedButtonSx}>Cancelar</Button>
            <Button
              size="small"
              variant="contained"
              disabled={!fechaReprogramada || !seleccion}
              sx={catalogoPrimaryButtonSx}
              onClick={() => {
                if (seleccion && fechaReprogramada) onReprogramar(seleccion, new Date(fechaReprogramada).toISOString());
                setReprogramarPos(null);
              }}
            >
              Guardar
            </Button>
          </Stack>
        </Stack>
      </Popover>
    </Box>
  );
}
