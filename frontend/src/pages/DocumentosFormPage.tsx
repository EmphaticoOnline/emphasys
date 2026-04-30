import * as React from 'react';
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  MenuItem,
  Toolbar,
  Typography,
  Divider,
  Snackbar,
  Tabs,
  Tab,
} from '@mui/material';

import Grid from '@mui/material/Grid';

import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CommentIcon from '@mui/icons-material/ModeCommentOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import DynamicFieldControl from '../components/DynamicFieldControl';
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
import { fetchProductos } from '../services/productosService';
import type { Producto } from '../types/producto';
import type { Contacto, ContactoDetalle } from '../types/contactos.types';
import { getEmpresaActivaId } from '../utils/empresaUtils';
import { useSession } from '../session/useSession';
import type { ImpuestoEntrada, ImpuestoCalculadoUI } from '../utils/impuestos';
import { calcularImpuestosPreview } from '../services/documentosService';
import { DocumentoDatosFiscalesTab } from '../modules/documentos';
import { FacturaPagosDrawer } from '../modules/finanzas/FacturaPagosDrawer';
import { DEFAULT_ESTADO_SEGUIMIENTO } from '../modules/cotizaciones/estadoSeguimiento';
import { crearContacto, getContacto } from '../services/contactos.api';
import { fetchSaldoDocumento } from '../services/finanzasService';
import {
  guardarCamposDocumento,
  guardarCamposPartida,
  fetchCamposDocumento,
  fetchCamposPartida,
} from '../services/camposDinamicosService';
import type { CampoValorPayload, CampoValorGuardado } from '../types/camposDinamicos';

const defaultFecha = () => new Date().toISOString().substring(0, 10);
const validarRFC = (rfc: string) => /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/i.test(rfc);

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
  subtotal_partida: 0,
  total_partida: 0,
  archivo_imagen_1: null,
  producto: null,
  observaciones: '',
  impuestos: [],
  impuestos_calculados: [],
});

type DocumentosFormPageProps = {
  tipoDocumento?: TipoDocumento;
};

const TEXTOS: Record<string, { nuevo: string; editar: string; descripcion: string; guardado: string; cargando: string; singular: string }> = {
  cotizacion: {
    nuevo: 'Nueva cotización',
    editar: 'Editar cotización',
    descripcion: 'Captura el encabezado y las partidas de la cotización.',
    guardado: 'Cotización guardada',
    cargando: 'Cargando cotización...',
    singular: 'cotización',
  },
  factura: {
    nuevo: 'Nueva factura',
    editar: 'Editar factura',
    descripcion: 'Captura el encabezado y las partidas de la factura.',
    guardado: 'Factura guardada',
    cargando: 'Cargando factura...',
    singular: 'factura',
  },
  pedido: {
    nuevo: 'Nuevo pedido',
    editar: 'Editar pedido',
    descripcion: 'Captura el encabezado y las partidas del pedido.',
    guardado: 'Pedido guardado',
    cargando: 'Cargando pedido...',
    singular: 'pedido',
  },
  remision: {
    nuevo: 'Nueva remisión',
    editar: 'Editar remisión',
    descripcion: 'Captura el encabezado y las partidas de la remisión.',
    guardado: 'Remisión guardada',
    cargando: 'Cargando remisión...',
    singular: 'remisión',
  },
};

const ENTIDAD_TIPO_DOCUMENTO = 'DOCUMENTO';
const ENTIDAD_TIPO_PARTIDA = 'DOCUMENTO_PARTIDA';

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

