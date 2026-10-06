import type { FinanzasOperacion } from '../../types/finanzas';
import { movimientoGeneralPendiente } from './FilaCapturaMovimiento';

export function estadoMovimiento(op: { estado_conciliacion?: string | null }) {
  return String(op.estado_conciliacion || 'pendiente').toLowerCase();
}

/** Pendiente y cotejado se alternan. Conciliado pertenece a un cierre y no cambia. */
export function siguienteEstadoCotejo(estado: string | null | undefined): 'pendiente' | 'cotejado' | null {
  const actual = String(estado || 'pendiente').toLowerCase();
  if (actual === 'pendiente') return 'cotejado';
  if (actual === 'cotejado') return 'pendiente';
  return null;
}

export function movimientoEliminable(op: FinanzasOperacion) {
  return op.id > 0 && estadoMovimiento(op) === 'pendiente';
}

/** Copia segura: movimiento general, sin transferencia ni documento. El alta lo deja pendiente. */
export function movimientoDuplicable(op: FinanzasOperacion) {
  if (op.id <= 0 || op.es_transferencia || op.transferencia_id) return false;
  if (op.documento_origen_id || op.factura_id) return false;
  return (op.naturaleza_operacion ?? 'movimiento_general') === 'movimiento_general';
}

/** Misma vía que editar la cuenta de un movimiento general pendiente. */
export function movimientoMovible(op: FinanzasOperacion) {
  return movimientoGeneralPendiente(op);
}

export function todasCumplen(filas: readonly FinanzasOperacion[], prueba: (op: FinanzasOperacion) => boolean) {
  return filas.length > 0 && filas.every(prueba);
}

/** Ingreso suma; salida resta. */
export function netoSeleccion(filas: readonly Pick<FinanzasOperacion, 'tipo_movimiento' | 'monto'>[]) {
  return filas.reduce((suma, op) => {
    const monto = Math.abs(Number(op.monto) || 0);
    return suma + (op.tipo_movimiento === 'Deposito' ? monto : -monto);
  }, 0);
}
