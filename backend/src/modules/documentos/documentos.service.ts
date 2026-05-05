import pool from '../../config/database';
import type { PoolClient } from 'pg';
import type { TipoDocumento } from '../../types/documentos';
import { crearDocumentoRepository } from './documentos.repository';

type DocumentoCrearPayload = Record<string, any> & {
  agente_id?: number | null;
  conversacion_id?: number | null;
  documento_origen_id?: number | null;
  contacto_principal_id?: number | null;
  usuario_creacion_id?: number | null;
};

/**
 * Asigna agente_id (si no viene en el payload) con las reglas definidas.
 */
async function resolverAgenteId(
  payload: DocumentoCrearPayload,
  empresaId: number,
  client?: PoolClient
): Promise<number | null | undefined> {
  const executor = client ?? pool;
  let resolved = false;
  let agenteId: number | null | undefined = undefined;

  if (payload.documento_origen_id) {
    const { rows } = await executor.query(
      `SELECT agente_id
         FROM documentos
        WHERE id = $1 AND empresa_id = $2
        LIMIT 1`,
      [payload.documento_origen_id, empresaId]
    );
    if (rows[0]) {
      agenteId = rows[0].agente_id ?? null;
      resolved = true;
    }
  }

  if (!resolved && payload.contacto_principal_id) {
    const { rows } = await executor.query(
      `SELECT vendedor_id
         FROM contactos
        WHERE id = $1 AND empresa_id = $2
        LIMIT 1`,
      [payload.contacto_principal_id, empresaId]
    );
    const vendedorId = rows[0]?.vendedor_id ?? null;
    if (vendedorId !== null) {
      agenteId = vendedorId;
      resolved = true;
    }
  }

  if (!resolved && payload.usuario_creacion_id) {
    const { rows } = await executor.query(
      `SELECT vendedor_contacto_id
         FROM core.usuarios
        WHERE id = $1
        LIMIT 1`,
      [payload.usuario_creacion_id]
    );
    if (rows[0]) {
      agenteId = rows[0].vendedor_contacto_id ?? null;
      resolved = true;
    }
  }

  return resolved ? agenteId ?? null : undefined;
}

type DocumentoOportunidadInput = {
  contacto_principal_id?: number | null;
  agente_id?: number | null;
  conversacion_id?: number | null;
};

export async function asegurarOportunidadParaCotizacion(
  documento: { id: number; tipo_documento?: TipoDocumento | string | null; agente_id?: number | null },
  data: DocumentoOportunidadInput,
  empresaId: number,
  client: PoolClient
) {
  const tipoDocumento = String(documento.tipo_documento ?? '').toLowerCase();
  if (tipoDocumento !== 'cotizacion') {
    return null;
  }

  const contactoId = data.contacto_principal_id ?? null;
  if (!contactoId) {
    throw new Error('VALIDATION_ERROR: No se puede crear una cotización sin cliente.');
  }

  const { rows: existingRows } = await client.query<{ id: number }>(
    `SELECT id
       FROM crm.oportunidades_venta
      WHERE cotizacion_principal_id = $1
      LIMIT 1`,
    [documento.id]
  );

  if (existingRows[0]?.id) {
    return existingRows[0];
  }

  const vendedorId = data.agente_id ?? documento.agente_id ?? null;
  const { rows } = await client.query<{ id: number }>(
    `INSERT INTO crm.oportunidades_venta (
        empresa_id,
        contacto_id,
        vendedor_id,
        conversacion_id,
        cotizacion_principal_id,
        estatus
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id`,
    [
      empresaId,
      contactoId,
      vendedorId,
      data.conversacion_id ?? null,
      documento.id,
      'abierta',
    ]
  );

  return rows[0] ?? null;
}

/**
 * Crea documentos aplicando reglas de agente_id antes de persistir.
 */
export async function crearDocumentoService(
  payload: DocumentoCrearPayload,
  empresaId: number,
  tipoDocumento: TipoDocumento
) {
  const client = await pool.connect();
  const data = { ...payload, conversacion_id: payload.conversacion_id ?? null };
  try {
    await client.query('BEGIN');

    console.log('DEBUG DATA EN SERVICE:', data);
    if (data.agente_id === undefined) {
      const agenteId = await resolverAgenteId(data, empresaId, client);
      if (agenteId !== undefined) {
        data.agente_id = agenteId;
      }
    }

    const created = await crearDocumentoRepository(data, empresaId, tipoDocumento, client);

    if (tipoDocumento === 'cotizacion' && created?.id) {
      await asegurarOportunidadParaCotizacion(
        {
          id: created.id,
          tipo_documento: tipoDocumento,
          agente_id: created.agente_id ?? data.agente_id ?? null,
        },
        data,
        empresaId,
        client
      );
    }

    await client.query('COMMIT');

    return created;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Recalcula subtotal, iva y total de un documento a partir de sus partidas.
 * Usa una sola transacción para evitar inconsistencias.
 */
export async function actualizarTotales(documentoId: number, client?: PoolClient): Promise<void> {
  const ownedClient = !client;
  const executor = client ?? (await pool.connect());
  try {
    if (ownedClient) {
      await executor.query('BEGIN');
    }

    const { rows: totalesRows } = await executor.query(
      `SELECT
          COALESCE(SUM(dp.subtotal_partida), 0) AS subtotal,
          COALESCE(SUM(CASE WHEN LOWER(i.tipo) = 'traslado' THEN dpi.monto ELSE 0 END), 0) AS traslados,
          COALESCE(SUM(CASE WHEN LOWER(i.tipo) = 'retencion' THEN dpi.monto ELSE 0 END), 0) AS retenciones
       FROM documentos_partidas dp
       LEFT JOIN documentos_partidas_impuestos dpi ON dpi.partida_id = dp.id
       LEFT JOIN impuestos i ON i.id::text = dpi.impuesto_id
       WHERE dp.documento_id = $1`,
      [documentoId]
    );

    const subtotal = Number(totalesRows[0]?.subtotal ?? 0);
    const traslados = Number(totalesRows[0]?.traslados ?? 0);
    const retenciones = Number(totalesRows[0]?.retenciones ?? 0);
    const iva = traslados;
    const total = subtotal + traslados - retenciones;

    await executor.query(
      `UPDATE documentos
          SET subtotal = $1,
              iva = $2,
              total = $3
        WHERE id = $4`,
      [subtotal, iva, total, documentoId]
    );

    if (ownedClient) {
      await executor.query('COMMIT');
    }
  } catch (error) {
    if (ownedClient) {
      await executor.query('ROLLBACK');
    }
    throw error;
  } finally {
    if (ownedClient) {
      executor.release();
    }
  }
}
