import pool from '../../config/database';
import type { PoolClient } from 'pg';
import type { TipoDocumento } from '../../types/documentos';
import { calcularImpuestosPartida } from '../impuestos/impuestos.service';
import { OPORTUNIDAD_ESTADOS_SEGUIMIENTO, normalizarEstadoSeguimientoCotizacion } from './cotizacion-status';
import { actualizarDocumentoRepository, crearDocumentoRepository, obtenerDocumentoRepository, reemplazarPartidasRepository, type PartidaInput } from './documentos.repository';

type DocumentoCrearPayload = Record<string, any> & {
  agente_id?: number | null;
  conversacion_id?: number | null;
  documento_origen_id?: number | null;
  contacto_principal_id?: number | null;
  usuario_creacion_id?: number | null;
};

type DuplicarCotizacionResult = {
  id: number;
};

const OPORTUNIDAD_ESTATUS_SYNC_VALIDOS = new Set<string>(OPORTUNIDAD_ESTADOS_SEGUIMIENTO);

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

type DocumentoCotizacionActualRow = {
  id: number;
  tipo_documento: string | null;
  contacto_principal_id: number | null;
  oportunidad_id: number | null;
  agente_id: number | null;
  estado_seguimiento: string | null;
};

type OportunidadPrincipalRow = {
  id: number;
  cotizacion_principal_id: number | null;
};

type CotizacionHermanaRow = {
  id: number;
};

async function asignarOportunidadADocumento(
  documentoId: number,
  oportunidadId: number,
  empresaId: number,
  client: PoolClient
) {
  await client.query(
    `UPDATE documentos
        SET oportunidad_id = $1
      WHERE id = $2
        AND empresa_id = $3`,
    [oportunidadId, documentoId, empresaId]
  );
}

async function crearOportunidadParaCotizacion(
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
    throw new Error('VALIDATION_ERROR: No se puede guardar una cotización sin cliente.');
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

  const oportunidad = rows[0] ?? null;
  if (oportunidad?.id) {
    await asignarOportunidadADocumento(documento.id, oportunidad.id, empresaId, client);
  }

  return oportunidad;
}

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
    await asignarOportunidadADocumento(documento.id, existingRows[0].id, empresaId, client);
    return existingRows[0];
  }

  return crearOportunidadParaCotizacion(documento, data, empresaId, client);
}

async function obtenerCotizacionActual(documentoId: number, empresaId: number, client: PoolClient) {
  const { rows } = await client.query<DocumentoCotizacionActualRow>(
    `SELECT id,
            tipo_documento,
            contacto_principal_id,
            oportunidad_id,
            agente_id,
            estado_seguimiento
       FROM documentos
      WHERE id = $1
        AND empresa_id = $2
      LIMIT 1`,
    [documentoId, empresaId]
  );

  return rows[0] ?? null;
}

async function obtenerOportunidadPrincipal(oportunidadId: number, empresaId: number, client: PoolClient) {
  const { rows } = await client.query<OportunidadPrincipalRow>(
    `SELECT id, cotizacion_principal_id
       FROM crm.oportunidades_venta
      WHERE id = $1
        AND empresa_id = $2
      LIMIT 1`,
    [oportunidadId, empresaId]
  );

  return rows[0] ?? null;
}

async function obtenerCotizacionHermanaMasReciente(
  oportunidadId: number,
  cotizacionExcluirId: number,
  empresaId: number,
  client: PoolClient
) {
  const { rows } = await client.query<CotizacionHermanaRow>(
    `SELECT id
       FROM documentos
      WHERE empresa_id = $1
        AND oportunidad_id = $2
        AND id <> $3
        AND LOWER(tipo_documento) = 'cotizacion'
      ORDER BY fecha_documento DESC NULLS LAST, id DESC
      LIMIT 1`,
    [empresaId, oportunidadId, cotizacionExcluirId]
  );

  return rows[0] ?? null;
}

async function actualizarCotizacionPrincipalOportunidad(
  oportunidadId: number,
  cotizacionId: number | null,
  empresaId: number,
  client: PoolClient
) {
  const result = await client.query(
    `UPDATE crm.oportunidades_venta
        SET cotizacion_principal_id = $1,
            updated_at = NOW()
      WHERE id = $2
        AND empresa_id = $3`,
    [cotizacionId, oportunidadId, empresaId]
  );

  return (result.rowCount ?? 0) > 0;
}

