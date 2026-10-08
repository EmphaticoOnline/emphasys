import pool from '../../config/database';
import { agregarPartidaRepository, obtenerTrazabilidadPartidas, reemplazarPartidasRepository, type PartidaInput } from './documentos.repository';
import { calcularImpuestosPartida } from '../impuestos/impuestos.service';
import { actualizarTotales } from './documentos.service';
import { esFacturaTimbrada } from './factura-timbrada-edicion';
import { assertNotaVentaEditable } from './nota-venta-editabilidad';
import { isTraslado } from './documento-policy.registry';

async function assertTrasladoSinImpuestos(documentoId: number, empresaId: number, data?: PartidaInput | PartidaInput[]): Promise<void> {
  const { rows } = await pool.query<{ tipo_documento: string }>(
    `SELECT tipo_documento FROM documentos WHERE id = $1 AND empresa_id = $2 LIMIT 1`,
    [documentoId, empresaId]
  );
  if (!isTraslado(rows[0]?.tipo_documento)) return;
  const partidas = Array.isArray(data) ? data : data ? [data] : [];
  if (partidas.some((p: any) => Array.isArray(p?.impuestos) && p.impuestos.length > 0)) {
    throw new Error('VALIDATION_ERROR: Un Traslado no puede contener impuestos');
  }
}

async function assertPartidasFacturaTimbrada(documentoId: number, empresaId: number, client: Pick<import('pg').PoolClient, 'query'>): Promise<void> {
  const { rows } = await client.query(
    `SELECT d.tipo_documento, d.estatus_documento,
            EXISTS (SELECT 1 FROM documentos_cfdi dc WHERE dc.documento_id = d.id) AS esta_timbrado
       FROM documentos d WHERE d.id = $1 AND d.empresa_id = $2 LIMIT 1`,
    [documentoId, empresaId]
  );
  if (esFacturaTimbrada(rows[0] ?? {})) {
    throw new Error('VALIDATION_ERROR: Las partidas de una factura timbrada no pueden modificarse.');
  }
}

async function assertProductosFactura(
  tipoDocumento: string | null | undefined,
  partidas: PartidaInput | PartidaInput[],
  empresaId: number,
  client: Pick<import('pg').PoolClient, 'query'>,
): Promise<void> {
  if (String(tipoDocumento ?? '').trim().toLowerCase() !== 'factura') return;

  const lista = Array.isArray(partidas) ? partidas : [partidas];
  const productoIds = [...new Set(
    lista
      .map((partida) => partida.producto_id)
      .filter((id): id is number => id != null),
  )];
  if (!productoIds.length) return;

  const { rows } = await client.query<{ id: number; clave_producto_sat: string | null }>(
    `SELECT id, clave_producto_sat
       FROM public.productos
      WHERE empresa_id = $1
        AND id = ANY($2::int[])`,
    [empresaId, productoIds],
  );
  const productos = new Map(rows.map((row) => [Number(row.id), row]));

  for (const productoId of productoIds) {
    const producto = productos.get(Number(productoId));
    if (!producto) {
      throw new Error(`VALIDATION_ERROR: El producto ${productoId} no existe o no pertenece a la empresa activa.`);
    }
    if (!String(producto.clave_producto_sat ?? '').trim()) {
      throw new Error(`VALIDATION_ERROR: El producto ${productoId} no tiene ClaveProdServ SAT configurada.`);
    }
  }
}

/**
 * Orquesta el flujo de creación de partidas asegurando cálculo de impuestos después de cada cambio.
 */
export async function agregarPartidaService(documentoId: number, data: PartidaInput, empresaId: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assertNotaVentaEditable(documentoId, empresaId, client);
    await assertPartidasFacturaTimbrada(documentoId, empresaId, client);
    await assertTrasladoSinImpuestos(documentoId, empresaId, data);
    const { rows: trasladoRows } = await client.query<{ tipo_documento: string }>(
      `SELECT tipo_documento FROM documentos WHERE id = $1 AND empresa_id = $2 LIMIT 1`, [documentoId, empresaId]
    );
    await assertProductosFactura(trasladoRows[0]?.tipo_documento, data, empresaId, client);
    const partidaData = isTraslado(trasladoRows[0]?.tipo_documento)
      ? { ...data, precio_unitario: 0, descuento: 0, descuento_monto: 0, subtotal_partida: 0, total_partida: 0 }
      : data;
    const partida = await agregarPartidaRepository(documentoId, partidaData, empresaId, client);
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
    await assertNotaVentaEditable(documentoId, empresaId, client);
    await assertPartidasFacturaTimbrada(documentoId, empresaId, client);
    await assertTrasladoSinImpuestos(documentoId, empresaId, partidas);
  const { rows: trasladoRows } = await client.query<{ tipo_documento: string }>(
    `SELECT tipo_documento FROM documentos WHERE id = $1 AND empresa_id = $2 LIMIT 1`, [documentoId, empresaId]
  );
  await assertProductosFactura(trasladoRows[0]?.tipo_documento, partidas, empresaId, client);
  const partidasPersistir = isTraslado(trasladoRows[0]?.tipo_documento)
    ? partidas.map((p) => ({ ...p, precio_unitario: 0, descuento: 0, descuento_monto: 0, subtotal_partida: 0, total_partida: 0 }))
    : partidas;
  const inserted = await reemplazarPartidasRepository(documentoId, partidasPersistir, empresaId, client);
  console.log('[BACK IVA DEBUG] reemplazarPartidasService inserted', inserted?.map((p) => ({ id: p?.id, producto_id: p?.producto_id, subtotal: p?.subtotal_partida, total: p?.total_partida })));

    const { rows: documentoRows } = await client.query<{ tipo_documento: string; estatus_documento: string }>(
      `SELECT tipo_documento, estatus_documento FROM documentos WHERE id = $1 AND empresa_id = $2 LIMIT 1`,
      [documentoId, empresaId],
    );
    const esRecepcionBorrador = String(documentoRows[0]?.tipo_documento ?? '').toLowerCase() === 'recepcion'
      && String(documentoRows[0]?.estatus_documento ?? '').toLowerCase() === 'borrador';
    if (esRecepcionBorrador && Array.isArray(inserted)) {
      for (const partida of inserted) {
        if (partida?.id) await calcularImpuestosPartida(partida.id, client);
      }
      await actualizarTotales(documentoId, client);
      await client.query('COMMIT');
      return inserted;
    }

    // Con trazabilidad activa, reemplazarPartidasRepository solo actualizó la imagen de
    // cada partida in-place (cantidad, precio, descuento e importes quedaron intactos).
    // Recalcular impuestos/totales aquí sería un cambio indirecto sobre datos protegidos,
    // así que se omite por completo.
    const trazabilidadPartidas = await obtenerTrazabilidadPartidas(documentoId, client);
    if (trazabilidadPartidas.activa) {
      await client.query('COMMIT');
      return inserted;
    }

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
