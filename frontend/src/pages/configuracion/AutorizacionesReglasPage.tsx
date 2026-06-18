import * as React from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, FormHelperText, IconButton, InputLabel, MenuItem, Paper,
  Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip,
  Typography,
} from '@mui/material';
import { AddRounded, DeleteOutlineRounded, EditRounded } from '@mui/icons-material';
import {
  getTransiciones, getReglas, createRegla, updateRegla, deleteRegla,
  type AutorizacionRegla, type CrearReglaInput, type ModoAutorizacion, type TransicionConId,
} from '../../services/autorizacionesService';
import { fetchRoles } from '../../services/rolesService';
import { fetchUsuariosHabilitados } from '../../services/usuariosService';
import type { Rol } from '../../types/rol';
import { useSession } from '../../session/useSession';

interface Usuario { id: number; nombre: string; }

const MODO_LABELS: Record<ModoAutorizacion, string> = { ninguna: 'Ninguna', directa: 'Directa', flujo: 'Flujo' };
const MODO_CHIP: Record<ModoAutorizacion, { bgcolor: string; color: string }> = {
  ninguna: { bgcolor: '#e5e7eb', color: '#374151' },
  directa: { bgcolor: '#dbeafe', color: '#1d4ed8' },
  flujo:   { bgcolor: '#ede9fe', color: '#6d28d9' },
};

function fmtMonto(v: string | null) {
  if (v === null) return '—';
  return Number(v).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 });
}

interface FormState {
  transicion_id: number | '';
  monto_minimo: string;
  monto_maximo: string;
  modo: ModoAutorizacion;
  autorizador_tipo: 'rol' | 'usuario';
  rol_autorizador_id: number | '';
  usuario_autorizador_id: number | '';
}

const FORM_DEFAULT: FormState = {
  transicion_id: '',
  monto_minimo: '',
  monto_maximo: '',
  modo: 'flujo',
  autorizador_tipo: 'rol',
  rol_autorizador_id: '',
  usuario_autorizador_id: '',
};

