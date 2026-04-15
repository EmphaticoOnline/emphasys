import * as React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  Autocomplete,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  Switch,
  TextField,
  Typography,
  Paper,
  Stack,
  CircularProgress,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { getContacto, crearContacto, actualizarContacto, obtenerCatalogosConfigurablesContacto, guardarCatalogosConfigurablesContacto, type CatalogoConfigurablesRespuesta } from '../services/contactos.api';
import { apiFetch } from '../services/apiFetch';
import { fetchVendedores } from '../services/contactosService';
import type { Contacto, ContactoDetalle } from '../types/contactos.types';
import { getEmpresaActivaId } from '../utils/empresaUtils';

type FormState = {
  nombre: string;
  tipo_contacto: string;
  clasificacion: string;
  origen_contacto: string;
  vendedor_id: string;
  rfc: string;
  email: string;
  telefono: string;
  telefono_secundario: string;
  activo: boolean;
  calle: string;
  numero_exterior: string;
  numero_interior: string;
  colonia: string;
  ciudad: string;
  estado: string;
  cp: string;
  pais: string;
  cp_sat: string;
  colonia_sat: string;
  rfc_fiscal: string;
  regimen_fiscal: string;
  uso_cfdi: string;
  forma_pago: string;
  metodo_pago: string;
};

const initialState: FormState = {
  nombre: '',
  tipo_contacto: 'Cliente',
  clasificacion: '',
  origen_contacto: '',
  vendedor_id: '',
  rfc: '',
  email: '',
  telefono: '',
  telefono_secundario: '',
  activo: true,
  calle: '',
  numero_exterior: '',
  numero_interior: '',
  colonia: '',
  ciudad: '',
  estado: '',
  cp: '',
  pais: '',
  cp_sat: '',
  colonia_sat: '',
  rfc_fiscal: '',
  regimen_fiscal: '',
  uso_cfdi: '',
  forma_pago: '',
  metodo_pago: '',
};

type CatalogoComercialValor = {
  id: number;
  tipo_catalogo_id: number;
  descripcion: string;
  clave: string | null;
  orden: number | null;
};

type CatalogoComercialTipo = {
  id: number;
  nombre: string | null;
  descripcion: string | null;
  valores: CatalogoComercialValor[];
};

export default function ContactoFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

