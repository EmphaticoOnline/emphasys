import pool from '../../config/database';
import type { PoolClient } from 'pg';

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
          COALESCE(SUM(subtotal_partida), 0) AS subtotal,
          COALESCE(SUM(iva_monto), 0) AS iva,
          COALESCE(SUM(total_partida), 0) AS total
       FROM documentos_partidas
       WHERE documento_id = $1`,
      [documentoId]
    );

    const totales = totalesRows[0] || { subtotal: 0, iva: 0, total: 0 };

    await executor.query(
      `UPDATE documentos
          SET subtotal = $1,
              iva = $2,
              total = $3
        WHERE id = $4`,
      [Number(totales.subtotal), Number(totales.iva), Number(totales.total), documentoId]
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
