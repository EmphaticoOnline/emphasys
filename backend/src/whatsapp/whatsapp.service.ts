import axios from "axios";
import qs from "qs";
import pool from "../config/database";
import { normalizarTelefono } from "../utils/telefono";
import {
  actualizarConversacionSalienteWhatsapp,
  getOrCreateConversacionWhatsapp,
  getOrCreateWhatsappContacto,
  registrarMensajeAudioSalienteWhatsapp,
  registrarMensajeDocumentoSalienteWhatsapp,
  registrarMensajeImagenSalienteWhatsapp,
  registrarMensajePlantillaSalienteWhatsapp,
  registrarMensajeTextoSalienteWhatsapp,
} from "../crm/conversaciones.service";
import { getWhatsappConfig } from "./whatsapp-config.service";
import { resolverPlantillaWhatsapp } from "./whatsapp-plantillas.service";

const GUPSHUP_API_URL = "https://api.gupshup.io/wa/api/v1/msg";
const WHATSAPP_WINDOW_MINUTES = 1440;

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

export const sendTextMessage = async (empresaId: number, to: string, text: string) => {
  try {
    const config = await getWhatsappConfig(empresaId);

    const destinoNormalizado = normalizarTelefono(to);
    if (!destinoNormalizado) {
      throw new Error("telefono inválido o vacío para WhatsApp");
    }

    const contactoId = await getOrCreateWhatsappContacto(empresaId, destinoNormalizado);
    const conversacionId = await getOrCreateConversacionWhatsapp(empresaId, contactoId);

    await validateWhatsapp24hWindow(empresaId, conversacionId);

    const payload = qs.stringify({
      channel: "whatsapp",
      source: config.phone_number,
      destination: destinoNormalizado,
      message: JSON.stringify({
        type: "text",
        text
      })
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
      response.data?.messageId || null
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
  caption?: string | null
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

    const payload = qs.stringify({
      channel: "whatsapp",
      source: config.phone_number,
      destination: destinoNormalizado,
      message: JSON.stringify({
        type: "image",
        originalUrl: mediaUrl,
        previewUrl: mediaUrl,
        caption: caption ?? undefined
      })
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
      response.data?.messageId || null
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
  filename?: string | null
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

    const payload = qs.stringify({
      channel: "whatsapp",
      source: config.phone_number,
      destination: destinoNormalizado,
      message: JSON.stringify({
        type: "file",
        url: mediaUrl,
        filename: filename ?? undefined
      })
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

    console.log("📤 Documento enviado:", response.data);

    await registrarMensajeDocumentoSalienteWhatsapp(
      empresaId,
      conversacionId,
      destinoNormalizado,
      mediaUrl,
      filename ?? null,
      response.data?.messageId || null
    );

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
  mediaUrl: string
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

    const payload = qs.stringify({
      channel: "whatsapp",
      source: config.phone_number,
      destination: destinoNormalizado,
      message: JSON.stringify({
        type: "audio",
        url: mediaUrl
      })
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
      response.data?.messageId || null
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
  tipoPlantilla: string
) => {
  try {
    const config = await getWhatsappConfig(empresaId);
    const plantilla = await resolverPlantillaWhatsapp(empresaId, tipoPlantilla);

    if (!plantilla) {
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
    if (!destinoNormalizado) {
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
          destination: destinoNormalizado,
          message: JSON.stringify({
            type: "template",
            template: {
              id: plantilla.provider_template_id,
              params: []
            }
          })
        });
        break;
      default:
        throw new Error(`Proveedor de WhatsApp no soportado: ${plantilla.proveedor}`);
    }

    console.log("[WhatsApp Template] Payload", payload);

    console.log('[WhatsApp] API KEY EN USO:', config.api_key);
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

    console.log("[WhatsApp Template] API Response", response.status, response.data);

    await registrarMensajePlantillaSalienteWhatsapp(
      empresaId,
      conversacionId,
      destinoNormalizado,
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
    });
    throw error;
  }
};