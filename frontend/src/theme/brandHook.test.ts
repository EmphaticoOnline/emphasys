import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { activeBrand } from './brand/active.ts';
import { brandBlueAlpha } from './brand/derived.ts';
import { getBrandStyles } from './brand/styles.ts';
import { brandElevation, brandGradients, buildBrandElevation, buildBrandGradients } from './elevation.ts';
import { THEME_IDS, getThemeById } from './themes.ts';
import { brandTints, buildBrandTints } from './tints.ts';
import { BRAND_HOOK_ORDER, revertLinePatch, type LinePatchFixture } from './__fixtures__/colorMigrations.ts';
import { acmeBrand } from './__fixtures__/acmeBrand.ts';

/**
 * Identidad visual por empresa, E2: los componentes leen la marca del tema con
 * `useBrand()` en lugar de importar los valores estáticos de la marca activa.
 */
const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const fixture = JSON.parse(readText(`./__fixtures__/${BRAND_HOOK_ORDER[0]}`)) as LinePatchFixture;
const toJson = (value: unknown) => JSON.parse(JSON.stringify(value));

test('con la marca activa, useBrand entrega los mismos objetos que importaban los componentes', () => {
  const styles = getBrandStyles(activeBrand);
  assert.equal(styles.activeBrand, activeBrand);
  assert.equal(styles.brandElevation, brandElevation);
  assert.equal(styles.brandGradients, brandGradients);
  assert.equal(styles.brandTints, brandTints);
  assert.equal(styles.brandBlueAlpha, brandBlueAlpha);
  for (const id of THEME_IDS) assert.equal(getThemeById(id).brand, styles, id);
});

test('con otra marca, el tema lleva su identidad derivada, construida una sola vez', () => {
  const styles = getBrandStyles(acmeBrand);
  assert.equal(getBrandStyles(acmeBrand), styles);
  assert.equal(styles.activeBrand, acmeBrand);
  assert.deepStrictEqual(toJson(styles.brandElevation), toJson(buildBrandElevation(acmeBrand)));
  assert.deepStrictEqual(toJson(styles.brandGradients), toJson(buildBrandGradients(acmeBrand)));
  assert.deepStrictEqual(toJson(styles.brandTints), toJson(buildBrandTints(acmeBrand)));
  assert.notEqual(styles.brandBlueAlpha(0.06), brandBlueAlpha(0.06));
  assert.match(styles.brandBlueAlpha(0.06), /^rgba\(\d+, \d+, \d+, 0\.06\)$/);
  for (const id of THEME_IDS) assert.equal(getThemeById(id, acmeBrand).brand, styles, id);
});

test('equivalencia contra HEAD: revertir el parche de E2 reproduce cada archivo byte a byte', () => {
  const files = Object.entries(fixture.files);
  assert.equal(files.length, 62);
  for (const [file, entry] of files) {
    const current = readText(`../${file}`);
    assert.equal(sha256(current), entry.migratedSha256, `${file}: cambió después de E2 sin registrarse`);
    assert.equal(sha256(revertLinePatch(current, file, entry)), entry.beforeSha256, file);
    const hunk = entry.hunks.find((h) => h.migrated.length > 0)!;
    const tampered = current.split('\n');
    tampered[hunk.at] = `${tampered[hunk.at]} `;
    assert.throws(() => revertLinePatch(tampered.join('\n'), file, entry), /no coincide con el parche registrado/, file);
  }
});

