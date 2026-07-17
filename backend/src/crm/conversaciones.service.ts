import pool from "../config/database";
import { normalizarTelefono } from "../utils/telefono";

export type ReglasSeguimiento = {
  tiempo_tolerancia_respuesta_a_cliente: number;
  tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente: number;
  tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente: number;
};

const DEFAULT_REGLAS_SEGUIMIENTO: ReglasSeguimiento = {
  tiempo_tolerancia_respuesta_a_cliente: 30,
  tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente: 4,
  tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente: 24,
};

export async function getReglasSeguimiento(empresaId: number): Promise<ReglasSeguimiento> {
  try {
    const { rows } = await pool.query<Partial<ReglasSeguimiento>>(
      `
        SELECT
          tiempo_tolerancia_respuesta_a_cliente,
          tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente,
          tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente
        FROM crm.reglas_seguimiento
        WHERE empresa_id = $1
        LIMIT 1
      `,
      [empresaId]
    );

    const row = rows[0];
    if (!row) {
      return { ...DEFAULT_REGLAS_SEGUIMIENTO };
    }

    return {
      tiempo_tolerancia_respuesta_a_cliente: Number.isFinite(Number(row.tiempo_tolerancia_respuesta_a_cliente))
        ? Number(row.tiempo_tolerancia_respuesta_a_cliente)
        : DEFAULT_REGLAS_SEGUIMIENTO.tiempo_tolerancia_respuesta_a_cliente,
      tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente: Number.isFinite(Number(row.tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente))
        ? Number(row.tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente)
        : DEFAULT_REGLAS_SEGUIMIENTO.tiempo_sin_seguimiento_requerido_despues_de_respuesta_a_cliente,
      tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente: Number.isFinite(Number(row.tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente))
        ? Number(row.tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente)
        : DEFAULT_REGLAS_SEGUIMIENTO.tiempo_maximo_sin_respuesta_despues_de_respuesta_a_cliente,
    };
  } catch (error) {
    console.error("Error obteniendo reglas de seguimiento:", error);
    return { ...DEFAULT_REGLAS_SEGUIMIENTO };
  }
}

export const getOrCreateWhatsappContacto = async (empresaId: number, telefono: string) => {
  const telefonoNormalizado = normalizarTelefono(telefono);
  const variantes = Array.from(new Set([
    telefono,
    telefonoNormalizado,
    telefonoNormalizado.startsWith('52') && telefonoNormalizado.length === 12
      ? `521${telefonoNormalizado.slice(2)}`
      : null,
    telefonoNormalizado.startsWith('521') && telefonoNormalizado.length === 13
      ? `52${telefonoNormalizado.slice(3)}`
      : null,
  ].filter((value): value is string => Boolean(value))));

  for (const variante of variantes) {
    const contactoResult = await pool.query(
      `
        SELECT id
        FROM public.contactos
        WHERE empresa_id = $1
          AND telefono = $2
        LIMIT 1
        `,
      [empresaId, variante]
    );

    if (contactoResult.rows.length > 0) {
      console.info('[WhatsApp Contacto] Contacto existente encontrado', {
        empresaId,
        telefonoOriginal: telefono,
        telefonoNormalizado,
        varianteUsada: variante,
        contactoId: contactoResult.rows[0].id,
        huboMatch: true,
      });

      return contactoResult.rows[0].id as number;
    }
  }

  console.info('[WhatsApp Contacto] No se encontro contacto existente, creando nuevo', {
    empresaId,
    telefonoOriginal: telefono,
    telefonoNormalizado,
    variantesBuscadas: variantes,
    huboMatch: false,
  });

  const newContacto = await pool.query(
    `
        INSERT INTO public.contactos
  (empresa_id, tipo_contacto, nombre, telefono, activo, bloqueado)
  VALUES ($1, 'Lead', $2, $3, true, false)
        RETURNING id
        `,
    [empresaId, telefonoNormalizado, telefonoNormalizado]
  );

  return newContacto.rows[0].id as number;
};

