import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  FormControlLabel,
  FormControl,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { useSession } from '../../session/useSession';
import type { Usuario, UsuarioPayload } from '../../types/usuario';
import type { Rol } from '../../types/rol';
import {
  asignarEmpresas,
  asignarRoles,
  createUsuario,
  deleteUsuario,
  fetchUsuario,
  fetchUsuarios,
  updateUsuario,
} from '../../services/usuariosService';
import { apiFetch } from '../../services/apiFetch';

const emptyForm: UsuarioPayload & { password?: string } = {
  nombre: '',
  email: '',
  password: '',
  es_superadmin: false,
  activo: true,
};

type RolesCache = Record<number, Rol[]>;
type RolesSeleccionados = Record<number, number | null>; // empresaId -> rolId único

autoResetPromisePolyfill();

export default function UsuariosPage() {
  const { session } = useSession();
  const empresas = session.empresas ?? [];

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [rolesCache, setRolesCache] = useState<RolesCache>({});
  const [rolesSeleccionados, setRolesSeleccionados] = useState<RolesSeleccionados>({});
  const [empresasSeleccionadas, setEmpresasSeleccionadas] = useState<{ empresa_id: number; activo: boolean }[]>([]);

  const faltantes = useMemo(() => {
    const missing: string[] = [];
    if (!form.nombre || String(form.nombre).trim() === '') missing.push('nombre');
    if (!form.email || String(form.email).trim() === '') missing.push('email');
    if (!editId && (!form.password || String(form.password).length < 6)) missing.push('password (mínimo 6)');
    if (editId && form.password && String(form.password).length < 6) missing.push('password (mínimo 6)');
    return missing;
  }, [form.nombre, form.email, form.password, editId]);

  const loadUsuarios = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUsuarios();
      setUsuarios(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudieron cargar los usuarios';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsuarios();
  }, []);

  const handleOpenCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm, activo: true, es_superadmin: false, password: '' });
    setFormError(null);
    setDialogOpen(true);
    setEmpresasSeleccionadas([]);
    setRolesSeleccionados({});
  };

  const handleOpenEdit = async (usuario: Usuario) => {
    setEditId(usuario.id);
    setForm({ nombre: usuario.nombre, email: usuario.email, activo: usuario.activo, es_superadmin: usuario.es_superadmin, password: '' });
    setFormError(null);
    setDialogOpen(true);
    setDetalleLoading(true);
    setRolesSeleccionados({});
    setEmpresasSeleccionadas([]);
    try {
      const det = await fetchUsuario(usuario.id);
      const empresasAsignadas = det.empresas ?? [];
      setEmpresasSeleccionadas(empresasAsignadas);
      const rolesMap: RolesSeleccionados = {};
      (det.roles ?? []).forEach((r) => {
        if (rolesMap[r.empresa_id] === undefined) {
          rolesMap[r.empresa_id] = r.rol_id;
        }
      });
      setRolesSeleccionados(rolesMap);
      await preloadRolesForEmpresas(empresasAsignadas.map((e) => e.empresa_id));
    } catch (err: any) {
      const msg = err?.message || 'No se pudo cargar las empresas y roles del usuario';
      setFormError(msg);
    } finally {
      setDetalleLoading(false);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setFormError(null);
    setForm(emptyForm);
  };

  const handleChange = (field: keyof UsuarioPayload | 'password', value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const preloadRolesForEmpresas = async (empresaIds: number[]) => {
    const toLoad = empresaIds.filter((id) => !rolesCache[id]);
    if (toLoad.length === 0) return;
    try {
      const rolesArr = await Promise.all(
        toLoad.map((id) => apiFetch<Rol[]>(`/api/empresas/${id}/roles`, { headers: { 'X-Empresa-Id': String(id) } }))
      );
      setRolesCache((prev) => {
        const next = { ...prev } as RolesCache;
        toLoad.forEach((id, idx) => {
          next[id] = rolesArr[idx] ?? [];
        });
        return next;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudieron cargar los roles';
      setFormError(msg);
    }
  };

  const handleSubmit = async () => {
    if (faltantes.length > 0) {
      setFormError(`Faltan campos obligatorios o inválidos: ${faltantes.join(', ')}`);
      return;
    }

    const payload: UsuarioPayload = {
      nombre: form.nombre,
      email: form.email,
      es_superadmin: Boolean(form.es_superadmin),
      activo: Boolean(form.activo),
    };
    if (!editId || (form.password && form.password.length > 0)) {
      payload.password = form.password || '';
    }

    setSaving(true);
    try {
      const saved = editId ? await updateUsuario(editId, payload) : await createUsuario(payload);
      const userId = editId ?? saved.id;

      // asignar empresas y roles
      await asignarEmpresas(userId, empresasSeleccionadas);
      for (const emp of empresasSeleccionadas) {
        const rolId = rolesSeleccionados[emp.empresa_id] ?? null;
        const roles = rolId ? [rolId] : [];
        await asignarRoles(userId, emp.empresa_id, roles);
      }
      setDialogOpen(false);
      await loadUsuarios();
    } catch (err: any) {
      const msg = err?.message || 'No se pudo guardar el usuario';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (usuario: Usuario) => {
    const confirm = window.confirm(`¿Eliminar/desactivar el usuario "${usuario.nombre}"?`);
    if (!confirm) return;
    try {
      await deleteUsuario(usuario.id);
      await loadUsuarios();
    } catch (err: any) {
      setError(err?.message || 'No se pudo eliminar el usuario');
    }
  };

  const ensureRolesLoaded = async (empresaId: number): Promise<Rol[]> => {
    if (rolesCache[empresaId]) return rolesCache[empresaId];
    try {
      const data = await apiFetch<Rol[]>(`/api/empresas/${empresaId}/roles`, { headers: { 'X-Empresa-Id': String(empresaId) } });
      setRolesCache((prev) => ({ ...prev, [empresaId]: data }));
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudieron cargar los roles';
      setFormError(msg);
      return [];
    }
  };

  const handleEmpresaToggle = async (empresaId: number, checked: boolean) => {
    if (checked) {
      const roles = await ensureRolesLoaded(empresaId);
      setEmpresasSeleccionadas((prev) => {
        if (prev.some((e) => e.empresa_id === empresaId)) return prev.map((e) => (e.empresa_id === empresaId ? { ...e, activo: true } : e));
        return [...prev, { empresa_id: empresaId, activo: true }];
      });
      setRolesSeleccionados((prev) => {
        if (prev[empresaId] !== undefined) return prev;
        const first = roles?.[0]?.id ?? null;
        return { ...prev, [empresaId]: first ?? null };
      });
    } else {
      setEmpresasSeleccionadas((prev) => prev.filter((e) => e.empresa_id !== empresaId));
      setRolesSeleccionados((current) => {
        const copy = { ...current };
        delete copy[empresaId];
        return copy;
      });
    }
  };

  // Activo se controla con el switch principal (handleEmpresaToggle). Mantén función vacía por compatibilidad si se usara en algún lado.

  const handleRolChange = (empresaId: number, rolId: number | null) => {
    setRolesSeleccionados((prev) => ({ ...prev, [empresaId]: rolId }));
  };
  const rolSeleccionado = (empresaId: number) => rolesSeleccionados[empresaId] ?? null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Toolbar disableGutters sx={{ justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            Usuarios
          </Typography>
          <Typography variant="body2" color="#4b5563">
            Administra los usuarios del sistema, sus empresas y roles asignados.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreate}
          sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: '#1d2f68' }}
        >
          Nuevo usuario
        </Button>
      </Toolbar>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 1, backgroundColor: '#fff' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Superadmin</TableCell>
              <TableCell>Activo</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5}>Cargando...</TableCell>
              </TableRow>
            ) : usuarios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>No hay usuarios registrados.</TableCell>
              </TableRow>
            ) : (
              usuarios.map((usuario) => (
                <TableRow key={usuario.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography fontWeight={600}>{usuario.nombre}</Typography>
                      <Chip label={`ID ${usuario.id}`} size="small" />
                    </Stack>
                  </TableCell>
                  <TableCell>{usuario.email}</TableCell>
                  <TableCell>{usuario.es_superadmin ? 'Sí' : 'No'}</TableCell>
                  <TableCell>{usuario.activo ? 'Activo' : 'Inactivo'}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => void handleOpenEdit(usuario)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton size="small" color="error" onClick={() => handleDelete(usuario)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Crear / Editar */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editId ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {formError && (
            <Alert severity="warning" onClose={() => setFormError(null)}>
              {formError}
            </Alert>
          )}
          <TextField
            label="Nombre"
            required
            fullWidth
            value={form.nombre || ''}
            onChange={(e) => handleChange('nombre', e.target.value)}
            sx={{ overflow: 'visible' }}
            InputLabelProps={{ sx: { overflow: 'visible' } }}
          />
          <TextField
            label="Email"
            required
            fullWidth
            type="email"
            value={form.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
          />
          <TextField
            label={editId ? 'Password (dejar en blanco para no cambiar)' : 'Password'}
            type="password"
            fullWidth
            value={form.password || ''}
            onChange={(e) => handleChange('password', e.target.value)}
            helperText="Mínimo 6 caracteres"
          />
          <FormControlLabel
            control={<Switch checked={Boolean(form.es_superadmin)} onChange={(e) => handleChange('es_superadmin', e.target.checked)} color="primary" />}
            label="Usuario superadmin"
          />
          <FormControlLabel
            control={<Switch checked={Boolean(form.activo)} onChange={(e) => handleChange('activo', e.target.checked)} color="primary" />}
            label="Usuario activo"
          />

          <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 2, p: 2, mt: 1 }}>
            <Typography variant="h6" fontWeight={700} color="#1d2f68" gutterBottom>
              Empresas y roles
            </Typography>
            {detalleLoading ? (
              <Typography variant="body2">Cargando empresas y roles...</Typography>
            ) : empresas.length === 0 ? (
              <Typography variant="body2">No hay empresas configuradas.</Typography>
            ) : (
              <Table size="small" sx={{ border: '1px solid #e5e7eb' }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Empresa</TableCell>
                    <TableCell>Activo</TableCell>
                    <TableCell>Rol</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {empresas.map((emp) => {
                    const seleccion = empresasSeleccionadas.find((e) => e.empresa_id === emp.id);
                    const activo = seleccion?.activo ?? false;
                    const rolesDisponibles = rolesCache[emp.id] ?? [];
                    return (
                      <TableRow key={emp.id} hover>
                        <TableCell>{emp.nombre}</TableCell>
                        <TableCell>
                          <Switch
                            size="small"
                            checked={activo}
                            onChange={(e) => void handleEmpresaToggle(emp.id, e.target.checked)}
                          />
                        </TableCell>
                        <TableCell>
                          {rolesDisponibles.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                              No hay roles configurados
                            </Typography>
                          ) : (
                            <FormControl size="small" sx={{ minWidth: 220 }}>
                              <Select
                                displayEmpty
                                value={rolSeleccionado(emp.id) ? String(rolSeleccionado(emp.id)) : ''}
                                onChange={(e) => handleRolChange(emp.id, e.target.value ? Number(e.target.value) : null)}
                                disabled={!activo}
                                renderValue={(selected) => {
                                  if (!selected) return 'Selecciona un rol';
                                  const found = rolesDisponibles.find((r) => String(r.id) === String(selected));
                                  return found?.nombre ?? 'Selecciona un rol';
                                }}
                              >
                                <MenuItem value="">
                                  <em>Sin rol</em>
                                </MenuItem>
                                {rolesDisponibles.map((rol) => (
                                  <MenuItem key={rol.id} value={String(rol.id)}>
                                    {rol.nombre}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={saving}>
            {editId ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Evita error de jest/dom con queueMicrotask en algunos entornos antiguos
function autoResetPromisePolyfill() {
  if (typeof queueMicrotask === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    window.queueMicrotask = (cb: () => void) => Promise.resolve().then(cb);
  }
}
