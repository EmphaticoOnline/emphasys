import type { GridColDef, GridValidRowModel } from '@mui/x-data-grid';

// Aplica un orden de columnas guardado (persistencia por pantalla vía
// useGridPreferences, mismo patrón que Documentos/Pólizas): columnas
// conocidas primero en el orden guardado, cualquier columna nueva que no
// estuviera guardada se agrega al final en su posición original.
export function reordenarColumnas<TRow extends GridValidRowModel>(
  base: GridColDef<TRow>[],
  orden: string[]
): GridColDef<TRow>[] {
  if (!orden.length) return base;
  const porCampo = new Map(base.map((col) => [col.field, col]));
  const ordenadas = orden.map((field) => porCampo.get(field)).filter((col): col is GridColDef<TRow> => Boolean(col));
  const faltantes = base.filter((col) => !orden.includes(col.field));
  return [...ordenadas, ...faltantes];
}
