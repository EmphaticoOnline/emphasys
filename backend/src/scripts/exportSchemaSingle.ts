import { spawn } from "child_process";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import dotenv from "dotenv";

// This script exports the full database schema into a single SQL file.
// It keeps the per-table exporter intact; see package.json scripts for both options.

type ConnectionInfo = {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl: boolean;
};

const projectRoot = path.resolve(__dirname, "..", "..");
// Try root .env first, then backend/.env as a fallback. Missing files are ignored.
dotenv.config({ path: path.join(projectRoot, ".env") });
dotenv.config({ path: path.join(projectRoot, "backend", ".env") });

const OUTPUT_ROOT = path.join(projectRoot, "database", "schema");
const OUTPUT_FILE = path.join(OUTPUT_ROOT, "full-schema.sql");
const EXCLUDED_SCHEMAS = new Set(["pg_catalog", "information_schema"]);

function resolveConnection(): ConnectionInfo {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 5432,
      user: decodeURIComponent(url.username),
      password: url.password ? decodeURIComponent(url.password) : undefined,
      database: url.pathname.replace(/^\//, ""),
      ssl: url.searchParams.get("ssl") === "true" || process.env.PGSSLMODE === "require",
    };
  }

  const { PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE, PGSSLMODE } = process.env;
  if (!PGHOST || !PGUSER || !PGDATABASE) {
    throw new Error("Missing PGHOST, PGUSER, PGDATABASE or DATABASE_URL");
  }

  return {
    host: PGHOST,
    port: PGPORT ? Number(PGPORT) : 5432,
    user: PGUSER,
    password: PGPASSWORD,
    database: PGDATABASE,
    ssl: PGSSLMODE === "require",
  };
}

function runPgDump(conn: ConnectionInfo): Promise<string> {
  const args = [
    "--schema-only",
    "--no-owner",
    "--no-privileges",
    "--no-tablespaces",
    ...Array.from(EXCLUDED_SCHEMAS).flatMap((schema) => ["--exclude-schema", schema]),
    "--host",
    conn.host,
    "--port",
    String(conn.port),
    "--username",
    conn.user,
    conn.database,
  ];

  const env = { ...process.env } as NodeJS.ProcessEnv;
  if (conn.password) {
    env.PGPASSWORD = conn.password;
  }

  return new Promise((resolve, reject) => {
    const child = spawn("pg_dump", args, { env });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`pg_dump failed (exit ${code}): ${stderr || stdout}`));
      }
    });
  });
}

async function ensureDir(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
}

async function main() {
  const conn = resolveConnection();
  await ensureDir(OUTPUT_ROOT);

  const dump = await runPgDump(conn);
  const header = [
    `-- Full schema export`,
    `-- Database: ${conn.database}`,
    `-- Generated at: ${new Date().toISOString()}`,
    "",
  ].join("\n");

  await writeFile(OUTPUT_FILE, header + dump, { encoding: "utf-8" });
  console.log(`Schema export finished. Output file: ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
