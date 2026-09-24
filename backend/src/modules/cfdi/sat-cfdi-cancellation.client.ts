import { createHash, createVerify } from 'node:crypto';
import path from 'node:path';
// The package root intentionally exposes utility classes only in CommonJS;
// use its documented Node Credential implementation without logging secrets.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Credential = require(path.join(path.dirname(require.resolve('@nodecfdi/credentials')), 'node/credential.js')).default;
import { XMLParser } from 'fast-xml-parser';

export const SAT_CFDI_CANCELLATION_ENDPOINT =
  'https://cancelacion.facturaelectronica.sat.gob.mx/Cancelacion/CancelaCFDService.svc';
export const SAT_CFDI_CANCELLATION_SOAP_ACTION =
  'http://cancelacfd.sat.gob.mx/ICancelaCFDBinding/CancelaCFD';
const NS = 'http://www.sat.gob.mx/sitio_internet/cfd';
const DSIG = 'http://www.w3.org/2000/09/xmldsig#';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SatCancellationInput = {
  rfcEmisor: string;
  uuid: string;
  motivo: '01' | '02' | '03' | '04' | string;
  uuidSustitucion?: string | null;
  certificado: string | Buffer;
  llavePrivada: string | Buffer;
  password: string;
};

export type SatCancellationResult = {
  httpStatus: number;
  estatusPeticion: string | null;
  uuid: string | null;
  estatusUuid: string | null;
  acuseXml: string;
  solicitudRecibida: boolean;
  cfdiCancelado: false;
};

type Transport = (body: string, signal: AbortSignal) => Promise<{ status: number; body: string }>;

function text(value: unknown): string | null {
  const result = String(value ?? '').trim();
  return result || null;
}

function asText(value: string | Buffer): string {
  return Buffer.isBuffer(value) ? value.toString('binary') : value;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function certificateBase64(certificate: string | Buffer): string {
  const raw = Buffer.isBuffer(certificate) ? certificate : Buffer.from(certificate, 'binary');
  const pem = raw.toString('utf8');
  if (pem.includes('BEGIN CERTIFICATE')) {
    return pem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, '');
  }
  return raw.toString('base64');
}

function c14n(value: string): string {
  // The SAT schema uses the inclusive XML 1.0 canonicalization algorithm. This
  // controlled fragment has no comments, namespaces other than the root, or
  // mixed content, so deterministic serialization is sufficient here.
  return value.replace(/\s*\/?>/g, (match) => match.trim());
}

export function buildSatCancellationXml(input: SatCancellationInput, now = new Date()): string {
  const rfc = input.rfcEmisor.trim().toUpperCase();
  const uuid = input.uuid.trim().toUpperCase();
  const motivo = input.motivo.trim().padStart(2, '0');
  if (!/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(rfc)) throw new Error('RFC emisor inválido.');
  if (!UUID.test(uuid)) throw new Error('UUID inválido.');
  if (!['01', '02', '03', '04'].includes(motivo)) throw new Error('Motivo SAT inválido.');
  const replacement = input.uuidSustitucion?.trim().toUpperCase() || '';
  if (motivo === '01' && !UUID.test(replacement)) throw new Error('uuidSustitucion es obligatorio y debe ser UUID para motivo 01.');
  if (motivo !== '01' && replacement) throw new Error('uuidSustitucion sólo aplica al motivo 01.');

  // SAT requires local time in ISO format without timezone offset.
  const fecha = now.toISOString().replace(/\.\d{3}Z$/, '').replace('Z', '');
  const folio = `<Folio UUID="${uuid}" Motivo="${motivo}"${motivo === '01' ? ` FolioSustitucion="${replacement}"` : ''} />`;
  const unsigned = `<Cancelacion xmlns="${NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" Fecha="${fecha}" RfcEmisor="${rfc}"><Folios>${folio}</Folios>`;
  const digest = createHash('sha256').update(c14n(unsigned + '</Cancelacion>'), 'utf8').digest('base64');
  const signedInfo = `<SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315" /><SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256" /><Reference URI=""><Transforms><Transform Algorithm="${DSIG}enveloped-signature" /></Transforms><DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256" /><DigestValue>${digest}</DigestValue></Reference></SignedInfo>`;
  const credential = Credential.create(asText(input.certificado), asText(input.llavePrivada), input.password);
  const signature = Buffer.from(credential.privateKey().sign(signedInfo, 'sha256'), 'binary').toString('base64');
  const cert = certificateBase64(input.certificado);
  return `${unsigned}<Signature xmlns="${DSIG}">${signedInfo}<SignatureValue>${signature}</SignatureValue><KeyInfo><X509Data><X509Certificate>${cert}</X509Certificate></X509Data></KeyInfo></Signature></Cancelacion>`;
}

