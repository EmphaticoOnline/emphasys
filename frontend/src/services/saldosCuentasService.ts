import { apiFetch, apiFetchBlob, triggerBlobDownload } from './apiFetch';
import type { AuxiliarCuentaResultado, CuentaSaldoMes, SaldoAnioResultado } from '../types/saldosCuentas';

export async function fetchEjerciciosDisponibles(): Promise<number[]> {
  return apiFetch('/api/contabilidad/ejercicios');
}

export async function fetchSaldosMes(ejercicio: number, periodo: number): Promise<CuentaSaldoMes[]> {
  return apiFetch(`/api/contabilidad/cuentas/saldos-mes?ejercicio=${ejercicio}&periodo=${periodo}`);
}

export async function fetchSaldosAnio(cuentaId: number, ejercicio: number): Promise<SaldoAnioResultado> {
  return apiFetch(`/api/contabilidad/cuentas/${cuentaId}/saldos-anio?ejercicio=${ejercicio}`);
}

export async function fetchAuxiliarCuenta(
  cuentaId: number,
  ejercicio: number,
  periodo: number
): Promise<AuxiliarCuentaResultado> {
  return apiFetch(`/api/contabilidad/cuentas/${cuentaId}/auxiliar?ejercicio=${ejercicio}&periodo=${periodo}`);
}

export async function descargarAuxiliarCuenta(
  cuentaId: number,
  ejercicio: number,
  periodo: number,
  formato: 'pdf' | 'excel'
): Promise<void> {
  const { blob, filename } = await apiFetchBlob(
    `/api/contabilidad/cuentas/${cuentaId}/auxiliar?ejercicio=${ejercicio}&periodo=${periodo}&formato=${formato}`
  );
  triggerBlobDownload(blob, filename);
}
