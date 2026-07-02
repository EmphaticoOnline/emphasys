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

function _calcularResumenHistorial(lineas: HistorialPrecioLinea[]): HistorialPreciosResumen {
  if (lineas.length === 0) {
    return { ultimo_costo: 0, primer_costo: null, costo_min: 0, costo_max: 0, costo_promedio: 0, variacion_pct: null };
  }

  // lineas ordenadas DESC → primero = más reciente, último = más antiguo
  const ultimo_costo = lineas[0].precio_unitario;
  const primer_costo = lineas[lineas.length - 1].precio_unitario;

  let costo_min = Infinity;
  let costo_max = -Infinity;
  let suma_pond  = 0;
  let suma_cant  = 0;

  for (const l of lineas) {
    if (l.precio_unitario < costo_min) costo_min = l.precio_unitario;
    if (l.precio_unitario > costo_max) costo_max = l.precio_unitario;
    suma_pond += l.cantidad * l.precio_unitario;
    suma_cant  += l.cantidad;
  }

  const costo_promedio = suma_cant > 0 ? suma_pond / suma_cant : 0;

  const variacion_pct = lineas.length >= 2 && primer_costo > 0
    ? ((ultimo_costo - primer_costo) / primer_costo) * 100
    : null;

  return {
    ultimo_costo,
    primer_costo,
    costo_min: costo_min === Infinity ? 0 : costo_min,
    costo_max: costo_max === -Infinity ? 0 : costo_max,
    costo_promedio,
    variacion_pct,
  };
}

export async function obtenerHistorialPreciosCompra(params: {
  empresaId: number;
  fechaInicio: string;
  fechaFin: string;
  productoId?: number | null;
  contactoId?: number | null;
}): Promise<HistorialPreciosResult> {
  const { empresaId, fechaInicio, fechaFin, productoId, contactoId } = params;

  const args: unknown[] = [empresaId, fechaInicio, fechaFin];
  const filtros: string[] = [];

  if (productoId) {
    args.push(productoId);
    filtros.push(`AND dp.producto_id = $${args.length}`);
  }
  if (contactoId) {
    args.push(contactoId);
    filtros.push(`AND d.contacto_principal_id = $${args.length}`);
  }

  const { rows } = await pool.query(
    `SELECT
       dp.id,
       d.fecha_documento                                                                   AS fecha,
       COALESCE(c.nombre, '—')                                                           AS proveedor_nombre,
       COALESCE(d.serie, '')                                                               AS serie,
       COALESCE(d.numero, 0)::int                                                         AS numero,
       COALESCE(d.serie_externa, '')                                                       AS serie_externa,
       COALESCE(d.numero_externo, 0)::int                                                 AS numero_externo,
       COALESCE(dp.producto_id::text, 'libre:' || COALESCE(dp.descripcion_alterna, ''))  AS grupo_key,
       dp.producto_id,
       COALESCE(p.clave, dp.descripcion_alterna, '—')                                   AS clave,
       COALESCE(p.descripcion, dp.descripcion_alterna, '(sin descripción)')              AS descripcion,
       dp.cantidad::numeric                                                                AS cantidad,
       dp.precio_unitario::numeric                                                         AS precio_unitario,
       dp.subtotal_partida::numeric                                                        AS subtotal
     FROM documentos_partidas dp
     JOIN documentos d ON d.id = dp.documento_id AND d.empresa_id = $1
     LEFT JOIN contactos c ON c.id = d.contacto_principal_id AND c.empresa_id = $1
     LEFT JOIN productos p ON p.id = dp.producto_id AND p.empresa_id = $1
     WHERE d.tipo_documento = 'factura_compra'
       AND d.fecha_documento >= $2::date
       AND d.fecha_documento <= $3::date
       AND LOWER(COALESCE(d.estatus_documento, '')) NOT IN ('cancelado', 'cancelada')
       ${filtros.join(' ')}
     ORDER BY d.fecha_documento DESC, d.id DESC, dp.numero_partida`,
    args
  );

  const lineas: HistorialPrecioLinea[] = rows.map((r) => {
    const serieExt = String(r.serie_externa ?? '').trim();
    const numExt   = Number(r.numero_externo ?? 0);
    return {
      id:                   r.id as number,
      fecha:                toFecha(r.fecha),
      proveedor_nombre:     String(r.proveedor_nombre ?? '—'),
      folio:                formatearFolioDocumento(String(r.serie ?? ''), Number(r.numero ?? 0)),
      referencia_proveedor: (serieExt || numExt > 0) ? formatearFolioDocumento(serieExt, numExt) : '',
      grupo_key:            String(r.grupo_key ?? ''),
      producto_id:          r.producto_id != null ? Number(r.producto_id) : null,
      clave:                String(r.clave ?? '—'),
      descripcion:          String(r.descripcion ?? '(sin descripción)'),
      cantidad:             Number(r.cantidad ?? 0),
      precio_unitario:      Number(r.precio_unitario ?? 0),
      subtotal:             Number(r.subtotal ?? 0),
    };
  });

  return {
    fecha_inicio: fechaInicio,
    fecha_fin:    fechaFin,
    lineas,
    resumen: _calcularResumenHistorial(lineas),
  };
}

// ── Movimientos por Período (Compras por Período / Ventas por Período) ────────

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

const AGRUPACION_TRUNC: Record<Agrupacion, string> = {
  dia:    'day',
  semana: 'week',
  mes:    'month',
  anio:   'year',
};

const MESES_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

