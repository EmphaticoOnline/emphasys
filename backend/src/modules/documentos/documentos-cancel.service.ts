import pool from '../../config/database';
import type { PoolClient } from 'pg';
import { FacturamaClient } from '../cfdi/facturama.client';
import { obtenerRolesDeUsuarioEnEmpresa } from '../auth/auth.service';
import { revertirInventarioDocumentoEnTransaccion } from '../inventario/inventario.service';
import { generarReversaCancelacionFacturaVenta } from '../contabilidad/facturaVentaContabilizacion.repository';
import {
  type CfdiCancelacionEstado,
  type CfdiPacModalidad,
  esUuidFiscal,
  getCancelPath,
  validarIdentidadCfdiOriginal,
} from '../cfdi/cfdi-cancelacion';
import {
  obtenerDependenciasCancelacion,
  type DependenciaCancelacion,
} from './documentos-dependencias-cancelacion';
import { markTransportCancelledForDocument } from '../transporte/transporte.repository';

export class DocumentoCancelValidationError extends Error {
  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
    readonly code = 'CANCELACION_VALIDATION_ERROR',
    readonly statusCode = 400
  ) {
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
  xml_timbrado: string | null;
  pac: string | null;
  pac_id: string | null;
  pac_modalidad: CfdiPacModalidad | null;
  rfc_emisor: string | null;
  rfc_receptor: string | null;
  total: string | number | null;
  folio_cfdi: string | null;
  cancelacion_estado: CfdiCancelacionEstado | null;
  cfdi_pac_config_id: number | null;
};

/** Intento de cancelación recuperado de la tabla documentos_cancelacion_intentos */
type IntentoParaEjecucion = {
  id: number;
  cfdi_uuid: string | null;
  motivo_cancelacion: string | null;
  motivo_sat: string | null;
  uuid_sustitucion: string | null;
  acuse_xml?: string | null;
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
    `SELECT uuid, fecha_cancelacion, xml_timbrado, pac, pac_id, pac_modalidad,
            cfdi_pac_config_id,
            rfc_emisor, rfc_receptor, total, folio_cfdi, cancelacion_estado
       FROM documentos_cfdi
      WHERE documento_id = $1
      LIMIT 1`,
    [documentoId]
  );
  return rows[0] ?? null;
}

