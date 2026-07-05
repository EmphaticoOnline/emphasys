import { apiFetch, apiFetchBlob, triggerBlobDownload } from './apiFetch';

export type CfdiSatCredenciales =
  | { existe: false }
  | {
      existe: true;
      rfc_certificado: string;
      vigencia_desde: string;
      vigencia_hasta: string;
      cargado_en: string;
      vigente: boolean;
    };

export type CfdiSatAutorizacion = {
  version: string;
  texto: string;
  aceptada: boolean;
  aceptado_en: string | null;
  aceptado_por: string | null;
};

export type CfdiSatTipoDescarga = 'emitidos' | 'recibidos';
export type CfdiSatTipoSolicitud = 'xml' | 'metadata';
export type CfdiSatEstatusComprobante = 'activos' | 'cancelados' | 'todos';
export type CfdiSatSolicitudEstatus =
  | 'pendiente'
  | 'solicitado'
  | 'en_proceso'
  | 'terminado'
  | 'sin_resultados'
  | 'error'
  | 'expirado'
  | 'rechazado';

export type CfdiSatSolicitud = {
  id: number;
  empresa_id: number;
  usuario_id: number;
  tipo_descarga: CfdiSatTipoDescarga;
  fecha_inicio: string;
  fecha_fin: string;
  tipo_solicitud: CfdiSatTipoSolicitud;
  estatus_comprobante: CfdiSatEstatusComprobante | null;
  sat_request_id: string | null;
  estatus: CfdiSatSolicitudEstatus;
  mensaje_error: string | null;
  cfdis_encontrados: number | null;
  creado_en: string;
  solicitado_en: string | null;
  verificado_en: string | null;
  total_paquetes: number;
  total_comprobantes: number;
};

export type CfdiSatComprobanteEstatusSat = 'vigente' | 'cancelado';

export type CfdiSatEstadoImportacionOperativo =
  | 'importado'
  | 'listo_para_importar'
  | 'sin_xml'
  | 'cancelado'
  | 'proveedor_no_encontrado'
  | 'proveedor_duplicado'
  | 'proveedor_tipo_invalido'
  | 'impuestos_no_mapeados'
  | 'rfc_receptor_no_coincide'
  | 'uuid_ya_existe_en_documentos'
  | 'no_aplica';

export type CfdiSatConfianzaDuplicado = 'alta' | 'media' | 'baja';

export type CfdiSatPosibleDocumentoExistente = {
  documento_id: number;
  confianza: CfdiSatConfianzaDuplicado;
  motivo: string;
};

export type CfdiSatCandidatoVinculacion = {
  documento_id: number;
  serie: string | null;
  numero: number | null;
  serie_externa: string | null;
  numero_externo: number | null;
  proveedor_id: number | null;
  proveedor_nombre: string | null;
  fecha_documento: string;
  total: number;
  estatus_documento: string;
  confianza: CfdiSatConfianzaDuplicado;
  motivo: string;
};

export type CfdiSatVinculacionResultado = {
  documento_id: number;
  comprobante_id: number;
  uuid: string;
  proveedor_id: number | null;
  proveedor_nombre: string | null;
};

export type CfdiSatEvaluacionImportacion = {
  comprobante_id: number;
  uuid: string;
  elegible_importacion: boolean;
  estado_importacion_operativo: CfdiSatEstadoImportacionOperativo;
  mensaje: string;
  documento_id: number | null;
  proveedor_id: number | null;
  proveedor_nombre: string | null;
  posible_documento_existente: CfdiSatPosibleDocumentoExistente | null;
};

export type CfdiSatComprobante = {
  id: number;
  empresa_id: number;
  solicitud_id: number;
  paquete_id: number;
  uuid: string;
  rfc_emisor: string;
  rfc_receptor: string;
  nombre_emisor: string | null;
  nombre_receptor: string | null;
  fecha_emision: string | null;
  tipo_comprobante: string | null;
  total: string | null;
  moneda: string | null;
  estatus_sat: CfdiSatComprobanteEstatusSat | null;
  tipo_descarga: CfdiSatTipoDescarga;
  tiene_xml: boolean;
  importado_compras: boolean;
  documento_id: number | null;
  creado_en: string;
  /** Solo viene cuando se pide con incluir_evaluacion=true (fetchCfdiSatComprobantes). */
  evaluacion: CfdiSatEvaluacionImportacion | null;
};

