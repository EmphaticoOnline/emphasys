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
  proveedor_id: number | null;
  moneda: string;
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

// ── Vencimientos de Clientes ──────────────────────────────────────────────────

export type VencimientoCliente = {
  id: number;
  fecha_vencimiento: string;
  dias: number;
  cliente_nombre: string;
  folio: string;
  total: number;
  saldo: number;
};

export type VencimientosClientesResult = {
  fecha_corte: string;
  vencimientos: VencimientoCliente[];
};

export type VencimientosClientesParams = {
  fecha_corte?: string;
  contacto_id?: number | null;
  moneda?: string | null;
};

function buildVencimientosClientesQs(params: VencimientosClientesParams, extras: Record<string, string> = {}): URLSearchParams {
  const qs = new URLSearchParams(extras);
  if (params.fecha_corte) qs.set('fecha_corte', params.fecha_corte);
  if (params.contacto_id) qs.set('contacto_id', String(params.contacto_id));
  if (params.moneda) qs.set('moneda', params.moneda);
  return qs;
}

export async function fetchVencimientosClientes(params: VencimientosClientesParams): Promise<VencimientosClientesResult> {
  const res = await apiFetch(`${BASE}/finanzas/vencimientos-clientes?${buildVencimientosClientesQs(params).toString()}`);
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? 'Error al obtener reporte');
  }
  return res.json() as Promise<VencimientosClientesResult>;
}

export function buildVencimientosClientesExportUrl(params: VencimientosClientesParams, formato: 'excel' | 'pdf'): string {
  return `${BASE}/finanzas/vencimientos-clientes?${buildVencimientosClientesQs(params, { formato }).toString()}`;
}

// ── Pagos de Clientes / Proveedores ───────────────────────────────────────────

export type PagoRegistrado = {
  id: number;
  fecha: string;
  folio: string;
  contacto_id: number | null;
  contacto_nombre: string;
  contacto_rfc: string | null;
  cuenta_id: number;
  cuenta_nombre: string;
  cuenta_moneda: string;
  monto: number;
  referencia: string | null;
  concepto_nombre: string | null;
  estado_conciliacion: string;
  metodo_pago_nombre: string | null;
};

export type PagosResult = {
  fecha_inicio: string;
  fecha_fin: string;
  total: number;
  pagos: PagoRegistrado[];
};

export type PagosParams = {
  fecha_inicio?: string;
  fecha_fin?: string;
  contacto_id?: number | null;
  cuenta_id?: number | null;
};

function buildPagosQs(params: PagosParams, extras: Record<string, string> = {}): URLSearchParams {
  const qs = new URLSearchParams(extras);
  if (params.fecha_inicio) qs.set('fecha_inicio', params.fecha_inicio);
  if (params.fecha_fin)    qs.set('fecha_fin',    params.fecha_fin);
  if (params.contacto_id)  qs.set('contacto_id',  String(params.contacto_id));
  if (params.cuenta_id)    qs.set('cuenta_id',    String(params.cuenta_id));
  return qs;
}

async function fetchPagos(endpoint: string, params: PagosParams): Promise<PagosResult> {
  const res = await apiFetch(`${BASE}/${endpoint}?${buildPagosQs(params).toString()}`);
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? 'Error al obtener reporte');
  }
  return res.json() as Promise<PagosResult>;
}

function buildPagosExportUrl(endpoint: string, params: PagosParams, formato: 'excel'): string {
  return `${BASE}/${endpoint}?${buildPagosQs(params, { formato }).toString()}`;
}

export const fetchPagosClientes    = (p: PagosParams) => fetchPagos('finanzas/pagos-clientes', p);
export const fetchPagosProveedores = (p: PagosParams) => fetchPagos('finanzas/pagos-proveedores', p);
export const buildPagosClientesExportUrl    = (p: PagosParams, f: 'excel') => buildPagosExportUrl('finanzas/pagos-clientes', p, f);
export const buildPagosProveedoresExportUrl = (p: PagosParams, f: 'excel') => buildPagosExportUrl('finanzas/pagos-proveedores', p, f);

