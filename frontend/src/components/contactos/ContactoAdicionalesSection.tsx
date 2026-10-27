import * as React from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined';
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined';
import {
  actualizarContactoAdicional,
  cambiarActivoContactoAdicional,
  crearContactoAdicional,
  eliminarContactoAdicional,
  listarContactosAdicionales,
} from '../../services/contactos.api';
import type { ContactoAdicional, ContactoAdicionalInput } from '../../types/contactos.types';
import { formatearTelefonoParaMostrar, normalizarTelefonoMx } from '../../utils/telefono';

type Props = {
  contactoId: number;
  onTotalChange?: (total: number) => void;
};

const COLUMNAS = 'minmax(180px, 1.4fr) minmax(180px, 1.3fr) minmax(120px, 0.9fr) minmax(120px, 0.9fr) 90px 128px';
const ANCHO_MINIMO = 920;
/** Debajo de este ancho del panel (no de la ventana) la tabla se muestra como tarjetas. */
const ANCHO_TABLA = 760;

const FORM_VACIO: ContactoAdicionalInput = {
  nombre: '',
  puesto: null,
  email: null,
  telefono: null,
  telefono_secundario: null,
  observaciones: null,
  activo: true,
};

/** Mismo orden que el backend: activos primero, luego por nombre. */
function ordenar(filas: ContactoAdicional[]) {
  return [...filas].sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }) || a.id - b.id);
}

/** Misma normalización que la captura de contactos; undefined si el número es inválido. */
function telefonoNormalizado(valor: string | null): string | null | undefined {
  if (!valor?.trim()) return null;
  try {
    return normalizarTelefonoMx(valor);
  } catch {
    return undefined;
  }
}

