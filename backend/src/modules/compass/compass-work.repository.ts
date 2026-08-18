import pool from '../../config/database';
import type { PoolClient } from 'pg';
import type { ActividadFilters, ActividadInput, ActividadPatch, CompassOwnerScope, CierreActividadInput, DerivadaActividadInput, TareaFilters, TareaInput, TareaPatch } from './compass.types';

export class CompassNotFoundError extends Error {}
export class CompassBusinessError extends Error {}

const TAREA_SELECT = `SELECT t.id, t.titulo, t.frente_id, f.nombre AS frente_nombre,
  to_char(t.fecha_limite, 'YYYY-MM-DD') AS fecha_limite, t.prioridad_operativa, t.estado,
  t.es_siguiente_accion, t.fecha_finalizacion, t.created_at, t.updated_at
  FROM compass.tareas t LEFT JOIN compass.frentes f ON f.id=t.frente_id AND f.usuario_id=t.usuario_id`;

const ACTIVIDAD_SELECT = `SELECT a.id, a.titulo, a.frente_id, f.nombre AS frente_nombre,
  a.tarea_id, t.titulo AS tarea_titulo, a.actividad_origen_id, a.tipo_origen,
  a.inicio_programado, a.fin_programado, a.estado, a.minutos_efectivos,
  a.resultado, a.fecha_cierre, a.created_at, a.updated_at
  FROM compass.actividades a
  LEFT JOIN compass.frentes f ON f.id=a.frente_id AND f.usuario_id=a.usuario_id
  LEFT JOIN compass.tareas t ON t.id=a.tarea_id AND t.usuario_id=a.usuario_id`;

async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const value = await work(client); await client.query('COMMIT'); return value; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function listarTareas(scope: CompassOwnerScope, filters: TareaFilters) {
  const values: unknown[] = [scope.usuarioId];
  const where = ['t.usuario_id=$1'];
  if (filters.frenteId) { values.push(filters.frenteId); where.push(`t.frente_id=$${values.length}`); }
  if (filters.estado) { values.push(filters.estado); where.push(`t.estado=$${values.length}`); }
  if (filters.pendientes) where.push(`t.estado IN ('pendiente','en_curso')`);
  const { rows } = await pool.query(`${TAREA_SELECT} WHERE ${where.join(' AND ')}
    ORDER BY CASE WHEN t.estado IN ('pendiente','en_curso') AND t.fecha_limite < CURRENT_DATE THEN 0
                  WHEN t.estado IN ('pendiente','en_curso') AND t.fecha_limite IS NOT NULL THEN 1
                  WHEN t.estado IN ('pendiente','en_curso') THEN 2 ELSE 3 END,
             t.fecha_limite ASC NULLS LAST, t.created_at DESC`, values);
  return rows;
}

export async function obtenerTarea(scope: CompassOwnerScope, id: number, client: PoolClient | null = null) {
  const db = client ?? pool;
  const { rows } = await db.query(`${TAREA_SELECT} WHERE t.usuario_id=$1 AND t.id=$2 LIMIT 1`, [scope.usuarioId, id]);
  return rows[0] ?? null;
}

async function lockFrente(client: PoolClient, scope: CompassOwnerScope, frenteId: number) {
  const { rows } = await client.query('SELECT id FROM compass.frentes WHERE usuario_id=$1 AND id=$2 FOR UPDATE', [scope.usuarioId, frenteId]);
  if (!rows[0]) throw new CompassNotFoundError('Frente no encontrado');
}

