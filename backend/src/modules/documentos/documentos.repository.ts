import pool from '../../config/database';
import type { PoolClient } from 'pg';
import type { TipoDocumento } from '../../types/documentos';
import type { TratamientoImpuestos } from '../impuestos/impuestos.types';
import {
  normalizarEstadoSeguimientoCotizacion,
  sanitizarCamposCotizacion,
} from './cotizacion-status';
import { obtenerOCrearProductoTecnicoNcComercialRepository } from '../productos/productos.repository';
import { reservarNumeroParaSerieExistente, resolverSerieDocumento, resolverYReservarSerieDocumento } from './series-documento.service';
import { DocumentoDeleteValidationError } from './documentos-delete.service';
import { sanitizarRichTextBasico } from '../../utils/richTextSanitize';

function sanitizarObservacionesPartida(observaciones: unknown): string | null {
  return typeof observaciones === 'string' && observaciones
    ? sanitizarRichTextBasico(observaciones)
    : null;
}

function normalizarCamposFiscalesSat(data: Record<string, any>): void {
  if (Object.prototype.hasOwnProperty.call(data, 'rfc_receptor')) {
    const rfc = String(data.rfc_receptor || '').toUpperCase();
    if (rfc === 'XAXX010101000' || rfc === 'XEXX010101000') {
      data.regimen_fiscal_receptor = '616';
      data.uso_cfdi = 'S01';
    }
  }
  if (Object.prototype.hasOwnProperty.call(data, 'metodo_pago')) {
    if (String(data.metodo_pago || '').toUpperCase() === 'PPD') {
      data.forma_pago = '99';
    }
  }
}

export type Documento = {
  id: number;
  empresa_id: number;
  tipo_documento: TipoDocumento;
  motivo_nc?: 'devolucion' | 'bonificacion' | 'otro' | null;
  concepto_id?: number | null;
  serie: string | null;
  numero: number | null;
  serie_externa?: string | null;
  numero_externo?: number | null;
  documento_origen_id?: number | null;
  oportunidad_id?: number | null;
  fecha_documento: string;
  contacto_principal_id: number | null;
  agente_id?: number | null;
  tipo_cambio?: number | null;
  finanzas_operacion_id?: number | null;
  subtotal: number;
  descuento_global?: number;
  descuento?: number;
  iva: number;
  total: number;
  estatus_documento: string;
  moneda: string | null;
  observaciones?: string | null;
  usuario_creacion_id?: number | null;
  producto_resumen?: string | null;
  estado_seguimiento?: string | null;
  comentario_seguimiento?: string | null;
};

export type Partida = {
  id: number;
  documento_id: number;
  producto_id: number | null;
  descripcion_alterna: string | null;
  cantidad: number;
  precio_unitario: number;
  precio_lista_id?: number | null;
  precio_editado_manual?: boolean;
  precio_origen?: string | null;
  descuento?: number;
  descuento_tipo?: 'porcentaje' | 'monto';
  descuento_monto?: number;
  subtotal_partida: number;
  total_partida: number;
  es_parte_oportunidad?: boolean;
  archivo_imagen_1?: string | null;
  producto_archivo_id?: number | null;
  producto_descripcion?: string | null;
  producto_clave?: string | null;
  observaciones?: string | null;
  impuestos?: Array<{
    impuesto_id: string;
    nombre?: string | null;
    tipo?: string | null;
    tasa: number;
    base?: number | null;
    monto: number;
  }>;
};

const CAMPOS_DOCUMENTO = [
  'serie',
  'numero',
  'serie_externa',
  'numero_externo',
  'fecha_documento',
  'fecha_vencimiento',
  'documento_origen_id',
  'oportunidad_id',
  'contacto_principal_id',
  'motivo_nc',
  'concepto_id',
  'rfc_receptor',
  'nombre_receptor',
  'regimen_fiscal_receptor',
  'uso_cfdi',
  'forma_pago',
  'metodo_pago',
  'codigo_postal_receptor',
  'moneda',
  'tipo_cambio',
  'finanzas_operacion_id',
  'observaciones',
  'producto_resumen',
  'estado_seguimiento',
  'comentario_seguimiento',
  'subtotal',
  'descuento_global',
  'descuento',
  'iva',
  'total',
  'agente_id',
  'estatus_documento',
  'usuario_creacion_id',
  'tratamiento_impuestos',
] as const;

const SEGUIMIENTO_CAMPOS = ['producto_resumen', 'estado_seguimiento', 'comentario_seguimiento'] as const;

let seguimientoColumnsPresent: boolean | null = null;

const ESTADOS_BLOQUEADOS_REVERSION_DESDE_CONVERTIDA = new Set([
  'abierta',
  'pausada',
  'perdida',
  'cancelada',
  'no seleccionada',
]);

type ReversionEstadoConvertidaScope = 'cotizacion' | 'oportunidad';

type ValidarReversionEstadoConvertidaOptions = {
  scope: ReversionEstadoConvertidaScope;
  entityId: number;
  empresaId: number;
  estadoActual: unknown;
  estadoNuevo: unknown;
  client?: PoolClient;
};

function debeBloquearReversionDesdeConvertida(estadoActual: unknown, estadoNuevo: unknown) {
  const actualNormalizado = normalizarEstadoSeguimientoCotizacion(estadoActual);
  const nuevoNormalizado = normalizarEstadoSeguimientoCotizacion(estadoNuevo);

  return actualNormalizado === 'convertida'
    && !!nuevoNormalizado
    && nuevoNormalizado !== 'convertida'
    && ESTADOS_BLOQUEADOS_REVERSION_DESDE_CONVERTIDA.has(nuevoNormalizado);
}

function estatusDocumentoEsInactivo(estatusDocumento: unknown) {
  const estatusNormalizado = String(estatusDocumento ?? '').trim().toLowerCase();
  return estatusNormalizado === 'cancelado' || estatusNormalizado === 'cancelada';
}

function assertFacturaCompraNoEmitida(tipo_documento: unknown, estatus_documento: unknown) {
  if (String(tipo_documento ?? '').trim().toLowerCase() !== 'factura_compra') return;
  const estatus = String(estatus_documento ?? '').trim().toLowerCase();
  if (estatus === 'emitido' || estatus === 'enviado') {
    throw new Error('VALIDATION_ERROR: La factura de compra está emitida y no puede modificarse. Para revertir sus efectos, utilice la cancelación.');
  }
}

async function assertOrdenCompraModificable(
  documentoId: number,
  empresaId: number,
  tipo_documento: unknown,
  executor: Pick<import('pg').PoolClient, 'query'>
) {
  if (String(tipo_documento ?? '').trim().toLowerCase() !== 'orden_compra') return;

  const { rows } = await executor.query<{ existe: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM documentos d
        WHERE d.empresa_id = $1
          AND d.documento_origen_id = $2
          AND LOWER(TRIM(COALESCE(d.estatus_documento, ''))) NOT IN ('cancelado', 'cancelada')
       UNION ALL
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
    throw new Error('VALIDATION_ERROR: La orden de compra tiene documentos derivados activos y no puede modificarse. Cancele los documentos derivados primero.');
  }
}

/**
 * Una factura solo puede eliminarse (DELETE físico) si nunca tuvo efecto fiscal ni
 * financiero: sin timbrar y sin pagos aplicados. Si ya está timbrada, debe seguir el
 * flujo formal de cancelación de CFDI en lugar de eliminarse.
 */
async function assertFacturaEliminable(
  documentoId: number,
  empresaId: number,
  tipo_documento: unknown,
  estatus_documento: unknown,
  executor: Pick<import('pg').PoolClient, 'query'>
) {
  if (String(tipo_documento ?? '').trim().toLowerCase() !== 'factura') return;

  if (String(estatus_documento ?? '').trim().toLowerCase() === 'timbrado') {
    throw new DocumentoDeleteValidationError(
      'No se puede eliminar una factura timbrada. Utilice la cancelación fiscal (CFDI) en su lugar.'
    );
  }

  const { rows: cfdiRows } = await executor.query<{ uuid: string | null }>(
    `SELECT uuid FROM documentos_cfdi WHERE documento_id = $1 LIMIT 1`,
    [documentoId]
  );
  if (cfdiRows[0]?.uuid) {
    throw new DocumentoDeleteValidationError(
      'No se puede eliminar una factura timbrada. Utilice la cancelación fiscal (CFDI) en su lugar.'
    );
  }

  const { rows: aplicacionesRows } = await executor.query<{ existe: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM aplicaciones_saldo a
        WHERE a.empresa_id = $1
          AND (a.documento_origen_id = $2 OR a.documento_destino_id = $2)
     ) AS existe`,
    [empresaId, documentoId]
  );
  if (Boolean(aplicacionesRows[0]?.existe)) {
    throw new DocumentoDeleteValidationError(
      'No se puede eliminar la factura porque tiene pagos aplicados.'
    );
  }
}

/**
 * Devuelve true si el documento tiene un intento de cancelación en estado
 * 'externo_ok_interno_pendiente', es decir: Facturama ya canceló el CFDI pero
 * la transacción interna aún no se completó. El documento debe ser de solo lectura
 * en este estado hasta que se resuelva el intento.
 */
async function documentoTieneCancelacionPendiente(
  documentoId: number,
  empresaId: number,
  executor: Pick<import('pg').PoolClient, 'query'>
): Promise<boolean> {
  const { rows } = await executor.query<{ pendiente: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM public.documentos_cancelacion_intentos
        WHERE documento_id = $1
          AND empresa_id   = $2
          AND estado       = 'externo_ok_interno_pendiente'
        LIMIT 1
     ) AS pendiente`,
    [documentoId, empresaId]
  );
  return Boolean(rows[0]?.pendiente);
}

