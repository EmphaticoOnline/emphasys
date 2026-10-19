import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { accountingColors, balanceColors, cashFlowColors, inventoryFlowColors, stalenessColors } from './functional.ts';
import { classicTheme, experimentalTheme } from './themes.ts';
import { classicTokens, experimentalTokens } from './tokens.ts';
import {
  DECISION_ORDER,
  LATER_FIXTURES,
  revertLater,
  revertMinor,
  type LaterFixtures,
  type MinorFileFixture,
} from './__fixtures__/colorMigrations.ts';

/**
 * Decisiones de diseño aplicadas (docs/white-label-decisiones-diseno.md).
 * - Sin cambio visual (D8, D-T3, D-B4): el valor nuevo es igual al anterior.
 * - Con cambio visual aprobado (D1, D2, D4, D6): el cambio es exactamente el declarado.
 * En todas, revertir el fixture reproduce el HEAD previo byte a byte.
 */
const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

type Replacement = { from: string; to: string; times: number };
type DecisionFileFixture = MinorFileFixture & {
  lines: Record<string, MinorFileFixture['lines'][string] & { replacements: Replacement[]; importMerge?: boolean }>;
};
type DecisionFixture = { source: string; files: Record<string, DecisionFileFixture> };

const blocks = DECISION_ORDER.map((name) => ({ name, fixture: JSON.parse(readText(`./__fixtures__/${name}`)) as DecisionFixture }));
const laterFixtures: LaterFixtures = Object.fromEntries(
  LATER_FIXTURES.filter((name) => existsSync(new URL(`./__fixtures__/${name}`, import.meta.url))).map((name) => [
    name,
    JSON.parse(readText(`./__fixtures__/${name}`)),
  ]),
);
const asOfBlock = (name: string, file: string) => revertLater(name, file, readText(`../${file}`), laterFixtures);
const block = (id: string) => blocks.find(({ name }) => name === `decisions.${id}.baseline.json`)!.fixture;
const replacementsOf = (id: string) =>
  Object.values(block(id).files).flatMap((entry) => Object.values(entry.lines).flatMap((line) => (line.importMerge ? [] : line.replacements)));

test('cada decisión aplicada está registrada y revertirla reproduce el HEAD previo byte a byte', () => {
  assert.ok(blocks.length > 0);
  for (const { name, fixture } of blocks) {
    for (const [file, entry] of Object.entries(fixture.files)) {
      assert.equal(sha256(revertMinor(asOfBlock(name, file), entry)), entry.headSha256, `${name} ${file}`);
      for (const [n, line] of Object.entries(entry.lines)) {
        let out = line.original;
        for (const { from, to, times } of line.replacements) {
          assert.equal(out.split(from).length - 1, times, `${name} ${file}:${n}`);
          out = out.split(from).join(to);
        }
        if (!line.importMerge) assert.equal(out, line.migrated, `${name} ${file}:${n}`);
      }
    }
  }
});

test('D8 (sin cambio visual): la antigüedad usa stalenessColors con los mismos valores de palette', () => {
  for (const theme of [classicTheme, experimentalTheme]) {
    assert.equal(stalenessColors.stale, theme.palette.error.main);
    assert.equal(stalenessColors.aging, theme.palette.warning.main);
  }
  const replacements = replacementsOf('d8');
  assert.equal(replacements.length, 3);
  for (const { from, to } of replacements) {
    // Mismo umbral y mismo orden: error → stale, warning → aging.
    assert.equal(to, from.replace("'error.main'", 'stalenessColors.stale').replace("'warning.main'", 'stalenessColors.aging'));
  }
  for (const file of ['../pages/finanzas/ConciliacionBancariaPage.tsx', '../pages/informes/finanzas/MovimientosNoConciliadosPage.tsx']) {
    assert.doesNotMatch(readText(file), /> 30 \? 'error\.main'/, file);
  }
});