// ── Posición de Tesorería ──────────────────────────────────────────────────────

export type CuentaTesoreria = {
  id: number;
  identificador: string;
  tipo_cuenta: string;
  moneda: string;
  saldo: number;
  saldo_conciliado: number;
  fecha_ultima_conciliacion: string | null;
  es_cuenta_efectivo: boolean;
  afecta_total_disponible: boolean;
};

export type TotalPorMoneda = {
  moneda: string;
  saldo: number;
  saldo_conciliado: number;
  cantidad_cuentas: number;
};

export type PosicionTesoreriaResult = {
  fecha_consulta: string;
  cuentas: CuentaTesoreria[];
  totales_por_moneda: TotalPorMoneda[];
};

export async function fetchPosicionTesoreria(): Promise<PosicionTesoreriaResult> {
  const res = await apiFetch(`${BASE}/finanzas/posicion-tesoreria`);
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? 'Error al obtener posición de tesorería');
  }
  return res.json() as Promise<PosicionTesoreriaResult>;
}

export function buildPosicionTesoreriaExportUrl(formato: 'excel'): string {
  return `${BASE}/finanzas/posicion-tesoreria?formato=${formato}`;
}

// ── Cartera Vencida ────────────────────────────────────────────────────────────

export type CarteraVencidaRow = {
  documento_id: number;
  contacto_id: number | null;
  contacto_nombre: string;
  fecha_documento: string;
  tipo_documento: string;
  folio: string;
  moneda: string;
  total: number;
  saldo: number;
  dias: number;
  bucket: '0-30' | '31-60' | '61-90' | '90+';
};

export type CarteraVencidaResumenRow = {
  contacto_id: number | null;
  contacto_nombre: string;
  moneda: string;
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
  total: number;
};

export type TotalCarteraMoneda = {
  moneda: string;
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
  total: number;
};

export type CarteraVencidaResult = {
  fecha_base: string;
  detalle: CarteraVencidaRow[];
  resumen: CarteraVencidaResumenRow[];
  totales: TotalCarteraMoneda[];
};

export type CarteraVencidaParams = {
  fecha_base?: string;
  tipo_documento?: 'factura' | 'factura_compra';
};

function buildCarteraQs(params: CarteraVencidaParams, extras: Record<string, string> = {}): URLSearchParams {
  const qs = new URLSearchParams(extras);
  if (params.fecha_base)     qs.set('fecha_base',     params.fecha_base);
  if (params.tipo_documento) qs.set('tipo_documento', params.tipo_documento);
  return qs;
}

export async function fetchCarteraVencida(params: CarteraVencidaParams): Promise<CarteraVencidaResult> {
  const res = await apiFetch(`${BASE}/finanzas/cartera-vencida?${buildCarteraQs(params).toString()}`);
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? 'Error al obtener cartera vencida');
  }
  return res.json() as Promise<CarteraVencidaResult>;
}

export function buildCarteraVencidaExportUrl(params: CarteraVencidaParams, formato: 'excel', vista: 'detalle' | 'resumen' = 'detalle'): string {
  return `${BASE}/finanzas/cartera-vencida?${buildCarteraQs(params, { formato, vista }).toString()}`;
}

// ── Movimientos No Conciliados (Fase 3.3) ─────────────────────────────────────

export interface MovimientoNoConciliado {
  id: number;
  fecha: string;
  cuenta_id: number;
  cuenta_nombre: string;
  cuenta_moneda: string;
  tipo_movimiento: string;
  naturaleza_operacion: string;
  monto: number;
  moneda: string;
  referencia: string | null;
  observaciones: string | null;
  estado_conciliacion: string;
  dias_sin_conciliar: number;
  contacto_id: number | null;
  contacto_nombre: string | null;
  concepto_nombre: string | null;
  metodo_pago_nombre: string | null;
  documento_origen_id: number | null;
  documento_folio: string | null;
}

