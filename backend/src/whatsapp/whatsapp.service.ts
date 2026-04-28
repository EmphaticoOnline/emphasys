import axios from "axios";
import qs from "qs";
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

export const sendTextMessage = async (empresaId: number, to: string, text: string) => {
  try {
    const config = await getWhatsappConfig(empresaId);

    const destinoNormalizado = normalizarTelefono(to);
    if (!destinoNormalizado) {
      throw new Error("telefono inválido o vacío para WhatsApp");
    }

    const contactoId = await getOrCreateWhatsappContacto(empresaId, destinoNormalizado);
    const conversacionId = await getOrCreateConversacionWhatsapp(empresaId, contactoId);

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
    console.error("❌ Error enviando mensaje:", error.response?.data || error.message);
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
    console.error("❌ Error enviando imagen:", error.response?.data || error.message);
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
    console.error("❌ Error enviando documento:", error.response?.data || error.message);
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
    console.error("❌ Error enviando audio:", error.response?.data || error.message);
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