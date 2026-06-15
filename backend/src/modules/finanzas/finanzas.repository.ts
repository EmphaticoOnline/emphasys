import pool from '../../config/database';
import type { PoolClient } from 'pg';
import { obtenerReglaDocumentoOrigenFinanciero } from './documento-origen-financiero';

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
};

export async function obtenerSaldoDocumento(id: number, empresaId: number) {
  const sql = `
    SELECT id, empresa_id, tipo_documento, moneda, tipo_cambio, total, saldo
    FROM documentos_saldo
    WHERE id = $1 AND empresa_id = $2
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

export async function obtenerReporteAging(empresaId: number) {
  const sql = `
    SELECT
  d.id AS documento_id,
  d.contacto_principal_id AS contacto_id,
  d.fecha_documento AS fecha,
  d.tipo_documento,
  d.moneda,
  d.total,
  ds.saldo,
  (CURRENT_DATE - d.fecha_documento)::integer AS dias,
      CASE
        WHEN (CURRENT_DATE - d.fecha_documento) <= 30 THEN '0-30'
        WHEN (CURRENT_DATE - d.fecha_documento) <= 60 THEN '31-60'
        WHEN (CURRENT_DATE - d.fecha_documento) <= 90 THEN '61-90'
        ELSE '90+'
      END AS bucket
    FROM documentos d
    JOIN documentos_saldo ds ON ds.id = d.id AND ds.empresa_id = d.empresa_id
    WHERE d.empresa_id = $1
      AND ds.saldo > 0
    ORDER BY d.fecha_documento, d.id
  `;
  const { rows } = await pool.query(sql, [empresaId]);
  return rows;
}

export async function obtenerReporteAgingResumen(empresaId: number) {
  const sql = `
    SELECT
  d.contacto_principal_id AS contacto_id,
  SUM(CASE WHEN (CURRENT_DATE - d.fecha_documento) <= 30 THEN ds.saldo ELSE 0 END) AS bucket_0_30,
  SUM(CASE WHEN (CURRENT_DATE - d.fecha_documento) > 30 AND (CURRENT_DATE - d.fecha_documento) <= 60 THEN ds.saldo ELSE 0 END) AS bucket_31_60,
  SUM(CASE WHEN (CURRENT_DATE - d.fecha_documento) > 60 AND (CURRENT_DATE - d.fecha_documento) <= 90 THEN ds.saldo ELSE 0 END) AS bucket_61_90,
  SUM(CASE WHEN (CURRENT_DATE - d.fecha_documento) > 90 THEN ds.saldo ELSE 0 END) AS bucket_90_plus,
      SUM(ds.saldo) AS total
    FROM documentos d
    JOIN documentos_saldo ds ON ds.id = d.id AND ds.empresa_id = d.empresa_id
    WHERE d.empresa_id = $1
      AND ds.saldo > 0
      AND d.tipo_documento IN ('factura', 'factura_compra')
  GROUP BY d.contacto_principal_id
  ORDER BY d.contacto_principal_id
  `;
  const { rows } = await pool.query(sql, [empresaId]);
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
};

export async function upsertOperacionDocumentoEnTransaccion(
  client: PoolClient,
  data: OperacionInput,
  empresaId: number,
  operacionExistenteId?: number | null
): Promise<Operacion> {
  if (operacionExistenteId) {
    const { rows: opRows } = await client.query<Operacion>(
      'SELECT * FROM finanzas_operaciones WHERE id = $1 AND empresa_id = $2 FOR UPDATE',
      [operacionExistenteId, empresaId]
    );
    const original = opRows[0];
    if (!original) throw new Error('Operación no encontrada');

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
             documento_origen_id = $7, referencia = $8, observaciones = $9, es_transferencia = $10, transferencia_id = $11, saldo = $12, concepto_id = $13
         WHERE id = $14
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
           documento_origen_id = $7, referencia = $8, observaciones = $9, es_transferencia = $10, transferencia_id = $11, saldo = $12, concepto_id = $13
       WHERE id = $14
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
      es_transferencia, transferencia_id, estado_conciliacion, saldo, concepto_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
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
      imp_saldo_insoluto
    ) VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8,$9)
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
