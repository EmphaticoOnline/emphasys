import pool from '../../config/database';

export type TipoDocumento = {
  codigo: string;
  nombre: string;
  nombre_plural: string | null;
  icono: string | null;
};

export async function listarTiposDocumento(): Promise<TipoDocumento[]> {
  const query = `
    SELECT codigo, nombre, nombre_plural, icono
      FROM core.tipos_documento
     WHERE activo = TRUE
     ORDER BY orden
  `;

  const { rows } = await pool.query<TipoDocumento>(query);
  return rows;
}
