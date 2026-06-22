import pool from '../../config/database';
import { formatearFolioDocumento } from '../../utils/documentos';

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
  saldo: number;        // saldo acumulado (running balance) — se conserva para compatibilidad
  saldo_actual: number; // saldo vigente del documento (siempre presente)
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

type EstadoCuentaConfig = {
  tiposDocumento: string[];
  tiposCargo: string[];
  etiqueta: Record<string, string>;
  concepto: Record<string, string>;
};

const CONFIG_PROVEEDOR: EstadoCuentaConfig = {
  tiposDocumento: ['factura_compra', 'nota_credito_compra', 'pago_proveedor'],
  tiposCargo: ['factura_compra'],
  etiqueta: {
    factura_compra:      'Factura',
    nota_credito_compra: 'N. Crédito',
    pago_proveedor:      'Pago',
  },
  concepto: {
    factura_compra:      'Factura de compra',
    nota_credito_compra: 'Nota de crédito',
    pago_proveedor:      'Pago a proveedor',
  },
};

const CONFIG_CLIENTE: EstadoCuentaConfig = {
  tiposDocumento: ['factura', 'nota_credito', 'pago_cliente'],
  tiposCargo: ['factura'],
  etiqueta: {
    factura:      'Factura',
    nota_credito: 'N. Crédito',
    pago_cliente: 'Pago',
  },
  concepto: {
    factura:      'Factura de venta',
    nota_credito: 'Nota de crédito',
    pago_cliente: 'Pago de cliente',
  },
};

function toFecha(val: unknown): string {
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val ?? '').slice(0, 10);
}

function etiquetaAplicacion(tipoDoc: string | null, config: EstadoCuentaConfig) {
  if (!tipoDoc) return { etiqueta: 'Pago', concepto: 'Abono aplicado' };
  return {
    etiqueta: config.etiqueta[tipoDoc] ?? 'Abono',
    concepto: config.concepto[tipoDoc] ?? 'Abono aplicado',
  };
}

async function _obtenerAplicaciones(
  config: EstadoCuentaConfig,
  empresaId: number,
  docIds: number[],
  fechaCorte: string
): Promise<Map<number, AplicacionDetalle[]>> {
  if (docIds.length === 0) return new Map();

  const { rows } = await pool.query(
    `SELECT
       a.documento_destino_id            AS doc_id,
       a.id                              AS aplicacion_id,
       a.documento_origen_id             AS origen_doc_id,
       COALESCE(a.fecha_aplicacion::date, NOW()::date)::text AS fecha,
       a.monto,
       d_origen.serie                    AS origen_serie,
       COALESCE(d_origen.numero, 0)::int AS origen_numero,
       d_origen.tipo_documento           AS origen_tipo,
       fo.id                             AS operacion_id,
       fc.identificador                  AS cuenta_nombre
     FROM aplicaciones_saldo a
     LEFT JOIN documentos d_origen
       ON d_origen.id = a.documento_origen_id AND d_origen.empresa_id = a.empresa_id
     LEFT JOIN finanzas_operaciones fo
       ON fo.id = a.finanzas_operacion_id AND fo.empresa_id = a.empresa_id
     LEFT JOIN finanzas_cuentas fc
       ON fc.id = fo.cuenta_id AND fc.empresa_id = fo.empresa_id
     WHERE a.empresa_id = $1
       AND a.documento_destino_id = ANY($2::int[])
       AND COALESCE(a.fecha_aplicacion::date, NOW()::date) <= $3::date
     ORDER BY a.documento_destino_id, a.fecha_aplicacion, a.id`,
    [empresaId, docIds, fechaCorte]
  );

  const mapa = new Map<number, AplicacionDetalle[]>();
  for (const row of rows) {
    const docId = row.doc_id as number;
    if (!mapa.has(docId)) mapa.set(docId, []);

    let folio: string;
    let tipoEtiqueta: string;
    let concepto: string;

    if (row.origen_tipo) {
      const labels = etiquetaAplicacion(row.origen_tipo as string, config);
      folio = formatearFolioDocumento(row.origen_serie as string, row.origen_numero as number);
      tipoEtiqueta = labels.etiqueta;
      concepto = labels.concepto;
    } else {
      folio = row.cuenta_nombre ? String(row.cuenta_nombre) : `OPR-${String(row.operacion_id ?? '')}`;
      tipoEtiqueta = 'Pago';
      concepto = 'Pago directo';
    }

    mapa.get(docId)!.push({
      id: row.aplicacion_id as number,
      fecha: toFecha(row.fecha),
      folio,
      tipo_etiqueta: tipoEtiqueta,
      concepto,
      monto: Number(row.monto ?? 0),
      origen_doc_id: row.origen_doc_id != null ? (row.origen_doc_id as number) : null,
    });
  }
  return mapa;
}

