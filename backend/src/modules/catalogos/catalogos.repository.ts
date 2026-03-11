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
  catalogo_padre_id: number | null;
  catalogo_padre_nombre?: string | null;
  catalogo_padre_tipo_catalogo_id?: number | null;
  created_at: string;
};

export type CatalogoValorWithTipo = CatalogoValor & {
  tipo_catalogo_nombre: string | null;
};

export class CatalogoJerarquiaError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function obtenerCatalogoInfo(
  empresaId: number,
  id: number
): Promise<{ catalogo_padre_id: number | null; tipo_catalogo_id: number }> {
  const query = `SELECT catalogo_padre_id, tipo_catalogo_id FROM core.catalogos WHERE id = $1 AND empresa_id = $2 LIMIT 1`;
  const { rows } = await pool.query<{ catalogo_padre_id: number | null; tipo_catalogo_id: number }>(query, [id, empresaId]);
  if (!rows.length) {
    throw new CatalogoJerarquiaError('El padre indicado no existe en la empresa');
  }
  return rows[0];
}

async function validarJerarquiaSinCiclo(
  empresaId: number,
  idActual: number | null,
  catalogoPadreId: number | null | undefined,
  tipoCatalogoActual?: number | null
): Promise<void> {
  if (catalogoPadreId === null || catalogoPadreId === undefined) return;

  let tipoActual = tipoCatalogoActual ?? null;
  if (tipoActual === null && idActual !== null) {
    const infoActual = await obtenerCatalogoInfo(empresaId, idActual);
    tipoActual = infoActual.tipo_catalogo_id;
  }
  if (tipoActual === null || tipoActual === undefined) {
    throw new CatalogoJerarquiaError('tipo_catalogo_id es obligatorio para validar jerarquía');
  }

  if (idActual !== null && catalogoPadreId === idActual) {
    throw new CatalogoJerarquiaError('Un registro no puede ser padre de sí mismo');
  }

  const visitados = new Set<number>();
  let cursor: number | null = catalogoPadreId;

  while (cursor !== null) {
    if (visitados.has(cursor)) {
      throw new CatalogoJerarquiaError('La jerarquía de catálogos contiene un ciclo');
    }
    visitados.add(cursor);

    if (idActual !== null && cursor === idActual) {
      throw new CatalogoJerarquiaError('Un registro no puede ser padre de su propio ancestro');
    }

    const infoPadre = await obtenerCatalogoInfo(empresaId, cursor);
    if (infoPadre.tipo_catalogo_id !== tipoActual) {
      throw new CatalogoJerarquiaError('El padre debe pertenecer al mismo tipo de catálogo');
    }

    cursor = infoPadre.catalogo_padre_id ?? null;
  }
}

export async function obtenerCatalogosPorTipo(
  empresaId: number,
  tipoCatalogoId: number
): Promise<CatalogoValorWithTipo[]> {
  const query = `
    SELECT c.*, ct.nombre AS tipo_catalogo_nombre, cpadre.descripcion AS catalogo_padre_nombre, cpadre.tipo_catalogo_id AS catalogo_padre_tipo_catalogo_id
    FROM core.catalogos c
    INNER JOIN core.catalogos_tipos ct ON ct.id = c.tipo_catalogo_id
    LEFT JOIN core.catalogos cpadre ON cpadre.id = c.catalogo_padre_id
    WHERE c.empresa_id = $1 AND c.tipo_catalogo_id = $2
    ORDER BY c.orden ASC NULLS LAST, c.descripcion ASC NULLS LAST, c.id
  `;
  const { rows } = await pool.query(query, [empresaId, tipoCatalogoId]);
  return rows;
}

