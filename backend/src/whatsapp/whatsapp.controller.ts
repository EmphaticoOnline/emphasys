import { Request, Response } from "express";
import { normalizeWhatsappPayload } from "./whatsapp.mapper";
import { sendDocumentMessage, sendImageMessage, sendTemplateMessage, sendTextMessage } from "./whatsapp.service";
import pool from "../config/database";
import { normalizarTelefono } from "../utils/telefono";
import { getEmpresaActivaId } from "../shared/context/empresa";
import { obtenerRolesDeUsuarioEnEmpresa, obtenerUsuarioPorId } from "../modules/auth/auth.service";
import {
  listarEtiquetasWhatsapp as listarEtiquetasWhatsappRepo,
  crearEtiquetaWhatsapp,
  actualizarEtiquetaWhatsapp,
  listarEtiquetasConversacion,
  asignarEtiquetaConversacion,
  quitarEtiquetaConversacion,
  obtenerEtiquetaWhatsapp,
} from "./whatsapp-tags.repository";

type EtapaOportunidad =
  | "nuevo"
  | "contactado"
  | "interesado"
  | "cotizado"
  | "negociacion"
  | "ganado"
  | "perdido";

type RuteoLeadsRow = {
  id: number;
  modo_asignacion: string;
  ultimo_vendedor_id: number | null;
  vendedor_fijo_id: number | null;
};

const ADMIN_ROLE_NAMES = new Set(["administrador", "admin"]);
const VENDEDOR_ROLE_NAMES = new Set(["vendedor", "ventas"]);

const normalizarRolNombre = (nombre?: string | null) => (nombre ?? "").trim().toLowerCase();

async function resolverVendedorRoundRobin(
  client: any,
  empresaId: number,
  ultimoVendedorId: number | null
): Promise<number | null> {
  console.log("[WhatsApp Ruteo] resolverVendedorRoundRobin: entrada", {
    empresaId,
    ultimoVendedorId,
  });
  const { rows } = await client.query(
    `SELECT id
       FROM public.contactos
      WHERE empresa_id = $1
        AND tipo_contacto = 'Vendedor'
        AND activo = true
      ORDER BY id ASC`,
    [empresaId]
  );

  console.log("[WhatsApp Ruteo] resolverVendedorRoundRobin: vendedores rows", {
    empresaId,
    rows,
  });

  const vendedores = rows as Array<{ id: number }>;
  const candidatoIds = vendedores.map((row) => row.id);
  console.log("[WhatsApp Ruteo] resolverVendedorRoundRobin: candidatos", {
    empresaId,
    candidatoIds,
  });

  if (!vendedores.length) {
    console.log("[WhatsApp Ruteo] resolverVendedorRoundRobin: sin vendedores", {
      empresaId,
      ultimoVendedorId,
    });
    return null;
  }

  if (!ultimoVendedorId) {
    console.log("[WhatsApp Ruteo] resolverVendedorRoundRobin: seleccionado", {
      empresaId,
      ultimoVendedorId,
      vendedorId: vendedores[0].id,
    });
    return vendedores[0].id;
  }

  const next = vendedores.find((row) => row.id > ultimoVendedorId);
  const seleccionado = next?.id ?? vendedores[0].id;
  console.log("[WhatsApp Ruteo] resolverVendedorRoundRobin: seleccionado", {
    empresaId,
    ultimoVendedorId,
    vendedorId: seleccionado ?? null,
  });
  return seleccionado;
}

