import { apiFetch } from './apiFetch';

export type EtapaProduccion = {
  id: number;
  empresa_id: number;
  nombre: string;
  orden: number;
  color: string | null;
  activo: boolean;
};

export type SeguimientoProduccionRow = {
  id: number;
  empresa_id: number;
  documento_id: number;
  activo: boolean;
  tipo_documento: string;
  serie: string | null;
  numero: number | null;
  cliente: string;
  etapa_id: number | null;
  etapa_nombre: string | null;
  etapa_color: string | null;
  fecha_promesa: string | null;
  comentarios: string | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
};

export type SeguimientoProduccionHistorialRow = {
  id: number;
  empresa_id: number;
  documento_id: number;
  etapa_id: number | null;
  etapa_nombre: string | null;
  etapa_color: string | null;
  fecha_promesa: string | null;
  comentarios: string | null;
  updated_by: number | null;
  usuario_nombre: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateSeguimientoProduccionPayload = {
  documento_id: number;
  etapa_id?: number | null;
  fecha_promesa?: string | null;
  comentarios?: string | null;
};

export type CreateEtapaProduccionPayload = {
  nombre: string;
  orden: number;
  color?: string | null;
  activo?: boolean;
};

export type UpdateEtapaProduccionPayload = {
  nombre?: string;
  orden?: number;
  color?: string | null;
  activo?: boolean;
};

export type UpdateSeguimientoProduccionPayload = {
  etapa_id: number | null;
  fecha_promesa: string | null;
  comentarios: string | null;
};

export type CreateSeguimientoProduccionResponse = {
  created: boolean;
  message: string;
  seguimiento: SeguimientoProduccionRow;
};

export type DeleteEtapaProduccionResponse = {
  deleted: true;
  id: number;
};

export type ProduccionCampoConfigurable = {
  campoId: number;
  campoPadreId: number | null;
  nombre: string;
  valor: string;
};

export type ProduccionPartidaOperativa = {
  id: number;
  numeroPartida: number;
  productoId: number | null;
  productoClave: string | null;
  productoDescripcion: string | null;
  descripcionAlterna: string | null;
  cantidad: number;
  unidad: string | null;
  tituloAgrupador: string | null;
  observaciones: string | null;
  imagenUrl: string | null;
  camposConfigurables: ProduccionCampoConfigurable[];
};

export type ProduccionDetalleOperativo = {
  documento: {
    id: number;
    tipoDocumento: string;
    serie: string | null;
    numero: number | null;
    fechaDocumento: string;
    observaciones: string | null;
  };
  contacto: {
    id: number;
    nombre: string;
    nombreContacto: string | null;
    telefono: string | null;
    email: string | null;
  } | null;
  etapaActual: {
    id: number | null;
    nombre: string | null;
    color: string | null;
  } | null;
  fechaPromesa: string | null;
  partidas: ProduccionPartidaOperativa[];
};

export function listEtapasProduccion(includeInactive = false) {
  const query = includeInactive ? '?incluir_inactivas=1' : '';
  return apiFetch<EtapaProduccion[]>(`/api/produccion/etapas${query}`);
}

export function createEtapaProduccion(payload: CreateEtapaProduccionPayload) {
  return apiFetch<EtapaProduccion>('/api/produccion/etapas', {
    method: 'POST',
    body: payload,
  });
}

export function updateEtapaProduccion(id: number, payload: UpdateEtapaProduccionPayload) {
  return apiFetch<EtapaProduccion>(`/api/produccion/etapas/${id}`, {
    method: 'PUT',
    body: payload,
  });
}

export function deleteEtapaProduccion(id: number) {
  return apiFetch<DeleteEtapaProduccionResponse>(`/api/produccion/etapas/${id}`, {
    method: 'DELETE',
  });
}

export function listSeguimientosProduccion() {
  return apiFetch<SeguimientoProduccionRow[]>('/api/produccion/seguimientos');
}

export function getSeguimientoProduccionPorDocumento(documentoId: number) {
  return apiFetch<SeguimientoProduccionHistorialRow[]>(`/api/produccion/seguimientos/documento/${documentoId}`);
}

export function getDetalleOperativoProduccion(documentoId: number) {
  return apiFetch<ProduccionDetalleOperativo>(`/api/produccion/documentos/${documentoId}/detalle`);
}

export function createSeguimientoProduccion(payload: CreateSeguimientoProduccionPayload) {
  return apiFetch<CreateSeguimientoProduccionResponse>('/api/produccion/seguimientos', {
    method: 'POST',
    body: payload,
  });
}

export function updateSeguimientoProduccion(id: number, payload: UpdateSeguimientoProduccionPayload) {
  return apiFetch<SeguimientoProduccionRow>(`/api/produccion/seguimientos/${id}`, {
    method: 'PUT',
    body: payload,
  });
}