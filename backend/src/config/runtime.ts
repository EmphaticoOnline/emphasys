import dotenv from "dotenv";
import fs from "fs";
import path from "path";

export type AppEnv = "development" | "production";
export type DbTarget = "local" | "server" | "production";

const appEnv = (process.env.APP_ENV ?? "development") as AppEnv;
const dbTarget = (process.env.DB_TARGET ?? (appEnv === "production" ? "production" : "local")) as DbTarget;

if (!["development", "production"].includes(appEnv)) {
  throw new Error(`APP_ENV inválido: ${appEnv}`);
}
if (!["local", "server", "production"].includes(dbTarget)) {
  throw new Error(`DB_TARGET inválido: ${dbTarget}`);
}
if (appEnv === "development" && dbTarget === "production") {
  throw new Error("Configuración bloqueada: desarrollo no puede usar la BD de producción.");
}
if (appEnv === "production" && dbTarget !== "production") {
  throw new Error("Configuración bloqueada: producción debe usar DB_TARGET=production.");
}

const projectRoot = path.resolve(__dirname, "../..");
// En desarrollo se reutilizan las credenciales/servicios del .env local, pero
// el host y puerto de PostgreSQL siempre los fija el selector de destino.
const envPath = path.join(projectRoot, ".env");

if (envPath && fs.existsSync(envPath)) dotenv.config({ path: envPath });

const defaultDb = dbTarget === "local"
  ? { host: "127.0.0.1", port: 5432 }
  : { host: "127.0.0.1", port: dbTarget === "server" ? 15432 : 5432 };
const databaseName = dbTarget === "local"
  ? "dev_emphasys"
  : (process.env.DB_NAME || "emphasys");

export const runtimeConfig = {
  appEnv,
  dbTarget,
  db: {
    // El destino lo determina el perfil, no un DB_HOST/DB_PORT residual.
    host: defaultDb.host,
    port: defaultDb.port,
    name: databaseName,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD,
  },
};

if (!Number.isInteger(runtimeConfig.db.port) || runtimeConfig.db.port < 1) {
  throw new Error("DB_PORT inválido.");
}

if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  const urlPort = Number(url.port || 5432);
  if (url.hostname !== runtimeConfig.db.host || urlPort !== runtimeConfig.db.port || url.pathname.slice(1) !== runtimeConfig.db.name) {
    throw new Error("DATABASE_URL no coincide con el perfil DB_TARGET seleccionado.");
  }
  delete process.env.DATABASE_URL;
}

// Mantener una sola conexión canónica para el backend y los scripts PG.
process.env.DB_HOST = runtimeConfig.db.host;
process.env.DB_PORT = String(runtimeConfig.db.port);
process.env.DB_NAME = runtimeConfig.db.name;
process.env.DB_USER = runtimeConfig.db.user;
if (runtimeConfig.db.password !== undefined) process.env.DB_PASSWORD = runtimeConfig.db.password;
process.env.PGHOST = runtimeConfig.db.host;
process.env.PGPORT = String(runtimeConfig.db.port);
process.env.PGDATABASE = runtimeConfig.db.name;
process.env.PGUSER = runtimeConfig.db.user;
if (runtimeConfig.db.password !== undefined) process.env.PGPASSWORD = runtimeConfig.db.password;

export function logRuntimeConfig(): void {
  console.log(`[config] APP_ENV=${runtimeConfig.appEnv}`);
  console.log(`[config] DB_TARGET=${runtimeConfig.dbTarget}`);
  console.log(`[config] PostgreSQL=${runtimeConfig.db.host}:${runtimeConfig.db.port}/${runtimeConfig.db.name}`);
}
