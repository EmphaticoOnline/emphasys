import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { activeBrand } from './brand/active.ts';
import { emphasysBrand } from './brand/emphasys.ts';
import { renderBrandHtml, renderWebManifest } from './brand/webIdentity.ts';
import { createEmphasysTheme } from './createEmphasysTheme.ts';
import { buildBrandElevation, buildBrandGradients } from './elevation.ts';
import { buildBrandTints } from './tints.ts';
import {
  buildClassicTokens,
  buildExperimentalTokens,
  classicTokens,
  EDITORIAL_FIGURE_FAMILY,
  experimentalTokens,
  FUNCTIONAL_FONT_FAMILY,
  MAIN_NAV_TYPE,
} from './tokens.ts';
import { acmeBrand } from './__fixtures__/acmeBrand.ts';
import { serializeTheme } from './__fixtures__/serializeTheme.ts';

/**
 * Validación white label de punta a punta (PE-109): una marca distinta en todos
 * sus colores (`acmeBrand`) debe cambiar toda la identidad derivada, sin dejar
 * colores de Emphasys, salvo las coincidencias funcionales documentadas.
 */
const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const emphasysHexes = [...new Set(JSON.stringify(emphasysBrand.colors).toLowerCase().match(/#[0-9a-f]{6}/g) ?? [])];
const channels = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
/** Apariciones de cada color de Emphasys en un texto, como hex o como `rgb(a)` con o sin espacios. */
const emphasysHits = (text: string) => {
  const lower = text.toLowerCase();
  const hits: Record<string, { hex: number; rgb: number }> = {};
  for (const hex of emphasysHexes) {
    const [r, g, b] = channels(hex);
    const rgb = (lower.match(new RegExp(`rgba?\\(\\s*${r}\\s*,\\s*${g}\\s*,\\s*${b}\\s*[,)]`, 'g')) ?? []).length;
    const count = lower.split(hex).length - 1;
    if (count || rgb) hits[hex] = { hex: count, rgb };
  }
  return hits;
};
const flatten = (value: unknown, prefix = '', out: Record<string, string> = {}) => {
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object') flatten(child, path, out);
    else if (typeof child === 'string') out[path] = child;
  }
  return out;
};

/**
 * Roles funcionales cuyo valor coincide con un color de Emphasys pero que, por
 * diseño (PE-106), no siguen a la marca: viven en `functional.ts`.
 */
const FUNCTIONAL_COINCIDENCES = {
  classic: ['action.info', 'metric.amount.foreground', 'metric.available.foreground', 'metric.progress'],
  experimental: ['metric.amount.background', 'metric.amount.foreground', 'metric.track'],
};

test('la marca de prueba no comparte ningún color con Emphasys', () => {
  const acme = JSON.stringify(acmeBrand.colors).toLowerCase().match(/#[0-9a-f]{6}/g) ?? [];
  assert.equal(new Set(acme).size, acme.length, 'acmeBrand no repite colores');
  assert.deepEqual(acme.filter((hex) => emphasysHexes.includes(hex)), []);
});

test('tokens: todo valor de marca Emphasys sigue a la marca, salvo las coincidencias funcionales', () => {
  for (const [name, build] of [
    ['classic', buildClassicTokens],
    ['experimental', buildExperimentalTokens],
  ] as const) {
    const base = flatten(build(emphasysBrand));
    const next = flatten(build(acmeBrand));
    const fixed = Object.entries(base)
      .filter(([path, value]) => emphasysHexes.some((hex) => value.toLowerCase().includes(hex)) && next[path] === value)
      .map(([path]) => path)
      .sort();
    assert.deepEqual(fixed, [...FUNCTIONAL_COINCIDENCES[name]].sort(), `${name}: un token de marca no sigue a la marca`);
    // Tampoco quedan colores de Emphasys como rgb(a) en los tokens de la otra marca.
    for (const [hex, { rgb }] of Object.entries(emphasysHits(JSON.stringify(next)))) assert.equal(rgb, 0, `${name}: ${hex} en rgb`);
  }
});

test('temas MUI: con otra marca solo quedan las coincidencias funcionales, sin rgb de marca', () => {
  const classic = serializeTheme(createEmphasysTheme(buildClassicTokens(acmeBrand), { editorialFigures: false, restyleSurfaces: false }));
  const experimental = serializeTheme(createEmphasysTheme(buildExperimentalTokens(acmeBrand), { editorialFigures: true, restyleSurfaces: true }));
  assert.deepEqual(emphasysHits(JSON.stringify(classic)), { '#1d2f68': { hex: 4, rgb: 0 } });
  assert.deepEqual(emphasysHits(JSON.stringify(experimental)), {
    '#e4ddd2': { hex: 1, rgb: 0 },
    '#efe4d4': { hex: 1, rgb: 0 },
    '#3e3428': { hex: 1, rgb: 0 },
  });
});

test('derivados de marca (sombras, degradados, tintes) no conservan colores de Emphasys', () => {
  for (const derived of [buildBrandElevation(acmeBrand), buildBrandGradients(acmeBrand), buildBrandTints(acmeBrand)]) {
    assert.deepEqual(emphasysHits(JSON.stringify(derived)), {});
  }
});

test('identidad web: index.html y manifest toman nombre y color de la otra marca', () => {
  const html = renderBrandHtml(readText('../../index.html'), acmeBrand);
  assert.ok(html.includes('<title>Acme ERP</title>'));
  assert.ok(html.includes(`content="${acmeBrand.metadata.themeColor}"`));
  assert.ok(!/emphasys/i.test(html.replace(/\/[\w./-]*emphasys[\w./-]*/gi, '')), 'index.html no nombra Emphasys fuera de rutas de assets');
  const manifest = JSON.parse(renderWebManifest(acmeBrand));
  assert.equal(manifest.name, 'Acme ERP');
  assert.equal(manifest.short_name, 'Acme');
  assert.equal(manifest.theme_color, acmeBrand.metadata.themeColor);
  assert.equal(manifest.background_color, acmeBrand.metadata.backgroundColor);
});

test('los tokens por defecto y las tipografías leen la marca activa, no Emphasys directamente', () => {
  const source = readText('./tokens.ts');
  assert.ok(!/emphasysBrand/.test(source), 'tokens.ts no debe importar emphasysBrand');
  assert.deepEqual(classicTokens, buildClassicTokens(activeBrand));
  assert.deepEqual(experimentalTokens, buildExperimentalTokens(activeBrand));
  assert.equal(MAIN_NAV_TYPE.fontFamily, activeBrand.typography.navigation);
  assert.equal(EDITORIAL_FIGURE_FAMILY, activeBrand.typography.editorialFigure);
  assert.equal(FUNCTIONAL_FONT_FAMILY, activeBrand.typography.functional);
});
