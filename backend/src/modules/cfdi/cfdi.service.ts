import { convert } from 'xmlbuilder2';
import { XMLParser } from 'fast-xml-parser';
import pool from '../../config/database';
import { CfdiBuilder } from './cfdi.builder';
import { FacturamaClient } from './facturama.client';
import {
  enmascararRfc,
  extraerEmisorCfdi,
  validarRfcEmisorRecibido,
} from './cfdi-emisor.validation';
import { actualizarIntentoTimbrado } from './cfdi-timbrado-intentos.repository';
import type {
  CfdiBuildOptions,
  CfdiInvoiceData,
  CfdiPartida,
  FacturamaStampResponse,
  TimbradoPersisted,
  TimbrarFacturaResult,
  TimbreFiscalDigitalData,
} from './cfdi.types';

export class CfdiValidationError extends Error {}
export class CfdiConfigurationError extends Error {}

const ensure = (condition: any, message: string): void => {
  if (!condition) throw new CfdiValidationError(message);
};

const limpiarPacId = (value: unknown): string | null => {
  const normalized = String(value ?? '').trim();
  return normalized || null;
};

/**
 * Lanza CfdiValidationError si el documento tiene un intento de cancelación
 * en estado externo_ok_interno_pendiente (CFDI cancelado en SAT, pendiente de
 * sincronización interna). No tiene sentido timbrar en ese estado.
 */
