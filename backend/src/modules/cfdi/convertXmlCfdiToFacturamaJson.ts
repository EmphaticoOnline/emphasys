import { XMLParser } from 'fast-xml-parser';

export type FacturamaItemTax = {
  Name: string;
  Base: number;
  Rate: number;
  Total: number;
};

export type FacturamaItem = {
  ProductCode: string;
  Description: string;
  UnitCode: string;
  Quantity: number;
  UnitPrice: number;
  Subtotal: number;
  Total: number;
  TaxObject: string;
  Taxes?: FacturamaItemTax[];
};

export type FacturamaLiteJson = {
  NameId: string;
  Folio?: string;
  CfdiType: string;
  ExpeditionPlace: string;
  PaymentForm: string | undefined;
  PaymentMethod: string | undefined;
  Issuer?: {
    Rfc?: string;
    Name?: string;
    FiscalRegime?: string;
  };
  Receiver: {
    Rfc: string;
    Name?: string;
    CfdiUse?: string;
    FiscalRegime?: string;
    TaxZipCode?: string;
  };
  GlobalInformation?: {
    Periodicity: string;
    Months: string;
    Year: string;
  };
  Items: FacturamaItem[];
};

const toNumber = (value: any): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const ensureArray = <T>(value: T | T[] | undefined | null): T[] => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};

const mapImpuestoNombre = (impuesto?: string): string => {
  if (!impuesto) return 'IVA';
  switch (impuesto) {
    case '002':
      return 'IVA';
    case '001':
      return 'ISR';
    case '003':
      return 'IEPS';
    default:
      return impuesto;
  }
};

/**
 * Convierte un XML CFDI 4.0 (ya generado) al JSON que espera el endpoint Facturama API Lite (POST /api-lite/3/cfdis).
 * Maneja múltiples conceptos y convierte valores numéricos a number.
 */
export function convertXmlCfdiToFacturamaJson(xml: string): FacturamaLiteJson {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
    trimValues: true,
  });

  const parsed = parser.parse(xml);
  const comprobante = parsed?.['cfdi:Comprobante'] || parsed?.Comprobante;
  if (!comprobante) {
    throw new Error('No se encontró cfdi:Comprobante en el XML.');
  }

  const emisor = comprobante['cfdi:Emisor'] || comprobante.Emisor;
  const receptor = comprobante['cfdi:Receptor'] || comprobante.Receptor;
  const conceptos = comprobante['cfdi:Conceptos']?.['cfdi:Concepto'] || comprobante.Conceptos?.Concepto;

  // Fecha del comprobante para global information (when receptor is generic)
  const fechaRaw = comprobante.Fecha;
  const fecha = fechaRaw ? new Date(fechaRaw) : null;
  const monthStr = fecha && !isNaN(fecha.getTime()) ? String(fecha.getMonth() + 1).padStart(2, '0') : undefined;
  const yearStr = fecha && !isNaN(fecha.getTime()) ? String(fecha.getFullYear()) : undefined;

  const items: FacturamaItem[] = ensureArray(conceptos).map((concepto: any) => {
    const impuestos = concepto['cfdi:Impuestos'] || concepto.Impuestos;
    const traslados = impuestos?.['cfdi:Traslados']?.['cfdi:Traslado'] || impuestos?.Traslados?.Traslado;
    const trasladosArr = ensureArray(traslados);

    const quantity = toNumber(concepto.Cantidad);
    const unitPrice = toNumber(concepto.ValorUnitario);
    const subtotal = quantity * unitPrice;

    const taxes: FacturamaItemTax[] = trasladosArr.map((t: any) => ({
      Name: mapImpuestoNombre(t.Impuesto),
      Base: subtotal,
      Rate: toNumber(t.TasaOCuota),
      Total: toNumber(t.Importe),
    }));

    const totalTaxes = taxes.reduce((acc, t) => acc + toNumber(t.Total), 0);
    const total = subtotal + totalTaxes;

    return {
      ProductCode: concepto.ClaveProdServ,
      Description: concepto.Descripcion,
      UnitCode: concepto.ClaveUnidad,
      Quantity: quantity,
      UnitPrice: unitPrice,
      Subtotal: subtotal,
      Total: total,
      TaxObject: concepto.ObjetoImp,
      Taxes: taxes.length ? taxes : undefined,
    };
  });

  const result: FacturamaLiteJson = {
    NameId: '1',
    Folio: comprobante.Folio,
    CfdiType: comprobante.TipoDeComprobante || 'I',
    ExpeditionPlace: comprobante.LugarExpedicion,
    PaymentForm: comprobante.FormaPago,
    PaymentMethod: comprobante.MetodoPago,
    Issuer: {
      Rfc: emisor?.Rfc,
      Name: emisor?.Nombre,
      FiscalRegime: emisor?.RegimenFiscal,
    },
    Receiver: {
      Rfc: receptor?.Rfc,
      Name: receptor?.Nombre,
      CfdiUse: receptor?.UsoCFDI,
      FiscalRegime: receptor?.RegimenFiscalReceptor,
      TaxZipCode: receptor?.DomicilioFiscalReceptor,
    },
    Items: items,
  };

  if (result.Receiver.Rfc === 'XAXX010101000' && monthStr && yearStr) {
    result.GlobalInformation = {
      Periodicity: '01',
      Months: monthStr,
      Year: yearStr,
    };
  }

  return result;
}
