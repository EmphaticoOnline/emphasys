import { apiFetch } from './apiFetch';

export type SatClaveDescripcion = { clave: string; descripcion: string };

const buscar = async (path: string, q: string): Promise<SatClaveDescripcion[]> => {
  const data = await apiFetch<{ items: SatClaveDescripcion[] }>(
    `/api/catalogos/sat/${path}?q=${encodeURIComponent(q)}&limit=50`,
  );
  return data.items ?? [];
};

/** Catálogo SAT de bienes/servicios transportados (clave_prod_serv_cp). */
export const buscarBienesTransportadosSat = (q: string) => buscar('bienes-transportados', q);

/** Catálogo SAT de unidades de medida (c_ClaveUnidad). */
export const buscarUnidadesSat = (q: string) => buscar('unidades', q);
