import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { activeBrand } from './brand/active.ts';
import { emphasysBrand } from './brand/emphasys.ts';
import { neutralColors } from './structural.ts';

const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

type Entry = { hex: string; token: string };
/** HEAD cdfd082: hash de cada archivo, imports agregados y token de cada literal. */
const baseline: {
  files: Record<string, { headSha256: string; addedImports: string[]; lines: Record<string, Entry[]>; keptLiteral: Record<string, number> }>;
} = JSON.parse(readText('./__fixtures__/neutralColors.baseline.json'));

type Sources = { neutralColors: unknown; activeBrand: unknown };
const current: Sources = { neutralColors, activeBrand };

// Solo colores: `activeBrand.name` (PE-105) también aparece en estos archivos y no es de este bloque.
const TOKEN = /neutralColors(?:\.[a-zA-Z]+|\[\d+\])+|activeBrand\.colors(?:\.[a-zA-Z]+)+/g;
const resolve = (token: string, sources: Sources): string => {
  const [, root, rest] = /^(neutralColors|activeBrand)(.*)$/.exec(token)!;
  const value = [...rest!.matchAll(/\.([a-zA-Z]+)|\[(\d+)\]/g)].reduce<unknown>(
    (node, [, key, index]) => (node as Record<string, unknown>)[key ?? index!],
    sources[root as keyof Sources],
  );
  assert.equal(typeof value, 'string', `${token} no existe`);
  return value as string;
};

/** Deshace la migración: tokens a literales, plantillas a strings y quita los imports. */
function revert(source: string, addedImports: string[], sources: Sources): string {
  let out = source.replace(/`([^`]*\$\{(?:neutralColors|activeBrand\.colors)[^`]*)`/g, (_, body: string) =>
    `'${body.replace(/\$\{([^}]+)\}/g, (_m, token: string) => resolve(token, sources))}'`,
  );
  out = out.replace(TOKEN, (token) => `'${resolve(token, sources)}'`);
  for (const line of addedImports) out = out.replace(`${line}\n`, '');
  return out;
}

const entries = () => Object.entries(baseline.files);

test('cada token resuelve exactamente al literal que reemplazó', () => {
  for (const [file, { lines }] of entries()) {
    for (const [line, list] of Object.entries(lines)) {
      for (const { hex, token } of list) assert.equal(resolve(token, current), hex, `${file}:${line} ${token}`);
    }
  }
});

test('equivalencia contra HEAD: revertir reproduce cada archivo byte a byte', () => {
  for (const [file, { headSha256, addedImports }] of entries()) {
    assert.equal(sha256(revert(readText(`../${file}`), addedImports, current)), headSha256, file);
  }
});

test('mutación: alterar cualquier valor usado rompe la equivalencia', () => {
  const used = new Set(entries().flatMap(([, { lines }]) => Object.values(lines).flat().map((e) => e.token)));
  for (const token of used) {
    const mutated = structuredClone(current) as Sources;
    const [, root, rest] = /^(neutralColors|activeBrand)(.*)$/.exec(token)!;
    const keys = [...rest!.matchAll(/\.([a-zA-Z]+)|\[(\d+)\]/g)].map(([, key, index]) => key ?? index!);
    const parent = keys.slice(0, -1).reduce<Record<string, unknown>>(
      (node, key) => node[key] as Record<string, unknown>,
      mutated[root as keyof Sources] as Record<string, unknown>,
    );
    const value = parent[keys.at(-1)!] as string;
    parent[keys.at(-1)!] = `${value.slice(0, -1)}${value.endsWith('0') ? '1' : '0'}`;
    for (const [file, { headSha256, addedImports, lines }] of entries()) {
      if (!Object.values(lines).flat().some((e) => e.token === token)) continue;
      assert.notEqual(sha256(revert(readText(`../${file}`), addedImports, mutated)), headSha256, `${file} no detectó ${token}`);
    }
  }
});

test('en los archivos migrados solo quedan los literales excluidos a propósito', () => {
  for (const [file, { lines, keptLiteral }] of entries()) {
    const hexes = new Set(Object.values(lines).flat().map((e) => e.hex));
    const remaining: Record<string, number> = {};
    for (const [hex] of readText(`../${file}`).matchAll(/#[0-9a-fA-F]{6}/g)) {
      const value = hex.toLowerCase();
      if (hexes.has(value)) remaining[value] = (remaining[value] ?? 0) + 1;
    }
    assert.deepStrictEqual(remaining, keptLiteral, file);
  }
  // Degradado decorativo de VersionUpdateDrawer: pendiente con el resto de degradados.
  assert.deepStrictEqual(baseline.files['components/VersionUpdateDrawer.tsx']?.keptLiteral, { '#1d2f68': 1 });
});

test('el azul de los componentes compartidos sale de la marca activa', () => {
  assert.equal(activeBrand.colors.blue.base, '#1d2f68');
  assert.equal(activeBrand.colors.blue.hover, '#162551');
  const brandTokens = entries().flatMap(([, { lines }]) => Object.values(lines).flat()).filter((e) => e.token.startsWith('activeBrand'));
  assert.ok(brandTokens.length > 0);
  for (const { hex } of brandTokens) assert.ok([emphasysBrand.colors.blue.base, emphasysBrand.colors.blue.hover].includes(hex));
});

test('los neutrales estructurales no dependen de la marca ni coinciden con ella', () => {
  assert.ok(!/from '\.\/brand\//.test(readText('./structural.ts')), 'structural.ts no debe importar la marca');
  const brandValues = new Set(JSON.stringify(emphasysBrand.colors).match(/#[0-9a-f]{6}/g));
  for (const value of JSON.stringify(neutralColors).match(/#[0-9a-f]{6}/g) ?? []) {
    assert.ok(!brandValues.has(value), `${value} no debe venir de la marca`);
  }
});

test('el legado sin importadores y el color por defecto de BD quedan fuera', () => {
  for (const file of ['components/Sidebar.tsx', 'components/SecondaryNav.tsx', 'components/Layout.tsx', 'components/Menu.tsx']) {
    assert.ok(!(file in baseline.files), `${file} es legado y no se migra`);
  }
  assert.ok(readText('../components/DynamicFieldControl.tsx').includes("const COLOR_POR_DEFECTO = '#000000';"));
});