async function cotizacionTieneFacturaActivaDerivada(
  cotizacionId: number,
  empresaId: number,
  client?: PoolClient
) {
  const executor = client ?? pool;
  const { rows } = await executor.query<{ has_active_invoice: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM documentos d
        WHERE d.empresa_id = $1
          AND d.documento_origen_id = $2
          AND LOWER(COALESCE(d.tipo_documento, '')) = 'factura'
          AND LOWER(TRIM(COALESCE(d.estatus_documento, ''))) NOT IN ('cancelado', 'cancelada')
     ) AS has_active_invoice`,
    [empresaId, cotizacionId]
  );

  return Boolean(rows[0]?.has_active_invoice);
}

async function oportunidadTieneFacturaActivaDerivada(
  oportunidadId: number,
  empresaId: number,
  client?: PoolClient
) {
  const executor = client ?? pool;
  const { rows } = await executor.query<{ has_active_invoice: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM documentos factura
         JOIN documentos cotizacion
           ON cotizacion.id = factura.documento_origen_id
          AND cotizacion.empresa_id = factura.empresa_id
        WHERE factura.empresa_id = $1
          AND cotizacion.oportunidad_id = $2
          AND LOWER(COALESCE(factura.tipo_documento, '')) = 'factura'
          AND LOWER(COALESCE(cotizacion.tipo_documento, '')) = 'cotizacion'
          AND LOWER(TRIM(COALESCE(factura.estatus_documento, ''))) NOT IN ('cancelado', 'cancelada')
     ) AS has_active_invoice`,
    [empresaId, oportunidadId]
  );

  return Boolean(rows[0]?.has_active_invoice);
}

async function revertirConversionComercialSiYaNoHayFacturasActivas(
  cotizacionId: number | null | undefined,
  empresaId: number,
  client?: PoolClient
) {
  if (!cotizacionId) {
    return;
  }

  const executor = client ?? pool;
  const { rows } = await executor.query<{ id: number; oportunidad_id: number | null }>(
    `SELECT id, oportunidad_id
       FROM documentos
      WHERE id = $1
        AND empresa_id = $2
        AND LOWER(COALESCE(tipo_documento, '')) = 'cotizacion'
      LIMIT 1`,
    [cotizacionId, empresaId]
  );

  const cotizacion = rows[0];
  if (!cotizacion) {
    return;
  }

  const cotizacionSigueConvertida = await cotizacionTieneFacturaActivaDerivada(cotizacion.id, empresaId, client);
  if (!cotizacionSigueConvertida) {
    await executor.query(
      `UPDATE documentos
          SET estado_seguimiento = 'abierta'
        WHERE id = $1
          AND empresa_id = $2
          AND LOWER(COALESCE(tipo_documento, '')) = 'cotizacion'
          AND LOWER(COALESCE(estado_seguimiento, '')) = 'convertida'`,
      [cotizacion.id, empresaId]
    );
  }

  if (!cotizacion.oportunidad_id) {
    return;
  }

  const oportunidadSigueConvertida = await oportunidadTieneFacturaActivaDerivada(cotizacion.oportunidad_id, empresaId, client);
  if (!oportunidadSigueConvertida) {
    await executor.query(
      `UPDATE crm.oportunidades_venta
          SET estatus = 'abierta',
              updated_at = NOW()
        WHERE id = $1
          AND empresa_id = $2
          AND LOWER(COALESCE(estatus, '')) = 'convertida'`,
      [cotizacion.oportunidad_id, empresaId]
    );
  }
}

export async function validarReversionEstadoConvertidaConFacturacion(
  options: ValidarReversionEstadoConvertidaOptions
) {
  if (!debeBloquearReversionDesdeConvertida(options.estadoActual, options.estadoNuevo)) {
    return;
  }

  const estadoDestino = normalizarEstadoSeguimientoCotizacion(options.estadoNuevo) ?? String(options.estadoNuevo ?? '').trim();
  const tieneFacturaActiva = options.scope === 'cotizacion'
    ? await cotizacionTieneFacturaActivaDerivada(options.entityId, options.empresaId, options.client)
    : await oportunidadTieneFacturaActivaDerivada(options.entityId, options.empresaId, options.client);

  if (!tieneFacturaActiva) {
    return;
  }

  if (options.scope === 'cotizacion') {
    throw new Error(
      `VALIDATION_ERROR: No se puede cambiar la cotización a "${estadoDestino}" porque ya tiene una factura activa generada.`
    );
  }

  throw new Error(
    `VALIDATION_ERROR: No se puede cambiar la oportunidad a "${estadoDestino}" porque ya existe una factura activa generada desde una cotización de esta oportunidad.`
  );
}

