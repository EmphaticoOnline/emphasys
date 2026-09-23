import { XMLParser } from 'fast-xml-parser';

export const SAT_CONSULTA_URL = 'https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc';
export const SAT_SOAP_ACTION = 'http://tempuri.org/IConsultaCFDIService/Consulta';

export type SatCfdiQuery = {
  uuid: string;
  issuerRfc: string;
  receiverRfc: string;
  total: string;
  selloEmisor?: string | null;
};

export type SatCfdiResult = {
  codigoEstatus: string | null;
  estado: string | null;
  esCancelable: string | null;
  estatusCancelacion: string | null;
  validacionEfos: string | null;
  httpStatus: number;
  endpoint: string;
};

type SatTransport = (body: string, signal: AbortSignal) => Promise<{ status: number; body: string }>;

function text(value: unknown): string | null {
  const valueText = String(value ?? '').trim();
  return valueText || null;
}

function lastEight(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 8) throw new Error('El sello del emisor no tiene al menos 8 caracteres.');
  return normalized.slice(-8);
}

export function extraerDatosConsultaDesdeXml(xml: string, expectedUuid?: string | null): SatCfdiQuery {
  const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', removeNSPrefix: true, trimValues: true }).parse(xml);
  const comprobante = parsed?.Comprobante;
  const emisor = comprobante?.Emisor;
  const receptor = comprobante?.Receptor;
  const timbre = comprobante?.Complemento?.TimbreFiscalDigital;
  const uuid = text(timbre?.UUID);
  const sello = text(comprobante?.Sello);
  if (!comprobante || !emisor || !receptor || !timbre || !uuid || !sello) {
    throw new Error('El XML timbrado no contiene los datos necesarios para consultar el SAT.');
  }
  if (expectedUuid && uuid.toUpperCase() !== expectedUuid.trim().toUpperCase()) {
    throw new Error('El UUID del XML no coincide con el UUID almacenado.');
  }
  const total = text(comprobante.Total);
  const issuerRfc = text(emisor.Rfc);
  const receiverRfc = text(receptor.Rfc);
  if (!total || !issuerRfc || !receiverRfc) throw new Error('El XML timbrado no contiene RFC o total válido.');
  return { uuid, issuerRfc, receiverRfc, total, selloEmisor: sello };
}

export function construirExpresionImpresa(query: SatCfdiQuery): string {
  const fe = query.selloEmisor ? lastEight(query.selloEmisor) : undefined;
  if (!query.uuid || !query.issuerRfc || !query.receiverRfc || !query.total || !fe) {
    throw new Error('Faltan datos para construir la expresión impresa del SAT.');
  }
  const params = new URLSearchParams({ re: query.issuerRfc.trim().toUpperCase(), rr: query.receiverRfc.trim().toUpperCase(), tt: query.total, id: query.uuid.trim().toUpperCase(), fe });
  return `?${params.toString()}`;
}

function getValue(source: Record<string, unknown>, name: string): string | null {
  return text(source[name] ?? source[name.charAt(0).toLowerCase() + name.slice(1)]);
}

export function parsearRespuestaSat(xml: string, httpStatus = 200): SatCfdiResult {
  const parsed = new XMLParser({ removeNSPrefix: true, trimValues: true }).parse(xml);
  const result = parsed?.Envelope?.Body?.ConsultaResponse?.ConsultaResult;
  if (!result || typeof result !== 'object') throw new Error('La respuesta SOAP del SAT no contiene ConsultaResult.');
  const source = result as Record<string, unknown>;
  return {
    codigoEstatus: getValue(source, 'CodigoEstatus'),
    estado: getValue(source, 'Estado'),
    esCancelable: getValue(source, 'EsCancelable'),
    estatusCancelacion: getValue(source, 'EstatusCancelacion'),
    validacionEfos: getValue(source, 'ValidacionEFOS'),
    httpStatus,
    endpoint: SAT_CONSULTA_URL,
  };
}

export function clasificarResultadoSat(result: Pick<SatCfdiResult, 'codigoEstatus' | 'estado' | 'estatusCancelacion'>): 'no_solicitada' | 'pendiente' | 'rechazada' | 'cancelada' | 'requiere_reconciliacion' {
  const code = String(result.codigoEstatus ?? '').trim().toUpperCase();
  const estado = String(result.estado ?? '').trim().toLowerCase();
  const cancelacion = String(result.estatusCancelacion ?? '').trim().toLowerCase();
  if (!code.startsWith('S -') || !['vigente', 'cancelado'].includes(estado)) return 'requiere_reconciliacion';
  if (estado === 'cancelado') return 'cancelada';
  if (!cancelacion) return 'no_solicitada';
  if (cancelacion === 'en proceso') return 'pendiente';
  if (cancelacion === 'solicitud rechazada') return 'rechazada';
  return 'requiere_reconciliacion';
}

export function obtenerProveedorStatusSat(result: Pick<SatCfdiResult, 'estado' | 'estatusCancelacion'>): string | null {
  return result.estatusCancelacion || result.estado || null;
}

export async function consultarCfdiSat(query: SatCfdiQuery, options: { timeoutMs?: number; transport?: SatTransport } = {}): Promise<SatCfdiResult> {
  const expression = construirExpresionImpresa(query);
  const body = `<?xml version="1.0" encoding="utf-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/"><soapenv:Header/><soapenv:Body><tem:Consulta><tem:expresionImpresa><![CDATA[${expression}]]></tem:expresionImpresa></tem:Consulta></soapenv:Body></soapenv:Envelope>`;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const transport = options.transport ?? (async (requestBody, signal) => {
      const response = await fetch(SAT_CONSULTA_URL, { method: 'POST', headers: { Accept: 'text/xml', 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: SAT_SOAP_ACTION }, body: requestBody, signal });
      return { status: response.status, body: await response.text() };
    });
    const response = await transport(body, controller.signal);
    if (response.status < 200 || response.status >= 300) throw new Error(`El SAT respondió HTTP ${response.status}.`);
    return parsearRespuestaSat(response.body, response.status);
  } finally {
    clearTimeout(timer);
  }
}
