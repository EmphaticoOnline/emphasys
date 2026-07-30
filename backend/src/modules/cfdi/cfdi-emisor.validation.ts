import { XMLParser } from 'fast-xml-parser';

export type CfdiEmisorRecibido = {
  rfc: string;
  nombre: string;
  regimenFiscal: string;
  lugarExpedicion: string;
  noCertificado: string;
  uuid: string;
};

export const normalizarRfcEstricto = (value: unknown): string =>
  String(value ?? '').trim().toUpperCase();

export function enmascararRfc(value: unknown): string {
  const rfc = normalizarRfcEstricto(value);
  if (!rfc) return '[vacío]';
  if (rfc.length <= 6) return '***';
  return `${rfc.slice(0, 3)}${'*'.repeat(Math.max(3, rfc.length - 6))}${rfc.slice(-3)}`;
}

export function extraerEmisorCfdi(xml: string): CfdiEmisorRecibido {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
    trimValues: true,
  });
  const parsed = parser.parse(xml);
  const comprobante = parsed?.Comprobante;
  const emisor = comprobante?.Emisor;
  const timbre = comprobante?.Complemento?.TimbreFiscalDigital;

  return {
    rfc: normalizarRfcEstricto(emisor?.Rfc),
    nombre: String(emisor?.Nombre ?? '').trim(),
    regimenFiscal: String(emisor?.RegimenFiscal ?? '').trim(),
    lugarExpedicion: String(comprobante?.LugarExpedicion ?? '').trim(),
    noCertificado: String(comprobante?.NoCertificado ?? '').trim(),
    uuid: String(timbre?.UUID ?? '').trim(),
  };
}

export function validarRfcEmisorRecibido(xml: string, rfcEsperado: string): CfdiEmisorRecibido {
  const esperado = normalizarRfcEstricto(rfcEsperado);
  if (!esperado) {
    throw new Error('El RFC de la empresa activa está vacío.');
  }

  const recibido = extraerEmisorCfdi(xml);
  if (!recibido.rfc || recibido.rfc !== esperado) {
    throw new Error(
      'Facturama devolvió un CFDI con un RFC emisor distinto al de la empresa activa. El timbrado no fue guardado.'
    );
  }
  return recibido;
}