async function ensureSeguimientoColumns(client?: PoolClient) {
  if (seguimientoColumnsPresent !== null) return seguimientoColumnsPresent;
  const executor = client ?? (await pool.connect());
  try {
    const { rows } = await executor.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_name = 'documentos'
          AND column_name = ANY($1::text[])`,
      [SEGUIMIENTO_CAMPOS]
    );
    seguimientoColumnsPresent = rows.length === SEGUIMIENTO_CAMPOS.length;
    return seguimientoColumnsPresent;
  } catch (err) {
    console.warn('[DOCUMENTOS] No se pudo verificar columnas de seguimiento, se asume ausentes', err);
    seguimientoColumnsPresent = false;
    return false;
  } finally {
    if (!client) executor.release();
  }
}

type DocumentoInput = Omit<Partial<Record<typeof CAMPOS_DOCUMENTO[number], any>>, 'tratamiento_impuestos'> & {
  tipo_documento?: TipoDocumento;
  tratamiento_impuestos?: TratamientoImpuestos;
};

type ActualizarDocumentoOptions = {
  skipOportunidadStatusSync?: boolean;
};

export type PartidaInput = {
  producto_id?: number | null;
  descripcion_alterna?: string | null;
  cantidad?: number | null;
  precio_unitario?: number | null;
  precio_lista_id?: number | null;
  precio_editado_manual?: boolean;
  precio_origen?: string | null;
  descuento?: number | null;
  descuento_tipo?: 'porcentaje' | 'monto' | null;
  descuento_monto?: number | null;
  subtotal_partida?: number | null;
  total_partida?: number | null;
  es_parte_oportunidad?: boolean;
  archivo_imagen_1?: string | null;
  producto_archivo_id?: number | null;
  observaciones?: string | null;
};

/**
 * Normaliza descuento_tipo/descuento/descuento_monto de una partida:
 * - descuento_tipo sólo puede ser 'porcentaje' o 'monto' (default 'porcentaje').
 * - Sólo el campo correspondiente al tipo activo se persiste con valor; el otro queda en 0
 *   para evitar que ambos descuentos se apliquen a la vez.
 * - descuento_monto se acota entre 0 y el importe bruto (cantidad * precio_unitario).
 * - descuento (porcentaje) se acota entre 0 y 100.
 */
function normalizarDescuentoPartida(data: PartidaInput): { descuento: number; descuento_tipo: 'porcentaje' | 'monto'; descuento_monto: number } {
  const esMonto = String(data.descuento_tipo ?? 'porcentaje').toLowerCase() === 'monto';
  const cantidad = Number(data.cantidad ?? 0) || 0;
  const precioUnitario = Number(data.precio_unitario ?? 0) || 0;
  const importeBruto = cantidad * precioUnitario;

  if (esMonto) {
    const montoCrudo = Number(data.descuento_monto ?? 0) || 0;
    const descuentoMonto = Math.min(Math.max(montoCrudo, 0), Math.max(importeBruto, 0));
    return { descuento: 0, descuento_tipo: 'monto', descuento_monto: Number(descuentoMonto.toFixed(2)) };
  }

  const porcentajeCrudo = Number(data.descuento ?? 0) || 0;
  const descuento = Math.min(Math.max(porcentajeCrudo, 0), 100);
  return { descuento, descuento_tipo: 'porcentaje', descuento_monto: 0 };
}

const normalizarImagenPartida = (data: PartidaInput, permiteImagen: boolean) => {
  if (!permiteImagen) {
    return {
      archivo_imagen_1: null as string | null,
      producto_archivo_id: null as number | null,
    };
  }

  const archivoImagen = typeof data.archivo_imagen_1 === 'string' && data.archivo_imagen_1.trim()
    ? data.archivo_imagen_1.trim()
    : null;

  const productoArchivoId = Number.isFinite(Number(data.producto_archivo_id))
    ? Number(data.producto_archivo_id)
    : null;

  if (archivoImagen) {
    return {
      archivo_imagen_1: archivoImagen,
      producto_archivo_id: null,
    };
  }

  return {
    archivo_imagen_1: null,
    producto_archivo_id: productoArchivoId,
  };
};

export async function listarDocumentosRepository(
  tipoDocumento: TipoDocumento,
  empresaId: number,
  search?: string | null,
  agenteIdForzado?: number | null
) {
  const esFactura = ['factura', 'factura_compra', 'nota_credito', 'nota_credito_compra'].includes((tipoDocumento || '').toLowerCase());
  const esCotizacion = (tipoDocumento || '').toLowerCase() === 'cotizacion';
  const selectSaldo = esFactura
    ? `CASE WHEN LOWER(TRIM(COALESCE(d.estatus_documento, ''))) IN ('cancelado', 'cancelada') THEN 0 ELSE COALESCE(ds.saldo, 0) END AS saldo`
    : 'NULL::numeric AS saldo';
  const joinSaldo = esFactura ? 'LEFT JOIN documentos_saldo ds ON ds.id = d.id AND ds.empresa_id = d.empresa_id' : '';
  const selectDeleteWarning = esCotizacion
    ? `CASE
         WHEN o.id IS NOT NULL
          AND o.cotizacion_principal_id = d.id
          AND COALESCE(oc.total_cotizaciones, 0) = 1
         THEN true
         ELSE false
       END AS eliminara_oportunidad,`
    : 'false AS eliminara_oportunidad,';
  const joinDeleteWarning = esCotizacion
    ? `LEFT JOIN crm.oportunidades_venta o
         ON o.id = d.oportunidad_id
        AND o.empresa_id = d.empresa_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS total_cotizaciones
           FROM documentos dc
          WHERE dc.empresa_id = d.empresa_id
            AND LOWER(dc.tipo_documento) = 'cotizacion'
            AND dc.oportunidad_id = d.oportunidad_id
       ) oc ON TRUE`
    : '';
  const hasSeguimiento = await ensureSeguimientoColumns();

  const selectSeguimiento = hasSeguimiento
    ? `d.producto_resumen,
       d.estado_seguimiento,
       d.comentario_seguimiento,`
    : `NULL::text AS producto_resumen,
       NULL::text AS estado_seguimiento,
       NULL::text AS comentario_seguimiento,`;

  const searchTerm = String(search ?? '').trim();
  const values: Array<number | string> = [empresaId, tipoDocumento.toLowerCase()];
  const whereClauses = ['d.empresa_id = $1', 'LOWER(d.tipo_documento) = $2'];

  if (searchTerm) {
    values.push(`%${searchTerm}%`);
    const searchIdx = values.length;
    const saldoSearchExpr = esFactura ? 'COALESCE(ds.saldo, 0)::text' : "''";

    whereClauses.push(`(
      CONCAT(COALESCE(d.serie, ''), COALESCE(d.numero::text, '')) ILIKE $${searchIdx}
      OR COALESCE(d.serie, '') ILIKE $${searchIdx}
      OR COALESCE(d.numero::text, '') ILIKE $${searchIdx}
      OR COALESCE(c.nombre, '') ILIKE $${searchIdx}
      OR COALESCE(c.email, '') ILIKE $${searchIdx}
      OR COALESCE(c.telefono, '') ILIKE $${searchIdx}
      OR COALESCE(c.telefono_secundario, '') ILIKE $${searchIdx}
      OR COALESCE(cdf.rfc, c.rfc, d.rfc_receptor, '') ILIKE $${searchIdx}
      OR COALESCE(d.nombre_receptor, '') ILIKE $${searchIdx}
      OR COALESCE(con.nombre_concepto, '') ILIKE $${searchIdx}
      OR COALESCE(d.subtotal::text, '') ILIKE $${searchIdx}
      OR COALESCE(d.total::text, '') ILIKE $${searchIdx}
      OR ${saldoSearchExpr} ILIKE $${searchIdx}
      OR COALESCE(d.fecha_documento::text, '') ILIKE $${searchIdx}
      OR COALESCE(d.estatus_documento, '') ILIKE $${searchIdx}
      OR COALESCE(d.producto_resumen, '') ILIKE $${searchIdx}
      OR EXISTS (
        SELECT 1
          FROM documentos_partidas dp
          LEFT JOIN productos p ON p.id = dp.producto_id
         WHERE dp.documento_id = d.id
           AND (
             COALESCE(p.clave, '') ILIKE $${searchIdx}
             OR COALESCE(p.descripcion, '') ILIKE $${searchIdx}
             OR COALESCE(dp.descripcion_alterna, '') ILIKE $${searchIdx}
             OR COALESCE(dp.observaciones, '') ILIKE $${searchIdx}
             OR COALESCE(dp.comentarios_internos, '') ILIKE $${searchIdx}
           )
      )
    )`);
  }

  if (agenteIdForzado) {
    values.push(agenteIdForzado);
    whereClauses.push(`d.agente_id = $${values.length}`);
  }

  const query = `
    SELECT
      d.id,
      d.motivo_nc,
      d.serie,
      d.numero,
      d.serie_externa,
      d.numero_externo,
      d.fecha_documento,
      d.contacto_principal_id,
      d.agente_id,
      c.nombre AS nombre_cliente,
      c.email AS contacto_email,
      c.telefono AS cliente_telefono,
      ${selectSeguimiento}
      d.subtotal,
      d.iva,
      d.total,
      d.tratamiento_impuestos,
      ${selectDeleteWarning}
      d.estatus_documento,
      ${selectSaldo}
    FROM documentos d
    ${joinSaldo}
    ${joinDeleteWarning}
    LEFT JOIN contactos c ON d.contacto_principal_id = c.id
    LEFT JOIN contactos_datos_fiscales cdf ON cdf.contacto_id = c.id
    LEFT JOIN conceptos con ON con.id = d.concepto_id AND con.empresa_id = d.empresa_id
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY d.fecha_documento DESC, d.id DESC
  `;
  const { rows } = await pool.query(query, values);
  return rows;
}

type DocumentosAdditionalFilters = {
  soloPendientes?: boolean;
  quickFilter?: string;
  clienteId?: number | null;
  agenteId?: number | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  montoMin?: number | null;
  montoMax?: number | null;
};

export async function listarDocumentosRepositoryPaginado(
  tipoDocumento: TipoDocumento,
  empresaId: number,
  pagination: { page: number; limit: number },
  search?: string | null,
  additionalFilters?: DocumentosAdditionalFilters,
  agenteIdForzado?: number | null
): Promise<{ data: any[]; total: number }> {
  const esFactura = ['factura', 'factura_compra', 'nota_credito', 'nota_credito_compra'].includes((tipoDocumento || '').toLowerCase());
  const esCotizacion = (tipoDocumento || '').toLowerCase() === 'cotizacion';
  const esOrdenCompra = (tipoDocumento || '').toLowerCase() === 'orden_compra';
  const selectSaldo = esFactura
    ? `CASE WHEN LOWER(TRIM(COALESCE(d.estatus_documento, ''))) IN ('cancelado', 'cancelada') THEN 0 ELSE COALESCE(ds.saldo, 0) END AS saldo`
    : 'NULL::numeric AS saldo';
  const joinSaldo = esFactura ? 'LEFT JOIN documentos_saldo ds ON ds.id = d.id AND ds.empresa_id = d.empresa_id' : '';
  const selectEstadoRecepcion = esOrdenCompra
    ? `(
         SELECT CASE
           WHEN COALESCE(SUM(
             CASE WHEN LOWER(d_dest.tipo_documento) = 'recepcion'
                   AND LOWER(COALESCE(d_dest.estatus_documento, ''))
                       NOT IN ('cancelado', 'cancelada')
             THEN dpv_sub.cantidad ELSE 0 END
           ), 0) <= 0.000001 THEN 'abierta'
           WHEN COALESCE(SUM(
             CASE WHEN LOWER(d_dest.tipo_documento) = 'recepcion'
                   AND LOWER(COALESCE(d_dest.estatus_documento, ''))
                       NOT IN ('cancelado', 'cancelada')
             THEN dpv_sub.cantidad ELSE 0 END
           ), 0) >= (SELECT COALESCE(SUM(dp2.cantidad), 0) FROM public.documentos_partidas dp2 WHERE dp2.documento_id = d.id) - 0.000001 THEN 'cerrada'
           ELSE 'parcial'
         END
         FROM public.documentos_partidas dp_sub
         LEFT JOIN public.documentos_partidas_vinculos dpv_sub
           ON dpv_sub.documento_origen_id = d.id
          AND dpv_sub.partida_origen_id   = dp_sub.id
         LEFT JOIN public.documentos d_dest
           ON d_dest.id = dpv_sub.documento_destino_id
         WHERE dp_sub.documento_id = d.id
       ) AS estado_recepcion`
    : `NULL::text AS estado_recepcion`;
  const hasSeguimiento = await ensureSeguimientoColumns();

  const selectSeguimiento = hasSeguimiento
    ? `d.producto_resumen,
       d.estado_seguimiento,
       d.comentario_seguimiento,`
    : `NULL::text AS producto_resumen,
       NULL::text AS estado_seguimiento,
       NULL::text AS comentario_seguimiento,`;

  const values: Array<number | string> = [empresaId, tipoDocumento.toLowerCase()];
  const whereClauses = ['d.empresa_id = $1', 'LOWER(d.tipo_documento) = $2'];

  const searchTerm = String(search ?? '').trim();
  if (searchTerm) {
    values.push(`%${searchTerm}%`);
    const searchIdx = values.length;
    const saldoSearchExpr = esFactura ? 'COALESCE(ds.saldo, 0)::text' : "''";
    whereClauses.push(`(
      CONCAT(COALESCE(d.serie, ''), COALESCE(d.numero::text, '')) ILIKE $${searchIdx}
      OR COALESCE(d.serie, '') ILIKE $${searchIdx}
      OR COALESCE(d.numero::text, '') ILIKE $${searchIdx}
      OR COALESCE(c.nombre, '') ILIKE $${searchIdx}
      OR COALESCE(c.email, '') ILIKE $${searchIdx}
      OR COALESCE(c.telefono, '') ILIKE $${searchIdx}
      OR COALESCE(c.telefono_secundario, '') ILIKE $${searchIdx}
      OR COALESCE(cdf.rfc, c.rfc, d.rfc_receptor, '') ILIKE $${searchIdx}
      OR COALESCE(d.nombre_receptor, '') ILIKE $${searchIdx}
      OR COALESCE(con.nombre_concepto, '') ILIKE $${searchIdx}
      OR COALESCE(d.subtotal::text, '') ILIKE $${searchIdx}
      OR COALESCE(d.total::text, '') ILIKE $${searchIdx}
      OR ${saldoSearchExpr} ILIKE $${searchIdx}
      OR COALESCE(d.fecha_documento::text, '') ILIKE $${searchIdx}
      OR COALESCE(d.estatus_documento, '') ILIKE $${searchIdx}
      OR COALESCE(d.producto_resumen, '') ILIKE $${searchIdx}
      OR EXISTS (
        SELECT 1
          FROM documentos_partidas dp
          LEFT JOIN productos p ON p.id = dp.producto_id
         WHERE dp.documento_id = d.id
           AND (
             COALESCE(p.clave, '') ILIKE $${searchIdx}
             OR COALESCE(p.descripcion, '') ILIKE $${searchIdx}
             OR COALESCE(dp.descripcion_alterna, '') ILIKE $${searchIdx}
             OR COALESCE(dp.observaciones, '') ILIKE $${searchIdx}
             OR COALESCE(dp.comentarios_internos, '') ILIKE $${searchIdx}
           )
      )
    )`);
  }

  if (additionalFilters) {
    const { soloPendientes, quickFilter, clienteId, agenteId, fechaDesde, fechaHasta, montoMin, montoMax } = additionalFilters;

    if (soloPendientes && esFactura) {
      whereClauses.push('COALESCE(ds.saldo, 0) > 0');
    }

    if (quickFilter && quickFilter !== 'todos') {
      values.push(quickFilter.toLowerCase());
      const qfIdx = values.length;
      if (esCotizacion && hasSeguimiento) {
        whereClauses.push(`LOWER(COALESCE(d.estado_seguimiento, 'borrador')) = $${qfIdx}`);
      } else {
        whereClauses.push(`(CASE WHEN LOWER(d.estatus_documento) = 'enviado' THEN 'emitido' ELSE LOWER(COALESCE(d.estatus_documento, 'borrador')) END) = $${qfIdx}`);
      }
    }

    if (clienteId) {
      values.push(Number(clienteId));
      whereClauses.push(`d.contacto_principal_id = $${values.length}`);
    }

    if (agenteId) {
      values.push(Number(agenteId));
      whereClauses.push(`d.agente_id = $${values.length}`);
    }

    if (fechaDesde) {
      values.push(fechaDesde);
      whereClauses.push(`d.fecha_documento::date >= $${values.length}::date`);
    }

    if (fechaHasta) {
      values.push(fechaHasta);
      whereClauses.push(`d.fecha_documento::date <= $${values.length}::date`);
    }

    if (montoMin !== null && montoMin !== undefined && !isNaN(montoMin)) {
      values.push(montoMin);
      whereClauses.push(`d.total >= $${values.length}`);
    }

    if (montoMax !== null && montoMax !== undefined && !isNaN(montoMax)) {
      values.push(montoMax);
      whereClauses.push(`d.total <= $${values.length}`);
    }
  }

  if (agenteIdForzado) {
    values.push(agenteIdForzado);
    whereClauses.push(`d.agente_id = $${values.length}`);
  }

  const offset = (pagination.page - 1) * pagination.limit;
  values.push(pagination.limit, offset);
  const limitIdx = values.length - 1;
  const offsetIdx = values.length;

  const query = `
    SELECT
      d.id,
      d.motivo_nc,
      d.serie,
      d.numero,
      d.serie_externa,
      d.numero_externo,
      d.fecha_documento,
      d.contacto_principal_id,
      d.agente_id,
      d.oportunidad_id,
      c.nombre AS nombre_cliente,
      c.email AS contacto_email,
      c.telefono AS cliente_telefono,
      ${selectSeguimiento}
      d.subtotal,
      d.iva,
      d.total,
      d.tratamiento_impuestos,
      false AS eliminara_oportunidad,
      d.estatus_documento,
      COALESCE(d.estado_autorizacion, 'no_requerida') AS estado_autorizacion,
      ${selectSaldo},
      ${selectEstadoRecepcion},
      COUNT(*) OVER() AS total_count
    FROM documentos d
    ${joinSaldo}
    LEFT JOIN contactos c ON d.contacto_principal_id = c.id
    LEFT JOIN contactos_datos_fiscales cdf ON cdf.contacto_id = c.id
    LEFT JOIN conceptos con ON con.id = d.concepto_id AND con.empresa_id = d.empresa_id
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY d.fecha_documento DESC, d.id DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await pool.query(query, values);
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const data = rows.map((row: any) => {
    const { total_count, ...rest } = row;
    return rest;
  });
  return { data, total };
}

