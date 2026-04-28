import pool from '../../../config/database';

export type EmailPlantilla = {
  id: number;
  empresa_id: number;
  tipo: string;
  asunto: string;
  html: string;
};

export async function obtenerPlantillaEmail(
  empresaId: number,
  tipo: string
): Promise<EmailPlantilla | null> {
  const query = `
    SELECT id, empresa_id, tipo, asunto, html
      FROM crm.email_plantillas
     WHERE empresa_id = $1
       AND LOWER(tipo) = LOWER($2)
     LIMIT 1
  `;

  const { rows } = await pool.query<EmailPlantilla>(query, [empresaId, tipo]);
  return rows[0] ?? null;
}