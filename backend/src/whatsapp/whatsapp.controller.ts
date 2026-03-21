import { Request, Response } from "express";
import { normalizeWhatsappPayload } from "./whatsapp.mapper";
import { sendTextMessage } from "./whatsapp.service";
import pool from "../config/database";
import { normalizarTelefono } from "../utils/telefono";
import { getEmpresaActivaId } from "../shared/context/empresa";




export const whatsappWebhook = async (req: Request, res: Response) => {

  const token = req.headers["x-webhook-token"];

  if (token !== process.env.WHATSAPP_WEBHOOK_TOKEN) {
    return res.status(200).json({ ignored: true });
  }

  const empresaId = getEmpresaActivaId();

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
      [empresaId, telefono]
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
        [empresaId, telefono, telefono]
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
      [empresaId, contactoId]
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
        [empresaId, contactoId]
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
        empresaId,
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

    await pool.query(
      `
      UPDATE whatsapp.whatsapp_conversaciones
      SET ultimo_mensaje_en = GREATEST(ultimo_mensaje_en, NOW())
      WHERE id = $1
      `,
      [conversacionId]
    );

    return res.status(200).json({ received: true });



  } catch (err) {
    console.error("Error procesando webhook:", err);
    return res.status(200).json({ error: true });
  }
};

export const enviarWhatsapp = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId ?? getEmpresaActivaId();
    const { telefono, mensaje } = req.body || {};

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    if (!telefono || !mensaje) {
      return res.status(400).json({ message: "telefono y mensaje son requeridos" });
    }

    await sendTextMessage(Number(empresaId), String(telefono), String(mensaje));

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Error al enviar mensaje de WhatsApp:", error);
    return res.status(500).json({ message: "No se pudo enviar el mensaje" });
  }
};

export const listarConversacionesWhatsapp = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId ?? getEmpresaActivaId();

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    const sinceRaw = req.query.since;
    const sinceDate = sinceRaw ? new Date(String(sinceRaw)) : null;
    const sinceFilter = sinceDate && !Number.isNaN(sinceDate.getTime());

    const params: any[] = [empresaId];
    if (sinceFilter) {
      params.push(sinceDate.toISOString());
    }

    const sinceWhere = sinceFilter ? " AND c.ultimo_mensaje_en > $2" : "";

    const result = await pool.query(
      `
      SELECT
        c.id,
        c.contacto_id AS "contactoId",
        COALESCE(ct.telefono, lm.telefono) AS telefono,
        COALESCE(ct.nombre, NULL) AS nombre,
        lm.contenido AS "ultimoMensaje",
        lm.fecha_envio AS "ultimoMensajeEn"
      FROM whatsapp.whatsapp_conversaciones c
      LEFT JOIN public.contactos ct ON ct.id = c.contacto_id
      LEFT JOIN LATERAL (
        SELECT m.telefono, m.contenido, m.fecha_envio
        FROM whatsapp.whatsapp_mensajes m
        WHERE m.conversacion_id = c.id
        ORDER BY m.fecha_envio DESC NULLS LAST, m.creado_en DESC NULLS LAST
        LIMIT 1
      ) lm ON TRUE
      WHERE c.empresa_id = $1
      ${sinceWhere}
      ORDER BY lm.fecha_envio DESC NULLS LAST, c.ultimo_mensaje_en DESC NULLS LAST, c.creada_en DESC
      `,
      params
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error listando conversaciones de WhatsApp:", error);
    return res.status(500).json({ message: "No se pudieron obtener las conversaciones" });
  }
};

export const obtenerConversacionWhatsapp = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId ?? getEmpresaActivaId();
    const conversacionId = req.params.id;

    const sinceRaw = req.query.since;
    const sinceDate = sinceRaw ? new Date(String(sinceRaw)) : null;
    const sinceFilter = sinceDate && !Number.isNaN(sinceDate.getTime());

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    if (!conversacionId) {
      return res.status(400).json({ message: "id de conversación requerido" });
    }

    // Verificar pertenencia de la conversación a la empresa
    const convCheck = await pool.query(
      `SELECT 1 FROM whatsapp.whatsapp_conversaciones WHERE id = $1 AND empresa_id = $2 LIMIT 1`,
      [conversacionId, empresaId]
    );

    if (convCheck.rows.length === 0) {
      return res.status(404).json({ message: "Conversación no encontrada" });
    }

    const params: any[] = [conversacionId, empresaId];
    if (sinceFilter) {
      params.push(sinceDate?.toISOString());
    }

    const sinceWhere = sinceFilter
      ? " AND (fecha_envio > $3 OR (fecha_envio IS NULL AND creado_en > $3))"
      : "";

    const messages = await pool.query(
      `
      SELECT
        id,
        telefono,
        tipo_mensaje,
        canal,
        contenido,
        fecha_envio,
        status,
        creado_en
      FROM whatsapp.whatsapp_mensajes
      WHERE conversacion_id = $1 AND empresa_id = $2
      ${sinceWhere}
      ORDER BY fecha_envio ASC NULLS LAST, creado_en ASC NULLS LAST
      `,
      params
    );

    return res.status(200).json(messages.rows);
  } catch (error) {
    console.error("Error obteniendo conversación de WhatsApp:", error);
    return res.status(500).json({ message: "No se pudieron obtener los mensajes" });
  }
};