export const getOrCreateConversacionContacto = async (empresaId: number, contactoId: number) => {
  // No filtra por estado: si ya existe una conversación finalizada para este
  // contacto se reutiliza (no se crea una duplicada). La reactivación a
  // 'abierta' se maneja aparte, solo ante mensajes entrantes.
  const convResult = await pool.query(
    `
      SELECT id
      FROM crm.conversaciones
      WHERE empresa_id = $1
        AND contacto_id = $2
      ORDER BY creada_en DESC
      LIMIT 1
      `,
    [empresaId, contactoId]
  );

  if (convResult.rows.length > 0) {
    return convResult.rows[0].id as number;
  }

  const newConv = await pool.query(
    `
        INSERT INTO crm.conversaciones
        (empresa_id, contacto_id, estado, creada_en, ultimo_mensaje_en)
        VALUES ($1, $2, 'abierta', NOW(), NOW())
        RETURNING id
        `,
    [empresaId, contactoId]
  );

  return newConv.rows[0].id as number;
};

export const getOrCreateConversacionWhatsapp = async (empresaId: number, contactoId: number) => {
  return getOrCreateConversacionContacto(empresaId, contactoId);
};

export const obtenerIdExternoMensaje = async (
  empresaId: number,
  mensajeId: number
): Promise<string | null> => {
  const { rows } = await pool.query<{ id_externo: string | null }>(
    `
      SELECT id_externo
      FROM crm.mensajes
      WHERE id = $1
        AND empresa_id = $2
      LIMIT 1
      `,
    [mensajeId, empresaId]
  );

  return rows[0]?.id_externo ?? null;
};

export type MensajeParaReenvio = {
  id: number;
  conversacion_id: number;
  tipo_mensaje: 'entrante' | 'saliente';
  tipo_contenido: 'text' | 'image' | 'audio' | 'document';
  contenido: string | null;
  caption: string | null;
  media_url: string | null;
};

// Trae el mensaje original a reenviar, siempre acotado a empresa_id: si el
// mensaje pertenece a otra empresa simplemente no aparece (null), nunca se
// filtra información cruzada entre tenants.
export const obtenerMensajeParaReenvio = async (
  empresaId: number,
  mensajeId: number
): Promise<MensajeParaReenvio | null> => {
  const { rows } = await pool.query<MensajeParaReenvio>(
    `
      SELECT
        id,
        conversacion_id,
        tipo_mensaje,
        COALESCE(tipo_contenido, 'text') AS tipo_contenido,
        contenido,
        caption,
        media_url
      FROM crm.mensajes
      WHERE id = $1
        AND empresa_id = $2
      LIMIT 1
      `,
    [mensajeId, empresaId]
  );

  return rows[0] ?? null;
};

export type ConversacionDestinoReenvio = {
  id: number;
  contacto_id: number | null;
  telefono: string | null;
  nombre: string | null;
};

// Resuelve, en una sola consulta, cuáles de los ids de conversación pedidos
// como destino de un reenvío son válidos: deben pertenecer a la misma
// empresa y, si el usuario es vendedor (no admin), estar asignados a su
// vendedor_contacto_id. Los ids que no aparecen en el resultado deben
// tratarse como no autorizados o inexistentes por el llamador.
export const obtenerConversacionesDestinoValidas = async (
  empresaId: number,
  conversacionIds: number[],
  vendedorScope: { esAdmin: boolean; vendedorContactoId: number | null }
): Promise<ConversacionDestinoReenvio[]> => {
  if (conversacionIds.length === 0) return [];

  const params: any[] = [empresaId, conversacionIds];
  let vendedorClause = '';
  if (!vendedorScope.esAdmin) {
    params.push(vendedorScope.vendedorContactoId);
    vendedorClause = ` AND ct.vendedor_id = $${params.length}`;
  }

  const { rows } = await pool.query<ConversacionDestinoReenvio>(
    `
      SELECT
        c.id,
        c.contacto_id,
        ct.telefono,
        ct.nombre
      FROM crm.conversaciones c
      LEFT JOIN public.contactos ct ON ct.id = c.contacto_id
      WHERE c.empresa_id = $1
        AND c.id = ANY($2::bigint[])
        ${vendedorClause}
      `,
    params
  );

  return rows;
};

