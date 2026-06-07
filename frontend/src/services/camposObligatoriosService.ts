import { apiFetch } from "./apiFetch";

type CamposObligatoriosResponse = {
  campos: string[];
};

export async function fetchCamposObligatorios(
  entidad: string,
  contexto: string | null
): Promise<string[]> {
  const params = new URLSearchParams({ entidad });
  if (contexto) params.set("contexto", contexto);
  const response = await apiFetch<CamposObligatoriosResponse>(
    `/api/configuracion/campos-obligatorios?${params}`
  );
  return response?.campos ?? [];
}

export async function crearCampoObligatorio(
  entidad: string,
  contexto: string | null,
  campo: string
): Promise<void> {
  await apiFetch("/api/configuracion/campos-obligatorios", {
    method: "POST",
    body: { entidad, contexto, campo } as any,
  });
}

export async function eliminarCampoObligatorio(
  entidad: string,
  contexto: string | null,
  campo: string
): Promise<void> {
  await apiFetch("/api/configuracion/campos-obligatorios", {
    method: "DELETE",
    body: { entidad, contexto, campo } as any,
  });
}
