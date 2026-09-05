import type { CotizacionDetalle, CotizacionListado, CotizacionCrearPayload, CotizacionPartidaPayload } from '../types/cotizacion';
import type { DocumentoDetalleResponse } from '../types/documentoDetalle';
import type { TipoDocumento } from '../types/documentos.types';
import { apiFetch, apiFetchBlob, triggerBlobDownload } from './apiFetch';
import { clearSession, loadSession } from '../session/sessionStorage';

const BASE_PATH: Record<TipoDocumento, string> = {
  cotizacion: '/api/documentos',
  factura: '/api/facturas',
  orden_servicio: '/api/documentos',
  pedido: '/api/documentos',
  remision: '/api/documentos',
};

const getBasePath = (tipo: TipoDocumento) => BASE_PATH[tipo] || '/api/documentos';
const shouldAppendTipoQuery = (tipo: TipoDocumento) => getBasePath(tipo) === '/api/documentos';
const withTipoQuery = (path: string, tipo: TipoDocumento) =>
  shouldAppendTipoQuery(tipo) ? `${path}${path.includes('?') ? '&' : '?'}tipo_documento=${tipo}` : path;

type PdfDescarga = {
  blob: File;
  filename: string;
};

// Un PDF abierto en el visor nativo de Chrome puede necesitar su blob URL
// mucho después de que terminó el fetch (por ejemplo, al descargarlo minutos
// después). Se revocan todos al abandonar la página de Emphasys.
const pdfViewerObjectUrls = new Set<string>();
let pdfViewerCleanupRegistered = false;

function conservarPdfViewerObjectUrl(url: string): void {
  pdfViewerObjectUrls.add(url);
  if (pdfViewerCleanupRegistered) return;
  pdfViewerCleanupRegistered = true;
  window.addEventListener('beforeunload', () => {
    pdfViewerObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    pdfViewerObjectUrls.clear();
  });
}

function obtenerFilenameDesdeContentDisposition(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) {
    return fallback;
  }

  const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (filenameStarMatch?.[1]) {
    try {
      return decodeURIComponent(filenameStarMatch[1]).trim();
    } catch {
      return filenameStarMatch[1].trim();
    }
  }

  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (filenameMatch?.[1]) {
    return filenameMatch[1].trim();
  }

  return fallback;
}

function normalizarPdfDescarga(blob: Blob, filename: string): PdfDescarga {
  const nombreSeguro = (filename || 'documento.pdf').trim() || 'documento.pdf';
  const file = new File([blob], nombreSeguro, { type: 'application/pdf' });
  return { blob: file, filename: nombreSeguro };
}

export function getDocumentos(tipo: TipoDocumento, options?: { search?: string | null }): Promise<CotizacionListado[]> {
  const base = getBasePath(tipo);
  const params = new URLSearchParams();
  if (shouldAppendTipoQuery(tipo)) {
    params.set('tipo_documento', tipo);
  }

  const search = options?.search?.trim();
  if (search) {
    params.set('search', search);
  }

  const query = params.toString();
  const url = query ? `${base}?${query}` : base;
  return apiFetch(url);
}

export type DocumentosPaginadosResponse = {
  data: CotizacionListado[];
  total: number;
  page: number;
  limit: number;
};