export async function obtenerDocumentoRepository(
  id: number,
  empresaId: number,
  tipoDocumento?: TipoDocumento,
  agenteIdForzado?: number | null
) {
  const executor = pool;
  const params: Array<number | string> = [empresaId, id];
  let condTipo = '';
  if (tipoDocumento) {
    params.push(tipoDocumento);
    condTipo = `AND LOWER(d.tipo_documento) = LOWER($${params.length})`;
  }
  let condAgente = '';
  if (agenteIdForzado) {
    params.push(agenteIdForzado);
    condAgente = `AND d.agente_id = $${params.length}`;
  }
  const docQuery = `
    SELECT
      d.*,
      fo.cuenta_id AS cuenta_financiera_id,
      c.nombre AS cliente_nombre,
      c.nombre_contacto AS cliente_nombre_contacto,
      c.email AS cliente_email,
      c.telefono AS cliente_telefono,
      NULLIF(TRIM(CONCAT_WS(' ', cd.calle, cd.numero_exterior, cd.numero_interior, cd.colonia)), '') AS cliente_direccion,
      NULLIF(TRIM(CONCAT_WS(', ', NULLIF(cd.ciudad, ''), NULLIF(cd.estado, ''), NULLIF(cd.cp, ''))), '') AS cliente_ciudad_estado_cp,
      d.rfc_receptor AS cliente_rfc,
      d.regimen_fiscal_receptor,
      d.uso_cfdi,
      d.forma_pago,
      d.metodo_pago,
      d.codigo_postal_receptor,
      ag.nombre AS agente_nombre
    FROM documentos d
    LEFT JOIN finanzas_operaciones fo ON fo.id = d.finanzas_operacion_id AND fo.empresa_id = d.empresa_id
    LEFT JOIN contactos c ON d.contacto_principal_id = c.id
    LEFT JOIN contactos_domicilios cd ON cd.contacto_id = c.id AND cd.es_principal = true
    LEFT JOIN contactos ag ON ag.id = d.agente_id
    WHERE d.empresa_id = $1 AND d.id = $2
      ${condTipo}
      ${condAgente}
    LIMIT 1
  `;
  console.log('[BACK SQL DEBUG] obtenerDocumento docQuery', docQuery);
  console.log('[BACK SQL DEBUG] obtenerDocumento params', params);
  const { rows: docRows } = await executor.query(docQuery, params);
  const documento = docRows[0];
  if (!documento) return null;

  const partidasQuery = `
    SELECT dp.*, p.descripcion AS producto_descripcion, p.clave AS producto_clave,
           dpv.documento_origen_id,
           dpv.partida_origen_id,
           dpv.cantidad AS cantidad_vinculada
    FROM documentos_partidas dp
    LEFT JOIN productos p ON dp.producto_id = p.id
    LEFT JOIN LATERAL (
      SELECT documento_origen_id, partida_origen_id, cantidad
      FROM documentos_partidas_vinculos
      WHERE partida_destino_id = dp.id
        AND documento_destino_id = dp.documento_id
      ORDER BY id
      LIMIT 1
    ) dpv ON true
    WHERE dp.documento_id = $1
    ORDER BY dp.id
  `;
  console.log('[BACK SQL DEBUG] obtenerDocumento partidasQuery', partidasQuery);
  console.log('[BACK SQL DEBUG] obtenerDocumento partidas params', [id]);
  const { rows: partidas } = await executor.query(partidasQuery, [id]);

  console.log('[BACK IVA DEBUG] obtenerDocumentoRepository partidas raw', partidas.map((p) => ({
    id: p.id,
    producto_id: p.producto_id,
    subtotal_partida: p.subtotal_partida,
    total_partida: p.total_partida,
  })));

  // Obtener impuestos por partida y adjuntarlos sin duplicar filas
  if (partidas.length > 0) {
    const partidaIds = partidas.map((p) => p.id);
    const impuestosQuery = `
      SELECT dpi.partida_id,
             dpi.impuesto_id,
             dpi.tasa,
             dpi.base,
             dpi.monto,
             i.nombre,
             i.tipo
        FROM documentos_partidas_impuestos dpi
        LEFT JOIN impuestos i ON i.id::text = dpi.impuesto_id
       WHERE dpi.partida_id = ANY($1::int[])
       ORDER BY dpi.partida_id, dpi.id
    `;
    console.log('[BACK SQL DEBUG] obtenerDocumento impuestosQuery', impuestosQuery);
    console.log('[BACK SQL DEBUG] obtenerDocumento impuestos params', [partidaIds]);
    const { rows: impuestosRows } = await executor.query(impuestosQuery, [partidaIds]);
  console.log('[BACK IVA DEBUG] obtenerDocumentoRepository impuestosRows', impuestosRows);
    const impuestosPorPartida = impuestosRows.reduce<Record<number, any[]>>((acc, row) => {
      if (!acc[row.partida_id]) acc[row.partida_id] = [];
      acc[row.partida_id].push({
        impuesto_id: row.impuesto_id,
        nombre: row.nombre,
        tipo: row.tipo,
        tasa: Number(row.tasa),
        base: row.base,
        monto: Number(row.monto),
      });
      return acc;
    }, {});

    partidas.forEach((p: any) => {
      p.impuestos = impuestosPorPartida[p.id] ?? [];
    });

    console.log('[BACK IVA DEBUG] obtenerDocumentoRepository partidas con impuestos', partidas.map((p: any) => ({
      id: p.id,
      producto_id: p.producto_id,
      impuestos: p.impuestos,
    })));
  }

  if (String(documento.tipo_documento ?? '').trim().toLowerCase() === 'orden_compra') {
    const { rows: derivadosRows } = await executor.query<{ existe: boolean }>(
      `SELECT EXISTS (
         SELECT 1
           FROM documentos d
          WHERE d.empresa_id = $1
            AND d.documento_origen_id = $2
            AND LOWER(TRIM(COALESCE(d.estatus_documento, ''))) NOT IN ('cancelado', 'cancelada')
         UNION ALL
         SELECT 1
           FROM documentos_partidas_vinculos dpv
           JOIN documentos d_dest ON d_dest.id = dpv.documento_destino_id
          WHERE dpv.documento_origen_id = $2
            AND d_dest.empresa_id = $1
            AND d_dest.id <> $2
            AND LOWER(TRIM(COALESCE(d_dest.estatus_documento, ''))) NOT IN ('cancelado', 'cancelada')
       ) AS existe`,
      [empresaId, id]
    );
    documento.tiene_derivados_activos = Boolean(derivadosRows[0]?.existe);
  }

  const { rows: trazabilidadRows } = await executor.query<{
    es_origen: boolean;
    tipo_documento_relacionado: string | null;
    folio_relacionado: string | null;
  }>(
    `SELECT
       (dpv.documento_origen_id = $1) AS es_origen,
       d_rel.tipo_documento AS tipo_documento_relacionado,
       CASE
         WHEN d_rel.serie IS NOT NULL AND d_rel.numero IS NOT NULL
           THEN d_rel.serie || '-' || LPAD(d_rel.numero::text, 3, '0')
         WHEN d_rel.serie IS NOT NULL THEN d_rel.serie
         WHEN d_rel.numero IS NOT NULL THEN d_rel.numero::text
         ELSE NULL
       END AS folio_relacionado
     FROM documentos_partidas dp
     JOIN documentos_partidas_vinculos dpv
       ON dpv.partida_origen_id = dp.id
       OR dpv.partida_destino_id = dp.id
     LEFT JOIN documentos d_rel ON d_rel.id = CASE
       WHEN dpv.documento_origen_id = $1 THEN dpv.documento_destino_id
       ELSE dpv.documento_origen_id
     END
     WHERE dp.documento_id = $1
     LIMIT 1`,
    [id]
  );
  const trazRow = trazabilidadRows[0] ?? null;
  documento.trazabilidad_activa = trazRow !== null;
  documento.trazabilidad_rol = trazRow ? (trazRow.es_origen ? 'origen' : 'destino') : null;
  documento.documento_trazabilidad = trazRow
    ? { tipo_documento: trazRow.tipo_documento_relacionado ?? '', folio: trazRow.folio_relacionado ?? '' }
    : null;

  return { documento, partidas };
}

