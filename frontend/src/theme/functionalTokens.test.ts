import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { emphasysBrand } from './brand/emphasys.ts';
import type { BrandDefinition } from './brand/types.ts';
import { createEmphasysTheme } from './createEmphasysTheme.ts';
import {
  agingBucketColors,
  categoricalPalettes,
  classicFunctionalTokens,
  experimentalFunctionalTokens,
  feedbackTokens,
  thirdPartyColors,
} from './functional.ts';
import { classicTheme, experimentalTheme } from './themes.ts';
import {
  buildClassicTokens,
  buildExperimentalTokens,
  classicTokens,
  experimentalTokens,
  type EmphasysTokens,
} from './tokens.ts';

const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const toJson = (value: unknown) => JSON.parse(JSON.stringify(value));
const palettesBaseline = JSON.parse(readText('./__fixtures__/functionalPalettes.baseline.json'));

/** Marca con todos sus colores reemplazados por valores distintos y únicos. */
function brandWithEveryColorChanged(): BrandDefinition {
  let next = 0;
  const swap = (value: unknown): unknown => {
    if (typeof value === 'string') return `#${(0x100000 + next++).toString(16)}`;
    return Object.fromEntries(Object.entries(value as object).map(([key, child]) => [key, swap(child)]));
  };
  return { ...emphasysBrand, colors: swap(emphasysBrand.colors) as BrandDefinition['colors'] };
}

const functionalSlice = (tokens: EmphasysTokens) => ({
  destructive: tokens.action.destructive,
  info: tokens.action.info,
  status: tokens.status,
  metric: tokens.metric,
});

/** Rutas `a.b.c` de todos los valores hoja. */
function leaves(value: unknown, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      for (const [path, leaf] of leaves(child, prefix ? `${prefix}.${key}` : key)) out.set(path, leaf);
    }
  } else {
    out.set(prefix, value);
  }
  return out;
}

const changedPaths = (before: EmphasysTokens, after: EmphasysTokens) => {
  const a = leaves(before);
  const b = leaves(after);
  return [...a.keys()].filter((path) => a.get(path) !== b.get(path));
};

const isFunctionalPath = (path: string) =>
  path === 'action.destructive' || path === 'action.info' || path.startsWith('status.') || path.startsWith('metric.');

test('EmphasysTokens toma sus roles funcionales de la capa funcional', () => {
  assert.deepStrictEqual(functionalSlice(classicTokens), {
    destructive: classicFunctionalTokens.action.destructive,
    info: classicFunctionalTokens.action.info,
    status: classicFunctionalTokens.status,
    metric: classicFunctionalTokens.metric,
  });
  assert.deepStrictEqual(functionalSlice(experimentalTokens), {
    destructive: experimentalFunctionalTokens.action.destructive,
    info: experimentalFunctionalTokens.action.info,
    status: experimentalFunctionalTokens.status,
    metric: experimentalFunctionalTokens.metric,
  });
});

test('cambiar todos los colores de la marca no cambia ningún token funcional', () => {
  const brand = brandWithEveryColorChanged();
  assert.deepStrictEqual(toJson(functionalSlice(buildClassicTokens(brand))), toJson(functionalSlice(classicTokens)));
  assert.deepStrictEqual(
    toJson(functionalSlice(buildExperimentalTokens(brand))),
    toJson(functionalSlice(experimentalTokens)),
  );
});

test('una marca distinta sí cambia los tokens de identidad y solo esos', () => {
  const brand = brandWithEveryColorChanged();
  for (const [base, next] of [
    [classicTokens, buildClassicTokens(brand)],
    [experimentalTokens, buildExperimentalTokens(brand)],
  ] as const) {
    const changed = changedPaths(base, next);
    assert.ok(changed.length > 0);
    assert.deepStrictEqual(changed.filter(isFunctionalPath), [], 'un rol funcional siguió a la marca');
    for (const identityPath of ['frame.background', 'action.primary', 'action.primaryHover', 'grid.header', 'chat.sent']) {
      assert.ok(changed.includes(identityPath), `${identityPath} debería seguir a la marca`);
    }
  }
  const changedClassic = changedPaths(classicTokens, buildClassicTokens(brand));
  assert.ok(changedClassic.includes('documentNav.indicator'), 'el acento verde petróleo es de marca');
  const changedExperimental = changedPaths(experimentalTokens, buildExperimentalTokens(brand));
  for (const identityPath of ['canvas.page', 'content.background', 'content.elevated', 'content.foreground', 'table.line']) {
    assert.ok(changedExperimental.includes(identityPath), `${identityPath} debería seguir a la marca`);
  }
});

test('feedbackTokens coincide con palette.success/warning/error/info de ambos temas', () => {
  for (const theme of [classicTheme, experimentalTheme]) {
    for (const key of ['success', 'warning', 'error', 'info'] as const) {
      assert.deepStrictEqual(toJson(theme.palette[key]), feedbackTokens[key], `palette.${key}`);
    }
  }
});

test('un tema construido con otra marca conserva la paleta de estados de MUI', () => {
  const brand = brandWithEveryColorChanged();
  const theme = createEmphasysTheme(buildExperimentalTokens(brand), { editorialFigures: true, restyleSurfaces: true });
  assert.notEqual(theme.palette.primary.main, experimentalTheme.palette.primary.main);
  for (const key of ['success', 'warning', 'error', 'info'] as const) {
    assert.deepStrictEqual(toJson(theme.palette[key]), feedbackTokens[key], `palette.${key}`);
  }
});

test('paletas categóricas y de antigüedad son idénticas a las que tenían los componentes', () => {
  const { series, months, avatars } = categoricalPalettes;
  assert.deepStrictEqual(toJson({ series, months, avatars }), {
    series: palettesBaseline.series,
    months: palettesBaseline.months,
    avatars: palettesBaseline.avatars,
  });
  assert.deepStrictEqual(toJson(agingBucketColors), palettesBaseline.agingBuckets);
  assert.equal(categoricalPalettes.months.length, 12);
});

test('colores de terceros conservan sus valores', () => {
  assert.deepStrictEqual(toJson(thirdPartyColors), { whatsapp: '#25D366', excel: '#217346', excelHover: '#1a5c38' });
});

test('la capa funcional no depende de la marca y la marca no define colores funcionales', () => {
  const functionalSource = readText('./functional.ts');
  assert.ok(!/from '\.\/brand\//.test(functionalSource), 'functional.ts no debe importar la marca');
  const brandKeys = [...leaves(emphasysBrand.colors).keys()].join(' ');
  for (const forbidden of ['success', 'warning', 'error', 'destructive', 'info', 'draft', 'cancellation', 'metric', 'whatsapp', 'chart', 'avatar']) {
    assert.ok(!brandKeys.toLowerCase().includes(forbidden), `la marca no debe definir ${forbidden}`);
  }
});
