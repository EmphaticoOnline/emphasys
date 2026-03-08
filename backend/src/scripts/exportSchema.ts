import { spawn } from "child_process";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { Client } from "pg";

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

async function fetchSchemas(client: Client): Promise<string[]> {
  const res = await client.query<{ schema_name: string }>(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ($1, $2) ORDER BY schema_name`,
    ["pg_catalog", "information_schema"]
  );
  return res.rows.map((row) => row.schema_name);
}

async function fetchTables(client: Client, schema: string): Promise<string[]> {
  const res = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name`,
    [schema]
  );
  return res.rows.map((row) => row.table_name);
}

function runPgDump(conn: ConnectionInfo, schema: string, table: string): Promise<string> {
  const args = [
    "--schema-only",
    "--no-owner",
    "--no-privileges",
    "--no-tablespaces",
    "--table",
    `${schema}.${table}`,
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
        reject(new Error(`pg_dump failed for ${schema}.${table} (exit ${code}): ${stderr || stdout}`));
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

  const client = new Client({
    host: conn.host,
    port: conn.port,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    ssl: conn.ssl ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();

  try {
    const schemas = (await fetchSchemas(client)).filter((schema) => !EXCLUDED_SCHEMAS.has(schema));
    if (schemas.length === 0) {
      console.warn("No schemas found (excluding system schemas). Nothing to do.");
      return;
    }

    for (const schema of schemas) {
      const tables = await fetchTables(client, schema);
      const schemaDir = path.join(OUTPUT_ROOT, schema);
      await ensureDir(schemaDir);

      if (tables.length === 0) {
        continue;
      }

      for (const table of tables) {
        const dump = await runPgDump(conn, schema, table);
        const header = `-- Schema: ${schema}\n-- Table: ${table}\n-- Generated automatically\n\n`;
        const filePath = path.join(schemaDir, `${table}.sql`);
        await writeFile(filePath, header + dump, { encoding: "utf-8" });
        console.log(`Saved ${schema}.${table} -> ${filePath}`);
      }
    }
  } finally {
    await client.end();
  }

  console.log(`Schema export finished. Output directory: ${OUTPUT_ROOT}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
