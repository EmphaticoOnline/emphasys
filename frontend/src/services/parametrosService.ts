import { apiFetch } from "./apiFetch";
import type { ParametrosModulo } from "../types/parametros";

type ParametrosResponse = {
  modulos: ParametrosModulo[];
};

export async function fetchParametrosSistema(): Promise<ParametrosModulo[]> {
  const response = await apiFetch<ParametrosResponse>("/api/configuracion/parametros");
  return response?.modulos ?? [];
}

export async function guardarParametroSistema(parametro_id: number, valor: any): Promise<void> {
  await apiFetch("/api/configuracion/parametros", {
    method: "POST",
    body: { parametro_id, valor } as any,
  });
}