export default function DocumentosFormPage({ tipoDocumento: propTipo }: DocumentosFormPageProps) {
  const { id, codigo } = useParams();
  const { session } = useSession();
  const sessionUserId = session.user?.id ?? null;
  const tipoDocumento = (propTipo ?? (codigo as TipoDocumento)) || 'cotizacion';
  const isCotizacion = tipoDocumento === 'cotizacion';
  const isEdit = Boolean(id && id !== 'nuevo');
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = `/ventas/${tipoDocumento}`;
  const showFiscalTab = tipoDocumento === 'factura';
  const textos = TEXTOS[tipoDocumento] ?? {
    nuevo: 'Nuevo documento',
    editar: 'Editar documento',
    descripcion: 'Crea o edita documentos.',
    guardado: 'Documento guardado',
    cargando: 'Cargando documento...',
    singular: 'documento',
  };

  const [form, setForm] = useState<CotizacionCrearPayload>({
    tipo_documento: tipoDocumento,
    serie: tipoDocumento === 'factura' ? 'FAC' : null,
    contacto_principal_id: null,
    agente_id: null,
    fecha_documento: defaultFecha(),
    moneda: 'MXN',
    observaciones: '',
    subtotal: 0,
    iva: 0,
    total: 0,
    usuario_creacion_id: sessionUserId ?? null,
    empresa_id: getEmpresaActivaId(),
    estado_seguimiento: isCotizacion ? DEFAULT_ESTADO_SEGUIMIENTO : null,
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
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [vendedores, setVendedores] = useState<Contacto[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState<boolean>(isEdit);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [openPagos, setOpenPagos] = useState(false);
  const [saldoDocumento, setSaldoDocumento] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>(
    { open: false, message: '', severity: 'success' }
  );
  const [duplicateDialog, setDuplicateDialog] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [activeTab, setActiveTab] = useState<number>(0);
  const [crearClienteOpen, setCrearClienteOpen] = useState(false);
  const [crearClienteNombre, setCrearClienteNombre] = useState('');
  const [crearClienteTipo, setCrearClienteTipo] = useState<'Lead' | 'Cliente'>('Lead');
  const [crearClienteLoading, setCrearClienteLoading] = useState(false);

  const shouldOpenPagos = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('abrirPagos') === '1';
  }, [location.search]);
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
  const imagenInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const prevContactoRef = useRef<number | null | undefined>(undefined);
  const skipFiscalFetchRef = useRef<boolean>(false);
  const previewTimersRef = useRef<Record<number, ReturnType<typeof setTimeout> | null>>({});
  const previewSeqRef = useRef<Record<number, number>>({});
  const previewGlobalSeqRef = useRef<number>(0);
  const tratamientoRef = useRef<TratamientoImpuestos | null>(form.tratamiento_impuestos ?? 'normal');
  const isChangingTratamientoRef = useRef<boolean>(false);
  const suppressPreviewRef = useRef<boolean>(false);
  const tratamientoChangeSeqRef = useRef<number>(0);

  const runImpuestosPreview = async (
    index: number,
    partida: PartidaForm,
    tratamientoActual: TratamientoImpuestos,
    seq: number,
    immediate: boolean = false
  ) => {
    console.log('[impuestos] runPreview caller stack', new Error().stack);
    console.log('[impuestos] debounce fired -> runPreview', {
      index,
      seq,
      producto_id: partida.producto_id,
      cantidad: partida.cantidad,
      precio_unitario: partida.precio_unitario,
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
        tratamiento_impuestos: tratamientoActual,
      });
      const resp: any = await calcularImpuestosPreview({
        producto_id: partida.producto_id ?? null,
        cantidad: partida.cantidad ?? 0,
        precio_unitario: partida.precio_unitario ?? 0,
        tratamiento_impuestos: tratamientoActual,
      });

      if (previewSeqRef.current[index] !== seq) return;

      console.log('[impuestos] preview response', {
        index,
        seq,
        producto_id: partida.producto_id,
        cantidad: partida.cantidad,
        precio_unitario: partida.precio_unitario,
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
        recalcTotales(next);
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

  const recalcTotales = (partidasList: PartidaForm[]) => {
    const subtotal = partidasList.reduce((acc, p) => acc + (p.subtotal_partida || 0), 0);
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
    setForm((prev) => ({ ...prev, subtotal, iva: impuestosTotales, total }));
  };

  const isSinIva = (t: TratamientoImpuestos | null | undefined) => (t ?? '').toLowerCase() === 'sin_iva';
  const isOperacionEstandar = (t: TratamientoImpuestos | null | undefined) => ['normal', 'operacion_estandar'].includes((t ?? '').toLowerCase());

  const partidasGridTemplate = useMemo(
    () =>
      (isCotizacion
        ? '180px 1fr 80px 120px 120px 120px 120px 52px 40px 48px'
        : '180px 1fr 80px 120px 120px 120px 120px 40px 48px'),
    [isCotizacion]
  );

  const calcularPartida = (partida: PartidaForm): PartidaForm => {
    const cantidad = Number(partida.cantidad) || 0;
    const precio = Number(partida.precio_unitario) || 0;
    const subtotal_partida = cantidad * precio;
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
      tratamiento_impuestos: tratamientoPlan,
      immediate,
    });

    const runPreview = () => {
      const tratamientoActual = tratamientoOverride ?? tratamientoRef.current ?? form.tratamiento_impuestos ?? 'normal';
      runImpuestosPreview(index, partida, tratamientoActual, seq, immediate);
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

      const updated = calcularPartida(updater(current));

      next[index] = updated;
      recalcTotales(next);
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
      recalcTotales(next);

      next.forEach((p, idx) => {
        if (changeSeq !== tratamientoChangeSeqRef.current) {
          return;
        }
        previewSeqRef.current[idx] = newSeq;
        runImpuestosPreview(idx, p, valor, newSeq, true);
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
      setTimeout(() => recalcTotales(ajustadas), 0);
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
      recalcTotales(next);
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
      const tiposContacto = tipoDocumento === 'cotizacion' ? ['Cliente', 'Lead'] : undefined;
      const [c, p, v] = await Promise.all([fetchContactos(tiposContacto), fetchProductos(), fetchVendedores()]);
      setContactos(c);
      setProductos(p);
      setVendedores(v);
    } catch (e) {
      console.error(e);
    }
  };

  const loadDocumento = async () => {
    if (!isEdit || !id) return;
    try {
      setLoading(true);
      setValoresCamposDocumento({});
      setValoresCamposPartidas([{}]);
      const requests: [Promise<CotizacionDetalle>, Promise<{ saldo: number } | null>?] = [getDocumento(Number(id), tipoDocumento)];
      if (tipoDocumento === 'factura') {
        requests.push(fetchSaldoDocumento(Number(id)).catch(() => null));
      }
      const [data, saldoData] = await Promise.all(requests);
      const doc = data.documento;
      setSaldoDocumento(Number((saldoData as any)?.saldo ?? doc.saldo ?? 0));
      setForm({
        tipo_documento: doc.tipo_documento ?? tipoDocumento,
  serie: (doc as any).serie || null,
        contacto_principal_id: doc.contacto_principal_id,
        agente_id: (doc as any).agente_id ?? null,
        fecha_documento: doc.fecha_documento?.substring(0, 10) || defaultFecha(),
        moneda: doc.moneda || 'MXN',
        observaciones: doc.observaciones || '',
        subtotal: doc.subtotal || 0,
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
          subtotal_partida: p.subtotal_partida,
          total_partida: p.total_partida,
          archivo_imagen_1: p.archivo_imagen_1 ?? null,
          observaciones: p.observaciones ?? '',
          producto: prod,
          impuestos: impuestosEntrada,
          impuestos_calculados: impuestosCalc,
        });
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
      recalcTotales(nextPartidas);

      // Carga valores dinámicos ya capturados
      const [valoresDocResp, valoresPartidasResp] = await Promise.all([
        fetchCamposDocumento(Number(id)),
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
    loadCombos();
  }, []);

  useEffect(() => {
    loadDocumento();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id, tipoDocumento]);

  useEffect(() => {
    if (isEdit) return;
    if (!sessionUserId) return;
    setForm((prev) => (prev.usuario_creacion_id ? prev : { ...prev, usuario_creacion_id: sessionUserId }));
  }, [isEdit, sessionUserId]);

  useEffect(() => {
    tratamientoRef.current = form.tratamiento_impuestos ?? 'normal';
  }, [form.tratamiento_impuestos]);

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

  const handleSave = async () => {
    if (!form.contacto_principal_id) {
      setSnackbar({ open: true, message: 'Selecciona un cliente', severity: 'error' });
      return;
    }
    const requiereDatosFiscales = tipoDocumento === 'factura' && form.tratamiento_impuestos !== 'sin_iva';

    if (requiereDatosFiscales) {
      if (!form.rfc_receptor || !validarRFC(form.rfc_receptor)) {
        setSnackbar({ open: true, message: 'RFC receptor es obligatorio y debe ser válido', severity: 'error' });
        return;
      }
      if (!form.regimen_fiscal_receptor || !form.uso_cfdi || !form.forma_pago || !form.metodo_pago || !form.codigo_postal_receptor) {
        setSnackbar({ open: true, message: 'Completa los datos fiscales requeridos', severity: 'error' });
        return;
      }
    }
    try {
      setSaving(true);
      const payload: CotizacionCrearPayload & { conversacion_id: number | null } = {
        ...form,
        tipo_documento: tipoDocumento,
        serie: form.serie?.trim() || null,
        subtotal: form.subtotal || 0,
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
      if (isEdit && id) {
        const updated = await updateDocumento(Number(id), tipoDocumento, payload);
        docId = (updated as any).id ?? Number(id);
      } else {
        const created = await createDocumento(tipoDocumento, payload);
        docId = (created as any).id;
      }

      const partidasPayload: CotizacionPartidaPayload[] = partidas.map((p) => ({
        producto_id: p.producto_id,
        descripcion_alterna: p.descripcion_alterna ?? '',
        cantidad: p.cantidad ?? 0,
        precio_unitario: p.precio_unitario ?? 0,
        subtotal_partida: p.subtotal_partida ?? 0,
        total_partida: p.total_partida ?? 0,
        ...(isCotizacion ? { archivo_imagen_1: p.archivo_imagen_1 ?? null } : {}),
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

  setSnackbar({ open: true, message: textos.guardado, severity: 'success' });
      setTimeout(() => navigate(basePath), 400);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo guardar';
      if (message.toLowerCase().includes('serie') && message.toLowerCase().includes('número')) {
        setDuplicateDialog({ open: true, message });
      } else {
        setSnackbar({ open: true, message, severity: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleProductoChange = (index: number, producto: Producto | null) => {
    setPartidaAt(index, (prev) => {
      return {
        ...prev,
        producto_id: producto?.id ?? null,
        descripcion_alterna: producto?.descripcion || prev.descripcion_alterna,
        precio_unitario: producto?.precio_publico ?? producto?.precio_menudeo ?? prev.precio_unitario ?? 0,
        producto: producto ?? null,
        impuestos: [],
        impuestos_calculados: [],
      };
    });
  };

  const handleCantidadPrecioChange = (index: number, field: 'cantidad' | 'precio_unitario', value: string) => {
    console.log('[calc] onChange input', { index, field, value });
    setPartidaAt(index, (prev) => {
      return {
        ...prev,
        [field]: Number(value),
        impuestos: prev.impuestos ?? [],
      };
    });
  };

  const handleImagenClick = (index: number) => {
    const url = partidas[index]?.archivo_imagen_1?.trim();
    if (url) {
      window.open(url, '_blank', 'noopener');
      return;
    }
    imagenInputRefs.current[index]?.click();
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
      setPartidaAt(index, (prev) => ({ ...prev, archivo_imagen_1: resp.url }));
      setSnackbar({ open: true, message: 'Imagen cargada', severity: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo subir la imagen';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setUploadingImagen((prev) => {
        const next = [...prev];
        next[index] = false;
        return next;
      });
      const input = imagenInputRefs.current[index];
      if (input) input.value = '';
    }
  };

  const handleImagenRemove = (index: number) => {
    const imagenUrl = partidas[index]?.archivo_imagen_1?.trim();
    if (!imagenUrl) return;
    if (!window.confirm('¿Eliminar la imagen de esta partida?')) return;

    setPartidaAt(index, (prev) => ({ ...prev, archivo_imagen_1: null }));

    const input = imagenInputRefs.current[index];
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
      const nuevo = await crearContacto({ nombre, tipo_contacto: crearClienteTipo });
      setContactos((prev) => [nuevo, ...prev.filter((c) => c.id !== nuevo.id)]);
      handleClienteSelect(nuevo);
      await cargarDatosFiscalesContacto(nuevo.id);
      setSnackbar({ open: true, message: 'Cliente creado', severity: 'success' });
      setCrearClienteOpen(false);
      setCrearClienteNombre('');
      setCrearClienteTipo('Lead');
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Toolbar disableGutters sx={{ justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button variant="text" startIcon={<ArrowBackIcon />} onClick={() => navigate(basePath)}>
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
          {isEdit && id && (
            <Button
              variant="outlined"
              onClick={() => setOpenPagos(true)}
              disabled={tipoDocumento !== 'factura' || !form.contacto_principal_id || saldoDocumento <= 0}
            >
              Aplicar pago
            </Button>
          )}
          {isEdit && id && (
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              onClick={async () => {
                try {
                  setDownloadingPdf(true);
                  await abrirDocumentoPdfEnNuevaVentana(Number(id), tipoDocumento);
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

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

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
                  <Autocomplete
                    fullWidth
                    options={[...contactos, { id: -1, nombre: 'Crear cliente…' } as Contacto]}
                    loading={contactos.length === 0}
                    getOptionLabel={(option) => option.nombre || ''}
                    isOptionEqualToValue={(option, value) => option?.id === value?.id}
                    value={contactos.find((c) => c.id === form.contacto_principal_id) || null}
                    onChange={(_, value) => {
                      if (value?.id === -1) {
                        setCrearClienteOpen(true);
                        setCrearClienteNombre('');
                        setCrearClienteTipo('Lead');
                        return;
                      }
                      handleClienteSelect(value);
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
                {tipoDocumento === 'factura' && (
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
                <Box
                  sx={{
                    display: { xs: 'none', md: 'grid' },
                    gridTemplateColumns: partidasGridTemplate,
                    gap: 1,
                    px: 1,
                    color: '#6b7280',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <Box>Producto</Box>
                  <Box>Descripción</Box>
                  <Box textAlign="right">Cant.</Box>
                  <Box textAlign="right">Precio</Box>
                  <Box textAlign="right">Subtotal</Box>
                  <Box textAlign="right">IVA</Box>
                  <Box textAlign="right">Total</Box>
                  {isCotizacion && <Box textAlign="center">Imagen</Box>}
                  <Box textAlign="center">Obs.</Box>
                  <Box textAlign="center">&nbsp;</Box>
                </Box>

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
                      <Autocomplete
                        options={productos}
                        loading={productos.length === 0}
                        getOptionLabel={(option) => option.clave || ''}
                        value={productos.find((p) => p.id === partida.producto_id) || null}
                        onChange={(_, value) => handleProductoChange(index, value)}
                        filterOptions={filterProductos}
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
                              {(option as Producto)?.clave || ''}
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
                              {(option as Producto)?.descripcion || ''}
                            </Typography>
                          </Box>
                        )}
                        renderInput={(params) => (
                          <TextField
                            {...(params as any)}
                            label={undefined}
                            placeholder="Producto"
                            size="small"
                            InputLabelProps={{ sx: { fontSize: 13 } }}
                            inputProps={{ ...params.inputProps, style: { fontSize: 13 } }}
                          />
                        )}
                        sx={{ minWidth: 0 }}
                      />

                      <TextField
                        label={undefined}
                        placeholder="Descripción"
                        value={partida.descripcion_alterna ?? ''}
                        onChange={(e) => handleDescripcionChange(index, e.target.value)}
                        size="small"
                        InputProps={{ sx: { fontSize: 13 } }}
                        inputProps={{ style: { fontSize: 13 } }}
                        sx={{ minWidth: 0 }}
                        disabled
                      />

                      <TextField
                        label={undefined}
                        placeholder="Cant."
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
                        label={undefined}
                        placeholder="Precio"
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
                        label={undefined}
                        value={formatter.format(partida.subtotal_partida ?? 0)}
                        InputProps={{ readOnly: true, sx: { fontSize: 13 }, style: { textAlign: 'right' } }}
                        size="small"
                      />

                      <TextField
                        label={undefined}
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
                        label={undefined}
                        value={formatter.format(partida.total_partida ?? 0)}
                        InputProps={{ readOnly: true, sx: { fontSize: 13 }, style: { textAlign: 'right' } }}
                        size="small"
                      />

                      {isCotizacion && (
                        <Box display="flex" justifyContent="center" alignItems="center" gap={0.5}>
                          <input
                            type="file"
                            accept="image/*"
                            ref={(el) => {
                              imagenInputRefs.current[index] = el;
                            }}
                            onChange={(e) => handleImagenChange(index, e.target.files)}
                            style={{ display: 'none' }}
                          />
                          <Tooltip title={partida.archivo_imagen_1 ? 'Ver imagen' : 'Subir imagen'}>
                            <span>
                              <IconButton
                                size="small"
                                aria-label="Imagen de partida"
                                onClick={() => handleImagenClick(index)}
                                disabled={Boolean(uploadingImagen[index])}
                                color={partida.archivo_imagen_1 ? 'primary' : 'default'}
                              >
                                {uploadingImagen[index] ? (
                                  <CircularProgress size={18} />
                                ) : partida.archivo_imagen_1 ? (
                                  <ImageOutlinedIcon fontSize="small" />
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
                      <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' }, mt: 1 }}>
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
                          size="small"
                          InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }}
                          inputProps={{ style: { fontSize: 13 } }}
                        />
                      </Box>
                    )}
                  </React.Fragment>
                ))}
              </Stack>

              <Divider />

              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end" spacing={1.5} alignItems="flex-end">
                <TextField
                  label="Subtotal"
                  value={formatter.format(form.subtotal || 0)}
                  InputProps={{ readOnly: true, sx: { fontSize: 13 }, style: { textAlign: 'right' } }}
                  size="small"
                  sx={{ width: { xs: '100%', sm: 180 } }}
                />
                <TextField
                  label="IVA"
                  value={formatter.format(form.iva || 0)}
                  InputProps={{ readOnly: true, sx: { fontSize: 13 }, style: { textAlign: 'right' } }}
                  size="small"
                  sx={{ width: { xs: '100%', sm: 160 } }}
                />
                <TextField
                  label="Total"
                  value={formatter.format(form.total || 0)}
                  InputProps={{ readOnly: true, sx: { fontSize: 13, fontWeight: 700 }, style: { textAlign: 'right' } }}
                  size="small"
                  sx={{ width: { xs: '100%', sm: 180 } }}
                />
              </Stack>
            </>
          )}
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

      <Dialog open={crearClienteOpen} onClose={() => { if (!crearClienteLoading) { setCrearClienteOpen(false); setCrearClienteNombre(''); setCrearClienteTipo('Lead'); } }} fullWidth maxWidth="xs">
        <DialogTitle>Crear cliente rápido</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Nombre"
            size="small"
            autoFocus
            value={crearClienteNombre}
            onChange={(e) => setCrearClienteNombre(e.target.value)}
            disabled={crearClienteLoading}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            select
            label="Tipo de contacto"
            size="small"
            value={crearClienteTipo}
            onChange={(e) => setCrearClienteTipo(e.target.value as 'Lead' | 'Cliente')}
            disabled={crearClienteLoading}
          >
            <MenuItem value="Lead">Lead</MenuItem>
            <MenuItem value="Cliente">Cliente</MenuItem>
          </TextField>
          <Alert severity="info" sx={{ fontSize: 13 }}>
            Se asignará al documento con el tipo seleccionado.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { if (!crearClienteLoading) { setCrearClienteOpen(false); setCrearClienteNombre(''); setCrearClienteTipo('Lead'); } }} disabled={crearClienteLoading}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void handleCrearClienteSubmit()} disabled={crearClienteLoading}>
            {crearClienteLoading ? 'Creando…' : 'Crear y asignar'}
          </Button>
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

      {tipoDocumento === 'factura' && isEdit && id && form.contacto_principal_id ? (
        <FacturaPagosDrawer
          open={openPagos}
          onClose={handleClosePagosDrawer}
          documentoId={Number(id)}
          contactoId={Number(form.contacto_principal_id)}
          saldo={saldoDocumento}
        />
      ) : null}
    </Box>
  );
}
