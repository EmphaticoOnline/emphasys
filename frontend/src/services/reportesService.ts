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

// ── Vencimientos de Proveedores ───────────────────────────────────────────────

export type VencimientoProveedor = {
  id: number;
  fecha_vencimiento: string;
  dias: number;
  proveedor_nombre: string;
  folio: string;
  referencia_proveedor: string;
  total: number;
  saldo: number;
};

export type VencimientosProveedoresResult = {
  fecha_corte: string;
  vencimientos: VencimientoProveedor[];
};

export type VencimientosProveedoresParams = {
  fecha_corte?: string;
  contacto_id?: number | null;
  moneda?: string | null;
};

function buildVencimientosQs(params: VencimientosProveedoresParams, extras: Record<string, string> = {}): URLSearchParams {
  const qs = new URLSearchParams(extras);
  if (params.fecha_corte) qs.set('fecha_corte', params.fecha_corte);
  if (params.contacto_id) qs.set('contacto_id', String(params.contacto_id));
  if (params.moneda) qs.set('moneda', params.moneda);
  return qs;
}

export async function fetchVencimientosProveedores(params: VencimientosProveedoresParams): Promise<VencimientosProveedoresResult> {
  const res = await apiFetch(`${BASE}/finanzas/vencimientos-proveedores?${buildVencimientosQs(params).toString()}`);
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? 'Error al obtener reporte');
  }
  return res.json() as Promise<VencimientosProveedoresResult>;
}

export function buildVencimientosProveedoresExportUrl(params: VencimientosProveedoresParams, formato: 'excel' | 'pdf'): string {
  return `${BASE}/finanzas/vencimientos-proveedores?${buildVencimientosQs(params, { formato }).toString()}`;
}

// ── Historial de Precios de Compra ────────────────────────────────────────────

export type HistorialPrecioLinea = {
  id: number;
  fecha: string;
  proveedor_nombre: string;
  folio: string;
  referencia_proveedor: string;
  grupo_key: string;
  producto_id: number | null;
  clave: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
};

export type HistorialPreciosResumen = {
  ultimo_costo: number;
  primer_costo: number | null;
  costo_min: number;
  costo_max: number;
  costo_promedio: number;
  variacion_pct: number | null;
};

export type HistorialPreciosResult = {
  fecha_inicio: string;
  fecha_fin: string;
  lineas: HistorialPrecioLinea[];
  resumen: HistorialPreciosResumen;
};

export type HistorialPreciosParams = {
  fecha_inicio: string;
  fecha_fin: string;
  producto_id?: number | null;
  contacto_id?: number | null;
};

function buildHistorialQs(params: HistorialPreciosParams, extras: Record<string, string> = {}): URLSearchParams {
  const qs = new URLSearchParams({ fecha_inicio: params.fecha_inicio, fecha_fin: params.fecha_fin, ...extras });
  if (params.producto_id) qs.set('producto_id', String(params.producto_id));
  if (params.contacto_id) qs.set('contacto_id', String(params.contacto_id));
  return qs;
}

export async function fetchHistorialPreciosCompra(params: HistorialPreciosParams): Promise<HistorialPreciosResult> {
  const res = await apiFetch(`${BASE}/compras/historial-precios?${buildHistorialQs(params).toString()}`);
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? 'Error al obtener reporte');
  }
  return res.json() as Promise<HistorialPreciosResult>;
}

export function buildHistorialPreciosExportUrl(params: HistorialPreciosParams, formato: 'excel' | 'pdf'): string {
  return `${BASE}/compras/historial-precios?${buildHistorialQs(params, { formato }).toString()}`;
}

export async function fetchHistorialPreciosVenta(params: HistorialPreciosParams): Promise<HistorialPreciosResult> {
  const res = await apiFetch(`${BASE}/ventas/historial-precios?${buildHistorialQs(params).toString()}`);
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? 'Error al obtener reporte');
  }
  return res.json() as Promise<HistorialPreciosResult>;
}

export function buildHistorialPreciosVentaExportUrl(params: HistorialPreciosParams, formato: 'excel' | 'pdf'): string {
  return `${BASE}/ventas/historial-precios?${buildHistorialQs(params, { formato }).toString()}`;
}

// ── Movimientos por Período (Compras / Ventas) ────────────────────────────────

export type Agrupacion = 'dia' | 'semana' | 'mes' | 'anio';

export type PeriodoResumen = {
  periodo_key:          string;
  periodo_label:        string;
  cantidad_documentos:  number;
  cantidad_contactos:   number;
  cantidad_total:       number;
  subtotal:             number;
  iva:                  number;
  total:                number;
};

export type DocumentoPeriodo = {
  periodo_key:      string;
  id:               number;
  fecha:            string;
  folio:            string;
  contacto_nombre:  string;
  cantidad_total:   number;
  subtotal:         number;
  iva:              number;
  total:            number;
};

export type KpisMovimientosPeriodo = {
  total:                number;
  cantidad_documentos:  number;
  cantidad_contactos:   number;
  cantidad_total:       number;
  ticket_promedio:      number;
};

