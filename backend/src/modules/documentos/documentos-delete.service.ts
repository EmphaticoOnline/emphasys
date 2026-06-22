import pool from '../../config/database';
import type { PoolClient } from 'pg';

export class DocumentoDeleteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentoDeleteValidationError';
  }
}

type OportunidadDeleteRow = {
  id: number;
  cotizacion_principal_id: number | null;
};

type DocumentoDeleteRow = {
  id: number;
  tipo_documento: string | null;
  oportunidad_id?: number | null;
};

type CotizacionHermanaRow = {
  id: number;
};

async function cotizacionTieneDocumentosPosteriores(documentoId: number, client: PoolClient) {
  const { rows } = await client.query<{ tiene_descendientes: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM documentos
       WHERE documento_origen_id = $1
         AND LOWER(COALESCE(tipo_documento, '')) <> 'cotizacion'
     ) AS tiene_descendientes`,
    [documentoId]
  );

  return Boolean(rows[0]?.tiene_descendientes);
}

async function eliminarDocumentoBase(documentoId: number, empresaId: number, tipoDocumento: string, client: PoolClient) {
  const { rows: _vinculosBase } = await client.query(
    `SELECT dpv.id, dpv.documento_origen_id, dpv.documento_destino_id,
            dpv.partida_origen_id, dpv.partida_destino_id, dpv.cantidad
       FROM documentos_partidas_vinculos dpv
      WHERE dpv.documento_destino_id = $1
         OR dpv.documento_origen_id = $1`,
    [documentoId]
  );
  if (_vinculosBase.length > 0) {
    console.warn('[VINCULOS AUDIT] eliminarDocumentoBase - vinculos presentes antes de DELETE', {
      operacion: 'eliminarDocumentoBase',
      documentoId,
      tipoDocumento,
      vinculos: _vinculosBase,
      stack: new Error().stack,
    });
  }

  await client.query(
    `DELETE FROM documentos_partidas dp
      WHERE dp.documento_id = $1
        AND EXISTS (
          SELECT 1
          FROM documentos d
          WHERE d.id = $1
            AND d.empresa_id = $2
            AND LOWER(d.tipo_documento) = LOWER($3)
        )`,
    [documentoId, empresaId, tipoDocumento]
  );

  const result = await client.query(
    `DELETE FROM documentos
      WHERE id = $1
        AND empresa_id = $2
        AND LOWER(tipo_documento) = LOWER($3)`,
    [documentoId, empresaId, tipoDocumento]
  );

  return (result.rowCount ?? 0) > 0;
}

async function eliminarOportunidadBase(oportunidadId: number, empresaId: number, client: PoolClient) {
  const result = await client.query(
    `DELETE FROM crm.oportunidades_venta
      WHERE id = $1
        AND empresa_id = $2`,
    [oportunidadId, empresaId]
  );

  return (result.rowCount ?? 0) > 0;
}

async function obtenerCotizacion(documentoId: number, empresaId: number, client: PoolClient) {
  const { rows } = await client.query<DocumentoDeleteRow>(
    `SELECT id, tipo_documento, oportunidad_id
       FROM documentos
      WHERE id = $1
        AND empresa_id = $2
      LIMIT 1`,
    [documentoId, empresaId]
  );

  return rows[0] ?? null;
}

async function obtenerCotizacionesHermanas(
  oportunidadId: number,
  cotizacionExcluirId: number,
  empresaId: number,
  client: PoolClient
) {
  const { rows } = await client.query<CotizacionHermanaRow>(
    `SELECT d.id
       FROM documentos d
      WHERE d.empresa_id = $1
        AND LOWER(d.tipo_documento) = 'cotizacion'
        AND d.oportunidad_id = $2
        AND d.id <> $3
      ORDER BY d.fecha_documento DESC NULLS LAST, d.id DESC`,
    [empresaId, oportunidadId, cotizacionExcluirId]
  );

  return rows;
}

async function obtenerOportunidad(oportunidadId: number, empresaId: number, client: PoolClient) {
  const { rows } = await client.query<OportunidadDeleteRow>(
    `SELECT id, cotizacion_principal_id
       FROM crm.oportunidades_venta
      WHERE id = $1
        AND empresa_id = $2
      LIMIT 1`,
    [oportunidadId, empresaId]
  );

  return rows[0] ?? null;
}

async function obtenerOportunidadPorCotizacion(documentoId: number, empresaId: number, client: PoolClient) {
  const { rows } = await client.query<OportunidadDeleteRow>(
    `SELECT o.id, o.cotizacion_principal_id
       FROM documentos d
       JOIN crm.oportunidades_venta o
         ON o.empresa_id = d.empresa_id
        AND (
          o.id = d.oportunidad_id
          OR o.cotizacion_principal_id = d.id
        )
      WHERE d.id = $1
        AND d.empresa_id = $2
      ORDER BY CASE WHEN o.id = d.oportunidad_id THEN 0 ELSE 1 END
      LIMIT 1`,
    [documentoId, empresaId]
  );

  return rows[0] ?? null;
}

export async function puedeEliminarCotizacion(documentoId: number, empresaId: number, client?: PoolClient) {
  const ownedClient = !client;
  const executor = client ?? (await pool.connect());

  try {
    const documento = await obtenerCotizacion(documentoId, empresaId, executor);

    if (!documento) {
      return { exists: false, canDelete: false, tipoDocumento: null as string | null };
    }

    const tipoDocumento = String(documento.tipo_documento ?? '').toLowerCase();
    if (tipoDocumento !== 'cotizacion') {
      return { exists: true, canDelete: false, tipoDocumento };
    }

    const tieneDescendientes = await cotizacionTieneDocumentosPosteriores(documentoId, executor);
    return { exists: true, canDelete: !tieneDescendientes, tipoDocumento };
  } finally {
    if (ownedClient) {
      executor.release();
    }
  }
}

export async function eliminarCotizacionConValidacion(documentoId: number, empresaId: number) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const documento = await obtenerCotizacion(documentoId, empresaId, client);
    if (!documento) {
      await client.query('ROLLBACK');
      return false;
    }

    const tipoDocumento = String(documento.tipo_documento ?? '').toLowerCase();
    if (tipoDocumento !== 'cotizacion') {
      throw new DocumentoDeleteValidationError('Solo se permite esta validación para cotizaciones.');
    }

    const puedeEliminar = await puedeEliminarCotizacion(documentoId, empresaId, client);
    if (!puedeEliminar.canDelete) {
      throw new DocumentoDeleteValidationError('No se puede eliminar la cotización porque ya generó documentos posteriores.');
    }

    const oportunidadId = documento.oportunidad_id ?? null;
    const oportunidad = oportunidadId
      ? await obtenerOportunidad(oportunidadId, empresaId, client)
      : await obtenerOportunidadPorCotizacion(documentoId, empresaId, client);

    if (oportunidad) {
      const esPrincipal = oportunidad.cotizacion_principal_id === documentoId;

      if (!esPrincipal) {
        const deleted = await eliminarDocumentoBase(documentoId, empresaId, 'cotizacion', client);
        await client.query('COMMIT');
        return deleted;
      }

      const cotizacionesHermanas = await obtenerCotizacionesHermanas(oportunidad.id, documentoId, empresaId, client);

      if (cotizacionesHermanas.length > 0) {
        await client.query(
          `UPDATE crm.oportunidades_venta
              SET cotizacion_principal_id = $1,
                  updated_at = NOW()
            WHERE id = $2
              AND empresa_id = $3`,
          [cotizacionesHermanas[0].id, oportunidad.id, empresaId]
        );

        const deleted = await eliminarDocumentoBase(documentoId, empresaId, 'cotizacion', client);
        await client.query('COMMIT');
        return deleted;
      }

      await eliminarOportunidadBase(oportunidad.id, empresaId, client);
    }

    const deleted = await eliminarDocumentoBase(documentoId, empresaId, 'cotizacion', client);
    await client.query('COMMIT');
    return deleted;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function eliminarOportunidadConValidacion(oportunidadId: number, empresaId: number) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const oportunidad = await obtenerOportunidad(oportunidadId, empresaId, client);
    if (!oportunidad) {
      await client.query('ROLLBACK');
      return false;
    }

    const cotizacionPrincipalId = oportunidad.cotizacion_principal_id;

    if (!cotizacionPrincipalId) {
      const deleted = await eliminarOportunidadBase(oportunidadId, empresaId, client);
      await client.query('COMMIT');
      return deleted;
    }

    const documento = await obtenerCotizacion(cotizacionPrincipalId, empresaId, client);

    if (documento) {
      const tipoDocumento = String(documento.tipo_documento ?? '').toLowerCase();
      if (tipoDocumento === 'cotizacion') {
        const puedeEliminar = await puedeEliminarCotizacion(cotizacionPrincipalId, empresaId, client);
        if (!puedeEliminar.canDelete) {
          throw new DocumentoDeleteValidationError('No se puede eliminar la oportunidad porque su cotización ya generó documentos posteriores.');
        }
      }
    }

    await eliminarOportunidadBase(oportunidadId, empresaId, client);

    if (documento && String(documento.tipo_documento ?? '').toLowerCase() === 'cotizacion') {
      await eliminarDocumentoBase(cotizacionPrincipalId, empresaId, 'cotizacion', client);
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}