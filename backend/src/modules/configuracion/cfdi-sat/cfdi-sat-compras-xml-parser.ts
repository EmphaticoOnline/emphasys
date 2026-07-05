import { XMLParser } from 'fast-xml-parser';

export interface CfdiConceptoImpuesto {
  tipo: 'traslado' | 'retencion';
  impuesto: string | null;
  tasaOCuota: number | null;
  base: number | null;
  importe: number;
}

export interface CfdiConceptoParseado {
  claveProdServ: string | null;
  claveUnidad: string | null;
  unidad: string | null;
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  descuento: number;
  importe: number;
  impuestos: CfdiConceptoImpuesto[];
}

export interface CfdiComprasParseado {
  uuid: string;
  serie: string | null;
  folio: string | null;
  /** Tal cual viene en el XML (hora local sin zona), ej. '2024-05-01T12:34:56' */
  fecha: string | null;
  formaPago: string | null;
  metodoPago: string | null;
  usoCfdi: string | null;
  moneda: string;
  tipoCambio: number | null;
  subTotal: number;
  descuento: number;
  total: number;
  totalImpuestosTrasladados: number;
  totalImpuestosRetenidos: number;
  rfcEmisor: string;
  nombreEmisor: string | null;
  rfcReceptor: string;
  nombreReceptor: string | null;
  regimenFiscalReceptor: string | null;
  codigoPostalReceptor: string | null;
  conceptos: CfdiConceptoParseado[];
}

function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toStringOrNull(value: unknown): string | null {
  const texto = value != null ? String(value).trim() : '';
  return texto || null;
}

function parseImpuestosNodo(impuestosNodo: any): CfdiConceptoImpuesto[] {
  if (!impuestosNodo) return [];
  const resultado: CfdiConceptoImpuesto[] = [];

  ensureArray(impuestosNodo.Traslados?.Traslado).forEach((t: any) => {
    resultado.push({
      tipo: 'traslado',
      impuesto: toStringOrNull(t?.Impuesto),
      tasaOCuota: toNumberOrNull(t?.TasaOCuota),
      base: toNumberOrNull(t?.Base),
      importe: toNumber(t?.Importe),
    });
  });

  ensureArray(impuestosNodo.Retenciones?.Retencion).forEach((r: any) => {
    resultado.push({
      tipo: 'retencion',
      impuesto: toStringOrNull(r?.Impuesto),
      tasaOCuota: toNumberOrNull(r?.TasaOCuota),
      base: toNumberOrNull(r?.Base),
      importe: toNumber(r?.Importe),
    });
  });

  return resultado;
}

/**
 * Parser completo de CFDI 4.0/3.3 para el flujo de importación a Compras.
 * Deliberadamente separado de cfdi-sat-xml-parser.ts (parser "mínimo" usado en
 * Fase 3 para catalogar comprobantes) para no alterar ese comportamiento ya
 * probado. Usa removeNSPrefix (igual que convertXmlCfdiToFacturamaJson.ts) para
 * no depender de que el prefijo de namespace sea literalmente "cfdi:"/"tfd:".
 */
export function parseCfdiXmlCompras(xml: string): CfdiComprasParseado {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
    trimValues: true,
  });

  const parsed = parser.parse(xml);
  const comprobante = parsed?.Comprobante;
  if (!comprobante) {
    throw new Error('No se encontró el nodo Comprobante en el XML');
  }

  const emisor = comprobante.Emisor;
  const receptor = comprobante.Receptor;
  if (!emisor || !receptor) {
    throw new Error('El XML no tiene nodos Emisor/Receptor válidos');
  }

  const timbre = comprobante.Complemento?.TimbreFiscalDigital;
  const uuid = String(timbre?.UUID ?? '').trim().toUpperCase();
  if (!uuid) {
    throw new Error('No se encontró UUID (TimbreFiscalDigital) en el XML');
  }

  const conceptos: CfdiConceptoParseado[] = ensureArray(comprobante.Conceptos?.Concepto).map((concepto: any) => ({
    claveProdServ: toStringOrNull(concepto?.ClaveProdServ),
    claveUnidad: toStringOrNull(concepto?.ClaveUnidad),
    unidad: toStringOrNull(concepto?.Unidad),
    descripcion: toStringOrNull(concepto?.Descripcion) ?? 'Concepto sin descripción',
    cantidad: toNumber(concepto?.Cantidad) || 1,
    valorUnitario: toNumber(concepto?.ValorUnitario),
    descuento: toNumber(concepto?.Descuento),
    importe: toNumber(concepto?.Importe),
    impuestos: parseImpuestosNodo(concepto?.Impuestos),
  }));

  if (conceptos.length === 0) {
    throw new Error('El XML no tiene conceptos');
  }

  const impuestosHeader = comprobante.Impuestos;

  return {
    uuid,
    serie: toStringOrNull(comprobante.Serie),
    folio: toStringOrNull(comprobante.Folio),
    fecha: toStringOrNull(comprobante.Fecha),
    formaPago: toStringOrNull(comprobante.FormaPago),
    metodoPago: toStringOrNull(comprobante.MetodoPago),
    usoCfdi: toStringOrNull(receptor.UsoCFDI),
    moneda: toStringOrNull(comprobante.Moneda)?.toUpperCase() ?? 'MXN',
    tipoCambio: toNumberOrNull(comprobante.TipoCambio),
    subTotal: toNumber(comprobante.SubTotal),
    descuento: toNumber(comprobante.Descuento),
    total: toNumber(comprobante.Total),
    totalImpuestosTrasladados: toNumber(impuestosHeader?.TotalImpuestosTrasladados),
    totalImpuestosRetenidos: toNumber(impuestosHeader?.TotalImpuestosRetenidos),
    rfcEmisor: String(emisor.Rfc ?? '').trim().toUpperCase(),
    nombreEmisor: toStringOrNull(emisor.Nombre),
    rfcReceptor: String(receptor.Rfc ?? '').trim().toUpperCase(),
    nombreReceptor: toStringOrNull(receptor.Nombre),
    regimenFiscalReceptor: toStringOrNull(receptor.RegimenFiscalReceptor),
    codigoPostalReceptor: toStringOrNull(receptor.DomicilioFiscalReceptor),
    conceptos,
  };
}
