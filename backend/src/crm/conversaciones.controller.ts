import { Request, Response } from "express";
import { normalizeWhatsappPayload } from "../whatsapp/whatsapp.mapper";
import {
  MAX_REENVIO_DESTINATARIOS,
  REENVIO_CONCURRENCY,
  sendAudioMessage,
  sendDocumentMessage,
  sendImageMessage,
  sendTemplateMessage,
  sendTemplateMensajeDirecta,
  sendTextMessage,
  verifyMediaUrlReachable,
  WhatsappWindowExpiredError,
} from "../whatsapp/whatsapp.service";
import {
  buildWhatsappErrorInfo,
  classifyWhatsappError,
  logWhatsappFailureTechnical,
  WhatsappErrorInfo,
} from "../whatsapp/whatsapp-error";
import pool from "../config/database";
import { normalizarTelefono } from "../utils/telefono";
import { getEmpresaActivaId } from "../shared/context/empresa";
import {
  DEFAULT_WHATSAPP_TEMPLATE_ACTION,
  resolverTipoPlantillaWhatsapp,
} from "../whatsapp/whatsapp-template-type.service";
import { obtenerPlantillaWhatsappPorId } from "../whatsapp/whatsapp-plantillas.service";
import { resolverContextoScopeComercial } from "../modules/auth/scope-comercial";
import {
  listarEtiquetasWhatsapp as listarEtiquetasWhatsappRepo,
  crearEtiquetaWhatsapp,
  actualizarEtiquetaWhatsapp,
  eliminarEtiquetaWhatsapp,
  listarEtiquetasConversacion,
  asignarEtiquetaConversacion,
  quitarEtiquetaConversacion,
  obtenerEtiquetaWhatsapp,
} from "../whatsapp/whatsapp-tags.repository";
import {
  actualizarConversacionEntranteWhatsapp,
  actualizarMediaUrlMensajeEntrante,
  finalizarConversacion,
  getReglasSeguimiento,
  getOrCreateConversacionWhatsapp,
  getOrCreateWhatsappContacto,
  MOTIVOS_FINALIZACION,
  MotivoFinalizacion,
  obtenerConversacionesDestinoValidas,
  obtenerMensajeParaReenvio,
  reabrirConversacion,
  registrarMensajeEntranteWhatsapp,
  type MensajeSalienteMetadata,
} from "./conversaciones.service";
import { descargarYPersistirAdjuntoEntrante, redactUrlForLog } from "../whatsapp/whatsapp-media-download.service";

type EtapaOportunidad =
  | "nuevo"
  | "contactado"
  | "interesado"
  | "cotizado"
  | "negociacion"
  | "convertida"
  | "perdida";

const normalizarEtapaOportunidad = (valor: unknown): EtapaOportunidad | null => {
  const etapa = String(valor ?? '').trim().toLowerCase();

  switch (etapa) {
    case 'nuevo':
    case 'contactado':
    case 'interesado':
    case 'cotizado':
    case 'negociacion':
      return etapa;
    case 'convertida':
    case 'ganado':
    case 'ganada':
      return 'convertida';
    case 'perdida':
    case 'perdido':
      return 'perdida';
    default:
      return null;
  }
};

type RuteoLeadsRow = {
  id: number;
  modo_asignacion: string;
  ultimo_vendedor_id: number | null;
  vendedor_fijo_id: number | null;
};

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

