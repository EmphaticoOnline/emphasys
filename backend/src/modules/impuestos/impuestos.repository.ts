import type { PoolClient, QueryResult } from 'pg';
import pool from '../../config/database';
import type { ImpuestoCatalogo, PartidaConDocumento, TratamientoImpuestos } from './impuestos.types';

function getExecutor(client?: PoolClient) {
  return client ?? pool;
}

export async function obtenerPartidaConDocumento(
  partidaId: number,
  client?: PoolClient
): Promise<PartidaConDocumento | null> {
  const executor = getExecutor(client);
  const query = `
    SELECT
      dp.id              AS "partidaId",
      dp.documento_id    AS "documentoId",
      dp.producto_id     AS "productoId",
      d.empresa_id       AS "empresaId",
      dp.subtotal_partida AS "subtotalPartida",
      d.tratamiento_impuestos AS "tratamientoImpuestos",
      d.estatus_documento     AS "estatusDocumento",
      d.tipo_documento        AS "tipoDocumento"
    FROM documentos_partidas dp
    JOIN documentos d ON d.id = dp.documento_id
    WHERE dp.id = $1
    LIMIT 1
  `;
  const { rows }: QueryResult<PartidaConDocumento> = await executor.query(query, [partidaId]);
  return rows[0] ?? null;
}

export async function eliminarImpuestosDePartida(partidaId: number, client?: PoolClient): Promise<void> {
  const executor = getExecutor(client);
  await executor.query('DELETE FROM documentos_partidas_impuestos WHERE partida_id = $1', [partidaId]);
}

export async function obtenerImpuestosDeProducto(
  productoId: number,
  client?: PoolClient
): Promise<ImpuestoCatalogo[]> {
  const executor = getExecutor(client);
  const query = `
    SELECT i.id, i.nombre, i.tipo, i.tasa
      FROM productos_impuestos pi
      JOIN impuestos i ON i.id = pi.impuesto_id
     WHERE pi.producto_id = $1
       AND i.activo = true
  `;
  const { rows }: QueryResult<ImpuestoCatalogo> = await executor.query(query, [productoId]);
  return rows;
}

export async function obtenerImpuestosDefaultEmpresa(
  empresaId: number,
  client?: PoolClient
): Promise<ImpuestoCatalogo[]> {
  const executor = getExecutor(client);
  const query = `
    SELECT i.id, i.nombre, i.tipo, i.tasa
      FROM core.empresas_impuestos_default eid
      JOIN impuestos i ON i.id = eid.impuesto_id::text
     WHERE eid.empresa_id = $1
       AND i.activo = true
     ORDER BY eid.orden NULLS LAST
  `;
  const { rows }: QueryResult<ImpuestoCatalogo> = await executor.query(query, [empresaId]);
  return rows;
}

export async function obtenerImpuestosPorTratamiento(
  tratamiento: TratamientoImpuestos,
  client?: PoolClient
): Promise<ImpuestoCatalogo[]> {
  const executor = getExecutor(client);
  const query = `
    SELECT i.id, i.nombre, i.tipo, i.tasa
      FROM reglas_tratamiento_impuestos rti
      JOIN impuestos i ON i.id = rti.impuesto_id
     WHERE lower(rti.tratamiento) = lower($1)
       AND i.activo = true
  `;
  const { rows }: QueryResult<ImpuestoCatalogo> = await executor.query(query, [tratamiento]);
  return rows;
}

export async function listarImpuestosCatalogo(client?: PoolClient): Promise<ImpuestoCatalogo[]> {
  const executor = getExecutor(client);
  const query = `
    SELECT i.id, i.nombre, i.tipo, i.tasa
      FROM impuestos i
     WHERE i.activo = true
     ORDER BY i.nombre ASC
  `;
  const { rows }: QueryResult<ImpuestoCatalogo> = await executor.query(query);
  return rows;
}

