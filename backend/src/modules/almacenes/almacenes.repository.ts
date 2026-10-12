import pool from '../../config/database';
import type { PoolClient } from 'pg';

export interface AlmacenRow {
  id: number;
  empresa_id: number;
  clave: string | null;
  nombre: string;
  tipo: string;
  activo: boolean;
  created_at: string;
  updated_at: string | null;
}

export async function getAlmacenesRepository(empresaId: number, incluirInactivos = false): Promise<AlmacenRow[]> {
  const query = `
    SELECT id, empresa_id, clave, nombre, tipo, activo, created_at, updated_at
      FROM inventario.almacenes
     WHERE empresa_id = $1
       AND ($2 OR activo = true)
     ORDER BY nombre ASC, id ASC
  `;

  const { rows } = await pool.query<AlmacenRow>(query, [empresaId, incluirInactivos]);
  return rows;
}

export async function crearAlmacen(empresaId: number, data: { clave: string; nombre: string; tipo?: string; activo?: boolean }) {
  const { rows } = await pool.query<AlmacenRow>(
    `INSERT INTO inventario.almacenes (empresa_id, clave, nombre, tipo, activo, updated_at)
     VALUES ($1, btrim($2), btrim($3), COALESCE(NULLIF(btrim($4), ''), 'normal'), COALESCE($5, true), now())
     RETURNING id, empresa_id, clave, nombre, tipo, activo, created_at, updated_at`,
    [empresaId, data.clave, data.nombre, data.tipo ?? 'normal', data.activo ?? true]
  );
  return rows[0];
}

const IDENTIFICADOR = /^[a-z_][a-z0-9_]*$/;

function citar(nombre: string): string {
  if (!IDENTIFICADOR.test(nombre)) throw new Error('Identificador de catálogo inválido');
  return `"${nombre}"`;
}

const REFERENCIAS_SIN_LLAVE = [
  { schema: 'inventario', tabla: 'existencias', columna: 'almacen_id', etiqueta: 'existencias' },
  { schema: 'inventario', tabla: 'movimientos_partidas', columna: 'almacen_id', etiqueta: 'movimientos de inventario' },
  { schema: 'inventario', tabla: 'movimientos_partidas', columna: 'almacen_destino_id', etiqueta: 'transferencias de inventario' },
  { schema: 'contabilidad', tabla: 'polizas', columna: 'almacen_id', etiqueta: 'pólizas contables' },
] as const;

const ETIQUETA_LLAVE: Record<string, string> = {
  'public.documentos.almacen_id': 'documentos',
  'public.documentos_partidas.almacen_id': 'partidas de documentos',
  'contabilidad.configuracion_cuentas_contables.almacen_id': 'configuración contable',
  'contabilidad.polizas.almacen_id': 'pólizas contables',
  'inventario.existencias.almacen_id': 'existencias',
  'inventario.movimientos_partidas.almacen_id': 'movimientos de inventario',
  'inventario.movimientos_partidas.almacen_destino_id': 'transferencias de inventario',
};

export class AlmacenConReferenciasError extends Error {
  readonly status = 409;
  constructor(origenes: string[]) {
    super(`No se puede eliminar el almacén porque tiene referencias en ${origenes.join(', ')}.`);
  }
}

async function columnaExiste(client: PoolClient, schema: string, tabla: string, columna: string): Promise<boolean> {
  const { rows } = await client.query<{ ok: number }>(
    `SELECT 1 AS ok
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
      LIMIT 1`,
    [schema, tabla, columna],
  );
  return rows.length > 0;
}

async function contarReferencia(
  client: PoolClient,
  schema: string,
  tabla: string,
  columna: string,
  almacenId: number,
  empresaId: number,
): Promise<number> {
  const tieneEmpresa = await columnaExiste(client, schema, tabla, 'empresa_id');
  const sql = tieneEmpresa
    ? `SELECT count(*)::int AS n FROM ${citar(schema)}.${citar(tabla)} WHERE ${citar(columna)} = $1 AND empresa_id = $2`
    : `SELECT count(*)::int AS n FROM ${citar(schema)}.${citar(tabla)} WHERE ${citar(columna)} = $1`;
  const { rows } = await client.query<{ n: number }>(sql, tieneEmpresa ? [almacenId, empresaId] : [almacenId]);
  return rows[0]?.n ?? 0;
}

export async function eliminarAlmacen(id: number, empresaId: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existente = await client.query(
      `SELECT id FROM inventario.almacenes WHERE id = $1 AND empresa_id = $2 FOR UPDATE`,
      [id, empresaId],
    );
    if (!existente.rows[0]) {
      await client.query('ROLLBACK');
      return false;
    }

    const llaves = await client.query<{ schema: string; tabla: string; columna: string }>(
      `SELECT n.nspname AS schema, c.relname AS tabla, a.attname AS columna
         FROM pg_constraint con
         JOIN pg_class c ON c.oid = con.conrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY (con.conkey) AND NOT a.attisdropped
        WHERE con.contype = 'f'
          AND con.confrelid = 'inventario.almacenes'::regclass`,
    );

    const revisiones = new Map<string, { schema: string; tabla: string; columna: string; etiqueta: string }>();
    for (const llave of llaves.rows) {
      const clave = `${llave.schema}.${llave.tabla}.${llave.columna}`;
      revisiones.set(clave, { ...llave, etiqueta: ETIQUETA_LLAVE[clave] ?? `${llave.tabla}.${llave.columna}` });
    }
    for (const referencia of REFERENCIAS_SIN_LLAVE) {
      const clave = `${referencia.schema}.${referencia.tabla}.${referencia.columna}`;
      if (!revisiones.has(clave) && await columnaExiste(client, referencia.schema, referencia.tabla, referencia.columna)) {
        revisiones.set(clave, referencia);
      }
    }

    const origenes: string[] = [];
    for (const referencia of revisiones.values()) {
      const total = await contarReferencia(client, referencia.schema, referencia.tabla, referencia.columna, id, empresaId);
      if (total > 0) origenes.push(referencia.etiqueta);
    }
    if (origenes.length > 0) throw new AlmacenConReferenciasError(origenes);

    await client.query(`DELETE FROM inventario.almacenes WHERE id = $1 AND empresa_id = $2`, [id, empresaId]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string })?.code === '23503') {
      throw new AlmacenConReferenciasError(['otras dependencias']);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function actualizarAlmacen(id: number, empresaId: number, data: { clave: string; nombre: string; tipo?: string; activo: boolean }) {
  const { rows } = await pool.query<AlmacenRow>(
    `UPDATE inventario.almacenes
        SET clave=btrim($3), nombre=btrim($4), tipo=COALESCE(NULLIF(btrim($5), ''), 'normal'), activo=$6, updated_at=now()
      WHERE id=$1 AND empresa_id=$2
      RETURNING id, empresa_id, clave, nombre, tipo, activo, created_at, updated_at`,
    [id, empresaId, data.clave, data.nombre, data.tipo ?? 'normal', data.activo]
  );
  return rows[0] ?? null;
}