export type DocumentoRelacionado = {
  id: number;
  tipo_documento: string;
  serie: string | null;
  numero: number | null;
  fecha_documento: string;
  estatus_documento: string;
  total: number;
  relacion: 'origen' | 'destino';
};

export async function obtenerDocumentosRelacionadosRepository(
  id: number,
  empresaId: number
): Promise<DocumentoRelacionado[]> {
  const MAX_SALTOS = 6;
  const visitados = new Map<number, 'origen' | 'destino'>();
  let frontier = [id];
  let saltos = 0;

  while (frontier.length > 0 && saltos < MAX_SALTOS) {
    const { rows } = await pool.query<{ documento_id: number; relacionado_id: number; relacion: 'origen' | 'destino' }>(
      `SELECT DISTINCT
         dp.documento_id AS documento_id,
         CASE WHEN dpv.documento_origen_id = dp.documento_id THEN dpv.documento_destino_id ELSE dpv.documento_origen_id END AS relacionado_id,
         CASE WHEN dpv.documento_origen_id = dp.documento_id THEN 'destino' ELSE 'origen' END AS relacion
       FROM documentos_partidas dp
       JOIN documentos_partidas_vinculos dpv
         ON dpv.partida_origen_id = dp.id OR dpv.partida_destino_id = dp.id
       WHERE dp.documento_id = ANY($1::int[])`,
      [frontier]
    );

    const siguienteFrontier: number[] = [];
    for (const row of rows) {
      const relacionadoId = Number(row.relacionado_id);
      if (!relacionadoId || relacionadoId === id || visitados.has(relacionadoId)) continue;
      visitados.set(relacionadoId, row.relacion);
      siguienteFrontier.push(relacionadoId);
    }
    frontier = siguienteFrontier;
    saltos += 1;
  }

  if (visitados.size === 0) return [];

  const ids = Array.from(visitados.keys());
  const { rows: documentosRows } = await pool.query<{
    id: number;
    tipo_documento: string;
    serie: string | null;
    numero: number | null;
    fecha_documento: string;
    estatus_documento: string;
    total: string;
  }>(
    `SELECT id, tipo_documento, serie, numero, fecha_documento, estatus_documento, total
       FROM documentos
      WHERE empresa_id = $1 AND id = ANY($2::int[])`,
    [empresaId, ids]
  );

  return documentosRows
    .map((doc) => ({
      id: doc.id,
      tipo_documento: doc.tipo_documento,
      serie: doc.serie,
      numero: doc.numero,
      fecha_documento: doc.fecha_documento,
      estatus_documento: doc.estatus_documento,
      total: Number(doc.total),
      relacion: visitados.get(doc.id) ?? 'destino',
    }))
    .sort((a, b) => a.fecha_documento.localeCompare(b.fecha_documento));
}

export async function crearDocumentoRepository(
  data: DocumentoInput,
  empresaId: number,
  tipoDocumento: TipoDocumento,
  client?: PoolClient
) {
  const executor = client ?? pool;
  const tipoDocumentoNormalizado = (data.tipo_documento || tipoDocumento).toLowerCase() as TipoDocumento;
  const dataConDefaults: DocumentoInput = tipoDocumentoNormalizado === 'cotizacion'
    ? sanitizarCamposCotizacion({ ...data }, { applyDefaults: true })
    : { ...data };

  const estatus = dataConDefaults.estatus_documento || 'Borrador';
  const tipoDocumentoDb = tipoDocumentoNormalizado;

  if (dataConDefaults.tratamiento_impuestos === undefined || dataConDefaults.tratamiento_impuestos === null) {
    throw new Error('VALIDATION_ERROR: El tratamiento de impuestos es obligatorio');
  }

  // Prellenar datos fiscales del contacto en facturas si no vienen en la petición
  if (tipoDocumentoDb === 'factura' && dataConDefaults.contacto_principal_id) {
    try {
      const { rows: contactoRows } = await executor.query(
        `SELECT nombre FROM contactos WHERE id = $1 AND empresa_id = $2 LIMIT 1`,
        [dataConDefaults.contacto_principal_id, empresaId]
      );
      const nombreContacto = contactoRows[0]?.nombre || null;

      const { rows: fiscalesRows } = await executor.query(
        `SELECT COALESCE(cdf.rfc, c.rfc) AS rfc,
                cdf.regimen_fiscal,
                cdf.uso_cfdi,
                cdf.forma_pago,
                cdf.metodo_pago
           FROM contactos c
           LEFT JOIN contactos_datos_fiscales cdf
             ON cdf.contacto_id = c.id
          WHERE c.id = $1
            AND c.empresa_id = $2
          LIMIT 1`,
        [dataConDefaults.contacto_principal_id, empresaId]
      );
      const fiscales = fiscalesRows[0] || {};

      // CP fiscal ahora proviene del domicilio principal (cp_sat)
      const { rows: domicilioRows } = await executor.query(
        `SELECT cp_sat
           FROM contactos_domicilios
          WHERE contacto_id = $1
            AND es_principal = true
          LIMIT 1`,
        [dataConDefaults.contacto_principal_id]
      );
      const cpSat = domicilioRows[0]?.cp_sat ?? null;

      dataConDefaults.rfc_receptor = dataConDefaults.rfc_receptor ?? fiscales.rfc ?? null;
      dataConDefaults.nombre_receptor = dataConDefaults.nombre_receptor ?? nombreContacto ?? null;
      dataConDefaults.regimen_fiscal_receptor = dataConDefaults.regimen_fiscal_receptor ?? fiscales.regimen_fiscal ?? null;
      dataConDefaults.uso_cfdi = dataConDefaults.uso_cfdi ?? fiscales.uso_cfdi ?? null;
      dataConDefaults.forma_pago = dataConDefaults.forma_pago ?? fiscales.forma_pago ?? null;
      dataConDefaults.metodo_pago = dataConDefaults.metodo_pago ?? fiscales.metodo_pago ?? null;
      dataConDefaults.codigo_postal_receptor = dataConDefaults.codigo_postal_receptor ?? cpSat ?? null;
    } catch (err) {
      console.warn('No se pudieron precargar datos fiscales del contacto', err);
    }
  }

  normalizarCamposFiscalesSat(dataConDefaults);

  const serieResuelta = await resolverYReservarSerieDocumento({
    empresaId,
    tipoDocumento: tipoDocumentoDb,
    usuarioId: Number(dataConDefaults.usuario_creacion_id ?? 0) || null,
    tratamientoImpuestos: dataConDefaults.tratamiento_impuestos,
    client: executor,
  });
  const numero = serieResuelta.numero;
  const serie = serieResuelta.serie;

  const valores: any[] = [empresaId, tipoDocumentoDb, estatus, serie, numero];

  const columnas: string[] = ['empresa_id', 'tipo_documento', 'estatus_documento', 'serie', 'numero'];
  const hasSeguimiento = await ensureSeguimientoColumns();

  CAMPOS_DOCUMENTO.forEach((campo) => {
    // serie y numero ya se agregaron con sus defaults
    if (campo === 'serie' || campo === 'numero' || campo === 'estatus_documento') return;
    if (!hasSeguimiento && (SEGUIMIENTO_CAMPOS as readonly string[]).includes(campo)) return;
    if (dataConDefaults[campo] !== undefined) {
      columnas.push(campo);
      valores.push(dataConDefaults[campo]);
    }
  });

  const params = valores.map((_, idx) => `$${idx + 1}`).join(', ');
  const query = `INSERT INTO documentos (${columnas.join(', ')}) VALUES (${params}) RETURNING *`;

  // Validar duplicado serie + número + tipo + empresa
  const { rowCount: dupCount } = await executor.query(
    `SELECT 1 FROM documentos
     WHERE empresa_id = $1
       AND LOWER(tipo_documento) = LOWER($2)
       AND COALESCE(serie,'') = COALESCE($3,'')
       AND numero = $4
     LIMIT 1`,
    [empresaId, tipoDocumentoDb, serie, numero]
  );
  if ((dupCount ?? 0) > 0) {
    const err: any = new Error(`Ya existe un documento con la serie ${serie ?? ''} y número ${numero}.`);
    err.code = 'DOCUMENTO_DUPLICADO';
    throw err;
  }

  const { rows } = await executor.query(query, valores);
  return rows[0];
}

