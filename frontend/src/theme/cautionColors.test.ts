import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { LATER_FIXTURES, revertLater, type LaterFixtures } from './__fixtures__/colorMigrations.ts';
import { emphasysBrand } from './brand/emphasys.ts';
import { alertColors } from './functional.ts';

const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

/** Bloques posteriores que también tocan estos archivos: se revierten primero, del más nuevo al más viejo. */
const laterFixtures: LaterFixtures = Object.fromEntries(
  LATER_FIXTURES
    .filter((name) => existsSync(new URL(`./__fixtures__/${name}`, import.meta.url)))
    .map((name) => [name, JSON.parse(readText(`./__fixtures__/${name}`))]),
);
const withoutNeutral = (file: string) => revertLater(null, file, readText(`../${file}`), laterFixtures);
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

type Entry = { hex: string; token: string };
/** HEAD adc312d: hash de cada archivo y el token que reemplaza cada literal naranja. */
const baseline: { files: Record<string, { headSha256: string; lines: Record<string, Entry[]> }> } = JSON.parse(
  readText('./__fixtures__/cautionColors.baseline.json'),
);

const caution: Record<string, string> = alertColors.caution;
const TOKEN = /alertColors\.caution\[(\d+)\]/g;

/** Deshace la migración: cada token vuelve a ser el literal que resuelve `scale`. */
const revert = (source: string, scale: Record<string, string>) =>
  source.replace(TOKEN, (_, step: string) => `'${scale[step]}'`);

test('cada token naranja resuelve exactamente al literal que reemplazó', () => {
  for (const [file, { lines }] of Object.entries(baseline.files)) {
    for (const [line, entries] of Object.entries(lines)) {
      for (const { hex, token } of entries) {
        const step = /\[(\d+)\]/.exec(token)?.[1];
        assert.equal(step && caution[step], hex, `${file}:${line} ${token}`);
      }
    }
  }
});

test('equivalencia contra HEAD: revertir los tokens reproduce cada archivo byte a byte', () => {
  for (const [file, { headSha256 }] of Object.entries(baseline.files)) {
    assert.equal(sha256(revert(withoutNeutral(file), caution)), headSha256, file);
  }
});

test('mutación: alterar cualquier tono de la escala rompe la equivalencia', () => {
  // Solo los tonos que usan los archivos de este bloque (50 y 300 los usa el bloque CRM).
  const usedSteps = new Set(Object.values(baseline.files).flatMap(({ lines }) => Object.values(lines).flat().map((e) => /\[(\d+)\]/.exec(e.token)![1]!)));
  for (const step of usedSteps) {
    const mutated = { ...caution, [step]: `${caution[step]!.slice(0, -1)}0` };
    const affected = Object.entries(baseline.files).filter(([, { lines }]) =>
      Object.values(lines).flat().some((entry) => entry.token === `alertColors.caution[${step}]`),
    );
    assert.ok(affected.length > 0, `caution[${step}] no se usa`);
    for (const [file, { headSha256 }] of affected) {
      assert.notEqual(sha256(revert(withoutNeutral(file), mutated)), headSha256, `${file} no detectó caution[${step}]`);
    }
  }
});

test('cada archivo usa los tokens naranja tantas veces como literales tenía y no conserva ninguno', () => {
  const hexes = new Set(Object.values(caution));
  for (const [file, { lines }] of Object.entries(baseline.files)) {
    const source = readText(`../${file}`);
    assert.equal([...source.matchAll(TOKEN)].length, Object.values(lines).flat().length, file);
    const literals = [...source.matchAll(/#[0-9a-fA-F]{6}/g)].filter(([hex]) => hexes.has(hex.toLowerCase()));
    assert.equal(literals.length, 0, `${file} conserva literales naranja`);
  }
});

test('los archivos de CRM no son de este bloque: los cubre el bloque CRM', () => {
  const crm: { files: Record<string, unknown> } = JSON.parse(readText('./__fixtures__/crmColors.baseline.json'));
  for (const file of [
    'pages/OportunidadesPage.tsx',
    'hooks/useSeguimientoActividades.ts',
    'components/crm/ActividadSeguimientoDrawer.tsx',
  ]) {
    assert.ok(!(file in baseline.files), `${file} no debe estar en el fixture naranja`);
    assert.ok(file in crm.files, `${file} debe estar en el fixture CRM`);
  }
});

test('caution es una familia propia: distinta de warning y ajena a la marca', () => {
  const warning = new Set<string>(Object.values(alertColors.warning));
  for (const value of Object.values(caution)) assert.ok(!warning.has(value));
  const brandValues = new Set(JSON.stringify(emphasysBrand.colors).match(/#[0-9a-f]{6}/g));
  for (const value of Object.values(caution)) assert.ok(!brandValues.has(value), `${value} no debe venir de la marca`);
});
