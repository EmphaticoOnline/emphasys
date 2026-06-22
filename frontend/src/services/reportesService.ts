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

// ── Volumen por Contacto (Compras por Proveedor / Ventas por Cliente) ─────────

export type ContactoVolumen = {
  contacto_id: number;
  nombre: string;
  rfc: string;
  cantidad_facturas: number;
  subtotal: number;
  iva: number;
  total_comprado: number;
  pct_participacion: number;
};

export type FacturaVolumenDetalle = {
  id: number;
  contacto_id: number;
  fecha: string;
  folio: string;
  subtotal: number;
  iva: number;
  total: number;
  cancelado: boolean;
};

export type VolumenContactoResult = {
  fecha_inicio: string;
  fecha_fin: string;
  contactos: ContactoVolumen[];
  facturas: FacturaVolumenDetalle[];
};

export type VolumenContactoParams = {
  fecha_inicio: string;
  fecha_fin: string;
  contacto_id?: number | null;
  detalle?: boolean;
};

function buildVolumenQs(params: VolumenContactoParams, extras: Record<string, string> = {}): URLSearchParams {
  const qs = new URLSearchParams({ fecha_inicio: params.fecha_inicio, fecha_fin: params.fecha_fin, ...extras });
  if (params.contacto_id) qs.set('contacto_id', String(params.contacto_id));
  if (params.detalle) qs.set('detalle', 'true');
  return qs;
}

async function fetchVolumenContacto(endpoint: string, params: VolumenContactoParams): Promise<VolumenContactoResult> {
  const res = await apiFetch(`${BASE}/${endpoint}?${buildVolumenQs(params).toString()}`);
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? 'Error al obtener reporte');
  }
  return res.json() as Promise<VolumenContactoResult>;
}

function buildVolumenExportUrl(endpoint: string, params: VolumenContactoParams, formato: 'excel' | 'pdf'): string {
  return `${BASE}/${endpoint}?${buildVolumenQs(params, { formato }).toString()}`;
}

export const fetchComprasPorProveedor = (p: VolumenContactoParams) =>
  fetchVolumenContacto('compras/compras-por-proveedor', p);

export const buildComprasPorProveedorExportUrl = (p: VolumenContactoParams, f: 'excel' | 'pdf') =>
  buildVolumenExportUrl('compras/compras-por-proveedor', p, f);

export const fetchVentasPorCliente = (p: VolumenContactoParams) =>
  fetchVolumenContacto('ventas/ventas-por-cliente', p);

export const buildVentasPorClienteExportUrl = (p: VolumenContactoParams, f: 'excel' | 'pdf') =>
  buildVolumenExportUrl('ventas/ventas-por-cliente', p, f);

// ── Volumen por Producto (Compras / Ventas) ───────────────────────────────────

export type ProductoVolumen = {
  grupo_key: string;
  producto_id: number | null;
  clave: string;
  descripcion: string;
  unidad: string;
  cantidad_total: number;
  cantidad_documentos: number;
  precio_promedio: number;
  ultimo_precio_unitario: number;
  subtotal: number;
  iva: number;
  total: number;
  ultimo_movimiento: string;
  pct_participacion: number;
};

export type PartidaVolumenDetalle = {
  grupo_key: string;
  producto_id: number | null;
  fecha: string;
  folio: string;
  contacto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  subtotal: number;
  total: number;
};

export type VolumenProductoResult = {
  fecha_inicio: string;
  fecha_fin: string;
  productos: ProductoVolumen[];
  partidas: PartidaVolumenDetalle[];
};

export type VolumenProductoParams = {
  fecha_inicio: string;
  fecha_fin: string;
  producto_id?: number | null;
  contacto_id?: number | null;
  detalle?: boolean;
  excluir_sin_movimiento?: boolean;
};

