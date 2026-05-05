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
};

async function cotizacionTieneDocumentosPosteriores(documentoId: number, client: PoolClient) {
  const { rows } = await client.query<{ tiene_descendientes: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM documentos
       WHERE documento_origen_id = $1
     ) AS tiene_descendientes`,
    [documentoId]
  );

  return Boolean(rows[0]?.tiene_descendientes);
}

async function eliminarDocumentoBase(documentoId: number, empresaId: number, tipoDocumento: string, client: PoolClient) {
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
    `SELECT id, tipo_documento
       FROM documentos
      WHERE id = $1
        AND empresa_id = $2
      LIMIT 1`,
    [documentoId, empresaId]
  );

  return rows[0] ?? null;
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
    `SELECT id, cotizacion_principal_id
       FROM crm.oportunidades_venta
      WHERE cotizacion_principal_id = $1
        AND empresa_id = $2
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

    const oportunidad = await obtenerOportunidadPorCotizacion(documentoId, empresaId, client);
    if (oportunidad) {
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