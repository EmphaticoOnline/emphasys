import pool from '../../config/database';

export type CatalogoValor = {
  id: number;
  empresa_id: number;
  tipo_catalogo_id: number;
  clave: string | null;
  descripcion: string;
  orden: number | null;
  activo: boolean | null;
  extra: any;
  created_at: string;
};

export type CatalogoValorWithTipo = CatalogoValor & {
  tipo_catalogo_nombre: string | null;
};

export async function obtenerCatalogosPorTipo(
  empresaId: number,
  tipoCatalogoId: number
): Promise<CatalogoValorWithTipo[]> {
  const query = `
    SELECT c.*, ct.nombre AS tipo_catalogo_nombre
    FROM core.catalogos c
    INNER JOIN core.catalogos_tipos ct ON ct.id = c.tipo_catalogo_id
    WHERE c.empresa_id = $1 AND c.tipo_catalogo_id = $2
    ORDER BY c.orden ASC NULLS LAST, c.descripcion ASC NULLS LAST, c.id
  `;
  const { rows } = await pool.query(query, [empresaId, tipoCatalogoId]);
  return rows;
}

export async function obtenerCatalogoTipoNombre(
  tipoCatalogoId: number
): Promise<string | null> {
  const query = 'SELECT nombre FROM core.catalogos_tipos WHERE id = $1 LIMIT 1';
  const { rows } = await pool.query(query, [tipoCatalogoId]);
  return rows[0]?.nombre ?? null;
}

export async function crearCatalogoValor(
  empresaId: number,
  payload: Partial<CatalogoValor>
): Promise<CatalogoValor> {
  const cols = ['empresa_id', 'tipo_catalogo_id', 'clave', 'descripcion', 'orden', 'activo', 'extra'];
  const values = [
    empresaId,
    payload.tipo_catalogo_id,
    payload.clave ?? null,
    payload.descripcion,
    payload.orden ?? null,
    payload.activo ?? true,
    payload.extra ?? null,
  ];
  const params = values.map((_, i) => `$${i + 1}`).join(', ');
  const query = `INSERT INTO core.catalogos (${cols.join(', ')}) VALUES (${params}) RETURNING *`;
  const { rows } = await pool.query(query, values);
  return rows[0];
}

export async function actualizarCatalogoValor(
  empresaId: number,
  id: number,
  payload: Partial<CatalogoValor>
): Promise<CatalogoValor | null> {
  const allowed = ['clave', 'descripcion', 'orden', 'activo', 'extra'];
  const sets: string[] = [];
  const values: any[] = [];

  for (const field of allowed) {
    if (field in payload) {
      values.push((payload as any)[field]);
      sets.push(`${field} = $${values.length}`);
    }
  }

  if (!sets.length) return null;

  values.push(id);
  values.push(empresaId);

  const query = `
    UPDATE core.catalogos
    SET ${sets.join(', ')}
    WHERE id = $${values.length - 1} AND empresa_id = $${values.length}
    RETURNING *
  `;

  const { rows } = await pool.query(query, values);
  return rows[0] ?? null;
}

export async function catalogoEstaEnUso(id: number): Promise<boolean> {
  const query = `
    SELECT 1
    FROM core.entidades_catalogos
    WHERE catalogo_id = $1
    LIMIT 1
  `;
  const result = await pool.query(query, [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function eliminarCatalogoValor(
  empresaId: number,
  id: number
): Promise<CatalogoValor | null> {
  const query = `
    DELETE FROM core.catalogos
    WHERE id = $1 AND empresa_id = $2
    RETURNING *
  `;
  const { rows } = await pool.query(query, [id, empresaId]);
  return rows[0] ?? null;
}
