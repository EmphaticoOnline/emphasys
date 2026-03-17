import pool from '../../config/database';

export interface AlmacenRow {
  id: number;
  clave: string | null;
  nombre: string;
}

export async function getAlmacenesRepository(empresaId: number): Promise<AlmacenRow[]> {
  const query = `
    SELECT id, clave, nombre
      FROM inventario.almacenes
     WHERE empresa_id = $1
       AND activo = true
     ORDER BY nombre ASC, id ASC
  `;

  const { rows } = await pool.query<AlmacenRow>(query, [empresaId]);
  return rows;
}
