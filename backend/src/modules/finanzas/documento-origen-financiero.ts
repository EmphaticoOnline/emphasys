import type { TipoDocumento } from '../../types/documentos';

export type NaturalezaOperacionFinanciera = 'cobro_cliente' | 'pago_proveedor' | 'movimiento_general';
export type TipoMovimientoFinanciero = 'Deposito' | 'Retiro';
export type FlujoDocumentoOrigen = 'ventas' | 'compras';

export type ReglaDocumentoOrigenFinanciero = {
  flujo: FlujoDocumentoOrigen;
  tipoMovimiento: TipoMovimientoFinanciero;
  naturaleza: Exclude<NaturalezaOperacionFinanciera, 'movimiento_general'>;
};

const REGLAS_DOCUMENTO_ORIGEN_FINANCIERO: Partial<Record<TipoDocumento, ReglaDocumentoOrigenFinanciero>> = {
  cotizacion: {
    flujo: 'ventas',
    tipoMovimiento: 'Deposito',
    naturaleza: 'cobro_cliente',
  },
  pedido: {
    flujo: 'ventas',
    tipoMovimiento: 'Deposito',
    naturaleza: 'cobro_cliente',
  },
  orden_servicio: {
    flujo: 'ventas',
    tipoMovimiento: 'Deposito',
    naturaleza: 'cobro_cliente',
  },
  orden_compra: {
    flujo: 'compras',
    tipoMovimiento: 'Retiro',
    naturaleza: 'pago_proveedor',
  },
};

function normalizarTipoDocumento(tipoDocumento: string | null | undefined): TipoDocumento | null {
  const normalizado = String(tipoDocumento ?? '').trim().toLowerCase();
  return normalizado ? (normalizado as TipoDocumento) : null;
}

export function obtenerReglaDocumentoOrigenFinanciero(
  tipoDocumento: string | null | undefined
): ReglaDocumentoOrigenFinanciero | null {
  const normalizado = normalizarTipoDocumento(tipoDocumento);
  if (!normalizado) return null;
  return REGLAS_DOCUMENTO_ORIGEN_FINANCIERO[normalizado] ?? null;
}

export function soportaDocumentoOrigenFinanciero(tipoDocumento: string | null | undefined): boolean {
  return obtenerReglaDocumentoOrigenFinanciero(tipoDocumento) !== null;
}