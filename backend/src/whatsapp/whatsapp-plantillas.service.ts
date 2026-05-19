import pool from "../config/database";

export type WhatsappPlantilla = {
  id: number;
  empresa_id: number;
  nombre_interno: string;
  tipo: string;
  proveedor: string;
  provider_template_id: string;
  es_default: boolean;
  activa: boolean;
};

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
      activa
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
      activa
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
      activa
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
      activa
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
