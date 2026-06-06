import { apiFetch } from './apiFetch';

export type WhatsappPlantillaOption = {
  id: number;
  empresa_id: number;
  nombre_interno: string;
  tipo: string;
  proveedor: string;
  provider_template_id: string;
  es_default: boolean;
  activa: boolean;
};

export async function fetchWhatsappPlantillas(incluirInactivas = false): Promise<WhatsappPlantillaOption[]> {
  const params = new URLSearchParams();
  if (incluirInactivas) params.set('incluir_inactivas', '1');
  const qs = params.toString();
  return apiFetch(`/api/whatsapp/plantillas${qs ? `?${qs}` : ''}`);
}

export type PlantillaAdminPayload = {
  nombre_interno: string;
  tipo: string;
  proveedor: string;
  provider_template_id: string;
  es_default: boolean;
  activa?: boolean;
};

export async function crearWhatsappPlantilla(payload: PlantillaAdminPayload): Promise<WhatsappPlantillaOption> {
  return apiFetch<WhatsappPlantillaOption>('/api/whatsapp/plantillas', {
    method: 'POST',
    body: payload as any,
  });
}

export async function actualizarWhatsappPlantilla(
  id: number,
  payload: Partial<PlantillaAdminPayload>
): Promise<WhatsappPlantillaOption> {
  return apiFetch<WhatsappPlantillaOption>(`/api/whatsapp/plantillas/${id}`, {
    method: 'PUT',
    body: payload as any,
  });
}