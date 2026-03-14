import { convert } from 'xmlbuilder2';
import { XMLParser } from 'fast-xml-parser';
import pool from '../../config/database';
import { CfdiBuilder } from './cfdi.builder';
import { FacturamaClient } from './facturama.client';
import type {
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

export class CfdiService {
  constructor(private readonly builder = new CfdiBuilder()) {}

  async timbrarFactura(documentoId: number, empresaId: number): Promise<TimbrarFacturaResult> {
    const data = await this.obtenerFactura(documentoId, empresaId);
    this.validarDatos(data);

    // Validaciones: impedir timbrar si ya existe CFDI o si el documento ya está marcado como timbrado
    await this.assertDocumentoNoTimbrado(documentoId, empresaId);
    await this.assertNoCfdi(documentoId);

    const { xml } = this.builder.build(data);

    const facturama = FacturamaClient.fromEnv();
    const { xmlTimbrado, response } = await facturama.stampXml(xml);

    if (!xmlTimbrado || !xmlTimbrado.trim()) {
      throw new CfdiValidationError('Facturama no regresó XML timbrado.');
    }

    const timbre = this.extraerTimbre(xmlTimbrado, response);
    if (!timbre.uuid) {
      throw new CfdiValidationError('No se encontró UUID del timbre.');
    }

    const persistido = await this.guardarTimbrado(documentoId, xmlTimbrado, timbre, response);

    // Marcar el documento como timbrado
    await this.marcarDocumentoTimbrado(documentoId);

    return {
      xmlGenerado: xml,
      xmlTimbrado,
      timbre: persistido,
      facturamaResponse: response,
    };
  }

  private async obtenerFactura(documentoId: number, empresaId: number): Promise<CfdiInvoiceData> {
    const { rows: documentoRows } = await pool.query(
      `SELECT d.id, d.empresa_id, d.serie, d.numero, d.fecha_documento, d.moneda, d.subtotal, d.iva, d.total,
              d.forma_pago, d.metodo_pago, d.uso_cfdi, d.rfc_receptor, d.nombre_receptor, d.regimen_fiscal_receptor, d.codigo_postal_receptor,
              e.razon_social, e.rfc, e.regimen_fiscal, e.codigo_postal_id
         FROM documentos d
         JOIN core.empresas e ON e.id = d.empresa_id
        WHERE d.id = $1
          AND d.empresa_id = $2
          AND LOWER(d.tipo_documento) = 'factura'
        LIMIT 1`,
      [documentoId, empresaId]
    );

    const documento = documentoRows[0];
    if (!documento) {
      throw new CfdiValidationError('Factura no encontrada o no pertenece a la empresa.');
    }

    const { rows: partidasRows } = await pool.query(
      `SELECT dp.id,
              dp.cantidad,
              dp.precio_unitario,
              dp.subtotal_partida,
              dp.iva_porcentaje,
              dp.iva_monto,
              COALESCE(dp.descripcion_alterna, p.descripcion) AS descripcion,
              p.clave_producto_sat,
              p.clave_unidad_sat
         FROM documentos_partidas dp
         LEFT JOIN productos p ON p.id = dp.producto_id
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
                tipo,
                tasa,
                base,
                monto
           FROM documentos_partidas_impuestos
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

    const partidas: CfdiPartida[] = partidasRows.map((p) => ({
      id: p.id,
      cantidad: Number(p.cantidad),
      precio_unitario: Number(p.precio_unitario),
      subtotal_partida: Number(p.subtotal_partida),
      iva_porcentaje: p.iva_porcentaje != null ? Number(p.iva_porcentaje) : null,
      iva_monto: p.iva_monto != null ? Number(p.iva_monto) : null,
      descripcion: p.descripcion,
      clave_producto_sat: p.clave_producto_sat,
      clave_unidad_sat: p.clave_unidad_sat,
      impuestos: impuestosPorPartida[p.id],
    }));

    return {
      documento: {
        id: documento.id,
        empresa_id: documento.empresa_id,
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
    xmlTimbrado: string,
    timbre: TimbreFiscalDigitalData,
    response: FacturamaStampResponse
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
    ];

    try {
      const pre = await pool.query('SELECT 1 FROM public.documentos_cfdi WHERE documento_id = $1 LIMIT 1', [documentoId]);
      if (pre.rowCount && pre.rowCount > 0) {
        throw new CfdiValidationError('Esta factura ya fue timbrada y no puede timbrarse nuevamente.');
      }

      const { rows } = await pool.query<TimbradoPersisted>(
        `INSERT INTO public.documentos_cfdi (
            documento_id, uuid, fecha_timbrado, version_cfdi, serie_cfdi, folio_cfdi,
            no_certificado, no_certificado_sat, sello_cfdi, sello_sat, cadena_original,
            xml_timbrado, qr_url, estado_sat, rfc_proveedor_certificacion,
            rfc_emisor, rfc_receptor, total
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
          RETURNING *`,
        values
      );

      return rows[0];
    } catch (err: any) {
      // Defensa contra condiciones de carrera: si ya existe un timbre, no sobrescribir.
      if (err?.code === '23505') {
        throw new CfdiValidationError('Esta factura ya fue timbrada y no puede timbrarse nuevamente.');
      }
      throw err;
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
      throw new CfdiValidationError('Esta factura ya fue timbrada y no puede timbrarse nuevamente.');
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
      throw new CfdiValidationError('Esta factura ya fue timbrada y no puede timbrarse nuevamente.');
    }
  }

  private async marcarDocumentoTimbrado(documentoId: number): Promise<void> {
    try {
      const { rowCount } = await pool.query(
        `UPDATE documentos
            SET estatus_documento = 'Timbrado',
                saldo = COALESCE(total, 0)
          WHERE id = $1
            AND (estatus_documento IS NULL OR LOWER(estatus_documento) <> 'timbrado')`,
        [documentoId]
      );

      if (!rowCount) {
        console.log('[cfdi] Documento ya estaba timbrado, no se actualizó estatus/saldo', { documentoId });
      }
    } catch (err) {
      console.error('[cfdi] No se pudo actualizar estatus_documento a Timbrado', err);
      throw err;
    }
  }
}

export const cfdiService = new CfdiService();
