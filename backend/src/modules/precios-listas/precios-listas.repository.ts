import pool from '../../config/database';
import type { TipoPrecioLista } from '../../shared/constants/precios';

export interface PrecioLista {
  id: number;
  empresa_id: number;
  nombre: string;
  tipo_precio: TipoPrecioLista;
  orden: number | null;
  es_default: boolean;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export type PrecioListaPersistedInput = {
  nombre: string;
  tipo_precio: TipoPrecioLista;
  orden: number | null;
  es_default: boolean;
  activo: boolean;
};

const PRECIO_LISTA_SELECT = `
  SELECT
    id,
    empresa_id,
    nombre,
    tipo_precio,
    orden,
    es_default,
    activo,
    created_at,
    updated_at
  FROM precios_listas
`;

export async function listarPreciosListasRepository(
  empresaId: number,
  incluirInactivas = false
): Promise<PrecioLista[]> {
  const conditions = ['empresa_id = $1'];
  const values: Array<number | boolean> = [empresaId];

  if (!incluirInactivas) {
    conditions.push('activo = true');
  }

  const query = `
    ${PRECIO_LISTA_SELECT}
    WHERE ${conditions.join(' AND ')}
    ORDER BY orden ASC NULLS LAST, nombre ASC
  `;

  const { rows } = await pool.query<PrecioLista>(query, values);
  return rows;
}

export async function obtenerPrecioListaPorIdRepository(id: number, empresaId: number): Promise<PrecioLista | null> {
  const query = `
    ${PRECIO_LISTA_SELECT}
    WHERE id = $1 AND empresa_id = $2
    LIMIT 1
  `;
  const { rows } = await pool.query<PrecioLista>(query, [id, empresaId]);
  return rows[0] ?? null;
}

export async function crearPrecioListaRepository(
  empresaId: number,
  payload: PrecioListaPersistedInput
): Promise<PrecioLista> {
  const query = `
    INSERT INTO precios_listas (
      empresa_id,
      nombre,
      tipo_precio,
      orden,
      es_default,
      activo,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    RETURNING id, empresa_id, nombre, tipo_precio, orden, es_default, activo, created_at, updated_at
  `;

  const { rows } = await pool.query<PrecioLista>(query, [
    empresaId,
    payload.nombre,
    payload.tipo_precio,
    payload.orden,
    payload.es_default,
    payload.activo,
  ]);

  return rows[0];
}

export async function actualizarPrecioListaRepository(
  id: number,
  empresaId: number,
  payload: PrecioListaPersistedInput
): Promise<PrecioLista | null> {
  const query = `
    UPDATE precios_listas
       SET nombre = $1,
           tipo_precio = $2,
           orden = $3,
           es_default = $4,
           activo = $5,
           updated_at = NOW()
         WHERE id = $6 AND empresa_id = $7
         RETURNING id, empresa_id, nombre, tipo_precio, orden, es_default, activo, created_at, updated_at
  `;

  const { rows } = await pool.query<PrecioLista>(query, [
    payload.nombre,
    payload.tipo_precio,
    payload.orden,
    payload.es_default,
    payload.activo,
    id,
    empresaId,
  ]);

  return rows[0] ?? null;
}

export async function desactivarPrecioListaRepository(id: number, empresaId: number): Promise<PrecioLista | null> {
  const query = `
    UPDATE precios_listas
       SET activo = false,
           es_default = false,
           updated_at = NOW()
     WHERE id = $1 AND empresa_id = $2
         RETURNING id, empresa_id, nombre, tipo_precio, orden, es_default, activo, created_at, updated_at
  `;
  const { rows } = await pool.query<PrecioLista>(query, [id, empresaId]);
  return rows[0] ?? null;
}