import pool from '../../config/database';
import { agregarPartidaRepository, reemplazarPartidasRepository, type PartidaInput } from './documentos.repository';
import { calcularImpuestosPartida } from '../impuestos/impuestos.service';
import { actualizarTotales } from './documentos.service';

/**
 * Orquesta el flujo de creación de partidas asegurando cálculo de impuestos después de cada cambio.
 */
export async function agregarPartidaService(documentoId: number, data: PartidaInput, empresaId: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const partida = await agregarPartidaRepository(documentoId, data, empresaId, client);
    console.log('[BACK IVA DEBUG] agregarPartidaService partida creada', partida ? { id: partida.id, producto_id: partida.producto_id, subtotal: partida.subtotal_partida, total: partida.total_partida } : null);
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
  console.log('[BACK IVA DEBUG] reemplazarPartidasService inserted', inserted?.map((p) => ({ id: p?.id, producto_id: p?.producto_id, subtotal: p?.subtotal_partida, total: p?.total_partida })));

    // Recuperar tratamiento del documento para decidir el flujo de impuestos
    const { rows: docRows } = await client.query(
      `SELECT tratamiento_impuestos
         FROM documentos
        WHERE id = $1 AND empresa_id = $2
        LIMIT 1`,
      [documentoId, empresaId]
    );
    const tratamiento = (docRows[0]?.tratamiento_impuestos ?? '').toLowerCase();

    if (Array.isArray(inserted) && inserted.length > 0) {
      const partidaIds = inserted.map((p) => p?.id).filter(Boolean) as number[];

      if (tratamiento === 'sin_iva') {
        // Nota de venta: limpiar impuestos y asegurar totales sin impuestos
        if (partidaIds.length) {
          await client.query('DELETE FROM documentos_partidas_impuestos WHERE partida_id = ANY($1)', [partidaIds]);
          await client.query(
            `UPDATE documentos_partidas
                SET total_partida = subtotal_partida
              WHERE id = ANY($1)`,
            [partidaIds]
          );
        }
      } else {
        // Operación estándar (u otro tratamiento con impuestos): recalcular impuestos por partida
        for (const partida of inserted) {
          if (partida?.id) {
            console.log('[impuestos] Calculando impuestos para partida reemplazada (id DB)', partida.id);
            await calcularImpuestosPartida(partida.id, client);
          }
        }
      }
    }

    // Recalcular totales del documento (encabezado) después de ajustar partidas/impuestos
    await actualizarTotales(documentoId, client);

    await client.query('COMMIT');
    return inserted;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
