const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ensureDependencies, fingerprint } = require('./deploy-dependencies');
const { createTimings } = require('./deploy-timings');

function fixture(t) {
  const parent = path.resolve(__dirname, '../.cache/deploy-erp');
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'test-'));
  const project = path.join(root, 'frontend');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'package.json'), '{"name":"test"}');
  fs.writeFileSync(path.join(project, 'package-lock.json'), '{"lockfileVersion":3}');
  t.after(() => {
    if (path.dirname(path.resolve(root)) !== parent) throw new Error('Unsafe test cleanup');
    fs.rmSync(root, { recursive: true, force: true });
  });
  let installs = 0;
  const install = async () => {
    installs++;
    fs.mkdirSync(path.join(project, 'node_modules'), { recursive: true });
  };
  return { root, project, cache: path.join(root, '.cache/deploy-erp/frontend.sha256'),
    count: () => installs,
    ensure: (extra = {}) => ensureDependencies({ root, directory: 'frontend', env: {}, install, ...extra }), install };
}

test('first install records hash; second run reuses dependencies', async (t) => {
  const f = fixture(t);
  assert.equal(await f.ensure(), 'installed');
  assert.equal(await f.ensure(), 'cached');
  assert.equal(f.count(), 1);
  assert.equal(fs.readFileSync(f.cache, 'utf8').trim(), fingerprint(f.project, {}));
});

for (const file of ['package.json', 'package-lock.json']) {
  test(`${file} content changes invalidate cache even with the same timestamp`, async (t) => {
    const f = fixture(t);
    await f.ensure();
    const target = path.join(f.project, file);
    const previous = fs.statSync(target);
    fs.writeFileSync(target, '{"changed":true}');
    fs.utimesSync(target, previous.atime, previous.mtime);
    assert.equal(await f.ensure(), 'installed');
    assert.equal(f.count(), 2);
  });
}

test('missing node_modules forces install even when hash matches', async (t) => {
  const f = fixture(t);
  await f.ensure();
  fs.rmdirSync(path.join(f.project, 'node_modules'));
  assert.equal(await f.ensure(), 'installed');
});

test('missing/corrupt receipt forces installation', async (t) => {
  const f = fixture(t);
  await f.ensure();
  fs.writeFileSync(f.cache, 'invalid');
  assert.equal(await f.ensure(), 'installed');
  fs.unlinkSync(f.cache);
  assert.equal(await f.ensure(), 'installed');
});

test('failure invalidates old receipt even after reverting manifest changes', async (t) => {
  const f = fixture(t);
  await f.ensure();
  const file = path.join(f.project, 'package.json');
  const original = fs.readFileSync(file);
  fs.writeFileSync(file, '{}');
  await assert.rejects(f.ensure({ install: async () => { throw new Error('npm failed'); } }), /npm failed/);
  assert.equal(fs.existsSync(f.cache), false);
  fs.writeFileSync(file, original);
  assert.equal(await f.ensure(), 'installed');
});

test('receipt uses the lockfile after successful npm install', async (t) => {
  const f = fixture(t);
  await f.ensure({ install: async () => {
    await f.install();
    fs.writeFileSync(path.join(f.project, 'package-lock.json'), '{"updatedByNpm":true}');
  } });
  assert.equal(await f.ensure(), 'cached');
  assert.equal(f.count(), 1);
});

test('SKIP_LOCAL_INSTALL neither installs nor creates a receipt', async (t) => {
  const f = fixture(t);
  assert.equal(await f.ensure({ env: { SKIP_LOCAL_INSTALL: 'true' } }), 'skipped');
  assert.equal(f.count(), 0);
  assert.equal(fs.existsSync(f.cache), false);
});

test('npm configuration changes invalidate dependencies', async (t) => {
  const f = fixture(t);
  await f.ensure();
  assert.equal(await f.ensure({ env: { npm_config_omit: 'dev' } }), 'installed');
  assert.equal(await f.ensure({ env: { npm_config_omit: 'dev' } }), 'cached');
});

test('second and third runs hit cache despite transient npm invocation variables', async (t) => {
  const f = fixture(t);
  assert.equal(await f.ensure({ env: { npm_config_logs_dir: '/first', npm_config_argv: 'first' } }), 'installed');
  assert.equal(await f.ensure({ env: { npm_config_logs_dir: '/second', npm_config_argv: 'second' } }), 'cached');
  assert.equal(await f.ensure({ env: { npm_config_logs_dir: '/third', npm_config_argv: 'third' } }), 'cached');
  assert.equal(f.count(), 1);
});

test('known valid legacy receipt migrates without reinstalling', async (t) => {
  const f = fixture(t);
  await f.ensure();
  fs.writeFileSync(f.cache, fingerprint(f.project, {}, true));
  assert.equal(await f.ensure(), 'cached');
  assert.equal(f.count(), 1);
  assert.equal(fs.readFileSync(f.cache, 'utf8').trim(), fingerprint(f.project, {}));
});

test('timings measure success/failure and accumulate transfer cleanup without double counting', async () => {
  let time = 0;
  const lines = [];
  const timings = createTimings(() => time, (line) => lines.push(line));
  await timings.measure('Build frontend', async () => { time += 92000; });
  timings.start('Transferencia'); time += 1000; timings.stop('Transferencia');
  await assert.rejects(timings.measure('Activación remota', async () => { time += 13000; throw new Error('test'); }));
  timings.start('Transferencia'); time += 1000; timings.stop('Transferencia');
  timings.summary();
  assert.ok(lines.includes('- Build frontend: 92.00s'));
  assert.ok(lines.includes('- Transferencia: 2.00s'));
  assert.ok(lines.includes('- Activación remota: 13.00s'));
  assert.ok(lines.includes('- Total: 107.00s'));
});