async function _obtenerEstadoCuenta(
  config: EstadoCuentaConfig,
  params: {
    contactoId: number;
    empresaId: number;
    fechaCorte?: string | null;
    incluirCancelados?: boolean;
    detalle?: boolean;
  }
): Promise<EstadoCuentaResult> {
  const { contactoId, empresaId, incluirCancelados = false, detalle = false } = params;
  const hoy = new Date().toISOString().slice(0, 10);
  const fechaCorte = params.fechaCorte || hoy;
  const { tiposDocumento, tiposCargo } = config;

  const { rows: contactoRows } = await pool.query<ContactoResumen>(
    `SELECT id, nombre, rfc FROM contactos WHERE id = $1 AND empresa_id = $2`,
    [contactoId, empresaId]
  );
  const contacto = contactoRows[0] ?? null;

  const cargoExpr = tiposCargo.map((t) => `'${t}'`).join(', ');
  const signoExpr = `
    CASE
      WHEN LOWER(COALESCE(d.estatus_documento, '')) IN ('cancelado', 'cancelada') THEN 0
      WHEN d.tipo_documento IN (${cargoExpr}) THEN d.total::numeric
      ELSE -(d.total::numeric)
    END`;

  const filtroEstatus = incluirCancelados
    ? ''
    : `AND LOWER(COALESCE(d.estatus_documento, '')) NOT IN ('cancelado', 'cancelada')`;

  // saldo_actual histórico: total del documento menos aplicaciones registradas hasta la fecha de corte
  const saldoActualSelect = `, CASE WHEN LOWER(COALESCE(d.estatus_documento,'')) IN ('cancelado','cancelada')
    THEN 0
    ELSE d.total::numeric - COALESCE((
      SELECT SUM(a.monto) FROM aplicaciones_saldo a
      WHERE a.documento_destino_id = d.id
        AND a.empresa_id = d.empresa_id
        AND COALESCE(a.fecha_aplicacion::date, NOW()::date) <= $4::date
    ), 0)
  END AS saldo_actual`;

  const { rows } = await pool.query(
    `SELECT
       d.id,
       d.fecha_documento                                                     AS fecha,
       d.tipo_documento                                                      AS tipo,
       COALESCE(d.serie, '')                                                 AS serie,
       COALESCE(d.numero, 0)::int                                           AS numero,
       d.total::numeric                                                      AS total,
       d.estatus_documento,
       LOWER(COALESCE(d.estatus_documento, '')) IN ('cancelado','cancelada') AS cancelado,
       SUM(${signoExpr}) OVER (
         ORDER BY d.fecha_documento, d.id
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS saldo_acumulado
       ${saldoActualSelect}
     FROM documentos d
     WHERE d.empresa_id = $1
       AND d.contacto_principal_id = $2
       AND d.tipo_documento = ANY($3::text[])
       AND d.fecha_documento <= $4::date
       ${filtroEstatus}
     ORDER BY d.fecha_documento, d.id`,
    [empresaId, contactoId, tiposDocumento, fechaCorte]
  );

  let aplicacionesMap = new Map<number, AplicacionDetalle[]>();
  if (detalle) {
    const docCargoIds = rows
      .filter((r) => tiposCargo.includes(r.tipo as string) && !r.cancelado)
      .map((r) => r.id as number);
    aplicacionesMap = await _obtenerAplicaciones(config, empresaId, docCargoIds, fechaCorte);
  }

  const movimientos: MovimientoEstadoCuenta[] = rows.map((row) => {
    const tipo = row.tipo as string;
    const total = Number(row.total ?? 0);
    const cancelado = Boolean(row.cancelado);
    const esCargo = tiposCargo.includes(tipo);
    const esCargoActivo = esCargo && !cancelado;
    const mov: MovimientoEstadoCuenta = {
      id: row.id as number,
      fecha: toFecha(row.fecha),
      folio: formatearFolioDocumento(row.serie as string, row.numero as number),
      tipo,
      tipo_etiqueta: config.etiqueta[tipo] ?? tipo,
      concepto: config.concepto[tipo] ?? tipo,
      cargo: esCargoActivo ? total : 0,
      abono: (!esCargo && !cancelado) ? total : 0,
      saldo: Number(row.saldo_acumulado ?? 0),
      saldo_actual: Number(row.saldo_actual ?? 0),
      cancelado,
      es_cargo: esCargo,
    };
    if (detalle) {
      mov.total_original = total;
      mov.aplicaciones = aplicacionesMap.get(row.id as number) ?? [];
    }
    return mov;
  });

  const saldoFinal = rows.length > 0 ? Number(rows[rows.length - 1].saldo_acumulado ?? 0) : 0;

  return { contacto, fecha_corte: fechaCorte, saldo_final: saldoFinal, movimientos };
}

