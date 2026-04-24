import axios from "axios";
import qs from "qs";
import pool from "../config/database";
import { normalizarTelefono } from "../utils/telefono";
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

    // 🔎 1️⃣ Resolver contacto para el número (crear si falta)
    const contactoResult = await pool.query(
      `
      SELECT id
      FROM public.contactos
      WHERE empresa_id = $1
        AND telefono = $2
      LIMIT 1
      `,
      [empresaId, destinoNormalizado]
    );

    let contactoId: number;

    if (contactoResult.rows.length > 0) {
      contactoId = contactoResult.rows[0].id;
    } else {
      const newContacto = await pool.query(
        `
        INSERT INTO public.contactos
  (empresa_id, tipo_contacto, nombre, telefono, activo, bloqueado)
  VALUES ($1, 'Lead', $2, $3, true, false)
        RETURNING id
        `,
        [empresaId, destinoNormalizado, destinoNormalizado]
      );

      contactoId = newContacto.rows[0].id;
    }

    // 🔎 2️⃣ Buscar conversación abierta para ese contacto
    const convResult = await pool.query(
      `
      SELECT id
      FROM whatsapp.conversaciones
      WHERE empresa_id = $1
        AND contacto_id = $2
        AND estado = 'abierta'
      ORDER BY creada_en DESC
      LIMIT 1
      `,
      [empresaId, contactoId]
    );

    let conversacionId: number;

    if (convResult.rows.length > 0) {
      conversacionId = convResult.rows[0].id;
    } else {
      const newConv = await pool.query(
        `
        INSERT INTO whatsapp.conversaciones
        (empresa_id, contacto_id, estado, creada_en, ultimo_mensaje_en)
        VALUES ($1, $2, 'abierta', NOW(), NOW())
        RETURNING id
        `,
        [empresaId, contactoId]
      );

      conversacionId = newConv.rows[0].id;
    }

    // 📤 3️⃣ Enviar mensaje a Gupshup
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

    // 💾 4️⃣ Guardar mensaje saliente
    await pool.query(
      `
      INSERT INTO whatsapp.mensajes
      (
        empresa_id,
        conversacion_id,
        telefono,
        tipo_mensaje,
        canal,
        tipo_contenido,
        contenido,
        fecha_envio,
        id_externo,
        status,
        creado_en
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8,$9,NOW())
      `,
      [
        empresaId,
        conversacionId,
        destinoNormalizado,
        'saliente',
        'whatsapp',
        'text',
        text,
        response.data?.messageId || null,
        'sent'
      ]
    );

    await pool.query(
      `
      UPDATE whatsapp.conversaciones
      SET
        ultimo_mensaje_en = GREATEST(ultimo_mensaje_en, NOW()),
        etapa_oportunidad = CASE
          WHEN etapa_oportunidad = 'nuevo' THEN 'contactado'
          ELSE etapa_oportunidad
        END
      WHERE id = $1
        AND empresa_id = $2
      `,
      [conversacionId, empresaId]
    );

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

    const contactoResult = await pool.query(
      `
      SELECT id
      FROM public.contactos
      WHERE empresa_id = $1
        AND telefono = $2
      LIMIT 1
      `,
      [empresaId, destinoNormalizado]
    );

    let contactoId: number;

    if (contactoResult.rows.length > 0) {
      contactoId = contactoResult.rows[0].id;
    } else {
      const newContacto = await pool.query(
        `
        INSERT INTO public.contactos
  (empresa_id, tipo_contacto, nombre, telefono, activo, bloqueado)
  VALUES ($1, 'Lead', $2, $3, true, false)
        RETURNING id
        `,
        [empresaId, destinoNormalizado, destinoNormalizado]
      );

      contactoId = newContacto.rows[0].id;
    }

    const convResult = await pool.query(
      `
      SELECT id
      FROM whatsapp.conversaciones
      WHERE empresa_id = $1
        AND contacto_id = $2
        AND estado = 'abierta'
      ORDER BY creada_en DESC
      LIMIT 1
      `,
      [empresaId, contactoId]
    );

    let conversacionId: number;

    if (convResult.rows.length > 0) {
      conversacionId = convResult.rows[0].id;
    } else {
      const newConv = await pool.query(
        `
        INSERT INTO whatsapp.conversaciones
        (empresa_id, contacto_id, estado, creada_en, ultimo_mensaje_en)
        VALUES ($1, $2, 'abierta', NOW(), NOW())
        RETURNING id
        `,
        [empresaId, contactoId]
      );

      conversacionId = newConv.rows[0].id;
    }

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

    await pool.query(
      `
      INSERT INTO whatsapp.mensajes
      (
        empresa_id,
        conversacion_id,
        telefono,
        tipo_mensaje,
        canal,
        tipo_contenido,
        caption,
        contenido,
        fecha_envio,
        id_externo,
        status,
        creado_en
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),$9,$10,NOW())
      `,
      [
        empresaId,
        conversacionId,
        destinoNormalizado,
        'saliente',
        'whatsapp',
        'image',
        caption ?? null,
        mediaUrl,
        response.data?.messageId || null,
        'sent'
      ]
    );

    await pool.query(
      `
      UPDATE whatsapp.conversaciones
      SET
        ultimo_mensaje_en = GREATEST(ultimo_mensaje_en, NOW()),
        etapa_oportunidad = CASE
          WHEN etapa_oportunidad = 'nuevo' THEN 'contactado'
          ELSE etapa_oportunidad
        END
      WHERE id = $1
        AND empresa_id = $2
      `,
      [conversacionId, empresaId]
    );

    return response.data;
  } catch (error: any) {
    console.error("❌ Error enviando imagen:", error.response?.data || error.message);
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

    const contactoResult = await pool.query(
      `
      SELECT id
      FROM public.contactos
      WHERE empresa_id = $1
        AND telefono = $2
      LIMIT 1
      `,
      [empresaId, destinoNormalizado]
    );

    let contactoId: number;

    if (contactoResult.rows.length > 0) {
      contactoId = contactoResult.rows[0].id;
    } else {
      const newContacto = await pool.query(
        `
        INSERT INTO public.contactos
  (empresa_id, tipo_contacto, nombre, telefono, activo, bloqueado)
  VALUES ($1, 'Lead', $2, $3, true, false)
        RETURNING id
        `,
        [empresaId, destinoNormalizado, destinoNormalizado]
      );

      contactoId = newContacto.rows[0].id;
    }

    const convResult = await pool.query(
      `
      SELECT id
      FROM whatsapp.conversaciones
      WHERE empresa_id = $1
        AND contacto_id = $2
        AND estado = 'abierta'
      ORDER BY creada_en DESC
      LIMIT 1
      `,
      [empresaId, contactoId]
    );

    let conversacionId: number;

    if (convResult.rows.length > 0) {
      conversacionId = convResult.rows[0].id;
    } else {
      const newConv = await pool.query(
        `
        INSERT INTO whatsapp.conversaciones
        (empresa_id, contacto_id, estado, creada_en, ultimo_mensaje_en)
        VALUES ($1, $2, 'abierta', NOW(), NOW())
        RETURNING id
        `,
        [empresaId, contactoId]
      );

      conversacionId = newConv.rows[0].id;
    }

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

    // TEMP: log de API key en uso para diagnóstico
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

    await pool.query(
      `
      INSERT INTO whatsapp.mensajes
      (
        empresa_id,
        conversacion_id,
        telefono,
        tipo_mensaje,
        canal,
        contenido,
        fecha_envio,
        id_externo,
        status,
        creado_en
      )
      VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8,NOW())
      `,
      [
        empresaId,
        conversacionId,
        destinoNormalizado,
        'saliente',
        'whatsapp',
  `Plantilla: ${plantilla.nombre_interno}`,
        response.data?.messageId || null,
        'sent'
      ]
    );

    await pool.query(
      `
      UPDATE whatsapp.conversaciones
      SET
        ultimo_mensaje_en = GREATEST(ultimo_mensaje_en, NOW()),
        etapa_oportunidad = CASE
          WHEN etapa_oportunidad = 'nuevo' THEN 'contactado'
          ELSE etapa_oportunidad
        END
      WHERE id = $1
        AND empresa_id = $2
      `,
      [conversacionId, empresaId]
    );

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