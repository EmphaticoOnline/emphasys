import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { alertColors, attachmentIndicatorColors, documentSummaryTones, feedbackTokens, fiscalStatusColors } from './functional.ts';
import { neutralColors } from './structural.ts';
import { emphasysBrand } from './brand/emphasys.ts';
import { brandBlueAlpha, rgbaFromHex } from './brand/derived.ts';
import {
  colorTokenPath,
  colorTokenRoots,
  convertLine,
  DOCUMENTOS_FORM_ORDER,
  entriesTokenMap,
  LATER_FIXTURES,
  revertLater,
  revertMinor,
  type LaterFixtures,
  type MinorFileFixture,
} from './__fixtures__/colorMigrations.ts';

const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

const FILE = 'pages/DocumentosFormPage.tsx';
type SubblockFixture = { source: string; files: Record<string, MinorFileFixture & { keptLiteral: Record<string, number> }> };

/** Un fixture por subbloque (ver docs/white-label-documentosformpage-audit.md), en orden. */
const subblocks = DOCUMENTOS_FORM_ORDER.map((name) => ({
  name,
  fixture: JSON.parse(readText(`./__fixtures__/${name}`)) as SubblockFixture,
}));
const laterFixtures: LaterFixtures = Object.fromEntries(
  LATER_FIXTURES.filter((name) => existsSync(new URL(`./__fixtures__/${name}`, import.meta.url))).map((name) => [
    name,
    JSON.parse(readText(`./__fixtures__/${name}`)),
  ]),
);
/** El archivo tal como lo dejó el subbloque `name`: sin los subbloques posteriores. */
const asOfSubblock = (name: string) => revertLater(name, FILE, readText(`../${FILE}`), laterFixtures);

const colorLines = (fixture: SubblockFixture) =>
  Object.entries(fixture.files[FILE]!.lines)
    .filter(([, line]) => line.entries.length > 0)
    .map(([n, line]) => ({ n, ...line }));

test('cada subbloque solo toca DocumentosFormPage y está en la cadena de migraciones', () => {
  assert.ok(subblocks.length >= 1);
  for (const { name, fixture } of subblocks) {
    assert.deepStrictEqual(Object.keys(fixture.files), [FILE], name);
    assert.ok(LATER_FIXTURES.includes(name), `${name} debe estar en LATER_FIXTURES`);
  }
});

test('equivalencia contra HEAD: restaurar cada subbloque reproduce el archivo previo byte a byte', () => {
  for (const { name, fixture } of subblocks) {
    const entry = fixture.files[FILE]!;
    assert.equal(sha256(revertMinor(asOfSubblock(name), entry)), entry.headSha256, name);
  }
});

test('cada línea migrada es la transformación de su original con los valores actuales de sus tokens', () => {
  for (const { name, fixture } of subblocks) {
    // Cada subbloque convierte solo sus propios valores: los posteriores quedan literales en su texto migrado.
    for (const { n, original, migrated, entries } of colorLines(fixture)) {
      assert.equal(convertLine(original, entriesTokenMap(entries)), migrated, `${name} línea ${n}`);
    }
  }
});

test('mutación: alterar cualquier valor usado rompe la transformación de sus líneas', () => {
  for (const { name, fixture } of subblocks) {
    const used = new Set(colorLines(fixture).flatMap((line) => line.entries.map((e) => e.token)));
    for (const token of used) {
      const roots = colorTokenRoots();
      const path = colorTokenPath(token);
      const parent = path.slice(0, -1).reduce<Record<string, unknown>>((node, key) => node[key] as Record<string, unknown>, roots);
      const value = parent[path.at(-1)!] as string;
      parent[path.at(-1)!] = `${value.slice(0, -1)}${value.endsWith('0') ? '1' : '0'}`;
      for (const { n, original, migrated, entries } of colorLines(fixture)) {
        if (!entries.some((e) => e.token === token)) continue;
        assert.notEqual(convertLine(original, entriesTokenMap(entries, roots)), migrated, `${name} línea ${n} no detectó ${token}`);
      }
    }
  }
});

