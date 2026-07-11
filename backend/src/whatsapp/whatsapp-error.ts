import { WhatsappWindowExpiredError } from "./whatsapp.service";

export type WhatsappErrorCode =
  | "VENTANA_24_HORAS_CERRADA"
  | "NUMERO_INVALIDO"
  | "NUMERO_NO_REGISTRADO"
  | "CREDENCIALES_INVALIDAS"
  | "SERVICIO_NO_DISPONIBLE"
  | "ARCHIVO_NO_PERMITIDO"
  | "MENSAJE_VACIO"
  | "ERROR_DESCONOCIDO";

export type WhatsappErrorInfo = {
  httpStatus: number;
  codigo: WhatsappErrorCode;
  mensajeUsuario: string;
  accionSugerida: string | null;
  detalleTecnico: string;
  recuperable: boolean;
};

// Catálogo de mensajes para el usuario final (no técnicos). El detalle técnico
// real de cada caso se conserva aparte en `detalleTecnico` para diagnóstico,
// nunca se muestra en la interfaz.
const CATALOGO: Record<WhatsappErrorCode, Omit<WhatsappErrorInfo, "detalleTecnico">> = {
  VENTANA_24_HORAS_CERRADA: {
    httpStatus: 400,
    codigo: "VENTANA_24_HORAS_CERRADA",
    mensajeUsuario:
      "No puedes enviar un mensaje libre porque han pasado más de 24 horas desde el último mensaje del cliente. Puedes enviar una plantilla autorizada, pero debes esperar a que el cliente responda antes de continuar con mensajes normales.",
    accionSugerida: "Envía una plantilla autorizada de WhatsApp. El cliente debe responder para poder continuar con mensajes libres.",
    recuperable: false,
  },
  NUMERO_INVALIDO: {
    httpStatus: 400,
    codigo: "NUMERO_INVALIDO",
    mensajeUsuario: "El número telefónico del contacto no es válido para WhatsApp.",
    accionSugerida: "Revisa que tenga lada y 10 dígitos, sin caracteres adicionales.",
    recuperable: false,
  },
  NUMERO_NO_REGISTRADO: {
    httpStatus: 422,
    codigo: "NUMERO_NO_REGISTRADO",
    mensajeUsuario: "WhatsApp no pudo entregar el mensaje porque este número aparentemente no tiene una cuenta activa.",
    accionSugerida: null,
    recuperable: false,
  },
  CREDENCIALES_INVALIDAS: {
    httpStatus: 502,
    codigo: "CREDENCIALES_INVALIDAS",
    mensajeUsuario: "No fue posible conectarse con el servicio de WhatsApp de la empresa.",
    accionSugerida: "Repórtalo al administrador del sistema. No es un error de captura.",
    recuperable: false,
  },
  SERVICIO_NO_DISPONIBLE: {
    httpStatus: 503,
    codigo: "SERVICIO_NO_DISPONIBLE",
    mensajeUsuario: "El servicio de WhatsApp no está disponible temporalmente.",
    accionSugerida: "Espera unos minutos e intenta nuevamente.",
    recuperable: true,
  },
  ARCHIVO_NO_PERMITIDO: {
    httpStatus: 422,
    codigo: "ARCHIVO_NO_PERMITIDO",
    mensajeUsuario: "No se pudo enviar el archivo adjunto.",
    accionSugerida: null,
    recuperable: false,
  },
  MENSAJE_VACIO: {
    httpStatus: 400,
    codigo: "MENSAJE_VACIO",
    mensajeUsuario: "El mensaje está vacío o contiene información que no puede enviarse.",
    accionSugerida: null,
    recuperable: false,
  },
  ERROR_DESCONOCIDO: {
    httpStatus: 500,
    codigo: "ERROR_DESCONOCIDO",
    mensajeUsuario: "No fue posible enviar el mensaje por una causa no identificada.",
    accionSugerida: "Intenta nuevamente. Si el problema continúa, repórtalo al administrador.",
    recuperable: true,
  },
};

export function buildWhatsappErrorInfo(codigo: WhatsappErrorCode, detalleTecnico: string, overrides?: {
  mensajeUsuario?: string;
  accionSugerida?: string | null;
}): WhatsappErrorInfo {
  const base = CATALOGO[codigo];
  return {
    ...base,
    mensajeUsuario: overrides?.mensajeUsuario ?? base.mensajeUsuario,
    accionSugerida: overrides?.accionSugerida !== undefined ? overrides.accionSugerida : base.accionSugerida,
    detalleTecnico,
  };
}

function extraerCodigoGupshup(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const candidato = record.code ?? record.errorCode ?? (record.error as any)?.code;
  const num = Number(candidato);
  return Number.isFinite(num) ? num : null;
}

function stringifyDetalle(status: number | undefined, data: unknown, fallback: string): string {
  if (data !== undefined && data !== null) {
    try {
      return `HTTP ${status ?? "?"} - ${JSON.stringify(data)}`;
    } catch {
      return `HTTP ${status ?? "?"} - ${String(data)}`;
    }
  }
  return fallback;
}