export async function actualizarDocumentoRepository(
  id: number,
  data: DocumentoInput,
  empresaId: number,
  tipoDocumento?: TipoDocumento,
  client?: PoolClient,
  options?: ActualizarDocumentoOptions
) {
  const executor = client ?? pool;

  if (
    Object.prototype.hasOwnProperty.call(data, 'tratamiento_impuestos')
    && (data.tratamiento_impuestos === undefined || data.tratamiento_impuestos === null)
  ) {
    throw new Error('VALIDATION_ERROR: El tratamiento de impuestos es obligatorio');
  }
  const hasSeguimiento = await ensureSeguimientoColumns();

  // Traer valores actuales para comparar serie/número
  const { rows: currentRows } = await executor.query(
    `SELECT d.id,
            d.serie,
            d.numero,
            d.tipo_documento,
            d.estado_seguimiento,
            d.estatus_documento,
            d.documento_origen_id,
            d.usuario_creacion_id,
            d.tratamiento_impuestos,
            EXISTS (
              SELECT 1
                FROM documentos_cfdi dc
               WHERE dc.documento_id = d.id
               LIMIT 1
            ) AS esta_timbrado
       FROM documentos d
      WHERE d.id = $1 AND d.empresa_id = $2 ${tipoDocumento ? 'AND LOWER(d.tipo_documento) = LOWER($3)' : ''}
      LIMIT 1`,
    tipoDocumento ? [id, empresaId, tipoDocumento] : [id, empresaId]
  );
  const current = currentRows[0];
  if (!current) return null;

  if (estatusDocumentoEsInactivo(current.estatus_documento)) {
    throw new Error('VALIDATION_ERROR: El documento está cancelado y es de solo lectura');
  }

  if (await documentoTieneCancelacionPendiente(id, empresaId, executor)) {
    throw new Error('VALIDATION_ERROR: El documento tiene una cancelación CFDI pendiente de sincronización y es de solo lectura');
  }

  assertFacturaCompraNoEmitida(current.tipo_documento, current.estatus_documento);
  await assertOrdenCompraModificable(id, empresaId, current.tipo_documento, executor);

  let dataToUpdate: DocumentoInput = { ...data };
  normalizarCamposFiscalesSat(dataToUpdate);
  const serieActual = current.serie ?? null;
  const serieNueva = dataToUpdate.serie ?? serieActual;
  const tipoDestino = (dataToUpdate.tipo_documento ?? current.tipo_documento) as TipoDocumento;
  const tipoDestinoNormalizado = String(tipoDestino ?? '').toLowerCase() as TipoDocumento;
  const tipoActualNormalizado = String(current.tipo_documento ?? '').toLowerCase() as TipoDocumento;
  const serieFueEnviadaExplicitamente = Object.prototype.hasOwnProperty.call(dataToUpdate, 'serie');
  const serieExplicitaNormalizada = serieFueEnviadaExplicitamente
    ? (dataToUpdate.serie == null ? null : String(dataToUpdate.serie).trim() || null)
    : null;
  const serieFueCambiadaManualmente = serieFueEnviadaExplicitamente && serieExplicitaNormalizada !== serieActual;
  const documentoEstaTimbrado = Boolean(current.esta_timbrado)
    || String(current.estatus_documento ?? '').trim().toLowerCase() === 'timbrado';

  if (tipoDestinoNormalizado === 'cotizacion') {
    dataToUpdate = sanitizarCamposCotizacion(dataToUpdate);

    if (Object.prototype.hasOwnProperty.call(dataToUpdate, 'estado_seguimiento')) {
      await validarReversionEstadoConvertidaConFacturacion({
        scope: 'cotizacion',
        entityId: id,
        empresaId,
        estadoActual: current.estado_seguimiento,
        estadoNuevo: dataToUpdate.estado_seguimiento,
        client,
      });
    }
  }

  if (!serieFueCambiadaManualmente && !documentoEstaTimbrado) {
    const usuarioActual = Number(current.usuario_creacion_id ?? 0) || null;
    const usuarioNuevo = Object.prototype.hasOwnProperty.call(dataToUpdate, 'usuario_creacion_id')
      ? Number(dataToUpdate.usuario_creacion_id ?? 0) || null
      : usuarioActual;
    const tratamientoActual = current.tratamiento_impuestos ?? null;
    const tratamientoNuevo = Object.prototype.hasOwnProperty.call(dataToUpdate, 'tratamiento_impuestos')
      ? dataToUpdate.tratamiento_impuestos ?? null
      : tratamientoActual;

    const criterioSerieCambio = tipoActualNormalizado !== tipoDestinoNormalizado
      || usuarioActual !== usuarioNuevo
      || tratamientoActual !== tratamientoNuevo;

    if (criterioSerieCambio) {
      const serieResuelta = await resolverSerieDocumento({
        empresaId,
        tipoDocumento: tipoDestinoNormalizado,
        usuarioId: usuarioNuevo,
        tratamientoImpuestos: tratamientoNuevo,
        client: executor,
      });

      if (serieResuelta.serie !== serieActual) {
        dataToUpdate.serie = serieResuelta.serie;
        dataToUpdate.numero = await reservarNumeroParaSerieExistente({
          empresaId,
          tipoDocumento: tipoDestinoNormalizado,
          serie: serieResuelta.serie,
          client: executor,
        });
      }
    }
  }

  // Si cambió la serie, reasignar número secuencial para esa serie
  if (serieNueva !== serieActual) {
    dataToUpdate.numero = await reservarNumeroParaSerieExistente({
      empresaId,
      tipoDocumento: tipoDestino,
      serie: String(serieNueva ?? ''),
      client: executor,
    });
  }

  const entries = CAMPOS_DOCUMENTO.filter((campo) => {
    if (!hasSeguimiento && (SEGUIMIENTO_CAMPOS as readonly string[]).includes(campo)) return false;
    return dataToUpdate[campo] !== undefined;
  });
  const sets = entries.map((campo, idx) => `${campo} = $${idx + 1}`).join(', ');
  const valores = entries.map((campo) => dataToUpdate[campo]);
  if (!sets) {
    const query = `SELECT * FROM documentos WHERE id = $1 AND empresa_id = $2 ${tipoDocumento ? 'AND LOWER(tipo_documento) = LOWER($3)' : ''}`;
    const { rows } = await executor.query(query, tipoDocumento ? [id, empresaId, tipoDocumento] : [id, empresaId]);
    return rows[0] || null;
  }

  const whereTipo = tipoDocumento ? ` AND LOWER(tipo_documento) = LOWER($${valores.length + 3})` : '';
  const query = `
    UPDATE documentos
    SET ${sets}
    WHERE id = $${valores.length + 1} AND empresa_id = $${valores.length + 2}${whereTipo}
    RETURNING *
  `;

  const params = tipoDocumento ? [...valores, id, empresaId, tipoDocumento] : [...valores, id, empresaId];
  const { rows } = await executor.query(query, params);
  const updated = rows[0] || null;

  if (
    updated
    && tipoDestinoNormalizado === 'cotizacion'
    && !options?.skipOportunidadStatusSync
    && Object.prototype.hasOwnProperty.call(dataToUpdate, 'estado_seguimiento')
    && current.estado_seguimiento !== updated.estado_seguimiento
  ) {
    await executor.query(
      `UPDATE crm.oportunidades_venta o
          SET estatus = $1,
              updated_at = NOW()
         FROM documentos d
        WHERE d.id = $2
          AND d.empresa_id = $3
          AND LOWER(COALESCE($1, '')) IN ('abierta', 'pausada', 'convertida', 'perdida', 'cancelada')
          AND o.empresa_id = $3
          AND o.id = d.oportunidad_id`,
      [updated.estado_seguimiento, id, empresaId]
    );
  }

  if (
    updated
    && tipoDestinoNormalizado === 'factura'
    && Object.prototype.hasOwnProperty.call(dataToUpdate, 'estatus_documento')
    && current.estatus_documento !== updated.estatus_documento
    && estatusDocumentoEsInactivo(updated.estatus_documento)
  ) {
    await revertirConversionComercialSiYaNoHayFacturasActivas(updated.documento_origen_id, empresaId, client);
  }

  return updated;
}

