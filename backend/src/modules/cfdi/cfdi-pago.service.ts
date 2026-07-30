import { XMLParser } from 'fast-xml-parser';
import pool from '../../config/database';
import { FacturamaClient } from './facturama.client';
import { buildPagoComplementPayload } from './pago-complement.builder';
import { CfdiValidationError } from './cfdi.service';
import {
  validarFacturaRelacionadaPago,
  validarReceptorFiscalComun,
} from './pago-complement.validation';
import {
  PagoComplementValidationError,
} from './pago-complement.errors';
import { actualizarIntentoTimbrado } from './cfdi-timbrado-intentos.repository';
import type {
  ImpuestoDR,
  AplicacionComplemento,
  PagoComplementData,
  TimbradoPersisted,
  TimbrarFacturaResult,
  TimbreFiscalDigitalData,
  FacturamaStampResponse,
} from './cfdi.types';
import { formatearFolioDocumento } from '../../utils/documentos';

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

// Duplicado intencionalmente: assertDocumentoSinCancelacionPendiente no está
// exportada desde cfdi.service.ts y no queremos modificar ese módulo.
async function assertDocumentoSinCancelacionPendiente(
  documentoId: number,
  empresaId: number
): Promise<void> {
  const { rows } = await pool.query<{ pendiente: boolean }>(
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
  if (rows[0]?.pendiente) {
    throw new CfdiValidationError(
      'No se puede timbrar: el documento tiene una cancelación CFDI pendiente de sincronización interna'
    );
  }
}

async function assertSinIntentoTimbradoPendiente(
  documentoId: number,
  empresaId: number
): Promise<void> {
  const { rows } = await pool.query<{ pendiente: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM public.cfdi_intentos_timbrado
        WHERE documento_id = $1 AND empresa_id = $2
          AND estado IN ('aceptado_pendiente_descarga', 'xml_recuperado', 'error_descarga')
     ) AS pendiente`,
    [documentoId, empresaId]
  );
  if (rows[0]?.pendiente) {
    throw new CfdiValidationError(
      'El pago tiene un intento aceptado pendiente de descarga o reconciliación y no puede volver a timbrarse.'
    );
  }
}

// Actualiza solo estatus_documento. No toca saldo (comportamiento distinto al
// de cfdi.service.ts, que hace saldo = total para facturas).
async function marcarPagoTimbrado(documentoId: number): Promise<void> {
  await pool.query(
    `UPDATE documentos
        SET estatus_documento = 'Timbrado'
      WHERE id = $1
        AND tipo_documento = 'pago_cliente'
        AND (estatus_documento IS NULL OR LOWER(estatus_documento) <> 'timbrado')`,
    [documentoId]
  );
}

// ---------------------------------------------------------------------------
// Extracción de timbre del XML timbrado
// ---------------------------------------------------------------------------

function parseTimbre(
  xmlTimbrado: string,
  response: FacturamaStampResponse
): TimbreFiscalDigitalData {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      removeNSPrefix: true,
      trimValues: true,
    });
    const parsed = parser.parse(xmlTimbrado);
    const comprobante = parsed?.['cfdi:Comprobante'] || parsed?.Comprobante;
    const complemento = comprobante?.Complemento || comprobante?.['cfdi:Complemento'];
    const stamp = complemento?.TimbreFiscalDigital || complemento?.['tfd:TimbreFiscalDigital'];

    return {
      uuid:
        stamp?.UUID ||
        (response as any)?.Complement?.TaxStamp?.Uuid ||
        (response as any)?.uuid ||
        null,
      fechaTimbrado:
        stamp?.FechaTimbrado ||
        (response as any)?.Complement?.TaxStamp?.Date ||
        null,
      selloCfd:
        stamp?.SelloCFD ||
        (response as any)?.Complement?.TaxStamp?.CfdiSign ||
        (response as any)?.SelloCFD ||
        null,
      selloSat:
        stamp?.SelloSAT ||
        (response as any)?.Complement?.TaxStamp?.SatSign ||
        (response as any)?.SelloSAT ||
        null,
      noCertificadoSat:
        stamp?.NoCertificadoSAT ||
        (response as any)?.Complement?.TaxStamp?.SatCertNumber ||
        (response as any)?.NoCertificadoSat ||
        null,
      noCertificado: comprobante?.NoCertificado || (response as any)?.CertNumber || null,
      rfcProveedorCertificacion:
        stamp?.RfcProvCertif ||
        (response as any)?.Complement?.TaxStamp?.RfcProvCertif ||
        null,
      cadenaOriginal: (response as any)?.OriginalString || null,
    };
  } catch {
    return {
      uuid:
        (response as any)?.Complement?.TaxStamp?.Uuid ||
        (response as any)?.uuid ||
        null,
    };
  }
}

// ---------------------------------------------------------------------------
// Servicio principal
// ---------------------------------------------------------------------------

export type PagoComplementPrevalidacion = {
  documentoId: number;
  aplicaciones: number;
  estado: 'sin_aplicaciones' | 'receptor_disponible' | 'inconsistente';
  origen: 'xml_facturas' | null;
  receptor: {
    nombre: string;
    rfcEnmascarado: string;
    regimenFiscal: string;
    codigoPostal: string;
  } | null;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

const enmascararRfc = (rfc: string): string => {
  const normalized = rfc.trim().toUpperCase();
  if (normalized.length <= 6) return '***';
  return `${normalized.slice(0, 3)}${'*'.repeat(Math.max(3, normalized.length - 6))}${normalized.slice(-3)}`;
};

export function assertPagoTieneAplicaciones(
  aplicaciones: readonly unknown[],
  input: { documentoId: number; serie: string | null; numero: number | null }
): void {
  if (aplicaciones.length > 0) return;
  const folioPago = input.numero !== null
    ? formatearFolioDocumento(input.serie || '', input.numero)
    : String(input.documentoId);
  throw new PagoComplementValidationError(
    'PAYMENT_WITHOUT_APPLICATIONS',
    `El pago ${folioPago} no tiene facturas aplicadas. Aplique el pago a una factura PPD timbrada antes de generar el Complemento de Pago.`,
    409,
    { documento_id: input.documentoId, folio: folioPago }
  );
}

export async function obtenerPrevalidacionComplementoPago(
  documentoId: number,
  empresaId: number
): Promise<PagoComplementPrevalidacion> {
  const { rows } = await pool.query<{
    id: number;
    documento_id: number | null;
    folio: string;
    tipo_documento: string | null;
    empresa_id: number | null;
    estatus_documento: string | null;
    tratamiento_impuestos: string | null;
    uuid: string | null;
    cfdi_registrado: boolean;
    xml_timbrado: string | null;
    estado_sat: string | null;
    fecha_cancelacion: string | null;
    rfc_empresa: string;
    monto: string;
    saldo_anterior: string | null;
    saldo_insoluto: string | null;
    parcialidad: number | null;
  }>(
    `SELECT a.id, f.id AS documento_id,
            CONCAT_WS('-', NULLIF(f.serie, ''), f.numero::text) AS folio,
            f.tipo_documento, f.empresa_id, f.estatus_documento, f.tratamiento_impuestos,
            dc.uuid, (dc.documento_id IS NOT NULL) AS cfdi_registrado, dc.xml_timbrado,
            dc.estado_sat, dc.fecha_cancelacion,
            e.rfc AS rfc_empresa,
            a.monto_moneda_documento AS monto,
            a.imp_saldo_ant AS saldo_anterior,
            a.imp_saldo_insoluto AS saldo_insoluto,
            a.num_parcialidad AS parcialidad
       FROM aplicaciones_saldo a
       JOIN documentos p ON p.id = a.documento_origen_id
       LEFT JOIN documentos f ON f.id = a.documento_destino_id
       JOIN core.empresas e ON e.id = p.empresa_id
       LEFT JOIN documentos_cfdi dc ON dc.documento_id = f.id
      WHERE p.id = $1 AND p.empresa_id = $2 AND p.tipo_documento = 'pago_cliente'
      ORDER BY a.id`,
    [documentoId, empresaId]
  );
  if (!rows.length) {
    return {
      documentoId,
      aplicaciones: 0,
      estado: 'sin_aplicaciones',
      origen: null,
      receptor: null,
      error: {
        code: 'PAYMENT_WITHOUT_APPLICATIONS',
        message: 'El pago no tiene facturas aplicadas.',
      },
    };
  }

  try {
    const receptores = rows.map((row) => {
      if (!row.documento_id || !row.tipo_documento || row.empresa_id === null) {
        throw new PagoComplementValidationError(
          'RELATED_INVOICE_NOT_FOUND',
          `No se encontró la factura relacionada con la aplicación ${row.id}.`,
          404,
          { aplicacion_id: row.id }
        );
      }
      if (!row.cfdi_registrado) {
        throw new PagoComplementValidationError(
          'RELATED_INVOICE_NOT_STAMPED',
          `La factura ${row.folio || row.documento_id} no está timbrada.`,
          409,
          { folio: row.folio || String(row.documento_id) }
        );
      }
      const validated = validarFacturaRelacionadaPago({
        documentoId: row.documento_id,
        folio: row.folio || String(row.documento_id),
        tipoDocumento: row.tipo_documento,
        empresaId: row.empresa_id,
        estatusDocumento: row.estatus_documento,
        tratamientoImpuestos: row.tratamiento_impuestos,
        uuid: row.uuid,
        xmlTimbrado: row.xml_timbrado,
        estadoSat: row.estado_sat,
        fechaCancelacion: row.fecha_cancelacion,
        rfcEmpresa: row.rfc_empresa,
        previousBalance: Number(row.saldo_anterior),
        amountPaid: Number(row.monto),
        remainingBalance: Number(row.saldo_insoluto),
        partialityNumber: Number(row.parcialidad),
      });
      return {
        folio: row.folio || String(row.id),
        receptor: validated.receptor,
      };
    });
    const receptor = validarReceptorFiscalComun(receptores);
    return {
      documentoId,
      aplicaciones: rows.length,
      estado: 'receptor_disponible',
      origen: 'xml_facturas',
      receptor: {
        nombre: receptor.nombre,
        rfcEnmascarado: enmascararRfc(receptor.rfc),
        regimenFiscal: receptor.regimenFiscal,
        codigoPostal: receptor.domicilioFiscal,
      },
    };
  } catch (error) {
    const validationError = error instanceof PagoComplementValidationError
      ? error
      : new PagoComplementValidationError(
          'RELATED_XML_INVALID',
          'No fue posible interpretar los XML de las facturas aplicadas.',
          422
        );
    return {
      documentoId,
      aplicaciones: rows.length,
      estado: 'inconsistente',
      origen: 'xml_facturas',
      receptor: null,
      error: {
        code: validationError.code,
        message: validationError.message,
        ...(validationError.details ? { details: validationError.details } : {}),
      },
    };
  }
}

export async function timbrarComplementoPago(
  documentoId: number,
  empresaId: number
): Promise<TimbrarFacturaResult> {

  // 1) Guard: no timbrar si hay cancelación CFDI pendiente de sincronización
  await assertDocumentoSinCancelacionPendiente(documentoId, empresaId);
  await assertSinIntentoTimbradoPendiente(documentoId, empresaId);

  // 2) Guard: no timbrar si ya existe un timbre para este documento
  const { rows: cfdiExistenteRows } = await pool.query<{ uuid: string | null }>(
    'SELECT uuid FROM public.documentos_cfdi WHERE documento_id = $1 LIMIT 1',
    [documentoId]
  );
  if (cfdiExistenteRows.length > 0 && cfdiExistenteRows[0].uuid) {
    throw new CfdiValidationError('Este pago ya fue timbrado como Complemento de Pagos.');
  }

  // 3) Cargar datos del pago y la empresa
  const { rows: pagoRows } = await pool.query<{
    id: number;
    empresa_id: number;
    tipo_documento: string;
    estatus_documento: string;
    serie: string | null;
    numero: number | null;
    moneda: string;
    tipo_cambio: string;
    total: string;
    forma_pago: string | null;
    fecha_documento: string;
    rfc_receptor: string | null;
    nombre_receptor: string | null;
    regimen_fiscal_receptor: string | null;
    codigo_postal_receptor: string | null;
    empresa_rfc: string;
    empresa_nombre: string;
    empresa_regimen: string;
    empresa_cp: string;
    contacto_principal_id: number;
  }>(
    `SELECT d.id, d.empresa_id, d.tipo_documento, d.estatus_documento, d.serie, d.numero,
            d.moneda, d.tipo_cambio, d.total,
            d.forma_pago, d.fecha_documento,
            d.rfc_receptor, d.nombre_receptor,
            d.regimen_fiscal_receptor, d.codigo_postal_receptor,
            e.rfc AS empresa_rfc, e.razon_social AS empresa_nombre,
            e.regimen_fiscal_id AS empresa_regimen,
            e.codigo_postal_id AS empresa_cp,
            d.contacto_principal_id
       FROM documentos d
       JOIN core.empresas e ON e.id = d.empresa_id
      WHERE d.id = $1 AND d.empresa_id = $2 AND d.tipo_documento = 'pago_cliente'`,
    [documentoId, empresaId]
  );

  const pago = pagoRows[0];
  if (!pago) {
    throw new CfdiValidationError('Pago no encontrado o tipo de documento inválido.');
  }
  if (['cancelado', 'eliminado', 'timbrado'].includes(String(pago.estatus_documento).trim().toLowerCase())) {
    throw new CfdiValidationError(`El pago está ${pago.estatus_documento} y no puede timbrarse.`);
  }

  // Las aplicaciones se validan antes que cualquier dato fiscal del pago. El
  // receptor histórico se obtiene después desde los XML de estas facturas.
  const { rows: apRows } = await pool.query<{
    id: number;
    documento_destino_id: number;
    monto_moneda_documento: string;
    num_parcialidad: number | null;
    imp_saldo_ant: string | null;
    imp_saldo_insoluto: string | null;
    uuid_factura: string | null;
    cfdi_registrado: boolean;
    serie_factura: string | null;
    folio_factura: string | null;
    moneda_factura: string | null;
    tipo_cambio_factura: string | null;
    total_factura: string | null;
    tipo_documento_factura: string | null;
    empresa_id_factura: number | null;
    estatus_factura: string | null;
    tratamiento_impuestos_factura: string | null;
    xml_factura: string | null;
    estado_sat_factura: string | null;
    fecha_cancelacion_factura: string | null;
  }>(
    `SELECT a.id, a.documento_destino_id,
            a.monto_moneda_documento,
            a.num_parcialidad, a.imp_saldo_ant, a.imp_saldo_insoluto,
            dc.uuid AS uuid_factura, (dc.documento_id IS NOT NULL) AS cfdi_registrado,
            dc.xml_timbrado AS xml_factura,
            dc.estado_sat AS estado_sat_factura,
            dc.fecha_cancelacion AS fecha_cancelacion_factura,
            f.serie AS serie_factura, f.numero::text AS folio_factura,
            f.moneda AS moneda_factura, f.tipo_cambio AS tipo_cambio_factura,
            f.total AS total_factura, f.tipo_documento AS tipo_documento_factura,
            f.empresa_id AS empresa_id_factura,
            f.estatus_documento AS estatus_factura,
            f.tratamiento_impuestos AS tratamiento_impuestos_factura
       FROM aplicaciones_saldo a
       LEFT JOIN documentos f ON f.id = a.documento_destino_id
       LEFT JOIN documentos_cfdi dc ON dc.documento_id = f.id
      WHERE a.documento_origen_id = $1 AND a.empresa_id = $2
      ORDER BY a.id ASC`,
    [documentoId, empresaId]
  );

  assertPagoTieneAplicaciones(apRows, {
    documentoId,
    serie: pago.serie,
    numero: pago.numero,
  });
  for (const ap of apRows) {
    if (!ap.tipo_documento_factura || ap.empresa_id_factura === null) {
      throw new PagoComplementValidationError(
        'RELATED_INVOICE_NOT_FOUND',
        `No se encontró la factura relacionada con la aplicación ${ap.id}.`,
        404,
        { aplicacion_id: ap.id, documento_destino_id: ap.documento_destino_id }
      );
    }
  }

  if (!pago.forma_pago) {
    throw new CfdiValidationError(
      'El pago no tiene Forma de Pago asignada (requerida para Complemento de Pagos).'
    );
  }
  if (pago.forma_pago === '99') {
    throw new CfdiValidationError('El pago no puede usar la forma de pago 99 para un complemento.');
  }
  if (!Number.isFinite(new Date(pago.fecha_documento).getTime()) || Number(pago.total) <= 0) {
    throw new CfdiValidationError('La fecha o el importe total del pago no es válido.');
  }
  for (const ap of apRows) {
    if (!ap.cfdi_registrado) {
      throw new PagoComplementValidationError(
        'RELATED_INVOICE_NOT_STAMPED',
        `La factura ${ap.serie_factura || ''}${ap.folio_factura || ''} no está timbrada.`,
        409,
        { documento_id: ap.documento_destino_id, folio: `${ap.serie_factura || ''}-${ap.folio_factura || ''}` }
      );
    }
    if (ap.num_parcialidad === null || ap.imp_saldo_ant === null || ap.imp_saldo_insoluto === null) {
      throw new PagoComplementValidationError(
        'PAYMENT_APPLICATION_INVALID',
        `La aplicación a la factura ${ap.serie_factura || ''}-${ap.folio_factura || ''} no tiene datos de parcialidad registrados.`,
        422,
        { documento_id: ap.documento_destino_id, folio: `${ap.serie_factura || ''}-${ap.folio_factura || ''}` }
      );
    }
    if (ap.empresa_id_factura !== empresaId) {
      throw new PagoComplementValidationError(
        'PAYMENT_APPLICATION_INVALID',
        `La factura ${ap.serie_factura || ''}-${ap.folio_factura || ''} pertenece a otra empresa.`,
        422,
        { documento_id: ap.documento_destino_id, folio: `${ap.serie_factura || ''}-${ap.folio_factura || ''}` }
      );
    }
  }

  // 5) Cargar impuestos de las facturas relacionadas
  const facturaIds = [...new Set(apRows.map((r) => r.documento_destino_id))];
  const { rows: impRows } = await pool.query<{
    documento_id: number;
    impuesto: string;
    tipo: string;
    tasa: string;
    base: string;
    monto: string;
  }>(
    `SELECT dp.documento_id,
            i.nombre AS impuesto, i.tipo,
            dpi.tasa, dpi.base, dpi.monto
       FROM documentos_partidas_impuestos dpi
       JOIN impuestos i ON i.id = dpi.impuesto_id
       JOIN documentos_partidas dp ON dp.id = dpi.partida_id
      WHERE dp.documento_id = ANY($1::int[])`,
    [facturaIds]
  );

  const impuestosPorFactura = new Map<number, ImpuestoDR[]>();
  for (const imp of impRows) {
    const list = impuestosPorFactura.get(imp.documento_id) ?? [];
    list.push({
      impuesto: imp.impuesto,
      tipo: imp.tipo as 'traslado' | 'retencion',
      tasa: Number(imp.tasa),
      base: Number(imp.base),
      monto: Number(imp.monto),
    });
    impuestosPorFactura.set(imp.documento_id, list);
  }

  // 6) Construir el input del builder
  const receptoresRelacionados: Array<{
    folio: string;
    receptor: ReturnType<typeof validarFacturaRelacionadaPago>['receptor'];
  }> = [];
  const aplicaciones: AplicacionComplemento[] = apRows.map((ap) => {
    const folioFactura = `${ap.serie_factura || ''}-${ap.folio_factura || ''}`.replace(/^-|-$/g, '');
    let validated;
    try {
      validated = validarFacturaRelacionadaPago({
        documentoId: ap.documento_destino_id,
        folio: folioFactura,
        tipoDocumento: ap.tipo_documento_factura!,
        empresaId: ap.empresa_id_factura!,
        estatusDocumento: ap.estatus_factura,
        tratamientoImpuestos: ap.tratamiento_impuestos_factura,
        uuid: ap.uuid_factura,
        xmlTimbrado: ap.xml_factura,
        estadoSat: ap.estado_sat_factura,
        fechaCancelacion: ap.fecha_cancelacion_factura,
        rfcEmpresa: pago.empresa_rfc,
        previousBalance: Number(ap.imp_saldo_ant),
        amountPaid: Number(ap.monto_moneda_documento),
        remainingBalance: Number(ap.imp_saldo_insoluto),
        partialityNumber: ap.num_parcialidad!,
      });
    } catch (error) {
      if (error instanceof PagoComplementValidationError) throw error;
      throw new CfdiValidationError(
        error instanceof Error ? error.message : `La factura ${folioFactura} no es válida para complemento.`
      );
    }
    receptoresRelacionados.push({ folio: folioFactura, receptor: validated.receptor });
    return {
      uuid_factura: ap.uuid_factura!,
      serie: ap.serie_factura,
      folio: ap.folio_factura,
      moneda_factura: ap.moneda_factura!,
      tipo_cambio_factura: Number(ap.tipo_cambio_factura || 1),
      total_factura: Number(ap.total_factura),
      monto_moneda_documento: Number(ap.monto_moneda_documento),
      num_parcialidad: ap.num_parcialidad!,
      imp_saldo_ant: Number(ap.imp_saldo_ant!),
      imp_saldo_insoluto: Number(ap.imp_saldo_insoluto!),
      payment_method: validated.paymentMethod,
      impuestos: impuestosPorFactura.get(ap.documento_destino_id) ?? [],
    };
  });
  const receptorFiscal = validarReceptorFiscalComun(receptoresRelacionados);
  const totalAplicado = apRows.reduce(
    (sum, application) => sum + Number(application.monto_moneda_documento),
    0
  );
  if (Math.abs(totalAplicado - Number(pago.total)) > 0.01) {
    throw new PagoComplementValidationError(
      'PAYMENT_BALANCE_INVALID',
      'La suma de los importes aplicados no coincide con el importe total del pago.',
      422,
      { total_pago: Number(pago.total), total_aplicado: totalAplicado }
    );
  }
  const relatedUuids = apRows.map((application) => String(application.uuid_factura).toLowerCase());
  if (new Set(relatedUuids).size !== relatedUuids.length) {
    throw new PagoComplementValidationError(
      'PAYMENT_APPLICATION_INVALID',
      'El complemento contiene más de una aplicación para el mismo UUID relacionado.',
      422
    );
  }

  const complementData: PagoComplementData = {
    empresa: {
      rfc: pago.empresa_rfc,
      razon_social: pago.empresa_nombre,
      regimen_fiscal: pago.empresa_regimen,
      codigo_postal_id: pago.empresa_cp,
    },
    receptor: {
      rfc: receptorFiscal.rfc,
      nombre: receptorFiscal.nombre,
      regimen_fiscal: receptorFiscal.regimenFiscal,
      codigo_postal: receptorFiscal.domicilioFiscal,
    },
    pago: {
      serie: pago.serie,
      folio: pago.numero,
      monto: Number(pago.total),
      forma_pago: pago.forma_pago!,
      moneda: pago.moneda,
      tipo_cambio: Number(pago.tipo_cambio || 1),
      fecha: pago.fecha_documento,
    },
    aplicaciones,
  };

  // 7) Construir payload y timbrar con Facturama
  let payload;
  try {
    payload = buildPagoComplementPayload(complementData);
  } catch (error) {
    throw new CfdiValidationError(
      error instanceof Error
        ? error.message
        : 'El complemento de pago contiene datos fiscales incompletos y no puede enviarse a Facturama.'
    );
  }
  const facturama = await FacturamaClient.fromDatabaseOrEnv();

  let xmlTimbrado: string;
  let response: FacturamaStampResponse;
  let pacId: string | null = null;
  let pacModalidad: 'lite' | 'web' | null = null;
  let intentoId: number | undefined;

  try {
    const stamped = await facturama.stampPagoComplement(payload, { empresaId, documentoId });
    xmlTimbrado = stamped.xmlTimbrado;
    response = stamped.response;
    pacId = stamped.pacId || null;
    pacModalidad = stamped.pacModalidad || null;
    intentoId = stamped.intentoId;
  } catch (error: any) {
    if (error?.isFacturamaValidation && typeof error?.message === 'string' && error.message.trim()) {
      throw new CfdiValidationError(error.message.trim());
    }
    throw error;
  }

  // 8) Extraer datos del timbre del XML timbrado
  const timbre = parseTimbre(xmlTimbrado, response);
  if (!timbre.uuid) {
    throw new CfdiValidationError(
      'Facturama no regresó UUID en el timbre del complemento de pago.'
    );
  }

  // 9) Persistir — mismo patrón que guardarTimbrado en cfdi.service.ts:
  //    INSERT estándar + catch 23505 para manejar conflictos de PK.
  const fechaTimbrado = timbre.fechaTimbrado ? new Date(timbre.fechaTimbrado) : new Date();
  let persistido: TimbradoPersisted;

  try {
    const { rows } = await pool.query<TimbradoPersisted>(
      `INSERT INTO public.documentos_cfdi (
          documento_id, uuid, fecha_timbrado, version_cfdi,
          serie_cfdi, folio_cfdi, no_certificado, no_certificado_sat, sello_cfdi, sello_sat,
          cadena_original, xml_timbrado, qr_url,
          estado_sat, rfc_proveedor_certificacion,
          rfc_emisor, rfc_receptor, total, pac, pac_id, pac_modalidad
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
        RETURNING *`,
      [
        documentoId,
        timbre.uuid,
        fechaTimbrado,
        '4.0',
        pago.serie,
        pago.numero !== null ? String(pago.numero) : null,
        timbre.noCertificado || null,
        timbre.noCertificadoSat || null,
        timbre.selloCfd || null,
        timbre.selloSat || null,
        timbre.cadenaOriginal || null,
        xmlTimbrado,
        (response as any)?.QrUrl || (response as any)?.QrCode || null,
        'vigente',
        timbre.rfcProveedorCertificacion || null,
        pago.empresa_rfc,
        receptorFiscal.rfc,
        Number(pago.total),
        'facturama',
        pacId,
        pacModalidad,
      ]
    );
    persistido = rows[0];
    if (intentoId) {
      await actualizarIntentoTimbrado(intentoId, 'persistido', { uuid: timbre.uuid });
    }
  } catch (err: any) {
    if (err?.code === '23505') {
      throw new CfdiValidationError(
        'Este complemento de pago ya fue timbrado y no puede timbrarse nuevamente.'
      );
    }
    throw err;
  }

  // 10) Marcar el pago como timbrado (solo estatus_documento, no saldo)
  await marcarPagoTimbrado(documentoId);

  return {
    xmlGenerado: JSON.stringify(payload),
    xmlTimbrado,
    timbre: persistido,
    facturamaResponse: response,
  };
}
