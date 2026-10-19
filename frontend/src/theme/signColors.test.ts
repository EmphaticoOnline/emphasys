import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { balanceColors, cashFlowColors, dueDateColors, priceVarianceColors } from './functional.ts';
import { amountSignColor, inflowColor, outflowColor, overdueColor } from './sign.ts';
import { classicTheme, experimentalTheme } from './themes.ts';
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
type SignFileFixture = MinorFileFixture & {
  lines: Record<string, MinorFileFixture['lines'][string] & { replacements: Replacement[]; importMerge?: boolean }>;
};
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
  for (const { name, file, n, original, migrated, replacements, importMerge } of allLines()) {
    if (importMerge) {
      // Import fusionado: mismo módulo, conserva todos los nombres previos y agrega los nuevos.
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
      out = out.split(from).join(to);
    }
    assert.equal(out, migrated, `${name} ${file}:${n}`);
  }
});

test('bloque 1: cada reemplazo cambia un rol del tema por el helper que lo lee', () => {
  const allowed: Record<string, string[]> = {
    'action.destructive': ['amountSignColor', 'outflowColor', 'overdueColor'],
    'applied.foreground': ['amountSignColor', 'inflowColor'],
  };
  for (const { name, file, n, replacements } of allLines().filter((l) => l.name === 'signColors.b1.baseline.json')) {
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

test('bloque 2: cada rol de balanceColors es exactamente el palette.*.main que reemplazó, en los dos temas', () => {
  const b2 = blocks.find(({ name }) => name === 'signColors.b2.baseline.json')!.fixture;
  const replacements = Object.values(b2.files).flatMap((f) => Object.values(f.lines).flatMap((l) => l.replacements));
  assert.equal(replacements.reduce((a, r) => a + r.times, 0), 15);
  for (const { from, to } of replacements) {
    const palette = /^'(error|success|warning)\.main'$/.exec(from);
    const role = /^balanceColors\.([a-zA-Z]+)$/.exec(to);
    assert.ok(palette && role, `${from} → ${to}`);
    const value = balanceColors[role[1] as keyof typeof balanceColors];
    for (const theme of [classicTheme, experimentalTheme]) {
      assert.equal(value, theme.palette[palette[1] as 'error' | 'success' | 'warning'].main, `${to} en ${theme.palette.primary.main}`);
    }
  }
  // Varios significados comparten valor sin fusionarse (auditoría §2 y §8).
  assert.deepStrictEqual(Object.keys(balanceColors), ['due', 'inFavor', 'settled', 'onHold', 'negative', 'positive', 'outstanding']);
  const used = new Set(replacements.map((r) => r.to));
  for (const key of Object.keys(balanceColors)) assert.ok(used.has(`balanceColors.${key}`), `balanceColors.${key} no se usa`);
});

test('bloque 2: los textos neutrales del mismo ternario siguen en palette de texto', () => {
  // Solo se migra el signo: 'text.primary' e 'inherit' quedan como estaban.
  const b2 = blocks.find(({ name }) => name === 'signColors.b2.baseline.json')!.fixture;
  for (const [file, entry] of Object.entries(b2.files)) {
    for (const { original, migrated, importMerge } of Object.values(entry.lines)) {
      if (importMerge) continue;
      for (const keep of ["'text.primary'", "'inherit'"]) {
        assert.equal(migrated.split(keep).length, original.split(keep).length, `${file}: ${keep}`);
      }
      assert.ok(!/'(error|success|warning)\.main'/.test(migrated), `${file}: quedó un palette de signo`);
    }
  }
});

test('bloque 3: cashFlowColors y dueDateColors son exactamente los palette.*.main que reemplazaron', () => {
  const b3 = blocks.find(({ name }) => name === 'signColors.b3.baseline.json')!.fixture;
  const replacements = Object.values(b3.files).flatMap((f) => Object.values(f.lines).flatMap((l) => l.replacements));
  assert.equal(replacements.reduce((a, r) => a + r.times, 0), 19);
  const families: Record<string, Record<string, string>> = { cashFlowColors, dueDateColors };
  for (const { from, to } of replacements) {
    const palette = /^'(error|success|warning)\.main'$/.exec(from);
    const role = /^(cashFlowColors|dueDateColors)\.([a-zA-Z]+)$/.exec(to);
    assert.ok(palette && role, `${from} → ${to}`);
    for (const theme of [classicTheme, experimentalTheme]) {
      assert.equal(families[role[1]!]![role[2]!], theme.palette[palette[1] as 'error' | 'success' | 'warning'].main, to);
    }
  }
  const used = new Set(replacements.map((r) => r.to));
  for (const token of ['cashFlowColors.inflow', 'cashFlowColors.outflow', 'dueDateColors.overdue', 'dueDateColors.dueToday']) {
    assert.ok(used.has(token), `${token} no se usa`);
  }
  // Flujo: tres familias con valores distintos que no se fusionan (auditoría D2).
  assert.notEqual(cashFlowColors.outflow, '#dc2626');
});

test('bloque 3: los días sin conciliar (antigüedad) quedan fuera y en palette', () => {
  assert.ok(readText('../pages/finanzas/ConciliacionBancariaPage.tsx').includes("const color = n > 30 ? 'error.main' : n > 7 ? 'warning.main' : 'text.secondary';"));
  const noConciliados = readText('../pages/informes/finanzas/MovimientosNoConciliadosPage.tsx');
  assert.ok(noConciliados.includes("const color = d > 30 ? 'error.main' : d > 7 ? 'warning.main' : 'text.secondary';"));
  assert.ok(noConciliados.includes("color={k.maxDias > 30 ? 'error.main' : k.maxDias > 7 ? 'warning.main' : 'text.primary'}"));
});

test('bloque 4: priceVarianceColors son exactamente los palette.*.main que reemplazaron, en ventas y compras', () => {
  const b4 = blocks.find(({ name }) => name === 'signColors.b4.baseline.json')!.fixture;
  assert.deepStrictEqual(Object.keys(b4.files).sort(), [
    'pages/informes/compras/HistorialPreciosCompraPage.tsx',
    'pages/informes/ventas/HistorialPreciosVentaPage.tsx',
  ]);
  const replacements = Object.values(b4.files).flatMap((f) => Object.values(f.lines).flatMap((l) => l.replacements));
  assert.equal(replacements.reduce((a, r) => a + r.times, 0), 12);
  for (const { from, to } of replacements) {
    const palette = /^'(error|success)\.main'$/.exec(from);
    const role = /^priceVarianceColors\.(up|down|max|min)$/.exec(to);
    assert.ok(palette && role, `${from} → ${to}`);
    for (const theme of [classicTheme, experimentalTheme]) {
      assert.equal(priceVarianceColors[role[1] as keyof typeof priceVarianceColors], theme.palette[palette[1] as 'error' | 'success'].main, to);
    }
  }
  // Ventas y compras migran igual: misma lectura (subir en rojo), pendiente de diseño D9.
  const [compras, ventas] = Object.values(b4.files).map((f) => Object.values(f.lines).map((l) => l.replacements.map((r) => r.to).join('|')));
  assert.deepStrictEqual(compras, ventas);
  // El valor KPI "Último precio/costo" (#1d2f68) sigue fuera, como en el bloque de neutrales.
  for (const file of Object.keys(b4.files)) assert.ok(readText(`../${file}`).includes("color: '#1d2f68', bold: true"), file);
});

test('cierre de la fuente A: en los archivos migrados solo quedan palette que no son de signo', () => {
  const files = new Set(
    blocks
      .filter(({ name }) => ['signColors.b2.baseline.json', 'signColors.b3.baseline.json', 'signColors.b4.baseline.json'].includes(name))
      .flatMap(({ fixture }) => Object.keys(fixture.files)),
  );
  assert.equal(files.size, 17);
  // Validación, alertas, acción destructiva y antigüedad de conciliación (D8): no son signo.
  const expected: Record<string, number> = {
    'modules/contabilidad/SaldosInicialesView.tsx': 2,
    'pages/DocumentosFormPage.tsx': 1,
    'pages/informes/inventario/ExistenciasPorAlmacenPage.tsx': 1,
    'pages/finanzas/ConciliacionBancariaPage.tsx': 2,
    'pages/informes/finanzas/MovimientosNoConciliadosPage.tsx': 4,
  };
  for (const file of files) {
    const count = readText(`../${file}`).match(/'(error|success|warning)\.main'/g)?.length ?? 0;
    assert.equal(count, expected[file] ?? 0, file);
  }
});
