import pool from '../../config/database';
import type { PoolClient } from 'pg';
import { obtenerReglaDocumentoOrigenFinanciero } from './documento-origen-financiero';
import { crearDocumentoRepository } from '../documentos/documentos.repository';

// pg puede devolver columnas `date` como objetos Date en lugar de strings.
// Esta función normaliza ambos casos a "YYYY-MM-DD" usando UTC para evitar desfase de zona horaria.
function toIsoDateStr(v: unknown): string {
  if (!v) return '';
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, '0');
    const d = String(v.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

const TIPOS_DOCUMENTO_CARGO = [
  'factura',
  'factura_compra',
  'nota_credito',
  'nota_credito_compra',
  'pago_cliente',
  'pago_proveedor',
  'ajuste_cliente',
  'ajuste_proveedor',
];

const currentCivilDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const roundFinancial = (value: number | string | null | undefined, decimals = 6) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(decimals));
};

export type AnticipoDisponible = {
  finanzas_operacion_id: number;
  empresa_id: number;
  documento_origen_id: number;
  tipo_movimiento: string;
  naturaleza_operacion: string;
  fecha: string;
  monto_total: number;
  monto_aplicado: number;
  monto_disponible: number;
  contacto_id: number | null;
  contacto_nombre: string | null;
  cuenta_id: number;
  cuenta_identificador: string | null;
  moneda: string | null;
};

type AplicacionSaldoInput = {
  documento_origen_id: number;
  documento_destino_id: number;
  monto: number;
  monto_moneda_documento: number;
  fecha_aplicacion?: string | null;
  created_by?: number | null;
};

type AplicacionAnticipoBatchInput = {
  documento_origen_id: number;
  documento_destino_id: number;
  aplicaciones: Array<{
    finanzas_operacion_id: number;
    monto: number;
    monto_moneda_documento?: number | null;
    fecha_aplicacion?: string | null;
  }>;
  fecha_aplicacion?: string | null;
  created_by?: number | null;
};

export async function obtenerSaldoDocumento(id: number, empresaId: number) {
  const sql = `
    SELECT ds.id, ds.empresa_id, ds.tipo_documento, ds.moneda, ds.tipo_cambio, ds.total,
      CASE WHEN LOWER(TRIM(COALESCE(d.estatus_documento, ''))) IN ('cancelado', 'cancelada') THEN 0 ELSE ds.saldo END AS saldo
    FROM documentos_saldo ds
    JOIN documentos d ON d.id = ds.id AND d.empresa_id = ds.empresa_id
    WHERE ds.id = $1 AND ds.empresa_id = $2
  `;
  const { rows } = await pool.query(sql, [id, empresaId]);
  return rows[0] || null;
}

export async function obtenerOperacionPorId(id: number, empresaId: number) {
  const sql = `
    SELECT fo.*, c.nombre AS contacto_nombre, fc.identificador AS cuenta_nombre,
           d.tipo_documento AS documento_origen_tipo_documento,
           d.serie AS documento_origen_serie,
           d.numero AS documento_origen_numero,
           d.total AS documento_origen_total
    FROM finanzas_operaciones fo
    LEFT JOIN contactos c ON c.id = fo.contacto_id
    LEFT JOIN finanzas_cuentas fc ON fc.id = fo.cuenta_id
    LEFT JOIN documentos d ON d.id = fo.documento_origen_id AND d.empresa_id = fo.empresa_id
    WHERE fo.id = $1 AND fo.empresa_id = $2
  `;
  const { rows } = await pool.query(sql, [id, empresaId]);
  return rows[0] || null;
}

export async function obtenerResumenAnticiposDocumento(documentoId: number, empresaId: number) {
  const { rows: documentoRows } = await pool.query<{
    id: number;
    empresa_id: number;
    tipo_documento: string;
    total: string;
  }>(
    `SELECT id, empresa_id, tipo_documento, total
     FROM documentos
     WHERE id = $1 AND empresa_id = $2`,
    [documentoId, empresaId]
  );

  const documento = documentoRows[0];
  if (!documento) return null;

  const regla = obtenerReglaDocumentoOrigenFinanciero(documento.tipo_documento);
  if (!regla) {
    return {
      documento_id: documento.id,
      empresa_id: documento.empresa_id,
      tipo_documento: documento.tipo_documento,
      flujo: null,
      total_documento: Number(documento.total || 0),
      total_anticipado: 0,
      total_aplicado: 0,
      disponible_por_aplicar: 0,
      pendiente_estimado: Number(documento.total || 0),
      cantidad_operaciones: 0,
    };
  }

  const sql = `
    WITH operaciones_origen AS (
      SELECT fo.id, fo.monto
      FROM finanzas_operaciones fo
      WHERE fo.empresa_id = $1
        AND fo.documento_origen_id = $2
        AND fo.tipo_movimiento = $3
        AND fo.naturaleza_operacion = $4
    ),
    totales AS (
      SELECT
        COUNT(*)::int AS cantidad_operaciones,
        COALESCE(SUM(monto), 0) AS total_anticipado
      FROM operaciones_origen
    ),
    aplicaciones AS (
      SELECT COALESCE(SUM(a.monto), 0) AS total_aplicado
      FROM aplicaciones_saldo a
      JOIN operaciones_origen oo ON oo.id = a.finanzas_operacion_id
    )
    SELECT
      $2::int AS documento_id,
      $1::int AS empresa_id,
      $5::text AS tipo_documento,
      $6::text AS flujo,
      $7::numeric AS total_documento,
      t.total_anticipado,
      ap.total_aplicado,
      t.total_anticipado - ap.total_aplicado AS disponible_por_aplicar,
      GREATEST($7::numeric - t.total_anticipado, 0) AS pendiente_estimado,
      t.cantidad_operaciones
    FROM totales t
    CROSS JOIN aplicaciones ap
  `;

  const { rows } = await pool.query(sql, [
    empresaId,
    documentoId,
    regla.tipoMovimiento,
    regla.naturaleza,
    documento.tipo_documento,
    regla.flujo,
    Number(documento.total || 0),
  ]);

  return rows[0] || null;
}

export async function listarAnticiposDisponiblesDocumentoOrigen(documentoId: number, empresaId: number) {
  const { rows: documentoRows } = await pool.query<{
    id: number;
    empresa_id: number;
    tipo_documento: string;
  }>(
    `SELECT id, empresa_id, tipo_documento
     FROM documentos
     WHERE id = $1 AND empresa_id = $2`,
    [documentoId, empresaId]
  );

  const documento = documentoRows[0];
  if (!documento) return null;

  const regla = obtenerReglaDocumentoOrigenFinanciero(documento.tipo_documento);
  if (!regla) {
    return {
      documento_id: documento.id,
      empresa_id: documento.empresa_id,
      tipo_documento: documento.tipo_documento,
      flujo: null,
      anticipos: [] as AnticipoDisponible[],
      total_disponible: 0,
    };
  }

  const { rows } = await pool.query<AnticipoDisponible>(
    `SELECT
       fo.id AS finanzas_operacion_id,
       fo.empresa_id,
       fo.documento_origen_id,
       fo.tipo_movimiento,
       fo.naturaleza_operacion,
       fo.fecha,
       fo.monto AS monto_total,
       COALESCE(SUM(a.monto), 0) AS monto_aplicado,
       fo.monto - COALESCE(SUM(a.monto), 0) AS monto_disponible,
       fo.contacto_id,
       c.nombre AS contacto_nombre,
       fo.cuenta_id,
       fc.identificador AS cuenta_identificador,
       fc.moneda
     FROM finanzas_operaciones fo
     LEFT JOIN aplicaciones_saldo a
       ON a.finanzas_operacion_id = fo.id
      AND a.empresa_id = fo.empresa_id
     LEFT JOIN contactos c
       ON c.id = fo.contacto_id
     LEFT JOIN finanzas_cuentas fc
       ON fc.id = fo.cuenta_id
      AND fc.empresa_id = fo.empresa_id
     WHERE fo.empresa_id = $1
       AND fo.documento_origen_id = $2
       AND fo.tipo_movimiento = $3
       AND fo.naturaleza_operacion = $4
     GROUP BY
       fo.id,
       fo.empresa_id,
       fo.documento_origen_id,
       fo.tipo_movimiento,
       fo.naturaleza_operacion,
       fo.fecha,
       fo.monto,
       fo.contacto_id,
       c.nombre,
       fo.cuenta_id,
       fc.identificador,
       fc.moneda
     HAVING fo.monto - COALESCE(SUM(a.monto), 0) > 0
     ORDER BY fo.fecha, fo.id`,
    [empresaId, documentoId, regla.tipoMovimiento, regla.naturaleza]
  );

  return {
    documento_id: documento.id,
    empresa_id: documento.empresa_id,
    tipo_documento: documento.tipo_documento,
    flujo: regla.flujo,
    anticipos: rows,
    total_disponible: rows.reduce((sum, row) => sum + Number(row.monto_disponible || 0), 0),
  };
}

export async function listarAplicacionesPorDocumento(documentoId: number, empresaId: number) {
  const sql = `
    SELECT a.*, 
           CASE WHEN a.documento_origen_id = $1 THEN doc_destino.tipo_documento ELSE doc_origen.tipo_documento END AS tipo_documento,
           CASE WHEN a.documento_origen_id = $1 THEN doc_destino.serie ELSE doc_origen.serie END AS serie,
           CASE WHEN a.documento_origen_id = $1 THEN doc_destino.numero ELSE doc_origen.numero END AS numero,
           CASE WHEN a.documento_origen_id = $1 THEN doc_destino.fecha_documento ELSE doc_origen.fecha_documento END AS fecha_documento,
           CASE WHEN a.documento_origen_id = $1 THEN doc_destino.total ELSE doc_origen.total END AS total_documento,
           CASE WHEN a.documento_origen_id = $1 THEN doc_destino.moneda ELSE doc_origen.moneda END AS moneda_documento,
           doc_origen.tipo_documento AS tipo_documento_origen,
           doc_destino.tipo_documento AS tipo_documento_destino
    FROM aplicaciones_saldo a
    LEFT JOIN documentos doc_origen ON doc_origen.id = a.documento_origen_id AND doc_origen.empresa_id = a.empresa_id
    LEFT JOIN documentos doc_destino ON doc_destino.id = a.documento_destino_id AND doc_destino.empresa_id = a.empresa_id
    WHERE a.empresa_id = $2
      AND (a.documento_destino_id = $1 OR a.documento_origen_id = $1)
    ORDER BY a.fecha_aplicacion, a.id
  `;
  const { rows } = await pool.query(sql, [documentoId, empresaId]);
  return rows;
}

export async function listarEstadoCuentaContacto(contactoId: number, empresaId: number) {
  const sql = `
    SELECT d.id,
      d.contacto_principal_id AS contacto_id,
           d.empresa_id,
           'documento'::text AS origen,
           d.tipo_documento AS tipo,
           d.serie,
           d.numero,
           d.moneda,
           d.tipo_cambio,
           d.total AS monto,
           ds.saldo,
           d.fecha_documento AS fecha
    FROM documentos d
    JOIN documentos_saldo ds ON ds.id = d.id AND ds.empresa_id = d.empresa_id
    WHERE d.empresa_id = $1
      AND d.contacto_principal_id = $2
      AND d.tipo_documento = ANY($3::text[])
      AND COALESCE(LOWER(TRIM(d.estatus_documento)), '') NOT IN ('cancelado', 'cancelada', 'borrador', '')

    UNION ALL

    SELECT fo.id,
     fo.contacto_id,
     fo.empresa_id,
     'operacion'::text AS origen,
     fo.tipo_movimiento AS tipo,
   NULL::text AS serie,
   NULL::int AS numero,
     fc.moneda,
     1::numeric(9,4) AS tipo_cambio,
     fo.monto,
     NULL::numeric AS saldo,
     fo.fecha
    FROM finanzas_operaciones fo
    JOIN finanzas_cuentas fc ON fc.id = fo.cuenta_id AND fc.empresa_id = fo.empresa_id
    WHERE fo.empresa_id = $1
      AND fo.contacto_id = $2
  AND fo.tipo_movimiento IN ('Deposito','Retiro')

    ORDER BY fecha, id
  `;
  const { rows } = await pool.query(sql, [empresaId, contactoId, TIPOS_DOCUMENTO_CARGO]);
  return rows;
}

export async function obtenerReporteAging(empresaId: number, fechaBase?: string) {
  const args: unknown[] = [empresaId];
  const fechaExpr = fechaBase ? `$2::date` : `CURRENT_DATE`;
  if (fechaBase) args.push(fechaBase);

  const sql = `
    SELECT
  d.id AS documento_id,
  d.contacto_principal_id AS contacto_id,
  d.fecha_documento AS fecha,
  d.tipo_documento,
  d.moneda,
  d.total,
  ds.saldo,
  (${fechaExpr} - d.fecha_documento)::integer AS dias,
      CASE
        WHEN (${fechaExpr} - d.fecha_documento) <= 30 THEN '0-30'
        WHEN (${fechaExpr} - d.fecha_documento) <= 60 THEN '31-60'
        WHEN (${fechaExpr} - d.fecha_documento) <= 90 THEN '61-90'
        ELSE '90+'
      END AS bucket
    FROM documentos d
    JOIN documentos_saldo ds ON ds.id = d.id AND ds.empresa_id = d.empresa_id
    WHERE d.empresa_id = $1
      AND ds.saldo > 0
    ORDER BY d.fecha_documento, d.id
  `;
  const { rows } = await pool.query(sql, args);
  return rows;
}

