import pool from '../../../config/database';
import type { PoolClient } from 'pg';

export type CfdiPacConfigRow = {
  id: number;
  pac: string;
  modo: 'sandbox' | 'produccion';
  base_url: string;
  username: string;
  password: string;
  stamp_path: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type UpdateCfdiPacConfigPayload = {
  pac: string;
  modo: 'sandbox' | 'produccion';
  base_url: string;
  username: string;
  password?: string | null;
  stamp_path: string;
  activo: boolean;
};

export type CreateCfdiPacConfigPayload = {
  pac: string;
  modo: 'sandbox' | 'produccion';
  base_url: string;
  username: string;
  password: string;
  stamp_path: string;
  activo: boolean;
};

export async function listarCfdiPacConfigs(): Promise<CfdiPacConfigRow[]> {
  const { rows } = await pool.query<CfdiPacConfigRow>(
    `SELECT id,
            pac,
            modo,
            base_url,
            username,
            password,
            stamp_path,
            activo,
            created_at,
            updated_at
       FROM core.cfdi_pac_config
      ORDER BY CASE modo WHEN 'sandbox' THEN 0 ELSE 1 END, pac ASC`
  );

  return rows;
}

export async function obtenerCfdiPacConfigPorId(id: number): Promise<CfdiPacConfigRow | null> {
  const { rows } = await pool.query<CfdiPacConfigRow>(
    `SELECT id,
            pac,
            modo,
            base_url,
            username,
            password,
            stamp_path,
            activo,
            created_at,
            updated_at
       FROM core.cfdi_pac_config
      WHERE id = $1
      LIMIT 1`,
    [id]
  );

  return rows[0] ?? null;
}

export async function actualizarCfdiPacConfig(
  id: number,
  payload: UpdateCfdiPacConfigPayload
): Promise<CfdiPacConfigRow | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (payload.activo) {
      await desactivarOtrasConfiguracionesActivas(client, id);
    }

    const { rows } = await client.query<CfdiPacConfigRow>(
      `UPDATE core.cfdi_pac_config
          SET pac = $2,
              modo = $3,
              base_url = $4,
              username = $5,
              password = COALESCE(NULLIF($6, ''), password),
              stamp_path = $7,
              activo = $8,
              updated_at = NOW()
        WHERE id = $1
        RETURNING id,
                  pac,
                  modo,
                  base_url,
                  username,
                  password,
                  stamp_path,
                  activo,
                  created_at,
                  updated_at`,
      [
        id,
        payload.pac,
        payload.modo,
        payload.base_url,
        payload.username,
        payload.password ?? null,
        payload.stamp_path,
        payload.activo,
      ]
    );

    await client.query('COMMIT');
    return rows[0] ?? null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function crearCfdiPacConfig(
  payload: CreateCfdiPacConfigPayload
): Promise<CfdiPacConfigRow> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (payload.activo) {
      await desactivarOtrasConfiguracionesActivas(client);
    }

    const { rows } = await client.query<CfdiPacConfigRow>(
      `INSERT INTO core.cfdi_pac_config (
          pac,
          modo,
          base_url,
          username,
          password,
          stamp_path,
          activo,
          created_at,
          updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id,
                 pac,
                 modo,
                 base_url,
                 username,
                 password,
                 stamp_path,
                 activo,
                 created_at,
                 updated_at`,
      [
        payload.pac,
        payload.modo,
        payload.base_url,
        payload.username,
        payload.password,
        payload.stamp_path,
        payload.activo,
      ]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function desactivarOtrasConfiguracionesActivas(client: PoolClient, excludeId?: number): Promise<void> {
  const params = excludeId ? [excludeId] : [];
  const excludeClause = excludeId ? 'AND id <> $1' : '';

  await client.query(
    `UPDATE core.cfdi_pac_config
        SET activo = FALSE,
            updated_at = NOW()
      WHERE activo = TRUE
        ${excludeClause}`,
    params
  );
}