import { XMLParser } from 'fast-xml-parser';

export interface CfdiXmlParseado {
  uuid: string;
  rfcEmisor: string;
  rfcReceptor: string;
  nombreEmisor: string | null;
  nombreReceptor: string | null;
  /** Tal cual viene en el XML (hora local sin zona), ej. '2024-05-01T12:34:56' */
  fechaEmision: string | null;
  tipoComprobante: string | null;
  total: number | null;
  moneda: string | null;
}

/**
 * Parser mínimo de CFDI 4.0/3.3. Usa removeNSPrefix (mismo mecanismo que
 * convertXmlCfdiToFacturamaJson.ts) para no depender de que el prefijo de
 * namespace sea literalmente "cfdi:"/"tfd:" — cualquier prefijo equivalente
 * queda normalizado a los nombres de nodo sin prefijo.
 */
export function parseCfdiXml(xml: string): CfdiXmlParseado {
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

  const complemento = comprobante.Complemento;
  const timbre = complemento?.TimbreFiscalDigital;
  const uuid = String(timbre?.UUID ?? '').trim().toUpperCase();
  if (!uuid) {
    throw new Error('No se encontró UUID (TimbreFiscalDigital) en el XML');
  }

  const totalRaw = Number(comprobante.Total);

  return {
    uuid,
    rfcEmisor: String(emisor.Rfc ?? '').trim().toUpperCase(),
    rfcReceptor: String(receptor.Rfc ?? '').trim().toUpperCase(),
    nombreEmisor: emisor.Nombre ? String(emisor.Nombre).trim() : null,
    nombreReceptor: receptor.Nombre ? String(receptor.Nombre).trim() : null,
    fechaEmision: comprobante.Fecha ? String(comprobante.Fecha).trim() : null,
    tipoComprobante: comprobante.TipoDeComprobante ? String(comprobante.TipoDeComprobante).trim().toUpperCase() : null,
    total: Number.isFinite(totalRaw) ? totalRaw : null,
    moneda: comprobante.Moneda ? String(comprobante.Moneda).trim().toUpperCase() : null,
  };
}
