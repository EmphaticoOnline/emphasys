const { run: runCommand } = require('./deploy-command');
const { ensureDependencies } = require('./deploy-dependencies');
const { createTimings } = require('./deploy-timings');
const { createReleasePackage } = require('./deploy-package');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REMOTE_PATH = '/var/www/emphasys-backend';
const SSH_OPTIONS = ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new',
  '-o', 'ConnectTimeout=20', '-o', 'ConnectionAttempts=1',
  '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3'];
const quote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;
const log = (message) => console.log(`==> ${message}`);

function findTool(name, env) {
  const directories = (env.PATH || '').split(path.delimiter)
    .filter(Boolean).map((entry) => entry.replace(/^"|"$/g, ''));
  if (process.platform === 'win32') {
    const gitRoots = [
      path.join(env.ProgramFiles || 'C:\\Program Files', 'Git'),
      path.join(env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Git'),
    ];
    if (env.LOCALAPPDATA) gitRoots.push(path.join(env.LOCALAPPDATA, 'Programs', 'Git'));
    for (const directory of directories) {
      if (fs.existsSync(path.join(directory, 'git.exe'))) {
        gitRoots.push(path.resolve(directory, '..'));
      }
    }
    const system32 = path.join(env.SystemRoot || 'C:\\Windows', 'System32');
    directories.push(system32, path.join(system32, 'OpenSSH'));
    for (const root of gitRoots) directories.push(path.join(root, 'usr', 'bin'));
  }
  for (const directory of directories) {
    const candidate = path.resolve(directory, name + (process.platform === 'win32' ? '.exe' : ''));
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // Continue looking in the remaining standard locations.
    }
  }
  throw new Error(`Falta la herramienta requerida ${name}. Debe estar en PATH o en Windows/Git for Windows. No se inició el deploy.`);
}

function run(command, args, options = {}) {
  return runCommand(command, args, { cwd: ROOT, ...options });
}

async function main() {
  const timings = createTimings();
  try { await deploy(timings); } finally { timings.summary(); }
}

