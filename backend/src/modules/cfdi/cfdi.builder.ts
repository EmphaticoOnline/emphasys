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

const normalizeRate = (value: number): number => (value > 1 ? value / 100 : value);

const mapImpuestoClave = (impuesto?: string | null): string => {
  const val = (impuesto || '').toUpperCase();
  if (val === 'IVA' || val === '002') return '002';
  if (val === 'ISR' || val === '001') return '001';
  if (val === 'IEPS' || val === '003') return '003';
  return val || IVA_IMPUESTO;
};

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

      const impuestosDetallados = Array.isArray(p.impuestos) ? p.impuestos : [];
      const tieneImpuestosDetallados = impuestosDetallados.length > 0;

      const impuestosCalculados = tieneImpuestosDetallados
        ? impuestosDetallados.map((imp) => {
            const tasaNorm = normalizeRate(Number(imp.tasa));
            const baseImp = Number.isFinite(Number(imp.base)) ? Number(imp.base) : base;
            const importeImp = Number.isFinite(Number(imp.monto)) ? Number(imp.monto) : baseImp * tasaNorm;
            return {
              tipo: (imp.tipo || '').toLowerCase() === 'retencion' ? 'retencion' : 'traslado',
              impuestoClave: mapImpuestoClave(imp.impuesto),
              tasa: tasaNorm,
              base: baseImp,
              importe: importeImp,
            };
          })
        : [
            {
              tipo: 'traslado',
              impuestoClave: IVA_IMPUESTO,
              tasa,
              base,
              importe: importeIva,
            },
          ];

      return { partida: p, base, importeIva, tasa, impuestosCalculados };
    });

    const subtotal = data.documento.subtotal ?? conceptos.reduce((acc, it) => acc + it.base, 0);

    let totalImpuestosTrasladados = 0;
    let totalImpuestosRetenidos = 0;

    const globalTraslados = new Map<string, { impuesto: string; tasa: number; importe: number }>();
    const globalRetenciones = new Map<string, { impuesto: string; tasa: number; importe: number }>();

    conceptos.forEach((c) => {
      c.impuestosCalculados.forEach((imp) => {
        const key = `${imp.impuestoClave}|${formatRate(imp.tasa)}`;

        if (imp.tipo === 'retencion') {
          totalImpuestosRetenidos += imp.importe;
          const current = globalRetenciones.get(key) || { impuesto: imp.impuestoClave, tasa: imp.tasa, importe: 0 };
          current.importe += imp.importe;
          globalRetenciones.set(key, current);
          return;
        }

        totalImpuestosTrasladados += imp.importe;
        const current = globalTraslados.get(key) || { impuesto: imp.impuestoClave, tasa: imp.tasa, importe: 0 };
        current.importe += imp.importe;
        globalTraslados.set(key, current);
      });
    });

    const total = data.documento.total ?? subtotal + totalImpuestosTrasladados - totalImpuestosRetenidos;

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
      TotalImpuestosRetenidos: totalImpuestosRetenidos > 0 ? formatMoney(totalImpuestosRetenidos) : undefined,
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

    conceptos.forEach(({ partida, base, impuestosCalculados, tasa, importeIva }) => {
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

      const trasladosPartida = impuestosCalculados.filter((imp) => imp.tipo !== 'retencion');
      const retencionesPartida = impuestosCalculados.filter((imp) => imp.tipo === 'retencion');

      if (trasladosPartida.length > 0) {
        const traslados = impuestos.ele('cfdi:Traslados');
        trasladosPartida.forEach((imp) => {
          traslados.ele('cfdi:Traslado', sanitize({
            Base: formatMoney(imp.base),
            Impuesto: imp.impuestoClave,
            TipoFactor: 'Tasa',
            TasaOCuota: formatRate(imp.tasa),
            Importe: formatMoney(imp.importe),
          }));
        });
        traslados.up();
      }

      if (retencionesPartida.length > 0) {
        const retenciones = impuestos.ele('cfdi:Retenciones');
        retencionesPartida.forEach((imp) => {
          retenciones.ele('cfdi:Retencion', sanitize({
            Base: formatMoney(imp.base),
            Impuesto: imp.impuestoClave,
            TipoFactor: 'Tasa',
            TasaOCuota: formatRate(imp.tasa),
            Importe: formatMoney(imp.importe),
          }));
        });
        retenciones.up();
      }

      impuestos.up();
      concepto.up();
    });

    xml.up(); // cierra Conceptos

    if (totalImpuestosTrasladados > 0 || totalImpuestosRetenidos > 0) {
      const impuestos = xml.ele('cfdi:Impuestos', sanitize({
        TotalImpuestosTrasladados: totalImpuestosTrasladados > 0 ? formatMoney(totalImpuestosTrasladados) : undefined,
        TotalImpuestosRetenidos: totalImpuestosRetenidos > 0 ? formatMoney(totalImpuestosRetenidos) : undefined,
      }));

      if (globalTraslados.size > 0) {
        const traslados = impuestos.ele('cfdi:Traslados');
        globalTraslados.forEach((imp) => {
          traslados.ele('cfdi:Traslado', {
            Impuesto: imp.impuesto,
            TipoFactor: 'Tasa',
            TasaOCuota: formatRate(imp.tasa),
            Importe: formatMoney(imp.importe),
          });
        });
        traslados.up();
      }

      if (globalRetenciones.size > 0) {
        const retenciones = impuestos.ele('cfdi:Retenciones');
        globalRetenciones.forEach((imp) => {
          retenciones.ele('cfdi:Retencion', {
            Impuesto: imp.impuesto,
            TipoFactor: 'Tasa',
            TasaOCuota: formatRate(imp.tasa),
            Importe: formatMoney(imp.importe),
          });
        });
        retenciones.up();
      }

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
