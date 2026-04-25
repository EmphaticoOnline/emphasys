import pool from "../config/database";

export type WhatsappEtiqueta = {
  id: number;
  empresa_id: number;
  nombre: string;
  color: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
  uso_count?: number;
};

export async function listarEtiquetasWhatsapp(empresaId: number, incluirInactivas = false) {
  const filtroActiva = incluirInactivas ? "" : " AND e.activo = true";
  const { rows } = await pool.query<WhatsappEtiqueta>(
    `
    SELECT
      e.id,
      e.empresa_id,
      e.nombre,
      e.color,
      e.activo,
      e.created_at,
      e.updated_at,
      COUNT(ce.id)::int AS uso_count
    FROM whatsapp.etiquetas e
    LEFT JOIN whatsapp.conversacion_etiquetas ce
      ON ce.etiqueta_id = e.id
      AND ce.empresa_id = e.empresa_id
    WHERE e.empresa_id = $1
      ${filtroActiva}
    GROUP BY e.id, e.empresa_id, e.nombre, e.color, e.activo, e.created_at, e.updated_at
    ORDER BY e.activo DESC, e.nombre ASC
    `,
    [empresaId]
  );
  return rows;
}

export async function obtenerEtiquetaWhatsapp(empresaId: number, etiquetaId: number, incluirInactivas = false) {
  const params: Array<number | boolean> = [empresaId, etiquetaId];
  const filtroActiva = incluirInactivas ? "" : " AND activo = true";
  const { rows } = await pool.query<WhatsappEtiqueta>(
    `
    SELECT id, empresa_id, nombre, color, activo, created_at, updated_at
    FROM whatsapp.etiquetas
    WHERE empresa_id = $1
      AND id = $2
      ${filtroActiva}
    `,
    params
  );
  return rows[0] ?? null;
}

export async function crearEtiquetaWhatsapp(empresaId: number, data: { nombre: string; color: string }) {
  const { nombre, color } = data;
  const { rows } = await pool.query<WhatsappEtiqueta>(
    `
    INSERT INTO whatsapp.etiquetas (empresa_id, nombre, color)
    VALUES ($1, $2, $3)
    RETURNING id, empresa_id, nombre, color, activo, created_at, updated_at
    `,
    [empresaId, nombre.trim(), color.trim()]
  );

  return rows[0];
}

export async function actualizarEtiquetaWhatsapp(
  empresaId: number,
  etiquetaId: number,
  data: { nombre?: string; color?: string; activo?: boolean }
) {
  const { nombre, color, activo } = data;
  const { rows } = await pool.query<WhatsappEtiqueta>(
    `
    UPDATE whatsapp.etiquetas
    SET nombre = COALESCE($3, nombre),
        color = COALESCE($4, color),
        activo = COALESCE($5, activo),
        updated_at = NOW()
    WHERE empresa_id = $1
      AND id = $2
    RETURNING id, empresa_id, nombre, color, activo, created_at, updated_at
    `,
    [empresaId, etiquetaId, nombre?.trim() ?? null, color?.trim() ?? null, activo ?? null]
  );

  return rows[0] ?? null;
}

export async function eliminarEtiquetaWhatsapp(empresaId: number, etiquetaId: number) {
  const usoResult = await pool.query<{ uso_count: number }>(
    `
    SELECT COUNT(*)::int AS uso_count
    FROM whatsapp.conversacion_etiquetas
    WHERE empresa_id = $1
      AND etiqueta_id = $2
    `,
    [empresaId, etiquetaId]
  );

  const usoCount = usoResult.rows[0]?.uso_count ?? 0;
  if (usoCount > 0) {
    const error = new Error("La etiqueta tiene asignaciones activas");
    (error as Error & { code?: string; usoCount?: number }).code = "TAG_IN_USE";
    (error as Error & { code?: string; usoCount?: number }).usoCount = usoCount;
    throw error;
  }

  const { rows } = await pool.query<WhatsappEtiqueta>(
    `
    DELETE FROM whatsapp.etiquetas
    WHERE empresa_id = $1
      AND id = $2
    RETURNING id, empresa_id, nombre, color, activo, created_at, updated_at
    `,
    [empresaId, etiquetaId]
  );

  return rows[0] ?? null;
}

export async function listarEtiquetasConversacion(empresaId: number, conversacionId: number) {
  const { rows } = await pool.query<WhatsappEtiqueta>(
    `
    SELECT e.id, e.empresa_id, e.nombre, e.color, e.activo, e.created_at, e.updated_at
    FROM whatsapp.conversacion_etiquetas ce
    INNER JOIN whatsapp.etiquetas e ON e.id = ce.etiqueta_id
    WHERE ce.empresa_id = $1
      AND ce.conversacion_id = $2
    ORDER BY e.nombre ASC
    `,
    [empresaId, conversacionId]
  );
  return rows;
}

export async function asignarEtiquetaConversacion(
  empresaId: number,
  conversacionId: number,
  etiquetaId: number
) {
  const { rows } = await pool.query(
    `
    INSERT INTO whatsapp.conversacion_etiquetas (empresa_id, conversacion_id, etiqueta_id)
    VALUES ($1, $2, $3)
    ON CONFLICT (conversacion_id, etiqueta_id) DO NOTHING
    RETURNING id, conversacion_id, etiqueta_id
    `,
    [empresaId, conversacionId, etiquetaId]
  );
  return rows[0] ?? null;
}

export async function quitarEtiquetaConversacion(
  empresaId: number,
  conversacionId: number,
  etiquetaId: number
) {
  const { rows } = await pool.query(
    `
    DELETE FROM whatsapp.conversacion_etiquetas
    WHERE empresa_id = $1
      AND conversacion_id = $2
      AND etiqueta_id = $3
    RETURNING id, conversacion_id, etiqueta_id
    `,
    [empresaId, conversacionId, etiquetaId]
  );
  return rows[0] ?? null;
}