export default function AutorizacionesReglasPage() {
  const { session } = useSession();
  const empresaId = session.empresaActivaId ?? 0;

  const [reglas, setReglas] = React.useState<AutorizacionRegla[]>([]);
  const [transiciones, setTransiciones] = React.useState<TransicionConId[]>([]);
  const [roles, setRoles] = React.useState<Rol[]>([]);
  const [usuarios, setUsuarios] = React.useState<Usuario[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editando, setEditando] = React.useState<AutorizacionRegla | null>(null);
  const [form, setForm] = React.useState<FormState>(FORM_DEFAULT);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    Promise.all([getReglas(), getTransiciones(), fetchRoles(empresaId), fetchUsuariosHabilitados()])
      .then(([r, t, ro, u]) => {
        setReglas(r);
        setTransiciones(t);
        setRoles(ro);
        setUsuarios(u as unknown as Usuario[]);
      })
      .catch(() => setError('Error al cargar datos'))
      .finally(() => setLoading(false));
  }, [empresaId]);

  function abrirDialog(regla?: AutorizacionRegla) {
    setSaveError(null);
    if (regla) {
      setEditando(regla);
      setForm({
        transicion_id: regla.transicion_id,
        monto_minimo: regla.monto_minimo ?? '',
        monto_maximo: regla.monto_maximo ?? '',
        modo: regla.modo,
        autorizador_tipo: regla.rol_autorizador_id ? 'rol' : 'usuario',
        rol_autorizador_id: regla.rol_autorizador_id ?? '',
        usuario_autorizador_id: regla.usuario_autorizador_id ?? '',
      });
    } else {
      setEditando(null);
      setForm(FORM_DEFAULT);
    }
    setDialogOpen(true);
  }

  async function guardar() {
    if (!form.transicion_id) { setSaveError('Selecciona una transición.'); return; }
    if (form.modo !== 'ninguna' && !form.rol_autorizador_id && !form.usuario_autorizador_id) {
      setSaveError('Selecciona un rol o usuario autorizador.'); return;
    }
    setSaving(true);
    setSaveError(null);
    const data: CrearReglaInput = {
      transicion_id: Number(form.transicion_id),
      monto_minimo: form.monto_minimo !== '' ? Number(form.monto_minimo) : null,
      monto_maximo: form.monto_maximo !== '' ? Number(form.monto_maximo) : null,
      modo: form.modo,
      rol_autorizador_id: form.modo !== 'ninguna' && form.autorizador_tipo === 'rol' && form.rol_autorizador_id ? Number(form.rol_autorizador_id) : null,
      usuario_autorizador_id: form.modo !== 'ninguna' && form.autorizador_tipo === 'usuario' && form.usuario_autorizador_id ? Number(form.usuario_autorizador_id) : null,
    };
    try {
      if (editando) {
        await updateRegla(editando.id, data);
      } else {
        await createRegla(data);
      }
      const updated = await getReglas();
      setReglas(updated);
      setDialogOpen(false);
    } catch (e: any) {
      setSaveError(e.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function desactivar(id: number) {
    try {
      await deleteRegla(id);
      setReglas((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      setError(e.message ?? 'Error al desactivar');
    }
  }

  if (loading) return <Box display="flex" justifyContent="center" pt={6}><CircularProgress /></Box>;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            Políticas de autorización
          </Typography>
          <Typography variant="body2" color="#4b5563" mt={0.5}>
            Define qué transiciones documentales requieren autorización y en qué modo.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRounded />} onClick={() => abrirDialog()}
          sx={{ bgcolor: '#1d2f68', '&:hover': { bgcolor: '#152255' } }}>
          Nueva política
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell>Transición</TableCell>
              <TableCell>Monto mín.</TableCell>
              <TableCell>Monto máx.</TableCell>
              <TableCell>Modo</TableCell>
              <TableCell>Autorizador</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reglas.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#9ca3af' }}>
                  No hay políticas configuradas
                </TableCell>
              </TableRow>
            )}
            {reglas.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {r.td_origen_nombre} → {r.td_destino_nombre}
                  </Typography>
                </TableCell>
                <TableCell>{fmtMonto(r.monto_minimo)}</TableCell>
                <TableCell>{fmtMonto(r.monto_maximo)}</TableCell>
                <TableCell>
                  <Chip label={MODO_LABELS[r.modo]} size="small"
                    sx={{ ...MODO_CHIP[r.modo], fontWeight: 600, fontSize: 11 }} />
                </TableCell>
                <TableCell>
                  {r.modo === 'ninguna' ? '—' : (r.rol_nombre ?? r.usuario_nombre ?? '—')}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => abrirDialog(r)}>
                      <EditRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Desactivar">
                    <IconButton size="small" color="error" onClick={() => desactivar(r.id)}>
                      <DeleteOutlineRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editando ? 'Editar política' : 'Nueva política de autorización'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} mt={1}>
            {saveError && <Alert severity="error">{saveError}</Alert>}

            <FormControl fullWidth size="small">
              <InputLabel>Transición</InputLabel>
              <Select label="Transición" value={form.transicion_id}
                onChange={(e) => setForm((f) => ({ ...f, transicion_id: e.target.value as number }))}>
                {transiciones.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.td_origen_nombre} → {t.td_destino_nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack direction="row" spacing={2}>
              <TextField
                label="Monto mínimo (opcional)" size="small" fullWidth type="number"
                value={form.monto_minimo}
                onChange={(e) => setForm((f) => ({ ...f, monto_minimo: e.target.value }))}
                helperText="Vacío = sin límite inferior"
              />
              <TextField
                label="Monto máximo (opcional)" size="small" fullWidth type="number"
                value={form.monto_maximo}
                onChange={(e) => setForm((f) => ({ ...f, monto_maximo: e.target.value }))}
                helperText="Vacío = sin límite superior"
              />
            </Stack>

            <FormHelperText sx={{ mx: 0, color: '#6b7280' }}>
              Los rangos son inclusivos. Para bandas consecutivas usa valores distintos en el límite (ej. 0–100,000 y 100,001–200,000).
            </FormHelperText>

            <FormControl fullWidth size="small">
              <InputLabel>Modo</InputLabel>
              <Select label="Modo" value={form.modo}
                onChange={(e) => setForm((f) => ({ ...f, modo: e.target.value as ModoAutorizacion }))}>
                <MenuItem value="ninguna">Ninguna — sin restricción</MenuItem>
                <MenuItem value="directa">Directa — solo usuarios con permiso pueden ejecutar</MenuItem>
                <MenuItem value="flujo">Flujo — requiere solicitud formal y aprobación</MenuItem>
              </Select>
            </FormControl>

            {form.modo !== 'ninguna' && (
              <>
                <FormControl fullWidth size="small">
                  <InputLabel>Tipo de autorizador</InputLabel>
                  <Select label="Tipo de autorizador" value={form.autorizador_tipo}
                    onChange={(e) => setForm((f) => ({ ...f, autorizador_tipo: e.target.value as 'rol' | 'usuario', rol_autorizador_id: '', usuario_autorizador_id: '' }))}>
                    <MenuItem value="rol">Por rol</MenuItem>
                    <MenuItem value="usuario">Por usuario específico</MenuItem>
                  </Select>
                </FormControl>

                {form.autorizador_tipo === 'rol' ? (
                  <FormControl fullWidth size="small">
                    <InputLabel>Rol autorizador</InputLabel>
                    <Select label="Rol autorizador" value={form.rol_autorizador_id}
                      onChange={(e) => setForm((f) => ({ ...f, rol_autorizador_id: e.target.value as number }))}>
                      {roles.filter((r) => r.activo).map((r) => (
                        <MenuItem key={r.id} value={r.id}>{r.nombre}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <FormControl fullWidth size="small">
                    <InputLabel>Usuario autorizador</InputLabel>
                    <Select label="Usuario autorizador" value={form.usuario_autorizador_id}
                      onChange={(e) => setForm((f) => ({ ...f, usuario_autorizador_id: e.target.value as number }))}>
                      {usuarios.map((u) => (
                        <MenuItem key={u.id} value={u.id}>{u.nombre}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={guardar} disabled={saving}
            sx={{ bgcolor: '#1d2f68', '&:hover': { bgcolor: '#152255' } }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
