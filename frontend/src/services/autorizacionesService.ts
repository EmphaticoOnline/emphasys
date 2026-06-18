import { apiFetch } from './apiFetch';

const BASE = '/api/autorizaciones';

export type ModoAutorizacion = 'ninguna' | 'directa' | 'flujo';
export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';
export type EstadoAutorizacion = 'no_requerida' | 'pendiente' | 'aprobada' | 'rechazada';

export interface AutorizacionRegla {
  id: number;
  empresa_id: number;
  transicion_id: number;
  monto_minimo: string | null;
  monto_maximo: string | null;
  modo: ModoAutorizacion;
  rol_autorizador_id: number | null;
  usuario_autorizador_id: number | null;
  nivel: number;
  activa: boolean;
  created_at: string;
  updated_at: string;
  td_origen_nombre: string;
  td_origen_codigo: string;
  td_destino_nombre: string;
  td_destino_codigo: string;
  rol_nombre: string | null;
  usuario_nombre: string | null;
}

export interface AutorizacionSolicitud {
  id: number;
  empresa_id: number;
  regla_id: number;
  documento_origen_id: number;
  tipo_documento_origen: string;
  tipo_documento_destino: string;
  folio_documento_origen: string | null;
  monto: string;
  estado: EstadoSolicitud;
  usuario_solicitante_id: number;
  usuario_autorizador_id: number | null;
  comentario_solicitante: string | null;
  comentario_autorizador: string | null;
  created_at: string;
  updated_at: string;
  respondido_at: string | null;
  usuario_solicitante_nombre: string;
  usuario_autorizador_nombre: string | null;
}

export interface CrearReglaInput {
  transicion_id: number;
  monto_minimo?: number | null;
  monto_maximo?: number | null;
  modo: ModoAutorizacion;
  rol_autorizador_id?: number | null;
  usuario_autorizador_id?: number | null;
}

export interface TransicionConId {
  id: number;
  td_origen_nombre: string;
  td_origen_codigo: string;
  td_destino_nombre: string;
  td_destino_codigo: string;
}

// ─── Transiciones ─────────────────────────────────────────────────────────────

export function getTransiciones(): Promise<TransicionConId[]> {
  return apiFetch(`${BASE}/transiciones`);
}

// ─── Reglas ───────────────────────────────────────────────────────────────────

export function getReglas(): Promise<AutorizacionRegla[]> {
  return apiFetch(`${BASE}/reglas`);
}

export function createRegla(data: CrearReglaInput): Promise<AutorizacionRegla> {
  return apiFetch(`${BASE}/reglas`, { method: 'POST', body: data as any });
}

export function updateRegla(id: number, data: Partial<CrearReglaInput>): Promise<AutorizacionRegla> {
  return apiFetch(`${BASE}/reglas/${id}`, { method: 'PUT', body: data as any });
}

export function deleteRegla(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`${BASE}/reglas/${id}`, { method: 'DELETE' });
}

// ─── Solicitudes ──────────────────────────────────────────────────────────────

export function getBandeja(): Promise<AutorizacionSolicitud[]> {
  return apiFetch(`${BASE}/solicitudes/bandeja`);
}

export function getMisSolicitudes(estado?: string): Promise<AutorizacionSolicitud[]> {
  const qs = estado ? `?estado=${encodeURIComponent(estado)}` : '';
  return apiFetch(`${BASE}/solicitudes/mis-solicitudes${qs}`);
}

export function getSolicitud(id: number): Promise<AutorizacionSolicitud> {
  return apiFetch(`${BASE}/solicitudes/${id}`);
}

export function responderSolicitud(
  id: number,
  decision: 'aprobada' | 'rechazada',
  comentario?: string | null
): Promise<AutorizacionSolicitud> {
  return apiFetch(`${BASE}/solicitudes/${id}/responder`, {
    method: 'PUT',
    body: { decision, comentario_autorizador: comentario ?? null } as any,
  });
}

export function cancelarSolicitud(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`${BASE}/solicitudes/${id}/cancelar`, { method: 'PUT' });
}