export async function obtenerReporteAgingResumen(empresaId: number, fechaBase?: string) {
  const args: unknown[] = [empresaId];
  const fechaExpr = fechaBase ? `$2::date` : `CURRENT_DATE`;
  if (fechaBase) args.push(fechaBase);

  const sql = `
    SELECT
  d.contacto_principal_id AS contacto_id,
  SUM(CASE WHEN (${fechaExpr} - d.fecha_documento) <= 30 THEN ds.saldo ELSE 0 END) AS bucket_0_30,
  SUM(CASE WHEN (${fechaExpr} - d.fecha_documento) > 30 AND (${fechaExpr} - d.fecha_documento) <= 60 THEN ds.saldo ELSE 0 END) AS bucket_31_60,
  SUM(CASE WHEN (${fechaExpr} - d.fecha_documento) > 60 AND (${fechaExpr} - d.fecha_documento) <= 90 THEN ds.saldo ELSE 0 END) AS bucket_61_90,
  SUM(CASE WHEN (${fechaExpr} - d.fecha_documento) > 90 THEN ds.saldo ELSE 0 END) AS bucket_90_plus,
      SUM(ds.saldo) AS total
    FROM documentos d
    JOIN documentos_saldo ds ON ds.id = d.id AND ds.empresa_id = d.empresa_id
    WHERE d.empresa_id = $1
      AND ds.saldo > 0
      AND d.tipo_documento IN ('factura', 'factura_compra')
  GROUP BY d.contacto_principal_id
  ORDER BY d.contacto_principal_id
  `;
  const { rows } = await pool.query(sql, args);
  return rows;
}

export type TipoMovimiento = 'Deposito' | 'Retiro';

export type Cuenta = {
  id: number;
  empresa_id: number;
  identificador: string;
  numero_cuenta?: string | null;
  tipo_cuenta: string;
  moneda: string;
  saldo: number;
  saldo_inicial?: number;
  saldo_conciliado?: number;
  fecha_ultima_conciliacion?: string | null;
  es_cuenta_efectivo?: boolean;
  afecta_total_disponible?: boolean;
  cuenta_cerrada?: boolean;
  observaciones?: string | null;
};

export type Operacion = {
  id: number;
  empresa_id: number;
  cuenta_id: number;
  fecha: string;
  tipo_movimiento: TipoMovimiento;
  monto: number;
  referencia?: string | null;
  observaciones?: string | null;
  contacto_id?: number | null;
  contacto_nombre?: string | null;
  documento_origen_id?: number | null;
  documento_origen_tipo_documento?: string | null;
  documento_origen_serie?: string | null;
  documento_origen_numero?: number | null;
  documento_origen_total?: number | null;
  factura_id?: number | null;
  es_transferencia?: boolean;
  transferencia_id?: number | null;
  estado_conciliacion?: string;
  saldo?: number | null;
  concepto_id?: number | null;
  concepto_nombre?: string | null;
  transferencia_cuenta_origen?: number | null;
  transferencia_cuenta_destino?: number | null;
  transferencia_origen_nombre?: string | null;
  transferencia_destino_nombre?: string | null;
  created_by?: number | null;
  metodo_pago_id?: number | null;
  metodo_pago_nombre?: string | null;
};

export async function listarCuentas(empresaId: number): Promise<Cuenta[]> {
  const { rows } = await pool.query<Cuenta>(
    `SELECT * FROM finanzas_cuentas WHERE empresa_id = $1 ORDER BY identificador`,
    [empresaId]
  );
  return rows;
}

export async function crearCuenta(data: Partial<Cuenta>, empresaId: number): Promise<Cuenta> {
  const client = await pool.connect();
  try {
    const {
      identificador,
      numero_cuenta,
      tipo_cuenta = 'Disponibilidad',
      moneda = 'MXN',
      saldo_inicial = 0,
      saldo = saldo_inicial,
      observaciones = null,
      es_cuenta_efectivo = false,
      afecta_total_disponible = true,
      cuenta_cerrada = false,
    } = data;

    if (!identificador) {
      throw new Error('identificador es requerido');
    }

    const insert = `
      INSERT INTO finanzas_cuentas (
        empresa_id, identificador, numero_cuenta, tipo_cuenta, moneda,
        saldo, saldo_inicial, observaciones, es_cuenta_efectivo, afecta_total_disponible, cuenta_cerrada
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `;
    const { rows } = await client.query<Cuenta>(insert, [
      empresaId,
      identificador,
      numero_cuenta ?? null,
      tipo_cuenta,
      moneda,
      saldo,
      saldo_inicial,
      observaciones,
      es_cuenta_efectivo,
      afecta_total_disponible,
      cuenta_cerrada,
    ]);
    return rows[0];
  } finally {
    client.release();
  }
}

