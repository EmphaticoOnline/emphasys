import pool from '../../config/database';

export type PlantillaDocumento = {
  id: string | number;
  empresa_id: string | number;
  tipo_documento: string;
  nombre: string;
  contenido_html: string;
  activo: boolean;
  created_at: string | Date | null;
  updated_at: string | Date | null;
};

export async function obtenerPlantillaActiva(
  empresaId: string | number,
  tipoDocumento: string
): Promise<PlantillaDocumento | null> {
  console.log('REPO QUERY:', empresaId, tipoDocumento);
  const query = `
    SELECT id, empresa_id, tipo_documento, nombre, contenido_html, activo, created_at, updated_at
      FROM public.plantillas_documento
     WHERE empresa_id = $1
       AND LOWER(tipo_documento) = LOWER($2)
       AND activo = TRUE
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1;
  `;

  const { rows } = await pool.query<PlantillaDocumento>(query, [empresaId, tipoDocumento]);
  console.log('REPO RESULT:', rows);
  return rows[0] ?? null;
}
