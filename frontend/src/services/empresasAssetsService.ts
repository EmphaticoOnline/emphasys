import { apiFetch } from "./apiFetch";

export type EmpresaAsset = {
  id: number;
  empresa_id: number;
  tipo: string;
  nombre_archivo: string;
  ruta: string;
  mime_type: string;
  tamano_bytes: number;
  activo: boolean;
  created_at: string;
};

const API_BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL?.replace(/\/$/, "")) || "";

export function buildAssetUrl(ruta: string): string {
  if (!ruta) return "";
  if (/^https?:\/\//i.test(ruta)) return ruta;
  const normalized = ruta.startsWith("/") ? ruta : `/${ruta}`;
  return `${API_BASE}${normalized}`;
}

export async function fetchEmpresaAsset(empresaId: number, tipo: string = "logo_default"): Promise<EmpresaAsset | null> {
  try {
    const asset = await apiFetch<EmpresaAsset>(`/api/empresas/${empresaId}/assets/${tipo}`);
    return asset;
  } catch (error) {
    if (error instanceof Error && /no encontrado|404/i.test(error.message)) {
      return null;
    }
    throw error;
  }
}

export async function uploadEmpresaAsset(empresaId: number, file: File, tipo: string = "logo_default"): Promise<EmpresaAsset> {
  const formData = new FormData();
  formData.append("archivo", file);
  formData.append("tipo", tipo);

  const asset = await apiFetch<EmpresaAsset>(`/api/empresas/${empresaId}/assets`, {
    method: "POST",
    body: formData,
  });

  return asset;
}
