// Deployment is mocked. Only the runner tests launch harmless local Node processes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { run: runCommand } = require('./deploy-command');

const source = fs.readFileSync(path.join(__dirname, 'deploy-erp.js'), 'utf8');
const remote = fs.readFileSync(path.join(__dirname, 'deploy-erp-remote.sh'), 'utf8').replace(/\r\n/g, '\n');

async function simulate(platform, settings = {}) {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const root = platform === 'win32' ? 'C:\\Project with spaces\\emphasys' : '/project with spaces/emphasys';
  const bin = platform === 'win32' ? 'C:\\Program Files\\Git\\usr\\bin' : '/usr/bin';
  const npmCli = paths.join(root, 'npm-cli.js');
  const env = { PATH: platform === 'win32' ? '' : bin, npm_execpath: npmCli, BUILD_ID: '20260922T120000Z', KEEP_ME: 'preserved', ...settings.env };
  const commands = [];
  const mutations = [];
  const tools = ['ssh', 'scp', 'tar'].filter((name) => name !== settings.missing)
    .map((name) => paths.join(bin, name + (platform === 'win32' ? '.exe' : '')));
  const fakeFs = {
    constants: fs.constants,
    existsSync: (file) => file === npmCli || tools.includes(file),
    accessSync(file) { if (!tools.includes(file)) throw new Error('ENOENT'); },
    statSync: () => ({ isFile: () => true }),
    readFileSync: () => remote,
    rmSync: (file) => mutations.push(['remove', file]),
    writeFileSync: (file, data) => mutations.push(['write', file, data]),
    unlinkSync: (file) => mutations.push(['unlink', file]),
    mkdtempSync(prefix) { mutations.push(['mkdir', prefix]); return prefix + 'test'; },
  };
  async function run(command, args, options) {
    const call = { command, args, options };
    commands.push(call);
    const failure = await settings.fail?.(call);
    if (failure) {
      const error = new Error(options.stage + ': ' + (failure.error?.message || failure.status));
      error.exitCode = failure.error?.code === 'ETIMEDOUT' ? 124 : failure.status;
      throw error;
    }
    if (args.at(-1) === 'mktemp -d /tmp/emphasys-erp.XXXXXXXXXX') return '/tmp/emphasys-erp.ABC123\n';
    if (args.at(-1)?.startsWith('cat ')) return `${settings.remoteBuildId || env.BUILD_ID}\n`;
    return '';
  }
  const fakeRequire = (name) => {
    if (name === 'node:fs') return fakeFs;
    if (name === 'node:path') return paths;
    if (name === './deploy-command') return { run };
    if (name === './deploy-package') return {
      createReleasePackage: async ({ root, temporary, tar, env, run }) => {
        const archive = paths.join(temporary, 'deploy-release.tar.gz');
        await run(tar, ['-czf', archive, ...require('./deploy-package').CONTENTS], { env, stage: 'Empaquetar release completo' });
        return archive;
      },
    };
    if (name === './deploy-dependencies') return {
      ensureDependencies: async ({ directory, env, install }) => {
        if (env.SKIP_LOCAL_INSTALL !== 'true' && !settings.cachedDependencies) await install();
      },
    };
    if (name === './deploy-timings') return {
      createTimings: () => require('./deploy-timings').createTimings(undefined, () => {}),
    };
    return require(name);
  };
  const context = {
    require: fakeRequire, module: { exports: {} }, __dirname: paths.join(root, 'scripts'),
    process: { platform, env, execPath: paths.join(bin, 'node') },
    console: { log() {}, error() {} },
  };
  vm.runInNewContext(source, context);
  let error;
  try { await context.module.exports.main(); } catch (caught) { error = caught; }
  return { commands, mutations, error, root, env, paths };
}