export type DescargarSolicitudResultado = {
  solicitud: CfdiSatSolicitud;
  nuevos: number;
  duplicados: number;
  paquetes_con_error: number;
};

export type CfdiSatComprobanteFiltros = {
  tipo_descarga?: CfdiSatTipoDescarga | '';
  uuid?: string;
  rfc_emisor?: string;
  rfc_receptor?: string;
  nombre_emisor?: string;
  nombre_receptor?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  tipo_comprobante?: string;
  estatus_sat?: CfdiSatComprobanteEstatusSat | '';
  importado_compras?: 'true' | 'false' | '';
  solicitud_id?: number;
  paquete_id?: number;
  page?: number;
  pageSize?: number;
  /** Pide al backend que evalúe el estado operativo de importación de la página actual (Fase 10). */
  incluir_evaluacion?: boolean;
};

export type CfdiSatComprobantesPagina = {
  comprobantes: CfdiSatComprobante[];
  total: number;
  page: number;
  pageSize: number;
};

export type CfdiSatSolicitudResumen = {
  id: number;
  tipo_descarga: CfdiSatTipoDescarga;
  tipo_solicitud: CfdiSatTipoSolicitud;
  fecha_inicio: string;
  fecha_fin: string;
  estatus: CfdiSatSolicitudEstatus;
  sat_request_id: string | null;
};

export type CfdiSatPaqueteResumen = {
  id: number;
  solicitud_id: number;
  sat_package_id: string;
  estatus: 'pendiente' | 'descargado' | 'error';
  descargado_en: string | null;
  mensaje_error: string | null;
  creado_en: string;
  total_comprobantes: number;
  tiene_zip: boolean;
};

export type CfdiSatComprobanteDetalle = {
  comprobante: CfdiSatComprobante;
  evaluacion: CfdiSatEvaluacionImportacion;
  solicitud: CfdiSatSolicitudResumen | null;
  paquete: Pick<CfdiSatPaqueteResumen, 'id' | 'sat_package_id' | 'estatus' | 'descargado_en'> | null;
};

export type CfdiSatImportacionPreview = {
  uuid: string;
  emisor: { rfc: string; nombre: string | null };
  fecha: string | null;
  total: number;
  moneda: string;
  numero_conceptos: number;
  proveedor: { id: number; nombre: string };
};

export type CfdiSatDocumentoImportado = {
  id: number;
  tipo_documento: string;
  estatus_documento: string;
  serie: string | null;
  numero: number | null;
  serie_externa: string | null;
  numero_externo: number | null;
  total: number;
  contacto_id: number;
  contacto_nombre: string;
};

export type CfdiSatImportacionLoteItem = {
  id: number;
  uuid: string | null;
  ok: boolean;
  documento_id?: number;
  mensaje_error?: string;
  code?: string;
};

export type CfdiSatImportacionLoteResultado = {
  resultados: CfdiSatImportacionLoteItem[];
  resumen: { total: number; importados: number; fallidos: number };
};

export type CfdiSatBitacoraAccion =
  | 'credencial_subida'
  | 'credencial_eliminada'
  | 'autorizacion_aceptada'
  | 'solicitud_creada'
  | 'verificacion'
  | 'descarga_paquete'
  | 'importado_compras'
  | 'verificacion_automatica'
  | 'descarga_automatica'
  | 'automatizacion_error'
  | 'vinculacion_documento'
  | 'error';

export type CfdiSatBitacoraResultado = 'ok' | 'error';

export type CfdiSatBitacoraEntrada = {
  id: number;
  empresa_id: number;
  usuario_id: number;
  usuario_nombre: string | null;
  accion: CfdiSatBitacoraAccion;
  resultado: CfdiSatBitacoraResultado;
  detalle: string | null;
  creado_en: string;
};

export type CfdiSatBitacoraFiltros = {
  fecha_inicio?: string;
  fecha_fin?: string;
  accion?: CfdiSatBitacoraAccion | '';
  resultado?: CfdiSatBitacoraResultado | '';
  usuario_id?: number;
  solicitud_id?: number;
  comprobante_id?: number;
  uuid?: string;
  page?: number;
  pageSize?: number;
};

export type CfdiSatBitacoraPagina = {
  bitacora: CfdiSatBitacoraEntrada[];
  total: number;
  page: number;
  pageSize: number;
};

