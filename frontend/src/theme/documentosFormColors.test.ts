import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { neutralColors } from './structural.ts';
import {
  convertLine,
  DOCUMENTOS_FORM_ORDER,
  LATER_FIXTURES,
  neutralTokenMap,
  revertLater,
  revertMinor,
  type LaterFixtures,
  type MinorFileFixture,
  type NeutralPalette,
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

test('cada línea migrada es la transformación de su original con los valores actuales de neutralColors', () => {
  const map = neutralTokenMap();
  for (const { name, fixture } of subblocks) {
    for (const { n, original, migrated } of colorLines(fixture)) {
      assert.equal(convertLine(original, map), migrated, `${name} línea ${n}`);
    }
  }
});

test('mutación: alterar cualquier neutral usado rompe la transformación de sus líneas', () => {
  for (const { name, fixture } of subblocks) {
    const used = new Set(colorLines(fixture).flatMap((line) => line.entries.map((e) => e.token)));
    for (const token of used) {
      const palette = structuredClone(neutralColors) as unknown as Record<string, Record<string, string>>;
      const [, family, key] = /^neutralColors\.([a-z]+)(?:\[(\d+)\]|\.([a-zA-Z]+))$/.exec(token)!.filter(Boolean);
      const value = palette[family!]![key!]!;
      palette[family!]![key!] = `${value.slice(0, -1)}${value.endsWith('0') ? '1' : '0'}`;
      const map = neutralTokenMap(palette as unknown as NeutralPalette);
      for (const { n, original, migrated, entries } of colorLines(fixture)) {
        if (!entries.some((e) => e.token === token)) continue;
        assert.notEqual(convertLine(original, map), migrated, `${name} línea ${n} no detectó ${token}`);
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
