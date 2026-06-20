import { apiFetch } from '../api/apiClient';

const BASE = '/api/reportes';

export type AplicacionDetalle = {
  id: number;
  fecha: string;
  folio: string;
  tipo_etiqueta: string;
  concepto: string;
  monto: number;
  origen_doc_id: number | null;
};

export type MovimientoEstadoCuenta = {
  id: number;
  fecha: string;
  folio: string;
  tipo: string;
  tipo_etiqueta: string;
  concepto: string;
  cargo: number;
  abono: number;
  saldo: number;
  saldo_actual: number;
  cancelado: boolean;
  es_cargo: boolean;
  // Presentes sólo en modo detalle
  total_original?: number;
  aplicaciones?: AplicacionDetalle[];
};

export type ContactoResumen = {
  id: number;
  nombre: string;
  rfc: string | null;
};

export type EstadoCuentaResult = {
  contacto: ContactoResumen | null;
  fecha_corte: string;
  saldo_final: number;
  movimientos: MovimientoEstadoCuenta[];
};

export type EstadoCuentaParams = {
  contacto_id: number;
  fecha_corte?: string;
  incluir_cancelados?: boolean;
  detalle?: boolean;
};

function buildQs(params: EstadoCuentaParams, extras: Record<string, string> = {}): URLSearchParams {
  const qs = new URLSearchParams({ contacto_id: String(params.contacto_id), ...extras });
  if (params.fecha_corte) qs.set('fecha_corte', params.fecha_corte);
  if (params.incluir_cancelados) qs.set('incluir_cancelados', 'true');
  if (params.detalle) qs.set('detalle', 'true');
  return qs;
}

async function fetchEstadoCuenta(
  endpoint: string,
  params: EstadoCuentaParams
): Promise<EstadoCuentaResult> {
  const res = await apiFetch(`${BASE}/${endpoint}?${buildQs(params).toString()}`);
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? 'Error al obtener estado de cuenta');
  }
  return res.json() as Promise<EstadoCuentaResult>;
}

function buildExportUrl(
  endpoint: string,
  params: EstadoCuentaParams,
  formato: 'excel' | 'csv' | 'pdf'
): string {
  return `${BASE}/${endpoint}?${buildQs(params, { formato }).toString()}`;
}

export const fetchEstadoCuentaProveedor = (p: EstadoCuentaParams) =>
  fetchEstadoCuenta('compras/estado-cuenta-proveedor', p);

export const fetchEstadoCuentaCliente = (p: EstadoCuentaParams) =>
  fetchEstadoCuenta('ventas/estado-cuenta-cliente', p);

export const buildEstadoCuentaProveedorExportUrl = (
  p: EstadoCuentaParams,
  f: 'excel' | 'csv' | 'pdf'
) => buildExportUrl('compras/estado-cuenta-proveedor', p, f);

export const buildEstadoCuentaClienteExportUrl = (
  p: EstadoCuentaParams,
  f: 'excel' | 'csv' | 'pdf'
) => buildExportUrl('ventas/estado-cuenta-cliente', p, f);

// ── Compras por Proveedor ─────────────────────────────────────────────────────

export type ProveedorCompras = {
  proveedor_id: number;
  nombre: string;
  rfc: string;
  cantidad_facturas: number;
  subtotal: number;
  iva: number;
  total_comprado: number;
  pct_participacion: number;
};

export type FacturaCompraDetalle = {
  id: number;
  proveedor_id: number;
  fecha: string;
  folio: string;
  subtotal: number;
  iva: number;
  total: number;
  cancelado: boolean;
};

export type ComprasPorProveedorResult = {
  fecha_inicio: string;
  fecha_fin: string;
  proveedores: ProveedorCompras[];
  facturas: FacturaCompraDetalle[];
};

export type ComprasPorProveedorParams = {
  fecha_inicio: string;
  fecha_fin: string;
  proveedor_id?: number | null;
  incluir_cancelados?: boolean;
  detalle?: boolean;
};

function buildCppQs(params: ComprasPorProveedorParams, extras: Record<string, string> = {}): URLSearchParams {
  const qs = new URLSearchParams({
    fecha_inicio: params.fecha_inicio,
    fecha_fin: params.fecha_fin,
    ...extras,
  });
  if (params.proveedor_id) qs.set('proveedor_id', String(params.proveedor_id));
  if (params.incluir_cancelados) qs.set('incluir_cancelados', 'true');
  if (params.detalle) qs.set('detalle', 'true');
  return qs;
}

export async function fetchComprasPorProveedor(
  params: ComprasPorProveedorParams
): Promise<ComprasPorProveedorResult> {
  const res = await apiFetch(`${BASE}/compras/compras-por-proveedor?${buildCppQs(params).toString()}`);
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? 'Error al obtener compras por proveedor');
  }
  return res.json() as Promise<ComprasPorProveedorResult>;
}

export function buildComprasPorProveedorExportUrl(
  params: ComprasPorProveedorParams,
  formato: 'excel' | 'pdf'
): string {
  return `${BASE}/compras/compras-por-proveedor?${buildCppQs(params, { formato }).toString()}`;
}
