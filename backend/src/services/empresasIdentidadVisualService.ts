import pool from "../config/database";
import {
  aplicarCambios,
  VIGENTES_EMPHASYS,
  type ColoresVigentes,
  type ModoIdentidad,
  type OrigenColor,
} from "../shared/identidadVisual/cambios";
import type { RolIdentidad } from "../shared/identidadVisual/contraste";

/** Fila de core.empresas_identidad_visual tal como la devuelve pg. */
export type IdentidadVisualRow = {
  empresa_id: number;
  color_primario: string | null;
  color_acento: string | null;
  color_sidebar: string | null;
  color_superficie_secundaria: string | null;
  modo: ModoIdentidad;
  modo_presentacion_logo: ModoPresentacionLogo;
  origen_primario: OrigenColor;
  origen_acento: OrigenColor;
  origen_sidebar: OrigenColor;
  propuesta_primario: string | null;
  propuesta_acento: string | null;
  propuesta_sidebar: string | null;
  propuesta_estado: "ok" | "sin_colores_utiles" | "error" | null;
  /** numeric llega como string desde pg. */
  propuesta_confianza: string | null;
  propuesta_detalle: Record<string, unknown> | null;
  propuesta_asset_id: number | null;
  propuesta_algoritmo_version: number | null;
  propuesta_generada_at: string | null;
  actualizado_por: number | null;
  created_at: string;
  updated_at: string;
};

export type IdentidadVisualRespuesta = {
  empresa_id: number;
  colores: Record<RolIdentidad, string | null>;
  superficie_secundaria?: string | null;
  modo?: ModoIdentidad;
  modo_presentacion_logo?: ModoPresentacionLogo;
  origen: Record<RolIdentidad, OrigenColor>;
  propuesta: {
    estado: "ok" | "sin_colores_utiles" | "error";
    primario: string | null;
    acento: string | null;
    sidebar: string | null;
    confianza: number | null;
    asset_id: number | null;
    algoritmo_version: number | null;
    generada_at: string | null;
    /** Solo para superadministradores. */
    detalle?: Record<string, unknown> | null;
  } | null;
  updated_at: string | null;
  actualizado_por: number | null;
};

export type ModoPresentacionLogo = 'automatico' | 'fondo_blanco' | 'logo_blanco';

export type ResultadoGuardar =
  | { ok: true; identidad: IdentidadVisualRow | null }
  | { ok: false; conflictos: RolIdentidad[] };

const COLUMNAS = `empresa_id, color_primario, color_acento, color_sidebar, color_superficie_secundaria, modo, modo_presentacion_logo,
       origen_primario, origen_acento, origen_sidebar,
       propuesta_primario, propuesta_acento, propuesta_sidebar,
       propuesta_estado, propuesta_confianza, propuesta_detalle, propuesta_asset_id,
       propuesta_algoritmo_version, propuesta_generada_at,
       actualizado_por, created_at, updated_at`;

export async function obtenerIdentidadVisual(empresaId: number): Promise<IdentidadVisualRow | null> {
  const { rows } = await pool.query<IdentidadVisualRow>(
    `SELECT ${COLUMNAS}
       FROM core.empresas_identidad_visual
      WHERE empresa_id = $1`,
    [empresaId]
  );
  return rows[0] ?? null;
}

/** Colores vigentes de una fila (o los de Emphasys si no hay fila). */
export function vigentesDeFila(row: IdentidadVisualRow | null): ColoresVigentes {
  if (!row) return VIGENTES_EMPHASYS;
  const propuesta =
    row.propuesta_estado === "ok" && row.propuesta_primario && row.propuesta_acento && row.propuesta_sidebar
      ? { primario: row.propuesta_primario, acento: row.propuesta_acento, sidebar: row.propuesta_sidebar }
      : null;
  return {
    colores: { primario: row.color_primario, acento: row.color_acento, sidebar: row.color_sidebar },
    origen: { primario: row.origen_primario, acento: row.origen_acento, sidebar: row.origen_sidebar },
    propuesta,
    superficieSecundaria: row.color_superficie_secundaria ?? null,
    modo: row.modo ?? (row.color_primario || row.color_acento || row.color_sidebar || row.color_superficie_secundaria ? 'personalizado' : 'emphasys'),
  };
}

