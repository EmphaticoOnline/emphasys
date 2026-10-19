import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { amountSignColor, inflowColor, outflowColor, overdueColor } from './sign.ts';
import { classicTokens, experimentalTokens } from './tokens.ts';
import {
  LATER_FIXTURES,
  revertLater,
  revertMinor,
  SIGN_ORDER,
  type LaterFixtures,
  type MinorFileFixture,
} from './__fixtures__/colorMigrations.ts';

const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

type Replacement = { from: string; to: string; times: number };
type SignFileFixture = MinorFileFixture & { lines: Record<string, MinorFileFixture['lines'][string] & { replacements: Replacement[] }> };
type SignFixture = { source: string; files: Record<string, SignFileFixture> };

/** Un fixture por bloque de fuentes de signo (ver docs/white-label-fuentes-de-signo-audit.md). */
const blocks = SIGN_ORDER.map((name) => ({ name, fixture: JSON.parse(readText(`./__fixtures__/${name}`)) as SignFixture }));
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

test('los helpers de signo leen exactamente los roles que reemplazan, en los dos temas', () => {
  for (const tokens of [classicTokens, experimentalTokens]) {
    assert.equal(amountSignColor(tokens, 'negative'), tokens.action.destructive);
    assert.equal(amountSignColor(tokens, 'positive'), tokens.metric.applied.foreground);
    assert.equal(outflowColor(tokens), tokens.action.destructive);
    assert.equal(inflowColor(tokens), tokens.metric.applied.foreground);
    assert.equal(overdueColor(tokens), tokens.action.destructive);
  }
  // Valores efectivos de hoy: estas pantallas usan el tema experimental.
  assert.equal(amountSignColor(experimentalTokens, 'negative'), '#8a4d45');
  assert.equal(amountSignColor(experimentalTokens, 'positive'), '#3f6b52');
  assert.equal(amountSignColor(classicTokens, 'negative'), '#b91c1c');
  assert.equal(amountSignColor(classicTokens, 'positive'), '#1f2937');
});

test('equivalencia contra HEAD: restaurar cada archivo del bloque reproduce el previo byte a byte', () => {
  for (const { name, fixture } of blocks) {
    for (const [file, entry] of Object.entries(fixture.files)) {
      assert.equal(sha256(revertMinor(asOfBlock(name, file), entry)), entry.headSha256, `${name} ${file}`);
    }
  }
});

test('cada línea migrada es exactamente su original con los reemplazos declarados', () => {
  for (const { name, file, n, original, migrated, replacements } of allLines()) {
    let out = original;
    for (const { from, to, times } of replacements) {
      assert.equal(out.split(from).length - 1, times, `${name} ${file}:${n} "${from}"`);
      out = out.split(from).join(to);
    }
    assert.equal(out, migrated, `${name} ${file}:${n}`);
  }
});

test('cada reemplazo cambia un rol del tema por el helper que lo lee', () => {
  const allowed: Record<string, string[]> = {
    'action.destructive': ['amountSignColor', 'outflowColor', 'overdueColor'],
    'applied.foreground': ['amountSignColor', 'inflowColor'],
  };
  for (const { name, file, n, replacements } of allLines()) {
    for (const { from, to } of replacements) {
      const role = Object.keys(allowed).find((r) => from.endsWith(r));
      assert.ok(role, `${name} ${file}:${n}: "${from}" no es un rol de signo`);
      assert.ok(allowed[role!]!.some((helper) => to.includes(`${helper}(`)), `${name} ${file}:${n}: "${to}"`);
      if (to.includes("'negative'")) assert.equal(role, 'action.destructive');
      if (to.includes("'positive'")) assert.equal(role, 'applied.foreground');
    }
  }
});

test('las acciones destructivas siguen usando action.destructive', () => {
  // Botón "Eliminar partida": acción, no signo (auditoría §1, excluidos).
  const form = readText('../pages/InventarioMovimientoFormPage.tsx');
  assert.ok(form.includes("'&:hover:not(:disabled)': { bgcolor: theme.emphasys.metric.blocked.background, color: theme.emphasys.action.destructive },"));
  // Tesorería: dependencia del useMemo de columnas (los helpers leen el mismo rol), mensaje de error y botón de eliminar ×2.
  const table = readText('../modules/finanzas/MovimientosTable.tsx');
  assert.equal(table.match(/tokens\.action\.destructive/g)?.length, 4);
  // Validación (póliza no cuadrada) no es signo.
  assert.ok(readText('../modules/contabilidad/PolizaFormView.tsx').includes('theme.emphasys.action.destructive'));
});

test('el bloque 1 cubre los 14 usos de signo de action.destructive y sus contrapartes', () => {
  const b1 = blocks.find(({ name }) => name === 'signColors.b1.baseline.json')!.fixture;
  const replacements = Object.values(b1.files).flatMap((f) => Object.values(f.lines).flatMap((l) => l.replacements));
  const total = (fn: string) => replacements.filter((r) => r.to.includes(fn)).reduce((a, r) => a + r.times, 0);
  assert.equal(replacements.filter((r) => r.from.endsWith('action.destructive')).length, 14);
  assert.equal(total("'negative'"), 10);
  assert.equal(total("'positive'"), 4);
  assert.equal(total('outflowColor('), 3);
  assert.equal(total('inflowColor('), 3);
  assert.equal(total('overdueColor('), 1);
});