async function asignarVendedorSiAplica(empresaId: number, contactoId: number): Promise<number | null> {
  const client = await pool.connect();

  try {
    console.log("[WhatsApp Ruteo] asignarVendedorSiAplica: entrada", {
      empresaId,
      contactoId,
    });
    await client.query("BEGIN");

    const contactoRes = await client.query<{ vendedor_id: number | null }>(
      `SELECT vendedor_id
         FROM public.contactos
        WHERE id = $1
          AND empresa_id = $2
        FOR UPDATE`,
      [contactoId, empresaId]
    );

    const vendedorActual = contactoRes.rows[0]?.vendedor_id ?? null;
    console.log("[WhatsApp Ruteo] asignarVendedorSiAplica: vendedor_actual", {
      empresaId,
      contactoId,
      vendedorActual,
    });
    if (vendedorActual) {
      await client.query("ROLLBACK");
      return vendedorActual;
    }

    const ruteoRes = await client.query<RuteoLeadsRow>(
      `SELECT id,
              modo_asignacion,
              ultimo_vendedor_id,
              vendedor_fijo_id
         FROM public.crm_ruteo_leads
        WHERE empresa_id = $1
          AND origen = $2
          AND activo = true
        LIMIT 1
        FOR UPDATE`,
      [empresaId, "whatsapp"]
    );

    const ruteo = ruteoRes.rows[0];
    console.log("[WhatsApp Ruteo] asignarVendedorSiAplica: ruteo", {
      empresaId,
      contactoId,
      ruteo,
    });
    if (!ruteo || ruteo.modo_asignacion !== "round_robin") {
      await client.query("ROLLBACK");
      return null;
    }

    console.log("[WhatsApp Ruteo] asignarVendedorSiAplica: ultimo_vendedor_id", {
      empresaId,
      contactoId,
      ultimoVendedorId: ruteo.ultimo_vendedor_id ?? null,
    });
    const vendedorId = await resolverVendedorRoundRobin(client, empresaId, ruteo.ultimo_vendedor_id ?? null);
    console.log("[WhatsApp Ruteo] asignarVendedorSiAplica: vendedor_seleccionado", {
      empresaId,
      contactoId,
      vendedorId: vendedorId ?? null,
    });
    if (!vendedorId) {
      await client.query("ROLLBACK");
      return null;
    }

    const updateContacto = await client.query(
      `UPDATE public.contactos
          SET vendedor_id = $1
        WHERE id = $2
          AND empresa_id = $3
          AND vendedor_id IS NULL`,
      [vendedorId, contactoId, empresaId]
    );
    console.log("[WhatsApp Ruteo] asignarVendedorSiAplica: update_contacto", {
      empresaId,
      contactoId,
      vendedorId,
      rowCount: updateContacto.rowCount ?? 0,
    });

    if ((updateContacto.rowCount ?? 0) > 0) {
      await client.query(
        `UPDATE public.crm_ruteo_leads
            SET ultimo_vendedor_id = $1,
                fecha_actualizacion = NOW()
          WHERE id = $2`,
        [vendedorId, ruteo.id]
      );
      console.log("[WhatsApp Ruteo] asignarVendedorSiAplica: ruteo_actualizado", {
        empresaId,
        contactoId,
        vendedorId,
        ruteoId: ruteo.id,
      });
    }

    await client.query("COMMIT");
    console.log("[WhatsApp Ruteo] asignarVendedorSiAplica: commit", {
      empresaId,
      contactoId,
      vendedorId,
    });
    return vendedorId;
  } catch (error) {
    await client.query("ROLLBACK");
    console.log("[WhatsApp Ruteo] asignarVendedorSiAplica: rollback", {
      empresaId,
      contactoId,
      error: (error as Error)?.message,
    });
    throw error;
  } finally {
    client.release();
  }
}

async function resolverContextoVisibilidad(empresaId: number, userId?: number, esSuperadmin?: boolean) {
  if (!userId) {
    return {
      esAdmin: Boolean(esSuperadmin),
      esVendedor: false,
      vendedorContactoId: null as number | null,
    };
  }

  const [usuario, roles] = await Promise.all([
    obtenerUsuarioPorId(userId),
    obtenerRolesDeUsuarioEnEmpresa(userId, empresaId),
  ]);

  const roleNames = roles.map((rol) => normalizarRolNombre(rol.nombre));
  const esAdminRole = roleNames.some((name) => ADMIN_ROLE_NAMES.has(name));
  const esVendedorRole = roleNames.some((name) => VENDEDOR_ROLE_NAMES.has(name));

  return {
    esAdmin: Boolean(esSuperadmin || esAdminRole),
    esVendedor: Boolean(esVendedorRole),
    vendedorContactoId: usuario?.vendedor_contacto_id ?? null,
  };
}

