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
  facturas: FacturaCompraDetalle[];   // vacío si detalle = false
};

export async function obtenerComprasPorProveedor(params: {
  empresaId: number;
  fechaInicio: string;
  fechaFin: string;
  proveedorId?: number | null;
  incluirCancelados?: boolean;
  detalle?: boolean;
}): Promise<ComprasPorProveedorResult> {
  const { empresaId, fechaInicio, fechaFin, proveedorId, incluirCancelados = false, detalle = false } = params;

  const filtroCancelados = incluirCancelados
    ? ''
    : `AND LOWER(COALESCE(d.estatus_documento, '')) NOT IN ('cancelado', 'cancelada')`;

  const args: unknown[] = [empresaId, fechaInicio, fechaFin];
  let filtroProveedor = '';
  if (proveedorId) {
    args.push(proveedorId);
    filtroProveedor = `AND d.contacto_principal_id = $${args.length}`;
  }

  const { rows: resumen } = await pool.query<{
    proveedor_id: number;
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
         d.contacto_principal_id AS proveedor_id,
         SUM(d.subtotal)::numeric  AS subtotal,
         SUM(d.iva)::numeric       AS iva,
         SUM(d.total)::numeric     AS total_comprado,
         COUNT(d.id)::int          AS cantidad_facturas
       FROM documentos d
       WHERE d.empresa_id = $1
         AND d.tipo_documento = 'factura_compra'
         AND d.fecha_documento >= $2::date
         AND d.fecha_documento <= $3::date
         ${filtroCancelados}
         ${filtroProveedor}
       GROUP BY d.contacto_principal_id
     ),
     gran_total AS (SELECT COALESCE(SUM(total_comprado), 0) AS gt FROM base)
     SELECT
       b.proveedor_id,
       c.nombre,
       COALESCE(c.rfc, '')    AS rfc,
       b.cantidad_facturas,
       COALESCE(b.subtotal, 0)       AS subtotal,
       COALESCE(b.iva, 0)            AS iva,
       COALESCE(b.total_comprado, 0) AS total_comprado,
       ROUND(
         COALESCE(b.total_comprado, 0) * 100.0 / NULLIF((SELECT gt FROM gran_total), 0),
         2
       )::numeric AS pct_participacion
     FROM base b
     JOIN contactos c ON c.id = b.proveedor_id AND c.empresa_id = $1
     ORDER BY b.total_comprado DESC`,
    args
  );

  let facturas: FacturaCompraDetalle[] = [];
  if (detalle) {
    const { rows } = await pool.query<{
      id: number;
      proveedor_id: number;
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
         d.contacto_principal_id          AS proveedor_id,
         d.fecha_documento                AS fecha,
         COALESCE(d.serie, '')            AS serie,
         COALESCE(d.numero, 0)::int       AS numero,
         COALESCE(d.subtotal, 0)::numeric AS subtotal,
         COALESCE(d.iva, 0)::numeric      AS iva,
         COALESCE(d.total, 0)::numeric    AS total,
         LOWER(COALESCE(d.estatus_documento, '')) IN ('cancelado', 'cancelada') AS cancelado
       FROM documentos d
       WHERE d.empresa_id = $1
         AND d.tipo_documento = 'factura_compra'
         AND d.fecha_documento >= $2::date
         AND d.fecha_documento <= $3::date
         ${filtroCancelados}
         ${filtroProveedor}
       ORDER BY d.contacto_principal_id, d.fecha_documento, d.id`,
      args
    );

    facturas = rows.map((r) => ({
      id: r.id,
      proveedor_id: r.proveedor_id,
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
    proveedores: resumen.map((r) => ({
      proveedor_id: r.proveedor_id,
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
