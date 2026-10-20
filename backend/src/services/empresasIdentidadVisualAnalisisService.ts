import path from "path";
import sharp from "sharp";
import pool from "../config/database";
import { analizarLogo, ALGORITMO_VERSION, type ResultadoAnalisis } from "../shared/identidadVisual/analisisLogo";
import { obtenerEmpresaAssetPorTipo } from "./empresasAssetsService";
import type { IdentidadVisualRow } from "./empresasIdentidadVisualService";

/**
 * Análisis del logotipo de una empresa (logo_default). Solo guarda la
 * PROPUESTA (columnas propuesta_*): nunca toca los colores aprobados ni su
 * origen, así que no puede sobrescribir una personalización.
 */

/** Lado máximo al que se reduce el logo antes de analizarlo. */
const LADO_ANALISIS = 96;

function directorioUploads(): string {
  return process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.resolve(process.cwd(), "uploads");
}

/** `/uploads/empresas/x/logo.png` → ruta absoluta dentro del directorio de uploads (o null si sale de él). */
export function rutaAbsolutaAsset(ruta: string, raiz = directorioUploads()): string | null {
  const relativa = ruta.replace(/^\/?uploads\/?/, "");
  const absoluta = path.resolve(raiz, relativa);
  const dentro = path.relative(raiz, absoluta);
  return !dentro || dentro.startsWith("..") || path.isAbsolute(dentro) ? null : absoluta;
}

/** Decodifica una imagen (PNG, JPG, WebP, SVG…) a RGBA reducido. */
export async function decodificarLogo(entrada: string | Buffer) {
  const { data, info } = await sharp(entrada)
    .ensureAlpha()
    .resize(LADO_ANALISIS, LADO_ANALISIS, { fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}

type Propuesta = {
  estado: "ok" | "sin_colores_utiles" | "error";
  colores: { primario: string | null; acento: string | null; sidebar: string | null };
  confianza: number;
  detalle: Record<string, unknown>;
};

export function propuestaDeResultado(resultado: ResultadoAnalisis): Propuesta {
  return resultado.estado === "ok"
    ? { estado: "ok", colores: resultado.colores, confianza: resultado.confianza, detalle: resultado.detalle }
    : { estado: "sin_colores_utiles", colores: { primario: null, acento: null, sidebar: null }, confianza: 0, detalle: resultado.detalle };
}

/** Guarda la propuesta (crea la fila con todo en Emphasys si no existía). No escribe colores ni origen. */
export async function guardarPropuestaIdentidad(
  empresaId: number,
  propuesta: Propuesta,
  assetId: number | null
): Promise<IdentidadVisualRow> {
  const { rows } = await pool.query<IdentidadVisualRow>(
    `INSERT INTO core.empresas_identidad_visual
            (empresa_id, propuesta_primario, propuesta_acento, propuesta_sidebar,
             propuesta_estado, propuesta_confianza, propuesta_detalle, propuesta_asset_id,
             propuesta_algoritmo_version, propuesta_generada_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     ON CONFLICT (empresa_id) DO UPDATE
        SET propuesta_primario          = EXCLUDED.propuesta_primario,
            propuesta_acento            = EXCLUDED.propuesta_acento,
            propuesta_sidebar           = EXCLUDED.propuesta_sidebar,
            propuesta_estado            = EXCLUDED.propuesta_estado,
            propuesta_confianza         = EXCLUDED.propuesta_confianza,
            propuesta_detalle           = EXCLUDED.propuesta_detalle,
            propuesta_asset_id          = EXCLUDED.propuesta_asset_id,
            propuesta_algoritmo_version = EXCLUDED.propuesta_algoritmo_version,
            propuesta_generada_at       = EXCLUDED.propuesta_generada_at,
            updated_at                  = now()
     RETURNING *`,
    [
      empresaId,
      propuesta.colores.primario,
      propuesta.colores.acento,
      propuesta.colores.sidebar,
      propuesta.estado,
      propuesta.confianza,
      JSON.stringify(propuesta.detalle),
      assetId,
      ALGORITMO_VERSION,
    ]
  );
  return rows[0]!;
}

export type ResultadoAnalisisEmpresa =
  | { ok: true; identidad: IdentidadVisualRow }
  | { ok: false; motivo: "sin_logo" };

/**
 * Analiza el logo_default vigente de la empresa y guarda la propuesta. Un logo
 * que no se puede leer queda registrado con estado 'error' (la propuesta
 * anterior se reemplaza, porque ya no corresponde al logo vigente).
 */
export async function analizarLogoEmpresa(
  empresaId: number,
  leer: (asset: { ruta: string }) => Promise<string | Buffer | null> = async ({ ruta }) => rutaAbsolutaAsset(ruta)
): Promise<ResultadoAnalisisEmpresa> {
  const asset = await obtenerEmpresaAssetPorTipo(empresaId, "logo_default");
  if (!asset) return { ok: false, motivo: "sin_logo" };

  let propuesta: Propuesta;
  try {
    const entrada = await leer(asset);
    if (!entrada) throw new Error("Ruta del logo fuera del directorio de uploads");
    propuesta = propuestaDeResultado(analizarLogo(await decodificarLogo(entrada)));
  } catch (error) {
    propuesta = {
      estado: "error",
      colores: { primario: null, acento: null, sidebar: null },
      confianza: 0,
      detalle: { version: ALGORITMO_VERSION, motivo: "No se pudo leer el logotipo", error: (error as Error)?.message ?? String(error) },
    };
  }
  const identidad = await guardarPropuestaIdentidad(empresaId, propuesta, asset.id);
  return { ok: true, identidad };
}