export async function obtenerEstadoCuentaProveedor(params: {
  contactoId: number;
  empresaId: number;
  fechaCorte?: string | null;
  incluirCancelados?: boolean;
  detalle?: boolean;
}): Promise<EstadoCuentaResult> {
  return _obtenerEstadoCuenta(CONFIG_PROVEEDOR, params);
}

export async function obtenerEstadoCuentaCliente(params: {
  contactoId: number;
  empresaId: number;
  fechaCorte?: string | null;
  incluirCancelados?: boolean;
  detalle?: boolean;
}): Promise<EstadoCuentaResult> {
  return _obtenerEstadoCuenta(CONFIG_CLIENTE, params);
}

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

async function _obtenerVolumen(
  tipoDocumento: string,
  params: {
    empresaId: number;
    fechaInicio: string;
    fechaFin: string;
    contactoId?: number | null;
    detalle?: boolean;
  }
): Promise<VolumenContactoResult> {
  const { empresaId, fechaInicio, fechaFin, contactoId, detalle = false } = params;

  const filtroCancelados = `AND LOWER(COALESCE(d.estatus_documento, '')) NOT IN ('cancelado', 'cancelada')`;

  // $1=empresaId  $2=fechaInicio  $3=fechaFin  $4=tipoDocumento  [$5=contactoId]
  const args: unknown[] = [empresaId, fechaInicio, fechaFin, tipoDocumento];
  let filtroContacto = '';
  if (contactoId) {
    args.push(contactoId);
    filtroContacto = `AND d.contacto_principal_id = $${args.length}`;
  }

  const { rows: resumen } = await pool.query<{
    contacto_id: number;
    nombre: string;
    rfc: string;
    cantidad_facturas: number;
    subtotal: number;
    iva: number;
    total_comprado: number;
    pct_participacion: number;
  }>(
    `WITH base AS (
       SELECT
         d.contacto_principal_id AS contacto_id,
         SUM(d.subtotal)::numeric AS subtotal,
         SUM(d.iva)::numeric      AS iva,
         SUM(d.total)::numeric    AS total_comprado,
         COUNT(d.id)::int         AS cantidad_facturas
       FROM documentos d
       WHERE d.empresa_id = $1
         AND d.tipo_documento = $4
         AND d.fecha_documento >= $2::date
         AND d.fecha_documento <= $3::date
         ${filtroCancelados}
         ${filtroContacto}
       GROUP BY d.contacto_principal_id
     ),
     gran_total AS (SELECT COALESCE(SUM(total_comprado), 0) AS gt FROM base)
     SELECT
       b.contacto_id,
       c.nombre,
       COALESCE(c.rfc, '')           AS rfc,
       b.cantidad_facturas,
       COALESCE(b.subtotal, 0)       AS subtotal,
       COALESCE(b.iva, 0)            AS iva,
       COALESCE(b.total_comprado, 0) AS total_comprado,
       ROUND(
         COALESCE(b.total_comprado, 0) * 100.0 / NULLIF((SELECT gt FROM gran_total), 0),
         2
       )::numeric AS pct_participacion
     FROM base b
     JOIN contactos c ON c.id = b.contacto_id AND c.empresa_id = $1
     ORDER BY b.total_comprado DESC`,
    args
  );

  let facturas: FacturaVolumenDetalle[] = [];
  if (detalle) {
    // reutiliza los mismos args (ya incluyen tipoDocumento y contactoId si aplica)
    const { rows } = await pool.query<{
      id: number;
      contacto_id: number;
      fecha: unknown;
      serie: string;
      numero: number;
      subtotal: number;
      iva: number;
      total: number;
      cancelado: boolean;
    }>(
      `SELECT
         d.id,
         d.contacto_principal_id          AS contacto_id,
         d.fecha_documento                AS fecha,
         COALESCE(d.serie, '')            AS serie,
         COALESCE(d.numero, 0)::int       AS numero,
         COALESCE(d.subtotal, 0)::numeric AS subtotal,
         COALESCE(d.iva, 0)::numeric      AS iva,
         COALESCE(d.total, 0)::numeric    AS total,
         LOWER(COALESCE(d.estatus_documento, '')) IN ('cancelado', 'cancelada') AS cancelado
       FROM documentos d
       WHERE d.empresa_id = $1
         AND d.tipo_documento = $4
         AND d.fecha_documento >= $2::date
         AND d.fecha_documento <= $3::date
         ${filtroCancelados}
         ${filtroContacto}
       ORDER BY d.contacto_principal_id, d.fecha_documento, d.id`,
      args
    );

    facturas = rows.map((r) => ({
      id: r.id,
      contacto_id: r.contacto_id,
      fecha: toFecha(r.fecha),
      folio: formatearFolioDocumento(r.serie, r.numero),
      subtotal: Number(r.subtotal),
      iva: Number(r.iva),
      total: Number(r.total),
      cancelado: Boolean(r.cancelado),
    }));
  }

  return {
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    contactos: resumen.map((r) => ({
      contacto_id: r.contacto_id,
      nombre: r.nombre,
      rfc: r.rfc,
      cantidad_facturas: Number(r.cantidad_facturas),
      subtotal: Number(r.subtotal),
      iva: Number(r.iva),
      total_comprado: Number(r.total_comprado),
      pct_participacion: Number(r.pct_participacion),
    })),
    facturas,
  };
}

