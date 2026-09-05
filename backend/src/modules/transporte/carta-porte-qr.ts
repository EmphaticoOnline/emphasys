import QRCode from 'qrcode';

export const CARTA_PORTE_VERIFIER_URL = 'https://verificacfdi.facturaelectronica.sat.gob.mx/verificaccp/default.aspx';

export function generarCadenaQRCartaPorte(idCcp: string, fechaHoraOrigen: string, fechaCertificacion: string): string {
  const params = new URLSearchParams({ IdCCP: idCcp, FechaHoraOrigen: fechaHoraOrigen, FechaHoraCertificacion: fechaCertificacion });
  return `${CARTA_PORTE_VERIFIER_URL}?${params.toString()}`;
}

export async function generarImagenQRCartaPorte(idCcp: string, fechaHoraOrigen: string, fechaCertificacion: string): Promise<string> {
  return QRCode.toDataURL(generarCadenaQRCartaPorte(idCcp, fechaHoraOrigen, fechaCertificacion));
}
