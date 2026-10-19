import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import * as functional from './functional.ts';
import * as structural from './structural.ts';
import {
  LATER_FIXTURES,
  LEFTOVER_ORDER,
  revertLater,
  revertMinor,
  type LaterFixtures,
  type MinorFileFixture,
} from './__fixtures__/colorMigrations.ts';

const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

type Replacement = { from: string; to: string; times: number };
type LeftoverFileFixture = MinorFileFixture & {
  lines: Record<string, MinorFileFixture['lines'][string] & { replacements: Replacement[]; importMerge?: boolean }>;
};
type LeftoverFixture = { source: string; files: Record<string, LeftoverFileFixture> };

const blocks = LEFTOVER_ORDER.map((name) => ({ name, fixture: JSON.parse(readText(`./__fixtures__/${name}`)) as LeftoverFixture }));
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

/**
 * Familias que R1 puede usar, con su capa (ver docs/white-label-restos-r1-audit.md).
 * Ninguna depende de la marca.
 */
const ROOTS = {
  alertColors: functional.alertColors,
  fiscalStatusColors: functional.fiscalStatusColors,
  crmAccents: functional.crmAccents,
  leadFilterChipColors: functional.leadFilterChipColors,
  searchHighlightColors: functional.searchHighlightColors,
  activityRailTones: functional.activityRailTones,
  authorizationModeColors: functional.authorizationModeColors,
  inventoryAffectationColors: functional.inventoryAffectationColors,
  alertRowColors: functional.alertRowColors,
  cartaPorteSectionColors: functional.cartaPorteSectionColors,
  neutralColors: structural.neutralColors,
  selectionColors: structural.selectionColors,
  rowStripeColors: structural.rowStripeColors,
} as const;
type Roots = Record<string, unknown>;
const currentRoots = (): Roots => structuredClone(ROOTS) as Roots;

const TOKEN = new RegExp(`\\b(?:${Object.keys(ROOTS).join('|')})(?:\\.\\w+|\\[\\d+\\])+`, 'g');
const resolve = (token: string, roots: Roots): string => {
  const path = [...token.matchAll(/(\w+)|\[(\d+)\]/g)].map(([, key, index]) => (key ?? index)!);
  const value = path.reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], roots);
  if (typeof value !== 'string') throw new Error(`${token} no resuelve a un color`);
  return value;
};
/**
 * Fragmento migrado → fragmento original: cada token vuelve a `'<hex>'`; en una
 * plantilla (`` `1px solid ${token}` ``) vuelve a `'1px solid <hex>'`.
 */
const sourceOf = (to: string, roots: Roots) =>
  to.startsWith('`')
    ? `'${to.slice(1, -1).replace(new RegExp(`\\$\\{(${TOKEN.source})\\}`, 'g'), (_m, token: string) => resolve(token, roots))}'`
    : to.replace(TOKEN, (token) => `'${resolve(token, roots)}'`);
const restoreLine = (migrated: string, replacements: Replacement[], roots: Roots) =>
  replacements.reduce((line, { to }) => line.split(to).join(sourceOf(to, roots)), migrated);
const restoredSha = (name: string, file: string, entry: LeftoverFileFixture, roots: Roots) => {
  const lines = Object.fromEntries(
    Object.entries(entry.lines).map(([n, line]) => [n, line.importMerge ? line : { ...line, original: restoreLine(line.migrated, line.replacements, roots) }]),
  );
  return sha256(revertMinor(asOfBlock(name, file), { ...entry, lines }));
};

/** Literales y reemplazos de cada subbloque. */
const BLOCK_SCOPE: Record<string, { literals: number; files: number }> = {
  'restos.r1-1.baseline.json': { literals: 30, files: 11 },
  'restos.r1-2.baseline.json': { literals: 16, files: 9 },
};

test('cada subbloque tiene alcance declarado', () => {
  assert.deepEqual(Object.keys(BLOCK_SCOPE), [...LEFTOVER_ORDER]);
  for (const { name, fixture } of blocks) {
    assert.equal(Object.keys(fixture.files).length, BLOCK_SCOPE[name]!.files, name);
    const literals = Object.values(fixture.files)
      .flatMap((entry) => Object.values(entry.lines))
      .flatMap((line) => line.replacements)
      .reduce((sum, { from, times }) => sum + (from.match(/#[0-9a-fA-F]{6}/g)?.length ?? 0) * times, 0);
    assert.equal(literals, BLOCK_SCOPE[name]!.literals, name);
  }
});

test('equivalencia contra HEAD: restaurar cada archivo reproduce el previo byte a byte', () => {
  for (const { name, fixture } of blocks) {
    for (const [file, entry] of Object.entries(fixture.files)) {
      assert.equal(sha256(revertMinor(asOfBlock(name, file), entry)), entry.headSha256, `${name} ${file}`);
    }
  }
});

test('transformación: cada token resuelve exactamente al literal que reemplazó', () => {
  const roots = currentRoots();
  for (const { name, file, n, original, migrated, replacements, importMerge } of allLines()) {
    if (importMerge) {
      const names = (line: string) => /^import \{ ([^}]+) \} from '([^']+)';$/.exec(line)!;
      const [, before, mod] = names(original);
      const [, after, modAfter] = names(migrated);
      assert.equal(modAfter, mod, `${name} ${file}:${n}`);
      for (const x of before!.split(', ')) assert.ok(after!.split(', ').includes(x), `${name} ${file}:${n} perdió ${x}`);
      continue;
    }
    let out = original;
    for (const { from, to, times } of replacements) {
      assert.equal(out.split(from).length - 1, times, `${name} ${file}:${n} "${from}"`);
      assert.equal(sourceOf(to, roots), from, `${name} ${file}:${n}: ${to} reproduce "${from}"`);
      out = out.split(from).join(to);
    }
    assert.equal(out, migrated, `${name} ${file}:${n}`);
  }
});

