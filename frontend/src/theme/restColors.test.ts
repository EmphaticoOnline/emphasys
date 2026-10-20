import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { emphasysBrand } from './brand/emphasys.ts';
import { feedbackTokens, opportunityBucketColors, temperatureColors } from './functional.ts';
import {
  convertLine,
  currentRestPalettes,
  LATER_FIXTURES,
  REST_FIXTURE,
  restTokenMap,
  revertLater,
  revertMinor,
  type LaterFixtures,
  type RestFixture,
  type RestPalettes,
} from './__fixtures__/colorMigrations.ts';

const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** HEAD d70d93a: grupo de cada archivo, texto original y migrado de cada línea, imports. */
const baseline: RestFixture = JSON.parse(readText('./__fixtures__/restColors.baseline.json'));
const files = () => Object.entries(baseline.files);
const laterFixtures: LaterFixtures = Object.fromEntries(
  LATER_FIXTURES.filter((name) => existsSync(new URL(`./__fixtures__/${name}`, import.meta.url))).map((name) => [
    name,
    JSON.parse(readText(`./__fixtures__/${name}`)),
  ]),
);
const colorLines = () =>
  files().flatMap(([file, entry]) =>
    Object.entries(entry.lines)
      .filter(([, line]) => line.entries.length > 0)
      .map(([n, line]) => ({ file, n, group: entry.group, ...line })),
  );

test('equivalencia contra HEAD: restaurar líneas e imports reproduce cada archivo', () => {
  // Primero se revierten los bloques posteriores que tocaron el mismo archivo (p. ej. elevación E3).
  for (const [file, entry] of files()) {
    const asOfBlock = revertLater(REST_FIXTURE, file, readText(`../${file}`), laterFixtures);
    assert.equal(sha256(revertMinor(asOfBlock, entry)), entry.headSha256, file);
  }
});

test('cada línea migrada es la transformación de su original con los valores actuales de su grupo', () => {
  const palettes = currentRestPalettes();
  for (const { file, n, group, original, migrated } of colorLines()) {
    assert.equal(convertLine(original, restTokenMap(group, palettes)), migrated, `${file}:${n}`);
  }
});

test('mutación: alterar cualquier valor usado rompe la transformación de sus líneas', () => {
  const used = new Set(colorLines().flatMap((line) => line.entries.map((e) => e.token)));
  for (const token of used) {
    const [root, key] = token.split('.') as [keyof RestPalettes, string];
    const palettes = structuredClone(currentRestPalettes());
    const value = palettes[root][key]!;
    palettes[root][key] = `${value.slice(0, -1)}${value.endsWith('0') ? '1' : '0'}`;
    const affected = colorLines().filter((line) => line.entries.some((e) => e.token === token));
    assert.ok(affected.length > 0, token);
    for (const { file, n, group, original, migrated } of affected) {
      assert.notEqual(convertLine(original, restTokenMap(group, palettes)), migrated, `${file}:${n} no detectó ${token}`);
    }
  }
});

test('los buckets de éxito, error y advertencia son exactamente los de palette de MUI', () => {
  assert.equal(opportunityBucketColors.convertidas, feedbackTokens.success.main);
  assert.equal(opportunityBucketColors.perdidas, feedbackTokens.error.main);
  assert.equal(opportunityBucketColors.pausadas, feedbackTokens.warning.main);
  assert.equal(opportunityBucketColors.abiertas, '#1976d2');
});

test('la temperatura es una escala propia aunque comparta valores con estados', () => {
  // "Muy caliente" no es un error: mismo valor, objeto separado.
  assert.equal(temperatureColors.muy_caliente, feedbackTokens.error.main);
  assert.equal(temperatureColors.caliente, feedbackTokens.warning.main);
  assert.notEqual(temperatureColors as unknown, opportunityBucketColors as unknown);
  assert.deepStrictEqual(Object.keys(temperatureColors), ['frio', 'tibio', 'caliente', 'muy_caliente']);
});

test('ningún color del bloque sale de la marca; el chip índigo coincide con el tinte pero no lo sigue', () => {
  const brandValues = new Set(JSON.stringify(emphasysBrand.colors).match(/#[0-9a-f]{6}/g));
  const palettes = currentRestPalettes();
  for (const [root, values] of Object.entries(palettes)) {
    for (const [key, hex] of Object.entries(values)) {
      const expected = root === 'activityTypeChipColors' && key === 'pendingBackground';
      assert.equal(brandValues.has(hex), expected, `${root}.${key}`);
    }
  }
});