async function validarAccesoConversacion(
  empresaId: number,
  conversacionId: number,
  authUserId?: number,
  esSuperadmin?: boolean
) {
  const { esAdmin, esVendedor, vendedorContactoId } = await resolverContextoScopeComercial(
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
      FROM crm.conversaciones c
       LEFT JOIN public.contactos ct ON ct.id = c.contacto_id
      WHERE c.id = $1
        AND c.empresa_id = $2
        ${convExtra}
      LIMIT 1`,
    convParams
  );

  return convCheck.rows.length > 0;
}

// Orquesta la descarga+persistencia local de un adjunto entrante (best-effort,
// ver whatsapp-media-download.service.ts) y, solo si tiene éxito, actualiza
// crm.mensajes.media_url a la copia local. Nunca lanza: cualquier fallo (tipo
// no soportado, timeout, red, tamaño excedido, etc.) se registra en log y se
// descarta en silencio, dejando la URL original de Gupshup intacta en la fila
// ya insertada. Se invoca sin `await` desde whatsappWebhook.
async function persistirAdjuntoEntranteEnSegundoPlano(params: {
  empresaId: number;
  mensajeId: number;
  mediaUrlOriginal: string;
  mimeTypeHint: string | null;
}): Promise<void> {
  try {
    const resultado = await descargarYPersistirAdjuntoEntrante({
      empresaId: params.empresaId,
      mediaUrl: params.mediaUrlOriginal,
      mimeTypeHint: params.mimeTypeHint,
    });

    if (!resultado.ok) {
      console.warn("[WhatsApp Webhook][Media] No se persistió copia local del adjunto entrante", {
        empresaId: params.empresaId,
        mensajeId: params.mensajeId,
        mediaUrl: redactUrlForLog(params.mediaUrlOriginal),
        motivo: resultado.motivo,
      });
      return;
    }

    const actualizado = await actualizarMediaUrlMensajeEntrante(
      params.empresaId,
      params.mensajeId,
      params.mediaUrlOriginal,
      resultado.url
    );

    console.log("[WhatsApp Webhook][Media] Copia local de adjunto entrante persistida", {
      empresaId: params.empresaId,
      mensajeId: params.mensajeId,
      actualizado,
      urlLocal: resultado.url,
    });
  } catch (error) {
    console.error("[WhatsApp Webhook][Media] Error persistiendo adjunto entrante en segundo plano", {
      empresaId: params.empresaId,
      mensajeId: params.mensajeId,
      mediaUrl: redactUrlForLog(params.mediaUrlOriginal),
      error: (error as Error)?.message,
    });
  }
}

export const whatsappWebhook = async (req: Request, res: Response) => {
  const value = req.body?.entry?.[0]?.changes?.[0]?.value;
  const messages = Array.isArray(value?.messages) ? value.messages : [];
  const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
  const extractedIds = {
    gs_ids: statuses.map((item: any) => item?.gs_id).filter(Boolean),
    message_ids: messages.map((item: any) => item?.id).filter(Boolean),
    statuses_ids: statuses.map((item: any) => item?.id).filter(Boolean),
    external_ids: statuses.map((item: any) => item?.externalId ?? item?.external_id).filter(Boolean),
  };
  const extractedStatuses = statuses.map((item: any) => ({
    status: item?.status ?? null,
    gs_id: item?.gs_id ?? null,
    id: item?.id ?? null,
    externalId: item?.externalId ?? item?.external_id ?? null,
    errors: item?.errors ?? item?.error_data ?? item?.error ?? null,
  }));

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
      "x-forwarded-for": req.headers["x-forwarded-for"],
      host: req.headers["host"],
    },
    body: req.body,
  });
  console.info('[WhatsApp Webhook] Callback summary', {
    method: req.method,
    path: req.path,
    headers: {
      'x-webhook-token': req.headers['x-webhook-token'],
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
      host: req.headers['host'],
    },
    ids: extractedIds,
    statuses: extractedStatuses,
    body: req.body,
  });

  const token = req.headers["x-webhook-token"];

  if (token !== process.env.WHATSAPP_WEBHOOK_TOKEN) {
    console.log("[WhatsApp Webhook] Token inválido o ausente", { token });
    return res.status(200).json({ ignored: true });
  }

  if (!value?.messages && !value?.statuses) {
    return res.sendStatus(200);
  }
  if (Array.isArray(statuses) && statuses.length > 0) {
    console.info('[WhatsApp Webhook][STATUS PAYLOAD]', {
      value,
      statuses,
      body: req.body,
    });
  }
  const targetMessageIds = new Set([
    'db1fbc39-1342-48f5-9e1b-23b6dbbb89d3',
    '40614c4b-b30a-4760-b38a-0075194fb89a',
    '61d3efa5-d9b0-4bd7-8adc-0b8b8bf2c730',
  ]);
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
      console.info('[WhatsApp Webhook][STATUS ITEM]', {
        estado,
        externalId,
        statusObj,
      });
      const isTargetMessage = Boolean(externalId && targetMessageIds.has(String(externalId)));

      if (isTargetMessage) {
        console.info('[WhatsApp Webhook][TARGET STATUS]', {
          externalId,
          estado,
          statusObj,
          value,
          body: req.body,
        });
      }

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
          FROM crm.mensajes
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
          UPDATE crm.mensajes
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

        if (isTargetMessage) {
          console.info('[WhatsApp Webhook][TARGET UPDATED]', {
            externalId,
            estado,
            currentStatus,
            nextOrder,
            currentOrder,
            rowCount: updateResult.rowCount ?? 0,
          });
        }
      } catch (error) {
        console.error("[WhatsApp Webhook] Error actualizando status", {
          externalId,
          status: estado,
          message: (error as Error)?.message,
        });

        if (isTargetMessage) {
          console.error('[WhatsApp Webhook][TARGET ERROR]', {
            externalId,
            estado,
            message: (error as Error)?.message,
            stack: (error as Error)?.stack,
            body: req.body,
            value,
            statusObj,
          });
        }
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

    console.log("[WhatsApp Webhook] Buscando contacto", { empresaId, telefono });
    const contactoId = await getOrCreateWhatsappContacto(empresaId, telefono);
    console.log("[WhatsApp Webhook] Contacto resuelto", { contactoId });

    try {
      console.log("[WhatsApp Webhook] Asignando vendedor", { empresaId, contactoId });
      await asignarVendedorSiAplica(empresaId, contactoId);
    } catch (error) {
      console.error("[WhatsApp Webhook] Error asignando vendedor", {
        message: (error as Error)?.message,
        stack: (error as Error)?.stack,
      });
    }

    console.log("[WhatsApp Webhook] Buscando conversación", { empresaId, contactoId });
    const conversacionId = await getOrCreateConversacionWhatsapp(empresaId, contactoId);
    console.log("[WhatsApp Webhook] Conversación resuelta", { conversacionId });

    console.log("[WhatsApp Webhook] Insertando mensaje", {
      empresaId,
      conversacionId,
      telefono,
      messageId: normalized.messageId,
      tipoContenido: normalized.tipoContenido,
      tieneMediaUrl: Boolean(normalized.mediaUrl),
    });
    const mensajeInsertadoId = await registrarMensajeEntranteWhatsapp(
      empresaId,
      conversacionId,
      telefono,
      normalized.text,
      normalized.timestamp,
      normalized.messageId,
      {
        tipoContenido: normalized.tipoContenido,
        mediaUrl: normalized.mediaUrl,
        caption: normalized.caption,
        mimeType: normalized.mimeType,
      }
    );

    if (mensajeInsertadoId === null) {
      // Webhook duplicado (mismo empresa_id + id_externo ya procesado, ver
      // ux_mensaje_externo y el ON CONFLICT DO NOTHING en
      // registrarMensajeEntranteWhatsapp): no es un error, es exactamente el
      // reintento que Gupshup hace cuando no recibe una respuesta 2xx a
      // tiempo. Se trata como ya procesado: no se descarga el adjunto de
      // nuevo, no se reactiva la conversación de nuevo, y se responde 200
      // igual que un mensaje nuevo, para que el proveedor deje de reintentar.
      console.info("[WhatsApp Webhook] Webhook duplicado ignorado (id_externo ya procesado)", {
        empresaId,
        conversacionId,
        messageId: normalized.messageId,
      });
      return res.status(200).json({ received: true, duplicate: true });
    }

    console.log("[WhatsApp Webhook] Mensaje insertado", { conversacionId, mensajeInsertadoId });

    // Persistencia local del adjunto: deliberadamente NO se espera (no hay
    // `await`) para que nunca retrase ni arriesgue la respuesta al webhook.
    // Corre en segundo plano después de que el mensaje ya quedó registrado
    // con la URL original de Gupshup; si la descarga tiene éxito, actualiza
    // media_url a la copia local. El .catch() es una red de seguridad
    // adicional: persistirAdjuntoEntranteEnSegundoPlano ya nunca debería
    // rechazar la promesa, pero un unhandled rejection aquí tumbaría el
    // proceso completo en Node moderno, así que se cubre igual.
    if (normalized.tipoContenido !== "text" && normalized.mediaUrl) {
      void persistirAdjuntoEntranteEnSegundoPlano({
        empresaId,
        mensajeId: mensajeInsertadoId,
        mediaUrlOriginal: normalized.mediaUrl,
        mimeTypeHint: normalized.mimeType,
      }).catch((error) => {
        console.error("[WhatsApp Webhook] Fallo inesperado en persistencia de adjunto en segundo plano", {
          empresaId,
          mensajeInsertadoId,
          error: (error as Error)?.message,
        });
      });
    }

    console.log("[WhatsApp Webhook] Actualizando conversación", { conversacionId });
    await actualizarConversacionEntranteWhatsapp(conversacionId);
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

// Escapa los comodines de LIKE/ILIKE ('%', '_') y el propio carácter de
// escape ('\') para que el texto que escribe el usuario se trate siempre
// como literal dentro del patrón `%...%`, nunca como wildcard.
function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function responderErrorWhatsapp(res: Response, info: WhatsappErrorInfo) {
  return res.status(info.httpStatus).json({
    success: false,
    codigo: info.codigo,
    mensaje_usuario: info.mensajeUsuario,
    accion_sugerida: info.accionSugerida,
    detalle_tecnico: info.detalleTecnico,
    recuperable: info.recuperable,
    // `message` se conserva por compatibilidad con clientes que ya leen
    // este campo (ej. services/apiFetch.ts y los diálogos que lo usan).
    message: info.mensajeUsuario,
  });
}

export const enviarWhatsapp = async (req: Request, res: Response) => {
  const empresaId = req.context?.empresaId ?? getEmpresaActivaId();
  const { telefono, mensaje, tipo, media_url, mensaje_respuesta_id } = req.body || {};
  const tipoMensaje = String(tipo || "text").toLowerCase();
  const usuarioId = req.auth?.userId ?? null;

  try {
    console.log("[WhatsApp Enviar] Solicitud recibida", {
      empresaId,
      telefono,
      tipo,
      media_url,
      mensaje,
      mensaje_respuesta_id,
    });

    if (!empresaId) {
      return responderErrorWhatsapp(res, buildWhatsappErrorInfo("ERROR_DESCONOCIDO", "empresaId requerido", {
        mensajeUsuario: "No se pudo determinar la empresa activa para enviar el mensaje.",
        accionSugerida: "Vuelve a iniciar sesión. Si el problema continúa, repórtalo al administrador.",
      }));
    }

    if (!telefono) {
      return responderErrorWhatsapp(res, buildWhatsappErrorInfo("NUMERO_INVALIDO", "telefono es requerido"));
    }

    const mensajeRespuestaId = mensaje_respuesta_id !== undefined && mensaje_respuesta_id !== null && mensaje_respuesta_id !== ""
      && Number.isFinite(Number(mensaje_respuesta_id))
      ? Number(mensaje_respuesta_id)
      : null;

    if (tipoMensaje === "text") {
      if (!mensaje || !String(mensaje).trim()) {
        return responderErrorWhatsapp(res, buildWhatsappErrorInfo("MENSAJE_VACIO", "mensaje es requerido"));
      }

      const respuesta = await sendTextMessage(Number(empresaId), String(telefono), String(mensaje), mensajeRespuestaId);
      return res.status(200).json(respuesta);
    }

    if (tipoMensaje === "image") {
      if (!media_url) {
        return responderErrorWhatsapp(res, buildWhatsappErrorInfo("ARCHIVO_NO_PERMITIDO", "media_url es requerido", {
          mensajeUsuario: "No se pudo enviar el archivo adjunto porque no fue posible cargarlo.",
        }));
      }

      const respuesta = await sendImageMessage(
        Number(empresaId),
        String(telefono),
        String(media_url),
        mensaje ? String(mensaje) : null,
        mensajeRespuestaId
      );
      return res.status(200).json(respuesta);
    }

    if (tipoMensaje === "document") {
      if (!media_url) {
        return responderErrorWhatsapp(res, buildWhatsappErrorInfo("ARCHIVO_NO_PERMITIDO", "media_url es requerido", {
          mensajeUsuario: "No se pudo enviar el archivo adjunto porque no fue posible cargarlo.",
        }));
      }

      const respuesta = await sendDocumentMessage(
        Number(empresaId),
        String(telefono),
        String(media_url),
        mensaje ? String(mensaje) : null,
        { mensajeRespuestaId }
      );
      return res.status(200).json(respuesta);
    }

    if (tipoMensaje === "audio") {
      if (!media_url) {
        return responderErrorWhatsapp(res, buildWhatsappErrorInfo("ARCHIVO_NO_PERMITIDO", "media_url es requerido", {
          mensajeUsuario: "No se pudo enviar el archivo adjunto porque no fue posible cargarlo.",
        }));
      }

      const respuesta = await sendAudioMessage(
        Number(empresaId),
        String(telefono),
        String(media_url),
        mensajeRespuestaId
      );
      return res.status(200).json(respuesta);
    }

    return responderErrorWhatsapp(res, buildWhatsappErrorInfo("ERROR_DESCONOCIDO", `tipo de mensaje no soportado: ${tipoMensaje}`));
  } catch (error) {
    const info = classifyWhatsappError(error);

    logWhatsappFailureTechnical({
      empresaId: empresaId ?? null,
      telefono: telefono ?? null,
      usuarioId,
      tipoMensaje,
      tieneAdjunto: Boolean(media_url),
      info,
    });

    return responderErrorWhatsapp(res, info);
  }
};

type ReenvioStatus =
  | "enviado"
  | "ventana_cerrada"
  | "archivo_no_disponible"
  | "no_autorizado"
  | "conversacion_invalida"
  | "error";

type ReenvioResultado = {
  conversacion_id: number;
  nombre: string | null;
  status: ReenvioStatus;
  mensaje_usuario: string | null;
};

// Ejecuta `fn` sobre `items` respetando un máximo de tareas en paralelo, para
// no lanzar N requests simultáneos a Gupshup en un reenvío múltiple. No hay
// ninguna librería de concurrencia en el backend (ver whatsapp.service.ts),
// así que se resuelve con un lote simple propio.
async function mapWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await fn(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Reenvía un mensaje existente (texto, imagen, documento o audio) a una o
// varias conversaciones destino. Es técnicamente un mensaje nuevo por cada
// destinatario: reutiliza exactamente el mismo flujo de envío/persistencia
// que un mensaje normal (sendTextMessage/sendImageMessage/etc., incluida la
// validación de la ventana de 24h dentro de cada uno), por lo que no
// duplica esa lógica ni permite evadirla. No usa mensaje_respuesta_id del
// original: reenviar no es responder, y el contexto de reply no tiene
// sentido cruzado entre conversaciones distintas.
export const reenviarMensajeWhatsapp = async (req: Request, res: Response) => {
  const empresaId = req.context?.empresaId ?? getEmpresaActivaId();
  const authUserId = req.auth?.userId;
  const esSuperadmin = req.auth?.esSuperadmin;

  try {
    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    const { mensaje_id, conversaciones_destino } = req.body || {};
    const mensajeId = Number(mensaje_id);

    if (!Number.isFinite(mensajeId) || mensajeId <= 0) {
      return res.status(400).json({ message: "mensaje_id es requerido y debe ser numérico" });
    }

    if (!Array.isArray(conversaciones_destino) || conversaciones_destino.length === 0) {
      return res.status(400).json({ message: "conversaciones_destino es requerido y debe ser un arreglo no vacío" });
    }

    const destinoIds = Array.from(
      new Set(
        conversaciones_destino
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isFinite(value) && value > 0)
      )
    );

    if (destinoIds.length === 0) {
      return res.status(400).json({ message: "conversaciones_destino no contiene ids válidos" });
    }

    if (destinoIds.length > MAX_REENVIO_DESTINATARIOS) {
      return res.status(400).json({
        message: `No puedes reenviar a más de ${MAX_REENVIO_DESTINATARIOS} conversaciones a la vez`,
      });
    }

    const mensajeOriginal = await obtenerMensajeParaReenvio(Number(empresaId), mensajeId);
    if (!mensajeOriginal) {
      return res.status(404).json({ message: "El mensaje original no existe o no pertenece a esta empresa" });
    }

    const tieneAccesoOrigen = await validarAccesoConversacion(
      Number(empresaId),
      mensajeOriginal.conversacion_id,
      authUserId,
      esSuperadmin
    );
    if (!tieneAccesoOrigen) {
      return res.status(403).json({ message: "No tienes acceso a la conversación de este mensaje" });
    }

    if (
      (mensajeOriginal.tipo_contenido === "image" ||
        mensajeOriginal.tipo_contenido === "audio" ||
        mensajeOriginal.tipo_contenido === "document") &&
      !mensajeOriginal.media_url
    ) {
      return res.status(422).json({ message: "El mensaje original no tiene un archivo adjunto disponible para reenviar" });
    }

    if (mensajeOriginal.tipo_contenido === "text" && !mensajeOriginal.contenido?.trim()) {
      return res.status(422).json({ message: "El mensaje original no tiene contenido de texto para reenviar" });
    }

    const scope = await resolverContextoScopeComercial(Number(empresaId), authUserId, esSuperadmin);
    if (!scope.esAdmin && !scope.vendedorContactoId) {
      return res.status(403).json({ message: "No tienes conversaciones asignadas para reenviar mensajes" });
    }

    const destinosValidos = await obtenerConversacionesDestinoValidas(Number(empresaId), destinoIds, scope);
    const destinosValidosPorId = new Map(destinosValidos.map((d) => [d.id, d]));

    // Si el adjunto es media, se valida UNA sola vez que la URL siga siendo
    // accesible (puede venir de Gupshup y ser temporal, o de /uploads y ser
    // persistente): si falla, ningún destinatario debe recibir un envío con
    // una URL rota.
    let mediaDisponible = true;
    if (mensajeOriginal.media_url && mensajeOriginal.tipo_contenido !== "text") {
      mediaDisponible = await verifyMediaUrlReachable(mensajeOriginal.media_url);
    }

    const usuarioId = authUserId ? Number(authUserId) : null;
    const forwardMetadata: MensajeSalienteMetadata = {
      reenviado_de_mensaje_id: mensajeOriginal.id,
      reenviado_por_usuario_id: usuarioId,
      conversacion_origen_id: mensajeOriginal.conversacion_id,
    };

    const resultados = await mapWithConcurrencyLimit(destinoIds, REENVIO_CONCURRENCY, async (destinoId): Promise<ReenvioResultado> => {
      const destino = destinosValidosPorId.get(destinoId);

      if (!destino) {
        return { conversacion_id: destinoId, nombre: null, status: "no_autorizado", mensaje_usuario: "No autorizado para esta conversación" };
      }
      if (!destino.telefono) {
        return { conversacion_id: destinoId, nombre: destino.nombre, status: "conversacion_invalida", mensaje_usuario: "La conversación no tiene un teléfono asociado" };
      }
      if (!mediaDisponible) {
        return {
          conversacion_id: destinoId,
          nombre: destino.nombre,
          status: "archivo_no_disponible",
          mensaje_usuario: "El archivo adjunto original ya no está disponible",
        };
      }

      try {
        if (mensajeOriginal.tipo_contenido === "text") {
          await sendTextMessage(Number(empresaId), destino.telefono, mensajeOriginal.contenido as string, null, forwardMetadata);
        } else if (mensajeOriginal.tipo_contenido === "image") {
          await sendImageMessage(Number(empresaId), destino.telefono, mensajeOriginal.media_url as string, mensajeOriginal.caption ?? null, null, forwardMetadata);
        } else if (mensajeOriginal.tipo_contenido === "document") {
          await sendDocumentMessage(Number(empresaId), destino.telefono, mensajeOriginal.media_url as string, mensajeOriginal.caption ?? null, {
            mensajeRespuestaId: null,
            forwardMetadata,
          });
        } else if (mensajeOriginal.tipo_contenido === "audio") {
          await sendAudioMessage(Number(empresaId), destino.telefono, mensajeOriginal.media_url as string, null, forwardMetadata);
        }

        return { conversacion_id: destinoId, nombre: destino.nombre, status: "enviado", mensaje_usuario: null };
      } catch (error) {
        const info = classifyWhatsappError(error);
        logWhatsappFailureTechnical({
          empresaId: Number(empresaId),
          telefono: destino.telefono,
          usuarioId,
          tipoMensaje: `reenvio:${mensajeOriginal.tipo_contenido}`,
          tieneAdjunto: mensajeOriginal.tipo_contenido !== "text",
          info,
        });

        const status: ReenvioStatus = error instanceof WhatsappWindowExpiredError ? "ventana_cerrada" : "error";
        return { conversacion_id: destinoId, nombre: destino.nombre, status, mensaje_usuario: info.mensajeUsuario };
      }
    });

    const resumen = resultados.reduce(
      (acc, r) => {
        acc[r.status] += 1;
        acc.total += 1;
        return acc;
      },
      {
        enviado: 0,
        ventana_cerrada: 0,
        archivo_no_disponible: 0,
        no_autorizado: 0,
        conversacion_invalida: 0,
        error: 0,
        total: 0,
      }
    );

    return res.status(200).json({ mensaje_id: mensajeOriginal.id, resultados, resumen });
  } catch (error) {
    console.error("Error reenviando mensaje de WhatsApp:", error);
    return res.status(500).json({ message: "No se pudo procesar el reenvío del mensaje" });
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

    const { esAdmin, esVendedor, vendedorContactoId } = await resolverContextoScopeComercial(
      empresaId,
      authUserId,
      req.auth?.esSuperadmin
    );

    const vendedorParamRaw = (req.query.vendedor_id ?? req.query.vendedorId) as string | string[] | undefined;
    const vendedorParam = Array.isArray(vendedorParamRaw) ? vendedorParamRaw[0] : vendedorParamRaw;
    const vendedorFilter = vendedorParam ? Number(vendedorParam) : null;
    const tagIdsRaw = req.query.tag_ids ?? req.query.tagIds;
    const tagIdsValue = Array.isArray(tagIdsRaw) ? tagIdsRaw.join(',') : tagIdsRaw;
    const tagIdsString = typeof tagIdsValue === 'string' ? tagIdsValue.trim() : '';
    const tagIds = tagIdsString
      ? tagIdsString
        .split(',')
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
      : [];

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

    if (tagIds.length > 0) {
      params.push(tagIds);
      filters.push(`EXISTS (
        SELECT 1
        FROM crm.conversacion_etiquetas ce
        WHERE ce.empresa_id = c.empresa_id
          AND ce.conversacion_id = c.id
          AND ce.etiqueta_id = ANY($${params.length})
      )`);
    }

    const estadoParamRaw = req.query.estado;
    const estadoParam = Array.isArray(estadoParamRaw) ? estadoParamRaw[0] : estadoParamRaw;
    const soloFinalizadas = estadoParam === 'finalizada';

    // Las conversaciones finalizadas no deben aparecer en el tablero operativo
    // (Riesgo de perder / Requiere atención / Actividad reciente) salvo que se
    // pida explícitamente la vista de Finalizadas.
    filters.push(
      soloFinalizadas
        ? "(c.estado = 'finalizada' OR c.finalizada_en IS NOT NULL)"
        : "NOT (c.estado = 'finalizada' OR c.finalizada_en IS NOT NULL)"
    );

    const searchParamRaw = req.query.search ?? req.query.q;
    const searchParamValue = Array.isArray(searchParamRaw) ? searchParamRaw[0] : searchParamRaw;
    const searchTerm = typeof searchParamValue === "string" ? searchParamValue.trim() : "";

    if (searchTerm) {
      params.push(`%${escapeLikePattern(searchTerm)}%`);
      const textIdx = params.length;

      // Además del texto libre, si el término trae dígitos utilizables como
      // teléfono se compara contra el teléfono normalizado (solo dígitos y "+"),
      // igual que hacía el filtro anterior en el frontend.
      const phoneDigits = searchTerm.replace(/[^\d+]/g, "");
      let phoneClause = "FALSE";
      if (phoneDigits) {
        params.push(`%${escapeLikePattern(phoneDigits)}%`);
        const phoneIdx = params.length;
        phoneClause = `regexp_replace(COALESCE(ct.telefono, lm.telefono, ''), '[^0-9+]', '', 'g') ILIKE $${phoneIdx} ESCAPE '\\'`;
      }

      // EXISTS (en vez de JOIN) para no multiplicar filas por conversación ni
      // romper la paginación/orden actuales; empresa_id se repite dentro del
      // EXISTS como aislamiento explícito por tenant, aunque conversacion_id
      // ya pertenece a una sola empresa.
      filters.push(`(
        sat.unaccent(COALESCE(ct.nombre, '')) ILIKE sat.unaccent($${textIdx}) ESCAPE '\\'
        OR ${phoneClause}
        OR EXISTS (
          SELECT 1
          FROM crm.mensajes msg_buscar
          WHERE msg_buscar.empresa_id = c.empresa_id
            AND msg_buscar.conversacion_id = c.id
            AND msg_buscar.contenido IS NOT NULL
            AND sat.unaccent(msg_buscar.contenido) ILIKE sat.unaccent($${textIdx}) ESCAPE '\\'
        )
      )`);
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
        c.estado,
        c.finalizada_en,
        c.finalizada_por,
        c.motivo_finalizacion,
        c.observaciones_finalizacion,
        c.reactivada_en,
        EXISTS (
          SELECT 1
          FROM crm.oportunidades_venta o
          WHERE o.empresa_id = c.empresa_id
            AND o.conversacion_id = c.id
        ) AS "tiene_oportunidad",
        lm.contenido AS "ultimoMensaje",
        lm.tipo_mensaje AS "ultimoMensajeTipo",
        lm.fecha_envio AS "ultimoMensajeEn"
      FROM crm.conversaciones c
      LEFT JOIN public.contactos ct ON ct.id = c.contacto_id
      LEFT JOIN LATERAL (
        SELECT m.telefono, m.contenido, m.fecha_envio, m.tipo_mensaje
        FROM crm.mensajes m
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

export const obtenerReglasSeguimientoWhatsapp = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId ?? getEmpresaActivaId();

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    const reglas = await getReglasSeguimiento(Number(empresaId));
    return res.status(200).json(reglas);
  } catch (error) {
    console.error("Error obteniendo reglas de seguimiento de WhatsApp:", error);
    return res.status(500).json({ message: "No se pudieron obtener las reglas de seguimiento" });
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

    const { esAdmin, esVendedor, vendedorContactoId } = await resolverContextoScopeComercial(
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
         FROM crm.conversaciones c
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
      ? " AND (m.fecha_envio > $3 OR (m.fecha_envio IS NULL AND m.creado_en > $3))"
      : "";

    const messages = await pool.query(
      `
      SELECT
        m.id,
        m.telefono,
        m.tipo_mensaje,
        m.canal,
        m.tipo_contenido,
        m.media_url,
        m.caption,
        m.contenido,
        m.fecha_envio,
        m.status,
        m.creado_en,
        m.mensaje_respuesta_id,
        r.tipo_mensaje AS respuesta_tipo_mensaje,
        r.tipo_contenido AS respuesta_tipo_contenido,
        r.contenido AS respuesta_contenido,
        r.caption AS respuesta_caption
      FROM crm.mensajes m
      LEFT JOIN crm.mensajes r ON r.id = m.mensaje_respuesta_id AND r.empresa_id = m.empresa_id
      WHERE m.conversacion_id = $1 AND m.empresa_id = $2
      ${sinceWhere}
      ORDER BY m.fecha_envio ASC NULLS LAST, m.creado_en ASC NULLS LAST
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
    const etapaOportunidad = normalizarEtapaOportunidad((req.body as { etapa_oportunidad?: string })?.etapa_oportunidad);
    const authUserId = req.auth?.userId;

    console.log("[PATCH /whatsapp/conversaciones/:id/etapa] payload", {
      conversacionId,
      etapa_oportunidad: etapaOportunidad,
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
      "convertida",
      "perdida",
    ];

    if (!etapaOportunidad || !etapasValidas.includes(etapaOportunidad)) {
      return res.status(400).json({ message: "etapa_oportunidad inválida" });
    }

    const { esAdmin, esVendedor, vendedorContactoId } = await resolverContextoScopeComercial(
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
         FROM crm.conversaciones c
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
      UPDATE crm.conversaciones
      SET etapa_oportunidad = $1
      WHERE id = $2 AND empresa_id = $3
      RETURNING id, contacto_id AS "contactoId", estado, etapa_oportunidad, ultimo_mensaje_en, creada_en
      `,
      [etapaOportunidad, conversacionId, empresaId]
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

export const finalizarConversacionWhatsapp = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId ?? getEmpresaActivaId();
    const conversacionId = Number(req.params.id);
    const authUserId = req.auth?.userId;
    const { motivo_finalizacion, observaciones_finalizacion } = req.body || {};

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    if (!Number.isFinite(conversacionId)) {
      return res.status(400).json({ message: "id de conversación inválido" });
    }

    const motivo = typeof motivo_finalizacion === "string" ? motivo_finalizacion.trim() : "";
    if (!MOTIVOS_FINALIZACION.includes(motivo as MotivoFinalizacion)) {
      return res.status(400).json({ message: `motivo_finalizacion debe ser uno de: ${MOTIVOS_FINALIZACION.join(", ")}` });
    }

    const observaciones = typeof observaciones_finalizacion === "string" ? observaciones_finalizacion.trim() : "";
    if (motivo === "otro" && !observaciones) {
      return res.status(400).json({ message: "observaciones_finalizacion es requerido cuando el motivo es 'otro'" });
    }

    const acceso = await validarAccesoConversacion(
      empresaId,
      conversacionId,
      authUserId,
      req.auth?.esSuperadmin
    );

    if (!acceso) {
      return res.status(404).json({ message: "Conversación no encontrada" });
    }

    const actualizado = await finalizarConversacion(
      empresaId,
      conversacionId,
      authUserId ?? null,
      motivo as MotivoFinalizacion,
      observaciones ? observaciones : null
    );

    if (!actualizado) {
      return res.status(404).json({ message: "Conversación no encontrada" });
    }

    return res.status(200).json(actualizado);
  } catch (error) {
    console.error("Error finalizando conversación de WhatsApp:", error);
    return res.status(500).json({ message: "No se pudo finalizar la conversación" });
  }
};

export const reabrirConversacionWhatsapp = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId ?? getEmpresaActivaId();
    const conversacionId = Number(req.params.id);
    const authUserId = req.auth?.userId;

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    if (!Number.isFinite(conversacionId)) {
      return res.status(400).json({ message: "id de conversación inválido" });
    }

    const acceso = await validarAccesoConversacion(
      empresaId,
      conversacionId,
      authUserId,
      req.auth?.esSuperadmin
    );

    if (!acceso) {
      return res.status(404).json({ message: "Conversación no encontrada" });
    }

    const actualizado = await reabrirConversacion(empresaId, conversacionId);

    if (!actualizado) {
      return res.status(404).json({ message: "Conversación no encontrada" });
    }

    return res.status(200).json(actualizado);
  } catch (error) {
    console.error("Error reabriendo conversación de WhatsApp:", error);
    return res.status(500).json({ message: "No se pudo reabrir la conversación" });
  }
};

export const listarEtiquetasWhatsapp = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId ?? getEmpresaActivaId();
    const incluirInactivas = req.query.incluir_inactivas === "1" || req.query.incluir_inactivas === "true";

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    const etiquetas = await listarEtiquetasWhatsappRepo(empresaId, incluirInactivas);
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

export const eliminarEtiquetaWhatsappController = async (req: Request, res: Response) => {
  try {
    const empresaId = req.context?.empresaId ?? getEmpresaActivaId();
    const etiquetaId = Number(req.params.id);

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    if (!Number.isFinite(etiquetaId)) {
      return res.status(400).json({ message: "id de etiqueta inválido" });
    }

    const eliminada = await eliminarEtiquetaWhatsapp(empresaId, etiquetaId);

    if (!eliminada) {
      return res.status(404).json({ message: "Etiqueta no encontrada" });
    }

    return res.status(200).json({ deleted: true });
  } catch (error: any) {
    if (error?.code === "TAG_IN_USE") {
      const usoCount = Number(error?.usoCount || 0);
      return res.status(409).json({
        message: `No se puede eliminar la etiqueta porque está asignada a ${usoCount} conversación${usoCount === 1 ? "" : "es"}.`,
      });
    }
    console.error("Error eliminando etiqueta de WhatsApp:", error);
    return res.status(500).json({ message: "No se pudo eliminar la etiqueta" });
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
    const { telefono, tipo, plantilla_id, params } = req.body || {};

    console.info('[WhatsApp Template Controller] Solicitud recibida', {
      empresaId,
      telefono,
      tipo,
      plantilla_id,
    });

    if (!empresaId) {
      return res.status(400).json({ message: "empresaId requerido" });
    }

    if (!telefono) {
      return res.status(400).json({ message: "telefono es requerido" });
    }

    const templateParams: string[] = Array.isArray(params) ? params.map(String) : [];

    let respuesta: any;

    if (plantilla_id) {
      const plantilla = await obtenerPlantillaWhatsappPorId(Number(empresaId), Number(plantilla_id));
      if (!plantilla) {
        return res.status(404).json({ message: "Plantilla no encontrada" });
      }
      if (!plantilla.activa) {
        return res.status(409).json({ message: "La plantilla no está activa" });
      }
      respuesta = await sendTemplateMensajeDirecta(Number(empresaId), String(telefono), plantilla, templateParams);
    } else {
      const accionPlantilla = String(tipo ?? DEFAULT_WHATSAPP_TEMPLATE_ACTION).trim() || DEFAULT_WHATSAPP_TEMPLATE_ACTION;
      let tipoPlantilla: string;

      try {
        tipoPlantilla = resolverTipoPlantillaWhatsapp(accionPlantilla);
      } catch (error) {
        return res.status(400).json({ message: (error as Error).message });
      }

      respuesta = await sendTemplateMessage(Number(empresaId), String(telefono), tipoPlantilla, templateParams);
    }

    console.info('[WhatsApp Template Controller] Respuesta', { empresaId, telefono, respuesta });

    if (respuesta?.error) {
      return res.status(409).json({ message: respuesta.message || "No hay plantilla disponible" });
    }

    return res.status(200).json(respuesta);
  } catch (error) {
    console.error('[WhatsApp Template Controller] Error al enviar plantilla de WhatsApp', error);
    return res.status(500).json({ message: "No se pudo enviar la plantilla" });
  }
};