import pool from '../../config/database';

export type TipoDatoCampo = 'texto' | 'numero' | 'fecha' | 'booleano' | 'lista';

export type CampoConfiguracion = {
  id: number;
  empresa_id: number;
  entidad_tipo_id: number;
  entidad_tipo_codigo: string | null;
  tipo_documento: string | null;
  nombre: string;
  clave: string | null;
  tipo_dato: TipoDatoCampo;
  tipo_control: string | null;
  proposito_sistema: string | null;
  catalogo_tipo_id: number | null;
  catalogo_tipo_nombre: string | null;
  campo_padre_id: number | null;
  obligatorio: boolean;
  activo: boolean;
  orden: number | null;
  created_at: string;
};

export type CamposConfiguracionFiltro = {
  entidad_tipo_id?: number;
  entidad_tipo_codigo?: string;
  tipo_documento?: string;
  incluirInactivos?: boolean;
};

function validarCatalogoTipoLista(payload: Partial<CampoConfiguracion>): void {
  if (payload.tipo_dato === 'lista' && !payload.catalogo_tipo_id) {
    throw new Error('catalogo_tipo_id es obligatorio cuando tipo_dato es lista');
  }
}

function normalizarPropositoSistema(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === '') return null;

  return String(value).trim();
}

export async function obtenerCamposConfiguracion(
  empresaId: number,
  filtros: CamposConfiguracionFiltro = {}
): Promise<CampoConfiguracion[]> {
  const conditions: string[] = ['cc.empresa_id = $1'];
  const values: Array<number | string | boolean> = [empresaId];

  if (filtros.entidad_tipo_id) {
    conditions.push(`cc.entidad_tipo_id = $${conditions.length + 1}`);
    values.push(filtros.entidad_tipo_id);
  } else if (filtros.entidad_tipo_codigo) {
    conditions.push(`LOWER(et.codigo) = LOWER($${conditions.length + 1})`);
    values.push(filtros.entidad_tipo_codigo);
  }

  if (filtros.tipo_documento) {
    conditions.push(`(cc.tipo_documento IS NULL OR LOWER(cc.tipo_documento) = LOWER($${conditions.length + 1}))`);
    values.push(filtros.tipo_documento);
  }

  if (!filtros.incluirInactivos) {
    conditions.push('cc.activo = true');
  }

  const query = `
    SELECT
      cc.id,
      cc.empresa_id,
      cc.entidad_tipo_id,
      et.codigo AS entidad_tipo_codigo,
      cc.tipo_documento,
      cc.nombre,
      cc.clave,
      cc.tipo_dato,
      cc.tipo_control,
      cc.proposito_sistema,
      cc.catalogo_tipo_id,
      ct.nombre AS catalogo_tipo_nombre,
      cc.campo_padre_id,
      cc.obligatorio,
      cc.activo,
      cc.orden,
      cc.created_at
    FROM core.campos_configuracion cc
    LEFT JOIN core.catalogos_tipos ct ON ct.id = cc.catalogo_tipo_id
    LEFT JOIN core.entidades_tipos et ON et.id = cc.entidad_tipo_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY cc.orden ASC NULLS LAST, cc.nombre ASC NULLS LAST, cc.id
  `;

  const { rows } = await pool.query<CampoConfiguracion>(query, values);
  return rows;
}

async function validarCampoPadre(
  empresaId: number,
  payload: Partial<CampoConfiguracion>,
  idActual?: number | null
): Promise<void> {
  const padreId = payload.campo_padre_id;
  if (padreId === null || padreId === undefined) return;
  if (idActual && padreId === idActual) {
    throw new Error('Un campo no puede ser padre de sí mismo');
  }

  const query = `
    SELECT id, entidad_tipo_id, tipo_documento
      FROM core.campos_configuracion
     WHERE id = $1 AND empresa_id = $2
     LIMIT 1
  `;
  const { rows } = await pool.query(query, [padreId, empresaId]);
  const padre = rows[0];
  if (!padre) {
    throw new Error('El campo padre no pertenece a la empresa');
  }

  if (payload.entidad_tipo_id && padre.entidad_tipo_id !== payload.entidad_tipo_id) {
    throw new Error('El campo padre debe pertenecer a la misma entidad');
  }

  const tipoDocActual = payload.tipo_documento?.toLowerCase() ?? null;
  const tipoDocPadre = padre.tipo_documento ? String(padre.tipo_documento).toLowerCase() : null;
  if (tipoDocActual !== tipoDocPadre) {
    throw new Error('El campo padre debe pertenecer al mismo tipo de documento');
  }
}