async function assertSinSolicitudCancelacionActiva(
  client: PoolClient,
  documentoId: number,
  empresaId: number
): Promise<void> {
  const { rows } = await client.query<{ existe: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM public.documentos_cancelacion_intentos
        WHERE documento_id = $1
          AND empresa_id = $2
          AND estado IN ('iniciado', 'solicitada', 'pendiente', 'requiere_reconciliacion')
     ) AS existe`,
    [documentoId, empresaId]
  );
  if (rows[0]?.existe) {
    throw new DocumentoCancelValidationError(
      'El CFDI ya tiene una solicitud de cancelación pendiente o requiere reconciliación.'
    );
  }
}

function validarCfdiParaCancelacion(cfdi: DocumentoCfdiRow, motivoSat: string | null, uuidSustitucion: string | null): {
  pacId: string;
  modalidad: CfdiPacModalidad;
  rfcEmisor: string;
} {
  const pacId = limpiarTexto(cfdi.pac_id);
  if (!pacId) {
    throw new DocumentoCancelValidationError('No puede cancelarse porque falta el identificador del PAC.');
  }
  if (esUuidFiscal(pacId)) {
    throw new DocumentoCancelValidationError('El identificador del PAC no puede ser el UUID fiscal.');
  }
  if (cfdi.pac_modalidad !== 'web' && cfdi.pac_modalidad !== 'lite') {
    throw new DocumentoCancelValidationError('No puede cancelarse porque la modalidad del CFDI es desconocida.');
  }
  if (!cfdi.uuid || !cfdi.xml_timbrado || !cfdi.rfc_emisor) {
    throw new DocumentoCancelValidationError('El CFDI no tiene identidad fiscal completa para cancelarse.');
  }
  if (cfdi.fecha_cancelacion || cfdi.cancelacion_estado === 'cancelada') {
    throw new DocumentoCancelValidationError('El CFDI ya está cancelado.');
  }
  if (motivoSat === '01' && !uuidSustitucion) {
    throw new DocumentoCancelValidationError('uuid_sustitucion es obligatorio cuando motivo_sat es 01');
  }

  try {
    validarIdentidadCfdiOriginal({
      xml: cfdi.xml_timbrado,
      uuid: cfdi.uuid,
      rfcEmisor: cfdi.rfc_emisor,
      rfcReceptor: cfdi.rfc_receptor,
      total: cfdi.total,
      folio: cfdi.folio_cfdi,
    });
  } catch (error) {
    throw new DocumentoCancelValidationError(
      error instanceof Error ? error.message : 'La identidad fiscal del CFDI no pudo validarse.'
    );
  }

  return { pacId, modalidad: cfdi.pac_modalidad, rfcEmisor: cfdi.rfc_emisor };
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
  const dependencias = await obtenerDependenciasCancelacion(client, documentoId, empresaId);
  if (dependencias.bloqueantes.length > 0) {
    const first = dependencias.bloqueantes[0];
    throw new DocumentoCancelValidationError(
      `No se puede cancelar porque existe el documento activo ${first.folio || `#${first.documentoId}`} derivado de éste.`,
      {
        dependencias_bloqueantes: dependencias.bloqueantes,
        correcciones_no_bloqueantes: dependencias.noBloqueantes,
      }
    );
  }
  return dependencias.noBloqueantes;
}

export type PrevalidacionCancelacion = {
  documentoId: number;
  folio: string;
  aplicacionesActivas: number;
  derivadosBloqueantes: DependenciaCancelacion[];
  correccionesNoBloqueantes: DependenciaCancelacion[];
  inventario: boolean;
  contabilidad: boolean;
  intentoActivo: { id: number; estado: string } | null;
  cfdi: {
    uuid: string | null;
    estadoSat: string | null;
    cancelacionEstado: string | null;
    pacId: string | null;
    pacModalidad: string | null;
  } | null;
  puedeSolicitarCancelacion: boolean;
  advertencias: string[];
};

export async function prevalidarCancelacionDocumento(
  documentoId: number,
  empresaId: number
): Promise<PrevalidacionCancelacion> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{
      id: number;
      folio: string;
      aplicaciones_activas: number;
      inventario: boolean;
      contabilidad: boolean;
      uuid: string | null;
      estado_sat: string | null;
      cancelacion_estado: string | null;
      pac_id: string | null;
      pac_modalidad: string | null;
      intento_activo_id: number | null;
      intento_activo_estado: string | null;
    }>(
      `SELECT d.id,
              CONCAT_WS('-', NULLIF(d.serie, ''), LPAD(d.numero::text, CASE WHEN ABS(d.numero) < 1000 THEN 3 ELSE 6 END, '0')) AS folio,
              (SELECT COUNT(*)::int FROM aplicaciones_saldo a
                WHERE a.empresa_id = d.empresa_id
                  AND (a.documento_origen_id = d.id OR a.documento_destino_id = d.id)) AS aplicaciones_activas,
              EXISTS (SELECT 1 FROM inventario.movimientos m
                WHERE m.empresa_id = d.empresa_id AND m.documento_id = d.id AND m.es_reversion = false) AS inventario,
              EXISTS (SELECT 1 FROM contabilidad.contabilizaciones c
                WHERE c.empresa_id = d.empresa_id AND c.documento_id = d.id
                  AND c.evento_contable = 'emision' AND c.es_reversa = false) AS contabilidad,
              dc.uuid, dc.estado_sat, dc.cancelacion_estado, dc.pac_id, dc.pac_modalidad,
              intento.id AS intento_activo_id, intento.estado AS intento_activo_estado
         FROM documentos d
         LEFT JOIN documentos_cfdi dc ON dc.documento_id = d.id
         LEFT JOIN LATERAL (
           SELECT i.id, i.estado
             FROM documentos_cancelacion_intentos i
            WHERE i.documento_id = d.id
              AND i.empresa_id = d.empresa_id
              AND i.estado IN ('iniciado', 'solicitada', 'pendiente', 'requiere_reconciliacion')
            ORDER BY i.created_at DESC
            LIMIT 1
         ) intento ON true
        WHERE d.id = $1 AND d.empresa_id = $2
        LIMIT 1`,
      [documentoId, empresaId]
    );
    const document = rows[0];
    if (!document) throw new DocumentoCancelValidationError('Documento no encontrado');
    const dependencies = await obtenerDependenciasCancelacion(client, documentoId, empresaId);
    const warnings = dependencies.noBloqueantes.map(
      (item) => `Existe una factura corregida vinculada: ${item.folio}. La cancelación de ${document.folio} no afectará ${item.folio}.`
    );
    return {
      documentoId,
      folio: document.folio,
      aplicacionesActivas: Number(document.aplicaciones_activas),
      derivadosBloqueantes: dependencies.bloqueantes,
      correccionesNoBloqueantes: dependencies.noBloqueantes,
      inventario: Boolean(document.inventario),
      contabilidad: Boolean(document.contabilidad),
      intentoActivo: document.intento_activo_id ? {
        id: Number(document.intento_activo_id),
        estado: String(document.intento_activo_estado),
      } : null,
      cfdi: document.uuid ? {
        uuid: document.uuid,
        estadoSat: document.estado_sat,
        cancelacionEstado: document.cancelacion_estado,
        pacId: document.pac_id,
        pacModalidad: document.pac_modalidad,
      } : null,
      puedeSolicitarCancelacion:
        Number(document.aplicaciones_activas) === 0 &&
        dependencies.bloqueantes.length === 0 &&
        !document.intento_activo_id,
      advertencias: document.intento_activo_id
        ? [
            ...warnings,
            `Existe un intento de cancelación ${document.intento_activo_estado} (#${document.intento_activo_id}). Debe reconciliarse antes de reintentar.`,
          ]
        : warnings,
    };
  } finally {
    client.release();
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

/**
 * true si el documento tiene una contabilización de emisión de factura de
 * venta activa (evento_contable='emision', es_reversa=false). Se consulta
 * contra contabilidad.contabilizaciones (la marca real que deja el motor de
 * ventas), no contra documentos.tipo_documento: así se evita disparar
 * generarReversaCancelacionFacturaVenta (que exige tipo de póliza de
 * cancelación configurado) para documentos que nunca se contabilizaron o que
 * no son facturas de venta (p. ej. facturas de compra, cuyo tipo_documento es
 * 'factura_compra', un valor distinto).
 */
async function tieneContabilizacionVentaFacturaActiva(
  client: PoolClient,
  documentoId: number,
  empresaId: number
): Promise<boolean> {
  const { rows } = await client.query<{ existe: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM contabilidad.contabilizaciones ct
        WHERE ct.empresa_id = $1
          AND ct.documento_id = $2
          AND ct.tipo_documento = 'factura_venta'
          AND ct.evento_contable = 'emision'
          AND ct.es_reversa = false
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
  proveedor?: string | null;
  pacId?: string | null;
  modalidad?: CfdiPacModalidad | null;
  rfcEmisor?: string | null;
  endpoint?: string | null;
  cfdiPacConfigId?: number | null;
}, client?: PoolClient): Promise<number> {
  const executor = client ?? pool;
  const { rows } = await executor.query<{ id: number }>(
    `INSERT INTO documentos_cancelacion_intentos
       (empresa_id, documento_id, usuario_id, estado,
        motivo_cancelacion, motivo_sat, uuid_sustitucion, cfdi_uuid,
        proveedor, pac_id, modalidad, rfc_emisor, endpoint, cfdi_pac_config_id)
     VALUES ($1, $2, $3, 'iniciado', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id`,
    [
      params.empresaId,
      params.documentoId,
      params.usuarioId,
      params.motivoCancelacion,
      params.motivoSat,
      params.uuidSustitucion,
      params.cfdiUuid,
      params.proveedor ?? null,
      params.pacId ?? null,
      params.modalidad ?? null,
      params.rfcEmisor ?? null,
      params.endpoint ?? null,
      params.cfdiPacConfigId ?? null,
    ]
  );
  return rows[0].id;
}

async function insertarIntentoConBloqueo(params: Parameters<typeof insertarIntento>[0]): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const documento = await obtenerDocumentoParaCancelacion(
      client,
      params.documentoId,
      params.empresaId,
      true
    );
    if (!documento) throw new DocumentoCancelValidationError('Documento no encontrado');
    if (esCancelado(documento.estatus_documento)) {
      throw new DocumentoCancelValidationError('El documento ya está cancelado');
    }
    await assertSinSolicitudCancelacionActiva(client, params.documentoId, params.empresaId);
    await assertSinAplicacionesActivas(client, params.documentoId, params.empresaId);
    await assertSinDocumentosDerivadosActivos(client, params.documentoId, params.empresaId);
    const intentoId = await insertarIntento(params, client);
    await client.query('COMMIT');
    return intentoId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function actualizarEstadoIntento(
  intentoId: number,
  estado: string,
  extras: {
    errorExternoMensaje?: string;
    errorInternoMensaje?: string;
    proveedorStatus?: string | null;
    errorCodigo?: string | null;
    mensajeSanitizado?: string | null;
    acuseXml?: string | null;
    facturamaRespuesta?: Record<string, unknown> | null;
    incrementarConsulta?: boolean;
  } = {}
): Promise<void> {
  await pool.query(
    `UPDATE documentos_cancelacion_intentos
        SET estado                 = $2::varchar,
            facturama_respuesta    = COALESCE($3::jsonb, facturama_respuesta),
            error_externo_mensaje  = COALESCE($4::text, error_externo_mensaje),
            error_interno_mensaje  = COALESCE($5::text, error_interno_mensaje),
            proveedor_status       = COALESCE($6::varchar, proveedor_status),
            error_codigo           = COALESCE($7::varchar, error_codigo),
            mensaje_sanitizado     = COALESCE($8::text, mensaje_sanitizado),
            acuse_xml              = COALESCE($9::text, acuse_xml),
            intentos_consulta      = intentos_consulta + CASE WHEN $10::boolean THEN 1 ELSE 0 END,
            fecha_solicitud        = CASE WHEN $2::text IN ('solicitada', 'pendiente', 'cancelada', 'requiere_reconciliacion') THEN COALESCE(fecha_solicitud, NOW()) ELSE fecha_solicitud END,
            updated_at             = NOW()
      WHERE id = $1`,
    [
      intentoId,
      estado,
      extras.facturamaRespuesta ? JSON.stringify(extras.facturamaRespuesta) : null,
      extras.errorExternoMensaje ?? null,
      extras.errorInternoMensaje ?? null,
      extras.proveedorStatus ?? null,
      extras.errorCodigo ?? null,
      limpiarTexto(extras.mensajeSanitizado)?.slice(0, 500) ?? null,
      extras.acuseXml ?? null,
      Boolean(extras.incrementarConsulta),
    ]
  );
}

function sanitizarRespuestaPac(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const allowed = ['Status', 'status', 'Message', 'message', 'ModelState', 'Code', 'code'];
  return Object.fromEntries(
    allowed.filter((key) => key in source).map((key) => [key, source[key]])
  );
}

export function clasificarFalloCancelacionPac(error: any): {
  estado: 'error' | 'requiere_reconciliacion';
  code: string;
  message: string;
  pacResponse: Record<string, unknown> | null;
} {
  const hasPacResponse = Boolean(error?.hasPacResponse || error?.statusCode);
  if (!hasPacResponse && error?.requestDispatched) {
    return {
      estado: 'requiere_reconciliacion',
      code: String(error?.transportCode || error?.code || 'PAC_RESPONSE_UNKNOWN'),
      message: 'No fue posible confirmar el estado fiscal; la solicitud requiere conciliación antes de cualquier reintento.',
      pacResponse: null,
    };
  }
  return {
    estado: 'error',
    code: String(error?.statusCode || error?.transportCode || error?.code || 'PAC_ERROR'),
    message: String(error?.message || 'Facturama rechazó la solicitud de cancelación.'),
    pacResponse: sanitizarRespuestaPac(error?.facturamaResponse),
  };
}

export async function consultarEstadoCancelacionPac(
  client: Pick<FacturamaClient, 'getCfdiStatus'>,
  payload: { pacId: string; modalidad: CfdiPacModalidad }
) {
  return client.getCfdiStatus(payload);
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
    `SELECT id, cfdi_uuid, motivo_cancelacion, motivo_sat,
            uuid_sustitucion, acuse_xml
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
  const { id: intentoId, cfdi_uuid: cfdiUuid, acuse_xml: acuseXml,
          motivo_cancelacion: motivoCancelacion, motivo_sat: motivoSat,
          uuid_sustitucion: uuidSustitucion } = intento;

  console.log(`[CANCELACION] Inicio doc=${documentoId} empresa=${empresaId} usuario=${usuarioId} intento=${intentoId}`);
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
                cancelacion_estado = 'cancelada',
                cancelacion_proveedor_status = 'canceled',
                cancelacion_ultima_consulta_at = NOW(),
                xml_cancelacion   = COALESCE($2::text, xml_cancelacion)
          WHERE documento_id = $1`,
        [documentoId, acuseXml ?? null]
      );
      await markTransportCancelledForDocument(client, documentoId, empresaId);
    }

    // Reversa contable automática de venta. generarReversaCancelacionFacturaVenta
    // recibe este mismo `client`, así que TODO lo que hace (leer la
    // contabilización/póliza original, insertar la póliza reversa, registrar
    // la reversa en contabilidad.contabilizaciones) corre dentro de esta
    // misma transacción — nunca abre una segunda conexión con pool.connect().
    // Eso es lo que antes causaba el 504: una segunda conexión pedida al
    // mismo pool mientras esta primera seguía retenida podía quedarse
    // esperando indefinidamente (no hay connectionTimeoutMillis configurado)
    // a que el propio pool liberara una conexión que, en la práctica, era
    // justo la que esta transacción ya tenía tomada. Con un solo client, si
    // la reversa falla, el ROLLBACK de abajo deshace también lo que la
    // reversa alcanzó a insertar: nunca queda una factura cancelada sin
    // reversa, y nunca queda una reversa "huérfana" de una cancelación que
    // no se completó.
    const requiereReversaVenta = await tieneContabilizacionVentaFacturaActiva(client, documentoId, empresaId);
    console.log(`[CANCELACION] Antes de generar reversa doc=${documentoId} requiereReversaVenta=${requiereReversaVenta}`);
    if (requiereReversaVenta) {
      try {
        const resultadoReversa = await generarReversaCancelacionFacturaVenta(
          empresaId,
          documentoId,
          {
            usuario_id: usuarioId,
            comentario: `Reversa automática por cancelación de documento ${documentoId}`,
          },
          client
        );
        console.log(
          `[CANCELACION] Después de generar reversa doc=${documentoId} generada=${resultadoReversa.generada}` +
            (resultadoReversa.generada ? ` poliza_id=${resultadoReversa.poliza.id}` : ` motivo=${resultadoReversa.motivo}`)
        );
      } catch (reversaError) {
        // Cualquier falla al generar la reversa (tipo de póliza de
        // cancelación no configurado, cuentas faltantes, doble reversa, etc.)
        // debe abortar toda la cancelación: no puede quedar una factura de
        // venta contabilizada marcada como cancelada sin su póliza reversa.
        console.log(
          `[CANCELACION] Error al generar reversa doc=${documentoId}: ${(reversaError as Error)?.message ?? reversaError}`
        );
        const mensaje = String((reversaError as Error)?.message ?? '')
          .replace('VALIDATION_ERROR:', '')
          .trim();
        throw new DocumentoCancelValidationError(
          mensaje || 'No se pudo generar la reversa contable de la factura de venta; la cancelación fue revertida.'
        );
      }
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
    console.log(
      `[CANCELACION] Error, haciendo ROLLBACK doc=${documentoId}: ${(error as Error)?.message ?? error}`
    );
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
  let cfdi: DocumentoCfdiRow | null = null;
  let identidadPac: ReturnType<typeof validarCfdiParaCancelacion> | null = null;
  let facturamaCancelacion: FacturamaClient | null = null;
  try {
    const documento = await obtenerDocumentoParaCancelacion(precheckClient, input.documentoId, input.empresaId, false);
    if (!documento) throw new DocumentoCancelValidationError('Documento no encontrado');
    if (esCancelado(documento.estatus_documento)) throw new DocumentoCancelValidationError('El documento ya está cancelado');

    await assertSinSolicitudCancelacionActiva(precheckClient, input.documentoId, input.empresaId);
    await assertSinAplicacionesActivas(precheckClient, input.documentoId, input.empresaId);
    await assertSinDocumentosDerivadosActivos(precheckClient, input.documentoId, input.empresaId);

    cfdi = await obtenerCfdiDocumento(precheckClient, input.documentoId);
    cfdiUuid = limpiarTexto(cfdi?.uuid);
    requiereCancelacionFacturama = Boolean(cfdiUuid) && !cfdi?.fecha_cancelacion;
    if (requiereCancelacionFacturama && cfdi) {
      identidadPac = validarCfdiParaCancelacion(cfdi, motivoSat ?? '02', uuidSustitucion);
      facturamaCancelacion = await FacturamaClient.forHistorical({
        empresaId: input.empresaId,
        configId: cfdi.cfdi_pac_config_id,
        pac: cfdi.pac,
        modalidad: cfdi.pac_modalidad,
      });
    }

    // Una factura en Borrador no es un documento fiscal formal: no se
    // cancela, se elimina. Una factura Emitida sí se puede cancelar aunque
    // no esté timbrada (cancelación operativa interna, sin CFDI/PAC) — ver
    // el bloque 5 más abajo, que ya omite la llamada a Facturama cuando no
    // hay cfdiUuid.
    if (
      String(documento.tipo_documento ?? '').trim().toLowerCase() === 'factura' &&
      String(documento.estatus_documento ?? '').trim().toLowerCase() === 'borrador'
    ) {
      throw new DocumentoCancelValidationError(
        'La factura está en borrador; no se puede cancelar. Elimínela si ya no la necesita.'
      );
    }
  } finally {
    precheckClient.release();
  }

  const endpoint = identidadPac
    ? getCancelPath(identidadPac.modalidad, identidadPac.pacId, motivoSat ?? '02', uuidSustitucion)
    : null;

  // 4. Registrar intento antes de cualquier llamada externa
  const intentoId = await insertarIntentoConBloqueo({
    documentoId: input.documentoId,
    empresaId: input.empresaId,
    usuarioId: input.usuarioId,
    motivoCancelacion,
    motivoSat,
    uuidSustitucion,
    cfdiUuid,
    proveedor: identidadPac ? (cfdi?.pac || 'facturama') : null,
    pacId: identidadPac?.pacId ?? null,
    modalidad: identidadPac?.modalidad ?? null,
    rfcEmisor: identidadPac?.rfcEmisor ?? null,
    endpoint,
    cfdiPacConfigId: facturamaCancelacion?.configId ?? null,
  });

  // 5. Cancelación en Facturama (fuera de la transacción SQL)
  let acuseXml: string | null = null;
  let respuestaPacRecibida = false;
  if (requiereCancelacionFacturama && cfdiUuid) {
    try {
      if (!identidadPac) {
        throw new DocumentoCancelValidationError('El CFDI no tiene identidad PAC completa.');
      }
      if (!facturamaCancelacion) throw new DocumentoCancelValidationError('No se resolvió la configuración PAC original.');
      const cancelacion = await facturamaCancelacion.cancelCfdi({
        pacId: identidadPac.pacId,
        modalidad: identidadPac.modalidad,
        motivoSat: motivoSat ?? '02',
        uuidSustitucion,
      });
      respuestaPacRecibida = true;
      const acuseBase64 = String(
        cancelacion.data?.AcuseXmlBase64 ?? cancelacion.data?.acuseXmlBase64 ?? ''
      ).trim();
      if (acuseBase64) {
        const decoded = Buffer.from(acuseBase64, 'base64').toString('utf8').trim();
        acuseXml = decoded.startsWith('<') ? decoded : null;
      }

      await actualizarEstadoIntento(intentoId, cancelacion.estado, {
        proveedorStatus: cancelacion.proveedorStatus,
        acuseXml,
        facturamaRespuesta: sanitizarRespuestaPac(cancelacion.data),
      });
      await pool.query(
        `UPDATE public.documentos_cfdi
            SET cancelacion_estado = $2,
                cancelacion_proveedor_status = $3,
                cancelacion_ultima_consulta_at = NOW()
          WHERE documento_id = $1`,
        [input.documentoId, cancelacion.estado, cancelacion.proveedorStatus]
      );

      if (cancelacion.estado !== 'cancelada') {
        const mensajes: Record<string, string> = {
          pendiente: 'Cancelación pendiente de aceptación. El documento permanece Timbrado.',
          rechazada: 'La cancelación fue rechazada. El documento permanece Timbrado.',
          error: 'El CFDI permanece activo. El documento permanece Timbrado.',
          requiere_reconciliacion: 'La respuesta del PAC es ambigua. El documento permanece Timbrado y requiere reconciliación.',
        };
        return {
          ok: false,
          documento_id: input.documentoId,
          estatus_documento: 'Timbrado',
          cancelacion_estado: cancelacion.estado,
          proveedor_status: cancelacion.proveedorStatus,
          intento_id: intentoId,
          message: mensajes[cancelacion.estado] || 'La cancelación no fue confirmada.',
        };
      }
    } catch (error: any) {
      const failure = respuestaPacRecibida && !error?.requestDispatched
        ? {
            estado: 'requiere_reconciliacion' as const,
            code: 'CANCELACION_AUDIT_PERSISTENCE_ERROR',
            message: 'Facturama respondió, pero no fue posible persistir con certeza el resultado. La cancelación requiere conciliación.',
            pacResponse: null,
          }
        : clasificarFalloCancelacionPac(error);
      try {
        await actualizarEstadoIntento(intentoId, failure.estado, {
          errorExternoMensaje: failure.message.slice(0, 500),
          errorCodigo: failure.code,
          mensajeSanitizado: failure.message,
          facturamaRespuesta: failure.pacResponse,
        });
        await pool.query(
          `UPDATE public.documentos_cfdi
              SET cancelacion_estado = $2::varchar,
                  cancelacion_proveedor_status = NULL,
                  cancelacion_ultima_consulta_at = NOW()
            WHERE documento_id = $1`,
          [input.documentoId, failure.estado]
        );
      } catch (persistenceError) {
        // Si falla la bitácora después de haber enviado el DELETE, el estado
        // necesariamente es incierto. Esta consulta deliberadamente simple
        // evita volver a usar la sentencia que haya fallado.
        await pool.query(
          `UPDATE documentos_cancelacion_intentos
              SET estado = 'requiere_reconciliacion',
                  error_codigo = 'CANCELACION_AUDIT_PERSISTENCE_ERROR',
                  mensaje_sanitizado = 'La solicitud pudo llegar al PAC, pero no se pudo persistir su resultado. Requiere conciliación.',
                  updated_at = NOW()
            WHERE id = $1`,
          [intentoId]
        );
        console.error('[CANCELACION] No se pudo persistir el resultado PAC', {
          intentoId,
          documentoId: input.documentoId,
          code: (persistenceError as any)?.code || null,
        });
      }
      throw new DocumentoCancelValidationError(
        failure.message,
        { intento_id: intentoId, estado_reconciliacion: failure.estado },
        failure.code,
        failure.estado === 'requiere_reconciliacion' ? 409 : 422
      );
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
      acuse_xml: acuseXml,
      motivo_cancelacion: motivoCancelacion,
      motivo_sat: motivoSat,
      uuid_sustitucion: uuidSustitucion,
    },
    documentoId: input.documentoId,
    empresaId: input.empresaId,
    usuarioId: input.usuarioId,
  });
}

