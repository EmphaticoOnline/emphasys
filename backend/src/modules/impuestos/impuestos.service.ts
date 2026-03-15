import pool from '../../config/database';
import type { PoolClient } from 'pg';
import { calcularImpuestosParaSubtotal } from './impuestos.calculador';
import { ImpuestosResolver } from './impuestos.resolver';
import {
  eliminarImpuestosDePartida,
  insertarImpuestosDePartida,
  obtenerPartidaConDocumento,
} from './impuestos.repository';
import type { ImpuestoCalculado } from './impuestos.types';
import { actualizarTotales } from '../documentos/documentos.service';

const resolver = new ImpuestosResolver();

/**
 * Calcula e inserta los impuestos de una partida de documento.
 * Solo requiere el ID de la partida, el servicio se encarga de obtener los datos necesarios.
 */
export async function calcularImpuestosPartida(partidaId: number, client?: PoolClient): Promise<ImpuestoCalculado[]> {
  const ownedClient = !client;
  const executor = client ?? (await pool.connect());

  try {
    if (ownedClient) {
      await executor.query('BEGIN');
    }

    console.log('[impuestos] calcularImpuestosPartida', partidaId);

  const partida = await obtenerPartidaConDocumento(partidaId, executor);
    if (!partida) {
      throw new Error('Partida no encontrada');
    }

    const {
      productoId,
      empresaId,
      subtotalPartida,
      tratamientoImpuestos,
      estatusDocumento,
      documentoId,
      tipoDocumento,
    } = partida;

    console.log('[impuestos] base partida', subtotalPartida);

    const subtotalNumber = parseFloat(subtotalPartida as any);
    if (!Number.isFinite(subtotalNumber)) {
      throw new Error(`Subtotal de partida inválido (NaN). partidaId=${partidaId}, subtotal=${subtotalPartida}`);
    }

    // Si el tratamiento es sin IVA, omitir el resolver y dejar la partida sin impuestos
    if ((tratamientoImpuestos ?? '').toLowerCase() === 'sin_iva') {
      await eliminarImpuestosDePartida(partidaId, executor);

      const ivaMonto = 0;
      const totalPartida = subtotalNumber;
      await executor.query(
        `UPDATE documentos_partidas
            SET iva_monto = $1,
                total_partida = $2
          WHERE id = $3`,
        [ivaMonto, totalPartida, partidaId]
      );

      // Recalcular totales del documento (encabezado)
      await actualizarTotales(documentoId, executor);

      if (ownedClient) {
        await executor.query('COMMIT');
      }
      return [];
    }

    // Validación de estatus del documento
    const estadosBloqueados = ['TIMBRADO', 'CANCELADO', 'CERRADO'];
    if (estadosBloqueados.includes(estatusDocumento?.toUpperCase?.() ?? '')) {
      throw new Error('No se pueden recalcular impuestos en un documento con estatus TIMBRADO/CANCELADO/CERRADO');
    }

    // 1) Limpia impuestos previos
  await eliminarImpuestosDePartida(partidaId, executor);

    // 2) Resuelve impuestos aplicables
    const impuestosAplicables = await resolver.resolverImpuestosAplicables(
      productoId,
      empresaId,
      tratamientoImpuestos,
      executor
    );
    console.log('[impuestos] aplicables', impuestosAplicables);

    // 3) Calcula montos
    const impuestosCalculados = calcularImpuestosParaSubtotal(subtotalNumber, impuestosAplicables);
    console.log('[impuestos] calculados', impuestosCalculados);

    // 3.1) Actualiza totales de la partida (iva_monto y total_partida)
    const traslados = impuestosCalculados
      .filter((imp) => (imp.tipo ?? '').toLowerCase() === 'traslado')
      .reduce((acc, imp) => acc + Number(imp.monto), 0);
    const retenciones = impuestosCalculados
      .filter((imp) => (imp.tipo ?? '').toLowerCase() === 'retencion')
      .reduce((acc, imp) => acc + Number(imp.monto), 0);

    const ivaMonto = traslados; // IVA correspondiente a impuestos de tipo "traslado"
  const totalPartida = subtotalNumber + traslados - retenciones;

    const updateResult = await executor.query(
      `UPDATE documentos_partidas
          SET iva_monto = $1,
              total_partida = $2
        WHERE id = $3`,
      [ivaMonto, totalPartida, partidaId]
    );
    console.log('[impuestos] update resultado', updateResult.rowCount);
    if ((updateResult.rowCount ?? 0) === 0) {
      throw new Error(`No se actualizó la partida ${partidaId} en documentos_partidas`);
    }
    console.log('[impuestos] partida totales actualizados', { partidaId, ivaMonto, totalPartida });

    // 4) Inserta resultados
    await insertarImpuestosDePartida(
      partidaId,
      impuestosCalculados.map((imp) => ({
        impuestoId: imp.impuestoId,
        tasa: imp.tasa,
        base: imp.base,
        monto: imp.monto,
      })),
      executor
    );

    // Recalcular totales sólo para facturas y facturas de compra
    const tiposConTotales = ['factura', 'factura_compra'];
    if (tiposConTotales.includes(tipoDocumento?.toLowerCase?.() ?? '')) {
      await actualizarTotales(documentoId, executor);
    }
    if (ownedClient) {
      await executor.query('COMMIT');
    }
    return impuestosCalculados;
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