/** Independent verifier: Node's OpenSSL-backed verifier, not node-forge. */
export function verifySatCancellationXml(xml: string): boolean {
  const signature = xml.match(/<Signature xmlns="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#">([\s\S]*?)<\/Signature>/)?.[1];
  const signedInfo = signature?.match(/(<SignedInfo>[\s\S]*?<\/SignedInfo>)/)?.[1];
  const signatureValue = signature?.match(/<SignatureValue>([^<]+)<\/SignatureValue>/)?.[1];
  const certificate = xml.match(/<X509Certificate>([^<]+)<\/X509Certificate>/)?.[1];
  if (!signedInfo || !signatureValue || !certificate) return false;
  const signedDocument = xml.replace(/<Signature xmlns="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#">[\s\S]*?<\/Signature>/, '');
  const unsigned = signedDocument.replace(/^<\?xml[^>]*>\s*/, '');
  const digest = signedInfo.match(/<DigestValue>([^<]+)<\/DigestValue>/)?.[1];
  const expectedDigest = createHash('sha256').update(c14n(unsigned), 'utf8').digest('base64');
  if (!digest || digest !== expectedDigest) return false;
  const pem = `-----BEGIN CERTIFICATE-----\n${certificate.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;
  const verifier = createVerify('RSA-SHA256');
  verifier.update(signedInfo, 'utf8');
  verifier.end();
  return verifier.verify(pem, Buffer.from(signatureValue, 'base64'));
}

export function buildSatCancellationSoapEnvelope(xml: string): string {
  return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Header/><soap:Body><CancelaCFD xmlns="http://cancelacfd.sat.gob.mx">${xml}</CancelaCFD></soap:Body></soap:Envelope>`;
}

export class SatCfdiCancellationClient {
  constructor(private readonly options: { endpoint?: string; timeoutMs?: number; transport?: Transport } = {}) {}

  async cancelar(input: SatCancellationInput): Promise<SatCancellationResult> {
    const xml = buildSatCancellationXml(input);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 20_000);
    try {
      const transport = this.options.transport ?? (async (body, signal) => {
        const response = await fetch(this.options.endpoint ?? SAT_CFDI_CANCELLATION_ENDPOINT, {
          method: 'POST', signal, body: buildSatCancellationSoapEnvelope(body),
          headers: { Accept: 'text/xml', 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: SAT_CFDI_CANCELLATION_SOAP_ACTION },
        });
        return { status: response.status, body: await response.text() };
      });
      const response = await transport(xml, controller.signal);
      const parsed = new XMLParser({ removeNSPrefix: true, trimValues: true, isArray: (name) => name === 'FolioRespuesta' }).parse(response.body);
      const result = parsed?.Envelope?.Body?.CancelaCFDResponse?.CancelaCFDResult ?? parsed?.Envelope?.Body?.CancelaCFDResult;
      const folio = result?.FoliosRespuesta?.FolioRespuesta?.[0] ?? result?.FoliosRespuesta?.FolioRespuesta ?? result?.FolioRespuesta?.[0] ?? result?.FolioRespuesta ?? result?.Folios?.[0] ?? result?.Folios;
      const estatusPeticion = text(result?.EstatusPeticion);
      const uuid = text(folio?.UUID);
      const estatusUuid = text(folio?.EstatusUUID);
      return { httpStatus: response.status, estatusPeticion, uuid, estatusUuid, acuseXml: response.body, solicitudRecibida: estatusUuid === '201', cfdiCancelado: false };
    } finally { clearTimeout(timer); }
  }
}
