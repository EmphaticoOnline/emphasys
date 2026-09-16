import pool from '../../../config/database';

export async function obtenerConfiguracion(empresaId: number) {
  const [empresa, horarios, excepciones] = await Promise.all([
    pool.query('SELECT id, zona_horaria FROM core.empresas WHERE id = $1', [empresaId]),
    pool.query(`SELECT id, dia_semana, hora_inicio, hora_fin, activo FROM core.empresa_horarios_laborales WHERE empresa_id = $1 ORDER BY dia_semana`, [empresaId]),
    pool.query(`SELECT id, fecha, tipo, descripcion, hora_inicio, hora_fin FROM core.empresa_excepciones_laborales WHERE empresa_id = $1 ORDER BY fecha DESC`, [empresaId]),
  ]);
  return { zona_horaria: empresa.rows[0]?.zona_horaria ?? null, horarios: horarios.rows, excepciones: excepciones.rows };
}

export async function actualizarZonaHoraria(empresaId: number, zona: string | null) {
  const { rows } = await pool.query(`UPDATE core.empresas SET zona_horaria = $1 WHERE id = $2 RETURNING id, zona_horaria`, [zona, empresaId]);
  return rows[0];
}

export async function guardarHorario(empresaId: number, dia: number, inicio: string, fin: string, activo: boolean) {
  const { rows } = await pool.query(`INSERT INTO core.empresa_horarios_laborales (empresa_id, dia_semana, hora_inicio, hora_fin, activo) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (empresa_id,dia_semana) DO UPDATE SET hora_inicio=EXCLUDED.hora_inicio, hora_fin=EXCLUDED.hora_fin, activo=EXCLUDED.activo, actualizado_en=now() RETURNING id,dia_semana,hora_inicio,hora_fin,activo`, [empresaId, dia, inicio, fin, activo]);
  return rows[0];
}

export async function guardarHorarios(empresaId: number, horarios: Array<{ dia: number; inicio: string; fin: string; activo: boolean }>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = [];
    for (const horario of horarios) {
      const { rows } = await client.query(`INSERT INTO core.empresa_horarios_laborales (empresa_id, dia_semana, hora_inicio, hora_fin, activo) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (empresa_id,dia_semana) DO UPDATE SET hora_inicio=EXCLUDED.hora_inicio, hora_fin=EXCLUDED.hora_fin, activo=EXCLUDED.activo, actualizado_en=now() RETURNING id,dia_semana,hora_inicio,hora_fin,activo`, [empresaId, horario.dia, horario.inicio, horario.fin, horario.activo]);
      result.push(rows[0]);
    }
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function guardarExcepcion(empresaId: number, data: { fecha: string; tipo: string; descripcion: string | null; hora_inicio: string | null; hora_fin: string | null }) {
  const { rows } = await pool.query(`INSERT INTO core.empresa_excepciones_laborales (empresa_id,fecha,tipo,descripcion,hora_inicio,hora_fin) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (empresa_id,fecha) DO UPDATE SET tipo=EXCLUDED.tipo, descripcion=EXCLUDED.descripcion, hora_inicio=EXCLUDED.hora_inicio, hora_fin=EXCLUDED.hora_fin, actualizado_en=now() RETURNING id,fecha,tipo,descripcion,hora_inicio,hora_fin`, [empresaId, data.fecha, data.tipo, data.descripcion, data.hora_inicio, data.hora_fin]);
  return rows[0];
}

export async function eliminarExcepcion(empresaId: number, id: number) {
  return Boolean((await pool.query('DELETE FROM core.empresa_excepciones_laborales WHERE id=$1 AND empresa_id=$2', [id, empresaId])).rowCount);
}

export async function actualizarExcepcion(empresaId: number, id: number, data: { fecha: string; tipo: string; descripcion: string | null; hora_inicio: string | null; hora_fin: string | null }) {
  const { rows } = await pool.query(`UPDATE core.empresa_excepciones_laborales SET fecha=$1,tipo=$2,descripcion=$3,hora_inicio=$4,hora_fin=$5,actualizado_en=now() WHERE id=$6 AND empresa_id=$7 RETURNING id,fecha,tipo,descripcion,hora_inicio,hora_fin`, [data.fecha, data.tipo, data.descripcion, data.hora_inicio, data.hora_fin, id, empresaId]);
  return rows[0] ?? null;
}