export type CfdiSatResumenModulo = {
  solicitudes: { total: number; en_proceso: number; terminadas: number; con_error: number };
  comprobantes: { total: number; recibidos: number; importados: number; pendientes_importar: number };
  paquetes_con_error: number;
};

export type CfdiSatUsoCarpeta = { archivos: number; bytes: number; disponible: boolean };

export type CfdiSatAlmacenamiento = {
  zips: CfdiSatUsoCarpeta;
  xml: CfdiSatUsoCarpeta;
  total_bytes: number;
  total_archivos: number;
};

export type NuevaSolicitudPayload = {
  tipo_descarga: CfdiSatTipoDescarga;
  fecha_inicio: string;
  fecha_fin: string;
  tipo_solicitud: CfdiSatTipoSolicitud;
  estatus_comprobante?: CfdiSatEstatusComprobante | null;
  fielPassword: string;
};

export type CfdiSatAutomatizacion = {
  empresa_id: number;
  auto_verificar: boolean;
  auto_descargar: boolean;
  frecuencia_minutos: number;
  ultimo_run_en: string | null;
  actualizado_por: number | null;
  actualizado_en: string;
};

export type CfdiSatAutomatizacionPayload = {
  auto_verificar: boolean;
  auto_descargar: boolean;
  frecuencia_minutos: number;
};

export type CfdiSatEjecucionAutomatizacion = {
  solicitudesVerificadas: number;
  solicitudesConErrorVerificacion: number;
  solicitudesDescargadas: number;
  comprobantesNuevos: number;
  paquetesConError: number;
  mensajes: string[];
};

const BASE_URL = '/api/configuracion/cfdi-sat';

export async function fetchCfdiSatCredenciales(): Promise<CfdiSatCredenciales> {
  return apiFetch<CfdiSatCredenciales>(`${BASE_URL}/credenciales`);
}

export async function uploadCfdiSatCredenciales(cerFile: File, keyFile: File): Promise<CfdiSatCredenciales> {
  const formData = new FormData();
  formData.append('cer', cerFile);
  formData.append('key', keyFile);

  return apiFetch<CfdiSatCredenciales>(`${BASE_URL}/credenciales`, {
    method: 'POST',
    body: formData,
  });
}

export async function deleteCfdiSatCredenciales(): Promise<void> {
  await apiFetch<void>(`${BASE_URL}/credenciales`, { method: 'DELETE' });
}

export async function fetchCfdiSatAutorizacion(): Promise<CfdiSatAutorizacion> {
  return apiFetch<CfdiSatAutorizacion>(`${BASE_URL}/autorizacion`);
}

export async function aceptarCfdiSatAutorizacion(): Promise<CfdiSatAutorizacion> {
  return apiFetch<CfdiSatAutorizacion>(`${BASE_URL}/autorizacion`, { method: 'POST' });
}

export async function fetchCfdiSatSolicitudes(): Promise<CfdiSatSolicitud[]> {
  const response = await apiFetch<{ solicitudes: CfdiSatSolicitud[] }>(`${BASE_URL}/solicitudes`);
  return response.solicitudes ?? [];
}

export async function crearCfdiSatSolicitud(payload: NuevaSolicitudPayload): Promise<CfdiSatSolicitud> {
  const response = await apiFetch<{ solicitud: CfdiSatSolicitud }>(`${BASE_URL}/solicitudes`, {
    method: 'POST',
    body: payload,
  });
  return response.solicitud;
}

export async function verificarCfdiSatSolicitud(id: number, fielPassword: string): Promise<CfdiSatSolicitud> {
  const response = await apiFetch<{ solicitud: CfdiSatSolicitud }>(`${BASE_URL}/solicitudes/${id}/verificar`, {
    method: 'POST',
    body: { fielPassword },
  });
  return response.solicitud;
}

export async function descargarCfdiSatSolicitud(id: number, fielPassword: string): Promise<DescargarSolicitudResultado> {
  return apiFetch<DescargarSolicitudResultado>(`${BASE_URL}/solicitudes/${id}/descargar`, {
    method: 'POST',
    body: { fielPassword },
  });
}

export async function fetchCfdiSatComprobantes(
  filtros: CfdiSatComprobanteFiltros = {}
): Promise<CfdiSatComprobantesPagina> {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });

  const query = params.toString();
  return apiFetch<CfdiSatComprobantesPagina>(`${BASE_URL}/comprobantes${query ? `?${query}` : ''}`);
}