export async function obtenerComprasPorProveedor(params: {
  empresaId: number;
  fechaInicio: string;
  fechaFin: string;
  contactoId?: number | null;
  detalle?: boolean;
}): Promise<VolumenContactoResult> {
  return _obtenerVolumen('factura_compra', params);
}

export async function obtenerVentasPorCliente(params: {
  empresaId: number;
  fechaInicio: string;
  fechaFin: string;
  contactoId?: number | null;
  detalle?: boolean;
}): Promise<VolumenContactoResult> {
  return _obtenerVolumen('factura', params);
}

// ── Volumen por Producto (Compras por Producto / Ventas por Producto) ──────────

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

async function _obtenerVolumenProducto(
  tipoDocumento: string,
  params: {
    empresaId: number;
    fechaInicio: string;
    fechaFin: string;
    productoId?: number | null;
    contactoId?: number | null;
    detalle?: boolean;
    excluirSinMovimiento?: boolean;
  }
): Promise<VolumenProductoResult> {
  const {
    empresaId, fechaInicio, fechaFin,
    productoId, contactoId,
    detalle = false,
    excluirSinMovimiento = true,
  } = params;

  const sinCancelados  = `LOWER(COALESCE(d.estatus_documento, '')) NOT IN ('cancelado', 'cancelada')`;
  const sinCancelados2 = `LOWER(COALESCE(d2.estatus_documento, '')) NOT IN ('cancelado', 'cancelada')`;
  const grupoKey       = `COALESCE(dp.producto_id::text, 'libre:' || COALESCE(dp.descripcion_alterna, ''))`;
  const grupoKey2      = `COALESCE(dp2.producto_id::text, 'libre:' || COALESCE(dp2.descripcion_alterna, ''))`;

  const args: unknown[] = [empresaId, fechaInicio, fechaFin, tipoDocumento];

  let filtroProducto = '';
  if (productoId) {
    args.push(productoId);
    filtroProducto = `AND dp.producto_id = $${args.length}`;
  }
  let filtroContacto = '';
  if (contactoId) {
    args.push(contactoId);
    filtroContacto = `AND d.contacto_principal_id = $${args.length}`;
  }

  const havingClause = excluirSinMovimiento ? 'HAVING SUM(total) > 0' : '';

  const { rows: resumen } = await pool.query(
    `WITH
     base_raw AS (
       SELECT
         ${grupoKey}                                                              AS grupo_key,
         dp.producto_id,
         COALESCE(p.clave, dp.descripcion_alterna, '—')                          AS clave,
         COALESCE(p.descripcion, dp.descripcion_alterna, '(sin descripción)')    AS descripcion,
         COALESCE(u.clave, '')                                                    AS unidad,
         dp.cantidad::numeric                                                     AS cantidad,
         dp.subtotal_partida::numeric                                             AS subtotal,
         dp.total_partida::numeric                                                AS total,
         d.id                                                                     AS doc_id
       FROM documentos_partidas dp
       JOIN documentos d ON d.id = dp.documento_id AND d.empresa_id = $1
       LEFT JOIN productos p ON p.id = dp.producto_id AND p.empresa_id = $1
       LEFT JOIN unidades u ON u.id = p.unidad_venta_id
       WHERE d.tipo_documento = $4
         AND d.fecha_documento >= $2::date
         AND d.fecha_documento <= $3::date
         AND ${sinCancelados}
         ${filtroProducto}
         ${filtroContacto}
     ),
     base AS (
       SELECT
         grupo_key,
         producto_id,
         clave,
         descripcion,
         unidad,
         SUM(cantidad)::numeric         AS cantidad_total,
         COUNT(DISTINCT doc_id)::int    AS cantidad_documentos,
         SUM(subtotal)::numeric         AS subtotal,
         SUM(total - subtotal)::numeric AS iva,
         SUM(total)::numeric            AS total
       FROM base_raw
       GROUP BY grupo_key, producto_id, clave, descripcion, unidad
       ${havingClause}
     ),
     gran_total AS (SELECT COALESCE(SUM(total), 0) AS gt FROM base),
     hist_movimiento AS (
       SELECT
         ${grupoKey2}                    AS grupo_key,
         MAX(d2.fecha_documento)::text   AS ultimo_movimiento
       FROM documentos_partidas dp2
       JOIN documentos d2 ON d2.id = dp2.documento_id AND d2.empresa_id = $1
       WHERE d2.tipo_documento = $4
         AND ${sinCancelados2}
       GROUP BY 1
     ),
     hist_precio AS (
       SELECT DISTINCT ON (${grupoKey2})
         ${grupoKey2}                       AS grupo_key,
         dp2.precio_unitario::numeric       AS ultimo_precio_unitario
       FROM documentos_partidas dp2
       JOIN documentos d2 ON d2.id = dp2.documento_id AND d2.empresa_id = $1
       WHERE d2.tipo_documento = $4
         AND ${sinCancelados2}
       ORDER BY ${grupoKey2}, d2.fecha_documento DESC, d2.id DESC, dp2.id DESC
     )
     SELECT
       b.grupo_key,
       b.producto_id,
       b.clave,
       b.descripcion,
       b.unidad,
       b.cantidad_total,
       b.cantidad_documentos,
       b.subtotal,
       b.iva,
       b.total,
       ROUND(b.total * 100.0 / NULLIF((SELECT gt FROM gran_total), 0), 2)::numeric AS pct_participacion,
       CASE WHEN b.cantidad_total > 0
         THEN ROUND((b.subtotal / b.cantidad_total)::numeric, 4)
         ELSE 0
       END AS precio_promedio,
       COALESCE(hm.ultimo_movimiento, '')     AS ultimo_movimiento,
       COALESCE(hp.ultimo_precio_unitario, 0) AS ultimo_precio_unitario
     FROM base b
     LEFT JOIN hist_movimiento hm ON hm.grupo_key = b.grupo_key
     LEFT JOIN hist_precio hp ON hp.grupo_key = b.grupo_key
     ORDER BY b.total DESC`,
    args
  );

  let partidas: PartidaVolumenDetalle[] = [];
  if (detalle) {
    const { rows } = await pool.query(
      `SELECT
         ${grupoKey}                            AS grupo_key,
         dp.producto_id,
         d.fecha_documento                      AS fecha,
         COALESCE(d.serie, '')                  AS serie,
         COALESCE(d.numero, 0)::int             AS numero,
         COALESCE(c.nombre, '—')               AS contacto_nombre,
         dp.cantidad::numeric                   AS cantidad,
         dp.precio_unitario::numeric            AS precio_unitario,
         COALESCE(dp.descuento, 0)::numeric     AS descuento,
         dp.subtotal_partida::numeric           AS subtotal,
         dp.total_partida::numeric              AS total
       FROM documentos_partidas dp
       JOIN documentos d ON d.id = dp.documento_id AND d.empresa_id = $1
       LEFT JOIN contactos c ON c.id = d.contacto_principal_id AND c.empresa_id = $1
       WHERE d.tipo_documento = $4
         AND d.fecha_documento >= $2::date
         AND d.fecha_documento <= $3::date
         AND ${sinCancelados}
         ${filtroProducto}
         ${filtroContacto}
       ORDER BY ${grupoKey}, d.fecha_documento, d.id, dp.numero_partida`,
      args
    );
    partidas = rows.map((r) => ({
      grupo_key:       String(r.grupo_key),
      producto_id:     r.producto_id != null ? (r.producto_id as number) : null,
      fecha:           toFecha(r.fecha),
      folio:           formatearFolioDocumento(r.serie as string, r.numero as number),
      contacto_nombre: String(r.contacto_nombre ?? '—'),
      cantidad:        Number(r.cantidad ?? 0),
      precio_unitario: Number(r.precio_unitario ?? 0),
      descuento:       Number(r.descuento ?? 0),
      subtotal:        Number(r.subtotal ?? 0),
      total:           Number(r.total ?? 0),
    }));
  }

  return {
    fecha_inicio: fechaInicio,
    fecha_fin:    fechaFin,
    productos: resumen.map((r) => ({
      grupo_key:              String(r.grupo_key),
      producto_id:            r.producto_id != null ? (r.producto_id as number) : null,
      clave:                  String(r.clave ?? '—'),
      descripcion:            String(r.descripcion ?? '(sin descripción)'),
      unidad:                 String(r.unidad ?? ''),
      cantidad_total:         Number(r.cantidad_total ?? 0),
      cantidad_documentos:    Number(r.cantidad_documentos ?? 0),
      subtotal:               Number(r.subtotal ?? 0),
      iva:                    Number(r.iva ?? 0),
      total:                  Number(r.total ?? 0),
      pct_participacion:      Number(r.pct_participacion ?? 0),
      precio_promedio:        Number(r.precio_promedio ?? 0),
      ultimo_movimiento:      toFecha(r.ultimo_movimiento),
      ultimo_precio_unitario: Number(r.ultimo_precio_unitario ?? 0),
    })),
    partidas,
  };
}

