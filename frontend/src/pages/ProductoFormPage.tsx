import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import RichTextEditor from '../components/RichTextEditor';
import EspecificacionesBibliotecaEditor from '../components/productos/EspecificacionesBibliotecaEditor';
import SeccionCard from '../components/productos/formulario/SeccionCard';
import SeccionesIndice, { type SeccionIndiceItem } from '../components/productos/formulario/SeccionesIndice';
import SeccionIdentificacion from '../components/productos/formulario/SeccionIdentificacion';
import SeccionFiscalUnidades, { type ProductoServicioSatOption } from '../components/productos/formulario/SeccionFiscalUnidades';
import SeccionImagenesArchivos from '../components/productos/formulario/SeccionImagenesArchivos';

import type { ProductoBasico, Producto } from '../types/producto';
import {
  createProducto,
  fetchProducto,
  updateProducto,
  obtenerCatalogosConfigurablesProducto,
  guardarCatalogosConfigurablesProducto,
  fetchProductoArchivos,
  uploadProductoImagen,
  deleteProductoArchivo,
  marcarProductoArchivoPrincipal,
  fetchConfiguracionEspecificaciones,
  type CatalogoConfigurablesProductoRespuesta,
  type ProductoArchivo,
} from '../services/productosService';
import { apiFetch, type ApiFetchError } from '../services/apiFetch';
import { fetchCamposObligatorios } from '../services/camposObligatoriosService';
import { PRODUCTOS_CAMPOS } from '../definitions/productos.fields';
import { fetchUnidades, type Unidad } from '../services/unidadesService';
import { useSession } from '../session/useSession';

