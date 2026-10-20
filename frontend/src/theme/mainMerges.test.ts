import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { MERGE_ORDER, revertMerge, type MergeFixture } from './__fixtures__/colorMigrations.ts';

/**
 * Merges de `main` registrados en la cadena de fixtures. No migran nada: permiten
 * que las pruebas de equivalencia de los bloques anteriores reviertan los archivos
 * que `main` también tocó, sin perder el cambio de `main`.
 */
const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const merges = MERGE_ORDER.map((name) => ({ name, fixture: JSON.parse(readText(`./__fixtures__/${name}`)) as MergeFixture }));

test('cada archivo de un merge registrado coincide con el resultado del merge y se revierte a su contenido previo', () => {
  assert.ok(merges.length > 0);
  for (const { name, fixture } of merges) {
    for (const [file, entry] of Object.entries(fixture.files)) {
      const current = readText(`../${file}`);
      assert.equal(sha256(current), entry.mergedSha256, `${name} ${file}: cambió después del merge sin registrarse`);
      assert.equal(sha256(entry.merged), entry.mergedSha256, `${name} ${file}: contenido del merge corrupto en el fixture`);
      assert.equal(sha256(entry.before), entry.beforeSha256, `${name} ${file}: contenido previo corrupto en el fixture`);
      assert.equal(sha256(revertMerge(current, file, entry)), entry.beforeSha256, `${name} ${file}`);
      assert.throws(() => revertMerge(`${current}\n`, file, entry), /no coincide con el merge registrado/);
    }
  }
});

test('merge de main 8761927: configVisual conserva el arreglo de scroll de main y los cambios de White Label', () => {
  const file = 'components/configuracion/configVisual.tsx';
  const entry = merges.find(({ name }) => name === 'merges.main-8761927.baseline.json')!.fixture.files[file]!;
  const current = readText(`../${file}`);

  // Arreglo de main (ConfigPageFrame): el marco hace scroll y el contenido va en una columna interna.
  assert.match(current, /flex: '1 1 auto',\n\s+minHeight: 0,\n\s+overflow: 'auto',/);
  assert.match(current, /<Box sx=\{\{ display: 'flex', flexDirection: 'column', gap: 1\.5, minWidth: 0 \}\}>\n\s+\{children\}\n\s+<\/Box>/);
  // White Label (D-B4): el botón primario lee el foreground del tema y no queda el import sin uso.
  assert.match(current, /color: theme\.emphasys\.action\.primaryForeground,/);
  assert.doesNotMatch(current, /onPrimaryColors/);

  // El contenido previo es el de la rama antes del merge: sin el arreglo de main y con los cambios de White Label.
  assert.match(entry.before, /flex: 1,\n\s+minHeight: 0,/);
  assert.doesNotMatch(entry.before, /'1 1 auto'/);
  assert.match(entry.before, /color: theme\.emphasys\.action\.primaryForeground,/);
});
