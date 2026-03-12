import { apiFetch } from "./apiFetch";
import type { ParametroOpcion } from "../types/parametros";

export async function fetchOpciones(parametroId: number): Promise<ParametroOpcion[]> {
  return apiFetch<ParametroOpcion[]>(`/api/parametros/${parametroId}/opciones`);
}

export async function crearOpcion(parametroId: number, payload: { valor: string; etiqueta: string; orden?: number | null }) {
  return apiFetch<ParametroOpcion>(`/api/parametros/${parametroId}/opciones`, {
    method: "POST",
    body: payload as any,
  });
}

export async function actualizarOpcion(opcionId: number, payload: { valor?: string; etiqueta?: string; orden?: number | null }) {
  return apiFetch<ParametroOpcion>(`/api/opciones-parametro/${opcionId}`, {
    method: "PUT",
    body: payload as any,
  });
}

export async function eliminarOpcion(opcionId: number) {
  await apiFetch<void>(`/api/opciones-parametro/${opcionId}`, { method: "DELETE" });
}