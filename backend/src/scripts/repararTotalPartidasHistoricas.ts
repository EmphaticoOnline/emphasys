import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { resolvePostgresConnection, withPostgresTunnel } from './lib/postgresSshTunnel';

const TOLERANCIA = 0.02;

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

type Candidate = {
  partida_id: number;
  documento_id: number;
  empresa_id: number;
  total_partida_anterior: number | null;
  total_partida_nuevo: number;
};

type DocumentCheck = {
  documento_id: number;
  empresa_id: number;
  max_diff: number;
};

type Options = {
  apply: boolean;
  confirm: boolean;
  empresaIds: number[] | null;
  desde: string | null;
  hasta: string | null;
};

function parseOptions(): Options {
  const args = new Set(process.argv.slice(2));
  if (args.has('--dry-run') === args.has('--apply')) {
    throw new Error('Debe indicar exactamente uno de: --dry-run o --apply');
  }
  const apply = args.has('--apply');
  if (apply && !args.has('--confirm')) throw new Error('--apply requiere también --confirm');
  const value = (prefix: string): string | null => {
    const item = process.argv.slice(2).find((arg) => arg.startsWith(`${prefix}=`));
    return item ? item.slice(prefix.length + 1) : null;
  };
  const empresa = value('--empresa');
  const desde = value('--desde');
  const hasta = value('--hasta');
  if (empresa !== null && (!/^\d+$/.test(empresa) || Number(empresa) <= 0)) throw new Error('--empresa debe ser un id entero positivo');
  for (const [label, date] of [['--desde', desde], ['--hasta', hasta]] as const) {
    if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${label} debe tener formato YYYY-MM-DD`);
  }
  return { apply, confirm: args.has('--confirm'), empresaIds: empresa ? [Number(empresa)] : null, desde, hasta };
}

function assertServerTarget(): void {
  if (process.env.DB_TARGET !== 'server') {
    throw new Error('Esta reparación exige DB_TARGET=server. No se ejecutará ningún cambio.');
  }
}

const taxCte = `
  WITH tax AS (
    SELECT
      dpi.partida_id,
      SUM(CASE WHEN LOWER(COALESCE(i.tipo, '')) = 'traslado' THEN COALESCE(dpi.monto, 0) ELSE 0 END) AS traslados,
      SUM(CASE WHEN LOWER(COALESCE(i.tipo, '')) = 'retencion' THEN COALESCE(dpi.monto, 0) ELSE 0 END) AS retenciones
    FROM documentos_partidas_impuestos dpi
    LEFT JOIN impuestos i ON i.id = dpi.impuesto_id
    GROUP BY dpi.partida_id
  )`;

function candidateQuery(): string {
  return `${taxCte}
    SELECT
      dp.id AS partida_id,
      d.id AS documento_id,
      d.empresa_id,
      dp.total_partida AS total_partida_anterior,
      dp.subtotal_partida + COALESCE(t.traslados, 0) - COALESCE(t.retenciones, 0) AS total_partida_nuevo
    FROM documentos_partidas dp
    JOIN documentos d ON d.id = dp.documento_id
    LEFT JOIN tax t ON t.partida_id = dp.id
    WHERE dp.subtotal_partida > 0
      AND COALESCE(dp.total_partida, 0) = 0
      AND ($1::int[] IS NULL OR d.empresa_id = ANY($1::int[]))
      AND LOWER(COALESCE(d.estatus_documento, '')) NOT LIKE 'cancel%'
      AND ($2::date IS NULL OR d.fecha_documento >= $2::date)
      AND ($3::date IS NULL OR d.fecha_documento <= $3::date)
    ORDER BY d.empresa_id, d.id, dp.id`;
}

function documentCheckQuery(documentIds: number[]): string {
  return `${taxCte},
    all_parts AS (
      SELECT
        d.id AS documento_id,
        d.empresa_id,
        d.subtotal AS doc_subtotal,
        d.iva AS doc_iva,
        d.total AS doc_total,
        dp.subtotal_partida,
        COALESCE(t.traslados, 0) AS traslados,
        COALESCE(t.retenciones, 0) AS retenciones,
        dp.subtotal_partida + COALESCE(t.traslados, 0) - COALESCE(t.retenciones, 0) AS total_reconstruido
      FROM documentos d
      JOIN documentos_partidas dp ON dp.documento_id = d.id
      LEFT JOIN tax t ON t.partida_id = dp.id
      WHERE d.id = ANY($1::int[])
    ),
    checks AS (
      SELECT
        documento_id,
        empresa_id,
        ABS(SUM(subtotal_partida) - MAX(doc_subtotal)) AS subtotal_diff,
        ABS(SUM(traslados) - SUM(retenciones) - MAX(doc_iva)) AS iva_diff,
        ABS(SUM(total_reconstruido) - MAX(doc_total)) AS total_diff
      FROM all_parts
      GROUP BY documento_id, empresa_id
    )
    SELECT documento_id, empresa_id, GREATEST(subtotal_diff, iva_diff, total_diff) AS max_diff
    FROM checks
    ORDER BY empresa_id, documento_id`;
}

async function main(): Promise<void> {
  assertServerTarget();
  const options = parseOptions();
  const apply = options.apply;
  const conn = resolvePostgresConnection();
  console.log(`[historical-repair] mode=${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`[historical-repair] DB_TARGET=${process.env.DB_TARGET}; filtros empresa=${options.empresaIds?.join(',') ?? 'todas'}, desde=${options.desde ?? 'inicio'}, hasta=${options.hasta ?? 'fin'}`);

  await withPostgresTunnel(async ({ host, port }) => {
    const client = new Client({ host, port, user: conn.user, password: conn.password, database: conn.database, ssl: conn.ssl });
    await client.connect();
    try {
      await client.query('BEGIN');

      const candidatesResult = await client.query<Candidate>(candidateQuery(), [options.empresaIds, options.desde, options.hasta]);
      const candidates = candidatesResult.rows;
      const documentIds = [...new Set(candidates.map((row) => row.documento_id))];
      const companyIds = [...new Set(candidates.map((row) => row.empresa_id))];
      const scope = await client.query<{ empresa_id: number; empresa: string; tipo_origen: string; documentos: string; partidas: string }>(
        `SELECT d.empresa_id, e.nombre AS empresa,
                COALESCE(origen.tipo_documento, 'sin_origen') AS tipo_origen,
                COUNT(DISTINCT d.id)::text AS documentos, COUNT(dp.id)::text AS partidas
         FROM documentos_partidas dp
         JOIN documentos d ON d.id = dp.documento_id
         JOIN core.empresas e ON e.id = d.empresa_id
         LEFT JOIN documentos origen ON origen.id = d.documento_origen_id
         WHERE dp.id = ANY($1::int[])
         GROUP BY d.empresa_id, e.nombre, COALESCE(origen.tipo_documento, 'sin_origen')
         ORDER BY d.empresa_id, tipo_origen`,
        [candidates.map((row) => row.partida_id)]
      );
      console.table(scope.rows);
      console.log(`[historical-repair] Se encontraron ${candidates.length} partidas en ${documentIds.length} documentos de ${companyIds.length} empresas.`);

      const checks = await client.query<DocumentCheck>(documentCheckQuery(documentIds), [documentIds]);
      const invalid = checks.rows.filter((row) => Number(row.max_diff) > TOLERANCIA);
      if (checks.rowCount !== documentIds.length || invalid.length > 0) {
        throw new Error(`Validación de encabezados fallida: documentos=${checks.rowCount}, inválidos=${invalid.length}`);
      }

      console.table(candidates.map((row) => ({
        partida_id: row.partida_id,
        documento_id: row.documento_id,
        empresa_id: row.empresa_id,
        anterior: row.total_partida_anterior,
        nuevo: Number(row.total_partida_nuevo),
      })));
      console.log(`[historical-repair] candidatos validados: ${candidates.length} partidas / ${documentIds.length} documentos`);

      if (!apply) {
        await client.query('ROLLBACK');
        console.log('[historical-repair] dry-run terminado; ROLLBACK intencional, no se modificó ningún dato.');
        return;
      }

      const updated = await client.query(
        `${taxCte}, reconstructed AS (
          SELECT dp.id AS partida_id,
            dp.subtotal_partida + COALESCE(t.traslados, 0) - COALESCE(t.retenciones, 0) AS total_partida_nuevo
          FROM documentos_partidas dp
          JOIN documentos d ON d.id = dp.documento_id
          LEFT JOIN tax t ON t.partida_id = dp.id
          WHERE dp.subtotal_partida > 0
            AND COALESCE(dp.total_partida, 0) = 0
            AND ($1::int[] IS NULL OR d.empresa_id = ANY($1::int[]))
            AND d.id = ANY($2::int[])
            AND LOWER(COALESCE(d.estatus_documento, '')) NOT LIKE 'cancel%'
        )
        UPDATE documentos_partidas dp
        SET total_partida = r.total_partida_nuevo
        FROM reconstructed r
        WHERE dp.id = r.partida_id`,
        [options.empresaIds, documentIds]
      );
      if (updated.rowCount !== candidates.length) {
        throw new Error(`Filas actualizadas inesperadas: ${updated.rowCount}; esperado=${candidates.length}`);
      }

      const remaining = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM documentos_partidas dp JOIN documentos d ON d.id = dp.documento_id
         WHERE dp.subtotal_partida > 0 AND COALESCE(dp.total_partida, 0) = 0
           AND d.id = ANY($1::int[])
           AND LOWER(COALESCE(d.estatus_documento, '')) NOT LIKE 'cancel%'`,
        [documentIds]
      );
      if (Number(remaining.rows[0].count) !== 0) throw new Error(`Quedan candidatos pendientes: ${remaining.rows[0].count}`);

      const byCompany = await client.query<{ empresa_id: number; pendientes: string }>(
        `SELECT empresas.empresa_id, COUNT(dp.id)::text AS pendientes
         FROM (SELECT DISTINCT empresa_id FROM documentos WHERE id = ANY($1::int[])) AS empresas
         LEFT JOIN documentos d ON d.empresa_id = empresas.empresa_id
           AND d.id = ANY($1::int[])
           AND LOWER(COALESCE(d.estatus_documento, '')) NOT LIKE 'cancel%'
         LEFT JOIN documentos_partidas dp ON dp.documento_id = d.id
           AND dp.subtotal_partida > 0
           AND COALESCE(dp.total_partida, 0) = 0
         GROUP BY empresas.empresa_id
         ORDER BY empresas.empresa_id`,
        [documentIds]
      );
      console.table(byCompany.rows);
      if (byCompany.rows.some((row) => Number(row.pendientes) !== 0)) {
        throw new Error('La validación posterior por empresa no quedó en cero.');
      }

      const byOrigin = await client.query<{ tipo_origen: string; pendientes: string }>(
        `SELECT COALESCE(origen.tipo_documento, 'sin_origen') AS tipo_origen, COUNT(*)::text AS pendientes
         FROM documentos_partidas dp
         JOIN documentos d ON d.id = dp.documento_id
         LEFT JOIN documentos origen ON origen.id = d.documento_origen_id
         WHERE dp.subtotal_partida > 0 AND COALESCE(dp.total_partida, 0) = 0
           AND d.id = ANY($1::int[])
           AND LOWER(COALESCE(d.estatus_documento, '')) NOT LIKE 'cancel%'
         GROUP BY COALESCE(origen.tipo_documento, 'sin_origen')`,
        [documentIds]
      );
      console.table(byOrigin.rows);
      if (byOrigin.rows.length !== 0) throw new Error('La validación posterior por origen no quedó en cero.');

      const after = await client.query<DocumentCheck>(documentCheckQuery(documentIds), [documentIds]);
      const afterInvalid = after.rows.filter((row) => Number(row.max_diff) > TOLERANCIA);
      if (after.rowCount !== documentIds.length || afterInvalid.length > 0) {
        throw new Error(`Validación posterior fallida: documentos=${after.rowCount}, inválidos=${afterInvalid.length}`);
      }

      await client.query('COMMIT');
      console.log(`[historical-repair] COMMIT realizado: ${updated.rowCount} partidas.`);
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* conserva el error original */ }
      throw error;
    } finally {
      await client.end();
    }
  });
}

main().catch((error) => {
  console.error(`[historical-repair] ABORTADO: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