export async function agregarPartidaRepository(documentoId: number, data: PartidaInput, empresaId: number, client?: PoolClient) {
  const ownedClient = !client;
  const executor = client ?? (await pool.connect());
  try {
    const { rows: docRows } = await executor.query(
      'SELECT tipo_documento, estatus_documento FROM documentos WHERE id = $1 AND empresa_id = $2 LIMIT 1',
      [documentoId, empresaId]
    );
    const docRow = docRows[0];
    if (!docRow) return null;

    if (estatusDocumentoEsInactivo(docRow.estatus_documento)) {
      throw new Error('VALIDATION_ERROR: El documento está cancelado y es de solo lectura');
    }

    if (await documentoTieneCancelacionPendiente(documentoId, empresaId, executor)) {
      throw new Error('VALIDATION_ERROR: El documento tiene una cancelación CFDI pendiente de sincronización y es de solo lectura');
    }

    assertFacturaCompraNoEmitida(docRow.tipo_documento, docRow.estatus_documento);
    await assertOrdenCompraModificable(documentoId, empresaId, docRow.tipo_documento, executor);

    const permiteImagen = true;
    const imagen = normalizarImagenPartida(data, permiteImagen);
    const descuentoNormalizado = normalizarDescuentoPartida(data);

    const campos: string[] = ['documento_id'];
    const valores: any[] = [documentoId];

    const camposPermitidos: Array<keyof PartidaInput> = [
      // numero_partida se maneja aparte (secuencial)
      'producto_id',
      'descripcion_alterna',
      'cantidad',
      'precio_unitario',
      'precio_lista_id',
      'precio_editado_manual',
      'precio_origen',
      'descuento',
      'descuento_tipo',
      'descuento_monto',
      'subtotal_partida',
      'total_partida',
      'es_parte_oportunidad',
      'archivo_imagen_1',
      'producto_archivo_id',
      'observaciones',
    ];

    camposPermitidos.forEach((campo) => {
      if (campo === 'es_parte_oportunidad') {
        campos.push(campo);
        valores.push(data.es_parte_oportunidad ?? true);
        return;
      }

      if (campo === 'descuento' || campo === 'descuento_tipo' || campo === 'descuento_monto') {
        campos.push(campo);
        valores.push(descuentoNormalizado[campo]);
        return;
      }

      if (campo === 'archivo_imagen_1') {
        campos.push(campo);
        valores.push(imagen.archivo_imagen_1);
        return;
      }

      if (campo === 'producto_archivo_id') {
        campos.push(campo);
        valores.push(imagen.producto_archivo_id);
        return;
      }

      if (campo === 'observaciones') {
        campos.push(campo);
        valores.push(sanitizarObservacionesPartida(data.observaciones));
        return;
      }

      if (data[campo] !== undefined) {
        campos.push(campo);
        valores.push(data[campo]);
      }
    });

    // Asegurar columnas de total inicializados (el motor de impuestos recalcula después)
    if (!campos.includes('total_partida')) {
      campos.push('total_partida');
      valores.push(data.total_partida ?? data.subtotal_partida ?? 0);
    }

  // numero_partida secuencial (COUNT + 1 para ese documento)
    const nextNumeroSql = `(
      SELECT COALESCE(MAX(numero_partida), 0) + 1 FROM documentos_partidas WHERE documento_id = $1
    )`;
    campos.push('numero_partida');
    valores.push(null); // placeholder para mantener índices; lo sustituimos en query

    const params = valores.map((_, idx) => `$${idx + 1}`).join(', ');
    const query = `INSERT INTO documentos_partidas (${campos.join(', ')})
      VALUES (${params.substring(0, params.lastIndexOf(','))}, ${nextNumeroSql})
      RETURNING *`;
    const { rows } = await executor.query(query, valores);
    return rows[0];
  } finally {
    if (ownedClient) {
      executor.release();
    }
  }
}