async function deploy(timings) {
  const env = { ...process.env, FRONTEND_TARGET: 'erp' };
  const server = env.SSH_SERVER || 'ubuntu@148.113.192.7';
  const buildId = env.BUILD_ID || new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  // BUILD_ID must remain a single child of releases.
  if (buildId === '.' || buildId === '..' || /[\\/\x00-\x1f\x7f]/.test(buildId)) {
    throw new Error('BUILD_ID debe ser un nombre de release, sin separadores de ruta ni caracteres de control.');
  }
  if (server.startsWith('-') || /[\s\x00-\x1f]/.test(server)) throw new Error('SSH_SERVER debe ser un destino SSH válido (usuario@servidor).');
  const tools = Object.fromEntries(['ssh', 'scp', 'tar'].map((name) => [name, findTool(name, env)]));
  const npmCli = [env.npm_execpath, path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')]
    .find((candidate) => candidate && fs.existsSync(candidate));
  if (!npmCli) throw new Error('No se encontró npm. Ejecuta este script mediante npm run deploy:erp con Node.js y npm instalados.');
  const ssh = (command, stage, capture = false, timeoutMs = 120000) => run(tools.ssh, ['-n', '-T', ...SSH_OPTIONS, server, command], {
    env, stage, capture, timeoutMs,
  });
  const npm = (directory, args) => run(process.execPath, [npmCli, ...args], {
    cwd: path.join(ROOT, directory), env, stage: `npm ${args.join(' ')} (${directory})`, timeoutMs: 1200000,
  });
  const dependencies = (directory) => timings.measure(`Dependencias ${directory}`, () => ensureDependencies({
    root: ROOT, directory, env, install: () => npm(directory, ['install']), measure: timings.measure,
  }));
  const cleanBuild = (relative) => {
    const target = path.resolve(ROOT, relative);
    if (!target.startsWith(ROOT + path.sep)) throw new Error('Directorio de build fuera del repositorio.');
    fs.rmSync(target, { recursive: true, force: true });
  };

  // Fail before builds or remote mutations if a required tool is unavailable.
  await run(tools.tar, ['--version'], { env, stage: 'Verificar tar' });
  await run(tools.ssh, ['-V'], { env, stage: 'Verificar ssh' });
  await npm('.', ['--version']);
  if (env.SKIP_FRONTEND !== 'true') {
    log('Building frontend target: erp...');
    await dependencies('frontend');
    // Vite empties only its configured outDir; no cached build artifacts are reused.
    await timings.measure('Build frontend', () => npm('frontend', ['run', 'build:erp', '--', '--emptyOutDir']));
  } else log('Skipping frontend build (SKIP_FRONTEND=true)...');

  log('Building backend...');
  cleanBuild('backend/dist');
  await dependencies('backend');
  await timings.measure('Build backend', () => npm('backend', ['run', 'build']));
  fs.writeFileSync(path.join(ROOT, 'backend/dist/.build-id'), `${buildId}\n`);

  const localTemp = fs.mkdtempSync(path.join(ROOT, '.deploy-erp-'));
  const remoteTemp = `/tmp/emphasys-erp-${randomUUID()}`;
  const remoteArchive = `${remoteTemp}.tar.gz`;
  const cleanup = `timeout --kill-after=5s 30s rm -rf -- ${quote(remoteTemp)} ${quote(remoteArchive)}`;
  let failure;
  timings.start('Transferencia');
  try {
    const archive = await createReleasePackage({ root: ROOT, temporary: localTemp, tar: tools.tar, env, run });
    await run(tools.scp, ['-S', tools.ssh, ...SSH_OPTIONS,
      `./${path.relative(ROOT, archive).split(path.sep).join('/')}`, `${server}:${remoteArchive}`],
    { env, stage: 'Subir paquete único', timeoutMs: 600000 });
    const required = ['timeout', 'bash', 'mkdir', 'tar', 'gzip', 'cp', 'rm', 'cat', 'ln', 'readlink', 'mv', 'find', 'sort', 'sha256sum'];
    if (env.SKIP_REMOTE_INSTALL !== 'true') required.push('npm');
    if (env.PREPARE_ONLY !== 'true') required.push('pm2', 'curl');
    const prepare = `set -e
for tool in ${required.join(' ')}; do command -v "$tool" >/dev/null 2>&1 || { echo "Falta herramienta remota: $tool" >&2; exit 1; }; done
trap ${quote(cleanup)} EXIT
deploy_umask=$(umask)
umask 077
mkdir ${quote(remoteTemp)}
umask "$deploy_umask"
echo '==> REMOTO INICIO: extraer paquete único'
tar -xzpf ${quote(remoteArchive)} -C ${quote(remoteTemp)}
echo '==> REMOTO FIN: extraer paquete único'
bash ${quote(`${remoteTemp}/deploy-erp-prepare.sh`)} ${[REMOTE_PATH, buildId, env.FRONTEND_TARGET].map(quote).join(' ')}
rm -f -- ${quote(remoteArchive)}
trap - EXIT`;
    await ssh(`timeout --kill-after=10s 900s bash -c ${quote(prepare)}`, 'Preparar release completo', false, 930000);
    timings.stop('Transferencia');
    // The script is a complete file, never mixed with npm/PM2 stdin.
    const activate = `set -e
trap ${quote(cleanup)} EXIT
bash ${quote(`${remoteTemp}/deploy-erp-remote.sh`)} ${[REMOTE_PATH, buildId, env.SKIP_REMOTE_INSTALL || 'false', env.PREPARE_ONLY || 'false'].map(quote).join(' ')}`;
    await timings.measure('Activación remota', () => ssh(
      `timeout --kill-after=10s 1800s bash -c ${quote(activate)}`, 'Instalar y activar release', false, 1830000));
  } catch (error) {
    failure = error;
    // Exceptional recovery only; successful deployments use exactly two SSH sessions.
    try { await ssh(cleanup, 'Limpiar temporal tras fallo', false, 45000); } catch (cleanupError) {
      console.error(`No se pudo limpiar el temporal remoto: ${cleanupError.message}`);
    }
  } finally {
    timings.stop('Transferencia');
    if (path.dirname(localTemp) !== ROOT) throw new Error('Temporal fuera del repositorio.');
    fs.rmSync(localTemp, { recursive: true, force: true });
  }
  if (failure) throw failure;
  log('Deploy ERP finalizado correctamente.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Deploy ERP falló: ${error.message}`);
    process.exitCode = error.exitCode || 1;
  });
}

module.exports = { main, findTool, quote };
