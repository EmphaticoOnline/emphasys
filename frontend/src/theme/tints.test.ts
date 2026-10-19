import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { brandBlueAlpha, rgbaFromHex } from './brand/derived.ts';
import { rgbaFromHex as neutralRgbaFromHex } from './color.ts';
import { emphasysBrand } from './brand/emphasys.ts';
import type { BrandDefinition } from './brand/types.ts';
import { alertColors, alertTints, environmentColors } from './functional.ts';
import { brandTints, buildBrandTints, type BrandTints } from './tints.ts';
import {
  LATER_FIXTURES,
  revertLater,
  revertMinor,
  TINT_ORDER,
  type LaterFixtures,
  type MinorFileFixture,
} from './__fixtures__/colorMigrations.ts';

const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** HEAD 2a96ab6: valor exacto de cada tinte y cuántas veces aparecía escrito a mano. */
const baseline = JSON.parse(readText('./__fixtures__/tints.baseline.json')) as {
  brand: Record<string, { value: string; headOccurrences: number }>;
  /** Tintes funcionales (T2), por token completo. */
  functional: Record<string, { value: string; headOccurrences: number }>;
};

type Replacement = { from: string; to: string; times: number };
type TintFileFixture = MinorFileFixture & {
  lines: Record<string, MinorFileFixture['lines'][string] & { replacements: Replacement[]; importMerge?: boolean }>;
};
type TintFixture = { source: string; files: Record<string, TintFileFixture> };

const blocks = TINT_ORDER.map((name) => ({ name, fixture: JSON.parse(readText(`./__fixtures__/${name}`)) as TintFixture }));
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

/** Tokens y reemplazos de cada bloque (ver docs/white-label-tintes-alfa-audit.md §4). */
const BLOCK_SCOPE: Record<string, { tokens: (token: string) => boolean; total: number }> = {
  'tints.t1.baseline.json': { tokens: (token) => token.startsWith('brandTints.'), total: 17 },
  'tints.t2.baseline.json': {
    tokens: (token) => ['alertTints.errorHover', 'environmentColors.defaultBackground', 'environmentColors.defaultBorder'].includes(token),
    total: 4,
  },
};

/** Familia de marca de la que deriva cada tinte. */
const FAMILY: Record<keyof BrandTints, 'blue' | 'beige' | 'accent'> = {
  focusRow: 'blue',
  focusRowSelected: 'blue',
  focusRowSelectedHover: 'blue',
  focusRowBorder: 'blue',
  focusPulseEnd: 'blue',
  gridRowSelected: 'blue',
  gridRowSelectedHover: 'blue',
  activeItem: 'blue',
  activeItemHover: 'blue',
  drawerBorder: 'blue',
  iconWash: 'blue',
  noteSurface: 'blue',
  outlineButtonBorder: 'blue',
  onChromeSeparator: 'beige',
  onChromeMutedIcon: 'beige',
  accentWash: 'accent',
};

/** Token completo (`brandTints.focusRow`, `alertTints.errorHover`) → valor. */
type TokenValues = Record<string, string>;
const tokenValues = (brand: BrandTints = brandTints): TokenValues => ({
  ...Object.fromEntries(Object.entries(brand).map(([key, value]) => [`brandTints.${key}`, value])),
  'alertTints.errorHover': alertTints.errorHover,
  'environmentColors.defaultBackground': environmentColors.defaultBackground,
  'environmentColors.defaultBorder': environmentColors.defaultBorder,
});
const brandKey = (token: string) => (token.startsWith('brandTints.') ? (token.slice('brandTints.'.length) as keyof BrandTints) : null);

/**
 * Reemplazo → texto original, con los valores dados: `brandTints.x` vuelve a
 * `'<valor>'` y `` `1px solid ${brandTints.x}` `` vuelve a `'1px solid <valor>'`.
 */