for (const platform of ['win32', 'darwin', 'linux']) {
  test(`${platform}: builds ERP/backend, preserves environment, transfers only intended artifacts`, async () => {
    const result = await simulate(platform);
    assert.ifError(result.error);
    const { commands, mutations } = result;
    const builds = commands.filter(({ args }) => args.includes('run'));
    assert.deepEqual(builds.map(({ args }) => Array.from(args.slice(1))), [['run', 'build:erp', '--', '--emptyOutDir'], ['run', 'build']]);
    assert.equal(commands.filter(({ args }) => args.includes('install')).length, 2);
    assert.ok(commands.every(({ options }) => options.env.KEEP_ME === 'preserved' && options.env.FRONTEND_TARGET === 'erp'));
    assert.ok(commands.every(({ command }) => !/rsync|bash/.test(command)));
    const archives = commands.filter(({ args }) => args[0] === '-czf');
    assert.equal(archives.length, 1);
    assert.deepEqual(Array.from(archives[0].args.slice(2)), require('./deploy-package').CONTENTS);
    const transfers = commands.filter(({ command }) => /scp(?:\.exe)?$/.test(command));
    assert.equal(transfers.length, 1);
    const sshSessions = commands.filter(({ command, args }) => /ssh(?:\.exe)?$/.test(command) && !args.includes('-V'));
    assert.equal(sshSessions.length, 2);
    assert.equal(sshSessions[0].options.stage, 'Preparar release completo');
    assert.equal(sshSessions[1].options.stage, 'Instalar y activar release');
    assert.ok(mutations.some(([kind, file, data]) => kind === 'write' && file.endsWith('.build-id') && data === result.env.BUILD_ID + '\n'));
    assert.ok(mutations.filter(([kind]) => kind === 'remove').every(([, file]) => file.startsWith(result.root + result.paths.sep)));
  });
}

test('skip flags preserve builds/install rules and are passed to remote activation', async () => {
  const result = await simulate('win32', { env: { SKIP_FRONTEND: 'true', SKIP_LOCAL_INSTALL: 'true', SKIP_REMOTE_INSTALL: 'true', PREPARE_ONLY: 'true' } });
  assert.ifError(result.error);
  assert.ok(!result.commands.some(({ args }) => args.includes('install') || args.includes('build:erp')));
  assert.ok(result.commands.some(({ args }) => args.includes('build')));
  assert.ok(result.commands.find(({ options }) => options.stage === 'Instalar y activar release')?.args.at(-1).includes('true'));
  const preflight = result.commands.find(({ options }) => options.stage === 'Preparar release completo');
  assert.ok(!preflight.args.at(-1).includes('pm2'));
});

for (const missing of ['ssh', 'scp', 'tar']) {
  test(`missing ${missing} aborts before any build, connection or write`, async () => {
    const result = await simulate('win32', { missing });
    assert.match(result.error.message, new RegExp(`Falta la herramienta requerida ${missing}`));
    assert.equal(result.commands.length, 0);
    assert.equal(result.mutations.length, 0);
  });
}

test('build failure propagates the exit code and prevents release creation', async () => {
  const result = await simulate('win32', { fail: ({ args }) => args.includes('build:erp') && { status: 42 } });
  assert.equal(result.error.exitCode, 42);
  assert.ok(!result.commands.some(({ args }) => args.at(-1)?.startsWith('mktemp')));
});

test('failed upload cleans temporary files and never activates the release', async () => {
  const result = await simulate('win32', { fail: ({ command }) => /scp\.exe$/.test(command) && { status: 9 } });
  assert.equal(result.error.exitCode, 9);
  assert.ok(!result.commands.some(({ options }) => options.stage === 'Instalar y activar release'));
  assert.equal(result.commands.at(-1).options.stage, 'Limpiar temporal tras fallo');
  assert.ok(result.mutations.at(-1)[1].endsWith('.deploy-erp-test'));
});

test('failed remote preparation prevents activation', async () => {
  const result = await simulate('linux', { fail: ({ options }) => options.stage === 'Preparar release completo' && { status: 1 } });
  assert.equal(result.error.exitCode, 1);
  assert.ok(!result.commands.some(({ options }) => options.stage === 'Instalar y activar release'));
});

test('remote activation failure remains a failure after successful temporary cleanup', async () => {
  const result = await simulate('darwin', { fail: ({ options }) => options.stage === 'Instalar y activar release' && { status: 7 } });
  assert.equal(result.error.exitCode, 7);
});

test('unsafe BUILD_ID is rejected before filesystem mutations or commands', async () => {
  const result = await simulate('win32', { env: { BUILD_ID: '../current' } });
  assert.match(result.error.message, /BUILD_ID/);
  assert.equal(result.commands.length, 0);
  assert.equal(result.mutations.length, 0);
});

