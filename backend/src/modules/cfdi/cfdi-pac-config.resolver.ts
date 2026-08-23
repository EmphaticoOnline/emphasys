import type { QueryResultRow } from 'pg';
import pool from '../../config/database';

export type PacConfigResolved = {
  id: number;
  pac: string;
  modo: 'sandbox' | 'produccion';
  base_url: string;
  username: string;
  password: string;
  stamp_path: string;
};

export type PacConfigDb = {
  query<T extends QueryResultRow = any>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

const CONFIG_COLUMNS = `cfg.id, cfg.pac, cfg.modo, cfg.base_url,
  cfg.username, cfg.password, cfg.stamp_path`;

export async function resolvePacConfigForEmpresa(
  empresaId: number,
  db: PacConfigDb = pool
): Promise<PacConfigResolved> {
  const { rows } = await db.query<PacConfigResolved>(
    `SELECT ${CONFIG_COLUMNS}
       FROM core.empresas_cfdi_pac_config assignment
       JOIN core.cfdi_pac_config cfg ON cfg.id = assignment.cfdi_pac_config_id
      WHERE assignment.empresa_id = $1 AND cfg.activo = true
      LIMIT 1`,
    [empresaId]
  );
  if (!rows[0]) {
    throw new Error(`La empresa ${empresaId} no tiene una configuración PAC activa asignada.`);
  }
  return rows[0];
}

export async function resolvePacConfigById(
  configId: number,
  db: PacConfigDb = pool,
  requireActive = true
): Promise<PacConfigResolved> {
  const { rows } = await db.query<PacConfigResolved>(
    `SELECT ${CONFIG_COLUMNS}
       FROM core.cfdi_pac_config cfg
      WHERE cfg.id = $1 AND ($2::boolean = false OR cfg.activo = true)
      LIMIT 1`,
    [configId, requireActive]
  );
  if (!rows[0]) throw new Error(`La configuración PAC ${configId} no existe o está inactiva.`);
  return rows[0];
}

export async function resolveHistoricalPacConfig(
  input: { empresaId: number; configId?: number | null; pac?: string | null; modalidad?: string | null },
  db: PacConfigDb = pool
): Promise<PacConfigResolved> {
  if (input.configId) return resolvePacConfigById(input.configId, db, false);

  const pac = String(input.pac || '').trim().toLowerCase();
  if (pac) {
    const { rows } = await db.query<PacConfigResolved>(
      `SELECT ${CONFIG_COLUMNS}
         FROM core.cfdi_pac_config cfg
        WHERE lower(cfg.pac) = $1 AND cfg.activo = true
        ORDER BY cfg.id`,
      [pac]
    );
    if (rows.length === 1) return rows[0];
  }

  // pac_modalidad (lite/web) no identifica Sandbox vs Producción. El único fallback
  // permitido es la asignación explícita de la empresa, nunca una configuración global.
  console.warn('[CFDI][PAC] Identidad histórica insuficiente; se usará la asignación explícita de la empresa.', {
    empresaId: input.empresaId,
    pac: pac || null,
    modalidad: input.modalidad || null,
  });
  return resolvePacConfigForEmpresa(input.empresaId, db);
}
