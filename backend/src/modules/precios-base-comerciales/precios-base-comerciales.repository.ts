import type { PoolClient } from 'pg';
import pool from '../../config/database';

export type PrecioBaseInput = { empresaId: number; documentoId: number; partidaId: number; precioBaseComercial: string | number; motivo?: string | null; usuarioId: number };

function normalizarPrecio(value: string | number): string {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,6})?$/.test(text)) throw new Error('VALIDATION_ERROR: el precio base comercial debe ser un numeric no negativo con hasta seis decimales');
  return text;
}

async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export async function obtenerPrecioBaseComercial(empresaId: number, partidaId: number) {
  const { rows } = await pool.query(`SELECT c.*, d.tipo_documento, d.tipo_documento AS documento_tipo, p.numero_partida, p.precio_unitario AS precio_fiscal FROM public.documentos_partidas_condiciones_comerciales c JOIN public.documentos d ON d.id=c.documento_id JOIN public.documentos_partidas p ON p.id=c.partida_id WHERE c.empresa_id=$1 AND c.partida_id=$2`, [empresaId, partidaId]);
  if (!rows[0]) throw new Error('NOT_FOUND: condición comercial no encontrada');
  const historial = await pool.query(`SELECT h.*, u.nombre AS usuario_nombre FROM public.documentos_partidas_condiciones_comerciales_historial h JOIN core.usuarios u ON u.id=h.usuario_id WHERE h.empresa_id=$1 AND h.partida_id=$2 ORDER BY h.fecha_cambio DESC, h.id DESC`, [empresaId, partidaId]);
  return { ...rows[0], historial: historial.rows };
}

export async function establecerPrecioBaseComercial(input: PrecioBaseInput) {
  const precio = normalizarPrecio(input.precioBaseComercial);
  const motivo = input.motivo == null ? null : String(input.motivo).trim();
  if (motivo === '') throw new Error('VALIDATION_ERROR: el motivo no puede estar vacío');
  await transaction(async client => {
    const partida = await client.query(`SELECT p.id, p.documento_id, d.tipo_documento, d.empresa_id FROM public.documentos_partidas p JOIN public.documentos d ON d.id=p.documento_id WHERE p.id=$1 AND p.documento_id=$2 AND d.empresa_id=$3 FOR UPDATE`, [input.partidaId,input.documentoId,input.empresaId]);
    if (!partida.rows[0]) throw new Error('NOT_FOUND: partida no encontrada para el documento y empresa');
    const user = await client.query('SELECT id FROM core.usuarios WHERE id=$1 AND activo=true', [input.usuarioId]);
    if (!user.rows[0]) throw new Error('NOT_FOUND: usuario no encontrado');
    const current = await client.query(`SELECT *, (precio_base_comercial = $3::numeric) AS mismo_precio FROM public.documentos_partidas_condiciones_comerciales WHERE empresa_id=$1 AND partida_id=$2 FOR UPDATE`, [input.empresaId,input.partidaId,precio]);
    const anterior = current.rows[0]?.precio_base_comercial ?? null;
    if (current.rows[0]?.mismo_precio === true) throw new Error('CONFLICT: el precio base comercial no cambió');
    if (anterior !== null && !motivo) throw new Error('VALIDATION_ERROR: el motivo es obligatorio para cambiar el precio base comercial');
    const condicion = current.rows[0] ?? (await client.query(`INSERT INTO public.documentos_partidas_condiciones_comerciales (empresa_id,documento_id,partida_id,precio_base_comercial) VALUES ($1,$2,$3,$4) RETURNING *`, [input.empresaId,input.documentoId,input.partidaId,precio])).rows[0];
    if (current.rows[0]) await client.query(`UPDATE public.documentos_partidas_condiciones_comerciales SET precio_base_comercial=$1,fecha_modificacion=now() WHERE id=$2`, [precio,condicion.id]);
    await client.query(`INSERT INTO public.documentos_partidas_condiciones_comerciales_historial (condicion_id,empresa_id,documento_id,partida_id,precio_base_anterior,precio_base_nuevo,motivo,usuario_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [condicion.id,input.empresaId,input.documentoId,input.partidaId,anterior,precio,motivo,input.usuarioId]);
    const descripcion = anterior === null ? `Estableció precio base comercial en ${precio}.` : `Cambió precio base comercial de ${anterior} a ${precio}. Motivo: ${motivo}`;
    await client.query(`INSERT INTO public.audit_log (empresa_id,usuario_id,modulo,entidad,entidad_id,accion,descripcion,datos_anteriores,datos_nuevos,origen) VALUES ($1,$2,'precios_base_comerciales','documentos_partidas',$3,$4,$5,$6::jsonb,$7::jsonb,'api')`, [input.empresaId,input.usuarioId,String(input.partidaId),anterior === null ? 'establecer_precio_base_comercial' : 'cambiar_precio_base_comercial',descripcion,JSON.stringify(anterior === null ? null : {precio_base_comercial:String(anterior)}),JSON.stringify({precio_base_comercial:precio,motivo})]);
  });
  return obtenerPrecioBaseComercial(input.empresaId, input.partidaId);
}
