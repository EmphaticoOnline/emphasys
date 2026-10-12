import { apiFetch, apiFetchBlob, triggerBlobDownload } from './apiFetch';
import type {
  Almacen,
  CrearMovimientoManualPayload,
  MovimientoListadoItem,
  MovimientoDetalle,
} from '../types/inventario';

// Nota: actualmente no existe router de inventario expuesto en backend (no hay /api/inventario en app.ts).
// Se mantiene la ruta esperada a la espera de que el backend publique estos endpoints.
// Si el backend define otra ruta, ajustar BASE_URL en consecuencia.
const BASE_URL = '/api/inventario';

export async function crearMovimientoManual(payload: CrearMovimientoManualPayload) {
  return apiFetch(`${BASE_URL}/movimientos/manual`, {
    method: 'POST',
    body: payload as any,
  });
}

export async function listarMovimientos(): Promise<MovimientoListadoItem[]> {
  return apiFetch(`${BASE_URL}/movimientos`);
}

export async function obtenerMovimientoDetalle(id: number): Promise<MovimientoDetalle> {
  return apiFetch(`${BASE_URL}/movimientos/${id}`);
}

export async function afectarMovimiento(id: number): Promise<void> {
  await apiFetch(`${BASE_URL}/movimientos/${id}/afectar`, { method: 'POST' });
}

export async function desafectarMovimiento(id: number, motivo: string): Promise<void> {
  await apiFetch(`${BASE_URL}/movimientos/${id}/desafectar`, { method: 'POST', body: { motivo } as any });
}

export async function actualizarMovimiento(id: number, payload: CrearMovimientoManualPayload): Promise<void> {
  await apiFetch(`${BASE_URL}/movimientos/${id}`, { method: 'PUT', body: payload as any });
}

export async function eliminarMovimiento(id: number): Promise<void> {
  await apiFetch(`${BASE_URL}/movimientos/${id}`, { method: 'DELETE' });
}

export async function fetchAlmacenes(incluirInactivos = false): Promise<Almacen[]> {
  return apiFetch(incluirInactivos ? '/api/almacenes/admin' : '/api/almacenes');
}

export async function crearAlmacen(payload: { clave: string; nombre: string; tipo?: string; activo?: boolean }): Promise<Almacen> {
  return apiFetch('/api/almacenes', { method: 'POST', body: payload as any });
}

export async function actualizarAlmacen(id: number, payload: { clave: string; nombre: string; tipo?: string; activo: boolean }): Promise<Almacen> {
  return apiFetch(`/api/almacenes/${id}`, { method: 'PUT', body: payload as any });
}

export async function eliminarAlmacen(id: number): Promise<void> {
  await apiFetch(`/api/almacenes/${id}`, { method: 'DELETE' });
}

export async function obtenerUltimoCosto(productoId: number): Promise<number | null> {
  const data = await apiFetch<{ costo_unitario: number | string | null }>(`${BASE_URL}/productos/${productoId}/ultimo-costo`);
  return data.costo_unitario == null ? null : Number(data.costo_unitario);
}

export type ExportMovimientoColumna = { field: string; headerName: string };

export async function exportarMovimientos(payload: {
  columns: ExportMovimientoColumna[];
}): Promise<void> {
  const { blob, filename } = await apiFetchBlob(`${BASE_URL}/movimientos/exportar`, {
    method: 'POST',
    body: payload as any,
  });
  triggerBlobDownload(blob, filename);
}

export type RecalculoPayload = { alcance: 'producto'|'todos'; producto_id?: number; desde?: string|null; revision?: string|null };
export type RecalculoResultado = { alcance:string; productoId:number|null; desde:string|null; revision?:string; productos:number; movimientos:number; diferencias?: any[]; antes?: any[]; despues?: any[]; duracion_ms:number };
export async function analizarRecalculo(payload: RecalculoPayload): Promise<RecalculoResultado> {
  return apiFetch(`${BASE_URL}/recalculos/analizar`, { method:'POST', body:payload as any });
}
export async function ejecutarRecalculo(payload: RecalculoPayload): Promise<RecalculoResultado> {
  return apiFetch(`${BASE_URL}/recalculos/ejecutar`, { method:'POST', body:payload as any });
}
