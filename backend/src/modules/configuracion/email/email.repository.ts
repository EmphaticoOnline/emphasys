import pool from '../../../config/database';

export type ConfiguracionEmailBaseRow = {
  id: number;
  empresa_id: number;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string | null;
  smtp_secure: boolean;
  email_remitente: string | null;
  nombre_remitente: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type ConfiguracionEmailEmpresaRow = ConfiguracionEmailBaseRow;

export type UpsertConfiguracionEmailPayload = {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string | null;
  smtp_secure: boolean;
  email_remitente: string | null;
  nombre_remitente: string | null;
  activo: boolean;
};

export async function obtenerConfiguracionEmailPorEmpresa(
  empresaId: number
): Promise<ConfiguracionEmailEmpresaRow | null> {
  const { rows } = await pool.query<ConfiguracionEmailEmpresaRow>(
    `SELECT id,
            empresa_id,
            smtp_host,
            smtp_port,
            smtp_user,
            smtp_password,
            smtp_secure,
            email_remitente,
            nombre_remitente,
            activo,
            created_at,
            updated_at
       FROM crm.configuracion_email_empresa
      WHERE empresa_id = $1
      LIMIT 1`,
    [empresaId]
  );

  return rows[0] ?? null;
}

export async function obtenerConfiguracionEmailActivaPorEmpresa(
  empresaId: number
): Promise<ConfiguracionEmailEmpresaRow | null> {
  const { rows } = await pool.query<ConfiguracionEmailEmpresaRow>(
    `SELECT id,
            empresa_id,
            smtp_host,
            smtp_port,
            smtp_user,
            smtp_password,
            smtp_secure,
            email_remitente,
            nombre_remitente,
            activo,
            created_at,
            updated_at
       FROM crm.configuracion_email_empresa
      WHERE empresa_id = $1
        AND activo = TRUE
      LIMIT 1`,
    [empresaId]
  );

  return rows[0] ?? null;
}

export async function upsertConfiguracionEmailEmpresa(
  empresaId: number,
  payload: UpsertConfiguracionEmailPayload
): Promise<ConfiguracionEmailEmpresaRow> {
  console.log('[SMTP SAVE][repository][empresa] payload', {
    empresaId,
    smtp_user: payload.smtp_user,
    smtp_password_present: Boolean(payload.smtp_password),
    smtp_password_length: payload.smtp_password?.length ?? 0,
  });

  const { rows } = await pool.query<ConfiguracionEmailEmpresaRow>(
    `INSERT INTO crm.configuracion_email_empresa (
        empresa_id,
        smtp_host,
        smtp_port,
        smtp_user,
        smtp_password,
        smtp_secure,
        email_remitente,
        nombre_remitente,
        activo,
        updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     ON CONFLICT (empresa_id)
     DO UPDATE SET
        smtp_host = EXCLUDED.smtp_host,
        smtp_port = EXCLUDED.smtp_port,
        smtp_user = EXCLUDED.smtp_user,
        smtp_password = EXCLUDED.smtp_password,
        smtp_secure = EXCLUDED.smtp_secure,
        email_remitente = EXCLUDED.email_remitente,
        nombre_remitente = EXCLUDED.nombre_remitente,
        activo = EXCLUDED.activo,
        updated_at = now()
     RETURNING id,
               empresa_id,
               smtp_host,
               smtp_port,
               smtp_user,
               smtp_password,
               smtp_secure,
               email_remitente,
               nombre_remitente,
               activo,
               created_at,
               updated_at`,
    [
      empresaId,
      payload.smtp_host,
      payload.smtp_port,
      payload.smtp_user,
      payload.smtp_password,
      payload.smtp_secure,
      payload.email_remitente,
      payload.nombre_remitente,
      payload.activo,
    ]
  );

  console.log('[SMTP SAVE][repository][empresa] row returning', {
    empresaId,
    smtp_password_present: Boolean(rows[0]?.smtp_password),
    smtp_password_length: rows[0]?.smtp_password?.length ?? 0,
  });

  return rows[0];
}