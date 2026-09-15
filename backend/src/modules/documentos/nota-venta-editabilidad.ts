import pool from '../../config/database';

export type NotaVentaEditabilidad = {
  esNotaVenta: boolean;
  editable: boolean;
  motivos: string[];
};

type Executor = Pick<typeof pool, 'query'>;

export async function evaluarEditabilidadNotaVenta(documentoId: number, empresaId: number, executor: Executor = pool): Promise<NotaVentaEditabilidad> {
  const { rows } = await executor.query(`
    SELECT d.tipo_documento, d.tratamiento_impuestos, d.estatus_documento,
           d.estado_autorizacion, d.finanzas_operacion_id,
           EXISTS (SELECT 1 FROM inventario.movimientos m WHERE m.documento_id=d.id AND m.empresa_id=d.empresa_id AND m.es_reversion=false
                   AND NOT EXISTS (SELECT 1 FROM inventario.movimientos r WHERE r.documento_id=d.id AND r.empresa_id=d.empresa_id AND r.es_reversion=true)) AS inventario_original,
           EXISTS (SELECT 1 FROM aplicaciones_saldo a WHERE a.empresa_id=d.empresa_id AND (a.documento_origen_id=d.id OR a.documento_destino_id=d.id)) AS aplicaciones,
           EXISTS (SELECT 1 FROM documentos_relaciones r WHERE r.empresa_id=d.empresa_id AND (r.documento_origen_id=d.id OR r.documento_destino_id=d.id) AND r.activa=true) AS derivado_activo,
           EXISTS (SELECT 1 FROM documentos_partidas_vinculos v WHERE v.documento_origen_id=d.id OR v.documento_destino_id=d.id) AS vinculos_partidas,
           EXISTS (SELECT 1 FROM contabilidad.documentos_polizas p WHERE p.empresa_id=d.empresa_id AND p.documento_id=d.id) AS poliza
      FROM documentos d WHERE d.id=$1 AND d.empresa_id=$2 LIMIT 1`, [documentoId, empresaId]);
  const d = rows[0];
  const esNotaVenta = String(d?.tipo_documento ?? '').toLowerCase() === 'factura' && String(d?.tratamiento_impuestos ?? '').toLowerCase() === 'sin_iva';
  if (!d || !esNotaVenta) return { esNotaVenta, editable: true, motivos: [] };
  const motivos: string[] = [];
  if (['cancelado', 'cancelada'].includes(String(d.estatus_documento ?? '').trim().toLowerCase())) motivos.push('documento_cancelado');
  if (String(d.estado_autorizacion ?? '').toLowerCase() === 'aprobada') motivos.push('autorizacion_aprobada');
  if (d.inventario_original) motivos.push('movimiento_inventario');
  if (d.aplicaciones) motivos.push('aplicacion_saldo');
  if (d.finanzas_operacion_id) motivos.push('operacion_financiera');
  if (d.derivado_activo) motivos.push('documento_derivado');
  if (d.vinculos_partidas) motivos.push('vinculos_partidas');
  if (d.poliza) motivos.push('poliza_contable');
  return { esNotaVenta, editable: motivos.length === 0, motivos };
}

export async function assertNotaVentaEditable(documentoId: number, empresaId: number, executor?: Executor): Promise<void> {
  const estado = await evaluarEditabilidadNotaVenta(documentoId, empresaId, executor);
  if (!estado.esNotaVenta || estado.editable) return;
  throw new Error(`VALIDATION_ERROR: La nota de venta no puede modificarse porque tiene: ${estado.motivos.join(', ')}.`);
}
