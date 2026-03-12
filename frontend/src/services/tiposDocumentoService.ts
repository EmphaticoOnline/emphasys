import { apiFetch } from './apiFetch';

export type TipoDocumentoEmpresa = {
  codigo: string;
  nombre: string;
  nombre_plural: string | null;
  icono: string | null;
  orden?: number | null;
};

export async function fetchTiposDocumentoHabilitados(modulo?: string): Promise<TipoDocumentoEmpresa[]> {
  const query = modulo ? `?modulo=${encodeURIComponent(modulo)}` : '';
  return apiFetch<TipoDocumentoEmpresa[]>(`/api/tipos-documento/habilitados${query}`);
}