/**
 * Traduce un error crudo (de axios/Gupshup, de validación interna, o de
 * dominio) a una respuesta comprensible para el usuario, sin inventar la
 * causa: si no hay evidencia suficiente para clasificar, cae en
 * ERROR_DESCONOCIDO y conserva el detalle técnico real para diagnóstico.
 */
export function classifyWhatsappError(error: unknown): WhatsappErrorInfo {
  if (error instanceof WhatsappWindowExpiredError) {
    return buildWhatsappErrorInfo("VENTANA_24_HORAS_CERRADA", `${error.code}: ${error.message}`);
  }

  const err = error as any;
  const status: number | undefined = err?.response?.status;
  const data = err?.response?.data;
  const detalleTecnico = stringifyDetalle(
    status,
    data,
    err?.code ? `${err.code}: ${err?.message ?? ""}` : (err?.message || String(error))
  );

  const rawMessage = typeof err?.message === "string" ? err.message : "";

  if (rawMessage.includes("telefono inválido o vacío")) {
    return buildWhatsappErrorInfo("NUMERO_INVALIDO", detalleTecnico);
  }

  if (
    rawMessage.includes("WhatsApp no configurado") ||
    rawMessage.includes("Configuración de WhatsApp incompleta")
  ) {
    return buildWhatsappErrorInfo("CREDENCIALES_INVALIDAS", detalleTecnico);
  }

  // Errores de red hacia Gupshup (no hubo respuesta del proveedor).
  if (status === undefined && typeof err?.code === "string") {
    const networkCodes = ["ECONNABORTED", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"];
    if (networkCodes.includes(err.code)) {
      return buildWhatsappErrorInfo("SERVICIO_NO_DISPONIBLE", detalleTecnico);
    }
  }

  // Códigos numéricos documentados de Gupshup dentro del body de error.
  // https://docs.gupshup.io/docs/error-and-status-messages
  const gupshupCode = extraerCodigoGupshup(data);
  if (gupshupCode === 1002) return buildWhatsappErrorInfo("NUMERO_NO_REGISTRADO", detalleTecnico);
  if (gupshupCode === 1001 || gupshupCode === 1003) return buildWhatsappErrorInfo("CREDENCIALES_INVALIDAS", detalleTecnico);
  if (gupshupCode === 1010) return buildWhatsappErrorInfo("ARCHIVO_NO_PERMITIDO", detalleTecnico);
  if (gupshupCode === 4001) return buildWhatsappErrorInfo("SERVICIO_NO_DISPONIBLE", detalleTecnico);

  if (status === 401 || status === 403) return buildWhatsappErrorInfo("CREDENCIALES_INVALIDAS", detalleTecnico);
  if (status === 429) return buildWhatsappErrorInfo("SERVICIO_NO_DISPONIBLE", detalleTecnico);
  if (typeof status === "number" && status >= 500) return buildWhatsappErrorInfo("SERVICIO_NO_DISPONIBLE", detalleTecnico);

  const mensajeGupshup = typeof (data as any)?.message === "string" ? (data as any).message.toLowerCase() : "";
  if (mensajeGupshup.includes("not opt") || mensajeGupshup.includes("not exist") || mensajeGupshup.includes("not a whatsapp")) {
    return buildWhatsappErrorInfo("NUMERO_NO_REGISTRADO", detalleTecnico);
  }
  if (mensajeGupshup.includes("invalid destination") || mensajeGupshup.includes("invalid number")) {
    return buildWhatsappErrorInfo("NUMERO_INVALIDO", detalleTecnico);
  }
  if (mensajeGupshup.includes("media") || mensajeGupshup.includes("url")) {
    return buildWhatsappErrorInfo("ARCHIVO_NO_PERMITIDO", detalleTecnico);
  }

  return buildWhatsappErrorInfo("ERROR_DESCONOCIDO", detalleTecnico);
}

export type WhatsappTechnicalLogParams = {
  empresaId: number | string | null;
  telefono: string | null;
  usuarioId: number | string | null;
  tipoMensaje: string;
  tieneAdjunto: boolean;
  info: WhatsappErrorInfo;
};

/**
 * Registro técnico para diagnóstico (requerimiento: conservar causa real
 * aunque el usuario vea un mensaje comprensible). No incluye tokens,
 * contraseñas ni credenciales.
 */
export function logWhatsappFailureTechnical(params: WhatsappTechnicalLogParams) {
  console.error("[WhatsApp Enviar] Fallo clasificado", {
    empresaId: params.empresaId,
    telefono: params.telefono,
    usuarioId: params.usuarioId,
    tipoMensaje: params.tipoMensaje,
    tieneAdjunto: params.tieneAdjunto,
    fecha: new Date().toISOString(),
    httpStatus: params.info.httpStatus,
    codigo: params.info.codigo,
    detalleTecnico: params.info.detalleTecnico,
  });
}
