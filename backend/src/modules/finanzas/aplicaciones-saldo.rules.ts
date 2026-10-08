import type { PoolClient } from 'pg';

type QueryExecutor = Pick<PoolClient, 'query'>;

const normalizarEstado = (value: unknown) => String(value ?? '').trim().toLowerCase();
const esCancelado = (value: unknown) => ['cancelado', 'cancelada'].includes(normalizarEstado(value));
const TRATAMIENTOS_IMPUESTOS_VALIDOS = new Set(['normal', 'sin_iva', 'tasa_cero', 'exento']);

export const normalizarTratamientoImpuestos = (value: unknown): string => {
  const normalizado = normalizarEstado(value);
  return TRATAMIENTOS_IMPUESTOS_VALIDOS.has(normalizado) ? normalizado : 'normal';
};

export class AplicacionSaldoValidationError extends Error {
  status = 409;
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AplicacionSaldoValidationError';
    this.code = code;
  }
}

export async function documentoTieneAplicacionesSaldo(
  executor: QueryExecutor,
  documentoId: number,
  empresaId: number,
): Promise<boolean> {
  const result = await executor.query<{ existe: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM aplicaciones_saldo
        WHERE empresa_id = $1
          AND (documento_origen_id = $2 OR documento_destino_id = $2)
     ) AS existe`,
    [empresaId, documentoId],
  );
  return Boolean(result.rows[0]?.existe);
}

export type NotaCreditoAplicacionSnapshot = {
  tipo_documento?: string | null;
  estatus_documento: string | null;
  tratamiento_impuestos: string | null;
  uuid: string | null;
  estado_sat: string | null;
  fecha_cancelacion: string | null;
  cancelacion_estado: string | null;
};

export function evaluarNotaCreditoElegibleParaAplicacion(
  documento: NotaCreditoAplicacionSnapshot | null | undefined,
): { ok: true } | { ok: false; code: string; message: string } {
  if (!documento) {
    return { ok: false, code: 'NC_NO_ENCONTRADA', message: 'La nota de crédito no existe o no es compatible.' };
  }

  const estatus = normalizarEstado(documento.estatus_documento);
  const esNotaCreditoCompra = normalizarEstado(documento.tipo_documento) === 'nota_credito_compra';
  if (esCancelado(estatus)) {
    return { ok: false, code: 'NC_CANCELADA', message: 'Una nota de crédito cancelada no puede aplicar saldo.' };
  }

  if (esNotaCreditoCompra) {
    if (estatus !== 'emitido') {
      return { ok: false, code: 'NC_NO_EMITIDA', message: 'La nota de crédito de compra debe estar emitida antes de aplicar saldo.' };
    }
    return { ok: true };
  }

  if (normalizarEstado(documento.tratamiento_impuestos) === 'sin_iva') {
    if (estatus !== 'emitido') {
      return { ok: false, code: 'NC_NO_EMITIDA', message: 'La nota de crédito debe estar emitida antes de aplicar saldo.' };
    }
    return { ok: true };
  }

  const cfdiCancelado = Boolean(documento.fecha_cancelacion)
    || ['cancelado', 'cancelada'].includes(normalizarEstado(documento.estado_sat))
    || ['cancelada', 'cancelado'].includes(normalizarEstado(documento.cancelacion_estado));
  if (estatus !== 'timbrado' || !documento.uuid || cfdiCancelado) {
    return {
      ok: false,
      code: 'NC_NO_TIMBRADA',
      message: 'La nota de crédito fiscal debe estar timbrada y vigente antes de aplicar saldo.',
    };
  }

  return { ok: true };
}

export async function assertNotaCreditoElegibleParaAplicacion(
  executor: QueryExecutor,
  documentoId: number,
  empresaId: number,
): Promise<void> {
  const result = await executor.query<NotaCreditoAplicacionSnapshot>(
    `SELECT d.tipo_documento,
            d.estatus_documento,
            d.tratamiento_impuestos,
            dc.uuid,
            dc.estado_sat,
            dc.fecha_cancelacion,
            dc.cancelacion_estado
       FROM documentos d
       LEFT JOIN documentos_cfdi dc ON dc.documento_id = d.id
      WHERE d.id = $1
        AND d.empresa_id = $2
        AND d.tipo_documento IN ('nota_credito', 'nota_credito_compra')
      LIMIT 1`,
    [documentoId, empresaId],
  );

  const evaluacion = evaluarNotaCreditoElegibleParaAplicacion(result.rows[0]);
  if (!evaluacion.ok) {
    throw new AplicacionSaldoValidationError(evaluacion.code, evaluacion.message);
  }
}

export function assertTratamientoCompatibleNotaCredito(
  tratamientoOrigen: unknown,
  tratamientoDestino: unknown,
): void {
  const origen = normalizarTratamientoImpuestos(tratamientoOrigen);
  const destino = normalizarTratamientoImpuestos(tratamientoDestino);
  if (origen !== destino) {
    const error = new Error('La Nota de Crédito y la factura destino tienen tratamientos incompatibles.');
    (error as any).status = 409;
    throw error;
  }
}

export async function assertNotaCreditoSinAplicacionesParaBorrador(
  executor: QueryExecutor,
  documentoId: number,
  empresaId: number,
): Promise<void> {
  if (await documentoTieneAplicacionesSaldo(executor, documentoId, empresaId)) {
    throw new Error('VALIDATION_ERROR: La nota de crédito tiene aplicaciones de saldo. Desaplique el saldo antes de regresar el documento a borrador.');
  }
}
