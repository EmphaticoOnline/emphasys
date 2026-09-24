import fs from 'node:fs/promises';
import path from 'node:path';
import pool from '../config/database';
import { decryptSecret } from '../utils/secret-crypto';
import { buildSatCancellationXml, buildSatCancellationSoapEnvelope, verifySatCancellationXml, SAT_CFDI_CANCELLATION_ENDPOINT, SAT_CFDI_CANCELLATION_SOAP_ACTION } from '../modules/cfdi/sat-cfdi-cancellation.client';

function arg(name: string): string | null {
  const value = process.argv.find((item) => item.startsWith(`--${name}=`));
  return value ? value.slice(name.length + 3) : null;
}

function storedFile(relativePath: string): string {
  const clean = relativePath.replace(/^\/+/, '');
  return path.resolve(process.cwd(), clean);
}

async function main() {
  if (!process.argv.includes('--dry-run')) throw new Error('Este runner requiere --dry-run; nunca envía solicitudes.');
  const documentoId = Number(arg('documento-id'));
  if (!Number.isInteger(documentoId) || documentoId <= 0) throw new Error('--documento-id inválido.');
  const motivo = String(arg('motivo') || '02').padStart(2, '0');
  const uuidSustitucion = arg('uuid-sustitucion');

  const { rows } = await pool.query<any>(`SELECT e.razon_social, e.rfc, e.cfdi_csd_cer_path, e.cfdi_csd_key_path,
      e.cfdi_csd_password_encrypted, dc.uuid
    FROM documentos_cfdi dc JOIN documentos d ON d.id = dc.documento_id
    JOIN core.empresas e ON e.id = d.empresa_id WHERE dc.documento_id = $1 LIMIT 1`, [documentoId]);
  const row = rows[0];
  if (!row) throw new Error('No se encontró empresa/CFDI para el documento.');
  if (!row.uuid || !row.cfdi_csd_cer_path || !row.cfdi_csd_key_path || !row.cfdi_csd_password_encrypted) throw new Error('Faltan UUID o credenciales CSD administradas por Emphasys.');

  const [certificate, privateKey] = await Promise.all([fs.readFile(storedFile(row.cfdi_csd_cer_path)), fs.readFile(storedFile(row.cfdi_csd_key_path))]);
  const password = decryptSecret(row.cfdi_csd_password_encrypted);
  const xml = buildSatCancellationXml({ rfcEmisor: row.rfc, uuid: row.uuid, motivo, uuidSustitucion, certificado: certificate, llavePrivada: privateKey, password });
  const valid = verifySatCancellationXml(xml);
  const negatives = {
    UUID: !verifySatCancellationXml(xml.replace(row.uuid.toUpperCase(), '82DF C328-F96F-43D1-AFA3-CF9F24BEF3A8'.replace(' ', ''))),
    RFC: !verifySatCancellationXml(xml.replace(`RfcEmisor="${row.rfc}"`, 'RfcEmisor="AAA010101AAA"')),
    Fecha: !verifySatCancellationXml(xml.replace(/Fecha="[^"]+"/, 'Fecha="2026-09-23T16:22:11"')),
    Motivo: !verifySatCancellationXml(xml.replace('Motivo="02"', 'Motivo="03"')),
  };
  const soap = buildSatCancellationSoapEnvelope(xml)
    .replace(new RegExp(row.uuid, 'g'), 'UUID-DE-PRUEBA')
    .replace(new RegExp(row.rfc, 'g'), 'RFC-DE-PRUEBA')
    .replace(/<X509Certificate>[^<]+<\/X509Certificate>/, '<X509Certificate>CERTIFICADO-OMITIDO</X509Certificate>')
    .replace(/<SignatureValue>[^<]+<\/SignatureValue>/, '<SignatureValue>FIRMA-OMITIDA</SignatureValue>')
    .replace(/<DigestValue>[^<]+<\/DigestValue>/, '<DigestValue>DIGEST-OMITIDO</DigestValue>');
  console.log(JSON.stringify({
    Empresa: row.razon_social,
    RFC: row.rfc,
    UUID: row.uuid,
    Motivo: motivo,
    'UUID sustituto': uuidSustitucion || null,
    Certificado: `[archivo .cer; ${certificate.length} bytes]`,
    Fecha: xml.match(/\sFecha="([^"]+)"/)?.[1] || null,
    'Firma XML válida': valid ? 'SI' : 'NO',
    'Pruebas de alteración': Object.fromEntries(Object.entries(negatives).map(([key, value]) => [key, value ? 'RECHAZADA/CORRECTO' : 'FALLÓ'])) ,
    Endpoint: SAT_CFDI_CANCELLATION_ENDPOINT,
    SOAPAction: SAT_CFDI_CANCELLATION_SOAP_ACTION,
  }, null, 2));
  if (!valid) throw new Error('La verificación XMLDSig offline falló.');
  if (!Object.values(negatives).every(Boolean)) throw new Error('Una prueba negativa no fue rechazada.');
  console.log('\n--- SOAP Envelope sanitizado (no enviado) ---\n' + soap);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : 'Error en dry-run'); process.exitCode = 1; }).finally(() => pool.end());
