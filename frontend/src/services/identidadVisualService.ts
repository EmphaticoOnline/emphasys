import { apiFetch } from "./apiFetch";
import type { ColoresEmpresa } from "../theme/brand/empresaBrand";

/** Respuesta de GET /api/empresas/:id/identidad-visual (solo lo que usa la app). */
export type IdentidadVisualEmpresa = {
  empresa_id: number;
  colores: ColoresEmpresa;
};

export async function fetchIdentidadVisual(empresaId: number): Promise<IdentidadVisualEmpresa> {
  return apiFetch<IdentidadVisualEmpresa>(`/api/empresas/${empresaId}/identidad-visual`);
}