async function validarAccesoConversacion(
  empresaId: number,
  conversacionId: number,
  authUserId?: number,
  esSuperadmin?: boolean
) {
  const { esAdmin, esVendedor, vendedorContactoId } = await resolverContextoVisibilidad(
    empresaId,
    authUserId,
    esSuperadmin
  );

  if (!esAdmin && !vendedorContactoId) {
    return false;
  }

  const convParams: any[] = [conversacionId, empresaId];
  let convExtra = "";

  if (!esAdmin && (esVendedor || vendedorContactoId)) {
    convParams.push(vendedorContactoId);
    convExtra = ` AND ct.vendedor_id = $${convParams.length}`;
  }

  const convCheck = await pool.query(
    `SELECT 1
       FROM whatsapp.conversaciones c
       LEFT JOIN public.contactos ct ON ct.id = c.contacto_id
      WHERE c.id = $1
        AND c.empresa_id = $2
        ${convExtra}
      LIMIT 1`,
    convParams
  );

  return convCheck.rows.length > 0;
}




export const whatsappWebhook = async (req: Request, res: Response) => {
  console.log("WEBHOOK HIT", JSON.stringify(req.body, null, 2));
  console.log("[WhatsApp Webhook] RAW ENTRY", {
    headers: req.headers,
    body: req.body,
  });
  console.log("[WhatsApp Webhook] Incoming request", {
    method: req.method,
    path: req.path,
    headers: {
      "x-webhook-token": req.headers["x-webhook-token"],
      "user-agent": req.headers["user-agent"],
      "content-type": req.headers["content-type"],
    },
    body: req.body,
  });

  const token = req.headers["x-webhook-token"];

  if (token !== process.env.WHATSAPP_WEBHOOK_TOKEN) {
    console.log("[WhatsApp Webhook] Token inválido o ausente", { token });
    return res.status(200).json({ ignored: true });
  }

  const value = req.body?.entry?.[0]?.changes?.[0]?.value;
  if (!value?.messages && !value?.statuses) {
    return res.sendStatus(200);
  }
  const statuses = value?.statuses || [];
  if (Array.isArray(statuses) && statuses.length > 0) {
    const STATUS_ORDER: Record<string, number> = {
      sending: 0,
      enqueued: 1,
      sent: 2,
      delivered: 3,
      read: 4,
      failed: 5,
    };
    const VALID_STATUS = ["sent", "delivered", "read", "failed"];

    for (const statusObj of statuses) {
      const estado = statusObj?.status;
      const externalId = statusObj?.gs_id;

      if (!estado || !externalId) {
        continue;
      }

      if (!VALID_STATUS.includes(estado)) {
        console.log("[WhatsApp Webhook] Status ignorado (no válido)", estado);
        continue;
      }

      if (!(estado in STATUS_ORDER)) {
        console.log("[WhatsApp Webhook] Estado ignorado", { estado, externalId });
        continue;
      }

      console.log("STATUS UPDATE:", estado, externalId);

      try {
        const currentResult = await pool.query<{ status: string | null }>(
          `
          SELECT status
          FROM whatsapp.mensajes
          WHERE id_externo = $1
          `,
          [externalId]
        );

        const currentStatus = currentResult.rows[0]?.status ?? null;
        const currentOrder = currentStatus && currentStatus in STATUS_ORDER
          ? STATUS_ORDER[currentStatus]
          : -1;
        const nextOrder = STATUS_ORDER[estado];

        if (nextOrder <= currentOrder) {
          console.log("[WhatsApp Webhook] Status ignorado (no avanza)", {
            externalId,
            estado,
            currentStatus,
          });
          continue;
        }

        const updateResult = await pool.query(
          `
          UPDATE whatsapp.mensajes
          SET status = $1
          WHERE id_externo = $2
          `,
          [estado, externalId]
        );

        console.log("[WhatsApp Webhook] Status actualizado", {
          externalId,
          status: estado,
          rowCount: updateResult.rowCount ?? 0,
        });
      } catch (error) {
        console.error("[WhatsApp Webhook] Error actualizando status", {
          externalId,
          status: estado,
          message: (error as Error)?.message,
        });
      }
    }

    return res.status(200).json({ received: true });
  }

  const displayPhoneNumber = req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.display_phone_number as
    | string
    | undefined;
  if (!displayPhoneNumber) {
    console.log("[WhatsApp Webhook] display_phone_number no encontrado", { body: req.body });
    return res.status(400).json({ message: "Empresa no encontrada para este número" });
  }

  console.log("[WhatsApp Webhook] Resolviendo empresa", { displayPhoneNumber });

  const empresaResult = await pool.query<{ empresa_id: number }>(
    `
    SELECT empresa_id
    FROM whatsapp.config
    WHERE phone_number = $1
      AND activo = true
    LIMIT 1
    `,
    [displayPhoneNumber]
  );

  const empresaId = empresaResult.rows[0]?.empresa_id;
  if (!empresaId) {
    console.log("[WhatsApp Webhook] Empresa no encontrada", { displayPhoneNumber });
    return res.status(400).json({ message: "Empresa no encontrada para este número" });
  }

  console.log("[WhatsApp Webhook] Empresa resuelta", { empresaId });

  try {
    const normalized = normalizeWhatsappPayload(req.body);

    if (!normalized) {
      console.log("[WhatsApp Webhook] Payload ignorado tras normalizar", { body: req.body });
      return res.status(200).json({ ignored: true });
    }
    console.log("[WhatsApp Webhook] Payload normalizado", normalized);
    console.log("[WhatsApp Webhook] Número recibido", { from: normalized.from });
    const telefono = normalizarTelefono(normalized.from);
    console.log("[WhatsApp Webhook] Teléfono normalizado", { telefono });

    // 🔍 1️⃣ Buscar contacto por teléfono
    console.log("[WhatsApp Webhook] Buscando contacto", { empresaId, telefono });
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
      console.log("[WhatsApp Webhook] Contacto encontrado", { contactoId });
    } else {
      // 🆕 Crear contacto si no existe
      console.log("[WhatsApp Webhook] Contacto no encontrado, creando", { empresaId, telefono });
      const newContacto = await pool.query(
        `
        INSERT INTO public.contactos
  (empresa_id, tipo_contacto, nombre, telefono, activo, bloqueado)
  VALUES ($1, 'Lead', $2, $3, true, false)
        RETURNING id
        `,
        [empresaId, telefono, telefono]
      );

      contactoId = newContacto.rows[0].id;
      console.log("[WhatsApp Webhook] Contacto creado", { contactoId });
    }

    try {
      console.log("[WhatsApp Webhook] Asignando vendedor", { empresaId, contactoId });
      await asignarVendedorSiAplica(empresaId, contactoId);
    } catch (error) {
      console.error("[WhatsApp Webhook] Error asignando vendedor", {
        message: (error as Error)?.message,
        stack: (error as Error)?.stack,
      });
    }

    // 🔍 2️⃣ Buscar conversación abierta para ese contacto
    console.log("[WhatsApp Webhook] Buscando conversación", { empresaId, contactoId });
    let convResult = await pool.query(
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

    let conversacionId;

    if (convResult.rows.length > 0) {
      conversacionId = convResult.rows[0].id;
      console.log("[WhatsApp Webhook] Conversación encontrada", { conversacionId });
    } else {
      console.log("[WhatsApp Webhook] Conversación no encontrada, creando", { empresaId, contactoId });
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
      console.log("[WhatsApp Webhook] Conversación creada", { conversacionId });
    }

    // 📨 3️⃣ Insertar mensaje
    console.log("[WhatsApp Webhook] Insertando mensaje", {
      empresaId,
      conversacionId,
      telefono,
      messageId: normalized.messageId,
    });
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
    console.log("[WhatsApp Webhook] Mensaje insertado", { conversacionId });

    console.log("[WhatsApp Webhook] Actualizando conversación", { conversacionId });
    await pool.query(
      `
      UPDATE whatsapp.conversaciones
      SET ultimo_mensaje_en = GREATEST(ultimo_mensaje_en, NOW())
      WHERE id = $1
      `,
      [conversacionId]
    );
    console.log("[WhatsApp Webhook] Conversación actualizada", { conversacionId });

    return res.status(200).json({ received: true });



  } catch (err) {
    console.error("[WhatsApp Webhook] Error procesando webhook", {
      message: (err as Error)?.message,
      stack: (err as Error)?.stack,
      body: req.body,
    });
    return res.status(200).json({ error: true });
  }
};

