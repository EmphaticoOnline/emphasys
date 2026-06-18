import pool from '../../config/database';
import type { PoolClient } from 'pg';
import { FacturamaClient } from '../cfdi/facturama.client';
import { obtenerRolesDeUsuarioEnEmpresa } from '../auth/auth.service';
import { revertirInventarioDocumentoEnTransaccion } from '../inventario/inventario.service';

export class DocumentoCancelValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentoCancelValidationError';
  }
}

// ─── Tipos internos ───────────────────────────────────────────────────────────

type CancelarDocumentoInput = {
  documentoId: number;
  empresaId: number;
  usuarioId: number;
  esSuperadmin: boolean;
  motivoCancelacion?: string | null;
  motivoSat?: string | null;
  uuidSustitucion?: string | null;
};

type DocumentoCancelRow = {
  id: number;
  tipo_documento: string | null;
  estatus_documento: string | null;
  fecha_cancelacion: string | null;
};

type DocumentoCfdiRow = {
  uuid: string | null;
  fecha_cancelacion: string | null;
};

/** Intento de cancelación recuperado de la tabla documentos_cancelacion_intentos */
type IntentoParaEjecucion = {
  id: number;
  cfdi_uuid: string | null;
  facturama_respuesta: any;
  motivo_cancelacion: string | null;
  motivo_sat: string | null;
  uuid_sustitucion: string | null;
};

// ─── Helpers de validación ────────────────────────────────────────────────────

function esCancelado(estatus: unknown): boolean {
  const value = String(estatus ?? '').trim().toLowerCase();
  return value === 'cancelado' || value === 'cancelada';
}

function limpiarTexto(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function normalizarMotivoSat(value: unknown): string | null {
  const raw = limpiarTexto(value);
  if (!raw) return null;

  const normalized = raw.padStart(2, '0');
  if (!['01', '02', '03', '04'].includes(normalized)) {
    throw new DocumentoCancelValidationError('motivo_sat debe ser uno de: 01, 02, 03, 04');
  }

  return normalized;
}

async function validarPermisoAdministrador(empresaId: number, usuarioId: number, esSuperadmin: boolean) {
  if (esSuperadmin) return;

  const roles = await obtenerRolesDeUsuarioEnEmpresa(usuarioId, empresaId);
  const esAdministrador = roles.some((rol) => String(rol.nombre ?? '').trim().toLowerCase() === 'administrador');

  if (!esAdministrador) {
    throw new DocumentoCancelValidationError('Solo un administrador puede cancelar documentos');
  }
}

// ─── Queries de negocio ───────────────────────────────────────────────────────

async function obtenerDocumentoParaCancelacion(
  client: PoolClient,
  documentoId: number,
  empresaId: number,
  forUpdate = false
): Promise<DocumentoCancelRow | null> {
  const locking = forUpdate ? 'FOR UPDATE' : '';
  const { rows } = await client.query<DocumentoCancelRow>(
    `SELECT id, tipo_documento, estatus_documento, fecha_cancelacion
       FROM documentos
      WHERE id = $1
        AND empresa_id = $2
      LIMIT 1
      ${locking}`,
    [documentoId, empresaId]
  );
  return rows[0] ?? null;
}

async function obtenerCfdiDocumento(client: PoolClient, documentoId: number): Promise<DocumentoCfdiRow | null> {
  const { rows } = await client.query<DocumentoCfdiRow>(
    `SELECT uuid, fecha_cancelacion
       FROM documentos_cfdi
      WHERE documento_id = $1
      LIMIT 1`,
    [documentoId]
  );
  return rows[0] ?? null;
}

async function assertSinAplicacionesActivas(client: PoolClient, documentoId: number, empresaId: number) {
  const { rows } = await client.query<{ existe: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM aplicaciones_saldo a
        WHERE a.empresa_id = $1
          AND (a.documento_origen_id = $2 OR a.documento_destino_id = $2)
     ) AS existe`,
    [empresaId, documentoId]
  );

  if (Boolean(rows[0]?.existe)) {
    throw new DocumentoCancelValidationError(
      'No se puede cancelar: el documento tiene aplicaciones de saldo activas como origen o destino'
    );
  }
}

/**
 * Verifica que no existan documentos derivados activos.
 * Revisa tanto el campo documento_origen_id como la tabla documentos_partidas_vinculos
 * para cubrir vínculos por partida (p. ej. remisiones/facturas con cantidades parciales).
 */
async function assertSinDocumentosDerivadosActivos(client: PoolClient, documentoId: number, empresaId: number) {
  const { rows } = await client.query<{ existe: boolean }>(
    `SELECT EXISTS (
       -- Derivados directos vía campo documento_origen_id
       SELECT 1
         FROM documentos d
        WHERE d.empresa_id = $1
          AND d.documento_origen_id = $2
          AND LOWER(TRIM(COALESCE(d.estatus_documento, ''))) NOT IN ('cancelado', 'cancelada')
       UNION ALL
       -- Derivados vinculados vía documentos_partidas_vinculos
       SELECT 1
         FROM documentos_partidas_vinculos dpv
         JOIN documentos d_dest ON d_dest.id = dpv.documento_destino_id
        WHERE dpv.documento_origen_id = $2
          AND d_dest.empresa_id = $1
          AND d_dest.id <> $2
          AND LOWER(TRIM(COALESCE(d_dest.estatus_documento, ''))) NOT IN ('cancelado', 'cancelada')
     ) AS existe`,
    [empresaId, documentoId]
  );

  if (Boolean(rows[0]?.existe)) {
    throw new DocumentoCancelValidationError('No se puede cancelar: el documento tiene documentos derivados activos');
  }
}

async function tieneMovimientoInventarioAsociado(client: PoolClient, documentoId: number, empresaId: number): Promise<boolean> {
  const { rows } = await client.query<{ existe: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM inventario.movimientos m
        WHERE m.empresa_id = $1
          AND m.documento_id = $2
          AND m.es_reversion = false
     ) AS existe`,
    [empresaId, documentoId]
  );
  return Boolean(rows[0]?.existe);
}

