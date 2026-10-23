import { Client } from "pg";
import { resolvePostgresConnection, withPostgresTunnel, PostgresConnection } from "./lib/postgresSshTunnel";

export const ALLOWED_QUERY_DATABASES = new Set(["emphasys", "paz_financiera"]);

function hasMultipleStatements(sql: string) { let quote = ""; for (let i = 0; i < sql.length; i += 1) { const c = sql[i]; if (quote) { if (c === quote && sql[i - 1] !== "\\") quote = ""; } else if (c === "'" || c === '"') quote = c; else if (c === ";" && sql.slice(i + 1).trim()) return true; } return false; }
function withoutLeadingComments(sql: string) { return sql.replace(/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/g, "").trim(); }
export function validateReadQuery(sql: string) {
  if (!sql) throw new Error('Uso: npm run db:query -- "SELECT ..."');
  if (hasMultipleStatements(sql)) throw new Error("db:query sólo permite una sentencia SQL de lectura");
  const keyword = withoutLeadingComments(sql).match(/^([A-Za-z]+)/)?.[1].toUpperCase();
  if (keyword !== "SELECT" && keyword !== "WITH") throw new Error("db:query sólo permite consultas SELECT o WITH de lectura");
}
function databaseFromUrl(value: string) { try { return decodeURIComponent(new URL(value).pathname.replace(/^\//, "")); } catch { throw new Error("DATABASE_URL no es válida"); } }
function resolvePostgresConnectionFromEnv(env: NodeJS.ProcessEnv): PostgresConnection {
  if (env.DATABASE_URL) { const url = new URL(env.DATABASE_URL); return { host: url.hostname, port: url.port ? Number(url.port) : 5432, user: decodeURIComponent(url.username), password: url.password ? decodeURIComponent(url.password) : undefined, database: databaseFromUrl(env.DATABASE_URL), ssl: url.searchParams.get("ssl") === "true" || env.PGSSLMODE === "require" }; }
  if (!env.PGHOST || !env.PGUSER || !env.PGDATABASE) throw new Error("Missing PGHOST, PGUSER, PGDATABASE or DATABASE_URL");
  return { host: env.PGHOST, port: env.PGPORT ? Number(env.PGPORT) : 5432, user: env.PGUSER, password: env.PGPASSWORD, database: env.PGDATABASE, ssl: env.PGSSLMODE === "require" };
}
export function resolveQueryConnection(env: NodeJS.ProcessEnv = process.env): PostgresConnection {
  const requested = env.DB_QUERY_DATABASE?.trim();
  if (requested && !ALLOWED_QUERY_DATABASES.has(requested)) throw new Error("DB_QUERY_DATABASE sólo puede ser emphasys o paz_financiera");
  const base = resolvePostgresConnectionFromEnv(env);
  if (!requested) return base;
  if (env.DATABASE_URL && base.database !== requested) throw new Error("DB_QUERY_DATABASE entra en conflicto con la base indicada por DATABASE_URL");
  return { ...base, database: requested };
}
async function main() { const sql = process.argv.slice(2).join(" ").trim(); validateReadQuery(sql); const conn = resolveQueryConnection(); await withPostgresTunnel(async ({ host, port }) => { const client = new Client({ host, port, user: conn.user, password: conn.password, database: conn.database, ssl: conn.ssl }); await client.connect(); try { await client.query("BEGIN"); await client.query("SET TRANSACTION READ ONLY"); const result = await client.query(sql); console.table(result.rows); await client.query("COMMIT"); } catch (error) { try { await client.query("ROLLBACK"); } catch {} throw error; } finally { await client.end(); } }); }
if (require.main === module) main().catch((error) => { console.error(`db:query: ${error.message || error}`); process.exitCode = 1; });
