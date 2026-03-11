import { apiFetch } from './apiFetch';
import type { CampoConfiguracion, CampoValorPayload, CatalogoValor, CampoValorGuardado } from '../types/camposDinamicos';

export type EntidadTipo = {
  id: number;
  codigo: string;
  nombre: string;
};

export type CatalogoTipo = {
  id: number;
  nombre: string | null;
  entidad_tipo_id: number;
};

export type CamposConfiguracionFiltro = {
  entidad_tipo_id?: number;
  entidad_tipo_codigo?: string;
  tipo_documento?: string;
  incluirInactivos?: boolean;
};

export async function fetchCamposConfiguracion(filtro: CamposConfiguracionFiltro = {}): Promise<CampoConfiguracion[]> {
  const params = new URLSearchParams();
  if (filtro.entidad_tipo_id) params.set('entidad_tipo_id', String(filtro.entidad_tipo_id));
  if (filtro.entidad_tipo_codigo) params.set('entidad_tipo_codigo', filtro.entidad_tipo_codigo);
  if (filtro.tipo_documento) params.set('tipo_documento', filtro.tipo_documento);
  if (filtro.incluirInactivos) params.set('incluir_inactivos', '1');

  const qs = params.toString();
  const url = `/api/campos-configuracion${qs ? `?${qs}` : ''}`;
  return apiFetch(url);
}

export async function crearCampoConfiguracion(payload: Partial<CampoConfiguracion>): Promise<CampoConfiguracion> {
  return apiFetch('/api/campos-configuracion', {
    method: 'POST',
    body: payload as any,
  });
}

export async function actualizarCampoConfiguracion(id: number, payload: Partial<CampoConfiguracion>): Promise<CampoConfiguracion> {
  return apiFetch(`/api/campos-configuracion/${id}`, {
    method: 'PUT',
    body: payload as any,
  });
}

export async function eliminarCampoConfiguracion(id: number): Promise<void> {
  await apiFetch(`/api/campos-configuracion/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchEntidadesTipos(): Promise<EntidadTipo[]> {
  return apiFetch('/api/entidades-tipos');
}

export type TipoDocumento = {
  codigo: string;
  nombre: string;
  nombre_plural: string | null;
  icono: string | null;
};

export async function fetchTiposDocumento(): Promise<TipoDocumento[]> {
  return apiFetch('/api/tipos-documento');
}

export async function fetchCatalogosTipos(): Promise<CatalogoTipo[]> {
  return apiFetch('/api/catalogos/tipos');
}

export async function fetchCatalogoDinamico(
  tipoCatalogo: number | string,
  parentId?: number | null
): Promise<CatalogoValor[]> {
  const params = new URLSearchParams();
  if (parentId !== undefined && parentId !== null) params.set('parent_id', String(parentId));
  const qs = params.toString();
  return apiFetch(`/api/catalogos/${tipoCatalogo}${qs ? `?${qs}` : ''}`);
}

export async function guardarCamposDocumento(payload: { documento_id: number; valores: CampoValorPayload[] }) {
  return apiFetch<{ ok: boolean; count: number }>('/api/documentos-campos', {
    method: 'POST',
    body: payload as any,
  });
}

export async function guardarCamposPartida(payload: { partida_id: number; valores: CampoValorPayload[] }) {
  return apiFetch<{ ok: boolean; count: number }>('/api/documentos-partidas-campos', {
    method: 'POST',
    body: payload as any,
  });
}

export async function fetchCamposDocumento(documentoId: number): Promise<CampoValorGuardado[]> {
  if (!documentoId) return [];
  try {
    const resp = await apiFetch<{ valores: CampoValorGuardado[] }>(`/api/documentos/${documentoId}/campos`);
    return resp?.valores || [];
  } catch (error) {
    console.error('No se pudieron cargar los campos dinámicos del documento', error);
    return [];
  }
}

export async function fetchCamposPartida(partidaId: number): Promise<CampoValorGuardado[]> {
  if (!partidaId) return [];
  try {
    // Endpoint compatible con /api/documentos-partidas/:id/campos y /api/documentos-partidas-campos/:id
    const resp = await apiFetch<{ valores: CampoValorGuardado[] }>(`/api/documentos-partidas/${partidaId}/campos`);
    return resp?.valores || [];
  } catch (error) {
    // fallback al endpoint previo en caso de despliegues antiguos
    try {
      const resp = await apiFetch<{ valores: CampoValorGuardado[] }>(`/api/documentos-partidas-campos/${partidaId}`);
      return resp?.valores || [];
    } catch (inner) {
      console.error('No se pudieron cargar los campos dinámicos de la partida', inner);
      return [];
    }
  }
}
