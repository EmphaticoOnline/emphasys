import { apiFetch } from './apiFetch';

export type WhatsappEtiquetaAdmin = {
  id: number;
  empresa_id: number;
  nombre: string;
  color: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
  uso_count?: number;
};

export async function fetchWhatsappEtiquetas(incluirInactivas = false): Promise<WhatsappEtiquetaAdmin[]> {
  const params = new URLSearchParams();
  if (incluirInactivas) params.set('incluir_inactivas', '1');
  const qs = params.toString();
  return apiFetch(`/api/whatsapp/etiquetas${qs ? `?${qs}` : ''}`);
}

export async function crearWhatsappEtiqueta(payload: { nombre: string; color: string }): Promise<WhatsappEtiquetaAdmin> {
  return apiFetch('/api/whatsapp/etiquetas', {
    method: 'POST',
    body: payload as any,
  });
}

export async function actualizarWhatsappEtiqueta(
  id: number,
  payload: { nombre?: string; color?: string; activo?: boolean }
): Promise<WhatsappEtiquetaAdmin> {
  return apiFetch(`/api/whatsapp/etiquetas/${id}`, {
    method: 'PATCH',
    body: payload as any,
  });
}

export async function eliminarWhatsappEtiqueta(id: number): Promise<void> {
  await apiFetch(`/api/whatsapp/etiquetas/${id}`, {
    method: 'DELETE',
  });
}