export const enviarWhatsapp = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId ?? getEmpresaActivaId();
  const { telefono, mensaje, tipo, media_url } = req.body || {};

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    if (!telefono) {
      return res.status(400).json({ message: "telefono es requerido" });
    }

    const tipoMensaje = String(tipo || "text").toLowerCase();

    if (tipoMensaje === "text") {
      if (!mensaje) {
        return res.status(400).json({ message: "mensaje es requerido" });
      }

      const respuesta = await sendTextMessage(Number(empresaId), String(telefono), String(mensaje));
      return res.status(200).json(respuesta);
    }

    if (tipoMensaje === "image") {
      if (!media_url) {
        return res.status(400).json({ message: "media_url es requerido" });
      }

      const respuesta = await sendImageMessage(
        Number(empresaId),
        String(telefono),
        String(media_url),
        mensaje ? String(mensaje) : null
      );
      return res.status(200).json(respuesta);
    }

    if (tipoMensaje === "document") {
      if (!media_url) {
        return res.status(400).json({ message: "media_url es requerido" });
      }

      const respuesta = await sendDocumentMessage(
        Number(empresaId),
        String(telefono),
        String(media_url),
        mensaje ? String(mensaje) : null
      );
      return res.status(200).json(respuesta);
    }

    return res.status(400).json({ message: "tipo de mensaje no soportado" });
  } catch (error) {
    console.error("Error al enviar mensaje de WhatsApp:", error);
    return res.status(500).json({ message: "No se pudo enviar el mensaje" });
  }
};

