import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { emphasysBrand } from './brand/emphasys.ts';
import type { BrandDefinition } from './brand/types.ts';
import { brandElevation, brandGradients, buildBrandElevation, buildBrandGradients, elevation, surfaceGradients } from './elevation.ts';
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
  surfaceGradients: TokenBaseline;
  brandGradients: TokenBaseline;
};
/** Capa del módulo → sección del fixture. Estructurales: `elevation`, `surfaceGradients`; de marca: el resto. */
const LAYERS = [
  ['elevation', 'structural'],
  ['brandElevation', 'brand'],
  ['surfaceGradients', 'surfaceGradients'],
  ['brandGradients', 'brandGradients'],
] as const;
type LayerName = (typeof LAYERS)[number][0];
type Layers = Record<LayerName, Record<string, string>>;
const currentLayers = (): Layers => ({ elevation, brandElevation, surfaceGradients, brandGradients });
/** Capas de identidad construidas con otra marca; las estructurales no participan. */
const brandLayers = (brand: BrandDefinition): Partial<Layers> => ({
  brandElevation: buildBrandElevation(brand),
  brandGradients: buildBrandGradients(brand),
});

type Replacement = { from: string; to: string; times: number };
type ElevationFileFixture = MinorFileFixture & {
  lines: Record<string, MinorFileFixture['lines'][string] & { replacements: Replacement[]; importMerge?: boolean }>;
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

/** Token completo (`elevation.railControl`, `brandGradients.updateBar`) → valor. */
type TokenValues = Record<string, string>;
const tokenValues = (overrides: Partial<Layers> = {}): TokenValues =>
  Object.fromEntries(
    Object.entries({ ...currentLayers(), ...overrides }).flatMap(([layer, values]) =>
      Object.entries(values).map(([key, value]) => [`${layer}.${key}`, value]),
    ),
  );
/** Reemplazo → token: `elevation.card` (string entre comillas) o `${elevation.statusCard}` (dentro de una plantilla). */
const tokenOf = (to: string) => /^\$\{(.+)\}$/.exec(to)?.[1] ?? to;
const restoreLine = (migrated: string, replacements: Replacement[], values: TokenValues) =>
  replacements.reduce((line, { to }) => {
    const token = tokenOf(to);
    if (!(token in values)) throw new Error(`Token de elevación desconocido: ${token}`);
    return line.split(to).join(to === token ? `'${values[token]}'` : values[token]!);
  }, migrated);

/** Tokens y reemplazos de cada bloque (ver docs/white-label-elevacion-audit.md §5). */
const BLOCK_SCOPE: Record<string, { tokens: string[]; total: number }> = {
  'elevation.e1.baseline.json': { tokens: ['elevation.railControl', 'elevation.railSelection'], total: 23 },
  'elevation.e2.baseline.json': {
    tokens: ['brandElevation.floating', 'brandElevation.floatingStrong', 'brandElevation.dialog', 'brandElevation.panel', 'brandElevation.dropdown'],
    total: 17,
  },
  'elevation.e3.baseline.json': {
    tokens: [
      'elevation.hairline',
      'elevation.hairlineBlack',
      'elevation.card',
      'elevation.floatingButton',
      'elevation.gridMenu',
      'elevation.floatingSummary',
      'elevation.draggable',
      'elevation.dragging',
      'elevation.drawer',
      'elevation.drawerButton',
      'elevation.statusCard',
      'elevation.statusCardRest',
      'elevation.underline',
    ],
    total: 17,
  },
  'elevation.e4.baseline.json': {
    tokens: [
      'brandElevation.primaryGlow',
      'brandElevation.activeGlow',
      'surfaceGradients.header',
      'surfaceGradients.disabledHatch',
      'brandGradients.updateBar',
    ],
    total: 5,
  },
};
const migratedTokens = () => blocks.flatMap(({ name }) => BLOCK_SCOPE[name]!.tokens);

/** Restaura un archivo con valores alternativos de los tokens y devuelve su SHA-256. */
const restoredSha = (name: string, file: string, entry: ElevationFileFixture, values: TokenValues) => {
  const lines = Object.fromEntries(
    Object.entries(entry.lines).map(([n, line]) => [n, line.importMerge ? line : { ...line, original: restoreLine(line.migrated, line.replacements, values) }]),
  );
  return sha256(revertMinor(asOfBlock(name, file), { ...entry, lines }));
};

/** Marca alternativa: cambia solo grafito, tinta y azul respecto de Emphasys. */
const alternateBrand = (overrides: Partial<{ graphite: string; ink: string; blue: string }>): BrandDefinition => {
  const brand = structuredClone(emphasysBrand);
  if (overrides.graphite) brand.colors.graphite.deep = overrides.graphite;
  if (overrides.ink) brand.colors.ink.primary = overrides.ink;
  if (overrides.blue) brand.colors.blue.base = overrides.blue;
  return brand;
};

test('paridad: cada token de elevación y degradado reproduce byte a byte un literal que existía en HEAD', () => {
  const layers = currentLayers();
  for (const [layer, section] of LAYERS) {
    assert.deepEqual(Object.keys(layers[layer]).sort(), Object.keys(baseline[section]).sort(), layer);
    for (const [key, { value, headOccurrences }] of Object.entries(baseline[section])) {
      assert.equal(layers[layer][key], value, `${layer}.${key}`);
      assert.ok(headOccurrences > 0, `${layer}.${key} debe venir de un literal real`);
    }
  }
  // Sin unificación: ningún valor se repite entre tokens.
  const values = Object.values(tokenValues());
  assert.equal(new Set(values).size, values.length);
});

test('degradados: el inicio de la barra de actualización sigue al azul de marca y el final queda fijo (D-E2)', () => {
  assert.deepEqual(buildBrandGradients(emphasysBrand), brandGradients);
  assert.equal(surfaceGradients.updateBarEnd, '#3b82f6');
  const alt = buildBrandGradients(alternateBrand({ blue: '#708090' }));
  assert.equal(alt.updateBar, 'linear-gradient(90deg, #708090 0%, #3b82f6 100%)');
  // Grafito y tinta no participan en los degradados.
  assert.deepEqual(buildBrandGradients(alternateBrand({ graphite: '#102030', ink: '#405060' })), brandGradients);
  // Los degradados estructurales no usan colores de marca.
  const brandHexes = JSON.stringify(emphasysBrand.colors).match(/#[0-9a-f]{6}/g) ?? [];
  for (const [key, value] of Object.entries(surfaceGradients)) {
    for (const hex of brandHexes) assert.ok(!value.toLowerCase().includes(hex), `surfaceGradients.${key} no debe usar ${hex}`);
  }
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

test('todos los bloques del registro tienen alcance declarado', () => {
  assert.deepEqual(Object.keys(BLOCK_SCOPE), [...ELEVATION_ORDER]);
});

test('equivalencia contra HEAD: restaurar cada archivo de cada bloque reproduce el previo byte a byte', () => {
  for (const { name, fixture } of blocks) {
    for (const [file, entry] of Object.entries(fixture.files)) {
      assert.equal(sha256(revertMinor(asOfBlock(name, file), entry)), entry.headSha256, `${name} ${file}`);
    }
  }
});

test('transformación: cada línea es su original con los reemplazos declarados, y vuelve con los valores actuales', () => {
  const totals: Record<string, number> = {};
  for (const { name, file, n, original, migrated, replacements, importMerge } of allLines()) {
    if (importMerge) {
      // Import fusionado: mismo módulo, conserva todos los nombres previos y agrega los del bloque.
      const names = (line: string) => /^import \{ ([^}]+) \} from '([^']+)';$/.exec(line)!;
      const [, before, mod] = names(original);
      const [, after, modAfter] = names(migrated);
      assert.equal(modAfter, mod, `${name} ${file}:${n}`);
      assert.match(mod!, /theme\/elevation$/);
      for (const x of before!.split(', ')) assert.ok(after!.split(', ').includes(x), `${name} ${file}:${n} perdió ${x}`);
      continue;
    }
    let out = original;
    for (const { from, to, times } of replacements) {
      assert.equal(out.split(from).length - 1, times, `${name} ${file}:${n} "${from}"`);
      assert.ok(BLOCK_SCOPE[name]!.tokens.includes(tokenOf(to)), `${name} ${file}:${n}: ${to} no pertenece al bloque`);
      out = out.split(from).join(to);
      totals[name] = (totals[name] ?? 0) + times;
    }
    assert.equal(out, migrated, `${name} ${file}:${n}`);
    assert.equal(restoreLine(migrated, replacements, tokenValues()), original, `${name} ${file}:${n}`);
  }
  for (const { name } of blocks) assert.equal(totals[name], BLOCK_SCOPE[name]!.total, name);
});

test('mutación: alterar cualquier sombra migrada rompe la equivalencia de cada archivo que la usa', () => {
  const current = tokenValues();
  for (const { name, fixture } of blocks) {
    for (const token of BLOCK_SCOPE[name]!.tokens) {
      // Cambia el último dígito del valor (alfa de una sombra, parada de un degradado).
      const mutated = { ...current, [token]: current[token]!.replace(/(\d)(?!.*\d)/, (d) => (d === '9' ? '8' : String(Number(d) + 1))) };
      assert.notEqual(mutated[token], current[token]);
      let checked = 0;
      for (const [file, entry] of Object.entries(fixture.files)) {
        if (!Object.values(entry.lines).some((line) => line.replacements.some(({ to }) => tokenOf(to) === token))) continue;
        assert.notEqual(restoredSha(name, file, entry, mutated), entry.headSha256, `${file} debe detectar la mutación de ${token}`);
        checked++;
      }
      assert.ok(checked > 0, `${token} se usa en ${name}`);
    }
  }
});

test('seguimiento de marca: con otro grafito, tinta o azul, solo dejan de reproducir HEAD los archivos que usan esa familia', () => {
  const current = tokenValues();
  for (const overrides of [{ graphite: '#102030' }, { ink: '#405060' }, { blue: '#708090' }]) {
    const values = tokenValues(brandLayers(alternateBrand(overrides)));
    // Las capas estructurales no cambian con la marca.
    for (const [token, value] of Object.entries(values)) {
      if (token.startsWith('elevation.') || token.startsWith('surfaceGradients.')) assert.equal(value, current[token], token);
    }
    let moved = 0;
    for (const { name, fixture } of blocks) {
      for (const [file, entry] of Object.entries(fixture.files)) {
        const tokens = Object.values(entry.lines).flatMap((line) => line.replacements.map(({ to }) => tokenOf(to)));
        const moves = tokens.some((token) => values[token] !== current[token]);
        const sha = restoredSha(name, file, entry, values);
        if (moves) assert.notEqual(sha, entry.headSha256, `${name} ${file} debe seguir a ${JSON.stringify(overrides)}`);
        else assert.equal(sha, entry.headSha256, `${name} ${file} no depende de ${JSON.stringify(overrides)}`);
        if (moves) moved++;
      }
    }
    assert.ok(moved > 0, `${JSON.stringify(overrides)} mueve al menos un archivo`);
  }
});

test('cierre: no quedan escritas a mano las sombras migradas y el resto conserva sus usos de HEAD', () => {
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
  const migrated = migratedTokens();
  for (const [layer, section] of LAYERS) {
    for (const [key, { value, headOccurrences }] of Object.entries(baseline[section])) {
      const token = `${layer}.${key}`;
      // `updateBarEnd` es un color suelto, no un literal de sombra o degradado: lo cubre `brandGradients.updateBar`.
      if (token === 'surfaceGradients.updateBarEnd') continue;
      assert.equal(count(value), migrated.includes(token) ? 0 : headOccurrences, token);
    }
  }
  // Con E1–E4 no queda ninguna sombra ni degradado de la auditoría escrito a mano.
  assert.deepEqual(
    LAYERS.flatMap(([layer, section]) => Object.keys(baseline[section]).map((key) => `${layer}.${key}`)).filter(
      (token) => token !== 'surfaceGradients.updateBarEnd' && !migrated.includes(token),
    ),
    [],
  );
});