// ─── Saga: tabla documentos_cancelacion_intentos ─────────────────────────────

async function insertarIntento(params: {
  documentoId: number;
  empresaId: number;
  usuarioId: number;
  motivoCancelacion: string | null;
  motivoSat: string | null;
  uuidSustitucion: string | null;
  cfdiUuid: string | null;
}): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO documentos_cancelacion_intentos
       (empresa_id, documento_id, usuario_id, estado,
        motivo_cancelacion, motivo_sat, uuid_sustitucion, cfdi_uuid)
     VALUES ($1, $2, $3, 'iniciado', $4, $5, $6, $7)
     RETURNING id`,
    [
      params.empresaId,
      params.documentoId,
      params.usuarioId,
      params.motivoCancelacion,
      params.motivoSat,
      params.uuidSustitucion,
      params.cfdiUuid,
    ]
  );
  return rows[0].id;
}

async function actualizarEstadoIntento(
  intentoId: number,
  estado: string,
  extras: {
    facturamaRespuesta?: any;
    errorExternoMensaje?: string;
    errorInternoMensaje?: string;
  } = {}
): Promise<void> {
  await pool.query(
    `UPDATE documentos_cancelacion_intentos
        SET estado                 = $2,
            facturama_respuesta    = COALESCE($3, facturama_respuesta),
            error_externo_mensaje  = COALESCE($4, error_externo_mensaje),
            error_interno_mensaje  = COALESCE($5, error_interno_mensaje),
            updated_at             = NOW()
      WHERE id = $1`,
    [
      intentoId,
      estado,
      extras.facturamaRespuesta != null ? JSON.stringify(extras.facturamaRespuesta) : null,
      extras.errorExternoMensaje ?? null,
      extras.errorInternoMensaje ?? null,
    ]
  );
}

/**
 * Busca un intento previo en estado recuperable (externo_ok o externo_ok_interno_pendiente).
 * Sólo existen cuando Facturama ya fue invocado con éxito; la cancelación interna puede
 * reintentarse sin volver a llamar al PAC.
 */
async function obtenerIntentoPendienteDeReintento(
  documentoId: number,
  empresaId: number
): Promise<IntentoParaEjecucion | null> {
  const { rows } = await pool.query<IntentoParaEjecucion>(
    `SELECT id, cfdi_uuid, facturama_respuesta,
            motivo_cancelacion, motivo_sat, uuid_sustitucion
       FROM documentos_cancelacion_intentos
      WHERE documento_id = $1
        AND empresa_id   = $2
        AND estado IN ('externo_ok', 'externo_ok_interno_pendiente')
      ORDER BY created_at DESC
      LIMIT 1`,
    [documentoId, empresaId]
  );
  return rows[0] ?? null;
}

// ─── Cancelación interna (transacción SQL) ────────────────────────────────────

/**
 * Ejecuta la parte interna (SQL) de la cancelación.
 * Se puede llamar tanto en el flujo normal como en un reintento.
 * Al final de la transacción actualiza el intento a 'completado'.
 * Si la transacción falla y el intento tenía CFDI, lo marca como
 * 'externo_ok_interno_pendiente' para forzar el bloqueo de edición
 * y facilitar el reintento. Si no había CFDI, lo marca 'error_interno'.
 */
async function ejecutarCancelacionInterna(params: {
  intento: IntentoParaEjecucion;
  documentoId: number;
  empresaId: number;
  usuarioId: number;
}): Promise<{
  ok: boolean;
  documento_id: number;
  estatus_documento: string;
  fecha_cancelacion: string;
  inventario_revertido: boolean;
  cfdi_cancelado_facturama: boolean;
  intento_id: number;
}> {
  const { intento, documentoId, empresaId, usuarioId } = params;
  const { id: intentoId, cfdi_uuid: cfdiUuid, facturama_respuesta: facturamaRespuesta,
          motivo_cancelacion: motivoCancelacion, motivo_sat: motivoSat,
          uuid_sustitucion: uuidSustitucion } = intento;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Re-validación con bloqueo para evitar condiciones de carrera
    const documento = await obtenerDocumentoParaCancelacion(client, documentoId, empresaId, true);
    if (!documento) {
      throw new DocumentoCancelValidationError('Documento no encontrado');
    }
    if (esCancelado(documento.estatus_documento)) {
      throw new DocumentoCancelValidationError('El documento ya está cancelado');
    }

    await assertSinAplicacionesActivas(client, documentoId, empresaId);
    await assertSinDocumentosDerivadosActivos(client, documentoId, empresaId);

    // Reversión de inventario (dentro de la misma transacción)
    console.log(`[CANCELACION] Verificando movimiento inventario doc=${documentoId} empresa=${empresaId}`);
    const hayMovimientoInventario = await tieneMovimientoInventarioAsociado(client, documentoId, empresaId);
    console.log(`[CANCELACION] tieneMovimientoInventarioAsociado=`, hayMovimientoInventario);
    if (hayMovimientoInventario) {
      console.log(`[CANCELACION] Llamando revertirInventarioDocumentoEnTransaccion doc=${documentoId}`);
      await revertirInventarioDocumentoEnTransaccion(client, documentoId, empresaId, usuarioId, {
        observaciones: `Reversión por cancelación de documento ${documentoId}`,
      });
      console.log(`[CANCELACION] revertirInventarioDocumentoEnTransaccion completado`);
    }

    // Cancelar documento
    await client.query(
      `UPDATE documentos
          SET estatus_documento      = 'Cancelado',
              fecha_cancelacion      = CURRENT_DATE,
              usuario_cancelacion_id = $1,
              motivo_cancelacion     = $2,
              motivo_sat             = $3,
              uuid_sustitucion       = $4,
              usuario_modificacion_id = $1,
              fecha_modificacion     = NOW()
        WHERE id = $5
          AND empresa_id = $6`,
      [usuarioId, motivoCancelacion, motivoSat, uuidSustitucion, documentoId, empresaId]
    );

    // Actualizar CFDI si aplica
    if (cfdiUuid) {
      await client.query(
        `UPDATE documentos_cfdi
            SET fecha_cancelacion = NOW(),
                estado_sat        = 'cancelado',
                xml_cancelacion   = COALESCE($2::text, xml_cancelacion)
          WHERE documento_id = $1`,
        [documentoId, facturamaRespuesta != null ? JSON.stringify(facturamaRespuesta) : null]
      );
    }

    // Marcar intento como completado dentro de la misma transacción para atomicidad
    await client.query(
      `UPDATE documentos_cancelacion_intentos
          SET estado = 'completado', updated_at = NOW()
        WHERE id = $1`,
      [intentoId]
    );

    console.log(`[CANCELACION] Antes de COMMIT doc=${documentoId}`);
    await client.query('COMMIT');
    console.log(`[CANCELACION] COMMIT completado`);

    return {
      ok: true,
      documento_id: documentoId,
      estatus_documento: 'Cancelado',
      fecha_cancelacion: new Date().toISOString(),
      inventario_revertido: hayMovimientoInventario,
      cfdi_cancelado_facturama: Boolean(cfdiUuid),
      intento_id: intentoId,
    };
  } catch (error) {
    await client.query('ROLLBACK');

    // Si había CFDI ya cancelado en Facturama → bloquear edición del documento
    // hasta que un administrador resuelva el intento manualmente o lo reintente.
    // Si no había CFDI → error limpio, no hay inconsistencia externa.
    const estadoFallback = cfdiUuid ? 'externo_ok_interno_pendiente' : 'error_interno';
    const errorMensaje = String((error as Error)?.message ?? 'Error desconocido').substring(0, 1000);

    await actualizarEstadoIntento(intentoId, estadoFallback, { errorInternoMensaje: errorMensaje });

    throw error;
  } finally {
    client.release();
  }
}

// ─── Punto de entrada público ─────────────────────────────────────────────────

export async function cancelarDocumentoService(input: CancelarDocumentoInput) {
  // 1. Verificar permiso siempre (antes de cualquier otra operación)
  await validarPermisoAdministrador(input.empresaId, input.usuarioId, input.esSuperadmin);

  const motivoCancelacion = limpiarTexto(input.motivoCancelacion);
  const motivoSat = normalizarMotivoSat(input.motivoSat);
  const uuidSustitucion = limpiarTexto(input.uuidSustitucion);

  if (motivoSat === '01' && !uuidSustitucion) {
    throw new DocumentoCancelValidationError('uuid_sustitucion es obligatorio cuando motivo_sat es 01');
  }

  // 2. Reintento: si existe un intento recuperable no volver a llamar a Facturama
  const intentoPendiente = await obtenerIntentoPendienteDeReintento(input.documentoId, input.empresaId);
  if (intentoPendiente) {
    return ejecutarCancelacionInterna({
      intento: intentoPendiente,
      documentoId: input.documentoId,
      empresaId: input.empresaId,
      usuarioId: input.usuarioId,
    });
  }

  // 3. Precheck de negocio sin bloqueo (lectura optimista para fail-fast)
  const precheckClient = await pool.connect();
  let cfdiUuid: string | null = null;
  let requiereCancelacionFacturama = false;
  try {
    const documento = await obtenerDocumentoParaCancelacion(precheckClient, input.documentoId, input.empresaId, false);
    if (!documento) throw new DocumentoCancelValidationError('Documento no encontrado');
    if (esCancelado(documento.estatus_documento)) throw new DocumentoCancelValidationError('El documento ya está cancelado');

    await assertSinAplicacionesActivas(precheckClient, input.documentoId, input.empresaId);
    await assertSinDocumentosDerivadosActivos(precheckClient, input.documentoId, input.empresaId);

    const cfdi = await obtenerCfdiDocumento(precheckClient, input.documentoId);
    cfdiUuid = limpiarTexto(cfdi?.uuid);
    requiereCancelacionFacturama = Boolean(cfdiUuid) && !cfdi?.fecha_cancelacion;
  } finally {
    precheckClient.release();
  }

  // 4. Registrar intento antes de cualquier llamada externa
  const intentoId = await insertarIntento({
    documentoId: input.documentoId,
    empresaId: input.empresaId,
    usuarioId: input.usuarioId,
    motivoCancelacion,
    motivoSat,
    uuidSustitucion,
    cfdiUuid,
  });

  // 5. Cancelación en Facturama (fuera de la transacción SQL)
  let facturamaRespuesta: any = null;
  if (requiereCancelacionFacturama && cfdiUuid) {
    try {
      const facturama = await FacturamaClient.fromDatabaseOrEnv();
      facturamaRespuesta = await facturama.cancelCfdi({
        uuid: cfdiUuid,
        motivoSat: motivoSat ?? '02',
        uuidSustitucion,
      });
      await actualizarEstadoIntento(intentoId, 'externo_ok', { facturamaRespuesta });
    } catch (error: any) {
      const mensaje = String(error?.message || 'No se pudo cancelar CFDI en Facturama');
      await actualizarEstadoIntento(intentoId, 'error_externo', { errorExternoMensaje: mensaje });
      throw new DocumentoCancelValidationError(mensaje);
    }
  } else {
    // Sin CFDI: avanzar estado para que ejecutarCancelacionInterna pueda marcar 'completado'
    await actualizarEstadoIntento(intentoId, 'externo_ok', {});
  }

  // 6. Cancelación interna (transacción SQL)
  return ejecutarCancelacionInterna({
    intento: {
      id: intentoId,
      cfdi_uuid: cfdiUuid,
      facturama_respuesta: facturamaRespuesta,
      motivo_cancelacion: motivoCancelacion,
      motivo_sat: motivoSat,
      uuid_sustitucion: uuidSustitucion,
    },
    documentoId: input.documentoId,
    empresaId: input.empresaId,
    usuarioId: input.usuarioId,
  });
}