export const registrarMensajeEmailSaliente = async (params: {
  empresaId: number;
  contactoId: number | null;
  conversacionId: number;
  contenido: string;
  emailTo: string;
  emailFrom: string | null;
  emailSubject: string;
  status: 'sent' | 'failed';
  externalId?: string | null;
  respuestaJson?: Record<string, unknown> | null;
}) => {
  await pool.query(
    `
      INSERT INTO crm.mensajes
      (
        empresa_id,
        contacto_id,
        conversacion_id,
        telefono,
        tipo_mensaje,
        canal,
        tipo_contenido,
        contenido,
        email_to,
        email_from,
        email_subject,
        fecha_envio,
        status,
        id_externo,
        respuesta_json,
        creado_en
      )
      VALUES ($1, $2, $3, NULL, 'saliente', 'email', 'text', $4, $5, $6, $7, NOW(), $8, $9, $10::jsonb, NOW())
      `,
    [
      params.empresaId,
      params.contactoId,
      params.conversacionId,
      params.contenido,
      params.emailTo,
      params.emailFrom,
      params.emailSubject,
      params.status,
      params.externalId ?? null,
      params.respuestaJson ? JSON.stringify(params.respuestaJson) : null,
    ]
  );
};

export const actualizarConversacionSaliente = async (conversacionId: number, empresaId: number) => {
  await pool.query(
    `
      UPDATE crm.conversaciones
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
};

// Trazabilidad interna de reenvíos: no existe una columna dedicada para
// relacionar un mensaje reenviado con su mensaje original, así que se
// reutiliza la columna jsonb `respuesta_json` (hoy sin uso en mensajes
// salientes de WhatsApp) en vez de agregar una migración. Nunca se muestra
// al cliente: solo viaja internamente en crm.mensajes para auditoría.
export type MensajeSalienteMetadata = {
  reenviado_de_mensaje_id: number;
  reenviado_por_usuario_id: number | null;
  conversacion_origen_id: number;
};

export const registrarMensajeTextoSalienteWhatsapp = async (
  empresaId: number,
  conversacionId: number,
  telefono: string,
  text: string,
  externalId: string | null,
  mensajeRespuestaId?: number | null,
  metadata?: MensajeSalienteMetadata | null
) => {
  await pool.query(
    `
      INSERT INTO crm.mensajes
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
        mensaje_respuesta_id,
        respuesta_json,
        creado_en
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8,$9,$10,$11::jsonb,NOW())
      `,
    [
      empresaId,
      conversacionId,
      telefono,
      'saliente',
      'whatsapp',
      'text',
      text,
      externalId,
      'sent',
      mensajeRespuestaId ?? null,
      metadata ? JSON.stringify(metadata) : null
    ]
  );
};

export const registrarMensajeImagenSalienteWhatsapp = async (
  empresaId: number,
  conversacionId: number,
  telefono: string,
  mediaUrl: string,
  caption: string | null,
  externalId: string | null,
  mensajeRespuestaId?: number | null,
  metadata?: MensajeSalienteMetadata | null
) => {
  await pool.query(
    `
      INSERT INTO crm.mensajes
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
        mensaje_respuesta_id,
        respuesta_json,
        creado_en
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),$9,$10,$11,$12::jsonb,NOW())
      `,
    [
      empresaId,
      conversacionId,
      telefono,
      'saliente',
      'whatsapp',
      'image',
      caption,
      mediaUrl,
      externalId,
      'sent',
      mensajeRespuestaId ?? null,
      metadata ? JSON.stringify(metadata) : null
    ]
  );
};

export const registrarMensajeDocumentoSalienteWhatsapp = async (
  empresaId: number,
  conversacionId: number,
  telefono: string,
  mediaUrl: string,
  filename: string | null,
  externalId: string | null,
  mensajeRespuestaId?: number | null,
  metadata?: MensajeSalienteMetadata | null
) => {
  await pool.query(
    `
      INSERT INTO crm.mensajes
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
        mensaje_respuesta_id,
        respuesta_json,
        creado_en
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),$9,$10,$11,$12::jsonb,NOW())
      `,
    [
      empresaId,
      conversacionId,
      telefono,
      'saliente',
      'whatsapp',
      'document',
      filename,
      mediaUrl,
      externalId,
      'sent',
      mensajeRespuestaId ?? null,
      metadata ? JSON.stringify(metadata) : null
    ]
  );
};

export const registrarMensajeAudioSalienteWhatsapp = async (
  empresaId: number,
  conversacionId: number,
  telefono: string,
  mediaUrl: string,
  externalId: string | null,
  mensajeRespuestaId?: number | null,
  metadata?: MensajeSalienteMetadata | null
) => {
  await pool.query(
    `
      INSERT INTO crm.mensajes
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
        mensaje_respuesta_id,
        respuesta_json,
        creado_en
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8,$9,$10,$11::jsonb,NOW())
      `,
    [
      empresaId,
      conversacionId,
      telefono,
      'saliente',
      'whatsapp',
      'audio',
      mediaUrl,
      externalId,
      'sent',
      mensajeRespuestaId ?? null,
      metadata ? JSON.stringify(metadata) : null
    ]
  );
};

export const registrarMensajePlantillaSalienteWhatsapp = async (
  empresaId: number,
  conversacionId: number,
  telefono: string,
  contenido: string,
  externalId: string | null
) => {
  await pool.query(
    `
      INSERT INTO crm.mensajes
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
      telefono,
      'saliente',
      'whatsapp',
      contenido,
      externalId,
      'sent'
    ]
  );
};

