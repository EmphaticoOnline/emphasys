import pool from '../../../config/database';

export interface CfdiSatAutomatizacionRow {
  empresa_id: number;
  auto_verificar: boolean;
  auto_descargar: boolean;
  frecuencia_minutos: number;
  ultimo_run_en: string | null;
  actualizado_por: number | null;
  actualizado_en: string;
}

const DEFAULTS = {
  auto_verificar: false,
  auto_descargar: false,
  frecuencia_minutos: 60,
};

/** Devuelve la configuración de la empresa, o los defaults (sin insertar fila) si nunca se configuró. */
export async function obtenerAutomatizacion(empresaId: number): Promise<CfdiSatAutomatizacionRow> {
  const { rows } = await pool.query<CfdiSatAutomatizacionRow>(
    `SELECT empresa_id, auto_verificar, auto_descargar, frecuencia_minutos,
            ultimo_run_en, actualizado_por, actualizado_en
       FROM core.cfdi_sat_automatizacion
      WHERE empresa_id = $1
      LIMIT 1`,
    [empresaId]
  );

  if (rows[0]) return rows[0];

  return {
    empresa_id: empresaId,
    auto_verificar: DEFAULTS.auto_verificar,
    auto_descargar: DEFAULTS.auto_descargar,
    frecuencia_minutos: DEFAULTS.frecuencia_minutos,
    ultimo_run_en: null,
    actualizado_por: null,
    actualizado_en: new Date(0).toISOString(),
  };
}

export interface ActualizarAutomatizacionParams {
  autoVerificar: boolean;
  autoDescargar: boolean;
  frecuenciaMinutos: number;
  usuarioId: number;
}

export async function actualizarAutomatizacion(
  empresaId: number,
  params: ActualizarAutomatizacionParams
): Promise<CfdiSatAutomatizacionRow> {
  const { rows } = await pool.query<CfdiSatAutomatizacionRow>(
    `INSERT INTO core.cfdi_sat_automatizacion
       (empresa_id, auto_verificar, auto_descargar, frecuencia_minutos, actualizado_por, actualizado_en)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (empresa_id) DO UPDATE
        SET auto_verificar = EXCLUDED.auto_verificar,
            auto_descargar = EXCLUDED.auto_descargar,
            frecuencia_minutos = EXCLUDED.frecuencia_minutos,
            actualizado_por = EXCLUDED.actualizado_por,
            actualizado_en = NOW()
     RETURNING empresa_id, auto_verificar, auto_descargar, frecuencia_minutos,
               ultimo_run_en, actualizado_por, actualizado_en`,
    [empresaId, params.autoVerificar, params.autoDescargar, params.frecuenciaMinutos, params.usuarioId]
  );

  return rows[0];
}

export async function marcarUltimoRun(empresaId: number): Promise<void> {
  await pool.query(
    `INSERT INTO core.cfdi_sat_automatizacion (empresa_id, ultimo_run_en)
     VALUES ($1, NOW())
     ON CONFLICT (empresa_id) DO UPDATE SET ultimo_run_en = NOW()`,
    [empresaId]
  );
}
