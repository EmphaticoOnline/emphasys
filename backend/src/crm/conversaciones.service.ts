import pool from "../config/database";

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
  const contactoResult = await pool.query(
    `
      SELECT id
      FROM public.contactos
      WHERE empresa_id = $1
        AND telefono = $2
      LIMIT 1
      `,
    [empresaId, telefono]
  );

  if (contactoResult.rows.length > 0) {
    return contactoResult.rows[0].id as number;
  }

  const newContacto = await pool.query(
    `
        INSERT INTO public.contactos
  (empresa_id, tipo_contacto, nombre, telefono, activo, bloqueado)
  VALUES ($1, 'Lead', $2, $3, true, false)
        RETURNING id
        `,
    [empresaId, telefono, telefono]
  );

  return newContacto.rows[0].id as number;
};

export const getOrCreateConversacionContacto = async (empresaId: number, contactoId: number) => {
  const convResult = await pool.query(
    `
      SELECT id
      FROM crm.conversaciones
      WHERE empresa_id = $1
        AND contacto_id = $2
        AND estado = 'abierta'
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

export const registrarMensajeTextoSalienteWhatsapp = async (
  empresaId: number,
  conversacionId: number,
  telefono: string,
  text: string,
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
      telefono,
      'saliente',
      'whatsapp',
      'text',
      text,
      externalId,
      'sent'
    ]
  );
};

export const registrarMensajeImagenSalienteWhatsapp = async (
  empresaId: number,
  conversacionId: number,
  telefono: string,
  mediaUrl: string,
  caption: string | null,
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
      telefono,
      'saliente',
      'whatsapp',
      'image',
      caption,
      mediaUrl,
      externalId,
      'sent'
    ]
  );
};

export const registrarMensajeDocumentoSalienteWhatsapp = async (
  empresaId: number,
  conversacionId: number,
  telefono: string,
  mediaUrl: string,
  filename: string | null,
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
      telefono,
      'saliente',
      'whatsapp',
      'document',
      filename,
      mediaUrl,
      externalId,
      'sent'
    ]
  );
};

export const registrarMensajeAudioSalienteWhatsapp = async (
  empresaId: number,
  conversacionId: number,
  telefono: string,
  mediaUrl: string,
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
      telefono,
      'saliente',
      'whatsapp',
      'audio',
      mediaUrl,
      externalId,
      'sent'
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

export const registrarMensajeEntranteWhatsapp = async (
  empresaId: number,
  conversacionId: number,
  telefono: string,
  contenido: string,
  timestamp: string | number | Date | null | undefined,
  messageId: string
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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
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
      'received'
    ]
  );
};

export const actualizarConversacionSalienteWhatsapp = async (
  conversacionId: number,
  empresaId: number
) => {
  await actualizarConversacionSaliente(conversacionId, empresaId);
};

export const actualizarConversacionEntranteWhatsapp = async (conversacionId: number) => {
  await pool.query(
    `
      UPDATE crm.conversaciones
      SET ultimo_mensaje_en = GREATEST(ultimo_mensaje_en, NOW())
      WHERE id = $1
      `,
    [conversacionId]
  );
};