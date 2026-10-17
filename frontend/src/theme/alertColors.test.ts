import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { emphasysBrand } from './brand/emphasys.ts';
import { alertColors, feedbackTokens, inventoryFlowColors, thirdPartyColors } from './functional.ts';

const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
/** Conteo de literales por archivo, extraído de HEAD (632bad8) antes de migrar. */
const baseline: {
  files: Record<string, { migrated: Record<string, number>; keptLiteral: Record<string, number> }>;
} = JSON.parse(readText('./__fixtures__/alertColors.baseline.json'));

type Family = keyof typeof alertColors;
const resolve = (family: string, step: string): string => {
  const scale = alertColors[family as Family] as Record<string, string>;
  const value = scale[step];
  assert.ok(value, `alertColors.${family}[${step}] no existe`);
  return value;
};

/** Familias de este bloque; `caution` (naranja) tiene su propio bloque y prueba. */
const allHexes = new Set([alertColors.success, alertColors.warning, alertColors.error].flatMap((scale) => Object.values(scale)));

function countTokens(source: string) {
  const counts: Record<string, number> = {};
  for (const [, family, step] of source.matchAll(/alertColors\.(success|warning|error)\[(\d+)\]/g)) {
    const hex = resolve(family!, step!);
    counts[hex] = (counts[hex] ?? 0) + 1;
  }
  return counts;
}

function countLiterals(source: string) {
  const counts: Record<string, number> = {};
  for (const [hex] of source.matchAll(/#[0-9a-fA-F]{6}/g)) {
    const value = hex.toLowerCase();
    if (allHexes.has(value)) counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

test('cada archivo migrado resuelve exactamente los mismos colores que tenía en HEAD', () => {
  for (const [file, expected] of Object.entries(baseline.files)) {
    const source = readText(`../${file}`);
    assert.deepStrictEqual(countTokens(source), expected.migrated, file);
  }
});

/** Literales que este bloque dejó y que después migró el bloque contable. */
const accountingBaseline: { files: Record<string, { lines: Record<string, { hex: string }[]> }> } = JSON.parse(
  readText('./__fixtures__/accountingColors.baseline.json'),
);

test('en los archivos migrados solo quedan los literales excluidos a propósito', () => {
  for (const [file, expected] of Object.entries(baseline.files)) {
    const source = readText(`../${file}`);
    const remaining = { ...expected.keptLiteral };
    for (const { hex } of Object.values(accountingBaseline.files[file]?.lines ?? {}).flat()) {
      if (remaining[hex]) remaining[hex] -= 1;
      if (remaining[hex] === 0) delete remaining[hex];
    }
    assert.deepStrictEqual(countLiterals(source), remaining, file);
  }
  // Importes negativos (signo contable, no error): los dejó este bloque y los migró el contable.
  assert.deepStrictEqual(baseline.files['modules/contabilidad/AuxiliaresSatView.tsx']?.keptLiteral, { '#b91c1c': 2 });
  assert.deepStrictEqual(baseline.files['modules/contabilidad/BalanzaXmlView.tsx']?.keptLiteral, { '#b91c1c': 1 });
});

test('cada archivo migrado importa alertColors una sola vez', () => {
  for (const file of Object.keys(baseline.files)) {
    const source = readText(`../${file}`);
    const imports = source.match(/^import \{[^}]*\balertColors\b[^}]*\} from '[^']*theme\/functional';$/gm) ?? [];
    assert.equal(imports.length, 1, file);
  }
});

test('alertColors no tiene valores repetidos entre familias', () => {
  const values = Object.values(alertColors).flatMap((scale) => Object.values(scale));
  assert.equal(new Set(values).size, values.length);
});

test('alertColors es independiente de palette de MUI y de la marca', () => {
  assert.notEqual(alertColors.success[800], feedbackTokens.success.main);
  assert.notEqual(alertColors.error[700], feedbackTokens.error.main);
  assert.notEqual(alertColors.warning[800], feedbackTokens.warning.main);
  const brandValues = new Set(JSON.stringify(emphasysBrand.colors).match(/#[0-9a-f]{6}/g));
  for (const value of allHexes) assert.ok(!brandValues.has(value), `${value} no debe venir de la marca`);
});

test('dirección de inventario y terceros conservan sus tokens propios', () => {
  // Mismo valor que algunos tonos de alerta, otro significado: no se fusionan.
  assert.equal(inventoryFlowColors.inbound, alertColors.success[600]);
  assert.equal(inventoryFlowColors.outbound, alertColors.error[600]);
  assert.equal(thirdPartyColors.whatsapp, '#25D366');
});
