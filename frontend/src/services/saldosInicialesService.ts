import { apiFetch } from './apiFetch';
import type { ItemSaldoInicialLote, ResultadoLoteSaldosIniciales, SaldoInicialCuenta } from '../types/saldosIniciales';

const BASE = '/api/contabilidad/e-contabilidad/saldos-iniciales';

export async function fetchSaldosIniciales(ejercicio: number): Promise<SaldoInicialCuenta[]> {
  return apiFetch(`${BASE}?ejercicio=${ejercicio}`);
}

export async function actualizarSaldosInicialesLote(
  ejercicio: number,
  items: ItemSaldoInicialLote[]
): Promise<ResultadoLoteSaldosIniciales> {
  return apiFetch(BASE, {
    method: 'PATCH',
    body: { ejercicio, items } as any,
  });
}
