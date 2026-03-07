import pool from '../../config/database';
import { getEmpresaActivaId } from '../../shared/context/empresa';

export async function getUnidadesRepository() {
  const empresaId = getEmpresaActivaId();
  const query = `
    SELECT id, clave, descripcion, unidad_sat_id, activo
    FROM unidades
    WHERE empresa_id = $1
    ORDER BY descripcion
  `;
  const { rows } = await pool.query(query, [empresaId]);
  return rows;
}
