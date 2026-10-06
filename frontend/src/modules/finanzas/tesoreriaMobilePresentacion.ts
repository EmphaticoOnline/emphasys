import type { FinanzasCuenta, FinanzasOperacion } from '../../types/finanzas';
import { referenciaCapturada } from './origenMovimiento';
import { etiquetaContraparteTransferencia } from './transferenciaLogica';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatearMoneda(monto: number, moneda: string): string {
  const codigo = /^[A-Z]{3}$/.test(moneda) ? moneda : 'MXN';
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: codigo }).format(monto);
  } catch {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto);
  }
}

export function totalesDisponibles(cuentas: FinanzasCuenta[]): { moneda: string; total: number }[] {
  const map = new Map<string, number>();
  for (const cuenta of cuentas) {
    if (cuenta.cuenta_cerrada || cuenta.afecta_total_disponible === false) continue;
    const moneda = cuenta.moneda || 'MXN';
    map.set(moneda, (map.get(moneda) || 0) + (Number(cuenta.saldo) || 0));
  }
  return [...map.entries()].map(([moneda, total]) => ({ moneda, total }));
}

export function detalleCuenta(cuenta: FinanzasCuenta): string {
  const numero = cuenta.numero_cuenta?.replace(/\s/g, '') || '';
  const terminacion = numero.length >= 4 ? `··${numero.slice(-4)}` : '';
  return [
    cuenta.moneda || 'MXN',
    cuenta.tipo_cuenta,
    terminacion,
    cuenta.cuenta_cerrada ? 'Cerrada' : '',
  ].filter(Boolean).join(' · ');
}

function claveFecha(fecha: string | null | undefined): string {
  const match = String(fecha ?? '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? '';
}

function claveDia(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export function etiquetaGrupoFecha(clave: string, hoy = new Date()): string {
  if (!clave || clave === 'sin-fecha') return 'SIN FECHA';
  if (clave === claveDia(hoy)) return 'HOY';
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
  if (clave === claveDia(ayer)) return 'AYER';
  const [anio, mes, dia] = clave.split('-').map(Number);
  const texto = `${dia} ${MESES[(mes || 1) - 1] || ''}`.trim();
  if (anio === hoy.getFullYear()) return texto.toUpperCase();
  return `${texto} ${anio}`.toUpperCase();
}

export type GrupoMovimientos = {
  clave: string;
  etiqueta: string;
  operaciones: FinanzasOperacion[];
};

export function agruparMovimientos(operaciones: FinanzasOperacion[], hoy = new Date()): GrupoMovimientos[] {
  const ordenadas = [...operaciones].sort((a, b) => {
    const fecha = claveFecha(b.fecha).localeCompare(claveFecha(a.fecha));
    if (fecha !== 0) return fecha;
    return b.id - a.id;
  });
  const grupos: GrupoMovimientos[] = [];
  for (const operacion of ordenadas) {
    const clave = claveFecha(operacion.fecha) || 'sin-fecha';
    const ultimo = grupos[grupos.length - 1];
    if (!ultimo || ultimo.clave !== clave) {
      grupos.push({ clave, etiqueta: etiquetaGrupoFecha(clave, hoy), operaciones: [operacion] });
    } else {
      ultimo.operaciones.push(operacion);
    }
  }
  return grupos;
}

export function lineasMovimiento(op: FinanzasOperacion): { principal: string; concepto: string; nota: string } {
  const contacto = op.contacto_nombre?.trim() || '';
  const concepto = op.concepto_nombre?.trim() || '';
  const referencia = referenciaCapturada(op);
  const ruta = op.es_transferencia && (op.transferencia_origen_nombre || op.transferencia_destino_nombre)
    ? `${op.transferencia_origen_nombre || 'Origen'} → ${op.transferencia_destino_nombre || 'Destino'}`
    : '';

  if (op.es_transferencia) {
    return {
      principal: etiquetaContraparteTransferencia(op) || ruta || 'Transferencia',
      concepto: 'Transferencia',
      nota: referencia,
    };
  }
  if (contacto) return { principal: contacto, concepto, nota: concepto ? '' : referencia };
  if (concepto) return { principal: concepto, concepto: '', nota: referencia };
  return { principal: referencia || 'Movimiento', concepto: '', nota: '' };
}

export function importeMovimiento(op: FinanzasOperacion, moneda: string): { texto: string; retiro: boolean } {
  const monto = Math.abs(Number(op.monto) || 0);
  const texto = formatearMoneda(monto, moneda);
  const retiro = op.tipo_movimiento === 'Retiro';
  return { texto: retiro ? `-${texto}` : texto, retiro };
}