function mensajeError(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function ContactoAdicionalesSection({ contactoId, onTotalChange }: Props) {
  const theme = useTheme();
  const tokens = theme.emphasys;
  const contenedorRef = React.useRef<HTMLDivElement | null>(null);
  const [anchoContenedor, setAnchoContenedor] = React.useState<number | null>(null);
  const compacto = anchoContenedor !== null && anchoContenedor < ANCHO_TABLA;
  const [filas, setFilas] = React.useState<ContactoAdicional[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ocupadoId, setOcupadoId] = React.useState<number | null>(null);
  const [editando, setEditando] = React.useState<ContactoAdicional | 'nuevo' | null>(null);
  const [eliminando, setEliminando] = React.useState<ContactoAdicional | null>(null);
  const [eliminandoError, setEliminandoError] = React.useState<string | null>(null);
  const [eliminandoGuardando, setEliminandoGuardando] = React.useState(false);

  const cargar = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFilas(await listarContactosAdicionales(contactoId));
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron cargar los contactos adicionales'));
    } finally {
      setLoading(false);
    }
  }, [contactoId]);

  React.useEffect(() => {
    void cargar();
  }, [cargar]);

  React.useEffect(() => {
    const elemento = contenedorRef.current;
    if (!elemento) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setAnchoContenedor(entry.contentRect.width);
    });
    observer.observe(elemento);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    onTotalChange?.(filas.length);
  }, [filas.length, onTotalChange]);

  const iconoSx = (disabled: boolean) => ({
    width: 34,
    height: 34,
    borderRadius: '10px',
    bgcolor: disabled ? tokens.action.disabled : tokens.action.primary,
    color: tokens.action.primaryForeground,
    '&:hover': { bgcolor: disabled ? tokens.action.disabled : tokens.action.primaryHover },
    '&.Mui-disabled': { bgcolor: tokens.action.disabled, color: tokens.action.primaryForeground },
  });

  const reemplazarFila = (fila: ContactoAdicional) => {
    setFilas((prev) => {
      const existe = prev.some((item) => item.id === fila.id);
      return ordenar(existe ? prev.map((item) => (item.id === fila.id ? fila : item)) : [...prev, fila]);
    });
  };

  const alternarActivo = async (fila: ContactoAdicional) => {
    setOcupadoId(fila.id);
    setError(null);
    try {
      reemplazarFila(await cambiarActivoContactoAdicional(contactoId, fila.id, !fila.activo));
    } catch (err) {
      setError(mensajeError(err, 'No se pudo cambiar el estado del contacto adicional'));
    } finally {
      setOcupadoId(null);
    }
  };

  const confirmarEliminar = async () => {
    if (!eliminando) return;
    setEliminandoGuardando(true);
    setEliminandoError(null);
    try {
      await eliminarContactoAdicional(contactoId, eliminando.id);
      setFilas((prev) => prev.filter((item) => item.id !== eliminando.id));
      setEliminando(null);
      setError(null);
    } catch (err) {
      setEliminandoError(mensajeError(err, 'No se pudo eliminar el contacto adicional'));
    } finally {
      setEliminandoGuardando(false);
    }
  };

  const renderAcciones = (fila: ContactoAdicional) => {
    const ocupado = ocupadoId === fila.id;
    const toggleLabel = fila.activo ? 'Desactivar' : 'Activar';
    return (
      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
        <Tooltip title="Editar" arrow>
          <span>
            <IconButton size="small" aria-label="Editar" disabled={ocupado} onClick={() => setEditando(fila)} sx={iconoSx(ocupado)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={toggleLabel} arrow>
          <span>
            <IconButton size="small" aria-label={toggleLabel} disabled={ocupado} onClick={() => void alternarActivo(fila)} sx={iconoSx(ocupado)}>
              {fila.activo ? <ToggleOnOutlinedIcon fontSize="small" /> : <ToggleOffOutlinedIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Eliminar" arrow>
          <span>
            <IconButton
              size="small"
              aria-label="Eliminar"
              disabled={ocupado}
              onClick={() => {
                setEliminandoError(null);
                setEliminando(fila);
              }}
              sx={iconoSx(ocupado)}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    );
  };

  const estadoChip = (activo: boolean) => (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.6,
        height: 24,
        px: 1,
        borderRadius: 99,
        bgcolor: tokens.content.elevated,
        color: tokens.content.foreground,
        fontSize: 12,
        fontWeight: 650,
      }}
    >
      <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: activo ? theme.palette.success.main : tokens.table.muted }} />
      {activo ? 'Activo' : 'Inactivo'}
    </Box>
  );

  const textoCelda = (valor: string | null | undefined, extra?: object) => (
    <Typography noWrap sx={{ fontSize: 13, color: valor ? tokens.content.secondary : tokens.table.muted, ...extra }}>
      {valor || '—'}
    </Typography>
  );

  return (
    <Box ref={contenedorRef}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ letterSpacing: 0.4, color: tokens.content.foreground }}>
            CONTACTOS ADICIONALES
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.content.muted }}>
            Personas que trabajan en esta empresa.
          </Typography>
        </Box>
        <Tooltip title="Agregar contacto adicional" arrow>
          <IconButton size="small" aria-label="Agregar contacto adicional" onClick={() => setEditando('nuevo')} sx={iconoSx(false)}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {error ? (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.5 }}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : filas.length === 0 ? (
        <Typography variant="body2" sx={{ color: tokens.content.muted }}>
          Este contacto no tiene contactos adicionales registrados.
        </Typography>
      ) : compacto ? (
        <Stack spacing={1}>
          {filas.map((fila) => (
            <Box
              key={fila.id}
              sx={{ border: `1px solid ${tokens.content.border}`, borderRadius: 1.5, p: 1.5, opacity: fila.activo ? 1 : 0.65 }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: tokens.content.foreground, overflowWrap: 'anywhere' }}>{fila.nombre}</Typography>
                  {fila.puesto ? <Typography sx={{ fontSize: 12, color: tokens.content.muted }}>{fila.puesto}</Typography> : null}
                </Box>
                {estadoChip(fila.activo)}
              </Box>
              <Box sx={{ mt: 0.75 }}>
                {fila.email ? textoCelda(fila.email) : null}
                {fila.telefono ? textoCelda(formatearTelefonoParaMostrar(fila.telefono)) : null}
                {fila.telefono_secundario ? textoCelda(formatearTelefonoParaMostrar(fila.telefono_secundario)) : null}
              </Box>
              <Box sx={{ mt: 1 }}>{renderAcciones(fila)}</Box>
            </Box>
          ))}
        </Stack>
      ) : (
        <Box sx={{ overflowX: 'auto', border: `1px solid ${tokens.content.border}`, borderRadius: 1.5 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: COLUMNAS,
              columnGap: 1.15,
              alignItems: 'center',
              height: 32,
              minWidth: ANCHO_MINIMO,
              px: 1.5,
              boxSizing: 'border-box',
              backgroundColor: tokens.grid.header,
              color: tokens.grid.headerForeground,
              fontSize: 10.5,
              fontWeight: 650,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
            }}
          >
            <span>Nombre / Puesto</span>
            <span>Correo</span>
            <span>Teléfono</span>
            <span>Tel. secundario</span>
            <span>Estado</span>
            <span style={{ textAlign: 'right' }}>Acciones</span>
          </Box>
          {filas.map((fila, index) => (
            <Box
              key={fila.id}
              sx={{
                display: 'grid',
                gridTemplateColumns: COLUMNAS,
                columnGap: 1.15,
                alignItems: 'center',
                minHeight: 52,
                minWidth: ANCHO_MINIMO,
                px: 1.5,
                py: 0.75,
                boxSizing: 'border-box',
                borderTop: index === 0 ? 'none' : `1px solid ${tokens.table.line}`,
                opacity: fila.activo ? 1 : 0.65,
                '&:hover': { backgroundColor: tokens.grid.hover },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Tooltip title={fila.observaciones || ''} arrow placement="top-start">
                  <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 700, color: tokens.content.foreground }}>
                    {fila.nombre}
                  </Typography>
                </Tooltip>
                {fila.puesto ? <Typography noWrap sx={{ fontSize: 12, color: tokens.content.muted }}>{fila.puesto}</Typography> : null}
              </Box>
              {textoCelda(fila.email)}
              {textoCelda(formatearTelefonoParaMostrar(fila.telefono), { fontVariantNumeric: 'tabular-nums' })}
              {textoCelda(formatearTelefonoParaMostrar(fila.telefono_secundario), { fontVariantNumeric: 'tabular-nums' })}
              <Box>{estadoChip(fila.activo)}</Box>
              {renderAcciones(fila)}
            </Box>
          ))}
        </Box>
      )}

      <ContactoAdicionalDialog
        open={editando !== null}
        contactoId={contactoId}
        registro={editando === 'nuevo' ? null : editando}
        onClose={() => setEditando(null)}
        onSaved={(fila) => {
          reemplazarFila(fila);
          setEditando(null);
          setError(null);
        }}
      />

      <Dialog open={eliminando !== null} onClose={eliminandoGuardando ? undefined : () => setEliminando(null)} fullWidth maxWidth="xs">
        <DialogTitle>Eliminar contacto adicional</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Eliminar a <strong>{eliminando?.nombre}</strong>? Esta acción no se puede deshacer. Si solo quieres ocultarlo, usa Desactivar.
          </Typography>
          {eliminandoError ? <Alert severity="error" sx={{ mt: 2 }}>{eliminandoError}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEliminando(null)} disabled={eliminandoGuardando}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={() => void confirmarEliminar()} disabled={eliminandoGuardando}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

