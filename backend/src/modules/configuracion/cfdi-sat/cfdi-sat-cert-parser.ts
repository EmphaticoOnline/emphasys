import forge from 'node-forge';

export interface CertificadoInfo {
  rfc: string | null;
  vigenciaDesde: Date;
  vigenciaHasta: Date;
}

/**
 * Los certificados del SAT (CSD y FIEL) incluyen el RFC del titular en el atributo
 * x500UniqueIdentifier (OID 2.5.4.45) del subject, con formato "RFC" (personas morales)
 * o "RFC / CURP" (personas físicas).
 */
function extraerRfcDeCertificado(cert: forge.pki.Certificate): string | null {
  const attr = cert.subject.attributes.find(
    (a: any) => a.type === '2.5.4.45' || a.shortName === 'x500UniqueIdentifier'
  );

  const raw = attr && typeof (attr as any).value === 'string' ? ((attr as any).value as string) : null;
  if (!raw) return null;

  const rfc = raw.split('/')[0]?.trim().toUpperCase();
  return rfc || null;
}

export function parseCerBuffer(buffer: Buffer): CertificadoInfo {
  const asn1 = forge.asn1.fromDer(buffer.toString('binary'));
  const cert = forge.pki.certificateFromAsn1(asn1);

  return {
    rfc: extraerRfcDeCertificado(cert),
    vigenciaDesde: cert.validity.notBefore,
    vigenciaHasta: cert.validity.notAfter,
  };
}

/**
 * Valida que el .key tenga una estructura ASN.1/DER plausible (PKCS#8
 * EncryptedPrivateKeyInfo). No requiere ni valida la contraseña: el sobre
 * PKCS#8 se puede decodificar sin descifrar el contenido.
 */
export function assertKeyBufferEsValido(buffer: Buffer): void {
  forge.asn1.fromDer(buffer.toString('binary'));
}
