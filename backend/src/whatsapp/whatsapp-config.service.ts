import pool from "../config/database";

type WhatsappConfig = {
  api_key: string;
  phone_number: string;
  app_name: string;
};

export async function getWhatsappConfig(empresaId: number): Promise<WhatsappConfig> {
  const query = `
    SELECT api_key, phone_number, app_name
      FROM whatsapp.config
     WHERE empresa_id = $1
       AND activo = true
     LIMIT 1
  `;
  const { rows } = await pool.query<WhatsappConfig>(query, [empresaId]);
  const config = rows[0];
  if (!config) {
    console.error("WhatsApp no configurado para esta empresa", { empresaId });
    throw new Error("WhatsApp no configurado para esta empresa");
  }
  if (!config.api_key || !config.phone_number || !config.app_name) {
    throw new Error("Configuración de WhatsApp incompleta para esta empresa");
  }
  return config;
}