test('mutación: alterar cualquier valor usado rompe la equivalencia de cada archivo que lo usa', () => {
  const used = new Set(allLines().flatMap(({ replacements }) => replacements.flatMap(({ to }) => to.match(TOKEN) ?? [])));
  assert.ok(used.size > 0);
  for (const token of used) {
    const roots = currentRoots();
    const path = [...token.matchAll(/(\w+)|\[(\d+)\]/g)].map(([, key, index]) => (key ?? index)!);
    const parent = path.slice(0, -1).reduce<Record<string, unknown>>((node, key) => node[key] as Record<string, unknown>, roots);
    const value = parent[path.at(-1)!] as string;
    parent[path.at(-1)!] = `${value.slice(0, -1)}${value.endsWith('0') ? '1' : '0'}`;
    let checked = 0;
    for (const { name, fixture } of blocks) {
      for (const [file, entry] of Object.entries(fixture.files)) {
        if (!Object.values(entry.lines).some((line) => line.replacements.some(({ to }) => (to.match(TOKEN) ?? []).includes(token)))) continue;
        assert.notEqual(restoredSha(name, file, entry, roots), entry.headSha256, `${file} debe detectar la mutación de ${token}`);
        checked++;
      }
    }
    assert.ok(checked > 0, token);
  }
});

test('R1.1: mismos valores con otros significados quedan en tokens separados', () => {
  // Importe CRM (teal-700) ≠ impuesto del resumen de documentos, aunque compartan `#0f766e`.
  assert.equal(functional.crmAccents.amount, functional.documentSummaryTones.tax);
  // Texto y fondo activo del chip de leads: mismo valor, dos roles.
  assert.equal(functional.leadFilterChipColors.foreground, functional.leadFilterChipColors.activeBackground);
  // Fila vencida y bajo mínimo: mismo valor, dos roles.
  assert.equal(functional.alertRowColors.overdue, functional.alertRowColors.belowMinimum);
  // Coincidencia actual del buscador ≠ estado borrador, aunque compartan `#facc15`.
  assert.equal(functional.searchHighlightColors.current, '#facc15');
  // El chip fiscal del resumen flotante es el mismo chip que el de DocumentosFormPage: reutiliza su familia.
  assert.deepEqual(
    { ...functional.fiscalStatusColors },
    {
      completeBackground: '#e8f4ee',
      completeText: '#1c6b47',
      incompleteBackground: '#fdf3e3',
      incompleteText: '#9a5b00',
      completeBorder: '#c9e3d5',
      incompleteBorder: '#ecd9b4',
    },
  );
  assert.equal(functional.alertColors.error[900], '#7f1d1d');
});

test('R1.2: superficies y categóricos con rol propio; solo se reutiliza un token cuando el rol es el mismo', () => {
  // La barra fija `top: 72` de la vista móvil es el mismo rol que la barra fija de DocumentosFormPage.
  assert.equal(structural.neutralColors.steel.wash, '#eef1f4');
  // Mismo rol (borde del panel de filtros), valores distintos: no se unifican.
  assert.notEqual(structural.neutralColors.steel.documentFiltersBorder, structural.neutralColors.steel.opportunityFiltersBorder);
  assert.deepEqual({ ...structural.rowStripeColors }, { treasuryDocuments: '#f4faf4', kardex: '#f8f8ff' });
  assert.deepEqual(
    { ...functional.cartaPorteSectionColors },
    { ruta: '#e4eef6', unidad: '#e5f0e8', operador: '#f8efe4', generales: '#f3ecf6', mercancias: '#e8f2f0' },
  );
  assert.equal(structural.selectionColors.chipSurface, '#e8eefc');
});

test('las capas de R1 no dependen de la marca', () => {
  for (const file of ['./functional.ts', './structural.ts']) assert.ok(!/from '\.\/brand\//.test(readText(file)), file);
  assert.ok(structural.neutralColors);
});

test('cierre: los literales migrados de cada subbloque ya no aparecen en sus archivos', () => {
  for (const { name, fixture } of blocks) {
    for (const [file, entry] of Object.entries(fixture.files)) {
      const source = readText(`../${file}`);
      for (const { from } of Object.values(entry.lines).flatMap((line) => line.replacements)) {
        assert.equal(source.split(from).length - 1, 0, `${name} ${file}: quedó "${from}"`);
      }
    }
  }
});
