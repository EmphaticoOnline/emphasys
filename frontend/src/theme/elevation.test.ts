import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { emphasysBrand } from './brand/emphasys.ts';
import type { BrandDefinition } from './brand/types.ts';
import { brandElevation, buildBrandElevation, elevation } from './elevation.ts';
import {
  ELEVATION_ORDER,
  LATER_FIXTURES,
  revertLater,
  revertMinor,
  type LaterFixtures,
  type MinorFileFixture,
} from './__fixtures__/colorMigrations.ts';

const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

type TokenBaseline = Record<string, { value: string; headOccurrences: number }>;
const baseline = JSON.parse(readText('./__fixtures__/elevation.baseline.json')) as {
  structural: TokenBaseline;
  brand: TokenBaseline;
};

type Replacement = { from: string; to: string; times: number };
type ElevationFileFixture = MinorFileFixture & {
  lines: Record<string, MinorFileFixture['lines'][string] & { replacements: Replacement[] }>;
};
type ElevationFixture = { source: string; files: Record<string, ElevationFileFixture> };

const blocks = ELEVATION_ORDER.map((name) => ({ name, fixture: JSON.parse(readText(`./__fixtures__/${name}`)) as ElevationFixture }));
const laterFixtures: LaterFixtures = Object.fromEntries(
  LATER_FIXTURES.filter((name) => existsSync(new URL(`./__fixtures__/${name}`, import.meta.url))).map((name) => [
    name,
    JSON.parse(readText(`./__fixtures__/${name}`)),
  ]),
);
const asOfBlock = (name: string, file: string) => revertLater(name, file, readText(`../${file}`), laterFixtures);
const allLines = () =>
  blocks.flatMap(({ name, fixture }) =>
    Object.entries(fixture.files).flatMap(([file, entry]) => Object.entries(entry.lines).map(([n, line]) => ({ name, file, n, ...line }))),
  );

/** `elevation.railControl` → literal entre comillas, con los valores dados. */
const tokenLiteral = (token: string, values: Record<string, string>) => {
  const match = /^elevation\.(\w+)$/.exec(token);
  if (!match || !(match[1]! in values)) throw new Error(`Token de elevación desconocido: ${token}`);
  return `'${values[match[1]!]}'`;
};
const restoreLine = (migrated: string, replacements: Replacement[], values: Record<string, string>) =>
  replacements.reduce((line, { to }) => line.split(to).join(tokenLiteral(to, values)), migrated);

/** Marca alternativa: cambia solo grafito, tinta y azul respecto de Emphasys. */
const alternateBrand = (overrides: Partial<{ graphite: string; ink: string; blue: string }>): BrandDefinition => {
  const brand = structuredClone(emphasysBrand);
  if (overrides.graphite) brand.colors.graphite.deep = overrides.graphite;
  if (overrides.ink) brand.colors.ink.primary = overrides.ink;
  if (overrides.blue) brand.colors.blue.base = overrides.blue;
  return brand;
};

test('paridad: cada token de elevación reproduce byte a byte un literal que existía en HEAD', () => {
  assert.deepEqual(Object.keys(elevation).sort(), Object.keys(baseline.structural).sort());
  assert.deepEqual(Object.keys(brandElevation).sort(), Object.keys(baseline.brand).sort());
  for (const [key, { value, headOccurrences }] of Object.entries(baseline.structural)) {
    assert.equal(elevation[key as keyof typeof elevation], value, `elevation.${key}`);
    assert.ok(headOccurrences > 0, `elevation.${key} debe venir de un literal real`);
  }
  for (const [key, { value, headOccurrences }] of Object.entries(baseline.brand)) {
    assert.equal(brandElevation[key as keyof typeof brandElevation], value, `brandElevation.${key}`);
    assert.ok(headOccurrences > 0, `brandElevation.${key} debe venir de un literal real`);
  }
  // Sin unificación: ningún valor se repite entre tokens.
  const values = [...Object.values(elevation), ...Object.values(brandElevation)];
  assert.equal(new Set(values).size, values.length);
});

test('las sombras de identidad se derivan de la marca; las estructurales no usan sus colores', () => {
  assert.deepEqual(buildBrandElevation(emphasysBrand), brandElevation);
  const { graphite, ink, blue } = emphasysBrand.colors;
  const rgb = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(', ');
  for (const [key, value] of Object.entries(elevation)) {
    for (const hex of [graphite.deep, ink.primary, blue.base]) {
      assert.ok(!value.includes(rgb(hex)), `elevation.${key} no debe usar el color de marca ${hex}`);
    }
  }
});

