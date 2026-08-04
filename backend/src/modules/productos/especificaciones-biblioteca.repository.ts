import pool from '../../config/database';
import type { PoolClient } from 'pg';

export const TIPOS_ESPECIFICACION = ['medida', 'material', 'accesorio', 'garantia', 'entrega', 'condicion', 'otro'] as const;
export type TipoEspecificacion = typeof TIPOS_ESPECIFICACION[number];
export type AlcanceEspecificacion = 'global' | 'producto';

export function normalizarContenidoEspecificacion(value: unknown): string {
  if (typeof value !== 'string') throw new Error('VALIDATION_ERROR: El contenido es obligatorio');
  const contenido = value.replace(/<[^>]*>/g, '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!contenido) throw new Error('VALIDATION_ERROR: El contenido es obligatorio');
  if (contenido.length > 1000) throw new Error('VALIDATION_ERROR: El contenido no puede exceder 1000 caracteres');
  return contenido;
}

export function validarTipo(value: unknown): TipoEspecificacion {
  const tipo = String(value ?? 'otro').toLowerCase() as TipoEspecificacion;
  if (!TIPOS_ESPECIFICACION.includes(tipo)) throw new Error('VALIDATION_ERROR: Tipo de especificación inválido');
  return tipo;
}

export async function listarEspecificacionesBiblioteca(empresaId: number, productoId?: number | null, incluirBajas = false) {
  const params: any[] = [empresaId];
  const filtros = ['eb.empresa_id = $1'];
  if (productoId !== undefined) {
    if (productoId === null) {
      filtros.push('eb.producto_id IS NULL');
    } else {
      params.push(productoId);
      filtros.push(`eb.producto_id = $${params.length}`);
    }
  }
  if (!incluirBajas) filtros.push('eb.fecha_baja IS NULL');
  const { rows } = await pool.query(
    `SELECT eb.* FROM public.especificaciones_biblioteca eb
      WHERE ${filtros.join(' AND ')}
      ORDER BY eb.alcance, eb.es_preferida DESC, eb.orden, eb.id`, params);
  return rows;
}

async function validarProducto(empresaId: number, productoId: number, client: PoolClient) {
  const { rowCount } = await client.query('SELECT 1 FROM public.productos WHERE id = $1 AND empresa_id = $2', [productoId, empresaId]);
  if (!rowCount) throw new Error('VALIDATION_ERROR: Producto inválido o perteneciente a otra empresa');
}

export async function crearEspecificacionBiblioteca(empresaId: number, usuarioId: number | null, data: any) {
  const client = await pool.connect();
  try {
    const alcance: AlcanceEspecificacion = data?.alcance === 'producto' ? 'producto' : data?.alcance === 'global' ? 'global' : (() => { throw new Error('VALIDATION_ERROR: Alcance inválido'); })();
    const productoId = alcance === 'producto' ? Number(data.producto_id) : null;
    if (alcance === 'producto' && !Number.isInteger(productoId)) throw new Error('VALIDATION_ERROR: producto_id es obligatorio');
    if (productoId) await validarProducto(empresaId, productoId, client);
    const contenido = normalizarContenidoEspecificacion(data?.contenido);
    const tipo = validarTipo(data?.tipo);
    const orden = Number.isInteger(Number(data?.orden)) && Number(data.orden) >= 0 ? Number(data.orden) : 0;
    const { rows } = await client.query(
      `INSERT INTO public.especificaciones_biblioteca
       (empresa_id, producto_id, alcance, tipo, contenido, orden, es_preferida, usuario_creacion_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [empresaId, productoId, alcance, tipo, contenido, orden, data?.es_preferida === true, usuarioId]);
    return rows[0];
  } finally { client.release(); }
}

export async function actualizarEspecificacionBiblioteca(id: number, empresaId: number, usuarioId: number | null, data: any) {
  const contenido = normalizarContenidoEspecificacion(data?.contenido);
  const tipo = validarTipo(data?.tipo);
  const orden = Number(data?.orden);
  if (!Number.isInteger(orden) || orden < 0) throw new Error('VALIDATION_ERROR: Orden inválido');
  const { rows } = await pool.query(
    `UPDATE public.especificaciones_biblioteca SET contenido=$1, tipo=$2, orden=$3,
       es_preferida=$4, usuario_modificacion_id=$5, fecha_modificacion=now()
     WHERE id=$6 AND empresa_id=$7 RETURNING *`,
    [contenido, tipo, orden, data?.es_preferida === true, usuarioId, id, empresaId]);
  return rows[0] ?? null;
}

export async function reordenarEspecificacionesBiblioteca(empresaId: number, usuarioId: number | null, ids: unknown[]) {
  const normalized = ids.map(Number);
  if (!normalized.length || normalized.some((id) => !Number.isInteger(id)) || new Set(normalized).size !== normalized.length) throw new Error('VALIDATION_ERROR: Orden inválido');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT id, alcance, producto_id FROM public.especificaciones_biblioteca WHERE empresa_id=$1 AND id=ANY($2::bigint[]) FOR UPDATE', [empresaId, normalized]);
    if (rows.length !== normalized.length) throw new Error('VALIDATION_ERROR: Hay especificaciones inválidas o de otra empresa');
    const grupo = `${rows[0].alcance}:${rows[0].producto_id ?? ''}`;
    if (rows.some((r) => `${r.alcance}:${r.producto_id ?? ''}` !== grupo)) throw new Error('VALIDATION_ERROR: Solo se puede reordenar dentro del mismo grupo');
    for (let i = 0; i < normalized.length; i++) await client.query('UPDATE public.especificaciones_biblioteca SET orden=$1, usuario_modificacion_id=$2, fecha_modificacion=now() WHERE id=$3', [i, usuarioId, normalized[i]]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

export async function cambiarBajaEspecificacionBiblioteca(id: number, empresaId: number, usuarioId: number | null, darDeBaja: boolean) {
  const { rows } = await pool.query(
    `UPDATE public.especificaciones_biblioteca SET fecha_baja=$1, usuario_baja_id=$2,
       usuario_modificacion_id=$2, fecha_modificacion=now() WHERE id=$3 AND empresa_id=$4 RETURNING *`,
    [darDeBaja ? new Date() : null, darDeBaja ? usuarioId : null, id, empresaId]);
  return rows[0] ?? null;
}
