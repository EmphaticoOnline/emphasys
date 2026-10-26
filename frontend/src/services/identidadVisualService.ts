import { apiFetch, type ApiFetchError } from "./apiFetch";
import type { ColoresEmpresa, ModoIdentidad } from "../theme/brand/empresaBrand";

export type ModoPresentacionLogo = 'automatico' | 'fondo_blanco' | 'logo_blanco';

export type RolIdentidad = keyof ColoresEmpresa;
export type OrigenColor = "emphasys" | "analisis" | "manual";

/** Respuesta de GET/PUT/POST analizar de /api/empresas/:id/identidad-visual. */
export type IdentidadVisualEmpresa = {
  empresa_id: number;
  colores: Omit<ColoresEmpresa, 'superficie_secundaria'> & { superficie_secundaria?: string | null };
  modo?: ModoIdentidad;
  modo_presentacion_logo?: ModoPresentacionLogo;
  superficie_secundaria?: string | null;
  origen?: Record<RolIdentidad, OrigenColor>;
  propuesta?: {
    estado: "ok" | "sin_colores_utiles" | "error";
    primario: string | null;
    acento: string | null;
    sidebar: string | null;
    confianza: number | null;
    asset_id: number | null;
    algoritmo_version: number | null;
    generada_at: string | null;
    detalle?: Record<string, unknown> | null;
  } | null;
  updated_at?: string | null;
  actualizado_por?: number | null;
};

export type ResultadoGuardarIdentidad =
  | { ok: true; identidad: IdentidadVisualEmpresa }
  | { ok: false; conflictos: RolIdentidad[] };

/** Evento para que la app aplique enseguida los colores recién guardados. */
export const EVENTO_IDENTIDAD_ACTUALIZADA = "emphasys:identidad-visual-actualizada";
export type DetalleIdentidadActualizada = { empresaId: number; colores: ColoresEmpresa; modo: ModoIdentidad; modoPresentacionLogo: ModoPresentacionLogo };

export async function fetchIdentidadVisual(empresaId: number): Promise<IdentidadVisualEmpresa> {
  return apiFetch<IdentidadVisualEmpresa>(`/api/empresas/${empresaId}/identidad-visual`);
}

/** PUT: un 409 (colores manuales sin confirmar) se devuelve como conflicto, no como error. */
export async function guardarIdentidadVisual(
  empresaId: number,
  colores: Partial<ColoresEmpresa>,
  confirmarSobrescritura: boolean,
  modo: ModoIdentidad = 'personalizado',
  modoPresentacionLogo: ModoPresentacionLogo = 'automatico'
): Promise<ResultadoGuardarIdentidad> {
  try {
    const { superficie_secundaria, ...roles } = colores;
    const identidad = await apiFetch<IdentidadVisualEmpresa>(`/api/empresas/${empresaId}/identidad-visual`, {
      method: "PUT",
      body: { colores: roles, superficie_secundaria, modo, modo_presentacion_logo: modoPresentacionLogo, confirmarSobrescritura },
    });
    window.dispatchEvent(
      new CustomEvent<DetalleIdentidadActualizada>(EVENTO_IDENTIDAD_ACTUALIZADA, { detail: { empresaId, colores: { ...identidad.colores, superficie_secundaria: identidad.superficie_secundaria ?? identidad.colores.superficie_secundaria ?? null }, modo: identidad.modo ?? modo, modoPresentacionLogo: identidad.modo_presentacion_logo ?? modoPresentacionLogo } })
    );
    return { ok: true, identidad };
  } catch (error) {
    const err = error as ApiFetchError;
    const conflictos = (err.payload as { conflictos?: RolIdentidad[] } | null)?.conflictos;
    if (err.status === 409 && Array.isArray(conflictos)) return { ok: false, conflictos };
    throw error;
  }
}

export async function analizarLogoIdentidad(empresaId: number): Promise<IdentidadVisualEmpresa> {
  return apiFetch<IdentidadVisualEmpresa>(`/api/empresas/${empresaId}/identidad-visual/analizar`, { method: "POST" });
}