const tokenOf = (to: string) => /(?:brandTints|alertTints|environmentColors)\.\w+/.exec(to)![0];
const sourceOf = (to: string, values: TokenValues) => {
  const token = tokenOf(to);
  if (!(token in values)) throw new Error(`Token de tinte desconocido: ${token}`);
  return to.startsWith('`') ? `'${to.slice(1, -1).replace(`\${${token}}`, values[token]!)}'` : `'${values[token]}'`;
};
const restoreLine = (migrated: string, replacements: Replacement[], values: TokenValues) =>
  replacements.reduce((line, { to }) => line.split(to).join(sourceOf(to, values)), migrated);
const restoredSha = (name: string, file: string, entry: TintFileFixture, values: TokenValues) => {
  const lines = Object.fromEntries(
    Object.entries(entry.lines).map(([n, line]) => [n, line.importMerge ? line : { ...line, original: restoreLine(line.migrated, line.replacements, values) }]),
  );
  return sha256(revertMinor(asOfBlock(name, file), { ...entry, lines }));
};

const alternateBrand = (overrides: Partial<{ blue: string; beige: string; accent: string }>): BrandDefinition => {
  const brand = structuredClone(emphasysBrand);
  if (overrides.blue) brand.colors.blue.base = overrides.blue;
  if (overrides.beige) brand.colors.beige.base = overrides.beige;
  if (overrides.accent) brand.colors.accent = overrides.accent;
  return brand;
};

test('rgbaFromHex conserva el formato previo y admite alfa literal y formato compacto', () => {
  assert.equal(rgbaFromHex('#1d2f68', 0.06), 'rgba(29, 47, 104, 0.06)');
  assert.equal(brandBlueAlpha(0.06), 'rgba(29, 47, 104, 0.06)');
  assert.equal(rgbaFromHex('#1d2f68', '0.10'), 'rgba(29, 47, 104, 0.10)');
  assert.equal(rgbaFromHex('#1d2f68', 0.1), 'rgba(29, 47, 104, 0.1)');
  assert.equal(rgbaFromHex('#1d2f68', '0.05', 'compact'), 'rgba(29,47,104,0.05)');
  assert.throws(() => rgbaFromHex('#1d2f68', '10%'));
});

test('paridad: cada tinte reproduce byte a byte el literal de HEAD, con su formato', () => {
  assert.deepEqual(Object.keys(brandTints).sort(), Object.keys(baseline.brand).sort());
  assert.deepEqual(Object.keys(FAMILY).sort(), Object.keys(brandTints).sort());
  for (const [key, { value, headOccurrences }] of Object.entries(baseline.brand)) {
    assert.equal(brandTints[key as keyof BrandTints], value, key);
    assert.ok(headOccurrences > 0, `${key} debe venir de un literal real`);
  }
  assert.deepEqual(buildBrandTints(emphasysBrand), brandTints);
});