export async function crearCampoConfiguracion(
  empresaId: number,
  payload: Partial<CampoConfiguracion>
): Promise<CampoConfiguracion> {
  const normalizedPayload: Partial<CampoConfiguracion> = {
    ...payload,
    proposito_sistema: normalizarPropositoSistema(payload.proposito_sistema),
  };

  validarCatalogoTipoLista(normalizedPayload);
  await validarCampoPadre(empresaId, normalizedPayload, null);

  const cols = [
    'empresa_id',
    'entidad_tipo_id',
    'tipo_documento',
    'nombre',
    'clave',
    'tipo_dato',
    'tipo_control',
    'proposito_sistema',
    'catalogo_tipo_id',
    'campo_padre_id',
    'obligatorio',
    'activo',
    'orden',
  ];

  const values = [
    empresaId,
    normalizedPayload.entidad_tipo_id,
    normalizedPayload.tipo_documento ?? null,
    normalizedPayload.nombre,
    normalizedPayload.clave ?? null,
    normalizedPayload.tipo_dato,
    normalizedPayload.tipo_control ?? null,
    normalizedPayload.proposito_sistema ?? null,
    normalizedPayload.catalogo_tipo_id ?? null,
    normalizedPayload.campo_padre_id ?? null,
    normalizedPayload.obligatorio ?? false,
    normalizedPayload.activo ?? true,
    normalizedPayload.orden ?? null,
  ];

  const params = values.map((_, i) => `$${i + 1}`).join(', ');
  const query = `
    INSERT INTO core.campos_configuracion (${cols.join(', ')})
    VALUES (${params})
    RETURNING *
  `;

  const { rows } = await pool.query<CampoConfiguracion>(query, values);
  return rows[0];
}

export async function actualizarCampoConfiguracion(
  empresaId: number,
  id: number,
  payload: Partial<CampoConfiguracion>
): Promise<CampoConfiguracion | null> {
  const normalizedPayload: Partial<CampoConfiguracion> = {
    ...payload,
    ...(payload.proposito_sistema !== undefined
      ? { proposito_sistema: normalizarPropositoSistema(payload.proposito_sistema) }
      : {}),
  };

  const allowed = [
    'entidad_tipo_id',
    'tipo_documento',
    'nombre',
    'clave',
    'tipo_dato',
    'tipo_control',
    'proposito_sistema',
    'catalogo_tipo_id',
    'campo_padre_id',
    'obligatorio',
    'activo',
    'orden',
  ];

  const sets: string[] = [];
  const values: any[] = [];

  for (const field of allowed) {
    if (field in normalizedPayload) {
      values.push((normalizedPayload as any)[field]);
      sets.push(`${field} = $${values.length}`);
    }
  }

  if (!sets.length) return null;

  const baseQuery = `
    SELECT entidad_tipo_id, tipo_documento, tipo_dato, proposito_sistema, catalogo_tipo_id
      FROM core.campos_configuracion
     WHERE id = $1 AND empresa_id = $2
     LIMIT 1
  `;
  const baseRes = await pool.query(baseQuery, [id, empresaId]);
  const actual = baseRes.rows[0];
  if (!actual) return null;

  const merged: Partial<CampoConfiguracion> = {
    entidad_tipo_id: normalizedPayload.entidad_tipo_id ?? actual.entidad_tipo_id,
    tipo_documento: normalizedPayload.tipo_documento ?? actual.tipo_documento,
    tipo_dato: ('tipo_dato' in normalizedPayload ? normalizedPayload.tipo_dato : actual.tipo_dato) as CampoConfiguracion['tipo_dato'],
    proposito_sistema: ('proposito_sistema' in normalizedPayload
      ? normalizedPayload.proposito_sistema ?? null
      : actual.proposito_sistema ?? null) as CampoConfiguracion['proposito_sistema'],
    catalogo_tipo_id: 'catalogo_tipo_id' in normalizedPayload ? normalizedPayload.catalogo_tipo_id ?? null : actual.catalogo_tipo_id ?? null,
    campo_padre_id: normalizedPayload.campo_padre_id ?? undefined,
  } as any;

  validarCatalogoTipoLista(merged);
  await validarCampoPadre(empresaId, merged, id);

  values.push(id);
  values.push(empresaId);

  const query = `
    UPDATE core.campos_configuracion
       SET ${sets.join(', ')}
     WHERE id = $${values.length - 1} AND empresa_id = $${values.length}
     RETURNING *
  `;

  const { rows } = await pool.query<CampoConfiguracion>(query, values);
  return rows[0] ?? null;
}

export async function eliminarCampoConfiguracion(
  empresaId: number,
  id: number
): Promise<CampoConfiguracion | null> {
  const query = `
    DELETE FROM core.campos_configuracion
    WHERE id = $1 AND empresa_id = $2
    RETURNING *
  `;
  const { rows } = await pool.query<CampoConfiguracion>(query, [id, empresaId]);
  return rows[0] ?? null;
}