export async function actualizarCuenta(id: number, data: Partial<Cuenta>, empresaId: number): Promise<Cuenta> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existe } = await client.query<Cuenta>(
      'SELECT * FROM finanzas_cuentas WHERE id = $1 AND empresa_id = $2 FOR UPDATE',
      [id, empresaId]
    );
    if (!existe[0]) throw new Error('Cuenta no encontrada');

    const {
      identificador = existe[0].identificador,
      numero_cuenta = existe[0].numero_cuenta,
      tipo_cuenta = existe[0].tipo_cuenta,
      moneda = existe[0].moneda,
      observaciones = existe[0].observaciones,
      es_cuenta_efectivo = existe[0].es_cuenta_efectivo,
      afecta_total_disponible = existe[0].afecta_total_disponible,
      cuenta_cerrada = existe[0].cuenta_cerrada,
    } = data;

    const { rows } = await client.query<Cuenta>(
      `UPDATE finanzas_cuentas
       SET identificador = $1,
           numero_cuenta = $2,
           tipo_cuenta = $3,
           moneda = $4,
           observaciones = $5,
           es_cuenta_efectivo = $6,
           afecta_total_disponible = $7,
           cuenta_cerrada = $8
       WHERE id = $9 AND empresa_id = $10
       RETURNING *`,
      [
        identificador,
        numero_cuenta,
        tipo_cuenta,
        moneda,
        observaciones,
        es_cuenta_efectivo,
        afecta_total_disponible,
        cuenta_cerrada,
        id,
        empresaId,
      ]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function eliminarCuenta(id: number, empresaId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: cuentaRows } = await client.query<Cuenta>(
      'SELECT * FROM finanzas_cuentas WHERE id = $1 AND empresa_id = $2 FOR UPDATE',
      [id, empresaId]
    );
    if (!cuentaRows[0]) throw new Error('Cuenta no encontrada');

    const { rows: ops } = await client.query<{ total: string }>(
      'SELECT COUNT(*)::int AS total FROM finanzas_operaciones WHERE cuenta_id = $1',
      [id]
    );
    if (Number(ops[0]?.total || 0) > 0) {
      throw new Error('No se puede eliminar una cuenta con operaciones');
    }

    await client.query('DELETE FROM finanzas_cuentas WHERE id = $1', [id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function obtenerCuentaConLock(
  client: PoolClient,
  cuentaId: number,
  empresaId: number
): Promise<Cuenta | null> {
  const { rows } = await client.query<Cuenta>(
    `SELECT * FROM finanzas_cuentas WHERE id = $1 AND empresa_id = $2 FOR UPDATE`,
    [cuentaId, empresaId]
  );
  return rows[0] ?? null;
}

export async function listarOperaciones(empresaId: number, cuentaId?: number): Promise<Operacion[]> {
  const params: any[] = [empresaId];
  const filters: string[] = ['fo.empresa_id = $1'];
  if (cuentaId) {
    params.push(cuentaId);
    filters.push(`fo.cuenta_id = $${params.length}`);
  }
  const where = filters.join(' AND ');
  const { rows } = await pool.query<Operacion>(
    `SELECT fo.*,
            c.nombre AS contacto_nombre,
            co.nombre_concepto AS concepto_nombre,
           d.tipo_documento AS documento_origen_tipo_documento,
           d.serie AS documento_origen_serie,
           d.numero AS documento_origen_numero,
           d.total AS documento_origen_total,
            ft.cuenta_origen_id AS transferencia_cuenta_origen,
            ft.cuenta_destino_id AS transferencia_cuenta_destino,
            coo.identificador AS transferencia_origen_nombre,
            cod.identificador AS transferencia_destino_nombre
     FROM finanzas_operaciones fo
     LEFT JOIN contactos c ON c.id = fo.contacto_id
     LEFT JOIN conceptos co ON co.id = fo.concepto_id
         LEFT JOIN documentos d ON d.id = fo.documento_origen_id AND d.empresa_id = fo.empresa_id
     LEFT JOIN finanzas_transferencias ft ON ft.id = fo.transferencia_id
     LEFT JOIN finanzas_cuentas coo ON coo.id = ft.cuenta_origen_id
     LEFT JOIN finanzas_cuentas cod ON cod.id = ft.cuenta_destino_id
     WHERE ${where}
     ORDER BY fo.fecha DESC, fo.id DESC`,
    params
  );
  return rows;
}

export type OperacionInput = {
  cuenta_id: number;
  fecha: string;
  tipo_movimiento: TipoMovimiento;
  monto: number;
  naturaleza_operacion?: 'cobro_cliente' | 'pago_proveedor' | 'movimiento_general';
  documento_origen_id?: number | null;
  contacto_id?: number | null;
  referencia?: string | null;
  observaciones?: string | null;
  es_transferencia?: boolean;
  transferencia_id?: number | null;
  concepto_id?: number | null;
  created_by?: number | null;
  metodo_pago_id?: number | null;
};

export async function upsertOperacionDocumentoEnTransaccion(
  client: PoolClient,
  data: OperacionInput,
  empresaId: number,
  operacionExistenteId?: number | null
): Promise<Operacion> {
  // Validar método de pago operativo si se proporciona
  if (data.metodo_pago_id) {
    const { rows: mpRows } = await client.query<{ requiere_referencia: boolean }>(
      `SELECT requiere_referencia FROM public.finanzas_metodos_pago
       WHERE id = $1 AND empresa_id = $2 AND activo = true`,
      [data.metodo_pago_id, empresaId]
    );
    if (!mpRows[0]) {
      const err = new Error('El método de pago no existe, está inactivo o no pertenece a esta empresa');
      (err as any).status = 422;
      throw err;
    }
    if (mpRows[0].requiere_referencia && !data.referencia) {
      const err = new Error('El método de pago seleccionado requiere una referencia (número de cheque, SPEI, etc.)');
      (err as any).status = 422;
      throw err;
    }
  }

  if (operacionExistenteId) {
    const { rows: opRows } = await client.query<Operacion>(
      'SELECT * FROM finanzas_operaciones WHERE id = $1 AND empresa_id = $2 FOR UPDATE',
      [operacionExistenteId, empresaId]
    );
    const original = opRows[0];
    if (!original) throw new Error('Operación no encontrada');

    if (String(original.estado_conciliacion ?? '').toLowerCase() !== 'pendiente') {
      const err = new Error('No se puede editar la operación porque ya está cotejada o conciliada. Para modificar una operación conciliada contacte al administrador.');
      (err as any).status = 409;
      throw err;
    }

    const oldDelta = original.tipo_movimiento === 'Deposito' ? Number(original.monto) : -Number(original.monto);
    const newDelta = data.tipo_movimiento === 'Deposito' ? Number(data.monto) : -Number(data.monto);

    const cuentaOriginal = await obtenerCuentaConLock(client, original.cuenta_id, empresaId);
    if (!cuentaOriginal) throw new Error('Cuenta original no encontrada');

    let naturaleza = data.naturaleza_operacion ?? (original as any).naturaleza_operacion ?? 'movimiento_general';
    let contactoId = data.contacto_id ?? original.contacto_id ?? null;
    const documentoOrigenId = data.documento_origen_id ?? original.documento_origen_id ?? null;

    if (documentoOrigenId) {
      const { rows: documentoRows } = await client.query<{
        id: number;
        empresa_id: number;
        tipo_documento: string;
        contacto_principal_id: number | null;
      }>(
        `SELECT id, empresa_id, tipo_documento, contacto_principal_id
         FROM documentos
         WHERE id = $1 AND empresa_id = $2`,
        [documentoOrigenId, empresaId]
      );
      const documentoOrigen = documentoRows[0];
      if (!documentoOrigen) throw new Error('Documento origen no encontrado');

      const regla = obtenerReglaDocumentoOrigenFinanciero(documentoOrigen.tipo_documento);
      if (!regla) throw new Error('El tipo de documento origen no soporta anticipos/pagos financieros');
      if (data.tipo_movimiento !== regla.tipoMovimiento) {
        throw new Error('tipo_movimiento incompatible con el documento origen');
      }

      naturaleza = regla.naturaleza;
      contactoId = documentoOrigen.contacto_principal_id;
    }

    if (data.cuenta_id === original.cuenta_id) {
      const nuevoSaldo = Number(cuentaOriginal.saldo) - oldDelta + newDelta;
      await client.query('UPDATE finanzas_cuentas SET saldo = $1 WHERE id = $2', [nuevoSaldo, cuentaOriginal.id]);
      const { rows } = await client.query<Operacion>(
        `UPDATE finanzas_operaciones
         SET cuenta_id = $1, fecha = $2, tipo_movimiento = $3, naturaleza_operacion = $4, monto = $5, contacto_id = $6,
             documento_origen_id = $7, referencia = $8, observaciones = $9, es_transferencia = $10, transferencia_id = $11, saldo = $12, concepto_id = $13, metodo_pago_id = $14
         WHERE id = $15
         RETURNING *`,
        [
          data.cuenta_id,
          data.fecha,
          data.tipo_movimiento,
          naturaleza,
          data.monto,
          contactoId,
          documentoOrigenId,
          data.referencia ?? null,
          data.observaciones ?? null,
          data.es_transferencia ?? false,
          data.transferencia_id ?? null,
          nuevoSaldo,
          data.concepto_id ?? null,
          data.metodo_pago_id ?? null,
          operacionExistenteId,
        ]
      );
      return rows[0];
    }

    const cuentaNueva = await obtenerCuentaConLock(client, data.cuenta_id, empresaId);
    if (!cuentaNueva) throw new Error('Cuenta destino no encontrada');

    const saldoOriginal = Number(cuentaOriginal.saldo) - oldDelta;
    const saldoNuevo = Number(cuentaNueva.saldo) + newDelta;

    await client.query('UPDATE finanzas_cuentas SET saldo = $1 WHERE id = $2', [saldoOriginal, cuentaOriginal.id]);
    await client.query('UPDATE finanzas_cuentas SET saldo = $1 WHERE id = $2', [saldoNuevo, cuentaNueva.id]);

    const { rows } = await client.query<Operacion>(
      `UPDATE finanzas_operaciones
       SET cuenta_id = $1, fecha = $2, tipo_movimiento = $3, naturaleza_operacion = $4, monto = $5, contacto_id = $6,
           documento_origen_id = $7, referencia = $8, observaciones = $9, es_transferencia = $10, transferencia_id = $11, saldo = $12, concepto_id = $13, metodo_pago_id = $14
       WHERE id = $15
       RETURNING *`,
      [
        data.cuenta_id,
        data.fecha,
        data.tipo_movimiento,
        naturaleza,
        data.monto,
        contactoId,
        documentoOrigenId,
        data.referencia ?? null,
        data.observaciones ?? null,
        data.es_transferencia ?? false,
        data.transferencia_id ?? null,
        saldoNuevo,
        data.concepto_id ?? null,
        data.metodo_pago_id ?? null,
        operacionExistenteId,
      ]
    );
    return rows[0];
  }

  const cuenta = await obtenerCuentaConLock(client, data.cuenta_id, empresaId);
  if (!cuenta) throw new Error('Cuenta no encontrada');

  const delta = data.tipo_movimiento === 'Deposito' ? Number(data.monto) : -Number(data.monto);
  const nuevoSaldo = Number(cuenta.saldo) + delta;

  let naturaleza = data.naturaleza_operacion ?? 'movimiento_general';
  let contactoId = data.contacto_id ?? null;

  if (data.documento_origen_id) {
    const { rows: documentoRows } = await client.query<{
      id: number;
      empresa_id: number;
      tipo_documento: string;
      contacto_principal_id: number | null;
    }>(
      `SELECT id, empresa_id, tipo_documento, contacto_principal_id
       FROM documentos
       WHERE id = $1 AND empresa_id = $2`,
      [data.documento_origen_id, empresaId]
    );
    const documentoOrigen = documentoRows[0];
    if (!documentoOrigen) throw new Error('Documento origen no encontrado');

    const regla = obtenerReglaDocumentoOrigenFinanciero(documentoOrigen.tipo_documento);
    if (!regla) throw new Error('El tipo de documento origen no soporta anticipos/pagos financieros');
    if (data.tipo_movimiento !== regla.tipoMovimiento) {
      throw new Error('tipo_movimiento incompatible con el documento origen');
    }

    naturaleza = regla.naturaleza;
    contactoId = documentoOrigen.contacto_principal_id;
  }

  const insert = `
    INSERT INTO finanzas_operaciones (
      empresa_id, cuenta_id, fecha, tipo_movimiento, naturaleza_operacion, monto, contacto_id, documento_origen_id, referencia, observaciones,
      es_transferencia, transferencia_id, estado_conciliacion, saldo, concepto_id, created_by, metodo_pago_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    RETURNING *
  `;
  const { rows } = await client.query<Operacion>(insert, [
    empresaId,
    data.cuenta_id,
    data.fecha,
    data.tipo_movimiento,
    naturaleza,
    data.monto,
    contactoId,
    data.documento_origen_id ?? null,
    data.referencia ?? null,
    data.observaciones ?? null,
    data.es_transferencia ?? false,
    data.transferencia_id ?? null,
    'pendiente',
    nuevoSaldo,
    data.concepto_id ?? null,
    data.created_by ?? null,
    data.metodo_pago_id ?? null,
  ]);

  await client.query('UPDATE finanzas_cuentas SET saldo = $1 WHERE id = $2', [nuevoSaldo, data.cuenta_id]);
  return rows[0];
}

async function crearAplicacionTx(
  client: PoolClient,
  data: AplicacionSaldoInput,
  empresaId: number
) {
  const documentoOrigenId = Number(data.documento_origen_id ?? 0);
  const documentoDestinoId = Number(data.documento_destino_id ?? 0);

  if (!documentoOrigenId) {
    const err = new Error('documento_origen_id es obligatorio');
    (err as any).status = 400;
    throw err;
  }
  if (!documentoDestinoId) {
    const err = new Error('documento_destino_id es obligatorio');
    (err as any).status = 400;
    throw err;
  }
  if (!(data.monto > 0) || !(data.monto_moneda_documento > 0)) {
    const err = new Error('monto y monto_moneda_documento deben ser mayores a 0');
    (err as any).status = 400;
    throw err;
  }
  if (documentoOrigenId === documentoDestinoId) {
    const err = new Error('No se puede aplicar un documento contra sí mismo');
    (err as any).status = 409;
    throw err;
  }

  // 1) Bloquear destino primero
  // Verificar que ninguno de los dos documentos tenga cancelación CFDI pendiente
  const { rows: pendientesRows } = await client.query<{ documento_id: number }>(
    `SELECT documento_id
       FROM public.documentos_cancelacion_intentos
      WHERE documento_id = ANY($1::int[])
        AND empresa_id   = $2
        AND estado       = 'externo_ok_interno_pendiente'
      LIMIT 1`,
    [[documentoOrigenId, documentoDestinoId], empresaId]
  );
  if (pendientesRows.length > 0) {
    const errPend = new Error('No se puede aplicar saldo: uno de los documentos tiene una cancelación CFDI pendiente de sincronización interna');
    (errPend as any).status = 409;
    throw errPend;
  }

  const destinoQuery = `
    SELECT d.id, d.empresa_id, d.contacto_principal_id AS contacto_id, d.tipo_documento, d.moneda, d.tipo_cambio, d.total
    FROM documentos d
    WHERE d.id = $1 AND d.tipo_documento IN ('factura', 'factura_compra') AND d.empresa_id = $2
    FOR UPDATE
  `;
  const destinoRows = await client.query(destinoQuery, [documentoDestinoId, empresaId]);
  const destino = destinoRows.rows[0];
  if (!destino) {
    const err = new Error('Documento destino no encontrado o tipo inválido');
    (err as any).status = 404;
    throw err;
  }

  // 2) Bloquear origen documental
  const origenDocQuery = `
    SELECT d.id, d.empresa_id, d.contacto_principal_id AS contacto_id, d.tipo_documento, d.moneda, d.tipo_cambio, d.total
    FROM documentos d
    WHERE d.id = $1 AND d.empresa_id = $2 AND d.tipo_documento IN ('nota_credito', 'nota_credito_compra', 'pago_cliente', 'pago_proveedor', 'ajuste_cliente', 'ajuste_proveedor')
    FOR UPDATE
  `;
  const origenRows = await client.query(origenDocQuery, [documentoOrigenId, empresaId]);
  const origen = origenRows.rows[0];
  if (!origen) {
    const err = new Error('Documento origen no encontrado o tipo inválido');
    (err as any).status = 404;
    throw err;
  }

  // 3) Validar empresa/contacto
  if (origen.empresa_id !== destino.empresa_id) {
    const err = new Error('empresa_id distinto entre origen y destino');
    (err as any).status = 409;
    throw err;
  }
  if (origen.contacto_id !== destino.contacto_id) {
    const err = new Error('contacto_id distinto entre origen y destino');
    (err as any).status = 409;
    throw err;
  }

  // 4) Validar compatibilidad de tipos
  if (destino.tipo_documento === 'factura') {
    if (!['nota_credito', 'pago_cliente', 'ajuste_cliente'].includes(origen.tipo_documento)) {
      const err = new Error('documento origen incompatible para factura');
      (err as any).status = 409;
      throw err;
    }
  } else if (destino.tipo_documento === 'factura_compra') {
    if (!['nota_credito_compra', 'pago_proveedor', 'ajuste_proveedor'].includes(origen.tipo_documento)) {
      const err = new Error('documento origen incompatible para factura_compra');
      (err as any).status = 409;
      throw err;
    }
  }

  // 5) Agregaciones dentro de la misma transacción
  const { rows: origenSumRows } = await client.query(
    `SELECT COALESCE(SUM(a.monto), 0) AS aplicado_origen_base FROM aplicaciones_saldo a WHERE a.documento_origen_id = $1`,
    [origen.id]
  );
  const aplicadoOrigen = Number(origenSumRows[0]?.aplicado_origen_base || 0);

  const { rows: destSumRows } = await client.query(
    `SELECT COALESCE(SUM(a.monto_moneda_documento), 0) AS aplicado_destino FROM aplicaciones_saldo a WHERE a.documento_destino_id = $1`,
    [destino.id]
  );
  const aplicadoDestino = Number(destSumRows[0]?.aplicado_destino || 0);

  const tipoCambioOrigen = Math.abs(Number(origen.tipo_cambio || 1)) || 1;
  const montoOrigenBase = Math.abs(Number(origen.total || 0) * tipoCambioOrigen);
  const saldoOrigen = roundFinancial(montoOrigenBase - aplicadoOrigen);
  const saldoDestino = roundFinancial(Number(destino.total || 0) - aplicadoDestino);

  // Campos fiscales SAT para DoctoRelacionado en Complemento de Pagos 2.0.
  // El COUNT es seguro porque el FOR UPDATE sobre destino impide inserciones
  // concurrentes al mismo documento_destino_id hasta que esta transacción confirme.
  const { rows: parcRows } = await client.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM aplicaciones_saldo WHERE documento_destino_id = $1`,
    [destino.id]
  );
  const numParcialidad = Number(parcRows[0]?.cnt ?? 0) + 1;
  const impSaldoAnt = saldoDestino;

  const montoBase = roundFinancial(data.monto);
  const montoMonedaDocumento = roundFinancial(data.monto_moneda_documento);
  const compareTolerance = 0.000001;

  console.info('[finanzas.crearAplicacionTx] validacion_saldos', {
    empresaId,
    documento_origen_id: documentoOrigenId,
    documento_destino_id: documentoDestinoId,
    tipo_cambio_origen: tipoCambioOrigen,
    saldo_origen: saldoOrigen,
    saldo_destino: saldoDestino,
    monto: montoBase,
    monto_moneda_documento: montoMonedaDocumento,
  });

  if (saldoOrigen <= compareTolerance || saldoDestino <= compareTolerance) {
    const err = new Error('Saldo insuficiente en origen o destino');
    (err as any).status = 409;
    throw err;
  }
  if (montoBase - saldoOrigen > compareTolerance) {
    const err = new Error('El monto excede el saldo del origen');
    (err as any).status = 409;
    throw err;
  }
  if (montoMonedaDocumento - saldoDestino > compareTolerance) {
    const err = new Error('El monto excede el saldo del destino');
    (err as any).status = 409;
    throw err;
  }

  const expectedBase = roundFinancial(montoMonedaDocumento * tipoCambioOrigen);
  const diff = Math.abs(roundFinancial(expectedBase - montoBase));
  const tolerance = 0.000001;
  if (diff > tolerance) {
    const err = new Error('Inconsistencia entre monto y monto_moneda_documento respecto al tipo de cambio del origen');
    (err as any).status = 409;
    throw err;
  }

  const impSaldoInsoluto = roundFinancial(impSaldoAnt - montoMonedaDocumento);

  const insertSql = `
    INSERT INTO aplicaciones_saldo (
      empresa_id,
      documento_origen_id,
      documento_destino_id,
      monto,
      monto_moneda_documento,
      fecha_aplicacion,
      fecha_creacion,
      num_parcialidad,
      imp_saldo_ant,
      imp_saldo_insoluto,
      created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8,$9,$10)
    RETURNING *
  `;

  const insertValues = [
    destino.empresa_id,
    origen.id,
    destino.id,
    montoBase,
    montoMonedaDocumento,
    data.fecha_aplicacion ?? null,
    numParcialidad,
    impSaldoAnt,
    impSaldoInsoluto,
    data.created_by ?? null,
  ];

  const { rows: appRows } = await client.query(insertSql, insertValues);
  return appRows[0];
}

export async function crearAplicacionEnTransaccion(
  client: PoolClient,
  data: AplicacionSaldoInput,
  empresaId: number
) {
  return crearAplicacionTx(client, data, empresaId);
}

export async function crearOperacion(data: OperacionInput, empresaId: number): Promise<Operacion> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const operacion = await upsertOperacionDocumentoEnTransaccion(client, data, empresaId);

    await client.query('COMMIT');
    return operacion;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function actualizarOperacion(
  id: number,
  data: OperacionInput,
  empresaId: number
): Promise<Operacion> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const operacion = await upsertOperacionDocumentoEnTransaccion(client, data, empresaId, id);
    await client.query('COMMIT');
    return operacion;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function eliminarOperacion(id: number, empresaId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<Operacion>(
      `SELECT * FROM finanzas_operaciones WHERE id = $1 AND empresa_id = $2 FOR UPDATE`,
      [id, empresaId]
    );
    const operacion = rows[0];
    if (!operacion) throw new Error('Operación no encontrada');

    if (String(operacion.estado_conciliacion ?? '').toLowerCase() !== 'pendiente') {
      throw new Error('No se puede eliminar la operación porque ya está cotejada o conciliada');
    }

    const cuenta = await obtenerCuentaConLock(client, operacion.cuenta_id, empresaId);
    if (!cuenta) throw new Error('Cuenta no encontrada');

    const { rows: documentoPagoRows } = await client.query<{
      id: number;
      estatus_documento: string | null;
    }>(
      `SELECT id, estatus_documento
         FROM documentos
        WHERE finanzas_operacion_id = $1
          AND empresa_id = $2
        LIMIT 1
        FOR UPDATE`,
      [id, empresaId]
    );

    const documentoPago = documentoPagoRows[0];
    if (documentoPago) {
      if (String(documentoPago.estatus_documento ?? '').toLowerCase() === 'timbrado') {
        throw new Error('No se puede eliminar la operación porque el documento de pago asociado está timbrado');
      }

      await client.query('DELETE FROM documentos WHERE id = $1 AND empresa_id = $2', [documentoPago.id, empresaId]);
    }

    const delta = operacion.tipo_movimiento === 'Deposito' ? -Number(operacion.monto) : Number(operacion.monto);
    const nuevoSaldo = Number(cuenta.saldo) + delta;

    await client.query('DELETE FROM finanzas_operaciones WHERE id = $1', [id]);
    await client.query('UPDATE finanzas_cuentas SET saldo = $1 WHERE id = $2', [nuevoSaldo, cuenta.id]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function crearTransferencia(
  data: { cuenta_origen_id: number; cuenta_destino_id: number; fecha: string; monto: number; referencia?: string | null; observaciones?: string | null },
  empresaId: number
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (data.cuenta_origen_id === data.cuenta_destino_id) {
      throw new Error('Las cuentas deben ser distintas');
    }

    const cuentaOrigen = await obtenerCuentaConLock(client, data.cuenta_origen_id, empresaId);
    const cuentaDestino = await obtenerCuentaConLock(client, data.cuenta_destino_id, empresaId);
    if (!cuentaOrigen || !cuentaDestino) throw new Error('Cuenta origen o destino no encontrada');

    const insertTransfer = `
      INSERT INTO finanzas_transferencias (empresa_id, cuenta_origen_id, cuenta_destino_id, monto, fecha, referencia, observaciones)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `;
    const { rows: transferRows } = await client.query(insertTransfer, [
      empresaId,
      data.cuenta_origen_id,
      data.cuenta_destino_id,
      data.monto,
      data.fecha,
      data.referencia ?? null,
      data.observaciones ?? null,
    ]);
    const transferencia = transferRows[0];

    // Retiro origen
    const retiroSaldo = Number(cuentaOrigen.saldo) - Number(data.monto);
    const insertRetiro = `
      INSERT INTO finanzas_operaciones (
        empresa_id, cuenta_id, fecha, tipo_movimiento, monto, referencia, observaciones,
        es_transferencia, transferencia_id, estado_conciliacion, saldo
      ) VALUES ($1,$2,$3,'Retiro',$4,$5,$6,true,$7,'pendiente',$8)
      RETURNING *
    `;
    const { rows: retiroRows } = await client.query(insertRetiro, [
      empresaId,
      data.cuenta_origen_id,
      data.fecha,
      data.monto,
      data.referencia ?? null,
      data.observaciones ?? null,
      transferencia.id,
      retiroSaldo,
    ]);

    // Depósito destino
    const depositoSaldo = Number(cuentaDestino.saldo) + Number(data.monto);
    const insertDeposito = `
      INSERT INTO finanzas_operaciones (
        empresa_id, cuenta_id, fecha, tipo_movimiento, monto, referencia, observaciones,
        es_transferencia, transferencia_id, estado_conciliacion, saldo
      ) VALUES ($1,$2,$3,'Deposito',$4,$5,$6,true,$7,'pendiente',$8)
      RETURNING *
    `;
    const { rows: depositoRows } = await client.query(insertDeposito, [
      empresaId,
      data.cuenta_destino_id,
      data.fecha,
      data.monto,
      data.referencia ?? null,
      data.observaciones ?? null,
      transferencia.id,
      depositoSaldo,
    ]);

    await client.query('UPDATE finanzas_cuentas SET saldo = $1 WHERE id = $2', [retiroSaldo, data.cuenta_origen_id]);
    await client.query('UPDATE finanzas_cuentas SET saldo = $1 WHERE id = $2', [depositoSaldo, data.cuenta_destino_id]);

    await client.query('COMMIT');
    return { transferencia, retiro: retiroRows[0], deposito: depositoRows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function actualizarTransferencia(
  id: number,
  data: { cuenta_origen_id: number; cuenta_destino_id: number; fecha: string; monto: number; referencia?: string | null; observaciones?: string | null },
  empresaId: number
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (data.cuenta_origen_id === data.cuenta_destino_id) {
      throw new Error('Las cuentas deben ser distintas');
    }

    const { rows: transferRows } = await client.query(
      `SELECT * FROM finanzas_transferencias WHERE id = $1 AND empresa_id = $2 FOR UPDATE`,
      [id, empresaId]
    );
    const transferencia = transferRows[0];
    if (!transferencia) throw new Error('Transferencia no encontrada');

    const opsRes = await client.query<Operacion>(
      `SELECT * FROM finanzas_operaciones WHERE transferencia_id = $1 AND empresa_id = $2 FOR UPDATE`,
      [id, empresaId]
    );
    const retiro = opsRes.rows.find((op) => op.tipo_movimiento === 'Retiro');
    const deposito = opsRes.rows.find((op) => op.tipo_movimiento === 'Deposito');
    if (!retiro || !deposito) throw new Error('Operaciones de transferencia incompletas');

    const opsConciliadasUpdate = opsRes.rows.filter(
      (op) => String(op.estado_conciliacion ?? '').toLowerCase() !== 'pendiente'
    );
    if (opsConciliadasUpdate.length > 0) {
      const err = new Error('No se puede modificar una transferencia con operaciones conciliadas.');
      (err as any).status = 409;
      throw err;
    }

    const cuentasALock = new Set<number>([
      transferencia.cuenta_origen_id,
      transferencia.cuenta_destino_id,
      data.cuenta_origen_id,
      data.cuenta_destino_id,
    ]);
    const cuentasLockeadas: Record<number, any> = {};
    for (const cuentaId of cuentasALock) {
      const cuenta = await obtenerCuentaConLock(client, cuentaId, empresaId);
      if (!cuenta) throw new Error('Cuenta no encontrada');
      cuentasLockeadas[cuentaId] = cuenta;
    }

    // Revertir efecto previo
    const origenAnterior = cuentasLockeadas[transferencia.cuenta_origen_id];
    const destinoAnterior = cuentasLockeadas[transferencia.cuenta_destino_id];
    origenAnterior.saldo = Number(origenAnterior.saldo) + Number(transferencia.monto);
    destinoAnterior.saldo = Number(destinoAnterior.saldo) - Number(transferencia.monto);

    // Aplicar nuevos montos
    const origenNuevo = cuentasLockeadas[data.cuenta_origen_id];
    const destinoNuevo = cuentasLockeadas[data.cuenta_destino_id];
    origenNuevo.saldo = Number(origenNuevo.saldo) - Number(data.monto);
    destinoNuevo.saldo = Number(destinoNuevo.saldo) + Number(data.monto);

    await client.query('UPDATE finanzas_cuentas SET saldo = $1 WHERE id = $2', [origenAnterior.saldo, origenAnterior.id]);
    await client.query('UPDATE finanzas_cuentas SET saldo = $1 WHERE id = $2', [destinoAnterior.saldo, destinoAnterior.id]);
    await client.query('UPDATE finanzas_cuentas SET saldo = $1 WHERE id = $2', [origenNuevo.saldo, origenNuevo.id]);
    await client.query('UPDATE finanzas_cuentas SET saldo = $1 WHERE id = $2', [destinoNuevo.saldo, destinoNuevo.id]);

    await client.query(
      `UPDATE finanzas_transferencias
       SET cuenta_origen_id = $1, cuenta_destino_id = $2, monto = $3, fecha = $4, referencia = $5, observaciones = $6
       WHERE id = $7`,
      [data.cuenta_origen_id, data.cuenta_destino_id, data.monto, data.fecha, data.referencia ?? null, data.observaciones ?? null, id]
    );

    await client.query(
      `UPDATE finanzas_operaciones
         SET cuenta_id = $1, fecha = $2, tipo_movimiento = 'Retiro', monto = $3, referencia = $4, observaciones = $5,
             es_transferencia = true, transferencia_id = $6, saldo = $7
       WHERE id = $8`,
      [data.cuenta_origen_id, data.fecha, data.monto, data.referencia ?? null, data.observaciones ?? null, id, origenNuevo.saldo, retiro.id]
    );

    await client.query(
      `UPDATE finanzas_operaciones
         SET cuenta_id = $1, fecha = $2, tipo_movimiento = 'Deposito', monto = $3, referencia = $4, observaciones = $5,
             es_transferencia = true, transferencia_id = $6, saldo = $7
       WHERE id = $8`,
      [data.cuenta_destino_id, data.fecha, data.monto, data.referencia ?? null, data.observaciones ?? null, id, destinoNuevo.saldo, deposito.id]
    );

    await client.query('COMMIT');
    return { id, ...data };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function eliminarTransferencia(id: number, empresaId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: transferRows } = await client.query(
      `SELECT * FROM finanzas_transferencias WHERE id = $1 AND empresa_id = $2 FOR UPDATE`,
      [id, empresaId]
    );
    const transferencia = transferRows[0];
    if (!transferencia) throw new Error('Transferencia no encontrada');

    const { rows: ops } = await client.query<Operacion>(
      `SELECT * FROM finanzas_operaciones WHERE transferencia_id = $1 AND empresa_id = $2 FOR UPDATE`,
      [id, empresaId]
    );
    const retiro = ops.find((op) => op.tipo_movimiento === 'Retiro');
    const deposito = ops.find((op) => op.tipo_movimiento === 'Deposito');

    const opsConciliadasDelete = ops.filter(
      (op) => String(op.estado_conciliacion ?? '').toLowerCase() !== 'pendiente'
    );
    if (opsConciliadasDelete.length > 0) {
      const err = new Error('No se puede eliminar una transferencia con operaciones conciliadas.');
      (err as any).status = 409;
      throw err;
    }

    const cuentaOrigen = await obtenerCuentaConLock(client, transferencia.cuenta_origen_id, empresaId);
    const cuentaDestino = await obtenerCuentaConLock(client, transferencia.cuenta_destino_id, empresaId);
    if (!cuentaOrigen || !cuentaDestino) throw new Error('Cuenta no encontrada');

    const monto = Number(transferencia.monto);
    const saldoOrigen = Number(cuentaOrigen.saldo) + (retiro ? monto : 0);
    const saldoDestino = Number(cuentaDestino.saldo) - (deposito ? monto : 0);

    await client.query('UPDATE finanzas_cuentas SET saldo = $1 WHERE id = $2', [saldoOrigen, cuentaOrigen.id]);
    await client.query('UPDATE finanzas_cuentas SET saldo = $1 WHERE id = $2', [saldoDestino, cuentaDestino.id]);

    await client.query('DELETE FROM finanzas_operaciones WHERE transferencia_id = $1 AND empresa_id = $2', [id, empresaId]);
    await client.query('DELETE FROM finanzas_transferencias WHERE id = $1 AND empresa_id = $2', [id, empresaId]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function crearConciliacion(
  data: { cuenta_id: number; fecha_corte: string; saldo_banco: number; observaciones?: string | null },
  empresaId: number
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cuenta = await obtenerCuentaConLock(client, data.cuenta_id, empresaId);
    if (!cuenta) throw new Error('Cuenta no encontrada');

    const insert = `
      INSERT INTO finanzas_conciliaciones (empresa_id, cuenta_id, fecha_corte, saldo_banco, observaciones)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
    `;
    const { rows } = await client.query(insert, [
      empresaId,
      data.cuenta_id,
      data.fecha_corte,
      data.saldo_banco,
      data.observaciones ?? null,
    ]);

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function crearAplicacion(
  data: AplicacionSaldoInput,
  empresaId: number
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = await crearAplicacionTx(client, data, empresaId);

    await client.query('COMMIT');
    return created;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function aplicarAnticiposDocumentoDestino(
  data: AplicacionAnticipoBatchInput,
  empresaId: number
) {
  const client = await pool.connect();
  try {
    const documentoOrigenId = Number(data.documento_origen_id ?? 0);
    const documentoDestinoId = Number(data.documento_destino_id ?? 0);
    const aplicaciones = Array.isArray(data.aplicaciones) ? data.aplicaciones : [];

    if (!documentoOrigenId || !documentoDestinoId) {
      const err = new Error('documento_origen_id y documento_destino_id son obligatorios');
      (err as any).status = 400;
      throw err;
    }
    if (aplicaciones.length === 0) {
      const err = new Error('Se requiere al menos una aplicación');
      (err as any).status = 400;
      throw err;
    }

    await client.query('BEGIN');

    const { rows: sourceRows } = await client.query<{
      id: number;
      tipo_documento: string;
      empresa_id: number;
    }>(
      `SELECT id, tipo_documento, empresa_id
       FROM documentos
       WHERE id = $1 AND empresa_id = $2
       FOR SHARE`,
      [documentoOrigenId, empresaId]
    );
    const documentoOrigen = sourceRows[0];
    if (!documentoOrigen) {
      const err = new Error('Documento origen no encontrado');
      (err as any).status = 404;
      throw err;
    }

    const regla = obtenerReglaDocumentoOrigenFinanciero(documentoOrigen.tipo_documento);
    if (!regla) {
      const err = new Error('El documento origen no soporta anticipos');
      (err as any).status = 400;
      throw err;
    }

    const { rows: destinoRows } = await client.query<{
      id: number;
      empresa_id: number;
      documento_origen_id: number | null;
      tipo_documento: string;
    }>(
      `SELECT id, empresa_id, documento_origen_id, tipo_documento
       FROM documentos
       WHERE id = $1 AND empresa_id = $2
       FOR SHARE`,
      [documentoDestinoId, empresaId]
    );
    const documentoDestino = destinoRows[0];
    if (!documentoDestino) {
      const err = new Error('Documento destino no encontrado');
      (err as any).status = 404;
      throw err;
    }
    if (documentoDestino.documento_origen_id !== documentoOrigenId) {
      const err = new Error('La factura destino no está ligada al documento origen indicado');
      (err as any).status = 409;
      throw err;
    }

    const requestedOperationIds = Array.from(new Set(aplicaciones.map((item) => Number(item.finanzas_operacion_id)).filter((id) => id > 0)));
    const { rows: operationRows } = await client.query<{
      id: number;
      documento_origen_id: number | null;
      tipo_movimiento: string;
      naturaleza_operacion: string;
    }>(
      `SELECT id, documento_origen_id, tipo_movimiento, naturaleza_operacion
       FROM finanzas_operaciones
       WHERE empresa_id = $1
         AND id = ANY($2::int[])
       FOR UPDATE`,
      [empresaId, requestedOperationIds]
    );

    if (operationRows.length !== requestedOperationIds.length) {
      const err = new Error('Una o más operaciones de anticipo no existen');
      (err as any).status = 404;
      throw err;
    }

    const operationMap = new Map(operationRows.map((row) => [Number(row.id), row]));
    const created: any[] = [];
    for (const item of aplicaciones) {
      const operation = operationMap.get(Number(item.finanzas_operacion_id));
      if (!operation) {
        const err = new Error('Operación de anticipo no encontrada');
        (err as any).status = 404;
        throw err;
      }
      if (Number(operation.documento_origen_id ?? 0) !== documentoOrigenId) {
        const err = new Error('La operación no pertenece al documento origen');
        (err as any).status = 409;
        throw err;
      }
      if (String(operation.tipo_movimiento ?? '') !== regla.tipoMovimiento || String(operation.naturaleza_operacion ?? '') !== regla.naturaleza) {
        const err = new Error('La operación no es compatible con el flujo de anticipo del documento origen');
        (err as any).status = 409;
        throw err;
      }

      const monto = Number(item.monto ?? 0);
      const montoMonedaDocumento = Number(item.monto_moneda_documento ?? item.monto ?? 0);
      const fechaAplicacion = item.fecha_aplicacion ?? data.fecha_aplicacion ?? currentCivilDate();

      const createdRow = await crearAplicacionTx(
        client,
        {
          documento_origen_id: documentoOrigenId,
          documento_destino_id: documentoDestinoId,
          monto,
          monto_moneda_documento: montoMonedaDocumento,
          fecha_aplicacion: fechaAplicacion,
          created_by: data.created_by ?? null,
        },
        empresaId
      );
      created.push(createdRow);
    }

    await client.query('COMMIT');
    return created;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function verificarSaldosCuentas(empresaId: number) {
  const sql = `
    SELECT
      fc.id,
      fc.identificador,
      fc.moneda,
      fc.saldo                                                        AS saldo_registrado,
      fc.saldo_inicial + COALESCE(SUM(
        CASE WHEN fo.tipo_movimiento = 'Deposito' THEN fo.monto ELSE -fo.monto END
      ), 0)                                                           AS saldo_calculado,
      fc.saldo - (fc.saldo_inicial + COALESCE(SUM(
        CASE WHEN fo.tipo_movimiento = 'Deposito' THEN fo.monto ELSE -fo.monto END
      ), 0))                                                          AS diferencia
    FROM finanzas_cuentas fc
    LEFT JOIN finanzas_operaciones fo
      ON fo.cuenta_id = fc.id AND fo.empresa_id = fc.empresa_id
    WHERE fc.empresa_id = $1
    GROUP BY fc.id, fc.identificador, fc.moneda, fc.saldo, fc.saldo_inicial
    ORDER BY ABS(
      fc.saldo - (fc.saldo_inicial + COALESCE(SUM(
        CASE WHEN fo.tipo_movimiento = 'Deposito' THEN fo.monto ELSE -fo.monto END
      ), 0))
    ) DESC NULLS LAST
  `;
  const { rows } = await pool.query(sql, [empresaId]);
  const conDiferencia = rows.filter((r) => Math.abs(Number(r.diferencia ?? 0)) > 0.01);
  return {
    cuentas: rows,
    tiene_diferencias: conDiferencia.length > 0,
    total_cuentas_con_diferencia: conDiferencia.length,
  };
}

export async function diagnosticarDuplicadosAplicaciones(empresaId: number) {
  const sql = `
    SELECT
      a.documento_origen_id,
      a.documento_destino_id,
      COUNT(*)           AS total_aplicaciones,
      SUM(a.monto)       AS monto_total_aplicado,
      doc_o.tipo_documento AS tipo_origen,
      doc_d.tipo_documento AS tipo_destino
    FROM aplicaciones_saldo a
    LEFT JOIN documentos doc_o ON doc_o.id = a.documento_origen_id AND doc_o.empresa_id = a.empresa_id
    LEFT JOIN documentos doc_d ON doc_d.id = a.documento_destino_id AND doc_d.empresa_id = a.empresa_id
    WHERE a.empresa_id = $1
    GROUP BY a.documento_origen_id, a.documento_destino_id, doc_o.tipo_documento, doc_d.tipo_documento
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `;
  const { rows } = await pool.query(sql, [empresaId]);
  return {
    tiene_duplicados: rows.length > 0,
    total_pares_duplicados: rows.length,
    duplicados: rows,
    recomendacion: rows.length === 0
      ? 'No se encontraron pares duplicados. Es seguro agregar UNIQUE(documento_origen_id, documento_destino_id) en una próxima migración.'
      : `Se encontraron ${rows.length} pares con más de una aplicación al mismo par origen-destino. Revisar manualmente antes de agregar constraint UNIQUE.`,
  };
}

export async function eliminarAplicacion(id: number, empresaId: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Leer aplicación con FOR UPDATE en tabla aplicaciones_saldo
    const appSql = `
      SELECT *
      FROM aplicaciones_saldo
      WHERE id = $1 AND empresa_id = $2
      FOR UPDATE
    `;
    const { rows } = await client.query(appSql, [id, empresaId]);
    const app = rows[0];
    if (!app) {
      const err = new Error('Aplicación no encontrada');
      (err as any).status = 404;
      throw err;
    }

    // Verificar que sea la última aplicación del documento destino.
    // Las aplicaciones anteriores tienen campos CFDI (num_parcialidad, imp_saldo_ant,
    // imp_saldo_insoluto) que dependen del orden; eliminar una intermedia los dejaría inconsistentes.
    const { rows: posterioresRows } = await client.query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt
       FROM aplicaciones_saldo
       WHERE documento_destino_id = $1 AND empresa_id = $2 AND id > $3`,
      [app.documento_destino_id, empresaId, id]
    );
    if (Number(posterioresRows[0]?.cnt ?? 0) > 0) {
      const err = new Error(
        'Solo se puede eliminar la última aplicación de este documento. ' +
        'Existen aplicaciones posteriores cuyos campos CFDI (num_parcialidad, imp_saldo_ant, imp_saldo_insoluto) ' +
        'dependen de esta. Elimine primero la aplicación más reciente.'
      );
      (err as any).status = 409;
      throw err;
    }

    // 2) Bloquear documento destino primero
    const destSql = `
      SELECT id
      FROM documentos
      WHERE id = $1 AND empresa_id = $2
      FOR UPDATE
    `;
    await client.query(destSql, [app.documento_destino_id, empresaId]);

    // 3) Bloquear origen documental
    if (app.documento_origen_id) {
      const origenDocSql = `
        SELECT id
        FROM documentos
        WHERE id = $1 AND empresa_id = $2
        FOR UPDATE
      `;
      await client.query(origenDocSql, [app.documento_origen_id, empresaId]);
    }

    // 4) Eliminar aplicación (DELETE real)
    const deleteSql = `
      DELETE FROM aplicaciones_saldo
      WHERE id = $1 AND empresa_id = $2
    `;
    await client.query(deleteSql, [id, empresaId]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Catálogo: finanzas_metodos_pago ────────────────────────────────────────────

export type FinanzasMetodoPago = {
  id: number;
  empresa_id: number;
  clave: string;
  nombre: string;
  activo: boolean;
  requiere_referencia: boolean;
  es_efectivo: boolean;
  forma_pago_sat: string | null;
  created_at: string;
};

export type MetodoPagoInput = {
  clave: string;
  nombre: string;
  activo?: boolean;
  requiere_referencia?: boolean;
  es_efectivo?: boolean;
  forma_pago_sat?: string | null;
};

export async function listarMetodosPago(empresaId: number, soloActivos = false): Promise<FinanzasMetodoPago[]> {
  const where = soloActivos ? 'WHERE empresa_id = $1 AND activo = true' : 'WHERE empresa_id = $1';
  const { rows } = await pool.query<FinanzasMetodoPago>(
    `SELECT * FROM public.finanzas_metodos_pago ${where} ORDER BY nombre ASC`,
    [empresaId]
  );
  return rows;
}

export async function crearMetodoPago(data: MetodoPagoInput, empresaId: number): Promise<FinanzasMetodoPago> {
  const { rows } = await pool.query<FinanzasMetodoPago>(
    `INSERT INTO public.finanzas_metodos_pago
       (empresa_id, clave, nombre, activo, requiere_referencia, es_efectivo, forma_pago_sat)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      empresaId,
      data.clave.trim(),
      data.nombre.trim(),
      data.activo ?? true,
      data.requiere_referencia ?? false,
      data.es_efectivo ?? false,
      data.forma_pago_sat ?? null,
    ]
  );
  if (!rows[0]) throw new Error('No se pudo crear el método de pago');
  return rows[0];
}

export async function actualizarMetodoPago(
  id: number,
  data: Partial<MetodoPagoInput>,
  empresaId: number
): Promise<FinanzasMetodoPago> {
  const { rows: existing } = await pool.query<FinanzasMetodoPago>(
    'SELECT * FROM public.finanzas_metodos_pago WHERE id = $1 AND empresa_id = $2',
    [id, empresaId]
  );
  if (!existing[0]) throw Object.assign(new Error('Método de pago no encontrado'), { status: 404 });

  const current = existing[0];
  const { rows } = await pool.query<FinanzasMetodoPago>(
    `UPDATE public.finanzas_metodos_pago
     SET clave               = $1,
         nombre              = $2,
         activo              = $3,
         requiere_referencia = $4,
         es_efectivo         = $5,
         forma_pago_sat      = $6
     WHERE id = $7 AND empresa_id = $8
     RETURNING *`,
    [
      data.clave             !== undefined ? data.clave.trim()             : current.clave,
      data.nombre            !== undefined ? data.nombre.trim()            : current.nombre,
      data.activo            !== undefined ? data.activo                   : current.activo,
      data.requiere_referencia !== undefined ? data.requiere_referencia    : current.requiere_referencia,
      data.es_efectivo       !== undefined ? data.es_efectivo              : current.es_efectivo,
      data.forma_pago_sat    !== undefined ? data.forma_pago_sat           : current.forma_pago_sat,
      id,
      empresaId,
    ]
  );
  if (!rows[0]) throw new Error('No se pudo actualizar el método de pago');
  return rows[0];
}

// ── Programación de pagos ──────────────────────────────────────────────────────

export type ProgramacionPagoDetalle = {
  id: number;
  empresa_id: number;
  programacion_id: number;
  documento_id: number;
  monto_programado: number;
  moneda: string;
  created_at: string;
  updated_at: string;
  // joined
  documento_serie?: string | null;
  documento_numero?: number | null;
  documento_serie_externa?: string | null;
  documento_numero_externo?: number | null;
  documento_fecha_vencimiento?: string | null;
};

export type ProgramacionPago = {
  id: number;
  empresa_id: number;
  documento_id: number | null;  // nullable: NULL para multi-factura, legacy para v1
  proveedor_id: number | null;
  fecha_programada: string;
  monto_programado: number;  // total de todos los detalles
  moneda: string;
  cuenta_origen_id: number | null;
  metodo_pago_id: number | null;
  referencia: string | null;
  estatus: 'programado' | 'pagado' | 'cancelado';
  notas: string | null;
  documento_pago_id: number | null;
  finanzas_operacion_id: number | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
  // joined
  proveedor_nombre?: string | null;
  numero_facturas?: number;
  folios_resumen?: string | null;
  // primer documento (backward compat display)
  documento_serie?: string | null;
  documento_numero?: number | null;
  documento_serie_externa?: string | null;
  documento_numero_externo?: number | null;
  documento_folio?: string | null;
  documento_folio_proveedor?: string | null;
  documento_fecha_vencimiento?: string | null;
  cuenta_identificador?: string | null;
  metodo_pago_nombre?: string | null;
  detalles?: ProgramacionPagoDetalle[];
};

export type ProgramacionPagoInput = {
  proveedor_id: number;
  fecha_programada: string;
  moneda: string;
  cuenta_origen_id?: number | null;
  metodo_pago_id?: number | null;
  referencia?: string | null;
  notas?: string | null;
  detalles: Array<{
    documento_id: number;
    monto_programado: number;
  }>;
};

export type FacturaCompraPendiente = {
  id: number;
  serie: string;
  numero: number;
  serie_externa: string | null;
  numero_externo: number | null;
  folio: string;
  folio_proveedor: string;
  fecha_documento: string;
  fecha_vencimiento: string | null;
  proveedor_id: number;
  proveedor_nombre: string;
  moneda: string;
  total: number;
  saldo: number;
  saldo_disponible_programar: number;
};

export async function listarFacturasCompraPendientes(
  empresaId: number,
  opts?: { proveedorId?: number | null; search?: string | null; excludeProgramacionId?: number | null }
): Promise<FacturaCompraPendiente[]> {
  // $1 = empresaId, $2 = excludeProgramacionId (puede ser null)
  const excludeProgId = opts?.excludeProgramacionId ?? null;
  const args: unknown[] = [empresaId, excludeProgId];
  const filtros: string[] = [];

  if (opts?.proveedorId) {
    args.push(opts.proveedorId);
    filtros.push(`AND d.contacto_principal_id = $${args.length}`);
  }
  if (opts?.search) {
    args.push(`%${opts.search}%`);
    filtros.push(`AND (c.nombre ILIKE $${args.length} OR CAST(d.numero AS text) ILIKE $${args.length} OR d.serie_externa ILIKE $${args.length})`);
  }

  const { rows } = await pool.query(
    `SELECT
       d.id,
       d.serie,
       d.numero,
       d.serie_externa,
       d.numero_externo,
       d.fecha_documento::date AS fecha_documento,
       d.fecha_vencimiento::date AS fecha_vencimiento,
       d.contacto_principal_id AS proveedor_id,
       COALESCE(c.nombre, '') AS proveedor_nombre,
       d.moneda,
       COALESCE(d.total, 0)::numeric AS total,
       GREATEST(0, COALESCE(d.total, 0)::numeric - COALESCE(
         (SELECT SUM(a.monto_moneda_documento) FROM aplicaciones_saldo a
          WHERE a.documento_destino_id = d.id AND a.empresa_id = d.empresa_id), 0
       )) AS saldo,
       COALESCE(
         (SELECT SUM(det.monto_programado)
          FROM finanzas_programacion_pagos_detalle det
          JOIN finanzas_programacion_pagos pp
            ON pp.id = det.programacion_id AND pp.empresa_id = det.empresa_id
          WHERE det.documento_id = d.id AND det.empresa_id = d.empresa_id
            AND pp.estatus = 'programado'
            AND ($2::integer IS NULL OR pp.id != $2::integer)), 0
       ) AS total_programado
     FROM documentos d
     LEFT JOIN contactos c ON c.id = d.contacto_principal_id AND c.empresa_id = d.empresa_id
     WHERE d.empresa_id = $1
       AND d.tipo_documento = 'factura_compra'
       AND LOWER(COALESCE(d.estatus_documento, '')) NOT IN ('cancelado', 'cancelada', 'borrador')
       ${filtros.join(' ')}
     ORDER BY d.fecha_documento DESC, d.id DESC
     LIMIT 50`,
    args
  );

  return rows
    .filter((r) => Number(r.saldo ?? 0) > 0.001)
    .map((r) => {
      const serie = String(r.serie ?? '').trim();
      const num = Number(r.numero ?? 0);
      const serieExt = String(r.serie_externa ?? '').trim();
      const numExt = Number(r.numero_externo ?? 0);
      const saldo = Number(r.saldo ?? 0);
      const totalProgramado = Number(r.total_programado ?? 0);
      return {
        id: r.id as number,
        serie,
        numero: num,
        serie_externa: serieExt || null,
        numero_externo: numExt > 0 ? numExt : null,
        folio: serie || num > 0 ? `${serie}${num}` : String(r.id),
        folio_proveedor: serieExt || numExt > 0 ? `${serieExt}${numExt}` : '',
        fecha_documento: r.fecha_documento ? String(r.fecha_documento).slice(0, 10) : '',
        fecha_vencimiento: r.fecha_vencimiento ? toIsoDateStr(r.fecha_vencimiento) : null,
        proveedor_id: r.proveedor_id as number,
        proveedor_nombre: String(r.proveedor_nombre ?? ''),
        moneda: String(r.moneda ?? 'MXN'),
        total: Number(r.total ?? 0),
        saldo,
        saldo_disponible_programar: Math.max(0, saldo - totalProgramado),
      };
    });
}

export async function listarProgramacionesPago(
  empresaId: number,
  filtros?: {
    id?: number | null;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    proveedorId?: number | null;
    estatus?: string | null;
    cuentaOrigenId?: number | null;
    metodoPagoId?: number | null;
    moneda?: string | null;
  }
): Promise<ProgramacionPago[]> {
  const args: unknown[] = [empresaId];
  const conds: string[] = [];

  if (filtros?.id) {
    args.push(filtros.id);
    conds.push(`AND pp.id = $${args.length}`);
  }
  if (filtros?.fechaInicio) {
    args.push(filtros.fechaInicio);
    conds.push(`AND pp.fecha_programada >= $${args.length}`);
  }
  if (filtros?.fechaFin) {
    args.push(filtros.fechaFin);
    conds.push(`AND pp.fecha_programada <= $${args.length}`);
  }
  if (filtros?.proveedorId) {
    args.push(filtros.proveedorId);
    conds.push(`AND pp.proveedor_id = $${args.length}`);
  }
  if (filtros?.estatus) {
    args.push(filtros.estatus);
    conds.push(`AND pp.estatus = $${args.length}`);
  }
  if (filtros?.cuentaOrigenId) {
    args.push(filtros.cuentaOrigenId);
    conds.push(`AND pp.cuenta_origen_id = $${args.length}`);
  }
  if (filtros?.metodoPagoId) {
    args.push(filtros.metodoPagoId);
    conds.push(`AND pp.metodo_pago_id = $${args.length}`);
  }
  if (filtros?.moneda) {
    args.push(filtros.moneda);
    conds.push(`AND UPPER(pp.moneda) = UPPER($${args.length})`);
  }

  const { rows } = await pool.query(
    `SELECT
       pp.*,
       COALESCE(c.nombre, '') AS proveedor_nombre,
       -- Primer detalle (para display backward-compat de folio único)
       primer.serie AS documento_serie,
       primer.numero AS documento_numero,
       primer.serie_externa AS documento_serie_externa,
       primer.numero_externo AS documento_numero_externo,
       COALESCE(primer.serie, '') || CAST(COALESCE(primer.numero, 0) AS text) AS documento_folio,
       CASE WHEN primer.serie_externa IS NOT NULL OR primer.numero_externo IS NOT NULL
            THEN COALESCE(primer.serie_externa, '') || CAST(COALESCE(primer.numero_externo, 0) AS text)
            ELSE NULL END AS documento_folio_proveedor,
       primer.fecha_vencimiento AS documento_fecha_vencimiento,
       -- Resumen de detalles
       COALESCE(det_cnt.cnt, 0) AS numero_facturas,
       det_cnt.folios_resumen,
       fc.identificador AS cuenta_identificador,
       mp.nombre AS metodo_pago_nombre
     FROM finanzas_programacion_pagos pp
     LEFT JOIN LATERAL (
       SELECT d2.serie, d2.numero, d2.serie_externa, d2.numero_externo,
              d2.fecha_vencimiento::date AS fecha_vencimiento
       FROM finanzas_programacion_pagos_detalle det
       JOIN documentos d2 ON d2.id = det.documento_id
       WHERE det.programacion_id = pp.id
       ORDER BY det.id ASC
       LIMIT 1
     ) primer ON true
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*)::int AS cnt,
         STRING_AGG(
           CASE WHEN d3.serie_externa IS NOT NULL OR d3.numero_externo IS NOT NULL
                THEN COALESCE(d3.serie_externa,'') || CAST(COALESCE(d3.numero_externo,0) AS text)
                ELSE COALESCE(d3.serie,'') || CAST(COALESCE(d3.numero,0) AS text)
           END,
           ', ' ORDER BY det2.id ASC
         ) AS folios_resumen
       FROM finanzas_programacion_pagos_detalle det2
       JOIN documentos d3 ON d3.id = det2.documento_id
       WHERE det2.programacion_id = pp.id
     ) det_cnt ON true
     LEFT JOIN contactos c
       ON c.id = pp.proveedor_id AND c.empresa_id = pp.empresa_id
     LEFT JOIN finanzas_cuentas fc
       ON fc.id = pp.cuenta_origen_id AND fc.empresa_id = pp.empresa_id
     LEFT JOIN finanzas_metodos_pago mp
       ON mp.id = pp.metodo_pago_id AND mp.empresa_id = pp.empresa_id
     WHERE pp.empresa_id = $1
       ${conds.join(' ')}
     ORDER BY pp.fecha_programada ASC, pp.id ASC`,
    args
  );

  const programaciones: ProgramacionPago[] = rows.map((r) => ({
    id: r.id as number,
    empresa_id: r.empresa_id as number,
    documento_id: r.documento_id != null ? (r.documento_id as number) : null,
    proveedor_id: r.proveedor_id as number | null,
    fecha_programada: r.fecha_programada ? toIsoDateStr(r.fecha_programada) : '',
    monto_programado: Number(r.monto_programado ?? 0),
    moneda: String(r.moneda ?? 'MXN'),
    cuenta_origen_id: r.cuenta_origen_id as number | null,
    metodo_pago_id: r.metodo_pago_id as number | null,
    referencia: r.referencia ? String(r.referencia) : null,
    estatus: r.estatus as 'programado' | 'pagado' | 'cancelado',
    notas: r.notas ? String(r.notas) : null,
    documento_pago_id: r.documento_pago_id as number | null,
    finanzas_operacion_id: r.finanzas_operacion_id as number | null,
    created_by: r.created_by as number | null,
    updated_by: r.updated_by as number | null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    proveedor_nombre: r.proveedor_nombre ? String(r.proveedor_nombre) : null,
    numero_facturas: Number(r.numero_facturas ?? 0),
    folios_resumen: r.folios_resumen ? String(r.folios_resumen) : null,
    documento_serie: r.documento_serie ? String(r.documento_serie) : null,
    documento_numero: r.documento_numero != null ? Number(r.documento_numero) : null,
    documento_serie_externa: r.documento_serie_externa ? String(r.documento_serie_externa) : null,
    documento_numero_externo: r.documento_numero_externo != null ? Number(r.documento_numero_externo) : null,
    documento_folio: r.documento_folio ? String(r.documento_folio) : null,
    documento_folio_proveedor: r.documento_folio_proveedor ? String(r.documento_folio_proveedor) : null,
    documento_fecha_vencimiento: r.documento_fecha_vencimiento
      ? toIsoDateStr(r.documento_fecha_vencimiento)
      : null,
    cuenta_identificador: r.cuenta_identificador ? String(r.cuenta_identificador) : null,
    metodo_pago_nombre: r.metodo_pago_nombre ? String(r.metodo_pago_nombre) : null,
    detalles: [],
  }));

  // Cargar detalles para todas las programaciones en una sola query
  if (programaciones.length > 0) {
    const ids = programaciones.map((p) => p.id);
    const { rows: detRows } = await pool.query(
      `SELECT
         det.*,
         d.serie, d.numero, d.serie_externa, d.numero_externo,
         d.fecha_vencimiento::date AS documento_fecha_vencimiento
       FROM finanzas_programacion_pagos_detalle det
       JOIN documentos d ON d.id = det.documento_id
       WHERE det.programacion_id = ANY($1::int[]) AND det.empresa_id = $2
       ORDER BY det.programacion_id, det.id ASC`,
      [ids, programaciones[0]!.empresa_id]
    );

    const detallesPorProg = new Map<number, ProgramacionPagoDetalle[]>();
    for (const dr of detRows) {
      const pid = dr.programacion_id as number;
      if (!detallesPorProg.has(pid)) detallesPorProg.set(pid, []);
      detallesPorProg.get(pid)!.push({
        id: dr.id as number,
        empresa_id: dr.empresa_id as number,
        programacion_id: pid,
        documento_id: dr.documento_id as number,
        monto_programado: Number(dr.monto_programado ?? 0),
        moneda: String(dr.moneda ?? 'MXN'),
        created_at: String(dr.created_at),
        updated_at: String(dr.updated_at),
        documento_serie: dr.serie ? String(dr.serie) : null,
        documento_numero: dr.numero != null ? Number(dr.numero) : null,
        documento_serie_externa: dr.serie_externa ? String(dr.serie_externa) : null,
        documento_numero_externo: dr.numero_externo != null ? Number(dr.numero_externo) : null,
        documento_fecha_vencimiento: dr.documento_fecha_vencimiento
          ? toIsoDateStr(dr.documento_fecha_vencimiento)
          : null,
      });
    }

    for (const prog of programaciones) {
      prog.detalles = detallesPorProg.get(prog.id) ?? [];
    }
  }

  return programaciones;
}

// ---------------------------------------------------------------------------
// Helpers internos para validación y creación de detalles
// ---------------------------------------------------------------------------

async function validarCabeceraInput(
  client: PoolClient,
  data: ProgramacionPagoInput,
  empresaId: number
): Promise<void> {
  if (!data.proveedor_id) {
    throw Object.assign(new Error('proveedor_id es requerido'), { status: 422 });
  }
  if (!data.detalles || data.detalles.length === 0) {
    throw Object.assign(new Error('Debe incluir al menos una factura en los detalles'), { status: 422 });
  }

  const { rows: prvRows } = await client.query(
    `SELECT id FROM contactos WHERE id = $1 AND empresa_id = $2`,
    [data.proveedor_id, empresaId]
  );
  if (!prvRows[0]) throw Object.assign(new Error('Proveedor no encontrado'), { status: 404 });

  if (data.cuenta_origen_id) {
    const { rows: cuentaRows } = await client.query(
      `SELECT id FROM finanzas_cuentas WHERE id = $1 AND empresa_id = $2 AND NOT COALESCE(cuenta_cerrada, false)`,
      [data.cuenta_origen_id, empresaId]
    );
    if (!cuentaRows[0]) throw Object.assign(new Error('La cuenta origen no existe o está cerrada'), { status: 422 });
  }

  if (data.metodo_pago_id) {
    const { rows: mpRows } = await client.query<{ requiere_referencia: boolean }>(
      `SELECT requiere_referencia FROM finanzas_metodos_pago WHERE id = $1 AND empresa_id = $2 AND activo = true`,
      [data.metodo_pago_id, empresaId]
    );
    if (!mpRows[0]) throw Object.assign(new Error('El método de pago no existe, está inactivo o no pertenece a esta empresa'), { status: 422 });
    if (mpRows[0].requiere_referencia && !data.referencia?.trim()) {
      throw Object.assign(new Error('El método de pago seleccionado requiere una referencia'), { status: 422 });
    }
  }
}

async function validarYComputarDetalles(
  client: PoolClient,
  data: ProgramacionPagoInput,
  empresaId: number,
  excludeId?: number
): Promise<number> {
  const docIds = data.detalles.map((d) => d.documento_id);
  if (new Set(docIds).size !== docIds.length) {
    throw Object.assign(new Error('No se puede incluir la misma factura más de una vez'), { status: 422 });
  }

  let total = 0;
  for (const det of data.detalles) {
    if (!det.documento_id || !(det.monto_programado > 0)) {
      throw Object.assign(new Error('Cada detalle debe tener documento_id y monto_programado > 0'), { status: 422 });
    }

    const { rows: docRows } = await client.query<{
      tipo_documento: string; estatus_documento: string;
      moneda: string; contacto_principal_id: number | null;
    }>(
      `SELECT tipo_documento, estatus_documento, moneda, contacto_principal_id
       FROM documentos WHERE id = $1 AND empresa_id = $2`,
      [det.documento_id, empresaId]
    );
    const doc = docRows[0];
    if (!doc) throw Object.assign(new Error(`Documento ${det.documento_id} no encontrado`), { status: 404 });
    if (doc.tipo_documento !== 'factura_compra') {
      throw Object.assign(new Error(`El documento ${det.documento_id} no es una factura de compra`), { status: 422 });
    }
    if (['cancelado', 'cancelada', 'borrador'].includes(String(doc.estatus_documento ?? '').toLowerCase())) {
      throw Object.assign(new Error(`El documento ${det.documento_id} está cancelado o en borrador`), { status: 422 });
    }
    if (doc.contacto_principal_id !== data.proveedor_id) {
      throw Object.assign(
        new Error(`El documento ${det.documento_id} no pertenece al proveedor seleccionado`),
        { status: 422 }
      );
    }
    if (String(doc.moneda ?? 'MXN').toUpperCase() !== String(data.moneda ?? 'MXN').toUpperCase()) {
      throw Object.assign(
        new Error(`La moneda '${data.moneda}' no coincide con la del documento ${det.documento_id} ('${doc.moneda}')`),
        { status: 422 }
      );
    }

    const { rows: saldoRows } = await client.query<{ saldo: string }>(
      `SELECT GREATEST(0, COALESCE(d.total, 0) - COALESCE(
         (SELECT SUM(a.monto_moneda_documento) FROM aplicaciones_saldo a
          WHERE a.documento_destino_id = d.id AND a.empresa_id = d.empresa_id), 0
       )) AS saldo FROM documentos d WHERE d.id = $1`,
      [det.documento_id]
    );
    const saldoDoc = Number(saldoRows[0]?.saldo ?? 0);

    const excludeArgs: unknown[] = excludeId ? [excludeId] : [];
    const { rows: progRows } = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(det2.monto_programado), 0) AS total
       FROM finanzas_programacion_pagos_detalle det2
       JOIN finanzas_programacion_pagos pp ON pp.id = det2.programacion_id
       WHERE det2.documento_id = $1 AND det2.empresa_id = $2 AND pp.estatus = 'programado'
       ${excludeId ? `AND pp.id != $3` : ''}`,
      [det.documento_id, empresaId, ...excludeArgs]
    );
    const totalProgExistente = Number(progRows[0]?.total ?? 0);
    const disponible = saldoDoc - totalProgExistente;

    if (det.monto_programado > disponible + 0.000001) {
      throw Object.assign(
        new Error(`El monto ${det.monto_programado} para la factura ${det.documento_id} excede el saldo disponible para programar (${disponible.toFixed(2)})`),
        { status: 422 }
      );
    }

    total += det.monto_programado;
  }

  return total;
}

async function insertarDetalles(
  client: PoolClient,
  programacionId: number,
  empresaId: number,
  detalles: Array<{ documento_id: number; monto_programado: number }>,
  moneda: string
): Promise<void> {
  for (const det of detalles) {
    await client.query(
      `INSERT INTO finanzas_programacion_pagos_detalle
         (empresa_id, programacion_id, documento_id, monto_programado, moneda)
       VALUES ($1, $2, $3, $4, $5)`,
      [empresaId, programacionId, det.documento_id, det.monto_programado, moneda]
    );
  }
}

// ---------------------------------------------------------------------------

export async function crearProgramacionPago(
  data: ProgramacionPagoInput,
  empresaId: number,
  userId?: number | null
): Promise<ProgramacionPago> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await validarCabeceraInput(client, data, empresaId);
    const total = await validarYComputarDetalles(client, data, empresaId);

    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO finanzas_programacion_pagos
         (empresa_id, documento_id, proveedor_id, fecha_programada, monto_programado, moneda,
          cuenta_origen_id, metodo_pago_id, referencia, estatus, notas, created_by, updated_by)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, 'programado', $9, $10, $10)
       RETURNING id`,
      [
        empresaId,
        data.proveedor_id,
        data.fecha_programada,
        total,
        data.moneda,
        data.cuenta_origen_id ?? null,
        data.metodo_pago_id ?? null,
        data.referencia?.trim() || null,
        data.notas?.trim() || null,
        userId ?? null,
      ]
    );
    const id = rows[0]!.id;
    await insertarDetalles(client, id, empresaId, data.detalles, data.moneda);

    await client.query('COMMIT');
    const list = await listarProgramacionesPago(empresaId, { id });
    const record = list[0];
    if (!record) throw new Error('No se pudo recuperar la programación creada');
    return record;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function actualizarProgramacionPago(
  id: number,
  data: Partial<ProgramacionPagoInput>,
  empresaId: number,
  userId?: number | null
): Promise<ProgramacionPago> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query<{
      id: number; proveedor_id: number | null; fecha_programada: string;
      monto_programado: number; moneda: string; cuenta_origen_id: number | null;
      metodo_pago_id: number | null; referencia: string | null; notas: string | null; estatus: string;
    }>(
      `SELECT id, proveedor_id, fecha_programada, monto_programado, moneda,
              cuenta_origen_id, metodo_pago_id, referencia, notas, estatus
       FROM finanzas_programacion_pagos WHERE id = $1 AND empresa_id = $2 FOR UPDATE`,
      [id, empresaId]
    );
    const current = existing[0];
    if (!current) throw Object.assign(new Error('Programación no encontrada'), { status: 404 });
    if (current.estatus !== 'programado') {
      throw Object.assign(
        new Error(`No se puede editar una programación con estatus '${current.estatus}'`),
        { status: 409 }
      );
    }

    // Si no se mandan detalles en el payload, cargar los existentes
    let detallesInput = data.detalles;
    if (!detallesInput || detallesInput.length === 0) {
      const { rows: existingDet } = await client.query<{
        documento_id: number; monto_programado: string;
      }>(
        `SELECT documento_id, monto_programado FROM finanzas_programacion_pagos_detalle WHERE programacion_id = $1`,
        [id]
      );
      detallesInput = existingDet.map((d) => ({
        documento_id: d.documento_id as number,
        monto_programado: Number(d.monto_programado),
      }));
    }

    const merged: ProgramacionPagoInput = {
      proveedor_id: data.proveedor_id ?? (current.proveedor_id ?? 0),
      fecha_programada: data.fecha_programada ?? current.fecha_programada,
      moneda: data.moneda ?? current.moneda,
      cuenta_origen_id: data.cuenta_origen_id !== undefined ? data.cuenta_origen_id : current.cuenta_origen_id,
      metodo_pago_id: data.metodo_pago_id !== undefined ? data.metodo_pago_id : current.metodo_pago_id,
      referencia: data.referencia !== undefined ? data.referencia : current.referencia,
      notas: data.notas !== undefined ? data.notas : current.notas,
      detalles: detallesInput,
    };

    await validarCabeceraInput(client, merged, empresaId);
    const total = await validarYComputarDetalles(client, merged, empresaId, id);

    // Reemplazar detalles atómicamente
    await client.query(
      `DELETE FROM finanzas_programacion_pagos_detalle WHERE programacion_id = $1`,
      [id]
    );
    await insertarDetalles(client, id, empresaId, merged.detalles, merged.moneda);

    await client.query(
      `UPDATE finanzas_programacion_pagos
       SET proveedor_id = $1, fecha_programada = $2, monto_programado = $3,
           moneda = $4, cuenta_origen_id = $5, metodo_pago_id = $6, referencia = $7,
           notas = $8, updated_by = $9, updated_at = now()
       WHERE id = $10 AND empresa_id = $11`,
      [
        merged.proveedor_id,
        merged.fecha_programada,
        total,
        merged.moneda,
        merged.cuenta_origen_id ?? null,
        merged.metodo_pago_id ?? null,
        merged.referencia?.trim() || null,
        merged.notas?.trim() || null,
        userId ?? null,
        id,
        empresaId,
      ]
    );
    await client.query('COMMIT');

    const list = await listarProgramacionesPago(empresaId, { id });
    const record = list[0];
    if (!record) throw new Error('No se pudo recuperar la programación actualizada');
    return record;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function cancelarProgramacionPago(
  id: number,
  empresaId: number,
  userId?: number | null
): Promise<ProgramacionPago> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query<ProgramacionPago>(
      `SELECT * FROM finanzas_programacion_pagos WHERE id = $1 AND empresa_id = $2 FOR UPDATE`,
      [id, empresaId]
    );
    const current = existing[0];
    if (!current) throw Object.assign(new Error('Programación no encontrada'), { status: 404 });
    if (current.estatus !== 'programado') {
      throw Object.assign(
        new Error(`Solo se puede cancelar una programación con estatus 'programado'; estatus actual: '${current.estatus}'`),
        { status: 409 }
      );
    }

    await client.query(
      `UPDATE finanzas_programacion_pagos
       SET estatus = 'cancelado', updated_by = $1, updated_at = now()
       WHERE id = $2 AND empresa_id = $3`,
      [userId ?? null, id, empresaId]
    );
    await client.query('COMMIT');

    const list = await listarProgramacionesPago(empresaId, { id });
    const record = list[0];
    if (!record) throw new Error('No se pudo recuperar la programación cancelada');
    return record;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export type PagarProgramacionResult = {
  programacion: ProgramacionPago;
  documento_pago_id: number;
  finanzas_operacion_id: number;
};

export async function pagarProgramacionPago(
  id: number,
  empresaId: number,
  userId?: number | null
): Promise<PagarProgramacionResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Bloquear y cargar encabezado
    const { rows: progRows } = await client.query<{
      id: number; proveedor_id: number | null; estatus: string; moneda: string;
      cuenta_origen_id: number | null; metodo_pago_id: number | null;
      referencia: string | null; notas: string | null;
    }>(
      `SELECT id, proveedor_id, estatus, moneda, cuenta_origen_id, metodo_pago_id, referencia, notas
       FROM finanzas_programacion_pagos WHERE id = $1 AND empresa_id = $2 FOR UPDATE`,
      [id, empresaId]
    );
    const prog = progRows[0];
    if (!prog) throw Object.assign(new Error('Programación no encontrada'), { status: 404 });
    if (prog.estatus !== 'programado') {
      throw Object.assign(
        new Error(`Solo se puede pagar una programación con estatus 'programado'; actual: '${prog.estatus}'`),
        { status: 409 }
      );
    }
    if (!prog.cuenta_origen_id) {
      throw Object.assign(
        new Error('La programación no tiene cuenta de origen asignada. Edítela antes de pagar.'),
        { status: 422 }
      );
    }

    // 2. Cargar detalles
    const { rows: detallesRows } = await client.query<{
      id: number; documento_id: number; monto_programado: string;
    }>(
      `SELECT id, documento_id, monto_programado
       FROM finanzas_programacion_pagos_detalle
       WHERE programacion_id = $1 AND empresa_id = $2
       ORDER BY id ASC`,
      [id, empresaId]
    );
    if (detallesRows.length === 0) {
      throw Object.assign(
        new Error('La programación no tiene facturas asociadas. Edítela antes de pagar.'),
        { status: 422 }
      );
    }

    // 3. Validar cuenta origen
    const { rows: cuentaRows } = await client.query(
      `SELECT id FROM finanzas_cuentas WHERE id = $1 AND empresa_id = $2 AND NOT COALESCE(cuenta_cerrada, false)`,
      [prog.cuenta_origen_id, empresaId]
    );
    if (!cuentaRows[0]) {
      throw Object.assign(new Error('La cuenta de origen está cerrada o no existe'), { status: 422 });
    }

    // 4. Validar método de pago si viene
    if (prog.metodo_pago_id) {
      const { rows: mpRows } = await client.query<{ requiere_referencia: boolean }>(
        `SELECT requiere_referencia FROM finanzas_metodos_pago
         WHERE id = $1 AND empresa_id = $2 AND activo = true`,
        [prog.metodo_pago_id, empresaId]
      );
      if (!mpRows[0]) {
        throw Object.assign(new Error('El método de pago no existe, está inactivo o no pertenece a esta empresa'), { status: 422 });
      }
      if (mpRows[0].requiere_referencia && !prog.referencia?.trim()) {
        throw Object.assign(
          new Error('El método de pago requiere referencia pero la programación no la tiene. Edítela antes de pagar.'),
          { status: 422 }
        );
      }
    }

    // 5. Validar cada factura y calcular total
    let totalPago = 0;
    for (const det of detallesRows) {
      const montoDet = Number(det.monto_programado);

      const { rows: docRows } = await client.query<{
        tipo_documento: string; estatus_documento: string; moneda: string;
      }>(
        `SELECT tipo_documento, estatus_documento, moneda FROM documentos WHERE id = $1 AND empresa_id = $2`,
        [det.documento_id, empresaId]
      );
      const doc = docRows[0];
      if (!doc) throw Object.assign(new Error(`Factura ${det.documento_id} no encontrada`), { status: 404 });
      if (doc.tipo_documento !== 'factura_compra') {
        throw Object.assign(new Error(`El documento ${det.documento_id} no es factura_compra`), { status: 422 });
      }
      if (['cancelado', 'cancelada', 'borrador'].includes(String(doc.estatus_documento ?? '').toLowerCase())) {
        throw Object.assign(new Error(`La factura ${det.documento_id} está cancelada o en borrador`), { status: 422 });
      }
      const monedaDoc = String(doc.moneda ?? 'MXN').toUpperCase();
      const monedaProg = String(prog.moneda ?? 'MXN').toUpperCase();
      if (monedaDoc !== monedaProg) {
        throw Object.assign(
          new Error(`La moneda de la programación (${monedaProg}) ya no coincide con la factura ${det.documento_id} (${monedaDoc})`),
          { status: 422 }
        );
      }

      const { rows: saldoRows } = await client.query<{ saldo: string }>(
        `SELECT GREATEST(0, COALESCE(d.total, 0) - COALESCE(
           (SELECT SUM(a.monto_moneda_documento) FROM aplicaciones_saldo a
            WHERE a.documento_destino_id = d.id AND a.empresa_id = d.empresa_id), 0
         )) AS saldo FROM documentos d WHERE d.id = $1`,
        [det.documento_id]
      );
      const saldoActual = Number(saldoRows[0]?.saldo ?? 0);
      if (montoDet > saldoActual + 0.000001) {
        throw Object.assign(
          new Error(`El monto programado (${montoDet.toFixed(2)}) para la factura ${det.documento_id} excede su saldo actual (${saldoActual.toFixed(2)})`),
          { status: 422 }
        );
      }

      totalPago += montoDet;
    }

    const hoy = currentCivilDate();

    // 6. Crear un solo documento pago_proveedor por el total
    const docPago = await crearDocumentoRepository(
      {
        contacto_principal_id: prog.proveedor_id,
        fecha_documento: hoy,
        moneda: prog.moneda,
        total: totalPago,
        subtotal: totalPago,
        iva: 0,
        tratamiento_impuestos: 'sin_iva',
        estatus_documento: 'Pagado',
        observaciones: prog.notas ?? null,
        usuario_creacion_id: userId ?? null,
        tipo_cambio: 1,
      },
      empresaId,
      'pago_proveedor',
      client
    );

    // 7. Crear una sola operación bancaria (Retiro) por el total
    const operacion = await upsertOperacionDocumentoEnTransaccion(
      client,
      {
        cuenta_id: prog.cuenta_origen_id,
        fecha: hoy,
        tipo_movimiento: 'Retiro',
        monto: totalPago,
        documento_origen_id: docPago.id,
        referencia: prog.referencia?.trim() || null,
        observaciones: prog.notas?.trim() || null,
        metodo_pago_id: prog.metodo_pago_id ?? null,
        created_by: userId ?? null,
      },
      empresaId
    );

    // 8. Vincular operación al documento pago_proveedor
    await client.query(
      `UPDATE documentos SET finanzas_operacion_id = $1 WHERE id = $2 AND empresa_id = $3`,
      [operacion.id, docPago.id, empresaId]
    );

    // 9. Crear una aplicación_saldo por cada factura del detalle
    for (const det of detallesRows) {
      await crearAplicacionEnTransaccion(
        client,
        {
          documento_origen_id: docPago.id,
          documento_destino_id: det.documento_id,
          monto: Number(det.monto_programado),
          monto_moneda_documento: Number(det.monto_programado),
          fecha_aplicacion: hoy,
          created_by: userId ?? null,
        },
        empresaId
      );
    }

    // 10. Marcar programación como pagada (actualiza también monto_programado al total real)
    await client.query(
      `UPDATE finanzas_programacion_pagos
       SET estatus = 'pagado', documento_pago_id = $1, finanzas_operacion_id = $2,
           monto_programado = $3, updated_by = $4, updated_at = now()
       WHERE id = $5 AND empresa_id = $6`,
      [docPago.id, operacion.id, totalPago, userId ?? null, id, empresaId]
    );

    await client.query('COMMIT');

    const list = await listarProgramacionesPago(empresaId, { id });
    const record = list[0];
    if (!record) throw new Error('No se pudo recuperar la programación actualizada');
    return { programacion: record, documento_pago_id: docPago.id, finanzas_operacion_id: operacion.id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// =============================================================================
// Fase 3.4 — Conciliación Bancaria Básica Manual
// =============================================================================

export type MovimientoConciliacion = {
  id: number;
  fecha: string;
  tipo_movimiento: string;
  naturaleza_operacion: string | null;
  monto: string;
  referencia: string | null;
  observaciones: string | null;
  estado_conciliacion: 'pendiente' | 'cotejado';
  dias_sin_conciliar: number;
  contacto_id: number | null;
  cuenta_nombre: string;
  cuenta_moneda: string;
  contacto_nombre: string | null;
  concepto_nombre: string | null;
  metodo_pago_nombre: string | null;
  documento_folio: string | null;
};

export type ConciliacionMovimientosResult = {
  movimientos: MovimientoConciliacion[];
  saldo_sistema: number;
  moneda: string;
};

export async function obtenerMovimientosConciliacion(
  cuentaId: number,
  fechaCorte: string,
  empresaId: number
): Promise<ConciliacionMovimientosResult> {
  const [movRes, saldoRes] = await Promise.all([
    pool.query<MovimientoConciliacion>(`
      SELECT
        fo.id, fo.fecha, fo.tipo_movimiento, fo.naturaleza_operacion, fo.monto,
        fo.referencia, fo.observaciones, fo.estado_conciliacion,
        ($2::date - fo.fecha::date)::int AS dias_sin_conciliar,
        fo.contacto_id,
        COALESCE(fc.identificador, '') AS cuenta_nombre,
        COALESCE(fc.moneda, 'MXN') AS cuenta_moneda,
        c.nombre AS contacto_nombre,
        co.nombre_concepto AS concepto_nombre,
        mp.nombre AS metodo_pago_nombre,
        CASE WHEN d.id IS NOT NULL
          THEN COALESCE(d.serie, '') || CAST(COALESCE(d.numero, 0) AS text)
          ELSE NULL
        END AS documento_folio
      FROM finanzas_operaciones fo
      JOIN finanzas_cuentas fc
        ON fc.id = fo.cuenta_id AND fc.empresa_id = fo.empresa_id
        AND NOT COALESCE(fc.cuenta_cerrada, false)
      LEFT JOIN contactos c ON c.id = fo.contacto_id AND c.empresa_id = fo.empresa_id
      LEFT JOIN conceptos co ON co.id = fo.concepto_id AND co.empresa_id = fo.empresa_id
      LEFT JOIN finanzas_metodos_pago mp ON mp.id = fo.metodo_pago_id AND mp.empresa_id = fo.empresa_id
      LEFT JOIN documentos d ON d.id = fo.documento_origen_id AND d.empresa_id = fo.empresa_id
      WHERE fo.empresa_id = $1
        AND fo.cuenta_id = $3
        AND fo.fecha <= $2
        AND fo.estado_conciliacion IN ('pendiente', 'cotejado')
      ORDER BY fo.fecha ASC, fo.id ASC
    `, [empresaId, fechaCorte, cuentaId]),
    pool.query<{ saldo_sistema: string; moneda: string }>(`
      SELECT
        COALESCE(fc.saldo_inicial, 0) + COALESCE(SUM(
          CASE WHEN fo2.tipo_movimiento = 'Deposito' THEN fo2.monto ELSE -fo2.monto END
        ), 0) AS saldo_sistema,
        COALESCE(fc.moneda, 'MXN') AS moneda
      FROM finanzas_cuentas fc
      LEFT JOIN finanzas_operaciones fo2
        ON fo2.cuenta_id = fc.id AND fo2.empresa_id = fc.empresa_id
        AND fo2.fecha <= $2
      WHERE fc.id = $3 AND fc.empresa_id = $1
        AND NOT COALESCE(fc.cuenta_cerrada, false)
      GROUP BY fc.saldo_inicial, fc.moneda
    `, [empresaId, fechaCorte, cuentaId]),
  ]);

  const saldoRow = saldoRes.rows[0];
  return {
    movimientos: movRes.rows,
    saldo_sistema: saldoRow ? Number(saldoRow.saldo_sistema) : 0,
    moneda: saldoRow?.moneda ?? 'MXN',
  };
}

export async function cotejarMovimientos(
  ids: number[],
  estado: 'pendiente' | 'cotejado',
  empresaId: number
): Promise<{ updated: number }> {
  if (ids.length === 0) return { updated: 0 };
  const res = await pool.query(
    `UPDATE finanzas_operaciones
     SET estado_conciliacion = $1
     WHERE id = ANY($2::int[]) AND empresa_id = $3 AND estado_conciliacion != 'conciliado'`,
    [estado, ids, empresaId]
  );
  return { updated: res.rowCount ?? 0 };
}

export type CierreConciliacionInput = {
  cuentaId: number;
  fechaCorte: string;
  saldoBanco: number;
  operacionIds: number[];
  observaciones?: string | null;
};

export type CierreConciliacionResult = {
  conciliacion_id: number;
  saldo_banco: number;
  saldo_sistema: number;
  diferencia: number;
  operaciones_conciliadas: number;
};

export async function ejecutarCierreConciliacion(
  data: CierreConciliacionInput,
  empresaId: number,
  userId?: number | null
): Promise<CierreConciliacionResult> {
  const { cuentaId, fechaCorte, saldoBanco, operacionIds, observaciones } = data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock account row and get saldo_inicial
    const { rows: cuentaRows } = await client.query<{ saldo_inicial: string }>(
      `SELECT saldo_inicial FROM finanzas_cuentas
       WHERE id = $1 AND empresa_id = $2 AND NOT COALESCE(cuenta_cerrada, false)
       FOR UPDATE`,
      [cuentaId, empresaId]
    );
    if (cuentaRows.length === 0) {
      throw Object.assign(new Error('Cuenta no encontrada o está cerrada'), { status: 404 });
    }
    const saldoInicial = Number(cuentaRows[0].saldo_inicial ?? 0);

    // 2. Validate provided operacion_ids belong to this cuenta, are before fechaCorte, and not already conciliado
    if (operacionIds.length > 0) {
      const { rows: invalid } = await client.query<{ id: number }>(
        `SELECT id FROM finanzas_operaciones
         WHERE id = ANY($1::int[]) AND empresa_id = $2
           AND (cuenta_id != $3 OR fecha > $4::date OR estado_conciliacion = 'conciliado')`,
        [operacionIds, empresaId, cuentaId, fechaCorte]
      );
      if (invalid.length > 0) {
        throw Object.assign(
          new Error(
            `${invalid.length} operación(es) no válidas para esta conciliación (ya conciliadas, fuera de fecha o de otra cuenta).`
          ),
          { status: 422 }
        );
      }

      // 3. Mark as 'conciliado'
      await client.query(
        `UPDATE finanzas_operaciones SET estado_conciliacion = 'conciliado'
         WHERE id = ANY($1::int[]) AND empresa_id = $2 AND estado_conciliacion != 'conciliado'`,
        [operacionIds, empresaId]
      );
    }

    // 4. Calculate saldo_sistema (saldo_inicial + ALL ops up to fechaCorte)
    const { rows: saldoRows } = await client.query<{ saldo_sistema: string }>(
      `SELECT $1::numeric + COALESCE(SUM(
         CASE WHEN tipo_movimiento = 'Deposito' THEN monto ELSE -monto END
       ), 0) AS saldo_sistema
       FROM finanzas_operaciones
       WHERE cuenta_id = $2 AND empresa_id = $3 AND fecha <= $4::date`,
      [saldoInicial, cuentaId, empresaId, fechaCorte]
    );
    const saldoSistema = Number(saldoRows[0]?.saldo_sistema ?? saldoInicial);
    const diferencia = Number(saldoBanco) - saldoSistema;

    // 5. Insert conciliación snapshot
    const { rows: concRows } = await client.query<{ id: number }>(
      `INSERT INTO finanzas_conciliaciones
         (empresa_id, cuenta_id, fecha_corte, saldo_banco, saldo_sistema, diferencia, observaciones, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [empresaId, cuentaId, fechaCorte, saldoBanco, saldoSistema, diferencia, observaciones ?? null, userId ?? null]
    );
    const conciliacionId = concRows[0].id;

    // 6. Insert bridge records
    if (operacionIds.length > 0) {
      const vals = operacionIds.map((_, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO finanzas_conciliaciones_operaciones (conciliacion_id, operacion_id)
         VALUES ${vals}
         ON CONFLICT (conciliacion_id, operacion_id) DO NOTHING`,
        [conciliacionId, ...operacionIds]
      );
    }

    // 7. Recalculate saldo_conciliado (all-time conciliado ops for this account)
    const { rows: scRows } = await client.query<{ saldo_conciliado: string }>(
      `SELECT $1::numeric + COALESCE(SUM(
         CASE WHEN tipo_movimiento = 'Deposito' THEN monto ELSE -monto END
       ), 0) AS saldo_conciliado
       FROM finanzas_operaciones
       WHERE cuenta_id = $2 AND empresa_id = $3 AND estado_conciliacion = 'conciliado'`,
      [saldoInicial, cuentaId, empresaId]
    );
    const saldoConciliado = Number(scRows[0]?.saldo_conciliado ?? saldoInicial);

    // 8. Update finanzas_cuentas
    await client.query(
      `UPDATE finanzas_cuentas
       SET saldo_conciliado = $1, fecha_ultima_conciliacion = now()
       WHERE id = $2 AND empresa_id = $3`,
      [saldoConciliado, cuentaId, empresaId]
    );

    await client.query('COMMIT');

    return {
      conciliacion_id: conciliacionId,
      saldo_banco: Number(saldoBanco),
      saldo_sistema: saldoSistema,
      diferencia,
      operaciones_conciliadas: operacionIds.length,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