// Devuelve el id del mensaje insertado, o null si el webhook es un duplicado
// (mismo (empresa_id, id_externo) ya procesado antes). `ux_mensaje_externo`
// (crm.mensajes, UNIQUE (empresa_id, id_externo) WHERE id_externo IS NOT
// NULL — ver database/schema/crm/mensajes.sql) es el índice que respalda el
// `ON CONFLICT`: el WHERE del ON CONFLICT debe coincidir exactamente con el
// predicado del índice parcial para que Postgres lo use como árbitro. Con
// `DO NOTHING`, un webhook reintentado por Gupshup no lanza una violación
// de unicidad (que antes sí ocurría y terminaba clasificada como error
// técnico en el catch general de whatsappWebhook): simplemente no inserta
// nada y RETURNING no devuelve filas, así el llamador puede distinguir
// "insertado" de "duplicado" sin depender de capturar una excepción.
export const registrarMensajeEntranteWhatsapp = async (
  empresaId: number,
  conversacionId: number,
  telefono: string,
  contenido: string,
  timestamp: string | number | Date | null | undefined,
  messageId: string,
  media?: {
    tipoContenido?: 'text' | 'image' | 'audio' | 'document';
    mediaUrl?: string | null;
    caption?: string | null;
    mimeType?: string | null;
  }
): Promise<number | null> => {
  const { rows } = await pool.query<{ id: number }>(
    `
      INSERT INTO crm.mensajes
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
        tipo_contenido,
        media_url,
        caption,
        mime_type,
        creado_en
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
      ON CONFLICT (empresa_id, id_externo) WHERE id_externo IS NOT NULL DO NOTHING
      RETURNING id
      `,
    [
      empresaId,
      conversacionId,
      telefono,
      'entrante',
      'whatsapp',
      contenido,
      timestamp,
      messageId,
      'received',
      media?.tipoContenido || 'text',
      media?.mediaUrl ?? null,
      media?.caption ?? null,
      media?.mimeType ?? null,
    ]
  );

  return rows[0]?.id ?? null;
};

// Se llama solo desde el flujo best-effort de persistencia local de
// adjuntos entrantes (whatsappWebhook -> whatsapp-media-download.service),
// después de que la descarga terminó con éxito. El filtro
// `AND media_url = $4` es una guarda defensiva: solo pisa el valor si
// todavía es la URL original de Gupshup que se guardó al insertar el
// mensaje, para no sobrescribir un cambio hecho por otra vía mientras la
// descarga estaba en curso.
export const actualizarMediaUrlMensajeEntrante = async (
  empresaId: number,
  mensajeId: number,
  mediaUrlOriginal: string,
  mediaUrlLocal: string
): Promise<boolean> => {
  const result = await pool.query(
    `
      UPDATE crm.mensajes
      SET media_url = $1
      WHERE id = $2
        AND empresa_id = $3
        AND media_url = $4
      `,
    [mediaUrlLocal, mensajeId, empresaId, mediaUrlOriginal]
  );

  return (result.rowCount ?? 0) > 0;
};

export const actualizarConversacionSalienteWhatsapp = async (
  conversacionId: number,
  empresaId: number
) => {
  await actualizarConversacionSaliente(conversacionId, empresaId);
};

