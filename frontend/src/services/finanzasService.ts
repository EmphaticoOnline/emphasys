import { apiFetch } from './apiFetch';
import type { FinanzasCuenta, FinanzasOperacion, TransferenciaPayload, ConciliacionPayload, TipoMovimiento, TransferenciaUpdatePayload } from '../types/finanzas';

const BASE = '/api/finanzas';

export async function fetchCuentas(): Promise<FinanzasCuenta[]> {
  return apiFetch(`${BASE}/cuentas`);
}

export async function crearCuenta(payload: Partial<FinanzasCuenta>): Promise<FinanzasCuenta> {
  return apiFetch(`${BASE}/cuentas`, {
    method: 'POST',
    body: payload as any,
  });
}

export async function actualizarCuenta(id: number, payload: Partial<FinanzasCuenta>): Promise<FinanzasCuenta> {
  return apiFetch(`${BASE}/cuentas/${id}`, {
    method: 'PUT',
    body: payload as any,
  });
}

export async function eliminarCuenta(id: number): Promise<void> {
  await apiFetch(`${BASE}/cuentas/${id}`, { method: 'DELETE' });
}

export async function fetchOperaciones(cuentaId: number): Promise<FinanzasOperacion[]> {
  return apiFetch(`${BASE}/operaciones?cuenta_id=${cuentaId}`);
}

export interface OperacionPayload {
  cuenta_id: number;
  fecha: string;
  tipo_movimiento: TipoMovimiento;
  contacto_id?: number | null;
  referencia?: string | null;
  observaciones?: string | null;
  monto: number;
  concepto_id?: number | null;
}

export async function crearOperacion(payload: OperacionPayload): Promise<FinanzasOperacion> {
  return apiFetch(`${BASE}/operaciones`, {
    method: 'POST',
    body: payload as any,
  });
}

export async function actualizarOperacion(id: number, payload: OperacionPayload): Promise<FinanzasOperacion> {
  return apiFetch(`${BASE}/operaciones/${id}`, {
    method: 'PUT',
    body: payload as any,
  });
}

export async function eliminarOperacion(id: number): Promise<void> {
  await apiFetch(`${BASE}/operaciones/${id}`, { method: 'DELETE' });
}

export async function crearTransferencia(payload: TransferenciaPayload): Promise<any> {
  return apiFetch(`${BASE}/transferencias`, {
    method: 'POST',
    body: payload as any,
  });
}

export async function actualizarTransferencia(id: number, payload: TransferenciaPayload): Promise<any> {
  return apiFetch(`${BASE}/transferencias/${id}`, {
    method: 'PUT',
    body: payload as any,
  });
}

export async function eliminarTransferencia(id: number): Promise<void> {
  await apiFetch(`${BASE}/transferencias/${id}`, { method: 'DELETE' });
}

export async function crearConciliacion(payload: ConciliacionPayload): Promise<any> {
  return apiFetch(`${BASE}/conciliaciones`, {
    method: 'POST',
    body: payload as any,
  });
}