export async function crearTarea(scope: CompassOwnerScope, input: TareaInput) {
  return transaction(async (client) => {
    if (input.frente_id) await lockFrente(client, scope, input.frente_id);
    if (input.es_siguiente_accion) await client.query('UPDATE compass.tareas SET es_siguiente_accion=false, updated_at=now() WHERE usuario_id=$1 AND frente_id=$2 AND es_siguiente_accion=true', [scope.usuarioId, input.frente_id]);
    const { rows } = await client.query<{ id: number }>(`INSERT INTO compass.tareas
      (empresa_id,usuario_id,titulo,frente_id,fecha_limite,prioridad_operativa,es_siguiente_accion)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [scope.empresaId,scope.usuarioId,input.titulo,input.frente_id,input.fecha_limite,input.prioridad_operativa,input.es_siguiente_accion]);
    return obtenerTarea(scope, rows[0].id, client);
  });
}

export async function actualizarTarea(scope: CompassOwnerScope, id: number, patch: TareaPatch) {
  return transaction(async (client) => {
    const current = await obtenerTarea(scope, id, client); if (!current) throw new CompassNotFoundError('Tarea no encontrada');
    const frenteId = Object.prototype.hasOwnProperty.call(patch, 'frente_id') ? patch.frente_id ?? null : current.frente_id;
    const next = Object.prototype.hasOwnProperty.call(patch, 'es_siguiente_accion') ? patch.es_siguiente_accion : current.es_siguiente_accion;
    if (next && !frenteId) throw new CompassBusinessError('Una siguiente acción debe pertenecer a un Frente');
    if (frenteId) await lockFrente(client, scope, frenteId);
    if (next) await client.query('UPDATE compass.tareas SET es_siguiente_accion=false, updated_at=now() WHERE usuario_id=$1 AND frente_id=$2 AND id<>$3 AND es_siguiente_accion=true', [scope.usuarioId,frenteId,id]);
    const fields: string[] = []; const values: unknown[] = [scope.usuarioId,id];
    for (const [key,value] of Object.entries(patch)) { values.push(value); fields.push(`${key}=$${values.length}`); }
    if (patch.estado === 'completada') fields.push('fecha_finalizacion=COALESCE(fecha_finalizacion,now())');
    else if (patch.estado != null) fields.push('fecha_finalizacion=NULL');
    if (patch.estado === 'completada' || patch.estado === 'cancelada') fields.push('es_siguiente_accion=false');
    await client.query(`UPDATE compass.tareas SET ${fields.join(',')}, updated_at=now() WHERE usuario_id=$1 AND id=$2`, values);
    return obtenerTarea(scope,id,client);
  });
}

export async function listarActividades(scope: CompassOwnerScope, filters: ActividadFilters) {
  const values: unknown[] = [scope.usuarioId]; const where = ['a.usuario_id=$1'];
  for (const [value, clause] of [[filters.fechaInicio,'a.inicio_programado >='],[filters.fechaFin,'a.inicio_programado <'],[filters.frenteId,'a.frente_id='],[filters.tareaId,'a.tarea_id='],[filters.estado,'a.estado=']] as const) {
    if (value != null) { values.push(value); where.push(`${clause}$${values.length}`); }
  }
  const { rows } = await pool.query(`${ACTIVIDAD_SELECT} WHERE ${where.join(' AND ')} ORDER BY a.inicio_programado ASC`, values); return rows;
}

export async function obtenerActividad(scope: CompassOwnerScope, id: number, client: PoolClient | null = null, lock = false) {
  const db = client ?? pool; const { rows } = await db.query(`${ACTIVIDAD_SELECT} WHERE a.usuario_id=$1 AND a.id=$2 LIMIT 1${lock ? ' FOR UPDATE OF a' : ''}`, [scope.usuarioId,id]); return rows[0] ?? null;
}

async function validateLinks(client: PoolClient, scope: CompassOwnerScope, frenteId: number | null, tareaId: number | null) {
  if (frenteId) await lockFrente(client,scope,frenteId);
  if (!tareaId) return;
  const task = await obtenerTarea(scope,tareaId,client); if (!task) throw new CompassNotFoundError('Tarea no encontrada');
  if ((task.frente_id ?? null) !== frenteId) throw new CompassBusinessError('El Frente de la Actividad debe coincidir con el de la Tarea');
}

async function insertActividad(client: PoolClient, scope: CompassOwnerScope, input: ActividadInput, originId: number | null = null, originType: string | null = null) {
  const { rows } = await client.query<{id:number}>(`INSERT INTO compass.actividades
    (empresa_id,usuario_id,frente_id,tarea_id,actividad_origen_id,tipo_origen,titulo,inicio_programado,fin_programado)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,[scope.empresaId,scope.usuarioId,input.frente_id,input.tarea_id,originId,originType,input.titulo,input.inicio_programado,input.fin_programado]);
  return obtenerActividad(scope,rows[0].id,client);
}

export async function crearActividad(scope: CompassOwnerScope, input: ActividadInput) { return transaction(async client => { await validateLinks(client,scope,input.frente_id,input.tarea_id); return insertActividad(client,scope,input); }); }

export async function actualizarActividad(scope: CompassOwnerScope, id: number, patch: ActividadPatch) {
  return transaction(async client => { const current=await obtenerActividad(scope,id,client,true); if(!current) throw new CompassNotFoundError('Actividad no encontrada'); if(current.estado!=='programada') throw new CompassBusinessError('Sólo una Actividad programada puede modificarse');
    const merged={...current,...patch}; if(Date.parse(merged.fin_programado)<=Date.parse(merged.inicio_programado)) throw new CompassBusinessError('fin_programado debe ser posterior a inicio_programado'); await validateLinks(client,scope,merged.frente_id,merged.tarea_id);
    const fields:string[]=[]; const values:unknown[]=[scope.usuarioId,id]; for(const [key,value] of Object.entries(patch)){values.push(value);fields.push(`${key}=$${values.length}`);} await client.query(`UPDATE compass.actividades SET ${fields.join(',')},updated_at=now() WHERE usuario_id=$1 AND id=$2`,values); return obtenerActividad(scope,id,client); });
}

export async function cerrarActividad(scope: CompassOwnerScope,id:number,input:CierreActividadInput){return transaction(async client=>{const current=await obtenerActividad(scope,id,client,true);if(!current)throw new CompassNotFoundError('Actividad no encontrada');if(current.estado!=='programada')throw new CompassBusinessError('La Actividad ya está cerrada');await client.query(`UPDATE compass.actividades SET estado=$3,minutos_efectivos=$4,resultado=$5,fecha_cierre=now(),updated_at=now() WHERE usuario_id=$1 AND id=$2`,[scope.usuarioId,id,input.estado,input.minutos_efectivos,input.resultado]);return obtenerActividad(scope,id,client);});}

async function derive(scope:CompassOwnerScope,id:number,input:DerivadaActividadInput,type:'reprogramacion'|'continuacion'){return transaction(async client=>{const original=await obtenerActividad(scope,id,client,true);if(!original)throw new CompassNotFoundError('Actividad no encontrada');if(type==='reprogramacion'&&original.estado!=='programada')throw new CompassBusinessError('Sólo una Actividad programada puede reprogramarse');if(type==='reprogramacion')await client.query(`UPDATE compass.actividades SET estado='cancelada',fecha_cierre=now(),updated_at=now() WHERE usuario_id=$1 AND id=$2`,[scope.usuarioId,id]);return insertActividad(client,scope,{titulo:input.titulo??original.titulo,frente_id:original.frente_id,tarea_id:original.tarea_id,inicio_programado:input.nuevo_inicio,fin_programado:input.nuevo_fin},id,type);});}
export const reprogramarActividad=(scope:CompassOwnerScope,id:number,input:DerivadaActividadInput)=>derive(scope,id,input,'reprogramacion');
export const continuarActividad=(scope:CompassOwnerScope,id:number,input:DerivadaActividadInput)=>derive(scope,id,input,'continuacion');
