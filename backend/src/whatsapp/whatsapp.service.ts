import axios from "axios";
import qs from "qs";
import pool from "../config/database";
import { normalizarTelefono } from "../utils/telefono";

const GUPSHUP_API_URL = "https://api.gupshup.io/sm/api/v1/msg";
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
const GUPSHUP_PHONE_NUMBER = process.env.GUPSHUP_PHONE_NUMBER;

export const sendTextMessage = async (empresaId: number, to: string, text: string) => {
  try {

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
      FROM whatsapp.whatsapp_conversaciones
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
        INSERT INTO whatsapp.whatsapp_conversaciones
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
      source: GUPSHUP_PHONE_NUMBER,
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
          apikey: GUPSHUP_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    console.log("📤 Mensaje enviado:", response.data);

    // 💾 4️⃣ Guardar mensaje saliente
    await pool.query(
      `
      INSERT INTO whatsapp.whatsapp_mensajes
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
        text,
        response.data?.messageId || null,
        'sent'
      ]
    );

    await pool.query(
      `
      UPDATE whatsapp.whatsapp_conversaciones
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