import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
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
import type { Rol, RolPayload } from '../../types/rol';
import { createRol, deleteRol, fetchRoles, updateRol } from '../../services/rolesService';

const emptyForm: RolPayload = {
  nombre: '',
  descripcion: '',
  activo: true,
};

export default function RolesPage() {
  const { session, setSession } = useSession();
  const empresas = session.empresas ?? [];
  const firstEmpresaId = empresas.length > 0 ? empresas[0]!.id : null;
  const initialEmpresaId = session.empresaActivaId ?? firstEmpresaId ?? null;

  const [empresaId, setEmpresaId] = useState<number | null>(initialEmpresaId);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RolPayload>(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const canCreate = Boolean(empresaId);

  const faltantes = useMemo(() => {
    const missing: string[] = [];
    if (!form.nombre || String(form.nombre).trim() === '') missing.push('nombre');
    return missing;
  }, [form.nombre]);

  const loadRoles = async (empId: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRoles(empId);
      setRoles(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudieron cargar los roles';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (empresaId) {
      void loadRoles(empresaId);
    }
  }, [empresaId]);

  const handleEmpresaChange = (value: string) => {
    const parsed = value ? Number(value) : null;
    setEmpresaId(parsed);
    setSession({ ...session, empresaActivaId: parsed });
    if (parsed) {
      void loadRoles(parsed);
    } else {
      setRoles([]);
    }
  };

  const handleOpenCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm, activo: true });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (rol: Rol) => {
    setEditId(rol.id);
    setForm({ nombre: rol.nombre, descripcion: rol.descripcion ?? '', activo: rol.activo });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setFormError(null);
  };

  const handleChange = (field: keyof RolPayload, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!empresaId) {
      setFormError('Selecciona una empresa');
      return;
    }
    if (faltantes.length > 0) {
      setFormError(`Faltan campos obligatorios: ${faltantes.join(', ')}`);
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        await updateRol(editId, { ...form, empresa_id: empresaId });
      } else {
        await createRol({ ...form, empresa_id: empresaId });
      }
      setDialogOpen(false);
      await loadRoles(empresaId);
    } catch (err: any) {
      const msg = err?.message || 'No se pudo guardar el rol';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActivo = async (rol: Rol, nextValue: boolean) => {
    try {
      setRoles((prev) => prev.map((r) => (r.id === rol.id ? { ...r, activo: nextValue } : r)));
      await updateRol(rol.id, { activo: nextValue, empresa_id: rol.empresa_id });
    } catch (err: any) {
      setRoles((prev) => prev.map((r) => (r.id === rol.id ? { ...r, activo: rol.activo } : r)));
      setError(err?.message || 'No se pudo actualizar el estado');
    }
  };

  const handleDelete = async (rol: Rol) => {
    const confirm = window.confirm(`¿Eliminar el rol "${rol.nombre}"?`);
    if (!confirm) return;
    try {
      await deleteRol(rol.id);
      if (empresaId) {
        await loadRoles(empresaId);
      }
    } catch (err: any) {
      setError(err?.message || 'No se pudo eliminar el rol');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Toolbar disableGutters sx={{ justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            Roles
          </Typography>
          <Typography variant="body2" color="#4b5563">
            Administra los roles por empresa. Cada nombre debe ser único dentro de la empresa.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="empresa-select-label">Empresa</InputLabel>
            <Select
              labelId="empresa-select-label"
              value={empresaId ? String(empresaId) : ''}
              label="Empresa"
              onChange={(e) => handleEmpresaChange(e.target.value as string)}
            >
              {empresas.map((emp) => (
                <MenuItem key={emp.id} value={String(emp.id)}>
                  {emp.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
            disabled={!canCreate}
            sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: '#1d2f68' }}
          >
            Nuevo rol
          </Button>
        </Stack>
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
              <TableCell>Descripción</TableCell>
              <TableCell>Activo</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!empresaId ? (
              <TableRow>
                <TableCell colSpan={4}>Selecciona una empresa para ver roles.</TableCell>
              </TableRow>
            ) : loading ? (
              <TableRow>
                <TableCell colSpan={4}>Cargando...</TableCell>
              </TableRow>
            ) : roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>No hay roles registrados.</TableCell>
              </TableRow>
            ) : (
              roles.map((rol) => (
                <TableRow key={rol.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography fontWeight={600}>{rol.nombre}</Typography>
                      <Chip label={rol.activo ? 'Activo' : 'Inactivo'} color={rol.activo ? 'success' : 'default'} size="small" />
                    </Stack>
                  </TableCell>
                  <TableCell>{rol.descripcion || '—'}</TableCell>
                  <TableCell>
                    <FormControlLabel
                      control={<Switch checked={rol.activo} onChange={(e) => handleToggleActivo(rol, e.target.checked)} />}
                      label={rol.activo ? 'Activo' : 'Inactivo'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => handleOpenEdit(rol)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton size="small" color="error" onClick={() => handleDelete(rol)}>
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

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Editar rol' : 'Nuevo rol'}</DialogTitle>
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
          />
          <TextField
            label="Descripción"
            fullWidth
            value={form.descripcion || ''}
            onChange={(e) => handleChange('descripcion', e.target.value)}
            multiline
            minRows={2}
          />
          <FormControlLabel
            control={<Switch checked={Boolean(form.activo)} onChange={(e) => handleChange('activo', e.target.checked)} color="primary" />}
            label="Rol activo"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={saving || !empresaId}>
            {editId ? 'Guardar cambios' : 'Crear rol'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
