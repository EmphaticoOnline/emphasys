import axios from "axios";
import qs from "qs";
import pool from "../config/database";

const GUPSHUP_API_URL = "https://api.gupshup.io/sm/api/v1/msg";
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
const GUPSHUP_PHONE_NUMBER = process.env.GUPSHUP_PHONE_NUMBER;

export const sendTextMessage = async (to: string, text: string) => {
  try {

    // 🔎 1️⃣ Buscar conversación abierta para ese número
    const convResult = await pool.query(
      `
      SELECT id
      FROM whatsapp.whatsapp_conversaciones
      WHERE empresa_id = $1
        AND estado = 'abierta'
        AND contacto_id IS NULL
      ORDER BY creada_en DESC
      LIMIT 1
      `,
      [1]
    );

    let conversacionId: number;

    if (convResult.rows.length > 0) {
      conversacionId = convResult.rows[0].id;
    } else {
      const newConv = await pool.query(
        `
        INSERT INTO whatsapp.whatsapp_conversaciones
        (empresa_id, estado, creada_en, ultimo_mensaje_en)
        VALUES ($1, 'abierta', NOW(), NOW())
        RETURNING id
        `,
        [1]
      );

      conversacionId = newConv.rows[0].id;
    }

    // 📤 2️⃣ Enviar mensaje a Gupshup
    const payload = qs.stringify({
      channel: "whatsapp",
      source: GUPSHUP_PHONE_NUMBER,
      destination: to,
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

    // 💾 3️⃣ Guardar mensaje saliente
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
      VALUES ($1,$2,$3,$4,$5,NOW(),$6,$7,NOW())
      `,
      [
        1,
        conversacionId,
        to,
        'saliente',
        'whatsapp',
        text,
        response.data?.messageId || null,
        'sent'
      ]
    );

    return response.data;

  } catch (error: any) {
    console.error("❌ Error enviando mensaje:", error.response?.data || error.message);
    throw error;
  }
};