import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { QueryResultRow } from 'pg';
import {
  resolveHistoricalPacConfig,
  resolvePacConfigForEmpresa,
  type PacConfigDb,
  type PacConfigResolved,
} from '../modules/cfdi/cfdi-pac-config.resolver';

const sandbox: PacConfigResolved = {
  id: 1, pac: 'facturama', modo: 'sandbox', base_url: 'https://sandbox.invalid',
  username: 'sandbox-user', password: 'hidden', stamp_path: '/stamp',
};
const production: PacConfigResolved = {
  id: 2, pac: 'facturama', modo: 'produccion', base_url: 'https://production.invalid',
  username: 'production-user', password: 'hidden', stamp_path: '/stamp',
};

function assignmentDb(assignments: Map<number, PacConfigResolved>): PacConfigDb {
  return {
    async query<T extends QueryResultRow = any>(_sql: string, params?: unknown[]) {
      const row = assignments.get(Number(params?.[0]));
      return { rows: (row ? [row] : []) as unknown as T[] };
    },
  };
}

async function main() {
  const db = assignmentDb(new Map([[8, sandbox], [3, production]]));

  assert.equal((await resolvePacConfigForEmpresa(8, db)).modo, 'sandbox');
  assert.equal((await resolvePacConfigForEmpresa(3, db)).modo, 'produccion');
  assert.equal((await resolvePacConfigForEmpresa(8, db)).id, 1);
  assert.equal((await resolvePacConfigForEmpresa(3, db)).id, 2);
  await assert.rejects(() => resolvePacConfigForEmpresa(77, db), /no tiene una configuración PAC activa asignada/);

  let historicalQuery = 0;
  const historicalDb: PacConfigDb = {
    async query<T extends QueryResultRow = any>(sql: string, params?: unknown[]) {
      historicalQuery += 1;
      if (sql.includes('cfg.id = $1')) return { rows: (Number(params?.[0]) === 2 ? [production] : []) as unknown as T[] };
      if (sql.includes('lower(cfg.pac)')) return { rows: [production] as unknown as T[] };
      return { rows: [] as T[] };
    },
  };
  assert.equal((await resolveHistoricalPacConfig({ empresaId: 3, configId: 2 }, historicalDb)).id, 2);
  assert.equal(historicalQuery, 1, 'El configId original debe tener prioridad.');
  assert.equal((await resolveHistoricalPacConfig({ empresaId: 3, pac: 'facturama', modalidad: 'lite' }, historicalDb)).id, 2);

  const root = path.resolve(__dirname, '..');
  const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
  const cfdi = read('modules/cfdi/cfdi.service.ts');
  const pago = read('modules/cfdi/cfdi-pago.service.ts');
  const csd = read('modules/cfdi/cfdi-csd.controller.ts');
  const cancel = read('modules/documentos/documentos-cancel.service.ts');
  const adminRepository = read('modules/configuracion/cfdi-pac-config/cfdi-pac-config.repository.ts');
  const adminRoutes = read('modules/configuracion/cfdi-pac-config/cfdi-pac-config.routes.ts');

  assert.match(cfdi, /FacturamaClient\.forEmpresa\(empresaId\)/);
  assert.match(cfdi, /cfdi_pac_config_id/);
  assert.match(pago, /FacturamaClient\.forEmpresa\(empresaId\)/);
  assert.match(pago, /facturama\.configId/);
  assert.match(csd, /empresa_id = \$1 AND cfdi_pac_config_id = \$2/);
  assert.match(cancel, /FacturamaClient\.forHistorical/);
  assert.match(adminRepository, /ON CONFLICT \(empresa_id\) DO UPDATE/);
  assert.match(adminRepository, /WHERE id=\$1 AND activo=true/);
  assert.match(adminRoutes, /cfdi-pac\/asignacion.*requireEmpresaActiva/);
  assert.doesNotMatch(read('modules/cfdi/facturama.client.ts'), /WHERE activo = TRUE\s+LIMIT 1/);

  console.log('OK: configuración PAC por empresa, persistencia, CSD, pagos e históricos.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