export async function fetchCfdiSatComprobanteDetalle(id: number): Promise<CfdiSatComprobanteDetalle> {
  return apiFetch<CfdiSatComprobanteDetalle>(`${BASE_URL}/comprobantes/${id}`);
}

export async function descargarXmlComprobante(id: number): Promise<void> {
  const { blob, filename } = await apiFetchBlob(`${BASE_URL}/comprobantes/${id}/xml`);
  triggerBlobDownload(blob, filename);
}

export async function fetchCfdiSatPaquetesDeSolicitud(solicitudId: number): Promise<CfdiSatPaqueteResumen[]> {
  const response = await apiFetch<{ paquetes: CfdiSatPaqueteResumen[] }>(
    `${BASE_URL}/solicitudes/${solicitudId}/paquetes`
  );
  return response.paquetes ?? [];
}

export async function fetchCfdiSatImportacionPreview(comprobanteId: number): Promise<CfdiSatImportacionPreview> {
  return apiFetch<CfdiSatImportacionPreview>(`${BASE_URL}/comprobantes/${comprobanteId}/importar-compras`);
}

export async function importarCfdiSatComprobanteACompras(comprobanteId: number): Promise<CfdiSatDocumentoImportado> {
  const response = await apiFetch<{ documento: CfdiSatDocumentoImportado }>(
    `${BASE_URL}/comprobantes/${comprobanteId}/importar-compras`,
    { method: 'POST' }
  );
  return response.documento;
}

export async function fetchCfdiSatCandidatosVinculacion(
  comprobanteId: number
): Promise<CfdiSatCandidatoVinculacion[]> {
  const response = await apiFetch<{ candidatos: CfdiSatCandidatoVinculacion[] }>(
    `${BASE_URL}/comprobantes/${comprobanteId}/candidatos-vinculacion`
  );
  return response.candidatos;
}

export async function vincularCfdiSatDocumento(
  comprobanteId: number,
  documentoId: number
): Promise<CfdiSatVinculacionResultado> {
  return apiFetch<CfdiSatVinculacionResultado>(`${BASE_URL}/comprobantes/${comprobanteId}/vincular-documento`, {
    method: 'POST',
    body: { documento_id: documentoId },
  });
}

export async function importarCfdiSatComprobantesLote(
  comprobanteIds: number[]
): Promise<CfdiSatImportacionLoteResultado> {
  return apiFetch<CfdiSatImportacionLoteResultado>(`${BASE_URL}/comprobantes/importar-compras-lote`, {
    method: 'POST',
    body: { comprobante_ids: comprobanteIds },
  });
}

export async function fetchCfdiSatBitacora(
  filtros: CfdiSatBitacoraFiltros = {}
): Promise<CfdiSatBitacoraPagina> {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });

  const query = params.toString();
  return apiFetch<CfdiSatBitacoraPagina>(`${BASE_URL}/bitacora${query ? `?${query}` : ''}`);
}

export async function fetchCfdiSatResumen(): Promise<CfdiSatResumenModulo> {
  return apiFetch<CfdiSatResumenModulo>(`${BASE_URL}/resumen`);
}

export async function fetchCfdiSatAlmacenamiento(): Promise<CfdiSatAlmacenamiento> {
  return apiFetch<CfdiSatAlmacenamiento>(`${BASE_URL}/almacenamiento`);
}

export async function fetchCfdiSatAutomatizacion(): Promise<CfdiSatAutomatizacion> {
  return apiFetch<CfdiSatAutomatizacion>(`${BASE_URL}/automatizacion`);
}

export async function actualizarCfdiSatAutomatizacion(
  payload: CfdiSatAutomatizacionPayload
): Promise<CfdiSatAutomatizacion> {
  return apiFetch<CfdiSatAutomatizacion>(`${BASE_URL}/automatizacion`, {
    method: 'PUT',
    body: payload,
  });
}

export async function ejecutarCfdiSatAutomatizacion(fielPassword: string): Promise<CfdiSatEjecucionAutomatizacion> {
  return apiFetch<CfdiSatEjecucionAutomatizacion>(`${BASE_URL}/automatizacion/ejecutar`, {
    method: 'POST',
    body: { fielPassword },
  });
}
