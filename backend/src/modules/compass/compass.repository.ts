import pool from '../../config/database';
import type { PoolClient } from 'pg';
import type { CompassOwnerScope, FrenteInput, FrentePatch, IntencionSemanalInput } from './compass.types';

const SELECT_FRENTE = `
  SELECT f.id, f.nombre, f.proposito, f.categoria, f.estado,
         i.id AS intencion_id,
         to_char(i.semana_inicio, 'YYYY-MM-DD') AS semana_inicio,
         i.prioridad AS prioridad_semanal,
         i.horas_objetivo::float8 AS horas_objetivo,
         i.expectativa_atencion,
         i.comentario AS intencion_comentario,
         t.id AS siguiente_accion_id,
         t.titulo AS siguiente_accion_titulo
    FROM compass.frentes f
    LEFT JOIN compass.intenciones_semanales i
      ON i.usuario_id = f.usuario_id
     AND i.frente_id = f.id
     AND i.semana_inicio = date_trunc('week', CURRENT_DATE)::date
    LEFT JOIN compass.tareas t
      ON t.usuario_id = f.usuario_id
     AND t.frente_id = f.id
     AND t.es_siguiente_accion = true`;

type FrenteRow = {
  id: number; nombre: string; proposito: string; categoria: string; estado: string;
  intencion_id: number | null; semana_inicio: string | null; prioridad_semanal: string | null;
  horas_objetivo: number | null; expectativa_atencion: string | null; intencion_comentario: string | null;
  siguiente_accion_id: number | null; siguiente_accion_titulo: string | null;
};

function mapFrente(row: FrenteRow) {
  return {
    id: row.id,
    nombre: row.nombre,
    proposito: row.proposito,
    categoria: row.categoria,
    estado: row.estado,
    prioridad_semanal: row.prioridad_semanal,
    horas_objetivo: row.horas_objetivo,
    expectativa_atencion: row.expectativa_atencion,
    siguiente_accion: row.siguiente_accion_id ? { id: row.siguiente_accion_id, titulo: row.siguiente_accion_titulo } : null,
    intencion_semanal: row.intencion_id ? {
      id: row.intencion_id,
      semana_inicio: row.semana_inicio,
      prioridad: row.prioridad_semanal,
      horas_objetivo: row.horas_objetivo,
      expectativa_atencion: row.expectativa_atencion,
      comentario: row.intencion_comentario,
    } : null,
  };
}

export async function listarFrentes(scope: CompassOwnerScope, estados: string[]) {
  const { rows } = await pool.query<FrenteRow>(
    `${SELECT_FRENTE}
      WHERE f.usuario_id = $1 AND f.estado = ANY($2::varchar[])
      ORDER BY CASE i.prioridad WHEN 'alta' THEN 1 WHEN 'media' THEN 2 WHEN 'baja' THEN 3 ELSE 4 END,
               f.nombre ASC`,
    [scope.usuarioId, estados]
  );
  return rows.map(mapFrente);
}

export async function obtenerFrente(scope: CompassOwnerScope, id: number) {
  const { rows } = await pool.query<FrenteRow>(
    `${SELECT_FRENTE} WHERE f.id = $2 AND f.usuario_id = $1 LIMIT 1`,
    [scope.usuarioId, id]
  );
  return rows[0] ? mapFrente(rows[0]) : null;
}

export async function crearFrente(scope: CompassOwnerScope, input: FrenteInput) {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO compass.frentes (empresa_id, usuario_id, nombre, proposito, categoria, estado)
     VALUES ($1, $2, $3, $4, $5, 'activo') RETURNING id`,
    [scope.empresaId, scope.usuarioId, input.nombre, input.proposito, input.categoria]
  );
  return obtenerFrente(scope, rows[0].id);
}

export async function actualizarFrente(scope: CompassOwnerScope, id: number, patch: FrentePatch) {
  const fields: string[] = [];
  const values: unknown[] = [scope.usuarioId, id];
  for (const [column, value] of Object.entries(patch)) {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  }
  const result = await pool.query(
    `UPDATE compass.frentes SET ${fields.join(', ')}, updated_at = now()
      WHERE usuario_id = $1 AND id = $2`,
    values
  );
  return result.rowCount ? obtenerFrente(scope, id) : null;
}

async function upsertIntencionDb(db: Pick<PoolClient,'query'>, scope: CompassOwnerScope, frenteId: number, input: IntencionSemanalInput) {
  const { rows } = await db.query(
    `INSERT INTO compass.intenciones_semanales
       (empresa_id, usuario_id, frente_id, semana_inicio, prioridad, horas_objetivo, expectativa_atencion, comentario)
     SELECT f.empresa_id, $1, f.id, $3::date, $4, $5, $6, $7
       FROM compass.frentes f
      WHERE f.usuario_id = $1 AND f.id = $2
     ON CONFLICT (usuario_id, frente_id, semana_inicio)
     DO UPDATE SET prioridad = EXCLUDED.prioridad,
                   horas_objetivo = EXCLUDED.horas_objetivo,
                   expectativa_atencion = EXCLUDED.expectativa_atencion,
                   comentario = EXCLUDED.comentario,
                   updated_at = now()
     RETURNING id, frente_id, to_char(semana_inicio, 'YYYY-MM-DD') AS semana_inicio,
               prioridad, horas_objetivo::float8 AS horas_objetivo,
               expectativa_atencion, comentario, created_at, updated_at`,
    [scope.usuarioId, frenteId, input.semana_inicio, input.prioridad,
      input.horas_objetivo, input.expectativa_atencion, input.comentario]
  );
  return rows[0] ?? null;
}
export const upsertIntencion=(scope:CompassOwnerScope,frenteId:number,input:IntencionSemanalInput)=>upsertIntencionDb(pool,scope,frenteId,input);
export const upsertIntencionEnTransaccion=(client:PoolClient,scope:CompassOwnerScope,frenteId:number,input:IntencionSemanalInput)=>upsertIntencionDb(client,scope,frenteId,input);
