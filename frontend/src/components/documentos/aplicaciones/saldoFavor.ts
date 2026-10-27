// La cancelación de saldo a favor se registra como una aplicación del pago o
// de la nota de crédito hacia un documento `ajuste_favor_*`. Así cuadra el
// saldo, pero para el usuario NO es una aplicación: el saldo se canceló. Estas
// utilidades la separan de las aplicaciones reales.
import type { AplicacionOperacion } from '../../../types/finanzas';

const TIPOS_CANCELACION_SALDO_FAVOR = new Set(['ajuste_favor_cliente', 'ajuste_favor_proveedor']);

export function esCancelacionSaldoFavor(aplicacion: Pick<AplicacionOperacion, 'tipo_documento_destino'>): boolean {
  return TIPOS_CANCELACION_SALDO_FAVOR.has(String(aplicacion.tipo_documento_destino ?? '').trim().toLowerCase());
}

/** Separa lo aplicado a facturas de lo cancelado, con el monto cancelado. */
export function separarAplicaciones<T extends AplicacionOperacion>(aplicaciones: T[]) {
  const aplicadas: T[] = [];
  const canceladas: T[] = [];
  aplicaciones.forEach((aplicacion) => (esCancelacionSaldoFavor(aplicacion) ? canceladas : aplicadas).push(aplicacion));
  const montoCancelado = Math.round(
    canceladas.reduce((acc, aplicacion) => acc + Number(aplicacion.monto_moneda_documento ?? aplicacion.monto ?? 0), 0) * 100,
  ) / 100;
  return { aplicadas, canceladas, montoCancelado };
}
