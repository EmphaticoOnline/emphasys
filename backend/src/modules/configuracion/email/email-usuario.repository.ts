import pool from '../../../config/database';
import type { ConfiguracionEmailBaseRow, UpsertConfiguracionEmailPayload } from './email.repository';

export type ConfiguracionEmailUsuarioRow = ConfiguracionEmailBaseRow & {
  usuario_id: number;
};

export async function obtenerConfiguracionEmailPorUsuario(
  empresaId: number,
  usuarioId: number
): Promise<ConfiguracionEmailUsuarioRow | null> {
  const { rows } = await pool.query<ConfiguracionEmailUsuarioRow>(
    `SELECT id,
            usuario_id,
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
       FROM crm.configuracion_email_usuario
      WHERE empresa_id = $1
        AND usuario_id = $2
      LIMIT 1`,
    [empresaId, usuarioId]
  );

  return rows[0] ?? null;
}

export async function obtenerConfiguracionEmailActivaPorUsuario(
  empresaId: number,
  usuarioId: number
): Promise<ConfiguracionEmailUsuarioRow | null> {
  const { rows } = await pool.query<ConfiguracionEmailUsuarioRow>(
    `SELECT id,
            usuario_id,
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
       FROM crm.configuracion_email_usuario
      WHERE empresa_id = $1
        AND usuario_id = $2
        AND activo = TRUE
      LIMIT 1`,
    [empresaId, usuarioId]
  );

  return rows[0] ?? null;
}

export async function upsertConfiguracionEmailUsuario(
  empresaId: number,
  usuarioId: number,
  payload: UpsertConfiguracionEmailPayload
): Promise<ConfiguracionEmailUsuarioRow> {
  console.log('[SMTP SAVE][repository][usuario] payload', {
    empresaId,
    usuarioId,
    smtp_user: payload.smtp_user,
    smtp_password_present: Boolean(payload.smtp_password),
    smtp_password_length: payload.smtp_password?.length ?? 0,
  });

  const { rows } = await pool.query<ConfiguracionEmailUsuarioRow>(
    `INSERT INTO crm.configuracion_email_usuario (
        usuario_id,
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
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     ON CONFLICT (usuario_id, empresa_id)
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
               usuario_id,
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
      usuarioId,
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

  console.log('[SMTP SAVE][repository][usuario] row returning', {
    empresaId,
    usuarioId,
    smtp_password_present: Boolean(rows[0]?.smtp_password),
    smtp_password_length: rows[0]?.smtp_password?.length ?? 0,
  });

  return rows[0];
}