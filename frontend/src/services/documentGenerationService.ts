const BASE_PATH = "/api/documentos";

type TipoDocumento =
  | "cotizacion"
  | "factura"
  | "nota_credito"
  | "orden_servicio"
  | "pedido"
  | "remision"
  | "orden_entrega"
  | "requisicion"
  | "orden_compra"
  | "recepcion"
  | "nota_credito_compra"
  | "factura_compra";

export interface OpcionGeneracionResponse {
  tipo_documento_destino: TipoDocumento;
  nombre: string;
  orden?: number;
}

export interface PrepararGeneracionPartida {
  partida_id: number;
  documento_origen_id: number;
  documento_origen_folio: string | null;
  producto_id: number | null;
  descripcion: string | null;
  unidad: string | null;
  cantidad_origen: number;
  cantidad_ya_generada: number;
  cantidad_pendiente_sugerida: number;
  cantidad_default: number;
  precio_unitario: number;
  importe_maximo_sugerido: number;
}

export interface PrepararGeneracionResponse {
  documento_origen: {
    documento_id: number;
    tipo_documento: TipoDocumento;
    folio: string | null;
    tratamiento_impuestos?: 'normal' | 'sin_iva' | 'tasa_cero' | 'exento' | null;
  } | null;
  documentos_origen: Array<{
    documento_id: number;
    tipo_documento: TipoDocumento;
    folio: string | null;
    tratamiento_impuestos?: 'normal' | 'sin_iva' | 'tasa_cero' | 'exento' | null;
  }>;
  es_consolidado: boolean;
  tipo_documento_destino: TipoDocumento;
  partidas: PrepararGeneracionPartida[];
}

export interface GenerarDocumentoPartidaInput {
  partida_origen_id: number;
  cantidad: number;
  monto_bonificacion?: number | null;
}

export interface DatosEncabezadoGeneracion {
  serie?: string | null;
  fecha?: string | Date;
  contacto_principal_id?: number | null;
  conversacion_id?: number | null;
  comentarios?: string | null;
  motivo_nc?: 'devolucion' | 'bonificacion' | 'otro' | null;
  concepto_id?: number | null;
  producto_resumen?: string | null;
  rfc_receptor?: string | null;
  nombre_receptor?: string | null;
  regimen_fiscal_receptor?: string | null;
  uso_cfdi?: string | null;
  forma_pago?: string | null;
  metodo_pago?: string | null;
  codigo_postal_receptor?: string | null;
  tratamiento_impuestos?: 'normal' | 'sin_iva' | 'tasa_cero' | 'exento' | null;
}

export interface GenerarDocumentoPayload {
  documento_origen_id?: number;
  documento_origen_ids?: number[];
  documento_destino_id?: number;
  tipo_documento_destino: TipoDocumento;
  datos_encabezado?: DatosEncabezadoGeneracion;
  partidas: GenerarDocumentoPartidaInput[];
}

export interface GenerarDocumentoResultado {
  documento_destino_id: number;
  tipo_documento_destino: TipoDocumento;
  folio: string | null;
  subtotal: number;
  iva: number;
  total: number;
  partidas: Array<{
    partida_destino_id: number;
    partida_origen_id: number;
    cantidad: number;
  }>;
}

function buildHeaders(token: string, empresaId: number | string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "X-Empresa-Id": empresaId.toString(),
    "Content-Type": "application/json",
  };
}

async function handleJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type");
  const isJson = contentType?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = (payload as any)?.message || response.statusText || "Error de solicitud";
    throw new Error(message);
  }

  return payload as T;
}

export async function getOpcionesGeneracion(
  documentoId: number,
  token: string,
  empresaId: number | string
): Promise<OpcionGeneracionResponse[]> {
  const resp = await fetch(`${BASE_PATH}/${documentoId}/opciones-generacion`, {
    headers: buildHeaders(token, empresaId),
  });
  return handleJsonResponse<OpcionGeneracionResponse[]>(resp);
}

export async function prepararGeneracion(
  documentoId: number,
  tipoDestino: TipoDocumento,
  token: string,
  empresaId: number | string
): Promise<PrepararGeneracionResponse> {
  const url = `${BASE_PATH}/${documentoId}/preparar-generacion?tipoDestino=${encodeURIComponent(tipoDestino)}`;
  const resp = await fetch(url, {
    headers: buildHeaders(token, empresaId),
  });
  return handleJsonResponse<PrepararGeneracionResponse>(resp);
}

export async function prepararGeneracionMultiple(
  documentoIds: number[],
  tipoDestino: TipoDocumento,
  token: string,
  empresaId: number | string
): Promise<PrepararGeneracionResponse> {
  const resp = await fetch(`${BASE_PATH}/preparar-generacion-multiple`, {
    method: "POST",
    headers: buildHeaders(token, empresaId),
    body: JSON.stringify({ documento_origen_ids: documentoIds, tipo_documento_destino: tipoDestino }),
  });
  return handleJsonResponse<PrepararGeneracionResponse>(resp);
}

export async function generarDocumentoDesdeOrigen(
  payload: GenerarDocumentoPayload,
  token: string,
  empresaId: number | string
): Promise<GenerarDocumentoResultado> {
  const resp = await fetch(`${BASE_PATH}/generar-desde-origen`, {
    method: "POST",
    headers: buildHeaders(token, empresaId),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse<GenerarDocumentoResultado>(resp);
}