export interface MovimientosNoConciliadosResult {
  fecha_corte: string;
  movimientos: MovimientoNoConciliado[];
}

export interface MovimientosNoConciliadosParams {
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  cuenta_id?: number | null;
  estado?: string | null;
  tipo_movimiento?: string | null;
  naturaleza?: string | null;
  contacto_id?: number | null;
  metodo_pago_id?: number | null;
  min_dias?: number | null;
}

function buildMovNCQs(params: MovimientosNoConciliadosParams, extras: Record<string, string> = {}): URLSearchParams {
  const qs = new URLSearchParams(extras);
  if (params.fecha_inicio)   qs.set('fecha_inicio',    params.fecha_inicio);
  if (params.fecha_fin)      qs.set('fecha_fin',       params.fecha_fin);
  if (params.cuenta_id)      qs.set('cuenta_id',       String(params.cuenta_id));
  if (params.estado)         qs.set('estado',          params.estado);
  if (params.tipo_movimiento) qs.set('tipo_movimiento', params.tipo_movimiento);
  if (params.naturaleza)     qs.set('naturaleza',      params.naturaleza);
  if (params.contacto_id)    qs.set('contacto_id',     String(params.contacto_id));
  if (params.metodo_pago_id) qs.set('metodo_pago_id',  String(params.metodo_pago_id));
  if (params.min_dias != null && params.min_dias > 0) qs.set('min_dias', String(params.min_dias));
  return qs;
}

export async function fetchMovimientosNoConciliados(
  params: MovimientosNoConciliadosParams
): Promise<MovimientosNoConciliadosResult> {
  const res = await apiFetch(`${BASE}/finanzas/movimientos-no-conciliados?${buildMovNCQs(params).toString()}`);
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? 'Error al obtener movimientos no conciliados');
  }
  return res.json() as Promise<MovimientosNoConciliadosResult>;
}

export function buildMovimientosNoConciliadosExportUrl(params: MovimientosNoConciliadosParams, formato: 'excel'): string {
  return `${BASE}/finanzas/movimientos-no-conciliados?${buildMovNCQs(params, { formato }).toString()}`;
}

// ════════════════════════════════════════════════════════════════════════════
// INVENTARIO
// ════════════════════════════════════════════════════════════════════════════

// ── 1. Existencias por Almacén ────────────────────────────────────────────────

export type ExistenciaPorAlmacen = {
  producto_id: number;
  clave: string;
  descripcion: string;
  familia: string;
  almacen_id: number;
  almacen: string;
  existencia: number;
  minimo_inventario: number;
  diferencia_minimo: number;
  costo_unitario: number;
  valor_inventario: number;
  ultima_fecha: string | null;
};

export type ExistenciasPorAlmacenResult = {
  lineas: ExistenciaPorAlmacen[];
  total_valor: number;
  total_productos: number;
};

export type ExistenciasPorAlmacenParams = {
  almacen_id?: number | null;
  producto_id?: number | null;
  solo_con_existencia?: boolean;
  solo_bajo_minimo?: boolean;
  familia?: string | null;
};

function buildExistenciasQs(params: ExistenciasPorAlmacenParams, extras: Record<string, string> = {}): URLSearchParams {
  const qs = new URLSearchParams(extras);
  if (params.almacen_id)         qs.set('almacen_id',          String(params.almacen_id));
  if (params.producto_id)        qs.set('producto_id',         String(params.producto_id));
  if (params.solo_con_existencia) qs.set('solo_con_existencia', 'true');
  if (params.solo_bajo_minimo)   qs.set('solo_bajo_minimo',    'true');
  if (params.familia)            qs.set('familia',              params.familia);
  return qs;
}

export async function fetchExistenciasPorAlmacen(params: ExistenciasPorAlmacenParams): Promise<ExistenciasPorAlmacenResult> {
  const res = await apiFetch(`${BASE}/inventario/existencias-por-almacen?${buildExistenciasQs(params).toString()}`);
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? 'Error al obtener existencias');
  }
  return res.json() as Promise<ExistenciasPorAlmacenResult>;
}

