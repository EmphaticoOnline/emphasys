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

export async function fetchAlmacenes(): Promise<Almacen[]> {
  return apiFetch('/api/almacenes');
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
