import type { PoolClient } from 'pg';

export async function recalcularEstadoOrdenCompraPorDependencias(
  ordenCompraId: number,
  empresaId: number,
  client: Pick<PoolClient, 'query'>,
): Promise<'Emitido' | 'Borrador' | null> {
  const { rows } = await client.query<{ tipo_documento: string; estatus_documento: string }>(
    `SELECT tipo_documento, estatus_documento FROM documentos WHERE id = $1 AND empresa_id = $2 LIMIT 1`,
    [ordenCompraId, empresaId],
  );
  if (String(rows[0]?.tipo_documento ?? '').toLowerCase() !== 'orden_compra') return null;
  const { rows: activos } = await client.query<{ existe: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM documentos d WHERE d.empresa_id = $2 AND d.documento_origen_id = $1
        AND LOWER(TRIM(COALESCE(d.tipo_documento, ''))) IN ('recepcion', 'factura_compra')
        AND LOWER(TRIM(COALESCE(d.estatus_documento, ''))) NOT IN ('cancelado', 'cancelada')
       UNION ALL
       SELECT 1 FROM documentos_partidas_vinculos v JOIN documentos d ON d.id = v.documento_destino_id
        WHERE v.documento_origen_id = $1 AND d.empresa_id = $2
          AND LOWER(TRIM(COALESCE(d.tipo_documento, ''))) IN ('recepcion', 'factura_compra')
          AND LOWER(TRIM(COALESCE(d.estatus_documento, ''))) NOT IN ('cancelado', 'cancelada')
     ) AS existe`,
    [ordenCompraId, empresaId],
  );
  const siguiente = activos[0]?.existe ? 'Emitido' : 'Borrador';
  if (String(rows[0].estatus_documento ?? '').toLowerCase() !== siguiente.toLowerCase()) {
    await client.query(`UPDATE documentos SET estatus_documento = $1, fecha_modificacion = NOW() WHERE id = $2 AND empresa_id = $3`, [siguiente, ordenCompraId, empresaId]);
  }
  return siguiente;
}
