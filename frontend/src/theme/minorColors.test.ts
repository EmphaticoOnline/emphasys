import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { emphasysBrand } from './brand/emphasys.ts';
import { categoricalPalettes } from './functional.ts';
import {
  convertLine,
  currentMinorPalettes,
  LATER_FIXTURES,
  MINOR_FIXTURE,
  REST_FIXTURE,
  revertLater,
  type LaterFixtures,
  minorTokenMap,
  revertMinor,
  type MinorFixture,
  type MinorPalettes,
} from './__fixtures__/colorMigrations.ts';

const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** HEAD 3e06d2f: texto original y migrado de cada línea, fragmentos e imports agregados. */
const baseline: MinorFixture = JSON.parse(readText('./__fixtures__/minorColors.baseline.json'));
const files = () => Object.entries(baseline.files);
/** Bloques posteriores (restos) que tocan los mismos archivos: se revierten primero. */
const laterFixtures: LaterFixtures = Object.fromEntries(
  LATER_FIXTURES
    .filter((name) => existsSync(new URL(`./__fixtures__/${name}`, import.meta.url)))
    .map((name) => [name, JSON.parse(readText(`./__fixtures__/${name}`))]),
);
const asOfBlock = (file: string) => revertLater(MINOR_FIXTURE, file, readText(`../${file}`), laterFixtures);
const colorLines = () =>
  files().flatMap(([file, { lines }]) =>
    Object.entries(lines)
      .filter(([, line]) => line.entries.length > 0)
      .map(([n, line]) => ({ file, n, ...line })),
  );

test('equivalencia contra HEAD: restaurar líneas, fragmentos e imports reproduce cada archivo', () => {
  for (const [file, entry] of files()) {
    assert.equal(sha256(revertMinor(asOfBlock(file), entry)), entry.headSha256, file);
  }
});

test('cada línea migrada es exactamente la transformación de su original con los valores actuales', () => {
  const map = minorTokenMap(currentMinorPalettes());
  for (const { file, n, original, migrated } of colorLines()) {
    assert.equal(convertLine(original, map), migrated, `${file}:${n}`);
  }
});

test('mutación: alterar cualquier valor usado rompe la transformación de sus líneas', () => {
  const used = new Set(colorLines().flatMap((line) => line.entries.map((e) => e.token)));
  for (const token of used) {
    const palettes = structuredClone(currentMinorPalettes()) as MinorPalettes;
    const keys = [...token.matchAll(/([a-zA-Z]+)|\[(\d+)\]/g)].map(([, key, index]) => (key ?? index)!);
    const parent = keys
      .slice(0, -1)
      .reduce<Record<string, unknown>>((node, key) => node[key] as Record<string, unknown>, palettes as unknown as Record<string, unknown>);
    const value = parent[keys.at(-1)!] as string;
    parent[keys.at(-1)!] = `${value.slice(0, -1)}${value.endsWith('0') ? '1' : '0'}`;
    const map = minorTokenMap(palettes);
    const affected = colorLines().filter((line) => line.entries.some((e) => e.token === token));
    assert.ok(affected.length > 0);
    for (const { file, n, original, migrated } of affected) {
      assert.notEqual(convertLine(original, map), migrated, `${file}:${n} no detectó ${token}`);
    }
  }
});

test('los fragmentos de ActivityCard conservan exactamente sus valores', () => {
  const snippets = Object.values(baseline.files['components/ActivityCard.tsx']!.snippets);
  assert.equal(snippets.length, 2);
  for (const { original, token } of snippets) {
    const values = [...original.matchAll(/'(#[0-9a-fA-F]{6})'/g)].map((m) => m[1]);
    const key = token.replace('categoricalPalettes.', '') as keyof typeof categoricalPalettes;
    assert.deepStrictEqual([...categoricalPalettes[key]], values, token);
  }
});

test('tinte y tinta salen de la marca; info, selección y terceros no', () => {
  assert.equal(emphasysBrand.colors.blue.tint, '#eef2ff');
  assert.equal(emphasysBrand.colors.ink.muted, '#7a7268');
  const map = minorTokenMap(currentMinorPalettes());
  const brandValues = new Set(JSON.stringify(emphasysBrand.colors).match(/#[0-9a-f]{6}/g));
  for (const [hex, token] of Object.entries(map)) {
    assert.equal(brandValues.has(hex), token.startsWith('activeBrand.'), `${token} (${hex})`);
  }
});

test('la actividad futura usa el mismo acento en ActivityCard y ActividadesPage', () => {
  for (const file of ['components/ActivityCard.tsx', 'pages/ActividadesPage.tsx']) {
    const tokens = Object.values(baseline.files[file]!.lines).flatMap((line) => line.entries.map((e) => e.token));
    assert.ok(tokens.includes('activityAccents.upcoming'), file);
  }
});

test('los colores de BD quedan fuera; el chip índigo y las escalas MUI son del bloque de restos', () => {
  const migrated = new Set(Object.keys(baseline.files));
  for (const file of ['modules/configuracion/ConceptosPage.tsx', 'pages/ConfiguracionEtapasProduccionPage.tsx', 'components/leads/TemperaturaScoreButton.tsx']) {
    assert.ok(!migrated.has(file), `${file} no se migra`);
  }
  assert.equal(readText('../modules/configuracion/ConceptosPage.tsx').match(/'#3e3428'/g)?.length, 2, 'color de concepto (BD)');
  assert.equal(readText('../pages/ConfiguracionEtapasProduccionPage.tsx').match(/#1D4ED8/g)?.length, 5, 'color de etapa (BD)');
  const rest: { files: Record<string, unknown> } = JSON.parse(readText(`./__fixtures__/${REST_FIXTURE}`));
  for (const file of ['components/crm/ActividadSeguimientoDrawer.tsx', 'pages/OportunidadesPage.tsx', 'components/leads/TemperaturaScoreButton.tsx']) {
    assert.ok(file in rest.files, `${file} debe estar en el bloque de restos`);
  }
});
