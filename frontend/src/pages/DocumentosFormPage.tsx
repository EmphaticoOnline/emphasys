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
  Collapse,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  IconButton,
  InputAdornment,
  Menu,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useMediaQuery,
  useTheme,
} from '@mui/material';

import Grid from '@mui/material/Grid';
import { createFilterOptions } from '@mui/material/Autocomplete';

import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CommentIcon from '@mui/icons-material/ModeCommentOutlined';
import PrintIcon from '@mui/icons-material/Print';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import { resolveDocumentoFormPath, resolveDocumentoModulo, resolveDocumentosListPath } from '../modules/documentos/documentoNavigation';
import DynamicFieldControl from '../components/DynamicFieldControl';
import MobileBackIconButton from '../components/MobileBackIconButton';
import MobileSaveFab from '../components/MobileSaveFab';
import ContactCaptureDialog, { type ContactCaptureDetailedFields } from '../components/contactos/ContactCaptureDialog';
import ProductoCaptureDialog from '../components/productos/ProductoCaptureDialog';
import { useCamposDinamicos } from '../hooks/useCamposDinamicos';

import type {
  CotizacionDetalle,
  CotizacionListado,
  CotizacionPartidaPayload,
  CotizacionCrearPayload,
  CotizacionPartida,
  ImpuestoPartida,
  TratamientoImpuestos,
} from '../types/cotizacion';
import type { TipoDocumento } from '../types/documentos.types';
import { getDocumento, getDocumentos, createDocumento, updateDocumento, replacePartidas, abrirDocumentoPdfEnNuevaVentana } from '../services/documentosService';
import { fetchConceptos } from '../services/conceptosService';
import {
  generarDocumentoDesdeOrigen,
  prepararGeneracionMultiple,
  type PrepararGeneracionResponse,
} from '../services/documentGenerationService';
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
import { fetchCuentas, fetchEstadoCuenta, fetchResumenAnticiposDocumento, fetchSaldoDocumento } from '../services/finanzasService';
import { buildAssetUrl } from '../services/empresasAssetsService';
import { resolvePrecioDocumento } from '../services/preciosService';
import { normalizarTelefonoMx } from '../utils/telefono';
import { formatearFolioDocumento } from '../utils/documentos.utils';
import { crearConcepto } from '../services/conceptosService';
import {
  guardarCamposDocumento,
  guardarCamposPartida,
  fetchCamposDocumento,
  fetchCamposPartida,
} from '../services/camposDinamicosService';
import type { CampoValorPayload, CampoValorGuardado } from '../types/camposDinamicos';
import type { Concepto, DocumentoAnticipoResumen, EstadoCuentaItem, FinanzasCuenta } from '../types/finanzas';
import { NumericFormat } from 'react-number-format';

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

type FinancialSummary = {
  subtotalBruto: number;
  descuentoPartidas: number;
  descuentoGlobal: number;
  subtotalNeto: number;
  iva: number;
  total: number;
};

const EMPTY_FINANCIAL_SUMMARY: FinancialSummary = {
  subtotalBruto: 0,
  descuentoPartidas: 0,
  descuentoGlobal: 0,
  subtotalNeto: 0,
  iva: 0,
  total: 0,
};

const compactEditableInputFontSize = { xs: 16, md: 13 } as const;

const campoEncabezadoSx = {
  '& .MuiOutlinedInput-root': {
    display: 'flex',
    alignItems: 'center',
  },
  '& .MuiInputBase-input': {
    fontSize: compactEditableInputFontSize,
    fontWeight: 400,
    lineHeight: 1.4375,
    py: '8.5px',
  },
  '& .MuiAutocomplete-input': {
    fontSize: compactEditableInputFontSize,
    fontWeight: 400,
    lineHeight: 1.4375,
  },
  '& .MuiSelect-select': {
    fontSize: compactEditableInputFontSize,
    fontWeight: 400,
    lineHeight: 1.4375,
    display: 'flex',
    alignItems: 'center',
  },
} as const;

const compactTableCellSx = {
  py: 1,
  px: 1.5,
  fontSize: 13,
} as const;

const getCuentaFinancieraDisplayLabel = (cuenta: FinanzasCuenta) => {
  const raw = String(cuenta.identificador ?? '').trim();
  const sanitized = raw
    .replace(/\b(clabe|clave|cuenta|cta\.?|numero|num\.?)(\s|:|-)*\d[\d\s-]*/gi, '')
    .replace(/(^|\s|-|\/)(\d[\d\s-]{3,})(?=$|\s|-|\/)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s\-/:,]+$/g, '')
    .trim();

  return sanitized || raw || `Cuenta ${cuenta.id}`;
};

const TRATAMIENTO_OPCIONES: { label: string; value: TratamientoImpuestos }[] = [
  { label: 'Operación estándar', value: 'normal' },
  { label: 'Nota de venta', value: 'sin_iva' },
  { label: 'Operación tasa cero', value: 'tasa_cero' },
  { label: 'Operación exenta', value: 'exento' },
];

const TIPOS_DOCUMENTO_CON_TRATAMIENTO_FISCAL = new Set<TipoDocumento>([
  'factura',
  'nota_credito',
  'nota_credito_compra',
  'cotizacion',
  'pedido',
  'orden_servicio',
  'remision',
  'orden_entrega',
]);

