import { apiFetch } from './apiFetch';

export async function eliminarOportunidad(id: number): Promise<void> {
  await apiFetch(`/api/crm/oportunidades/${id}`, {
    method: 'DELETE',
  });
}