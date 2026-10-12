import React from 'react';
import { Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, IconButton, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate, useParams } from 'react-router-dom';
import { actualizarAlmacen, crearAlmacen, fetchAlmacenes } from '../services/inventarioService';
import type { Almacen } from '../types/inventario';

const LISTADO = '/inventario/almacenes';
const TIPO_DEFAULT = 'normal';

type Formulario = { clave: string; nombre: string; tipo: string; activo: boolean };
const vacio: Formulario = { clave: '', nombre: '', tipo: TIPO_DEFAULT, activo: true };

// Misma tipografía compacta que la captura de Facturas (etiqueta flotante y texto a 12.5px).
const etiquetaProps = { shrink: true, sx: { fontSize: 12.5 } };
const textoProps = { style: { fontSize: 12.5 } };

export default function InventarioAlmacenFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const editando = id != null;
  const almacenId = editando ? Number(id) : null;

  const [form, setForm] = React.useState<Formulario>(vacio);
  const [original, setOriginal] = React.useState<Almacen | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [noEncontrado, setNoEncontrado] = React.useState(false);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [intentado, setIntentado] = React.useState(false);

  React.useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        setLoading(true);
        const almacenes = await fetchAlmacenes(true);
        if (!vigente) return;
        if (almacenId != null) {
          const encontrado = almacenes.find((a) => a.id === almacenId) ?? null;
          setOriginal(encontrado);
          setNoEncontrado(!encontrado);
          if (encontrado) {
            setForm({
              clave: encontrado.clave ?? '',
              nombre: encontrado.nombre,
              tipo: encontrado.tipo ?? TIPO_DEFAULT,
              activo: encontrado.activo !== false,
            });
          }
        }
      } catch (e) {
        if (vigente) setError(e instanceof Error ? e.message : 'No se pudo cargar el almacén');
      } finally {
        if (vigente) setLoading(false);
      }
    })();
    return () => { vigente = false; };
  }, [almacenId]);

  const set = <K extends keyof Formulario>(key: K, value: Formulario[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const faltaClave = !form.clave.trim();
  const faltaNombre = !form.nombre.trim();
  const deshabilitarGuardar = saving || loading || noEncontrado;

  const regresar = () => navigate(LISTADO);

  const guardar = async () => {
    setIntentado(true);
    if (faltaClave || faltaNombre || deshabilitarGuardar) return;
    const tipo = almacenId == null ? TIPO_DEFAULT : (original?.tipo?.trim() || TIPO_DEFAULT);
    const payload = { clave: form.clave.trim(), nombre: form.nombre.trim(), tipo, activo: form.activo };
    try {
      setSaving(true);
      setError('');
      if (almacenId == null) await crearAlmacen(payload);
      else await actualizarAlmacen(almacenId, payload);
      navigate(LISTADO, { state: { snackbar: { message: almacenId == null ? 'Almacén creado' : 'Almacén actualizado', severity: 'success' } } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el almacén');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      onKeyDownCapture={(event) => {
        if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
        event.preventDefault();
        event.stopPropagation();
        void guardar();
      }}
      sx={{ width: '100%', px: { xs: 1.5, md: 3 }, pt: 2, pb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      {/* Encabezado */}
      <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
        <Typography variant="h5" fontWeight={700} color="primary.main" sx={{ flexShrink: 0 }}>
          {editando ? 'Editar almacén' : 'Nuevo almacén'}
        </Typography>
        {original && (
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {original.clave ? `${original.clave} · ` : ''}{original.nombre}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Cancelar">
            <span>
              <IconButton
                onClick={regresar}
                disabled={saving}
                aria-label="Cancelar"
                sx={{ border: '1px solid', borderColor: 'primary.main', color: 'primary.main', borderRadius: 1 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={saving ? 'Guardando...' : 'Guardar (⌘/Ctrl + Enter)'}>
            <span>
              <IconButton
                onClick={() => void guardar()}
                disabled={deshabilitarGuardar}
                aria-label="Guardar"
                sx={{
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'primary.dark' },
                  '&.Mui-disabled': { bgcolor: (theme) => theme.emphasys.action.disabled, color: 'primary.contrastText' },
                }}
              >
                {saving ? <CircularProgress size={18} color="inherit" /> : <CheckIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      <Paper variant="outlined" sx={{ borderRadius: 2, p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Cargando…</Typography>
          </Box>
        ) : noEncontrado ? (
          <Alert severity="warning" action={<Button color="inherit" size="small" onClick={regresar}>Regresar</Button>}>
            No se encontró el almacén solicitado.
          </Alert>
        ) : (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(160px, 1fr) minmax(220px, 2fr)' }, gap: 1.5, alignItems: 'start' }}>
              <TextField
                label="Clave"
                required
                size="small"
                autoFocus={!editando}
                value={form.clave}
                onChange={(e) => set('clave', e.target.value)}
                error={intentado && faltaClave}
                {...(intentado && faltaClave ? { helperText: 'La clave es obligatoria' } : {})}
                InputLabelProps={etiquetaProps}
                inputProps={{ ...textoProps, maxLength: 30 }}
              />
              <TextField
                label="Nombre"
                required
                size="small"
                value={form.nombre}
                onChange={(e) => set('nombre', e.target.value)}
                error={intentado && faltaNombre}
                {...(intentado && faltaNombre ? { helperText: 'El nombre es obligatorio' } : {})}
                InputLabelProps={etiquetaProps}
                inputProps={{ ...textoProps, maxLength: 120 }}
              />
            </Box>
            <FormControlLabel
              control={<Checkbox size="small" checked={form.activo} onChange={(e) => set('activo', e.target.checked)} />}
              label="Activo"
              sx={{ mr: 0, alignSelf: 'flex-start', '& .MuiFormControlLabel-label': { fontSize: 13 } }}
            />
          </>
        )}
      </Paper>
    </Box>
  );
}
