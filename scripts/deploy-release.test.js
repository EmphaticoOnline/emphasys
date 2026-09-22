// All files stay inside a repository-local fixture. No SSH, SCP, npm or PM2 is executed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const { assetsManifest } = require('./deploy-assets');
const { spawnSync } = require('node:child_process');
const { createReleasePackage, CONTENTS } = require('./deploy-package');
const { findTool } = require('./deploy-erp');
const tar = findTool('tar', process.env);
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
const posix = (value) => value.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);

function fixture(t) {
  const parent = path.resolve(__dirname, '../.cache/deploy-erp');
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'release test-'));
  t.after(() => {
    if (path.dirname(path.resolve(root)) !== parent) throw new Error('Unsafe fixture cleanup');
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}
function write(root, name, value = 'content') {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}
function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, { encoding: 'utf8', timeout: 20000, ...options });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

async function packageFixture(t) {
  const root = fixture(t);
  write(root, 'backend/dist/server.js', 'fresh backend');
  write(root, 'backend/dist/.build-id', 'test-build\n');
  write(root, 'backend/assets/archivo con espacios.svg');
  write(root, 'backend/dist/modules/transporte/carta-porte-print.pdf.js', "module.exports = require.resolve('../../../assets/fonts/TREBUC.TTF');");
  write(root, 'backend/dist/modules/uploads/uploads.routes.js', 'module.exports = {};');
  for (const font of ['TREBUC.TTF', 'TREBUCBD.TTF', 'TREBUCIT.TTF', 'TREBUCBI.TTF']) {
    fs.mkdirSync(path.join(root, 'backend/assets/fonts'), { recursive: true });
    fs.copyFileSync(path.join(__dirname, '../backend/assets/fonts', font), path.join(root, 'backend/assets/fonts', font));
  }
  write(root, 'backend/package.json', '{}');
  write(root, 'backend/package-lock.json', '{}');
  write(root, 'frontend/dist/erp/index.html', 'fresh ERP');
  write(root, 'ecosystem.config.js', 'module.exports = {}');
  for (const excluded of ['.env', 'backend/.env', 'backend/dist/.env', 'backend/dist/uploads/secret',
    'backend/node_modules/secret', 'backend/assets/node_modules/secret', 'uploads/secret']) write(root, excluded, 'secret');
  const temporary = path.join(root, 'bundle');
  fs.mkdirSync(temporary);
  const archive = await createReleasePackage({ root, temporary, tar, env: process.env,
    run: async (executable, args, options) => command(executable, args, options) });
  const extracted = path.join(root, 'extracted');
  fs.mkdirSync(extracted);
  command(tar, ['-xzpf', archive, '-C', extracted]);
  return { root, archive, extracted };
}

test('single native tar round trip includes all artifacts, hidden build id and normalized scripts only', async (t) => {
  const { archive, extracted } = await packageFixture(t);
  const listing = command(tar, ['-tzf', archive]);
  for (const item of CONTENTS) assert.ok(listing.includes(item), item);
  assert.ok(listing.includes('backend/dist/.build-id'));
  assert.ok(!listing.includes('.env'));
  assert.ok(!listing.includes('node_modules'));
  // Solo se excluye la fuga de datos de runtime dentro de dist (backend/dist/uploads);
  // el módulo compilado backend/dist/modules/uploads debe conservarse (regresión: se perdía
  // por un --exclude=uploads sin anclar que también coincidía con este subdirectorio legítimo).
  assert.ok(!listing.includes('backend/dist/uploads/secret'));
  assert.ok(listing.includes('backend/dist/modules/uploads/uploads.routes.js'));
  assert.equal(fs.readFileSync(path.join(extracted, 'frontend/dist/erp/index.html'), 'utf8'), 'fresh ERP');
  for (const name of ['deploy-erp-prepare.sh', 'deploy-erp-remote.sh']) {
    assert.ok(fs.readFileSync(path.join(extracted, name), 'utf8').startsWith('#!/usr/bin/env bash\n'));
    command(bash, ['-n', posix(path.join(extracted, name))]);
  }
});

