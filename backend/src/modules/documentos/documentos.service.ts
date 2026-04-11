import pool from '../../config/database';
import type { PoolClient } from 'pg';
import type { TipoDocumento } from '../../types/documentos';
import { crearDocumentoRepository } from './documentos.repository';

type DocumentoCrearPayload = Record<string, any> & {
  agente_id?: number | null;
  documento_origen_id?: number | null;
  contacto_principal_id?: number | null;
  usuario_creacion_id?: number | null;
};

/**
 * Asigna agente_id (si no viene en el payload) con las reglas definidas.
 */
async function resolverAgenteId(payload: DocumentoCrearPayload, empresaId: number): Promise<number | null | undefined> {
  let resolved = false;
  let agenteId: number | null | undefined = undefined;

  if (payload.documento_origen_id) {
    const { rows } = await pool.query(
      `SELECT agente_id
         FROM documentos
        WHERE id = $1 AND empresa_id = $2
        LIMIT 1`,
      [payload.documento_origen_id, empresaId]
    );
    if (rows[0]) {
      agenteId = rows[0].agente_id ?? null;
      resolved = true;
    }
  }

  if (!resolved && payload.contacto_principal_id) {
    const { rows } = await pool.query(
      `SELECT vendedor_id
         FROM contactos
        WHERE id = $1 AND empresa_id = $2
        LIMIT 1`,
      [payload.contacto_principal_id, empresaId]
    );
    const vendedorId = rows[0]?.vendedor_id ?? null;
    if (vendedorId !== null) {
      agenteId = vendedorId;
      resolved = true;
    }
  }

  if (!resolved && payload.usuario_creacion_id) {
    const { rows } = await pool.query(
      `SELECT vendedor_contacto_id
         FROM core.usuarios
        WHERE id = $1
        LIMIT 1`,
      [payload.usuario_creacion_id]
    );
    if (rows[0]) {
      agenteId = rows[0].vendedor_contacto_id ?? null;
      resolved = true;
    }
  }

  return resolved ? agenteId ?? null : undefined;
}

/**
 * Crea documentos aplicando reglas de agente_id antes de persistir.
 */
export async function crearDocumentoService(
  payload: DocumentoCrearPayload,
  empresaId: number,
  tipoDocumento: TipoDocumento
) {
  const data = { ...payload };
  if (data.agente_id === undefined) {
    const agenteId = await resolverAgenteId(data, empresaId);
    if (agenteId !== undefined) {
      data.agente_id = agenteId;
    }
  }

  return crearDocumentoRepository(data, empresaId, tipoDocumento);
}

/**
 * Recalcula subtotal, iva y total de un documento a partir de sus partidas.
 * Usa una sola transacción para evitar inconsistencias.
 */
export async function actualizarTotales(documentoId: number, client?: PoolClient): Promise<void> {
  const ownedClient = !client;
  const executor = client ?? (await pool.connect());
  try {
    if (ownedClient) {
      await executor.query('BEGIN');
    }

    const { rows: totalesRows } = await executor.query(
      `SELECT
          COALESCE(SUM(dp.subtotal_partida), 0) AS subtotal,
          COALESCE(SUM(CASE WHEN LOWER(i.tipo) = 'traslado' THEN dpi.monto ELSE 0 END), 0) AS traslados,
          COALESCE(SUM(CASE WHEN LOWER(i.tipo) = 'retencion' THEN dpi.monto ELSE 0 END), 0) AS retenciones
       FROM documentos_partidas dp
       LEFT JOIN documentos_partidas_impuestos dpi ON dpi.partida_id = dp.id
       LEFT JOIN impuestos i ON i.id::text = dpi.impuesto_id
       WHERE dp.documento_id = $1`,
      [documentoId]
    );

    const subtotal = Number(totalesRows[0]?.subtotal ?? 0);
    const traslados = Number(totalesRows[0]?.traslados ?? 0);
    const retenciones = Number(totalesRows[0]?.retenciones ?? 0);
    const iva = traslados;
    const total = subtotal + traslados - retenciones;

    await executor.query(
      `UPDATE documentos
          SET subtotal = $1,
              iva = $2,
              total = $3
        WHERE id = $4`,
      [subtotal, iva, total, documentoId]
    );

    if (ownedClient) {
      await executor.query('COMMIT');
    }
  } catch (error) {
    if (ownedClient) {
      await executor.query('ROLLBACK');
    }
    throw error;
  } finally {
    if (ownedClient) {
      executor.release();
    }
  }
}
