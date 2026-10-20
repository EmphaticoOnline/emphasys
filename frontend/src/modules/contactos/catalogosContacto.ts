export type CatalogoContactoTipo = {
  id: number;
  nombre: string | null;
  descripcion: string | null;
  valores: {
    id: number;
    tipo_catalogo_id: number;
    descripcion: string;
    clave: string | null;
    orden: number | null;
  }[];
};

export const normalizarNombreCatalogoContacto = (value: string | null | undefined) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export function obtenerTipoOrigenContacto(tipos: CatalogoContactoTipo[], tipoId?: number | null) {
  if (tipoId) return tipos.find((tipo) => tipo.id === tipoId);
  return tipos.find((tipo) => normalizarNombreCatalogoContacto(tipo.nombre).includes('origen'));
}
