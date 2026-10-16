import React, { useEffect, useMemo, useState } from 'react';
import InputAdornment from '@mui/material/InputAdornment';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  FormControlLabel,
  ListSubheader,
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
import type { Contacto } from '../../types/contactos.types';
import { buildRutaInicioOptions, type RutaInicioOption } from '../../utils/rutaInicio';
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
import { fetchContactos } from '../../services/contactosService';
import { ConfigPageFrame, ConfigPageHeader } from '../../components/configuracion/configVisual';
import { CircularProgress } from '@mui/material';
import { CloseRounded, SaveOutlined } from '@mui/icons-material';
import { PanelBar, Pill, Section, actionIconSx, dialogPaperSx, editorialTableSx, emptyCellSx, fieldsOnIvorySx, formWellSx, rowIconSx, strongCellSx, wellSx } from '../../components/transporte/transporteVisual';

const emptyForm: UsuarioPayload & { password?: string } = {
  nombre: '',
  email: '',
  password: '',
  es_superadmin: false,
  activo: true,
  vendedor_contacto_id: null,
  ruta_inicio: null,
};

type RolesCache = Record<number, Rol[]>;
type RolesSeleccionados = Record<number, number | null>; // empresaId -> rolId único

autoResetPromisePolyfill();

export default function UsuariosPage() {
  const { session } = useSession();
  const empresas = session.empresas ?? [];

  const [showPassword, setShowPassword] = useState(false);
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
  const [vendedores, setVendedores] = useState<Contacto[]>([]);
  const [vendedoresLoading, setVendedoresLoading] = useState(false);
  const [rutaInicioOptions, setRutaInicioOptions] = useState<RutaInicioOption[]>([]);
  const [rutaInicioLoading, setRutaInicioLoading] = useState(false);

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

  useEffect(() => {
    const loadVendedores = async () => {
      setVendedoresLoading(true);
      try {
        const contactos = await fetchContactos();
        const soloVendedores = contactos.filter((c) => c.tipo_contacto === 'Vendedor');
        setVendedores(soloVendedores);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudieron cargar los vendedores';
        setFormError(msg);
      } finally {
        setVendedoresLoading(false);
      }
    };

    void loadVendedores();
  }, []);

  useEffect(() => {
    const loadRutaInicioOptions = async () => {
      if (!session.token) {
        setRutaInicioOptions([]);
        return;
      }

      setRutaInicioLoading(true);
      try {
        const options = await buildRutaInicioOptions(session);
        setRutaInicioOptions(options);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudieron cargar las rutas iniciales';
        setFormError(msg);
        setRutaInicioOptions([]);
      } finally {
        setRutaInicioLoading(false);
      }
    };

    void loadRutaInicioOptions();
  }, [session]);

  useEffect(() => {
    if (!form.ruta_inicio) return;
    if (rutaInicioOptions.some((option) => option.path === form.ruta_inicio)) return;
    setForm((prev) => ({ ...prev, ruta_inicio: null }));
  }, [form.ruta_inicio, rutaInicioOptions]);

  const handleOpenCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm, activo: true, es_superadmin: false, password: '', vendedor_contacto_id: null, ruta_inicio: null });
    setFormError(null);
    setDialogOpen(true);
    setEmpresasSeleccionadas([]);
    setRolesSeleccionados({});
  };

  const handleOpenEdit = async (usuario: Usuario) => {
    setEditId(usuario.id);
    setForm({
      nombre: usuario.nombre,
      email: usuario.email,
      activo: usuario.activo,
      es_superadmin: usuario.es_superadmin,
      password: '',
      vendedor_contacto_id: usuario.vendedor_contacto_id ?? null,
      ruta_inicio: usuario.ruta_inicio ?? null,
    });
    setFormError(null);
    setDialogOpen(true);
    setDetalleLoading(true);
    setRolesSeleccionados({});
    setEmpresasSeleccionadas([]);
    try {
      const det = await fetchUsuario(usuario.id);
      const empresasAsignadas = det.empresas ?? [];
      setForm((prev) => ({
        ...prev,
        vendedor_contacto_id: det.vendedor_contacto_id ?? prev.vendedor_contacto_id ?? null,
        ruta_inicio: det.ruta_inicio ?? prev.ruta_inicio ?? null,
      }));
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
      vendedor_contacto_id: form.vendedor_contacto_id ?? null,
      ruta_inicio: form.ruta_inicio ?? null,
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
    <ConfigPageFrame>
      <ConfigPageHeader title="Usuarios" description="Administra los usuarios del sistema, sus empresas y roles asignados." actions={
        <Tooltip title="Nuevo usuario"><IconButton size="small" sx={actionIconSx} onClick={handleOpenCreate}><AddIcon fontSize="small" /></IconButton></Tooltip>
      } />
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={wellSx}>
        <PanelBar title="Usuarios registrados" meta={loading ? undefined : `${usuarios.length} ${usuarios.length === 1 ? 'usuario' : 'usuarios'}`} />
        <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={editorialTableSx}>
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Vendedor</TableCell>
              <TableCell>Superadmin</TableCell>
              <TableCell>Activo</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={emptyCellSx}>Cargando...</TableCell>
              </TableRow>
            ) : usuarios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={emptyCellSx}>No hay usuarios registrados.</TableCell>
              </TableRow>
            ) : (
              usuarios.map((usuario) => (
                <TableRow key={usuario.id} hover>
                  <TableCell sx={strongCellSx}>
                    <Stack direction="row" spacing={1} alignItems="baseline">
                      <span>{usuario.nombre}</span>
                      <Box component="span" sx={(theme) => ({ fontSize: 12, fontWeight: 600, color: theme.emphasys.content.muted })}>ID {usuario.id}</Box>
                    </Stack>
                  </TableCell>
                  <TableCell>{usuario.email}</TableCell>
                  <TableCell>{usuario.vendedor_contacto_nombre ?? '—'}</TableCell>
                  <TableCell>{usuario.es_superadmin ? 'Sí' : 'No'}</TableCell>
                  <TableCell><Pill active={Boolean(usuario.activo)} /></TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Editar">
                        <IconButton size="small" sx={rowIconSx} onClick={() => void handleOpenEdit(usuario)}>
                          <EditIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton size="small" sx={rowIconSx} onClick={() => handleDelete(usuario)}>
                          <DeleteIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </Box>
      </Box>

      {/* Crear / Editar */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle component="div" sx={{ px: { xs: 1.5, md: 2.25 }, pt: 2, pb: 1.5 }}>
          <ConfigPageHeader
            eyebrow="Usuarios"
            title={editId ? 'Editar usuario' : 'Nuevo usuario'}
            description={editId && form.nombre ? [form.nombre, form.email].filter(Boolean).join(' · ') : undefined}
            actions={
              <Stack direction="row" spacing={0.5} alignItems="center">
                <FormControlLabel
                  sx={{ mr: 1 }}
                  control={<Switch size="small" checked={Boolean(form.activo)} onChange={(e) => handleChange('activo', e.target.checked)} />}
                  label={<Typography sx={{ fontSize: 13, fontWeight: 600 }}>Activo</Typography>}
                />
                <Tooltip title="Cancelar">
                  <IconButton size="small" sx={actionIconSx} onClick={handleCloseDialog}><CloseRounded fontSize="small" /></IconButton>
                </Tooltip>
                <Tooltip title={editId ? 'Guardar cambios' : 'Crear usuario'}>
                  <span>
                    <IconButton size="small" sx={actionIconSx} onClick={handleSubmit} disabled={saving}>
                      {saving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlined fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            }
          />
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 1.5, md: 2.25 }, pb: { xs: 1.5, md: 2.25 } }}>
          <Box sx={(theme) => ({ ...formWellSx(theme), ...fieldsOnIvorySx(theme) })}>
          {formError && (
            <Alert severity="warning" onClose={() => setFormError(null)}>
              {formError}
            </Alert>
          )}
          <Section title="Acceso" inset>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
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
            type={showPassword ? 'text' : 'password'}
            fullWidth
            value={form.password || ''}
            onChange={(e) => handleChange('password', e.target.value)}
            helperText="Mínimo 6 caracteres"
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      edge="end"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <FormControlLabel
            control={<Switch checked={Boolean(form.es_superadmin)} onChange={(e) => handleChange('es_superadmin', e.target.checked)} />}
            label={<Typography sx={{ fontSize: 13, fontWeight: 600 }}>Usuario superadmin</Typography>}
          />
          </Stack>
          </Section>

          <Section title="Preferencias" inset>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            select
            label="Vendedor"
            fullWidth
            value={form.vendedor_contacto_id ? String(form.vendedor_contacto_id) : ''}
            onChange={(e) => handleChange('vendedor_contacto_id', e.target.value ? Number(e.target.value) : null)}
            disabled={vendedoresLoading}
            helperText="Opcional"
          >
            <MenuItem value="">
              <em>Sin vendedor</em>
            </MenuItem>
            {vendedores.map((v) => (
              <MenuItem key={v.id} value={String(v.id)}>
                {v.nombre}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Ruta inicial"
            fullWidth
            value={form.ruta_inicio ?? ''}
            onChange={(e) => handleChange('ruta_inicio', e.target.value || null)}
            helperText={rutaInicioLoading ? 'Cargando rutas disponibles...' : 'Opcional'}
            disabled={rutaInicioLoading}
          >
            <MenuItem value="">
              <em>Usar fallback actual</em>
            </MenuItem>
            {rutaInicioOptions.map((ruta, index) => {
              const showGroupHeader = index === 0 || rutaInicioOptions[index - 1]?.group !== ruta.group;
              return [
                showGroupHeader ? (
                  <ListSubheader key={`group-${ruta.group}`} disableSticky>
                    {ruta.group}
                  </ListSubheader>
                ) : null,
                <MenuItem key={ruta.path} value={ruta.path} title={ruta.description}>
                  {ruta.label}
                </MenuItem>,
              ];
            })}
          </TextField>
          </Stack>
          </Section>

          <Section title="Empresas y roles" inset>
            {detalleLoading ? (
              <Typography variant="body2" sx={(theme) => ({ color: theme.emphasys.content.muted })}>Cargando empresas y roles...</Typography>
            ) : empresas.length === 0 ? (
              <Typography variant="body2" sx={(theme) => ({ color: theme.emphasys.content.muted })}>No hay empresas configuradas.</Typography>
            ) : (
              <Table size="small" sx={editorialTableSx}>
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
          </Section>
          </Box>
        </DialogContent>
      </Dialog>
    </ConfigPageFrame>
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