export function getDocumentosPaginados(
  tipo: TipoDocumento,
  options: {
    page: number;
    limit: number;
    search?: string | null;
    soloPendientes?: boolean;
    quickFilter?: string;
    clienteId?: number | null;
    agenteId?: number | null;
    fechaDesde?: string | null;
    fechaHasta?: string | null;
    montoMin?: string | null;
    montoMax?: string | null;
  }
): Promise<DocumentosPaginadosResponse> {
  const base = getBasePath(tipo);
  const params = new URLSearchParams();
  if (shouldAppendTipoQuery(tipo)) {
    params.set('tipo_documento', tipo);
  }
  params.set('page', String(options.page));
  params.set('limit', String(options.limit));

  const search = options.search?.trim();
  if (search) params.set('search', search);
  if (options.soloPendientes) params.set('solo_pendientes', 'true');
  if (options.quickFilter && options.quickFilter !== 'todos') params.set('quick_filter', options.quickFilter);
  if (options.clienteId) params.set('cliente_id', String(options.clienteId));
  if (options.agenteId) params.set('agente_id', String(options.agenteId));
  if (options.fechaDesde) params.set('fecha_desde', options.fechaDesde);
  if (options.fechaHasta) params.set('fecha_hasta', options.fechaHasta);
  if (options.montoMin) params.set('monto_min', options.montoMin);
  if (options.montoMax) params.set('monto_max', options.montoMax);

  return apiFetch(`${base}?${params.toString()}`);
}

export function getDocumento(id: number, tipo: TipoDocumento): Promise<CotizacionDetalle> {
  const base = getBasePath(tipo);
  const url = withTipoQuery(`${base}/${id}`, tipo);
  return apiFetch(url);
}

export function getDocumentoDetalle(id: number, tipo: TipoDocumento): Promise<DocumentoDetalleResponse> {
  return apiFetch(`/api/documentos/${id}/detalle?tipo_documento=${tipo}`);
}

export function createDocumento(tipo: TipoDocumento, data: CotizacionCrearPayload) {
  const base = getBasePath(tipo);
  return apiFetch(base, {
    method: 'POST',
    body: { ...data, tipo_documento: tipo } as any,
  });
}

export function updateDocumento(id: number, tipo: TipoDocumento, data: Partial<CotizacionCrearPayload>) {
  const base = getBasePath(tipo);
  const url = withTipoQuery(`${base}/${id}`, tipo);
  return apiFetch(url, {
    method: 'PUT',
    body: { ...data, tipo_documento: tipo } as any,
  });
}

export function duplicateDocumento(id: number, tipo: TipoDocumento): Promise<{ id: number }> {
  const base = getBasePath(tipo);
  return apiFetch(`${base}/${id}/duplicar`, {
    method: 'POST',
  });
}

export function duplicateDocumentos(ids: number[], tipo: TipoDocumento): Promise<{ ids: number[] }> {
  const base = getBasePath(tipo);
  return apiFetch(`${base}/duplicar-masivo`, {
    method: 'POST',
    body: { ids, tipo_documento: tipo } as any,
  });
}

export function validateDeleteDocumento(id: number, tipo: TipoDocumento): Promise<{ exists: boolean; canDelete: boolean; message?: string | null }> {
  const base = getBasePath(tipo);
  return apiFetch(`${base}/${id}/validar-eliminacion`, {
    method: 'GET',
  });
}

export function addPartida(documentoId: number, tipo: TipoDocumento, partida: CotizacionPartidaPayload) {
  const base = getBasePath(tipo);
  return apiFetch(`${base}/${documentoId}/partidas`, {
    method: 'POST',
    body: partida as any,
  });
}

export function replacePartidas(documentoId: number, tipo: TipoDocumento, partidas: CotizacionPartidaPayload[]) {
  const base = getBasePath(tipo);
  return apiFetch(`${base}/${documentoId}/partidas`, {
    method: 'PUT',
    body: { partidas } as any,
  });
}

export async function deleteDocumento(id: number, tipo: TipoDocumento) {
  const base = getBasePath(tipo);
  const url = withTipoQuery(`${base}/${id}`, tipo);
  await apiFetch(url, { method: 'DELETE' });
}