export async function obtenerComprasPorProducto(params: {
  empresaId: number;
  fechaInicio: string;
  fechaFin: string;
  productoId?: number | null;
  contactoId?: number | null;
  detalle?: boolean;
  excluirSinMovimiento?: boolean;
}): Promise<VolumenProductoResult> {
  return _obtenerVolumenProducto('factura_compra', params);
}

export async function obtenerVentasPorProducto(params: {
  empresaId: number;
  fechaInicio: string;
  fechaFin: string;
  productoId?: number | null;
  contactoId?: number | null;
  detalle?: boolean;
  excluirSinMovimiento?: boolean;
}): Promise<VolumenProductoResult> {
  return _obtenerVolumenProducto('factura', params);
}

// ── Órdenes de Compra Pendientes de Recibir ──────────────────────────────────

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

export async function obtenerOCPendientesRecibir(params: {
  empresaId: number;
  fechaCorte: string;
  contactoId?: number | null;
  excluirCompletamenteRecibidas?: boolean;
  detalle?: boolean;
}): Promise<OCPendientesResult> {
  const { empresaId, fechaCorte, contactoId, excluirCompletamenteRecibidas = true, detalle = false } = params;

  const args: unknown[] = [empresaId, fechaCorte];
  let filtroContacto = '';
  if (contactoId) {
    args.push(contactoId);
    filtroContacto = `AND d.contacto_principal_id = $${args.length}`;
  }

  const havingOC = excluirCompletamenteRecibidas
    ? 'HAVING COALESCE(SUM(tm.cantidad_materializada), 0) < SUM(op.cantidad_ordenada)'
    : '';

  // CTEs comunes reutilizadas en ambas queries
  const cteComunes = `
    tipos_entrada AS (
      SELECT LOWER(td.codigo) AS tipo
      FROM core.tipos_documento td
      LEFT JOIN core.empresas_tipos_documento etd
        ON etd.tipo_documento_id = td.id AND etd.empresa_id = $1
      WHERE COALESCE(etd.afecta_inventario, td.afecta_inventario) = 'entrada'
    ),
    oc_base AS (
      SELECT d.id AS oc_id, d.fecha_documento AS fecha_oc, d.serie, d.numero,
             COALESCE(d.total, 0)::numeric AS total_oc,
             d.contacto_principal_id
      FROM documentos d
      WHERE d.empresa_id = $1
        AND LOWER(d.tipo_documento) = 'orden_compra'
        AND d.fecha_documento <= $2::date
        AND LOWER(COALESCE(d.estatus_documento,'')) NOT IN ('cancelado','cancelada')
        ${filtroContacto}
    ),
    oc_partidas AS (
      SELECT ob.oc_id, ob.fecha_oc, ob.serie, ob.numero, ob.total_oc,
             ob.contacto_principal_id,
             dp.id AS partida_oc_id,
             dp.producto_id,
             dp.descripcion_alterna,
             dp.cantidad::numeric AS cantidad_ordenada
      FROM oc_base ob
      JOIN documentos_partidas dp ON dp.documento_id = ob.oc_id
    ),
    nivel1 AS (
      SELECT op.partida_oc_id,
             dpv.partida_destino_id,
             dpv.cantidad AS cantidad_vinculada,
             d.tipo_documento AS tipo_dest,
             d.fecha_documento AS fecha_dest,
             LOWER(COALESCE(d.estatus_documento,'')) AS estatus_dest
      FROM oc_partidas op
      JOIN documentos_partidas_vinculos dpv ON dpv.partida_origen_id = op.partida_oc_id
      JOIN documentos d ON d.id = dpv.documento_destino_id
      WHERE d.empresa_id = $1
    ),
    entrada_nivel1 AS (
      SELECT n1.partida_oc_id, n1.cantidad_vinculada
      FROM nivel1 n1
      JOIN tipos_entrada te ON LOWER(n1.tipo_dest) = te.tipo
      WHERE n1.fecha_dest <= $2::date
        AND n1.estatus_dest NOT IN ('cancelado','cancelada')
    ),
    intermedios_nivel1 AS (
      SELECT n1.partida_oc_id, n1.partida_destino_id
      FROM nivel1 n1
      LEFT JOIN tipos_entrada te ON LOWER(n1.tipo_dest) = te.tipo
      WHERE te.tipo IS NULL
        AND n1.estatus_dest NOT IN ('cancelado','cancelada')
    ),
    entrada_nivel2 AS (
      SELECT in1.partida_oc_id, dpv2.cantidad AS cantidad_vinculada
      FROM intermedios_nivel1 in1
      JOIN documentos_partidas_vinculos dpv2 ON dpv2.partida_origen_id = in1.partida_destino_id
      JOIN documentos d2 ON d2.id = dpv2.documento_destino_id
      JOIN tipos_entrada te ON LOWER(d2.tipo_documento) = te.tipo
      WHERE d2.empresa_id = $1
        AND d2.fecha_documento <= $2::date
        AND LOWER(COALESCE(d2.estatus_documento,'')) NOT IN ('cancelado','cancelada')
    ),
    total_materializado AS (
      SELECT partida_oc_id, SUM(cantidad_vinculada) AS cantidad_materializada
      FROM (
        SELECT partida_oc_id, cantidad_vinculada FROM entrada_nivel1
        UNION ALL
        SELECT partida_oc_id, cantidad_vinculada FROM entrada_nivel2
      ) t
      GROUP BY partida_oc_id
    )`;

  // ── Query de resumen (siempre se ejecuta) ──────────────────────────────────
  const { rows: resumenRows } = await pool.query(
    `WITH ${cteComunes}
     SELECT
       op.oc_id,
       op.serie,
       op.numero,
       op.fecha_oc,
       op.total_oc,
       op.contacto_principal_id                                                      AS proveedor_id,
       COALESCE(c.nombre, '—')                                                      AS proveedor_nombre,
       SUM(op.cantidad_ordenada)::numeric                                            AS cantidad_ordenada,
       COALESCE(SUM(tm.cantidad_materializada), 0)::numeric                         AS cantidad_materializada,
       (SUM(op.cantidad_ordenada) - COALESCE(SUM(tm.cantidad_materializada), 0))::numeric AS cantidad_pendiente,
       ROUND(COALESCE(SUM(tm.cantidad_materializada), 0) * 100.0
             / NULLIF(SUM(op.cantidad_ordenada), 0), 1)::numeric                   AS pct_recibido,
       ($2::date - op.fecha_oc)::int                                                AS dias_transcurridos
     FROM oc_partidas op
     LEFT JOIN total_materializado tm ON tm.partida_oc_id = op.partida_oc_id
     LEFT JOIN contactos c ON c.id = op.contacto_principal_id AND c.empresa_id = $1
     GROUP BY op.oc_id, op.serie, op.numero, op.fecha_oc, op.total_oc,
              op.contacto_principal_id, c.nombre
     ${havingOC}
     ORDER BY op.fecha_oc, op.oc_id`,
    args
  );

  const ordenes: OCPendienteOC[] = resumenRows.map((r) => ({
    oc_id:                 r.oc_id as number,
    folio:                 formatearFolioDocumento(r.serie as string, r.numero as number),
    fecha_oc:              toFecha(r.fecha_oc),
    total_oc:              Number(r.total_oc ?? 0),
    proveedor_id:          r.proveedor_id != null ? (r.proveedor_id as number) : null,
    proveedor_nombre:      String(r.proveedor_nombre ?? '—'),
    cantidad_ordenada:     Number(r.cantidad_ordenada ?? 0),
    cantidad_materializada: Number(r.cantidad_materializada ?? 0),
    cantidad_pendiente:    Number(r.cantidad_pendiente ?? 0),
    pct_recibido:          Number(r.pct_recibido ?? 0),
    dias_transcurridos:    Number(r.dias_transcurridos ?? 0),
  }));

  // ── Query de detalle (solo si se solicita) ─────────────────────────────────
  let partidas: OCPendientePartida[] = [];
  if (detalle) {
    const ocConPendienteCTE = excluirCompletamenteRecibidas
      ? `, oc_con_pendiente AS (
           SELECT op2.oc_id
           FROM oc_partidas op2
           LEFT JOIN total_materializado tm2 ON tm2.partida_oc_id = op2.partida_oc_id
           GROUP BY op2.oc_id
           HAVING COALESCE(SUM(tm2.cantidad_materializada), 0) < SUM(op2.cantidad_ordenada)
         )`
      : '';

    const joinPendiente = excluirCompletamenteRecibidas
      ? 'JOIN oc_con_pendiente ocp ON ocp.oc_id = op.oc_id'
      : '';

    const { rows: partidaRows } = await pool.query(
      `WITH ${cteComunes}
       ${ocConPendienteCTE}
       SELECT
         op.oc_id,
         op.serie,
         op.numero,
         op.partida_oc_id,
         dp.producto_id,
         COALESCE(p.clave, dp.descripcion_alterna, '—')                       AS clave,
         COALESCE(p.descripcion, dp.descripcion_alterna, '(sin descripción)') AS descripcion,
         COALESCE(u.clave, '')                                                  AS unidad,
         op.cantidad_ordenada,
         COALESCE(tm.cantidad_materializada, 0)::numeric                       AS cantidad_materializada,
         (op.cantidad_ordenada - COALESCE(tm.cantidad_materializada, 0))::numeric AS cantidad_pendiente,
         ROUND(COALESCE(tm.cantidad_materializada, 0) * 100.0
               / NULLIF(op.cantidad_ordenada, 0), 1)::numeric                 AS pct_recibido
       FROM oc_partidas op
       ${joinPendiente}
       JOIN documentos_partidas dp ON dp.id = op.partida_oc_id
       LEFT JOIN productos p ON p.id = dp.producto_id AND p.empresa_id = $1
       LEFT JOIN unidades u ON u.id = p.unidad_venta_id
       LEFT JOIN total_materializado tm ON tm.partida_oc_id = op.partida_oc_id
       ORDER BY op.fecha_oc, op.oc_id, op.partida_oc_id`,
      args
    );

    partidas = partidaRows.map((r) => ({
      oc_id:                 r.oc_id as number,
      serie:                 String(r.serie ?? ''),
      numero:                Number(r.numero ?? 0),
      partida_oc_id:         r.partida_oc_id as number,
      producto_id:           r.producto_id != null ? (r.producto_id as number) : null,
      clave:                 String(r.clave ?? '—'),
      descripcion:           String(r.descripcion ?? '(sin descripción)'),
      unidad:                String(r.unidad ?? ''),
      cantidad_ordenada:     Number(r.cantidad_ordenada ?? 0),
      cantidad_materializada: Number(r.cantidad_materializada ?? 0),
      cantidad_pendiente:    Number(r.cantidad_pendiente ?? 0),
      pct_recibido:          Number(r.pct_recibido ?? 0),
    }));
  }

  return { fecha_corte: fechaCorte, ordenes, partidas };
}
