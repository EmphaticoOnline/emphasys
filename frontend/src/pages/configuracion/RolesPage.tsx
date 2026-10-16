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
import { ConfigPageFrame, ConfigPageHeader } from '../../components/configuracion/configVisual';
import { CloseRounded, SaveOutlined } from '@mui/icons-material';
import { PanelBar, Section, actionIconSx, dialogPaperSx, editorialTableSx, emptyCellSx, fieldsOnIvorySx, formWellSx, rowIconSx, strongCellSx, wellSx } from '../../components/transporte/transporteVisual';

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
    <ConfigPageFrame>
      <ConfigPageHeader title="Roles" description="Administra los roles por empresa. Cada nombre debe ser único dentro de la empresa." actions={<Stack direction="row" spacing={1} alignItems="center">
          <FormControl size="small" sx={(theme) => ({ minWidth: 220, ...fieldsOnIvorySx(theme) })}>
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

          <Tooltip title="Nuevo rol">
            <span>
              <IconButton size="small" sx={actionIconSx} onClick={handleOpenCreate} disabled={!canCreate}>
                <AddIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>} />

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={wellSx}>
        <PanelBar title="Roles registrados" meta={empresaId && !loading ? `${roles.length} ${roles.length === 1 ? 'rol' : 'roles'}` : undefined} />
        <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={editorialTableSx}>
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Descripción</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!empresaId ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={emptyCellSx}>Selecciona una empresa para ver roles.</TableCell>
              </TableRow>
            ) : loading ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={emptyCellSx}>Cargando...</TableCell>
              </TableRow>
            ) : roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={emptyCellSx}>No hay roles registrados.</TableCell>
              </TableRow>
            ) : (
              roles.map((rol) => (
                <TableRow key={rol.id} hover>
                  <TableCell sx={strongCellSx}>{rol.nombre}</TableCell>
                  <TableCell>{rol.descripcion || '—'}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                      <Tooltip title="Editar">
                        <IconButton size="small" sx={rowIconSx} onClick={() => handleOpenEdit(rol)}>
                          <EditIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={rol.activo ? 'Desactivar' : 'Activar'}>
                        <Switch size="small" checked={rol.activo} onChange={(e) => handleToggleActivo(rol, e.target.checked)} />
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton size="small" sx={rowIconSx} onClick={() => handleDelete(rol)}>
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

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle component="div" sx={{ px: { xs: 1.5, md: 2.25 }, pt: 2, pb: 1.5 }}>
          <ConfigPageHeader
            eyebrow="Roles"
            title={editId ? 'Editar rol' : 'Nuevo rol'}
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
                <Tooltip title={editId ? 'Guardar cambios' : 'Crear rol'}>
                  <span>
                    <IconButton size="small" sx={actionIconSx} onClick={handleSubmit} disabled={saving || !empresaId}>
                      <SaveOutlined fontSize="small" />
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
          <Section title="Rol" inset>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
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
          </Stack>
          </Section>
          </Box>
        </DialogContent>
      </Dialog>
    </ConfigPageFrame>
  );
}
