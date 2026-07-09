import { apiFetch } from './apiFetch';
import type { RangoCuenta, RangoCuentaNuevoInput, RangoCuentaEdicionInput } from '../types/rangosCuentas';

const BASE = '/api/contabilidad/rangos-cuentas';

export async function fetchRangosCuentas(): Promise<RangoCuenta[]> {
  return apiFetch(BASE);
}

export async function crearRangoCuenta(payload: RangoCuentaNuevoInput): Promise<RangoCuenta> {
  return apiFetch(BASE, {
    method: 'POST',
    body: payload as any,
  });
}

export async function actualizarRangoCuenta(id: number, payload: RangoCuentaEdicionInput): Promise<RangoCuenta> {
  return apiFetch(`${BASE}/${id}`, {
    method: 'PUT',
    body: payload as any,
  });
}

export async function eliminarRangoCuenta(id: number): Promise<void> {
  await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
}
