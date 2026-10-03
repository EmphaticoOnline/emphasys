import { apiFetch } from './apiFetch';

export type SatClaveDescripcion = { clave: string; descripcion: string };

export type SatMaterialPeligroso = SatClaveDescripcion & {
  clase_division?: string | null;
  nombre_tecnico?: string | null;
};

const buscar = async <T extends SatClaveDescripcion = SatClaveDescripcion>(path: string, q: string): Promise<T[]> => {
  const data = await apiFetch<{ items: T[] }>(
    `/api/catalogos/sat/${path}?q=${encodeURIComponent(q)}&limit=50`,
  );
  return data.items ?? [];
};

/** Catálogo SAT de bienes/servicios transportados (clave_prod_serv_cp). */
export const buscarBienesTransportadosSat = (q: string) => buscar('bienes-transportados', q);

/** Catálogo SAT de unidades de medida (c_ClaveUnidad). */
export const buscarUnidadesSat = (q: string) => buscar('unidades', q);

/** Catálogo SAT de material peligroso. */
export const buscarMaterialesPeligrososSat = (q: string) => buscar<SatMaterialPeligroso>('materiales-peligrosos', q);

/** Catálogo SAT de tipos de embalaje. */
export const buscarTiposEmbalajeSat = (q: string) => buscar('tipos-embalaje', q);
