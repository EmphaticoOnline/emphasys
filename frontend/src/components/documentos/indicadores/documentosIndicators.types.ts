import type { DocumentoPolizaRelacionadaDto, EstadoContableFacturaVentaInfo } from '../../../services/facturaVentaContabilizacionService';

export type DocumentoFinancialStatus = 'paid' | 'partial' | 'pending' | 'overdue' | 'suspended' | 'unknown';
export type DocumentoAccountingStatus = 'accounted' | 'pending' | 'not_accountable' | 'unknown';
export type DocumentoCfdiStatus =
  | 'not_stamped'
  | 'stamped'
  | 'cancellation_requested'
  | 'cancellation_pending'
  | 'cancellation_reconciliation'
  | 'cancellation_rejected'
  | 'cancellation_error'
  | 'cancelled'
  | 'unknown'
  | 'not_applicable';
export type DocumentoCfdiCancellationStatus =
  | 'no_solicitada'
  | 'solicitada'
  | 'pendiente'
  | 'cancelada'
  | 'rechazada'
  | 'error'
  | 'requiere_reconciliacion';
export type DocumentoInventoryStatus = 'applied' | 'reversed' | 'warning' | 'inconsistent' | 'not_applicable' | 'will_apply_on_issue';
export type DocumentoInventoryType = 'entrada' | 'salida' | 'transferencia' | 'none';

export interface DocumentoInventarioResumenDto {
  aplica: boolean;
  tipoAfectacion: DocumentoInventoryType;
  tienePartidasInventariables: boolean;
  movimientoOriginalId: number | null;
  movimientoOriginalFecha: string | null;
  movimientoReversionId: number | null;
  movimientoReversionFecha: string | null;
  partidasMovimiento: number;
  movimientosOriginales: number;
  movimientosReversion: number;
}

export interface DocumentoFinancialIndicatorModel {
  status: DocumentoFinancialStatus;
  total?: number | null;
  balance?: number | null;
  paidAmount?: number | null;
  dueDate?: string | null;
  currency?: string | null;
  showShortBalance?: boolean;
  registeredBalance?: number | null;
}

export interface DocumentoAccountingIndicatorModel {
  status: DocumentoAccountingStatus;
  reason?: string | null;
  policies?: DocumentoPolizaRelacionadaDto[];
  primaryPolicyId?: number | null;
}

export interface DocumentoCfdiIndicatorModel {
  status: DocumentoCfdiStatus;
  uuid?: string | null;
  stampedAt?: string | null;
  satStatus?: string | null;
  cancelledAt?: string | null;
  cancellationStatus?: DocumentoCfdiCancellationStatus | null;
  cancellationAttemptId?: number | null;
  cancellationProvider?: string | null;
  cancellationProviderStatus?: string | null;
  cancellationRequestedAt?: string | null;
  cancellationLastCheckedAt?: string | null;
}

export interface DocumentoInventoryIndicatorModel {
  status: DocumentoInventoryStatus;
  type?: DocumentoInventoryType;
  originalMovementId?: number | null;
  originalMovementDate?: string | null;
  reversalMovementId?: number | null;
  reversalMovementDate?: string | null;
  movementItemsCount?: number | null;
  originalMovementsCount?: number;
  reversalMovementsCount?: number;
  reason?: string | null;
}

export interface DocumentoIndicatorModel {
  financial?: DocumentoFinancialIndicatorModel;
  accounting?: DocumentoAccountingIndicatorModel;
  cfdi?: DocumentoCfdiIndicatorModel;
  inventory?: DocumentoInventoryIndicatorModel;
}

export interface FacturaIndicatorSource {
  id: number;
  tipo_documento?: string | null;
  tratamiento_impuestos?: string | null;
  total?: number | null;
  saldo?: number | null;
  saldo_registrado?: number | null;
  saldo_suspendido_cancelacion?: number | null;
  cobro_bloqueado?: boolean;
  moneda?: string | null;
  fecha_vencimiento?: string | null;
  estatus_documento?: string | null;
  cfdi_uuid?: string | null;
  cfdi_fecha_timbrado?: string | null;
  cfdi_estado_sat?: string | null;
  cfdi_fecha_cancelacion?: string | null;
  cfdi_cancelacion_estado?: DocumentoCfdiCancellationStatus | null;
  cfdi_cancelacion_intento_id?: number | null;
  cfdi_cancelacion_proveedor?: string | null;
  cfdi_cancelacion_proveedor_status?: string | null;
  cfdi_cancelacion_fecha_solicitud?: string | null;
  cfdi_cancelacion_fecha_ultima_consulta?: string | null;
  inventario_resumen?: DocumentoInventarioResumenDto | null;
}

export type EstadoContableSource = EstadoContableFacturaVentaInfo | null | undefined;
