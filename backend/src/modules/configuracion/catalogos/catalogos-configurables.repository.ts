import pool from '../../../config/database';

export type CatalogoConfigurableRow = {
  entidad_tipo_id: number;
  entidad_nombre: string | null;
  entidad_descripcion: string | null;
  catalogo_tipo_id: number;
  catalogo_nombre: string | null;
  catalogo_descripcion: string | null;
};

export async function obtenerCatalogosConfigurables(empresaId: number): Promise<CatalogoConfigurableRow[]> {
  const query = `
    SELECT
      et.id AS entidad_tipo_id,
      et.nombre AS entidad_nombre,
      NULL::text AS entidad_descripcion,
      ct.id AS catalogo_tipo_id,
      ct.nombre AS catalogo_nombre,
      NULL::text AS catalogo_descripcion
    FROM core.catalogos_tipos ct
    INNER JOIN core.entidades_tipos et ON et.id = ct.entidad_tipo_id
  WHERE ct.empresa_id = $1
    ORDER BY entidad_nombre NULLS LAST, catalogo_nombre NULLS LAST, ct.id
  `;

  const result = await pool.query(query, [empresaId]);
  return result.rows;
}
