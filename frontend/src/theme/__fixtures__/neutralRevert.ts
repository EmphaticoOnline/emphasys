import { activeBrand } from '../brand/active.ts';
import { neutralColors } from '../structural.ts';

/**
 * Reversión de los bloques de neutrales y azul de marca (`neutralColors*.baseline.json`).
 * La usan sus pruebas de equivalencia y las de bloques anteriores que comparten
 * archivo, para comprobar cada bloque sin que el siguiente lo invalide.
 */
export type NeutralEntry = { hex: string; token: string };
export type NeutralFileFixture = {
  headSha256: string;
  addedImports: string[];
  lines: Record<string, NeutralEntry[]>;
  keptLiteral: Record<string, number>;
};
export type NeutralFixture = { source: string; files: Record<string, NeutralFileFixture> };
export type NeutralSources = { neutralColors: unknown; activeBrand: unknown };

export const currentNeutralSources: NeutralSources = { neutralColors, activeBrand };

/** Solo colores: `activeBrand.name` (PE-105) también aparece en algunos archivos. */
export const NEUTRAL_TOKEN = /neutralColors(?:\.[a-zA-Z]+|\[\d+\])+|activeBrand\.colors(?:\.[a-zA-Z]+)+/g;

export function tokenPath(token: string): { root: keyof NeutralSources; keys: string[] } {
  const match = /^(neutralColors|activeBrand)(.*)$/.exec(token);
  if (!match) throw new Error(`Token no reconocido: ${token}`);
  const keys = [...match[2]!.matchAll(/\.([a-zA-Z]+)|\[(\d+)\]/g)].map(([, key, index]) => (key ?? index)!);
  return { root: match[1] as keyof NeutralSources, keys };
}

export function resolveNeutralToken(token: string, sources: NeutralSources = currentNeutralSources): string {
  const { root, keys } = tokenPath(token);
  const value = keys.reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], sources[root]);
  if (typeof value !== 'string') throw new Error(`${token} no resuelve a un color`);
  return value;
}

/** Tokens a literales, plantillas creadas a strings, atributos JSX a `="…"` y quita los imports. */
export function revertNeutral(source: string, addedImports: string[], sources: NeutralSources = currentNeutralSources): string {
  const resolve = (token: string) => resolveNeutralToken(token, sources);
  let out = source.replace(/`([^`]*\$\{(?:neutralColors|activeBrand\.colors)[^`]*)`/g, (_, body: string) =>
    `'${body.replace(/\$\{([^}]+)\}/g, (_m, token: string) => resolve(token))}'`,
  );
  out = out.replace(
    /(\w+)=\{(neutralColors(?:\.[a-zA-Z]+|\[\d+\])+|activeBrand\.colors(?:\.[a-zA-Z]+)+)\}/g,
    (_, attr: string, token: string) => `${attr}="${resolve(token)}"`,
  );
  out = out.replace(NEUTRAL_TOKEN, (token) => `'${resolve(token)}'`);
  for (const line of addedImports) out = out.replace(`${line}\n`, '');
  return out;
}

/** Revierte el bloque neutral que migró `file`, si alguno lo hizo. */
export function revertNeutralFor(file: string, source: string, fixtures: NeutralFixture[]): string {
  const owner = fixtures.find((fixture) => file in fixture.files);
  return owner ? revertNeutral(source, owner.files[file]!.addedImports) : source;
}