/** Respuesta pública de GET y PUT. El detalle técnico solo va a superadministradores. */
export function aRespuesta(
  empresaId: number,
  row: IdentidadVisualRow | null,
  esSuperadmin: boolean
): IdentidadVisualRespuesta {
  const { colores, origen, superficieSecundaria, modo } = vigentesDeFila(row);
  const propuesta =
    row && row.propuesta_estado
      ? {
          estado: row.propuesta_estado,
          primario: row.propuesta_primario,
          acento: row.propuesta_acento,
          sidebar: row.propuesta_sidebar,
          confianza: row.propuesta_confianza === null ? null : Number(row.propuesta_confianza),
          asset_id: row.propuesta_asset_id,
          algoritmo_version: row.propuesta_algoritmo_version,
          generada_at: row.propuesta_generada_at,
          ...(esSuperadmin ? { detalle: row.propuesta_detalle } : {}),
        }
      : null;
  return {
    empresa_id: empresaId,
    colores,
    ...(row?.color_superficie_secundaria !== undefined ? { superficie_secundaria: superficieSecundaria ?? null } : {}),
    ...(row?.modo !== undefined ? { modo: modo ?? 'emphasys' } : {}),
    ...(row?.modo_presentacion_logo !== undefined ? { modo_presentacion_logo: row.modo_presentacion_logo ?? 'automatico' } : {}),
    origen,
    propuesta,
    updated_at: row?.updated_at ?? null,
    actualizado_por: row?.actualizado_por ?? null,
  };
}

/**
 * Guarda los colores aprobados en una transacción: bloquea la fila, aplica la
 * regla de origen y de confirmación (`aplicarCambios`) y hace el upsert. Si hay
 * conflictos con colores manuales, o si nada cambia, no escribe nada. La
 * propuesta no se toca.
 */
export async function guardarColoresIdentidad(
  empresaId: number,
  cambios: Partial<Record<RolIdentidad, string | null>>,
  confirmarSobrescritura: boolean,
  usuarioId: number,
  superficieSecundaria?: string | null,
  modo?: ModoIdentidad,
  modoPresentacionLogo: ModoPresentacionLogo = 'automatico'
): Promise<ResultadoGuardar> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<IdentidadVisualRow>(
      `SELECT ${COLUMNAS}
         FROM core.empresas_identidad_visual
        WHERE empresa_id = $1
        FOR UPDATE`,
      [empresaId]
    );
    const resultado = aplicarCambios(vigentesDeFila(rows[0] ?? null), cambios, confirmarSobrescritura, superficieSecundaria, modo);
    if (!resultado.ok) {
      await client.query("ROLLBACK");
      return { ok: false, conflictos: resultado.conflictos };
    }
    if (resultado.cambiados.length === 0 && resultado.superficieSecundaria === (rows[0]?.color_superficie_secundaria ?? null) && resultado.modo === (rows[0]?.modo ?? 'emphasys') && modoPresentacionLogo === (rows[0]?.modo_presentacion_logo ?? 'automatico')) {
      // Nada cambia: no se crea ni se toca la fila.
      await client.query("ROLLBACK");
      return { ok: true, identidad: rows[0] ?? null };
    }
    const { colores, origen } = resultado;
    const guardado = await client.query<IdentidadVisualRow>(
      `INSERT INTO core.empresas_identidad_visual
              (empresa_id, color_primario, color_acento, color_sidebar, color_superficie_secundaria, modo,
               origen_primario, origen_acento, origen_sidebar, actualizado_por, modo_presentacion_logo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (empresa_id) DO UPDATE
          SET color_primario  = EXCLUDED.color_primario,
              color_acento    = EXCLUDED.color_acento,
              color_sidebar   = EXCLUDED.color_sidebar,
              color_superficie_secundaria = EXCLUDED.color_superficie_secundaria,
              modo            = EXCLUDED.modo,
              origen_primario = EXCLUDED.origen_primario,
              origen_acento   = EXCLUDED.origen_acento,
              origen_sidebar  = EXCLUDED.origen_sidebar,
              actualizado_por = EXCLUDED.actualizado_por,
              modo_presentacion_logo = EXCLUDED.modo_presentacion_logo,
              updated_at      = now()
       RETURNING ${COLUMNAS}`,
      [
        empresaId,
        colores.primario,
        colores.acento,
        colores.sidebar,
        resultado.superficieSecundaria,
        resultado.modo,
        origen.primario,
        origen.acento,
        origen.sidebar,
        usuarioId,
        modoPresentacionLogo,
      ]
    );
    await client.query("COMMIT");
    return { ok: true, identidad: guardado.rows[0]! };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw error;
  } finally {
    client.release();
  }
}