test('preparation places artifacts, preserves Compass/env/uploads, deletes stale files and keeps current inactive', async (t) => {
  const { root, extracted } = await packageFixture(t);
  const server = path.join(root, 'server');
  write(server, 'current/frontend-compass-dist/index.html', 'existing Compass');
  write(server, 'current/dist/server.js', 'active old backend');
  write(server, '.env', 'server secrets');
  write(server, 'uploads/file', 'server upload');
  write(server, 'releases/test-build/dist/stale.js', 'obsolete');
  // Git Bash may emulate symlinks on Windows: emulate only ln, preserving its target for assertions.
  const harness = path.join(root, 'prepare-test.sh');
  fs.writeFileSync(harness, `#!/usr/bin/env bash
ln() { local target="\${@: -2:1}" link="\${@: -1}"; printf '%s' "$target" > "$link"; }
export -f ln
timeout() { shift 2; "$@"; }
export -f timeout
bash "$1" "$2" test-build erp
`);
  command(bash, [posix(harness), posix(path.join(extracted, 'deploy-erp-prepare.sh')), posix(server)]);
  const release = path.join(server, 'releases/test-build');
  assert.equal(fs.readFileSync(path.join(release, 'dist/server.js'), 'utf8'), 'fresh backend');
  assert.equal(fs.existsSync(path.join(release, 'dist/stale.js')), false);
  assert.equal(fs.readFileSync(path.join(release, 'frontend-compass-dist/index.html'), 'utf8'), 'existing Compass');
  assert.equal(fs.readFileSync(path.join(server, 'current/dist/server.js'), 'utf8'), 'active old backend');
  assert.equal(fs.readFileSync(path.join(server, '.env'), 'utf8'), 'server secrets');
  assert.equal(fs.readFileSync(path.join(server, 'uploads/file'), 'utf8'), 'server upload');
  assert.equal(fs.readFileSync(path.join(release, '.deploy-prepared'), 'utf8'), 'test-build\n');
  assert.equal(fs.readFileSync(path.join(release, '.env'), 'utf8'), '../../.env');
  const resolved = createRequire(path.join(release, 'dist/modules/transporte/carta-porte-print.pdf.js'))
    .resolve('../../../assets/fonts/TREBUC.TTF');
  assert.equal(resolved, path.join(release, 'assets/fonts/TREBUC.TTF'));
  assert.deepEqual(fs.readFileSync(resolved), fs.readFileSync(path.join(__dirname, '../backend/assets/fonts/TREBUC.TTF')));
  assert.equal(fs.existsSync(path.join(release, 'assets/assets')), false);
  assert.equal(fs.existsSync(path.join(release, 'assets/backend')), false);
});

test('missing or wrongly cased critical font fails package validation before transfer', async (t) => {
  const { root } = await packageFixture(t);
  const font = path.join(root, 'backend/assets/fonts/TREBUC.TTF');
  fs.renameSync(font, path.join(root, 'backend/assets/fonts/wrong-name.TTF'));
  assert.throws(() => assetsManifest(root), /assets\/fonts\/TREBUC.TTF/);
});

test('a package missing TREBUC.TTF cannot be marked prepared', async (t) => {
  const { root, extracted } = await packageFixture(t);
  fs.unlinkSync(path.join(extracted, 'backend/assets/fonts/TREBUC.TTF'));
  const server = path.join(root, 'server');
  write(server, 'current/frontend-compass-dist/index.html', 'active Compass');
  const result = spawnSync(bash, [posix(path.join(extracted, 'deploy-erp-prepare.sh')), posix(server), 'test-build', 'erp'],
    { encoding: 'utf8', timeout: 20000 });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /assets\/fonts\/TREBUC.TTF/);
  assert.equal(fs.existsSync(path.join(server, 'releases/test-build/.deploy-prepared')), false);
  assert.equal(fs.readFileSync(path.join(server, 'current/frontend-compass-dist/index.html'), 'utf8'), 'active Compass');
});