function _isoWeek(isoDate: string): number {
  const [yr, mo, da] = isoDate.slice(0, 10).split('-').map(Number);
  const d = new Date(Date.UTC(yr, mo - 1, da));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function _periodoLabel(key: string, agrupacion: Agrupacion): string {
  if (!key || key.length < 10) return key;
  const [yr, mo, da] = key.slice(0, 10).split('-').map(Number);
  switch (agrupacion) {
    case 'dia':    return `${String(da).padStart(2,'0')}-${String(mo).padStart(2,'0')}-${yr}`;
    case 'semana': return `Semana ${_isoWeek(key)} — ${yr}`;
    case 'mes':    return `${MESES_ES[mo - 1]} ${yr}`;
    case 'anio':   return String(yr);
  }
}

async function _obtenerMovimientosPorPeriodo(
  tipoDocumento: string,
  params: {
    empresaId:   number;
    fechaInicio: string;
    fechaFin:    string;
    agrupacion:  Agrupacion;
    contactoId?: number | null;
    productoId?: number | null;
  }
): Promise<MovimientosPorPeriodoResult> {
  const { empresaId, fechaInicio, fechaFin, agrupacion, contactoId, productoId } = params;

  const trunc = AGRUPACION_TRUNC[agrupacion];
  const sinCancelados = `LOWER(COALESCE(d.estatus_documento, '')) NOT IN ('cancelado', 'cancelada')`;

  // Construcción dinámica de filtros opcionales
  const args: unknown[] = [empresaId, fechaInicio, fechaFin, tipoDocumento];
  let filtroContacto = '';
  if (contactoId) {
    args.push(contactoId);
    filtroContacto = `AND d.contacto_principal_id = $${args.length}`;
  }

  // Cuando hay filtro de producto, se restringe qué documentos incluir via subquery
  let joinProducto  = '';
  let filtroProducto = '';
  let filtroProductoCant = '';
  if (productoId) {
    args.push(productoId);
    const pIdx = args.length;
    joinProducto   = `JOIN documentos_partidas dp_f ON dp_f.documento_id = d.id AND dp_f.producto_id = $${pIdx}`;
    filtroProducto = '';   // el join ya actúa como filtro
    filtroProductoCant = `AND dp.producto_id = $${pIdx}`;
  }

  // ── Resumen agrupado por período ──────────────────────────────────────────
  const { rows: resumenRows } = await pool.query(
    `WITH docs_base AS (
       SELECT DISTINCT d.id, d.fecha_documento, d.contacto_principal_id,
              d.subtotal::numeric AS subtotal,
              d.iva::numeric      AS iva,
              d.total::numeric    AS total
       FROM documentos d
       ${joinProducto}
       WHERE d.empresa_id = $1
         AND d.tipo_documento = $4
         AND d.fecha_documento >= $2::date
         AND d.fecha_documento <= $3::date
         AND ${sinCancelados}
         ${filtroContacto}
         ${filtroProducto}
     ),
     cantidades AS (
       SELECT
         DATE_TRUNC('${trunc}', d.fecha_documento)::date::text AS periodo_key,
         SUM(dp.cantidad)::numeric                              AS cantidad_total
       FROM documentos_partidas dp
       JOIN documentos d ON d.id = dp.documento_id
       WHERE d.id IN (SELECT id FROM docs_base)
         ${filtroProductoCant}
       GROUP BY 1
     )
     SELECT
       DATE_TRUNC('${trunc}', db.fecha_documento)::date::text AS periodo_key,
       COUNT(DISTINCT db.id)::int                             AS cantidad_documentos,
       COUNT(DISTINCT db.contacto_principal_id)::int          AS cantidad_contactos,
       COALESCE(c.cantidad_total, 0)                          AS cantidad_total,
       COALESCE(SUM(db.subtotal), 0)::numeric                 AS subtotal,
       COALESCE(SUM(db.iva), 0)::numeric                      AS iva,
       COALESCE(SUM(db.total), 0)::numeric                    AS total
     FROM docs_base db
     LEFT JOIN cantidades c ON c.periodo_key = DATE_TRUNC('${trunc}', db.fecha_documento)::date::text
     GROUP BY DATE_TRUNC('${trunc}', db.fecha_documento)::date::text, c.cantidad_total
     ORDER BY 1 ASC`,
    args
  );

  // ── Detalle de documentos por período ────────────────────────────────────
  const { rows: docRows } = await pool.query(
    `WITH docs_base AS (
       SELECT DISTINCT d.id
       FROM documentos d
       ${joinProducto}
       WHERE d.empresa_id = $1
         AND d.tipo_documento = $4
         AND d.fecha_documento >= $2::date
         AND d.fecha_documento <= $3::date
         AND ${sinCancelados}
         ${filtroContacto}
         ${filtroProducto}
     )
     SELECT
       DATE_TRUNC('${trunc}', d.fecha_documento)::date::text AS periodo_key,
       d.id,
       d.fecha_documento                                       AS fecha,
       COALESCE(d.serie, '')                                   AS serie,
       COALESCE(d.numero, 0)::int                             AS numero,
       COALESCE(c.nombre, '—')                               AS contacto_nombre,
       COALESCE(cant.cantidad_total, 0)::numeric               AS cantidad_total,
       COALESCE(d.subtotal, 0)::numeric                        AS subtotal,
       COALESCE(d.iva, 0)::numeric                             AS iva,
       COALESCE(d.total, 0)::numeric                           AS total
     FROM documentos d
     JOIN docs_base db ON db.id = d.id
     LEFT JOIN contactos c ON c.id = d.contacto_principal_id AND c.empresa_id = $1
     LEFT JOIN (
       SELECT dp.documento_id, SUM(dp.cantidad)::numeric AS cantidad_total
       FROM documentos_partidas dp
       WHERE dp.documento_id IN (SELECT id FROM docs_base)
         ${filtroProductoCant}
       GROUP BY dp.documento_id
     ) cant ON cant.documento_id = d.id
     ORDER BY 1 ASC, d.fecha_documento ASC, d.id ASC`,
    args
  );

  const periodos: PeriodoResumen[] = resumenRows.map((r) => ({
    periodo_key:         String(r.periodo_key ?? ''),
    periodo_label:       _periodoLabel(String(r.periodo_key ?? ''), agrupacion),
    cantidad_documentos: Number(r.cantidad_documentos ?? 0),
    cantidad_contactos:  Number(r.cantidad_contactos ?? 0),
    cantidad_total:      Number(r.cantidad_total ?? 0),
    subtotal:            Number(r.subtotal ?? 0),
    iva:                 Number(r.iva ?? 0),
    total:               Number(r.total ?? 0),
  }));

  const documentos: DocumentoPeriodo[] = docRows.map((r) => ({
    periodo_key:     String(r.periodo_key ?? ''),
    id:              r.id as number,
    fecha:           toFecha(r.fecha),
    folio:           formatearFolioDocumento(String(r.serie ?? ''), Number(r.numero ?? 0)),
    contacto_nombre: String(r.contacto_nombre ?? '—'),
    cantidad_total:  Number(r.cantidad_total ?? 0),
    subtotal:        Number(r.subtotal ?? 0),
    iva:             Number(r.iva ?? 0),
    total:           Number(r.total ?? 0),
  }));

  const totalGeneral       = periodos.reduce((s, p) => s + p.total, 0);
  const cantidadDocs       = periodos.reduce((s, p) => s + p.cantidad_documentos, 0);
  const cantidadContactos  = new Set(docRows.map((r) => r.contacto_nombre)).size;
  const cantidadTotal      = periodos.reduce((s, p) => s + p.cantidad_total, 0);

  return {
    fecha_inicio: fechaInicio,
    fecha_fin:    fechaFin,
    agrupacion,
    periodos,
    documentos,
    kpis: {
      total:               totalGeneral,
      cantidad_documentos: cantidadDocs,
      cantidad_contactos:  cantidadContactos,
      cantidad_total:      cantidadTotal,
      ticket_promedio:     cantidadDocs > 0 ? totalGeneral / cantidadDocs : 0,
    },
  };
}

export async function obtenerComprasPorPeriodo(params: {
  empresaId:   number;
  fechaInicio: string;
  fechaFin:    string;
  agrupacion:  Agrupacion;
  contactoId?: number | null;
  productoId?: number | null;
}): Promise<MovimientosPorPeriodoResult> {
  return _obtenerMovimientosPorPeriodo('factura_compra', params);
}

export async function obtenerVentasPorPeriodo(params: {
  empresaId:   number;
  fechaInicio: string;
  fechaFin:    string;
  agrupacion:  Agrupacion;
  contactoId?: number | null;
  productoId?: number | null;
}): Promise<MovimientosPorPeriodoResult> {
  return _obtenerMovimientosPorPeriodo('factura', params);
}

// ── Historial de Precios de Venta ─────────────────────────────────────────────

export async function obtenerHistorialPreciosVenta(params: {
  empresaId:   number;
  fechaInicio: string;
  fechaFin:    string;
  productoId?: number | null;
  contactoId?: number | null;
}): Promise<HistorialPreciosResult> {
  const { empresaId, fechaInicio, fechaFin, productoId, contactoId } = params;

  const args: unknown[] = [empresaId, fechaInicio, fechaFin];
  const filtros: string[] = [];

  if (productoId) {
    args.push(productoId);
    filtros.push(`AND dp.producto_id = $${args.length}`);
  }
  if (contactoId) {
    args.push(contactoId);
    filtros.push(`AND d.contacto_principal_id = $${args.length}`);
  }

  const { rows } = await pool.query(
    `SELECT
       dp.id,
       d.fecha_documento                                                                   AS fecha,
       COALESCE(c.nombre, '—')                                                           AS proveedor_nombre,
       COALESCE(d.serie, '')                                                               AS serie,
       COALESCE(d.numero, 0)::int                                                         AS numero,
       COALESCE(dp.producto_id::text, 'libre:' || COALESCE(dp.descripcion_alterna, ''))  AS grupo_key,
       dp.producto_id,
       COALESCE(p.clave, dp.descripcion_alterna, '—')                                   AS clave,
       COALESCE(p.descripcion, dp.descripcion_alterna, '(sin descripción)')              AS descripcion,
       dp.cantidad::numeric                                                                AS cantidad,
       dp.precio_unitario::numeric                                                         AS precio_unitario,
       dp.subtotal_partida::numeric                                                        AS subtotal
     FROM documentos_partidas dp
     JOIN documentos d ON d.id = dp.documento_id AND d.empresa_id = $1
     LEFT JOIN contactos c ON c.id = d.contacto_principal_id AND c.empresa_id = $1
     LEFT JOIN productos p ON p.id = dp.producto_id AND p.empresa_id = $1
     WHERE d.tipo_documento = 'factura'
       AND d.fecha_documento >= $2::date
       AND d.fecha_documento <= $3::date
       AND LOWER(COALESCE(d.estatus_documento, '')) NOT IN ('cancelado', 'cancelada')
       ${filtros.join(' ')}
     ORDER BY d.fecha_documento DESC, d.id DESC, dp.numero_partida`,
    args
  );

  const lineas: HistorialPrecioLinea[] = rows.map((r) => ({
    id:                   r.id as number,
    fecha:                toFecha(r.fecha),
    proveedor_nombre:     String(r.proveedor_nombre ?? '—'),
    folio:                formatearFolioDocumento(String(r.serie ?? ''), Number(r.numero ?? 0)),
    referencia_proveedor: '',
    grupo_key:            String(r.grupo_key ?? ''),
    producto_id:          r.producto_id != null ? Number(r.producto_id) : null,
    clave:                String(r.clave ?? '—'),
    descripcion:          String(r.descripcion ?? '(sin descripción)'),
    cantidad:             Number(r.cantidad ?? 0),
    precio_unitario:      Number(r.precio_unitario ?? 0),
    subtotal:             Number(r.subtotal ?? 0),
  }));

  return { fecha_inicio: fechaInicio, fecha_fin: fechaFin, lineas, resumen: _calcularResumenHistorial(lineas) };
}

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

async function _obtenerPendientesFacturar(
  tipoDocumento: string,
  params: {
    empresaId:   number;
    fechaInicio: string;
    fechaFin:    string;
    contactoId?: number | null;
  }
): Promise<PendientesFacturarResult> {
  const { empresaId, fechaInicio, fechaFin, contactoId } = params;
  const args: unknown[] = [empresaId, fechaInicio, fechaFin, tipoDocumento];

  let filtroContacto = '';
  if (contactoId) {
    args.push(contactoId);
    filtroContacto = `AND d.contacto_principal_id = $${args.length}`;
  }

  const { rows } = await pool.query(
    `WITH doc_base AS (
       SELECT d.id AS doc_id, d.fecha_documento AS fecha, d.serie, d.numero,
              d.contacto_principal_id,
              COALESCE(d.total, 0)::numeric AS total_doc
       FROM documentos d
       WHERE d.empresa_id = $1
         AND d.tipo_documento = $4
         AND d.fecha_documento >= $2::date
         AND d.fecha_documento <= $3::date
         AND LOWER(COALESCE(d.estatus_documento,'')) NOT IN ('cancelado','cancelada')
         ${filtroContacto}
     ),
     nivel1 AS (
       SELECT dp.documento_id AS doc_id,
              dpv.partida_destino_id,
              d_dest.tipo_documento AS tipo_dest,
              LOWER(COALESCE(d_dest.estatus_documento,'')) AS estatus_dest
       FROM doc_base db
       JOIN documentos_partidas dp ON dp.documento_id = db.doc_id
       JOIN documentos_partidas_vinculos dpv ON dpv.partida_origen_id = dp.id
       JOIN documentos d_dest ON d_dest.id = dpv.documento_destino_id
       WHERE d_dest.empresa_id = $1
     ),
     facturado_nivel1 AS (
       SELECT n1.doc_id, COALESCE(SUM(dp_f.total_partida), 0)::numeric AS monto
       FROM nivel1 n1
       JOIN documentos_partidas dp_f ON dp_f.id = n1.partida_destino_id
       WHERE LOWER(n1.tipo_dest) = 'factura'
         AND n1.estatus_dest NOT IN ('cancelado','cancelada')
       GROUP BY n1.doc_id
     ),
     intermedios AS (
       SELECT n1.doc_id, n1.partida_destino_id
       FROM nivel1 n1
       WHERE LOWER(n1.tipo_dest) != 'factura'
         AND n1.estatus_dest NOT IN ('cancelado','cancelada')
     ),
     facturado_nivel2 AS (
       SELECT i.doc_id, COALESCE(SUM(dp_f2.total_partida), 0)::numeric AS monto
       FROM intermedios i
       JOIN documentos_partidas_vinculos dpv2 ON dpv2.partida_origen_id = i.partida_destino_id
       JOIN documentos d_f2 ON d_f2.id = dpv2.documento_destino_id
       JOIN documentos_partidas dp_f2 ON dp_f2.id = dpv2.partida_destino_id
       WHERE LOWER(d_f2.tipo_documento) = 'factura'
         AND LOWER(COALESCE(d_f2.estatus_documento,'')) NOT IN ('cancelado','cancelada')
         AND d_f2.empresa_id = $1
       GROUP BY i.doc_id
     ),
     total_facturado AS (
       SELECT doc_id, SUM(monto) AS total_facturado
       FROM (
         SELECT doc_id, monto FROM facturado_nivel1
         UNION ALL
         SELECT doc_id, monto FROM facturado_nivel2
       ) t
       GROUP BY doc_id
     )
     SELECT
       db.doc_id,
       db.serie, db.numero,
       db.fecha,
       COALESCE(c.nombre, '—') AS cliente_nombre,
       db.contacto_principal_id AS cliente_id,
       db.total_doc,
       COALESCE(tf.total_facturado, 0)::numeric AS total_facturado,
       (db.total_doc - COALESCE(tf.total_facturado, 0))::numeric AS total_pendiente,
       ROUND(
         COALESCE(tf.total_facturado, 0) * 100.0 / NULLIF(db.total_doc, 0), 1
       )::numeric AS pct_avance
     FROM doc_base db
     LEFT JOIN total_facturado tf ON tf.doc_id = db.doc_id
     LEFT JOIN contactos c ON c.id = db.contacto_principal_id AND c.empresa_id = $1
     WHERE (db.total_doc - COALESCE(tf.total_facturado, 0)) > 0.01
     ORDER BY db.fecha ASC, db.doc_id ASC`,
    args
  );

  const documentos: PendienteFacturarDoc[] = rows.map((r) => ({
    doc_id:          r.doc_id as number,
    folio:           formatearFolioDocumento(String(r.serie ?? ''), Number(r.numero ?? 0)),
    fecha:           toFecha(r.fecha),
    cliente_id:      r.cliente_id != null ? (r.cliente_id as number) : null,
    cliente_nombre:  String(r.cliente_nombre ?? '—'),
    total_doc:       Number(r.total_doc ?? 0),
    total_facturado: Number(r.total_facturado ?? 0),
    total_pendiente: Number(r.total_pendiente ?? 0),
    pct_avance:      Number(r.pct_avance ?? 0),
  }));

  return { fecha_inicio: fechaInicio, fecha_fin: fechaFin, documentos };
}

export async function obtenerPedidosPendientesFacturar(params: {
  empresaId:   number;
  fechaInicio: string;
  fechaFin:    string;
  contactoId?: number | null;
}): Promise<PendientesFacturarResult> {
  return _obtenerPendientesFacturar('pedido', params);
}

export async function obtenerRemisionesPendientesFacturar(params: {
  empresaId:   number;
  fechaInicio: string;
  fechaFin:    string;
  contactoId?: number | null;
}): Promise<PendientesFacturarResult> {
  return _obtenerPendientesFacturar('remision', params);
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

export async function obtenerVencimientosProveedores(params: {
  empresaId: number;
  fechaCorte: string;
  contactoId?: number | null;
  moneda?: string | null;
}): Promise<VencimientosProveedoresResult> {
  const { empresaId, fechaCorte, contactoId, moneda } = params;

  const args: unknown[] = [empresaId, fechaCorte];
  const filtros: string[] = [];

  if (contactoId) {
    args.push(contactoId);
    filtros.push(`AND d.contacto_principal_id = $${args.length}`);
  }
  if (moneda) {
    args.push(moneda);
    filtros.push(`AND UPPER(d.moneda) = UPPER($${args.length})`);
  }

  const { rows } = await pool.query(
    `WITH base AS (
       SELECT
         d.id,
         d.contacto_principal_id                                        AS proveedor_id,
         COALESCE(d.moneda, 'MXN')                                      AS moneda,
         d.fecha_vencimiento::date                                     AS fecha_vencimiento,
         (d.fecha_vencimiento::date - $2::date)::int                   AS dias,
         COALESCE(c.nombre, '')                                         AS proveedor_nombre,
         COALESCE(d.serie, '')                                          AS serie,
         COALESCE(d.numero, 0)::int                                    AS numero,
         COALESCE(d.serie_externa, '')                                  AS serie_externa,
         COALESCE(d.numero_externo, 0)::int                            AS numero_externo,
         COALESCE(d.total, 0)::numeric                                  AS total,
         (COALESCE(d.total, 0)::numeric - COALESCE(
           (SELECT SUM(a.monto_moneda_documento)
            FROM aplicaciones_saldo a
            WHERE a.documento_destino_id = d.id
              AND a.empresa_id = d.empresa_id
              AND COALESCE(a.fecha_aplicacion::date, NOW()::date) <= $2::date
           ), 0
         ))                                                             AS saldo
       FROM documentos d
       LEFT JOIN contactos c
         ON c.id = d.contacto_principal_id AND c.empresa_id = d.empresa_id
       WHERE d.empresa_id = $1
         AND d.tipo_documento = 'factura_compra'
         AND d.fecha_vencimiento IS NOT NULL
         AND LOWER(COALESCE(d.estatus_documento, '')) NOT IN ('cancelado', 'cancelada', 'borrador')
         ${filtros.join(' ')}
     )
     SELECT * FROM base WHERE saldo > 0 ORDER BY fecha_vencimiento ASC`,
    args
  );

  const vencimientos: VencimientoProveedor[] = rows.map((r) => {
    const serieExt = String(r.serie_externa ?? '').trim();
    const numExt   = Number(r.numero_externo ?? 0);
    const refProveedor = (serieExt || numExt > 0)
      ? formatearFolioDocumento(serieExt, numExt)
      : '';

    return {
      id:                   r.id as number,
      proveedor_id:         r.proveedor_id as number | null,
      moneda:               String(r.moneda ?? 'MXN'),
      fecha_vencimiento:    toFecha(r.fecha_vencimiento),
      dias:                 Number(r.dias),
      proveedor_nombre:     String(r.proveedor_nombre ?? ''),
      folio:                formatearFolioDocumento(String(r.serie ?? ''), Number(r.numero ?? 0)),
      referencia_proveedor: refProveedor,
      total:                Number(r.total ?? 0),
      saldo:                Number(r.saldo ?? 0),
    };
  });

  return { fecha_corte: fechaCorte, vencimientos };
}

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

export async function obtenerVencimientosClientes(params: {
  empresaId: number;
  fechaCorte: string;
  contactoId?: number | null;
  moneda?: string | null;
}): Promise<VencimientosClientesResult> {
  const { empresaId, fechaCorte, contactoId, moneda } = params;
  const args: unknown[] = [empresaId, fechaCorte];
  const filtros: string[] = [];

  if (contactoId) {
    args.push(contactoId);
    filtros.push(`AND d.contacto_principal_id = $${args.length}`);
  }
  if (moneda) {
    args.push(moneda);
    filtros.push(`AND UPPER(d.moneda) = UPPER($${args.length})`);
  }

  const { rows } = await pool.query(
    `WITH base AS (
       SELECT
         d.id,
         d.fecha_vencimiento::date                                     AS fecha_vencimiento,
         (d.fecha_vencimiento::date - $2::date)::int                   AS dias,
         COALESCE(c.nombre, '')                                         AS cliente_nombre,
         COALESCE(d.serie, '')                                          AS serie,
         COALESCE(d.numero, 0)::int                                    AS numero,
         COALESCE(d.total, 0)::numeric                                  AS total,
         (COALESCE(d.total, 0)::numeric - COALESCE(
           (SELECT SUM(a.monto_moneda_documento)
            FROM aplicaciones_saldo a
            WHERE a.documento_destino_id = d.id
              AND a.empresa_id = d.empresa_id
              AND COALESCE(a.fecha_aplicacion::date, NOW()::date) <= $2::date
           ), 0
         ))                                                             AS saldo
       FROM documentos d
       LEFT JOIN contactos c
         ON c.id = d.contacto_principal_id AND c.empresa_id = d.empresa_id
       WHERE d.empresa_id = $1
         AND d.tipo_documento = 'factura'
         AND d.fecha_vencimiento IS NOT NULL
         AND LOWER(COALESCE(d.estatus_documento, '')) NOT IN ('cancelado', 'cancelada', 'borrador')
         ${filtros.join(' ')}
     )
     SELECT * FROM base WHERE saldo > 0 ORDER BY fecha_vencimiento ASC`,
    args
  );

  const vencimientos: VencimientoCliente[] = rows.map((r) => ({
    id:                r.id as number,
    fecha_vencimiento: toFecha(r.fecha_vencimiento),
    dias:              Number(r.dias),
    cliente_nombre:    String(r.cliente_nombre ?? ''),
    folio:             formatearFolioDocumento(String(r.serie ?? ''), Number(r.numero ?? 0)),
    total:             Number(r.total ?? 0),
    saldo:             Number(r.saldo ?? 0),
  }));

  return { fecha_corte: fechaCorte, vencimientos };
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

async function obtenerPagosBase(params: {
  empresaId: number;
  fechaInicio: string;
  fechaFin: string;
  contactoId?: number | null;
  cuentaId?: number | null;
  naturaleza: 'cobro_cliente' | 'pago_proveedor';
}): Promise<PagosResult> {
  const { empresaId, fechaInicio, fechaFin, contactoId, cuentaId, naturaleza } = params;
  const args: unknown[] = [empresaId, fechaInicio, fechaFin, naturaleza];
  const filtros: string[] = [];

  if (contactoId) {
    args.push(contactoId);
    filtros.push(`AND fo.contacto_id = $${args.length}`);
  }
  if (cuentaId) {
    args.push(cuentaId);
    filtros.push(`AND fo.cuenta_id = $${args.length}`);
  }

  const { rows } = await pool.query(
    `SELECT
       fo.id,
       fo.fecha,
       fo.monto,
       fo.referencia,
       fo.estado_conciliacion,
       fo.contacto_id,
       fo.cuenta_id,
       COALESCE(c.nombre, '')           AS contacto_nombre,
       c.rfc                            AS contacto_rfc,
       COALESCE(fc.identificador, '')   AS cuenta_nombre,
       COALESCE(fc.moneda, 'MXN')       AS cuenta_moneda,
       COALESCE(d.serie, '')            AS doc_serie,
       COALESCE(d.numero, 0)::int       AS doc_numero,
       COALESCE(co.nombre_concepto, '') AS concepto_nombre,
       mp.nombre                        AS metodo_pago_nombre
     FROM finanzas_operaciones fo
     LEFT JOIN contactos c
       ON c.id  = fo.contacto_id  AND c.empresa_id  = fo.empresa_id
     LEFT JOIN finanzas_cuentas fc
       ON fc.id = fo.cuenta_id    AND fc.empresa_id = fo.empresa_id
     LEFT JOIN documentos d
       ON d.id  = fo.documento_origen_id AND d.empresa_id = fo.empresa_id
     LEFT JOIN conceptos co
       ON co.id          = fo.concepto_id
      AND co.empresa_id  = fo.empresa_id
     LEFT JOIN public.finanzas_metodos_pago mp
       ON mp.id          = fo.metodo_pago_id
      AND mp.empresa_id  = fo.empresa_id
     WHERE fo.empresa_id            = $1
       AND fo.fecha BETWEEN $2 AND $3
       AND fo.naturaleza_operacion  = $4
       ${filtros.join(' ')}
     ORDER BY fo.fecha DESC, fo.id DESC`,
    args
  );

  const pagos: PagoRegistrado[] = rows.map((r) => ({
    id:                  r.id as number,
    fecha:               toFecha(r.fecha),
    folio:               formatearFolioDocumento(String(r.doc_serie ?? ''), Number(r.doc_numero ?? 0)),
    contacto_id:         r.contacto_id as number | null,
    contacto_nombre:     String(r.contacto_nombre ?? ''),
    contacto_rfc:        r.contacto_rfc ? String(r.contacto_rfc) : null,
    cuenta_id:           r.cuenta_id as number,
    cuenta_nombre:       String(r.cuenta_nombre ?? ''),
    cuenta_moneda:       String(r.cuenta_moneda ?? 'MXN'),
    monto:               Number(r.monto ?? 0),
    referencia:          r.referencia ? String(r.referencia) : null,
    concepto_nombre:     r.concepto_nombre ? String(r.concepto_nombre) : null,
    estado_conciliacion: String(r.estado_conciliacion ?? 'pendiente'),
    metodo_pago_nombre:  r.metodo_pago_nombre ? String(r.metodo_pago_nombre) : null,
  }));

  return {
    fecha_inicio: fechaInicio,
    fecha_fin:    fechaFin,
    total:        pagos.reduce((s, p) => s + p.monto, 0),
    pagos,
  };
}

export const obtenerPagosClientes = (p: Omit<Parameters<typeof obtenerPagosBase>[0], 'naturaleza'>) =>
  obtenerPagosBase({ ...p, naturaleza: 'cobro_cliente' });

export const obtenerPagosProveedores = (p: Omit<Parameters<typeof obtenerPagosBase>[0], 'naturaleza'>) =>
  obtenerPagosBase({ ...p, naturaleza: 'pago_proveedor' });

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

export async function obtenerPosicionTesoreria(empresaId: number): Promise<PosicionTesoreriaResult> {
  const { rows } = await pool.query(
    `SELECT
       id, identificador, tipo_cuenta, moneda, saldo,
       COALESCE(saldo_conciliado, 0)   AS saldo_conciliado,
       fecha_ultima_conciliacion,
       es_cuenta_efectivo,
       afecta_total_disponible
     FROM finanzas_cuentas
     WHERE empresa_id   = $1
       AND cuenta_cerrada = false
     ORDER BY moneda, tipo_cuenta, identificador`,
    [empresaId]
  );

  const cuentas: CuentaTesoreria[] = rows.map((r) => ({
    id:                       r.id as number,
    identificador:             String(r.identificador ?? ''),
    tipo_cuenta:               String(r.tipo_cuenta ?? ''),
    moneda:                    String(r.moneda ?? 'MXN'),
    saldo:                     Number(r.saldo ?? 0),
    saldo_conciliado:          Number(r.saldo_conciliado ?? 0),
    fecha_ultima_conciliacion: r.fecha_ultima_conciliacion ? toFecha(r.fecha_ultima_conciliacion) : null,
    es_cuenta_efectivo:        Boolean(r.es_cuenta_efectivo),
    afecta_total_disponible:   Boolean(r.afecta_total_disponible),
  }));

  const monedaMap = new Map<string, TotalPorMoneda>();
  for (const c of cuentas) {
    if (!monedaMap.has(c.moneda)) {
      monedaMap.set(c.moneda, { moneda: c.moneda, saldo: 0, saldo_conciliado: 0, cantidad_cuentas: 0 });
    }
    const t = monedaMap.get(c.moneda)!;
    t.saldo += c.saldo;
    t.saldo_conciliado += c.saldo_conciliado;
    t.cantidad_cuentas += 1;
  }

  return {
    fecha_consulta:    new Date().toISOString().slice(0, 10),
    cuentas,
    totales_por_moneda: Array.from(monedaMap.values()).sort((a, b) => a.moneda.localeCompare(b.moneda)),
  };
}

// ── Cartera Vencida con fecha_base configurable ───────────────────────────────

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

export async function obtenerCarteraVencida(params: {
  empresaId: number;
  fechaBase?: string;
  tipoDocumento?: 'factura' | 'factura_compra' | null;
}): Promise<CarteraVencidaResult> {
  const { empresaId } = params;
  const fechaBase = params.fechaBase || new Date().toISOString().slice(0, 10);
  const tiposDoc  = params.tipoDocumento ? [params.tipoDocumento] : ['factura', 'factura_compra'];

  const { rows } = await pool.query(
    `SELECT
       d.id                                                               AS documento_id,
       d.contacto_principal_id                                            AS contacto_id,
       COALESCE(c.nombre, '')                                             AS contacto_nombre,
       d.fecha_documento,
       d.fecha_vencimiento,
       d.tipo_documento,
       COALESCE(d.serie, '')                                              AS serie,
       COALESCE(d.numero, 0)::int                                         AS numero,
       COALESCE(d.moneda, 'MXN')                                          AS moneda,
       COALESCE(d.total, 0)::numeric                                      AS total,
       COALESCE(d.total, 0)::numeric
         - COALESCE(SUM(
             CASE WHEN COALESCE(a.fecha_aplicacion::date, NOW()::date) <= $2::date
               THEN a.monto ELSE 0 END
           ), 0)                                                           AS saldo,
       ($2::date - COALESCE(d.fecha_vencimiento, d.fecha_documento)::date)::int AS dias
     FROM documentos d
     LEFT JOIN contactos c
       ON c.id = d.contacto_principal_id AND c.empresa_id = d.empresa_id
     LEFT JOIN aplicaciones_saldo a
       ON a.documento_destino_id = d.id AND a.empresa_id = d.empresa_id
     WHERE d.empresa_id = $1
       AND d.tipo_documento = ANY($3::text[])
       AND LOWER(COALESCE(d.estatus_documento, '')) NOT IN ('cancelado', 'cancelada', 'borrador')
       AND COALESCE(d.fecha_vencimiento, d.fecha_documento)::date <= $2::date
     GROUP BY
       d.id, d.contacto_principal_id, c.nombre,
       d.fecha_documento, d.fecha_vencimiento, d.tipo_documento, d.serie, d.numero, d.moneda, d.total
     HAVING COALESCE(d.total, 0)::numeric
              - COALESCE(SUM(
                  CASE WHEN COALESCE(a.fecha_aplicacion::date, NOW()::date) <= $2::date
                    THEN a.monto ELSE 0 END
                ), 0) > 0.001
     ORDER BY d.contacto_principal_id NULLS LAST, COALESCE(d.fecha_vencimiento, d.fecha_documento) ASC`,
    [empresaId, fechaBase, tiposDoc]
  );

  const detalle: CarteraVencidaRow[] = rows.map((r) => {
    const dias = Number(r.dias ?? 0);
    const bucket: CarteraVencidaRow['bucket'] =
      dias <= 30 ? '0-30' : dias <= 60 ? '31-60' : dias <= 90 ? '61-90' : '90+';
    return {
      documento_id:    r.documento_id as number,
      contacto_id:     r.contacto_id as number | null,
      contacto_nombre: String(r.contacto_nombre ?? ''),
      fecha_documento: toFecha(r.fecha_documento),
      tipo_documento:  String(r.tipo_documento ?? ''),
      folio:           formatearFolioDocumento(String(r.serie ?? ''), Number(r.numero ?? 0)),
      moneda:          String(r.moneda ?? 'MXN'),
      total:           Number(r.total ?? 0),
      saldo:           Number(r.saldo ?? 0),
      dias,
      bucket,
    };
  });

  const resumenMap = new Map<string, CarteraVencidaResumenRow>();
  for (const row of detalle) {
    const key = String(row.contacto_id ?? '__sin_contacto__') + '_' + row.moneda;
    if (!resumenMap.has(key)) {
      resumenMap.set(key, {
        contacto_id:    row.contacto_id,
        contacto_nombre: row.contacto_nombre,
        moneda:         row.moneda,
        bucket_0_30: 0, bucket_31_60: 0, bucket_61_90: 0, bucket_90_plus: 0, total: 0,
      });
    }
    const res = resumenMap.get(key)!;
    if (row.bucket === '0-30')  res.bucket_0_30  += row.saldo;
    if (row.bucket === '31-60') res.bucket_31_60 += row.saldo;
    if (row.bucket === '61-90') res.bucket_61_90 += row.saldo;
    if (row.bucket === '90+')   res.bucket_90_plus += row.saldo;
    res.total += row.saldo;
  }

  const resumen = Array.from(resumenMap.values())
    .sort((a, b) => {
      const cmp = a.contacto_nombre.localeCompare(b.contacto_nombre, 'es');
      return cmp !== 0 ? cmp : a.moneda.localeCompare(b.moneda);
    });

  const totalesMap = new Map<string, TotalCarteraMoneda>();
  for (const r of resumen) {
    if (!totalesMap.has(r.moneda)) {
      totalesMap.set(r.moneda, {
        moneda: r.moneda,
        bucket_0_30: 0, bucket_31_60: 0, bucket_61_90: 0, bucket_90_plus: 0, total: 0,
      });
    }
    const t = totalesMap.get(r.moneda)!;
    t.bucket_0_30  += r.bucket_0_30;
    t.bucket_31_60 += r.bucket_31_60;
    t.bucket_61_90 += r.bucket_61_90;
    t.bucket_90_plus += r.bucket_90_plus;
    t.total += r.total;
  }

  const totales = Array.from(totalesMap.values()).sort((a, b) => a.moneda.localeCompare(b.moneda));

  return { fecha_base: fechaBase, detalle, resumen, totales };
}

// ── Movimientos No Conciliados ─────────────────────────────────────────────────

export type MovimientoNoConciliado = {
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
};

export type MovimientosNoConciliadosResult = {
  fecha_corte: string;
  movimientos: MovimientoNoConciliado[];
};

export async function obtenerMovimientosNoConciliados(params: {
  empresaId: number;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  cuentaId?: number | null;
  estadoConciliacion?: string | null;
  tipoMovimiento?: string | null;
  naturaleza?: string | null;
  contactoId?: number | null;
  metodoPagoId?: number | null;
  minDias?: number | null;
}): Promise<MovimientosNoConciliadosResult> {
  const hoy = new Date().toISOString().slice(0, 10);
  const fechaCorte = params.fechaFin || hoy;

  const args: unknown[] = [params.empresaId, fechaCorte];
  const conds: string[] = [];

  if (params.fechaInicio) {
    args.push(params.fechaInicio);
    conds.push(`AND fo.fecha >= $${args.length}`);
  }
  if (params.fechaFin) {
    conds.push(`AND fo.fecha <= $2`);
  }
  if (params.cuentaId) {
    args.push(params.cuentaId);
    conds.push(`AND fo.cuenta_id = $${args.length}`);
  }
  if (params.estadoConciliacion && params.estadoConciliacion !== 'todos') {
    args.push(params.estadoConciliacion);
    conds.push(`AND fo.estado_conciliacion = $${args.length}`);
  }
  if (params.tipoMovimiento && params.tipoMovimiento !== 'todos') {
    args.push(params.tipoMovimiento);
    conds.push(`AND fo.tipo_movimiento = $${args.length}`);
  }
  if (params.naturaleza && params.naturaleza !== 'todos') {
    args.push(params.naturaleza);
    conds.push(`AND fo.naturaleza_operacion = $${args.length}`);
  }
  if (params.contactoId) {
    args.push(params.contactoId);
    conds.push(`AND fo.contacto_id = $${args.length}`);
  }
  if (params.metodoPagoId) {
    args.push(params.metodoPagoId);
    conds.push(`AND fo.metodo_pago_id = $${args.length}`);
  }
  if (params.minDias != null && params.minDias > 0) {
    args.push(params.minDias);
    conds.push(`AND ($2::date - fo.fecha)::int >= $${args.length}`);
  }

  const { rows } = await pool.query(
    `SELECT
       fo.id,
       fo.fecha,
       fo.cuenta_id,
       fo.tipo_movimiento,
       fo.naturaleza_operacion,
       fo.monto,
       fo.referencia,
       fo.observaciones,
       fo.estado_conciliacion,
       ($2::date - fo.fecha)::int                              AS dias_sin_conciliar,
       fo.contacto_id,
       fo.documento_origen_id,
       COALESCE(fc.identificador, '')                          AS cuenta_nombre,
       COALESCE(fc.moneda, 'MXN')                             AS cuenta_moneda,
       c.nombre                                                AS contacto_nombre,
       co.nombre_concepto                                      AS concepto_nombre,
       mp.nombre                                               AS metodo_pago_nombre,
       CASE
         WHEN d.id IS NOT NULL
           THEN COALESCE(d.serie, '') || CAST(COALESCE(d.numero, 0) AS text)
         ELSE NULL
       END                                                     AS documento_folio
     FROM finanzas_operaciones fo
     JOIN finanzas_cuentas fc
       ON fc.id = fo.cuenta_id AND fc.empresa_id = fo.empresa_id
       AND NOT COALESCE(fc.cuenta_cerrada, false)
     LEFT JOIN contactos c
       ON c.id = fo.contacto_id AND c.empresa_id = fo.empresa_id
     LEFT JOIN conceptos co
       ON co.id = fo.concepto_id AND co.empresa_id = fo.empresa_id
     LEFT JOIN finanzas_metodos_pago mp
       ON mp.id = fo.metodo_pago_id AND mp.empresa_id = fo.empresa_id
     LEFT JOIN documentos d
       ON d.id = fo.documento_origen_id AND d.empresa_id = fo.empresa_id
     WHERE fo.empresa_id = $1
       AND fo.estado_conciliacion IN ('pendiente', 'cotejado')
       ${conds.join(' ')}
     ORDER BY fo.fecha ASC, fo.id ASC`,
    args
  );

  const movimientos: MovimientoNoConciliado[] = rows.map((r) => ({
    id:                   r.id as number,
    fecha:                String(r.fecha).slice(0, 10),
    cuenta_id:            r.cuenta_id as number,
    cuenta_nombre:        String(r.cuenta_nombre ?? ''),
    cuenta_moneda:        String(r.cuenta_moneda ?? 'MXN'),
    tipo_movimiento:      String(r.tipo_movimiento ?? ''),
    naturaleza_operacion: String(r.naturaleza_operacion ?? 'movimiento_general'),
    monto:                Number(r.monto ?? 0),
    moneda:               String(r.cuenta_moneda ?? 'MXN'),
    referencia:           r.referencia ? String(r.referencia) : null,
    observaciones:        r.observaciones ? String(r.observaciones) : null,
    estado_conciliacion:  String(r.estado_conciliacion ?? 'pendiente'),
    dias_sin_conciliar:   Number(r.dias_sin_conciliar ?? 0),
    contacto_id:          r.contacto_id as number | null,
    contacto_nombre:      r.contacto_nombre ? String(r.contacto_nombre) : null,
    concepto_nombre:      r.concepto_nombre ? String(r.concepto_nombre) : null,
    metodo_pago_nombre:   r.metodo_pago_nombre ? String(r.metodo_pago_nombre) : null,
    documento_origen_id:  r.documento_origen_id as number | null,
    documento_folio:      r.documento_folio ? String(r.documento_folio) : null,
  }));

  return { fecha_corte: fechaCorte, movimientos };
}

// ════════════════════════════════════════════════════════════════════════════
// INVENTARIO
// ════════════════════════════════════════════════════════════════════════════

function isoDate(v: unknown): string {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

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

export async function obtenerExistenciasPorAlmacen(params: {
  empresaId: number;
  almacenId: number | null;
  productoId: number | null;
  soloConExistencia: boolean;
  soloBajoMinimo: boolean;
  familia: string | null;
}): Promise<ExistenciasPorAlmacenResult> {
  const { empresaId, almacenId, productoId, soloConExistencia, soloBajoMinimo, familia } = params;

  const { rows } = await pool.query(
    `SELECT
       p.id       AS producto_id,
       p.clave,
       p.descripcion,
       COALESCE(p.familia, '')  AS familia,
       a.id       AS almacen_id,
       a.nombre   AS almacen,
       COALESCE(e.existencia, 0)                                                          AS existencia,
       COALESCE(p.minimo_inventario, 0)                                                   AS minimo_inventario,
       COALESCE(e.existencia, 0) - COALESCE(p.minimo_inventario, 0)                      AS diferencia_minimo,
       COALESCE(p.costo_promedio, p.ultimo_costo, p.costo_estandar, 0)                   AS costo_unitario,
       COALESCE(e.existencia, 0) * COALESCE(p.costo_promedio, p.ultimo_costo, p.costo_estandar, 0) AS valor_inventario,
       e.updated_at AS ultima_fecha
     FROM inventario.existencias e
     JOIN inventario.almacenes a ON a.id = e.almacen_id AND a.empresa_id = e.empresa_id
     JOIN public.productos p     ON p.id = e.producto_id AND p.empresa_id = e.empresa_id
     WHERE e.empresa_id = $1
       AND ($2::int IS NULL OR e.almacen_id = $2)
       AND ($3::int IS NULL OR e.producto_id = $3)
       AND (NOT $4::boolean OR e.existencia > 0)
       AND (NOT $5::boolean OR (p.minimo_inventario IS NOT NULL AND p.minimo_inventario > 0 AND e.existencia < p.minimo_inventario))
       AND ($6::text IS NULL OR p.familia = $6)
     ORDER BY p.descripcion, a.nombre`,
    [empresaId, almacenId, productoId, soloConExistencia, soloBajoMinimo, familia]
  );

  const lineas: ExistenciaPorAlmacen[] = rows.map((r) => ({
    producto_id:      Number(r.producto_id),
    clave:            String(r.clave),
    descripcion:      String(r.descripcion),
    familia:          String(r.familia ?? ''),
    almacen_id:       Number(r.almacen_id),
    almacen:          String(r.almacen),
    existencia:       Number(r.existencia ?? 0),
    minimo_inventario: Number(r.minimo_inventario ?? 0),
    diferencia_minimo: Number(r.diferencia_minimo ?? 0),
    costo_unitario:   Number(r.costo_unitario ?? 0),
    valor_inventario: Number(r.valor_inventario ?? 0),
    ultima_fecha:     r.ultima_fecha ? isoDate(r.ultima_fecha) : null,
  }));

  return {
    lineas,
    total_valor:     lineas.reduce((s, l) => s + l.valor_inventario, 0),
    total_productos: lineas.length,
  };
}

// ── Kardex ───────────────────────────────────────────────────────────────────

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

export async function obtenerKardexProducto(params: {
  empresaId: number;
  productoId: number;
  almacenId: number | null;
  fechaInicio: string;
  fechaFin: string;
  tipoMovimiento: string | null;
}): Promise<KardexResult> {
  const { empresaId, productoId, almacenId, fechaInicio, fechaFin, tipoMovimiento } = params;

  const [{ rows: prodRows }, { rows }] = await Promise.all([
    pool.query(
      `SELECT clave, descripcion FROM public.productos WHERE id = $1 AND empresa_id = $2`,
      [productoId, empresaId]
    ),
    pool.query(
      `SELECT
         mp.fecha_movimiento::date                                          AS fecha,
         m.tipo_movimiento,
         d.serie                                                            AS doc_serie,
         d.numero                                                           AS doc_numero,
         d.serie_externa                                                    AS doc_serie_externa,
         d.numero_externo                                                   AS doc_numero_externo,
         d.tipo_documento                                                   AS doc_tipo,
         a.nombre                                                           AS almacen,
         CASE WHEN mp.signo = 1 THEN mp.cantidad ELSE 0 END                AS entrada,
         CASE WHEN mp.signo = -1 THEN mp.cantidad ELSE 0 END               AS salida,
         mp.existencia_resultante                                           AS existencia_despues,
         mp.costo_unitario,
         mp.cantidad * COALESCE(mp.costo_unitario, 0)                      AS valor,
         m.observaciones
       FROM inventario.movimientos_partidas mp
       JOIN inventario.movimientos m  ON m.id = mp.movimiento_id AND m.empresa_id = mp.empresa_id
       JOIN inventario.almacenes a    ON a.id = mp.almacen_id    AND a.empresa_id = mp.empresa_id
       LEFT JOIN public.documentos d  ON d.id = m.documento_id   AND d.empresa_id = mp.empresa_id
       WHERE mp.empresa_id = $1
         AND mp.producto_id = $2
         AND ($3::int IS NULL OR mp.almacen_id = $3)
         AND mp.fecha_movimiento >= $4::date
         AND mp.fecha_movimiento <  $5::date + INTERVAL '1 day'
         AND ($6::text IS NULL OR m.tipo_movimiento = $6)
       ORDER BY mp.fecha_movimiento, mp.id`,
      [empresaId, productoId, almacenId, fechaInicio, fechaFin, tipoMovimiento]
    ),
  ]);

  const prod = prodRows[0] ?? null;

  const lineas: KardexLinea[] = rows.map((r) => ({
    fecha:              isoDate(r.fecha),
    tipo_movimiento:    String(r.tipo_movimiento ?? ''),
    doc_serie:          r.doc_serie          ? String(r.doc_serie)          : null,
    doc_numero:         r.doc_numero         != null ? Number(r.doc_numero) : null,
    doc_serie_externa:  r.doc_serie_externa  ? String(r.doc_serie_externa)  : null,
    doc_numero_externo: r.doc_numero_externo != null ? Number(r.doc_numero_externo) : null,
    doc_tipo:           r.doc_tipo           ? String(r.doc_tipo)           : null,
    almacen:            String(r.almacen ?? ''),
    entrada:            Number(r.entrada ?? 0),
    salida:             Number(r.salida ?? 0),
    existencia_despues: Number(r.existencia_despues ?? 0),
    costo_unitario:     r.costo_unitario != null ? Number(r.costo_unitario) : null,
    valor:              Number(r.valor ?? 0),
    observaciones:      r.observaciones ? String(r.observaciones) : null,
  }));

  return {
    fecha_inicio:         fechaInicio,
    fecha_fin:            fechaFin,
    producto_id:          productoId,
    producto_clave:       prod ? String(prod.clave) : '',
    producto_descripcion: prod ? String(prod.descripcion) : '',
    lineas,
  };
}

// ── Movimientos por período ───────────────────────────────────────────────────

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

export type MovimientosInventarioPeriodoResult = {
  fecha_inicio: string;
  fecha_fin: string;
  lineas: MovimientoInventario[];
  total_entradas: number;
  total_salidas: number;
  total_valor: number;
};

export async function obtenerMovimientosInventarioPeriodo(params: {
  empresaId: number;
  fechaInicio: string;
  fechaFin: string;
  almacenId: number | null;
  productoId: number | null;
  tipoMovimiento: string | null;
}): Promise<MovimientosInventarioPeriodoResult> {
  const { empresaId, fechaInicio, fechaFin, almacenId, productoId, tipoMovimiento } = params;

  const { rows } = await pool.query(
    `SELECT
       mp.fecha_movimiento::date                                            AS fecha,
       m.tipo_movimiento,
       p.id                                                                 AS producto_id,
       p.clave                                                              AS producto_clave,
       p.descripcion                                                        AS producto_descripcion,
       a.nombre                                                             AS almacen,
       mp.cantidad,
       mp.signo,
       CASE WHEN mp.signo = 1 THEN 'Entrada' ELSE 'Salida' END            AS tipo_signo,
       mp.costo_unitario,
       mp.cantidad * COALESCE(mp.costo_unitario, 0)                        AS valor,
       d.serie                                                              AS doc_serie,
       d.numero                                                             AS doc_numero,
       d.serie_externa                                                      AS doc_serie_externa,
       d.numero_externo                                                     AS doc_numero_externo,
       d.tipo_documento                                                     AS doc_tipo,
       m.observaciones
     FROM inventario.movimientos_partidas mp
     JOIN inventario.movimientos m ON m.id = mp.movimiento_id AND m.empresa_id = mp.empresa_id
     JOIN public.productos p       ON p.id = mp.producto_id   AND p.empresa_id = mp.empresa_id
     JOIN inventario.almacenes a   ON a.id = mp.almacen_id    AND a.empresa_id = mp.empresa_id
     LEFT JOIN public.documentos d ON d.id = m.documento_id   AND d.empresa_id = mp.empresa_id
     WHERE mp.empresa_id = $1
       AND mp.fecha_movimiento >= $2::date
       AND mp.fecha_movimiento <  $3::date + INTERVAL '1 day'
       AND ($4::int IS NULL OR mp.almacen_id = $4)
       AND ($5::int IS NULL OR mp.producto_id = $5)
       AND ($6::text IS NULL OR m.tipo_movimiento = $6)
     ORDER BY mp.fecha_movimiento, mp.id`,
    [empresaId, fechaInicio, fechaFin, almacenId, productoId, tipoMovimiento]
  );

  const lineas: MovimientoInventario[] = rows.map((r) => ({
    fecha:                isoDate(r.fecha),
    tipo_movimiento:      String(r.tipo_movimiento ?? ''),
    producto_id:          Number(r.producto_id),
    producto_clave:       String(r.producto_clave ?? ''),
    producto_descripcion: String(r.producto_descripcion ?? ''),
    almacen:              String(r.almacen ?? ''),
    cantidad:             Number(r.cantidad ?? 0),
    signo:                Number(r.signo ?? 1),
    tipo_signo:           String(r.tipo_signo ?? ''),
    costo_unitario:       r.costo_unitario != null ? Number(r.costo_unitario) : null,
    valor:                Number(r.valor ?? 0),
    doc_serie:            r.doc_serie   ? String(r.doc_serie)   : null,
    doc_numero:           r.doc_numero  != null ? Number(r.doc_numero) : null,
    doc_serie_externa:    r.doc_serie_externa  ? String(r.doc_serie_externa)  : null,
    doc_numero_externo:   r.doc_numero_externo != null ? Number(r.doc_numero_externo) : null,
    doc_tipo:             r.doc_tipo    ? String(r.doc_tipo)    : null,
    observaciones:        r.observaciones ? String(r.observaciones) : null,
  }));

  const totalEntradas = lineas.filter((l) => l.signo === 1).reduce((s, l) => s + l.cantidad, 0);
  const totalSalidas  = lineas.filter((l) => l.signo === -1).reduce((s, l) => s + l.cantidad, 0);
  const totalValor    = lineas.reduce((s, l) => s + l.valor, 0);

  return { fecha_inicio: fechaInicio, fecha_fin: fechaFin, lineas, total_entradas: totalEntradas, total_salidas: totalSalidas, total_valor: totalValor };
}

// ── Productos bajo mínimo ─────────────────────────────────────────────────────

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

export async function obtenerProductosBajoMinimo(params: {
  empresaId: number;
  almacenId: number | null;
  familia: string | null;
}): Promise<ProductosBajoMinimoResult> {
  const { empresaId, almacenId, familia } = params;

  const { rows } = await pool.query(
    `SELECT
       p.id                                                                           AS producto_id,
       p.clave,
       p.descripcion,
       COALESCE(p.familia, '')                                                        AS familia,
       e.almacen_id,
       a.nombre                                                                       AS almacen,
       COALESCE(e.existencia, 0)                                                     AS existencia,
       p.minimo_inventario,
       p.minimo_inventario - COALESCE(e.existencia, 0)                               AS faltante,
       c.nombre                                                                       AS proveedor_nombre,
       COALESCE(p.ultimo_costo, p.costo_promedio, p.costo_estandar, 0)              AS ultimo_costo,
       (p.minimo_inventario - COALESCE(e.existencia, 0))
         * COALESCE(p.ultimo_costo, p.costo_promedio, p.costo_estandar, 0)          AS valor_faltante
     FROM public.productos p
     LEFT JOIN inventario.existencias e
       ON e.producto_id = p.id AND e.empresa_id = p.empresa_id
       AND ($1::int IS NULL OR e.almacen_id = $1)
     LEFT JOIN inventario.almacenes a
       ON a.id = e.almacen_id AND a.empresa_id = e.empresa_id
     LEFT JOIN public.contactos c
       ON c.id = COALESCE(p.proveedor_preferido_id, p.proveedor_principal_id)
       AND c.empresa_id = p.empresa_id
     WHERE p.empresa_id = $2
       AND p.activo = true
       AND p.minimo_inventario IS NOT NULL AND p.minimo_inventario > 0
       AND COALESCE(e.existencia, 0) < p.minimo_inventario
       AND ($3::text IS NULL OR p.familia = $3)
     ORDER BY faltante DESC, p.descripcion`,
    [almacenId, empresaId, familia]
  );

  const lineas: ProductoBajoMinimo[] = rows.map((r) => ({
    producto_id:       Number(r.producto_id),
    clave:             String(r.clave),
    descripcion:       String(r.descripcion),
    familia:           String(r.familia ?? ''),
    almacen_id:        r.almacen_id != null ? Number(r.almacen_id) : null,
    almacen:           r.almacen ? String(r.almacen) : null,
    existencia:        Number(r.existencia ?? 0),
    minimo_inventario: Number(r.minimo_inventario ?? 0),
    faltante:          Number(r.faltante ?? 0),
    proveedor_nombre:  r.proveedor_nombre ? String(r.proveedor_nombre) : null,
    ultimo_costo:      Number(r.ultimo_costo ?? 0),
    valor_faltante:    Number(r.valor_faltante ?? 0),
  }));

  return {
    lineas,
    total_productos:     lineas.length,
    total_valor_faltante: lineas.reduce((s, l) => s + l.valor_faltante, 0),
  };
}

// ── Inventario valorizado ─────────────────────────────────────────────────────

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

export async function obtenerInventarioValorizado(params: {
  empresaId: number;
  almacenId: number | null;
  productoId: number | null;
  familia: string | null;
}): Promise<InventarioValorizadoResult> {
  const { empresaId, almacenId, productoId, familia } = params;

  const { rows } = await pool.query(
    `SELECT
       p.id                                                                             AS producto_id,
       p.clave,
       p.descripcion,
       COALESCE(p.familia, '')                                                          AS familia,
       a.id                                                                             AS almacen_id,
       a.nombre                                                                         AS almacen,
       e.existencia,
       COALESCE(p.costo_promedio, 0)                                                    AS costo_promedio,
       COALESCE(p.ultimo_costo,   0)                                                    AS ultimo_costo,
       COALESCE(p.costo_promedio, p.ultimo_costo, p.costo_estandar, 0)                 AS costo_valuacion,
       CASE
         WHEN p.costo_promedio IS NOT NULL AND p.costo_promedio > 0 THEN 'Promedio'
         WHEN p.ultimo_costo   IS NOT NULL AND p.ultimo_costo   > 0 THEN 'Último'
         WHEN p.costo_estandar IS NOT NULL AND p.costo_estandar > 0 THEN 'Estándar'
         ELSE 'Sin costo'
       END                                                                               AS tipo_costo,
       e.existencia * COALESCE(p.costo_promedio, p.ultimo_costo, p.costo_estandar, 0)  AS valor_inventario
     FROM inventario.existencias e
     JOIN inventario.almacenes a ON a.id = e.almacen_id AND a.empresa_id = e.empresa_id
     JOIN public.productos p     ON p.id = e.producto_id AND p.empresa_id = e.empresa_id
     WHERE e.empresa_id = $1
       AND e.existencia > 0
       AND ($2::int IS NULL OR e.almacen_id = $2)
       AND ($3::int IS NULL OR e.producto_id = $3)
       AND ($4::text IS NULL OR p.familia = $4)
     ORDER BY valor_inventario DESC, p.descripcion`,
    [empresaId, almacenId, productoId, familia]
  );

  const lineas: InventarioValorizadoLinea[] = rows.map((r) => ({
    producto_id:      Number(r.producto_id),
    clave:            String(r.clave),
    descripcion:      String(r.descripcion),
    familia:          String(r.familia ?? ''),
    almacen_id:       Number(r.almacen_id),
    almacen:          String(r.almacen),
    existencia:       Number(r.existencia ?? 0),
    costo_promedio:   Number(r.costo_promedio ?? 0),
    ultimo_costo:     Number(r.ultimo_costo ?? 0),
    costo_valuacion:  Number(r.costo_valuacion ?? 0),
    tipo_costo:       String(r.tipo_costo ?? 'Sin costo'),
    valor_inventario: Number(r.valor_inventario ?? 0),
  }));

  return {
    lineas,
    total_valor:    lineas.reduce((s, l) => s + l.valor_inventario, 0),
    total_unidades: lineas.reduce((s, l) => s + l.existencia, 0),
  };
}
