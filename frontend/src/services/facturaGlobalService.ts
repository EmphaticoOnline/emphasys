import { apiFetch } from './apiFetch';

const BASE = '/api/factura-global';

export type FacturaGlobalPreviewParams = {
  fecha_desde: string;
  fecha_hasta: string;
};

export type FacturaGlobalPreviewResult = {
  count: number;
  subtotal: number;
  iva: number;
  total: number;
  total_saldo: number;
  ventas_ids: number[];
};

export type FacturaGlobalGenerarParams = {
  fecha_desde: string;
  fecha_hasta: string;
  periodicidad: string;
  mes: string;
  anio: number;
};

export type FacturaGlobalGenerarResult = {
  factura_global_id: number;
  ventas_incluidas: number;
  subtotal: number;
  iva: number;
  total: number;
};

export async function previewFacturaGlobal(
  params: FacturaGlobalPreviewParams
): Promise<FacturaGlobalPreviewResult> {
  return apiFetch(`${BASE}/preview`, { method: 'POST', body: params as any });
}

export async function generarFacturaGlobal(
  params: FacturaGlobalGenerarParams
): Promise<FacturaGlobalGenerarResult> {
  return apiFetch(`${BASE}/generar`, { method: 'POST', body: params as any });
}
