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
    SELECT fo.*, c.nombre AS contacto_nombre, fc.identificador AS cuenta_nombre
    FROM finanzas_operaciones fo
    LEFT JOIN contactos c ON c.id = fo.contacto_id
    LEFT JOIN finanzas_cuentas fc ON fc.id = fo.cuenta_id
    WHERE fo.id = $1 AND fo.empresa_id = $2
  `;
  const { rows } = await pool.query(sql, [id, empresaId]);
  return rows[0] || null;
}

export async function listarAplicacionesPorOperacion(operacionId: number, empresaId: number) {
  const sql = `
    SELECT a.*,
      d.tipo_documento,
      d.serie,
      d.numero,
      d.fecha_documento AS fecha_documento,
      d.total AS total_documento,
      d.moneda AS moneda_documento
    FROM aplicaciones a
    LEFT JOIN documentos d ON d.id = a.documento_destino_id AND d.empresa_id = a.empresa_id
    WHERE a.finanzas_operacion_id = $1
      AND a.empresa_id = $2
    ORDER BY a.fecha_aplicacion, a.id
  `;
  const { rows } = await pool.query(sql, [operacionId, empresaId]);
  return rows;
}
export async function listarAplicacionesPorDocumento(documentoId: number, empresaId: number) {
  const sql = `
    SELECT a.*, 
           doc_origen.tipo_documento AS tipo_documento_origen,
           doc_destino.tipo_documento AS tipo_documento_destino,
           fo.tipo_movimiento AS tipo_movimiento
    FROM aplicaciones a
    LEFT JOIN documentos doc_origen ON doc_origen.id = a.documento_origen_id AND doc_origen.empresa_id = a.empresa_id
    LEFT JOIN documentos doc_destino ON doc_destino.id = a.documento_destino_id AND doc_destino.empresa_id = a.empresa_id
    LEFT JOIN finanzas_operaciones fo ON fo.id = a.finanzas_operacion_id AND fo.empresa_id = a.empresa_id
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
      AND d.tipo_documento IN ('factura','factura_compra','nota_credito','nota_credito_compra')

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
  const { rows } = await pool.query(sql, [empresaId, contactoId]);
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

export async function obtenerDisponibleOperacion(operacionId: number, empresaId: number) {
  const sql = `
    SELECT
      fo.id,
      fo.monto AS monto_total,
      COALESCE((
        SELECT SUM(a.monto)
        FROM aplicaciones a
        WHERE a.finanzas_operacion_id = fo.id
          AND a.empresa_id = fo.empresa_id
      ), 0) AS monto_aplicado,
      fo.monto - COALESCE((
        SELECT SUM(a.monto)
        FROM aplicaciones a
        WHERE a.finanzas_operacion_id = fo.id
          AND a.empresa_id = fo.empresa_id
      ), 0) AS monto_disponible
    FROM finanzas_operaciones fo
    WHERE fo.id = $1
      AND fo.empresa_id = $2
  `;
  const { rows } = await pool.query(sql, [operacionId, empresaId]);
  return rows[0] || null;
}
import pool from '../../config/database';
import type { PoolClient } from 'pg';

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
            ft.cuenta_origen_id AS transferencia_cuenta_origen,
            ft.cuenta_destino_id AS transferencia_cuenta_destino,
            coo.identificador AS transferencia_origen_nombre,
            cod.identificador AS transferencia_destino_nombre
     FROM finanzas_operaciones fo
     LEFT JOIN contactos c ON c.id = fo.contacto_id
     LEFT JOIN conceptos co ON co.id = fo.concepto_id
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
  contacto_id?: number | null;
  referencia?: string | null;
  observaciones?: string | null;
  es_transferencia?: boolean;
  transferencia_id?: number | null;
  concepto_id?: number | null;
};

