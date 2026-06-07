import pool from "../../../config/database";

export type CampoObligatorio = {
  id: number;
  empresa_id: number;
  entidad: string;
  contexto: string | null;
  campo: string;
  created_at: string;
};

export async function listarCamposObligatorios(
  empresaId: number,
  entidad: string,
  contexto: string | null
): Promise<string[]> {
  const { rows } = await pool.query<{ campo: string }>(
    `SELECT campo
       FROM core.campos_obligatorios
      WHERE empresa_id = $1
        AND entidad = $2
        AND ($3::varchar IS NULL OR contexto = $3)
      ORDER BY campo ASC`,
    [empresaId, entidad, contexto ?? null]
  );
  return rows.map((r) => r.campo);
}

export async function crearCampoObligatorio(
  empresaId: number,
  entidad: string,
  contexto: string | null,
  campo: string
): Promise<CampoObligatorio> {
  const { rows } = await pool.query<CampoObligatorio>(
    `INSERT INTO core.campos_obligatorios (empresa_id, entidad, contexto, campo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (empresa_id, entidad, contexto, campo) DO NOTHING
     RETURNING *`,
    [empresaId, entidad, contexto ?? null, campo]
  );
  if (rows[0]) return rows[0];
  const existing = await pool.query<CampoObligatorio>(
    `SELECT * FROM core.campos_obligatorios
      WHERE empresa_id = $1 AND entidad = $2
        AND (($3::varchar IS NULL AND contexto IS NULL) OR contexto = $3)
        AND campo = $4
      LIMIT 1`,
    [empresaId, entidad, contexto ?? null, campo]
  );
  return existing.rows[0];
}

export async function eliminarCampoObligatorio(
  empresaId: number,
  entidad: string,
  contexto: string | null,
  campo: string
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM core.campos_obligatorios
      WHERE empresa_id = $1
        AND entidad = $2
        AND (($3::varchar IS NULL AND contexto IS NULL) OR contexto = $3)
        AND campo = $4`,
    [empresaId, entidad, contexto ?? null, campo]
  );
  return (rowCount ?? 0) > 0;
}