async function fetchDocumentoPdf(id: number, tipo: TipoDocumento): Promise<PdfDescarga> {
  const session = loadSession();
  const apiBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL?.replace(/\/$/, '')) || '';
  const basePath = getBasePath(tipo);
  const pathWithQuery = withTipoQuery(`${basePath}/${id}/pdf`, tipo);
  const url = `${apiBase}${pathWithQuery}`;

  const headers = new Headers();
  if (session.token) headers.set('Authorization', `Bearer ${session.token}`);
  if (session.empresaActivaId) headers.set('X-Empresa-Id', String(session.empresaActivaId));

  const response = await fetch(url, { headers });

  if (response.status === 401) {
    clearSession();
    window.location.href = '/login';
    throw new Error('Sesión expirada');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const message = text || `Error HTTP ${response.status}`;
    throw new Error(message);
  }

  const blob = await response.blob();
  const fallbackFilename = `${tipo}-${id}.pdf`;
  const filename = obtenerFilenameDesdeContentDisposition(response.headers.get('Content-Disposition'), fallbackFilename);

  return normalizarPdfDescarga(blob, filename);
}

export async function downloadDocumentoPdf(id: number, tipo: TipoDocumento): Promise<Blob> {
  const { blob } = await fetchDocumentoPdf(id, tipo);
  return blob;
}

