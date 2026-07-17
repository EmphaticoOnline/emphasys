import axios from "axios";
import qs from "qs";
import pool from "../config/database";
import { normalizarTelefono } from "../utils/telefono";
import {
  actualizarConversacionSalienteWhatsapp,
  getOrCreateConversacionWhatsapp,
  getOrCreateWhatsappContacto,
  obtenerIdExternoMensaje,
  registrarMensajeAudioSalienteWhatsapp,
  registrarMensajeDocumentoSalienteWhatsapp,
  registrarMensajeImagenSalienteWhatsapp,
  registrarMensajePlantillaSalienteWhatsapp,
  registrarMensajeTextoSalienteWhatsapp,
  type MensajeSalienteMetadata,
} from "../crm/conversaciones.service";
import { getWhatsappConfig } from "./whatsapp-config.service";
import { resolverPlantillaWhatsapp, type WhatsappPlantilla } from "./whatsapp-plantillas.service";

const GUPSHUP_API_URL = "https://api.gupshup.io/wa/api/v1/msg";
const GUPSHUP_TEMPLATE_API_URL = "https://api.gupshup.io/wa/api/v1/template/msg";
const WHATSAPP_WINDOW_MINUTES = 1440;

// Límite de destinatarios por operación de reenvío múltiple: evita que un
// clic accidental (o un uso indebido tipo campaña masiva) dispare cientos de
// envíos simultáneos hacia Gupshup. No hay una configuración general de
// límites de envío en el sistema todavía, así que se deja como constante
// simple y fácil de ajustar hasta que exista una necesidad real de hacerla
// configurable por empresa.
export const MAX_REENVIO_DESTINATARIOS = 20;

// Cuántos reenvíos se procesan en paralelo dentro de una misma operación
// múltiple. No existe en el backend ninguna librería de control de
// concurrencia (p-limit, Bottleneck, etc.), así que se usa un lote simple
// propio en vez de agregar una dependencia nueva para este único caso de uso.
export const REENVIO_CONCURRENCY = 3;

export class WhatsappWindowExpiredError extends Error {
  status: number;
  code: string;

  constructor(message: string) {
    super(message);
    this.name = "WhatsappWindowExpiredError";
    this.status = 400;
    this.code = "WHATSAPP_WINDOW_EXPIRED";
  }
}

async function validateWhatsapp24hWindow(empresaId: number, conversacionId: number) {
  const { rows } = await pool.query<{
    id: number;
    tipo_mensaje: string | null;
    fecha_referencia: string | null;
  }>(
    `
      SELECT
        id,
        tipo_mensaje,
        COALESCE(fecha_envio, creado_en) AS fecha_referencia
      FROM crm.mensajes
      WHERE empresa_id = $1
        AND conversacion_id = $2
        AND canal = 'whatsapp'
        AND tipo_mensaje = 'entrante'
      ORDER BY COALESCE(fecha_envio, creado_en) DESC NULLS LAST, id DESC
      LIMIT 1
    `,
    [empresaId, conversacionId]
  );

  const lastIncoming = rows[0] ?? null;

  console.log("[WhatsApp Window] Último mensaje entrante", {
    empresaId,
    conversacionId,
    lastIncoming,
  });

  if (!lastIncoming) {
    console.warn("[WhatsApp Window] Ventana cerrada: no existe mensaje entrante previo", {
      empresaId,
      conversacionId,
    });
    throw new WhatsappWindowExpiredError(
      "Este cliente no ha iniciado conversación. Debes usar una plantilla para iniciar contacto."
    );
  }

  if (!lastIncoming.fecha_referencia) {
    console.warn("[WhatsApp Window] Ventana cerrada: fecha inválida en último mensaje entrante", {
      empresaId,
      conversacionId,
      fecha_referencia: lastIncoming.fecha_referencia,
    });
    throw new WhatsappWindowExpiredError(
      "La ventana de 24 horas ha expirado. Debes usar una plantilla para reactivar la conversación."
    );
  }

  const referenceDate = new Date(lastIncoming.fecha_referencia);
  const referenceMs = referenceDate.getTime();

  if (Number.isNaN(referenceMs)) {
    console.warn("[WhatsApp Window] Ventana cerrada: fecha inválida en último mensaje entrante", {
      empresaId,
      conversacionId,
      fecha_referencia: lastIncoming.fecha_referencia,
    });
    throw new WhatsappWindowExpiredError(
      "La ventana de 24 horas ha expirado. Debes usar una plantilla para reactivar la conversación."
    );
  }

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - referenceMs) / 60000));
  const withinWindow = elapsedMinutes <= WHATSAPP_WINDOW_MINUTES;

  console.log("[WhatsApp Window] Resultado validación", {
    empresaId,
    conversacionId,
    lastIncomingId: lastIncoming.id,
    elapsedMinutes,
    thresholdMinutes: WHATSAPP_WINDOW_MINUTES,
    withinWindow,
  });

  if (!withinWindow) {
    throw new WhatsappWindowExpiredError(
      "La ventana de 24 horas ha expirado. Debes usar una plantilla para reactivar la conversación."
    );
  }
}

