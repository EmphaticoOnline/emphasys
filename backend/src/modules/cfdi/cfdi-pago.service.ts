import { XMLParser } from 'fast-xml-parser';
import pool from '../../config/database';
import { FacturamaClient } from './facturama.client';
import { buildPagoComplementPayload } from './pago-complement.builder';
import { CfdiValidationError } from './cfdi.service';
import type {
  ImpuestoDR,
  AplicacionComplemento,
  PagoComplementData,
  TimbradoPersisted,
  TimbrarFacturaResult,
  TimbreFiscalDigitalData,
  FacturamaStampResponse,
} from './cfdi.types';

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

export async function timbrarComplementoPago(
  documentoId: number,
  empresaId: number
): Promise<TimbrarFacturaResult> {

  // 1) Guard: no timbrar si hay cancelación CFDI pendiente de sincronización
  await assertDocumentoSinCancelacionPendiente(documentoId, empresaId);

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
  }>(
    `SELECT d.id, d.empresa_id, d.tipo_documento,
            d.moneda, d.tipo_cambio, d.total,
            d.forma_pago, d.fecha_documento,
            d.rfc_receptor, d.nombre_receptor,
            d.regimen_fiscal_receptor, d.codigo_postal_receptor,
            e.rfc AS empresa_rfc, e.razon_social AS empresa_nombre,
            e.regimen_fiscal_id AS empresa_regimen,
            e.codigo_postal_id AS empresa_cp
       FROM documentos d
       JOIN core.empresas e ON e.id = d.empresa_id
      WHERE d.id = $1 AND d.empresa_id = $2 AND d.tipo_documento = 'pago_cliente'`,
    [documentoId, empresaId]
  );

  const pago = pagoRows[0];
  if (!pago) {
    throw new CfdiValidationError('Pago no encontrado o tipo de documento inválido.');
  }
  if (!pago.forma_pago) {
    throw new CfdiValidationError(
      'El pago no tiene Forma de Pago asignada (requerida para Complemento de Pagos).'
    );
  }
  // Auto-heredar datos fiscales de la primera factura aplicada si el pago no los tiene
  if (!pago.rfc_receptor || !pago.nombre_receptor || !pago.regimen_fiscal_receptor || !pago.codigo_postal_receptor) {
    const { rows: fiscalRows } = await pool.query<{
      rfc_receptor: string | null;
      nombre_receptor: string | null;
      regimen_fiscal_receptor: string | null;
      codigo_postal_receptor: string | null;
    }>(
      `SELECT f.rfc_receptor, f.nombre_receptor, f.regimen_fiscal_receptor, f.codigo_postal_receptor
         FROM aplicaciones_saldo a
         JOIN documentos f ON f.id = a.documento_destino_id
        WHERE a.documento_origen_id = $1 AND a.empresa_id = $2
          AND f.rfc_receptor IS NOT NULL
        ORDER BY a.id ASC
        LIMIT 1`,
      [documentoId, empresaId]
    );

    const fiscal = fiscalRows[0];
    if (fiscal) {
      pago.rfc_receptor = pago.rfc_receptor || fiscal.rfc_receptor;
      pago.nombre_receptor = pago.nombre_receptor || fiscal.nombre_receptor;
      pago.regimen_fiscal_receptor = pago.regimen_fiscal_receptor || fiscal.regimen_fiscal_receptor;
      pago.codigo_postal_receptor = pago.codigo_postal_receptor || fiscal.codigo_postal_receptor;

      await pool.query(
        `UPDATE documentos
            SET rfc_receptor             = COALESCE(rfc_receptor, $2),
                nombre_receptor          = COALESCE(nombre_receptor, $3),
                regimen_fiscal_receptor  = COALESCE(regimen_fiscal_receptor, $4),
                codigo_postal_receptor   = COALESCE(codigo_postal_receptor, $5)
          WHERE id = $1 AND tipo_documento = 'pago_cliente'`,
        [documentoId, fiscal.rfc_receptor, fiscal.nombre_receptor, fiscal.regimen_fiscal_receptor, fiscal.codigo_postal_receptor]
      );
    }
  }

  if (
    !pago.rfc_receptor ||
    !pago.nombre_receptor ||
    !pago.regimen_fiscal_receptor ||
    !pago.codigo_postal_receptor
  ) {
    throw new CfdiValidationError(
      'El receptor del pago no tiene datos fiscales completos (RFC, nombre, régimen fiscal, código postal).'
    );
  }

  // 4) Cargar aplicaciones con los campos fiscales calculados al momento de la aplicación
  const { rows: apRows } = await pool.query<{
    id: number;
    documento_destino_id: number;
    monto_moneda_documento: string;
    num_parcialidad: number | null;
    imp_saldo_ant: string | null;
    imp_saldo_insoluto: string | null;
    uuid_factura: string | null;
    serie_factura: string | null;
    folio_factura: string | null;
    moneda_factura: string;
    tipo_cambio_factura: string;
    total_factura: string;
  }>(
    `SELECT a.id, a.documento_destino_id,
            a.monto_moneda_documento,
            a.num_parcialidad, a.imp_saldo_ant, a.imp_saldo_insoluto,
            dc.uuid AS uuid_factura,
            f.serie AS serie_factura, f.numero::text AS folio_factura,
            f.moneda AS moneda_factura, f.tipo_cambio AS tipo_cambio_factura,
            f.total AS total_factura
       FROM aplicaciones_saldo a
       JOIN documentos f ON f.id = a.documento_destino_id
       LEFT JOIN documentos_cfdi dc ON dc.documento_id = f.id
      WHERE a.documento_origen_id = $1 AND a.empresa_id = $2
      ORDER BY a.id ASC`,
    [documentoId, empresaId]
  );

  if (apRows.length === 0) {
    throw new CfdiValidationError(
      'El pago no tiene facturas aplicadas. Aplique el pago a al menos una factura antes de timbrar.'
    );
  }

  for (const ap of apRows) {
    if (!ap.uuid_factura) {
      throw new CfdiValidationError(
        `La factura ${ap.serie_factura || ''}${ap.folio_factura || ''} (id ${ap.documento_destino_id}) no está timbrada. Timbre todas las facturas relacionadas primero.`
      );
    }
    if (ap.num_parcialidad === null || ap.imp_saldo_ant === null || ap.imp_saldo_insoluto === null) {
      throw new CfdiValidationError(
        `La aplicación a la factura ${ap.uuid_factura} no tiene datos de parcialidad registrados. ` +
        `Fue creada antes de la migración de Pagos 2.0 y no puede timbrarse.`
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
  const aplicaciones: AplicacionComplemento[] = apRows.map((ap) => ({
    uuid_factura: ap.uuid_factura!,
    serie: ap.serie_factura,
    folio: ap.folio_factura,
    moneda_factura: ap.moneda_factura,
    tipo_cambio_factura: Number(ap.tipo_cambio_factura || 1),
    total_factura: Number(ap.total_factura),
    monto_moneda_documento: Number(ap.monto_moneda_documento),
    num_parcialidad: ap.num_parcialidad!,
    imp_saldo_ant: Number(ap.imp_saldo_ant!),
    imp_saldo_insoluto: Number(ap.imp_saldo_insoluto!),
    impuestos: impuestosPorFactura.get(ap.documento_destino_id) ?? [],
  }));

  const complementData: PagoComplementData = {
    empresa: {
      rfc: pago.empresa_rfc,
      razon_social: pago.empresa_nombre,
      regimen_fiscal: pago.empresa_regimen,
      codigo_postal_id: pago.empresa_cp,
    },
    receptor: {
      rfc: pago.rfc_receptor!,
      nombre: pago.nombre_receptor!,
      regimen_fiscal: pago.regimen_fiscal_receptor!,
      codigo_postal: pago.codigo_postal_receptor!,
    },
    pago: {
      monto: Number(pago.total),
      forma_pago: pago.forma_pago!,
      moneda: pago.moneda,
      tipo_cambio: Number(pago.tipo_cambio || 1),
      fecha: pago.fecha_documento,
    },
    aplicaciones,
  };

  // 7) Construir payload y timbrar con Facturama
  const payload = buildPagoComplementPayload(complementData);
  const facturama = await FacturamaClient.fromDatabaseOrEnv();

  let xmlTimbrado: string;
  let response: FacturamaStampResponse;

  try {
    const stamped = await facturama.stampPagoComplement(payload);
    xmlTimbrado = stamped.xmlTimbrado;
    response = stamped.response;
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
          no_certificado_sat, sello_cfdi, sello_sat,
          cadena_original, xml_timbrado, qr_url,
          estado_sat, rfc_proveedor_certificacion,
          rfc_emisor, rfc_receptor, total
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING *`,
      [
        documentoId,
        timbre.uuid,
        fechaTimbrado,
        '4.0',
        timbre.noCertificadoSat || null,
        timbre.selloCfd || null,
        timbre.selloSat || null,
        timbre.cadenaOriginal || null,
        xmlTimbrado,
        (response as any)?.QrUrl || (response as any)?.QrCode || null,
        'vigente',
        timbre.rfcProveedorCertificacion || null,
        pago.empresa_rfc,
        pago.rfc_receptor,
        Number(pago.total),
      ]
    );
    persistido = rows[0];
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
