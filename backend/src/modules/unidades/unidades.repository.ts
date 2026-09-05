import pool from '../../config/database';
export type UnidadInput = { clave: string; descripcion: string; unidad_sat_id: number; activo?: boolean };

export async function getUnidadesRepository(empresaId: number, incluirInactivas = true) {
  const query = `
    SELECT u.id, u.clave, u.descripcion, u.unidad_sat_id, u.activo,
           su.clave AS unidad_sat_clave, su.descripcion AS unidad_sat_descripcion
    FROM unidades u
    JOIN sat.unidades su ON su.id = u.unidad_sat_id
    WHERE u.empresa_id = $1 AND ($2 OR u.activo = true)
    ORDER BY descripcion
  `;
  const { rows } = await pool.query(query, [empresaId, incluirInactivas]);
  return rows;
}

export async function crearUnidadRepository(empresaId: number, input: UnidadInput) {
  const { rows } = await pool.query(`INSERT INTO unidades (clave, descripcion, unidad_sat_id, empresa_id, activo) VALUES ($1,$2,$3,$4,$5) RETURNING id,clave,descripcion,unidad_sat_id,activo`, [input.clave.trim(), input.descripcion.trim(), input.unidad_sat_id, empresaId, input.activo ?? true]);
  return rows[0];
}

export async function actualizarUnidadRepository(empresaId: number, id: number, input: UnidadInput) {
  const { rows } = await pool.query(`UPDATE unidades SET clave=$1, descripcion=$2, unidad_sat_id=$3, activo=$4 WHERE id=$5 AND empresa_id=$6 RETURNING id,clave,descripcion,unidad_sat_id,activo`, [input.clave.trim(), input.descripcion.trim(), input.unidad_sat_id, input.activo ?? true, id, empresaId]);
  return rows[0] ?? null;
}

export async function eliminarUnidadRepository(empresaId: number, id: number) {
  const refs = await pool.query(`SELECT count(*)::int AS total FROM productos WHERE empresa_id=$1 AND (unidad_venta_id=$2 OR unidad_inventario_id=$2)`, [empresaId, id]);
  if (refs.rows[0].total > 0) return { deleted: false, referenced: refs.rows[0].total };
  const result = await pool.query(`DELETE FROM unidades WHERE id=$1 AND empresa_id=$2`, [id, empresaId]);
  return { deleted: result.rowCount === 1, referenced: 0 };
}