export function buildExistenciasExportUrl(params: ExistenciasPorAlmacenParams, formato: 'excel' | 'pdf'): string {
  return `${BASE}/inventario/existencias-por-almacen?${buildExistenciasQs(params, { formato }).toString()}`;
}

// ── 2. Kardex ────────────────────────────────────────────────────────────────

export type KardexLinea = {
  fecha: string;
  tipo_movimiento: string;
  doc_serie: string | null;
  doc_numero: number | null;
  doc_serie_externa: string | null;
  doc_numero_externo: number | null;
  doc_tipo: string | null;
  almacen: string;
  entrada: number;
  salida: number;
  existencia_despues: number;
  costo_unitario: number | null;
  valor: number;
  observaciones: string | null;
};

export type KardexResult = {
  fecha_inicio: string;
  fecha_fin: string;
  producto_id: number;
  producto_clave: string;
  producto_descripcion: string;
  lineas: KardexLinea[];
};

export type KardexParams = {
  producto_id: number;
  almacen_id?: number | null;
  fecha_inicio: string;
  fecha_fin: string;
  tipo_movimiento?: string | null;
};

function buildKardexQs(params: KardexParams, extras: Record<string, string> = {}): URLSearchParams {
  const qs = new URLSearchParams({ producto_id: String(params.producto_id), fecha_inicio: params.fecha_inicio, fecha_fin: params.fecha_fin, ...extras });
  if (params.almacen_id)       qs.set('almacen_id',       String(params.almacen_id));
  if (params.tipo_movimiento)  qs.set('tipo_movimiento',  params.tipo_movimiento);
  return qs;
}

export async function fetchKardexProducto(params: KardexParams): Promise<KardexResult> {
  const res = await apiFetch(`${BASE}/inventario/kardex?${buildKardexQs(params).toString()}`);
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? 'Error al obtener kardex');
  }
  return res.json() as Promise<KardexResult>;
}

export function buildKardexExportUrl(params: KardexParams, formato: 'excel' | 'pdf'): string {
  return `${BASE}/inventario/kardex?${buildKardexQs(params, { formato }).toString()}`;
}

// ── 3. Movimientos por período ────────────────────────────────────────────────

export type MovimientoInventario = {
  fecha: string;
  tipo_movimiento: string;
  producto_id: number;
  producto_clave: string;
  producto_descripcion: string;
  almacen: string;
  cantidad: number;
  signo: number;
  tipo_signo: string;
  costo_unitario: number | null;
  valor: number;
  doc_serie: string | null;
  doc_numero: number | null;
  doc_serie_externa: string | null;
  doc_numero_externo: number | null;
  doc_tipo: string | null;
  observaciones: string | null;
};

export type MovimientosPeriodoInvResult = {
  fecha_inicio: string;
  fecha_fin: string;
  lineas: MovimientoInventario[];
  total_entradas: number;
  total_salidas: number;
  total_valor: number;
};

export type MovimientosPeriodoInvParams = {
  fecha_inicio: string;
  fecha_fin: string;
  almacen_id?: number | null;
  producto_id?: number | null;
  tipo_movimiento?: string | null;
};

function buildMovPeriodoQs(params: MovimientosPeriodoInvParams, extras: Record<string, string> = {}): URLSearchParams {
  const qs = new URLSearchParams({ fecha_inicio: params.fecha_inicio, fecha_fin: params.fecha_fin, ...extras });
  if (params.almacen_id)      qs.set('almacen_id',      String(params.almacen_id));
  if (params.producto_id)     qs.set('producto_id',     String(params.producto_id));
  if (params.tipo_movimiento) qs.set('tipo_movimiento', params.tipo_movimiento);
  return qs;
}

