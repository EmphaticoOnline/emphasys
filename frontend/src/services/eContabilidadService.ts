import { apiFetch } from './apiFetch';
import type { ValidacionEContabilidadResultado } from '../types/eContabilidad';
import type { CodigoAgrupadorSat } from '../types/codigosAgrupadores';
import type { SugerenciaCodigoAgrupador } from '../types/sugerenciasCodigosAgrupadores';

export async function fetchValidacionesEContabilidad(
  ejercicio: number,
  periodo: number
): Promise<ValidacionEContabilidadResultado> {
  return apiFetch(`/api/contabilidad/e-contabilidad/validaciones?ejercicio=${ejercicio}&periodo=${periodo}`);
}

export async function fetchCodigosAgrupadores(buscar?: string): Promise<CodigoAgrupadorSat[]> {
  const query = buscar?.trim() ? `?buscar=${encodeURIComponent(buscar.trim())}` : '';
  return apiFetch(`/api/contabilidad/e-contabilidad/codigos-agrupadores${query}`);
}

export async function fetchSugerenciasCodigosAgrupadores(): Promise<SugerenciaCodigoAgrupador[]> {
  return apiFetch('/api/contabilidad/e-contabilidad/sugerencias-codigos-agrupadores');
}