test('paridad T2: los tintes funcionales reproducen el literal de HEAD y no dependen de la marca', () => {
  const values = tokenValues();
  assert.deepEqual(Object.keys(baseline.functional).sort(), ['alertTints.errorHover', 'environmentColors.defaultBackground', 'environmentColors.defaultBorder']);
  for (const [token, { value, headOccurrences }] of Object.entries(baseline.functional)) {
    assert.equal(values[token], value, token);
    assert.ok(headOccurrences > 0, `${token} debe venir de un literal real`);
  }
  // El hover destructivo se deriva del tono de error que acompaña (texto error[600] / [700]).
  assert.equal(alertTints.errorHover, rgbaFromHex(alertColors.error[600], '0.08'));
  // El helper neutro es el mismo que reexporta la capa de marca: functional.ts no importa la marca.
  assert.equal(neutralRgbaFromHex, rgbaFromHex);
  assert.ok(!/from '\.\/brand\//.test(readText('./functional.ts')));
  assert.ok(!/from '\.\/brand\//.test(readText('./color.ts')) && !/from '\.\/brand|from '\.\.\/brand/.test(readText('./color.ts')));
});

test('sin unificación: los valores repetidos son roles distintos declarados', () => {
  const groups: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(brandTints)) (groups[value] ??= []).push(key);
  const shared = Object.values(groups)
    .filter((keys) => keys.length > 1)
    .map((keys) => keys.sort())
    .sort();
  assert.deepEqual(shared, [
    ['activeItemHover', 'gridRowSelected', 'iconWash'],
    ['drawerBorder', 'focusRowSelected'],
    ['focusPulseEnd', 'focusRow'],
  ]);
});

test('marca alternativa: solo cambia la familia de marca de cada tinte, con el mismo formato y alfa', () => {
  const shape = (value: string) => value.replace(/\d+(, ?)\d+(, ?)\d+(, ?)/, 'R$1G$2B$3');
  for (const [family, overrides] of [
    ['blue', { blue: '#708090' }],
    ['beige', { beige: '#e0d0c0' }],
    ['accent', { accent: '#123456' }],
  ] as const) {
    const alt = buildBrandTints(alternateBrand(overrides));
    for (const key of Object.keys(brandTints) as (keyof BrandTints)[]) {
      if (FAMILY[key] === family) {
        assert.notEqual(alt[key], brandTints[key], `${key} debe seguir a ${family}`);
        assert.equal(shape(alt[key]), shape(brandTints[key]), `${key} conserva formato y alfa`);
      } else {
        assert.equal(alt[key], brandTints[key], `${key} no depende de ${family}`);
      }
    }
  }
  const alt = buildBrandTints(alternateBrand({ blue: '#708090', beige: '#e0d0c0', accent: '#123456' }));
  assert.equal(alt.focusRow, 'rgba(112, 128, 144, 0.10)');
  assert.equal(alt.noteSurface, 'rgba(112,128,144,0.05)');
  assert.equal(alt.onChromeMutedIcon, 'rgba(224,208,192,0.72)');
  assert.equal(alt.accentWash, 'rgba(18,52,86,0.1)');
});

test('equivalencia contra HEAD: restaurar cada archivo reproduce el previo byte a byte', () => {
  for (const { name, fixture } of blocks) {
    for (const [file, entry] of Object.entries(fixture.files)) {
      assert.equal(sha256(revertMinor(asOfBlock(name, file), entry)), entry.headSha256, `${name} ${file}`);
    }
  }
});

test('transformación: cada línea es su original con los reemplazos declarados, y vuelve con los valores actuales', () => {
  const totals: Record<string, number> = {};
  const values = tokenValues();
  for (const { name, file, n, original, migrated, replacements, importMerge } of allLines()) {
    if (importMerge) {
      // Import fusionado (T2): mismo módulo funcional, conserva los nombres previos.
      const names = (line: string) => /^import \{ ([^}]+) \} from '([^']+)';$/.exec(line)!;
      const [, before, mod] = names(original);
      const [, after, modAfter] = names(migrated);
      assert.equal(modAfter, mod, `${name} ${file}:${n}`);
      assert.match(mod!, /theme\/functional$/);
      for (const x of before!.split(', ')) assert.ok(after!.split(', ').includes(x), `${name} ${file}:${n} perdió ${x}`);
      continue;
    }
    let out = original;
    for (const { from, to, times } of replacements) {
      assert.equal(out.split(from).length - 1, times, `${name} ${file}:${n} "${from}"`);
      assert.ok(BLOCK_SCOPE[name]!.tokens(tokenOf(to)), `${name} ${file}:${n}: ${to} no pertenece al bloque`);
      assert.equal(sourceOf(to, values), from, `${name} ${file}:${n}: ${to} reproduce "${from}"`);
      out = out.split(from).join(to);
      totals[name] = (totals[name] ?? 0) + times;
    }
    assert.equal(out, migrated, `${name} ${file}:${n}`);
    assert.equal(restoreLine(migrated, replacements, values), original, `${name} ${file}:${n}`);
  }
  for (const { name } of blocks) assert.equal(totals[name], BLOCK_SCOPE[name]!.total, name);
});

