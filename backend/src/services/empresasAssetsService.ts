import pool from "../config/database";

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

export type EmpresaAssetInsert = Pick<
  EmpresaAsset,
  "empresa_id" | "tipo" | "nombre_archivo" | "ruta" | "mime_type" | "tamano_bytes"
>;

export async function obtenerEmpresaAssetPorTipo(empresaId: number, tipo: string): Promise<EmpresaAsset | null> {
  const { rows } = await pool.query<EmpresaAsset>(
    `SELECT *
       FROM core.empresas_assets
      WHERE empresa_id = $1
        AND tipo = $2
        AND activo = true
      ORDER BY created_at DESC
      LIMIT 1`,
    [empresaId, tipo]
  );

  return rows[0] ?? null;
}

export async function crearEmpresaAsset(payload: EmpresaAssetInsert): Promise<EmpresaAsset> {
  const values = [
    payload.empresa_id,
    payload.tipo,
    payload.nombre_archivo,
    payload.ruta,
    payload.mime_type,
    payload.tamano_bytes,
  ];

  const { rows } = await pool.query<EmpresaAsset>(
    `INSERT INTO core.empresas_assets (
       empresa_id,
       tipo,
       nombre_archivo,
       ruta,
       mime_type,
       tamano_bytes,
       activo
     ) VALUES (
       $1, $2, $3, $4, $5, $6, true
     )
     RETURNING *`,
    values
  );

  return rows[0];
}
