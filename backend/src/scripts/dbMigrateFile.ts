import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { resolvePostgresConnection, withPostgresTunnel } from './lib/postgresSshTunnel';

const projectRoot = path.resolve(__dirname, '../../..');
const migrationsRoot = path.resolve(projectRoot, 'database/migrations');

async function resolveMigration(input: string) {
  if (!input) throw new Error('Uso: npm run db:migrate:file -- database/migrations/<archivo>.sql');
  const candidate = path.resolve(projectRoot, input);
  const relative = path.relative(migrationsRoot, candidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Sólo se permiten archivos dentro de database/migrations/');
  if (path.extname(candidate).toLowerCase() !== '.sql') throw new Error('La migración debe ser un archivo .sql');
  const stat = await fs.stat(candidate).catch(() => null);
  if (!stat) throw new Error('El archivo de migración no existe');
  if (!stat.isFile()) throw new Error('La migración debe ser un archivo regular');
  const realCandidate = await fs.realpath(candidate);
  const realRoot = await fs.realpath(migrationsRoot);
  const realRelative = path.relative(realRoot, realCandidate);
  if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative)) throw new Error('La migración debe resolverse dentro de database/migrations/');
  return realCandidate;
}

function hasExplicitTransaction(sql: string) {
  return /\b(?:BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK)\b/i.test(sql);
}

function hasNonTransactionalStatements(sql: string) {
  return /\b(?:CREATE|DROP|REINDEX)\s+INDEX\s+CONCURRENTLY\b/i.test(sql);
}

async function main() {
  const file = await resolveMigration(process.argv[2]);
  const sql = await fs.readFile(file, 'utf8');
  if (!sql.trim()) throw new Error('La migración está vacía');
  const conn = resolvePostgresConnection();
  console.log(`Migración de escritura: ${path.relative(projectRoot, file)}`);
  console.log(`Base destino: ${conn.database}`);
  console.log(`Host lógico: ${conn.host}`);
  console.log('ADVERTENCIA: esta operación modifica la base de datos.');
  const explicit = hasExplicitTransaction(sql);
  const nonTransactional = hasNonTransactionalStatements(sql);
  if (explicit) console.log('Transacción: la migración administra su propia transacción; no se envolverá externamente.');
  else if (nonTransactional) console.log('Transacción: contiene sentencias no transaccionales; se ejecutará sin envoltura externa.');
  else console.log('Transacción: se ejecutará dentro de BEGIN/COMMIT, con ROLLBACK ante errores.');

  await withPostgresTunnel(async ({ host, port }) => {
    const client = new Client({ host, port, user: conn.user, password: conn.password, database: conn.database, ssl: conn.ssl });
    await client.connect();
    let outerTransaction = false;
    try {
      if (!explicit && !nonTransactional) { await client.query('BEGIN'); outerTransaction = true; }
      await client.query(sql);
      if (outerTransaction) await client.query('COMMIT');
      console.log('Migración ejecutada correctamente.');
    } catch (error) {
      if (outerTransaction) { try { await client.query('ROLLBACK'); } catch {} }
      throw error;
    } finally { await client.end(); }
  });
}

main().catch((error) => { console.error(`db:migrate:file: ${error.message || error}`); process.exitCode = 1; });
