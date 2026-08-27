import type { PoolClient } from 'pg';
import pool from '../../config/database';

export type CerrarFullInput = { documentoId: number; partidaId?: number | null; litrosCastigados: string | number; motivo: string; usuarioId: number; empresaId: number };

function litrosEscalados(value: string | number): bigint {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,6})?$/.test(text)) throw new Error('VALIDATION_ERROR: litros_castigados debe ser un numeric no negativo con hasta seis decimales');
  const [entero, decimales = ''] = text.split('.');
  return BigInt(entero) * 1000000n + BigInt(decimales.padEnd(6, '0'));
}

function compararNumeric(a: string | number, b: string | number) { return litrosEscalados(a) <= litrosEscalados(b); }

async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function obtenerEstadoFull(empresaId: number, documentoId: number, client: PoolClient | null = null) {
  const db = client ?? pool;
  const { rows } = await db.query(`SELECT f.*, d.tipo_documento, p.numero_partida,
    p.cantidad AS cantidad_original,
    COALESCE(v.litros_vendidos, 0)::numeric AS litros_vendidos,
    (p.cantidad - COALESCE(v.litros_vendidos, 0))::numeric AS saldo_despues_ventas,
    GREATEST(0, p.cantidad - COALESCE(v.litros_vendidos, 0) - f.litros_castigados)::numeric AS disponibilidad_operativa
    FROM public.operaciones_full f
    JOIN public.documentos d ON d.id=f.documento_id
    LEFT JOIN public.documentos_partidas p ON p.id=f.partida_id
    LEFT JOIN (SELECT documento_origen_id, partida_origen_id, SUM(cantidad) AS litros_vendidos
      FROM public.documentos_partidas_vinculos GROUP BY documento_origen_id, partida_origen_id) v
      ON v.documento_origen_id=f.documento_id AND v.partida_origen_id=f.partida_id
    WHERE f.empresa_id=$1 AND f.documento_id=$2`, [empresaId, documentoId]);
  if (!rows[0]) throw new Error('NOT_FOUND: FULL no encontrado');
  const historial = await db.query(`SELECT * FROM public.operaciones_full_cierres WHERE documento_id=$1 ORDER BY fecha_cierre DESC, id DESC`, [documentoId]);
  return { ...rows[0], historial: historial.rows };
}

export async function cerrarFull(input: CerrarFullInput) {
  const litros = litrosEscalados(input.litrosCastigados);
  const motivo = String(input.motivo ?? '').trim();
  if (!motivo) throw new Error('VALIDATION_ERROR: motivo_cierre es obligatorio');
  await transaction(async client => {
    const doc = await client.query(`SELECT id, tipo_documento, total FROM public.documentos WHERE id=$1 AND empresa_id=$2 FOR UPDATE`, [input.documentoId, input.empresaId]);
    if (!doc.rows[0]) throw new Error('NOT_FOUND: documento no encontrado');
    if (String(doc.rows[0].tipo_documento).toLowerCase() !== 'factura_compra') throw new Error('VALIDATION_ERROR: el documento debe ser factura_compra');
    const user = await client.query('SELECT id FROM core.usuarios WHERE id=$1 AND activo=true', [input.usuarioId]);
    if (!user.rows[0]) throw new Error('NOT_FOUND: usuario no encontrado');
    let partidaId = input.partidaId ?? null;
    if (partidaId !== null) {
      const partida = await client.query(`SELECT p.id, (p.cantidad - COALESCE((SELECT SUM(v.cantidad) FROM public.documentos_partidas_vinculos v WHERE v.documento_origen_id=p.documento_id AND v.partida_origen_id=p.id), 0)) AS disponible FROM public.documentos_partidas p WHERE p.id=$1 AND p.documento_id=$2 FOR UPDATE`, [partidaId, input.documentoId]);
      if (!partida.rows[0]) throw new Error('NOT_FOUND: partida no encontrada para el documento');
      if (!compararNumeric(input.litrosCastigados, partida.rows[0].disponible)) throw new Error('VALIDATION_ERROR: litros_castigados supera la cantidad operativamente disponible');
    } else if (litros > 0n) throw new Error('VALIDATION_ERROR: partida_id es obligatoria cuando hay litros castigados');
    const existing = await client.query(`SELECT id, estado_operativo FROM public.operaciones_full WHERE empresa_id=$1 AND documento_id=$2 FOR UPDATE`, [input.empresaId, input.documentoId]);
    if (existing.rows[0]?.estado_operativo === 'cerrado') throw new Error('CONFLICT: el FULL ya está cerrado');
    const full = existing.rows[0] ?? (await client.query(`INSERT INTO public.operaciones_full (empresa_id,documento_id,partida_id) VALUES ($1,$2,$3) RETURNING id`, [input.empresaId,input.documentoId,partidaId])).rows[0];
    await client.query(`UPDATE public.operaciones_full SET partida_id=$2, estado_operativo='cerrado', litros_castigados=$3, motivo_cierre=$4, fecha_cierre=now(), usuario_cierre_id=$5, fecha_modificacion=now() WHERE id=$1`, [full.id, partidaId, input.litrosCastigados, motivo, input.usuarioId]);
    await client.query(`INSERT INTO public.operaciones_full_cierres (operacion_full_id,documento_id,partida_id,estado_resultante,litros_castigados,motivo,usuario_id) VALUES ($1,$2,$3,'cerrado',$4,$5,$6)`, [full.id,input.documentoId,partidaId,input.litrosCastigados,motivo,input.usuarioId]);
    await client.query(`INSERT INTO public.audit_log (empresa_id,usuario_id,modulo,entidad,entidad_id,accion,descripcion,datos_nuevos,origen) VALUES ($1,$2,'operaciones_full','operaciones_full',$3,'cerrar', $4, $5::jsonb, 'api')`, [input.empresaId,input.usuarioId,input.documentoId,`Cerró FULL con ${String(input.litrosCastigados)} litros castigados. Motivo: ${motivo}`,JSON.stringify({estado_resultante:'cerrado',litros_castigados:String(input.litrosCastigados),motivo})]);
  });
  return obtenerEstadoFull(input.empresaId, input.documentoId);
}
