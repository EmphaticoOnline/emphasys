import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { revertNeutralFor, type NeutralFixture } from './__fixtures__/neutralRevert.ts';
import { emphasysBrand } from './brand/emphasys.ts';
import { accountingColors, alertColors } from './functional.ts';

const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

/** Bloques de neutrales posteriores que también tocan estos archivos: se revierten primero. */
const neutralFixtures: NeutralFixture[] = readdirSync(new URL('./__fixtures__/', import.meta.url))
  .filter((name) => /^neutralColors.*\.baseline\.json$/.test(name))
  .map((name) => JSON.parse(readText(`./__fixtures__/${name}`)));
const withoutNeutral = (file: string) => revertNeutralFor(file, readText(`../${file}`), neutralFixtures);

type Entry = { hex: string; token: string };
/** Literales por línea en HEAD (2af87e7) y el token que reemplaza a cada uno. */
const baseline: {
  files: Record<string, { lines: Record<string, Entry[]>; keptLiteral: Record<string, number> }>;
} = JSON.parse(readText('./__fixtures__/accountingColors.baseline.json'));

const resolveToken = (token: string): string => {
  const value = token
    .replace(/^accountingColors\./, '')
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], accountingColors);
  assert.equal(typeof value, 'string', `${token} no existe`);
  return value as string;
};

const count = (items: string[]) =>
  items.reduce<Record<string, number>>((acc, item) => ((acc[item] = (acc[item] ?? 0) + 1), acc), {});

test('cada token contable resuelve exactamente al literal que reemplazó', () => {
  for (const [file, { lines }] of Object.entries(baseline.files)) {
    for (const [line, entries] of Object.entries(lines)) {
      for (const { hex, token } of entries) assert.equal(resolveToken(token), hex, `${file}:${line} ${token}`);
    }
  }
});

test('cada archivo usa los tokens contables tantas veces como literales tenía', () => {
  for (const [file, { lines }] of Object.entries(baseline.files)) {
    const source = readText(`../${file}`);
    const expected = count(Object.values(lines).flat().map((entry) => entry.token));
    const actual = count([...source.matchAll(/accountingColors\.[a-zA-Z]+(?:\.[a-zA-Z]+)?/g)].map((m) => m[0]));
    assert.deepStrictEqual(actual, expected, file);
  }
});

test('en los archivos migrados solo quedan los literales excluidos a propósito', () => {
  for (const [file, { lines, keptLiteral }] of Object.entries(baseline.files)) {
    const hexes = new Set(Object.values(lines).flat().map((entry) => entry.hex));
    const source = withoutNeutral(file);
    const remaining = count([...source.matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0].toLowerCase()).filter((hex) => hexes.has(hex)));
    assert.deepStrictEqual(remaining, keptLiteral, file);
  }
  // Fecha atenuada de aplicación y guion de importe cero: otro significado, se quedan.
  assert.deepStrictEqual(baseline.files['pages/informes/EstadoCuentaPage.tsx']?.keptLiteral, { '#9ca3af': 2 });
});

test('cada archivo importa accountingColors una sola vez', () => {
  for (const file of Object.keys(baseline.files)) {
    const source = readText(`../${file}`);
    const imports = source.match(/^import \{[^}]*\baccountingColors\b[^}]*\} from '[^']*theme\/functional';$/gm) ?? [];
    assert.equal(imports.length, 1, file);
  }
});

test('utilidad y balance cuadrado comparten el mismo panel favorable', () => {
  for (const file of ['pages/informes/contabilidad/EstadoResultadosPage.tsx', 'pages/informes/contabilidad/BalanceGeneralPage.tsx']) {
    const tokens = Object.values(baseline.files[file]!.lines).flat().map((entry) => entry.token).sort();
    assert.deepStrictEqual(tokens, [
      'accountingColors.favorable.border',
      'accountingColors.favorable.surface',
      'accountingColors.favorable.text',
      'accountingColors.unfavorable.border',
      'accountingColors.unfavorable.surface',
      'accountingColors.unfavorable.text',
    ]);
  }
});

test('los colores contables son una familia propia, separada de alertas y de la marca', () => {
  // Mismo valor, otro significado: cargo no es error y abono no es éxito.
  assert.equal(accountingColors.debit, alertColors.error[600]);
  assert.equal(accountingColors.credit, alertColors.success[600]);
  assert.ok(!Object.keys(accountingColors).some((key) => ['success', 'warning', 'error'].includes(key)));
  const brandValues = new Set(JSON.stringify(emphasysBrand.colors).match(/#[0-9a-f]{6}/g));
  for (const value of JSON.stringify(accountingColors).match(/#[0-9a-f]{6}/g) ?? []) {
    assert.ok(!brandValues.has(value), `${value} no debe venir de la marca`);
  }
});