export async function crearOperacion(data: OperacionInput, empresaId: number): Promise<Operacion> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cuenta = await obtenerCuentaConLock(client, data.cuenta_id, empresaId);
    if (!cuenta) throw new Error('Cuenta no encontrada');

    const delta = data.tipo_movimiento === 'Deposito' ? Number(data.monto) : -Number(data.monto);
    const nuevoSaldo = Number(cuenta.saldo) + delta;

    const naturaleza = data.naturaleza_operacion ?? 'movimiento_general';

    const insert = `
      INSERT INTO finanzas_operaciones (
        empresa_id, cuenta_id, fecha, tipo_movimiento, naturaleza_operacion, monto, contacto_id, referencia, observaciones,
        es_transferencia, transferencia_id, estado_conciliacion, saldo, concepto_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `;
    const { rows } = await client.query<Operacion>(insert, [
      empresaId,
      data.cuenta_id,
      data.fecha,
      data.tipo_movimiento,
      naturaleza,
      data.monto,
      data.contacto_id ?? null,
      data.referencia ?? null,
      data.observaciones ?? null,
      data.es_transferencia ?? false,
      data.transferencia_id ?? null,
      'pendiente',
      nuevoSaldo,
      data.concepto_id ?? null,
    ]);
    const operacion = rows[0];

    await client.query('UPDATE finanzas_cuentas SET saldo = $1 WHERE id = $2', [nuevoSaldo, data.cuenta_id]);

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
    const { rows: opRows } = await client.query<Operacion>(
      'SELECT * FROM finanzas_operaciones WHERE id = $1 AND empresa_id = $2 FOR UPDATE',
      [id, empresaId]
    );
    const original = opRows[0];
    if (!original) throw new Error('Operación no encontrada');

    const oldDelta = original.tipo_movimiento === 'Deposito' ? Number(original.monto) : -Number(original.monto);
    const newDelta = data.tipo_movimiento === 'Deposito' ? Number(data.monto) : -Number(data.monto);

    const cuentaOriginal = await obtenerCuentaConLock(client, original.cuenta_id, empresaId);
    if (!cuentaOriginal) throw new Error('Cuenta original no encontrada');

    const naturaleza = data.naturaleza_operacion ?? (original as any).naturaleza_operacion ?? 'movimiento_general';

    if (data.cuenta_id === original.cuenta_id) {
      const nuevoSaldo = Number(cuentaOriginal.saldo) - oldDelta + newDelta;
      await client.query('UPDATE finanzas_cuentas SET saldo = $1 WHERE id = $2', [nuevoSaldo, cuentaOriginal.id]);
      const { rows } = await client.query<Operacion>(
        `UPDATE finanzas_operaciones
         SET cuenta_id = $1, fecha = $2, tipo_movimiento = $3, naturaleza_operacion = $4, monto = $5, contacto_id = $6,
             referencia = $7, observaciones = $8, es_transferencia = $9, transferencia_id = $10, saldo = $11, concepto_id = $12
         WHERE id = $13
         RETURNING *`,
        [
          data.cuenta_id,
          data.fecha,
          data.tipo_movimiento,
          naturaleza,
          data.monto,
          data.contacto_id ?? null,
          data.referencia ?? null,
          data.observaciones ?? null,
          data.es_transferencia ?? false,
          data.transferencia_id ?? null,
          nuevoSaldo,
          data.concepto_id ?? null,
          id,
        ]
      );
      await client.query('COMMIT');
      return rows[0];
    }

    const cuentaNueva = await obtenerCuentaConLock(client, data.cuenta_id, empresaId);
    if (!cuentaNueva) throw new Error('Cuenta destino no encontrada');

    const saldoOriginal = Number(cuentaOriginal.saldo) - oldDelta; // revertir efecto anterior
    const saldoNuevo = Number(cuentaNueva.saldo) + newDelta; // aplicar efecto en cuenta nueva

    await client.query('UPDATE finanzas_cuentas SET saldo = $1 WHERE id = $2', [saldoOriginal, cuentaOriginal.id]);
    await client.query('UPDATE finanzas_cuentas SET saldo = $1 WHERE id = $2', [saldoNuevo, cuentaNueva.id]);

    const { rows } = await client.query<Operacion>(
      `UPDATE finanzas_operaciones
       SET cuenta_id = $1, fecha = $2, tipo_movimiento = $3, naturaleza_operacion = $4, monto = $5, contacto_id = $6,
           referencia = $7, observaciones = $8, es_transferencia = $9, transferencia_id = $10, saldo = $11, concepto_id = $12
       WHERE id = $13
       RETURNING *`,
      [
        data.cuenta_id,
        data.fecha,
        data.tipo_movimiento,
        naturaleza,
        data.monto,
        data.contacto_id ?? null,
        data.referencia ?? null,
        data.observaciones ?? null,
        data.es_transferencia ?? false,
        data.transferencia_id ?? null,
        saldoNuevo,
        data.concepto_id ?? null,
        id,
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

    const cuenta = await obtenerCuentaConLock(client, operacion.cuenta_id, empresaId);
    if (!cuenta) throw new Error('Cuenta no encontrada');

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
  data: {
    finanzas_operacion_id?: number | null;
    documento_origen_id?: number | null;
    documento_destino_id: number;
    monto: number;
    monto_moneda_documento: number;
    fecha_aplicacion?: string | null;
  },
  empresaId: number
) {
  const client = await pool.connect();
  try {
    // Validaciones previas explícitas (sin truthiness)
    const hasPago = data.finanzas_operacion_id !== null && data.finanzas_operacion_id !== undefined;
    const hasDocOrigen = data.documento_origen_id !== null && data.documento_origen_id !== undefined;
    if ((hasPago && hasDocOrigen) || (!hasPago && !hasDocOrigen)) {
      const err = new Error('Debe enviar exactamente uno de finanzas_operacion_id o documento_origen_id');
      (err as any).status = 400;
      throw err;
    }
    if (data.documento_destino_id === null || data.documento_destino_id === undefined) {
      const err = new Error('documento_destino_id es obligatorio');
      (err as any).status = 400;
      throw err;
    }
    if (!(data.monto > 0) || !(data.monto_moneda_documento > 0)) {
      const err = new Error('monto y monto_moneda_documento deben ser mayores a 0');
      (err as any).status = 400;
      throw err;
    }
    if (hasDocOrigen && data.documento_origen_id === data.documento_destino_id) {
      const err = new Error('No se puede aplicar un documento contra sí mismo');
      (err as any).status = 409;
      throw err;
    }

    await client.query('BEGIN');

    // 1) Bloquear destino primero
    const destinoQuery = `
      SELECT d.id, d.empresa_id, d.contacto_principal_id AS contacto_id, d.tipo_documento, d.moneda, d.tipo_cambio, d.total
      FROM documentos d
      WHERE d.id = $1 AND d.tipo_documento IN ('factura', 'factura_compra') AND d.empresa_id = $2
      FOR UPDATE
    `;
    const destinoRows = await client.query(destinoQuery, [data.documento_destino_id, empresaId]);
    const destino = destinoRows.rows[0];
    if (!destino) {
      const err = new Error('Documento destino no encontrado o tipo inválido');
      (err as any).status = 404;
      throw err;
    }

    // 2) Bloquear origen (segundo)
    let origen: any = null;
    let esPago = hasPago;
    if (esPago) {
      const origenPagoQuery = `
        SELECT fo.id,
               fo.empresa_id,
               fo.contacto_id,
               fo.tipo_movimiento,
               fo.naturaleza_operacion,
               fc.moneda,
               1::numeric(9,4) AS tipo_cambio,
               fo.monto,
               fo.fecha
        FROM finanzas_operaciones fo
        JOIN finanzas_cuentas fc ON fc.id = fo.cuenta_id AND fc.empresa_id = fo.empresa_id
        WHERE fo.id = $1 AND fo.empresa_id = $2
        FOR UPDATE
      `;
      const origenRows = await client.query(origenPagoQuery, [data.finanzas_operacion_id, empresaId]);
      origen = origenRows.rows[0];
      if (!origen) {
        const err = new Error('Operación financiera no encontrada');
        (err as any).status = 404;
        throw err;
      }
    } else {
      const origenDocQuery = `
        SELECT d.id, d.empresa_id, d.contacto_principal_id AS contacto_id, d.tipo_documento, d.moneda, d.tipo_cambio, d.total
        FROM documentos d
        WHERE d.id = $1 AND d.empresa_id = $2 AND d.tipo_documento IN ('nota_credito', 'nota_credito_compra')
        FOR UPDATE
      `;
      const origenRows = await client.query(origenDocQuery, [data.documento_origen_id, empresaId]);
      origen = origenRows.rows[0];
      if (!origen) {
        const err = new Error('Documento origen no encontrado o tipo inválido');
        (err as any).status = 404;
        throw err;
      }
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

    // 4) Validar compatibilidad naturaleza vs documento destino (solo para pagos)
    if (esPago) {
      const compatibilidad: Record<string, string[]> = {
        cobro_cliente: ['factura', 'nota_credito'],
        pago_proveedor: ['factura_compra', 'nota_credito_compra'],
        movimiento_general: [],
      };

      const naturaleza = origen.naturaleza_operacion as string | undefined;
      if (!naturaleza) {
        const err = new Error('naturaleza_operacion no definida en la operación');
        (err as any).status = 409;
        throw err;
      }
      if (naturaleza === 'movimiento_general') {
        const err = new Error('La naturaleza movimiento_general no permite aplicaciones a documentos');
        (err as any).status = 409;
        throw err;
      }

      const permitidos = compatibilidad[naturaleza] ?? [];
      if (!permitidos.includes(destino.tipo_documento)) {
        const err = new Error('tipo_documento incompatible con la naturaleza de la operación');
        (err as any).status = 409;
        throw err;
      }
    }

    // 5) Validar compatibilidad de tipos
    if (destino.tipo_documento === 'factura') {
      if (esPago && origen.tipo_movimiento !== 'Deposito') {
        const err = new Error('tipo_movimiento incompatible para factura');
        (err as any).status = 409;
        throw err;
      }
      if (!esPago && origen.tipo_documento !== 'nota_credito') {
        const err = new Error('documento origen incompatible para factura');
        (err as any).status = 409;
        throw err;
      }
    } else if (destino.tipo_documento === 'factura_compra') {
      if (esPago && origen.tipo_movimiento !== 'Retiro') {
        const err = new Error('tipo_movimiento incompatible para factura_compra');
        (err as any).status = 409;
        throw err;
      }
      if (!esPago && origen.tipo_documento !== 'nota_credito_compra') {
        const err = new Error('documento origen incompatible para factura_compra');
        (err as any).status = 409;
        throw err;
      }
    }

  // 6) Agregaciones (sin FOR UPDATE en agregados) dentro de la misma transacción
    let aplicadoOrigen = 0;
    if (esPago) {
      const { rows } = await client.query(
        `SELECT COALESCE(SUM(a.monto), 0) AS aplicado_origen_base FROM aplicaciones a WHERE a.finanzas_operacion_id = $1`,
        [origen.id]
      );
      aplicadoOrigen = Number(rows[0]?.aplicado_origen_base || 0);
    } else {
      const { rows } = await client.query(
        `SELECT COALESCE(SUM(a.monto), 0) AS aplicado_origen_base FROM aplicaciones a WHERE a.documento_origen_id = $1`,
        [origen.id]
      );
      aplicadoOrigen = Number(rows[0]?.aplicado_origen_base || 0);
    }

    const { rows: destSumRows } = await client.query(
      `SELECT COALESCE(SUM(a.monto_moneda_documento), 0) AS aplicado_destino FROM aplicaciones a WHERE a.documento_destino_id = $1`,
      [destino.id]
    );
    const aplicadoDestino = Number(destSumRows[0]?.aplicado_destino || 0);

    // 6) Cálculo de saldos
    const saldoOrigen = esPago
      ? origen.monto * origen.tipo_cambio - aplicadoOrigen
      : origen.total * origen.tipo_cambio - aplicadoOrigen;
    const saldoDestino = destino.total - aplicadoDestino;

    // 7) Validaciones de saldos
    if (saldoOrigen <= 0 || saldoDestino <= 0) {
      const err = new Error('Saldo insuficiente en origen o destino');
      (err as any).status = 409;
      throw err;
    }
    if (data.monto > saldoOrigen) {
      const err = new Error('El monto excede el saldo del origen');
      (err as any).status = 409;
      throw err;
    }
    if (data.monto_moneda_documento > saldoDestino) {
      const err = new Error('El monto excede el saldo del destino');
      (err as any).status = 409;
      throw err;
    }

    // 8) Coherencia multimoneda (tolerancia de redondeo)
    const expectedBase = data.monto_moneda_documento * origen.tipo_cambio;
    const diff = Math.abs(expectedBase - data.monto);
    const tolerance = 0.01;
    if (diff > tolerance) {
      const err = new Error('Inconsistencia entre monto y monto_moneda_documento respecto al tipo de cambio del origen');
      (err as any).status = 409;
      throw err;
    }

    // 9) Insertar
    const insertSql = `
      INSERT INTO aplicaciones (
        empresa_id,
        finanzas_operacion_id,
        documento_origen_id,
        documento_destino_id,
        monto,
        monto_moneda_documento,
        fecha_aplicacion,
        fecha_creacion
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
      RETURNING *
    `;

    const insertValues = [
      destino.empresa_id,
      esPago ? origen.id : null,
      esPago ? null : origen.id,
      destino.id,
      data.monto,
      data.monto_moneda_documento,
      data.fecha_aplicacion ?? null,
    ];

    const { rows: appRows } = await client.query(insertSql, insertValues);

    await client.query('COMMIT');
    return appRows[0];
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

    // 1) Leer aplicación con FOR UPDATE en tabla aplicaciones
    const appSql = `
      SELECT *
      FROM aplicaciones
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

    // 3) Bloquear origen (pago o documento)
    if (app.finanzas_operacion_id) {
      const origenPagoSql = `
        SELECT id
        FROM finanzas_operaciones
        WHERE id = $1 AND empresa_id = $2
        FOR UPDATE
      `;
      await client.query(origenPagoSql, [app.finanzas_operacion_id, empresaId]);
    } else if (app.documento_origen_id) {
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
      DELETE FROM aplicaciones
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
