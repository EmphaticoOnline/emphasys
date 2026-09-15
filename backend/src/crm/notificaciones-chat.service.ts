import pool from "../config/database";
import { enviarPushAUsuario } from "../modules/notificaciones/notificaciones.service";

type ChatIncomingNotificationInput = {
  empresaId: number;
  contactoId: number;
  conversacionId: number;
  mensajeId: number;
  texto: string | null;
  tipoContenido: string | null;
  tieneAdjunto: boolean;
};

/** Orquestación CRM → usuario Emphasys → transporte Push general. */
export async function notificarNuevoMensajeChat(input: ChatIncomingNotificationInput): Promise<void> {
  const { rows } = await pool.query<{
    contacto_nombre: string;
    vendedor_id: number | null;
    usuario_id: number;
    usuarios_activos: string;
  }>(
    `SELECT c.nombre AS contacto_nombre,
            c.vendedor_id,
            u.id AS usuario_id,
            COUNT(u.id) OVER (PARTITION BY c.vendedor_id)::text AS usuarios_activos
       FROM public.contactos c
       LEFT JOIN core.usuarios u
         ON u.vendedor_contacto_id = c.vendedor_id
        AND u.activo = true
      WHERE c.id = $1
        AND c.empresa_id = $2`,
    [input.contactoId, input.empresaId]
  );

  const contacto = rows[0];
  if (!contacto?.vendedor_id) {
    console.warn("[Notificaciones Chat] Contacto sin vendedor asignado; Push omitido", {
      empresaId: input.empresaId, contactoId: input.contactoId, conversacionId: input.conversacionId,
    });
    return;
  }

  const activeUsers = rows.filter((row) => row.usuario_id != null);
  if (activeUsers.length === 0) {
    console.warn("[Notificaciones Chat] Vendedor sin usuario Emphasys activo; Push omitido", {
      empresaId: input.empresaId, contactoId: input.contactoId, vendedorId: contacto.vendedor_id,
    });
    return;
  }
  if (activeUsers.length !== 1) {
    console.error("[Notificaciones Chat] Vendedor con múltiples usuarios activos; Push omitido por ambigüedad", {
      empresaId: input.empresaId, contactoId: input.contactoId, vendedorId: contacto.vendedor_id,
      usuariosActivos: activeUsers.map((row) => row.usuario_id),
    });
    return;
  }

  const preview = input.texto?.trim();
  const body = preview || (input.tieneAdjunto
    ? `Tienes un nuevo ${input.tipoContenido || "archivo"} recibido.`
    : "Tienes un nuevo mensaje.");

  await enviarPushAUsuario(activeUsers[0].usuario_id, {
    title: `Nuevo mensaje de ${contacto.contacto_nombre || "contacto"}`,
    body,
    url: `/crm/conversaciones?conversation=${encodeURIComponent(String(input.conversacionId))}`,
    tag: "emphasys-chat-message",
    data: { type: "chat-message", conversationId: input.conversacionId },
  }, { respectPreferences: true, chatOnly: true });
}
