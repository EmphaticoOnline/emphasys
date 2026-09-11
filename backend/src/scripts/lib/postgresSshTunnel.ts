import { ChildProcess, spawn } from "child_process";
import dotenv from "dotenv";
import net from "net";
import path from "path";

export type PostgresConnection = {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl: boolean;
};

export type TunnelConnection = { host: "127.0.0.1"; port: number };

const projectRoot = path.resolve(__dirname, "..", "..", "..");
dotenv.config({ path: path.join(projectRoot, ".env") });
dotenv.config({ path: path.join(projectRoot, "backend", ".env") });

const DEFAULT_SSH_HOST = "148.113.192.7";

export function resolvePostgresConnection(): PostgresConnection {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    return { host: url.hostname, port: url.port ? Number(url.port) : 5432,
      user: decodeURIComponent(url.username), password: url.password ? decodeURIComponent(url.password) : undefined,
      database: url.pathname.replace(/^\//, ""),
      ssl: url.searchParams.get("ssl") === "true" || process.env.PGSSLMODE === "require" };
  }
  const { PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE, PGSSLMODE } = process.env;
  if (!PGHOST || !PGUSER || !PGDATABASE) throw new Error("Missing PGHOST, PGUSER, PGDATABASE or DATABASE_URL");
  return { host: PGHOST, port: PGPORT ? Number(PGPORT) : 5432, user: PGUSER,
    password: PGPASSWORD, database: PGDATABASE, ssl: PGSSLMODE === "require" };
}

function reserveLocalPort(): Promise<{ server: net.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      const address = server.address();
      if (!address || typeof address === "string") { server.close(); reject(new Error("Could not determine a local port for the SSH tunnel")); return; }
      resolve({ server, port: address.port });
    });
  });
}

function waitForTunnel(child: ChildProcess, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false; let timer: NodeJS.Timeout;
    const finish = (error?: Error) => { if (done) return; done = true; clearTimeout(timer); error ? reject(error) : resolve(); };
    const attempt = () => { if (done) return; const socket = net.createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => { socket.destroy(); finish(); });
      socket.once("error", () => { socket.destroy(); if (!done) setTimeout(attempt, 100); }); };
    child.once("error", finish);
    child.once("exit", (code, signal) => finish(new Error(`SSH tunnel exited before becoming ready (code ${code}, signal ${signal ?? "none"})`)));
    timer = setTimeout(() => finish(new Error("Timed out waiting for the SSH tunnel")), 15_000); attempt();
  });
}

export async function withPostgresTunnel<T>(fn: (connection: TunnelConnection) => Promise<T>): Promise<T> {
  const databaseHost = process.env.PGHOST || process.env.DB_HOST;
  const sshHost = process.env.PG_SSH_HOST || (databaseHost === DEFAULT_SSH_HOST ? DEFAULT_SSH_HOST : undefined);
  const sshConfigured = sshHost || process.env.PG_SSH_USER || process.env.PG_SSH_KEY || process.env.PG_SSH_PORT;
  if (!sshConfigured) return fn({ host: "127.0.0.1", port: Number(process.env.PGPORT || 5432) });
  if (!sshHost) throw new Error("PG_SSH_HOST is required when SSH tunnel settings are configured");
  const reservation = await reserveLocalPort();
  await new Promise<void>((resolve, reject) => reservation.server.close((error) => error ? reject(error) : resolve()));
  const child = spawn("ssh", ["-N", "-T", "-o", "BatchMode=yes", "-o", "ExitOnForwardFailure=yes", "-o", "ConnectTimeout=10", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=2", "-L", `${reservation.port}:127.0.0.1:5432`, "-i", process.env.PG_SSH_KEY || path.join(process.env.HOME || "", ".ssh", "id_rsa"), "-p", process.env.PG_SSH_PORT || "22", `${process.env.PG_SSH_USER || "ubuntu"}@${sshHost}`], { stdio: ["ignore", "ignore", "pipe"] });
  try { await waitForTunnel(child, reservation.port); return await fn({ host: "127.0.0.1", port: reservation.port }); }
  finally { if (child.exitCode === null && child.signalCode === null) { child.kill("SIGTERM"); await new Promise<void>((resolve) => child.once("close", () => resolve())); } }
}
