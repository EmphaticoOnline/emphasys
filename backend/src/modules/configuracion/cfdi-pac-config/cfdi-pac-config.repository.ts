import pool from '../../../config/database';

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

export type EmpresaCfdiPacAssignmentRow = {
  empresa_id: number;
  empresa_nombre: string;
  cfdi_pac_config_id: number;
  pac: string;
  modo: 'sandbox' | 'produccion';
  activo: boolean;
  csd_registrado: boolean;
  csd_fecha_actualizacion: string | null;
};

export async function obtenerAsignacionCfdiPacEmpresa(empresaId: number): Promise<EmpresaCfdiPacAssignmentRow | null> {
  const { rows } = await pool.query<EmpresaCfdiPacAssignmentRow>(
    `SELECT a.empresa_id, e.nombre AS empresa_nombre, a.cfdi_pac_config_id,
            cfg.pac, cfg.modo, cfg.activo, a.csd_registrado, a.csd_fecha_actualizacion
       FROM core.empresas_cfdi_pac_config a
       JOIN core.empresas e ON e.id = a.empresa_id
       JOIN core.cfdi_pac_config cfg ON cfg.id = a.cfdi_pac_config_id
      WHERE a.empresa_id = $1
      LIMIT 1`,
    [empresaId]
  );
  return rows[0] ?? null;
}

export async function guardarAsignacionCfdiPacEmpresa(
  empresaId: number,
  configId: number
): Promise<EmpresaCfdiPacAssignmentRow> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: configRows } = await client.query<{ id: number }>(
      `SELECT id FROM core.cfdi_pac_config WHERE id=$1 AND activo=true FOR UPDATE`,
      [configId]
    );
    if (!configRows[0]) throw new Error('La configuración PAC seleccionada no existe o está inactiva.');
    const { rows: currentRows } = await client.query<{ cfdi_pac_config_id: number }>(
      `SELECT cfdi_pac_config_id
         FROM core.empresas_cfdi_pac_config
        WHERE empresa_id=$1
        FOR UPDATE`,
      [empresaId]
    );
    const changed = Number(currentRows[0]?.cfdi_pac_config_id ?? 0) !== configId;

    await client.query(
      `INSERT INTO core.empresas_cfdi_pac_config
         (empresa_id, cfdi_pac_config_id, csd_registrado, csd_fecha_actualizacion)
       VALUES ($1,$2,false,NULL)
       ON CONFLICT (empresa_id) DO UPDATE
         SET cfdi_pac_config_id=EXCLUDED.cfdi_pac_config_id,
             csd_registrado=CASE
               WHEN core.empresas_cfdi_pac_config.cfdi_pac_config_id=EXCLUDED.cfdi_pac_config_id
                 THEN core.empresas_cfdi_pac_config.csd_registrado ELSE false END,
             csd_fecha_actualizacion=CASE
               WHEN core.empresas_cfdi_pac_config.cfdi_pac_config_id=EXCLUDED.cfdi_pac_config_id
                 THEN core.empresas_cfdi_pac_config.csd_fecha_actualizacion ELSE NULL END,
             updated_at=now()`,
      [empresaId, configId]
    );
    if (changed) {
      await client.query(
        `UPDATE core.empresas
            SET cfdi_csd_registrado_facturama=false,
                cfdi_csd_fecha_actualizacion=NULL
          WHERE id=$1`,
        [empresaId]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  const assignment = await obtenerAsignacionCfdiPacEmpresa(empresaId);
  if (!assignment) throw new Error('No se pudo recuperar la asignación PAC guardada.');
  return assignment;
}

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
