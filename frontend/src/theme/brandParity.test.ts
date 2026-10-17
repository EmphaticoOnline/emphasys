import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { emphasysBrand } from './brand/emphasys.ts';
import type { BrandDefinition } from './brand/types.ts';
import {
  EDITORIAL_FIGURE_FAMILY,
  FUNCTIONAL_FONT_FAMILY,
  MAIN_NAV_TYPE,
  buildClassicTokens,
  buildExperimentalTokens,
  classicTokens,
  experimentalTokens,
} from './tokens.ts';

const fromHere = (path: string) => new URL(path, import.meta.url);
const readText = (path: string) => readFileSync(fromHere(path), 'utf8');

const baseline = JSON.parse(readText('./__fixtures__/emphasysTokens.baseline.json'));

const currentSnapshot = () => ({
  classicTokens,
  experimentalTokens,
  MAIN_NAV_TYPE,
  EDITORIAL_FIGURE_FAMILY,
  FUNCTIONAL_FONT_FAMILY,
});

test('los tokens derivados de la marca Emphasys son idénticos al fixture congelado', () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(currentSnapshot())), baseline);
  assert.equal(
    `${JSON.stringify(currentSnapshot(), null, 2)}\n`,
    readText('./__fixtures__/emphasysTokens.baseline.json'),
  );
});

test('la marca Emphasys conserva grafito, beige, marfil, azul y acento', () => {
  const { colors } = emphasysBrand;
  assert.equal(colors.graphite.chrome, '#2c3344');
  assert.equal(colors.graphite.raised, '#3c4149');
  assert.equal(colors.graphite.deep, '#2c3138');
  assert.equal(colors.beige.base, '#f4f0e8');
  assert.equal(colors.beige.border, '#e4ddd2');
  assert.equal(colors.ivory.surface, '#f7f4ee');
  assert.equal(colors.ivory.elevated, '#fffaf2');
  assert.equal(colors.blue.base, '#1d2f68');
  assert.equal(colors.blue.hover, '#162551');
  assert.equal(colors.accent, '#006261');
});

test('los assets de la marca existen en el proyecto', () => {
  const { assets } = emphasysBrand;
  for (const file of [assets.logo, assets.logoMark]) {
    assert.ok(existsSync(fromHere(`../assets/${file}`)), `falta src/assets/${file}`);
  }
  const publicUrls = [assets.favicon, assets.appleTouchIcon, assets.manifest, ...Object.values(assets.icons)];
  for (const url of publicUrls) {
    assert.ok(existsSync(fromHere(`../../public${url}`)), `falta public${url}`);
  }
});

test('la metadata de la marca coincide con index.html y el manifest actuales', () => {
  const { metadata, assets } = emphasysBrand;
  const html = readText('../../index.html');
  assert.ok(html.includes(`<title>${metadata.title}</title>`));
  assert.ok(html.includes(`<meta name="theme-color" content="${metadata.themeColor}" />`));
  assert.ok(html.includes(`<meta name="apple-mobile-web-app-title" content="${metadata.shortName}" />`));
  assert.ok(html.includes(`href="${assets.favicon}"`));
  assert.ok(html.includes(`href="${assets.appleTouchIcon}"`));
  assert.ok(html.includes(`href="${assets.manifest}"`));

  const manifest = JSON.parse(readText('../../public/manifest.webmanifest'));
  assert.equal(manifest.name, metadata.appName);
  assert.equal(manifest.short_name, metadata.shortName);
  assert.equal(manifest.description, metadata.description);
  assert.equal(manifest.theme_color, metadata.themeColor);
  assert.equal(manifest.background_color, metadata.backgroundColor);
  assert.deepEqual(
    manifest.icons.map((icon: { src: string }) => icon.src),
    [assets.icons[192], assets.icons[512]],
  );
});

test('otra marca cambia la identidad sin tocar colores funcionales', () => {
  const otherBrand: BrandDefinition = {
    ...emphasysBrand,
    colors: {
      ...emphasysBrand.colors,
      blue: { base: '#000001', hover: '#000002', tint: '#000003', wash: '#000004' },
      graphite: { ...emphasysBrand.colors.graphite, chrome: '#000005', raised: '#000006' },
      accent: '#000007',
    },
  };
  const classic = buildClassicTokens(otherBrand);
  const experimental = buildExperimentalTokens(otherBrand);

  assert.equal(classic.action.primary, '#000001');
  assert.equal(classic.frame.background, '#000005');
  assert.equal(classic.documentNav.indicator, '#000007');
  assert.equal(experimental.action.primary, '#000006');

  for (const [tokens, base] of [
    [classic, classicTokens],
    [experimental, experimentalTokens],
  ] as const) {
    assert.deepStrictEqual(tokens.status, base.status);
    assert.deepStrictEqual(tokens.metric, base.metric);
    assert.equal(tokens.action.destructive, base.action.destructive);
    assert.equal(tokens.action.info, base.action.info);
  }
});