const initialForm: ProductoBasico = {
  clave: '',
  descripcion: '',
  clasificacion: '',
  tipo_producto: 'Inventariable',
  activo: true,
  clave_producto_sat: null,
  clave_bienes_transportados_sat: null,
  es_material_peligroso: false,
  clave_material_peligroso_sat: null,
  clave_embalaje_sat: null,
  descripcion_embalaje: null,
  unidad_venta_id: null,
  unidad_inventario_id: null,
  factor_conversion: null,
  especificaciones: '',
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

// Mapa campo nativo -> sección del documento, usado solo para pintar el
// indicador de error en el índice lateral (SeccionesIndice).
const CAMPO_A_SECCION: Record<string, 'identificacion' | 'fiscal'> = {
  clave: 'identificacion',
  descripcion: 'identificacion',
  clasificacion: 'identificacion',
  clave_producto_sat: 'fiscal',
  unidad_venta_id: 'fiscal',
  unidad_inventario_id: 'fiscal',
};

function construirEtiquetaObligatoriedad(tipoProducto: string, camposObligatorios: Set<string>): string {
  const etiquetas = Array.from(camposObligatorios)
    .filter((campo) => campo !== 'clave' && campo !== 'descripcion')
    .map((campo) => PRODUCTOS_CAMPOS.find((d) => d.campo === campo)?.etiqueta ?? campo);

  if (etiquetas.length === 0) {
    return `El tipo ${tipoProducto} no tiene campos adicionales configurados como obligatorios. Cambiar el tipo puede activar nuevas reglas.`;
  }

  return `El tipo ${tipoProducto} hace obligatorios: ${etiquetas.join(', ')}. Cambiar el tipo actualiza estas reglas.`;
}

export default function ProductoFormPage() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { session } = useSession();

  // Se captura una sola vez al montar: ¿esta instancia arrancó como alta?
  // Determina si se ofrece "Guardar y nuevo" en la cabecera.
  const esFlujoAltaRef = useRef<boolean>(!routeId || routeId === 'nuevo');
  // Id de ruta al que navegamos nosotros mismos tras crear (alta continua),
  // para que el efecto de carga no vuelva a pedir al servidor datos que ya
  // tenemos en memoria.
  const idAutoNavegadoRef = useRef<string | null>(null);

  const [productoId, setProductoId] = useState<number | null>(() => {
    if (!routeId || routeId === 'nuevo') return null;
    const parsed = Number(routeId);
    return Number.isFinite(parsed) ? parsed : null;
  });
  const isEdit = productoId !== null;

  const [form, setForm] = useState<ProductoBasico>(initialForm);
  const [formSnapshot, setFormSnapshot] = useState<string>(JSON.stringify(initialForm));
  const [loading, setLoading] = useState(isEdit);
  const [loadingUnidades, setLoadingUnidades] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );
  const [productoLoaded, setProductoLoaded] = useState<Producto | null>(null);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [productosSatOptions, setProductosSatOptions] = useState<ProductoServicioSatOption[]>([]);
  const [productosSatLoading, setProductosSatLoading] = useState(false);
  const [comercialTipos, setComercialTipos] = useState<CatalogoComercialTipo[]>([]);
  const [comercialSeleccionados, setComercialSeleccionados] = useState<Record<number, number[]>>({});
  const [comercialSnapshot, setComercialSnapshot] = useState<string>('{}');
  const [comercialLoading, setComercialLoading] = useState<boolean>(false);
  const [comercialError, setComercialError] = useState<string | null>(null);
  const [archivos, setArchivos] = useState<ProductoArchivo[]>([]);
  const [archivosLoading, setArchivosLoading] = useState(false);
  const [archivosError, setArchivosError] = useState<string | null>(null);
  const [uploadingImagenes, setUploadingImagenes] = useState(false);
  const [camposObligatorios, setCamposObligatorios] = useState<Set<string>>(new Set());
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [claveDuplicadaError, setClaveDuplicadaError] = useState<string | null>(null);
  const [especificacionesHabilitadas, setEspecificacionesHabilitadas] = useState(false);
  const [especificacionesVista, setEspecificacionesVista] = useState<'texto' | 'biblioteca'>('texto');
  const [especificacionesCount, setEspecificacionesCount] = useState(0);
  const [archivoActionId, setArchivoActionId] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState('identificacion');
  const imagenesInputRef = React.useRef<HTMLInputElement | null>(null);
  const productosSatDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Estado de error "en vivo": intersección entre lo que falló en el último
  // intento de guardar y lo que es obligatorio HOY según el tipo de producto
  // actual. Corrige el desfase anterior: si el usuario cambia de tipo y un
  // campo deja de ser obligatorio, su marca de error desaparece de inmediato
  // sin esperar a un nuevo intento de guardar.
  const erroresActivos = useMemo(() => {
    const activos = new Set<string>();
    validationErrors.forEach((campo) => {
      if (camposObligatorios.has(campo)) activos.add(campo);
    });
    return activos;
  }, [validationErrors, camposObligatorios]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== formSnapshot || JSON.stringify(comercialSeleccionados) !== comercialSnapshot,
    [form, formSnapshot, comercialSeleccionados, comercialSnapshot]
  );

  useEffect(() => {
    void fetchConfiguracionEspecificaciones()
      .then((config) => setEspecificacionesHabilitadas(config.habilitado))
      .catch(() => setEspecificacionesHabilitadas(false));
  }, [session.empresaActivaId]);

  const loadProductosSat = React.useCallback(async (search: string) => {
    setProductosSatLoading(true);
    try {
      const url = new URL('/api/catalogos/sat/productos-servicios', window.location.origin);
      if (search.trim()) {
        url.searchParams.set('q', search.trim());
      }
      url.searchParams.set('limit', '50');

      const data = await apiFetch<{ items: ProductoServicioSatOption[] }>(`${url.pathname}${url.search}`);
      setProductosSatOptions(data.items || []);
    } catch (err) {
      console.error('No se pudieron cargar productos/servicios SAT', err);
      setProductosSatOptions([]);
    } finally {
      setProductosSatLoading(false);
    }
  }, []);

  const queueLoadProductosSat = React.useCallback((search: string) => {
    if (productosSatDebounceRef.current) {
      clearTimeout(productosSatDebounceRef.current);
    }

    productosSatDebounceRef.current = setTimeout(() => {
      void loadProductosSat(search);
    }, 250);
  }, [loadProductosSat]);

  useEffect(() => {
    const loadUnidades = async () => {
      try {
        setLoadingUnidades(true);
        const data = await fetchUnidades();
        setUnidades(data.filter((u) => u.activo));
      } catch (e) {
        setSnackbar({ open: true, message: e instanceof Error ? e.message : 'No se pudieron cargar unidades', severity: 'error' });
      } finally {
        setLoadingUnidades(false);
      }
    };
    loadUnidades();
  }, []);

  // Carga del producto existente por URL. Se omite deliberadamente cuando el
  // cambio de ruta lo causamos nosotros mismos tras un alta en sitio (ver
  // idAutoNavegadoRef): en ese caso ya tenemos los datos en memoria.
  useEffect(() => {
    if (!routeId || routeId === 'nuevo') return;

    if (idAutoNavegadoRef.current === routeId) {
      idAutoNavegadoRef.current = null;
      return;
    }

    const parsedId = Number(routeId);
    if (!Number.isFinite(parsedId)) return;

    let cancelado = false;
    const load = async () => {
      try {
        setLoading(true);
        const producto = await fetchProducto(parsedId);
        if (cancelado) return;
        setProductoId(producto.id);
        setProductoLoaded(producto);
        const nuevoForm: ProductoBasico = {
          clave: producto.clave,
          descripcion: producto.descripcion,
          clasificacion: producto.clasificacion ?? '',
          tipo_producto: (producto.tipo_producto as ProductoBasico['tipo_producto']) ?? 'Inventariable',
          activo: producto.activo,
          clave_producto_sat: producto.clave_producto_sat ?? null,
          clave_bienes_transportados_sat: producto.clave_bienes_transportados_sat ?? null,
          es_material_peligroso: producto.es_material_peligroso ?? false,
          clave_material_peligroso_sat: producto.clave_material_peligroso_sat ?? null,
          clave_embalaje_sat: producto.clave_embalaje_sat ?? null,
          descripcion_embalaje: producto.descripcion_embalaje ?? null,
          unidad_venta_id: producto.unidad_venta_id ?? null,
          unidad_inventario_id: producto.unidad_inventario_id ?? null,
          factor_conversion: producto.factor_conversion ?? null,
          especificaciones: producto.especificaciones ?? '',
        };
        setForm(nuevoForm);
        setFormSnapshot(JSON.stringify(nuevoForm));
        if (producto.clave_producto_sat) {
          void loadProductosSat(producto.clave_producto_sat);
        }
        setError(null);
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : 'No se pudo cargar el producto');
      } finally {
        if (!cancelado) setLoading(false);
      }
    };
    void load();

    return () => {
      cancelado = true;
    };
  }, [routeId, loadProductosSat]);

  useEffect(() => () => {
    if (productosSatDebounceRef.current) {
      clearTimeout(productosSatDebounceRef.current);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchCamposObligatorios('productos', form.tipo_producto ?? 'Inventariable')
      .then((campos) => { if (isMounted) setCamposObligatorios(new Set(campos)); })
      .catch(() => { if (isMounted) setCamposObligatorios(new Set()); });
    return () => { isMounted = false; };
  }, [form.tipo_producto]);

  const buildSeleccionInicial = (
    tipos: CatalogoComercialTipo[],
    seleccionados: number[]
  ): Record<number, number[]> => {
    const setSel = new Set(seleccionados);
    return tipos.reduce<Record<number, number[]>>((acc, tipo) => {
      acc[tipo.id] = tipo.valores.filter((v) => setSel.has(v.id)).map((v) => v.id);
      return acc;
    }, {});
  };

  // Catálogos comerciales: reactivo a productoId. Tras el primer guardado
  // esto se vuelve a disparar y refresca contra el servidor la selección
  // que el propio handleSubmit acaba de persistir — es una relectura
  // redundante pero inofensiva (idempotente), preferida aquí sobre agregar
  // otra guarda de "auto-navegación" para mantener este efecto simple.
  useEffect(() => {
    let isMounted = true;

    const loadComercial = async () => {
      setComercialLoading(true);
      try {
        const data: CatalogoConfigurablesProductoRespuesta = await obtenerCatalogosConfigurablesProducto(productoId ?? undefined);
        if (!isMounted) return;
        const seleccionInicial = buildSeleccionInicial(data.tipos || [], data.seleccionados || []);
        setComercialTipos(data.tipos || []);
        setComercialSeleccionados(seleccionInicial);
        setComercialSnapshot(JSON.stringify(seleccionInicial));
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
  }, [productoId]);

  const loadArchivos = React.useCallback(async (id: number) => {
    try {
      setArchivosLoading(true);
      const data = await fetchProductoArchivos(id);
      setArchivos(Array.isArray(data) ? data : []);
      setArchivosError(null);
    } catch (err) {
      setArchivos([]);
      setArchivosError(err instanceof Error ? err.message : 'No se pudieron cargar las imágenes del producto');
    } finally {
      setArchivosLoading(false);
    }
  }, []);

  // Carga eager (no atada a ninguna pestaña, ya que el documento es
  // continuo): en cuanto hay productoId, se listan sus imágenes.
  useEffect(() => {
    if (productoId === null) {
      setArchivos([]);
      setArchivosError(null);
      return;
    }
    void loadArchivos(productoId);
  }, [productoId, loadArchivos]);

  const handleChange = (field: keyof ProductoBasico, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'clave') setClaveDuplicadaError(null);
  };

  const handleComercialChange = (tipoId: number, values: CatalogoComercialValor[]) => {
    setComercialSeleccionados((prev) => ({
      ...prev,
      [tipoId]: values.map((v) => v.id),
    }));
  };

  const obtenerCatalogosSeleccionados = () => {
    const todos = Object.values(comercialSeleccionados).flat();
    return Array.from(new Set(todos));
  };

  const esCampoVacio = (campo: string): boolean => {
    const value = (form as unknown as Record<string, unknown>)[campo];
    if (typeof value === 'boolean') return false;
    if (value === null || value === undefined) return true;
    return !String(value).trim();
  };

  const resetFormularioParaNuevaAlta = () => {
    setForm(initialForm);
    setFormSnapshot(JSON.stringify(initialForm));
    setProductoId(null);
    setProductoLoaded(null);
    setArchivos([]);
    setArchivosError(null);
    setComercialSeleccionados({});
    setValidationErrors(new Set());
    setClaveDuplicadaError(null);
    setProductosSatOptions([]);
    setEspecificacionesVista('texto');
    if (routeId !== 'nuevo') {
      navigate('/productos/nuevo', { replace: true });
    }
  };

  const handleSubmit = async (modo: 'normal' | 'nuevo' = 'normal') => {
    const errores = new Set<string>();
    for (const campo of camposObligatorios) {
      if (esCampoVacio(campo)) errores.add(campo);
    }
    if (errores.size > 0) {
      setValidationErrors(errores);
      const etiquetas = Array.from(errores).map(
        (c) => PRODUCTOS_CAMPOS.find((d) => d.campo === c)?.etiqueta ?? c
      );
      setSnackbar({ open: true, message: `Campos obligatorios sin completar: ${etiquetas.join(', ')}.`, severity: 'error' });
      setActiveSection('identificacion');
      document.getElementById('identificacion')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setValidationErrors(new Set());
    setClaveDuplicadaError(null);

    if (!form.clave.trim() || !form.descripcion.trim()) {
      setSnackbar({ open: true, message: 'Clave y descripción son obligatorias.', severity: 'error' });
      return;
    }
    const payload: ProductoBasico = {
      ...form,
      clave: form.clave.trim(),
      descripcion: form.descripcion.trim(),
      clasificacion: form.clasificacion?.trim() || null,
      tipo_producto: form.tipo_producto || 'Inventariable',
      factor_conversion: form.factor_conversion ?? null,
      especificaciones: form.especificaciones?.trim() || null,
    };

    try {
      setSaving(true);
      let productoIdActual = productoId;

      if (productoId !== null) {
        const actualizado = await updateProducto(productoId, payload);
        productoIdActual = actualizado?.id ?? productoId;
        setProductoLoaded(actualizado ?? null);
        setSnackbar({ open: true, message: 'Producto actualizado', severity: 'success' });
      } else {
        const creado = await createProducto(payload);
        productoIdActual = creado?.id ?? null;
        setProductoLoaded(creado ?? null);
        // Si el usuario pidió "Guardar y nuevo", no navegamos al registro
        // recién creado: se guardan sus catálogos comerciales más abajo y
        // luego se resetea el formulario para una nueva alta. Navegar aquí
        // y resetear el estado inmediatamente después dejaría la URL
        // apuntando a un producto que la pantalla ya no muestra.
        if (productoIdActual && modo === 'normal') {
          setProductoId(productoIdActual);
          idAutoNavegadoRef.current = String(productoIdActual);
          navigate(`/productos/${productoIdActual}`, { replace: true });
        }
        setSnackbar({
          open: true,
          message: modo === 'normal'
            ? 'Producto creado. Ya puedes cargar imágenes y especificaciones sin salir de esta pantalla.'
            : 'Producto creado.',
          severity: 'success',
        });
      }

      if (productoIdActual && Number.isFinite(productoIdActual)) {
        const catalogoIds = obtenerCatalogosSeleccionados();
        await guardarCatalogosConfigurablesProducto(productoIdActual, catalogoIds);
        setComercialSnapshot(JSON.stringify(comercialSeleccionados));
      }

      // Sincroniza el form con los valores normalizados (trim, defaults) que
      // realmente se persistieron, para que el indicador "cambios sin
      // guardar" no quede en falso positivo por espacios recortados u otras
      // normalizaciones que el payload aplicó pero el estado en pantalla no.
      setForm(payload);
      setFormSnapshot(JSON.stringify(payload));

      if (modo === 'nuevo') {
        resetFormularioParaNuevaAlta();
      }
    } catch (e) {
      const apiError = e as ApiFetchError;
      if (apiError?.status === 409) {
        const mensaje = (apiError.payload as { error?: string } | null)?.error || 'Ya existe un producto con esa clave.';
        setClaveDuplicadaError(mensaje);
        setValidationErrors((prev) => new Set(prev).add('clave'));
        setActiveSection('identificacion');
        document.getElementById('identificacion')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setSnackbar({ open: true, message: mensaje, severity: 'error' });
      } else {
        setSnackbar({ open: true, message: e instanceof Error ? e.message : 'No se pudo guardar', severity: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAgregarImagenesClick = () => {
    if (productoId === null) return;
    imagenesInputRef.current?.click();
  };

  const handleImagenesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);

    if (productoId === null || files.length === 0) {
      if (event.target) event.target.value = '';
      return;
    }

    try {
      setUploadingImagenes(true);
      for (const file of files) {
        await uploadProductoImagen(productoId, file);
      }
      await loadArchivos(productoId);
      setSnackbar({ open: true, message: files.length > 1 ? 'Imágenes cargadas' : 'Imagen cargada', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err instanceof Error ? err.message : 'No se pudieron cargar las imágenes', severity: 'error' });
    } finally {
      setUploadingImagenes(false);
      event.target.value = '';
    }
  };

  const handleEliminarArchivo = async (archivo: ProductoArchivo) => {
    if (!window.confirm('¿Eliminar esta imagen del producto?')) return;
    try {
      setArchivoActionId(archivo.id);
      await deleteProductoArchivo(archivo.id);
      if (productoId !== null) await loadArchivos(productoId);
      setSnackbar({ open: true, message: 'Imagen eliminada', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err instanceof Error ? err.message : 'No se pudo eliminar la imagen', severity: 'error' });
    } finally {
      setArchivoActionId(null);
    }
  };

  const handleMarcarPrincipal = async (archivo: ProductoArchivo) => {
    try {
      setArchivoActionId(archivo.id);
      await marcarProductoArchivoPrincipal(archivo.id);
      if (productoId !== null) await loadArchivos(productoId);
      setSnackbar({ open: true, message: 'Imagen principal actualizada', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err instanceof Error ? err.message : 'No se pudo actualizar la imagen principal', severity: 'error' });
    } finally {
      setArchivoActionId(null);
    }
  };

  const handleIrASeccion = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const explicacionObligatoriedad = construirEtiquetaObligatoriedad(form.tipo_producto || 'Inventariable', camposObligatorios);

  const erroresPorSeccion = useMemo(() => {
    const porSeccion = { identificacion: false, fiscal: false } as Record<'identificacion' | 'fiscal', boolean>;
    erroresActivos.forEach((campo) => {
      const seccion = CAMPO_A_SECCION[campo];
      if (seccion) porSeccion[seccion] = true;
    });
    if (claveDuplicadaError) porSeccion.identificacion = true;
    return porSeccion;
  }, [erroresActivos, claveDuplicadaError]);

  const seccionesIndice: SeccionIndiceItem[] = [
    { id: 'identificacion', etiqueta: 'Identificación', estado: erroresPorSeccion.identificacion ? 'error' : 'disponible' },
    { id: 'catalogos', etiqueta: 'Catálogos comerciales', estado: 'disponible' },
    { id: 'fiscal', etiqueta: 'Fiscal y unidades', estado: erroresPorSeccion.fiscal ? 'error' : 'disponible' },
    { id: 'adicionales', etiqueta: 'Datos adicionales', estado: 'disponible' },
    { id: 'archivos', etiqueta: 'Imágenes y archivos', estado: productoId === null ? 'pendiente' : 'disponible', contador: productoId === null ? undefined : archivos.length },
    // "Especificaciones" nunca queda 'pendiente' del todo: el texto legado
    // (RichTextEditor) siempre fue editable sin id, igual que antes de este
    // cambio; solo la biblioteca (contador) depende de producto.id.
    { id: 'especificaciones', etiqueta: 'Especificaciones', estado: 'disponible', contador: especificacionesHabilitadas && productoId !== null ? especificacionesCount : undefined },
  ];

  const guardarDeshabilitado = saving || loading || (productoId !== null && !isDirty);
  const title = productoId !== null ? (form.descripcion || productoLoaded?.descripcion || 'Producto') : 'Nuevo producto';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Paper
        elevation={0}
        sx={{ borderRadius: 1.5, border: '1px solid #e5e7eb', backgroundColor: '#ffffff', px: 2, py: 1 }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="#6b7280" fontSize={12.5}>
              Productos /
            </Typography>
            <Typography variant="subtitle1" fontWeight={700} color="#111827" fontSize={14.5} noWrap>
              {title}
            </Typography>
            {form.clave && (
              <Box
                component="span"
                sx={{
                  fontFamily: '"Roboto Mono", monospace',
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: '#1d2f68',
                  backgroundColor: 'rgba(29,47,104,0.08)',
                  borderRadius: 1,
                  px: 0.75,
                  py: 0.125,
                }}
              >
                {form.clave}
              </Box>
            )}
            {productoId === null ? (
              <Chip label="Borrador" size="small" sx={{ height: 20, fontSize: 11 }} />
            ) : (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: form.activo ? '#00b3ad' : '#9ca3af' }} />
                <Typography variant="caption" color="#6b7280">{form.activo ? 'Activo' : 'Inactivo'}</Typography>
              </Stack>
            )}
            {isDirty && (
              <Tooltip title="Hay cambios que aún no se guardan">
                <Typography variant="caption" color="#b45309" fontWeight={600}>
                  Cambios sin guardar
                </Typography>
              </Tooltip>
            )}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Button size="small" onClick={() => navigate('/productos')} sx={{ color: '#6b7280' }}>
              Cancelar
            </Button>
            {esFlujoAltaRef.current && (
              <Button size="small" variant="outlined" onClick={() => void handleSubmit('nuevo')} disabled={saving || loading}>
                Guardar y nuevo
              </Button>
            )}
            <Button
              size="small"
              variant="contained"
              onClick={() => void handleSubmit('normal')}
              disabled={guardarDeshabilitado}
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
              sx={{ backgroundColor: '#1d2f68', '&:hover': { backgroundColor: '#162551' } }}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Paper variant="outlined" sx={{ borderRadius: 1.5, borderColor: '#e5e7eb', p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <CircularProgress size={20} />
            <Typography color="text.secondary">Cargando producto...</Typography>
          </Stack>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexDirection: { xs: 'column', md: 'row' } }}>
          <SeccionesIndice secciones={seccionesIndice} activaId={activeSection} onSeleccionar={handleIrASeccion} />

          <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0, width: '100%', pb: 4 }}>
            <SeccionIdentificacion
              clave={form.clave}
              descripcion={form.descripcion}
              clasificacion={form.clasificacion ?? ''}
              tipoProducto={form.tipo_producto || 'Inventariable'}
              activo={form.activo}
              onClaveChange={(v) => handleChange('clave', v)}
              onDescripcionChange={(v) => handleChange('descripcion', v)}
              onClasificacionChange={(v) => handleChange('clasificacion', v)}
              onTipoProductoChange={(v) => handleChange('tipo_producto', v)}
              onActivoChange={(v) => handleChange('activo', v)}
              erroresActivos={erroresActivos}
              camposObligatorios={camposObligatorios}
              claveDuplicadaError={claveDuplicadaError}
              explicacionObligatoriedad={explicacionObligatoriedad}
            />

            <SeccionCard
              id="catalogos"
              titulo="Catálogos comerciales"
              subtitulo="Configurables por empresa"
              accion={
                <Tooltip title="Los catálogos se administran en Configuración">
                  <span>
                    <Typography component="span" sx={{ fontSize: 18, color: '#9ca3af', cursor: 'default', px: 0.5 }}>
                      ⋯
                    </Typography>
                  </span>
                </Tooltip>
              }
            >
              {comercialLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
                  <CircularProgress size={22} />
                </Box>
              ) : comercialError ? (
                <Typography color="#b91c1c" variant="body2">{comercialError}</Typography>
              ) : !comercialTipos.length ? (
                <Typography color="#6b7280" variant="body2">No hay catálogos configurables para productos.</Typography>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(12, 1fr)' }, gap: 1.5 }}>
                  {comercialTipos.map((tipo) => {
                    const seleccionadosIds = comercialSeleccionados[tipo.id] || [];
                    const valorSeleccionado = tipo.valores.filter((v) => seleccionadosIds.includes(v.id));

                    return (
                      <Box key={tipo.id} sx={{ gridColumn: { sm: 'span 3' } }}>
                        <Autocomplete
                          multiple
                          size="small"
                          options={tipo.valores}
                          value={valorSeleccionado}
                          getOptionLabel={(option) => option.clave || option.descripcion || ''}
                          onChange={(_, values) => handleComercialChange(tipo.id, values)}
                          renderInput={(params) => (
                            <TextField {...(params as any)} label={tipo.nombre || 'Catálogo'} placeholder="Sin asignar" />
                          )}
                          noOptionsText="Sin valores"
                          disableCloseOnSelect
                        />
                      </Box>
                    );
                  })}
                </Box>
              )}
            </SeccionCard>

            <SeccionFiscalUnidades
              claveProductoSat={form.clave_producto_sat ?? null}
              productosSatOptions={productosSatOptions}
              productosSatLoading={productosSatLoading}
              onClaveProductoSatChange={(v) => handleChange('clave_producto_sat', v)}
              onAbrirSat={() => {
                if (!productosSatOptions.length) void loadProductosSat(form.clave_producto_sat || '');
              }}
              onBuscarSat={queueLoadProductosSat}
              unidades={unidades}
              loadingUnidades={loadingUnidades}
              unidadVentaId={form.unidad_venta_id ?? null}
              unidadInventarioId={form.unidad_inventario_id ?? null}
              onUnidadVentaChange={(v) => handleChange('unidad_venta_id', v)}
              onUnidadInventarioChange={(v) => handleChange('unidad_inventario_id', v)}
              factorConversion={form.factor_conversion ?? null}
              onFactorConversionChange={(v) => handleChange('factor_conversion', v)}
              erroresActivos={erroresActivos}
              camposObligatorios={camposObligatorios}
              existenciaActual={productoLoaded?.existencia_actual}
              claveBienesTransportadosSat={form.clave_bienes_transportados_sat ?? null}
              esMaterialPeligroso={Boolean(form.es_material_peligroso)}
              claveMaterialPeligrosoSat={form.clave_material_peligroso_sat ?? null}
              claveEmbalajeSat={form.clave_embalaje_sat ?? null}
              descripcionEmbalaje={form.descripcion_embalaje ?? null}
              onCartaPorteChange={(field, value) => handleChange(field as keyof ProductoBasico, value as never)}
            />

            <SeccionCard
              id="adicionales"
              titulo="Datos adicionales"
              badge={
                <Box component="span" sx={{ fontSize: 10.5, fontWeight: 700, color: '#6b7280', backgroundColor: '#f1f3f5', borderRadius: 1, px: 0.75, py: 0.125 }}>
                  Reservado
                </Box>
              }
              reservado
            >
              <Typography variant="body2" color="#6b7280">
                Espacio estructural para secciones o campos futuros. Alcance funcional aún no definido; se insertan aquí con la misma rejilla de 12 columnas.
              </Typography>
            </SeccionCard>

            <SeccionImagenesArchivos
              disponible={productoId !== null}
              descripcionProducto={form.descripcion}
              archivos={archivos}
              archivosLoading={archivosLoading}
              archivosError={archivosError}
              onCerrarError={() => setArchivosError(null)}
              uploadingImagenes={uploadingImagenes}
              archivoActionId={archivoActionId}
              inputRef={imagenesInputRef}
              onAgregarClick={handleAgregarImagenesClick}
              onArchivosChange={handleImagenesChange}
              onEliminar={handleEliminarArchivo}
              onMarcarPrincipal={handleMarcarPrincipal}
            />

            <SeccionCard
              id="especificaciones"
              titulo="Especificaciones"
              badge={
                <Box component="span" sx={{ fontSize: 10.5, fontWeight: 700, color: '#006261', backgroundColor: 'rgba(0,98,97,0.1)', borderRadius: 1, px: 0.75, py: 0.125 }}>
                  Se guarda al instante
                </Box>
              }
              accion={
                especificacionesHabilitadas ? (
                  <Stack direction="row" spacing={0.5}>
                    <Button
                      size="small"
                      variant={especificacionesVista === 'texto' ? 'contained' : 'text'}
                      onClick={() => setEspecificacionesVista('texto')}
                      sx={especificacionesVista === 'texto' ? { backgroundColor: '#1d2f68', '&:hover': { backgroundColor: '#162551' } } : { color: '#6b7280' }}
                    >
                      Texto del producto
                    </Button>
                    <Button
                      size="small"
                      variant={especificacionesVista === 'biblioteca' ? 'contained' : 'text'}
                      onClick={() => setEspecificacionesVista('biblioteca')}
                      sx={especificacionesVista === 'biblioteca' ? { backgroundColor: '#1d2f68', '&:hover': { backgroundColor: '#162551' } } : { color: '#6b7280' }}
                    >
                      {`Biblioteca · ${especificacionesCount}`}
                    </Button>
                  </Stack>
                ) : undefined
              }
            >
              {/*
                Ambos bloques se montan siempre que la biblioteca esté
                habilitada (solo se alterna la visibilidad, no el montaje),
                para que el conteo "Biblioteca · N" del botón y del índice
                lateral quede actualizado desde que hay producto.id, sin
                depender de que el usuario haya entrado a esa vista.
              */}
              {especificacionesHabilitadas && (
                <Box sx={{ display: especificacionesVista === 'biblioteca' ? 'block' : 'none' }}>
                  <EspecificacionesBibliotecaEditor
                    alcance="producto"
                    productoId={productoId ?? undefined}
                    onError={(message) => setSnackbar({ open: true, message, severity: 'error' })}
                    onCountChange={setEspecificacionesCount}
                  />
                </Box>
              )}
              <Box sx={{ display: !especificacionesHabilitadas || especificacionesVista === 'texto' ? 'block' : 'none' }}>
                <Stack spacing={1}>
                  {especificacionesHabilitadas && (
                    <Typography variant="caption" color="#6b7280">
                      Este texto es independiente de la biblioteca de especificaciones; no se mezclan automáticamente.
                    </Typography>
                  )}
                  <RichTextEditor
                    content={form.especificaciones ?? ''}
                    onChange={(html) => handleChange('especificaciones', html)}
                    placeholder="Captura aquí las especificaciones técnicas o comerciales del producto..."
                  />
                </Stack>
              </Box>
            </SeccionCard>
          </Stack>
        </Box>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3200}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