export const listarConversacionesWhatsapp = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId ?? getEmpresaActivaId();
    const authUserId = req.auth?.userId;

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    const sinceRaw = req.query.since;
    const sinceDate = sinceRaw ? new Date(String(sinceRaw)) : null;
    const sinceFilter = sinceDate && !Number.isNaN(sinceDate.getTime());

    const { esAdmin, esVendedor, vendedorContactoId } = await resolverContextoVisibilidad(
      empresaId,
      authUserId,
      req.auth?.esSuperadmin
    );

    const vendedorParamRaw = (req.query.vendedor_id ?? req.query.vendedorId) as string | string[] | undefined;
    const vendedorParam = Array.isArray(vendedorParamRaw) ? vendedorParamRaw[0] : vendedorParamRaw;
    const vendedorFilter = vendedorParam ? Number(vendedorParam) : null;

    if (!esAdmin && !vendedorContactoId) {
      return res.status(200).json([]);
    }

    const params: any[] = [empresaId];
    const filters: string[] = ["c.empresa_id = $1"];

    if (sinceFilter) {
      params.push(sinceDate.toISOString());
      filters.push(`c.ultimo_mensaje_en > $${params.length}`);
    }

    if (esAdmin && Number.isFinite(vendedorFilter)) {
      params.push(vendedorFilter);
      filters.push(`ct.vendedor_id = $${params.length}`);
    } else if (!esAdmin && (esVendedor || vendedorContactoId)) {
      params.push(vendedorContactoId);
      filters.push(`ct.vendedor_id = $${params.length}`);
    }

    const result = await pool.query(
      `
      SELECT
        c.id,
        c.contacto_id AS "contactoId",
        COALESCE(ct.telefono, lm.telefono) AS telefono,
        COALESCE(ct.nombre, NULL) AS nombre,
        ct.vendedor_id AS "vendedor_id",
        c.etapa_oportunidad,
        lm.contenido AS "ultimoMensaje",
        lm.fecha_envio AS "ultimoMensajeEn"
      FROM whatsapp.conversaciones c
      LEFT JOIN public.contactos ct ON ct.id = c.contacto_id
      LEFT JOIN LATERAL (
        SELECT m.telefono, m.contenido, m.fecha_envio
        FROM whatsapp.mensajes m
        WHERE m.conversacion_id = c.id
        ORDER BY m.fecha_envio DESC NULLS LAST, m.creado_en DESC NULLS LAST
        LIMIT 1
      ) lm ON TRUE
      WHERE ${filters.join(" AND ")}
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
    const authUserId = req.auth?.userId;

    const sinceRaw = req.query.since;
    const sinceDate = sinceRaw ? new Date(String(sinceRaw)) : null;
    const sinceFilter = sinceDate && !Number.isNaN(sinceDate.getTime());

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    if (!conversacionId) {
      return res.status(400).json({ message: "id de conversación requerido" });
    }

    const { esAdmin, esVendedor, vendedorContactoId } = await resolverContextoVisibilidad(
      empresaId,
      authUserId,
      req.auth?.esSuperadmin
    );

    if (!esAdmin && !vendedorContactoId) {
      return res.status(404).json({ message: "Conversación no encontrada" });
    }

    const convParams: any[] = [conversacionId, empresaId];
    let convExtra = "";

    if (!esAdmin && (esVendedor || vendedorContactoId)) {
      convParams.push(vendedorContactoId);
      convExtra = ` AND ct.vendedor_id = $${convParams.length}`;
    }

    // Verificar pertenencia de la conversación a la empresa
    const convCheck = await pool.query(
      `SELECT 1
         FROM whatsapp.conversaciones c
         LEFT JOIN public.contactos ct ON ct.id = c.contacto_id
        WHERE c.id = $1
          AND c.empresa_id = $2
          ${convExtra}
        LIMIT 1`,
      convParams
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
        tipo_contenido,
        media_url,
        caption,
        contenido,
        fecha_envio,
        status,
        creado_en
      FROM whatsapp.mensajes
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

export const actualizarEtapaConversacion = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId ?? getEmpresaActivaId();
    const conversacionId = req.params.id;
    const { etapa_oportunidad } = req.body as { etapa_oportunidad?: EtapaOportunidad };
    const authUserId = req.auth?.userId;

    console.log("[PATCH /whatsapp/conversaciones/:id/etapa] payload", {
      conversacionId,
      etapa_oportunidad,
      empresaId,
    });

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    if (!conversacionId) {
      return res.status(400).json({ message: "id de conversación requerido" });
    }

    const etapasValidas: EtapaOportunidad[] = [
      "nuevo",
      "contactado",
      "interesado",
      "cotizado",
      "negociacion",
      "ganado",
      "perdido",
    ];

    if (!etapa_oportunidad || !etapasValidas.includes(etapa_oportunidad)) {
      return res.status(400).json({ message: "etapa_oportunidad inválida" });
    }

    // Verificar pertenencia
    const { esAdmin, esVendedor, vendedorContactoId } = await resolverContextoVisibilidad(
      empresaId,
      authUserId,
      req.auth?.esSuperadmin
    );

    if (!esAdmin && !vendedorContactoId) {
      return res.status(404).json({ message: "Conversación no encontrada" });
    }

    const convParams: any[] = [conversacionId, empresaId];
    let convExtra = "";

    if (!esAdmin && (esVendedor || vendedorContactoId)) {
      convParams.push(vendedorContactoId);
      convExtra = ` AND ct.vendedor_id = $${convParams.length}`;
    }

    const convCheck = await pool.query(
      `SELECT 1
         FROM whatsapp.conversaciones c
         LEFT JOIN public.contactos ct ON ct.id = c.contacto_id
        WHERE c.id = $1
          AND c.empresa_id = $2
          ${convExtra}
        LIMIT 1`,
      convParams
    );

    console.log("[PATCH /whatsapp/conversaciones/:id/etapa] convCheck rowCount", convCheck.rowCount);

    if (convCheck.rows.length === 0) {
      return res.status(404).json({ message: "Conversación no encontrada" });
    }

    const updateResult = await pool.query(
      `
      UPDATE whatsapp.conversaciones
      SET etapa_oportunidad = $1
      WHERE id = $2 AND empresa_id = $3
      RETURNING id, contacto_id AS "contactoId", estado, etapa_oportunidad, ultimo_mensaje_en, creada_en
      `,
      [etapa_oportunidad, conversacionId, empresaId]
    );

    console.log("[PATCH /whatsapp/conversaciones/:id/etapa] update rowCount", updateResult.rowCount);

    if (updateResult.rowCount === 0) {
      console.warn("[PATCH /whatsapp/conversaciones/:id/etapa] no rows updated", {
        conversacionId,
        empresaId,
      });
      return res.status(404).json({ message: "Conversación no encontrada o sin permiso" });
    }

    return res.status(200).json(updateResult.rows[0]);
  } catch (error) {
    console.error("Error actualizando etapa de conversación:", error);
    return res.status(500).json({ message: "No se pudo actualizar la etapa" });
  }
};

export const listarEtiquetasWhatsapp = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId ?? getEmpresaActivaId();

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    const etiquetas = await listarEtiquetasWhatsappRepo(empresaId);
    return res.status(200).json(etiquetas);
  } catch (error) {
    console.error("Error listando etiquetas de WhatsApp:", error);
    return res.status(500).json({ message: "No se pudieron obtener las etiquetas" });
  }
};

export const crearEtiquetaWhatsappController = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId ?? getEmpresaActivaId();
    const { nombre, color } = req.body || {};

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    if (!nombre || !color) {
      return res.status(400).json({ message: "nombre y color son requeridos" });
    }

    const etiqueta = await crearEtiquetaWhatsapp(empresaId, { nombre, color });
    return res.status(201).json(etiqueta);
  } catch (error: any) {
    if (error?.code === "23505") {
      return res.status(409).json({ message: "La etiqueta ya existe" });
    }
    console.error("Error creando etiqueta de WhatsApp:", error);
    return res.status(500).json({ message: "No se pudo crear la etiqueta" });
  }
};

export const actualizarEtiquetaWhatsappController = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId ?? getEmpresaActivaId();
    const etiquetaId = Number(req.params.id);
    const { nombre, color, activo } = req.body || {};

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    if (!Number.isFinite(etiquetaId)) {
      return res.status(400).json({ message: "id de etiqueta inválido" });
    }

    if (nombre == null && color == null && activo == null) {
      return res.status(400).json({ message: "Debe enviar al menos un campo para actualizar" });
    }

    const etiqueta = await actualizarEtiquetaWhatsapp(empresaId, etiquetaId, { nombre, color, activo });

    if (!etiqueta) {
      return res.status(404).json({ message: "Etiqueta no encontrada" });
    }

    return res.status(200).json(etiqueta);
  } catch (error: any) {
    if (error?.code === "23505") {
      return res.status(409).json({ message: "La etiqueta ya existe" });
    }
    console.error("Error actualizando etiqueta de WhatsApp:", error);
    return res.status(500).json({ message: "No se pudo actualizar la etiqueta" });
  }
};

export const listarEtiquetasConversacionWhatsapp = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId ?? getEmpresaActivaId();
    const conversacionId = Number(req.params.id);

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    if (!Number.isFinite(conversacionId)) {
      return res.status(400).json({ message: "id de conversación inválido" });
    }

    const acceso = await validarAccesoConversacion(
      empresaId,
      conversacionId,
      req.auth?.userId,
      req.auth?.esSuperadmin
    );

    if (!acceso) {
      return res.status(404).json({ message: "Conversación no encontrada" });
    }

    const etiquetas = await listarEtiquetasConversacion(empresaId, conversacionId);
    return res.status(200).json(etiquetas);
  } catch (error) {
    console.error("Error listando etiquetas de conversación:", error);
    return res.status(500).json({ message: "No se pudieron obtener las etiquetas" });
  }
};

export const agregarEtiquetaConversacionWhatsapp = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId ?? getEmpresaActivaId();
    const conversacionId = Number(req.params.id);
    const { etiqueta_id } = req.body || {};
    const etiquetaId = Number(etiqueta_id);

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    if (!Number.isFinite(conversacionId)) {
      return res.status(400).json({ message: "id de conversación inválido" });
    }

    if (!Number.isFinite(etiquetaId)) {
      return res.status(400).json({ message: "etiqueta_id inválido" });
    }

    const acceso = await validarAccesoConversacion(
      empresaId,
      conversacionId,
      req.auth?.userId,
      req.auth?.esSuperadmin
    );

    if (!acceso) {
      return res.status(404).json({ message: "Conversación no encontrada" });
    }

    const etiqueta = await obtenerEtiquetaWhatsapp(empresaId, etiquetaId);
    if (!etiqueta) {
      return res.status(404).json({ message: "Etiqueta no encontrada" });
    }

    const asignacion = await asignarEtiquetaConversacion(empresaId, conversacionId, etiquetaId);
    return res.status(200).json({ assigned: Boolean(asignacion) });
  } catch (error) {
    console.error("Error agregando etiqueta a conversación:", error);
    return res.status(500).json({ message: "No se pudo agregar la etiqueta" });
  }
};

export const quitarEtiquetaConversacionWhatsapp = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId ?? getEmpresaActivaId();
    const conversacionId = Number(req.params.id);
    const etiquetaId = Number(req.params.etiquetaId);

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    if (!Number.isFinite(conversacionId)) {
      return res.status(400).json({ message: "id de conversación inválido" });
    }

    if (!Number.isFinite(etiquetaId)) {
      return res.status(400).json({ message: "id de etiqueta inválido" });
    }

    const acceso = await validarAccesoConversacion(
      empresaId,
      conversacionId,
      req.auth?.userId,
      req.auth?.esSuperadmin
    );

    if (!acceso) {
      return res.status(404).json({ message: "Conversación no encontrada" });
    }

    const quitada = await quitarEtiquetaConversacion(empresaId, conversacionId, etiquetaId);

    if (!quitada) {
      return res.status(404).json({ message: "Etiqueta no asignada" });
    }

    return res.status(200).json({ removed: true });
  } catch (error) {
    console.error("Error quitando etiqueta de conversación:", error);
    return res.status(500).json({ message: "No se pudo quitar la etiqueta" });
  }
};

export const enviarWhatsappPlantilla = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId ?? getEmpresaActivaId();
    const { telefono, tipo } = req.body || {};

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    if (!telefono) {
      return res.status(400).json({ message: "telefono es requerido" });
    }

    const tipoPlantilla = String(tipo || "reactivacion");
    const respuesta = await sendTemplateMessage(Number(empresaId), String(telefono), tipoPlantilla);

    if (respuesta?.error) {
      return res.status(409).json({ message: respuesta.message || "No hay plantilla disponible" });
    }

    return res.status(200).json(respuesta);
  } catch (error) {
    console.error("Error al enviar plantilla de WhatsApp:", error);
    return res.status(500).json({ message: "No se pudo enviar la plantilla" });
  }
};