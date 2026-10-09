import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { withPostgresTunnel } from './lib/postgresSshTunnel';

/** Ejecuta el seed de empresa 8 sobre el mismo túnel SSH usado por db:query. */
async function main(): Promise<void> {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const backendRoot = path.join(repoRoot, 'backend');
  const seedPath = path.join(backendRoot, 'scripts', 'seed-demo-empresa-8.ts');
  if (!fs.existsSync(seedPath)) throw new Error(`No existe el seed en la ruta calculada: ${seedPath}`);
  const args = process.argv.slice(2);
  if (args.some((arg) => arg === '--limpiar=true')) {
    throw new Error('La limpieza está deshabilitada; no se permite --limpiar=true.');
  }

  const exitCode = await withPostgresTunnel(({ host, port }) => new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, [require.resolve('ts-node/dist/bin'), seedPath, ...args], {
      cwd: backendRoot,
      env: { ...process.env, DB_HOST: host, DB_PORT: String(port), PGHOST: host, PGPORT: String(port) },
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (signal) reject(new Error(`El seed terminó por señal ${signal}`));
      else resolve(code ?? 1);
    });
  }));

  if (exitCode !== 0) process.exitCode = exitCode;
}

main().catch((error) => {
  console.error(`seed-demo-empresa-8: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
