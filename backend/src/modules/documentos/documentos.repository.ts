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

export type Documento = {
  id: number;
  empresa_id: number;
  tipo_documento: TipoDocumento;
  motivo_nc?: 'devolucion' | 'bonificacion' | 'otro' | null;
  concepto_id?: number | null;
  serie: string | null;
  numero: number | null;
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
  'fecha_documento',
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
  subtotal_partida?: number | null;
  total_partida?: number | null;
  es_parte_oportunidad?: boolean;
  archivo_imagen_1?: string | null;
  producto_archivo_id?: number | null;
  observaciones?: string | null;
};

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

export async function listarDocumentosRepository(tipoDocumento: TipoDocumento, empresaId: number, search?: string | null) {
  const esFactura = ['factura', 'factura_compra', 'nota_credito', 'nota_credito_compra'].includes((tipoDocumento || '').toLowerCase());
  const esCotizacion = (tipoDocumento || '').toLowerCase() === 'cotizacion';
  const selectSaldo = esFactura ? 'COALESCE(ds.saldo, 0) AS saldo' : 'NULL::numeric AS saldo';
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

  const query = `
    SELECT
      d.id,
      d.motivo_nc,
      d.serie,
      d.numero,
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

export async function obtenerDocumentoRepository(id: number, empresaId: number, tipoDocumento?: TipoDocumento) {
  const executor = pool;
  const docQuery = `
    SELECT
      d.*,
      fo.cuenta_id AS cuenta_financiera_id,
      c.nombre AS cliente_nombre,
      c.email AS cliente_email,
      c.telefono AS cliente_telefono,
      TRIM(CONCAT_WS(' ', cd.calle, cd.numero_exterior, cd.numero_interior, cd.colonia, cd.ciudad, cd.estado, cd.cp, cd.pais)) AS cliente_direccion,
      d.rfc_receptor AS cliente_rfc,
      d.regimen_fiscal_receptor,
      d.uso_cfdi,
      d.forma_pago,
      d.metodo_pago,
      d.codigo_postal_receptor
    FROM documentos d
    LEFT JOIN finanzas_operaciones fo ON fo.id = d.finanzas_operacion_id AND fo.empresa_id = d.empresa_id
    LEFT JOIN contactos c ON d.contacto_principal_id = c.id
    LEFT JOIN contactos_domicilios cd ON cd.contacto_id = c.id AND cd.es_principal = true
    WHERE d.empresa_id = $1 AND d.id = $2
      ${tipoDocumento ? 'AND LOWER(d.tipo_documento) = LOWER($3)' : ''}
    LIMIT 1
  `;
  const params = tipoDocumento ? [empresaId, id, tipoDocumento] : [empresaId, id];
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

  return { documento, partidas };
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

  let dataToUpdate: DocumentoInput = { ...data };
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

    const permiteImagen = true;
    const imagen = normalizarImagenPartida(data, permiteImagen);

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

    const permiteImagen = true;
    const usaProductoTecnicoNc = ['nota_credito', 'nota_credito_compra'].includes(String(docRow.tipo_documento ?? '').toLowerCase());

    if (ownedClient) {
      await executor.query('BEGIN');
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
        subtotal_partida,
        total_partida,
        es_parte_oportunidad,
        archivo_imagen_1,
        producto_archivo_id,
        observaciones
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const insertedRows: any[] = [];
    for (const [idx, partida] of partidas.entries()) {
      const imagen = normalizarImagenPartida(partida, permiteImagen);
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
        partida.descuento ?? 0,
        partida.subtotal_partida ?? 0,
        partida.total_partida ?? partida.subtotal_partida ?? 0,
        partida.es_parte_oportunidad ?? true,
        imagen.archivo_imagen_1,
        imagen.producto_archivo_id,
        partida.observaciones ?? null,
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
    }>(
      `SELECT tipo_documento, documento_origen_id, finanzas_operacion_id
         FROM documentos
        WHERE id = $1
          AND empresa_id = $2
          ${tipoDocumento ? 'AND LOWER(tipo_documento) = LOWER($3)' : ''}
        LIMIT 1`,
      tipoDocumento ? [id, empresaId, tipoDocumento] : [id, empresaId]
    );

    const documentoActual = documentoRows[0] ?? null;

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
        estado_conciliacion: string | null;
      }>(
        `SELECT id, estado_conciliacion
           FROM finanzas_operaciones
          WHERE id = $1
            AND empresa_id = $2
          LIMIT 1
          FOR UPDATE`,
        [documentoActual.finanzas_operacion_id, empresaId]
      );

      const operacionFinanciera = operacionRows[0] ?? null;
      if (!operacionFinanciera) {
        throw new DocumentoDeleteValidationError(
          'Operación financiera asociada no encontrada'
        );
      }

      if (String(operacionFinanciera.estado_conciliacion ?? '').toLowerCase() !== 'pendiente') {
      throw new DocumentoDeleteValidationError('No se puede eliminar el documento porque la operación financiera asociada ya está cotejada o conciliada');      }

      await client.query('DELETE FROM finanzas_operaciones WHERE id = $1 AND empresa_id = $2', [operacionFinanciera.id, empresaId]);
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
