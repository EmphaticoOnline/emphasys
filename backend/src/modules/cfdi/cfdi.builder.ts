import { create } from 'xmlbuilder2';
import type { CfdiBuildOptions, CfdiBuildResult, CfdiInvoiceData, CfdiPartida } from './cfdi.types';

const CFDI_NAMESPACE = 'http://www.sat.gob.mx/cfd/4';
const CFDI_XSI = 'http://www.w3.org/2001/XMLSchema-instance';
const CFDI_SCHEMA_LOCATION = `${CFDI_NAMESPACE} http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd`;

const IVA_IMPUESTO = '002';
const IVA_TASA = 0.16;

const formatMoney = (value: number, decimals = 2) => value.toFixed(decimals);
const formatRate = (value: number) => value.toFixed(6);
const formatFecha = (value: string) => new Date(value).toISOString().slice(0, 19);

const sanitize = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const out: Partial<T> = {};
  Object.entries(obj).forEach(([key, val]) => {
    if (val === undefined || val === null || val === '') return;
    (out as Record<string, any>)[key] = val;
  });
  return out;
};

export function ajustarDomicilioFiscalReceptor(
  rfc: string | null,
  domicilioFiscalReceptor: string | null,
  lugarExpedicion: string | undefined
): string | null {
  const rfcUpper = (rfc || '').toUpperCase();
  if ((rfcUpper === 'XAXX010101000' || rfcUpper === 'XEXX010101000') && lugarExpedicion) {
    return lugarExpedicion;
  }
  return domicilioFiscalReceptor;
}

function resolveImporte(partida: CfdiPartida): { base: number; importeIva: number; tasa: number } {
  const base = partida.subtotal_partida ?? partida.cantidad * partida.precio_unitario;
  const tasa = partida.iva_porcentaje != null ? partida.iva_porcentaje / 100 : IVA_TASA;
  const importeIva = partida.iva_monto ?? Number((base * tasa).toFixed(2));
  return { base, importeIva, tasa };
}

export class CfdiBuilder {
  build(data: CfdiInvoiceData, options: CfdiBuildOptions = {}): CfdiBuildResult {
    if (!data.partidas.length) {
      throw new Error('La factura no tiene partidas.');
    }

    const conceptos = data.partidas.map((p) => {
      const { base, importeIva, tasa } = resolveImporte(p);
      return { partida: p, base, importeIva, tasa };
    });

    const subtotal = data.documento.subtotal ?? conceptos.reduce((acc, it) => acc + it.base, 0);
    const totalImpuestosTrasladados = conceptos.reduce((acc, it) => acc + it.importeIva, 0);
    const total = data.documento.total ?? subtotal + totalImpuestosTrasladados;

    const comprobanteAttrs = sanitize({
      'xmlns:cfdi': CFDI_NAMESPACE,
      'xmlns:xsi': CFDI_XSI,
      'xsi:schemaLocation': CFDI_SCHEMA_LOCATION,
      Version: '4.0',
      Serie: data.documento.serie || undefined,
      Folio: data.documento.numero ? String(data.documento.numero) : undefined,
      Fecha: options.fechaEmision ?? formatFecha(data.documento.fecha_documento),
      Moneda: data.documento.moneda || 'MXN',
      TipoDeComprobante: 'I',
      Exportacion: '01',
      SubTotal: formatMoney(subtotal),
      Total: formatMoney(total),
  LugarExpedicion: data.empresa.codigo_postal_id,
      MetodoPago: data.documento.metodo_pago || 'PUE',
      FormaPago: data.documento.forma_pago || '99',
      TotalImpuestosTrasladados: totalImpuestosTrasladados > 0 ? formatMoney(totalImpuestosTrasladados) : undefined,
    });

    const domicilioFiscalReceptorAjustado = ajustarDomicilioFiscalReceptor(
      data.documento.rfc_receptor,
      data.documento.codigo_postal_receptor,
      comprobanteAttrs.LugarExpedicion as string | undefined
    );

    const xml = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('cfdi:Comprobante', comprobanteAttrs)
      .ele('cfdi:Emisor', sanitize({
        Rfc: data.empresa.rfc,
        Nombre: data.empresa.razon_social,
        RegimenFiscal: data.empresa.regimen_fiscal,
      }))
      .up()
      .ele('cfdi:Receptor', sanitize({
        Rfc: data.documento.rfc_receptor,
        Nombre: data.documento.nombre_receptor,
        DomicilioFiscalReceptor: domicilioFiscalReceptorAjustado,
        RegimenFiscalReceptor: data.documento.regimen_fiscal_receptor,
        UsoCFDI: data.documento.uso_cfdi,
      }))
      .up();

    const conceptosNode = xml.ele('cfdi:Conceptos');

    conceptos.forEach(({ partida, base, importeIva, tasa }) => {
      const concepto = conceptosNode.ele('cfdi:Concepto', sanitize({
        ClaveProdServ: partida.clave_producto_sat,
        Cantidad: formatRate(partida.cantidad),
        ClaveUnidad: partida.clave_unidad_sat,
        Descripcion: partida.descripcion,
        ValorUnitario: formatMoney(partida.precio_unitario),
        Importe: formatMoney(base),
        ObjetoImp: '02',
      }));

      const impuestos = concepto.ele('cfdi:Impuestos');
      const traslados = impuestos.ele('cfdi:Traslados');
      traslados.ele('cfdi:Traslado', sanitize({
        Base: formatMoney(base),
        Impuesto: IVA_IMPUESTO,
        TipoFactor: 'Tasa',
        TasaOCuota: formatRate(tasa),
        Importe: formatMoney(importeIva),
      }));
      impuestos.up();
      concepto.up();
    });

    xml.up(); // cierra Conceptos

    if (totalImpuestosTrasladados > 0) {
      const impuestos = xml.ele('cfdi:Impuestos', {
        TotalImpuestosTrasladados: formatMoney(totalImpuestosTrasladados),
      });
      const traslados = impuestos.ele('cfdi:Traslados');
      traslados.ele('cfdi:Traslado', {
        Impuesto: IVA_IMPUESTO,
        TipoFactor: 'Tasa',
        TasaOCuota: formatRate(IVA_TASA),
        Importe: formatMoney(totalImpuestosTrasladados),
      });
      traslados.up();
      impuestos.up();
    }

    const xmlString = xml.end({ prettyPrint: true });

    return {
      xml: xmlString,
      subtotal,
      totalImpuestosTrasladados,
      total,
    };
  }
}