export async function fetchMovimientosInventarioPeriodo(params: MovimientosPeriodoInvParams): Promise<MovimientosPeriodoInvResult> {
  const res = await apiFetch(`${BASE}/inventario/movimientos-por-periodo?${buildMovPeriodoQs(params).toString()}`);
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? 'Error al obtener movimientos de inventario');
  }
  return res.json() as Promise<MovimientosPeriodoInvResult>;
}

export function buildMovimientosPeriodoInvExportUrl(params: MovimientosPeriodoInvParams, formato: 'excel' | 'pdf'): string {
  return `${BASE}/inventario/movimientos-por-periodo?${buildMovPeriodoQs(params, { formato }).toString()}`;
}

// ── 4. Productos bajo mínimo ──────────────────────────────────────────────────

export type ProductoBajoMinimo = {
  producto_id: number;
  clave: string;
  descripcion: string;
  familia: string;
  almacen_id: number | null;
  almacen: string | null;
  existencia: number;
  minimo_inventario: number;
  faltante: number;
  proveedor_nombre: string | null;
  ultimo_costo: number;
  valor_faltante: number;
};

export type ProductosBajoMinimoResult = {
  lineas: ProductoBajoMinimo[];
  total_productos: number;
  total_valor_faltante: number;
};

export type ProductosBajoMinimoParams = {
  almacen_id?: number | null;
  familia?: string | null;
};

function buildBajoMinimoQs(params: ProductosBajoMinimoParams, extras: Record<string, string> = {}): URLSearchParams {
  const qs = new URLSearchParams(extras);
  if (params.almacen_id) qs.set('almacen_id', String(params.almacen_id));
  if (params.familia)    qs.set('familia',    params.familia);
  return qs;
}

export async function fetchProductosBajoMinimo(params: ProductosBajoMinimoParams): Promise<ProductosBajoMinimoResult> {
  const res = await apiFetch(`${BASE}/inventario/productos-bajo-minimo?${buildBajoMinimoQs(params).toString()}`);
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? 'Error al obtener productos bajo mínimo');
  }
  return res.json() as Promise<ProductosBajoMinimoResult>;
}

export function buildBajoMinimoExportUrl(params: ProductosBajoMinimoParams, formato: 'excel' | 'pdf'): string {
  return `${BASE}/inventario/productos-bajo-minimo?${buildBajoMinimoQs(params, { formato }).toString()}`;
}

// ── 5. Inventario valorizado ──────────────────────────────────────────────────

export type InventarioValorizadoLinea = {
  producto_id: number;
  clave: string;
  descripcion: string;
  familia: string;
  almacen_id: number;
  almacen: string;
  existencia: number;
  costo_promedio: number;
  ultimo_costo: number;
  costo_valuacion: number;
  tipo_costo: string;
  valor_inventario: number;
};

export type InventarioValorizadoResult = {
  lineas: InventarioValorizadoLinea[];
  total_valor: number;
  total_unidades: number;
};

export type InventarioValorizadoParams = {
  almacen_id?: number | null;
  producto_id?: number | null;
  familia?: string | null;
};

function buildValorizadoQs(params: InventarioValorizadoParams, extras: Record<string, string> = {}): URLSearchParams {
  const qs = new URLSearchParams(extras);
  if (params.almacen_id)  qs.set('almacen_id',  String(params.almacen_id));
  if (params.producto_id) qs.set('producto_id', String(params.producto_id));
  if (params.familia)     qs.set('familia',     params.familia);
  return qs;
}

export async function fetchInventarioValorizado(params: InventarioValorizadoParams): Promise<InventarioValorizadoResult> {
  const res = await apiFetch(`${BASE}/inventario/inventario-valorizado?${buildValorizadoQs(params).toString()}`);
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? 'Error al obtener inventario valorizado');
  }
  return res.json() as Promise<InventarioValorizadoResult>;
}

export function buildInventarioValorizadoExportUrl(params: InventarioValorizadoParams, formato: 'excel' | 'pdf'): string {
  return `${BASE}/inventario/inventario-valorizado?${buildValorizadoQs(params, { formato }).toString()}`;
}
