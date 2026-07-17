import { apiFetch } from '../api/apiClient';

export type ListarConversacionesParams = {
  since?: string | null | undefined;
  vendedorId?: number | string | null | undefined;
  tagIds?: number[];
  estadoFinalizada?: boolean;
  search?: string | null | undefined;
};

export function fetchConversaciones(params: ListarConversacionesParams = {}) {
  const query = new URLSearchParams();
  if (params.since) {
    query.set('since', params.since);
  }
  if (params.vendedorId) {
    query.set('vendedor_id', String(params.vendedorId));
  }
  if (params.tagIds && params.tagIds.length > 0) {
    query.set('tag_ids', params.tagIds.join(','));
  }
  if (params.estadoFinalizada) {
    query.set('estado', 'finalizada');
  }
  if (params.search) {
    query.set('search', params.search);
  }

  const queryString = query.toString();
  return apiFetch(`/api/whatsapp/conversaciones${queryString ? `?${queryString}` : ''}`);
}

export type ObtenerMensajesConversacionParams = {
  since?: string | null | undefined;
};

export function fetchMensajesConversacion(
  conversationId: string,
  params: ObtenerMensajesConversacionParams = {}
) {
  const sinceParam = params.since ? `?since=${encodeURIComponent(params.since)}` : '';
  return apiFetch(`/api/whatsapp/conversacion/${conversationId}${sinceParam}`);
}
