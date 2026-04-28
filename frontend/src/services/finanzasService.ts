import { apiFetch } from './apiFetch';
import type {
  AplicacionOperacion,
  ConciliacionPayload,
  DocumentoSaldo,
  EstadoCuentaItem,
  FinanzasCuenta,
  FinanzasOperacion,
  NaturalezaOperacion,
  OperacionDisponible,
  TipoMovimiento,
  TransferenciaPayload,
  TransferenciaUpdatePayload,
} from '../types/finanzas';

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
  naturaleza_operacion?: NaturalezaOperacion;
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

export async function fetchOperacionDetalle(id: number): Promise<FinanzasOperacion> {
  return apiFetch(`${BASE}/finanzas_operaciones/${id}`);
}

export async function fetchOperacionDisponible(id: number): Promise<OperacionDisponible> {
  return apiFetch(`${BASE}/finanzas_operaciones/${id}/disponible`);
}

export async function fetchAplicacionesPorOperacion(id: number): Promise<AplicacionOperacion[]> {
  return apiFetch(`${BASE}/finanzas_operaciones/${id}/aplicaciones`);
}

export async function fetchAplicacionesDocumento(id: number): Promise<AplicacionOperacion[]> {
  return apiFetch(`${BASE}/documentos/${id}/aplicaciones`);
}

export async function fetchSaldoDocumento(id: number): Promise<DocumentoSaldo> {
  return apiFetch(`${BASE}/documentos/${id}/saldo`);
}

export async function fetchEstadoCuenta(contactoId: number): Promise<EstadoCuentaItem[]> {
  return apiFetch(`${BASE}/contactos/${contactoId}/estado-cuenta`);
}

export async function crearAplicacion(payload: {
  finanzas_operacion_id: number;
  documento_destino_id: number;
  monto: number;
  monto_moneda_documento?: number;
  fecha_aplicacion?: string | null;
}): Promise<AplicacionOperacion> {
  return apiFetch(`${BASE}/aplicaciones`, {
    method: 'POST',
    body: payload as any,
  });
}

export async function eliminarAplicacion(id: number): Promise<void> {
  await apiFetch(`${BASE}/aplicaciones/${id}`, { method: 'DELETE' });
}
