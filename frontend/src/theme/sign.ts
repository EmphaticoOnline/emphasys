import type { EmphasysTokens } from './tokens.ts';

/**
 * Colores de signo que siguen al tema activo (pantallas de tesorería,
 * contabilidad, productos e inventario). Leen hoy los mismos roles que usaban
 * los componentes, así que la apariencia no cambia:
 *
 * - negativo, salida y vencido → `action.destructive`
 * - positivo y entrada → `metric.applied.foreground`
 *
 * Separan el *significado* (signo) del rol de acción destructiva: una marca
 * podrá cambiar el color de "eliminar" sin cambiar el de "saldo negativo".
 * Las familias de signo con valor fijo (MUI) viven en `functional.ts`.
 */
export function amountSignColor(tokens: EmphasysTokens, sign: 'negative' | 'positive'): string {
  return sign === 'negative' ? tokens.action.destructive : tokens.metric.applied.foreground;
}

/** Flujo de salida: retiro de tesorería, salida de inventario. */
export const outflowColor = (tokens: EmphasysTokens): string => tokens.action.destructive;

/** Flujo de entrada: depósito de tesorería, entrada de inventario. */
export const inflowColor = (tokens: EmphasysTokens): string => tokens.metric.applied.foreground;

/** Importe vencido. */
export const overdueColor = (tokens: EmphasysTokens): string => tokens.action.destructive;
