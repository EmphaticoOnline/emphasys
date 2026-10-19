import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { activeBrand } from './brand/active.ts';
import { emphasysBrand } from './brand/emphasys.ts';
import { neutralColors } from './structural.ts';
import {
  currentNeutralSources,
  resolveNeutralToken,
  revertNeutral,
  tokenPath,
  type NeutralFixture,
  type NeutralSources,
} from './__fixtures__/neutralRevert.ts';
import { DOCUMENTOS_FORM_ORDER, LATER_FIXTURES, NEUTRAL_ORDER, revertLater, type LaterFixtures } from './__fixtures__/colorMigrations.ts';

const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** Un fixture por bloque funcional: compartidos, CFDI SAT, documentos, tesorería… */
const fixtureNames = readdirSync(new URL('./__fixtures__/', import.meta.url)).filter((name) =>
  /^neutralColors.*\.baseline\.json$/.test(name),
);
const fixtures: Record<string, NeutralFixture> = Object.fromEntries(
  fixtureNames.map((name) => [name, JSON.parse(readText(`./__fixtures__/${name}`))]),
);
const laterFixtures: LaterFixtures = Object.fromEntries(
  LATER_FIXTURES
    .filter((name) => existsSync(new URL(`./__fixtures__/${name}`, import.meta.url)))
    .map((name) => [name, JSON.parse(readText(`./__fixtures__/${name}`))]),
);
/** El archivo tal como lo dejó su bloque neutral: sin los bloques posteriores. */
const asOfBlock = (block: string, file: string) => revertLater(block, file, readText(`../${file}`), laterFixtures);

const files = () =>
  Object.entries(fixtures).flatMap(([block, fixture]) =>
    Object.entries(fixture.files).map(([file, data]) => ({ block, file, ...data })),
  );

test('cada bloque neutral tiene fixture y ningún archivo pertenece a dos bloques', () => {
  assert.deepStrictEqual([...fixtureNames].sort(), [...NEUTRAL_ORDER].sort(), 'NEUTRAL_ORDER debe listar todos los fixtures');
  const seen = new Map<string, string>();
  for (const { block, file } of files()) {
    assert.ok(!seen.has(file), `${file} está en ${seen.get(file)} y en ${block}`);
    seen.set(file, block);
  }
});

test('cada token resuelve exactamente al literal que reemplazó', () => {
  for (const { block, file, lines } of files()) {
    for (const [line, list] of Object.entries(lines)) {
      for (const { hex, token } of list) assert.equal(resolveNeutralToken(token).toLowerCase(), hex, `${block} ${file}:${line} ${token}`);
    }
  }
});

test('equivalencia contra HEAD: revertir reproduce cada archivo byte a byte', () => {
  for (const { block, file, headSha256, addedImports } of files()) {
    assert.equal(sha256(revertNeutral(asOfBlock(block, file), addedImports)), headSha256, `${block} ${file}`);
  }
});

test('mutación: alterar cualquier valor usado rompe la equivalencia', () => {
  const used = new Set(files().flatMap(({ lines }) => Object.values(lines).flat().map((e) => e.token)));
  for (const token of used) {
    const mutated = structuredClone(currentNeutralSources) as NeutralSources;
    const { root, keys } = tokenPath(token);
    const parent = keys
      .slice(0, -1)
      .reduce<Record<string, unknown>>((node, key) => node[key] as Record<string, unknown>, mutated[root] as Record<string, unknown>);
    const value = parent[keys.at(-1)!] as string;
    parent[keys.at(-1)!] = `${value.slice(0, -1)}${value.endsWith('0') ? '1' : '0'}`;
    for (const { block, file, headSha256, addedImports, lines } of files()) {
      if (!Object.values(lines).flat().some((e) => e.token === token)) continue;
      assert.notEqual(sha256(revertNeutral(asOfBlock(block, file), addedImports, mutated)), headSha256, `${block} ${file} no detectó ${token}`);
    }
  }
});

