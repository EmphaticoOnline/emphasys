import { convert } from 'xmlbuilder2';
import { XMLParser } from 'fast-xml-parser';
import pool from '../../config/database';
import { CfdiBuilder } from './cfdi.builder';
import { FacturamaClient } from './facturama.client';
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

export class CfdiService {
  constructor(private readonly builder = new CfdiBuilder()) {}

  async timbrarFactura(documentoId: number, empresaId: number): Promise<TimbrarFacturaResult> {
    return this.timbrarDocumento(documentoId, empresaId);
  }

  async timbrarDocumento(documentoId: number, empresaId: number): Promise<TimbrarFacturaResult> {
    await assertDocumentoSinCancelacionPendiente(documentoId, empresaId);

    const data = await this.obtenerDocumentoTimbrable(documentoId, empresaId);
    this.validarDatos(data);

    await this.assertDocumentoNoTimbrado(documentoId, empresaId);
    await this.assertNoCfdi(documentoId);

    const buildOptions = await this.resolverBuildOptions(data, empresaId);
    const { xml } = this.builder.build(data, buildOptions);

    const facturama = await FacturamaClient.fromDatabaseOrEnv();

    let xmlTimbrado: string;
    let response: FacturamaStampResponse;
    try {
      const stamped = await facturama.stampXml(xml);
      xmlTimbrado = stamped.xmlTimbrado;
      response = stamped.response;
    } catch (error: any) {
      if (error?.isFacturamaValidation && typeof error?.message === 'string' && error.message.trim()) {
        throw new CfdiValidationError(error.message.trim());
      }
      throw error;
    }

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
        throw new CfdiValidationError('Este documento ya fue timbrado y no puede timbrarse nuevamente.');
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
        throw new CfdiValidationError('Este documento ya fue timbrado y no puede timbrarse nuevamente.');
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