// Antes de reenviar un adjunto se verifica que su URL siga siendo accesible:
// los adjuntos entrantes guardan la URL cruda que mandó Gupshup en el
// webhook (ver whatsapp.mapper.ts) y esas URLs pueden ser temporales, así
// que no hay garantía de que sigan vigentes al momento de reenviar. Los
// adjuntos salientes (subidos por el usuario a /api/uploads) sí son
// persistentes, pero se valida igual por uniformidad y como red de
// seguridad barata. Si la verificación falla, el llamador debe tratar el
// destino como "archivo no disponible" y no intentar el envío.
export async function verifyMediaUrlReachable(mediaUrl: string): Promise<boolean> {
  try {
    const response = await axios.head(mediaUrl, { timeout: 4000, validateStatus: () => true });
    if (response.status >= 200 && response.status < 400) return true;
  } catch {
    // Algunos servidores no soportan HEAD; se reintenta con GET abajo.
  }

  try {
    const response = await axios.get(mediaUrl, {
      timeout: 4000,
      validateStatus: () => true,
      headers: { Range: "bytes=0-0" },
      responseType: "arraybuffer",
    });
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  }
}

function logWhatsappSendError(context: string, error: unknown) {
  if (error instanceof WhatsappWindowExpiredError) {
    console.warn(`[WhatsApp Send] ${context}: ventana expirada`, {
      code: error.code,
      message: error.message,
      status: error.status,
    });
    return;
  }

  const typedError = error as any;
  console.error(`[WhatsApp Send] ${context}: error`, typedError?.response?.data || typedError?.message || error);
}

// Resuelve el id_externo (gsId de Gupshup para mensajes salientes, wamid de WhatsApp para
// entrantes) del mensaje citado, para anidarlo como context.msgId dentro del `message` que
// se manda a Gupshup y que WhatsApp renderice la cita nativa en el teléfono del destinatario.
// Si no hay mensaje citado, no tiene id_externo, o falla la consulta, se omite en silencio:
// el mensaje se envía igual, solo sin la cita nativa.
async function resolveReplyContext(
  empresaId: number,
  mensajeRespuestaId?: number | null
): Promise<{ msgId: string } | undefined> {
  if (!mensajeRespuestaId) return undefined;

  try {
    const idExterno = await obtenerIdExternoMensaje(empresaId, mensajeRespuestaId);
    if (!idExterno) {
      console.warn('[WhatsApp Send] Mensaje citado sin id_externo, se envía sin context de Gupshup', {
        empresaId,
        mensajeRespuestaId,
      });
      return undefined;
    }
    return { msgId: idExterno };
  } catch (error) {
    console.warn('[WhatsApp Send] No se pudo resolver el mensaje citado para el context de Gupshup', {
      empresaId,
      mensajeRespuestaId,
      error: (error as Error)?.message,
    });
    return undefined;
  }
}