async function resolverCatalogoTipoId(
  empresaId: number,
  tipoCatalogo: number | string
): Promise<number | null> {
  if (typeof tipoCatalogo === 'number' && Number.isFinite(tipoCatalogo)) {
    return tipoCatalogo;
  }

  const numeric = Number(tipoCatalogo);
  if (Number.isFinite(numeric)) {
    return numeric;
  }

  const query = `
    SELECT id
      FROM core.catalogos_tipos
     WHERE empresa_id = $1
       AND LOWER(nombre) = LOWER($2)
     ORDER BY id
     LIMIT 1
  `;
  const { rows } = await pool.query<{ id: number }>(query, [empresaId, String(tipoCatalogo)]);
  return rows[0]?.id ?? null;
}

export async function obtenerCatalogosPorTipoFlexible(
  empresaId: number,
  tipoCatalogo: number | string,
  parentId?: number | null
): Promise<CatalogoValorWithTipo[]> {
  const tipoId = await resolverCatalogoTipoId(empresaId, tipoCatalogo);
  if (!tipoId) return [];

  const values: Array<number | null> = [empresaId, tipoId];
  const conditions = ['c.empresa_id = $1', 'c.tipo_catalogo_id = $2'];

  if (parentId === null) {
    conditions.push('c.catalogo_padre_id IS NULL');
  } else if (parentId !== undefined) {
    conditions.push(`c.catalogo_padre_id = $${values.length + 1}`);
    values.push(parentId);
  }

  const query = `
    SELECT c.*, ct.nombre AS tipo_catalogo_nombre, cpadre.descripcion AS catalogo_padre_nombre, cpadre.tipo_catalogo_id AS catalogo_padre_tipo_catalogo_id
      FROM core.catalogos c
      INNER JOIN core.catalogos_tipos ct ON ct.id = c.tipo_catalogo_id
      LEFT JOIN core.catalogos cpadre ON cpadre.id = c.catalogo_padre_id
     WHERE ${conditions.join(' AND ')}
       AND c.activo = true
     ORDER BY c.orden ASC NULLS LAST, c.descripcion ASC NULLS LAST, c.id
  `;

  const { rows } = await pool.query<CatalogoValorWithTipo>(query, values);
  return rows;
}

export async function obtenerCatalogoTipoNombre(
  tipoCatalogoId: number
): Promise<string | null> {
  const query = 'SELECT nombre FROM core.catalogos_tipos WHERE id = $1 LIMIT 1';
  const { rows } = await pool.query(query, [tipoCatalogoId]);
  return rows[0]?.nombre ?? null;
}

export type CatalogoTipoRow = {
  id: number;
  nombre: string | null;
  entidad_tipo_id: number;
};

export async function listarCatalogosTipos(empresaId: number): Promise<CatalogoTipoRow[]> {
  const query = `
    SELECT id, nombre, entidad_tipo_id
      FROM core.catalogos_tipos
     WHERE empresa_id = $1
       AND activo = true
     ORDER BY nombre NULLS LAST, id
  `;

  const { rows } = await pool.query<CatalogoTipoRow>(query, [empresaId]);
  return rows;
}

export async function crearCatalogoValor(
  empresaId: number,
  payload: Partial<CatalogoValor>
): Promise<CatalogoValor> {
  await validarJerarquiaSinCiclo(empresaId, null, payload.catalogo_padre_id ?? null, payload.tipo_catalogo_id ?? null);

  const cols = ['empresa_id', 'tipo_catalogo_id', 'clave', 'descripcion', 'orden', 'activo', 'extra', 'catalogo_padre_id'];
  const values = [
    empresaId,
    payload.tipo_catalogo_id,
    payload.clave ?? null,
    payload.descripcion,
    payload.orden ?? null,
    payload.activo ?? true,
    payload.extra ?? null,
    payload.catalogo_padre_id ?? null,
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
  if ('catalogo_padre_id' in payload) {
    const tipoActual = payload.tipo_catalogo_id ?? null;
    await validarJerarquiaSinCiclo(empresaId, id, payload.catalogo_padre_id ?? null, tipoActual);
  }

  const allowed = ['clave', 'descripcion', 'orden', 'activo', 'extra', 'catalogo_padre_id'];
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
