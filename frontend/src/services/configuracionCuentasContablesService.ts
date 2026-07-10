import { apiFetch } from './apiFetch';
import type {
  ConfiguracionCuentaContable,
  ConfiguracionCuentaContableInput,
  FiltrosConfiguracionCuentaContable,
} from '../types/configuracionCuentasContables';

const BASE = '/api/contabilidad/configuracion-cuentas-contables';

export async function fetchConfiguracionesCuentasContables(
  filtros: FiltrosConfiguracionCuentaContable = {}
): Promise<ConfiguracionCuentaContable[]> {
  const params = new URLSearchParams();
  if (filtros.uso_contable) params.set('uso_contable', filtros.uso_contable);
  if (filtros.contacto_id != null) params.set('contacto_id', String(filtros.contacto_id));
  if (filtros.producto_id != null) params.set('producto_id', String(filtros.producto_id));
  if (filtros.almacen_id != null) params.set('almacen_id', String(filtros.almacen_id));
  if (filtros.finanzas_cuenta_id != null) params.set('finanzas_cuenta_id', String(filtros.finanzas_cuenta_id));
  if (filtros.concepto_id != null) params.set('concepto_id', String(filtros.concepto_id));
  if (filtros.impuesto_id) params.set('impuesto_id', filtros.impuesto_id);
  if (filtros.activa != null) params.set('activa', String(filtros.activa));
  const query = params.toString();
  return apiFetch(`${BASE}${query ? `?${query}` : ''}`);
}

export async function crearConfiguracionCuentaContable(
  payload: ConfiguracionCuentaContableInput
): Promise<ConfiguracionCuentaContable> {
  return apiFetch(BASE, { method: 'POST', body: payload as any });
}

export async function actualizarConfiguracionCuentaContable(
  id: number,
  payload: ConfiguracionCuentaContableInput
): Promise<ConfiguracionCuentaContable> {
  return apiFetch(`${BASE}/${id}`, { method: 'PUT', body: payload as any });
}

export async function eliminarConfiguracionCuentaContable(id: number): Promise<void> {
  await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
}

export async function fetchValoresProducto(
  campo: 'familia' | 'linea' | 'clasificacion' | 'tipo_producto'
): Promise<string[]> {
  return apiFetch(`${BASE}/valores-producto?campo=${encodeURIComponent(campo)}`);
}