test('remote install, activation, rollback and retention match the original heredoc exactly', async () => {
  const original = fs.readFileSync(path.join(__dirname, '../deploy-rsync.sh'), 'utf8').replace(/\r\n/g, '\n');
  const block = original.split('<<REMOTE\n')[1].split('\nREMOTE')[0].replace(/\\\$/g, '$');
  const normalized = remote.slice(remote.indexOf('set -e\n'))
    .replace(/# BEGIN asset validation[\s\S]*?# END asset validation\n/, '')
    .replace('cd "$REMOTE_PATH"', 'cd $REMOTE_PATH')
    .replace(/# Preparation[^\n]*\n/, '')
    .replace(/test "\$\(cat[^\n]*\n/g, '')
    .replace(/step '[^']+' \d+ /g, '')
    .replace(/printf '==> REMOTO FIN: limpieza[^\n]+\n/g, '').trimEnd();
  assert.equal(normalized, block.trimEnd());
});

test('all SSH calls close stdin and use a complete remote script file', async () => {
  const { commands } = await simulate('win32');
  const ssh = commands.filter(({ command, args }) => /ssh\.exe$/.test(command) && !args.includes('-V'));
  assert.ok(ssh.every(({ args }) => args.includes('-n') && args.includes('-T')));
  assert.ok(ssh.every(({ args }) => args.includes('ConnectTimeout=20') && args.includes('ServerAliveCountMax=3')));
  assert.ok(commands.every(({ options }) => options.stage && !options.input));
  const activation = ssh.find(({ options }) => options.stage === 'Instalar y activar release');
  assert.ok(activation.args.at(-1).includes('deploy-erp-remote.sh'));
  assert.ok(!activation.args.at(-1).includes('bash -s'));
});

test('preparation session hang times out and cannot reach activation', { timeout: 15000 }, async () => {
  const result = await simulate('win32', {
    fail: async ({ options }) => {
      if (options.stage !== 'Preparar release completo') return;
      // Real silent, hung process in place of ssh. No network or remote mutations.
      await runCommand(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
        stage: options.stage, timeoutMs: 250, heartbeatMs: 100,
      });
    },
  });
  assert.equal(result.error.exitCode, 124);
  assert.match(result.error.message, /Preparar release completo/);
  assert.ok(result.commands.some(({ options }) => options.stage === 'Subir paquete único'));
  assert.ok(!result.commands.some(({ options }) => options.stage === 'Crear enlace frontend-dist'));
  assert.ok(!result.commands.some(({ options }) => options.stage === 'Instalar y activar release'));
  assert.equal(result.commands.at(-1).options.stage, 'Limpiar temporal tras fallo');
});

test('runner gives stdin EOF without waiting for keyboard input', { timeout: 15000 }, async () => {
  const output = await runCommand(process.execPath, ['-e',
    "process.stdin.resume(); process.stdin.on('end', () => console.log('EOF'));"],
  { stage: 'Prueba stdin cerrado', capture: true, timeoutMs: 5000 });
  assert.equal(output.trim(), 'EOF');
});

test('runner enforces timeout even when SIGTERM would be ignored', { timeout: 15000 }, async () => {
  await assert.rejects(runCommand(process.execPath, ['-e',
    "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);"],
  { stage: 'Prueba proceso resistente', timeoutMs: 250, heartbeatMs: 100 }),
  (error) => error.exitCode === 124 && /Prueba proceso resistente/.test(error.message));
});

test('runner preserves child failure exit code', async () => {
  await assert.rejects(runCommand(process.execPath, ['-e', 'process.exit(23)'],
    { stage: 'Prueba exit code', timeoutMs: 5000 }), (error) => error.exitCode === 23);
});

test('cached dependencies never skip frontend or backend builds', async () => {
  const result = await simulate('win32', { cachedDependencies: true });
  assert.ifError(result.error);
  assert.ok(!result.commands.some(({ args }) => args.includes('install')));
  assert.ok(result.commands.some(({ args }) => args.includes('build:erp') && args.includes('--emptyOutDir')));
  assert.ok(result.commands.some(({ args }) => args.includes('build')));
  assert.ok(!result.mutations.some(([kind, file]) => kind === 'remove' && file.endsWith('frontend\\dist\\erp')));
});