export const actualizarConversacionEntranteWhatsapp = async (conversacionId: number) => {
  // Único punto de entrada para mensajes entrantes: si la conversación estaba
  // finalizada, se reactiva automáticamente. Los envíos salientes desde el ERP
  // (actualizarConversacionSalienteWhatsapp) nunca deben reactivarla.
  await pool.query(
    `
      UPDATE crm.conversaciones
      SET
        ultimo_mensaje_en = GREATEST(ultimo_mensaje_en, NOW()),
        estado = CASE WHEN estado = 'finalizada' OR finalizada_en IS NOT NULL THEN 'abierta' ELSE estado END,
        finalizada_en = CASE WHEN estado = 'finalizada' OR finalizada_en IS NOT NULL THEN NULL ELSE finalizada_en END,
        finalizada_por = CASE WHEN estado = 'finalizada' OR finalizada_en IS NOT NULL THEN NULL ELSE finalizada_por END,
        motivo_finalizacion = CASE WHEN estado = 'finalizada' OR finalizada_en IS NOT NULL THEN NULL ELSE motivo_finalizacion END,
        observaciones_finalizacion = CASE WHEN estado = 'finalizada' OR finalizada_en IS NOT NULL THEN NULL ELSE observaciones_finalizacion END,
        reactivada_en = CASE WHEN estado = 'finalizada' OR finalizada_en IS NOT NULL THEN NOW() ELSE reactivada_en END,
        reactivada_por_evento = CASE WHEN estado = 'finalizada' OR finalizada_en IS NOT NULL THEN 'mensaje_entrante' ELSE reactivada_por_evento END,
        siguiente_accion = CASE WHEN estado = 'finalizada' OR finalizada_en IS NOT NULL THEN 'responder' ELSE siguiente_accion END,
        prioridad = CASE WHEN estado = 'finalizada' OR finalizada_en IS NOT NULL THEN 'media' ELSE prioridad END,
        etapa_oportunidad = CASE WHEN estado = 'finalizada' OR finalizada_en IS NOT NULL THEN 'contactado' ELSE etapa_oportunidad END
      WHERE id = $1
      `,
    [conversacionId]
  );
};

export const MOTIVOS_FINALIZACION = [
  'venta_cerrada',
  'informacion_entregada',
  'no_interesado',
  'sin_respuesta',
  'fuera_de_perfil',
  'duplicada',
  'prueba',
  'otro',
] as const;

export type MotivoFinalizacion = typeof MOTIVOS_FINALIZACION[number];

// crm.conversaciones.siguiente_accion es NOT NULL sin default vacío: al
// finalizar no hay una acción pendiente, así que se usa este valor en vez de NULL.
export const SIGUIENTE_ACCION_SIN_ACCION = 'sin_accion';

export const finalizarConversacion = async (
  empresaId: number,
  conversacionId: number,
  usuarioId: number | null,
  motivoFinalizacion: MotivoFinalizacion,
  observacionesFinalizacion: string | null
) => {
  const { rows } = await pool.query(
    `
      UPDATE crm.conversaciones
      SET
        estado = 'finalizada',
        finalizada_en = NOW(),
        finalizada_por = $3,
        motivo_finalizacion = $4,
        observaciones_finalizacion = $5,
        siguiente_accion = $6
      WHERE id = $1
        AND empresa_id = $2
      RETURNING
        id,
        estado,
        finalizada_en,
        finalizada_por,
        motivo_finalizacion,
        observaciones_finalizacion,
        siguiente_accion
      `,
    [conversacionId, empresaId, usuarioId, motivoFinalizacion, observacionesFinalizacion, SIGUIENTE_ACCION_SIN_ACCION]
  );

  return rows[0] ?? null;
};

export const reabrirConversacion = async (empresaId: number, conversacionId: number) => {
  const { rows } = await pool.query(
    `
      UPDATE crm.conversaciones
      SET
        estado = 'abierta',
        finalizada_en = NULL,
        finalizada_por = NULL,
        motivo_finalizacion = NULL,
        observaciones_finalizacion = NULL,
        reactivada_en = NOW(),
        reactivada_por_evento = 'reapertura_manual',
        siguiente_accion = 'responder',
        prioridad = 'media',
        etapa_oportunidad = 'contactado'
      WHERE id = $1
        AND empresa_id = $2
      RETURNING
        id,
        estado,
        finalizada_en,
        reactivada_en,
        reactivada_por_evento,
        etapa_oportunidad,
        siguiente_accion,
        prioridad
      `,
    [conversacionId, empresaId]
  );

  return rows[0] ?? null;
};