test('los literales que quedan son exactamente los pendientes de subbloques posteriores', () => {
  for (const { name, fixture } of subblocks) {
    const entry = fixture.files[FILE]!;
    const hexes = new Set(Object.values(entry.lines).flatMap((l) => l.entries.map((e) => e.hex)));
    const remaining: Record<string, number> = {};
    for (const [hex] of asOfSubblock(name).matchAll(/#[0-9a-fA-F]{6}/g)) {
      const value = hex.toLowerCase();
      if (hexes.has(value)) remaining[value] = (remaining[value] ?? 0) + 1;
    }
    assert.deepStrictEqual(remaining, entry.keptLiteral, name);
  }
});

test('subbloque 1: foco de adjuntos, fondo gris MUI y blancos quedan literales', () => {
  const s1 = subblocks.find(({ name }) => name === 'documentosForm.s1.baseline.json')!.fixture.files[FILE]!;
  const migrated = Object.values(s1.lines).map((l) => l.migrated).join('\n');
  // Mismas líneas, fuera de este subbloque (ver informe §2.6 y §2.2).
  assert.equal(migrated.match(/#1565c0/g)?.length, 2, 'foco/selección de adjuntos');
  assert.equal(migrated.match(/#fafafa/g)?.length, 1, 'fondo gris MUI 50');
  assert.equal(migrated.match(/'#fff'/g)?.length, 1, 'blanco');
  // Las dos copias del componente de adjuntos se migran juntas.
  const lines = Object.keys(s1.lines).map(Number);
  assert.ok(lines.some((n) => n < 4300) && lines.some((n) => n > 8700));
});

test('subbloque 2: neutrales sin token, chip fiscal y retención del panel quedan literales', () => {
  const s2 = subblocks.find(({ name }) => name === 'documentosForm.s2.baseline.json')!.fixture.files[FILE]!;
  const migrated = Object.values(s2.lines).map((l) => l.migrated).join('\n');
  // Mismas líneas, para el subbloque 5 (neutrales nuevos).
  assert.equal(migrated.match(/#fafbfd/g)?.length, 1);
  assert.equal(migrated.match(/#0f1626/g)?.length, 1);
  // Mismo rango, otras líneas: estado (chip fiscal) y funcional (retención), subbloques 6 y 7.
  const asOfS2 = asOfSubblock('documentosForm.s2.baseline.json');
  assert.ok(asOfS2.includes("bgcolor: fiscalCompleto ? '#e8f4ee' : '#fdf3e3',"));
  assert.equal(asOfS2.match(/'#9a5b00'/g)?.length, 4);
  for (const n of Object.keys(s2.lines).map(Number)) assert.ok(n > 4250 && n < 4900, `línea ${n} fuera del panel de captura`);
});

test('subbloque 3: el indicador de imagen de partidas (estado) queda literal', () => {
  const s3 = subblocks.find(({ name }) => name === 'documentosForm.s3.baseline.json')!.fixture.files[FILE]!;
  for (const n of Object.keys(s3.lines).map(Number)) assert.ok(n > 4880 && n < 5602, `línea ${n} fuera de partidas`);
  // Con imagen / archivo de producto / sin imagen: es estado y va en el subbloque 6, aunque #6b7280 tenga token.
  const asOfS3 = asOfSubblock('documentosForm.s3.baseline.json');
  const indicator = "partida.archivo_imagen_1 ? '#2e7d32' : partida.producto_archivo_id ? '#1565c0' : '#6b7280'";
  assert.equal(asOfS3.split(indicator).length - 1, 2, 'las dos instancias de partidas (escritorio y móvil)');
  const migratedNumbers = Object.keys(s3.lines).map(Number);
  assert.ok(!migratedNumbers.includes(5184) && !migratedNumbers.includes(5519));
});

test('subbloque 4: tonos del resumen financiero y estados de recepción quedan literales', () => {
  const s4 = subblocks.find(({ name }) => name === 'documentosForm.s4.baseline.json')!.fixture.files[FILE]!;
  for (const n of Object.keys(s4.lines).map(Number)) assert.ok(n > 5601 && n < 8722, `línea ${n} fuera del rango`);
  // Lo que se conserva de los mismos hex es exactamente lo funcional (subbloque 7) y lo de estado (subbloque 6).
  assert.deepStrictEqual(s4.keptLiteral, { '#475569': 1, '#111827': 3, '#334155': 3, '#f1f5f9': 1, '#94a3b8': 1 });
  const asOfS4 = asOfSubblock('documentosForm.s4.baseline.json');
  assert.equal(asOfS4.match(/tone: '#334155'/g)?.length, 3, 'subtotal bruto en los 3 resúmenes');
  assert.equal(asOfS4.match(/tone: '#111827'/g)?.length, 3, 'total en los 3 resúmenes');
  assert.ok(asOfS4.includes("abierta: { label: 'Abierta', bgcolor: '#f1f5f9', color: '#475569' },"));
});

test('subbloque 5: introduce los 11 roles steel del formulario y no deja ninguno de esos valores literal', () => {
  const s5 = subblocks.find(({ name }) => name === 'documentosForm.s5.baseline.json')!.fixture.files[FILE]!;
  const roles = ['ink', 'attachmentSurface', 'softSurface', 'wash', 'panelBand', 'rowStripe', 'dividerStrong', 'taxBorder', 'taxDivider', 'totalsBorder', 'summarySurface'];
  const used = new Set(Object.values(s5.lines).flatMap((l) => l.entries.map((e) => e.token)));
  assert.deepStrictEqual([...used].sort(), roles.map((r) => `neutralColors.steel.${r}`).sort());
  assert.deepStrictEqual(s5.keptLiteral, {});
  const steel = neutralColors.steel as Record<string, string>;
  const asOfS5 = asOfSubblock('documentosForm.s5.baseline.json').toLowerCase();
  for (const role of roles) assert.ok(!asOfS5.includes(steel[role]!), `${role} (${steel[role]}) sigue literal`);
});

test('subbloque 6: estados con token propio; mismo hex con otro significado queda para su subbloque', () => {
  const s6 = subblocks.find(({ name }) => name === 'documentosForm.s6.baseline.json')!.fixture.files[FILE]!;
  // Retención #9a5b00 (subbloque 7) y foco de adjuntos #1565c0 (subbloque 8) quedan literales.
  assert.deepStrictEqual(s6.keptLiteral, { '#1565c0': 6, '#9a5b00': 3 });
  assert.equal(fiscalStatusColors.incompleteText, '#9a5b00');
  assert.equal(attachmentIndicatorColors.productFile, '#1565c0');
  assert.equal(attachmentIndicatorColors.withImage, feedbackTokens.success.main);
  const tokens = Object.values(s6.lines).flatMap((l) => l.entries.map((e) => e.token));
  // El indicador de imagen aparece en 3 lugares (escritorio, móvil, traslado) con los mismos tokens.
  for (const role of ['withImage', 'productFile', 'none']) {
    assert.equal(tokens.filter((t) => t === `attachmentIndicatorColors.${role}`).length, 3, role);
  }
  // Estado de recepción y cantidades: solo tokens existentes de alertas y neutrales.
  const recepcion = Object.entries(s6.lines).filter(([n]) => Number(n) > 8500).flatMap(([, l]) => l.entries.map((e) => e.token));
  assert.ok(recepcion.length === 13 && recepcion.every((t) => t.startsWith('alertColors.') || t.startsWith('neutralColors.')));
});

test('subbloque 7: el resumen financiero conserva los tres tonos de importes negativos', () => {
  const s7 = subblocks.find(({ name }) => name === 'documentosForm.s7.baseline.json')!.fixture.files[FILE]!;
  assert.deepStrictEqual(s7.keptLiteral, {});
  // Sin unificar: ámbar (descuento de partidas, retenciones), naranja (descuento global) y ámbar propio (retención en línea).
  assert.equal(documentSummaryTones.itemDiscount, '#b45309');
  assert.equal(documentSummaryTones.withholding, '#b45309');
  assert.equal(documentSummaryTones.globalDiscount, '#9a3412');
  assert.equal(documentSummaryTones.discount, '#9a3412');
  assert.equal(documentSummaryTones.withholdingInline, '#9a5b00');
  assert.equal(documentSummaryTones.itemDiscount, alertColors.warning[700]);
  assert.equal(documentSummaryTones.net, alertColors.info[700]);
  assert.equal(documentSummaryTones.gross, neutralColors.slate[700]);
  assert.equal(documentSummaryTones.total, neutralColors.gray[900]);
  // Los dos resúmenes completos usan la misma secuencia; el flotante junta los descuentos.
  const byLine = Object.entries(s7.lines).filter(([, l]) => l.entries.length).map(([n, l]) => [Number(n), l.entries[0]!.token] as const);
  const sequence = (from: number, to: number) => byLine.filter(([n]) => n >= from && n <= to).map(([, t]) => t);
  const full = ['gross', 'itemDiscount', 'globalDiscount', 'net', 'tax', 'withholding', 'total'].map((k) => `documentSummaryTones.${k}`);
  assert.deepStrictEqual(sequence(8340, 8360), full);
  assert.deepStrictEqual(sequence(8410, 8430), full);
  assert.deepStrictEqual(sequence(8600, 8615), ['gross', 'discount', 'net', 'tax', 'withholding', 'total'].map((k) => `documentSummaryTones.${k}`));
  assert.equal(byLine.filter(([, t]) => t === 'documentSummaryTones.withholdingInline').length, 3);
});

test('subbloque 8: la sombra con alfa del azul sale de la marca y produce el mismo string', () => {
  const s8 = subblocks.find(({ name }) => name === 'documentosForm.s8.baseline.json')!.fixture.files[FILE]!;
  type ExprLine = { original: string; migrated: string; expressions?: { literal: string; expression: string }[] };
  const exprLines = Object.values(s8.lines as Record<string, ExprLine>).filter((l) => l.expressions?.length);
  assert.equal(exprLines.length, 2);
  for (const { original, migrated, expressions } of exprLines) {
    for (const { literal, expression } of expressions!) {
      const alpha = Number(/^brandBlueAlpha\(([0-9.]+)\)$/.exec(expression)![1]);
      // Transformación: el literal dentro del string pasa a plantilla con la expresión, sin más cambios.
      assert.equal(brandBlueAlpha(alpha), literal);
      assert.equal(migrated, original.replace(`'0 1px 0 ${literal}'`, `\`0 1px 0 \${${expression}}\``));
      // Mutación: otro azul de marca produce otra sombra.
      assert.notEqual(rgbaFromHex('#1d2f69', alpha), literal);
      assert.equal(rgbaFromHex('#000001', alpha), `rgba(0, 0, 1, ${alpha})`);
    }
  }
  assert.equal(emphasysBrand.colors.blue.base, '#1d2f68');
  // El mismo #1565c0 es foco de adjuntos aquí y "archivo de producto" en el subbloque 6: tokens distintos.
  const tokens = Object.values(s8.lines).flatMap((l) => l.entries.map((e) => e.token));
  assert.equal(tokens.filter((t) => t === 'selectionColors.attachmentFocus').length, 6);
  assert.equal(tokens.filter((t) => t === 'moduleAccents.documentSeparator').length, 1);
});

test('cierre: en DocumentosFormPage solo quedan los colores fuera de alcance documentados', () => {
  const source = readText(`../${FILE}`);
  const literals = [...source.matchAll(/#[0-9a-fA-F]{6}\b|'#[0-9a-fA-F]{3}'|rgba?\([^)]*\)/g)].map(([v]) => v.replace(/'/g, '').toLowerCase());
  const count = literals.reduce<Record<string, number>>((acc, v) => ((acc[v] = (acc[v] ?? 0) + 1), acc), {});
  // Informe §2.6: blancos y rgba que no son de marca (17). La sombra del resumen flotante pasó a
  // `elevation.floatingSummary` (elevación E3) y los 6 velos y bordes a `overlayColors` (tintes T4):
  // quedan solo los 10 blancos. Los 5 `#fff` de contraste sobre `primary.main` pasaron a
  // `onPrimaryColors.text` (blancos W1) y las 5 superficies y filas a `whiteSurfaces` (W2):
  // la página ya no tiene colores escritos a mano.
  assert.deepStrictEqual(count, {});
});