export const sendTextMessage = async (
  empresaId: number,
  to: string,
  text: string,
  mensajeRespuestaId?: number | null,
  forwardMetadata?: MensajeSalienteMetadata | null
) => {
  try {
    const config = await getWhatsappConfig(empresaId);

    const destinoNormalizado = normalizarTelefono(to);
    if (!destinoNormalizado) {
      throw new Error("telefono inválido o vacío para WhatsApp");
    }

    const contactoId = await getOrCreateWhatsappContacto(empresaId, destinoNormalizado);
    const conversacionId = await getOrCreateConversacionWhatsapp(empresaId, contactoId);

    await validateWhatsapp24hWindow(empresaId, conversacionId);

    const replyContext = await resolveReplyContext(empresaId, mensajeRespuestaId);

    const textMessagePayload = {
      type: "text",
      text,
      ...(replyContext ? { context: replyContext } : {})
    };

    if (replyContext) {
      console.log('[WhatsApp Send][Reply] message final a Gupshup (texto):', JSON.stringify(textMessagePayload, null, 2));
    }

    const payload = qs.stringify({
      channel: "whatsapp",
      source: config.phone_number,
      destination: destinoNormalizado,
      message: JSON.stringify(textMessagePayload)
    });

    const response = await axios.post(
      GUPSHUP_API_URL,
      payload,
      {
        headers: {
          apikey: config.api_key,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    console.log("📤 Mensaje enviado:", response.data);

    await registrarMensajeTextoSalienteWhatsapp(
      empresaId,
      conversacionId,
      destinoNormalizado,
      text,
      response.data?.messageId || null,
      mensajeRespuestaId ?? null,
      forwardMetadata ?? null
    );

    await actualizarConversacionSalienteWhatsapp(conversacionId, empresaId);

    return response.data;

  } catch (error: any) {
    logWhatsappSendError("text", error);
    throw error;
  }
};

export const sendImageMessage = async (
  empresaId: number,
  to: string,
  mediaUrl: string,
  caption?: string | null,
  mensajeRespuestaId?: number | null,
  forwardMetadata?: MensajeSalienteMetadata | null
) => {
  try {
    const config = await getWhatsappConfig(empresaId);

    const destinoNormalizado = normalizarTelefono(to);
    if (!destinoNormalizado) {
      throw new Error("telefono inválido o vacío para WhatsApp");
    }

    const contactoId = await getOrCreateWhatsappContacto(empresaId, destinoNormalizado);
    const conversacionId = await getOrCreateConversacionWhatsapp(empresaId, contactoId);

    await validateWhatsapp24hWindow(empresaId, conversacionId);

    const replyContext = await resolveReplyContext(empresaId, mensajeRespuestaId);

    const imageMessagePayload = {
      type: "image",
      originalUrl: mediaUrl,
      previewUrl: mediaUrl,
      caption: caption ?? undefined,
      ...(replyContext ? { context: replyContext } : {})
    };

    if (replyContext) {
      console.log('[WhatsApp Send][Reply] message final a Gupshup (imagen):', JSON.stringify(imageMessagePayload, null, 2));
    }

    const payload = qs.stringify({
      channel: "whatsapp",
      source: config.phone_number,
      destination: destinoNormalizado,
      message: JSON.stringify(imageMessagePayload)
    });

    const response = await axios.post(
      GUPSHUP_API_URL,
      payload,
      {
        headers: {
          apikey: config.api_key,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    console.log("📤 Imagen enviada:", response.data);

    await registrarMensajeImagenSalienteWhatsapp(
      empresaId,
      conversacionId,
      destinoNormalizado,
      mediaUrl,
      caption ?? null,
      response.data?.messageId || null,
      mensajeRespuestaId ?? null,
      forwardMetadata ?? null
    );

    await actualizarConversacionSalienteWhatsapp(conversacionId, empresaId);

    return response.data;
  } catch (error: any) {
    logWhatsappSendError("image", error);
    throw error;
  }
};

export const sendDocumentMessage = async (
  empresaId: number,
  to: string,
  mediaUrl: string,
  filename?: string | null,
  options?: {
    skipWindowValidation?: boolean;
    mensajeRespuestaId?: number | null;
    forwardMetadata?: MensajeSalienteMetadata | null;
  }
) => {
  try {
    const config = await getWhatsappConfig(empresaId);
    const destinoGupshup = String(to).replace(/\D/g, '');

    const destinoNormalizado = normalizarTelefono(to);
    if (!destinoGupshup) {
      throw new Error("telefono inválido o vacío para WhatsApp");
    }

    console.info('[WhatsApp Media] Input', {
      empresaId,
      telefonoOriginal: to,
      telefonoFinal: destinoNormalizado,
      telefonoGupshup: destinoGupshup,
      mediaUrl,
      filename: filename ?? null,
      skipWindowValidation: Boolean(options?.skipWindowValidation),
      endpoint: GUPSHUP_API_URL,
    });

    const contactoId = await getOrCreateWhatsappContacto(empresaId, destinoNormalizado);
    const conversacionId = await getOrCreateConversacionWhatsapp(empresaId, contactoId);

    if (!options?.skipWindowValidation) {
      await validateWhatsapp24hWindow(empresaId, conversacionId);
    }

    console.log('[WhatsApp Media] Enviando documento', {
      empresaId,
      destino: destinoNormalizado,
      mediaUrl,
      filename: filename ?? null,
      skipWindowValidation: Boolean(options?.skipWindowValidation),
    });

    const replyContext = await resolveReplyContext(empresaId, options?.mensajeRespuestaId);

    const documentMessagePayload = {
      type: "file",
      url: mediaUrl,
      filename: filename ?? undefined,
      ...(replyContext ? { context: replyContext } : {})
    };

    if (replyContext) {
      console.log('[WhatsApp Send][Reply] message final a Gupshup (documento):', JSON.stringify(documentMessagePayload, null, 2));
    }

    const payload = qs.stringify({
      channel: "whatsapp",
      source: config.phone_number,
      destination: destinoGupshup,
      message: JSON.stringify(documentMessagePayload)
    });

    console.log('[WhatsApp Media] Payload documento', payload);

    const response = await axios.post(
      GUPSHUP_API_URL,
      payload,
      {
        headers: {
          apikey: config.api_key,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    console.log("📤 Documento enviado:", {
      status: response.status,
      data: response.data,
    });
    console.log('[WhatsApp Media] Respuesta documento', {
      empresaId,
      destino: destinoGupshup,
      destinoNormalizado,
      mediaUrl,
      filename: filename ?? null,
      endpoint: GUPSHUP_API_URL,
      httpStatus: response.status,
      response: response.data,
      messageId: response.data?.messageId || null,
    });

    await registrarMensajeDocumentoSalienteWhatsapp(
      empresaId,
      conversacionId,
      destinoGupshup,
      mediaUrl,
      filename ?? null,
      response.data?.messageId || null,
      options?.mensajeRespuestaId ?? null,
      options?.forwardMetadata ?? null
    );

    console.info('[WhatsApp Media] Registro interno documento completado', {
      empresaId,
      conversacionId,
      destino: destinoGupshup,
      destinoNormalizado,
      messageId: response.data?.messageId || null,
      httpStatus: response.status,
      note: 'El envio se considera exitoso cuando axios.post resuelve; no se valida una confirmacion de entrega del proveedor',
    });

    await actualizarConversacionSalienteWhatsapp(conversacionId, empresaId);

    return response.data;
  } catch (error: any) {
    logWhatsappSendError("document", error);
    throw error;
  }
};

export const sendAudioMessage = async (
  empresaId: number,
  to: string,
  mediaUrl: string,
  mensajeRespuestaId?: number | null,
  forwardMetadata?: MensajeSalienteMetadata | null
) => {
  try {
    const config = await getWhatsappConfig(empresaId);

    const destinoNormalizado = normalizarTelefono(to);
    if (!destinoNormalizado) {
      throw new Error("telefono inválido o vacío para WhatsApp");
    }

    const contactoId = await getOrCreateWhatsappContacto(empresaId, destinoNormalizado);
    const conversacionId = await getOrCreateConversacionWhatsapp(empresaId, contactoId);

    await validateWhatsapp24hWindow(empresaId, conversacionId);

    const replyContext = await resolveReplyContext(empresaId, mensajeRespuestaId);

    const audioMessagePayload = {
      type: "audio",
      url: mediaUrl,
      ...(replyContext ? { context: replyContext } : {})
    };

    if (replyContext) {
      console.log('[WhatsApp Send][Reply] message final a Gupshup (audio):', JSON.stringify(audioMessagePayload, null, 2));
    }

    const payload = qs.stringify({
      channel: "whatsapp",
      source: config.phone_number,
      destination: destinoNormalizado,
      message: JSON.stringify(audioMessagePayload)
    });

    const response = await axios.post(
      GUPSHUP_API_URL,
      payload,
      {
        headers: {
          apikey: config.api_key,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    console.log("📤 Audio enviado:", response.data);

    await registrarMensajeAudioSalienteWhatsapp(
      empresaId,
      conversacionId,
      destinoNormalizado,
      mediaUrl,
      response.data?.messageId || null,
      mensajeRespuestaId ?? null,
      forwardMetadata ?? null
    );

    await actualizarConversacionSalienteWhatsapp(conversacionId, empresaId);

    return response.data;
  } catch (error: any) {
    logWhatsappSendError("audio", error);
    throw error;
  }
};

export const sendTemplateMessage = async (
  empresaId: number,
  to: string,
  tipoPlantilla: string,
  params: string[] = []
) => {
  try {
    console.info('[WhatsApp Template] Inicio de flujo template', {
      empresaId,
      destinoOriginal: to,
      tipoPlantilla,
    });

    const config = await getWhatsappConfig(empresaId);
    const plantilla = await resolverPlantillaWhatsapp(empresaId, tipoPlantilla);

    if (!plantilla) {
      console.warn('[WhatsApp Template] No se encontro plantilla activa para el tipo solicitado', {
        empresaId,
        tipoPlantilla,
      });
      return { error: true, message: "No hay plantilla activa configurada" };
    }

    console.log("[WhatsApp Template] Input", {
      empresaId,
      destino: to,
      proveedor: plantilla.proveedor,
      provider_template_id: plantilla.provider_template_id,
      tipo: tipoPlantilla,
    });

    const destinoNormalizado = normalizarTelefono(to);
    const destinoGupshup = String(to).replace(/\D/g, '');
    if (!destinoGupshup) {
      throw new Error("telefono inválido o vacío para WhatsApp");
    }

    const contactoId = await getOrCreateWhatsappContacto(empresaId, destinoNormalizado);
    const conversacionId = await getOrCreateConversacionWhatsapp(empresaId, contactoId);

    const proveedorNormalized = plantilla.proveedor?.toLowerCase();
    let payload: string;

    switch (proveedorNormalized) {
      case "gupshup":
        payload = qs.stringify({
          channel: "whatsapp",
          source: config.phone_number,
          "src.name": config.app_name,
          destination: destinoGupshup,
          template: JSON.stringify({
            id: plantilla.provider_template_id,
            params,
          }),
          message: JSON.stringify({
            type: "text",
            text: "text",
          }),
        });
        break;
      default:
        throw new Error(`Proveedor de WhatsApp no soportado: ${plantilla.proveedor}`);
    }

    console.log("[WhatsApp Template] Payload", payload);

    const response = await axios.post(
      GUPSHUP_TEMPLATE_API_URL,
      payload,
      {
        headers: {
          apikey: config.api_key,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    console.log("[WhatsApp Template] API Response", {
      httpStatus: response.status,
      data: response.data,
    });
    console.info('[WhatsApp Template] Confirmacion temporal', {
      empresaId,
      telefonoOriginal: to,
      telefonoFinal: destinoNormalizado,
      telefonoGupshup: destinoGupshup,
      proveedor: plantilla.proveedor,
      provider_template_id: plantilla.provider_template_id,
      endpoint: GUPSHUP_API_URL,
      httpStatus: response.status,
      responseBody: response.data,
      messageId: response.data?.messageId || null,
      note: 'El flujo asume exito si axios.post resuelve; no existe validacion adicional del proveedor',
    });

    await registrarMensajePlantillaSalienteWhatsapp(
      empresaId,
      conversacionId,
      destinoGupshup,
      `Plantilla: ${plantilla.nombre_interno}`,
      response.data?.messageId || null
    );

    await actualizarConversacionSalienteWhatsapp(conversacionId, empresaId);

    return { ...response.data, plantilla_usada: plantilla.provider_template_id };
  } catch (error: any) {
    console.error("[WhatsApp Template] API Error", {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      providerResponse: error?.response?.data,
    });
    throw error;
  }
};

export const sendTemplateDocumentMessage = async (
  empresaId: number,
  to: string,
  tipoPlantilla: string,
  params: string[],
  documentLink: string,
  filename: string
) => {
  try {
    console.info('[WhatsApp Template Document] Inicio de flujo', {
      empresaId,
      destinoOriginal: to,
      tipoPlantilla,
      documentLink,
      filename,
      params,
    });

    const config = await getWhatsappConfig(empresaId);
    const plantilla = await resolverPlantillaWhatsapp(empresaId, tipoPlantilla);

    if (!plantilla) {
      console.warn('[WhatsApp Template Document] No se encontro plantilla activa para el tipo solicitado', {
        empresaId,
        tipoPlantilla,
      });
      return { error: true, message: 'No hay plantilla activa configurada' };
    }

    const destinoNormalizado = normalizarTelefono(to);
    const destinoGupshup = String(to).replace(/\D/g, '');
    if (!destinoGupshup) {
      throw new Error('telefono inválido o vacío para WhatsApp');
    }

    const contactoId = await getOrCreateWhatsappContacto(empresaId, destinoNormalizado);
    const conversacionId = await getOrCreateConversacionWhatsapp(empresaId, contactoId);

    const proveedorNormalized = plantilla.proveedor?.toLowerCase();
    let payload: string;
    let payloadDebug: Record<string, unknown>;

    switch (proveedorNormalized) {
      case 'gupshup':
        payloadDebug = {
          channel: 'whatsapp',
          source: config.phone_number,
          'src.name': config.app_name,
          destination: destinoGupshup,
          template: JSON.stringify({
            id: plantilla.provider_template_id,
            params,
          }),
          message: JSON.stringify({
            type: 'document',
            document: {
              link: documentLink,
              filename,
            },
          }),
        };
        payload = qs.stringify(payloadDebug);
        break;
      default:
        throw new Error(`Proveedor de WhatsApp no soportado: ${plantilla.proveedor}`);
    }

    console.log('[WhatsApp Template Document] Payload', payload);
    console.info('[WhatsApp Template Document] Payload estructurado', {
      source: config.phone_number,
      srcName: config.app_name,
      destination: destinoGupshup,
      template: {
        id: plantilla.provider_template_id,
        params,
      },
      message: {
        type: 'document',
        document: {
          link: documentLink,
          filename,
        },
      },
    });

    const response = await axios.post(
      GUPSHUP_TEMPLATE_API_URL,
      payload,
      {
        headers: {
          apikey: config.api_key,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    console.log('[WhatsApp Template Document] API Response', {
      httpStatus: response.status,
      data: response.data,
    });

    await registrarMensajePlantillaSalienteWhatsapp(
      empresaId,
      conversacionId,
      destinoGupshup,
      `Plantilla: ${plantilla.nombre_interno}`,
      response.data?.messageId || null
    );

    await actualizarConversacionSalienteWhatsapp(conversacionId, empresaId);

    return { ...response.data, plantilla_usada: plantilla.provider_template_id };
  } catch (error: any) {
    console.error('[WhatsApp Template Document] API Error', {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      providerResponse: error?.response?.data,
    });
    throw error;
  }
};

export const sendTemplateMensajeDirecta = async (
  empresaId: number,
  to: string,
  plantilla: WhatsappPlantilla,
  params: string[] = []
) => {
  try {
    const config = await getWhatsappConfig(empresaId);

    const destinoNormalizado = normalizarTelefono(to);
    const destinoGupshup = String(to).replace(/\D/g, '');
    if (!destinoGupshup) {
      throw new Error("telefono inválido o vacío para WhatsApp");
    }

    const contactoId = await getOrCreateWhatsappContacto(empresaId, destinoNormalizado);
    const conversacionId = await getOrCreateConversacionWhatsapp(empresaId, contactoId);

    const proveedorNormalized = plantilla.proveedor?.toLowerCase();
    let payload: string;

    switch (proveedorNormalized) {
      case "gupshup":
        payload = qs.stringify({
          channel: "whatsapp",
          source: config.phone_number,
          "src.name": config.app_name,
          destination: destinoGupshup,
          template: JSON.stringify({
            id: plantilla.provider_template_id,
            params,
          }),
          message: JSON.stringify({
            type: "text",
            text: "text",
          }),
        });
        break;
      default:
        throw new Error(`Proveedor de WhatsApp no soportado: ${plantilla.proveedor}`);
    }

    const response = await axios.post(
      GUPSHUP_TEMPLATE_API_URL,
      payload,
      {
        headers: {
          apikey: config.api_key,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    await registrarMensajePlantillaSalienteWhatsapp(
      empresaId,
      conversacionId,
      destinoGupshup,
      `Plantilla: ${plantilla.nombre_interno}`,
      response.data?.messageId || null
    );

    await actualizarConversacionSalienteWhatsapp(conversacionId, empresaId);

    return { ...response.data, plantilla_usada: plantilla.provider_template_id };
  } catch (error: any) {
    console.error("[WhatsApp Template Directa] API Error", {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    });
    throw error;
  }
};