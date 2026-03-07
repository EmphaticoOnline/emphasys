import { apiFetch } from './apiFetch';

export type CatalogoConfigurable = {
  id: number;
  nombre: string | null;
  descripcion: string | null;
};

export type CatalogoConfigurableGrupo = {
  entidad_tipo_id: number;
  entidad_nombre: string | null;
  entidad_descripcion: string | null;
  catalogos: CatalogoConfigurable[];
};

const BASE_URL = '/api/configuracion/catalogos';

export async function fetchCatalogosConfigurables(): Promise<CatalogoConfigurableGrupo[]> {
  return apiFetch(BASE_URL);
}
