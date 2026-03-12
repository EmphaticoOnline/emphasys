import pool from '../../../config/database';

export type DocumentoEmpresa = {
  id: number;
  codigo: string;
  nombre: string;
  nombre_plural: string;
  icono: string | null;
  orden: number;
  habilitado: boolean;
};

export type TransicionDocumento = {
  tipo_documento_origen_id: number;
  tipo_documento_destino_id: number;
  activo: boolean;
};

export async function obtenerDocumentosEmpresa(empresaId: number): Promise<DocumentoEmpresa[]> {
  const query = `
    SELECT
      td.id,
      td.codigo,
      td.nombre,
      td.nombre_plural,
      td.icono,
      td.orden,
      COALESCE(etd.activo, FALSE) AS habilitado
    FROM core.tipos_documento td
    LEFT JOIN core.empresas_tipos_documento etd
      ON etd.tipo_documento_id = td.id
     AND etd.empresa_id = $1
    WHERE td.activo = TRUE
    ORDER BY td.orden, td.nombre;
  `;

  const { rows } = await pool.query<DocumentoEmpresa>(query, [empresaId]);
  return rows;
}

export async function documentoEstaHabilitado(empresaId: number, tipoDocumentoId: number): Promise<boolean> {
  const { rows } = await pool.query<{ existe: boolean }>(
    `SELECT COALESCE(activo, FALSE) AS existe
       FROM core.empresas_tipos_documento
      WHERE empresa_id = $1 AND tipo_documento_id = $2
      LIMIT 1`,
    [empresaId, tipoDocumentoId]
  );

  return rows[0]?.existe ?? false;
}

export async function existeTipoDocumento(tipoDocumentoId: number): Promise<boolean> {
  const { rows } = await pool.query<{ existe: boolean }>(
    `SELECT EXISTS (
        SELECT 1 FROM core.tipos_documento
         WHERE id = $1
           AND activo = TRUE
      ) AS existe`,
    [tipoDocumentoId]
  );

  return rows[0]?.existe ?? false;
}

export async function upsertDocumentoEmpresa(
  empresaId: number,
  tipoDocumentoId: number,
  activo: boolean
): Promise<{ empresa_id: number; tipo_documento_id: number; activo: boolean } | null> {
  const { rows } = await pool.query<{ empresa_id: number; tipo_documento_id: number; activo: boolean }>(
    `INSERT INTO core.empresas_tipos_documento (empresa_id, tipo_documento_id, activo)
       VALUES ($1, $2, $3)
   ON CONFLICT (empresa_id, tipo_documento_id)
     DO UPDATE SET activo = EXCLUDED.activo
   RETURNING empresa_id, tipo_documento_id, activo`,
    [empresaId, tipoDocumentoId, activo]
  );

  return rows[0] ?? null;
}

export async function obtenerDocumentosActivosEmpresa(empresaId: number): Promise<DocumentoEmpresa[]> {
  const query = `
    SELECT
      td.id,
      td.codigo,
      td.nombre,
      td.nombre_plural,
      td.icono,
      td.orden,
      TRUE AS habilitado
    FROM core.tipos_documento td
    JOIN core.empresas_tipos_documento etd
      ON etd.tipo_documento_id = td.id
     AND etd.empresa_id = $1
    WHERE td.activo = TRUE
      AND etd.activo = TRUE
    ORDER BY td.orden, td.nombre;
  `;

  const { rows } = await pool.query<DocumentoEmpresa>(query, [empresaId]);
  return rows;
}

export async function obtenerTransicionesEmpresa(empresaId: number): Promise<TransicionDocumento[]> {
  const { rows } = await pool.query<TransicionDocumento>(
    `SELECT tipo_documento_origen_id, tipo_documento_destino_id, activo
       FROM core.empresas_tipos_documento_transiciones
      WHERE empresa_id = $1`,
    [empresaId]
  );

  return rows;
}

export async function upsertTransicionDocumento(
  empresaId: number,
  origenId: number,
  destinoId: number,
  activo: boolean
): Promise<TransicionDocumento | null> {
  const { rows } = await pool.query<TransicionDocumento>(
    `INSERT INTO core.empresas_tipos_documento_transiciones (
        empresa_id,
        tipo_documento_origen_id,
        tipo_documento_destino_id,
        activo
     ) VALUES ($1, $2, $3, $4)
     ON CONFLICT (empresa_id, tipo_documento_origen_id, tipo_documento_destino_id)
     DO UPDATE SET activo = EXCLUDED.activo
     RETURNING tipo_documento_origen_id, tipo_documento_destino_id, activo`,
    [empresaId, origenId, destinoId, activo]
  );

  return rows[0] ?? null;
}