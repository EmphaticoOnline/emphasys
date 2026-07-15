import pool from '../../config/database';
import { ClaveMovimientoTipoAutomatico, esClaveMovimientoValida } from './tiposAutomaticos.constants';

export interface ConfiguracionTipoAutomatico {
  clave_movimiento: ClaveMovimientoTipoAutomatico;
  tipo_poliza_id: number | null;
}

export interface ActualizarTipoAutomaticoInput {
  clave_movimiento: string;
  tipo_poliza_id: number | null;
}

// contabilidad.configuracion_tipos_automaticos.tipo_poliza_id es bigint:
// node-pg lo regresa como string. Se normaliza a number para que el resto
// del código (comparaciones, resolución en el motor) no se tope con un
// string donde se espera un number.
function mapearFila(row: any): ConfiguracionTipoAutomatico {
  return {
    clave_movimiento: row.clave_movimiento,
    tipo_poliza_id: row.tipo_poliza_id != null ? Number(row.tipo_poliza_id) : null,
  };
}

export async function listarConfiguracionTiposAutomaticos(empresaId: number): Promise<ConfiguracionTipoAutomatico[]> {
  const { rows } = await pool.query(
    `SELECT clave_movimiento, tipo_poliza_id
       FROM contabilidad.configuracion_tipos_automaticos
      WHERE empresa_id = $1 AND activo = true`,
    [empresaId]
  );
  return rows.map(mapearFila);
}

async function validarTipoPoliza(
  client: import('pg').PoolClient,
  empresaId: number,
  tipoPolizaId: number,
  claveMovimiento: string
): Promise<void> {
  const { rows } = await client.query<{ existe: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM contabilidad.tipos_poliza WHERE id = $1 AND empresa_id = $2 AND activo = true
     ) AS existe`,
    [tipoPolizaId, empresaId]
  );
  if (!rows[0].existe) {
    throw new Error(
      `VALIDATION_ERROR: El tipo de póliza seleccionado para "${claveMovimiento}" no existe o no está activo.`
    );
  }
}

export async function actualizarConfiguracionTiposAutomaticos(
  empresaId: number,
  items: ActualizarTipoAutomaticoInput[]
): Promise<ConfiguracionTipoAutomatico[]> {
  for (const item of items) {
    if (!esClaveMovimientoValida(item.clave_movimiento)) {
      throw new Error(`VALIDATION_ERROR: Clave de movimiento desconocida: ${item.clave_movimiento}`);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const item of items) {
      if (item.tipo_poliza_id != null) {
        await validarTipoPoliza(client, empresaId, item.tipo_poliza_id, item.clave_movimiento);
      }
      await client.query(
        `INSERT INTO contabilidad.configuracion_tipos_automaticos (empresa_id, clave_movimiento, tipo_poliza_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (empresa_id, clave_movimiento)
         DO UPDATE SET tipo_poliza_id = EXCLUDED.tipo_poliza_id, actualizado_en = now()`,
        [empresaId, item.clave_movimiento, item.tipo_poliza_id]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return listarConfiguracionTiposAutomaticos(empresaId);
}

// Helper centralizado para que el motor de contabilización resuelva el tipo
// de póliza automático de un movimiento sin dispersar queries por todo el
// código. Regresa null si no está configurado (o está desactivado); el
// llamador decide el mensaje de error específico del movimiento.
export async function obtenerTipoPolizaAutomatico(
  empresaId: number,
  claveMovimiento: ClaveMovimientoTipoAutomatico
): Promise<number | null> {
  const { rows } = await pool.query(
    `SELECT tipo_poliza_id
       FROM contabilidad.configuracion_tipos_automaticos
      WHERE empresa_id = $1 AND clave_movimiento = $2 AND activo = true`,
    [empresaId, claveMovimiento]
  );
  const valor = rows[0]?.tipo_poliza_id;
  return valor != null ? Number(valor) : null;
}
