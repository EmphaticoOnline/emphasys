import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
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
  MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import ReplayIcon from '@mui/icons-material/Replay';
import { createEmpresa, deleteEmpresa, fetchEmpresas, updateEmpresa } from '../../services/empresasService';
import { buildAssetUrl, fetchEmpresaAsset, uploadEmpresaAsset } from '../../services/empresasAssetsService';
import type { Empresa, EmpresaPayload } from '../../types/empresa';
import { apiFetch } from '../../services/apiFetch';

const requiredFields: Array<keyof EmpresaPayload> = [
  'identificador',
  'nombre',
  'razon_social',
  'rfc',
  'regimen_fiscal_id',
  'codigo_postal_id',
  'colonia_id',
  'calle',
  'pais',
];

const emptyForm: EmpresaPayload = {
  identificador: '',
  nombre: '',
  razon_social: '',
  rfc: '',
  regimen_fiscal_id: '',
  codigo_postal_id: '',
  estado_id: '',
  localidad_id: '',
  colonia_id: '',
  calle: '',
  numero_exterior: '',
  numero_interior: '',
  pais: 'México',
  telefono: '',
  email: '',
  sitio_web: '',
  activo: true,
};

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<EmpresaPayload>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [cpSatLoading, setCpSatLoading] = useState(false);
  const [cpSatError, setCpSatError] = useState<string | null>(null);
  const [coloniasSatLoading, setColoniasSatLoading] = useState(false);
  const [coloniasSatOptions, setColoniasSatOptions] = useState<{ clave: string; nombre: string }[]>([]);
  const [estadoNombre, setEstadoNombre] = useState('');
  const [localidadNombre, setLocalidadNombre] = useState('');
  const [estadoLookup, setEstadoLookup] = useState<Record<string, string>>({});
  const [regimenLookup, setRegimenLookup] = useState<Record<string, string>>({});
  const [regimenOptions, setRegimenOptions] = useState<{ id: string; descripcion: string }[]>([]);
  const [regimenLoading, setRegimenLoading] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSuccess, setLogoSuccess] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoAsset, setLogoAsset] = useState<{ ruta: string } | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const resetLogoState = () => {
    setLogoLoading(false);
    setLogoError(null);
    setLogoSuccess(null);
    setLogoFile(null);
    setLogoAsset(null);
  };

  const tituloDialogo = editId ? 'Editar empresa' : 'Crear empresa';

  const faltantes = useMemo(() => {
    return requiredFields.filter((campo) => {
      const value = (form as Record<string, any>)[campo];
      return value === undefined || value === null || String(value).trim() === '';
    });
  }, [form]);

  const loadEmpresas = () => {
    setLoading(true);
    fetchEmpresas()
      .then((data) => {
        setEmpresas(data);
        setError(null);
        const cps = Array.from(new Set(data.map((e) => e.codigo_postal_id).filter(Boolean))) as string[];
        if (cps.length > 0) {
          void preloadEstadosPorCp(cps);
        }
        const regimenesIds = Array.from(new Set(data.map((e) => e.regimen_fiscal_id).filter(Boolean))) as string[];
        if (regimenesIds.length > 0) {
          void preloadRegimenes(regimenesIds);
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'No se pudieron cargar las empresas';
        setError(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEmpresas();
  }, []);

  const handleOpenCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm, activo: true });
    setFormError(null);
    setEstadoNombre('');
    setLocalidadNombre('');
    setColoniasSatOptions([]);
    if (regimenOptions.length === 0) {
      void loadRegimenesOptions();
    }
    setDialogOpen(true);
  };

  const handleOpenEdit = (empresa: Empresa) => {
    setEditId(empresa.id);
    setForm({ ...empresa });
    setFormError(null);
    setEstadoNombre(empresa.estado_id || '');
    setLocalidadNombre(empresa.localidad_id || '');
    if (empresa.codigo_postal_id) {
      void loadCpSatData(empresa.codigo_postal_id, empresa.colonia_id || undefined);
    }
    if (regimenOptions.length === 0) {
      void loadRegimenesOptions();
    }
    resetLogoState();
    void loadLogoAsset(empresa.id);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setFormError(null);
    resetLogoState();
  };

  const handleChange = (campo: keyof EmpresaPayload, value: any) => {
    setForm((prev) => ({ ...prev, [campo]: value }));
  };

  const fetchJson = async <T,>(url: string): Promise<T> => apiFetch<T>(url);

  const normalizeNombre = (value: any) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.nombre || value.texto || value.clave || '';
  };

  const loadColoniasSat = async (cp: string, selectedColonia?: string) => {
    if (!cp) {
      setColoniasSatOptions([]);
      return;
    }
    setColoniasSatLoading(true);
    try {
      const data = await fetchJson<{ items: { colonia: string; texto: string }[] }>(`/api/sat/colonias/${cp}`);
      const options = (data.items || []).map((c) => ({ clave: c.colonia, nombre: c.texto }));
      setColoniasSatOptions(options);
      if (selectedColonia) {
        const exists = options.some((c) => c.clave === selectedColonia);
        if (!exists) {
          setForm((prev) => ({ ...prev, colonia_id: '' }));
        }
      }
    } catch (err) {
      console.error('No se pudo cargar colonias SAT', err);
      setColoniasSatOptions([]);
    } finally {
      setColoniasSatLoading(false);
    }
  };

  const loadCpSatData = async (cp: string, selectedColonia?: string) => {
    const cpTrim = cp.trim();
    if (!cpTrim || cpTrim.length < 5) return;
    setCpSatLoading(true);
    setCpSatError(null);
    try {
      const data = await fetchJson<{
        codigo_postal?: string;
        estado?: { clave?: string; nombre?: string } | string;
        municipio?: { clave?: string; nombre?: string } | string;
        localidad?: { clave?: string; nombre?: string } | string;
        pais?: { clave?: string; nombre?: string } | string;
        colonias?: { clave: string; nombre: string }[];
      }>(`/api/sat/codigos-postales/${cpTrim}`);

      const estadoNombreResp = normalizeNombre(data.estado);
      const localidadNombreResp = normalizeNombre(data.localidad || data.municipio);

      setEstadoNombre(estadoNombreResp);
      setLocalidadNombre(localidadNombreResp);

      setForm((prev) => ({
        ...prev,
        codigo_postal_id: data.codigo_postal || cpTrim,
        estado_id: (data as any)?.estado?.clave || (typeof data.estado === 'string' ? data.estado : prev.estado_id) || '',
        localidad_id:
          (data as any)?.localidad?.clave || (data as any)?.municipio?.clave || (typeof data.localidad === 'string' ? data.localidad : prev.localidad_id) || '',
      }));

      if (data.colonias && Array.isArray(data.colonias) && data.colonias.length > 0) {
        const options = data.colonias.map((c) => ({ clave: (c as any).clave, nombre: (c as any).nombre }));
        setColoniasSatOptions(options);
        if (selectedColonia) {
          const exists = options.some((c) => c.clave === selectedColonia);
          if (!exists) {
            setForm((prev) => ({ ...prev, colonia_id: '' }));
          }
        }
      } else {
        await loadColoniasSat(cpTrim, selectedColonia);
      }
    } catch (err) {
      console.error('No se pudo cargar CP SAT', err);
      setCpSatError('El código postal SAT no se encontró');
      setColoniasSatOptions([]);
    } finally {
      setCpSatLoading(false);
    }
  };

  const handleCpSatChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.trim();
    setForm((prev) => ({ ...prev, codigo_postal_id: value, colonia_id: '' }));
    setCpSatError(null);
    if (value.length === 5) {
      void loadCpSatData(value);
    } else {
      setColoniasSatOptions([]);
    }
  };

  const handleSubmit = async () => {
    if (faltantes.length > 0) {
      setFormError(`Faltan campos obligatorios: ${faltantes.join(', ')}`);
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        await updateEmpresa(editId, form);
      } else {
        await createEmpresa(form);
      }
      setDialogOpen(false);
      loadEmpresas();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar la empresa';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDesactivar = async (empresa: Empresa) => {
    const confirmed = window.confirm(`¿Desactivar la empresa "${empresa.nombre}"?`);
    if (!confirmed) return;
    try {
      await deleteEmpresa(empresa.id);
      loadEmpresas();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo desactivar la empresa';
      setError(message);
    }
  };

  const handleActivar = async (empresa: Empresa) => {
    try {
      await updateEmpresa(empresa.id, { activo: true });
      loadEmpresas();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo activar la empresa';
      setError(message);
    }
  };

  const preloadEstadosPorCp = async (cps: string[]) => {
    const entries: Array<[string, string]> = [];
    for (const cp of cps) {
      try {
        const data = await apiFetch<{ estado?: { nombre?: string } | string }>(`/api/sat/codigos-postales/${cp}`);
        const nombre = typeof data?.estado === 'string' ? data.estado : data?.estado?.nombre;
        if (nombre) entries.push([cp, nombre]);
      } catch (err) {
        console.warn('No se pudo obtener estado para CP', cp, err);
      }
    }
    if (entries.length) {
      setEstadoLookup((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    }
  };

  const preloadRegimenes = async (ids: string[]) => {
    const entries: Array<[string, string]> = [];
    try {
      const data = await apiFetch<{ id: string; descripcion: string }[]>(`/api/catalogos/regimenes-fiscales`);
      data.forEach((item) => {
        if (ids.includes(String(item.id))) {
          entries.push([String(item.id), item.descripcion]);
        }
      });
    } catch (err) {
      console.warn('No se pudieron pre-cargar regímenes fiscales', err);
    }
    if (entries.length) {
      setRegimenLookup((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    }
  };

  const loadRegimenesOptions = async () => {
    setRegimenLoading(true);
    try {
      const data = await apiFetch<{ id: string; descripcion: string }[]>(`/api/catalogos/regimenes-fiscales`);
      const items = (data || []).map((i) => ({ id: String(i.id), descripcion: i.descripcion }));
      setRegimenOptions(items);
      if (items.length) {
        setRegimenLookup((prev) => ({ ...prev, ...Object.fromEntries(items.map((i) => [i.id, i.descripcion])) }));
      }
    } catch (err) {
      console.warn('No se pudieron cargar regímenes fiscales', err);
    } finally {
      setRegimenLoading(false);
    }
  };

  useEffect(() => {
    if (dialogOpen && form.codigo_postal_id && form.codigo_postal_id.length === 5) {
      void loadCpSatData(form.codigo_postal_id, form.colonia_id || undefined);
    }
    if (dialogOpen && regimenOptions.length === 0) {
      void loadRegimenesOptions();
    }
    if (dialogOpen && editId) {
      resetLogoState();
      void loadLogoAsset(editId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen]);

  const loadLogoAsset = async (empresaId: number) => {
    setLogoLoading(true);
    setLogoError(null);
    try {
      const asset = await fetchEmpresaAsset(empresaId, 'logo_default');
      if (asset) {
        setLogoAsset({ ruta: asset.ruta });
      } else {
        setLogoAsset(null);
      }
    } catch (err) {
      console.warn('No se pudo obtener el logo', err);
      setLogoError(err instanceof Error ? err.message : 'No se pudo cargar el logo');
    } finally {
      setLogoLoading(false);
    }
  };

  const handleLogoFileChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setLogoFile(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('El archivo supera los 5MB');
      setLogoFile(null);
      return;
    }
    setLogoError(null);
    setLogoSuccess(null);
    setLogoFile(file);
  };

  const handleUploadLogo = async () => {
    if (!editId) {
      setLogoError('Guarda primero la empresa para subir su logo');
      return;
    }
    if (!logoFile) {
      setLogoError('Selecciona un archivo');
      return;
    }
    if (logoFile.size > 5 * 1024 * 1024) {
      setLogoError('El archivo supera los 5MB');
      return;
    }
    setUploadingLogo(true);
    setLogoError(null);
    setLogoSuccess(null);
    try {
      const asset = await uploadEmpresaAsset(editId, logoFile, 'logo_default');
      setLogoAsset({ ruta: asset.ruta });
      setLogoSuccess('Logo actualizado exitosamente');
      setLogoFile(null);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'No se pudo subir el logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1d2f68">
            Empresas
          </Typography>
          <Typography variant="body2" color="#4b5563">
            Administra las empresas registradas. Solo se listan las activas por orden de nombre.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreate}
          sx={{ textTransform: 'none', fontWeight: 700, backgroundColor: '#1d2f68' }}
        >
          Nueva empresa
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
              <TableCell>Identificador</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>RFC</TableCell>
              <TableCell>Régimen fiscal</TableCell>
              <TableCell>Correo</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7}>Cargando...</TableCell>
              </TableRow>
            ) : empresas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>No hay empresas activas registradas.</TableCell>
              </TableRow>
            ) : (
              empresas.map((empresa) => (
                <TableRow key={empresa.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography fontWeight={600}>{empresa.identificador}</Typography>
                      <Chip label={empresa.activo ? 'Activa' : 'Inactiva'} color={empresa.activo ? 'success' : 'default'} size="small" />
                    </Stack>
                  </TableCell>
                  <TableCell>{empresa.nombre}</TableCell>
                  <TableCell>{empresa.rfc}</TableCell>
                  <TableCell>{regimenLookup[empresa.regimen_fiscal_id || ''] || empresa.regimen_fiscal || empresa.regimen_fiscal_id}</TableCell>
                  <TableCell>{empresa.email || '—'}</TableCell>
                  <TableCell>{estadoLookup[empresa.codigo_postal_id || ''] || empresa.estado_id}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => handleOpenEdit(empresa)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {empresa.activo ? (
                        <Tooltip title="Desactivar">
                          <IconButton size="small" color="error" onClick={() => handleDesactivar(empresa)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Activar">
                          <IconButton size="small" color="primary" onClick={() => handleActivar(empresa)}>
                            <ReplayIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{tituloDialogo}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, pt: 2 }}>
          {formError && (
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Alert severity="warning" onClose={() => setFormError(null)}>
                {formError}
              </Alert>
            </Box>
          )}
          <TextField
            label="Identificador"
            required
            fullWidth
            value={form.identificador || ''}
            onChange={(e) => handleChange('identificador', e.target.value)}
          />
          <TextField
            label="Nombre"
            required
            fullWidth
            value={form.nombre || ''}
            onChange={(e) => handleChange('nombre', e.target.value)}
          />
          <TextField
            label="Razón social"
            required
            fullWidth
            value={form.razon_social || ''}
            onChange={(e) => handleChange('razon_social', e.target.value)}
          />
          <TextField
            label="RFC"
            required
            fullWidth
            value={form.rfc || ''}
            onChange={(e) => handleChange('rfc', e.target.value)}
          />
          <TextField
            select
            label="Régimen fiscal"
            required
            fullWidth
            value={form.regimen_fiscal_id || ''}
            onChange={(e) => handleChange('regimen_fiscal_id', e.target.value)}
            SelectProps={{ native: false }}
            InputProps={{ endAdornment: regimenLoading ? <CircularProgress size={18} /> : undefined }}
          >
            {regimenOptions.map((opt) => (
              <MenuItem key={opt.id} value={opt.id}>
                {`${opt.id} - ${opt.descripcion}`}
              </MenuItem>
            ))}
            {!regimenOptions.find((o) => o.id === form.regimen_fiscal_id) && form.regimen_fiscal_id ? (
              <MenuItem value={form.regimen_fiscal_id}>
                {form.regimen_fiscal_id} (no catalogado)
              </MenuItem>
            ) : null}
          </TextField>
          <TextField
            label="Código postal SAT"
            required
            fullWidth
            value={form.codigo_postal_id || ''}
            onChange={handleCpSatChange}
            InputProps={{ endAdornment: cpSatLoading ? <CircularProgress size={18} /> : null }}
            helperText={cpSatError || 'Ingresa 5 dígitos para cargar estado, localidad y colonias'}
          />
          <Autocomplete
            options={coloniasSatOptions}
            loading={coloniasSatLoading || cpSatLoading}
            value={
              coloniasSatOptions.find((c) => c.clave === form.colonia_id) ||
              (form.colonia_id ? { clave: form.colonia_id, nombre: form.colonia_id } : null)
            }
            getOptionLabel={(option) => option.nombre || option.clave || ''}
            onChange={(_, value) => setForm((prev) => ({ ...prev, colonia_id: value?.clave || '' }))}
            renderInput={(params) => {
              const { InputLabelProps: _omitLabelProps, ...rest } = params;
              return (
                <TextField
                  {...rest}
                  label="Colonia SAT"
                  size={params.size ?? 'medium'}
                  fullWidth
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {(coloniasSatLoading || cpSatLoading) && <CircularProgress size={18} />}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                  placeholder={form.codigo_postal_id?.length !== 5 ? 'Ingresa CP SAT primero' : ''}
                />
              );
            }}
            noOptionsText={form.codigo_postal_id?.length === 5 ? 'Sin resultados' : 'Ingresa CP SAT'}
            disabled={!form.codigo_postal_id || form.codigo_postal_id.length !== 5}
          />
          <TextField
            label="Estado SAT"
            required
            fullWidth
            value={estadoNombre}
            InputProps={{ readOnly: true }}
          />
          <TextField
            label="Localidad / Municipio"
            fullWidth
            value={localidadNombre}
            InputProps={{ readOnly: true }}
          />
          <TextField label="Calle" fullWidth value={form.calle || ''} onChange={(e) => handleChange('calle', e.target.value)} />
          <TextField
            label="Número exterior"
            fullWidth
            value={form.numero_exterior || ''}
            onChange={(e) => handleChange('numero_exterior', e.target.value)}
          />
          <TextField
            label="Número interior"
            fullWidth
            value={form.numero_interior || ''}
            onChange={(e) => handleChange('numero_interior', e.target.value)}
          />
          <TextField label="País" fullWidth value={form.pais || ''} onChange={(e) => handleChange('pais', e.target.value)} />
          <TextField
            label="Teléfono"
            fullWidth
            value={form.telefono || ''}
            onChange={(e) => handleChange('telefono', e.target.value)}
          />
          <TextField label="Email" fullWidth value={form.email || ''} onChange={(e) => handleChange('email', e.target.value)} />
          <TextField
            label="Sitio web"
            fullWidth
            value={form.sitio_web || ''}
            onChange={(e) => handleChange('sitio_web', e.target.value)}
          />
          <Box sx={{ gridColumn: '1 / -1', border: '1px solid #e5e7eb', borderRadius: 1, p: 2, backgroundColor: '#fafafa' }}>
            <Typography variant="h6" gutterBottom>
              Imagen corporativa
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Logo principal (tipo: <strong>logo_default</strong>). Tamaño máximo 5MB.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <Button variant="outlined" component="label" sx={{ textTransform: 'none' }}>
                Seleccionar archivo
                <input type="file" accept="image/*" hidden onChange={handleLogoFileChange} />
              </Button>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {logoFile ? `${logoFile.name} (${Math.round(logoFile.size / 1024)} KB)` : 'Ningún archivo seleccionado'}
              </Typography>
              <Button
                variant="contained"
                onClick={handleUploadLogo}
                disabled={!editId || uploadingLogo || !logoFile}
                sx={{ textTransform: 'none' }}
              >
                {uploadingLogo ? 'Subiendo...' : 'Subir logo'}
              </Button>
            </Stack>
            <Box mt={2}>
              {logoError && (
                <Alert severity="error" onClose={() => setLogoError(null)}>
                  {logoError}
                </Alert>
              )}
              {logoSuccess && (
                <Alert severity="success" onClose={() => setLogoSuccess(null)}>
                  {logoSuccess}
                </Alert>
              )}
            </Box>
            <Box mt={2}>
              {logoLoading ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={18} />
                  <Typography variant="body2">Cargando logo...</Typography>
                </Stack>
              ) : logoAsset ? (
                <Stack spacing={1}>
                  <Typography variant="body2" color="text.secondary">
                    Logo actual:
                  </Typography>
                  <Box
                    component="img"
                    src={buildAssetUrl(logoAsset.ruta)}
                    alt="Logo de la empresa"
                    sx={{ maxWidth: 240, maxHeight: 120, objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: 1, p: 1, backgroundColor: '#fff' }}
                  />
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No hay un logo principal cargado.
                </Typography>
              )}
            </Box>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(form.activo)}
                onChange={(e) => handleChange('activo', e.target.checked)}
                color="primary"
              />
            }
            label="Empresa activa"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={saving}>
            GUARDAR
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
