import * as React from 'react';
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Typography,
  Divider,
  Snackbar,
  Chip,
  Tabs,
  Tab,
} from '@mui/material';

import Grid from '@mui/material/Grid';
import { createFilterOptions } from '@mui/material/Autocomplete';

import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CommentIcon from '@mui/icons-material/ModeCommentOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import { resolveDocumentoFormPath, resolveDocumentoModulo, resolveDocumentosListPath } from '../modules/documentos/documentoNavigation';
import DynamicFieldControl from '../components/DynamicFieldControl';
import ContactCaptureDialog, { type ContactCaptureDetailedFields } from '../components/contactos/ContactCaptureDialog';
import ProductoCaptureDialog from '../components/productos/ProductoCaptureDialog';
import { useCamposDinamicos } from '../hooks/useCamposDinamicos';

import type {
  CotizacionDetalle,
  CotizacionPartidaPayload,
  CotizacionCrearPayload,
  CotizacionPartida,
  ImpuestoPartida,
  TratamientoImpuestos,
} from '../types/cotizacion';
import type { TipoDocumento } from '../types/documentos.types';
import { getDocumento, createDocumento, updateDocumento, replacePartidas, abrirDocumentoPdfEnNuevaVentana } from '../services/documentosService';
import { uploadArchivo } from '../services/uploadsService';
import { fetchContactos, fetchVendedores } from '../services/contactosService';
import { createProducto, fetchProductoArchivos, fetchProductos, type ProductoArchivo } from '../services/productosService';
import type { Producto, ProductoBasico } from '../types/producto';
import type { Contacto, ContactoDetalle } from '../types/contactos.types';
import { getEmpresaActivaId } from '../utils/empresaUtils';
import { useSession } from '../session/useSession';
import type { ImpuestoEntrada, ImpuestoCalculadoUI } from '../utils/impuestos';
import { calcularImpuestosPreview } from '../services/documentosService';
import { DocumentoDatosFiscalesTab } from '../modules/documentos';
import { resolveDocumentoTextos } from '../modules/documentos/documentoTypeConfig';
import { useDocumentoConfig } from '../modules/documentos/useDocumentoConfig';
import type { ProductoTipoPermitido } from '../modules/documentos/documentoTypes';
import { FacturaPagosDrawer } from '../modules/finanzas/FacturaPagosDrawer';
import { OperacionDialog } from '../modules/finanzas/OperacionDialog';
import { getDocumentoOrigenFinancieroConfig } from '../modules/finanzas/documentoOrigenFinanciero';
import { DEFAULT_ESTADO_SEGUIMIENTO } from '../modules/cotizaciones/estadoSeguimiento';
import { crearContacto, getContacto } from '../services/contactos.api';
import { fetchCuentas, fetchResumenAnticiposDocumento, fetchSaldoDocumento } from '../services/finanzasService';
import { buildAssetUrl } from '../services/empresasAssetsService';
import { normalizarTelefonoMx } from '../utils/telefono';
import {
  guardarCamposDocumento,
  guardarCamposPartida,
  fetchCamposDocumento,
  fetchCamposPartida,
} from '../services/camposDinamicosService';
import type { CampoValorPayload, CampoValorGuardado } from '../types/camposDinamicos';
import type { DocumentoAnticipoResumen, FinanzasCuenta } from '../types/finanzas';

const toCivilDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeCivilDate = (value: string | null | undefined) => {
  const match = String(value ?? '').trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? '';
};

const defaultFecha = () => toCivilDate();
const validarRFC = (rfc: string) => /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/i.test(rfc);

const clampDiscountPercent = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
};

const getPartidaBaseBruta = (partida: Pick<PartidaForm, 'cantidad' | 'precio_unitario'>) => {
  const cantidad = Number(partida.cantidad) || 0;
  const precio = Number(partida.precio_unitario) || 0;
  return cantidad * precio;
};

const getPartidaDiscountAmount = (partida: Pick<PartidaForm, 'cantidad' | 'precio_unitario' | 'descuento'>) => {
  const baseBruta = getPartidaBaseBruta(partida);
  const descuento = clampDiscountPercent(partida.descuento);
  return baseBruta * (descuento / 100);
};

const getPartidaSubtotalAfterLineDiscount = (partida: Pick<PartidaForm, 'cantidad' | 'precio_unitario' | 'descuento'>) => (
  getPartidaBaseBruta(partida) - getPartidaDiscountAmount(partida)
);

const getPartidaGlobalDiscountAmount = (
  partida: Pick<PartidaForm, 'cantidad' | 'precio_unitario' | 'descuento'>,
  descuentoGlobal: unknown
) => {
  const subtotalDespuesDescuentoPartida = getPartidaSubtotalAfterLineDiscount(partida);
  const descuentoGlobalNormalizado = clampDiscountPercent(descuentoGlobal);
  return subtotalDespuesDescuentoPartida * (descuentoGlobalNormalizado / 100);
};

const getPartidaTotalDiscountAmount = (
  partida: Pick<PartidaForm, 'cantidad' | 'precio_unitario' | 'descuento'>,
  descuentoGlobal: unknown
) => getPartidaDiscountAmount(partida) + getPartidaGlobalDiscountAmount(partida, descuentoGlobal);

const getPartidaDiscountBreakdown = (
  partida: Pick<PartidaForm, 'cantidad' | 'precio_unitario' | 'descuento'>,
  descuentoGlobal: unknown
) => {
  const precioBruto = getPartidaBaseBruta(partida);
  const descuentoPartida = getPartidaDiscountAmount(partida);
  const subtotalIntermedio = precioBruto - descuentoPartida;
  const descuentoGlobalMonto = getPartidaGlobalDiscountAmount(partida, descuentoGlobal);
  const subtotalFinal = subtotalIntermedio - descuentoGlobalMonto;

  return {
    precioBruto,
    descuentoPartida,
    subtotalIntermedio,
    descuentoGlobalMonto,
    subtotalFinal,
  };
};

type PartidaForm = Omit<CotizacionPartidaPayload, 'impuestos'> & {
  id?: number;
  producto?: Producto | null;
  impuestos?: (ImpuestoEntrada | ImpuestoPartida)[];
  impuestos_calculados?: ImpuestoCalculadoUI[];
};

const TRATAMIENTO_OPCIONES: { label: string; value: TratamientoImpuestos }[] = [
  { label: 'Operación estándar', value: 'normal' },
  { label: 'Nota de venta', value: 'sin_iva' },
  { label: 'Operación a tasa 0%', value: 'tasa_cero' },
  { label: 'Operación exenta', value: 'exento' },
];

const emptyPartida = (): PartidaForm => ({
  producto_id: null,
  descripcion_alterna: '',
  cantidad: 1,
  precio_unitario: 0,
  descuento: 0,
  subtotal_partida: 0,
  total_partida: 0,
  es_parte_oportunidad: true,
  archivo_imagen_1: null,
  producto_archivo_id: null,
  producto: null,
  observaciones: '',
  impuestos: [],
  impuestos_calculados: [],
});

type DocumentosFormPageProps = {
  tipoDocumento?: TipoDocumento;
};

const DESCRIPCIONES_FORMULARIO: Record<string, string> = {
  cotizacion: 'Captura el encabezado y las partidas de la cotización.',
  factura: 'Captura el encabezado y las partidas de la factura.',
  orden_servicio: 'Registra los artículos recibidos y los servicios solicitados',
  pedido: 'Captura el encabezado y las partidas del pedido.',
  remision: 'Captura el encabezado y las partidas de la remisión.',
};

const ENTIDAD_TIPO_DOCUMENTO = 'DOCUMENTO';
const ENTIDAD_TIPO_PARTIDA = 'DOCUMENTO_PARTIDA';

type ProductoAutocompleteOption = Producto | {
  kind: 'create';
  id: -1;
  clave: string;
  descripcion: string;
};

type ContactoAutocompleteOption = Contacto | {
  kind: 'create';
  id: -1;
  nombre: string;
  inputValue: string;
};

const emptyContactCaptureDetailedFields = (): ContactCaptureDetailedFields => ({
  telefono: '',
  email: '',
  calle: '',
  numeroExterior: '',
  numeroInterior: '',
  colonia: '',
  ciudad: '',
  estado: '',
  cp: '',
});

const mapValoresToRecord = (valores: (CampoValorGuardado | CampoValorPayload)[]): Record<number, CampoValorPayload> => {
  const bucket: Record<number, CampoValorPayload> = {};
  valores.forEach((v) => {
    if (!v?.campo_id) return;
    bucket[v.campo_id] = {
      campo_id: v.campo_id,
      catalogo_id: v.catalogo_id ?? null,
      valor_texto: v.valor_texto ?? null,
      valor_numero: v.valor_numero ?? null,
      valor_fecha: v.valor_fecha ?? null,
      valor_boolean: v.valor_boolean ?? null,
    };
  });
  return bucket;
};

const prefetchOpcionesLista = (
  campos: ReturnType<typeof useCamposDinamicos>['campos'],
  valores: Record<number, CampoValorPayload>,
  loadOptions: (campoId: number, parentId: number | null) => void
) => {
  campos
    .filter((c) => c.tipo_dato === 'lista')
    .forEach((campo) => {
      const parentId = campo.campo_padre_id ? valores[campo.campo_padre_id]?.catalogo_id ?? null : null;
      loadOptions(campo.id, parentId ?? null);
    });
};

const buildCreateProductoOption = (): ProductoAutocompleteOption => ({
  kind: 'create',
  id: -1,
  clave: 'Crear producto...',
  descripcion: 'Registrar y asignar producto',
});

const filterContactoOptions = createFilterOptions<ContactoAutocompleteOption>({
  stringify: (option) => ('kind' in option && option.kind === 'create' ? option.inputValue : option.nombre || ''),
});

