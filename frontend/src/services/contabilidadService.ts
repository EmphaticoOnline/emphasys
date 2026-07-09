import { apiFetch } from './apiFetch';
import type {
  Cuenta,
  CuentaEdicionInput,
  CuentaNuevaInput,
  ConfiguracionContable,
  ConfiguracionContableInput,
  ValidarNuevaCuentaResponse,
} from '../types/contabilidad';
import type { CuentaAfectable } from '../types/polizas';

const BASE = '/api/contabilidad/cuentas';
const CONFIGURACION_BASE = '/api/contabilidad/configuracion';

export async function fetchCuentas(incluirInactivas = false): Promise<Cuenta[]> {
  const query = incluirInactivas ? '?incluir_inactivas=1' : '';
  return apiFetch(`${BASE}${query}`);
}

export async function validarNuevaCuenta(cuenta: string): Promise<ValidarNuevaCuentaResponse> {
  return apiFetch(`${BASE}/validar-nueva?cuenta=${encodeURIComponent(cuenta)}`);
}

export async function crearCuenta(payload: CuentaNuevaInput): Promise<Cuenta> {
  return apiFetch(BASE, {
    method: 'POST',
    body: payload as any,
  });
}

export async function actualizarCuenta(id: number, payload: CuentaEdicionInput): Promise<Cuenta> {
  return apiFetch(`${BASE}/${id}`, {
    method: 'PUT',
    body: payload as any,
  });
}

export async function eliminarCuenta(id: number): Promise<void> {
  await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
}

export async function fetchCuentasAfectables(buscar?: string): Promise<CuentaAfectable[]> {
  const query = buscar?.trim() ? `?buscar=${encodeURIComponent(buscar.trim())}` : '';
  return apiFetch(`${BASE}/afectables${query}`);
}

export async function fetchConfiguracionContable(): Promise<ConfiguracionContable> {
  return apiFetch(CONFIGURACION_BASE);
}

export async function actualizarConfiguracionContable(payload: ConfiguracionContableInput): Promise<ConfiguracionContable> {
  return apiFetch(CONFIGURACION_BASE, {
    method: 'PUT',
    body: payload as any,
  });
}

export async function actualizarCodigoAgrupadorSatCuenta(id: number, codigoAgrupadorSat: string | null): Promise<Cuenta> {
  return apiFetch(`${BASE}/${id}/codigo-agrupador-sat`, {
    method: 'PATCH',
    body: { codigo_agrupador_sat: codigoAgrupadorSat },
  });
}

export interface ItemCodigoAgrupadorSatLote {
  cuenta_id: number;
  codigo_agrupador_sat: string | null;
}

export interface ErrorLoteCodigoAgrupadorSat {
  cuenta_id: number;
  motivo: string;
}

export interface ResultadoLoteCodigoAgrupadorSat {
  actualizadas: number;
  errores: ErrorLoteCodigoAgrupadorSat[];
}

export async function actualizarCodigosAgrupadoresSatLote(
  items: ItemCodigoAgrupadorSatLote[]
): Promise<ResultadoLoteCodigoAgrupadorSat> {
  return apiFetch(`${BASE}/codigos-agrupadores-sat/lote`, {
    method: 'PATCH',
    body: { items } as any,
  });
}
