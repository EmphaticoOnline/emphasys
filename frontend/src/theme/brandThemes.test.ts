import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { activeBrand } from './brand/active.ts';
import { emphasysBrand } from './brand/emphasys.ts';
import { createEmphasysTheme } from './createEmphasysTheme.ts';
import { THEME_IDS, classicTheme, experimentalTheme, getThemeById } from './themes.ts';
import { buildClassicTokens, buildExperimentalTokens } from './tokens.ts';
import { acmeBrand } from './__fixtures__/acmeBrand.ts';
import { serializeTheme } from './__fixtures__/serializeTheme.ts';

/**
 * Identidad visual por empresa, E1: los temas se construyen por marca en tiempo
 * de ejecución, sin cambiar la apariencia de la marca activa.
 */
const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const toJson = (value: unknown) => JSON.parse(JSON.stringify(value));
const themeBaseline = JSON.parse(readText('./__fixtures__/emphasysMuiTheme.baseline.json'));

test('sin marca, getThemeById devuelve los mismos temas exportados y congelados', () => {
  assert.equal(getThemeById('classic'), classicTheme);
  assert.equal(getThemeById('experimental'), experimentalTheme);
  assert.equal(getThemeById('classic', activeBrand), classicTheme);
  assert.equal(getThemeById('experimental', emphasysBrand), experimentalTheme);
  assert.deepStrictEqual(toJson(serializeTheme(getThemeById('classic'))), themeBaseline.classicTheme);
  assert.deepStrictEqual(toJson(serializeTheme(getThemeById('experimental'))), themeBaseline.experimentalTheme);
});

test('otra marca produce temas propios, iguales a construirlos a mano, y se memoizan', () => {
  const expected = {
    classic: createEmphasysTheme(buildClassicTokens(acmeBrand), { editorialFigures: false, restyleSurfaces: false }),
    experimental: createEmphasysTheme(buildExperimentalTokens(acmeBrand), { editorialFigures: true, restyleSurfaces: true }),
  };
  for (const id of THEME_IDS) {
    const theme = getThemeById(id, acmeBrand);
    assert.notEqual(theme, getThemeById(id));
    assert.equal(getThemeById(id, acmeBrand), theme, `${id}: se reconstruyó`);
    assert.deepStrictEqual(toJson(serializeTheme(theme)), toJson(serializeTheme(expected[id])));
    assert.deepStrictEqual(toJson(theme.emphasys), toJson(expected[id].emphasys));
    assert.notDeepStrictEqual(toJson(theme.palette.primary), toJson(getThemeById(id).palette.primary));
  }
});

test('una copia con los mismos colores es otra clave: la marca de tiempo de ejecución debe conservar su instancia', () => {
  const copy = structuredClone(acmeBrand);
  assert.notEqual(getThemeById('classic', copy), getThemeById('classic', acmeBrand));
  assert.deepStrictEqual(toJson(serializeTheme(getThemeById('classic', copy))), toJson(serializeTheme(getThemeById('classic', acmeBrand))));
});

test('ningún ThemeProvider de la app usa un tema fijo: todos pasan por la marca de BrandContext', () => {
  for (const file of ['../main.tsx', './AppThemeGate.tsx', '../dev-mockups/almacenes/AlmacenesPrototipoPage.tsx']) {
    const source = readText(file);
    assert.match(source, /<BrandThemeProvider themeId=/, file);
    assert.doesNotMatch(source, /<ThemeProvider\b|classicTheme|experimentalTheme|from '\.\/theme\.js'/, file);
  }
  const provider = readText('./BrandThemeProvider.tsx');
  assert.match(provider, /getThemeById\(themeId, brand\)/);
  assert.match(provider, /useActiveBrand\(\)/);
  assert.match(readText('./brand/BrandContext.ts'), /createContext<BrandDefinition>\(activeBrand\)/);
});
