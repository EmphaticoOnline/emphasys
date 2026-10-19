import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { emphasysBrand } from './brand/emphasys.ts';
import * as functional from './functional.ts';
import * as structural from './structural.ts';
import {
  LATER_FIXTURES,
  revertLater,
  revertMinor,
  WHITE_ORDER,
  type LaterFixtures,
  type MinorFileFixture,
} from './__fixtures__/colorMigrations.ts';

const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

type Replacement = { from: string; to: string; times: number };
type WhiteFileFixture = MinorFileFixture & {
  lines: Record<string, MinorFileFixture['lines'][string] & { replacements: Replacement[]; importMerge?: boolean }>;
};
type WhiteFixture = { source: string; files: Record<string, WhiteFileFixture> };

const blocks = WHITE_ORDER.map((name) => ({ name, fixture: JSON.parse(readText(`./__fixtures__/${name}`)) as WhiteFixture }));
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

/**
 * Contexto de una línea migrada por su posición real (no por contenido: hay líneas idénticas).
 * Se lee el archivo tal como lo dejó su bloque; la línea `n` está desplazada por los imports que agregó.
 */
const contextOf = (name: string, file: string, n: string, before: number, after: number) => {
  const entry = blocks.find((block) => block.name === name)!.fixture.files[file]!;
  const lines = asOfBlock(name, file).split('\n');
  const index = Number(n) - 1 + entry.addedImports.length;
  assert.equal(lines[index], entry.lines[n]!.migrated, `${name} ${file}:${n} fuera de posición`);
  return lines.slice(Math.max(0, index - before), index + after + 1).join('\n');
};

/** Familias de blancos (ver docs/white-label-blancos-audit.md). Ninguna depende de la marca. */
const ROOTS = {
  onPrimaryColors: structural.onPrimaryColors,
  whiteSurfaces: structural.whiteSurfaces,
  onStatusColors: functional.onStatusColors,
  onMediaColors: structural.onMediaColors,
  dataColorContrast: functional.dataColorContrast,
  onDisabledColors: structural.onDisabledColors,
} as const;
type Roots = Record<string, Record<string, string>>;
const currentRoots = (): Roots => structuredClone(ROOTS) as Roots;
const TOKEN = new RegExp(`\\b(?:${Object.keys(ROOTS).join('|')})\\.\\w+`, 'g');
const resolve = (token: string, roots: Roots) => {
  const [root, key] = token.split('.') as [string, string];
  const value = roots[root]?.[key];
  if (typeof value !== 'string') throw new Error(`${token} no resuelve`);
  return value;
};
/** Fragmento migrado → original: cada token vuelve a su literal entre comillas, con su formato exacto. */
const sourceOf = (to: string, roots: Roots) => to.replace(TOKEN, (token) => `'${resolve(token, roots)}'`);
const restoreLine = (migrated: string, replacements: Replacement[], roots: Roots) =>
  replacements.reduce((line, { to }) => line.split(to).join(sourceOf(to, roots)), migrated);
const restoredSha = (name: string, file: string, entry: WhiteFileFixture, roots: Roots) => {
  const lines = Object.fromEntries(
    Object.entries(entry.lines).map(([n, line]) => [n, line.importMerge ? line : { ...line, original: restoreLine(line.migrated, line.replacements, roots) }]),
  );
  return sha256(revertMinor(asOfBlock(name, file), { ...entry, lines }));
};

/** Literales por subbloque y por formato: W1 = contraste sobre azul de marca o primario (D-B1, opción A). */
const BLOCK_SCOPE: Record<string, { files: number; formats: Record<string, number> }> = {
  'whites.w1.baseline.json': { files: 7, formats: { "'#fff'": 9, "'#ffffff'": 2, "'white'": 1 } },
  // W2 = superficies y filas (D-B2, por subrol).
  'whites.w2.baseline.json': { files: 19, formats: { "'#fff'": 32, "'#ffffff'": 18 } },
  // W3 = contraste sobre colores de estado y de terceros (rol E) y el icono sobre la insignia de imagen (F).
  'whites.w3.baseline.json': { files: 7, formats: { "'#fff'": 4, "'#ffffff'": 4, "'white'": 3 } },
  // W3b = iconos sobre adjuntos de imagen o video (rol F), en otro módulo que W3.
  'whites.w3b.baseline.json': { files: 1, formats: { "'white'": 2 } },
  // W4 = foreground blanco sobre colores que vienen de BD (D-B3).
  'whites.w4.baseline.json': { files: 4, formats: { "'#fff'": 2, "'#ffffff'": 3 } },
  // W5 = encabezado del grid de Oportunidades, cuyo fondo es el azul de marca: mismo rol que W1.
  'whites.w5.baseline.json': { files: 1, formats: { "'#ffffff'": 7 } },
  // W6 = los dos excluidos de W1: deshabilitado sobre gris y spinner en un botón de advertencia.
  'whites.w6.baseline.json': { files: 2, formats: { "'#fff'": 1, "'white'": 1 } },
};