export type EmpresaImpuestoDefaultRow = {
  id: number;
  empresa_id: number;
  impuesto_id: string;
  orden: number | null;
  impuesto?: ImpuestoCatalogo;
};

export async function listarImpuestosDefaultEmpresa(
  empresaId: number,
  client?: PoolClient
): Promise<EmpresaImpuestoDefaultRow[]> {
  const executor = getExecutor(client);
  const query = `
    SELECT eid.id,
           eid.empresa_id,
           eid.impuesto_id,
           eid.orden,
           i.id       AS "impuesto.id",
           i.nombre   AS "impuesto.nombre",
           i.tipo     AS "impuesto.tipo",
           i.tasa     AS "impuesto.tasa"
      FROM core.empresas_impuestos_default eid
      JOIN impuestos i ON i.id = eid.impuesto_id::text
     WHERE eid.empresa_id = $1
       AND i.activo = true
     ORDER BY eid.orden NULLS LAST, i.nombre ASC
  `;
  const { rows }: QueryResult<any> = await executor.query(query, [empresaId]);
  return rows.map((row) => ({
    id: row.id,
    empresa_id: row.empresa_id,
    impuesto_id: row.impuesto_id,
    orden: row.orden,
    impuesto: {
      id: row['impuesto.id'],
      nombre: row['impuesto.nombre'],
      tipo: row['impuesto.tipo'],
      tasa: Number(row['impuesto.tasa']),
    },
  }));
}

export async function crearImpuestoDefaultEmpresa(
  empresaId: number,
  data: { impuesto_id: string; orden?: number | null },
  client?: PoolClient
): Promise<EmpresaImpuestoDefaultRow> {
  const executor = getExecutor(client);
  const query = `
    INSERT INTO core.empresas_impuestos_default (empresa_id, impuesto_id, orden)
    VALUES ($1, $2, $3)
    RETURNING id, empresa_id, impuesto_id, orden
  `;
  const { rows }: QueryResult<any> = await executor.query(query, [empresaId, data.impuesto_id, data.orden ?? null]);
  const base = rows[0];
  return {
    id: base.id,
    empresa_id: base.empresa_id,
    impuesto_id: base.impuesto_id,
    orden: base.orden,
  };
}

export async function actualizarImpuestoDefaultEmpresa(
  id: number,
  empresaId: number,
  data: { orden?: number | null },
  client?: PoolClient
): Promise<EmpresaImpuestoDefaultRow | null> {
  const executor = getExecutor(client);
  const query = `
    UPDATE core.empresas_impuestos_default
       SET orden = $1
     WHERE id = $2 AND empresa_id = $3
     RETURNING id, empresa_id, impuesto_id, orden
  `;
  const { rows }: QueryResult<any> = await executor.query(query, [data.orden ?? null, id, empresaId]);
  const base = rows[0];
  if (!base) return null;
  return {
    id: base.id,
    empresa_id: base.empresa_id,
    impuesto_id: base.impuesto_id,
    orden: base.orden,
  };
}

export async function eliminarImpuestoDefaultEmpresa(id: number, empresaId: number, client?: PoolClient): Promise<void> {
  const executor = getExecutor(client);
  await executor.query('DELETE FROM core.empresas_impuestos_default WHERE id = $1 AND empresa_id = $2', [id, empresaId]);
}

export async function insertarImpuestosDePartida(
  partidaId: number,
  impuestos: { impuestoId: string; tasa: number; base: number; monto: number }[],
  client?: PoolClient
): Promise<void> {
  if (impuestos.length === 0) return;
  const executor = getExecutor(client);
  const values: any[] = [];
  const placeholders = impuestos
    .map((imp, index) => {
      const offset = index * 5;
      values.push(partidaId, imp.impuestoId, imp.tasa, imp.base, imp.monto);
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
    })
    .join(', ');

  const query = `
    INSERT INTO documentos_partidas_impuestos (partida_id, impuesto_id, tasa, base, monto)
    VALUES ${placeholders}
  `;
  await executor.query(query, values);
}
