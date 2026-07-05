import pool from '../../../config/database';

export interface CfdiSatCredencialRow {
  id: number;
  empresa_id: number;
  rfc_certificado: string;
  cer_content_encrypted: string;
  key_content_encrypted: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  cargado_por: number;
  cargado_en: string;
}

export async function obtenerCredencialesPorEmpresa(empresaId: number): Promise<CfdiSatCredencialRow | null> {
  const { rows } = await pool.query<CfdiSatCredencialRow>(
    `SELECT id, empresa_id, rfc_certificado, cer_content_encrypted, key_content_encrypted,
            vigencia_desde, vigencia_hasta, cargado_por, cargado_en
       FROM core.cfdi_sat_credenciales
      WHERE empresa_id = $1
      LIMIT 1`,
    [empresaId]
  );

  return rows[0] ?? null;
}

interface GuardarCredencialesParams {
  empresaId: number;
  rfcCertificado: string;
  cerContentEncrypted: string;
  keyContentEncrypted: string;
  vigenciaDesde: Date;
  vigenciaHasta: Date;
  cargadoPor: number;
}

/**
 * Reemplaza (upsert) la credencial FIEL de la empresa. Solo existe una credencial
 * activa por empresa; "reemplazar" significa sobrescribir la fila existente.
 */
export async function guardarCredenciales(params: GuardarCredencialesParams): Promise<CfdiSatCredencialRow> {
  const { rows } = await pool.query<CfdiSatCredencialRow>(
    `INSERT INTO core.cfdi_sat_credenciales
       (empresa_id, rfc_certificado, cer_content_encrypted, key_content_encrypted,
        vigencia_desde, vigencia_hasta, cargado_por, cargado_en)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (empresa_id) DO UPDATE
        SET rfc_certificado       = EXCLUDED.rfc_certificado,
            cer_content_encrypted = EXCLUDED.cer_content_encrypted,
            key_content_encrypted = EXCLUDED.key_content_encrypted,
            vigencia_desde        = EXCLUDED.vigencia_desde,
            vigencia_hasta        = EXCLUDED.vigencia_hasta,
            cargado_por           = EXCLUDED.cargado_por,
            cargado_en            = NOW()
      RETURNING id, empresa_id, rfc_certificado, cer_content_encrypted, key_content_encrypted,
                vigencia_desde, vigencia_hasta, cargado_por, cargado_en`,
    [
      params.empresaId,
      params.rfcCertificado,
      params.cerContentEncrypted,
      params.keyContentEncrypted,
      params.vigenciaDesde,
      params.vigenciaHasta,
      params.cargadoPor,
    ]
  );

  return rows[0];
}

export async function eliminarCredenciales(empresaId: number): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM core.cfdi_sat_credenciales WHERE empresa_id = $1`, [empresaId]);
  return (rowCount ?? 0) > 0;
}
