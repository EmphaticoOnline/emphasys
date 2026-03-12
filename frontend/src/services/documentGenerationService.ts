const BASE_PATH = "/api/documentos";

type TipoDocumento =
  | "cotizacion"
  | "factura"
  | "pedido"
  | "remision"
  | "orden_entrega"
  | "requisicion"
  | "orden_compra"
  | "recepcion"
  | "factura_compra";

export interface OpcionGeneracionResponse {
  tipo_documento_destino: TipoDocumento;
  nombre: string;
  orden?: number;
}

export interface PrepararGeneracionPartida {
  partida_id: number;
  producto_id: number | null;
  descripcion: string | null;
  unidad: string | null;
  cantidad_origen: number;
  cantidad_ya_generada: number;
  cantidad_pendiente_sugerida: number;
  cantidad_default: number;
  precio_unitario: number;
}

export interface PrepararGeneracionResponse {
  documento_origen: {
    documento_id: number;
    tipo_documento: TipoDocumento;
    folio: string | null;
  };
  tipo_documento_destino: TipoDocumento;
  partidas: PrepararGeneracionPartida[];
}

export interface GenerarDocumentoPartidaInput {
  partida_origen_id: number;
  cantidad: number;
}

export interface GenerarDocumentoPayload {
  documento_origen_id: number;
  tipo_documento_destino: TipoDocumento;
  datos_encabezado?: Record<string, unknown>;
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