for (const scenario of ['pm2-failure', 'health-failure', 'success', 'prepare-only', 'incomplete', 'missing-asset']) {
  test(`real Bash activation with simulated PM2/health: ${scenario}`, (t) => {
    const root = fixture(t);
    const server = path.join(root, 'server');
    const old = posix(path.join(server, 'releases/old'));
    const next = posix(path.join(server, 'releases/new'));
    write(server, 'releases/old/node_modules/marker');
    write(server, 'releases/new/dist/.build-id', 'new\n');
    write(server, 'releases/new/.deploy-assets.sha256', `${createHash('sha256').update('font bytes').digest('hex')}  assets/fonts/TREBUC.TTF\n`);
    if (scenario !== 'missing-asset') write(server, 'releases/new/assets/fonts/TREBUC.TTF', 'font bytes');
    if (scenario !== 'incomplete') write(server, 'releases/new/.deploy-prepared', 'new\n');
    write(server, 'current', old);
    write(server, 'ecosystem.config.js', '{}');
    if (scenario === 'success') {
      for (let i = 0; i < 7; i++) {
        write(server, `releases/obsolete-${i}/marker`);
        fs.utimesSync(path.join(server, `releases/obsolete-${i}`), 100 + i, 100 + i);
      }
    }
    const harness = path.join(root, 'activation-test.sh');
    fs.writeFileSync(harness, `#!/usr/bin/env bash
SERVER=$2
SCENARIO=$3
export SERVER SCENARIO
timeout() { shift 2; "$@"; }
readlink() { cat "\${@: -1}"; }
ln() { local target="\${@: -2:1}" link="\${@: -1}"; printf '%s' "$target" > "$link"; }
pm2() {
  echo "$*" >> "$SERVER/pm2.log"
  if [ "$1" = startOrReload ]; then
    local count=0
    [ ! -f "$SERVER/reloads" ] || count=$(cat "$SERVER/reloads")
    count=$((count + 1)); echo "$count" > "$SERVER/reloads"
    if [ "$SCENARIO" = pm2-failure ] && [ "$count" = 1 ]; then return 1; fi
  fi
}
curl() {
  local count=0
  [ ! -f "$SERVER/healths" ] || count=$(cat "$SERVER/healths")
  count=$((count + 1)); echo "$count" > "$SERVER/healths"
  if [ "$SCENARIO" = health-failure ] && [ "$count" = 1 ]; then return 1; fi
}
export -f timeout readlink ln pm2 curl
prepare=false
[ "$SCENARIO" != prepare-only ] || prepare=true
source "$1" "$SERVER" new true "$prepare"
`);
    const result = spawnSync(bash, [posix(harness), posix(path.join(__dirname, 'deploy-erp-remote.sh')), posix(server), scenario],
      { encoding: 'utf8', timeout: 20000 });
    assert.ifError(result.error);
    assert.equal(result.status, ['success', 'prepare-only'].includes(scenario) ? 0 : 1, result.stderr);
    assert.equal(fs.readFileSync(path.join(server, 'current'), 'utf8'), scenario === 'success' ? next : old);
    if (scenario.endsWith('failure')) {
      assert.equal(fs.readFileSync(path.join(server, 'reloads'), 'utf8').trim(), '2');
      assert.ok(!fs.readFileSync(path.join(server, 'pm2.log'), 'utf8').includes('save'));
    }
    if (scenario === 'success') {
      assert.match(fs.readFileSync(path.join(server, 'pm2.log'), 'utf8'), /save/);
      assert.equal(fs.readdirSync(path.join(server, 'releases')).length, 5);
      assert.equal(fs.existsSync(path.join(server, 'releases/obsolete-0')), false);
      assert.equal(fs.existsSync(path.join(server, 'releases/new')), true);
    }
    if (['prepare-only', 'incomplete', 'missing-asset'].includes(scenario)) assert.equal(fs.existsSync(path.join(server, 'pm2.log')), false);
  });
}