type DialogProps = {
  open: boolean;
  contactoId: number;
  registro: ContactoAdicional | null;
  onClose: () => void;
  onSaved: (fila: ContactoAdicional) => void;
};

function ContactoAdicionalDialog({ open, contactoId, registro, onClose, onSaved }: DialogProps) {
  const [form, setForm] = React.useState<ContactoAdicionalInput>(FORM_VACIO);
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [intentoGuardar, setIntentoGuardar] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setForm(
      registro
        ? {
            nombre: registro.nombre,
            puesto: registro.puesto,
            email: registro.email,
            telefono: registro.telefono ? formatearTelefonoParaMostrar(registro.telefono) : null,
            telefono_secundario: registro.telefono_secundario ? formatearTelefonoParaMostrar(registro.telefono_secundario) : null,
            observaciones: registro.observaciones,
            activo: registro.activo,
          }
        : FORM_VACIO,
    );
    setError(null);
    setIntentoGuardar(false);
  }, [open, registro]);

  const set = (campo: keyof ContactoAdicionalInput) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [campo]: event.target.value }));

  const nombreVacio = !form.nombre.trim();
  const emailInvalido = Boolean(form.email?.trim()) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email!.trim());
  const telefono = telefonoNormalizado(form.telefono);
  const telefonoSecundario = telefonoNormalizado(form.telefono_secundario);
  const telefonoInvalido = telefono === undefined;
  const telefonoSecundarioInvalido = telefonoSecundario === undefined;

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault();
    setIntentoGuardar(true);
    if (nombreVacio || emailInvalido || telefonoInvalido || telefonoSecundarioInvalido) return;
    const payload: ContactoAdicionalInput = { ...form, telefono: telefono ?? null, telefono_secundario: telefonoSecundario ?? null };
    setGuardando(true);
    setError(null);
    try {
      const fila = registro
        ? await actualizarContactoAdicional(contactoId, registro.id, payload)
        : await crearContactoAdicional(contactoId, payload);
      onSaved(fila);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo guardar el contacto adicional'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onClose={guardando ? undefined : onClose} fullWidth maxWidth="sm">
      <form onSubmit={(event) => void guardar(event)} noValidate>
        <DialogTitle>{registro ? 'Editar contacto adicional' : 'Nuevo contacto adicional'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, pt: 1 }}>
            <TextField
              label="Nombre"
              required
              autoFocus
              value={form.nombre}
              onChange={set('nombre')}
              error={intentoGuardar && nombreVacio}
              helperText={intentoGuardar && nombreVacio ? 'El nombre es obligatorio' : ' '}
              inputProps={{ maxLength: 150 }}
              sx={{ gridColumn: { sm: '1 / -1' } }}
            />
            <TextField label="Puesto" value={form.puesto ?? ''} onChange={set('puesto')} inputProps={{ maxLength: 100 }} />
            <TextField
              label="Correo"
              type="email"
              value={form.email ?? ''}
              onChange={set('email')}
              error={intentoGuardar && emailInvalido}
              helperText={intentoGuardar && emailInvalido ? 'El correo no es válido' : undefined}
              inputProps={{ maxLength: 150 }}
            />
            <TextField
              label="Teléfono"
              value={form.telefono ?? ''}
              onChange={set('telefono')}
              error={intentoGuardar && telefonoInvalido}
              helperText={intentoGuardar && telefonoInvalido ? 'El teléfono no es válido' : undefined}
              inputProps={{ maxLength: 30 }}
            />
            <TextField
              label="Teléfono secundario"
              value={form.telefono_secundario ?? ''}
              onChange={set('telefono_secundario')}
              error={intentoGuardar && telefonoSecundarioInvalido}
              helperText={intentoGuardar && telefonoSecundarioInvalido ? 'El teléfono secundario no es válido' : undefined}
              inputProps={{ maxLength: 30 }}
            />
            <TextField
              label="Observaciones"
              value={form.observaciones ?? ''}
              onChange={set('observaciones')}
              multiline
              minRows={3}
              sx={{ gridColumn: { sm: '1 / -1' } }}
            />
            <FormControlLabel
              control={<Switch checked={form.activo} onChange={(event) => setForm((prev) => ({ ...prev, activo: event.target.checked }))} />}
              label="Activo"
            />
          </Box>
          {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={guardando}>
            {registro ? 'Guardar cambios' : 'Agregar'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
