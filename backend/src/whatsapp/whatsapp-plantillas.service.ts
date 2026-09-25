import pool from "../config/database";

export type ParametroPlantilla = {
  variable: number;
  label: string;
  origen: 'manual' | 'contacto.nombre' | 'contacto.telefono' | 'contacto.empresa' | 'contacto.vendedor' | 'meta.formulario';
};

export type ContextoParametrosWhatsapp = {
  nombre: string;
  telefono: string;
  empresa: string;
  vendedor: string;
  formularioMeta: string;
};

const FORMULARIO_META_FALLBACK = 'tu proyecto';

export async function obtenerContextoParametrosWhatsapp(empresaId: number, contactoId: number): Promise<ContextoParametrosWhatsapp | null> {
  const { rows } = await pool.query<ContextoParametrosWhatsapp>(
    `SELECT COALESCE(NULLIF(BTRIM(c.nombre_contacto), ''), c.nombre, '') AS nombre,
            COALESCE(c.telefono, '') AS telefono,
            COALESCE(c.zona, '') AS empresa,
            COALESCE(NULLIF(BTRIM(vendedor.nombre), ''), '') AS vendedor,
            COALESCE(NULLIF(BTRIM(meta.form_name), ''), $3) AS "formularioMeta"
       FROM public.contactos c
       LEFT JOIN public.contactos vendedor ON vendedor.id = c.vendedor_id AND vendedor.empresa_id = c.empresa_id
       LEFT JOIN LATERAL (
         SELECT ml.form_name FROM crm.meta_leads ml
          WHERE ml.empresa_id = c.empresa_id AND ml.contacto_id = c.id
          ORDER BY COALESCE(ml.procesado_at, ml.actualizado_at, ml.recibido_at) DESC, ml.id DESC
          LIMIT 1
       ) meta ON TRUE
      WHERE c.empresa_id = $1 AND c.id = $2
      LIMIT 1`,
    [empresaId, contactoId, FORMULARIO_META_FALLBACK]
  );
  return rows[0] ?? null;
}

export async function resolverParametrosAutomaticosWhatsapp(
  empresaId: number,
  contactoId: number,
  plantilla: Pick<WhatsappPlantilla, 'configuracion_parametros'>,
  params: string[]
): Promise<string[]> {
  const contexto = await obtenerContextoParametrosWhatsapp(empresaId, contactoId);
  if (!contexto || !plantilla.configuracion_parametros) return params;
  const result = [...params];
  for (const parametro of plantilla.configuracion_parametros) {
    const index = parametro.variable - 1;
    if (index < 0) continue;
    switch (parametro.origen) {
      case 'contacto.nombre': result[index] = contexto.nombre; break;
      case 'contacto.telefono': result[index] = contexto.telefono; break;
      case 'contacto.empresa': result[index] = contexto.empresa; break;
      case 'contacto.vendedor': result[index] = contexto.vendedor; break;
      case 'meta.formulario': result[index] = contexto.formularioMeta; break;
      default: break;
    }
  }
  return result;
}

export type WhatsappPlantilla = {
  id: number;
  empresa_id: number;
  nombre_interno: string;
  tipo: string;
  proveedor: string;
  provider_template_id: string;
  es_default: boolean;
  activa: boolean;
  contenido?: string | null;
  configuracion_parametros?: ParametroPlantilla[] | null;
};

export type PlantillaPayload = {
  nombre_interno: string;
  tipo: string;
  proveedor: string;
  provider_template_id: string;
  es_default: boolean;
  activa?: boolean;
  contenido?: string | null;
  configuracion_parametros?: ParametroPlantilla[] | null;
};

export type PlantillaUpdatePayload = Partial<PlantillaPayload>;

