import { apiFetch } from './apiFetch';

export type TipoDocumentoEmpresa = {
  id?: number;
  codigo: string;
  nombre: string;
  nombre_plural: string | null;
  icono: string | null;
  orden?: number | null;
  whatsapp_plantilla_default_id?: number | null;
};

export type TipoDocumentoCatalogo = TipoDocumentoEmpresa;

export async function fetchTiposDocumento(): Promise<TipoDocumentoCatalogo[]> {
  return apiFetch<TipoDocumentoCatalogo[]>('/api/tipos-documento');
}

export async function fetchTiposDocumentoHabilitados(modulo?: string): Promise<TipoDocumentoEmpresa[]> {
  const query = modulo ? `?modulo=${encodeURIComponent(modulo)}` : '';
  return apiFetch<TipoDocumentoEmpresa[]>(`/api/tipos-documento/habilitados${query}`);
}