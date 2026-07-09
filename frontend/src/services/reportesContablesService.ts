import { apiFetch, apiFetchBlob, triggerBlobDownload } from './apiFetch';
import type {
  BalanzaAnaliticaResultado,
  EstadoResultadosResultado,
  BalanceGeneralResultado,
} from '../types/reportesContables';

const BASE = '/api/contabilidad/reportes';

export type BalanzaAnaliticaParams = {
  ejercicio: number;
  periodo_inicial: number;
  periodo_final: number;
  mostrar_ceros: boolean;
  solo_afectables: boolean;
};

export type EstadoResultadosParams = {
  ejercicio: number;
  periodo_inicial: number;
  periodo_final: number;
  mostrar_detalle: boolean;
};

export type BalanceGeneralParams = {
  ejercicio: number;
  periodo: number;
  mostrar_detalle: boolean;
};

function qs(params: Record<string, string | number | boolean>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => search.set(key, String(value)));
  return search.toString();
}

export async function fetchBalanzaAnalitica(params: BalanzaAnaliticaParams): Promise<BalanzaAnaliticaResultado> {
  return apiFetch(`${BASE}/balanza-analitica?${qs(params)}`);
}

export async function descargarBalanzaAnalitica(params: BalanzaAnaliticaParams, formato: 'pdf' | 'excel'): Promise<void> {
  const { blob, filename } = await apiFetchBlob(`${BASE}/balanza-analitica?${qs({ ...params, formato })}`);
  triggerBlobDownload(blob, filename);
}

export async function fetchEstadoResultados(params: EstadoResultadosParams): Promise<EstadoResultadosResultado> {
  return apiFetch(`${BASE}/estado-resultados?${qs(params)}`);
}

export async function descargarEstadoResultados(params: EstadoResultadosParams, formato: 'pdf' | 'excel'): Promise<void> {
  const { blob, filename } = await apiFetchBlob(`${BASE}/estado-resultados?${qs({ ...params, formato })}`);
  triggerBlobDownload(blob, filename);
}

export async function fetchBalanceGeneral(params: BalanceGeneralParams): Promise<BalanceGeneralResultado> {
  return apiFetch(`${BASE}/balance-general?${qs(params)}`);
}

export async function descargarBalanceGeneral(params: BalanceGeneralParams, formato: 'pdf' | 'excel'): Promise<void> {
  const { blob, filename } = await apiFetchBlob(`${BASE}/balance-general?${qs({ ...params, formato })}`);
  triggerBlobDownload(blob, filename);
}
