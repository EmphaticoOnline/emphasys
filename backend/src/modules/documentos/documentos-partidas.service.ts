import pool from '../../config/database';
import { agregarPartidaRepository, reemplazarPartidasRepository, type PartidaInput } from './documentos.repository';
import { calcularImpuestosPartida } from '../impuestos/impuestos.service';

/**
 * Orquesta el flujo de creación de partidas asegurando cálculo de impuestos después de cada cambio.
 */
export async function agregarPartidaService(documentoId: number, data: PartidaInput, empresaId: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const partida = await agregarPartidaRepository(documentoId, data, empresaId, client);
    if (partida?.id) {
      console.log('[impuestos] Calculando impuestos para partida creada (id DB)', partida.id);
      await calcularImpuestosPartida(partida.id, client);
    }
    await client.query('COMMIT');
    return partida;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Reemplaza todas las partidas y recalcula impuestos por cada partida insertada.
 */
export async function reemplazarPartidasService(
  documentoId: number,
  partidas: PartidaInput[],
  empresaId: number
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await reemplazarPartidasRepository(documentoId, partidas, empresaId, client);
    if (Array.isArray(inserted)) {
      for (const partida of inserted) {
        if (partida?.id) {
          console.log('[impuestos] Calculando impuestos para partida reemplazada (id DB)', partida.id);
          await calcularImpuestosPartida(partida.id, client);
        }
      }
    }
    await client.query('COMMIT');
    return inserted;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
