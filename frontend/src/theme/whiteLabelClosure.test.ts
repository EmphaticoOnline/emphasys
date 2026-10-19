import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';

/**
 * Cierre global de PE-107 (validación PE-109): fuera de `theme/`, Compass,
 * mockups y el legado sin importadores no queda ningún color escrito a mano,
 * de ningún tipo, salvo las exclusiones documentadas.
 *
 * - Hex de 3 a 8 dígitos, `rgb()`/`rgba()`, `hsl()`/`hsla()` y colores con nombre.
 * - `transparent`, `inherit` y `currentColor` no son colores de identidad y no cuentan.
 * - `common.white` y las rutas de `palette` (`'primary.main'`…) ya leen el tema.
 */
const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const LEGACY = ['components/Layout.tsx', 'components/Menu.tsx', 'components/Sidebar.tsx', 'components/SecondaryNav.tsx'];
const COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d[^)]*\)|\bhsla?\([^)]*\)|(['"`])(?:black|white|red|green|blue|gray|grey|orange|yellow|purple|pink|brown|cyan|magenta)\1/g;

/**
 * Exclusiones documentadas, por archivo:
 * - datos de usuario o BD y sus fallbacks (docs/white-label-restos-r1-audit.md §0);
 * - KPI y serie de gráfica (bloques 1 y 7);
 */
const DOCUMENTED: Record<string, Record<string, number>> = {
  'components/DynamicFieldControl.tsx': { '#000000': 1 },
  'components/produccion/ProduccionDetalleDrawer.tsx': { '#e5e7eb': 2 },
  'modules/configuracion/ConceptosPage.tsx': { '#3e3428': 2 },
  'pages/ConfiguracionEtapasProduccionPage.tsx': { '#1D4ED8': 5, '#E5E7EB': 2 },
  'pages/DocumentosPage.tsx': { '#e5e7eb': 2 },
  'pages/LeadsPage.tsx': { '#25D366': 8 },
  'pages/ProduccionPage.tsx': { '#e5e7eb': 1 },
  'pages/configuracion/FormatosImpresionPage.tsx': { '#1d2f68': 4 },
  'pages/configuracion/WhatsappEtiquetasPage.tsx': { '#25D366': 1 },
  'pages/informes/MovimientosPorPeriodoPage.tsx': { '#1d2f68': 1 },
  'pages/informes/compras/HistorialPreciosCompraPage.tsx': { '#1d2f68': 1 },
  'pages/informes/ventas/HistorialPreciosVentaPage.tsx': { '#1d2f68': 1 },
  'utils/leadsDerivation.ts': { '#1d2f68': 1 },
};

const sourceFiles = () => {
  const files: string[] = [];
  const walk = (dir: URL, rel: string) => {
    for (const name of readdirSync(dir)) {
      if (rel === '' && ['dev-mockups', 'theme', 'compass'].includes(name)) continue;
      const path = `${rel}${name}`;
      if (statSync(new URL(name, dir)).isDirectory()) walk(new URL(`${name}/`, dir), `${path}/`);
      else if (/\.(tsx?|css)$/.test(name) && !/\.test\.ts$/.test(name)) files.push(path);
    }
  };
  walk(new URL('../', import.meta.url), '');
  return files.filter((file) => !LEGACY.includes(file));
};

test('cierre global: fuera de theme/ y del legado solo quedan las exclusiones documentadas', () => {
  const remaining: Record<string, Record<string, number>> = {};
  for (const file of sourceFiles()) {
    for (const [match] of readText(`../${file}`).matchAll(COLOR)) {
      (remaining[file] ??= {})[match] = (remaining[file]![match] ?? 0) + 1;
    }
  }
  assert.deepEqual(remaining, DOCUMENTED);
});

test('el legado sigue fuera de alcance y sin importadores', () => {
  const files = sourceFiles();
  for (const legacy of LEGACY) {
    const name = legacy.replace(/^components\//, '').replace(/\.tsx$/, '');
    const importers = files.filter((file) => new RegExp(`from ['"][./]*(?:components/)?${name}['"]`).test(readText(`../${file}`)));
    assert.deepEqual(importers, [], `${legacy} tiene importadores`);
  }
});

test('H3: los mockups de diseño solo se montan en desarrollo y no tienen imports estáticos', () => {
  // Ningún archivo fuera de dev-mockups los importa de forma estática (entrarían al bundle de producción).
  const statics = sourceFiles().filter((file) => /^import\s[^;]*from\s+['"][./]*dev-mockups\//m.test(readText(`../${file}`)));
  assert.deepEqual(statics, []);

  const app = readText('../App.tsx');
  // Los 6 imports dinámicos viven solo dentro de la rama `import.meta.env.DEV`.
  const gate = /const devMockups = import\.meta\.env\.DEV\s*\?\s*\{([\s\S]*?)\}\s*:\s*null;/.exec(app);
  assert.ok(gate, 'falta el bloque `import.meta.env.DEV ? { … } : null`');
  const dynamicImports = (text: string) => [...text.matchAll(/import\(\s*'\.\/dev-mockups\/[^']+'\s*\)/g)].length;
  assert.equal(dynamicImports(gate[1]!), 6);
  assert.equal(dynamicImports(app), 6, 'hay imports de mockups fuera del bloque de desarrollo');
  assert.equal((gate[1]!.match(/React\.lazy\(/g) ?? []).length, 6);

  // Las rutas /dev/mockups solo se declaran dentro de `{devMockups && (…)}`, con los mismos paths de antes.
  const start = app.indexOf('{devMockups && (');
  const end = app.indexOf('</>', start);
  assert.ok(start >= 0 && end > start);
  const inside = app.slice(start, end);
  const mockupPaths = (text: string) => [...text.matchAll(/path="(\/dev\/mockups\/[^"]+)"/g)].map(([, path]) => path);
  assert.deepEqual(mockupPaths(inside), [
    '/dev/mockups/liquidacion-factura-origen',
    '/dev/mockups/nota-credito',
    '/dev/mockups/notas-credito',
    '/dev/mockups/notas-credito-2',
    '/dev/mockups/identidad',
    '/dev/mockups/almacenes',
  ]);
  assert.deepEqual(mockupPaths(app.slice(0, start) + app.slice(end)), [], 'hay rutas de mockups fuera del bloque de desarrollo');
});