test('mutación: alterar el valor o el formato de un tinte rompe la equivalencia de cada archivo que lo usa', () => {
  const mutations = (value: string) => [
    value.replace(/(\d)(?!.*\d)/, (d) => (d === '9' ? '8' : String(Number(d) + 1))),
    value.includes(', ') ? value.replace(/, /g, ',') : value.replace(/,/g, ', '),
  ];
  const current = tokenValues();
  for (const { name, fixture } of blocks) {
    for (const token of Object.keys(current).filter(BLOCK_SCOPE[name]!.tokens)) {
      let checked = 0;
      for (const mutatedValue of mutations(current[token]!)) {
        const values = { ...current, [token]: mutatedValue };
        for (const [file, entry] of Object.entries(fixture.files)) {
          if (!Object.values(entry.lines).some((line) => line.replacements.some(({ to }) => tokenOf(to) === token))) continue;
          assert.notEqual(restoredSha(name, file, entry, values), entry.headSha256, `${file} debe detectar la mutación de ${token}`);
          checked++;
        }
      }
      assert.ok(checked > 0, `${token} se usa en ${name}`);
    }
  }
  // Alfa normalizada: '0.10' → '0.1' también se detecta.
  assert.notEqual(rgbaFromHex(emphasysBrand.colors.blue.base, 0.1), brandTints.focusRow);
});

test('seguimiento de marca: con otro azul, beige o acento, solo dejan de reproducir HEAD los archivos que usan esa familia', () => {
  for (const [family, overrides] of [
    ['blue', { blue: '#708090' }],
    ['beige', { beige: '#e0d0c0' }],
    ['accent', { accent: '#123456' }],
  ] as const) {
    // Solo los tintes de marca se reconstruyen con la otra marca; los funcionales (T2) no participan.
    const values = tokenValues(buildBrandTints(alternateBrand(overrides)));
    let moved = 0;
    for (const { name, fixture } of blocks) {
      for (const [file, entry] of Object.entries(fixture.files)) {
        const families = Object.values(entry.lines).flatMap((line) =>
          line.replacements.map(({ to }) => {
            const key = brandKey(tokenOf(to));
            return key ? FAMILY[key] : null;
          }),
        );
        const sha = restoredSha(name, file, entry, values);
        if (families.includes(family)) {
          assert.notEqual(sha, entry.headSha256, `${file} debe seguir a ${family}`);
          moved++;
        } else {
          assert.equal(sha, entry.headSha256, `${name} ${file} no depende de ${family}`);
        }
      }
    }
    assert.ok(moved > 0, family);
  }
});

test('cierre: no quedan tintes de marca ni funcionales de T1–T2 escritos a mano fuera del legado', () => {
  const root = new URL('../', import.meta.url);
  const files: string[] = [];
  const walk = (dir: URL, rel: string) => {
    for (const name of readdirSync(dir)) {
      const path = `${rel}${name}`;
      if (['dev-mockups', 'theme', 'compass', 'node_modules'].includes(name) && rel === '') continue;
      if (statSync(new URL(name, dir)).isDirectory()) walk(new URL(`${name}/`, dir), `${path}/`);
      else if (/\.(tsx?|css)$/.test(name)) files.push(path);
    }
  };
  walk(root, '');
  const legacy = ['components/Layout.tsx', 'components/Menu.tsx'];
  const occurrences = (pattern: RegExp | string) =>
    files.flatMap((file) => {
      const text = readText(`../${file}`);
      const n = typeof pattern === 'string' ? text.split(pattern).length - 1 : [...text.matchAll(pattern)].length;
      return Array.from({ length: n }, () => file);
    });
  // T1: solo el legado conserva sus dos azules con alfa (fuera del alcance white label).
  const brandRgba = occurrences(/rgba\(\s*(?:29,\s*47,\s*104|244,\s*240,\s*232|0,\s*98,\s*97)\s*,/g);
  assert.deepEqual(brandRgba.sort(), ['components/Menu.tsx', 'components/Menu.tsx']);
  assert.ok(brandRgba.every((file) => legacy.includes(file)));
  // T2: el hover destructivo y el borde del entorno ya no aparecen escritos a mano.
  assert.deepEqual(occurrences(alertTints.errorHover), []);
  assert.deepEqual(occurrences(environmentColors.defaultBorder), []);
  // Mismo valor que el fondo del entorno, otro rol (brillo de pestaña): queda para T3.
  assert.deepEqual(occurrences(environmentColors.defaultBackground), ['components/layout/moduleTabBar.ts']);
});