function buildProductoQs(params: VolumenProductoParams, extras: Record<string, string> = {}): URLSearchParams {
  const qs = new URLSearchParams({ fecha_inicio: params.fecha_inicio, fecha_fin: params.fecha_fin, ...extras });
  if (params.producto_id) qs.set('producto_id', String(params.producto_id));
  if (params.contacto_id) qs.set('contacto_id', String(params.contacto_id));
  if (params.detalle) qs.set('detalle', 'true');
  if (params.excluir_sin_movimiento === false) qs.set('excluir_sin_movimiento', 'false');
  return qs;
}

async function fetchVolumenProducto(endpoint: string, params: VolumenProductoParams): Promise<VolumenProductoResult> {
  const res = await apiFetch(`${BASE}/${endpoint}?${buildProductoQs(params).toString()}`);
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? 'Error al obtener reporte');
  }
  return res.json() as Promise<VolumenProductoResult>;
}

function buildProductoExportUrl(endpoint: string, params: VolumenProductoParams, formato: 'excel' | 'pdf'): string {
  return `${BASE}/${endpoint}?${buildProductoQs(params, { formato }).toString()}`;
}

export const fetchComprasPorProducto = (p: VolumenProductoParams) =>
  fetchVolumenProducto('compras/compras-por-producto', p);

export const buildComprasPorProductoExportUrl = (p: VolumenProductoParams, f: 'excel' | 'pdf') =>
  buildProductoExportUrl('compras/compras-por-producto', p, f);

export const fetchVentasPorProducto = (p: VolumenProductoParams) =>
  fetchVolumenProducto('ventas/ventas-por-producto', p);

export const buildVentasPorProductoExportUrl = (p: VolumenProductoParams, f: 'excel' | 'pdf') =>
  buildProductoExportUrl('ventas/ventas-por-producto', p, f);

// ── OC Pendientes de Recibir ──────────────────────────────────────────────────

export type OCPendienteOC = {
  oc_id: number;
  folio: string;
  fecha_oc: string;
  total_oc: number;
  proveedor_id: number | null;
  proveedor_nombre: string;
  cantidad_ordenada: number;
  cantidad_materializada: number;
  cantidad_pendiente: number;
  pct_recibido: number;
  dias_transcurridos: number;
};

export type OCPendientePartida = {
  oc_id: number;
  serie: string;
  numero: number;
  partida_oc_id: number;
  producto_id: number | null;
  clave: string;
  descripcion: string;
  unidad: string;
  cantidad_ordenada: number;
  cantidad_materializada: number;
  cantidad_pendiente: number;
  pct_recibido: number;
};

export type OCPendientesResult = {
  fecha_corte: string;
  ordenes: OCPendienteOC[];
  partidas: OCPendientePartida[];
};

export type OCPendientesParams = {
  fecha_corte?: string;
  contacto_id?: number | null;
  excluir_completamente_recibidas?: boolean;
  detalle?: boolean;
};

function buildOCPendientesQs(params: OCPendientesParams, extras: Record<string, string> = {}): URLSearchParams {
  const qs = new URLSearchParams(extras);
  if (params.fecha_corte) qs.set('fecha_corte', params.fecha_corte);
  if (params.contacto_id) qs.set('contacto_id', String(params.contacto_id));
  if (params.excluir_completamente_recibidas === false) qs.set('excluir_completamente_recibidas', 'false');
  if (params.detalle) qs.set('detalle', 'true');
  return qs;
}

export async function fetchOCPendientesRecibir(params: OCPendientesParams): Promise<OCPendientesResult> {
  const res = await apiFetch(`${BASE}/compras/oc-pendientes-recibir?${buildOCPendientesQs(params).toString()}`);
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? 'Error al obtener reporte');
  }
  return res.json() as Promise<OCPendientesResult>;
}

export function buildOCPendientesExportUrl(params: OCPendientesParams, formato: 'excel' | 'pdf'): string {
  return `${BASE}/compras/oc-pendientes-recibir?${buildOCPendientesQs(params, { formato }).toString()}`;
}