function validarRFC(rfc: string) {
  const regex = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/i;
  return regex.test(rfc);
}

  const [form, setForm] = useState<FormState>(initialState);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(!!id);
  const [saving, setSaving] = useState<boolean>(false);
  const [rfcError, setRfcError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cpSatError, setCpSatError] = useState<string | null>(null);

  const [comercialTipos, setComercialTipos] = useState<CatalogoComercialTipo[]>([]);
  const [comercialSeleccionados, setComercialSeleccionados] = useState<Record<number, number[]>>({});
  const [comercialLoading, setComercialLoading] = useState<boolean>(false);
  const [comercialError, setComercialError] = useState<string | null>(null);

  const [vendedores, setVendedores] = useState<Contacto[]>([]);

  const [cpSatLoading, setCpSatLoading] = useState<boolean>(false);
  const [coloniasSatLoading, setColoniasSatLoading] = useState<boolean>(false);
  const [coloniasSatOptions, setColoniasSatOptions] = useState<{ colonia: string; texto: string }[]>([]);

  const [regimenLoading, setRegimenLoading] = useState(false);
  const [regimenOptions, setRegimenOptions] = useState<{ clave: string; nombre: string }[]>([]);
  const [regimenSearch, setRegimenSearch] = useState('');

  const [usoLoading, setUsoLoading] = useState(false);
  const [usoOptions, setUsoOptions] = useState<{ clave: string; nombre: string }[]>([]);
  const [usoSearch, setUsoSearch] = useState('');

  const [formaLoading, setFormaLoading] = useState(false);
  const [formaOptions, setFormaOptions] = useState<{ clave: string; nombre: string }[]>([]);
  const [formaSearch, setFormaSearch] = useState('');

  const [metodoLoading, setMetodoLoading] = useState(false);
  const [metodoOptions, setMetodoOptions] = useState<{ clave: string; nombre: string }[]>([]);
  const [metodoSearch, setMetodoSearch] = useState('');

  const debounceRefs = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const cpSatPrefetchDone = React.useRef(false);

  const buildSeleccionInicial = (
    tipos: CatalogoComercialTipo[],
    seleccionados: number[]
  ): Record<number, number[]> => {
    const seleccionSet = new Set(seleccionados);
    return tipos.reduce<Record<number, number[]>>((acc, tipo) => {
      acc[tipo.id] = tipo.valores.filter((v) => seleccionSet.has(v.id)).map((v) => v.id);
      return acc;
    }, {});
  };

  useEffect(() => {
    let isMounted = true;

    const loadComercial = async () => {
      setComercialLoading(true);
      try {
        const data: CatalogoConfigurablesRespuesta = await obtenerCatalogosConfigurablesContacto(id ? Number(id) : undefined);
        if (!isMounted) return;
        setComercialTipos(data.tipos || []);
        setComercialSeleccionados(buildSeleccionInicial(data.tipos || [], data.seleccionados || []));
        setComercialError(null);
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : 'Error al cargar catálogos comerciales';
        setComercialError(message);
        setComercialTipos([]);
        setComercialSeleccionados({});
      } finally {
        if (isMounted) setComercialLoading(false);
      }
    };

    loadComercial();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    let isMounted = true;

    const loadVendedores = async () => {
      try {
        const data = await fetchVendedores();
        if (isMounted) setVendedores(data);
      } catch (err) {
        if (isMounted) setVendedores([]);
      }
    };

    loadVendedores();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const response = await getContacto(Number(id));
        const isDetalle = (resp: any): resp is ContactoDetalle => 'contacto' in resp;

        const contacto: Contacto = isDetalle(response) ? response.contacto : (response as Contacto);
        const domicilio = isDetalle(response) ? response.domicilio_principal : undefined;
        const datosFiscales = isDetalle(response) ? response.datos_fiscales : undefined;

        const c = contacto as Record<string, any>;
        if (!isMounted) return;
        setForm({
          nombre: contacto.nombre || '',
          tipo_contacto: contacto.tipo_contacto || 'Cliente',
          clasificacion: contacto.clasificacion || '',
          origen_contacto: contacto.origen_contacto || '',
          vendedor_id: contacto.vendedor_id ? String(contacto.vendedor_id) : '',
          rfc: contacto.rfc || '',
          email: contacto.email || '',
          telefono: contacto.telefono || '',
          telefono_secundario: contacto.telefono_secundario || '',
          activo: contacto.activo ?? true,
          calle: domicilio?.calle || c.calle || '',
          numero_exterior: domicilio?.numero_exterior || c.numero_exterior || '',
          numero_interior: domicilio?.numero_interior || c.numero_interior || '',
          colonia: domicilio?.colonia || c.colonia || '',
          ciudad: domicilio?.ciudad || c.ciudad || '',
          estado: domicilio?.estado || c.estado || '',
          cp: domicilio?.cp || c.cp || '',
          pais: domicilio?.pais || c.pais || '',
          cp_sat: domicilio?.cp_sat || c.cp_sat || '',
          colonia_sat: domicilio?.colonia_sat || c.colonia_sat || '',
          rfc_fiscal: datosFiscales?.rfc || c.rfc_fiscal || '',
          regimen_fiscal: datosFiscales?.regimen_fiscal || c.regimen_fiscal || '',
          uso_cfdi: datosFiscales?.uso_cfdi || c.uso_cfdi || '',
          forma_pago: datosFiscales?.forma_pago || c.forma_pago || '',
          metodo_pago: datosFiscales?.metodo_pago || c.metodo_pago || '',
        });
      } catch (err: unknown) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : 'Error al cargar contacto';
        setError(message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (id) {
      load();
    }

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleTextChange = (field: keyof FormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const fetchJson = async <T,>(url: string): Promise<T> => apiFetch<T>(url);

  const normalizeNombre = (value: any) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.nombre || value.texto || value.clave || '';
  };

  const loadColoniasSat = async (cp: string) => {
    const cpTrim = cp.trim();
    if (!cpTrim) {
      setColoniasSatOptions([]);
      return;
    }
    setColoniasSatLoading(true);
    try {
      const data = await fetchJson<{ items: { colonia: string; texto: string }[] }>(`/api/sat/colonias/${cpTrim}`);
      setColoniasSatOptions(data.items || []);
    } catch (err) {
      console.error('No se pudo cargar colonias SAT', err);
      setColoniasSatOptions([]);
    } finally {
      setColoniasSatLoading(false);
    }
  };

  const loadCpSatData = async (cp: string) => {
    setCpSatLoading(true);
    setCpSatError(null);
    try {
      const data = await fetchJson<{
        codigo_postal?: string;
        cp?: string;
        estado?: { clave?: string; nombre?: string } | string;
        municipio?: { clave?: string; nombre?: string } | string;
        localidad?: { clave?: string; nombre?: string } | string;
        pais?: { clave?: string; nombre?: string } | string;
      }>(`/api/sat/codigos-postales/${cp}`);

      const estadoNombre = normalizeNombre(data.estado);
      const ciudadNombre = normalizeNombre(data.localidad || data.municipio);
      const paisNombre = normalizeNombre(data.pais) || 'MEX';

      setForm((prev) => ({
        ...prev,
        estado: estadoNombre || prev.estado,
        ciudad: ciudadNombre || prev.ciudad,
        pais: paisNombre || prev.pais,
      }));

      await loadColoniasSat(cp);
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
    setForm((prev) => ({ ...prev, cp_sat: value, colonia_sat: '' }));
    setCpSatError(null);

    if (value.length === 5) {
      loadCpSatData(value);
    } else {
      setColoniasSatOptions([]);
    }
  };

  useEffect(() => {
    if (cpSatPrefetchDone.current) return;
    if (form.cp_sat && form.cp_sat.length === 5) {
      cpSatPrefetchDone.current = true;
      loadCpSatData(form.cp_sat);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cp_sat]);

  const mapRegimenItems = (items: any[]) => (items || []).map((r) => ({ clave: r.id, nombre: r.descripcion }));

  const loadCatalog = (
    endpoint: string,
    search: string,
    setter: React.Dispatch<React.SetStateAction<{ clave: string; nombre: string }[]>>,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>,
    debounceKey: string,
    mapper?: (items: any[]) => { clave: string; nombre: string }[]
  ) => {
    if (debounceRefs.current[debounceKey]) {
      clearTimeout(debounceRefs.current[debounceKey] as number);
    }
    debounceRefs.current[debounceKey] = setTimeout(async () => {
      setLoading(true);
      try {
  const url = new URL(endpoint, window.location.origin);
  if (search) url.searchParams.set('q', search);
  // Catálogo SAT de formas de pago tiene >20 registros; pedimos hasta 50.
  url.searchParams.set('limit', '50');
    const data = await fetchJson<{ items: any[] }>(url.pathname + url.search);
    const items = mapper ? mapper(data.items || []) : data.items || [];
    setter(items);
      } catch (err) {
        console.error('Error cargando catálogo', endpoint, err);
        setter([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  // Precargar catálogos SAT para mostrar descripción completa en modo edición.
  useEffect(() => {
    loadCatalog('/api/catalogos/sat/regimenes-fiscales', '', setRegimenOptions, setRegimenLoading, 'regimen', mapRegimenItems);
    loadCatalog('/api/catalogos/sat/usos-cfdi', '', setUsoOptions, setUsoLoading, 'uso');
    loadCatalog('/api/catalogos/sat/formas-pago', '', setFormaOptions, setFormaLoading, 'forma');
    loadCatalog('/api/catalogos/sat/metodos-pago', '', setMetodoOptions, setMetodoLoading, 'metodo');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectChange = (event: SelectChangeEvent<string>) => {
    setForm((prev) => ({ ...prev, tipo_contacto: event.target.value }));
  };

  const handleComercialChange = (tipoId: number, values: CatalogoComercialValor[]) => {
    setComercialSeleccionados((prev) => ({
      ...prev,
      [tipoId]: values.map((v) => v.id),
    }));
  };

  const handleComercialSingleChange = (tipoId: number, catalogoId: number | '') => {
    setComercialSeleccionados((prev) => ({
      ...prev,
      [tipoId]: catalogoId ? [Number(catalogoId)] : [],
    }));
  };

  const catalogoTipoIds = {
    clasificacion: Number(import.meta.env.VITE_CONTACTO_CLASIFICACION_TIPO_ID) || null,
    origen: Number(import.meta.env.VITE_CONTACTO_ORIGEN_TIPO_ID) || null,
  };

  const normalizarTexto = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const obtenerCatalogoTipo = (nombre: string, id?: number | null) => {
    if (id) return comercialTipos.find((tipo) => tipo.id === id);
    const lookup = normalizarTexto(nombre);
    return comercialTipos.find((tipo) => normalizarTexto(tipo.nombre || '').includes(lookup));
  };

  const obtenerCatalogosSeleccionados = () => {
    const todos = Object.values(comercialSeleccionados).flat();
    return Array.from(new Set(todos));
  };

  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, activo: event.target.checked }));
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      nombre: form.nombre.trim(),
      tipo_contacto: form.tipo_contacto,
      clasificacion: form.clasificacion.trim() || null,
      origen_contacto: form.origen_contacto.trim() || null,
      vendedor_id: form.vendedor_id ? Number(form.vendedor_id) : null,
      rfc: form.rfc || null,
      email: form.email || null,
      telefono: form.telefono || null,
      telefono_secundario: form.telefono_secundario || null,
      activo: Boolean(form.activo),
      calle: form.calle.trim() || null,
      numero_exterior: form.numero_exterior.trim() || null,
      numero_interior: form.numero_interior.trim() || null,
      colonia: form.colonia.trim() || null,
      ciudad: form.ciudad.trim() || null,
      estado: form.estado.trim() || null,
      cp: form.cp.trim() || null,
      pais: form.pais.trim() || null,
  cp_sat: form.cp_sat.trim() || null,
  colonia_sat: form.colonia_sat.trim() || null,
      rfc_fiscal: form.rfc_fiscal.trim() || null,
      regimen_fiscal: form.regimen_fiscal.trim() || null,
      uso_cfdi: form.uso_cfdi.trim() || null,
      forma_pago: form.forma_pago.trim() || null,
      metodo_pago: form.metodo_pago.trim() || null,
      empresa_id: getEmpresaActivaId(),
    };

    try {
      let contactoIdCreado = id ? Number(id) : null;

      if (id) {
        await actualizarContacto(Number(id), payload);
      } else {
        const nuevo = await crearContacto(payload);
        contactoIdCreado = nuevo?.id ?? null;
      }

      if (contactoIdCreado && Number.isFinite(contactoIdCreado)) {
        const catalogoIds = obtenerCatalogosSeleccionados();
        await guardarCatalogosConfigurablesContacto(contactoIdCreado, catalogoIds);
      }
      navigate('/contactos');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar contacto';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Typography sx={{ p: 2 }}>Cargando...</Typography>;
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', px: 2, py: 2 }}>
      <Box sx={{ width: '100%', maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h5" fontWeight={600} color="#1d2f68">
              {id ? 'Editar contacto' : 'Nuevo contacto'}
            </Typography>
            <Typography variant="body2" color="#4b5563">
              Completa la información del contacto.
            </Typography>
          </Box>
        </Box>

        {error && (
          <Paper sx={{ p: 2, backgroundColor: '#fff5f5', border: '1px solid #fecaca' }}>
            <Typography color="#b91c1c">{error}</Typography>
          </Paper>
        )}

        <Paper component="form" onSubmit={handleSubmit} sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 1,
              position: 'sticky',
              top: 0,
              zIndex: 1,
              backgroundColor: '#fff',
              pb: 1.5,
              mb: 1,
              borderBottom: '1px solid #e5e7eb',
            }}
          >
            <Button variant="outlined" color="secondary" onClick={() => navigate('/contactos')} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" color="primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </Box>

          <Stack spacing={2}>
            <Tabs value={activeTab} onChange={handleTabChange} variant="scrollable" allowScrollButtonsMobile>
              <Tab label="Información general" />
              <Tab label="Domicilio" />
              <Tab label="Datos fiscales" />
              <Tab label="Comercial" />
            </Tabs>

            {activeTab === 0 && (
              <Stack spacing={2}>
                <TextField
                  label="Nombre"
                  value={form.nombre}
                  onChange={handleTextChange('nombre')}
                  required
                  fullWidth
                />

                <FormControl fullWidth>
                  <InputLabel id="tipo-contacto-label">Tipo de contacto</InputLabel>
                  <Select
                    labelId="tipo-contacto-label"
                    label="Tipo de contacto"
                    value={form.tipo_contacto}
                    onChange={handleSelectChange}
                  >
                    <MenuItem value="Lead">Lead</MenuItem>
                    <MenuItem value="Cliente">Cliente</MenuItem>
                    <MenuItem value="Proveedor">Proveedor</MenuItem>
                    <MenuItem value="Vendedor">Vendedor</MenuItem>
                  </Select>
                </FormControl>

                {(() => {
                  const clasificacionTipo = obtenerCatalogoTipo('clasificacion', catalogoTipoIds.clasificacion);
                  const clasificacionSeleccion = clasificacionTipo
                    ? comercialSeleccionados[clasificacionTipo.id]?.[0] ?? ''
                    : '';
                  return (
                    <FormControl fullWidth disabled={!clasificacionTipo}>
                      <InputLabel id="clasificacion-label">Clasificación</InputLabel>
                      <Select
                        labelId="clasificacion-label"
                        label="Clasificación"
                        value={clasificacionSeleccion ? String(clasificacionSeleccion) : ''}
                        onChange={(event) => {
                          if (!clasificacionTipo) return;
                          const value = event.target.value;
                          handleComercialSingleChange(
                            clasificacionTipo.id,
                            value ? Number(value) : ''
                          );
                        }}
                      >
                        <MenuItem value="">
                          <em>Sin clasificación</em>
                        </MenuItem>
                        {clasificacionTipo?.valores.map((valor) => (
                          <MenuItem key={valor.id} value={String(valor.id)}>
                            {valor.clave || valor.descripcion}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  );
                })()}

                {(() => {
                  const origenTipo = obtenerCatalogoTipo('origen', catalogoTipoIds.origen);
                  const origenSeleccion = origenTipo
                    ? comercialSeleccionados[origenTipo.id]?.[0] ?? ''
                    : '';
                  return (
                    <FormControl fullWidth disabled={!origenTipo}>
                      <InputLabel id="origen-contacto-label">Origen de contacto</InputLabel>
                      <Select
                        labelId="origen-contacto-label"
                        label="Origen de contacto"
                        value={origenSeleccion ? String(origenSeleccion) : ''}
                        onChange={(event) => {
                          if (!origenTipo) return;
                          const value = event.target.value;
                          handleComercialSingleChange(origenTipo.id, value ? Number(value) : '');
                        }}
                      >
                        <MenuItem value="">
                          <em>Sin origen</em>
                        </MenuItem>
                        {origenTipo?.valores.map((valor) => (
                          <MenuItem key={valor.id} value={String(valor.id)}>
                            {valor.clave || valor.descripcion}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  );
                })()}

                <Autocomplete
                  options={vendedores}
                  getOptionLabel={(option) => option.nombre || ''}
                  value={vendedores.find((v) => v.id === Number(form.vendedor_id)) || null}
                  onChange={(_, value) => setForm((prev) => ({ ...prev, vendedor_id: value ? String(value.id) : '' }))}
                  renderInput={(params) => (
                    <TextField
                      {...(params as any)}
                      label="Vendedor"
                      fullWidth
                    />
                  )}
                />

                <TextField label="RFC" value={form.rfc} onChange={handleTextChange('rfc')} fullWidth />
                <TextField label="Email" value={form.email} onChange={handleTextChange('email')} fullWidth />
                <TextField label="Teléfono" value={form.telefono} onChange={handleTextChange('telefono')} fullWidth />
                <TextField
                  label="Teléfono secundario"
                  value={form.telefono_secundario}
                  onChange={handleTextChange('telefono_secundario')}
                  fullWidth
                />

                <FormControlLabel
                  control={<Switch checked={form.activo} onChange={handleSwitchChange} />}
                  label="Activo"
                />
              </Stack>
            )}

            {activeTab === 1 && (
              <Stack spacing={2}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 2,
                  }}
                >
                  <Box sx={{ gridColumn: { sm: 'span 2' } }}>
                    <TextField
                      label="Calle"
                      value={form.calle}
                      onChange={handleTextChange('calle')}
                      fullWidth
                    />
                  </Box>
                  <TextField
                    label="Número exterior"
                    value={form.numero_exterior}
                    onChange={handleTextChange('numero_exterior')}
                    fullWidth
                  />
                  <TextField
                    label="Número interior"
                    value={form.numero_interior}
                    onChange={handleTextChange('numero_interior')}
                    fullWidth
                  />
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 2,
                  }}
                >
                  <TextField
                    label="Código Postal SAT"
                    value={form.cp_sat}
                    onChange={handleCpSatChange}
                    fullWidth
                    InputProps={{ endAdornment: cpSatLoading ? <CircularProgress size={18} /> : null }}
                    helperText={cpSatError || 'Al capturar 5 dígitos se cargan estado, ciudad y colonias SAT'}
                    error={Boolean(cpSatError)}
                  />
                  <Autocomplete
                    options={coloniasSatOptions}
                    loading={coloniasSatLoading || cpSatLoading}
                    value={
                      coloniasSatOptions.find((c) => c.colonia === form.colonia_sat) ||
                      (form.colonia_sat ? { colonia: form.colonia_sat, texto: form.colonia_sat } : null)
                    }
                    getOptionLabel={(option) => option.texto || option.colonia || ''}
                    onChange={(_, value) => setForm((prev) => ({ ...prev, colonia_sat: value?.colonia || '' }))}
                    renderInput={(params) => (
                      <TextField
                        {...(params as any)}
                        label="Colonia SAT"
                        size="medium"
                        fullWidth
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {(coloniasSatLoading || cpSatLoading) && <CircularProgress size={18} />}
                              {params.InputProps.endAdornment}
                            </>
                          ) as React.ReactNode,
                        }}
                        placeholder={form.cp_sat?.length !== 5 ? 'Ingresa CP SAT primero' : ''}
                      />
                    )}
                    noOptionsText={form.cp_sat?.length === 5 ? 'Sin resultados' : 'Ingresa CP SAT'}
                    disabled={!form.cp_sat || form.cp_sat.length !== 5}
                  />
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
                    gap: 2,
                  }}
                >
                  <TextField
                    label="Ciudad"
                    value={form.ciudad}
                    fullWidth
                    onChange={handleTextChange('ciudad')}
                  />
                  <TextField
                    label="Estado"
                    value={form.estado}
                    fullWidth
                    onChange={handleTextChange('estado')}
                  />
                  <TextField
                    label="País"
                    value={form.pais}
                    fullWidth
                    onChange={handleTextChange('pais')}
                  />
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 2,
                  }}
                >
                  <TextField
                    label="CP (manual)"
                    value={form.cp}
                    onChange={handleTextChange('cp')}
                    fullWidth
                  />

                  <TextField
                    label="Colonia (manual)"
                    value={form.colonia}
                    onChange={handleTextChange('colonia')}
                    fullWidth
                  />
                </Box>

              </Stack>
            )}

            {activeTab === 2 && (
              <Stack spacing={2}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 2,
                  }}
                >
                  <TextField
                    label="RFC fiscal"
                    value={form.rfc_fiscal}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();

                      setForm((prev) => ({
                        ...prev,
                        rfc_fiscal: value,
                      }));

                      if (value.length >= 12) {
                        if (!validarRFC(value)) {
                          setRfcError('RFC inválido');
                        } else {
                          setRfcError(null);
                        }
                      } else {
                        setRfcError(null);
                      }
                    }}
                    error={Boolean(rfcError)}
                    helperText={rfcError || ''}
                    fullWidth
                  />
                  <Autocomplete
                    options={regimenOptions}
                    loading={regimenLoading}
                    value={regimenOptions.find((o) => o.clave === form.regimen_fiscal) || (form.regimen_fiscal ? { clave: form.regimen_fiscal, nombre: form.regimen_fiscal } : null)}
                    getOptionLabel={(option) => option?.nombre || ''}
                    onInputChange={(_, value) => {
                      setRegimenSearch(value);
                      loadCatalog(
                        '/api/catalogos/sat/regimenes-fiscales',
                        value,
                        setRegimenOptions,
                        setRegimenLoading,
                        'regimen',
                        mapRegimenItems
                      );
                    }}
                    onChange={(_, value) => setForm((prev) => ({ ...prev, regimen_fiscal: value?.clave || '' }))}
                    renderInput={(params) => (
                      <TextField
                        {...(params as any)}
                        label="Régimen fiscal"
                        fullWidth
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {regimenLoading && <CircularProgress size={18} />} {params.InputProps.endAdornment}
                            </>
                          ) as React.ReactNode,
                        }}
                        noValidate
                        placeholder="Buscar"
                      />
                    )}
                    noOptionsText="Sin resultados"
                    onOpen={() => {
                      if (!regimenOptions.length) {
                        loadCatalog('/api/catalogos/sat/regimenes-fiscales', '', setRegimenOptions, setRegimenLoading, 'regimen', mapRegimenItems);
                      }
                    }}
                  />
                  <Autocomplete
                    options={usoOptions}
                    loading={usoLoading}
                    value={usoOptions.find((o) => o.clave === form.uso_cfdi) || (form.uso_cfdi ? { clave: form.uso_cfdi, nombre: form.uso_cfdi } : null)}
                    getOptionLabel={(option) => option?.nombre || ''}
                    onInputChange={(_, value) => {
                      setUsoSearch(value);
                      loadCatalog('/api/catalogos/sat/usos-cfdi', value, setUsoOptions, setUsoLoading, 'uso');
                    }}
                    onChange={(_, value) => setForm((prev) => ({ ...prev, uso_cfdi: value?.clave || '' }))}
                    renderInput={(params) => (
                      <TextField
                        {...(params as any)}
                        label="Uso CFDI"
                        fullWidth
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {usoLoading && <CircularProgress size={18} />} {params.InputProps.endAdornment}
                            </>
                          ) as React.ReactNode,
                        }}
                        placeholder="Buscar"
                      />
                    )}
                    noOptionsText="Sin resultados"
                    onOpen={() => {
                      if (!usoOptions.length) {
                        loadCatalog('/api/catalogos/sat/usos-cfdi', '', setUsoOptions, setUsoLoading, 'uso');
                      }
                    }}
                  />
                  <Autocomplete
                    options={formaOptions}
                    loading={formaLoading}
                    value={formaOptions.find((o) => o.clave === form.forma_pago) || (form.forma_pago ? { clave: form.forma_pago, nombre: form.forma_pago } : null)}
                    getOptionLabel={(option) => option?.nombre || ''}
                    onInputChange={(_, value) => {
                      setFormaSearch(value);
                      loadCatalog('/api/catalogos/sat/formas-pago', value, setFormaOptions, setFormaLoading, 'forma');
                    }}
                    onChange={(_, value) => setForm((prev) => ({ ...prev, forma_pago: value?.clave || '' }))}
                    renderInput={(params) => (
                      <TextField
                        {...(params as any)}
                        label="Forma de pago"
                        fullWidth
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {formaLoading && <CircularProgress size={18} />} {params.InputProps.endAdornment}
                            </>
                          ) as React.ReactNode,
                        }}
                        placeholder="Buscar"
                      />
                    )}
                    noOptionsText="Sin resultados"
                    onOpen={() => {
                      if (!formaOptions.length) {
                        loadCatalog('/api/catalogos/sat/formas-pago', '', setFormaOptions, setFormaLoading, 'forma');
                      }
                    }}
                  />
                  <Autocomplete
                    options={metodoOptions}
                    loading={metodoLoading}
                    value={metodoOptions.find((o) => o.clave === form.metodo_pago) || (form.metodo_pago ? { clave: form.metodo_pago, nombre: form.metodo_pago } : null)}
                    getOptionLabel={(option) => option?.nombre || ''}
                    onInputChange={(_, value) => {
                      setMetodoSearch(value);
                      loadCatalog('/api/catalogos/sat/metodos-pago', value, setMetodoOptions, setMetodoLoading, 'metodo');
                    }}
                    onChange={(_, value) => setForm((prev) => ({ ...prev, metodo_pago: value?.clave || '' }))}
                    renderInput={(params) => (
                      <TextField
                        {...(params as any)}
                        label="Método de pago"
                        fullWidth
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {metodoLoading && <CircularProgress size={18} />} {params.InputProps.endAdornment}
                            </>
                          ) as React.ReactNode,
                        }}
                        placeholder="Buscar"
                      />
                    )}
                    noOptionsText="Sin resultados"
                    onOpen={() => {
                      if (!metodoOptions.length) {
                        loadCatalog('/api/catalogos/sat/metodos-pago', '', setMetodoOptions, setMetodoLoading, 'metodo');
                      }
                    }}
                  />
                  {/* Código postal fiscal eliminado; usar cp único */}
                </Box>
              </Stack>
            )}

            {activeTab === 3 && (
              <Stack spacing={2}>
                {comercialLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : comercialError ? (
                  <Typography color="#b91c1c">{comercialError}</Typography>
                ) : !comercialTipos.length ? (
                  <Typography color="#4b5563">No hay catálogos configurables para contactos.</Typography>
                ) : (
                  comercialTipos.map((tipo) => {
                    const seleccionadosIds = comercialSeleccionados[tipo.id] || [];
                    const valorSeleccionado = tipo.valores.filter((v) => seleccionadosIds.includes(v.id));

                    return (
                      <Stack key={tipo.id} spacing={1}>
                        <Box>
                          <Typography variant="subtitle1" fontWeight={600} color="#1d2f68">
                            {tipo.nombre || 'Catálogo'}
                          </Typography>
                          {tipo.descripcion ? (
                            <Typography variant="body2" color="#4b5563">
                              {tipo.descripcion}
                            </Typography>
                          ) : null}
                        </Box>

                        <Autocomplete
                          multiple
                          options={tipo.valores}
                          value={valorSeleccionado}
                          getOptionLabel={(option) => option.clave || option.descripcion || ''}
                          onChange={(_, values) => handleComercialChange(tipo.id, values)}
                          renderInput={(params) => (
                            <TextField
                              {...(params as any)}
                              label={tipo.nombre || 'Valores'}
                              placeholder="Selecciona valores"
                              fullWidth
                            />
                          )}
                          noOptionsText="Sin valores"
                          disableCloseOnSelect
                        />
                      </Stack>
                    );
                  })
                )}
              </Stack>
            )}
          </Stack>

        </Paper>
      </Box>
    </Box>
  );
}