import type { DocumentoPolizaRelacionadaDto } from '../../../services/facturaVentaContabilizacionService';
import type {
  DocumentoAccountingIndicatorModel,
  DocumentoCfdiIndicatorModel,
  DocumentoFinancialIndicatorModel,
  DocumentoIndicatorModel,
  DocumentoInventoryIndicatorModel,
  EstadoContableSource,
  FacturaIndicatorSource,
} from './documentosIndicators.types';

export const MONETARY_TOLERANCE = 0.005;

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function todayCivilDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeCivilDate(value: unknown): string | null {
  const match = String(value ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export function isDocumentoCancelled(status: unknown): boolean {
  const normalized = normalize(status);
  return normalized === 'cancelado' || normalized === 'cancelada';
}

export function buildFinancialIndicatorModel(source: FacturaIndicatorSource): DocumentoFinancialIndicatorModel | undefined {
  if (isDocumentoCancelled(source.estatus_documento)) return undefined;

  const total = finiteNumber(source.total);
  const balance = finiteNumber(source.saldo);
  if (total == null || balance == null) {
    return { status: 'unknown', total, balance, dueDate: source.fecha_vencimiento ?? null, currency: source.moneda ?? null };
  }

  const normalizedBalance = Math.abs(balance) <= MONETARY_TOLERANCE ? 0 : balance;
  const paidAmount = Math.max(0, total - normalizedBalance);
  const dueDate = normalizeCivilDate(source.fecha_vencimiento);
  const status = normalizedBalance === 0
    ? 'paid'
    : dueDate && dueDate < todayCivilDate()
      ? 'overdue'
    : normalizedBalance < total - MONETARY_TOLERANCE
      ? 'partial'
      : 'pending';

  return {
    status,
    total,
    balance: normalizedBalance,
    paidAmount,
    dueDate,
    currency: source.moneda ?? null,
  };
}

function legacyPolicy(source: NonNullable<EstadoContableSource>): DocumentoPolizaRelacionadaDto[] {
  if (source.poliza_id == null) return [];
  return [{
    contabilizacionId: 0,
    polizaId: source.poliza_id,
    relacion: 'emision',
    eventoContable: 'emision',
    esReversa: false,
    contabilizacionOrigenId: null,
    tipoPolizaId: null,
    tipoPolizaIdentificador: source.tipo_poliza_identificador ?? null,
    tipoPolizaNombre: source.tipo_poliza_identificador ?? null,
    numero: source.poliza_numero ?? null,
    fecha: source.poliza_fecha ?? null,
    estatus: null,
  }];
}

export function buildAccountingIndicatorModel(source: EstadoContableSource): DocumentoAccountingIndicatorModel {
  if (!source) return { status: 'unknown', reason: 'Estado contable no disponible.', policies: [] };
  const policies = source.polizas_relacionadas?.length ? source.polizas_relacionadas : legacyPolicy(source);
  const primary = policies.find((policy) => policy.relacion === 'emision') ?? policies[0];
  if (source.estado === 'contabilizada') {
    return { status: 'accounted', reason: source.motivo, policies, primaryPolicyId: primary?.polizaId ?? source.poliza_id ?? null };
  }
  if (source.estado === 'no_contabilizable') {
    return { status: 'not_accountable', reason: source.motivo, policies };
  }
  return { status: 'pending', reason: source.motivo, policies };
}

export function buildCfdiIndicatorModel(source: FacturaIndicatorSource): DocumentoCfdiIndicatorModel {
  const uuid = String(source.cfdi_uuid ?? '').trim() || null;
  const stampedAt = source.cfdi_fecha_timbrado ?? null;
  const satStatus = String(source.cfdi_estado_sat ?? '').trim() || null;
  const cancelledAt = source.cfdi_fecha_cancelacion ?? null;
  const normalizedSat = normalize(satStatus);

  if (cancelledAt || normalizedSat === 'cancelado' || normalizedSat === 'cancelada') {
    return { status: 'cancelled', uuid, stampedAt, satStatus, cancelledAt };
  }
  if (!uuid && !stampedAt && !satStatus) {
    return { status: 'not_stamped', uuid, stampedAt, satStatus, cancelledAt };
  }
  if (uuid && stampedAt) {
    return { status: 'stamped', uuid, stampedAt, satStatus, cancelledAt };
  }
  return { status: 'unknown', uuid, stampedAt, satStatus, cancelledAt };
}

export function isCfdiApplicable(source: FacturaIndicatorSource): boolean {
  const tipoDocumento = normalize(source.tipo_documento || 'factura');
  if (tipoDocumento !== 'factura' && tipoDocumento !== 'nota_credito') return false;
  return normalize(source.tratamiento_impuestos || 'normal') !== 'sin_iva';
}

export function buildInventoryIndicatorModel(source: FacturaIndicatorSource): DocumentoInventoryIndicatorModel | undefined {
  const summary = source.inventario_resumen;
  if (summary && (!summary.aplica || !summary.tienePartidasInventariables)) {
    return { status: 'not_applicable', type: summary.tipoAfectacion };
  }
  if (!summary) return undefined;

  const documentStatus = normalize(source.estatus_documento);
  const originalCount = Number(summary.movimientosOriginales ?? 0);
  const reversalCount = Number(summary.movimientosReversion ?? 0);
  const itemsCount = Number(summary.partidasMovimiento ?? 0);
  const facts = {
    type: summary.tipoAfectacion,
    originalMovementId: summary.movimientoOriginalId,
    originalMovementDate: summary.movimientoOriginalFecha,
    reversalMovementId: summary.movimientoReversionId,
    reversalMovementDate: summary.movimientoReversionFecha,
    movementItemsCount: itemsCount,
    originalMovementsCount: originalCount,
    reversalMovementsCount: reversalCount,
  };

  if (documentStatus === 'borrador' && originalCount === 0 && reversalCount === 0) {
    return { ...facts, status: 'will_apply_on_issue' };
  }
  if (documentStatus === 'borrador') {
    return { ...facts, status: 'inconsistent', reason: 'El documento está en borrador, pero tiene movimientos de inventario asociados.' };
  }

  if (reversalCount > 0 && originalCount === 0) {
    return { ...facts, status: 'inconsistent', reason: 'Se encontró una reversión sin movimiento original asociado.' };
  }
  if (originalCount > 1 || reversalCount > 1) {
    return { ...facts, status: 'inconsistent', reason: 'Se encontraron múltiples movimientos originales o de reversión.' };
  }
  if (originalCount > 0 && itemsCount <= 0) {
    return { ...facts, status: 'inconsistent', reason: 'El movimiento original no tiene partidas asociadas.' };
  }
  if (originalCount > 0 && reversalCount > 0) {
    return { ...facts, status: 'reversed', reason: 'Revertido por cancelación.' };
  }
  if (originalCount > 0) {
    if (isDocumentoCancelled(source.estatus_documento)) {
      return { ...facts, status: 'inconsistent', reason: 'El documento está cancelado, pero no se encontró el movimiento de reversión.' };
    }
    return { ...facts, status: 'applied' };
  }

  const inventoryIsExpected = ['emitido', 'enviado', 'timbrado', 'cancelado', 'cancelada'].includes(documentStatus);
  if (inventoryIsExpected) {
    return {
      ...facts,
      status: 'warning',
      reason: 'El documento debía afectar inventario, pero no se encontró un movimiento asociado.',
    };
  }

  return undefined;
}

export function buildFacturaIndicatorModel(
  source: FacturaIndicatorSource,
  accountingSource: EstadoContableSource
): DocumentoIndicatorModel {
  return {
    financial: buildFinancialIndicatorModel(source),
    accounting: buildAccountingIndicatorModel(accountingSource),
    cfdi: isCfdiApplicable(source)
      ? buildCfdiIndicatorModel(source)
      : { status: 'not_applicable' },
    inventory: buildInventoryIndicatorModel(source),
  };
}
