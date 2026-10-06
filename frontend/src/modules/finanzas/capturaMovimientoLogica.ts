import type { FinanzasOperacion, NaturalezaOperacion, TipoMovimiento } from '../../types/finanzas';
import type { OperacionPayload } from '../../services/finanzasService';

export type CampoPendienteCaptura = 'fecha' | 'monto' | 'contacto' | 'concepto' | 'referencia';

export type MetodoCaptura = {
  requiere_referencia?: boolean;
  nombre?: string;
};

export function fechaCivil(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function limpiarMonto(value: string) {
  return value.replace(/[^0-9.]/g, '');
}

const formatoMontoVisible = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatearMontoVisible(value: string) {
  const limpio = limpiarMonto(value);
  if (!limpio || limpio === '.') return '';
  const n = Number(limpio);
  if (!Number.isFinite(n)) return '';
  return formatoMontoVisible.format(n);
}

export function leerMonto(value: string) {
  const limpio = limpiarMonto(value);
  if (!limpio) return 0;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : 0;
}

export type BorradorCaptura = {
  cuentaId: number | null;
  fecha: string;
  salida: string;
  ingreso: string;
  referencia: string;
  contactoId: number | null;
  conceptoId: number | null;
  metodoPagoId: number | null;
  observaciones: string | null;
  naturaleza: NaturalezaOperacion | null | undefined;
  documentoOrigenId: number | null;
  metodo: MetodoCaptura | null | undefined;
};

export type ResultadoCaptura =
  | { ok: true; payload: OperacionPayload }
  | { ok: false; campo: CampoPendienteCaptura; mensaje: string };

/** Regla única de la captura de movimientos generales, en escritorio y en móvil. */
export function validarBorradorCaptura(borrador: BorradorCaptura): ResultadoCaptura {
  const salidaNum = leerMonto(borrador.salida);
  const ingresoNum = leerMonto(borrador.ingreso);
  const naturaleza = borrador.naturaleza ?? 'movimiento_general';
  const general = naturaleza === 'movimiento_general' && borrador.documentoOrigenId == null;
  if (!borrador.cuentaId || !borrador.fecha) {
    return { ok: false, campo: 'fecha', mensaje: 'Indica la fecha.' };
  }
  if (salidaNum <= 0 && ingresoNum <= 0) {
    return { ok: false, campo: 'monto', mensaje: 'Indica un monto mayor que cero en Retiro o en Depósito.' };
  }
  if (salidaNum > 0 && ingresoNum > 0) {
    return { ok: false, campo: 'monto', mensaje: 'Retiro y depósito no pueden capturarse juntos.' };
  }
  if (general && !(borrador.contactoId != null && borrador.contactoId > 0)) {
    return { ok: false, campo: 'contacto', mensaje: 'Selecciona un contacto.' };
  }
  if (general && !(borrador.conceptoId != null && borrador.conceptoId > 0)) {
    return { ok: false, campo: 'concepto', mensaje: 'Selecciona un concepto.' };
  }
  if (borrador.metodo?.requiere_referencia && !borrador.referencia.trim()) {
    return {
      ok: false,
      campo: 'referencia',
      mensaje: `El método "${borrador.metodo.nombre}" requiere una referencia (número de cheque, SPEI, etc.).`,
    };
  }
  const tipo: TipoMovimiento = ingresoNum > 0 ? 'Deposito' : 'Retiro';
  return {
    ok: true,
    payload: {
      cuenta_id: borrador.cuentaId,
      fecha: borrador.fecha,
      tipo_movimiento: tipo,
      naturaleza_operacion: borrador.naturaleza ?? 'movimiento_general',
      documento_origen_id: borrador.documentoOrigenId,
      contacto_id: borrador.contactoId,
      referencia: borrador.referencia.trim() ? borrador.referencia.trim() : null,
      observaciones: borrador.observaciones,
      monto: ingresoNum > 0 ? ingresoNum : salidaNum,
      concepto_id: borrador.conceptoId,
      metodo_pago_id: borrador.metodoPagoId,
    },
  };
}

/** Alta o edición que parte de un movimiento general ya existente: duplicar o mover de cuenta. */
export function validarOperacionGeneral(operacion: FinanzasOperacion, cuentaId = operacion.cuenta_id): ResultadoCaptura {
  const monto = String(Math.abs(Number(operacion.monto) || 0));
  const retiro = operacion.tipo_movimiento === 'Retiro';
  return validarBorradorCaptura({
    cuentaId,
    fecha: String(operacion.fecha).slice(0, 10),
    salida: retiro ? monto : '',
    ingreso: retiro ? '' : monto,
    referencia: operacion.referencia ?? '',
    contactoId: operacion.contacto_id ?? null,
    conceptoId: operacion.concepto_id ?? null,
    metodoPagoId: operacion.metodo_pago_id ?? null,
    observaciones: operacion.observaciones ?? null,
    naturaleza: 'movimiento_general',
    documentoOrigenId: null,
    metodo: null,
  });
}