async function assertDocumentoSinCancelacionPendiente(documentoId: number, empresaId: number): Promise<void> {
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

async function assertDocumentoSinTimbradoPendiente(documentoId: number, empresaId: number): Promise<void> {
  const { rows } = await pool.query<{ intento_id: number }>(
    `SELECT id AS intento_id
       FROM public.cfdi_intentos_timbrado
      WHERE documento_id = $1
        AND empresa_id = $2
        AND estado IN (
          'aceptado_pendiente_descarga',
          'xml_recuperado',
          'error_descarga',
          'error_validacion'
        )
      ORDER BY created_at DESC
      LIMIT 1`,
    [documentoId, empresaId]
  );
  if (rows[0]) {
    throw new CfdiValidationError(
      'Facturama ya aceptó un intento para este documento. No vuelva a timbrar; el documento requiere reconciliación.'
    );
  }
}

export class CfdiService {
  constructor(private readonly builder = new CfdiBuilder()) {}

  async timbrarFactura(documentoId: number, empresaId: number): Promise<TimbrarFacturaResult> {
    return this.timbrarDocumento(documentoId, empresaId);
  }

  async timbrarDocumento(documentoId: number, empresaId: number): Promise<TimbrarFacturaResult> {
    await assertDocumentoSinCancelacionPendiente(documentoId, empresaId);
    await assertDocumentoSinTimbradoPendiente(documentoId, empresaId);

    const data = await this.obtenerDocumentoTimbrable(documentoId, empresaId);
    this.validarDatos(data);

    await this.assertDocumentoNoTimbrado(documentoId, empresaId);
    await this.assertNoCfdi(documentoId);

    const buildOptions = await this.resolverBuildOptions(data, empresaId);
    const { xml } = this.builder.build(data, buildOptions);

    const facturama = await FacturamaClient.fromDatabaseOrEnv();

    let xmlTimbrado: string;
    let response: FacturamaStampResponse;
    let intentoId: number | undefined;
    try {
      const stamped = await facturama.stampXml(xml, {
        expectedIssuerRfc: data.empresa.rfc,
        empresaId,
        documentoId,
        serie: data.documento.serie,
        folio: data.documento.numero,
      });
      xmlTimbrado = stamped.xmlTimbrado;
      response = stamped.response;
      intentoId = stamped.intentoId;
    } catch (error: any) {
      if (error?.isFacturamaValidation && typeof error?.message === 'string' && error.message.trim()) {
        throw new CfdiValidationError(error.message.trim());
      }
      throw error;
    }

    if (!xmlTimbrado || !xmlTimbrado.trim()) {
      throw new CfdiValidationError('Facturama no regresó XML timbrado.');
    }

    let emisorRecibido;
    try {
      emisorRecibido = validarRfcEmisorRecibido(xmlTimbrado, data.empresa.rfc);
    } catch (error) {
      let datosRecibidos: ReturnType<typeof validarRfcEmisorRecibido> | null = null;
      try {
        datosRecibidos = extraerEmisorCfdi(xmlTimbrado);
      } catch (_) {
        // El XML inválido también debe bloquearse sin registrar su contenido.
      }
      console.error('[CFDI][CRITICO] Emisor devuelto por Facturama no válido', {
        empresaId,
        documentoId,
        rfcEsperado: enmascararRfc(data.empresa.rfc),
        rfcRecibido: enmascararRfc(datosRecibidos?.rfc),
        uuid: datosRecibidos?.uuid || null,
        noCertificado: datosRecibidos?.noCertificado || null,
        coincide: false,
      });
      throw new CfdiValidationError(
        error instanceof Error
          ? error.message
          : 'Facturama devolvió un CFDI con un emisor no válido. El timbrado no fue guardado.'
      );
    }

    console.info('[CFDI][Facturama] Emisor recibido validado', {
      empresaId,
      documentoId,
      rfcRecibido: enmascararRfc(emisorRecibido.rfc),
      uuid: emisorRecibido.uuid || null,
      noCertificado: emisorRecibido.noCertificado || null,
      coincide: true,
    });

    const advertenciasEmisor = [
      {
        campo: 'Nombre',
        esperado: String(data.empresa.razon_social ?? '').trim().toUpperCase(),
        recibido: emisorRecibido.nombre.toUpperCase(),
      },
      {
        campo: 'RegimenFiscal',
        esperado: String(data.empresa.regimen_fiscal ?? '').trim(),
        recibido: emisorRecibido.regimenFiscal,
      },
      {
        campo: 'LugarExpedicion',
        esperado: String(data.empresa.codigo_postal_id ?? '').trim(),
        recibido: emisorRecibido.lugarExpedicion,
      },
    ].filter(({ esperado, recibido }) => esperado && recibido && esperado !== recibido);

    if (advertenciasEmisor.length > 0) {
      console.warn('[CFDI][Facturama] Diferencias no bloqueantes en datos del emisor', {
        empresaId,
        documentoId,
        campos: advertenciasEmisor.map(({ campo }) => campo),
      });
    }

    const timbre = this.extraerTimbre(xmlTimbrado, response);
    if (!timbre.uuid) {
      throw new CfdiValidationError('No se encontró UUID del timbre.');
    }

    const persistido = await this.guardarTimbrado(documentoId, empresaId, xmlTimbrado, timbre, response, intentoId);

    return {
      xmlGenerado: xml,
      xmlTimbrado,
      timbre: persistido,
      facturamaResponse: response,
    };
  }

  private async obtenerDocumentoTimbrable(documentoId: number, empresaId: number): Promise<CfdiInvoiceData> {
    const { rows: documentoRows } = await pool.query(
      `SELECT d.id, d.empresa_id, d.tipo_documento, d.motivo_nc, d.documento_origen_id,
              d.serie, d.numero, d.fecha_documento, d.moneda, d.subtotal, d.iva, d.total,
              d.forma_pago, d.metodo_pago, d.uso_cfdi, d.rfc_receptor, d.nombre_receptor, d.regimen_fiscal_receptor, d.codigo_postal_receptor,
              d.tratamiento_impuestos, d.periodicidad_global, d.meses_global, d.anio_global,
              e.razon_social, e.rfc, e.regimen_fiscal_id AS regimen_fiscal, e.codigo_postal_id
         FROM documentos d
         JOIN core.empresas e ON e.id = d.empresa_id
        WHERE d.id = $1
          AND d.empresa_id = $2
          AND LOWER(d.tipo_documento) IN ('factura', 'nota_credito')
        LIMIT 1`,
      [documentoId, empresaId]
    );

    const documento = documentoRows[0];
    if (!documento) {
      throw new CfdiValidationError('Documento timbrable no encontrado o no pertenece a la empresa.');
    }

    const tipoDocumento = String(documento.tipo_documento || '').trim().toLowerCase();
    if (tipoDocumento !== 'factura' && tipoDocumento !== 'nota_credito') {
      throw new CfdiValidationError('Solo se permite timbrar facturas y notas de crédito.');
    }

    const tratamiento = String(documento.tratamiento_impuestos || '').trim().toLowerCase();
    if (tratamiento === 'venta_publico_general') {
      throw new CfdiValidationError(
        'Las ventas de público general no se timbran individualmente. Genera una factura global para el período correspondiente.'
      );
    }

    if (tipoDocumento === 'nota_credito') {
      const motivoNc = String(documento.motivo_nc || '').trim().toLowerCase();
      if (!['bonificacion', 'devolucion', 'otro'].includes(motivoNc)) {
        throw new CfdiValidationError('Por ahora solo se permite timbrar notas de crédito con motivo Bonificación, Devolución o Otro.');
      }
    }

    const partidas = await this.obtenerPartidas(documentoId);

    return {
      documento: {
        id: documento.id,
        empresa_id: documento.empresa_id,
        tipo_documento: documento.tipo_documento,
        motivo_nc: documento.motivo_nc,
        documento_origen_id: documento.documento_origen_id,
        serie: documento.serie,
        numero: documento.numero,
        fecha_documento: documento.fecha_documento,
        moneda: documento.moneda || 'MXN',
        subtotal: Number(documento.subtotal),
        iva: Number(documento.iva ?? 0),
        total: Number(documento.total),
        forma_pago: documento.forma_pago,
        metodo_pago: documento.metodo_pago,
        uso_cfdi: documento.uso_cfdi,
        rfc_receptor: documento.rfc_receptor,
        nombre_receptor: documento.nombre_receptor,
        regimen_fiscal_receptor: documento.regimen_fiscal_receptor,
        codigo_postal_receptor: documento.codigo_postal_receptor,
        tratamiento_impuestos: documento.tratamiento_impuestos ?? null,
        periodicidad_global: documento.periodicidad_global ?? null,
        meses_global: documento.meses_global ?? null,
        anio_global: documento.anio_global ? Number(documento.anio_global) : null,
      },
      empresa: {
        id: documento.empresa_id,
        razon_social: documento.razon_social,
        rfc: documento.rfc,
        regimen_fiscal: documento.regimen_fiscal,
        codigo_postal_id: documento.codigo_postal_id,
      },
      partidas,
    };
  }

  private async obtenerPartidas(documentoId: number): Promise<CfdiPartida[]> {
    const { rows: partidasRows } = await pool.query(
      `SELECT dp.id,
              dp.cantidad,
              dp.precio_unitario,
              dp.subtotal_partida,
              COALESCE(dp.descripcion_alterna, p.descripcion) AS descripcion,
              p.clave_producto_sat,
              COALESCE(p.clave_unidad_sat, su.clave) AS clave_unidad_sat
         FROM documentos_partidas dp
         LEFT JOIN productos p ON p.id = dp.producto_id
         LEFT JOIN unidades u ON u.id = p.unidad_venta_id
         LEFT JOIN sat.unidades su ON su.id = u.unidad_sat_id
        WHERE dp.documento_id = $1
        ORDER BY dp.numero_partida ASC`,
      [documentoId]
    );

    const partidasIds = partidasRows.map((p) => p.id);
    let impuestosPorPartida: Record<number, {
      impuesto: string;
      tipo: string;
      tasa: number;
      base: number;
      monto: number;
    }[]> = {};

    if (partidasIds.length > 0) {
      const { rows: impuestosRows } = await pool.query(
        `SELECT partida_id,
                impuesto_id    AS impuesto,
                i.tipo,
                dpi.tasa,
                base,
                monto
           FROM documentos_partidas_impuestos dpi
           LEFT JOIN impuestos i ON i.id = dpi.impuesto_id
          WHERE partida_id = ANY($1::int[])
          ORDER BY partida_id ASC, impuesto_id ASC`,
        [partidasIds]
      );

      impuestosRows.forEach((row) => {
        const list = impuestosPorPartida[row.partida_id] ?? [];
        list.push({
          impuesto: row.impuesto,
          tipo: row.tipo,
          tasa: Number(row.tasa),
          base: Number(row.base),
          monto: Number(row.monto),
        });
        impuestosPorPartida[row.partida_id] = list;
      });
    }

    return partidasRows.map((p) => ({
      id: p.id,
      cantidad: Number(p.cantidad),
      precio_unitario: Number(p.precio_unitario),
      subtotal_partida: Number(p.subtotal_partida),
      descripcion: p.descripcion,
      clave_producto_sat: p.clave_producto_sat,
      clave_unidad_sat: p.clave_unidad_sat,
      impuestos: impuestosPorPartida[p.id],
    }));
  }

  private async resolverBuildOptions(data: CfdiInvoiceData, empresaId: number): Promise<CfdiBuildOptions> {
    const tipoDocumento = String(data.documento.tipo_documento || '').trim().toLowerCase();
    if (tipoDocumento === 'nota_credito') {
      const motivoNc = String(data.documento.motivo_nc || '').trim().toLowerCase();
      if (motivoNc === 'otro') {
        return {
          cfdiType: 'E',
        };
      }

      return {
        cfdiType: 'E',
        relations: await this.resolverNcRelations(data.documento.documento_origen_id, empresaId),
      };
    }

    const tratamiento = String(data.documento.tratamiento_impuestos || '').trim().toLowerCase();
    const rfcReceptor = String(data.documento.rfc_receptor || '').toUpperCase();
    const esFacturaGlobal =
      tratamiento === 'factura_global' &&
      (rfcReceptor === 'XAXX010101000' || rfcReceptor === 'XEXX010101000');

    if (esFacturaGlobal) {
      const periodicity = String(data.documento.periodicidad_global || '04').padStart(2, '0');
      const months = String(data.documento.meses_global || '01').padStart(2, '0');
      const year = String(data.documento.anio_global || new Date().getFullYear());
      return {
        cfdiType: 'I',
        globalInformation: { periodicity, months, year },
      };
    }

    return {
      cfdiType: 'I',
    };
  }

  private async resolverNcRelations(documentoOrigenId: number | null | undefined, empresaId: number) {
    const origenId = Number(documentoOrigenId);
    ensure(Number.isFinite(origenId) && origenId > 0, 'La nota de crédito no tiene factura origen relacionada.');

    const { rows } = await pool.query<{ uuid: string | null }>(
      `SELECT dc.uuid
         FROM documentos origen
         LEFT JOIN documentos_cfdi dc ON dc.documento_id = origen.id
        WHERE origen.id = $1
          AND origen.empresa_id = $2
          AND LOWER(COALESCE(origen.tipo_documento, '')) = 'factura'
        LIMIT 1`,
      [origenId, empresaId]
    );

    if (!rows.length) {
      throw new CfdiValidationError('La factura origen no existe o no pertenece a la empresa.');
    }

    const uuid = String(rows[0]?.uuid || '').trim();
    if (!uuid) {
      throw new CfdiValidationError('La factura origen aún no está timbrada');
    }

    return {
      type: '01',
      cfdis: [{ uuid }],
    };
  }

  private validarDatos(data: CfdiInvoiceData) {
    ensure(data.documento.rfc_receptor, 'RFC del receptor es requerido.');
    ensure(data.documento.regimen_fiscal_receptor, 'Régimen fiscal del receptor es requerido.');
    ensure(data.documento.codigo_postal_receptor, 'Código postal del receptor es requerido.');
    ensure(data.documento.uso_cfdi, 'Uso CFDI es requerido.');
    ensure(data.documento.forma_pago, 'Forma de pago es requerida.');
    ensure(data.documento.metodo_pago, 'Método de pago es requerido.');

    ensure(data.empresa.rfc, 'RFC del emisor es requerido.');
    ensure(data.empresa.regimen_fiscal, 'Régimen fiscal del emisor es requerido.');
    ensure(data.empresa.codigo_postal_id, 'Lugar de expedición (CP emisor) es requerido.');

    data.partidas.forEach((p, idx) => {
      ensure(p.clave_producto_sat, `Partida ${idx + 1} sin ClaveProdServ (clave_producto_sat).`);
      ensure(p.clave_unidad_sat, `Partida ${idx + 1} sin ClaveUnidad (clave_unidad_sat).`);
      ensure(p.descripcion, `Partida ${idx + 1} sin descripción.`);
      ensure(p.cantidad > 0, `Partida ${idx + 1} con cantidad inválida.`);
    });
  }

  private extraerTimbre(xmlTimbrado: string, response: FacturamaStampResponse): TimbreFiscalDigitalData {
    const parsed = convert(xmlTimbrado, { format: 'object' }) as any;
    const comprobante = parsed?.['cfdi:Comprobante'] || parsed?.Comprobante;
    const compAttrs = comprobante?.['@'] || {};
    const complemento = comprobante?.['cfdi:Complemento'] || comprobante?.Complemento;
    const timbre = complemento?.['tfd:TimbreFiscalDigital'] || complemento?.TimbreFiscalDigital;
    const timbreAttrs = timbre?.['@'] || {};

    console.log('[cfdi] extraerTimbre -> timbreAttrs.UUID:', timbreAttrs?.UUID);
    console.log('[cfdi] extraerTimbre -> response.uuid:', (response as any)?.uuid);
    console.log('[cfdi] extraerTimbre -> response.Complement?.TaxStamp?.Uuid:', (response as any)?.Complement?.TaxStamp?.Uuid);
    console.log('[cfdi] extraerTimbre -> response keys:', Object.keys(response || {}));

    const uuid =
      timbreAttrs?.UUID ||
      (response as any)?.uuid ||
      (response as any)?.Uuid ||
      (response as any)?.Complement?.TaxStamp?.Uuid;

    const fechaTimbrado =
      timbreAttrs?.FechaTimbrado ||
      (response as any)?.Complement?.TaxStamp?.Date;

    const version = compAttrs?.Version || timbreAttrs?.Version || '4.0';
    const rfcProveedorCertificacion =
      timbreAttrs?.RfcProvCertif ||
      (response as any)?.Complement?.TaxStamp?.RfcProvCertif ||
      null;

    console.log('[cfdi] UUID final extraído:', uuid);

    return {
      uuid,
      fechaTimbrado,
      selloCfd: timbreAttrs.SelloCFD || response.SelloCFD,
      selloSat: timbreAttrs.SelloSAT || response.SelloSAT,
      noCertificadoSat: timbreAttrs.NoCertificadoSAT || response.NoCertificadoSat || response.NoCertificadoSAT,
      version,
      cadenaOriginal: response.CadenaOriginal || null,
      serie: compAttrs.Serie || response.Serie || null,
      folio: compAttrs.Folio || response.Folio || null,
      noCertificado: compAttrs.NoCertificado || response.NoCertificado || null,
      rfcProveedorCertificacion,
      estadoSat: response.Estado || null,
    };
  }

  private async guardarTimbrado(
    documentoId: number,
    empresaId: number,
    xmlTimbrado: string,
    timbre: TimbreFiscalDigitalData,
    response: FacturamaStampResponse,
    intentoId?: number
  ): Promise<TimbradoPersisted> {
    const fechaTimbrado = timbre.fechaTimbrado ? new Date(timbre.fechaTimbrado) : new Date();

    // Parsear XML timbrado para extraer rfc_emisor, rfc_receptor y total de forma robusta.
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      removeNSPrefix: true,
      trimValues: true,
    });

    let rfcEmisor: string | null = null;
    let rfcReceptor: string | null = null;
    let totalComprobante: number | null = null;

    try {
      const parsed = parser.parse(xmlTimbrado);
      const comprobante = parsed?.['cfdi:Comprobante'] || parsed?.Comprobante;
      const emisor = comprobante?.['cfdi:Emisor'] || comprobante?.Emisor;
      const receptor = comprobante?.['cfdi:Receptor'] || comprobante?.Receptor;

      rfcEmisor = emisor?.Rfc || null;
      rfcReceptor = receptor?.Rfc || null;
      const totalRaw = comprobante?.Total;
      const totalNumber = totalRaw !== undefined ? Number(totalRaw) : NaN;
      totalComprobante = Number.isFinite(totalNumber) ? totalNumber : null;
    } catch (err) {
      console.error('[cfdi] No se pudo parsear xmlTimbrado para RFC/Total:', err);
    }

    const values = [
      documentoId,
      timbre.uuid,
      fechaTimbrado,
      timbre.version || (response as any)?.Version || '4.0',
      timbre.serie || (response as any)?.Serie || null,
      timbre.folio || (response as any)?.Folio || null,
      (response as any)?.CertNumber || timbre.noCertificado || null,
      (response as any)?.Complement?.TaxStamp?.SatCertNumber || timbre.noCertificadoSat || null,
      (response as any)?.Complement?.TaxStamp?.CfdiSign || timbre.selloCfd || null,
      (response as any)?.Complement?.TaxStamp?.SatSign || timbre.selloSat || null,
      (response as any)?.OriginalString || timbre.cadenaOriginal || (response as any)?.CadenaOriginal || null,
      xmlTimbrado,
      response.QrUrl || response.QrCode || null,
      'vigente',
      timbre.rfcProveedorCertificacion || (response as any)?.Complement?.TaxStamp?.RfcProvCertif || null,
      rfcEmisor,
      rfcReceptor,
      totalComprobante,
      'facturama',
      limpiarPacId((response as any)?.Id),
      limpiarPacId((response as any)?.Id) ? 'lite' : null,
    ];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const pre = await client.query(
        `SELECT d.estatus_documento, dc.uuid
           FROM public.documentos d
           LEFT JOIN public.documentos_cfdi dc ON dc.documento_id = d.id
          WHERE d.id = $1 AND d.empresa_id = $2
          FOR UPDATE OF d`,
        [documentoId, empresaId]
      );
      if (!pre.rowCount) {
        throw new CfdiValidationError('Documento no encontrado para persistir el timbrado.');
      }
      if (pre.rows[0]?.uuid || String(pre.rows[0]?.estatus_documento || '').toLowerCase() === 'timbrado') {
        throw new CfdiValidationError('Este documento ya fue timbrado y no puede timbrarse nuevamente.');
      }
      const uuidDuplicado = await client.query(
        'SELECT documento_id FROM public.documentos_cfdi WHERE LOWER(uuid) = LOWER($1) LIMIT 1',
        [timbre.uuid]
      );
      if (uuidDuplicado.rowCount) {
        throw new CfdiValidationError('El UUID devuelto por Facturama ya está vinculado a otro documento.');
      }

      const { rows } = await client.query<TimbradoPersisted>(
        `INSERT INTO public.documentos_cfdi (
            documento_id, uuid, fecha_timbrado, version_cfdi, serie_cfdi, folio_cfdi,
            no_certificado, no_certificado_sat, sello_cfdi, sello_sat, cadena_original,
            xml_timbrado, qr_url, estado_sat, rfc_proveedor_certificacion,
            rfc_emisor, rfc_receptor, total, pac, pac_id, pac_modalidad
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
          RETURNING *`,
        values
      );

      await client.query(
        `UPDATE public.documentos
            SET estatus_documento = 'Timbrado',
                saldo = COALESCE(total, 0)
          WHERE id = $1 AND empresa_id = $2`,
        [documentoId, empresaId]
      );
      if (intentoId) {
        await actualizarIntentoTimbrado(intentoId, 'persistido', { uuid: timbre.uuid }, client);
      }
      await client.query('COMMIT');
      return rows[0];
    } catch (err: any) {
      await client.query('ROLLBACK');
      // Defensa contra condiciones de carrera: si ya existe un timbre, no sobrescribir.
      if (err?.code === '23505') {
        throw new CfdiValidationError('Este documento ya fue timbrado y no puede timbrarse nuevamente.');
      }
      throw err;
    } finally {
      client.release();
    }
  }

  private async assertNoCfdi(documentoId: number): Promise<void> {
    console.log('[cfdi-debug] documentoId recibido (assertNoCfdi):', documentoId);
    const { rows } = await pool.query<{ uuid: string | null }>(
      'SELECT uuid FROM public.documentos_cfdi WHERE documento_id = $1 LIMIT 1',
      [documentoId]
    );

    console.log('[cfdi-debug] SQL documentos_cfdi: SELECT uuid FROM public.documentos_cfdi WHERE documento_id = $1 LIMIT 1; params:', [documentoId]);
    console.log('[cfdi-debug] resultado documentos_cfdi:', rows);

    const existente = rows[0]?.uuid;
    if (existente && String(existente).trim().length > 0) {
      throw new CfdiValidationError('Este documento ya fue timbrado y no puede timbrarse nuevamente.');
    }
  }

  private async assertDocumentoNoTimbrado(documentoId: number, empresaId: number): Promise<void> {
    const { rows } = await pool.query<{ estatus_documento: string | null }>(
      `SELECT estatus_documento
         FROM public.documentos
        WHERE id = $1 AND empresa_id = $2
        LIMIT 1`,
      [documentoId, empresaId]
    );

    console.log('[cfdi-debug] SQL estatus_documento: SELECT estatus_documento FROM public.documentos WHERE id = $1 AND empresa_id = $2 LIMIT 1; params:', [documentoId, empresaId]);
    console.log('[cfdi-debug] estatus_documento consultado:', rows);

    const estatus = rows[0]?.estatus_documento?.toLowerCase?.() ?? null;
    if (estatus === 'timbrado') {
      throw new CfdiValidationError('Este documento ya fue timbrado y no puede timbrarse nuevamente.');
    }
  }

}

export const cfdiService = new CfdiService();
