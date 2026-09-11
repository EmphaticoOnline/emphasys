import { spawn } from "child_process";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { PostgresConnection, resolvePostgresConnection, withPostgresTunnel } from "./lib/postgresSshTunnel";
const projectRoot = path.resolve(__dirname, "..", "..");
const outputRoot = path.join(projectRoot, "database", "schema");
const outputFile = path.join(outputRoot, "full-schema.sql");
function runPgDump(conn: PostgresConnection): Promise<string> { const args = ["--schema-only", "--no-owner", "--no-privileges", "--no-tablespaces", "--exclude-schema", "pg_catalog", "--exclude-schema", "information_schema", "--host", conn.host, "--port", String(conn.port), "--username", conn.user, conn.database]; const env = { ...process.env } as NodeJS.ProcessEnv; if (conn.password) env.PGPASSWORD = conn.password; return new Promise((resolve, reject) => { const child = spawn("pg_dump", args, { env }); let out = ""; let err = ""; child.stdout.on("data", (x) => { out += x.toString(); }); child.stderr.on("data", (x) => { err += x.toString(); }); child.on("error", reject); child.on("close", (code) => code === 0 ? resolve(out) : reject(new Error(`pg_dump failed (exit ${code}): ${err || out}`))); }); }
async function main() { const conn = resolvePostgresConnection(); await mkdir(outputRoot, { recursive: true }); await withPostgresTunnel(async ({ host, port }) => { const dump = await runPgDump({ ...conn, host, port, ssl: false }); const header = [`-- Full schema export`, `-- Database: ${conn.database}`, `-- Generated at: ${new Date().toISOString()}`, ""].join("\n"); await writeFile(outputFile, header + dump, "utf8"); console.log(`Schema export finished. Output file: ${outputFile}`); }); }
main().catch((err) => { console.error(err.message || err); process.exitCode = 1; });
