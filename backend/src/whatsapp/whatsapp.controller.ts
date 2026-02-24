import { Request, Response } from "express";
import { normalizeWhatsappPayload } from "./whatsapp.mapper";
import { sendTextMessage } from "./whatsapp.service";
import pool from "../config/database";
import { normalizarTelefono } from "../utils/telefono";

export const whatsappWebhook = async (req: Request, res: Response) => {
  try {
    const normalized = normalizeWhatsappPayload(req.body);

    if (!normalized) {
      return res.status(200).json({ ignored: true });
    }
    console.log("Número recibido:", normalized.from);
    const telefono = normalizarTelefono(normalized.from);

    // 🔍 1️⃣ Buscar contacto por teléfono
    let contactoResult = await pool.query(
      `
      SELECT id
      FROM public.contactos
      WHERE empresa_id = $1
        AND telefono = $2
      LIMIT 1
      `,
      [1, telefono]
    );

    let contactoId;

    if (contactoResult.rows.length > 0) {
      contactoId = contactoResult.rows[0].id;
    } else {
      // 🆕 Crear contacto si no existe
      const newContacto = await pool.query(
        `
        INSERT INTO public.contactos
        (empresa_id, tipo_contacto, nombre, telefono, activo, bloqueado)
        VALUES ($1, 'Cliente', $2, $3, true, false)
        RETURNING id
        `,
        [1, telefono, telefono]
      );

      contactoId = newContacto.rows[0].id;
      console.log("🆕 Contacto creado:", contactoId);
    }

    // 🔍 2️⃣ Buscar conversación abierta para ese contacto
    let convResult = await pool.query(
      `
      SELECT id
      FROM whatsapp.whatsapp_conversaciones
      WHERE empresa_id = $1
        AND contacto_id = $2
        AND estado = 'abierta'
      ORDER BY creada_en DESC
      LIMIT 1
      `,
      [1, contactoId]
    );

    let conversacionId;

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
        [1, contactoId]
      );

      conversacionId = newConv.rows[0].id;
      console.log("🆕 Conversación creada:", conversacionId);
    }

    // 📨 3️⃣ Insertar mensaje
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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
      `,
      [
        1,
        conversacionId,
        telefono,
        'entrante',
        'whatsapp',
        normalized.text,
        normalized.timestamp,
        normalized.messageId,
        'received'
      ]
    );

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error("Error procesando webhook:", err);
    return res.status(200).json({ error: true });
  }
};