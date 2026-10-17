import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { emphasysBrand } from './brand/emphasys.ts';
import { accountingColors, alertColors, thirdPartyColors } from './functional.ts';

const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

type Entry = { hex: string; token: string };
/** HEAD fba1a1d: hash de cada archivo, import agregado y token que reemplaza cada literal. */
const baseline: {
  files: Record<string, { headSha256: string; addedImport: string | null; lines: Record<string, Entry[]> }>;
} = JSON.parse(readText('./__fixtures__/crmColors.baseline.json'));

type Palette = {
  caution: Record<string, string>;
  positive: Record<string, string>;
  whatsapp: string;
};
const current: Palette = { caution: alertColors.caution, positive: alertColors.positive, whatsapp: thirdPartyColors.whatsapp };

const TOKEN = /alertColors\.(caution|positive)\[(\d+)\]|thirdPartyColors\.whatsapp/g;
const resolve = (token: string, palette: Palette): string => {
  if (token === 'thirdPartyColors.whatsapp') return palette.whatsapp;
  const [, family, step] = /alertColors\.(caution|positive)\[(\d+)\]/.exec(token)!;
  return palette[family as 'caution' | 'positive'][step!]!;
};

/** Deshace la migración: tokens a literales y quita el import agregado. */
const revert = (source: string, addedImport: string | null, palette: Palette) => {
  const reverted = source.replace(TOKEN, (token) => `'${resolve(token, palette)}'`);
  return addedImport ? reverted.replace(`${addedImport}\n`, '') : reverted;
};

test('cada token resuelve exactamente al literal que reemplazó', () => {
  for (const [file, { lines }] of Object.entries(baseline.files)) {
    for (const [line, entries] of Object.entries(lines)) {
      for (const { hex, token } of entries) assert.equal(resolve(token, current), hex, `${file}:${line} ${token}`);
    }
  }
});

test('equivalencia contra HEAD: revertir los tokens reproduce cada archivo byte a byte', () => {
  for (const [file, { headSha256, addedImport }] of Object.entries(baseline.files)) {
    assert.equal(sha256(revert(readText(`../${file}`), addedImport, current)), headSha256, file);
  }
});

test('mutación: alterar cualquier tono usado rompe la equivalencia de los archivos que lo usan', () => {
  const used = new Set(Object.values(baseline.files).flatMap(({ lines }) => Object.values(lines).flat().map((e) => e.token)));
  for (const token of used) {
    const value = resolve(token, current);
    const flip = `${value.slice(0, -1)}${value.endsWith('0') ? '1' : '0'}`;
    const mutated: Palette =
      token === 'thirdPartyColors.whatsapp'
        ? { ...current, whatsapp: flip }
        : (() => {
            const [, family, step] = /alertColors\.(caution|positive)\[(\d+)\]/.exec(token)!;
            const key = family as 'caution' | 'positive';
            return { ...current, [key]: { ...current[key], [step!]: flip } };
          })();
    for (const [file, { headSha256, addedImport, lines }] of Object.entries(baseline.files)) {
      if (!Object.values(lines).flat().some((e) => e.token === token)) continue;
      assert.notEqual(sha256(revert(readText(`../${file}`), addedImport, mutated)), headSha256, `${file} no detectó ${token}`);
    }
  }
});

test('ningún archivo migrado conserva literales del bloque', () => {
  const targets = new Set([...Object.values(alertColors.caution), ...Object.values(alertColors.positive)]);
  for (const file of Object.keys(baseline.files)) {
    const source = readText(`../${file}`);
    const literals = [...source.matchAll(/#[0-9a-fA-F]{6}/g)].map(([hex]) => hex.toLowerCase()).filter((hex) => targets.has(hex));
    assert.deepStrictEqual(literals, [], file);
  }
});

test('las insignias de WhatsApp usan el verde oficial y los defaults guardados en BD siguen literales', () => {
  for (const file of ['components/leads/LeadsDesktopView.tsx', 'components/leads/LeadsMobileView.tsx']) {
    const source = readText(`../${file}`);
    assert.ok(!source.includes('#25D366'), file);
    assert.equal(source.match(/thirdPartyColors\.whatsapp/g)?.length, 1, file);
  }
  const leads = readText('../pages/LeadsPage.tsx');
  assert.equal(leads.match(/thirdPartyColors\.whatsapp/g)?.length, 1, 'solo la insignia de LeadsPage');
  // Color inicial de etiquetas nuevas: se guarda en BD, no es tema.
  assert.equal(leads.match(/'#25D366'/g)?.length, 8);
  assert.equal(readText('../pages/configuracion/WhatsappEtiquetasPage.tsx').match(/'#25D366'/g)?.length, 1);
  assert.equal(thirdPartyColors.whatsapp, '#25D366');
});

test('cada archivo importa la capa funcional una sola vez', () => {
  for (const file of Object.keys(baseline.files)) {
    const imports = readText(`../${file}`).match(/^import \{[^}]*\} from '[^']*theme\/functional';$/gm) ?? [];
    assert.equal(imports.length, 1, file);
  }
});

test('positive (emerald) es una familia propia, distinta de success y ajena a la marca', () => {
  const success = new Set<string>(Object.values(alertColors.success));
  for (const value of Object.values(alertColors.positive)) assert.ok(!success.has(value));
  // Mismo valor que el panel contable favorable, otro significado: no se fusionan.
  assert.equal(alertColors.positive[50], accountingColors.favorable.surface);
  const brandValues = new Set(JSON.stringify(emphasysBrand.colors).match(/#[0-9a-f]{6}/g));
  for (const value of [...Object.values(alertColors.positive), ...Object.values(alertColors.caution)]) {
    assert.ok(!brandValues.has(value), `${value} no debe venir de la marca`);
  }
});
