import pool from '../../../config/database';
import type { PoolClient } from 'pg';

type QueryExecutor = Pick<PoolClient, 'query'>;

export type SerieDocumentoAdminRow = {
  id: number;
  serie: string;
  descripcion: string | null;
  tipo_documento: string;
  tipo_documento_nombre: string | null;
  es_fiscal: boolean;
  activa: boolean;
  ultimo_numero: number;
};

export type SerieDocumentoPayload = {
  serie: string;
  descripcion?: string | null;
  tipo_documento: string;
  es_fiscal: boolean;
  activa?: boolean;
  ultimo_numero?: number;
};

export type AsignacionSerieUsuarioRow = {
  id: number;
  usuario_id: number;
  usuario_nombre: string;
  tipo_documento: string;
  tipo_documento_nombre: string | null;
  serie_documento_id: number;
  serie: string;
  es_fiscal: boolean;
  created_at: string;
};

type AsignacionSeriePayload = {
  usuario_id: number;
  serie_documento_id: number;
  tipo_documento: string;
};

type SerieDocumentoTargetRow = {
  id: number;
  empresa_id: number;
  tipo_documento: string;
  serie: string;
  es_fiscal: boolean;
  activa: boolean;
};

type UsuarioEmpresaTargetRow = {
  id: number;
};

const SELECT_SERIE_BASE = `
  SELECT sd.id,
         sd.serie,
         sd.descripcion,
         sd.tipo_documento,
         td.nombre AS tipo_documento_nombre,
         sd.es_fiscal,
         sd.activa,
         COALESCE(sd.ultimo_numero, 0) AS ultimo_numero
    FROM public.series_documento sd
    LEFT JOIN core.tipos_documento td
      ON LOWER(td.codigo) = LOWER(sd.tipo_documento)
`;

const SELECT_ASIGNACION_BASE = `
  SELECT usd.id,
         usd.usuario_id,
         u.nombre AS usuario_nombre,
         sd.tipo_documento,
         td.nombre AS tipo_documento_nombre,
         sd.id AS serie_documento_id,
         sd.serie,
         sd.es_fiscal,
         usd.created_at
    FROM public.usuarios_series_documento usd
    JOIN public.series_documento sd
      ON sd.id = usd.serie_documento_id
    JOIN core.usuarios u
      ON u.id = usd.usuario_id
    LEFT JOIN core.tipos_documento td
      ON LOWER(td.codigo) = LOWER(sd.tipo_documento)
`;

async function obtenerSerieDocumentoAdminPorId(
  empresaId: number,
  serieId: number,
  client?: QueryExecutor
): Promise<SerieDocumentoAdminRow | null> {
  const executor = client ?? pool;
  const { rows } = await executor.query<SerieDocumentoAdminRow>(
    `${SELECT_SERIE_BASE}
     WHERE sd.empresa_id = $1
       AND sd.id = $2
     LIMIT 1`,
    [empresaId, serieId]
  );
  return rows[0] ?? null;
}

async function obtenerSerieDocumentoTarget(
  empresaId: number,
  serieDocumentoId: number,
  client?: QueryExecutor
): Promise<SerieDocumentoTargetRow | null> {
  const executor = client ?? pool;
  const { rows } = await executor.query<SerieDocumentoTargetRow>(
    `SELECT id, empresa_id, tipo_documento, serie, es_fiscal, activa
       FROM public.series_documento
      WHERE empresa_id = $1
        AND id = $2
      LIMIT 1`,
    [empresaId, serieDocumentoId]
  );
  return rows[0] ?? null;
}