export async function reemplazarPartidasRepository(
  documentoId: number,
  partidas: PartidaInput[],
  empresaId: number,
  client?: PoolClient
) {
  const ownedClient = !client;
  const executor = client ?? (await pool.connect());
  try {
    const { rows: docRows } = await executor.query(
      'SELECT tipo_documento, estatus_documento FROM documentos WHERE id = $1 AND empresa_id = $2 LIMIT 1',
      [documentoId, empresaId]
    );
    const docRow = docRows[0];
    if (!docRow) {
      return null;
    }

    if (estatusDocumentoEsInactivo(docRow.estatus_documento)) {
      throw new Error('VALIDATION_ERROR: El documento está cancelado y es de solo lectura');
    }

    if (await documentoTieneCancelacionPendiente(documentoId, empresaId, executor)) {
      throw new Error('VALIDATION_ERROR: El documento tiene una cancelación CFDI pendiente de sincronización y es de solo lectura');
    }

    assertFacturaCompraNoEmitida(docRow.tipo_documento, docRow.estatus_documento);
    await assertOrdenCompraModificable(documentoId, empresaId, docRow.tipo_documento, executor);

    const { rows: vinculosCheck } = await executor.query<{ folio_relacionado: string | null }>(
      `SELECT
         CASE
           WHEN d_rel.serie IS NOT NULL AND d_rel.numero IS NOT NULL
             THEN d_rel.serie || '-' || LPAD(d_rel.numero::text, 3, '0')
           WHEN d_rel.serie IS NOT NULL THEN d_rel.serie
           WHEN d_rel.numero IS NOT NULL THEN d_rel.numero::text
           ELSE NULL
         END AS folio_relacionado
       FROM documentos_partidas dp
       JOIN documentos_partidas_vinculos dpv
         ON dpv.partida_origen_id = dp.id
         OR dpv.partida_destino_id = dp.id
       LEFT JOIN documentos d_rel ON d_rel.id = CASE
         WHEN dpv.documento_origen_id = $1 THEN dpv.documento_destino_id
         ELSE dpv.documento_origen_id
       END
       WHERE dp.documento_id = $1
       LIMIT 1`,
      [documentoId]
    );
    if (vinculosCheck.length > 0) {
      const folio = vinculosCheck[0].folio_relacionado ?? '';
      throw new Error(`VALIDATION_ERROR: TRAZABILIDAD_ACTIVA: ${folio}`);
    }

    const permiteImagen = true;
    const usaProductoTecnicoNc = ['nota_credito', 'nota_credito_compra'].includes(String(docRow.tipo_documento ?? '').toLowerCase());

    if (ownedClient) {
      await executor.query('BEGIN');
    }
    const { rows: _vinculosReemplazar } = await executor.query(
      `SELECT dpv.id, dpv.documento_origen_id, dpv.documento_destino_id,
              dpv.partida_origen_id, dpv.partida_destino_id, dpv.cantidad
         FROM documentos_partidas_vinculos dpv
        WHERE dpv.documento_destino_id = $1
           OR dpv.documento_origen_id = $1`,
      [documentoId]
    );
    if (_vinculosReemplazar.length > 0) {
      console.warn('[VINCULOS AUDIT] reemplazarPartidasRepository - vinculos presentes antes de DELETE partidas', {
        operacion: 'reemplazarPartidas',
        documentoId,
        vinculos: _vinculosReemplazar,
        stack: new Error().stack,
      });
    }
    console.log('[documentos] reemplazarPartidasRepository - delete partidas documento', documentoId);
    await executor.query('DELETE FROM documentos_partidas WHERE documento_id = $1', [documentoId]);

    const insertQuery = `
      INSERT INTO documentos_partidas (
        documento_id,
        numero_partida,
        producto_id,
        descripcion_alterna,
        cantidad,
        precio_unitario,
        precio_lista_id,
        precio_editado_manual,
        precio_origen,
        descuento,
        descuento_tipo,
        descuento_monto,
        subtotal_partida,
        total_partida,
        es_parte_oportunidad,
        archivo_imagen_1,
        producto_archivo_id,
        observaciones
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;

    const insertedRows: any[] = [];
    for (const [idx, partida] of partidas.entries()) {
      const imagen = normalizarImagenPartida(partida, permiteImagen);
      const descuentoNormalizado = normalizarDescuentoPartida(partida);
      const productoTecnico = usaProductoTecnicoNc && !partida.producto_id
        ? await obtenerOCrearProductoTecnicoNcComercialRepository(empresaId, executor)
        : null;
      const values = [
        documentoId,
        idx + 1, // numero_partida secuencial por documento
        partida.producto_id ?? productoTecnico?.id ?? null,
        partida.descripcion_alterna ?? null,
        partida.cantidad ?? 0,
        partida.precio_unitario ?? 0,
        partida.precio_lista_id ?? null,
        partida.precio_editado_manual === true,
        partida.precio_origen ?? null,
        descuentoNormalizado.descuento,
        descuentoNormalizado.descuento_tipo,
        descuentoNormalizado.descuento_monto,
        partida.subtotal_partida ?? 0,
        partida.total_partida ?? partida.subtotal_partida ?? 0,
        partida.es_parte_oportunidad ?? true,
        imagen.archivo_imagen_1,
        imagen.producto_archivo_id,
        sanitizarObservacionesPartida(partida.observaciones),
      ];
      console.log('[documentos] reemplazarPartidasRepository - insert partida', {
        documentoId,
        numero_partida: idx + 1,
        total_partida: values[7],
      });
      const { rows } = await executor.query(insertQuery, values);
      console.log('[documentos] partida insertada id', rows[0]?.id);
      insertedRows.push(rows[0]);
    }

    if (ownedClient) {
      await executor.query('COMMIT');
    }
    console.log('[documentos] reemplazarPartidasRepository - commit partidas', { documentoId, count: insertedRows.length });
  return insertedRows;
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

export async function eliminarDocumentoRepository(id: number, empresaId: number, tipoDocumento?: TipoDocumento) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: documentoRows } = await client.query<{
      tipo_documento: string | null;
      documento_origen_id: number | null;
      finanzas_operacion_id: number | null;
      estatus_documento: string | null;
    }>(
      `SELECT tipo_documento, documento_origen_id, finanzas_operacion_id, estatus_documento
         FROM documentos
        WHERE id = $1
          AND empresa_id = $2
          ${tipoDocumento ? 'AND LOWER(tipo_documento) = LOWER($3)' : ''}
        LIMIT 1`,
      tipoDocumento ? [id, empresaId, tipoDocumento] : [id, empresaId]
    );

    const documentoActual = documentoRows[0] ?? null;

    if (documentoActual) {
      assertFacturaCompraNoEmitida(documentoActual.tipo_documento, documentoActual.estatus_documento);
      await assertFacturaEliminable(id, empresaId, documentoActual.tipo_documento, documentoActual.estatus_documento, client);
    }

    const { rows: _vinculosEliminar } = await client.query(
      `SELECT dpv.id, dpv.documento_origen_id, dpv.documento_destino_id,
              dpv.partida_origen_id, dpv.partida_destino_id, dpv.cantidad
         FROM documentos_partidas_vinculos dpv
        WHERE dpv.documento_destino_id = $1
           OR dpv.documento_origen_id = $1`,
      [id]
    );
    if (_vinculosEliminar.length > 0) {
      console.warn('[VINCULOS AUDIT] eliminarDocumentoRepository - vinculos presentes antes de DELETE documento', {
        operacion: 'eliminarDocumento',
        documentoId: id,
        tipoDocumento,
        vinculos: _vinculosEliminar,
        stack: new Error().stack,
      });
    }

    const deletePartidasSql = tipoDocumento
      ? 'DELETE FROM documentos_partidas dp WHERE dp.documento_id = $1 AND EXISTS (SELECT 1 FROM documentos d WHERE d.id = $1 AND d.empresa_id = $2 AND LOWER(d.tipo_documento) = LOWER($3))'
      : 'DELETE FROM documentos_partidas dp WHERE dp.documento_id = $1 AND EXISTS (SELECT 1 FROM documentos d WHERE d.id = $1 AND d.empresa_id = $2)';

    await client.query(deletePartidasSql, tipoDocumento ? [id, empresaId, tipoDocumento] : [id, empresaId]);

    const deleteDocumentoSql = tipoDocumento
      ? 'DELETE FROM documentos WHERE id = $1 AND empresa_id = $2 AND LOWER(tipo_documento) = LOWER($3)'
      : 'DELETE FROM documentos WHERE id = $1 AND empresa_id = $2';

    const result = await client.query(deleteDocumentoSql, tipoDocumento ? [id, empresaId, tipoDocumento] : [id, empresaId]);

    if ((result.rowCount ?? 0) > 0 && documentoActual?.finanzas_operacion_id) {
      const { rows: operacionRows } = await client.query<{
        id: number;
        cuenta_id: number;
        tipo_movimiento: string;
        monto: number | string;
        estado_conciliacion: string | null;
      }>(
        `SELECT id, cuenta_id, tipo_movimiento, monto, estado_conciliacion
           FROM finanzas_operaciones
          WHERE id = $1
            AND empresa_id = $2
          LIMIT 1
          FOR UPDATE`,
        [documentoActual.finanzas_operacion_id, empresaId]
      );

      const operacion = operacionRows[0] ?? null;
      if (!operacion) {
        throw new DocumentoDeleteValidationError('Operación financiera asociada no encontrada');
      }

      if (String(operacion.estado_conciliacion ?? '').toLowerCase() !== 'pendiente') {
        throw new DocumentoDeleteValidationError('No se puede eliminar el documento porque la operación financiera asociada ya está cotejada o conciliada');
      }

      const { rows: cuentaRows } = await client.query<{
        id: number;
        saldo: number | string;
      }>(
        `SELECT id, saldo
           FROM finanzas_cuentas
          WHERE id = $1
            AND empresa_id = $2
          LIMIT 1
          FOR UPDATE`,
        [operacion.cuenta_id, empresaId]
      );

      const cuenta = cuentaRows[0] ?? null;
      if (!cuenta) {
        throw new DocumentoDeleteValidationError('Cuenta no encontrada');
      }

      const delta = operacion.tipo_movimiento === 'Deposito' ? -Number(operacion.monto) : Number(operacion.monto);
      const nuevoSaldo = Number(cuenta.saldo) + delta;

      await client.query('DELETE FROM finanzas_operaciones WHERE id = $1 AND empresa_id = $2', [operacion.id, empresaId]);
      await client.query('UPDATE finanzas_cuentas SET saldo = $1 WHERE id = $2', [nuevoSaldo, cuenta.id]);
    }

    if (
      (result.rowCount ?? 0) > 0
      && String(documentoActual?.tipo_documento ?? '').trim().toLowerCase() === 'factura'
    ) {
      await revertirConversionComercialSiYaNoHayFacturasActivas(documentoActual?.documento_origen_id, empresaId, client);
    }

    await client.query('COMMIT');
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ─── Recepción resumen ────────────────────────────────────────────────────────

export type PartidaRecepcionResumen = {
  partida_oc_id: number;
  producto_id: number | null;
  producto_descripcion: string | null;
  producto_clave: string | null;
  descripcion_alterna: string | null;
  unidad: string | null;
  numero_partida: number | null;
  cantidad_ordenada: number;
  cantidad_recibida: number;
  cantidad_pendiente: number;
};

export type RecepcionResumenResponse = {
  partidas: PartidaRecepcionResumen[];
  estado_recepcion: 'abierta' | 'parcial' | 'cerrada';
  total_ordenado: number;
  total_recibido: number;
  total_pendiente: number;
};

export async function obtenerRecepcionResumenRepository(
  documentoId: number,
  empresaId: number
): Promise<RecepcionResumenResponse | null> {
  const { rows: docRows } = await pool.query<{ id: number }>(
    `SELECT id FROM documentos
      WHERE id = $1 AND empresa_id = $2
        AND LOWER(tipo_documento) = 'orden_compra'
      LIMIT 1`,
    [documentoId, empresaId]
  );
  if (!docRows[0]) return null;

  const { rows } = await pool.query<{
    partida_oc_id: string;
    producto_id: string | null;
    producto_descripcion: string | null;
    producto_clave: string | null;
    descripcion_alterna: string | null;
    unidad: string | null;
    numero_partida: string | null;
    cantidad_ordenada: string;
    cantidad_recibida: string;
    cantidad_pendiente: string;
  }>(
    `SELECT
       opr.partida_oc_id,
       opr.producto_id,
       p.descripcion     AS producto_descripcion,
       p.clave           AS producto_clave,
       dp.descripcion_alterna,
       dp.unidad,
       dp.numero_partida,
       opr.cantidad_ordenada,
       opr.cantidad_recibida,
       opr.cantidad_pendiente
     FROM public.oc_partidas_recepcion opr
     JOIN public.documentos_partidas dp ON dp.id = opr.partida_oc_id
     LEFT JOIN public.productos p ON p.id = opr.producto_id
     WHERE opr.oc_id      = $1
       AND opr.empresa_id = $2
     ORDER BY dp.numero_partida NULLS LAST, dp.id`,
    [documentoId, empresaId]
  );

  const partidas: PartidaRecepcionResumen[] = rows.map((row) => ({
    partida_oc_id:        Number(row.partida_oc_id),
    producto_id:          row.producto_id != null ? Number(row.producto_id) : null,
    producto_descripcion: row.producto_descripcion ?? null,
    producto_clave:       row.producto_clave ?? null,
    descripcion_alterna:  row.descripcion_alterna ?? null,
    unidad:               row.unidad ?? null,
    numero_partida:       row.numero_partida != null ? Number(row.numero_partida) : null,
    cantidad_ordenada:    Number(row.cantidad_ordenada),
    cantidad_recibida:    Number(row.cantidad_recibida),
    cantidad_pendiente:   Number(row.cantidad_pendiente),
  }));

  const total_ordenado  = partidas.reduce((s, p) => s + p.cantidad_ordenada, 0);
  const total_recibido  = partidas.reduce((s, p) => s + p.cantidad_recibida, 0);
  const total_pendiente = partidas.reduce((s, p) => s + p.cantidad_pendiente, 0);

  let estado_recepcion: 'abierta' | 'parcial' | 'cerrada';
  if (total_recibido <= 0.000001) {
    estado_recepcion = 'abierta';
  } else if (total_recibido >= total_ordenado - 0.000001) {
    estado_recepcion = 'cerrada';
  } else {
    estado_recepcion = 'parcial';
  }

  return { partidas, estado_recepcion, total_ordenado, total_recibido, total_pendiente };
}
