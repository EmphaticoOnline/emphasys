import { apiFetch } from './apiFetch';
import type {
  Cuenta,
  CuentaEdicionInput,
  CuentaNuevaInput,
  ConfiguracionContable,
  ConfiguracionContableInput,
  ValidarNuevaCuentaResponse,
} from '../types/contabilidad';

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

export async function cambiarEstadoCuenta(id: number, activa: boolean): Promise<Cuenta> {
  return apiFetch(`${BASE}/${id}/estado`, {
    method: 'PATCH',
    body: { activa } as any,
  });
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