test('cada subbloque tiene alcance declarado, por formato', () => {
  assert.deepEqual(Object.keys(BLOCK_SCOPE), [...WHITE_ORDER]);
  for (const { name, fixture } of blocks) {
    assert.equal(Object.keys(fixture.files).length, BLOCK_SCOPE[name]!.files, name);
    const formats: Record<string, number> = {};
    for (const { from, times } of Object.values(fixture.files).flatMap((e) => Object.values(e.lines)).flatMap((l) => l.replacements)) {
      for (const [literal] of from.matchAll(/'(?:#fff|#ffffff|white)'/g)) formats[literal] = (formats[literal] ?? 0) + times;
    }
    assert.deepEqual(formats, BLOCK_SCOPE[name]!.formats, name);
  }
});

test('paridad: los tokens conservan exactamente cada formato y no dependen de la marca', () => {
  assert.deepEqual({ ...structural.onPrimaryColors }, { text: '#fff', textLong: '#ffffff', progress: 'white' });
  assert.ok(!/from '\.\/brand\//.test(readText('./structural.ts')));
  // Fijos aunque el azul de marca sea otro (D-B1 A): no se derivan de `emphasysBrand`.
  assert.ok(!JSON.stringify(structural.onPrimaryColors).includes(emphasysBrand.colors.blue.base));
});

test('equivalencia contra HEAD: restaurar cada archivo reproduce el previo byte a byte', () => {
  for (const { name, fixture } of blocks) {
    for (const [file, entry] of Object.entries(fixture.files)) {
      assert.equal(sha256(revertMinor(asOfBlock(name, file), entry)), entry.headSha256, `${name} ${file}`);
    }
  }
});

test('transformación: cada token reproduce su literal y su formato', () => {
  const roots = currentRoots();
  for (const { name, file, n, original, migrated, replacements, importMerge } of allLines()) {
    if (importMerge) {
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
      assert.equal(sourceOf(to, roots), from, `${name} ${file}:${n}: ${to} reproduce "${from}"`);
      out = out.split(from).join(to);
    }
    assert.equal(out, migrated, `${name} ${file}:${n}`);
  }
});

test('W1: cada reemplazo es contraste sobre azul de marca o primario', () => {
  const background = /activeBrand\.colors\.blue\.base|'primary\.main'|theme\.emphasys\.action\.primary|variant="contained"/;
  for (const { name, file, n, migrated, importMerge } of allLines()) {
    if (importMerge || name !== 'whites.w1.baseline.json') continue;
    // Fondo primario en el mismo bloque `sx` o el contiguo: la línea, las 10 anteriores o las 4 siguientes (o el botón contenedor).
    const context = contextOf(name, file, n, 10, 4);
    assert.match(context, background, `${file}:${n} no está sobre azul o primario`);
  }
});

test('W2: cada reemplazo es un fondo (superficie o fila) y cada subrol conserva su formato', () => {
  for (const { name, file, n, migrated, replacements, importMerge } of allLines()) {
    if (importMerge || name !== 'whites.w2.baseline.json') continue;
    // La propiedad puede estar en la línea o en las dos anteriores (`bgcolor:` partido en ternarios).
    // `filaBase` (DocumentosFormPage) es el fondo de la fila de partidas: se aplica como `bgcolor` más abajo.
    const context = contextOf(name, file, n, 2, 0);
    assert.match(context, /backgroundColor|bgcolor|background:|return index % 2|const filaBase =/, `${file}:${n} no es un fondo`);
    for (const { to } of replacements) assert.match(to, /^whiteSurfaces\.\w+$/, `${file}:${n}`);
  }
  assert.deepEqual(
    Object.fromEntries(Object.entries(structural.whiteSurfaces).map(([key, value]) => [key, value])),
    {
      panel: '#fff',
      totalsPanel: '#ffffff',
      floatingSummary: '#fff',
      mobileEmptyState: '#fff',
      mobileListCard: '#ffffff',
      mobileList: '#fff',
      activityDrawer: '#ffffff',
      controlIdle: '#fff',
      outlineButton: '#ffffff',
      floatingButton: '#ffffff',
      imageThumb: '#ffffff',
      tableRow: '#fff',
      treasuryRowAlt: '#ffffff',
    },
  );
});

test('W3: cada reemplazo es contraste sobre su color funcional, de tercero o de imagen', () => {
  // Fondo esperado de cada token, en la línea o hasta 3 líneas alrededor.
  const background: Record<string, RegExp> = {
    'onStatusColors.environmentProduction': /environmentColors\.productionBackground/,
    'onStatusColors.whatsapp': /thirdPartyColors\.whatsapp/,
    'onStatusColors.leadFilterChip': /leadFilterChipColors\.activeBackground/,
    'onStatusColors.leadViewToggle': /backgroundColor: vistaFinalizadas \? 'text\.secondary'/,
    'onStatusColors.temperature': /temperaturaColor\(/,
    'onMediaColors.badgeIcon': /overlayColors\.media\.imageBadge/,
    'onMediaColors.icon': /position: 'absolute'/,
  };
  for (const { name, file, n, migrated, replacements, importMerge } of allLines()) {
    if (importMerge || !['whites.w3.baseline.json', 'whites.w3b.baseline.json'].includes(name)) continue;
    const context = contextOf(name, file, n, 6, 3);
    for (const { to } of replacements) {
      for (const token of to.match(TOKEN) ?? []) assert.match(context, background[token]!, `${file}:${n}: ${token} sin su fondo`);
    }
  }
  assert.deepEqual(
    { ...functional.onStatusColors },
    { environmentProduction: '#fff', whatsapp: 'white', leadFilterChip: '#ffffff', leadViewToggle: '#ffffff', temperature: '#fff', warningProgress: 'white' },
  );
  assert.deepEqual({ ...structural.onMediaColors }, { icon: 'white', badgeIcon: '#fff' });
  assert.ok(!/from '\.\/brand\//.test(readText('./functional.ts')));
});

test('W4: solo se extrae el foreground; los colores de BD y sus fallbacks siguen siendo datos', () => {
  assert.deepEqual({ ...functional.dataColorContrast }, { tagChipForeground: '#fff', stageLight: '#ffffff' });
  // El chip sigue pintando el color guardado en la etiqueta.
  assert.match(readText('../components/leads/LeadDetailPanel.tsx'), /bgcolor: tag\.color,\n\s+color: dataColorContrast\.tagChipForeground,/);
  // El contraste se sigue calculando contra el color de etapa, con su par oscuro.
  for (const file of ['../components/produccion/ProduccionDetalleDrawer.tsx', '../pages/DocumentosPage.tsx', '../pages/ProduccionPage.tsx']) {
    assert.match(readText(file), /return contrastWithWhite >= contrastWithDark \? dataColorContrast\.stageLight : neutralColors\.gray\[900\];/, file);
  }
  // Los fallbacks del color de etapa siguen literales, con los mismos usos que en HEAD.
  const fallbacks = (file: string) => readText(file).split("|| '#e5e7eb'").length - 1;
  assert.equal(fallbacks('../components/produccion/ProduccionDetalleDrawer.tsx'), 2);
  assert.equal(fallbacks('../pages/DocumentosPage.tsx'), 2);
  assert.equal(fallbacks('../pages/ProduccionPage.tsx'), 1);
  // Ningún reemplazo de W4 toca un color de fondo.
  for (const { name, replacements } of allLines()) {
    if (name !== 'whites.w4.baseline.json') continue;
    for (const { from, to } of replacements) {
      assert.doesNotMatch(from, /tag\.color|etapa_color|#e5e7eb/i, from);
      assert.match(to, /^.*dataColorContrast\.(tagChipForeground|stageLight).*$/);
    }
  }
});

test('W5: el encabezado del grid de Oportunidades tiene fondo azul de marca y todo su texto usa onPrimaryColors.textLong', () => {
  const source = readText('../pages/OportunidadesPage.tsx');
  assert.match(source, /'& \.MuiDataGrid-columnHeader': \{\n\s+backgroundColor: activeBrand\.colors\.blue\.base,\n\s+color: onPrimaryColors\.textLong,/);
  assert.equal(source.split('onPrimaryColors.textLong').length - 1, 7);
  assert.equal(source.split("'#ffffff'").length - 1, 0);
  // Las 7 líneas están dentro de los selectores del encabezado, entre `columnHeaders` y `columnSeparator`.
  const w5 = blocks.find((block) => block.name === 'whites.w5.baseline.json')!;
  const entry = w5.fixture.files['pages/OportunidadesPage.tsx']!;
  const lines = asOfBlock(w5.name, 'pages/OportunidadesPage.tsx').split('\n');
  const start = lines.findIndex((line) => line.includes("'& .MuiDataGrid-columnHeaders': {"));
  const end = lines.findIndex((line, i) => i > start && line.includes("'& .MuiDataGrid-columnSeparator': {"));
  assert.ok(start >= 0 && end > start);
  for (const [n, line] of Object.entries(entry.lines)) {
    if (line.importMerge) continue;
    const index = Number(n) - 1 + entry.addedImports.length;
    assert.equal(lines[index], line.migrated, n);
    assert.ok(index > start && index < end, `línea ${n} fuera del encabezado`);
  }
});

test('mutación: alterar el formato o el valor de un token rompe la equivalencia de cada archivo que lo usa', () => {
  const alternatives: Record<string, string> = { '#fff': '#ffffff', '#ffffff': '#fff', white: '#fff' };
  for (const [root, values] of Object.entries(ROOTS)) {
    for (const key of Object.keys(values)) {
      const roots = currentRoots();
      roots[root]![key] = alternatives[roots[root]![key]!]!;
      let checked = 0;
      for (const { name, fixture } of blocks) {
        for (const [file, entry] of Object.entries(fixture.files)) {
          if (!Object.values(entry.lines).some((line) => line.replacements.some(({ to }) => (to.match(TOKEN) ?? []).includes(`${root}.${key}`)))) continue;
          assert.notEqual(restoredSha(name, file, entry, roots), entry.headSha256, `${file} debe detectar ${root}.${key}`);
          checked++;
        }
      }
      assert.ok(checked > 0, `${root}.${key} se usa`);
    }
  }
});

test('W6: los dos excluidos de W1 tienen su propio rol, distinto del contraste sobre primario', () => {
  // Deshabilitado sobre gris: no sigue al primario aunque comparta línea con `onPrimaryColors.text`.
  assert.match(
    readText('../components/documentos/facturas/FacturaResumenFlotante.tsx'),
    /'&\.Mui-disabled': \{ bgcolor: neutralColors\.steel\.controlBorder, color: onDisabledColors\.text \}/,
  );
  // Spinner dentro del botón contenedor de advertencia.
  const conciliacion = readText('../pages/finanzas/ConciliacionBancariaPage.tsx');
  assert.match(conciliacion, /color="warning"[\s\S]{0,400}<CircularProgress size=\{18\} sx=\{\{ color: onStatusColors\.warningProgress \}\} \/>/);
  assert.deepEqual({ ...structural.onDisabledColors }, { text: '#fff' });
});

test('cierre global de blancos: fuera de theme/ y del legado no queda ningún blanco escrito a mano', () => {
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
  const legacy = ['components/Layout.tsx', 'components/Menu.tsx', 'components/Sidebar.tsx', 'components/SecondaryNav.tsx'];
  const remaining = files
    .filter((file) => !legacy.includes(file))
    .flatMap((file) => [...readText(`../${file}`).matchAll(/(['"`])(#fff|#ffffff|white)\1|#fff(?:fff)?\b/gi)].map(([match]) => `${file}: ${match}`));
  assert.deepEqual(remaining, []);
  // `common.white` (palette de MUI) sigue fuera de alcance y no se cuenta.
});