test('D-T3 (sin cambio visual): la franja de Oportunidades lee grid.stripe, que en el tema de su ruta vale lo mismo', () => {
  const [replacement] = replacementsOf('dt3');
  assert.deepEqual(replacement, {
    from: "backgroundColor: 'rgba(0, 120, 70, 0.05)',",
    to: 'backgroundColor: (theme) => theme.emphasys.grid.stripe,',
    times: 1,
  });
  // La ruta usa el tema clásico, cuya franja de grid es exactamente el literal anterior.
  // `resolveActiveTheme.ts` no carga en Node (importa './themes' sin extensión): se leen sus listas.
  const policy = readText('./resolveActiveTheme.ts');
  const list = (name: string) => [...(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\] as const;`).exec(policy)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(([, path]) => path);
  const exact = list('EXPERIMENTAL_EXACT_PATHS');
  const prefixes = list('EXPERIMENTAL_PATH_PREFIXES');
  assert.ok(exact.length > 0 && prefixes.length > 0);
  const route = '/crm/oportunidades';
  assert.ok(!exact.includes(route) && !prefixes.some((prefix) => route === prefix || route.startsWith(`${prefix}/`)), `${route} debe usar el tema clásico`);
  assert.equal(classicTokens.grid.stripe, 'rgba(0, 120, 70, 0.05)');
  assert.equal(classicTheme.emphasys.grid.stripe, 'rgba(0, 120, 70, 0.05)');
});

test('D-B4 (sin cambio visual): configPrimaryButtonSx lee primaryForeground y no tiene usos', () => {
  const source = readText('../components/configuracion/configVisual.tsx');
  assert.match(source, /color: theme\.emphasys\.action\.primaryForeground,/);
  assert.doesNotMatch(source, /onPrimaryColors/, 'el import sin uso se eliminó');
  // Ningún archivo lo usa: el cambio no tiene efecto visual hoy.
  const files: string[] = [];
  const walk = (dir: URL, rel: string) => {
    for (const name of readdirSync(dir)) {
      const path = `${rel}${name}`;
      if (statSync(new URL(name, dir)).isDirectory()) walk(new URL(`${name}/`, dir), `${path}/`);
      else if (/\.tsx?$/.test(name) && !/\.test\.ts$/.test(name)) files.push(path);
    }
  };
  walk(new URL('../', import.meta.url), '');
  const users = files.filter((file) => file !== 'components/configuracion/configVisual.tsx' && readText(`../${file}`).includes('configPrimaryButtonSx'));
  assert.deepEqual(users, []);
  // Si se usa en el futuro, el texto será el foreground primario de cada tema (blanco en clásico, beige en experimental).
  assert.equal(classicTokens.action.primaryForeground, '#ffffff');
  assert.equal(experimentalTokens.action.primaryForeground, '#f4f0e8');
});

test('D1 (cambio visual aprobado): el saldo al corte del estado de cuenta usa el color de sus filas', () => {
  const replacements = replacementsOf('d1');
  assert.equal(replacements.length, 2);
  // Cambio exacto, solo en el número del saldo al corte: rojo #d32f2f → #dc2626 y verde #2e7d32 → #16a34a.
  assert.deepEqual([balanceColors.due, balanceColors.inFavor], ['#d32f2f', '#2e7d32']);
  assert.deepEqual([accountingColors.debit, accountingColors.credit], ['#dc2626', '#16a34a']);
  const source = readText('../pages/informes/EstadoCuentaPage.tsx');
  assert.match(source, /color=\{saldoFinal > 0 \? accountingColors\.debit : saldoFinal < 0 \? accountingColors\.credit : 'text\.primary'\}/);
  // Las filas no cambian: siguen en debit / credit.
  assert.equal(source.split('accountingColors.debit').length - 1, 4);
  assert.equal(source.split('accountingColors.credit').length - 1, 4);
  assert.doesNotMatch(source, /balanceColors/);
});

test('D2 (cambio visual aprobado): las filas de movimientos de inventario usan el rol de flujo de inventario', () => {
  assert.equal(replacementsOf('d2').length, 2);
  // Cambio exacto, solo en las filas del informe: salida #d32f2f → #dc2626 y entrada #2e7d32 → #16a34a.
  assert.deepEqual([cashFlowColors.outflow, cashFlowColors.inflow], ['#d32f2f', '#2e7d32']);
  assert.deepEqual([inventoryFlowColors.outbound, inventoryFlowColors.inbound], ['#dc2626', '#16a34a']);
  const source = readText('../pages/informes/inventario/MovimientosInventarioPage.tsx');
  assert.match(source, /color=\{esEntrada \? inventoryFlowColors\.inbound : inventoryFlowColors\.outbound\}/);
  // Filas y tarjetas de totales comparten ahora el mismo rol; el Kardex ya lo usaba.
  assert.equal(source.split('inventoryFlowColors.inbound').length - 1, 2);
  assert.equal(source.split('inventoryFlowColors.outbound').length - 1, 2);
  assert.doesNotMatch(source, /cashFlowColors/);
  // El formulario de movimientos (tema experimental) sigue leyendo el tema.
  assert.match(readText('../pages/InventarioMovimientoFormPage.tsx'), /outflowColor\(theme\.emphasys\)/);
});