/** Líneas que el codemod puede quitar o agregar: imports y la desestructuración del hook. */
const IMPORT = /^import (type )?(\w+, )?\{ [\w, ]* \} from (['"])[./\w-]+\3;$/;
const HOOK = /^\s+const \{ (activeBrand|brandElevation|brandGradients|brandTints|brandBlueAlpha)(, (brandElevation|brandGradients|brandTints|brandBlueAlpha))* \} = useBrand\(\);$/;
/** Migraciones a mano, revisadas una por una: el resto de sus líneas queda idéntico. */
const MANUAL: Record<string, RegExp[]> = {
  // Constante de módulo → constante del componente; sombra de un helper → callback del tema.
  'components/documentos/facturas/CartaPorteViajeEditor.tsx': [
    /^import type \{ Theme \} from '@mui\/material\/styles';$/,
    /^(  )?const AZUL = activeBrand\.colors\.blue\.base;$/,
    /^      boxShadow: (brandElevation\.panel|\(theme: Theme\) => theme\.brand\.brandElevation\.panel),$/,
  ],
  // JSX de módulo: el color pasa a callback del tema.
  'components/productos/formulario/SeccionImagenesArchivos.tsx': [
    /^      color: (activeBrand\.colors\.accent|\(theme\) => theme\.brand\.activeBrand\.colors\.accent),$/,
    /^      backgroundColor: (brandTints\.accentWash|\(theme\) => theme\.brand\.brandTints\.accentWash),$/,
  ],
  // Tokens fijos del experimental → tokens del experimental con la marca del tema vigente.
  'components/layout/moduleTabBar.ts': [
    /^import type \{ SystemStyleObject \} from '@mui\/system';$/,
    /^import \{ getThemeById \} from '\.\.\/\.\.\/theme\/themes';$/,
    /^import \{ (experimentalTokens, MAIN_NAV_TYPE|MAIN_NAV_TYPE, type EmphasysTokens) \} from '\.\.\/\.\.\/theme\/tokens';$/,
    /^const chrome = \{$/,
    /^const chromeOf = \(experimentalTokens: EmphasysTokens\) => \(\{$/,
    /^\}\)? as const;$/,
    /^$/,
    /^\/\*\*$/,
    /^ \* (El listón usa siempre los tokens del tema experimental, con la marca del tema|vigente \(`theme\.brand`\), aunque se monte dentro del tema clásico\.)$/,
    /^ \*\/$/,
    /^const experimentalTokensOf = \(theme: Theme\): EmphasysTokens => getThemeById\('experimental', theme\.brand\?\.activeBrand\)\.emphasys;$/,
    /^  return \(theme: Theme\) => moduleTab(Strip|Bar)Styles\(experimentalTokensOf\(theme\)\);$/,
    /^\}$/,
    /^function moduleTab(Strip|Bar)Styles\(experimentalTokens: EmphasysTokens\): SystemStyleObject<Theme> \{$/,
    /^  const chrome = chromeOf\(experimentalTokens\);$/,
  ],
};

test('cada hunk de E2 solo cambia imports y hooks, salvo las migraciones a mano documentadas', () => {
  for (const [file, entry] of Object.entries(fixture.files)) {
    const allowed = [IMPORT, HOOK, ...(MANUAL[file] ?? [])];
    for (const hunk of entry.hunks) {
      for (const line of [...hunk.original, ...hunk.migrated]) {
        assert.ok(allowed.some((pattern) => pattern.test(line)), `${file}:${hunk.at + 1}: línea no permitida: ${line}`);
      }
    }
  }
});

test('cada useBrand() abre el cuerpo de un componente o hook, nunca una función común', () => {
  let hooks = 0;
  for (const file of Object.keys(fixture.files)) {
    const lines = readText(`../${file}`).split('\n');
    lines.forEach((line, index) => {
      if (!/useBrand\(\)/.test(line)) return;
      hooks += 1;
      const indent = /^\s*/.exec(line)![0].length;
      assert.match(lines[index - 1]!, /[{]$/, `${file}:${index + 1}: no es la primera línea del cuerpo`);
      let decl = index - 1;
      // Sube sobre la firma (parámetros en varias líneas y su cierre `}: Props) {`) hasta la declaración.
      while (decl >= 0 && (/^\s*$/.test(lines[decl]!) || /^\s*/.exec(lines[decl]!)![0].length >= indent || /^\s*[})]/.test(lines[decl]!))) decl -= 1;
      assert.match(lines[decl]!, /^(export (default )?)?(function ([A-Z]\w*|use[A-Z]\w*)\b|const [A-Z]\w* = )/, `${file}:${index + 1}`);
    });
  }
  assert.equal(hooks, 65);
});

/** Archivos de la app, fuera de la capa de tema, pruebas, fixtures y mockups de desarrollo. */
const appFiles = (dir: URL, base = ''): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = `${base}${name}`;
    if (statSync(new URL(name, dir)).isDirectory()) {
      return ['theme', 'dev-mockups', '__fixtures__'].includes(name) ? [] : appFiles(new URL(`${name}/`, dir), `${path}/`);
    }
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });

test('cierre E2: ningún archivo de la app importa colores de la marca de forma estática', () => {
  const STATIC = /import \{[^}]*\b(activeBrand|brandElevation|brandGradients|brandTints|brandBlueAlpha|classicTokens|experimentalTokens)\b[^}]*\} from '[./]*theme\//;
  const files = appFiles(new URL('../', import.meta.url));
  assert.ok(files.length > 300);
  assert.deepStrictEqual(files.filter((file) => STATIC.test(readText(`../${file}`))), []);
  // Excepciones documentadas: la tipografía no cambia por empresa (decisión 7) y los logos llegan en E5.
  const kept = files.filter((file) => /\b(MAIN_NAV_TYPE|EDITORIAL_FIGURE_FAMILY|brandLogos)\b/.test(readText(`../${file}`)));
  assert.ok(kept.length > 0);
});