export async function descargarDocumentoPdfEnNavegador(id: number, tipo: TipoDocumento): Promise<void> {
  const { blob, filename } = await fetchDocumentoPdf(id, tipo);
  const url = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

export async function descargarFacturaCfdiEnNavegador(id: number): Promise<void> {
  const { blob, filename } = await apiFetchBlob(`/api/facturas/${id}/cfdi`);
  triggerBlobDownload(blob, filename || `Factura_${id}.zip`);
}

export async function abrirDocumentoPdfEnNuevaVentana(id: number, tipo: TipoDocumento): Promise<void> {
  const win = window.open('', '_blank');

  if (!win) {
    throw new Error('El navegador bloqueó la ventana emergente para el PDF');
  }

  try {
    const { blob, filename } = await fetchDocumentoPdf(id, tipo);
    const url = URL.createObjectURL(blob);
    win.location.href = url;
    conservarPdfViewerObjectUrl(url);
  } catch (error) {
    win.close();
    throw error;
  }
}

export function enviarCotizacionPorCorreo(id: number, payload: {
  to: string;
  subject?: string;
  message?: string;
  tipoDocumento?: TipoDocumento;
}) {
  const body = payload.tipoDocumento ? { ...payload, tipo_documento: payload.tipoDocumento } : payload;
  return apiFetch(`/api/documentos/${id}/enviar-email`, {
    method: 'POST',
    body: body as any,
  });
}

export function timbrarDocumentoCfdi(id: number, tipo: TipoDocumento) {
  if (tipo === 'pago_cliente') {
    return apiFetch(`/api/documentos/${id}/timbrar-complemento-pago`, {
      method: 'POST',
    });
  }

  const base = getBasePath(tipo);
  if (base === '/api/facturas') {
    return apiFetch(`/api/facturas/${id}/timbrar`, {
      method: 'POST',
    });
  }

  return apiFetch(withTipoQuery(`/api/documentos/${id}/timbrar-cfdi`, tipo), {
    method: 'POST',
  });
}

export type PagoComplementPrevalidacion = {
  documentoId: number;
  aplicaciones: number;
  estado: 'sin_aplicaciones' | 'receptor_disponible' | 'inconsistente';
  origen: 'xml_facturas' | null;
  receptor: {
    nombre: string;
    rfcEnmascarado: string;
    regimenFiscal: string;
    codigoPostal: string;
  } | null;
  error?: { code: string; message: string; details?: Record<string, unknown> };
};

export function prevalidarComplementoPago(id: number): Promise<PagoComplementPrevalidacion> {
  return apiFetch(`/api/documentos/${id}/prevalidar-complemento-pago`);
}

export function enviarComplementoPago(id: number, email: string) {
  return apiFetch(`/api/documentos/${id}/enviar-complemento-pago`, {
    method: 'POST',
    body: { email } as any,
  });
}

export async function descargarComplementoPagoXml(id: number): Promise<void> {
  const { blob, filename } = await apiFetchBlob(
    `/api/documentos/${id}/xml?tipo_documento=pago_cliente`
  );
  triggerBlobDownload(blob, filename);
}

export function cancelarDocumento(
  id: number,
  tipo: TipoDocumento,
  payload: {
    motivo_cancelacion?: string | null;
    motivo_sat?: string | null;
    uuid_sustitucion?: string | null;
  }
) {
  return apiFetch(withTipoQuery(`/api/documentos/${id}/cancelar`, tipo), {
    method: 'POST',
    body: payload as any,
  });
}

export type PrevalidacionCancelacionDocumento = {
  documentoId: number;
  folio: string;
  aplicacionesActivas: number;
  derivadosBloqueantes: Array<{ documentoId: number; folio: string; tipoRelacion: string }>;
  correccionesNoBloqueantes: Array<{ documentoId: number; folio: string; tipoRelacion: string }>;
  inventario: boolean;
  contabilidad: boolean;
  intentoActivo: { id: number; estado: string } | null;
  cfdi: {
    uuid: string | null;
    estadoSat: string | null;
    cancelacionEstado: string | null;
    pacId: string | null;
    pacModalidad: string | null;
  } | null;
  puedeSolicitarCancelacion: boolean;
  advertencias: string[];
};

export function prevalidarCancelacionDocumento(id: number): Promise<PrevalidacionCancelacionDocumento> {
  return apiFetch(`/api/documentos/${id}/prevalidar-cancelacion`);
}

export type ReconciliacionCancelacionDocumento = {
  documento_id: number;
  intento_id: number;
  cancelacion_estado: 'no_solicitada' | 'solicitada' | 'pendiente' | 'cancelada' | 'rechazada' | 'error' | 'requiere_reconciliacion';
  proveedor_status: string | null;
  estatus_documento: string;
  message: string;
};

export function reconciliarCancelacionDocumento(id: number): Promise<ReconciliacionCancelacionDocumento> {
  return apiFetch(`/api/documentos/${id}/reconciliar-cancelacion`, {
    method: 'POST',
  });
}

// Preview de cálculo de impuestos (no persiste)
export function calcularImpuestosPreview(payload: {
  producto_id?: number | null;
  cantidad?: number | null;
  precio_unitario?: number | null;
  descuento?: number | null;
  descuento_tipo?: 'porcentaje' | 'monto' | null;
  descuento_monto?: number | null;
  descuento_global?: number | null;
  tratamiento_impuestos?: string | null;
}) {
  return apiFetch('/api/documentos/calcular-impuestos', {
    method: 'POST',
    body: payload as any,
  });
}

export type ExportDocumentoColumna = { field: string; headerName: string };

export async function exportarDocumentos(payload: {
  filters: Record<string, any>;
  columns: ExportDocumentoColumna[];
}): Promise<void> {
  const { blob, filename } = await apiFetchBlob('/api/documentos/exportar', {
    method: 'POST',
    body: payload as any,
  });
  triggerBlobDownload(blob, filename);
}

// ─── Recepción resumen de Orden de Compra ────────────────────────────────────

export type PartidaRecepcionResumen = {
  partida_oc_id: number;
  producto_id: number | null;
  producto_descripcion: string | null;
  producto_clave: string | null;
  descripcion_alterna: string | null;
  unidad: string | null;
  numero_partida: number | null;
  cantidad_ordenada: number;
  cantidad_recibida: number;
  cantidad_pendiente: number;
};

export type RecepcionResumenResponse = {
  partidas: PartidaRecepcionResumen[];
  estado_recepcion: 'abierta' | 'parcial' | 'cerrada';
  total_ordenado: number;
  total_recibido: number;
  total_pendiente: number;
};

export function getRecepcionResumen(documentoId: number): Promise<RecepcionResumenResponse> {
  return apiFetch(`/api/documentos/${documentoId}/recepcion-resumen`);
}
