import QRCode from 'qrcode';

export interface DatosQrCfdi {
  uuid: string;
  rfc_emisor: string;
  rfc_receptor: string;
  total: number;
  sello_cfdi: string;
}

/**
 * Construye la cadena QR oficial del SAT para CFDI 4.0.
 * Formato: https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=UUID&re=RFC_EMISOR&rr=RFC_RECEPTOR&tt=TOTAL&fe=SELLO_FINAL
 */
export function generarCadenaQR({ uuid, rfc_emisor, rfc_receptor, total, sello_cfdi }: DatosQrCfdi): string {
  const tt = Number(total).toFixed(2);
  const fe = (sello_cfdi || '').slice(-8);

  return `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${uuid}&re=${rfc_emisor}&rr=${rfc_receptor}&tt=${tt}&fe=${fe}`;
}

/**
 * Genera la imagen QR (DataURL base64) usando la cadena oficial del SAT.
 */
export async function generarImagenQR(cfdi: DatosQrCfdi): Promise<string> {
  const cadena = generarCadenaQR(cfdi);
  return QRCode.toDataURL(cadena);
}
