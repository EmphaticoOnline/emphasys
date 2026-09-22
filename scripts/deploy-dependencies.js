const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

const INSTALL_OPTIONS = new Set(['omit', 'include', 'production', 'optional', 'ignore_scripts',
  'legacy_peer_deps', 'strict_peer_deps', 'install_links', 'install_strategy', 'bin_links',
  'cpu', 'os', 'libc', 'arch', 'platform', 'registry', 'workspaces', 'workspace']);

function fingerprint(directory, env, legacy = false) {
  const hash = createHash('sha256');
  // npm injects operational values (logs, metrics, argv, etc.) on each invocation.
  // Only dependency-shaping options belong in the reusable installation receipt.
  const options = Object.entries(env).filter(([key]) => /^npm_config_/i.test(key));
  const stable = options.map(([key, value]) => [key.toLowerCase().slice(11), value])
    .filter(([key]) => INSTALL_OPTIONS.has(key)).sort();
  hash.update(JSON.stringify([legacy ? 1 : 2, process.version, process.platform, process.arch,
    env.NODE_ENV || '', legacy ? options.sort() : stable]));
  for (const name of ['package.json', 'package-lock.json', '.npmrc']) {
    hash.update(`\0${name}\0`);
    try { hash.update(fs.readFileSync(path.join(directory, name))); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      hash.update('<missing>');
    }
  }
  return hash.digest('hex');
}

async function ensureDependencies({ root, directory, env, install, measure = async (_, action) => action() }) {
  if (env.SKIP_LOCAL_INSTALL === 'true') {
    console.log(`==> Dependencias ${directory}: omitidas por SKIP_LOCAL_INSTALL=true`);
    return 'skipped';
  }
  const project = path.join(root, directory);
  const cache = path.join(root, '.cache', 'deploy-erp', `${directory}.sha256`);
  let reason = 'sin instalación conocida';
  const valid = await measure(`Validación ${directory}`, async () => {
    const expected = fingerprint(project, env);
    try {
      if (!fs.statSync(path.join(project, 'node_modules')).isDirectory()) return false;
      const recorded = fs.readFileSync(cache, 'utf8').trim();
      if (recorded === expected) return true;
      // A matching legacy receipt already proves a successful installation.
      if (recorded === fingerprint(project, env, true)) {
        fs.writeFileSync(cache, `${expected}\n`);
        return true;
      }
      reason = 'cambiaron manifests, runtime u opciones de instalación (o formato de caché)';
      return false;
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
      return false;
    }
  });
  if (valid) {
    console.log(`==> Dependencias ${directory}: hash vigente; no se necesita npm install`);
    return 'cached';
  }
  console.log(`==> Dependencias ${directory}: npm install necesario; ${reason}`);
  // Remove the old receipt before npm can partially change node_modules.
  fs.rmSync(cache, { force: true });
  await measure(`Instalación ${directory}`, install);
  // npm install can update package-lock.json: record its successful final state.
  if (!fs.statSync(path.join(project, 'node_modules')).isDirectory()) {
    throw new Error(`La instalación de ${directory} no creó node_modules.`);
  }
  const value = fingerprint(project, env);
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  const temporary = `${cache}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, `${value}\n`);
    fs.renameSync(temporary, cache);
  } finally { fs.rmSync(temporary, { force: true }); }
  return 'installed';
}

module.exports = { ensureDependencies, fingerprint };