async function sincronizarEstatusOportunidad(
  oportunidadId: number,
  estatus: string | null | undefined,
  empresaId: number,
  client: PoolClient
) {
  const estatusNormalizado = normalizarEstadoSeguimientoCotizacion(estatus);

  if (!estatusNormalizado || !OPORTUNIDAD_ESTATUS_SYNC_VALIDOS.has(estatusNormalizado)) {
    return;
  }

  await client.query(
    `UPDATE crm.oportunidades_venta
        SET estatus = $1,
            updated_at = NOW()
      WHERE id = $2
        AND empresa_id = $3`,
    [estatusNormalizado, oportunidadId, empresaId]
  );
}

async function desvincularPrincipalAnteriorSiCorresponde(
  oportunidadId: number,
  cotizacionId: number,
  empresaId: number,
  client: PoolClient
) {
  const oportunidad = await obtenerOportunidadPrincipal(oportunidadId, empresaId, client);
  if (!oportunidad || oportunidad.cotizacion_principal_id !== cotizacionId) {
    return;
  }

  const hermana = await obtenerCotizacionHermanaMasReciente(oportunidadId, cotizacionId, empresaId, client);
  await actualizarCotizacionPrincipalOportunidad(oportunidadId, hermana?.id ?? null, empresaId, client);
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

function construirPartidasDuplicadas(partidas: Array<Record<string, any>>): PartidaInput[] {
  return partidas.map((partida) => ({
    producto_id: partida.producto_id ?? null,
    descripcion_alterna: partida.descripcion_alterna ?? null,
    cantidad: Number(partida.cantidad ?? 0),
    precio_unitario: Number(partida.precio_unitario ?? 0),
    subtotal_partida: Number(partida.subtotal_partida ?? 0),
    total_partida: Number(partida.total_partida ?? partida.subtotal_partida ?? 0),
    es_parte_oportunidad: partida.es_parte_oportunidad ?? true,
    archivo_imagen_1: partida.archivo_imagen_1 ?? null,
    producto_archivo_id: partida.archivo_imagen_1 ? null : partida.producto_archivo_id ?? null,
    observaciones: partida.observaciones ?? null,
  }));
}

export async function duplicarCotizacionService(documentoId: number, empresaId: number): Promise<DuplicarCotizacionResult | null> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const origen = await obtenerDocumentoRepository(documentoId, empresaId, 'cotizacion');
    if (!origen?.documento) {
      await client.query('ROLLBACK');
      return null;
    }

    const documentoOrigen = origen.documento as Record<string, any>;
    const oportunidadId = Number(documentoOrigen.oportunidad_id ?? 0) || null;

    if (!oportunidadId) {
      throw new Error('VALIDATION_ERROR: La cotización no está ligada a una oportunidad.');
    }

    const nuevoDocumento = await crearDocumentoRepository(
      {
        fecha_documento: new Date().toISOString().slice(0, 10),
        oportunidad_id: oportunidadId,
        documento_origen_id: documentoOrigen.id,
        contacto_principal_id: documentoOrigen.contacto_principal_id ?? null,
        agente_id: documentoOrigen.agente_id ?? null,
        moneda: documentoOrigen.moneda ?? 'MXN',
        observaciones: documentoOrigen.observaciones ?? null,
        subtotal: Number(documentoOrigen.subtotal ?? 0),
        iva: Number(documentoOrigen.iva ?? 0),
        total: Number(documentoOrigen.total ?? 0),
        usuario_creacion_id: documentoOrigen.usuario_creacion_id ?? null,
        producto_resumen: documentoOrigen.producto_resumen ?? null,
        estado_seguimiento: 'abierta',
        comentario_seguimiento: null,
        estatus_documento: 'Borrador',
        tratamiento_impuestos: documentoOrigen.tratamiento_impuestos ?? 'normal',
        rfc_receptor: documentoOrigen.rfc_receptor ?? null,
        nombre_receptor: documentoOrigen.nombre_receptor ?? null,
        regimen_fiscal_receptor: documentoOrigen.regimen_fiscal_receptor ?? null,
        uso_cfdi: documentoOrigen.uso_cfdi ?? null,
        forma_pago: documentoOrigen.forma_pago ?? null,
        metodo_pago: documentoOrigen.metodo_pago ?? null,
        codigo_postal_receptor: documentoOrigen.codigo_postal_receptor ?? null,
      },
      empresaId,
      'cotizacion',
      client
    );

    const partidasDuplicadas = construirPartidasDuplicadas(origen.partidas as Array<Record<string, any>>);
    const partidasInsertadas = await reemplazarPartidasRepository(nuevoDocumento.id, partidasDuplicadas, empresaId, client);

    if (Array.isArray(partidasInsertadas) && partidasInsertadas.length > 0) {
      const tratamiento = String(documentoOrigen.tratamiento_impuestos ?? '').toLowerCase();

      if (tratamiento === 'sin_iva') {
        const partidaIds = partidasInsertadas.map((partida) => partida?.id).filter(Boolean) as number[];
        if (partidaIds.length) {
          await client.query('DELETE FROM documentos_partidas_impuestos WHERE partida_id = ANY($1)', [partidaIds]);
          await client.query(
            `UPDATE documentos_partidas
                SET total_partida = subtotal_partida
              WHERE id = ANY($1)`,
            [partidaIds]
          );
        }
      } else {
        for (const partida of partidasInsertadas) {
          if (partida?.id) {
            await calcularImpuestosPartida(partida.id, client);
          }
        }
      }
    }

    await actualizarTotales(nuevoDocumento.id, client);

    await client.query('COMMIT');
    return { id: nuevoDocumento.id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function actualizarCotizacionService(
  documentoId: number,
  payload: DocumentoCrearPayload,
  empresaId: number
) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const actual = await obtenerCotizacionActual(documentoId, empresaId, client);
    if (!actual) {
      await client.query('ROLLBACK');
      return null;
    }

    const actualizada = await actualizarDocumentoRepository(
      documentoId,
      payload,
      empresaId,
      'cotizacion',
      client,
      { skipOportunidadStatusSync: true }
    );

    if (!actualizada) {
      await client.query('ROLLBACK');
      return null;
    }

    const contactoAnterior = actual.contacto_principal_id ?? null;
    const contactoNuevo = actualizada.contacto_principal_id ?? null;
    const clienteCambio = contactoAnterior !== contactoNuevo;
    const oportunidadAnteriorId = actual.oportunidad_id ?? null;
    let oportunidadFinalId = actualizada.oportunidad_id ?? actual.oportunidad_id ?? null;

    if (clienteCambio) {
      if (oportunidadAnteriorId) {
        await desvincularPrincipalAnteriorSiCorresponde(oportunidadAnteriorId, documentoId, empresaId, client);
      }

      const nuevaOportunidad = await crearOportunidadParaCotizacion(
        {
          id: documentoId,
          tipo_documento: 'cotizacion',
          agente_id: actualizada.agente_id ?? actual.agente_id ?? null,
        },
        {
          contacto_principal_id: contactoNuevo,
          agente_id: actualizada.agente_id ?? actual.agente_id ?? null,
          conversacion_id: payload.conversacion_id ?? null,
        },
        empresaId,
        client
      );

      oportunidadFinalId = nuevaOportunidad?.id ?? null;
    } else if (oportunidadFinalId) {
      const oportunidadActual = await obtenerOportunidadPrincipal(oportunidadFinalId, empresaId, client);
      if (!oportunidadActual?.cotizacion_principal_id) {
        await actualizarCotizacionPrincipalOportunidad(oportunidadFinalId, documentoId, empresaId, client);
      }
    } else {
      const oportunidad = await asegurarOportunidadParaCotizacion(
        {
          id: documentoId,
          tipo_documento: 'cotizacion',
          agente_id: actualizada.agente_id ?? actual.agente_id ?? null,
        },
        {
          contacto_principal_id: contactoNuevo,
          agente_id: actualizada.agente_id ?? actual.agente_id ?? null,
          conversacion_id: payload.conversacion_id ?? null,
        },
        empresaId,
        client
      );

      oportunidadFinalId = oportunidad?.id ?? null;
    }

    if (oportunidadFinalId) {
      await sincronizarEstatusOportunidad(
        oportunidadFinalId,
        actualizada.estado_seguimiento ?? actual.estado_seguimiento ?? null,
        empresaId,
        client
      );
    }

    await client.query('COMMIT');
    return { ...actualizada, oportunidad_id: oportunidadFinalId };
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