const emptyPartida = (): PartidaForm => ({
  producto_id: null,
  descripcion_alterna: '',
  cantidad: 1,
  precio_unitario: 0,
  precio_lista_id: null,
  precio_editado_manual: false,
  precio_origen: null,
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
  embedded?: boolean;
  initialValues?: Partial<CotizacionCrearPayload>;
  lockedFields?: Partial<Record<'contacto_principal_id' | 'fecha_documento' | 'moneda', boolean>>;
  onEmbeddedClose?: () => void;
  onEmbeddedSaved?: (documentoId: number) => void;
};

const DESCRIPCIONES_FORMULARIO: Record<string, string> = {
  cotizacion: 'Captura el encabezado y las partidas de la cotización.',
  factura: 'Captura el encabezado y las partidas de la factura.',
  nota_credito: 'Captura una nota de crédito comercial o por devolución.',
  orden_servicio: 'Registra los artículos recibidos y los servicios solicitados',
  pedido: 'Captura el encabezado y las partidas del pedido.',
  remision: 'Captura el encabezado y las partidas de la remisión.',
  nota_credito_compra: 'Captura una nota de crédito de compra o devolución a proveedor.',
  pago_cliente: 'Captura un documento monetario simple de pago recibido.',
  pago_proveedor: 'Captura un documento monetario simple de pago a proveedor.',
};

const TIPOS_DOCUMENTO_CON_SALDO = ['factura', 'factura_compra', 'nota_credito', 'nota_credito_compra', 'pago_cliente', 'pago_proveedor'];
const MOTIVOS_NOTA_CREDITO = ['devolucion', 'bonificacion', 'otro'] as const;
type MotivoNotaCredito = typeof MOTIVOS_NOTA_CREDITO[number];

const esPartidaPlaceholder = (partida: PartidaForm) => {
  const impuestos = partida.impuestos_calculados ?? partida.impuestos ?? [];
  const sinProductoNiDescripcion = !partida.producto_id && !String(partida.descripcion_alterna ?? '').trim();
  const sinMontos = Number(partida.precio_unitario ?? 0) <= 0
    && Number(partida.subtotal_partida ?? 0) <= 0
    && Number(partida.total_partida ?? 0) <= 0
    && Number(partida.descuento ?? 0) <= 0;

  if (sinProductoNiDescripcion && sinMontos && !String(partida.observaciones ?? '').trim() && impuestos.length === 0) {
    return true;
  }

  return false;
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

type ConceptoAutocompleteOption = Concepto | {
  kind: 'create';
  id: -1;
  nombre_concepto: string;
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

const buildCreateConceptoOption = (inputValue: string): ConceptoAutocompleteOption => ({
  kind: 'create',
  id: -1,
  nombre_concepto: inputValue ? `+ Nuevo concepto "${inputValue}"` : '+ Nuevo concepto',
  inputValue,
});

const filterContactoOptions = createFilterOptions<ContactoAutocompleteOption>({
  stringify: (option) => ('kind' in option && option.kind === 'create' ? option.inputValue : option.nombre || ''),
});

const filterConceptoOptions = createFilterOptions<ConceptoAutocompleteOption>({
  stringify: (option) => ('kind' in option && option.kind === 'create' ? option.inputValue : option.nombre_concepto || ''),
});

export default function DocumentosFormPage({
  tipoDocumento: propTipo,
  embedded = false,
  initialValues,
  lockedFields,
  onEmbeddedClose,
  onEmbeddedSaved,
}: DocumentosFormPageProps) {
  const { id, codigo } = useParams();
  const { session } = useSession();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
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
    esDocumentoMonetario,
    requiereCuentaFinanciera,
    usaPartidas,
    partidasMostrarImagenes,
    partidasMostrarEsParteOportunidad,
    partidasMostrarMontoOportunidad,
  } = useDocumentoConfig(tipoDocumento);
  const navigate = useNavigate();
  const location = useLocation();
  const moduloDocumento = resolveDocumentoModulo(location.pathname);
  const documentoActualId = documentoPersistidoId ?? routeDocumentoId;
  const isCotizacion = tipoDocumento === 'cotizacion';
  const isNotaCredito = tipoDocumento === 'nota_credito' || tipoDocumento === 'nota_credito_compra';
  const isEdit = Boolean(documentoActualId);
  const basePath = resolveDocumentosListPath(tipoDocumento, moduloDocumento);
  const showFiscalTab = widgetFiscalTab;
  const isPaymentDocument = tipoDocumento === 'pago_cliente' || tipoDocumento === 'pago_proveedor';
  const useMobilePaymentApplicationCards = isMobile && isPaymentDocument;
  const textos = useMemo(
    () => ({
      ...resolveDocumentoTextos(tipoDocumento, documentoConfig),
      descripcion: DESCRIPCIONES_FORMULARIO[tipoDocumento] ?? 'Crea o edita documentos.',
    }),
    [documentoConfig, tipoDocumento]
  );
  const lockedContacto = Boolean(lockedFields?.contacto_principal_id);
  const lockedFechaDocumento = Boolean(lockedFields?.fecha_documento);
  const lockedMoneda = Boolean(lockedFields?.moneda);

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
    motivo_nc: isNotaCredito ? 'otro' : null,
    concepto_id: null,
    serie: defaultSerie,
    contacto_principal_id: null,
    agente_id: null,
    fecha_documento: defaultFecha(),
    moneda: 'MXN',
    tipo_cambio: 1,
    cuenta_financiera_id: null,
    finanzas_operacion_id: null,
    observaciones: '',
    subtotal: 0,
    descuento_global: 0,
    iva: 0,
    total: 0,
    usuario_creacion_id: sessionUserId ?? null,
    empresa_id: getEmpresaActivaId(),
    estado_seguimiento: (defaultEstadoSeguimiento ?? null) as NonNullable<CotizacionCrearPayload['estado_seguimiento']> | null,
    tratamiento_impuestos: 'sin_iva',
    rfc_receptor: '',
    nombre_receptor: '',
    regimen_fiscal_receptor: '',
    uso_cfdi: '',
    forma_pago: '',
    metodo_pago: '',
    codigo_postal_receptor: '',
    ...initialValues,
  });

  const syncDocumentoMonetarioTotals = useCallback((value: string | number | null | undefined) => {
    const amount = typeof value === 'number'
      ? Math.max(0, value || 0)
      : Math.max(0, Number(String(value ?? '').replace(/,/g, '')) || 0);
    setForm((prev) => ({
      ...prev,
      subtotal: amount,
      descuento_global: 0,
      descuento: 0,
      iva: 0,
      total: amount,
    }));
  }, []);

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
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [vendedores, setVendedores] = useState<Contacto[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [documentosOrigenDisponibles, setDocumentosOrigenDisponibles] = useState<CotizacionListado[]>([]);
  const [documentosOrigenSeleccionados, setDocumentosOrigenSeleccionados] = useState<CotizacionListado[]>([]);
  const [preparacionNotaCredito, setPreparacionNotaCredito] = useState<PrepararGeneracionResponse | null>(null);
  const [valoresEspecialesNotaCredito, setValoresEspecialesNotaCredito] = useState<Record<number, number>>({});
  const [loadingPreparacionNotaCredito, setLoadingPreparacionNotaCredito] = useState(false);
  const [resumenNotaCreditoEspecial, setResumenNotaCreditoEspecial] = useState<FinancialSummary>(EMPTY_FINANCIAL_SUMMARY);
  const [detallePartidasNotaCreditoEspecial, setDetallePartidasNotaCreditoEspecial] = useState<Record<number, { subtotal: number; iva: number; total: number }>>({});
  const [lineasSeleccionadasNotaCreditoEspecial, setLineasSeleccionadasNotaCreditoEspecial] = useState<Record<number, boolean>>({});
  const [busquedaNotaCreditoEspecial, setBusquedaNotaCreditoEspecial] = useState('');
  const [bonificacionInputDisplay, setBonificacionInputDisplay] = useState<Record<number, string>>({});
  const [bonificacionInputFocusedId, setBonificacionInputFocusedId] = useState<number | null>(null);
  const [capturasEspecialesDocumentoActual, setCapturasEspecialesDocumentoActual] = useState<Record<number, {
    documentoOrigenId: number;
    cantidadVinculada: number;
    montoCapturado: number;
    valor: number;
  }>>({});
  const [loading, setLoading] = useState<boolean>(isEdit);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [openPagos, setOpenPagos] = useState(false);
  const [openAnticipoDialog, setOpenAnticipoDialog] = useState(false);
  const [saldoDocumento, setSaldoDocumento] = useState<number>(0);
  const [anticiposResumen, setAnticiposResumen] = useState<DocumentoAnticipoResumen | null>(null);
  const [cuentasFinancieras, setCuentasFinancieras] = useState<FinanzasCuenta[]>([]);
  const [loadingAnticiposResumen, setLoadingAnticiposResumen] = useState(false);
  const [documentosCargoMonetarios, setDocumentosCargoMonetarios] = useState<EstadoCuentaItem[]>([]);
  const [loadingDocumentosCargoMonetarios, setLoadingDocumentosCargoMonetarios] = useState(false);
  const [montosAplicacionMonetaria, setMontosAplicacionMonetaria] = useState<Record<number, string>>({});
  const [autoApplyingDocumentoMonetario, setAutoApplyingDocumentoMonetario] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );
  const [duplicateDialog, setDuplicateDialog] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [conceptoObligatorioDialog, setConceptoObligatorioDialog] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
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
  const [crearConceptoOpen, setCrearConceptoOpen] = useState(false);
  const [crearConceptoNombre, setCrearConceptoNombre] = useState('');
  const [crearConceptoLoading, setCrearConceptoLoading] = useState(false);
  const [crearConceptoError, setCrearConceptoError] = useState<string | null>(null);
  const [notaCreditoManualTotalInput, setNotaCreditoManualTotalInput] = useState('');
  const [notaCreditoManualTotalFocused, setNotaCreditoManualTotalFocused] = useState(false);
  const [mobileActionsAnchorEl, setMobileActionsAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileExpandedPartidas, setMobileExpandedPartidas] = useState<boolean[]>([false]);
  const [mobileTotalsExpanded, setMobileTotalsExpanded] = useState(false);
  const [mobilePartidaMenuAnchorEl, setMobilePartidaMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [mobilePartidaMenuIndex, setMobilePartidaMenuIndex] = useState<number | null>(null);
  const conceptoAutoSyncRef = useRef<string | null>(null);
  const conceptoManualOverrideRef = useRef(false);

  const shouldOpenPagos = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('abrirPagos') === '1';
  }, [location.search]);
  const anticipoConfig = useMemo(() => getDocumentoOrigenFinancieroConfig(tipoDocumento), [tipoDocumento]);
  const totalAnticipadoRegistrado = Number(anticiposResumen?.total_anticipado ?? 0);
  const hasAnticiposRegistrados = Number(anticiposResumen?.cantidad_operaciones ?? 0) > 0 || totalAnticipadoRegistrado > 0;
  const tienePartidaValida = useMemo(
    () => !usaPartidas || partidas.some((partida) => Number(partida.cantidad ?? 0) > 0 && Number(partida.precio_unitario ?? 0) > 0),
    [partidas, usaPartidas]
  );
  const motivoNotaCredito = (form.motivo_nc ?? 'otro') as MotivoNotaCredito;
  const isNotaCreditoManual = isNotaCredito && motivoNotaCredito === 'otro';
  const isNotaCreditoDevolucion = isNotaCredito && motivoNotaCredito === 'devolucion';
  const isNotaCreditoBonificacion = isNotaCredito && motivoNotaCredito === 'bonificacion';
  const usaCapturaEspecialNotaCredito = isNotaCreditoManual || isNotaCreditoDevolucion || isNotaCreditoBonificacion;
  const usaGeneracionEspecialNotaCredito = isNotaCreditoDevolucion || isNotaCreditoBonificacion;
  const permiteCapturaManualSinPartidas = isNotaCredito && !partidas.some((partida) => !esPartidaPlaceholder(partida));
  const contactoLabel = tipoDocumento === 'nota_credito_compra' ? 'Proveedor' : 'Cliente';
  const tipoDocumentoOrigenNotaCredito = tipoDocumento === 'nota_credito_compra' ? 'factura_compra' : 'factura';
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

  const partidasNotaCreditoDisponibles = useMemo(
    () => (preparacionNotaCredito?.partidas ?? []).map((partida) => {
      const capturaActual = capturasEspecialesDocumentoActual[partida.partida_id];
      if (!capturaActual) return partida;

      return {
        ...partida,
        cantidad_ya_generada: Math.max(0, Number(partida.cantidad_ya_generada ?? 0) - Number(capturaActual.cantidadVinculada ?? 0)),
        cantidad_pendiente_sugerida: Number((Number(partida.cantidad_pendiente_sugerida ?? 0) + Number(capturaActual.cantidadVinculada ?? 0)).toFixed(6)),
        importe_maximo_sugerido: Number((Number(partida.importe_maximo_sugerido ?? 0) + Number(capturaActual.montoCapturado ?? 0)).toFixed(2)),
      };
    }).filter((partida) => {
      const disponible = isNotaCreditoDevolucion
        ? Number(partida.cantidad_pendiente_sugerida ?? 0)
        : Number(partida.importe_maximo_sugerido ?? 0);
      return disponible > 0.000001;
    }),
    [capturasEspecialesDocumentoActual, isNotaCreditoDevolucion, preparacionNotaCredito]
  );

  const getMontoEspecialNotaCredito = useCallback((partida: PrepararGeneracionResponse['partidas'][number]) => {
    const capturado = Math.max(0, Number(valoresEspecialesNotaCredito[partida.partida_id] ?? 0));
    if (capturado <= 0) return 0;

    if (isNotaCreditoDevolucion) {
      const cantidadDisponible = Math.max(0, Number(partida.cantidad_pendiente_sugerida ?? 0));
      const importeDisponible = Math.max(0, Number(partida.importe_maximo_sugerido ?? 0));
      if (cantidadDisponible <= 0 || importeDisponible <= 0) return 0;
      const proporcion = Math.min(capturado, cantidadDisponible) / cantidadDisponible;
      return Number((importeDisponible * proporcion).toFixed(2));
    }

    return Number(Math.min(capturado, Math.max(0, Number(partida.importe_maximo_sugerido ?? 0))).toFixed(2));
  }, [isNotaCreditoDevolucion, valoresEspecialesNotaCredito]);

  const documentosOrigenPorId = useMemo(
    () => Object.fromEntries(documentosOrigenDisponibles.map((doc) => [doc.id, doc])),
    [documentosOrigenDisponibles]
  );

  const documentosOrigenCliente = useMemo(
    () => documentosOrigenDisponibles.filter((doc) => Number(doc.contacto_principal_id ?? 0) === Number(form.contacto_principal_id ?? 0)),
    [documentosOrigenDisponibles, form.contacto_principal_id]
  );

  const partidasNotaCreditoVisibles = useMemo(() => {
    const termino = busquedaNotaCreditoEspecial.trim().toLowerCase();
    if (!termino) return partidasNotaCreditoDisponibles;

    return partidasNotaCreditoDisponibles.filter((partida) => {
      const documentoOrigen = documentosOrigenPorId[partida.documento_origen_id];
      const folio = formatearFolioDocumento(documentoOrigen?.serie ?? '', Number(documentoOrigen?.numero ?? 0))
        || partida.documento_origen_folio
        || String(partida.documento_origen_id);
      const producto = partida.producto_id ? (productos.find((item) => item.id === partida.producto_id)?.descripcion ?? '') : '';
      const descripcion = partida.descripcion ?? '';
      const searchable = `${folio} ${producto} ${descripcion}`.toLowerCase();
      return searchable.includes(termino);
    });
  }, [busquedaNotaCreditoEspecial, documentosOrigenPorId, partidasNotaCreditoDisponibles, productos]);

  const isPartidaNotaCreditoEspecialSeleccionada = useCallback((partidaId: number) => {
    const cantidad = Number(valoresEspecialesNotaCredito[partidaId] ?? 0);
    return Boolean(lineasSeleccionadasNotaCreditoEspecial[partidaId]) || cantidad > 0;
  }, [lineasSeleccionadasNotaCreditoEspecial, valoresEspecialesNotaCredito]);

  const getMaximoCapturableNotaCredito = useCallback((partida: PrepararGeneracionResponse['partidas'][number]) => (
    isNotaCreditoDevolucion
      ? Number(partida.cantidad_pendiente_sugerida ?? 0)
      : Number(partida.importe_maximo_sugerido ?? 0)
  ), [isNotaCreditoDevolucion]);

  const camposDocumento = useCamposDinamicos({ entidadTipoCodigo: ENTIDAD_TIPO_DOCUMENTO, tipoDocumento });
  const camposPartida = useCamposDinamicos({ entidadTipoCodigo: ENTIDAD_TIPO_PARTIDA, tipoDocumento });
  const [valoresCamposDocumento, setValoresCamposDocumento] = useState<Record<number, CampoValorPayload>>({});
  const [valoresCamposPartidas, setValoresCamposPartidas] = useState<Record<number, CampoValorPayload>[]>([{}]);

  const precioRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cantidadRefs = useRef<(HTMLInputElement | null)[]>([]);
  const partidaImagenInputRef = useRef<HTMLInputElement | null>(null);
  const prevContactoRef = useRef<number | null | undefined>(undefined);
  const prevPrecioResolverContactoRef = useRef<number | null | undefined>(undefined);
  const skipFiscalFetchRef = useRef<boolean>(false);
  const previewTimersRef = useRef<Record<number, ReturnType<typeof setTimeout> | null>>({});
  const previewSeqRef = useRef<Record<number, number>>({});
  const previewGlobalSeqRef = useRef<number>(0);
  const resumenNotaCreditoEspecialSeqRef = useRef<number>(0);
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

  const tiposDocumentoCargoMonetario = useMemo(
    () => (moduloDocumento === 'compras' ? ['factura_compra'] : ['factura']),
    [moduloDocumento]
  );

  const sanitizeCurrencyInput = useCallback((rawValue: string) => {
    const normalized = String(rawValue ?? '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
    if (!normalized) return '';

    const parts = normalized.split('.');
    const integerPart = (parts[0] ?? '').replace(/^0+(?=\d)/, '');
    const decimalDigits = parts.slice(1).join('').slice(0, 2);
    const hasDecimalPoint = normalized.includes('.');

    if (hasDecimalPoint) {
      if (normalized.endsWith('.') && decimalDigits.length === 0) {
        return `${integerPart || '0'}.`;
      }
      return `${integerPart || '0'}.${decimalDigits}`;
    }

    return integerPart || '0';
  }, []);

  const totalAplicacionMonetariaCapturado = useMemo(
    () => Object.values(montosAplicacionMonetaria).reduce((acc, value) => acc + (Number(value) || 0), 0),
    [montosAplicacionMonetaria]
  );

  const saldoDisponibleDocumentoMonetario = useMemo(
    () => Math.max(0, Number(documentoActualId ? saldoDocumento : form.total || 0) - totalAplicacionMonetariaCapturado),
    [documentoActualId, form.total, saldoDocumento, totalAplicacionMonetariaCapturado]
  );

  const decimalFormatter = useMemo(
    () => new Intl.NumberFormat('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    []
  );

  const sanitizeMontoBonificacionInput = useCallback((rawValue: string) => {
    const normalized = String(rawValue ?? '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
    if (!normalized) return '';

    const parts = normalized.split('.');
    const integerPart = (parts[0] ?? '').replace(/^0+(?=\d)/, '');
    const decimalDigits = parts.slice(1).join('').slice(0, 2);
    const hasDecimalPoint = normalized.includes('.');

    if (hasDecimalPoint) {
      if (normalized.endsWith('.') && decimalDigits.length === 0) {
        return `${integerPart || '0'}.`;
      }
      return `${integerPart || '0'}.${decimalDigits}`;
    }

    return integerPart || '0';
  }, []);

  const parseMontoBonificacionInput = useCallback((rawValue: string) => {
    const sanitized = sanitizeMontoBonificacionInput(rawValue);
    if (!sanitized || sanitized === '.') return 0;
    return Math.max(0, Number(sanitized) || 0);
  }, [sanitizeMontoBonificacionInput]);

  const formatMontoBonificacionInput = useCallback((value: number) => decimalFormatter.format(Number(value ?? 0)), [decimalFormatter]);

  const sanitizeMontoMonetarioInput = useCallback((rawValue: string) => {
    const cleaned = String(rawValue ?? '').replace(/[^0-9.]/g, '');
    if (!cleaned) return '';

    const parts = cleaned.split('.');
    const integerPart = (parts[0] ?? '').replace(/^0+(?=\d)/, '');
    const decimalDigits = parts.slice(1).join('').slice(0, 2);
    const hasDecimalPoint = cleaned.includes('.');

    if (hasDecimalPoint) {
      if (cleaned.endsWith('.') && decimalDigits.length === 0) {
        return `${integerPart || '0'}.`;
      }
      return `${integerPart || '0'}.${decimalDigits}`;
    }

    return integerPart || '0';
  }, []);

  const parseMontoMonetarioInput = useCallback((rawValue: string) => {
    const sanitized = sanitizeMontoMonetarioInput(rawValue);
    if (!sanitized || sanitized === '.') return 0;
    return Math.max(0, Number(sanitized) || 0);
  }, [sanitizeMontoMonetarioInput]);

  const formatMontoMonetarioInput = useCallback((value: number) => decimalFormatter.format(Number(value ?? 0)), [decimalFormatter]);
  const normalizarNombreConcepto = useCallback((value: string) => value.trim().toLowerCase(), []);

  const nombreConceptoAutoNotaCredito = useMemo(() => {
    if (!isNotaCreditoDevolucion && !isNotaCreditoBonificacion) return null;

    const contexto = tipoDocumento === 'nota_credito_compra' ? 'compra' : 'venta';
    return isNotaCreditoDevolucion
      ? `Devolución de ${contexto}`
      : `Bonificación sobre ${contexto}`;
  }, [isNotaCreditoBonificacion, isNotaCreditoDevolucion, tipoDocumento]);

  const conceptosActivos = useMemo(() => conceptos.filter((concepto) => concepto.activo), [conceptos]);

  const limpiarCrearConceptoDialog = useCallback(() => {
    setCrearConceptoOpen(false);
    setCrearConceptoNombre('');
    setCrearConceptoLoading(false);
    setCrearConceptoError(null);
  }, []);

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
    if (!usaPartidas) {
      return;
    }
    if (isNotaCredito && !partidasList.some((partida) => !esPartidaPlaceholder(partida))) {
      setForm((prev) => {
        const subtotal = Number(prev.subtotal ?? 0);
        const iva = Number(prev.iva ?? 0);
        return {
          ...prev,
          descuento: 0,
          total: Number((subtotal + iva).toFixed(2)),
        };
      });
      return;
    }

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
    if (!usaPartidas) {
      const subtotal = Number(form.subtotal ?? 0);
      const iva = Number(form.iva ?? 0);
      const total = Number(form.total ?? (subtotal + iva));
      return {
        subtotalBruto: subtotal,
        descuentoPartidas: 0,
        descuentoGlobal: 0,
        subtotalNeto: subtotal,
        iva,
        total,
      };
    }
    if (isNotaCredito && !partidas.some((partida) => !esPartidaPlaceholder(partida))) {
      const subtotal = Number(form.subtotal ?? 0);
      const iva = Number(form.iva ?? 0);
      return {
        subtotalBruto: subtotal,
        descuentoPartidas: 0,
        descuentoGlobal: 0,
        subtotalNeto: subtotal,
        iva,
        total: Number(form.total ?? (subtotal + iva)),
      };
    }

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
  }, [form.descuento_global, form.iva, form.subtotal, form.total, isNotaCredito, partidas, usaPartidas]);

  const resumenFinanciero = usaGeneracionEspecialNotaCredito ? resumenNotaCreditoEspecial : discountSummary;
  const mostrarResumenFinanciero = !usaCapturaEspecialNotaCredito || usaGeneracionEspecialNotaCredito;
  const mostrarResumenFinancieroStickyVisible = mostrarResumenFinancieroSticky || usaGeneracionEspecialNotaCredito;
  const ocultarIvaPorTratamiento = String(form.tratamiento_impuestos ?? 'normal').toLowerCase() === 'sin_iva';

  const recalcularNotaCreditoManual = useCallback(async (montoTotal: number, tratamiento: TratamientoImpuestos | null | undefined) => {
    const total = Number.isFinite(montoTotal) ? Math.max(0, Number(montoTotal)) : 0;
    if (total <= 0) {
      setForm((prev) => ({ ...prev, subtotal: 0, iva: 0, total: 0, descuento: 0, descuento_global: 0 }));
      return { subtotal: 0, iva: 0, total: 0 };
    }

    if ((tratamiento ?? 'normal') === 'sin_iva' || (tratamiento ?? 'normal') === 'tasa_cero' || (tratamiento ?? 'normal') === 'exento') {
      setForm((prev) => ({ ...prev, subtotal: total, iva: 0, total, descuento: 0, descuento_global: 0 }));
      return { subtotal: total, iva: 0, total };
    }

    try {
      const previewBase: any = await calcularImpuestosPreview({
        producto_id: null,
        cantidad: 1,
        precio_unitario: 100,
        descuento: 0,
        descuento_global: 0,
        tratamiento_impuestos: tratamiento ?? 'normal',
      });

      const subtotalBase = Number(previewBase?.subtotal_partida ?? 100) || 100;
      const totalBase = Number(previewBase?.total_partida ?? subtotalBase) || subtotalBase;
      const factor = totalBase > 0 ? totalBase / subtotalBase : 1;
      const subtotalEstimado = factor > 0 ? Number((total / factor).toFixed(6)) : total;

      const previewExacto: any = await calcularImpuestosPreview({
        producto_id: null,
        cantidad: 1,
        precio_unitario: subtotalEstimado,
        descuento: 0,
        descuento_global: 0,
        tratamiento_impuestos: tratamiento ?? 'normal',
      });

      const subtotal = Number(previewExacto?.subtotal_partida ?? subtotalEstimado) || subtotalEstimado;
      const totalCalculado = Number(previewExacto?.total_partida ?? total) || total;
      const iva = Number((totalCalculado - subtotal).toFixed(2));

      setForm((prev) => ({
        ...prev,
        subtotal: Number(subtotal.toFixed(2)),
        iva,
        total: Number(total.toFixed(2)),
        descuento: 0,
        descuento_global: 0,
      }));
      return {
        subtotal: Number(subtotal.toFixed(2)),
        iva,
        total: Number(total.toFixed(2)),
      };
    } catch (previewError) {
      console.error('[nota_credito_manual] No se pudo calcular impuestos', previewError);
      setForm((prev) => ({ ...prev, subtotal: total, iva: 0, total, descuento: 0, descuento_global: 0 }));
      return { subtotal: total, iva: 0, total };
    }
  }, []);

  const getNotaCreditoManualTotalActual = useCallback(() => parseMontoMonetarioInput(notaCreditoManualTotalInput), [notaCreditoManualTotalInput, parseMontoMonetarioInput]);

  useEffect(() => {
    if (!isNotaCreditoManual) {
      setNotaCreditoManualTotalInput('');
      setNotaCreditoManualTotalFocused(false);
      return;
    }

    if (notaCreditoManualTotalFocused) return;
    setNotaCreditoManualTotalInput(formatMontoMonetarioInput(Number(form.total ?? 0)));
  }, [form.total, formatMontoMonetarioInput, isNotaCreditoManual, notaCreditoManualTotalFocused]);

  useEffect(() => {
    if (!isNotaCreditoManual || !notaCreditoManualTotalFocused) return;

    const timer = setTimeout(() => {
      const numeric = getNotaCreditoManualTotalActual();
      void recalcularNotaCreditoManual(numeric, form.tratamiento_impuestos);
    }, 350);

    return () => clearTimeout(timer);
  }, [form.tratamiento_impuestos, getNotaCreditoManualTotalActual, isNotaCreditoManual, notaCreditoManualTotalFocused, recalcularNotaCreditoManual]);

  const handleNotaCreditoManualTotalChange = useCallback((rawValue: string) => {
    setNotaCreditoManualTotalInput(rawValue);
  }, []);

  const handleNotaCreditoManualTotalFocus = useCallback(() => {
    setNotaCreditoManualTotalFocused(true);
  }, []);

  const handleNotaCreditoManualTotalBlur = useCallback(() => {
    if (!isNotaCreditoManual) return;

    const numeric = getNotaCreditoManualTotalActual();
    setNotaCreditoManualTotalFocused(false);
    setNotaCreditoManualTotalInput(formatMontoMonetarioInput(numeric));
    void recalcularNotaCreditoManual(numeric, form.tratamiento_impuestos);
  }, [form.tratamiento_impuestos, formatMontoMonetarioInput, getNotaCreditoManualTotalActual, isNotaCreditoManual, recalcularNotaCreditoManual]);

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

  useEffect(() => {
    setMobileExpandedPartidas((prev) => {
      if (prev.length === partidas.length) return prev;
      return partidas.map((_, index) => prev[index] ?? false);
    });
  }, [partidas]);

  const isSinIva = (t: TratamientoImpuestos | null | undefined) => (t ?? '').toLowerCase() === 'sin_iva';
  const isOperacionEstandar = (t: TratamientoImpuestos | null | undefined) => ['normal', 'operacion_estandar'].includes((t ?? '').toLowerCase());

  const partidasGridTemplate = useMemo(
    () =>
      (partidasMostrarEsParteOportunidad || partidasMostrarImagenes
        ? '180px 1fr 80px 120px 88px 120px 120px 120px 120px 52px 40px 48px'
        : '180px 1fr 80px 120px 88px 120px 120px 120px 40px 48px'),
    [partidasMostrarEsParteOportunidad, partidasMostrarImagenes]
  );

  const useCompactMobilePartidas = isMobile && !esDocumentoMonetario && !usaCapturaEspecialNotaCredito && usaPartidas;

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
    if (isNotaCreditoManual) {
      tratamientoRef.current = valor;
      setForm((prev) => ({ ...prev, tratamiento_impuestos: valor }));
      void recalcularNotaCreditoManual(getNotaCreditoManualTotalActual(), valor);
      return;
    }

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

  const handleMotivoNotaCreditoChange = (valor: MotivoNotaCredito) => {
    conceptoManualOverrideRef.current = false;
    setConceptoObligatorioDialog({ open: false, message: '' });
    setForm((prev) => ({
      ...prev,
      motivo_nc: valor,
      descuento_global: 0,
      descuento: 0,
      concepto_id: valor === 'otro' ? prev.concepto_id : null,
    }));

    if (valor === 'otro') {
      setPartidas([emptyPartida()]);
      const montoActual = Number(form.total ?? 0);
      setNotaCreditoManualTotalInput(formatMontoMonetarioInput(montoActual));
      void recalcularNotaCreditoManual(montoActual, form.tratamiento_impuestos);
    }
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
      const [c, p, v, conceptosData] = await Promise.all([
        fetchContactos(tiposContactoPermitidos),
        fetchProductos(),
        fetchVendedores(),
        fetchConceptos().catch(() => []),
      ]);
      setContactos(c);
      setProductos(p);
      setVendedores(v);
      setConceptos(conceptosData ?? []);
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
      if (TIPOS_DOCUMENTO_CON_SALDO.includes(tipoDocumento)) {
        requests.push(fetchSaldoDocumento(Number(documentoActualId)).catch(() => null));
      }
      const [data, saldoData] = await Promise.all(requests);
      const doc = data.documento;
      setDocumentoPersistidoId(Number((doc as any).id ?? documentoActualId));
      setSaldoDocumento(Number((saldoData as any)?.saldo ?? doc.saldo ?? 0));
      setForm({
        tipo_documento: doc.tipo_documento ?? tipoDocumento,
        motivo_nc: (doc as any).motivo_nc ?? (isNotaCredito ? 'otro' : null),
        concepto_id: (doc as any).concepto_id ?? null,
  serie: (doc as any).serie || null,
        documento_origen_id: (doc as any).documento_origen_id ?? null,
        oportunidad_id: (doc as any).oportunidad_id ?? null,
        contacto_principal_id: doc.contacto_principal_id,
        agente_id: (doc as any).agente_id ?? null,
        fecha_documento: normalizeCivilDate(doc.fecha_documento) || defaultFecha(),
        moneda: doc.moneda || 'MXN',
        tipo_cambio: (doc as any).tipo_cambio ?? 1,
        cuenta_financiera_id: (doc as any).cuenta_financiera_id ?? null,
        finanzas_operacion_id: (doc as any).finanzas_operacion_id ?? null,
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
      const motivoDocumentoActual = ((doc as any).motivo_nc ?? null) as MotivoNotaCredito | null;
      if (isNotaCredito && (motivoDocumentoActual === 'devolucion' || motivoDocumentoActual === 'bonificacion')) {
        const capturasActuales = data.partidas.reduce<Record<number, {
          documentoOrigenId: number;
          cantidadVinculada: number;
          montoCapturado: number;
          valor: number;
        }>>((acc, partida) => {
          const partidaOrigenId = Number((partida as any).partida_origen_id ?? 0);
          const documentoOrigenId = Number((partida as any).documento_origen_id ?? 0);
          if (partidaOrigenId <= 0 || documentoOrigenId <= 0) return acc;

          const cantidadVinculada = Number((partida as any).cantidad_vinculada ?? partida.cantidad ?? 0);
          const montoCapturado = Number(partida.subtotal_partida ?? partida.total_partida ?? 0);
          const actual = acc[partidaOrigenId];
          acc[partidaOrigenId] = {
            documentoOrigenId,
            cantidadVinculada: Number(((actual?.cantidadVinculada ?? 0) + cantidadVinculada).toFixed(6)),
            montoCapturado: Number(((actual?.montoCapturado ?? 0) + montoCapturado).toFixed(2)),
            valor: motivoDocumentoActual === 'devolucion'
              ? Number(((actual?.valor ?? 0) + cantidadVinculada).toFixed(6))
              : Number(((actual?.valor ?? 0) + montoCapturado).toFixed(2)),
          };
          return acc;
        }, {});
        setCapturasEspecialesDocumentoActual(capturasActuales);
      } else {
        setCapturasEspecialesDocumentoActual({});
      }
      skipFiscalFetchRef.current = true;
      prevContactoRef.current = doc.contacto_principal_id;
      prevPrecioResolverContactoRef.current = doc.contacto_principal_id;
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
          precio_lista_id: p.precio_lista_id ?? null,
          precio_editado_manual: p.precio_editado_manual === true,
          precio_origen: p.precio_origen ?? null,
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
      let nextPartidas = usaPartidas ? (mapped.length ? mapped : [emptyPartida()]) : [emptyPartida()];
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
        usaPartidas
          ? Promise.all(nextPartidas.map((p) => (p.id ? fetchCamposPartida(p.id) : Promise.resolve([] as CampoValorGuardado[]))))
          : Promise.resolve([] as CampoValorGuardado[][]),
      ]);

      const bucketDoc = mapValoresToRecord(valoresDocResp || []);
      setValoresCamposDocumento(bucketDoc);
      prefetchOpcionesLista(camposDocumento.campos, bucketDoc, camposDocumento.loadOptions);

      const bucketsPartidas = usaPartidas
        ? nextPartidas.map((_, idx) => mapValoresToRecord(valoresPartidasResp[idx] || []))
        : [{}];
      setValoresCamposPartidas(bucketsPartidas.length ? bucketsPartidas : [{}]);
      if (usaPartidas) {
        bucketsPartidas.forEach((bucket) => {
          prefetchOpcionesLista(camposPartida.campos, bucket, camposPartida.loadOptions);
        });
      }

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

  const loadDocumentosCargoMonetarios = useCallback(async (documentIdOverride?: number | null) => {
    if (!esDocumentoMonetario || !form.contacto_principal_id) {
      setDocumentosCargoMonetarios([]);
      return;
    }

    try {
      setLoadingDocumentosCargoMonetarios(true);
      const estadoCuenta = await fetchEstadoCuenta(Number(form.contacto_principal_id));
      const documentos = (estadoCuenta ?? [])
        .filter((item) => item.origen === 'documento' && Number(item.saldo ?? 0) > 0)
        .filter((item) => tiposDocumentoCargoMonetario.includes(String(item.tipo ?? '').trim().toLowerCase()))
        .filter((item) => Number(item.id) !== Number(documentIdOverride ?? documentoActualId ?? 0))
        .filter((item) => !form.moneda || String(item.moneda ?? '').trim().toUpperCase() === String(form.moneda ?? '').trim().toUpperCase())
        .sort((a, b) => String(a.fecha ?? '').localeCompare(String(b.fecha ?? '')));
      setDocumentosCargoMonetarios(documentos);
    } catch (err) {
      console.error('No se pudo cargar el estado de cuenta del documento monetario', err);
      setDocumentosCargoMonetarios([]);
    } finally {
      setLoadingDocumentosCargoMonetarios(false);
    }
  }, [documentoActualId, esDocumentoMonetario, form.contacto_principal_id, form.moneda, tiposDocumentoCargoMonetario]);

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
    if (!esDocumentoMonetario) {
      setDocumentosCargoMonetarios([]);
      setMontosAplicacionMonetaria({});
      return;
    }
    if (!form.contacto_principal_id) {
      setDocumentosCargoMonetarios([]);
      setMontosAplicacionMonetaria({});
      return;
    }
    void loadDocumentosCargoMonetarios();
  }, [esDocumentoMonetario, form.contacto_principal_id, form.moneda, loadDocumentosCargoMonetarios]);

  useEffect(() => {
    if (!requiereCuentaFinanciera || cuentasFinancieras.length > 0) {
      return;
    }
    void loadCuentasFinancieras();
  }, [cuentasFinancieras.length, loadCuentasFinancieras, requiereCuentaFinanciera]);

  useEffect(() => {
    if (!isNotaCreditoDevolucion && !isNotaCreditoBonificacion) {
      setDocumentosOrigenDisponibles([]);
      setDocumentosOrigenSeleccionados([]);
      setPreparacionNotaCredito(null);
      setCapturasEspecialesDocumentoActual({});
      setValoresEspecialesNotaCredito({});
      setDetallePartidasNotaCreditoEspecial({});
      setLineasSeleccionadasNotaCreditoEspecial({});
      setBonificacionInputDisplay({});
      setBonificacionInputFocusedId(null);
      setBusquedaNotaCreditoEspecial('');
      return;
    }

    getDocumentos(tipoDocumentoOrigenNotaCredito)
      .then((docs) => setDocumentosOrigenDisponibles((docs ?? []).filter((doc) => String(doc.estatus_documento ?? '').toLowerCase() !== 'cancelada' && String(doc.estatus_documento ?? '').toLowerCase() !== 'cancelado')))
      .catch(() => setDocumentosOrigenDisponibles([]));
  }, [isNotaCreditoBonificacion, isNotaCreditoDevolucion, tipoDocumentoOrigenNotaCredito]);

  useEffect(() => {
    if (!usaGeneracionEspecialNotaCredito || !form.contacto_principal_id) {
      setDocumentosOrigenSeleccionados([]);
      setPreparacionNotaCredito(null);
      setValoresEspecialesNotaCredito({});
      setDetallePartidasNotaCreditoEspecial({});
      setLineasSeleccionadasNotaCreditoEspecial({});
      setBonificacionInputDisplay({});
      setBonificacionInputFocusedId(null);
      return;
    }

    setDocumentosOrigenSeleccionados(documentosOrigenCliente);
  }, [documentosOrigenCliente, form.contacto_principal_id, usaGeneracionEspecialNotaCredito]);

  useEffect(() => {
    if (!nombreConceptoAutoNotaCredito || conceptoManualOverrideRef.current) return;

    const nombreObjetivo = nombreConceptoAutoNotaCredito;
    const conceptoExistente = conceptos.find((concepto) => normalizarNombreConcepto(concepto.nombre_concepto) === normalizarNombreConcepto(nombreObjetivo));

    if (conceptoExistente) {
      if (form.concepto_id !== conceptoExistente.id) {
        setForm((prev) => ({ ...prev, concepto_id: conceptoExistente.id }));
      }
      conceptoAutoSyncRef.current = null;
      return;
    }

    if (conceptoAutoSyncRef.current === nombreObjetivo) return;
    conceptoAutoSyncRef.current = nombreObjetivo;

    let cancelled = false;
    void (async () => {
      try {
        const creado = await crearConcepto({
          nombre_concepto: nombreObjetivo,
          es_gasto: tipoDocumento === 'nota_credito_compra',
          activo: true,
        });

        if (cancelled) return;

        setConceptos((prev) => [
          ...prev.filter((concepto) => concepto.id !== creado.id),
          creado,
        ]);
        setForm((prev) => ({ ...prev, concepto_id: creado.id }));
      } catch (error) {
        if (!cancelled) {
          setSnackbar({
            open: true,
            message: `No se pudo crear automáticamente el concepto "${nombreObjetivo}"`,
            severity: 'error',
          });
        }
      } finally {
        if (!cancelled) {
          conceptoAutoSyncRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conceptos, form.concepto_id, nombreConceptoAutoNotaCredito, normalizarNombreConcepto, tipoDocumento]);

  useEffect(() => {
    if ((!isNotaCreditoDevolucion && !isNotaCreditoBonificacion) || documentosOrigenSeleccionados.length === 0) {
      setPreparacionNotaCredito(null);
      setValoresEspecialesNotaCredito({});
      setDetallePartidasNotaCreditoEspecial({});
      setLineasSeleccionadasNotaCreditoEspecial({});
      setBonificacionInputDisplay({});
      setBonificacionInputFocusedId(null);
      return;
    }
    if (!session.token || !session.empresaActivaId) {
      return;
    }

    setLoadingPreparacionNotaCredito(true);
    prepararGeneracionMultiple(
      documentosOrigenSeleccionados.map((doc) => doc.id),
      tipoDocumento,
      session.token,
      session.empresaActivaId
    )
      .then((data) => {
        setPreparacionNotaCredito(data);
        setValoresEspecialesNotaCredito(() => Object.fromEntries(data.partidas.map((partida) => [
          partida.partida_id,
          Number(capturasEspecialesDocumentoActual[partida.partida_id]?.valor ?? 0),
        ])));
        setLineasSeleccionadasNotaCreditoEspecial(() => Object.fromEntries(data.partidas.map((partida) => [
          partida.partida_id,
          Number(capturasEspecialesDocumentoActual[partida.partida_id]?.valor ?? 0) > 0,
        ])));
        setBonificacionInputDisplay(() => Object.fromEntries(data.partidas.map((partida) => [
          partida.partida_id,
          formatMontoBonificacionInput(Number(capturasEspecialesDocumentoActual[partida.partida_id]?.valor ?? 0)),
        ])));
        setBonificacionInputFocusedId(null);
        const contactoId = data.documentos_origen.length === 1
          ? (documentosOrigenSeleccionados[0]?.contacto_principal_id ?? null)
          : (documentosOrigenSeleccionados[0]?.contacto_principal_id ?? null);
        setForm((prev) => ({ ...prev, contacto_principal_id: contactoId }));
      })
      .catch((prepError: any) => {
        setPreparacionNotaCredito(null);
        setValoresEspecialesNotaCredito({});
        setLineasSeleccionadasNotaCreditoEspecial({});
        setBonificacionInputDisplay({});
        setBonificacionInputFocusedId(null);
        setSnackbar({ open: true, message: prepError?.message || 'No se pudo preparar la nota de crédito.', severity: 'error' });
      })
      .finally(() => setLoadingPreparacionNotaCredito(false));
  }, [capturasEspecialesDocumentoActual, documentosOrigenSeleccionados, formatMontoBonificacionInput, isNotaCreditoBonificacion, isNotaCreditoDevolucion, session.empresaActivaId, session.token, tipoDocumento]);

  useEffect(() => {
    if (!usaGeneracionEspecialNotaCredito) {
      setResumenNotaCreditoEspecial(EMPTY_FINANCIAL_SUMMARY);
      setDetallePartidasNotaCreditoEspecial({});
      return;
    }

    const partidasConMonto = partidasNotaCreditoDisponibles
      .map((partida) => ({ partida, subtotal: getMontoEspecialNotaCredito(partida) }))
      .filter((item) => item.subtotal > 0);

    if (partidasConMonto.length === 0) {
      setResumenNotaCreditoEspecial(EMPTY_FINANCIAL_SUMMARY);
      setDetallePartidasNotaCreditoEspecial({});
      setForm((prev) => ({
        ...prev,
        subtotal: 0,
        descuento: 0,
        descuento_global: 0,
        iva: 0,
        total: 0,
      }));
      return;
    }

    const seq = ++resumenNotaCreditoEspecialSeqRef.current;

    void Promise.all(
      partidasConMonto.map(async ({ partida, subtotal }) => {
        try {
          const preview: any = await calcularImpuestosPreview({
            producto_id: partida.producto_id ?? null,
            cantidad: 1,
            precio_unitario: subtotal,
            descuento: 0,
            descuento_global: 0,
            tratamiento_impuestos: form.tratamiento_impuestos ?? 'normal',
          });

          const subtotalPreview = Number(preview?.subtotal_partida ?? subtotal) || subtotal;
          const impuestos = Array.isArray(preview?.impuestos) ? preview.impuestos : [];
          const ivaPreview = impuestos.reduce((sum: number, imp: any) => {
            const monto = Number(imp?.monto ?? 0);
            const esRetencion = String(imp?.tipo ?? '').toLowerCase() === 'retencion';
            return sum + (esRetencion ? -monto : monto);
          }, 0);
          const totalPreview = Number(preview?.total_partida ?? (subtotalPreview + ivaPreview)) || (subtotalPreview + ivaPreview);

          return {
            partidaId: partida.partida_id,
            subtotalBruto: subtotalPreview,
            descuentoPartidas: 0,
            descuentoGlobal: 0,
            subtotalNeto: subtotalPreview,
            iva: Number(ivaPreview.toFixed(2)),
            total: Number(totalPreview.toFixed(2)),
          };
        } catch {
          return {
            partidaId: partida.partida_id,
            subtotalBruto: subtotal,
            descuentoPartidas: 0,
            descuentoGlobal: 0,
            subtotalNeto: subtotal,
            iva: 0,
            total: subtotal,
          };
        }
      })
    ).then((items) => {
      if (resumenNotaCreditoEspecialSeqRef.current !== seq) return;

      setDetallePartidasNotaCreditoEspecial(Object.fromEntries(items.map((item) => [
        item.partidaId,
        {
          subtotal: Number(item.subtotalNeto.toFixed(2)),
          iva: Number(item.iva.toFixed(2)),
          total: Number(item.total.toFixed(2)),
        },
      ])));

      const resumen = items.reduce<FinancialSummary>((acc, item) => ({
        subtotalBruto: acc.subtotalBruto + item.subtotalBruto,
        descuentoPartidas: acc.descuentoPartidas + item.descuentoPartidas,
        descuentoGlobal: acc.descuentoGlobal + item.descuentoGlobal,
        subtotalNeto: acc.subtotalNeto + item.subtotalNeto,
        iva: acc.iva + item.iva,
        total: acc.total + item.total,
      }), { ...EMPTY_FINANCIAL_SUMMARY });

      const resumenNormalizado: FinancialSummary = {
        subtotalBruto: Number(resumen.subtotalBruto.toFixed(2)),
        descuentoPartidas: 0,
        descuentoGlobal: 0,
        subtotalNeto: Number(resumen.subtotalNeto.toFixed(2)),
        iva: Number(resumen.iva.toFixed(2)),
        total: Number(resumen.total.toFixed(2)),
      };

      setResumenNotaCreditoEspecial(resumenNormalizado);
      setForm((prev) => ({
        ...prev,
        subtotal: resumenNormalizado.subtotalNeto,
        descuento: 0,
        descuento_global: 0,
        iva: resumenNormalizado.iva,
        total: resumenNormalizado.total,
      }));
    });
  }, [form.tratamiento_impuestos, getMontoEspecialNotaCredito, partidasNotaCreditoDisponibles, usaGeneracionEspecialNotaCredito]);

  useEffect(() => {
    if (!isNotaCreditoBonificacion) {
      setBonificacionInputDisplay({});
      setBonificacionInputFocusedId(null);
      return;
    }

    setBonificacionInputDisplay((prev) => {
      const next: Record<number, string> = {};
      partidasNotaCreditoDisponibles.forEach((partida) => {
        if (bonificacionInputFocusedId === partida.partida_id && prev[partida.partida_id] !== undefined) {
          next[partida.partida_id] = prev[partida.partida_id];
          return;
        }
        next[partida.partida_id] = formatMontoBonificacionInput(Number(valoresEspecialesNotaCredito[partida.partida_id] ?? 0));
      });
      return next;
    });
  }, [bonificacionInputFocusedId, formatMontoBonificacionInput, isNotaCreditoBonificacion, partidasNotaCreditoDisponibles, valoresEspecialesNotaCredito]);

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
    if (!['factura', 'nota_credito'].includes(tipoDocumento)) return;

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

  const construirPartidaTecnicaNotaCredito = useCallback(async (calculoManual?: { subtotal: number; iva: number; total: number }): Promise<CotizacionPartidaPayload> => {
    const subtotal = Number(calculoManual?.subtotal ?? form.subtotal ?? 0);
    const totalPartida = Number(calculoManual?.total ?? form.total ?? subtotal);

    let impuestosPayload: CotizacionPartidaPayload['impuestos'] = [];
    if (subtotal > 0) {
      const preview: any = await calcularImpuestosPreview({
        producto_id: null,
        cantidad: 1,
        precio_unitario: subtotal,
        descuento: 0,
        descuento_global: 0,
        tratamiento_impuestos: form.tratamiento_impuestos ?? 'normal',
      });

      impuestosPayload = (preview?.impuestos ?? []).map((imp: any) => ({
        impuesto_id: imp.impuestoId ?? imp.impuesto_id ?? imp.id,
        nombre: imp.nombre ?? null,
        tipo: imp.tipo ?? null,
        tasa: Number(imp.tasa ?? 0),
        base: imp.base ?? subtotal,
        monto: Number(imp.monto ?? 0),
      }));
    }

    return {
      producto_id: null,
      descripcion_alterna: null,
      cantidad: 1,
      precio_unitario: subtotal,
      precio_lista_id: null,
      precio_editado_manual: true,
      precio_origen: 'manual_nc',
      descuento: 0,
      subtotal_partida: subtotal,
      total_partida: totalPartida,
      observaciones: '',
      impuestos: impuestosPayload,
    };
  }, [form.subtotal, form.total, form.tratamiento_impuestos]);

  const validarDocumentoAntesDePersistir = useCallback((context: 'save' | 'anticipo' | 'exit' = 'save') => {
    const totalActual = isNotaCreditoManual ? getNotaCreditoManualTotalActual() : Number(form.total || 0);

    if (!form.contacto_principal_id) {
      setSnackbar({
        open: true,
        message: context === 'anticipo' ? 'Primero selecciona un cliente/proveedor.' : 'Selecciona un cliente',
        severity: 'error',
      });
      return false;
    }
    if ((context === 'anticipo' || hasAnticiposRegistrados) && totalActual <= 0) {
      setSnackbar({ open: true, message: 'Primero captura partidas o un total mayor a cero.', severity: 'error' });
      return false;
    }
    if (context === 'save' && isNotaCredito && !usaGeneracionEspecialNotaCredito && !tienePartidaValida && totalActual <= 0) {
      setSnackbar({ open: true, message: 'Captura un monto mayor a cero para la nota de crédito, o agrega partidas válidas.', severity: 'error' });
      return false;
    }
    if (context === 'save' && usaGeneracionEspecialNotaCredito) {
      if (documentosOrigenSeleccionados.length === 0 || !preparacionNotaCredito) {
        setSnackbar({ open: true, message: 'Selecciona al menos una factura origen válida.', severity: 'error' });
        return false;
      }
      const tieneCapturaValida = preparacionNotaCredito.partidas.some((partida) => Number(valoresEspecialesNotaCredito[partida.partida_id] ?? 0) > 0);
      if (!tieneCapturaValida) {
        setSnackbar({ open: true, message: isNotaCreditoDevolucion ? 'Captura al menos una cantidad a devolver.' : 'Captura al menos un monto a bonificar.', severity: 'error' });
        return false;
      }
    }
    if (context === 'anticipo' && !tienePartidaValida) {
      setSnackbar({ open: true, message: 'Agrega al menos una partida válida con cantidad y precio mayores a cero.', severity: 'error' });
      return false;
    }
    if (hasAnticiposRegistrados && totalActual < totalAnticipadoRegistrado) {
      setSnackbar({ open: true, message: 'El total del documento no puede ser menor que los anticipos registrados.', severity: 'error' });
      return false;
    }

    if (context === 'save' && isNotaCredito && !form.concepto_id) {
      setConceptoObligatorioDialog({
        open: true,
        message: 'La nota de crédito debe tener un concepto asociado. El concepto será utilizado posteriormente para la contabilización.',
      });
      return false;
    }

    const requiereDatosFiscales = ['factura', 'nota_credito'].includes(tipoDocumento) && form.tratamiento_impuestos !== 'sin_iva';
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

    if (requiereCuentaFinanciera && !form.cuenta_financiera_id) {
      setSnackbar({ open: true, message: 'Selecciona la cuenta, caja o banco del documento monetario', severity: 'error' });
      return false;
    }

    return true;
  }, [documentoActualId, documentosOrigenSeleccionados.length, form, getNotaCreditoManualTotalActual, hasAnticiposRegistrados, isNotaCredito, isNotaCreditoBonificacion, isNotaCreditoDevolucion, isNotaCreditoManual, preparacionNotaCredito, requiereCuentaFinanciera, tienePartidaValida, tipoDocumento, totalAnticipadoRegistrado, usaGeneracionEspecialNotaCredito, valoresEspecialesNotaCredito]);

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
      const totalNotaCreditoManual = isNotaCreditoManual ? getNotaCreditoManualTotalActual() : Number(form.total || 0);
      const calculoNotaCreditoManual = isNotaCreditoManual
        ? await recalcularNotaCreditoManual(totalNotaCreditoManual, form.tratamiento_impuestos)
        : null;
      const aplicacionesDocumento = esDocumentoMonetario
        ? documentosCargoMonetarios
            .map((item) => {
              const monto = Number(montosAplicacionMonetaria[item.id] ?? 0);
              if (!(monto > 0)) return null;
              return {
                documento_destino_id: Number(item.id),
                monto,
                monto_moneda_documento: monto,
                fecha_aplicacion: normalizeCivilDate(form.fecha_documento) || defaultFecha(),
              };
            })
            .filter(Boolean) as NonNullable<CotizacionCrearPayload['aplicaciones_documento']>
        : [];
      const payload: CotizacionCrearPayload & { conversacion_id: number | null } = {
        ...form,
        tipo_documento: tipoDocumento,
        producto_resumen: form.producto_resumen ?? null,
        serie: form.serie?.trim() || null,
        subtotal: isNotaCreditoManual ? (calculoNotaCreditoManual?.subtotal ?? form.subtotal ?? 0) : (form.subtotal || 0),
        descuento_global: form.descuento_global || 0,
        descuento: form.descuento || 0,
        iva: isNotaCreditoManual ? (calculoNotaCreditoManual?.iva ?? form.iva ?? 0) : (form.iva || 0),
        total: isNotaCreditoManual ? (calculoNotaCreditoManual?.total ?? totalNotaCreditoManual) : (form.total || 0),
        empresa_id: getEmpresaActivaId(),
        conversacion_id: conversacionId ? Number(conversacionId) : null,
        usuario_creacion_id: form.usuario_creacion_id ?? sessionUserId ?? null,
        estado_seguimiento: isCotizacion ? (form.estado_seguimiento ?? DEFAULT_ESTADO_SEGUIMIENTO) : null,
        tipo_cambio: form.tipo_cambio ?? 1,
        cuenta_financiera_id: form.cuenta_financiera_id ?? null,
        finanzas_operacion_id: form.finanzas_operacion_id ?? null,
        aplicaciones_documento: aplicacionesDocumento,
        tratamiento_impuestos: TIPOS_DOCUMENTO_CON_TRATAMIENTO_FISCAL.has(tipoDocumento) ? form.tratamiento_impuestos || 'normal' : 'normal',
        rfc_receptor: form.rfc_receptor?.trim() || null,
        nombre_receptor: form.nombre_receptor?.trim() || null,
        regimen_fiscal_receptor: form.regimen_fiscal_receptor?.trim() || null,
        uso_cfdi: form.uso_cfdi?.trim() || null,
        forma_pago: form.forma_pago?.trim() || null,
        metodo_pago: form.metodo_pago?.trim() || null,
        codigo_postal_receptor: form.codigo_postal_receptor?.trim() || null,
      };

      if (isNotaCreditoDevolucion || isNotaCreditoBonificacion) {
        if (!session.token || !session.empresaActivaId || !preparacionNotaCredito) {
          throw new Error('No se pudo preparar la generación de la nota de crédito.');
        }

        const resultado = await generarDocumentoDesdeOrigen({
          documento_origen_ids: documentosOrigenSeleccionados.map((doc) => doc.id),
          documento_destino_id: documentoActualId ? Number(documentoActualId) : undefined,
          tipo_documento_destino: tipoDocumento,
          datos_encabezado: {
            serie: form.serie?.trim() || null,
            fecha: form.fecha_documento,
            contacto_principal_id: form.contacto_principal_id,
            comentarios: form.observaciones?.trim() || null,
            motivo_nc: motivoNotaCredito,
            concepto_id: form.concepto_id ?? null,
            rfc_receptor: form.rfc_receptor?.trim() || null,
            nombre_receptor: form.nombre_receptor?.trim() || null,
            regimen_fiscal_receptor: form.regimen_fiscal_receptor?.trim() || null,
            uso_cfdi: form.uso_cfdi?.trim() || null,
            forma_pago: form.forma_pago?.trim() || null,
            metodo_pago: form.metodo_pago?.trim() || null,
            codigo_postal_receptor: form.codigo_postal_receptor?.trim() || null,
          },
          partidas: preparacionNotaCredito.partidas
            .map((partida) => {
              const valor = Number(valoresEspecialesNotaCredito[partida.partida_id] ?? 0);
              if (valor <= 0) return null;
              return isNotaCreditoDevolucion
                ? { partida_origen_id: partida.partida_id, cantidad: valor }
                : {
                    partida_origen_id: partida.partida_id,
                    cantidad: 1,
                    monto_bonificacion: Number(valor.toFixed(2)),
                  };
            })
            .filter(Boolean) as Array<{ partida_origen_id: number; cantidad: number; monto_bonificacion?: number | null }>,
        }, session.token, session.empresaActivaId);

        const docId = Number(resultado.documento_destino_id);
        setDocumentoPersistidoId(docId);
        const nextPath = resolveDocumentoFormPath(tipoDocumento, docId, moduloDocumento);
        if (!embedded && location.pathname !== nextPath) {
          navigate(nextPath, { replace: true });
        }
        void loadAnticiposResumen(docId);
        if (showSuccessMessage) {
          setSnackbar({ open: true, message: textos.guardado, severity: 'success' });
        }
        if (navigateAfterSave && !embedded) {
          setTimeout(() => navigate(basePath), 400);
        }
        if (embedded) {
          onEmbeddedSaved?.(docId);
        }
        return docId;
      }

      let docId: number;
      if (documentoActualId) {
        const updated = await updateDocumento(Number(documentoActualId), tipoDocumento, payload);
        docId = (updated as any).id ?? Number(documentoActualId);
      } else {
        const created = await createDocumento(tipoDocumento, payload);
        docId = (created as any).id;
      }

      setDocumentoPersistidoId(docId);

      const partidasPayload: CotizacionPartidaPayload[] = !usaPartidas
        ? []
        : isNotaCreditoManual
        ? [await construirPartidaTecnicaNotaCredito(calculoNotaCreditoManual ?? undefined)]
        : partidas.filter((p) => !esPartidaPlaceholder(p)).map((p) => ({
        producto_id: p.producto_id,
      descripcion_alterna: p.descripcion_alterna ?? null,
        cantidad: p.cantidad ?? 0,
        precio_unitario: p.precio_unitario ?? 0,
        precio_lista_id: p.precio_lista_id ?? null,
        precio_editado_manual: p.precio_editado_manual === true,
        precio_origen: p.precio_origen ?? null,
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
      const partidasGuardadas = usaPartidas ? await replacePartidas(docId, tipoDocumento, partidasPayload) : [];

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
      if (!embedded && location.pathname !== nextPath) {
        navigate(nextPath, { replace: true });
      }

      void loadAnticiposResumen(docId);

      if (esDocumentoMonetario) {
        const saldoActualizado = await fetchSaldoDocumento(docId).catch(() => null);
        if (saldoActualizado) {
          setSaldoDocumento(Number(saldoActualizado.saldo ?? 0));
        }
        setMontosAplicacionMonetaria({});
        void loadDocumentosCargoMonetarios(docId);
      }

      if (showSuccessMessage) {
        setSnackbar({ open: true, message: textos.guardado, severity: 'success' });
      }

      if (navigateAfterSave && !embedded) {
        setTimeout(() => navigate(basePath), 400);
      }

      if (embedded) {
        onEmbeddedSaved?.(docId);
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
    esDocumentoMonetario,
    textos.guardado,
    tieneValorCapturado,
    tipoDocumento,
    usaPartidas,
    validarDocumentoAntesDePersistir,
    valoresCamposDocumento,
    valoresCamposPartidas,
    loadDocumentosCargoMonetarios,
    montosAplicacionMonetaria,
    documentosCargoMonetarios,
  ]);

  const handleSave = async () => {
    await persistDocumento({ context: 'save', navigateAfterSave: true, showSuccessMessage: true });
  };

  const handleApplyDocumentoMonetario = useCallback((documentoCargo: EstadoCuentaItem) => {
    const montoActual = Number(montosAplicacionMonetaria[documentoCargo.id] ?? 0);
    const saldoCargo = Number(documentoCargo.saldo ?? 0);
    const disponibleFila = saldoDisponibleDocumentoMonetario + montoActual;
    const monto = Math.min(disponibleFila, saldoCargo);

    if (!(monto > 0)) {
      setSnackbar({ open: true, message: 'No hay saldo disponible para preparar esta aplicación', severity: 'error' });
      return;
    }

    setMontosAplicacionMonetaria((prev) => ({
      ...prev,
      [documentoCargo.id]: String(Number(monto.toFixed(2))),
    }));
  }, [montosAplicacionMonetaria, saldoDisponibleDocumentoMonetario]);

  const handleAutoApplyDocumentoMonetario = useCallback(async () => {
    if (!documentosCargoMonetarios.length || saldoDisponibleDocumentoMonetario <= 0) return;
    setAutoApplyingDocumentoMonetario(true);
    try {
      const nextMontos: Record<number, string> = {};
      let disponible = Number(documentoActualId ? saldoDocumento : form.total || 0);
      for (const documentoCargo of documentosCargoMonetarios) {
        if (disponible <= 0) break;
        const saldoCargo = Number(documentoCargo.saldo ?? 0);
        const monto = Math.min(disponible, saldoCargo);
        if (monto <= 0) continue;
        nextMontos[documentoCargo.id] = String(Number(monto.toFixed(2)));
        disponible -= monto;
      }
      setMontosAplicacionMonetaria(nextMontos);
    } finally {
      setAutoApplyingDocumentoMonetario(false);
    }
  }, [documentoActualId, documentosCargoMonetarios, form.total, saldoDocumento, saldoDisponibleDocumentoMonetario]);

  const resolverPrecioAutomaticoPartida = useCallback(async (
    index: number,
    producto: Producto | null,
    contactoId: number | null | undefined
  ) => {
    if (!producto?.id) {
      return;
    }

    if (!['cotizacion', 'orden_servicio', 'factura'].includes(tipoDocumento)) {
      return;
    }

    const partidaActual = partidas[index];
    if (!partidaActual || partidaActual.precio_editado_manual === true) {
      return;
    }

    try {
      const resolucion = await resolvePrecioDocumento(producto.id, contactoId ?? null);
      const precioResuelto = Number(resolucion.precio ?? 0);

      setPartidaAt(index, (prev) => {
        if (prev.producto_id !== producto.id || prev.precio_editado_manual === true) {
          return prev;
        }

        return {
          ...prev,
          precio_unitario: precioResuelto,
          precio_lista_id: resolucion.precio_lista_id ?? null,
          precio_editado_manual: false,
          precio_origen: 'LISTA',
        };
      });

      setPrecioInputs((prev) => {
        const next = [...prev];
        next[index] = String(precioResuelto);
        return next;
      });
    } catch (resolverError) {
      const rawMessage = resolverError instanceof Error ? resolverError.message : '';
      const isNetworkError = /load failed|failed to fetch/i.test(rawMessage);
      setSnackbar({
        open: true,
        message: isNetworkError
          ? 'No se pudo conectar con el backend para resolver el precio. Verifica que el backend local esté corriendo en el puerto 7001.'
          : rawMessage || 'No se pudo resolver el precio del producto',
        severity: 'error',
      });
    }
  }, [partidas, tipoDocumento]);

  const handleProductoChange = async (index: number, producto: Producto | null) => {
    setPartidaAt(index, (prev) => {
      const conservarManual = prev.precio_editado_manual === true;
      return {
        ...prev,
        producto_id: producto?.id ?? null,
        descripcion_alterna: producto?.descripcion || prev.descripcion_alterna,
        precio_unitario: producto ? prev.precio_unitario ?? 0 : (conservarManual ? prev.precio_unitario ?? 0 : 0),
        precio_lista_id: producto ? prev.precio_lista_id ?? null : (conservarManual ? prev.precio_lista_id ?? null : null),
        precio_editado_manual: conservarManual,
        precio_origen: producto ? (prev.precio_origen ?? null) : (conservarManual ? 'MANUAL' : null),
        producto: producto ?? null,
        producto_archivo_id: null,
        impuestos: [],
        impuestos_calculados: [],
      };
    });

    if (!producto) {
      setPrecioInputs((prev) => {
        const next = [...prev];
        next[index] = String(partidas[index]?.precio_editado_manual === true ? partidas[index]?.precio_unitario ?? 0 : 0);
        return next;
      });
      return;
    }

    await resolverPrecioAutomaticoPartida(index, producto, form.contacto_principal_id ?? null);
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
        precio_editado_manual: field === 'precio_unitario' ? true : prev.precio_editado_manual ?? false,
        precio_origen: field === 'precio_unitario' ? 'MANUAL' : prev.precio_origen ?? null,
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
    if (!['cotizacion', 'orden_servicio', 'factura'].includes(tipoDocumento)) {
      return;
    }

    if (prevPrecioResolverContactoRef.current === undefined) {
      prevPrecioResolverContactoRef.current = form.contacto_principal_id ?? null;
      return;
    }

    if (prevPrecioResolverContactoRef.current === (form.contacto_principal_id ?? null)) {
      return;
    }

    const siguienteContactoId = form.contacto_principal_id ?? null;
    prevPrecioResolverContactoRef.current = siguienteContactoId;

    partidas.forEach((partida, index) => {
      const producto = partida.producto ?? productos.find((item) => item.id === partida.producto_id) ?? null;
      if (!producto || partida.precio_editado_manual === true) {
        return;
      }

      void resolverPrecioAutomaticoPartida(index, producto, siguienteContactoId);
    });
  }, [form.contacto_principal_id, partidas, productos, resolverPrecioAutomaticoPartida, tipoDocumento]);

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

  const handleCrearConceptoSubmit = async () => {
    const nombre = crearConceptoNombre.trim();
    if (!nombre) {
      setCrearConceptoError('Ingresa el nombre del concepto');
      return;
    }

    const existente = conceptos.find((concepto) => normalizarNombreConcepto(concepto.nombre_concepto) === normalizarNombreConcepto(nombre));
    if (existente) {
      conceptoManualOverrideRef.current = true;
      setForm((prev) => ({ ...prev, concepto_id: existente.id }));
      limpiarCrearConceptoDialog();
      setSnackbar({ open: true, message: 'Concepto seleccionado', severity: 'success' });
      return;
    }

    try {
      setCrearConceptoLoading(true);
      setCrearConceptoError(null);
      const creado = await crearConcepto({
        nombre_concepto: nombre,
        es_gasto: tipoDocumento === 'nota_credito_compra',
        activo: true,
      });

      const refreshed = await fetchConceptos().catch(() => []);
      setConceptos((refreshed ?? []).length > 0 ? refreshed : [creado, ...conceptos.filter((concepto) => concepto.id !== creado.id)]);
      conceptoManualOverrideRef.current = true;
      setForm((prev) => ({ ...prev, concepto_id: creado.id }));
      setSnackbar({ open: true, message: 'Concepto creado', severity: 'success' });
      limpiarCrearConceptoDialog();
    } catch (err: any) {
      setCrearConceptoError(err?.message || 'No se pudo crear el concepto');
    } finally {
      setCrearConceptoLoading(false);
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

    navigate(basePath, { replace: true });
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

  const mobileActionsMenuOpen = Boolean(mobileActionsAnchorEl);

  const handleOpenMobileActionsMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setMobileActionsAnchorEl(event.currentTarget);
  }, []);

  const handleCloseMobileActionsMenu = useCallback(() => {
    setMobileActionsAnchorEl(null);
  }, []);

  const handleOpenPdf = useCallback(async () => {
    try {
      setDownloadingPdf(true);
      await abrirDocumentoPdfEnNuevaVentana(Number(documentoActualId), tipoDocumento);
    } catch (err: any) {
      setError(err?.message || 'No se pudo generar el PDF');
    } finally {
      setDownloadingPdf(false);
    }
  }, [documentoActualId, tipoDocumento]);

  const handleToggleMobilePartida = useCallback((index: number) => {
    setMobileExpandedPartidas((prev) => prev.map((item, itemIndex) => (itemIndex === index ? !item : item)));
  }, []);

  const handleOpenMobilePartidaMenu = useCallback((event: React.MouseEvent<HTMLElement>, index: number) => {
    setMobilePartidaMenuAnchorEl(event.currentTarget);
    setMobilePartidaMenuIndex(index);
  }, []);

  const handleCloseMobilePartidaMenu = useCallback(() => {
    setMobilePartidaMenuAnchorEl(null);
    setMobilePartidaMenuIndex(null);
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: mostrarResumenFinancieroStickyVisible ? { xs: 10, sm: 9 } : 0 }}>
      {isMobile ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            position: 'sticky',
            top: 72,
            zIndex: 2,
            py: 1,
            backgroundColor: '#eef1f4',
          }}
        >
          <MobileBackIconButton
            onClick={() => {
              void handleNavigateBack();
            }}
            disabled={saving}
          />
          <Box>
            <Typography variant="h5" fontWeight={600} color="#1d2f68">
              {isEdit ? textos.editar : textos.nuevo}
            </Typography>
            <Typography variant="body2" color="#4b5563">
              {textos.descripcion}
            </Typography>
          </Box>
        </Box>
      ) : null}

      <Toolbar
        disableGutters
        sx={{
          justifyContent: isMobile ? 'flex-end' : 'space-between',
          alignItems: 'center',
          flexDirection: 'row',
          gap: 0,
          pb: isMobile ? 0 : 1,
          width: '100%',
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ width: '100%', minWidth: 0, display: isMobile ? 'none' : 'flex' }}
        >
          {!isMobile ? (
            <Button
              variant="text"
              onClick={() => void handleNavigateBack()}
              sx={{ alignSelf: 'center' }}
            >
              Volver
            </Button>
          ) : null}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" fontWeight={700} color="#1d2f68">
              {isEdit ? textos.editar : textos.nuevo}
            </Typography>
            <Typography variant="body2" color="#4b5563">
              {textos.descripcion}
            </Typography>
          </Box>
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          justifyContent="flex-end"
          alignItems="center"
          sx={{ width: isMobile ? 'auto' : '100%', flexWrap: 'nowrap', minWidth: 0 }}
        >
          {isMobile ? (
            <>
              <IconButton
                aria-label="Más acciones"
                onClick={handleOpenMobileActionsMenu}
                disabled={saving || loading}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  flexShrink: 0,
                }}
              >
                <MoreVertIcon />
              </IconButton>
              <Menu
                anchorEl={mobileActionsAnchorEl}
                open={mobileActionsMenuOpen}
                onClose={handleCloseMobileActionsMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                {anticipoConfig ? (
                  <MenuItem
                    onClick={() => {
                      handleCloseMobileActionsMenu();
                      void handleOpenAnticipo();
                    }}
                    disabled={saving || loading}
                  >
                    {anticipoConfig.accionLabel}
                  </MenuItem>
                ) : null}
                {isEdit && documentoActualId ? (
                  <MenuItem
                    onClick={() => {
                      handleCloseMobileActionsMenu();
                      setOpenPagos(true);
                    }}
                    disabled={tipoDocumento !== 'factura' || !form.contacto_principal_id || saldoDocumento <= 0}
                  >
                    Aplicar pago
                  </MenuItem>
                ) : null}
                {isEdit && documentoActualId ? (
                  <MenuItem
                    onClick={() => {
                      handleCloseMobileActionsMenu();
                      void handleOpenPdf();
                    }}
                    disabled={loading || downloadingPdf}
                  >
                    {downloadingPdf ? 'Generando PDF...' : 'Ver / Imprimir PDF'}
                  </MenuItem>
                ) : null}
              </Menu>
            </>
          ) : (
            <>
              {anticipoConfig ? (
                <Button
                  variant="outlined"
                  onClick={() => void handleOpenAnticipo()}
                  disabled={saving || loading}
                >
                  {anticipoConfig.accionLabel}
                </Button>
              ) : null}
              {embedded && onEmbeddedClose ? (
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={onEmbeddedClose}
                  disabled={saving || loading}
                >
                  Cerrar
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
                  startIcon={<PrintIcon />}
                  onClick={() => void handleOpenPdf()}
                  disabled={loading || downloadingPdf}
                >
                  {downloadingPdf ? 'Generando...' : 'Ver / Imprimir PDF'}
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={saving || loading}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </>
          )}
        </Stack>
      </Toolbar>

      {isMobile ? (
        <MobileSaveFab
          loading={saving}
          disabled={saving || loading}
          onClick={handleSave}
        />
      ) : null}

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
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="Pestañas documento"
            variant={isMobile ? 'fullWidth' : 'standard'}
          >
            <Tab label="Documento" value={0} />
            <Tab label="Datos fiscales" value={1} />
          </Tabs>
        </Box>
      )}

      {(!showFiscalTab || activeTab === 0) && (
        <Paper variant="outlined" sx={{ borderRadius: 2, p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3, overflowX: 'clip' }}>
          {loading ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CircularProgress size={22} />
              <Typography color="text.secondary">{textos.cargando}</Typography>
            </Stack>
          ) : (
            <>
              {esDocumentoMonetario ? (
                <>
                  <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12, md: 4 }}>
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
                        disabled={lockedContacto}
                        onChange={(_, value) => {
                          if (lockedContacto) return;
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
                            label={contactoLabel}
                            required
                            size="small"
                            disabled={lockedContacto}
                            InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                            inputProps={{ ...params.inputProps }}
                            sx={campoEncabezadoSx}
                          />
                        )}
                      />
                    </Grid>
                    {!usaCapturaEspecialNotaCredito && (
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
                              inputProps={{ ...params.inputProps }}
                              sx={campoEncabezadoSx}
                            />
                          )}
                        />
                      </Grid>
                    )}
                    {!usaCapturaEspecialNotaCredito && (
                      <Grid size={{ xs: 12, md: 2 }}>
                        <TextField
                          label="Fecha documento"
                          type="date"
                          value={form.fecha_documento}
                          onChange={(e) => setForm((prev) => ({ ...prev, fecha_documento: e.target.value }))}
                          disabled={lockedFechaDocumento}
                          InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                          sx={campoEncabezadoSx}
                          fullWidth
                          size="small"
                        />
                      </Grid>
                    )}
                    <Grid size={{ xs: 12, md: 3 }}>
                      <NumericFormat
                        customInput={TextField}
                        label="Monto"
                        value={Number(form.total ?? 0)}
                        onValueChange={(values) => syncDocumentoMonetarioTotals(values.floatValue ?? 0)}
                        thousandSeparator="," 
                        decimalSeparator="."
                        decimalScale={2}
                        fixedDecimalScale
                        allowNegative={false}
                        prefix="$"
                        fullWidth
                        size="small"
                        InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                        inputProps={{ inputMode: 'decimal', style: { textAlign: 'right' } }}
                        sx={campoEncabezadoSx}
                      />
                    </Grid>
                  </Grid>

                  <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12, md: 2 }}>
                      <TextField
                        select
                        label="Moneda"
                        value={form.moneda || 'MXN'}
                        onChange={(e) => setForm((prev) => ({ ...prev, moneda: e.target.value || 'MXN', tipo_cambio: (e.target.value || 'MXN') === 'MXN' ? 1 : (prev.tipo_cambio ?? 1) }))}
                        disabled={lockedMoneda}
                        fullWidth
                        size="small"
                        InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                        sx={campoEncabezadoSx}
                      >
                        <MenuItem value="MXN">MXN</MenuItem>
                        <MenuItem value="USD">USD</MenuItem>
                        <MenuItem value="EUR">EUR</MenuItem>
                      </TextField>
                    </Grid>
                    {requiereCuentaFinanciera && (
                      <Grid size={{ xs: 12, md: 3 }}>
                        <TextField
                          select
                          label="Cuenta / caja / banco"
                          value={form.cuenta_financiera_id ?? ''}
                          onChange={(e) => setForm((prev) => ({ ...prev, cuenta_financiera_id: Number(e.target.value) || null }))}
                          fullWidth
                          size="small"
                          InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                          sx={campoEncabezadoSx}
                        >
                          <MenuItem value="">Selecciona una cuenta</MenuItem>
                          {cuentasFinancieras.map((cuenta) => (
                            <MenuItem key={cuenta.id} value={cuenta.id}>
                              {getCuentaFinancieraDisplayLabel(cuenta)}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                    )}
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField
                        label="Referencia / observaciones"
                        value={form.observaciones || ''}
                        onChange={(e) => setForm((prev) => ({ ...prev, observaciones: e.target.value }))}
                        fullWidth
                        size="small"
                        InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                        sx={campoEncabezadoSx}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Box
                        sx={{
                          width: '100%',
                          minWidth: 0,
                          '& .MuiAutocomplete-root': {
                            width: '100%',
                            minWidth: 0,
                          },
                          '& .MuiInputBase-root': {
                            minHeight: 40,
                          },
                          '& .MuiInputBase-input': {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          },
                        }}
                      >
                        <DocumentoDatosFiscalesTab
                          values={fiscalValues}
                          onChange={(changes) => setForm((prev) => ({ ...prev, ...changes }))}
                          disabled={saving || loading}
                          visibleFields={{
                            forma_pago: true,
                            rfc_receptor: false,
                            nombre_receptor: false,
                            regimen_fiscal_receptor: false,
                            uso_cfdi: false,
                            metodo_pago: false,
                            codigo_postal_receptor: false,
                          }}
                          showCatalogNote={false}
                          compact
                        />
                      </Box>
                    </Grid>
                  </Grid>

                  {(form.moneda || 'MXN') !== 'MXN' && (
                    <Grid container spacing={2} alignItems="center">
                      <Grid size={{ xs: 12, md: 2 }}>
                        <NumericFormat
                          customInput={TextField}
                          label="Tipo de cambio"
                          value={Number(form.tipo_cambio ?? 1)}
                          onValueChange={(values) => setForm((prev) => ({ ...prev, tipo_cambio: values.floatValue && values.floatValue > 0 ? values.floatValue : 1 }))}
                          thousandSeparator="," 
                          decimalSeparator="."
                          decimalScale={4}
                          fixedDecimalScale={false}
                          allowNegative={false}
                          fullWidth
                          size="small"
                          InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                          inputProps={{ inputMode: 'decimal', style: { textAlign: 'right', fontSize: 13 } }}
                          sx={campoEncabezadoSx}
                        />
                      </Grid>
                    </Grid>
                  )}
                </>
              ) : (
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
                    disabled={lockedContacto}
                    onChange={(_, value) => {
                      if (lockedContacto) return;
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
                        label={contactoLabel}
                        required
                        size="small"
                        disabled={lockedContacto}
                        InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                        inputProps={{ ...params.inputProps, style: { fontSize: 13 } }}
                        sx={{
                          '& .MuiInputBase-input': {
                            fontSize: 13,
                            fontWeight: 400,
                            lineHeight: 1.4375,
                          },
                        }}
                      />
                    )}
                  />
                </Grid>
                {!usaCapturaEspecialNotaCredito && (
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
                        inputProps={{ ...params.inputProps }}
                        sx={campoEncabezadoSx}
                      />
                    )}
                  />
                </Grid>
                )}
                {!usaCapturaEspecialNotaCredito && (
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    label="Fecha documento"
                    type="date"
                    value={form.fecha_documento}
                    onChange={(e) => setForm((prev) => ({ ...prev, fecha_documento: e.target.value }))}
                    disabled={lockedFechaDocumento}
                    InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                    inputProps={{ style: { fontSize: 13 } }}
                    fullWidth
                    size="small"
                  />
                </Grid>
                )}
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
                      sx={campoEncabezadoSx}
                    >
                      {TRATAMIENTO_OPCIONES.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                )}
                {isNotaCredito && (
                  <Grid size={{ xs: 12, md: 2 }}>
                    <TextField
                      select
                      label="Motivo NC"
                      value={motivoNotaCredito}
                      onChange={(e) => handleMotivoNotaCreditoChange(e.target.value as MotivoNotaCredito)}
                      fullWidth
                      size="small"
                      InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                      sx={campoEncabezadoSx}
                    >
                      <MenuItem value="otro">Otro</MenuItem>
                      <MenuItem value="devolucion">Devolucion</MenuItem>
                      <MenuItem value="bonificacion">Bonificacion</MenuItem>
                    </TextField>
                  </Grid>
                )}
                {isNotaCredito && (
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Autocomplete<ConceptoAutocompleteOption, false, false, false>
                      fullWidth
                      options={conceptosActivos}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      filterOptions={(options, params) => {
                        const filtered = filterConceptoOptions(options, params);
                        const inputValue = params.inputValue.trim();
                        const exists = options.some(
                          (option) => normalizarNombreConcepto(option.nombre_concepto) === normalizarNombreConcepto(inputValue)
                        );

                        if (inputValue && !exists) {
                          filtered.push(buildCreateConceptoOption(inputValue));
                        }

                        return filtered;
                      }}
                      getOptionLabel={(option) => {
                        if (typeof option === 'string') return option;
                        if ('kind' in option && option.kind === 'create') return option.nombre_concepto;
                        return option.nombre_concepto || '';
                      }}
                      value={conceptosActivos.find((concepto) => concepto.id === form.concepto_id) || null}
                      onChange={(_, value) => {
                        if (!value) {
                          conceptoManualOverrideRef.current = true;
                          setForm((prev) => ({ ...prev, concepto_id: null }));
                          return;
                        }

                        if ('kind' in value && value.kind === 'create') {
                          conceptoManualOverrideRef.current = true;
                          setCrearConceptoNombre(value.inputValue || '');
                          setCrearConceptoError(null);
                          setCrearConceptoOpen(true);
                          return;
                        }

                        conceptoManualOverrideRef.current = true;
                        setForm((prev) => ({ ...prev, concepto_id: value.id }));
                      }}
                      renderOption={(props, option) => {
                        const { key, ...rest } = props;
                        if ('kind' in option && option.kind === 'create') {
                          return (
                            <li {...rest} key={option.id ?? key}>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <AddIcon fontSize="small" />
                                <Typography variant="body2">{option.nombre_concepto}</Typography>
                              </Stack>
                            </li>
                          );
                        }

                        return (
                          <li {...rest} key={option.id ?? key}>
                            {option.nombre_concepto || ''}
                          </li>
                        );
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...(params as any)}
                          fullWidth
                          label="Concepto"
                          size="small"
                          InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                          inputProps={{ ...params.inputProps }}
                          sx={campoEncabezadoSx}
                        />
                      )}
                    />
                  </Grid>
                )}
                {isNotaCreditoManual && (
                  <Grid size={{ xs: 12, md: 2 }}>
                    <TextField
                      label="Monto total"
                      value={notaCreditoManualTotalInput}
                      onChange={(e) => handleNotaCreditoManualTotalChange(e.target.value)}
                      onFocus={handleNotaCreditoManualTotalFocus}
                      onBlur={handleNotaCreditoManualTotalBlur}
                      type="text"
                      inputMode="decimal"
                      fullWidth
                      size="small"
                      InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                      inputProps={{ style: { textAlign: 'right', fontSize: 13 } }}
                    />
                  </Grid>
                )}
                {!esDocumentoMonetario && (
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
                )}
                {!esDocumentoMonetario && !usaPartidas && (
                  <>
                    <Grid size={{ xs: 12, md: 2 }}>
                      <TextField
                        label="Subtotal"
                        type="number"
                        value={form.subtotal ?? 0}
                        onChange={(e) => syncDocumentoMonetarioTotals(e.target.value)}
                        fullWidth
                        size="small"
                        InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                        inputProps={{ min: 0, step: '0.01', style: { textAlign: 'right', fontSize: 13 } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 2 }}>
                      <TextField
                        label="Total"
                        type="number"
                        value={form.total ?? 0}
                        onChange={(e) => syncDocumentoMonetarioTotals(e.target.value)}
                        fullWidth
                        size="small"
                        InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                        inputProps={{ min: 0, step: '0.01', style: { textAlign: 'right', fontSize: 13 } }}
                      />
                    </Grid>
                  </>
                )}
                {!usaCapturaEspecialNotaCredito && !esDocumentoMonetario && (
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    label="Descuento global %"
                    type="number"
                    value={form.descuento_global ?? 0}
                    onChange={(e) => handleDescuentoGlobalChange(e.target.value)}
                    disabled={!usaPartidas || permiteCapturaManualSinPartidas}
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                    inputProps={{ min: 0, max: 100, step: 0.0001, style: { textAlign: 'right', fontSize: 13 } }}
                  />
                </Grid>
                )}
              </Grid>
              )}

              {esDocumentoMonetario && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={700} color="#1d2f68">
                        Aplicaciones del pago
                      </Typography>
                    </Box>
                    {useMobilePaymentApplicationCards ? (
                      <Stack spacing={1} sx={{ width: '100%' }}>
                        <Box
                          sx={{
                            border: '1px solid #bbf7d0',
                            backgroundColor: saldoDisponibleDocumentoMonetario > 0 ? '#f0fdf4' : '#f8fafc',
                            borderRadius: 2,
                            px: 1.5,
                            py: 1.25,
                          }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            Disponible para aplicar
                          </Typography>
                          <Typography variant="h6" fontWeight={700} color={saldoDisponibleDocumentoMonetario > 0 ? '#15803d' : '#475569'}>
                            {formatter.format(saldoDisponibleDocumentoMonetario)}
                          </Typography>
                        </Box>
                        <Button
                          variant="contained"
                          fullWidth
                          onClick={() => { void handleAutoApplyDocumentoMonetario(); }}
                          disabled={autoApplyingDocumentoMonetario || !form.contacto_principal_id || saldoDisponibleDocumentoMonetario <= 0 || documentosCargoMonetarios.length === 0}
                        >
                          {autoApplyingDocumentoMonetario ? 'Distribuyendo...' : 'Distribuir automaticamente'}
                        </Button>
                      </Stack>
                    ) : (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip label={`Disponible para aplicar: ${formatter.format(saldoDisponibleDocumentoMonetario)}`} variant="outlined" color={saldoDisponibleDocumentoMonetario > 0 ? 'success' : 'default'} />
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => { void handleAutoApplyDocumentoMonetario(); }}
                          disabled={autoApplyingDocumentoMonetario || !form.contacto_principal_id || saldoDisponibleDocumentoMonetario <= 0 || documentosCargoMonetarios.length === 0}
                        >
                          {autoApplyingDocumentoMonetario ? 'Distribuyendo...' : 'Distribuir automaticamente'}
                        </Button>
                      </Stack>
                    )}
                  </Stack>

                  {!form.contacto_principal_id ? (
                    <Alert severity="info">Selecciona un {contactoLabel.toLowerCase()} para cargar documentos de cargo pendientes.</Alert>
                  ) : loadingDocumentosCargoMonetarios ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="text.secondary">Cargando estado de cuenta...</Typography>
                    </Stack>
                  ) : documentosCargoMonetarios.length === 0 ? (
                    <Alert severity="info">No hay documentos de cargo con saldo disponibles para este contacto y moneda.</Alert>
                  ) : useMobilePaymentApplicationCards ? (
                    <Stack spacing={1.25}>
                      {documentosCargoMonetarios.map((item) => (
                        <Box
                          key={item.id}
                          sx={{
                            border: '1px solid #dbe5f0',
                            borderRadius: 2,
                            backgroundColor: '#fff',
                            p: 1.5,
                            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
                          }}
                        >
                          <Stack spacing={1.25}>
                            <Box>
                              <Typography variant="subtitle2" fontWeight={700} color="#1d2f68">
                                {formatearFolioDocumento(item.serie || '', item.numero || 0) || '—'}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Fecha: {normalizeCivilDate(item.fecha) || '—'}
                              </Typography>
                            </Box>

                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Saldo pendiente
                              </Typography>
                              <Typography variant="h6" fontWeight={700} color="#0f172a">
                                {formatter.format(Number(item.saldo || 0))}
                              </Typography>
                            </Box>

                            <NumericFormat
                              customInput={TextField}
                              size="small"
                              fullWidth
                              label="Monto a aplicar"
                              value={montosAplicacionMonetaria[item.id] ?? ''}
                              thousandSeparator="," 
                              decimalSeparator="."
                              decimalScale={2}
                              fixedDecimalScale
                              allowNegative={false}
                              prefix="$"
                              onValueChange={(values) => setMontosAplicacionMonetaria((prev) => ({
                                ...prev,
                                [item.id]: values.value,
                              }))}
                              inputProps={{ inputMode: 'decimal', style: { textAlign: 'right' } }}
                              sx={{
                                ...campoEncabezadoSx,
                                '& .MuiOutlinedInput-root': { minHeight: 40 },
                              }}
                            />

                            <Button
                              variant="outlined"
                              fullWidth
                              onClick={() => { handleApplyDocumentoMonetario(item); }}
                              disabled={saldoDisponibleDocumentoMonetario + (Number(montosAplicacionMonetaria[item.id] ?? 0) || 0) <= 0}
                            >
                              Aplicar todo
                            </Button>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <TableContainer sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={compactTableCellSx}>Folio</TableCell>
                            <TableCell sx={compactTableCellSx}>Fecha</TableCell>
                            <TableCell align="right" sx={compactTableCellSx}>Saldo pendiente</TableCell>
                            <TableCell sx={compactTableCellSx}>Monto a aplicar</TableCell>
                            <TableCell align="center" sx={compactTableCellSx}>Acción</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {documentosCargoMonetarios.map((item) => (
                            <TableRow key={item.id} hover>
                              <TableCell sx={compactTableCellSx}>{formatearFolioDocumento(item.serie || '', item.numero || 0) || '—'}</TableCell>
                              <TableCell sx={compactTableCellSx}>{normalizeCivilDate(item.fecha) || '—'}</TableCell>
                              <TableCell align="right" sx={compactTableCellSx}>{formatter.format(Number(item.saldo || 0))}</TableCell>
                              <TableCell sx={{ width: 220 }}>
                                <NumericFormat
                                  customInput={TextField}
                                  size="small"
                                  fullWidth
                                  value={montosAplicacionMonetaria[item.id] ?? ''}
                                  thousandSeparator="," 
                                  decimalSeparator="."
                                  decimalScale={2}
                                  fixedDecimalScale
                                  allowNegative={false}
                                  prefix="$"
                                  onValueChange={(values) => setMontosAplicacionMonetaria((prev) => ({
                                    ...prev,
                                    [item.id]: values.value,
                                  }))}
                                  inputProps={{ inputMode: 'decimal', style: { textAlign: 'right', fontSize: 13 } }}
                                  sx={{
                                    ...campoEncabezadoSx,
                                    '& .MuiOutlinedInput-root': { minHeight: 38 },
                                  }}
                                />
                              </TableCell>
                              <TableCell align="center" sx={compactTableCellSx}>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() => { handleApplyDocumentoMonetario(item); }}
                                  disabled={saldoDisponibleDocumentoMonetario + (Number(montosAplicacionMonetaria[item.id] ?? 0) || 0) <= 0}
                                >
                                  Aplicar todo
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}

              {isNotaCreditoManual && (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
                  <TextField
                    label="Subtotal"
                    value={formatter.format(Number(form.subtotal ?? 0))}
                    size="small"
                    InputProps={{ readOnly: true, style: { textAlign: 'right' } }}
                  />
                  <TextField
                    label="IVA"
                    value={formatter.format(Number(form.iva ?? 0))}
                    size="small"
                    InputProps={{ readOnly: true, style: { textAlign: 'right' } }}
                  />
                  <TextField
                    label="Total"
                    value={formatter.format(Number(form.total ?? 0))}
                    size="small"
                    InputProps={{ readOnly: true, style: { textAlign: 'right' } }}
                  />
                </Box>
              )}

              {(isNotaCreditoDevolucion || isNotaCreditoBonificacion) && (
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={700} color="#1d2f68">
                        Partidas disponibles para {isNotaCreditoDevolucion ? 'devolución' : 'bonificación'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        El sistema carga automáticamente todas las partidas pendientes del {contactoLabel.toLowerCase()}.
                      </Typography>
                    </Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Chip label={`${documentosOrigenCliente.length} factura(s)`} size="small" variant="outlined" />
                      <Chip label={`${partidasNotaCreditoDisponibles.length} partida(s) disponibles`} size="small" variant="outlined" />
                    </Stack>
                  </Stack>

                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} flexWrap="wrap">
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setLineasSeleccionadasNotaCreditoEspecial(Object.fromEntries(partidasNotaCreditoVisibles.map((partida) => [partida.partida_id, true])))}
                      disabled={partidasNotaCreditoVisibles.length === 0}
                    >
                      Seleccionar todo
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        setLineasSeleccionadasNotaCreditoEspecial({});
                        setValoresEspecialesNotaCredito((prev) => Object.fromEntries(Object.keys(prev).map((key) => [Number(key), 0])));
                      }}
                      disabled={partidasNotaCreditoDisponibles.length === 0}
                    >
                      Limpiar selección
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => {
                        setLineasSeleccionadasNotaCreditoEspecial(Object.fromEntries(partidasNotaCreditoVisibles.map((partida) => [partida.partida_id, true])));
                        setValoresEspecialesNotaCredito((prev) => ({
                          ...prev,
                          ...Object.fromEntries(partidasNotaCreditoVisibles.map((partida) => [partida.partida_id, getMaximoCapturableNotaCredito(partida)])),
                        }));
                      }}
                      disabled={partidasNotaCreditoVisibles.length === 0}
                    >
                      {isNotaCreditoDevolucion ? 'Devolver completos' : 'Bonificar completos'}
                    </Button>
                  </Stack>

                  <TextField
                    label="Buscar por factura, producto o descripción"
                    value={busquedaNotaCreditoEspecial}
                    onChange={(e) => setBusquedaNotaCreditoEspecial(e.target.value)}
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                    inputProps={{ style: { fontSize: 13 } }}
                  />

                  {!form.contacto_principal_id && (
                    <Alert severity="info">Selecciona un {contactoLabel.toLowerCase()} para cargar automáticamente las partidas disponibles.</Alert>
                  )}

                  {form.contacto_principal_id && loadingPreparacionNotaCredito && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="text.secondary">Cargando partidas disponibles...</Typography>
                    </Stack>
                  )}

                  {form.contacto_principal_id && !loadingPreparacionNotaCredito && partidasNotaCreditoDisponibles.length === 0 && (
                    <Alert severity="info">No hay partidas disponibles para devolución o bonificación para este {contactoLabel.toLowerCase()}.</Alert>
                  )}

                  {preparacionNotaCredito && partidasNotaCreditoDisponibles.length > 0 && (
                    <Paper variant="outlined" sx={{ borderColor: '#e5e7eb', overflow: 'hidden' }}>
                      <Box sx={{ overflowX: 'auto' }}>
                        <Box sx={{ minWidth: isNotaCreditoDevolucion ? 980 : 980 }}>
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: isNotaCreditoDevolucion ? '52px 240px 120px 130px 120px 120px 120px' : '52px 240px 90px 120px 140px 150px 120px',
                              gap: 1,
                              px: 1.25,
                              py: 1,
                              bgcolor: '#f8fafc',
                              borderBottom: '1px solid #e5e7eb',
                            }}
                          >
                            {(isNotaCreditoDevolucion
                              ? ['Sel.', 'Factura / producto', 'Disponible', 'A devolver', 'Precio', 'Total', 'Acción']
                              : ['Sel.', 'Factura / producto', 'Cantidad', 'Precio unitario', 'Subtotal partida', 'Monto bonificado', 'Acción']
                            ).map((header) => (
                              <Typography key={header} variant="caption" sx={{ fontWeight: 800, color: '#475569', fontSize: 11.5 }}>
                                {header}
                              </Typography>
                            ))}
                          </Box>

                          <Stack divider={<Divider flexItem />}>
                            {partidasNotaCreditoVisibles.map((partida) => {
                              const documentoOrigen = documentosOrigenPorId[partida.documento_origen_id];
                              const producto = partida.producto_id ? productos.find((item) => item.id === partida.producto_id) : null;
                              const detalle = detallePartidasNotaCreditoEspecial[partida.partida_id] ?? { subtotal: 0, iva: 0, total: 0 };
                              const folio = formatearFolioDocumento(documentoOrigen?.serie ?? '', Number(documentoOrigen?.numero ?? 0))
                                || partida.documento_origen_folio
                                || String(partida.documento_origen_id);
                              const fecha = documentoOrigen?.fecha_documento ? normalizeCivilDate(documentoOrigen.fecha_documento) : '';
                              const seleccionada = isPartidaNotaCreditoEspecialSeleccionada(partida.partida_id);
                              const maximo = getMaximoCapturableNotaCredito(partida);

                              return (
                                <Box
                                  key={partida.partida_id}
                                  sx={{
                                    display: 'grid',
                                    gridTemplateColumns: isNotaCreditoDevolucion ? '52px 240px 120px 130px 120px 120px 120px' : '52px 240px 90px 120px 140px 150px 120px',
                                    gap: 1,
                                    px: 1.25,
                                    py: 1,
                                    alignItems: 'center',
                                  }}
                                >
                                  <Checkbox
                                    checked={seleccionada}
                                    onChange={(_, checked) => {
                                      setLineasSeleccionadasNotaCreditoEspecial((prev) => ({ ...prev, [partida.partida_id]: checked }));
                                      if (!checked) {
                                        setValoresEspecialesNotaCredito((prev) => ({ ...prev, [partida.partida_id]: 0 }));
                                      }
                                    }}
                                    size="small"
                                  />
                                  <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="body2" fontWeight={700} noWrap>{folio}</Typography>
                                    <Typography variant="body2" noWrap>{producto?.clave || producto?.descripcion || partida.descripcion || 'Sin descripción'}</Typography>
                                    <Typography variant="caption" color="text.secondary" noWrap>
                                      {fecha || '-'} · Facturado {Number(partida.cantidad_origen ?? 0).toFixed(2)} · Ya devuelto {Number(partida.cantidad_ya_generada ?? 0).toFixed(2)}
                                    </Typography>
                                  </Box>
                                  <Typography variant="body2" textAlign="right" fontWeight={600}>
                                    {isNotaCreditoDevolucion
                                      ? Number(partida.cantidad_pendiente_sugerida ?? 0).toFixed(2)
                                      : Number(partida.cantidad_pendiente_sugerida ?? 0).toFixed(2)}
                                  </Typography>
                                  {!isNotaCreditoDevolucion && (
                                    <Typography variant="body2" textAlign="right">{formatter.format(Number(partida.precio_unitario ?? 0))}</Typography>
                                  )}
                                  {!isNotaCreditoDevolucion && (
                                    <Typography variant="body2" textAlign="right">{formatter.format(Number(partida.importe_maximo_sugerido ?? 0))}</Typography>
                                  )}
                                  <TextField
                                    type={isNotaCreditoDevolucion ? 'number' : 'text'}
                                    value={isNotaCreditoBonificacion
                                      ? (bonificacionInputDisplay[partida.partida_id] ?? formatMontoBonificacionInput(Number(valoresEspecialesNotaCredito[partida.partida_id] ?? 0)))
                                      : (valoresEspecialesNotaCredito[partida.partida_id] ?? 0)}
                                    disabled={false}
                                    onChange={(e) => {
                                      const rawValue = String(e.target.value ?? '');
                                      const valor = isNotaCreditoBonificacion
                                        ? parseMontoBonificacionInput(rawValue)
                                        : Math.max(0, Number(rawValue) || 0);
                                      if (isNotaCreditoBonificacion) {
                                        setBonificacionInputDisplay((prev) => ({
                                          ...prev,
                                          [partida.partida_id]: sanitizeMontoBonificacionInput(rawValue),
                                        }));
                                      }
                                      setLineasSeleccionadasNotaCreditoEspecial((prev) => ({ ...prev, [partida.partida_id]: valor > 0 }));
                                      setValoresEspecialesNotaCredito((prev) => ({
                                        ...prev,
                                        [partida.partida_id]: isNotaCreditoDevolucion
                                          ? Math.min(valor, Number(partida.cantidad_pendiente_sugerida ?? 0))
                                          : Math.min(valor, Number(partida.importe_maximo_sugerido ?? 0)),
                                      }));
                                    }}
                                    onFocus={() => {
                                      if (!isNotaCreditoBonificacion) return;
                                      setBonificacionInputFocusedId(partida.partida_id);
                                      setBonificacionInputDisplay((prev) => ({
                                        ...prev,
                                        [partida.partida_id]: Number(valoresEspecialesNotaCredito[partida.partida_id] ?? 0).toFixed(2),
                                      }));
                                    }}
                                    onBlur={() => {
                                      if (!isNotaCreditoBonificacion) return;
                                      setBonificacionInputFocusedId((prev) => (prev === partida.partida_id ? null : prev));
                                      setBonificacionInputDisplay((prev) => ({
                                        ...prev,
                                        [partida.partida_id]: formatMontoBonificacionInput(Number(valoresEspecialesNotaCredito[partida.partida_id] ?? 0)),
                                      }));
                                    }}
                                    size="small"
                                    InputProps={isNotaCreditoBonificacion ? {
                                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                    } : undefined}
                                    sx={isNotaCreditoBonificacion ? {
                                      '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                                        WebkitAppearance: 'none',
                                        margin: 0,
                                      },
                                      '& input[type=number], & input[type=text]': {
                                        MozAppearance: 'textfield',
                                      },
                                    } : undefined}
                                    inputProps={{
                                      inputMode: isNotaCreditoBonificacion ? 'decimal' : undefined,
                                      min: 0,
                                      max: maximo,
                                      step: 0.01,
                                      style: { textAlign: 'right', fontSize: 13 },
                                    }}
                                  />
                                  {isNotaCreditoDevolucion && (
                                    <Typography variant="body2" textAlign="right">{formatter.format(Number(partida.precio_unitario ?? 0))}</Typography>
                                  )}
                                  {isNotaCreditoDevolucion && (
                                    <Typography variant="body2" textAlign="right" fontWeight={700}>
                                      {formatter.format(detalle.total)}
                                    </Typography>
                                  )}
                                  <Tooltip title={isNotaCreditoDevolucion ? 'Llena automáticamente la cantidad disponible para devolver.' : 'Llena automáticamente la bonificación total con el subtotal completo de la partida.'}>
                                    <span>
                                      <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => {
                                          setLineasSeleccionadasNotaCreditoEspecial((prev) => ({ ...prev, [partida.partida_id]: true }));
                                          setValoresEspecialesNotaCredito((prev) => ({ ...prev, [partida.partida_id]: maximo }));
                                        }}
                                      >
                                        {isNotaCreditoDevolucion ? 'Devolver todo' : 'Bonificar todo'}
                                      </Button>
                                    </span>
                                  </Tooltip>
                                </Box>
                              );
                            })}
                          </Stack>
                        </Box>
                      </Box>
                    </Paper>
                  )}

                  {preparacionNotaCredito && partidasNotaCreditoDisponibles.length > 0 && partidasNotaCreditoVisibles.length === 0 && !loadingPreparacionNotaCredito && (
                    <Alert severity="info">No hay coincidencias para la búsqueda actual.</Alert>
                  )}
                </Stack>
              )}

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

              {!usaCapturaEspecialNotaCredito && usaPartidas && <Divider />}

              {!usaCapturaEspecialNotaCredito && usaPartidas && (
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Typography variant="h6" color="#1d2f68" fontWeight={700}>
                  Partidas
                </Typography>
                <Button startIcon={<AddIcon />} onClick={addRow} variant="outlined" size="small">
                  Agregar partida
                </Button>
              </Stack>
              )}

              {!usaCapturaEspecialNotaCredito && usaPartidas && (
              <Stack spacing={1}>
                {partidas.map((partida, index) => (
                  (() => {
                    const productoSeleccionado = productos.find((p) => p.id === partida.producto_id) || null;
                    const ivaPartida = (partida.impuestos ?? []).reduce((acc, imp: any) => {
                      const monto = Number(imp.monto ?? 0);
                      const esRetencion = (imp.tipo ?? '').toLowerCase() === 'retencion';
                      return acc + (esRetencion ? -monto : monto);
                    }, 0);
                    const breakdown = getPartidaDiscountBreakdown(partida, form.descuento_global ?? 0);
                    const isExpanded = mobileExpandedPartidas[index] ?? false;

                    if (useCompactMobilePartidas) {
                      return (
                        <Paper
                          key={index}
                          variant="outlined"
                          sx={{
                            p: 1.5,
                            borderRadius: 1.75,
                            border: '1.5px solid',
                            borderColor: '#96a7c7',
                            bgcolor: '#ffffff',
                            boxShadow: '0 1px 0 rgba(29, 47, 104, 0.06)',
                            mb: 1.5,
                          }}
                        >
                          <Stack spacing={1.25}>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="subtitle2" fontWeight={800} color="#1d2f68" sx={{ wordBreak: 'break-word' }}>
                                  {productoSeleccionado?.clave || productoSeleccionado?.descripcion || partida.descripcion_alterna || 'Producto sin seleccionar'}
                                </Typography>
                                {productoSeleccionado?.descripcion && productoSeleccionado?.clave ? (
                                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, wordBreak: 'break-word' }}>
                                    {productoSeleccionado.descripcion}
                                  </Typography>
                                ) : null}
                              </Box>
                              <IconButton size="small" aria-label="Acciones de la partida" onClick={(event) => handleOpenMobilePartidaMenu(event, index)}>
                                <MoreVertIcon fontSize="small" />
                              </IconButton>
                            </Stack>

                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
                              {[
                                { label: 'Cantidad', value: decimalFormatter.format(Number(partida.cantidad ?? 0)) },
                                { label: 'Precio', value: formatter.format(Number(partida.precio_unitario ?? 0)) },
                                { label: 'Total', value: formatter.format(Number(partida.total_partida ?? 0)) },
                              ].map((item) => (
                                <Box key={item.label} sx={{ minWidth: 0 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 11.5 }}>
                                    {item.label}
                                  </Typography>
                                  <Typography variant="body2" fontWeight={item.label === 'Total' ? 800 : 700} color={item.label === 'Total' ? '#111827' : 'text.primary'} noWrap>
                                    {item.value}
                                  </Typography>
                                </Box>
                              ))}
                            </Box>

                            <Button
                              variant={isExpanded ? 'text' : 'outlined'}
                              size="small"
                              onClick={() => handleToggleMobilePartida(index)}
                              endIcon={isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                              sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
                            >
                              {isExpanded ? 'Ocultar' : 'Editar'}
                            </Button>

                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <Stack spacing={1.25} sx={{ pt: 0.5 }}>
                                <Autocomplete<ProductoAutocompleteOption>
                                  options={productosAutocompleteOptions}
                                  loading={productos.length === 0}
                                  getOptionLabel={(option) => option.clave || ''}
                                  isOptionEqualToValue={(option, value) => option.id === value.id}
                                  value={productoSeleccionado}
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
                                        minWidth: 300,
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
                                        gridTemplateColumns: '120px 1fr',
                                        columnGap: 1.5,
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
                                />

                                <TextField
                                  label="Descripción"
                                  value={partida.descripcion_alterna ?? ''}
                                  onChange={(e) => handleDescripcionChange(index, e.target.value)}
                                  size="small"
                                  InputProps={{ sx: { fontSize: 13 } }}
                                  inputProps={{ style: { fontSize: 13 } }}
                                  disabled
                                />

                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
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
                                    value={editingPrecio[index] ? precioInputs[index] ?? '' : formatter.format(partida.precio_unitario ?? 0)}
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
                                    onFocus={() => {
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
                                </Box>

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
                                  title={(
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
                                  )}
                                >
                                  <Paper variant="outlined" sx={{ px: 1.25, py: 1, borderRadius: 1.5, borderColor: '#e5e7eb', bgcolor: '#f8fafc' }}>
                                    <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontSize: 11.5, mb: 0.5 }}>
                                      Resumen calculado
                                    </Typography>
                                    <Stack spacing={0.35}>
                                      <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                                        <Box component="span" color="text.secondary">Subtotal</Box>
                                        <Box component="span" fontWeight={700}>{formatter.format(partida.subtotal_partida ?? 0)}</Box>
                                      </Typography>
                                      <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                                        <Box component="span" color="text.secondary">IVA</Box>
                                        <Box component="span" fontWeight={700}>{formatter.format(ivaPartida)}</Box>
                                      </Typography>
                                      <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, color: '#111827' }}>
                                        <Box component="span" color="text.secondary">Total</Box>
                                        <Box component="span" fontWeight={800}>{formatter.format(partida.total_partida ?? 0)}</Box>
                                      </Typography>
                                    </Stack>
                                  </Paper>
                                </Tooltip>

                                {partidasMostrarEsParteOportunidad && (
                                  <Box display="flex" alignItems="center" gap={1}>
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
                                    <Typography variant="body2" color="text.secondary">
                                      Cuenta para oportunidad
                                    </Typography>
                                  </Box>
                                )}

                                {camposPartida.campos.length > 0 && (
                                  <Box
                                    sx={{
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
                                )}
                              </Stack>
                            </Collapse>
                          </Stack>
                        </Paper>
                      );
                    }

                    return (
                      <React.Fragment key={index}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.75,
                            borderRadius: 1.75,
                            border: '1.75px solid',
                            borderColor: '#96a7c7',
                            bgcolor: '#ffffff',
                            boxShadow: '0 1px 0 rgba(29, 47, 104, 0.06)',
                            display: 'grid',
                            gridTemplateColumns: {
                              xs: '1fr',
                              md: partidasGridTemplate,
                            },
                            gap: { xs: 1, md: 1.25 },
                            alignItems: 'center',
                            mb: 2,
                          }}
                        >
                          <Autocomplete<ProductoAutocompleteOption>
                            options={productosAutocompleteOptions}
                            loading={productos.length === 0}
                            getOptionLabel={(option) => option.clave || ''}
                            isOptionEqualToValue={(option, value) => option.id === value.id}
                            value={productoSeleccionado}
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
                            value={editingPrecio[index] ? precioInputs[index] ?? '' : formatter.format(partida.precio_unitario ?? 0)}
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
                            onFocus={() => {
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
                            title={(
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
                            )}
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
                            value={formatter.format(ivaPartida)}
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
                          <Box sx={{ gridColumn: '1 / -1', mt: { xs: 0.5, md: 0.25 } }}>
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
                        </Paper>
                      </React.Fragment>
                    );
                  })()
                ))}

                {useCompactMobilePartidas && (
                  <Menu
                    anchorEl={mobilePartidaMenuAnchorEl}
                    open={Boolean(mobilePartidaMenuAnchorEl)}
                    onClose={handleCloseMobilePartidaMenu}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  >
                    {mobilePartidaMenuIndex !== null && partidasMostrarImagenes ? (
                      <MenuItem
                        onClick={() => {
                          const targetIndex = mobilePartidaMenuIndex;
                          handleCloseMobilePartidaMenu();
                          if (targetIndex !== null) {
                            abrirImagenDialog(targetIndex);
                          }
                        }}
                        disabled={Boolean(uploadingImagen[mobilePartidaMenuIndex])}
                      >
                        {partidas[mobilePartidaMenuIndex]?.archivo_imagen_1
                          ? 'Cambiar imagen'
                          : partidas[mobilePartidaMenuIndex]?.producto_archivo_id
                            ? 'Ver o cambiar imagen'
                            : 'Agregar imagen'}
                      </MenuItem>
                    ) : null}
                    {mobilePartidaMenuIndex !== null && partidasMostrarImagenes && partidas[mobilePartidaMenuIndex]?.archivo_imagen_1 ? (
                      <MenuItem
                        onClick={() => {
                          const targetIndex = mobilePartidaMenuIndex;
                          handleCloseMobilePartidaMenu();
                          if (targetIndex !== null) {
                            handleImagenRemove(targetIndex);
                          }
                        }}
                        disabled={Boolean(uploadingImagen[mobilePartidaMenuIndex])}
                      >
                        Eliminar imagen
                      </MenuItem>
                    ) : null}
                    {mobilePartidaMenuIndex !== null ? (
                      <MenuItem
                        onClick={() => {
                          const targetIndex = mobilePartidaMenuIndex;
                          handleCloseMobilePartidaMenu();
                          if (targetIndex !== null) {
                            toggleObservaciones(targetIndex);
                            setMobileExpandedPartidas((prev) => prev.map((item, itemIndex) => (itemIndex === targetIndex ? true : item)));
                          }
                        }}
                      >
                        {(expandedObs[mobilePartidaMenuIndex] || Boolean(partidas[mobilePartidaMenuIndex]?.observaciones?.trim()))
                          ? 'Ocultar observaciones'
                          : 'Agregar observaciones'}
                      </MenuItem>
                    ) : null}
                    {mobilePartidaMenuIndex !== null ? (
                      <MenuItem
                        onClick={() => {
                          const targetIndex = mobilePartidaMenuIndex;
                          handleCloseMobilePartidaMenu();
                          if (targetIndex !== null) {
                            removeRow(targetIndex);
                          }
                        }}
                        sx={{ color: 'error.main' }}
                      >
                        Eliminar partida
                      </MenuItem>
                    ) : null}
                  </Menu>
                )}
              </Stack>
              )}

              {mostrarResumenFinanciero && usaPartidas && <Divider />}

              {mostrarResumenFinanciero && usaPartidas && (
              useCompactMobilePartidas ? (
                <Paper variant="outlined" sx={{ borderRadius: 1.5, borderColor: '#dbe3f0', overflow: 'hidden' }}>
                  <ButtonBase
                    onClick={() => setMobileTotalsExpanded((prev) => !prev)}
                    sx={{
                      width: '100%',
                      px: 1.5,
                      py: 1.25,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800} color="#1d2f68">
                        Totales del documento
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatter.format(resumenFinanciero.total)}
                      </Typography>
                    </Box>
                    {mobileTotalsExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </ButtonBase>

                  <Collapse in={mobileTotalsExpanded} timeout="auto" unmountOnExit>
                    <Stack spacing={1} sx={{ px: 1.5, pb: 1.5 }}>
                      <Box
                        ref={resumenFinancieroRef}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: '1fr',
                          gap: 0.75,
                        }}
                      >
                        {[
                          { label: 'Subtotal bruto', value: resumenFinanciero.subtotalBruto, tone: '#334155' },
                          { label: 'Desc. partidas', value: -resumenFinanciero.descuentoPartidas, tone: '#b45309' },
                          { label: 'Desc. global', value: -resumenFinanciero.descuentoGlobal, tone: '#9a3412' },
                          { label: 'Subtotal neto', value: resumenFinanciero.subtotalNeto, tone: '#1d4ed8' },
                          ...(ocultarIvaPorTratamiento ? [] : [{ label: 'IVA', value: resumenFinanciero.iva, tone: '#0f766e' }]),
                          { label: 'Total', value: resumenFinanciero.total, tone: '#111827' },
                        ].map((item) => (
                          <Paper
                            key={item.label}
                            variant="outlined"
                            sx={{
                              px: 1.25,
                              py: 1,
                              borderRadius: 1.25,
                              borderColor: '#e5e7eb',
                              bgcolor: '#fbfdff',
                              minWidth: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 1,
                            }}
                          >
                            <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11.5 }}>
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
                              }}
                            >
                              {formatter.format(item.value)}
                            </Typography>
                          </Paper>
                        ))}
                      </Box>

                      {partidasMostrarMontoOportunidad && (
                        <TextField
                          label="Monto oportunidad"
                          value={formatter.format(montoOportunidad)}
                          InputProps={{ readOnly: true, sx: { fontSize: 13, fontWeight: 700 }, style: { textAlign: 'right' } }}
                          size="small"
                          fullWidth
                        />
                      )}
                    </Stack>
                  </Collapse>
                </Paper>
              ) : (
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
                  { label: 'Subtotal bruto', value: resumenFinanciero.subtotalBruto, tone: '#334155' },
                  { label: 'Desc. partidas', value: -resumenFinanciero.descuentoPartidas, tone: '#b45309' },
                  { label: 'Desc. global', value: -resumenFinanciero.descuentoGlobal, tone: '#9a3412' },
                  { label: 'Subtotal neto', value: resumenFinanciero.subtotalNeto, tone: '#1d4ed8' },
                  ...(ocultarIvaPorTratamiento ? [] : [{ label: 'IVA', value: resumenFinanciero.iva, tone: '#0f766e' }]),
                  { label: 'Total', value: resumenFinanciero.total, tone: '#111827' },
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
              )
              )}
              {(!useCompactMobilePartidas && usaPartidas && partidasMostrarMontoOportunidad) && (
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

      {mostrarResumenFinancieroStickyVisible && usaPartidas && (
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
              { label: 'Bruto', value: resumenFinanciero.subtotalBruto, tone: '#334155' },
              ...(resumenFinanciero.descuentoPartidas + resumenFinanciero.descuentoGlobal > 0
                ? [{ label: 'Desc', value: -(resumenFinanciero.descuentoPartidas + resumenFinanciero.descuentoGlobal), tone: '#9a3412' }]
                : []),
              { label: 'Neto', value: resumenFinanciero.subtotalNeto, tone: '#1d4ed8' },
              ...(ocultarIvaPorTratamiento ? [] : [{ label: 'IVA', value: resumenFinanciero.iva, tone: '#0f766e' }]),
              { label: 'Total', value: resumenFinanciero.total, tone: '#111827', strong: true },
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

      <Dialog open={conceptoObligatorioDialog.open} onClose={() => setConceptoObligatorioDialog({ open: false, message: '' })}>
        <DialogTitle fontWeight={700}>Concepto obligatorio</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#374151' }}>
            {conceptoObligatorioDialog.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={() => setConceptoObligatorioDialog({ open: false, message: '' })}>
            Entendido
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={crearConceptoOpen}
        onClose={() => {
          if (!crearConceptoLoading) {
            limpiarCrearConceptoDialog();
          }
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle fontWeight={700}>Crear concepto</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1.5 }}>
          <TextField
            autoFocus
            label="Nombre del concepto"
            value={crearConceptoNombre}
            onChange={(e) => {
              setCrearConceptoNombre(e.target.value);
              if (crearConceptoError) setCrearConceptoError(null);
            }}
            fullWidth
            size="small"
            error={Boolean(crearConceptoError)}
            helperText={crearConceptoError || 'Se seleccionará automáticamente al guardar.'}
            InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
            sx={campoEncabezadoSx}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button disabled={crearConceptoLoading} onClick={() => limpiarCrearConceptoDialog()}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void handleCrearConceptoSubmit()} disabled={crearConceptoLoading}>
            {crearConceptoLoading ? 'Guardando...' : 'Guardar'}
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
          tipoDocumento={tipoDocumento}
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
