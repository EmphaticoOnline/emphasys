import pool from '../../../config/database';

export interface CfdiSatAutorizacionRow {
  id: number;
  empresa_id: number;
  usuario_id: number;
  version_texto: string;
  aceptado_en: string;
  usuario_nombre: string;
}

export async function obtenerAutorizacionVigente(
  empresaId: number,
  version: string
): Promise<CfdiSatAutorizacionRow | null> {
  const { rows } = await pool.query<CfdiSatAutorizacionRow>(
    `SELECT a.id, a.empresa_id, a.usuario_id, a.version_texto, a.aceptado_en, u.nombre AS usuario_nombre
       FROM core.cfdi_sat_autorizaciones a
       JOIN core.usuarios u ON u.id = a.usuario_id
      WHERE a.empresa_id = $1
        AND a.version_texto = $2
      ORDER BY a.aceptado_en DESC
      LIMIT 1`,
    [empresaId, version]
  );

  return rows[0] ?? null;
}

export async function registrarAceptacion(
  empresaId: number,
  usuarioId: number,
  version: string
): Promise<void> {
  await pool.query(
    `INSERT INTO core.cfdi_sat_autorizaciones (empresa_id, usuario_id, version_texto)
     VALUES ($1, $2, $3)`,
    [empresaId, usuarioId, version]
  );
}