export type MovimientosPorPeriodoResult = {
  fecha_inicio: string;
  fecha_fin:    string;
  agrupacion:   Agrupacion;
  periodos:     PeriodoResumen[];
  documentos:   DocumentoPeriodo[];
  kpis:         KpisMovimientosPeriodo;
};

export type MovimientosPorPeriodoParams = {
  fecha_inicio:  string;
  fecha_fin:     string;
  agrupacion:    Agrupacion;
  contacto_id?:  number | null;
  producto_id?:  number | null;
};

function buildPeriodoQs(params: MovimientosPorPeriodoParams, extras: Record<string, string> = {}): URLSearchParams {
  const qs = new URLSearchParams({
    fecha_inicio: params.fecha_inicio,
    fecha_fin:    params.fecha_fin,
    agrupacion:   params.agrupacion,
    ...extras,
  });
  if (params.contacto_id) qs.set('contacto_id', String(params.contacto_id));
  if (params.producto_id) qs.set('producto_id', String(params.producto_id));
  return qs;
}

async function fetchMovimientosPorPeriodo(
  endpoint: string,
  params: MovimientosPorPeriodoParams
): Promise<MovimientosPorPeriodoResult> {
  const res = await apiFetch(`${BASE}/${endpoint}?${buildPeriodoQs(params).toString()}`);
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? 'Error al obtener reporte');
  }
  return res.json() as Promise<MovimientosPorPeriodoResult>;
}

function buildPeriodoExportUrl(
  endpoint: string,
  params: MovimientosPorPeriodoParams,
  formato: 'excel' | 'pdf'
): string {
  return `${BASE}/${endpoint}?${buildPeriodoQs(params, { formato }).toString()}`;
}

export const fetchComprasPorPeriodo = (p: MovimientosPorPeriodoParams) =>
  fetchMovimientosPorPeriodo('compras/compras-por-periodo', p);

export const buildComprasPorPeriodoExportUrl = (p: MovimientosPorPeriodoParams, f: 'excel' | 'pdf') =>
  buildPeriodoExportUrl('compras/compras-por-periodo', p, f);

export const fetchVentasPorPeriodo = (p: MovimientosPorPeriodoParams) =>
  fetchMovimientosPorPeriodo('ventas/ventas-por-periodo', p);

export const buildVentasPorPeriodoExportUrl = (p: MovimientosPorPeriodoParams, f: 'excel' | 'pdf') =>
  buildPeriodoExportUrl('ventas/ventas-por-periodo', p, f);

// ── Pendientes de Facturar (Pedidos / Remisiones) ─────────────────────────────

export type PendienteFacturarDoc = {
  doc_id:          number;
  folio:           string;
  fecha:           string;
  cliente_id:      number | null;
  cliente_nombre:  string;
  total_doc:       number;
  total_facturado: number;
  total_pendiente: number;
  pct_avance:      number;
};

export type PendientesFacturarResult = {
  fecha_inicio: string;
  fecha_fin:    string;
  documentos:   PendienteFacturarDoc[];
};

export type PendientesFacturarParams = {
  fecha_inicio: string;
  fecha_fin:    string;
  contacto_id?: number | null;
};

function buildPendientesQs(params: PendientesFacturarParams, extras: Record<string, string> = {}): URLSearchParams {
  const qs = new URLSearchParams({ fecha_inicio: params.fecha_inicio, fecha_fin: params.fecha_fin, ...extras });
  if (params.contacto_id) qs.set('contacto_id', String(params.contacto_id));
  return qs;
}

async function fetchPendientesFacturar(endpoint: string, params: PendientesFacturarParams): Promise<PendientesFacturarResult> {
  const res = await apiFetch(`${BASE}/${endpoint}?${buildPendientesQs(params).toString()}`);
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? 'Error al obtener reporte');
  }
  return res.json() as Promise<PendientesFacturarResult>;
}

function buildPendientesExportUrl(endpoint: string, params: PendientesFacturarParams, formato: 'excel' | 'pdf'): string {
  return `${BASE}/${endpoint}?${buildPendientesQs(params, { formato }).toString()}`;
}

export const fetchPedidosPendientesFacturar = (p: PendientesFacturarParams) =>
  fetchPendientesFacturar('ventas/pedidos-pendientes-facturar', p);

export const buildPedidosPendientesExportUrl = (p: PendientesFacturarParams, f: 'excel' | 'pdf') =>
  buildPendientesExportUrl('ventas/pedidos-pendientes-facturar', p, f);

export const fetchRemisionesPendientesFacturar = (p: PendientesFacturarParams) =>
  fetchPendientesFacturar('ventas/remisiones-pendientes-facturar', p);

export const buildRemisionesPendientesExportUrl = (p: PendientesFacturarParams, f: 'excel' | 'pdf') =>
  buildPendientesExportUrl('ventas/remisiones-pendientes-facturar', p, f);
