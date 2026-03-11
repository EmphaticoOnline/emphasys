import pool from '../../config/database';

export type EntidadTipo = {
  id: number;
  codigo: string;
  nombre: string;
};

export async function listarEntidadesTipos(): Promise<EntidadTipo[]> {
  const query = `
    SELECT id, codigo, nombre
      FROM core.entidades_tipos
     ORDER BY nombre ASC, id
  `;
  const { rows } = await pool.query<EntidadTipo>(query);
  return rows;
}
