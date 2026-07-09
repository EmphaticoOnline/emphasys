import { apiFetch } from './apiFetch';
import type {
  PolizaEncabezado,
  PolizaMovimiento,
  PolizaConMovimientos,
  PolizaEncabezadoInput,
  SiguienteNumeroResultado,
  ResultadoLotePoliza,
  ResumenLotePolizas,
} from '../types/polizas';

const BASE = '/api/contabilidad/polizas';

export async function fetchPolizas(ejercicio: number, periodo: number, buscar?: string): Promise<PolizaEncabezado[]> {
  const params = new URLSearchParams({ ejercicio: String(ejercicio), periodo: String(periodo) });
  if (buscar?.trim()) params.set('buscar', buscar.trim());
  return apiFetch(`${BASE}?${params.toString()}`);
}

export async function fetchMovimientosPoliza(polizaId: number): Promise<PolizaMovimiento[]> {
  return apiFetch(`${BASE}/${polizaId}/movimientos`);
}

export async function fetchPoliza(polizaId: number): Promise<PolizaConMovimientos> {
  return apiFetch(`${BASE}/${polizaId}`);
}

export async function fetchSiguienteNumero(tipoPolizaId: number, fecha: string): Promise<SiguienteNumeroResultado> {
  const params = new URLSearchParams({ tipo_poliza_id: String(tipoPolizaId), fecha });
  return apiFetch(`${BASE}/siguiente-numero?${params.toString()}`);
}

export async function crearPoliza(payload: PolizaEncabezadoInput): Promise<PolizaEncabezado> {
  return apiFetch(BASE, {
    method: 'POST',
    body: payload as any,
  });
}

export async function actualizarPoliza(id: number, payload: PolizaEncabezadoInput): Promise<PolizaEncabezado> {
  return apiFetch(`${BASE}/${id}`, {
    method: 'PUT',
    body: payload as any,
  });
}

export async function eliminarPoliza(id: number): Promise<void> {
  await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
}

export interface CambioEstatusPolizaResultado {
  ok: true;
  estatus: 'aplicada' | 'borrador';
  message: string;
  poliza: PolizaEncabezado;
}

export async function cambiarEstatusPoliza(
  id: number,
  estatus: 'aplicada' | 'borrador'
): Promise<CambioEstatusPolizaResultado> {
  return apiFetch(`${BASE}/${id}/estatus`, {
    method: 'PATCH',
    body: { estatus } as any,
  });
}

export interface CambioEstatusLoteResultado {
  ok: true;
  resumen: ResumenLotePolizas;
  resultados: ResultadoLotePoliza[];
}

export async function cambiarEstatusPolizasLote(
  ids: number[],
  estatus: 'aplicada' | 'borrador'
): Promise<CambioEstatusLoteResultado> {
  return apiFetch(`${BASE}/estatus-lote`, {
    method: 'POST',
    body: { ids, estatus } as any,
  });
}
