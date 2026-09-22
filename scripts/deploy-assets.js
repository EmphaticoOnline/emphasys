const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}

function assetsManifest(root) {
  const backend = path.join(root, 'backend');
  const assets = files(path.join(backend, 'assets')).map((file) => ({
    file, relative: path.relative(backend, file).split(path.sep).join('/'),
  })).filter(({ relative }) => !relative.split('/').some((part) =>
    part === 'node_modules' || part === 'uploads' || part === '.env' || part.startsWith('.env.')))
    .sort((a, b) => a.relative.localeCompare(b.relative));
  const names = new Set(assets.map(({ relative }) => relative));
  const required = new Set();
  for (const compiled of files(path.join(backend, 'dist')).filter((file) => file.endsWith('.js'))) {
    const code = fs.readFileSync(compiled, 'utf8');
    // Static relative references, including require/require.resolve of an asset.
    for (const match of code.matchAll(/['"]((?:\.\.\/)+assets\/[^'"\r\n]+)['"]/g)) {
      required.add(path.relative(backend, path.resolve(path.dirname(compiled), match[1])).split(path.sep).join('/'));
    }
    // The PDF modules build fontsPath with path.resolve(__dirname, '..', '..', '..', 'assets', 'fonts').
    if (/['"]assets['"]/.test(code) && /['"]fonts['"]/.test(code)) {
      for (const match of code.matchAll(/['"](TREBUC[^'"\/\r\n]*\.TTF)['"]/g)) required.add(`assets/fonts/${match[1]}`);
    }
  }
  for (const relative of required) {
    if (!names.has(relative)) throw new Error(`Asset requerido por dist ausente o con mayúsculas incorrectas: ${relative}`);
  }
  if (!assets.length) throw new Error('backend/assets está vacío; no se puede verificar el release.');
  return assets.map(({ file, relative }) => {
    if (/[\\\r\n]/.test(relative)) throw new Error(`Nombre de asset no compatible con el manifiesto: ${relative}`);
    const hash = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    return `${hash}  ${relative}\n`;
  }).join('');
}

module.exports = { assetsManifest };