test('en los archivos migrados solo quedan los literales excluidos a propósito', () => {
  for (const { block, file, lines, keptLiteral } of files()) {
    const hexes = new Set(Object.values(lines).flat().map((e) => e.hex));
    const remaining: Record<string, number> = {};
    // Estado que dejó el bloque neutral: los bloques posteriores (p. ej. degradados E4) pueden migrar estos literales.
    for (const [hex] of asOfBlock(block, file).matchAll(/#[0-9a-fA-F]{6}/g)) {
      const value = hex.toLowerCase();
      if (hexes.has(value)) remaining[value] = (remaining[value] ?? 0) + 1;
    }
    assert.deepStrictEqual(remaining, keptLiteral, `${block} ${file}`);
  }
  // Degradado decorativo de VersionUpdateDrawer: quedó para el bloque de degradados (elevación E4, `brandGradients.updateBar`).
  assert.deepStrictEqual(fixtures['neutralColors.baseline.json']?.files['components/VersionUpdateDrawer.tsx']?.keptLiteral, {
    '#1d2f68': 1,
  });
});

test('el azul y el acento escritos a mano salen de la marca activa', () => {
  assert.equal(activeBrand.colors.blue.base, '#1d2f68');
  assert.equal(activeBrand.colors.blue.hover, '#162551');
  assert.equal(activeBrand.colors.accent, '#006261');
  const brandValues = new Set([emphasysBrand.colors.blue.base, emphasysBrand.colors.blue.hover, emphasysBrand.colors.accent]);
  const brandTokens = files().flatMap(({ lines }) => Object.values(lines).flat()).filter((e) => e.token.startsWith('activeBrand'));
  assert.ok(brandTokens.length > 0);
  for (const { hex } of brandTokens) assert.ok(brandValues.has(hex));
});

test('los neutrales estructurales no dependen de la marca ni coinciden con ella', () => {
  assert.ok(!/from '\.\/brand\//.test(readText('./structural.ts')), 'structural.ts no debe importar la marca');
  const brandValues = new Set(JSON.stringify(emphasysBrand.colors).match(/#[0-9a-f]{6}/g));
  for (const value of JSON.stringify(neutralColors).match(/#[0-9a-f]{6}/g) ?? []) {
    assert.ok(!brandValues.has(value), `${value} no debe venir de la marca`);
  }
  const values = JSON.stringify(neutralColors).match(/#[0-9a-f]{6}/g) ?? [];
  assert.equal(new Set(values).size, values.length, 'neutralColors no repite valores');
});

test('cada valor de neutralColors se usa en al menos un bloque', () => {
  const used = new Set(files().flatMap(({ lines }) => Object.values(lines).flat().map((e) => e.token)));
  // Los subbloques de DocumentosFormPage también consumen neutralColors (roles propios del formulario).
  for (const name of DOCUMENTOS_FORM_ORDER) {
    const fixture = JSON.parse(readText(`./__fixtures__/${name}`)) as { files: Record<string, { lines: Record<string, { entries: { token: string }[] }> }> };
    for (const entry of Object.values(fixture.files)) for (const line of Object.values(entry.lines)) for (const e of line.entries) used.add(e.token);
  }
  for (const [family, scale] of Object.entries(neutralColors)) {
    for (const key of Object.keys(scale)) {
      const token = family === 'steel' ? `neutralColors.steel.${key}` : `neutralColors.${family}[${key}]`;
      assert.ok(used.has(token), `${token} no se usa`);
    }
  }
});

test('legado y colores de BD quedan fuera; DocumentosFormPage va en sus propios subbloques', () => {
  const migrated = new Set(files().map(({ file }) => file));
  for (const file of [
    'components/Sidebar.tsx',
    'components/SecondaryNav.tsx',
    'components/Layout.tsx',
    'components/Menu.tsx',
    'pages/configuracion/FormatosImpresionPage.tsx',
    'pages/ConfiguracionEtapasProduccionPage.tsx',
  ]) {
    assert.ok(!migrated.has(file), `${file} no se migra`);
  }
  assert.ok(readText('../components/DynamicFieldControl.tsx').includes("const COLOR_POR_DEFECTO = '#000000';"));
  // DocumentosFormPage no entra en los bloques neutrales: se migra por subbloques propios.
  assert.ok(!migrated.has('pages/DocumentosFormPage.tsx'));
  assert.ok(DOCUMENTOS_FORM_ORDER.length >= 1);
});
