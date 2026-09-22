const fs = require('node:fs');
const path = require('node:path');
const { assetsManifest } = require('./deploy-assets');

const CONTENTS = [
  'backend/dist', 'backend/assets', 'backend/package.json', 'backend/package-lock.json',
  'frontend/dist/erp', 'ecosystem.config.js',
];

async function createReleasePackage({ root, temporary, tar, env, run }) {
  // Explicit allowlist: no repository-wide copy, dependencies or server-managed data.
  for (const entry of CONTENTS) fs.accessSync(path.join(root, entry));
  fs.writeFileSync(path.join(temporary, 'deploy-assets.sha256'), assetsManifest(root));
  const scripts = ['deploy-erp-prepare.sh', 'deploy-erp-remote.sh'];
  for (const name of scripts) {
    fs.writeFileSync(path.join(temporary, name), fs.readFileSync(path.join(__dirname, name), 'utf8').replace(/\r\n/g, '\n'));
  }
  const archive = path.join(temporary, 'deploy-release.tar.gz');
  const relative = (file) => path.relative(root, file).split(path.sep).join('/');
  await run(tar, ['-czf', relative(archive), '--exclude=.env', '--exclude=.env.*',
    '--exclude=node_modules', '--exclude=backend/dist/uploads', ...CONTENTS, '-C', relative(temporary), ...scripts, 'deploy-assets.sha256'], {
    cwd: root, env: { ...env, COPYFILE_DISABLE: '1' }, stage: 'Empaquetar release completo', timeoutMs: 600000,
  });
  return archive;
}

module.exports = { createReleasePackage, CONTENTS };
