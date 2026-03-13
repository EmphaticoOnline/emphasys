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

    const insert = `
      INSERT INTO finanzas_operaciones (
        empresa_id, cuenta_id, fecha, tipo_movimiento, monto, contacto_id, referencia, observaciones,
        es_transferencia, transferencia_id, estado_conciliacion, saldo, concepto_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `;
    const { rows } = await client.query<Operacion>(insert, [
      empresaId,
      data.cuenta_id,
      data.fecha,
      data.tipo_movimiento,
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

    if (data.cuenta_id === original.cuenta_id) {
      const nuevoSaldo = Number(cuentaOriginal.saldo) - oldDelta + newDelta;
      await client.query('UPDATE finanzas_cuentas SET saldo = $1 WHERE id = $2', [nuevoSaldo, cuentaOriginal.id]);
      const { rows } = await client.query<Operacion>(
        `UPDATE finanzas_operaciones
         SET cuenta_id = $1, fecha = $2, tipo_movimiento = $3, monto = $4, contacto_id = $5,
             referencia = $6, observaciones = $7, es_transferencia = $8, transferencia_id = $9, saldo = $10, concepto_id = $11
         WHERE id = $12
         RETURNING *`,
        [
          data.cuenta_id,
          data.fecha,
          data.tipo_movimiento,
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
       SET cuenta_id = $1, fecha = $2, tipo_movimiento = $3, monto = $4, contacto_id = $5,
           referencia = $6, observaciones = $7, es_transferencia = $8, transferencia_id = $9, saldo = $10, concepto_id = $11
       WHERE id = $12
       RETURNING *`,
      [
        data.cuenta_id,
        data.fecha,
        data.tipo_movimiento,
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
  data: { operacion_id: number; documento_id: number; monto: number },
  empresaId: number
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener operación y suma aplicada actual
    const { rows: opRows } = await client.query<Operacion>(
      `SELECT * FROM finanzas_operaciones WHERE id = $1 AND empresa_id = $2 FOR UPDATE`,
      [data.operacion_id, empresaId]
    );
    const operacion = opRows[0];
    if (!operacion) throw new Error('Operación no encontrada');

    const { rows: docRows } = await client.query<{ id: number; empresa_id: number; saldo: number }>(
      `SELECT id, empresa_id, saldo FROM documentos WHERE id = $1 AND empresa_id = $2 FOR UPDATE`,
      [data.documento_id, empresaId]
    );
    const documento = docRows[0];
    if (!documento) throw new Error('Documento no encontrado');

    const { rows: sumRows } = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(monto), 0) AS total FROM finanzas_aplicaciones WHERE operacion_id = $1`,
      [data.operacion_id]
    );
    const aplicadoActual = Number(sumRows[0]?.total || 0);

    if (data.monto > Number(documento.saldo ?? 0)) {
      throw new Error('El monto excede el saldo del documento');
    }
    if (aplicadoActual + data.monto > Number(operacion.monto)) {
      throw new Error('El monto excede el disponible de la operación');
    }

    const insert = `
      INSERT INTO finanzas_aplicaciones (empresa_id, operacion_id, documento_id, monto)
      VALUES ($1,$2,$3,$4)
      RETURNING *
    `;
    const { rows: appRows } = await client.query(insert, [empresaId, data.operacion_id, data.documento_id, data.monto]);

    await client.query(`UPDATE documentos SET saldo = saldo - $1 WHERE id = $2`, [data.monto, data.documento_id]);

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
    const { rows } = await client.query<{ id: number; documento_id: number; monto: number }>(
      `SELECT id, documento_id, monto FROM finanzas_aplicaciones WHERE id = $1 AND empresa_id = $2 FOR UPDATE`,
      [id, empresaId]
    );
    const app = rows[0];
    if (!app) throw new Error('Aplicación no encontrada');

    await client.query('DELETE FROM finanzas_aplicaciones WHERE id = $1', [id]);
    await client.query('UPDATE documentos SET saldo = saldo + $1 WHERE id = $2', [app.monto, app.documento_id]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
