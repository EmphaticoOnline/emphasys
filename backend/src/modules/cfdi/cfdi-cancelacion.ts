import { XMLParser } from 'fast-xml-parser';

export type CfdiPacModalidad = 'web' | 'lite';
export type CfdiCancelacionEstado =
  | 'no_solicitada'
  | 'solicitada'
  | 'pendiente'
  | 'cancelada'
  | 'rechazada'
  | 'error'
  | 'requiere_reconciliacion';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function esUuidFiscal(value: string): boolean {
  return UUID_PATTERN.test(String(value || '').trim());
}

function requirePacId(pacId: string): string {
  const id = String(pacId || '').trim();
  if (!id) {
    throw new Error('No puede cancelarse porque falta el identificador del PAC.');
  }
  if (esUuidFiscal(id)) {
    throw new Error('El identificador del PAC no puede ser el UUID fiscal.');
  }
  return id;
}

export function getApiLiteCancelPath(
  pacId: string,
  motivo: string,
  uuidSustitucion?: string | null
): string {
  const params = new URLSearchParams({ motive: motivo });
  if (motivo === '01' && uuidSustitucion) params.set('uuidReplacement', uuidSustitucion);
  return `/api-lite/cfdis/${encodeURIComponent(requirePacId(pacId))}?${params.toString()}`;
}

export function getApiWebCancelPath(
  pacId: string,
  motivo: string,
  uuidSustitucion?: string | null
): string {
  const params = new URLSearchParams({ type: 'issued', motive: motivo });
  if (motivo === '01' && uuidSustitucion) params.set('uuidReplacement', uuidSustitucion);
  return `/cfdi/${encodeURIComponent(requirePacId(pacId))}?${params.toString()}`;
}

export function getCancelPath(
  modalidad: CfdiPacModalidad,
  pacId: string,
  motivo: string,
  uuidSustitucion?: string | null
): string {
  if (modalidad === 'lite') return getApiLiteCancelPath(pacId, motivo, uuidSustitucion);
  if (modalidad === 'web') return getApiWebCancelPath(pacId, motivo, uuidSustitucion);
  throw new Error('No puede cancelarse porque la modalidad del CFDI es desconocida.');
}

export function getCfdiStatusPath(modalidad: CfdiPacModalidad, pacId: string): string {
  const id = encodeURIComponent(requirePacId(pacId));
  if (modalidad === 'web') return `/cfdi/${id}?type=issued`;
  if (modalidad === 'lite') return `/api-lite/cfdis/${id}`;
  throw new Error('No puede consultarse el CFDI porque la modalidad es desconocida.');
}

export function interpretarEstadoCancelacionFacturama(value: unknown): CfdiCancelacionEstado {
  const status = String(value ?? '').trim().toLowerCase();
  if (status === 'canceled' || status === 'cancelled' || status === 'cancelada') return 'cancelada';
  if (status === 'pending' || status === 'requested' || status === 'solicitada') return 'pendiente';
  if (status === 'rejected' || status === 'rechazada') return 'rechazada';
  if (status === 'active' || status === 'vigente') return 'error';
  return 'requiere_reconciliacion';
}

export function esSolicitudCancelacionActiva(value: unknown): boolean {
  return ['iniciado', 'solicitada', 'pendiente', 'requiere_reconciliacion'].includes(
    String(value ?? '').trim().toLowerCase()
  );
}

function normalizar(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

export function validarIdentidadCfdiOriginal(params: {
  xml: string;
  uuid: string;
  rfcEmisor: string;
  rfcReceptor?: string | null;
  total?: string | number | null;
  folio?: string | number | null;
}): void {
  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
    trimValues: true,
  }).parse(params.xml);
  const comprobante = parsed?.Comprobante;
  const emisor = comprobante?.Emisor;
  const receptor = comprobante?.Receptor;
  const timbre = comprobante?.Complemento?.TimbreFiscalDigital;

  if (!comprobante || !timbre) throw new Error('El XML timbrado no contiene un CFDI válido.');
  if (normalizar(timbre.UUID) !== normalizar(params.uuid)) {
    throw new Error('El UUID almacenado no coincide con el UUID del XML.');
  }
  if (normalizar(emisor?.Rfc) !== normalizar(params.rfcEmisor)) {
    throw new Error('El RFC emisor almacenado no coincide con el RFC fiscal del XML.');
  }
  if (params.rfcReceptor && normalizar(receptor?.Rfc) !== normalizar(params.rfcReceptor)) {
    throw new Error('El RFC receptor almacenado no coincide con el XML.');
  }
  if (params.total != null && Math.abs(Number(comprobante.Total) - Number(params.total)) > 0.005) {
    throw new Error('El total almacenado no coincide con el XML.');
  }
  if (
    params.folio != null &&
    String(params.folio).trim() &&
    String(comprobante.Folio ?? '').trim() !== String(params.folio).trim()
  ) {
    throw new Error('El folio almacenado no coincide con el XML.');
  }
}