export async function reconciliarCancelacionDocumentoService(input: {
  documentoId: number;
  empresaId: number;
  usuarioId: number;
}): Promise<{
  documento_id: number;
  intento_id: number;
  cancelacion_estado: CfdiCancelacionEstado;
  proveedor_status: string | null;
  estatus_documento: string;
  message: string;
}> {
  const { rows } = await pool.query<{
    intento_id: number;
    estado: string;
    pac_id: string | null;
    modalidad: CfdiPacModalidad | null;
    cfdi_uuid: string | null;
    motivo_cancelacion: string | null;
    motivo_sat: string | null;
    uuid_sustitucion: string | null;
    acuse_xml: string | null;
    estatus_documento: string;
    cfdi_pac_config_id: number | null;
    documento_cfdi_pac_config_id: number | null;
    pac: string | null;
    pac_modalidad: CfdiPacModalidad | null;
  }>(
    `SELECT i.id AS intento_id, i.estado, i.pac_id, i.modalidad, i.cfdi_uuid,
            i.motivo_cancelacion, i.motivo_sat, i.uuid_sustitucion, i.acuse_xml,
            d.estatus_documento, i.cfdi_pac_config_id,
            dc.cfdi_pac_config_id AS documento_cfdi_pac_config_id,
            dc.pac, dc.pac_modalidad
       FROM documentos_cancelacion_intentos i
       JOIN documentos d
         ON d.id = i.documento_id
        AND d.empresa_id = i.empresa_id
       LEFT JOIN documentos_cfdi dc ON dc.documento_id = d.id
      WHERE i.documento_id = $1
        AND i.empresa_id = $2
        AND i.estado IN ('iniciado', 'solicitada', 'pendiente', 'requiere_reconciliacion')
      ORDER BY i.created_at DESC, i.id DESC
      LIMIT 1`,
    [input.documentoId, input.empresaId]
  );
  const intento = rows[0];
  if (!intento) {
    throw new DocumentoCancelValidationError(
      'No existe una solicitud de cancelación activa para reconciliar.',
      undefined,
      'CANCELACION_SIN_INTENTO_ACTIVO',
      409
    );
  }
  if (!intento.pac_id || !intento.modalidad) {
    throw new DocumentoCancelValidationError(
      'El intento no tiene identidad PAC suficiente para consultar su estado.',
      { intento_id: Number(intento.intento_id) },
      'CANCELACION_IDENTIDAD_PAC_INCOMPLETA',
      409
    );
  }

  const facturama = await FacturamaClient.forHistorical({
    empresaId: input.empresaId,
    configId: intento.cfdi_pac_config_id ?? intento.documento_cfdi_pac_config_id,
    pac: intento.pac,
    modalidad: intento.pac_modalidad ?? intento.modalidad,
  });
  let consulta;
  try {
    consulta = await consultarEstadoCancelacionPac(facturama, {
      pacId: intento.pac_id,
      modalidad: intento.modalidad,
    });
  } catch (error: any) {
    const code = String(error?.response?.status || error?.code || 'PAC_STATUS_QUERY_ERROR');
    const message = 'No fue posible confirmar el estado fiscal; requiere conciliación.';
    await actualizarEstadoIntento(Number(intento.intento_id), 'requiere_reconciliacion', {
      errorCodigo: code,
      errorExternoMensaje: message,
      mensajeSanitizado: message,
      incrementarConsulta: true,
    });
    await pool.query(
      `UPDATE documentos_cfdi
          SET cancelacion_estado = 'requiere_reconciliacion',
              cancelacion_ultima_consulta_at = NOW()
        WHERE documento_id = $1`,
      [input.documentoId]
    );
    return {
      documento_id: input.documentoId,
      intento_id: Number(intento.intento_id),
      cancelacion_estado: 'requiere_reconciliacion',
      proveedor_status: null,
      estatus_documento: intento.estatus_documento,
      message,
    };
  }

  const estado = consulta.estado;
  const respuestaSanitizada = {
    Status: consulta.proveedorStatus,
    HttpStatus: consulta.httpStatus,
    Endpoint: consulta.endpoint,
    Method: 'GET',
  };
  await actualizarEstadoIntento(Number(intento.intento_id), estado, {
    proveedorStatus: consulta.proveedorStatus,
    facturamaRespuesta: respuestaSanitizada,
    errorCodigo: null,
    mensajeSanitizado: `Consulta GET de reconciliación: ${consulta.proveedorStatus || estado}.`,
    incrementarConsulta: true,
  });
  await pool.query(
    `UPDATE documentos_cfdi
        SET cancelacion_estado = $2::varchar,
            cancelacion_proveedor_status = $3::varchar,
            cancelacion_ultima_consulta_at = NOW()
      WHERE documento_id = $1`,
    [input.documentoId, estado, consulta.proveedorStatus]
  );

  if (estado === 'cancelada') {
    const result = await ejecutarCancelacionInterna({
      intento: {
        id: Number(intento.intento_id),
        cfdi_uuid: intento.cfdi_uuid,
        motivo_cancelacion: intento.motivo_cancelacion,
        motivo_sat: intento.motivo_sat,
        uuid_sustitucion: intento.uuid_sustitucion,
        acuse_xml: intento.acuse_xml,
      },
      documentoId: input.documentoId,
      empresaId: input.empresaId,
      usuarioId: input.usuarioId,
    });
    return {
      documento_id: input.documentoId,
      intento_id: Number(intento.intento_id),
      cancelacion_estado: 'cancelada',
      proveedor_status: consulta.proveedorStatus,
      estatus_documento: result.estatus_documento,
      message: 'Facturama confirmó la cancelación del CFDI.',
    };
  }

  const messages: Record<CfdiCancelacionEstado, string> = {
    no_solicitada: 'Facturama no reporta una solicitud de cancelación.',
    solicitada: 'La cancelación continúa solicitada.',
    pendiente: 'La cancelación sigue pendiente.',
    cancelada: 'Facturama confirmó la cancelación del CFDI.',
    rechazada: 'Facturama reporta que la cancelación fue rechazada.',
    error: 'Facturama reporta el CFDI vigente y sin cancelación confirmada.',
    requiere_reconciliacion: 'La consulta no permitió determinar el estado; requiere conciliación.',
  };
  return {
    documento_id: input.documentoId,
    intento_id: Number(intento.intento_id),
    cancelacion_estado: estado,
    proveedor_status: consulta.proveedorStatus,
    estatus_documento: intento.estatus_documento,
    message: messages[estado],
  };
}
