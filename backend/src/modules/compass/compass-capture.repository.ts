import type { PoolClient } from 'pg';
import pool from '../../config/database';
import type { CapturaEstado, CompassOwnerScope, ProcesarCapturaInput } from './compass.types';
import { CompassBusinessError, CompassNotFoundError } from './compass-work.repository';

const SELECT = `SELECT id, texto, estado, tipo_destino, destino_id, captured_at, processed_at, created_at, updated_at
  FROM compass.capturas`;

async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function listarCapturas(scope: CompassOwnerScope, estado: CapturaEstado) {
  const { rows } = await pool.query(`${SELECT} WHERE usuario_id=$1 AND estado=$2 ORDER BY captured_at DESC`, [scope.usuarioId, estado]);
  return rows;
}

export async function obtenerCaptura(scope: CompassOwnerScope, id: number, client: PoolClient | null = null, lock = false) {
  const db = client ?? pool;
  const { rows } = await db.query(`${SELECT} WHERE usuario_id=$1 AND id=$2 LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [scope.usuarioId, id]);
  return rows[0] ?? null;
}

export async function crearCaptura(scope: CompassOwnerScope, texto: string) {
  const { rows } = await pool.query<{ id: number }>(`INSERT INTO compass.capturas (empresa_id,usuario_id,texto)
    VALUES ($1,$2,$3) RETURNING id`, [scope.empresaId, scope.usuarioId, texto]);
  return obtenerCaptura(scope, rows[0].id);
}

export async function actualizarEstadoCaptura(scope: CompassOwnerScope, id: number, estado: 'pendiente' | 'descartada') {
  return transaction(async client => {
    const current = await obtenerCaptura(scope, id, client, true);
    if (!current) throw new CompassNotFoundError('Captura no encontrada');
    if (current.estado !== 'pendiente') throw new CompassBusinessError('La Captura ya fue procesada');
    if (estado === 'descartada') await client.query(`UPDATE compass.capturas SET estado='descartada',processed_at=now(),updated_at=now() WHERE usuario_id=$1 AND id=$2`, [scope.usuarioId,id]);
    return obtenerCaptura(scope,id,client);
  });
}

async function requireFrente(client: PoolClient, usuarioId: number, frenteId: number) {
  const { rowCount } = await client.query('SELECT id FROM compass.frentes WHERE usuario_id=$1 AND id=$2 FOR UPDATE', [usuarioId,frenteId]);
  if (!rowCount) throw new CompassNotFoundError('Frente no encontrado');
}

export async function procesarCaptura(scope: CompassOwnerScope, id: number, input: ProcesarCapturaInput) {
  return transaction(async client => {
    const captura = await obtenerCaptura(scope,id,client,true);
    if (!captura) throw new CompassNotFoundError('Captura no encontrada');
    if (captura.estado !== 'pendiente') throw new CompassBusinessError('La Captura ya fue procesada');
    if (input.destino === 'descartar') {
      await client.query(`UPDATE compass.capturas SET estado='descartada',processed_at=now(),updated_at=now() WHERE usuario_id=$1 AND id=$2`,[scope.usuarioId,id]);
      return obtenerCaptura(scope,id,client);
    }
    let destinoId: number;
    if (input.destino === 'tarea') {
      if (input.frente_id) await requireFrente(client,scope.usuarioId,input.frente_id);
      const { rows } = await client.query<{id:number}>(`INSERT INTO compass.tareas (empresa_id,usuario_id,titulo,frente_id)
        VALUES ($1,$2,$3,$4) RETURNING id`,[scope.empresaId,scope.usuarioId,captura.texto,input.frente_id]); destinoId=rows[0].id;
    } else if (input.destino === 'actividad') {
      if (input.frente_id) await requireFrente(client,scope.usuarioId,input.frente_id);
      if (input.tarea_id) {
        const { rows } = await client.query('SELECT frente_id FROM compass.tareas WHERE usuario_id=$1 AND id=$2 FOR UPDATE',[scope.usuarioId,input.tarea_id]);
        if (!rows[0]) throw new CompassNotFoundError('Tarea no encontrada');
        if ((rows[0].frente_id ?? null) !== input.frente_id) throw new CompassBusinessError('El Frente de la Actividad debe coincidir con el de la Tarea');
      }
      const { rows } = await client.query<{id:number}>(`INSERT INTO compass.actividades (empresa_id,usuario_id,titulo,frente_id,tarea_id,inicio_programado,fin_programado)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[scope.empresaId,scope.usuarioId,captura.texto,input.frente_id,input.tarea_id,input.inicio_programado,input.fin_programado]); destinoId=rows[0].id;
    } else if (input.destino === 'frente') {
      const { rows } = await client.query<{id:number}>(`INSERT INTO compass.frentes (empresa_id,usuario_id,nombre,proposito,categoria,estado)
        VALUES ($1,$2,$3,$4,$5,'activo') RETURNING id`,[scope.empresaId,scope.usuarioId,input.nombre,input.proposito,input.categoria]); destinoId=rows[0].id;
    } else if (input.destino === 'idea') {
      if (input.frente_id) await requireFrente(client,scope.usuarioId,input.frente_id);
      const { rows }=await client.query<{id:number}>('INSERT INTO compass.ideas (empresa_id,usuario_id,titulo,frente_id) VALUES ($1,$2,$3,$4) RETURNING id',[scope.empresaId,scope.usuarioId,captura.texto,input.frente_id]);destinoId=rows[0].id;
    } else {
      if (input.frente_id) await requireFrente(client,scope.usuarioId,input.frente_id);
      const { rows }=await client.query<{id:number}>('INSERT INTO compass.decisiones (empresa_id,usuario_id,titulo,descripcion,motivo,fecha_decision,frente_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',[scope.empresaId,scope.usuarioId,captura.texto,input.descripcion,input.motivo,input.fecha_decision,input.frente_id]);destinoId=rows[0].id;
    }
    await client.query(`UPDATE compass.capturas SET estado='procesada',tipo_destino=$3,destino_id=$4,processed_at=now(),updated_at=now()
      WHERE usuario_id=$1 AND id=$2`,[scope.usuarioId,id,input.destino,destinoId]);
    return obtenerCaptura(scope,id,client);
  });
}