export default function DocumentosFormPage({ tipoDocumento: propTipo }: DocumentosFormPageProps) {
  const { id, codigo } = useParams();
  const { session } = useSession();
  const sessionUserId = session.user?.id ?? null;
  const tipoDocumento = (propTipo ?? (codigo as TipoDocumento)) || 'cotizacion';
  const routeDocumentoId = useMemo(() => {
    const parsedId = Number(id);
    return Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;
  }, [id]);
  const [documentoPersistidoId, setDocumentoPersistidoId] = useState<number | null>(routeDocumentoId);
  const {
    config: documentoConfig,
    defaultSerie,
    defaultEstadoSeguimiento,
    contactoCaptureMode,
    contactoDefaultTipoContacto,
    contactoTiposPermitidos,
    tiposContactoPermitidos,
    productoCreationMode,
    productoCaptureMode,
    productoDefaultTipoProducto,
    productoTiposPermitidos,
    widgetFiscalTab,
    widgetOrigenDocumento,
    widgetTratamientoFiscal,
    widgetPagosDrawer,
    partidasMostrarImagenes,
    partidasMostrarEsParteOportunidad,
    partidasMostrarMontoOportunidad,
  } = useDocumentoConfig(tipoDocumento);
  const navigate = useNavigate();
  const location = useLocation();
  const moduloDocumento = resolveDocumentoModulo(location.pathname);
  const documentoActualId = documentoPersistidoId ?? routeDocumentoId;
  const isCotizacion = tipoDocumento === 'cotizacion';
  const isEdit = Boolean(documentoActualId);
  const basePath = resolveDocumentosListPath(tipoDocumento, moduloDocumento);
  const showFiscalTab = widgetFiscalTab;
  const textos = useMemo(
    () => ({
      ...resolveDocumentoTextos(tipoDocumento, documentoConfig),
      descripcion: DESCRIPCIONES_FORMULARIO[tipoDocumento] ?? 'Crea o edita documentos.',
    }),
    [documentoConfig, tipoDocumento]
  );

  const productoFlowConfig = useMemo(
    () => ({
      creationMode: productoCreationMode,
      captureMode: productoCaptureMode,
      defaultTipoProducto: productoDefaultTipoProducto,
    }),
    [productoCaptureMode, productoCreationMode, productoDefaultTipoProducto]
  );

  const [form, setForm] = useState<CotizacionCrearPayload>({
    tipo_documento: tipoDocumento,
    serie: defaultSerie,
    contacto_principal_id: null,
    agente_id: null,
    fecha_documento: defaultFecha(),
    moneda: 'MXN',
    observaciones: '',
    subtotal: 0,
    descuento_global: 0,
    iva: 0,
    total: 0,
    usuario_creacion_id: sessionUserId ?? null,
    empresa_id: getEmpresaActivaId(),
    estado_seguimiento: (defaultEstadoSeguimiento ?? null) as NonNullable<CotizacionCrearPayload['estado_seguimiento']> | null,
    tratamiento_impuestos: 'normal',
    rfc_receptor: '',
    nombre_receptor: '',
    regimen_fiscal_receptor: '',
    uso_cfdi: '',
    forma_pago: '',
    metodo_pago: '',
    codigo_postal_receptor: '',
  });

  const [partidas, setPartidas] = useState<PartidaForm[]>([emptyPartida()]);
  const [expandedObs, setExpandedObs] = useState<boolean[]>([false]);
  const [editingPrecio, setEditingPrecio] = useState<boolean[]>([false]);
  const [precioInputs, setPrecioInputs] = useState<string[]>(['']);
  const [uploadingImagen, setUploadingImagen] = useState<boolean[]>([false]);
  const [partidaImagenDialog, setPartidaImagenDialog] = useState<{ open: boolean; index: number | null; view: 'menu' | 'producto' }>({
    open: false,
    index: null,
    view: 'menu',
  });
  const [partidaImagenesProductoById, setPartidaImagenesProductoById] = useState<Record<number, ProductoArchivo[]>>({});
  const [partidaImagenesProductoLoadingId, setPartidaImagenesProductoLoadingId] = useState<number | null>(null);
  const [partidaImagenesProductoError, setPartidaImagenesProductoError] = useState<string | null>(null);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [vendedores, setVendedores] = useState<Contacto[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState<boolean>(isEdit);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [openPagos, setOpenPagos] = useState(false);
  const [openAnticipoDialog, setOpenAnticipoDialog] = useState(false);
  const [saldoDocumento, setSaldoDocumento] = useState<number>(0);
  const [anticiposResumen, setAnticiposResumen] = useState<DocumentoAnticipoResumen | null>(null);
  const [cuentasFinancieras, setCuentasFinancieras] = useState<FinanzasCuenta[]>([]);
  const [loadingAnticiposResumen, setLoadingAnticiposResumen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );
  const [duplicateDialog, setDuplicateDialog] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [activeTab, setActiveTab] = useState<number>(0);
  const [crearClienteOpen, setCrearClienteOpen] = useState(false);
  const [crearClienteNombre, setCrearClienteNombre] = useState('');
  const [crearClienteTipo, setCrearClienteTipo] = useState(contactoDefaultTipoContacto);
  const [crearClienteDetailedFields, setCrearClienteDetailedFields] = useState<ContactCaptureDetailedFields>(emptyContactCaptureDetailedFields);
  const [crearClienteLoading, setCrearClienteLoading] = useState(false);
  const [crearProductoOpen, setCrearProductoOpen] = useState(false);
  const [crearProductoClave, setCrearProductoClave] = useState('');
  const [crearProductoDescripcion, setCrearProductoDescripcion] = useState('');
  const [crearProductoTipo, setCrearProductoTipo] = useState<ProductoTipoPermitido>(productoDefaultTipoProducto);
  const [crearProductoLoading, setCrearProductoLoading] = useState(false);
  const [crearProductoIndex, setCrearProductoIndex] = useState<number | null>(null);
  const [crearProductoClaveError, setCrearProductoClaveError] = useState<string | null>(null);

  const shouldOpenPagos = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('abrirPagos') === '1';
  }, [location.search]);
  const anticipoConfig = useMemo(() => getDocumentoOrigenFinancieroConfig(tipoDocumento), [tipoDocumento]);
  const totalAnticipadoRegistrado = Number(anticiposResumen?.total_anticipado ?? 0);
  const hasAnticiposRegistrados = Number(anticiposResumen?.cantidad_operaciones ?? 0) > 0 || totalAnticipadoRegistrado > 0;
  const tienePartidaValida = useMemo(
    () => partidas.some((partida) => Number(partida.cantidad ?? 0) > 0 && Number(partida.precio_unitario ?? 0) > 0),
    [partidas]
  );
  const prefillContactoId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const rawContactoId = params.get('contactoId');
    const parsedContactoId = rawContactoId ? Number(rawContactoId) : NaN;
    return Number.isFinite(parsedContactoId) ? parsedContactoId : null;
  }, [location.search]);
  const conversacionId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('conversacionId');
  }, [location.search]);

  const camposDocumento = useCamposDinamicos({ entidadTipoCodigo: ENTIDAD_TIPO_DOCUMENTO, tipoDocumento });
  const camposPartida = useCamposDinamicos({ entidadTipoCodigo: ENTIDAD_TIPO_PARTIDA, tipoDocumento });
  const [valoresCamposDocumento, setValoresCamposDocumento] = useState<Record<number, CampoValorPayload>>({});
  const [valoresCamposPartidas, setValoresCamposPartidas] = useState<Record<number, CampoValorPayload>[]>([{}]);

  const precioRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cantidadRefs = useRef<(HTMLInputElement | null)[]>([]);
  const partidaImagenInputRef = useRef<HTMLInputElement | null>(null);
  const prevContactoRef = useRef<number | null | undefined>(undefined);
  const skipFiscalFetchRef = useRef<boolean>(false);
  const previewTimersRef = useRef<Record<number, ReturnType<typeof setTimeout> | null>>({});
  const previewSeqRef = useRef<Record<number, number>>({});
  const previewGlobalSeqRef = useRef<number>(0);
  const tratamientoRef = useRef<TratamientoImpuestos | null>(form.tratamiento_impuestos ?? 'normal');
  const descuentoGlobalRef = useRef<number>(clampDiscountPercent(form.descuento_global ?? 0));
  const resumenFinancieroRef = useRef<HTMLDivElement | null>(null);
  const isChangingTratamientoRef = useRef<boolean>(false);
  const suppressPreviewRef = useRef<boolean>(false);
  const tratamientoChangeSeqRef = useRef<number>(0);
  const [mostrarResumenFinancieroSticky, setMostrarResumenFinancieroSticky] = useState(false);

  const runImpuestosPreview = async (
    index: number,
    partida: PartidaForm,
    tratamientoActual: TratamientoImpuestos,
    seq: number,
    immediate: boolean = false,
    descuentoGlobalActual?: number | null
  ) => {
    console.log('[impuestos] runPreview caller stack', new Error().stack);
    console.log('[impuestos] debounce fired -> runPreview', {
      index,
      seq,
      producto_id: partida.producto_id,
      cantidad: partida.cantidad,
      precio_unitario: partida.precio_unitario,
      descuento_global: descuentoGlobalActual ?? descuentoGlobalRef.current,
      tratamiento_impuestos: tratamientoActual,
      immediate,
    });
    try {
      console.log('[impuestos] calling calcularImpuestosPreview', {
        index,
        seq,
        producto_id: partida.producto_id,
        cantidad: partida.cantidad,
        precio_unitario: partida.precio_unitario,
        descuento: partida.descuento,
        descuento_global: descuentoGlobalActual ?? descuentoGlobalRef.current,
        tratamiento_impuestos: tratamientoActual,
      });
      const resp: any = await calcularImpuestosPreview({
        producto_id: partida.producto_id ?? null,
        cantidad: partida.cantidad ?? 0,
        precio_unitario: partida.precio_unitario ?? 0,
        descuento: partida.descuento ?? 0,
        descuento_global: descuentoGlobalActual ?? descuentoGlobalRef.current,
        tratamiento_impuestos: tratamientoActual,
      });

      if (previewSeqRef.current[index] !== seq) return;

      console.log('[impuestos] preview response', {
        index,
        seq,
        producto_id: partida.producto_id,
        cantidad: partida.cantidad,
        precio_unitario: partida.precio_unitario,
        descuento: partida.descuento,
        descuento_global: descuentoGlobalActual ?? descuentoGlobalRef.current,
        tratamiento_impuestos: tratamientoActual,
        impuestos_len: Array.isArray(resp?.impuestos) ? resp.impuestos.length : null,
        subtotal_partida: resp?.subtotal_partida,
        total_partida: resp?.total_partida,
      });

      setPartidas((prev) => {
        const next = [...prev];
        const current = next[index];
        if (!current) return prev;

        const impuestosEntrada: ImpuestoEntrada[] = (resp.impuestos ?? []).map((imp: any) => ({
          id: imp.impuestoId ?? imp.impuesto_id ?? imp.id ?? '',
          nombre: imp.impuestoId ?? imp.impuesto_id ?? imp.id ?? '',
          tipo: imp.tipo ?? null,
          tasa: Number(imp.tasa ?? 0),
          monto: Number(imp.monto ?? 0),
          base: imp.base ?? null,
        }));

        const impuestosCalc: ImpuestoCalculadoUI[] = (resp.impuestos ?? []).map((imp: any) => ({
          impuestoId: imp.impuestoId ?? imp.impuesto_id ?? imp.id ?? '',
          nombre: imp.impuestoId ?? imp.impuesto_id ?? imp.id ?? '',
          tipo: imp.tipo ?? undefined,
          tasa: Number(imp.tasa ?? 0),
          monto: Number(imp.monto ?? 0),
        }));

        const updated: PartidaForm = {
          ...current,
          subtotal_partida: resp.subtotal_partida ?? current.subtotal_partida,
          impuestos: impuestosEntrada,
          impuestos_calculados: impuestosCalc,
          total_partida: resp.total_partida ?? current.total_partida ?? 0,
        };

        next[index] = updated;
        recalcTotales(next, descuentoGlobalActual ?? descuentoGlobalRef.current);
        return next;
      });
    } catch (error) {
      console.error('Error al calcular impuestos (preview)', error);
    }
  };

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: form.moneda || 'MXN',
        minimumFractionDigits: 2,
      }),
    [form.moneda]
  );

  const productosDisponibles = useMemo(() => {
    const tiposPermitidos = new Set(productoTiposPermitidos.map((tipo) => tipo.toLowerCase()));

    return productos.filter((producto) => {
      const tipoProducto = String(producto.tipo_producto ?? productoDefaultTipoProducto).trim().toLowerCase();
      return tiposPermitidos.has(tipoProducto);
    });
  }, [productoDefaultTipoProducto, productoTiposPermitidos, productos]);

  const productosAutocompleteOptions = useMemo<ProductoAutocompleteOption[]>(() => {
    if (productoCreationMode !== 'inline') {
      return productosDisponibles;
    }

    return [...productosDisponibles, buildCreateProductoOption()];
  }, [productoCreationMode, productosDisponibles]);

  const partidaImagenActual = partidaImagenDialog.index !== null ? partidas[partidaImagenDialog.index] ?? null : null;
  const partidaImagenProductoId = partidaImagenActual?.producto_id ?? null;
  const partidaImagenesProducto = partidaImagenProductoId ? partidaImagenesProductoById[partidaImagenProductoId] ?? [] : [];
  const partidaImagenSeleccionada = partidaImagenActual?.producto_archivo_id
    ? partidaImagenesProducto.find((archivo) => archivo.id === partidaImagenActual.producto_archivo_id) ?? null
    : null;
  const partidaImagenPreviewUrl = partidaImagenActual?.archivo_imagen_1?.trim()
    ? partidaImagenActual.archivo_imagen_1.trim()
    : partidaImagenSeleccionada
      ? buildAssetUrl(partidaImagenSeleccionada.archivo)
      : null;

  useEffect(() => {
    if (!partidaImagenDialog.open || partidaImagenDialog.view !== 'producto' || !partidaImagenProductoId) return;
    if (partidaImagenesProductoById[partidaImagenProductoId]) return;

    let cancelled = false;
    setPartidaImagenesProductoLoadingId(partidaImagenProductoId);
    setPartidaImagenesProductoError(null);

    void fetchProductoArchivos(partidaImagenProductoId)
      .then((archivos) => {
        if (cancelled) return;
        setPartidaImagenesProductoById((prev) => ({ ...prev, [partidaImagenProductoId]: archivos }));
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'No se pudieron cargar las imágenes del producto';
        setPartidaImagenesProductoError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setPartidaImagenesProductoLoadingId((current) => (current === partidaImagenProductoId ? null : current));
      });

    return () => {
      cancelled = true;
    };
  }, [partidaImagenDialog.open, partidaImagenDialog.view, partidaImagenProductoId, partidaImagenesProductoById]);

  const clearDependientes = useCallback(
    (bucket: Record<number, CampoValorPayload>, dependenciasMap: Record<number, number[]>, parentId: number) => {
      const hijos = dependenciasMap[parentId] || [];
      hijos.forEach((childId) => {
        delete bucket[childId];
        clearDependientes(bucket, dependenciasMap, childId);
      });
    },
    []
  );

  const tieneValorCapturado = (valor: CampoValorPayload) => {
    if (valor.catalogo_id !== undefined && valor.catalogo_id !== null) return true;
    if (valor.valor_texto !== undefined && valor.valor_texto !== null && valor.valor_texto !== '') return true;
    if (valor.valor_numero !== undefined && valor.valor_numero !== null) return true;
    if (valor.valor_fecha !== undefined && valor.valor_fecha !== null && valor.valor_fecha !== '') return true;
    if (valor.valor_boolean !== undefined && valor.valor_boolean !== null) return true;
    return false;
  };

  const recalcTotales = (partidasList: PartidaForm[], descuentoGlobalOverride?: number | null) => {
    const descuentoGlobalDocumento = clampDiscountPercent(descuentoGlobalOverride ?? descuentoGlobalRef.current ?? 0);
    const subtotal = partidasList.reduce((acc, p) => acc + (p.subtotal_partida || 0), 0);
    const descuento = partidasList.reduce((acc, p) => acc + getPartidaTotalDiscountAmount(p, descuentoGlobalDocumento), 0);
    const impuestosTotales = partidasList.reduce((acc, p) => {
      const impuestos = p.impuestos ?? [];
      const totalImpuestos = impuestos.reduce((s, imp: any) => {
        const monto = Number(imp.monto ?? 0);
        const esRetencion = (imp.tipo ?? '').toLowerCase() === 'retencion';
        return s + (esRetencion ? -monto : monto);
      }, 0);
      return acc + totalImpuestos;
    }, 0);
    const total = subtotal + impuestosTotales;
    setForm((prev) => ({ ...prev, subtotal, descuento, iva: impuestosTotales, total }));
  };

  const montoOportunidad = useMemo(
    () => partidas.reduce((acc, partida) => (
      partida.es_parte_oportunidad === false ? acc : acc + Number(partida.subtotal_partida ?? 0)
    ), 0),
    [partidas]
  );

  const discountSummary = useMemo(() => {
    const descuentoGlobalDocumento = clampDiscountPercent(form.descuento_global ?? 0);

    return partidas.reduce((acc, partida) => {
      const breakdown = getPartidaDiscountBreakdown(partida, descuentoGlobalDocumento);
      const impuestos = partida.impuestos ?? [];
      const ivaPartida = impuestos.reduce((sum, imp: any) => {
        const monto = Number(imp.monto ?? 0);
        const esRetencion = (imp.tipo ?? '').toLowerCase() === 'retencion';
        return sum + (esRetencion ? -monto : monto);
      }, 0);

      acc.subtotalBruto += breakdown.precioBruto;
      acc.descuentoPartidas += breakdown.descuentoPartida;
      acc.descuentoGlobal += breakdown.descuentoGlobalMonto;
      acc.subtotalNeto += Number(partida.subtotal_partida ?? breakdown.subtotalFinal ?? 0);
      acc.iva += ivaPartida;
      acc.total += Number(partida.total_partida ?? 0);
      return acc;
    }, {
      subtotalBruto: 0,
      descuentoPartidas: 0,
      descuentoGlobal: 0,
      subtotalNeto: 0,
      iva: 0,
      total: 0,
    });
  }, [form.descuento_global, partidas]);

  useEffect(() => {
    const target = resumenFinancieroRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') {
      setMostrarResumenFinancieroSticky(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setMostrarResumenFinancieroSticky(!entry.isIntersecting);
      },
      {
        threshold: 0.12,
      }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [activeTab, loading]);

  const isSinIva = (t: TratamientoImpuestos | null | undefined) => (t ?? '').toLowerCase() === 'sin_iva';
  const isOperacionEstandar = (t: TratamientoImpuestos | null | undefined) => ['normal', 'operacion_estandar'].includes((t ?? '').toLowerCase());

  const partidasGridTemplate = useMemo(
    () =>
      (partidasMostrarEsParteOportunidad || partidasMostrarImagenes
        ? '180px 1fr 80px 120px 88px 120px 120px 120px 120px 52px 40px 48px'
        : '180px 1fr 80px 120px 88px 120px 120px 120px 40px 48px'),
    [partidasMostrarEsParteOportunidad, partidasMostrarImagenes]
  );

  const calcularPartida = (partida: PartidaForm, descuentoGlobalOverride?: number | null): PartidaForm => {
    const cantidad = Number(partida.cantidad) || 0;
    const precio = Number(partida.precio_unitario) || 0;
    const descuento = clampDiscountPercent(partida.descuento);
    const descuentoGlobal = clampDiscountPercent(descuentoGlobalOverride ?? descuentoGlobalRef.current ?? 0);
    const baseBruta = cantidad * precio;
    const descuentoMonto = baseBruta * (descuento / 100);
    const subtotalDespuesDescuentoPartida = baseBruta - descuentoMonto;
    const descuentoGlobalMonto = subtotalDespuesDescuentoPartida * (descuentoGlobal / 100);
    const subtotal_partida = subtotalDespuesDescuentoPartida - descuentoGlobalMonto;
    const impuestosLista = (partida.impuestos ?? partida.impuestos_calculados ?? []) as any[];
    const totalImpuestos = impuestosLista.reduce((acc: number, imp: any) => {
      const monto = Number(imp.monto ?? 0);
      const esRetencion = (imp.tipo ?? '').toLowerCase() === 'retencion';
      return acc + (esRetencion ? -monto : monto);
    }, 0);
    const total_partida = subtotal_partida + totalImpuestos;

    const result = {
      ...partida,
      cantidad,
      precio_unitario: precio,
      descuento,
      subtotal_partida,
      total_partida,
      impuestos: impuestosLista as any,
      impuestos_calculados: partida.impuestos_calculados ?? [],
    };
    console.log('[calc] calcularPartida out', result);
    return result;
  };

  const aplicarTratamientoEnLista = (lista: PartidaForm[], valor: TratamientoImpuestos): PartidaForm[] => {
    const esSinIva = isSinIva(valor);

    return lista.map((p) => {
      const base: PartidaForm = {
        ...p,
        impuestos: esSinIva ? [] : p.impuestos ?? [],
        impuestos_calculados: esSinIva ? [] : p.impuestos_calculados ?? [],
      };
      return calcularPartida(base);
    });
  };

  const recalcularPartidasPorDescuentoGlobal = (descuentoGlobal: number) => {
    suppressPreviewRef.current = true;

    Object.keys(previewTimersRef.current).forEach((key) => {
      const timer = previewTimersRef.current[Number(key)];
      if (timer) clearTimeout(timer as any);
    });
    previewTimersRef.current = {} as any;

    const seq = ++previewGlobalSeqRef.current;
    descuentoGlobalRef.current = descuentoGlobal;

    setPartidas((prev) => {
      const next = prev.map((partida) => calcularPartida(partida, descuentoGlobal));
      recalcTotales(next, descuentoGlobal);

      next.forEach((partida, index) => {
        previewSeqRef.current[index] = seq;
        runImpuestosPreview(index, partida, tratamientoRef.current ?? form.tratamiento_impuestos ?? 'normal', seq, true, descuentoGlobal);
      });

      return next;
    });

    setTimeout(() => {
      suppressPreviewRef.current = false;
    }, 0);
  };

  const scheduleImpuestosPreview = (
    index: number,
    partida: PartidaForm,
    tratamientoOverride?: TratamientoImpuestos | null,
    immediate: boolean = false
  ) => {
    if (suppressPreviewRef.current) {
      console.log('[impuestos] preview suppressed during tratamiento change');
      return;
    }
    console.log('[impuestos] scheduleImpuestosPreview called');
    if (previewTimersRef.current[index]) {
      clearTimeout(previewTimersRef.current[index] as any);
    }

    const seq = ++previewGlobalSeqRef.current;
    previewSeqRef.current[index] = seq;

    const tratamientoPlan = tratamientoOverride ?? tratamientoRef.current ?? form.tratamiento_impuestos ?? 'normal';
    console.log('[impuestos] scheduleImpuestosPreview', {
      index,
      seq,
      producto_id: partida.producto_id,
      cantidad: partida.cantidad,
      precio_unitario: partida.precio_unitario,
      descuento_global: descuentoGlobalRef.current,
      tratamiento_impuestos: tratamientoPlan,
      immediate,
    });

    const runPreview = () => {
      const tratamientoActual = tratamientoOverride ?? tratamientoRef.current ?? form.tratamiento_impuestos ?? 'normal';
      runImpuestosPreview(index, partida, tratamientoActual, seq, immediate, descuentoGlobalRef.current);
    };

    if (immediate) {
      runPreview();
      return;
    }

    previewTimersRef.current[index] = setTimeout(runPreview, 300);
  };

  const setPartidaAt = (index: number, updater: (prev: PartidaForm) => PartidaForm) => {
    setPartidas((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;

      const updated = calcularPartida(updater(current), descuentoGlobalRef.current);

      next[index] = updated;
      recalcTotales(next, descuentoGlobalRef.current);
      if (!isChangingTratamientoRef.current) {
        scheduleImpuestosPreview(index, updated);
      }

      return next;
    });
  };

  const handleTratamientoChange = (valor: TratamientoImpuestos) => {
    tratamientoChangeSeqRef.current += 1;
    const changeSeq = tratamientoChangeSeqRef.current;
    console.log('[impuestos] handleTratamientoChange', {
      valor,
      prev: tratamientoRef.current,
      seq_before: previewGlobalSeqRef.current,
    });

    suppressPreviewRef.current = true;

    // Cancelar todos los timers pendientes antes de cualquier acción
    console.log('[impuestos] clearing debounce timers', previewTimersRef.current);
    Object.keys(previewTimersRef.current).forEach((key) => {
      const timer = previewTimersRef.current[Number(key)];
      if (timer) clearTimeout(timer as any);
    });
    previewTimersRef.current = {} as any;

    tratamientoRef.current = valor;

    setForm((prev) => ({
      ...prev,
      tratamiento_impuestos: valor,
      serie:
        valor === 'sin_iva'
          ? 'N'
          : isOperacionEstandar(valor)
          ? 'FAC'
          : prev.serie ?? null,
    }));

    const newSeq = ++previewGlobalSeqRef.current;

    Object.keys(previewTimersRef.current).forEach((key) => {
      const timer = previewTimersRef.current[Number(key)];
      if (timer) clearTimeout(timer as any);
      previewTimersRef.current[Number(key)] = null;
      previewSeqRef.current[Number(key)] = newSeq;
    });

    setPartidas((prev) => {
      const next = aplicarTratamientoEnLista(prev, valor);
      recalcTotales(next, descuentoGlobalRef.current);

      next.forEach((p, idx) => {
        if (changeSeq !== tratamientoChangeSeqRef.current) {
          return;
        }
        previewSeqRef.current[idx] = newSeq;
        runImpuestosPreview(idx, p, valor, newSeq, true, descuentoGlobalRef.current);
      });

      return next;
    });

    setTimeout(() => {
      suppressPreviewRef.current = false;
    }, 0);
  };

  const addRow = () => {
    setPartidas((prev) => {
      const next = [...prev, emptyPartida()];
      const ajustadas = form.tratamiento_impuestos === 'sin_iva' ? aplicarTratamientoEnLista(next, 'sin_iva') : next;
      setTimeout(() => recalcTotales(ajustadas, descuentoGlobalRef.current), 0);
      return ajustadas;
    });
    setExpandedObs((prev) => [...prev, false]);
    setEditingPrecio((prev) => [...prev, false]);
    setPrecioInputs((prev) => [...prev, '']);
    setUploadingImagen((prev) => [...prev, false]);
    setValoresCamposPartidas((prev) => [...prev, {}]);
  };

  const removeRow = (index: number) => {
    setPartidas((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      const next = filtered.length === 0 ? [emptyPartida()] : filtered;
      setExpandedObs((expPrev) => {
        const filteredExp = expPrev.filter((_, i) => i !== index);
        let aligned = filteredExp;
        if (next.length > filteredExp.length) aligned = [...filteredExp, false];
        if (aligned.length === 0) aligned = [false];
        return aligned;
      });
      setEditingPrecio((editPrev) => {
        const filteredEdit = editPrev.filter((_, i) => i !== index);
        let aligned = filteredEdit;
        if (next.length > filteredEdit.length) aligned = [...filteredEdit, false];
        if (aligned.length === 0) aligned = [false];
        return aligned;
      });
      setPrecioInputs((inputsPrev) => {
        const filteredInputs = inputsPrev.filter((_, i) => i !== index);
        let aligned = filteredInputs;
        if (next.length > filteredInputs.length) aligned = [...filteredInputs, ''];
        if (aligned.length === 0) aligned = [''];
        return aligned;
      });
      setUploadingImagen((uploadsPrev) => {
        const filteredUploads = uploadsPrev.filter((_, i) => i !== index);
        let aligned = filteredUploads;
        if (next.length > filteredUploads.length) aligned = [...filteredUploads, false];
        if (aligned.length === 0) aligned = [false];
        return aligned;
      });
      setValoresCamposPartidas((prevValores) => {
        const filteredValores = prevValores.filter((_, i) => i !== index);
        const aligned = filteredValores.length === 0 ? [{}] : filteredValores;
        return aligned;
      });
      recalcTotales(next, descuentoGlobalRef.current);
      return next;
    });
  };

  const handleValorCampoDocumentoChange = (valor: CampoValorPayload) => {
    setValoresCamposDocumento((prev) => {
      const next = { ...prev, [valor.campo_id]: { ...prev[valor.campo_id], ...valor, campo_id: valor.campo_id } };
      clearDependientes(next, camposDocumento.dependencias, valor.campo_id);
      return next;
    });
  };

  const handleValorCampoPartidaChange = (index: number, valor: CampoValorPayload) => {
    setValoresCamposPartidas((prev) => {
      const next = [...prev];
      const bucket = { ...(next[index] || {}) } as Record<number, CampoValorPayload>;
      bucket[valor.campo_id] = { ...bucket[valor.campo_id], ...valor, campo_id: valor.campo_id };
      clearDependientes(bucket, camposPartida.dependencias, valor.campo_id);
      next[index] = bucket;
      return next;
    });
  };

  const loadCombos = async () => {
    try {
      const [c, p, v] = await Promise.all([fetchContactos(tiposContactoPermitidos), fetchProductos(), fetchVendedores()]);
      setContactos(c);
      setProductos(p);
      setVendedores(v);
    } catch (e) {
      console.error(e);
    }
  };

  const loadDocumento = async () => {
    if (!documentoActualId) return;
    try {
      setLoading(true);
      setValoresCamposDocumento({});
      setValoresCamposPartidas([{}]);
      const requests: [Promise<CotizacionDetalle>, Promise<{ saldo: number } | null>?] = [getDocumento(Number(documentoActualId), tipoDocumento)];
      if (tipoDocumento === 'factura') {
        requests.push(fetchSaldoDocumento(Number(documentoActualId)).catch(() => null));
      }
      const [data, saldoData] = await Promise.all(requests);
      const doc = data.documento;
      setDocumentoPersistidoId(Number((doc as any).id ?? documentoActualId));
      setSaldoDocumento(Number((saldoData as any)?.saldo ?? doc.saldo ?? 0));
      setForm({
        tipo_documento: doc.tipo_documento ?? tipoDocumento,
  serie: (doc as any).serie || null,
        documento_origen_id: (doc as any).documento_origen_id ?? null,
        oportunidad_id: (doc as any).oportunidad_id ?? null,
        contacto_principal_id: doc.contacto_principal_id,
        agente_id: (doc as any).agente_id ?? null,
        fecha_documento: normalizeCivilDate(doc.fecha_documento) || defaultFecha(),
        moneda: doc.moneda || 'MXN',
        observaciones: doc.observaciones || '',
        subtotal: doc.subtotal || 0,
        descuento_global: (doc as any).descuento_global || 0,
        descuento: doc.descuento || 0,
        iva: doc.iva || 0,
        total: doc.total || 0,
        usuario_creacion_id: doc.usuario_creacion_id ?? sessionUserId ?? null,
        empresa_id: doc.empresa_id,
          estado_seguimiento: doc.estado_seguimiento ?? (doc.tipo_documento === 'cotizacion' ? DEFAULT_ESTADO_SEGUIMIENTO : null),
  tratamiento_impuestos: (doc as any).tratamiento_impuestos || 'normal',
        rfc_receptor: (doc as any).rfc_receptor || (doc as any).cliente_rfc || '',
        nombre_receptor: (doc as any).nombre_receptor || (doc as any).cliente_nombre || '',
        regimen_fiscal_receptor: (doc as any).regimen_fiscal_receptor || '',
        uso_cfdi: (doc as any).uso_cfdi || '',
        forma_pago: (doc as any).forma_pago || '',
        metodo_pago: (doc as any).metodo_pago || '',
        codigo_postal_receptor: (doc as any).codigo_postal_receptor || '',
      });
      skipFiscalFetchRef.current = true;
      prevContactoRef.current = doc.contacto_principal_id;
      descuentoGlobalRef.current = clampDiscountPercent((doc as any).descuento_global ?? 0);

      const mapped: PartidaForm[] = data.partidas.map((p: CotizacionPartida) => {
        const prod = productos.find((pr) => pr.id === p.producto_id) || null;
        const impuestosEntrada: ImpuestoEntrada[] = (p.impuestos ?? []).map((imp) => ({
          id: imp.impuesto_id,
          nombre: imp.nombre ?? imp.impuesto_id,
          tipo: imp.tipo ?? null,
          tasa: Number(imp.tasa ?? 0),
          monto: Number(imp.monto ?? 0),
          base: imp.base ?? null,
          impuesto_id: imp.impuesto_id,
        }));

        const impuestosCalcPersistidos: ImpuestoCalculadoUI[] = (p.impuestos_calculados ?? []).map((imp: any) => ({
          impuestoId: imp.impuestoId ?? imp.impuesto_id ?? imp.id ?? '',
          nombre: imp.nombre ?? '',
          tipo: imp.tipo ?? undefined,
          tasa: Number(imp.tasa ?? 0),
          monto: Number(imp.monto ?? 0),
        }));

        const impuestosCalcFallback: ImpuestoCalculadoUI[] =
          !impuestosCalcPersistidos.length && Array.isArray(p.impuestos)
            ? (p.impuestos as any[]).map((imp: any) => ({
                impuestoId: imp.impuestoId ?? imp.impuesto_id ?? imp.id ?? '',
                nombre: imp.nombre ?? imp.impuesto_id ?? '',
                tipo: imp.tipo ?? undefined,
                tasa: Number(imp.tasa ?? 0),
                monto: Number(imp.monto ?? 0),
              }))
            : [];

        const impuestosCalc: ImpuestoCalculadoUI[] = impuestosCalcPersistidos.length ? impuestosCalcPersistidos : impuestosCalcFallback;
        return calcularPartida({
          id: p.id,
          producto_id: p.producto_id,
          descripcion_alterna: p.descripcion_alterna ?? '',
          cantidad: p.cantidad,
          precio_unitario: p.precio_unitario,
          descuento: p.descuento ?? 0,
          subtotal_partida: p.subtotal_partida,
          total_partida: p.total_partida,
          es_parte_oportunidad: p.es_parte_oportunidad ?? true,
          archivo_imagen_1: p.archivo_imagen_1 ?? null,
          producto_archivo_id: p.archivo_imagen_1 ? null : p.producto_archivo_id ?? null,
          observaciones: p.observaciones ?? '',
          producto: prod,
          impuestos: impuestosEntrada,
          impuestos_calculados: impuestosCalc,
        }, (doc as any).descuento_global ?? 0);
      });
      let nextPartidas = mapped.length ? mapped : [emptyPartida()];
      if ((doc as any).tratamiento_impuestos === 'sin_iva') {
        nextPartidas = aplicarTratamientoEnLista(nextPartidas, 'sin_iva');
      }
      setPartidas(nextPartidas);
      setExpandedObs(nextPartidas.map((p) => Boolean(p.observaciones?.trim())) || [false]);
      setEditingPrecio(nextPartidas.map(() => false));
      setPrecioInputs(nextPartidas.map((p) => (p.precio_unitario ?? '').toString()));
  setUploadingImagen(nextPartidas.map(() => false));
      recalcTotales(nextPartidas, (doc as any).descuento_global ?? 0);

      // Carga valores dinámicos ya capturados
      const [valoresDocResp, valoresPartidasResp] = await Promise.all([
        fetchCamposDocumento(Number(documentoActualId)),
        Promise.all(nextPartidas.map((p) => (p.id ? fetchCamposPartida(p.id) : Promise.resolve([] as CampoValorGuardado[])))),
      ]);

      const bucketDoc = mapValoresToRecord(valoresDocResp || []);
      setValoresCamposDocumento(bucketDoc);
      prefetchOpcionesLista(camposDocumento.campos, bucketDoc, camposDocumento.loadOptions);

      const bucketsPartidas = nextPartidas.map((_, idx) => mapValoresToRecord(valoresPartidasResp[idx] || []));
      setValoresCamposPartidas(bucketsPartidas.length ? bucketsPartidas : [{}]);
      bucketsPartidas.forEach((bucket) => {
        prefetchOpcionesLista(camposPartida.campos, bucket, camposPartida.loadOptions);
      });

      setError(null);
    } catch (e) {
  const mensaje = e instanceof Error ? e.message : `No se pudo cargar la ${textos.singular}`;
      setError(mensaje);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDocumentoPersistidoId(routeDocumentoId);
  }, [routeDocumentoId]);

  const loadAnticiposResumen = useCallback(async (documentIdOverride?: number | null) => {
    const targetDocumentId = documentIdOverride ?? documentoActualId;

    if (!anticipoConfig || !targetDocumentId) {
      setAnticiposResumen(null);
      return;
    }
    try {
      setLoadingAnticiposResumen(true);
      const data = await fetchResumenAnticiposDocumento(Number(targetDocumentId));
      setAnticiposResumen(data);
    } catch {
      setAnticiposResumen(null);
    } finally {
      setLoadingAnticiposResumen(false);
    }
  }, [anticipoConfig, documentoActualId]);

  const loadCuentasFinancieras = useCallback(async () => {
    try {
      const data = await fetchCuentas();
      setCuentasFinancieras(data ?? []);
    } catch {
      setCuentasFinancieras([]);
    }
  }, []);

  useEffect(() => {
    loadCombos();
  }, []);

  useEffect(() => {
    loadDocumento();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentoActualId, tipoDocumento]);

  useEffect(() => {
    void loadAnticiposResumen();
  }, [loadAnticiposResumen]);

  useEffect(() => {
    if (!openAnticipoDialog || cuentasFinancieras.length > 0) return;
    void loadCuentasFinancieras();
  }, [cuentasFinancieras.length, loadCuentasFinancieras, openAnticipoDialog]);

  useEffect(() => {
    if (isEdit) return;
    if (!sessionUserId) return;
    setForm((prev) => (prev.usuario_creacion_id ? prev : { ...prev, usuario_creacion_id: sessionUserId }));
  }, [isEdit, sessionUserId]);

  useEffect(() => {
    tratamientoRef.current = form.tratamiento_impuestos ?? 'normal';
  }, [form.tratamiento_impuestos]);

  useEffect(() => {
    descuentoGlobalRef.current = clampDiscountPercent(form.descuento_global ?? 0);
  }, [form.descuento_global]);

  useEffect(() => {
    setValoresCamposPartidas((prev) => {
      const next = [...prev];
      while (next.length < partidas.length) next.push({});
      while (next.length > partidas.length) next.pop();
      return next;
    });
  }, [partidas.length]);

  useEffect(() => {
    camposDocumento.campos
      .filter((campo) => campo.tipo_dato === 'lista' && !campo.campo_padre_id)
      .forEach((campo) => {
        camposDocumento.loadOptions(campo.id, null);
      });
  }, [camposDocumento.campos, camposDocumento.loadOptions]);

  useEffect(() => {
    camposPartida.campos
      .filter((campo) => campo.tipo_dato === 'lista' && !campo.campo_padre_id)
      .forEach((campo) => {
        camposPartida.loadOptions(campo.id, null);
      });
  }, [camposPartida.campos, camposPartida.loadOptions]);

  // Carga opciones dependientes según valores actuales (evita setState en render)
  useEffect(() => {
    camposDocumento.campos
      .filter((campo) => campo.tipo_dato === 'lista')
      .forEach((campo) => {
        const parentCatalogId = campo.campo_padre_id
          ? valoresCamposDocumento[campo.campo_padre_id]?.catalogo_id ?? null
          : null;
        camposDocumento.loadOptions(campo.id, parentCatalogId ?? null);
      });
  }, [camposDocumento.campos, camposDocumento.loadOptions, valoresCamposDocumento]);

  useEffect(() => {
    camposPartida.campos
      .filter((campo) => campo.tipo_dato === 'lista')
      .forEach((campo) => {
        valoresCamposPartidas.forEach((bucket) => {
          const parentCatalogId = campo.campo_padre_id
            ? bucket?.[campo.campo_padre_id]?.catalogo_id ?? null
            : null;
          camposPartida.loadOptions(campo.id, parentCatalogId ?? null);
        });
      });
  }, [camposPartida.campos, camposPartida.loadOptions, valoresCamposPartidas]);

  useEffect(() => {
    if (tipoDocumento !== 'factura') return;

    const contactoId = form.contacto_principal_id;

    if (!contactoId) {
      prevContactoRef.current = contactoId;
      return;
    }

    if (skipFiscalFetchRef.current) {
      skipFiscalFetchRef.current = false;
      prevContactoRef.current = contactoId;
      return;
    }

    if (prevContactoRef.current === contactoId) return;

    cargarDatosFiscalesContacto(contactoId);
    prevContactoRef.current = contactoId;
  }, [form.contacto_principal_id, tipoDocumento]);

  const validarDocumentoAntesDePersistir = useCallback((context: 'save' | 'anticipo' | 'exit' = 'save') => {
    if (!form.contacto_principal_id) {
      setSnackbar({
        open: true,
        message: context === 'anticipo' ? 'Primero selecciona un cliente/proveedor.' : 'Selecciona un cliente',
        severity: 'error',
      });
      return false;
    }
    if ((context === 'anticipo' || hasAnticiposRegistrados) && Number(form.total || 0) <= 0) {
      setSnackbar({ open: true, message: 'Primero captura partidas o un total mayor a cero.', severity: 'error' });
      return false;
    }
    if (context === 'anticipo' && !tienePartidaValida) {
      setSnackbar({ open: true, message: 'Agrega al menos una partida válida con cantidad y precio mayores a cero.', severity: 'error' });
      return false;
    }
    if (hasAnticiposRegistrados && Number(form.total || 0) < totalAnticipadoRegistrado) {
      setSnackbar({ open: true, message: 'El total del documento no puede ser menor que los anticipos registrados.', severity: 'error' });
      return false;
    }

    const requiereDatosFiscales = tipoDocumento === 'factura' && form.tratamiento_impuestos !== 'sin_iva';
    if (requiereDatosFiscales) {
      if (!form.rfc_receptor || !validarRFC(form.rfc_receptor)) {
        setSnackbar({ open: true, message: 'RFC receptor es obligatorio y debe ser válido', severity: 'error' });
        return false;
      }
      if (!form.regimen_fiscal_receptor || !form.uso_cfdi || !form.forma_pago || !form.metodo_pago || !form.codigo_postal_receptor) {
        setSnackbar({ open: true, message: 'Completa los datos fiscales requeridos', severity: 'error' });
        return false;
      }
    }

    return true;
  }, [form, hasAnticiposRegistrados, tienePartidaValida, tipoDocumento, totalAnticipadoRegistrado]);

  const persistDocumento = useCallback(async (options?: {
    context?: 'save' | 'anticipo' | 'exit';
    navigateAfterSave?: boolean;
    showSuccessMessage?: boolean;
  }) => {
    const { context = 'save', navigateAfterSave = false, showSuccessMessage = true } = options ?? {};

    if (!validarDocumentoAntesDePersistir(context)) {
      return null;
    }

    try {
      setSaving(true);
      const payload: CotizacionCrearPayload & { conversacion_id: number | null } = {
        ...form,
        tipo_documento: tipoDocumento,
        serie: form.serie?.trim() || null,
        subtotal: form.subtotal || 0,
        descuento_global: form.descuento_global || 0,
        descuento: form.descuento || 0,
        iva: form.iva || 0,
        total: form.total || 0,
        empresa_id: getEmpresaActivaId(),
        conversacion_id: conversacionId ? Number(conversacionId) : null,
        usuario_creacion_id: form.usuario_creacion_id ?? sessionUserId ?? null,
        estado_seguimiento: isCotizacion ? (form.estado_seguimiento ?? DEFAULT_ESTADO_SEGUIMIENTO) : null,
        tratamiento_impuestos: tipoDocumento === 'factura' ? form.tratamiento_impuestos || 'normal' : 'normal',
        rfc_receptor: form.rfc_receptor?.trim() || null,
        nombre_receptor: form.nombre_receptor?.trim() || null,
        regimen_fiscal_receptor: form.regimen_fiscal_receptor?.trim() || null,
        uso_cfdi: form.uso_cfdi?.trim() || null,
        forma_pago: form.forma_pago?.trim() || null,
        metodo_pago: form.metodo_pago?.trim() || null,
        codigo_postal_receptor: form.codigo_postal_receptor?.trim() || null,
      };

      let docId: number;
      if (documentoActualId) {
        const updated = await updateDocumento(Number(documentoActualId), tipoDocumento, payload);
        docId = (updated as any).id ?? Number(documentoActualId);
      } else {
        const created = await createDocumento(tipoDocumento, payload);
        docId = (created as any).id;
      }

      setDocumentoPersistidoId(docId);

      const partidasPayload: CotizacionPartidaPayload[] = partidas.map((p) => ({
        producto_id: p.producto_id,
        descripcion_alterna: p.descripcion_alterna ?? '',
        cantidad: p.cantidad ?? 0,
        precio_unitario: p.precio_unitario ?? 0,
        descuento: p.descuento ?? 0,
        subtotal_partida: p.subtotal_partida ?? 0,
        total_partida: p.total_partida ?? 0,
        ...(partidasMostrarEsParteOportunidad
          ? {
              es_parte_oportunidad: p.es_parte_oportunidad ?? true,
            }
          : {}),
        ...(partidasMostrarImagenes
          ? {
              archivo_imagen_1: p.archivo_imagen_1 ?? null,
              producto_archivo_id: p.archivo_imagen_1 ? null : p.producto_archivo_id ?? null,
            }
          : {}),
        observaciones: p.observaciones ?? '',
        impuestos: (p.impuestos_calculados ?? p.impuestos ?? []).map((imp: any) => ({
          impuesto_id: imp.impuestoId ?? imp.impuesto_id ?? imp.id ?? imp.id,
          nombre: imp.nombre ?? null,
          tipo: imp.tipo ?? null,
          tasa: Number(imp.tasa ?? 0),
          base: imp.base ?? null,
          monto: Number(imp.monto ?? 0),
        })),
      }));
      const partidasGuardadas = await replacePartidas(docId, tipoDocumento, partidasPayload);

      const valoresDocumento = Object.values(valoresCamposDocumento).filter(tieneValorCapturado);
      if (valoresDocumento.length) {
        await guardarCamposDocumento({ documento_id: docId, valores: valoresDocumento });
      }

      if (Array.isArray(partidasGuardadas) && partidasGuardadas.length) {
        const tareasCamposPartida = partidasGuardadas
          .map((p, idx) => {
            const valoresMapa = valoresCamposPartidas[idx] || {};
            const valores = Object.values(valoresMapa).filter(tieneValorCapturado);
            if (!p?.id || valores.length === 0) return null;
            return guardarCamposPartida({ partida_id: p.id, valores });
          })
          .filter(Boolean) as Promise<unknown>[];

        if (tareasCamposPartida.length) {
          await Promise.all(tareasCamposPartida);
        }
      }

      const nextPath = resolveDocumentoFormPath(tipoDocumento, docId, moduloDocumento);
      if (location.pathname !== nextPath) {
        navigate(nextPath, { replace: true });
      }

      void loadAnticiposResumen(docId);

      if (showSuccessMessage) {
        setSnackbar({ open: true, message: textos.guardado, severity: 'success' });
      }

      if (navigateAfterSave) {
        setTimeout(() => navigate(basePath), 400);
      }

      return docId;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo guardar';
      if (message.toLowerCase().includes('serie') && message.toLowerCase().includes('número')) {
        setDuplicateDialog({ open: true, message });
      } else {
        setSnackbar({ open: true, message, severity: 'error' });
      }
      return null;
    } finally {
      setSaving(false);
    }
  }, [
    basePath,
    conversacionId,
    documentoActualId,
    form,
    isCotizacion,
    loadAnticiposResumen,
    location.pathname,
    moduloDocumento,
    navigate,
    partidas,
    partidasMostrarEsParteOportunidad,
    partidasMostrarImagenes,
    sessionUserId,
    textos.guardado,
    tieneValorCapturado,
    tipoDocumento,
    validarDocumentoAntesDePersistir,
    valoresCamposDocumento,
    valoresCamposPartidas,
  ]);

  const handleSave = async () => {
    await persistDocumento({ context: 'save', navigateAfterSave: true, showSuccessMessage: true });
  };

  const handleProductoChange = (index: number, producto: Producto | null) => {
    setPartidaAt(index, (prev) => {
      return {
        ...prev,
        producto_id: producto?.id ?? null,
        descripcion_alterna: producto?.descripcion || prev.descripcion_alterna,
        precio_unitario: producto?.precio_publico ?? producto?.precio_menudeo ?? prev.precio_unitario ?? 0,
        producto: producto ?? null,
        producto_archivo_id: null,
        impuestos: [],
        impuestos_calculados: [],
      };
    });
  };

  const handleCrearProductoSubmit = async () => {
    const descripcion = crearProductoDescripcion.trim();

    if (!descripcion) {
      setSnackbar({ open: true, message: 'La descripcion es obligatoria.', severity: 'error' });
      return;
    }

    let clave = crearProductoClave.trim();
    if (!clave) {
      clave = `PRD-${Date.now()}`;
    }

    const claveNormalizada = clave.toLowerCase();
    const claveDuplicada = productos.some((producto) => String(producto.clave ?? '').trim().toLowerCase() === claveNormalizada);

    if (claveDuplicada) {
      setCrearProductoClaveError('Ya existe un producto con esa clave.');
      return;
    }

    try {
      setCrearProductoLoading(true);
      setCrearProductoClaveError(null);
      const payload: ProductoBasico = {
        clave,
        descripcion,
        tipo_producto: crearProductoTipo,
        clasificacion: null,
        activo: true,
        unidad_venta_id: null,
        unidad_inventario_id: null,
      };
      const nuevo = await createProducto(payload);
      setProductos((prev) => [nuevo, ...prev.filter((producto) => producto.id !== nuevo.id)]);
      if (crearProductoIndex !== null) {
        handleProductoChange(crearProductoIndex, nuevo);
      }
      setSnackbar({ open: true, message: 'Producto creado', severity: 'success' });
      setCrearProductoOpen(false);
      setCrearProductoClave('');
      setCrearProductoDescripcion('');
      setCrearProductoTipo(productoDefaultTipoProducto);
      setCrearProductoIndex(null);
      setCrearProductoClaveError(null);
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo crear el producto', severity: 'error' });
    } finally {
      setCrearProductoLoading(false);
    }
  };

  const handleCantidadPrecioChange = (index: number, field: 'cantidad' | 'precio_unitario' | 'descuento', value: string) => {
    console.log('[calc] onChange input', { index, field, value });
    setPartidaAt(index, (prev) => {
      const nextValue = field === 'descuento' ? clampDiscountPercent(value) : Number(value);
      return {
        ...prev,
        [field]: nextValue,
        impuestos: prev.impuestos ?? [],
      };
    });
  };

  const handleDescuentoGlobalChange = (value: string) => {
    const descuentoGlobal = clampDiscountPercent(value);
    setForm((prev) => ({ ...prev, descuento_global: descuentoGlobal }));
    recalcularPartidasPorDescuentoGlobal(descuentoGlobal);
  };

  const abrirImagenDialog = (index: number) => {
    setPartidaImagenDialog({ open: true, index, view: 'menu' });
    setPartidaImagenesProductoError(null);
  };

  const cerrarImagenDialog = () => {
    setPartidaImagenDialog({ open: false, index: null, view: 'menu' });
    setPartidaImagenesProductoError(null);
  };

  const handleImagenCustomClick = () => {
    partidaImagenInputRef.current?.click();
  };

  const handleImagenProductoSelect = (archivo: ProductoArchivo) => {
    if (partidaImagenDialog.index === null) return;
    setPartidaAt(partidaImagenDialog.index, (prev) => ({
      ...prev,
      archivo_imagen_1: null,
      producto_archivo_id: archivo.id,
    }));
    setSnackbar({ open: true, message: 'Imagen del producto seleccionada', severity: 'success' });
    cerrarImagenDialog();
  };

  const handleImagenSinSeleccion = () => {
    if (partidaImagenDialog.index === null) return;
    setPartidaAt(partidaImagenDialog.index, (prev) => ({
      ...prev,
      archivo_imagen_1: null,
      producto_archivo_id: null,
    }));
    cerrarImagenDialog();
  };

  const handleImagenChange = async (index: number, files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    setUploadingImagen((prev) => {
      const next = [...prev];
      next[index] = true;
      return next;
    });

    try {
      const resp = await uploadArchivo(file);
      setPartidaAt(index, (prev) => ({ ...prev, archivo_imagen_1: resp.url, producto_archivo_id: null }));
      setSnackbar({ open: true, message: 'Imagen cargada', severity: 'success' });
      if (partidaImagenDialog.open && partidaImagenDialog.index === index) {
        cerrarImagenDialog();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo subir la imagen';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setUploadingImagen((prev) => {
        const next = [...prev];
        next[index] = false;
        return next;
      });
      const input = partidaImagenInputRef.current;
      if (input) input.value = '';
    }
  };

  const handleImagenRemove = (index: number) => {
    const imagenUrl = partidas[index]?.archivo_imagen_1?.trim();
    const productoArchivoId = partidas[index]?.producto_archivo_id ?? null;
    if (!imagenUrl && !productoArchivoId) return;
    if (!window.confirm('¿Eliminar la imagen de esta partida?')) return;

    setPartidaAt(index, (prev) => ({ ...prev, archivo_imagen_1: null, producto_archivo_id: null }));

    const input = partidaImagenInputRef.current;
    if (input) input.value = '';
  };

  const handleDescripcionChange = (index: number, value: string) => {
    setPartidaAt(index, (prev) => ({ ...prev, descripcion_alterna: value }));
  };

  const handleObservacionesChange = (index: number, value: string) => {
    setPartidaAt(index, (prev) => ({ ...prev, observaciones: value }));
  };

  const toggleObservaciones = (index: number) => {
    setExpandedObs((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const esDetalleContacto = (resp: ContactoDetalle | Contacto): resp is ContactoDetalle => 'contacto' in resp;

  const handleClienteSelect = (value: Contacto | null) => {
    setForm((prev) => ({
      ...prev,
      contacto_principal_id: value?.id ?? null,
      agente_id: prev.agente_id ?? value?.vendedor_id ?? null,
    }));
  };

  useEffect(() => {
    if (isEdit) return;
    if (!prefillContactoId) return;
    if (form.contacto_principal_id) return;
    if (!contactos.length) return;

    const contacto = contactos.find((item) => item.id === prefillContactoId) ?? null;
    if (!contacto) return;

    handleClienteSelect(contacto);
  }, [contactos, form.contacto_principal_id, handleClienteSelect, isEdit, prefillContactoId]);

  const cargarDatosFiscalesContacto = async (contactoId: number) => {
    try {
      const detalle = await getContacto(contactoId);
      const datosFiscales = esDetalleContacto(detalle) ? detalle.datos_fiscales : null;
      const nombreContacto = esDetalleContacto(detalle) ? detalle.contacto?.nombre : (detalle as Contacto).nombre;

      setForm((prev) => ({
        ...prev,
        contacto_principal_id: contactoId,
        rfc_receptor: datosFiscales?.rfc || '',
        nombre_receptor: nombreContacto || '',
        regimen_fiscal_receptor: datosFiscales?.regimen_fiscal || '',
        uso_cfdi: datosFiscales?.uso_cfdi || '',
        forma_pago: datosFiscales?.forma_pago || '',
        metodo_pago: datosFiscales?.metodo_pago || '',
        codigo_postal_receptor: datosFiscales?.codigo_postal || '',
      }));
    } catch (err) {
      console.error('No se pudo cargar datos fiscales del contacto', err);
    }
  };

  const handleCrearClienteSubmit = async () => {
    const nombre = crearClienteNombre.trim();
    if (!nombre) {
      setSnackbar({ open: true, message: 'Ingresa el nombre del cliente', severity: 'error' });
      return;
    }

    try {
      setCrearClienteLoading(true);
      const payload: Record<string, unknown> = {
        nombre,
        tipo_contacto: crearClienteTipo,
      };

      if (contactoCaptureMode === 'detailed') {
        const telefono = crearClienteDetailedFields.telefono.trim();
        const email = crearClienteDetailedFields.email.trim();
        const calle = crearClienteDetailedFields.calle.trim();
        const numeroExterior = crearClienteDetailedFields.numeroExterior.trim();
        const numeroInterior = crearClienteDetailedFields.numeroInterior.trim();
        const colonia = crearClienteDetailedFields.colonia.trim();
        const ciudad = crearClienteDetailedFields.ciudad.trim();
        const estado = crearClienteDetailedFields.estado.trim();
        const cp = crearClienteDetailedFields.cp.trim();

        if (telefono) {
          payload.telefono = normalizarTelefonoMx(telefono);
        }
        if (email) payload.email = email;
        if (calle) payload.calle = calle;
        if (numeroExterior) payload.numero_exterior = numeroExterior;
        if (numeroInterior) payload.numero_interior = numeroInterior;
        if (colonia) payload.colonia = colonia;
        if (ciudad) payload.ciudad = ciudad;
        if (estado) payload.estado = estado;
        if (cp) payload.cp = cp;
      }

      const nuevo = await crearContacto(payload as Partial<Contacto>);
      setContactos((prev) => [nuevo, ...prev.filter((c) => c.id !== nuevo.id)]);
      handleClienteSelect(nuevo);
      await cargarDatosFiscalesContacto(nuevo.id);
      setSnackbar({ open: true, message: 'Cliente creado', severity: 'success' });
      setCrearClienteOpen(false);
      setCrearClienteNombre('');
      setCrearClienteTipo(contactoDefaultTipoContacto);
      setCrearClienteDetailedFields(emptyContactCaptureDetailedFields());
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'No se pudo crear el cliente', severity: 'error' });
    } finally {
      setCrearClienteLoading(false);
    }
  };

  const filterProductos = (options: Producto[], state: any) => {
    const term = (state.inputValue || '').toString().trim().toLowerCase();
    if (!term) return options;
    return options.filter((opt) => {
      const clave = (opt.clave || '').toLowerCase();
      const descripcion = (opt.descripcion || '').toLowerCase();
      return clave.includes(term) || descripcion.includes(term);
    });
  };

  const fiscalValues = {
    rfc_receptor: form.rfc_receptor || '',
    nombre_receptor: form.nombre_receptor || '',
    regimen_fiscal_receptor: form.regimen_fiscal_receptor || '',
    uso_cfdi: form.uso_cfdi || '',
    forma_pago: form.forma_pago || '',
    metodo_pago: form.metodo_pago || '',
    codigo_postal_receptor: form.codigo_postal_receptor || '',
  };

  useEffect(() => {
    if (!shouldOpenPagos) return;
    if (tipoDocumento !== 'factura' || !isEdit || !id) return;
    if (!form.contacto_principal_id || saldoDocumento <= 0) return;
    setOpenPagos(true);
  }, [shouldOpenPagos, tipoDocumento, isEdit, id, form.contacto_principal_id, saldoDocumento]);

  const handleClosePagosDrawer = useCallback(() => {
    setOpenPagos(false);
    const params = new URLSearchParams(location.search);
    if (params.get('abrirPagos') === '1') {
      params.delete('abrirPagos');
      const nextSearch = params.toString();
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : '',
        },
        { replace: true }
      );
    }
    void loadDocumento();
  }, [location.pathname, location.search, navigate]);

  const handleOpenAnticipo = useCallback(async () => {
    if (!anticipoConfig) return;

    let docId = documentoActualId;
    if (!docId) {
      docId = await persistDocumento({ context: 'anticipo', navigateAfterSave: false, showSuccessMessage: false });
      if (!docId) return;
    } else if (!validarDocumentoAntesDePersistir('anticipo')) {
      return;
    }

    if (!cuentasFinancieras.length) {
      await loadCuentasFinancieras();
    }

    setDocumentoPersistidoId(docId);
    setOpenAnticipoDialog(true);
  }, [anticipoConfig, cuentasFinancieras.length, documentoActualId, loadCuentasFinancieras, persistDocumento, validarDocumentoAntesDePersistir]);

  const handleNavigateBack = useCallback(async () => {
    if (hasAnticiposRegistrados && documentoActualId) {
      const savedDocumentoId = await persistDocumento({ context: 'exit', navigateAfterSave: false, showSuccessMessage: false });
      if (!savedDocumentoId) return;
      setSnackbar({ open: true, message: 'Cambios guardados antes de salir.', severity: 'success' });
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(basePath);
  }, [basePath, documentoActualId, hasAnticiposRegistrados, navigate, persistDocumento]);

  const handleCloseAnticipoDialog = useCallback(() => {
    setOpenAnticipoDialog(false);
  }, []);

  const handleSavedAnticipo = useCallback((savedDocumentoId?: number | null) => {
    const targetDocumentId = savedDocumentoId ?? documentoActualId;

    setOpenAnticipoDialog(false);
    if (!targetDocumentId) return;

    setDocumentoPersistidoId(Number(targetDocumentId));
    void loadAnticiposResumen(Number(targetDocumentId));
  }, [documentoActualId, loadAnticiposResumen]);

  const anticiposFormatter = useMemo(
    () =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: form.moneda || 'MXN',
        minimumFractionDigits: 2,
      }),
    [form.moneda]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: mostrarResumenFinancieroSticky ? { xs: 10, sm: 9 } : 0 }}>
      <Toolbar disableGutters sx={{ justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            onClick={() => void handleNavigateBack()}
          >
            Volver
          </Button>
          <Box>
            <Typography variant="h5" fontWeight={700} color="#1d2f68">
              {isEdit ? textos.editar : textos.nuevo}
            </Typography>
            <Typography variant="body2" color="#4b5563">
              {textos.descripcion}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          {anticipoConfig ? (
            <Button
              variant="outlined"
              onClick={() => void handleOpenAnticipo()}
              disabled={saving || loading}
            >
              {anticipoConfig.accionLabel}
            </Button>
          ) : null}
          {isEdit && documentoActualId && (
            <Button
              variant="outlined"
              onClick={() => setOpenPagos(true)}
              disabled={tipoDocumento !== 'factura' || !form.contacto_principal_id || saldoDocumento <= 0}
            >
              Aplicar pago
            </Button>
          )}
          {isEdit && documentoActualId && (
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              onClick={async () => {
                try {
                  setDownloadingPdf(true);
                  await abrirDocumentoPdfEnNuevaVentana(Number(documentoActualId), tipoDocumento);
                } catch (err: any) {
                  setError(err?.message || 'No se pudo generar el PDF');
                } finally {
                  setDownloadingPdf(false);
                }
              }}
              disabled={loading || downloadingPdf}
            >
              {downloadingPdf ? 'Generando...' : 'PDF'}
            </Button>
          )}
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </Stack>
      </Toolbar>

      {anticipoConfig && (documentoActualId || hasAnticiposRegistrados || Number(form.total || 0) > 0) ? (
        <Paper
          variant="outlined"
          sx={{
            px: 1.5,
            py: 1,
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
            borderColor: hasAnticiposRegistrados ? '#9db4ff' : '#d7deed',
            bgcolor: '#f7faff',
          }}
        >
          {loadingAnticiposResumen ? <CircularProgress size={16} /> : null}
          <Typography variant="body2" color="#1d2f68" fontWeight={700}>
            {anticipoConfig.flujo === 'compras' ? 'Anticipos pagados' : 'Anticipos'}:
          </Typography>
          <Typography variant="body2" color="text.primary">
            {anticiposFormatter.format(Number(anticiposResumen?.total_anticipado ?? 0))}
            {anticipoConfig.flujo === 'compras' ? '' : ' recibidos'}
          </Typography>
          <Typography variant="body2" color="text.secondary">·</Typography>
          <Typography variant="body2" color="text.primary">
            Disponible: {anticiposFormatter.format(Number(anticiposResumen?.disponible_por_aplicar ?? 0))}
          </Typography>
          <Typography variant="body2" color="text.secondary">·</Typography>
          <Typography variant="body2" color={Number(form.total || 0) < totalAnticipadoRegistrado ? 'error.main' : 'text.primary'}>
            Pendiente: {anticiposFormatter.format(Number(anticiposResumen?.pendiente_estimado ?? Math.max(Number(form.total || 0), 0)))}
          </Typography>
        </Paper>
      ) : null}

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {widgetOrigenDocumento && isEdit && form.documento_origen_id ? (
        <Box>
          <Chip
            variant="outlined"
            label={`Basada en cotización #${form.documento_origen_id}`}
            sx={{ fontWeight: 600 }}
          />
        </Box>
      ) : null}

      {showFiscalTab && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="Pestañas documento">
            <Tab label="Documento" value={0} />
            <Tab label="Datos fiscales" value={1} />
          </Tabs>
        </Box>
      )}

      {(!showFiscalTab || activeTab === 0) && (
        <Paper variant="outlined" sx={{ borderRadius: 2, p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {loading ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CircularProgress size={22} />
              <Typography color="text.secondary">{textos.cargando}</Typography>
            </Stack>
          ) : (
            <>
              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 12, md: 5 }}>
                  <Autocomplete<ContactoAutocompleteOption>
                    fullWidth
                    options={contactos}
                    loading={contactos.length === 0}
                    getOptionLabel={(option) => option.nombre || ''}
                    filterOptions={(options, state) => {
                      const filtered = filterContactoOptions(options, state);
                      const inputValue = state.inputValue.trim();

                      if (!inputValue) {
                        return filtered;
                      }

                      const normalizedInput = inputValue.toLocaleLowerCase();
                      const hasExactMatch = options.some((option) => {
                        if ('kind' in option && option.kind === 'create') return false;
                        return (option.nombre || '').trim().toLocaleLowerCase() === normalizedInput;
                      });

                      if (hasExactMatch) {
                        return filtered;
                      }

                      return [
                        {
                          kind: 'create',
                          id: -1,
                          nombre: `➕ Crear cliente "${inputValue}"`,
                          inputValue,
                        },
                        ...filtered,
                      ];
                    }}
                    isOptionEqualToValue={(option, value) => {
                      const optionIsCreate = 'kind' in option && option.kind === 'create';
                      const valueIsCreate = !!value && 'kind' in value && value.kind === 'create';
                      if (optionIsCreate || valueIsCreate) {
                        return optionIsCreate && valueIsCreate && option.id === value.id;
                      }
                      return option?.id === value?.id;
                    }}
                    value={contactos.find((c) => c.id === form.contacto_principal_id) || null}
                    onChange={(_, value) => {
                      if (value && 'kind' in value && value.kind === 'create') {
                        setCrearClienteOpen(true);
                        setCrearClienteNombre(value.inputValue);
                        setCrearClienteTipo(contactoDefaultTipoContacto);
                        setCrearClienteDetailedFields(emptyContactCaptureDetailedFields());
                        return;
                      }
                      handleClienteSelect((value as Contacto | null) ?? null);
                    }}
                    renderOption={(props, option) => {
                      const { key, ...rest } = props;
                      return (
                        <li {...rest} key={option.id ?? key}>
                          {option.nombre || ''}
                        </li>
                      );
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...(params as any)}
                        fullWidth
                        label="Cliente"
                        required
                        size="small"
                        InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                        inputProps={{ ...params.inputProps, style: { fontSize: 13 } }}
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Autocomplete
                    fullWidth
                    options={vendedores}
                    loading={vendedores.length === 0}
                    getOptionLabel={(option) => option.nombre || ''}
                    value={vendedores.find((c) => c.id === form.agente_id) || null}
                    onChange={(_, value) => setForm((prev) => ({ ...prev, agente_id: value?.id ?? null }))}
                    renderOption={(props, option) => {
                      const { key, ...rest } = props;
                      return (
                        <li {...rest} key={option.id ?? key}>
                          {option.nombre || ''}
                        </li>
                      );
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...(params as any)}
                        fullWidth
                        label="Vendedor"
                        size="small"
                        InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                        inputProps={{ ...params.inputProps, style: { fontSize: 13 } }}
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    label="Fecha documento"
                    type="date"
                    value={form.fecha_documento}
                    onChange={(e) => setForm((prev) => ({ ...prev, fecha_documento: e.target.value }))}
                    InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                    inputProps={{ style: { fontSize: 13 } }}
                    fullWidth
                    size="small"
                  />
                </Grid>
                {widgetTratamientoFiscal && (
                  <Grid size={{ xs: 12, md: 2 }}>
                    <TextField
                      select
                      label="Tratamiento fiscal"
                      value={form.tratamiento_impuestos || 'normal'}
                      onChange={(e) => handleTratamientoChange((e.target.value as TratamientoImpuestos) || 'normal')}
                      fullWidth
                      size="small"
                      InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                      inputProps={{ style: { fontSize: 13 } }}
                    >
                      {TRATAMIENTO_OPCIONES.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                )}
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    label="Observaciones"
                    value={form.observaciones || ''}
                    onChange={(e) => setForm((prev) => ({ ...prev, observaciones: e.target.value }))}
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                    inputProps={{ style: { fontSize: 13 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    label="Descuento global %"
                    type="number"
                    value={form.descuento_global ?? 0}
                    onChange={(e) => handleDescuentoGlobalChange(e.target.value)}
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                    inputProps={{ min: 0, max: 100, step: 0.0001, style: { textAlign: 'right', fontSize: 13 } }}
                  />
                </Grid>
              </Grid>

              {camposDocumento.campos.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} color="#1d2f68" sx={{ mb: 1 }}>
                    Campos configurables
                  </Typography>
                  <Grid container spacing={1.5}>
                    {camposDocumento.campos.map((campo) => {
                      const parentCatalogId = campo.campo_padre_id
                        ? valoresCamposDocumento[campo.campo_padre_id]?.catalogo_id ?? null
                        : null;
                      const options = camposDocumento.getOptions(campo.id, parentCatalogId ?? null);
                      const disabled = campo.campo_padre_id ? !parentCatalogId : false;
                      const valorCampo = valoresCamposDocumento[campo.id];
                      return (
                        <Grid key={campo.id} size={{ xs: 12, md: 4 }}>
                          <DynamicFieldControl
                            campo={campo}
                            {...(valorCampo ? { value: valorCampo } : {})}
                            options={options}
                            loading={Boolean(camposDocumento.optionsLoading[`${campo.id}::${parentCatalogId ?? 'root'}`])}
                            disabled={disabled}
                            onChange={(val: CampoValorPayload) => handleValorCampoDocumentoChange({ ...val, campo_id: campo.id })}
                          />
                        </Grid>
                      );
                    })}
                  </Grid>
                </Box>
              )}

              <Divider />

              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Typography variant="h6" color="#1d2f68" fontWeight={700}>
                  Partidas
                </Typography>
                <Button startIcon={<AddIcon />} onClick={addRow} variant="outlined" size="small">
                  Agregar partida
                </Button>
              </Stack>

              <Stack spacing={1}>
                {partidas.map((partida, index) => (
                  <React.Fragment key={index}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.25,
                        borderRadius: 1.25,
                        borderColor: '#e5e7eb',
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: '1fr',
                          md: partidasGridTemplate,
                        },
                        gap: { xs: 1, md: 1 },
                        alignItems: 'center',
                      }}
                    >
                      <Autocomplete<ProductoAutocompleteOption>
                        options={productosAutocompleteOptions}
                        loading={productos.length === 0}
                        getOptionLabel={(option) => option.clave || ''}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        value={productos.find((p) => p.id === partida.producto_id) || null}
                        onChange={(_, value) => {
                          if (value && 'kind' in value && value.kind === 'create') {
                            setCrearProductoIndex(index);
                            setCrearProductoClave('');
                            setCrearProductoDescripcion('');
                            setCrearProductoTipo(productoDefaultTipoProducto);
                            setCrearProductoClaveError(null);
                            setCrearProductoOpen(true);
                            return;
                          }

                          handleProductoChange(index, value as Producto | null);
                        }}
                        filterOptions={(options, state) => {
                          const createOption = options.find((option) => 'kind' in option && option.kind === 'create') ?? null;
                          const productOptions = options.filter((option): option is Producto => !('kind' in option));
                          const filtered = filterProductos(productOptions, state);

                          return createOption ? [...filtered, createOption] : filtered;
                        }}
                        data-product-creation-mode={productoFlowConfig.creationMode}
                        data-product-capture-mode={productoFlowConfig.captureMode}
                        data-product-default-type={productoFlowConfig.defaultTipoProducto}
                        slotProps={{
                          popper: {
                            placement: 'bottom-start',
                            modifiers: [
                              {
                                name: 'offset',
                                options: {
                                  offset: [0, 4],
                                },
                              },
                            ],
                            sx: {
                              minWidth: 560,
                              maxWidth: 720,
                            },
                          },
                            }}
                        renderOption={(props, option) => (
                          <Box
                            component="li"
                            {...props}
                            sx={{
                              display: 'grid !important',
                              gridTemplateColumns: '140px 1fr',
                              columnGap: 2,
                              alignItems: 'center',
                              fontSize: 12,
                              px: 1,
                              width: '100%',
                            }}
                          >
                            <Typography
                              component="span"
                              fontWeight={700}
                              sx={{
                                fontSize: 12,
                                color: '#111827',
                                textAlign: 'left',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {'kind' in option ? option.clave : option.clave || ''}
                            </Typography>
                            <Typography
                              component="span"
                              sx={{
                                fontSize: 12,
                                color: '#374151',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {'kind' in option ? option.descripcion : option.descripcion || ''}
                            </Typography>
                          </Box>
                        )}
                        renderInput={(params) => (
                          <TextField
                            {...(params as any)}
                            label="Producto"
                            size="small"
                            InputLabelProps={{ sx: { fontSize: 13 } }}
                            inputProps={{ ...params.inputProps, style: { fontSize: 13 } }}
                          />
                        )}
                        sx={{ minWidth: 0 }}
                      />

                      <TextField
                        label="Descripción"
                        value={partida.descripcion_alterna ?? ''}
                        onChange={(e) => handleDescripcionChange(index, e.target.value)}
                        size="small"
                        InputProps={{ sx: { fontSize: 13 } }}
                        inputProps={{ style: { fontSize: 13 } }}
                        sx={{ minWidth: 0 }}
                        disabled
                      />

                      <TextField
                        label="Cantidad"
                        type="number"
                        value={partida.cantidad ?? 0}
                        onChange={(e) => handleCantidadPrecioChange(index, 'cantidad', e.target.value)}
                        size="small"
                        inputProps={{ min: 0, step: 0.01, style: { textAlign: 'right', fontSize: 13 } }}
                        onFocus={() => {
                          requestAnimationFrame(() => {
                            cantidadRefs.current[index]?.select();
                          });
                        }}
                        inputRef={(el) => {
                          cantidadRefs.current[index] = el;
                        }}
                      />

                      <TextField
                        label="Precio"
                        type="text"
                        value={editingPrecio[index]
                          ? precioInputs[index] ?? ''
                          : formatter.format(partida.precio_unitario ?? 0)}
                        onChange={(e) => {
                          const raw = e.target.value ?? '';
                          setPrecioInputs((prev) => {
                            const next = [...prev];
                            next[index] = raw;
                            return next;
                          });
                          const numeric = parseFloat(raw.replace(/[^0-9.,-]/g, '').replace(',', '.'));
                          handleCantidadPrecioChange(index, 'precio_unitario', Number.isFinite(numeric) ? String(numeric) : '0');
                        }}
                        onFocus={(e) => {
                          setEditingPrecio((prev) => {
                            const next = [...prev];
                            next[index] = true;
                            return next;
                          });
                          setPrecioInputs((prev) => {
                            const next = [...prev];
                            next[index] = (partida.precio_unitario ?? '').toString();
                            return next;
                          });
                          requestAnimationFrame(() => {
                            precioRefs.current[index]?.select();
                          });
                        }}
                        onBlur={() => {
                          setEditingPrecio((prev) => {
                            const next = [...prev];
                            next[index] = false;
                            return next;
                          });
                          setPrecioInputs((prev) => {
                            const next = [...prev];
                            next[index] = '';
                            return next;
                          });
                        }}
                        size="small"
                        inputProps={{ style: { textAlign: 'right', fontSize: 13 } }}
                        inputRef={(el) => {
                          precioRefs.current[index] = el;
                        }}
                      />

                      <TextField
                        label="% Desc."
                        type="number"
                        value={partida.descuento ?? 0}
                        onChange={(e) => handleCantidadPrecioChange(index, 'descuento', e.target.value)}
                        size="small"
                        inputProps={{ min: 0, max: 100, step: 0.01, style: { textAlign: 'right', fontSize: 13 } }}
                      />

                      <Tooltip
                        arrow
                        placement="top"
                        title={(() => {
                          const breakdown = getPartidaDiscountBreakdown(partida, form.descuento_global ?? 0);
                          return (
                            <Box sx={{ py: 0.25 }}>
                              <Typography sx={{ fontSize: 12.5, fontWeight: 700, mb: 0.5 }}>
                                Desglose del subtotal
                              </Typography>
                              <Typography sx={{ fontSize: 12 }}>Precio bruto: {formatter.format(breakdown.precioBruto)}</Typography>
                              <Typography sx={{ fontSize: 12 }}>Desc. partida: -{formatter.format(breakdown.descuentoPartida)}</Typography>
                              <Typography sx={{ fontSize: 12 }}>Subtotal intermedio: {formatter.format(breakdown.subtotalIntermedio)}</Typography>
                              <Typography sx={{ fontSize: 12 }}>Desc. global: -{formatter.format(breakdown.descuentoGlobalMonto)}</Typography>
                              <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Subtotal final: {formatter.format(breakdown.subtotalFinal)}</Typography>
                            </Box>
                          );
                        })()}
                      >
                        <TextField
                          label="Subtotal"
                          value={formatter.format(partida.subtotal_partida ?? 0)}
                          InputProps={{ readOnly: true, sx: { fontSize: 13 }, style: { textAlign: 'right' } }}
                          size="small"
                        />
                      </Tooltip>

                      <TextField
                        label="IVA"
                        value={formatter.format(
                          (partida.impuestos ?? []).reduce((acc, imp: any) => {
                            const monto = Number(imp.monto ?? 0);
                            const esRetencion = (imp.tipo ?? '').toLowerCase() === 'retencion';
                            return acc + (esRetencion ? -monto : monto);
                          }, 0)
                        )}
                        InputProps={{ readOnly: true, sx: { fontSize: 13 }, style: { textAlign: 'right' } }}
                        size="small"
                      />

                      <TextField
                        label="Total"
                        value={formatter.format(partida.total_partida ?? 0)}
                        InputProps={{ readOnly: true, sx: { fontSize: 13 }, style: { textAlign: 'right' } }}
                        size="small"
                      />

                      {partidasMostrarEsParteOportunidad && (
                        <Box display="flex" justifyContent="center" alignItems="center" sx={{ minHeight: 40 }}>
                          <Tooltip title="Cuenta para oportunidad">
                            <Checkbox
                              checked={partida.es_parte_oportunidad !== false}
                              onChange={(event) => {
                                setPartidaAt(index, (prev) => ({
                                  ...prev,
                                  es_parte_oportunidad: event.target.checked,
                                }));
                              }}
                              inputProps={{ 'aria-label': 'Cuenta para oportunidad' }}
                            />
                          </Tooltip>
                        </Box>
                      )}

                      {partidasMostrarImagenes && (
                        <Box display="flex" justifyContent="center" alignItems="center" gap={0.5}>
                          <Tooltip
                            title={
                              partida.archivo_imagen_1
                                ? 'Imagen personalizada'
                                : partida.producto_archivo_id
                                  ? 'Imagen del producto'
                                  : 'Agregar imagen'
                            }
                          >
                            <span>
                              <IconButton
                                size="small"
                                aria-label="Imagen de partida"
                                onClick={() => abrirImagenDialog(index)}
                                disabled={Boolean(uploadingImagen[index])}
                                sx={{
                                  color: partida.archivo_imagen_1
                                    ? '#2e7d32'
                                    : partida.producto_archivo_id
                                      ? '#1565c0'
                                      : '#6b7280',
                                }}
                              >
                                {uploadingImagen[index] ? (
                                  <CircularProgress size={18} />
                                ) : (
                                  <PhotoCameraOutlinedIcon fontSize="small" />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                          {partida.archivo_imagen_1 && (
                            <Tooltip title="Eliminar imagen">
                              <span>
                                <IconButton
                                  size="small"
                                  aria-label="Eliminar imagen de partida"
                                  onClick={() => handleImagenRemove(index)}
                                  disabled={Boolean(uploadingImagen[index])}
                                  color="error"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                        </Box>
                      )}

                      <IconButton
                        onClick={() => toggleObservaciones(index)}
                        aria-label="Observaciones"
                        size="small"
                        color={(partida.observaciones?.trim() || expandedObs[index]) ? 'primary' : 'default'}
                      >
                        <CommentIcon fontSize="small" />
                      </IconButton>

                      <IconButton color="error" onClick={() => removeRow(index)} aria-label="Eliminar partida" size="small">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Paper>

                    {camposPartida.campos.length > 0 && (
                      <Box
                        sx={{
                          gridColumn: { xs: '1', md: '1 / -1' },
                          mt: 0.5,
                          '& .MuiInputBase-input': {
                            fontSize: 13,
                          },
                          '& .MuiInputBase-root': {
                            fontSize: 13,
                          },
                        }}
                      >
                        <Grid container spacing={1.5}>
                          {camposPartida.campos.map((campo) => {
                            const parentCatalogId = campo.campo_padre_id
                              ? valoresCamposPartidas[index]?.[campo.campo_padre_id]?.catalogo_id ?? null
                              : null;
                            const options = camposPartida.getOptions(campo.id, parentCatalogId ?? null);
                            const valorCampo = valoresCamposPartidas[index]?.[campo.id];
                            const disabled = campo.campo_padre_id ? !parentCatalogId : false;
                            return (
                              <Grid key={`${campo.id}-${index}`} size={{ xs: 12, md: 4 }}>
                                <DynamicFieldControl
                                  campo={campo}
                                  {...(valorCampo ? { value: valorCampo } : {})}
                                  options={options}
                                  loading={Boolean(camposPartida.optionsLoading[`${campo.id}::${parentCatalogId ?? 'root'}`])}
                                  disabled={disabled}
                                  onChange={(val: CampoValorPayload) => handleValorCampoPartidaChange(index, { ...val, campo_id: campo.id })}
                                />
                              </Grid>
                            );
                          })}
                        </Grid>
                      </Box>
                    )}

                    {(expandedObs[index] || Boolean(partida.observaciones?.trim())) && (
                      <Box sx={{ gridColumn: { xs: '1', md: '2 / -1' }, mt: { xs: 0.5, md: 0.25 } }}>
                        <TextField
                          label="Observaciones de la partida"
                          placeholder="Texto adicional para impresión"
                          value={partida.observaciones ?? ''}
                          onChange={(e) => handleObservacionesChange(index, e.target.value)}
                          fullWidth
                          multiline
                          minRows={2}
                          variant="outlined"
                          size="small"
                          InputProps={{ sx: { fontSize: 13 } }}
                        />
                      </Box>
                    )}
                  </React.Fragment>
                ))}
              </Stack>

              <Divider />

              <Box
                ref={resumenFinancieroRef}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    lg: 'repeat(6, minmax(0, 1fr))',
                  },
                  gap: 1,
                }}
              >
                {[
                  { label: 'Subtotal bruto', value: discountSummary.subtotalBruto, tone: '#334155' },
                  { label: 'Desc. partidas', value: -discountSummary.descuentoPartidas, tone: '#b45309' },
                  { label: 'Desc. global', value: -discountSummary.descuentoGlobal, tone: '#9a3412' },
                  { label: 'Subtotal neto', value: discountSummary.subtotalNeto, tone: '#1d4ed8' },
                  { label: 'IVA', value: discountSummary.iva, tone: '#0f766e' },
                  { label: 'Total', value: discountSummary.total, tone: '#111827' },
                ].map((item) => (
                  <Paper
                    key={item.label}
                    variant="outlined"
                    sx={{
                      px: 1.25,
                      py: 1,
                      borderRadius: 1.5,
                      borderColor: '#e5e7eb',
                      bgcolor: '#fbfdff',
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 0.35,
                    }}
                  >
                    <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontSize: 11.5 }}>
                      {item.label}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: item.tone,
                        fontWeight: 800,
                        fontSize: 14.5,
                        lineHeight: 1.1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {formatter.format(item.value)}
                    </Typography>
                  </Paper>
                ))}
              </Box>
              {partidasMostrarMontoOportunidad && (
                <Stack direction="row" justifyContent="flex-end">
                  <TextField
                    label="Monto oportunidad"
                    value={formatter.format(montoOportunidad)}
                    InputProps={{ readOnly: true, sx: { fontSize: 13, fontWeight: 700 }, style: { textAlign: 'right' } }}
                    size="small"
                    sx={{ width: { xs: '100%', sm: 190 } }}
                  />
                </Stack>
              )}
            </>
          )}
        </Paper>
      )}

      {mostrarResumenFinancieroSticky && (
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            left: { xs: 8, sm: '50%' },
            right: { xs: 8, sm: 'auto' },
            bottom: { xs: 8, sm: 16 },
            transform: { sm: 'translateX(-50%)' },
            width: { xs: 'auto', sm: 'min(720px, calc(100vw - 32px))' },
            maxWidth: 760,
            zIndex: 1200,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'rgba(148, 163, 184, 0.35)',
            bgcolor: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
            px: 1.5,
            py: 1,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ flexWrap: 'wrap' }}>
            {[
              { label: 'Bruto', value: discountSummary.subtotalBruto, tone: '#334155' },
              ...(discountSummary.descuentoPartidas + discountSummary.descuentoGlobal > 0
                ? [{ label: 'Desc', value: -(discountSummary.descuentoPartidas + discountSummary.descuentoGlobal), tone: '#9a3412' }]
                : []),
              { label: 'Neto', value: discountSummary.subtotalNeto, tone: '#1d4ed8' },
              { label: 'IVA', value: discountSummary.iva, tone: '#0f766e' },
              { label: 'Total', value: discountSummary.total, tone: '#111827', strong: true },
            ].map((item) => (
              <Box
                key={item.label}
                sx={{
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.15,
                  px: 0.5,
                }}
              >
                <Typography variant="caption" sx={{ color: '#64748b', fontSize: 10.5, lineHeight: 1.1 }}>
                  {item.label}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: item.tone,
                    fontWeight: item.strong ? 800 : 700,
                    fontSize: item.strong ? 15 : 13.5,
                    lineHeight: 1.05,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatter.format(item.value)}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      {showFiscalTab && activeTab === 1 && (
        <Paper variant="outlined" sx={{ borderRadius: 2, p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <DocumentoDatosFiscalesTab
            values={fiscalValues}
            onChange={(changes) => setForm((prev) => ({ ...prev, ...changes }))}
            disabled={saving || loading}
          />
        </Paper>
      )}

      <Dialog open={duplicateDialog.open} onClose={() => setDuplicateDialog({ open: false, message: '' })}>
        <DialogTitle fontWeight={700}>Documento duplicado</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#374151' }}>
            Ya existe un documento con la misma serie y número. Por favor verifique el consecutivo antes de continuar.
            {duplicateDialog.message && (
              <>
                <br />
                <br />
                <strong>Detalle:</strong> {duplicateDialog.message}
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={() => setDuplicateDialog({ open: false, message: '' })}>
            Entendido
          </Button>
        </DialogActions>
      </Dialog>

      <ContactCaptureDialog
        open={crearClienteOpen}
        loading={crearClienteLoading}
        nombre={crearClienteNombre}
        tipoContacto={crearClienteTipo}
        tiposPermitidos={contactoTiposPermitidos}
        captureMode={contactoCaptureMode}
        detailedFields={crearClienteDetailedFields}
        title="Crear cliente"
        infoMessage="Se asignará al documento con el tipo seleccionado."
        onNombreChange={setCrearClienteNombre}
        onTipoContactoChange={setCrearClienteTipo}
        onDetailedFieldChange={(field, value) => {
          setCrearClienteDetailedFields((prev) => ({ ...prev, [field]: value }));
        }}
        onClose={() => {
          if (!crearClienteLoading) {
            setCrearClienteOpen(false);
            setCrearClienteNombre('');
            setCrearClienteTipo(contactoDefaultTipoContacto);
            setCrearClienteDetailedFields(emptyContactCaptureDetailedFields());
          }
        }}
        onSubmit={() => void handleCrearClienteSubmit()}
      />

      <ProductoCaptureDialog
        open={crearProductoOpen}
        loading={crearProductoLoading}
        clave={crearProductoClave}
        claveError={crearProductoClaveError}
        descripcion={crearProductoDescripcion}
        tipoProducto={crearProductoTipo}
        tiposPermitidos={productoTiposPermitidos}
        captureMode={productoCaptureMode}
        title="Crear producto rapido"
        onClaveChange={(value) => {
          setCrearProductoClave(value);
          if (crearProductoClaveError) {
            setCrearProductoClaveError(null);
          }
        }}
        onDescripcionChange={setCrearProductoDescripcion}
        onTipoProductoChange={setCrearProductoTipo}
        onClose={() => {
          if (!crearProductoLoading) {
            setCrearProductoOpen(false);
            setCrearProductoClave('');
            setCrearProductoDescripcion('');
            setCrearProductoTipo(productoDefaultTipoProducto);
            setCrearProductoIndex(null);
            setCrearProductoClaveError(null);
          }
        }}
        onSubmit={() => void handleCrearProductoSubmit()}
      />

      <Dialog open={partidaImagenDialog.open} onClose={cerrarImagenDialog} fullWidth maxWidth="sm">
        <DialogTitle fontWeight={700}>Imagen de la partida</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1.5 }}>
          <input
            ref={partidaImagenInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              if (partidaImagenDialog.index === null) return;
              void handleImagenChange(partidaImagenDialog.index, e.target.files);
            }}
            style={{ display: 'none' }}
          />

          {partidaImagenPreviewUrl && (
            <Box
              sx={{
                border: '1px solid #e5e7eb',
                borderRadius: 1.5,
                p: 1,
                bgcolor: '#fafafa',
              }}
            >
              <Box
                component="img"
                src={partidaImagenPreviewUrl}
                alt="Vista previa de la partida"
                sx={{ width: '100%', maxHeight: 260, objectFit: 'contain', display: 'block' }}
              />
            </Box>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="outlined" color="inherit" onClick={handleImagenSinSeleccion} fullWidth>
              Sin imagen
            </Button>
            <Button variant="outlined" onClick={handleImagenCustomClick} fullWidth>
              Subir imagen personalizada
            </Button>
            <Button
              variant="contained"
              onClick={() => setPartidaImagenDialog((prev) => ({ ...prev, view: 'producto' }))}
              disabled={!partidaImagenProductoId}
              fullWidth
            >
              Elegir imagen del producto
            </Button>
          </Stack>

          {partidaImagenDialog.view === 'producto' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Typography variant="subtitle2" fontWeight={700} color="#1d2f68">
                  Imágenes del producto
                </Typography>
                <Button size="small" onClick={() => setPartidaImagenDialog((prev) => ({ ...prev, view: 'menu' }))}>
                  Volver
                </Button>
              </Stack>

              {!partidaImagenProductoId && <Alert severity="info">Selecciona un producto en la partida antes de elegir una imagen.</Alert>}

              {partidaImagenProductoId && partidaImagenesProductoLoadingId === partidaImagenProductoId && (
                <Box display="flex" justifyContent="center" py={2}>
                  <CircularProgress size={24} />
                </Box>
              )}

              {partidaImagenProductoId && partidaImagenesProductoError && (
                <Alert severity="warning">{partidaImagenesProductoError}</Alert>
              )}

              {partidaImagenProductoId && !partidaImagenesProductoLoadingId && !partidaImagenesProductoError && (
                <>
                  {partidaImagenesProducto.length === 0 ? (
                    <Alert severity="info">Este producto no tiene imágenes registradas.</Alert>
                  ) : (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                        gap: 1,
                      }}
                    >
                      {partidaImagenesProducto.map((archivo) => {
                        const selected = archivo.id === partidaImagenActual?.producto_archivo_id;
                        return (
                          <ButtonBase
                            key={archivo.id}
                            onClick={() => handleImagenProductoSelect(archivo)}
                            sx={{
                              position: 'relative',
                              borderRadius: 1.5,
                              overflow: 'hidden',
                              border: selected ? '2px solid #1565c0' : '1px solid #e5e7eb',
                              bgcolor: '#fafafa',
                              aspectRatio: '1 / 1',
                            }}
                          >
                            <Box
                              component="img"
                              src={buildAssetUrl(archivo.archivo)}
                              alt={archivo.descripcion || `Imagen ${archivo.id}`}
                              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </ButtonBase>
                        );
                      })}
                    </Box>
                  )}
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={cerrarImagenDialog}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {widgetPagosDrawer && isEdit && documentoActualId && form.contacto_principal_id ? (
        <FacturaPagosDrawer
          open={openPagos}
          onClose={handleClosePagosDrawer}
          documentoId={Number(documentoActualId)}
          contactoId={Number(form.contacto_principal_id)}
          saldo={saldoDocumento}
        />
      ) : null}

      {anticipoConfig && documentoActualId ? (
        <OperacionDialog
          open={openAnticipoDialog}
          cuentas={cuentasFinancieras}
          defaultCuentaId={cuentasFinancieras[0]?.id ?? null}
          operacion={null}
          title={anticipoConfig.dialogTitle}
          saveLabel={anticipoConfig.accionLabel}
          presetPayload={{
            fecha: normalizeCivilDate(form.fecha_documento) || defaultFecha(),
            tipo_movimiento: anticipoConfig.tipo_movimiento,
            naturaleza_operacion: anticipoConfig.naturaleza_operacion,
            contacto_id: form.contacto_principal_id,
            documento_origen_id: Number(documentoActualId),
          }}
          lockedFields={{
            tipo_movimiento: true,
            naturaleza_operacion: true,
            contacto_id: true,
          }}
          onClose={handleCloseAnticipoDialog}
          onSaved={handleSavedAnticipo}
        />
      ) : null}
    </Box>
  );
}