export async function crearPlantilla(
  empresaId: number,
  payload: PlantillaPayload
): Promise<WhatsappPlantilla> {
  const { nombre_interno, tipo, proveedor, provider_template_id, es_default, activa = true, contenido = null, configuracion_parametros = null } = payload;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (es_default) {
      await client.query(
        `UPDATE whatsapp.plantillas
            SET es_default = FALSE
          WHERE empresa_id = $1 AND tipo = $2 AND es_default = TRUE`,
        [empresaId, tipo]
      );
    }

    const { rows } = await client.query<WhatsappPlantilla>(
      `INSERT INTO whatsapp.plantillas
         (empresa_id, nombre_interno, tipo, proveedor, provider_template_id, es_default, activa, contenido, configuracion_parametros)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, empresa_id, nombre_interno, tipo, proveedor, provider_template_id, es_default, activa, contenido, configuracion_parametros`,
      [empresaId, nombre_interno, tipo, proveedor, provider_template_id, es_default, activa, contenido, configuracion_parametros ? JSON.stringify(configuracion_parametros) : null]
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function actualizarPlantilla(
  empresaId: number,
  plantillaId: number,
  payload: PlantillaUpdatePayload
): Promise<WhatsappPlantilla | null> {
  const current = await obtenerPlantillaWhatsappPorId(empresaId, plantillaId);
  if (!current) return null;

  const nombre_interno = payload.nombre_interno ?? current.nombre_interno;
  const tipo = payload.tipo ?? current.tipo;
  const proveedor = payload.proveedor ?? current.proveedor;
  const provider_template_id = payload.provider_template_id ?? current.provider_template_id;
  const es_default = payload.es_default ?? current.es_default;
  const activa = payload.activa ?? current.activa;
  const contenido = 'contenido' in payload ? (payload.contenido ?? null) : (current.contenido ?? null);
  const configuracion_parametros = 'configuracion_parametros' in payload
    ? (payload.configuracion_parametros ?? null)
    : (current.configuracion_parametros ?? null);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (es_default && !current.es_default) {
      await client.query(
        `UPDATE whatsapp.plantillas
            SET es_default = FALSE
          WHERE empresa_id = $1 AND tipo = $2 AND es_default = TRUE AND id <> $3`,
        [empresaId, tipo, plantillaId]
      );
    }

    const { rows } = await client.query<WhatsappPlantilla>(
      `UPDATE whatsapp.plantillas
          SET nombre_interno = $1,
              tipo = $2,
              proveedor = $3,
              provider_template_id = $4,
              es_default = $5,
              activa = $6,
              contenido = $7,
              configuracion_parametros = $8,
              actualizado_en = NOW()
        WHERE id = $9 AND empresa_id = $10
        RETURNING id, empresa_id, nombre_interno, tipo, proveedor, provider_template_id, es_default, activa, contenido, configuracion_parametros`,
      [nombre_interno, tipo, proveedor, provider_template_id, es_default, activa, contenido, configuracion_parametros ? JSON.stringify(configuracion_parametros) : null, plantillaId, empresaId]
    );

    await client.query("COMMIT");
    return rows[0] ?? null;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listarPlantillasWhatsapp(
  empresaId: number,
  incluirInactivas = false
): Promise<WhatsappPlantilla[]> {
  const filtroActiva = incluirInactivas ? '' : 'AND activa = true';
  const { rows } = await pool.query<WhatsappPlantilla>(
    `
    SELECT
      id,
      empresa_id,
      nombre_interno,
      tipo,
      proveedor,
      provider_template_id,
      es_default,
      activa,
      contenido,
      configuracion_parametros
    FROM whatsapp.plantillas
    WHERE empresa_id = $1
      ${filtroActiva}
    ORDER BY activa DESC, nombre_interno ASC, id ASC
    `,
    [empresaId]
  );

  return rows;
}

export async function obtenerPlantillaWhatsappPorId(
  empresaId: number,
  plantillaId: number
): Promise<WhatsappPlantilla | null> {
  const { rows } = await pool.query<WhatsappPlantilla>(
    `
    SELECT
      id,
      empresa_id,
      nombre_interno,
      tipo,
      proveedor,
      provider_template_id,
      es_default,
      activa,
      contenido,
      configuracion_parametros
    FROM whatsapp.plantillas
    WHERE empresa_id = $1
      AND id = $2
    LIMIT 1
    `,
    [empresaId, plantillaId]
  );

  return rows[0] ?? null;
}

export async function resolverPlantillaWhatsapp(
  empresaId: number,
  tipo: string
): Promise<WhatsappPlantilla | null> {
  const queryDefault = `
    SELECT
      id,
      empresa_id,
      nombre_interno,
      tipo,
      proveedor,
      provider_template_id,
      es_default,
      activa,
      contenido,
      configuracion_parametros
    FROM whatsapp.plantillas
    WHERE empresa_id = $1
      AND tipo = $2
      AND activa = true
      AND es_default = true
    ORDER BY id ASC
    LIMIT 1
  `;

  const { rows: defaultRows } = await pool.query<WhatsappPlantilla>(queryDefault, [empresaId, tipo]);
  if (defaultRows.length > 0) {
    return defaultRows[0];
  }

  const queryFallback = `
    SELECT
      id,
      empresa_id,
      nombre_interno,
      tipo,
      proveedor,
      provider_template_id,
      es_default,
      activa,
      contenido,
      configuracion_parametros
    FROM whatsapp.plantillas
    WHERE empresa_id = $1
      AND tipo = $2
      AND activa = true
    ORDER BY es_default DESC, id ASC
    LIMIT 1
  `;

  const { rows: fallbackRows } = await pool.query<WhatsappPlantilla>(queryFallback, [empresaId, tipo]);
  return fallbackRows[0] ?? null;
}