function normalizarTexto(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

async function obtenerUsuarioHabilitadoEnEmpresa(
  empresaId: number,
  usuarioId: number,
  client?: QueryExecutor
): Promise<UsuarioEmpresaTargetRow | null> {
  const executor = client ?? pool;
  const { rows } = await executor.query<UsuarioEmpresaTargetRow>(
    `SELECT u.id
       FROM core.usuarios_empresas ue
       JOIN core.usuarios u ON u.id = ue.usuario_id
      WHERE ue.empresa_id = $1
        AND ue.usuario_id = $2
        AND ue.activo = true
        AND u.activo = true
      LIMIT 1`,
    [empresaId, usuarioId]
  );
  return rows[0] ?? null;
}

async function obtenerAsignacionPorId(
  empresaId: number,
  asignacionId: number,
  client?: QueryExecutor
): Promise<AsignacionSerieUsuarioRow | null> {
  const executor = client ?? pool;
  const { rows } = await executor.query<AsignacionSerieUsuarioRow>(
    `${SELECT_ASIGNACION_BASE}
     WHERE sd.empresa_id = $1
       AND usd.id = $2
     LIMIT 1`,
    [empresaId, asignacionId]
  );
  return rows[0] ?? null;
}

async function reemplazarAsignacionPorUsuarioYTipo(
  empresaId: number,
  usuarioId: number,
  tipoDocumento: string,
  excludeAsignacionId?: number | null,
  client?: QueryExecutor
) {
  const executor = client ?? pool;
  const params: Array<number | string | null> = [empresaId, usuarioId, tipoDocumento];
  let excludeFilter = '';

  if (excludeAsignacionId && Number.isFinite(excludeAsignacionId)) {
    params.push(excludeAsignacionId);
    excludeFilter = `AND usd.id <> $${params.length}`;
  }

  await executor.query(
    `DELETE FROM public.usuarios_series_documento usd
      USING public.series_documento sd
      WHERE usd.serie_documento_id = sd.id
        AND sd.empresa_id = $1
        AND usd.usuario_id = $2
        AND LOWER(sd.tipo_documento) = LOWER($3)
        ${excludeFilter}`,
    params
  );
}

export async function listarSeriesDocumentoAdmin(empresaId: number): Promise<SerieDocumentoAdminRow[]> {
  const { rows } = await pool.query<SerieDocumentoAdminRow>(
    `${SELECT_SERIE_BASE}
     WHERE sd.empresa_id = $1
     ORDER BY sd.tipo_documento ASC, sd.serie ASC`,
    [empresaId]
  );
  return rows;
}

export async function crearSerieDocumentoAdmin(
  empresaId: number,
  payload: SerieDocumentoPayload
): Promise<SerieDocumentoAdminRow> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO public.series_documento (
        empresa_id,
        serie,
        descripcion,
        tipo_documento,
        es_fiscal,
        activa,
        ultimo_numero,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, LOWER($4), $5, $6, 0, NOW(), NOW())
      RETURNING id`,
    [
      empresaId,
      payload.serie,
      payload.descripcion ?? null,
      payload.tipo_documento,
      payload.es_fiscal,
      payload.activa ?? true,
    ]
  );

  const creada = await obtenerSerieDocumentoAdminPorId(empresaId, Number(rows[0]?.id ?? 0));
  if (!creada) {
    throw new Error('No se pudo crear la serie.');
  }
  return creada;
}

export async function actualizarSerieDocumentoAdmin(
  empresaId: number,
  serieId: number,
  payload: SerieDocumentoPayload
): Promise<SerieDocumentoAdminRow | null> {
  const actualizarFolio = payload.ultimo_numero !== undefined && Number.isInteger(payload.ultimo_numero) && payload.ultimo_numero >= 0;

  const sql = actualizarFolio
    ? `UPDATE public.series_documento
          SET serie = $3,
              descripcion = $4,
              tipo_documento = LOWER($5),
              es_fiscal = $6,
              activa = $7,
              ultimo_numero = $8,
              updated_at = NOW()
        WHERE empresa_id = $1
          AND id = $2`
    : `UPDATE public.series_documento
          SET serie = $3,
              descripcion = $4,
              tipo_documento = LOWER($5),
              es_fiscal = $6,
              activa = $7,
              updated_at = NOW()
        WHERE empresa_id = $1
          AND id = $2`;

  const params = actualizarFolio
    ? [empresaId, serieId, payload.serie, payload.descripcion ?? null, payload.tipo_documento, payload.es_fiscal, payload.activa ?? true, payload.ultimo_numero]
    : [empresaId, serieId, payload.serie, payload.descripcion ?? null, payload.tipo_documento, payload.es_fiscal, payload.activa ?? true];

  const { rowCount } = await pool.query(sql, params);

  if (!rowCount) {
    return null;
  }

  return obtenerSerieDocumentoAdminPorId(empresaId, serieId);
}

export async function actualizarActivaSerieDocumento(
  empresaId: number,
  serieId: number,
  activa: boolean
): Promise<SerieDocumentoAdminRow | null> {
  const { rowCount } = await pool.query(
    `UPDATE public.series_documento
        SET activa = $3,
            updated_at = NOW()
      WHERE empresa_id = $1
        AND id = $2`,
    [empresaId, serieId, activa]
  );

  if (!rowCount) {
    return null;
  }

  return obtenerSerieDocumentoAdminPorId(empresaId, serieId);
}

export async function listarAsignacionesSeriesUsuario(empresaId: number): Promise<AsignacionSerieUsuarioRow[]> {
  const { rows } = await pool.query<AsignacionSerieUsuarioRow>(
    `${SELECT_ASIGNACION_BASE}
     WHERE sd.empresa_id = $1
     ORDER BY u.nombre ASC, sd.tipo_documento ASC, sd.serie ASC`,
    [empresaId]
  );
  return rows;
}

export async function crearAsignacionSerieUsuario(
  empresaId: number,
  payload: AsignacionSeriePayload
): Promise<AsignacionSerieUsuarioRow> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const serieTarget = await obtenerSerieDocumentoTarget(empresaId, payload.serie_documento_id, client);
    if (!serieTarget) {
      throw new Error('La serie seleccionada no existe para la empresa activa.');
    }
    if (!serieTarget.activa) {
      throw new Error('Solo se pueden asignar series activas.');
    }
    if (normalizarTexto(payload.tipo_documento) !== normalizarTexto(serieTarget.tipo_documento)) {
      throw new Error('La serie seleccionada no corresponde al tipo de documento indicado.');
    }

    const usuarioTarget = await obtenerUsuarioHabilitadoEnEmpresa(empresaId, payload.usuario_id, client);
    if (!usuarioTarget) {
      throw new Error('El usuario seleccionado no tiene acceso a la empresa activa.');
    }

    await reemplazarAsignacionPorUsuarioYTipo(
      empresaId,
      payload.usuario_id,
      payload.tipo_documento,
      null,
      client
    );

    const insertResult = await client.query<{ id: number }>(
      `INSERT INTO public.usuarios_series_documento (usuario_id, serie_documento_id, created_at)
       VALUES ($1, $2, NOW())
       RETURNING id`,
      [payload.usuario_id, payload.serie_documento_id]
    );

    const creada = await obtenerAsignacionPorId(empresaId, Number(insertResult.rows[0]?.id ?? 0), client);
    if (!creada) {
      throw new Error('No se pudo crear la asignación de serie.');
    }

    await client.query('COMMIT');
    return creada;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function actualizarAsignacionSerieUsuario(
  empresaId: number,
  asignacionId: number,
  payload: AsignacionSeriePayload
): Promise<AsignacionSerieUsuarioRow | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const actual = await obtenerAsignacionPorId(empresaId, asignacionId, client);
    if (!actual) {
      await client.query('ROLLBACK');
      return null;
    }

    const serieTarget = await obtenerSerieDocumentoTarget(empresaId, payload.serie_documento_id, client);
    if (!serieTarget) {
      throw new Error('La serie seleccionada no existe para la empresa activa.');
    }
    if (!serieTarget.activa) {
      throw new Error('Solo se pueden asignar series activas.');
    }
    if (normalizarTexto(payload.tipo_documento) !== normalizarTexto(serieTarget.tipo_documento)) {
      throw new Error('La serie seleccionada no corresponde al tipo de documento indicado.');
    }

    const usuarioTarget = await obtenerUsuarioHabilitadoEnEmpresa(empresaId, payload.usuario_id, client);
    if (!usuarioTarget) {
      throw new Error('El usuario seleccionado no tiene acceso a la empresa activa.');
    }

    await reemplazarAsignacionPorUsuarioYTipo(
      empresaId,
      payload.usuario_id,
      payload.tipo_documento,
      asignacionId,
      client
    );

    await client.query(
      `UPDATE public.usuarios_series_documento
          SET usuario_id = $2,
              serie_documento_id = $3,
              created_at = NOW()
        WHERE id = $1`,
      [asignacionId, payload.usuario_id, payload.serie_documento_id]
    );

    const actualizada = await obtenerAsignacionPorId(empresaId, asignacionId, client);
    if (!actualizada) {
      throw new Error('No se pudo actualizar la asignación de serie.');
    }

    await client.query('COMMIT');
    return actualizada;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function eliminarAsignacionSerieUsuario(empresaId: number, asignacionId: number): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM public.usuarios_series_documento usd
      USING public.series_documento sd
      WHERE usd.serie_documento_id = sd.id
        AND sd.empresa_id = $1
        AND usd.id = $2`,
    [empresaId, asignacionId]
  );

  return (result.rowCount ?? 0) > 0;
}