test('marca alternativa: cambian solo las sombras de identidad, con la misma geometría', () => {
  const alt = buildBrandElevation(alternateBrand({ graphite: '#102030', ink: '#405060', blue: '#708090' }));
  const geometry = (shadow: string) => shadow.replace(/rgba\([^)]*\)/, 'COLOR');
  for (const key of Object.keys(brandElevation) as (keyof typeof brandElevation)[]) {
    assert.notEqual(alt[key], brandElevation[key], `brandElevation.${key} debe seguir a la marca`);
    assert.equal(geometry(alt[key]), geometry(brandElevation[key]), `brandElevation.${key} conserva desplazamiento y alfa`);
  }
  assert.equal(alt.floating, '0 16px 40px rgba(16, 32, 48, 0.18)');
  assert.equal(alt.dialog, '0 18px 48px rgba(64, 80, 96, 0.16)');
  assert.equal(alt.primaryGlow, '0 10px 24px rgba(112, 128, 144, 0.28)');
  // Las estructurales son constantes del módulo: la marca no participa.
  for (const [key, { value }] of Object.entries(baseline.structural)) assert.equal(elevation[key as keyof typeof elevation], value);

  // Cada color de marca mueve solo su familia de sombras.
  const changed = (brand: BrandDefinition) =>
    Object.entries(buildBrandElevation(brand))
      .filter(([key, value]) => value !== brandElevation[key as keyof typeof brandElevation])
      .map(([key]) => key)
      .sort();
  assert.deepEqual(changed(alternateBrand({ graphite: '#102030' })), ['floating', 'floatingStrong']);
  assert.deepEqual(changed(alternateBrand({ ink: '#405060' })), ['dialog', 'dropdown', 'panel']);
  assert.deepEqual(changed(alternateBrand({ blue: '#708090' })), ['activeGlow', 'primaryGlow']);
});

test('E1 equivalencia contra HEAD: restaurar cada archivo reproduce el previo byte a byte', () => {
  for (const { name, fixture } of blocks) {
    for (const [file, entry] of Object.entries(fixture.files)) {
      assert.equal(sha256(revertMinor(asOfBlock(name, file), entry)), entry.headSha256, `${name} ${file}`);
    }
  }
});

test('E1 transformación: cada línea es su original con los reemplazos declarados, y vuelve con los valores actuales', () => {
  let total = 0;
  for (const { name, file, n, original, migrated, replacements } of allLines()) {
    let out = original;
    for (const { from, to, times } of replacements) {
      assert.equal(out.split(from).length - 1, times, `${name} ${file}:${n} "${from}"`);
      assert.match(to, /^elevation\.rail(Control|Selection)$/, `${name} ${file}:${n}: E1 solo usa las sombras del rail`);
      out = out.split(from).join(to);
      total += times;
    }
    assert.equal(out, migrated, `${name} ${file}:${n}`);
    assert.equal(restoreLine(migrated, replacements, elevation), original, `${name} ${file}:${n}`);
  }
  assert.equal(total, 23);
});

test('E1 mutación: alterar una sombra del rail rompe la equivalencia de cada archivo que la usa', () => {
  for (const key of ['railControl', 'railSelection'] as const) {
    const mutated = { ...elevation, [key]: elevation[key].replace('0.', '0.9') };
    for (const { name, fixture } of blocks) {
      for (const [file, entry] of Object.entries(fixture.files)) {
        const uses = Object.values(entry.lines).some((line) => line.replacements.some(({ to }) => to === `elevation.${key}`));
        if (!uses) continue;
        const lines = { ...entry.lines };
        for (const [n, line] of Object.entries(lines)) {
          lines[n] = { ...line, original: restoreLine(line.migrated, line.replacements, mutated) };
        }
        const restored = revertMinor(asOfBlock(name, file), { ...entry, lines });
        assert.notEqual(sha256(restored), entry.headSha256, `${file} debe detectar la mutación de ${key}`);
      }
    }
  }
});

test('E1 cierre: no quedan sombras del rail escritas a mano y E2–E4 siguen intactos', () => {
  const root = new URL('../', import.meta.url);
  const files: string[] = [];
  const walk = (dir: URL, rel: string) => {
    for (const name of readdirSync(dir)) {
      const path = `${rel}${name}`;
      if (['dev-mockups', 'theme', 'node_modules'].includes(name) && rel === '') continue;
      const url = new URL(name, dir);
      if (statSync(url).isDirectory()) walk(new URL(`${name}/`, dir), `${path}/`);
      else if (/\.(tsx?|css)$/.test(name)) files.push(path);
    }
  };
  walk(root, '');
  const count = (literal: string) => files.reduce((sum, file) => sum + (readText(`../${file}`).split(literal).length - 1), 0);
  assert.equal(count(elevation.railControl), 0);
  assert.equal(count(elevation.railSelection), 0);
  // Fuera de este bloque: el resto de sombras sigue literal, con sus usos de HEAD.
  for (const layer of [baseline.structural, baseline.brand]) {
    for (const [key, { value, headOccurrences }] of Object.entries(layer)) {
      if (key === 'railControl' || key === 'railSelection') continue;
      assert.equal(count(value), headOccurrences, `${key} no se migra en E1`);
    }
  }
});
