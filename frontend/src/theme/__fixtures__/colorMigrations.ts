import { activeBrand } from '../brand/active.ts';
import {
  activityAccents,
  activityTypeChipColors,
  advanceBoxColors,
  alertColors,
  attachmentIndicatorColors,
  feedbackTokens,
  fiscalStatusColors,
  categoricalPalettes,
  destructiveHoverColors,
  documentSummaryTones,
  environmentColors,
  moduleAccents,
  opportunityBucketColors,
  temperatureColors,
  thirdPartyColors,
} from '../functional.ts';
import { neutralColors, selectionColors } from '../structural.ts';
import { revertNeutral, type NeutralFixture } from './neutralRevert.ts';

/**
 * Registro de los bloques de migración con equivalencia por SHA-256, en orden
 * cronológico. Para verificar un bloque sobre un archivo, primero se revierten
 * los bloques posteriores que también lo tocaron (del más nuevo al más viejo).
 */
export const NEUTRAL_ORDER = [
  'neutralColors.baseline.json',
  'neutralColors.cfdi.baseline.json',
  'neutralColors.documentos.baseline.json',
  'neutralColors.tesoreria.baseline.json',
  'neutralColors.crm.baseline.json',
  'neutralColors.informes.baseline.json',
  'neutralColors.catalogos.baseline.json',
] as const;
export const MINOR_FIXTURE = 'minorColors.baseline.json';
export const REST_FIXTURE = 'restColors.baseline.json';
/** Subbloques de `DocumentosFormPage`, en orden (ver docs/white-label-documentosformpage-audit.md). */
export const DOCUMENTOS_FORM_ORDER = ['documentosForm.s1.baseline.json', 'documentosForm.s2.baseline.json', 'documentosForm.s3.baseline.json', 'documentosForm.s4.baseline.json', 'documentosForm.s5.baseline.json', 'documentosForm.s6.baseline.json', 'documentosForm.s7.baseline.json', 'documentosForm.s8.baseline.json'] as const;
/** Bloques de fuentes de signo (ver docs/white-label-fuentes-de-signo-audit.md), en orden. */
export const SIGN_ORDER = ['signColors.b1.baseline.json', 'signColors.b2.baseline.json', 'signColors.b3.baseline.json', 'signColors.b4.baseline.json'] as const;
/** Bloques de elevación (ver docs/white-label-elevacion-audit.md), en orden. */
export const ELEVATION_ORDER = ['elevation.e1.baseline.json', 'elevation.e2.baseline.json', 'elevation.e3.baseline.json', 'elevation.e4.baseline.json'] as const;
/** Bloques de tintes alfa (ver docs/white-label-tintes-alfa-audit.md), en orden. */
export const TINT_ORDER = ['tints.t1.baseline.json', 'tints.t2.baseline.json', 'tints.t3.baseline.json', 'tints.t4.baseline.json'] as const;
/** Restos R1 (ver docs/white-label-restos-r1-audit.md), en orden. */
export const LEFTOVER_ORDER = ['restos.r1-1.baseline.json', 'restos.r1-2.baseline.json', 'restos.r1-4.baseline.json'] as const;
/** Bloques de blancos (ver docs/white-label-blancos-audit.md), en orden. */
export const WHITE_ORDER = ['whites.w1.baseline.json', 'whites.w2.baseline.json', 'whites.w3.baseline.json', 'whites.w3b.baseline.json', 'whites.w4.baseline.json', 'whites.w5.baseline.json', 'whites.w6.baseline.json'] as const;
/** Decisiones de diseño aplicadas (ver docs/white-label-decisiones-diseno.md), en orden. */
export const DECISION_ORDER = ['decisions.d8.baseline.json', 'decisions.dt3.baseline.json', 'decisions.db4.baseline.json', 'decisions.d1.baseline.json', 'decisions.d2.baseline.json', 'decisions.d4.baseline.json', 'decisions.d6.baseline.json'] as const;
/**
 * Merges de `main` en la rama que tocan archivos de la cadena. No son migraciones:
 * se revierten restaurando el contenido previo completo, y solo si el archivo
 * coincide byte a byte con el resultado registrado del merge.
 */
export const MERGE_ORDER = ['merges.main-8761927.baseline.json'] as const;
/**
 * Identidad visual por empresa, E2: los imports estáticos de la marca pasan a
 * `useBrand()`. No cambian colores; se revierten con un parche exacto de líneas.
 */
export const BRAND_HOOK_ORDER = ['brandHook.e2.baseline.json'] as const;
/**
 * Estandarización de fechas (DD/MM/YYYY): los campos de fecha pasan a `FechaInput`/`FechaHoraInput`.
 * No cambia colores; se revierte con un parche exacto de líneas sobre el contenido previo.
 */
export const DATES_ORDER = ['dates.d1.baseline.json'] as const;
const LATER_CHAIN = [...NEUTRAL_ORDER, MINOR_FIXTURE, REST_FIXTURE, ...DOCUMENTOS_FORM_ORDER, ...SIGN_ORDER, ...ELEVATION_ORDER, ...TINT_ORDER, ...LEFTOVER_ORDER, ...WHITE_ORDER, ...DECISION_ORDER, ...MERGE_ORDER, ...BRAND_HOOK_ORDER, ...DATES_ORDER] as const;
/** Todos los fixtures de la cadena, en orden: las pruebas cargan esta lista, no una copia. */
export const LATER_FIXTURES: readonly string[] = LATER_CHAIN;

// ── Bloque de pendientes menores (revertido por línea) ─────────────────────────

export type MinorEntry = { hex: string; token: string };
export type MinorLine = { original: string; migrated: string; entries: MinorEntry[] };
export type MinorSnippet = { original: string; migrated: string; token: string };
export type MinorFileFixture = {
  headSha256: string;
  addedImports: string[];
  lines: Record<string, MinorLine>;
  snippets: Record<string, MinorSnippet>;
};
export type MinorFixture = { source: string; files: Record<string, MinorFileFixture> };

export type MinorPalettes = {
  alertColors: { info: Record<string, string>; open: Record<string, string> };
  selectionColors: Record<string, string>;
  thirdPartyColors: Record<string, string>;
  destructiveHoverColors: Record<string, string>;
  activityAccents: Record<string, string>;
  activeBrand: { colors: { blue: { tint: string }; ink: { muted: string } } };
};

export const currentMinorPalettes = (): MinorPalettes => ({
  alertColors: { info: { ...alertColors.info }, open: { ...alertColors.open } },
  selectionColors: { ...selectionColors },
  thirdPartyColors: {
    pdf: thirdPartyColors.pdf,
    pdfHover: thirdPartyColors.pdfHover,
    whatsappRead: thirdPartyColors.whatsappRead,
    whatsappDelivered: thirdPartyColors.whatsappDelivered,
  },
  destructiveHoverColors: { ...destructiveHoverColors },
  activityAccents: { ...activityAccents },
  activeBrand: { colors: { blue: { tint: activeBrand.colors.blue.tint }, ink: { muted: activeBrand.colors.ink.muted } } },
});

export const minorSnippetValues = { categoricalPalettes } as const;

/** hex (minúsculas) → token, construido desde los valores de la paleta. */
export function minorTokenMap(p: MinorPalettes): Record<string, string> {
  const map: Record<string, string> = {};
  const add = (hex: string, token: string) => {
    const key = hex.toLowerCase();
    if (map[key]) throw new Error(`${hex} repetido: ${map[key]} y ${token}`);
    map[key] = token;
  };
  for (const [step, hex] of Object.entries(p.alertColors.info)) add(hex, `alertColors.info[${step}]`);
  for (const [step, hex] of Object.entries(p.alertColors.open)) add(hex, `alertColors.open[${step}]`);
  for (const [role, hex] of Object.entries(p.selectionColors)) add(hex, `selectionColors.${role}`);
  for (const [role, hex] of Object.entries(p.thirdPartyColors)) add(hex, `thirdPartyColors.${role}`);
  for (const [role, hex] of Object.entries(p.destructiveHoverColors)) add(hex, `destructiveHoverColors.${role}`);
  for (const [role, hex] of Object.entries(p.activityAccents)) add(hex, `activityAccents.${role}`);
  add(p.activeBrand.colors.blue.tint, 'activeBrand.colors.blue.tint');
  add(p.activeBrand.colors.ink.muted, 'activeBrand.colors.ink.muted');
  return map;
}

/** Transformación de una línea: atributo JSX, string de un hex y string con hex dentro. */
export function convertLine(line: string, map: Record<string, string>): string {
  const token = (hex: string) => map[hex.toLowerCase()];
  return line
    .replace(/(\w+)="(#[0-9a-fA-F]{6})"/g, (m, attr: string, hex: string) => (token(hex) ? `${attr}={${token(hex)}}` : m))
    .replace(/'(#[0-9a-fA-F]{6})'/g, (m, hex: string) => token(hex) ?? m)
    .replace(/'([^'`$]*?#[0-9a-fA-F]{6}[^'`$]*?)'/g, (m, body: string) => {
      let touched = false;
      const inner = body.replace(/#[0-9a-fA-F]{6}/g, (hex) => (token(hex) ? ((touched = true), `\${${token(hex)}}`) : hex));
      return touched ? `\`${inner}\`` : m;
    });
}

/** Restaura las líneas y fragmentos originales y quita los imports agregados. */
export function revertMinor(source: string, file: MinorFileFixture): string {
  let text = source;
  for (const line of file.addedImports) text = text.replace(`${line}\n`, '');
  const lines = text.split('\n');
  const items = [
    ...Object.entries(file.lines).map(([n, l]) => ({ n: Number(n), migrated: l.migrated, original: [l.original] })),
    ...Object.entries(file.snippets).map(([n, s]) => ({ n: Number(n), migrated: s.migrated, original: s.original.split('\n') })),
  ].sort((a, b) => a.n - b.n);
  // En orden ascendente, todo lo de arriba ya está restaurado: la línea n vuelve a estar en n - 1.
  for (const item of items) {
    const index = item.n - 1;
    if (lines[index] !== item.migrated) throw new Error(`línea ${item.n}: no coincide con la migrada`);
    lines.splice(index, 1, ...item.original);
  }
  return lines.join('\n');
}

// ── Bloque de restos (revertido por línea, mapa por grupo) ─────────────────────

/** Cada archivo del bloque pertenece a un grupo: el mismo hex significa cosas distintas entre grupos. */
export type RestGroup = 'environment' | 'activityChip' | 'buckets' | 'temperature';
export type RestPalettes = Record<
  'environmentColors' | 'activityTypeChipColors' | 'opportunityBucketColors' | 'temperatureColors',
  Record<string, string>
>;
export type RestFileFixture = MinorFileFixture & { group: RestGroup };
export type RestFixture = { source: string; files: Record<string, RestFileFixture> };

const GROUP_ROOT: Record<RestGroup, keyof RestPalettes> = {
  environment: 'environmentColors',
  activityChip: 'activityTypeChipColors',
  buckets: 'opportunityBucketColors',
  temperature: 'temperatureColors',
};

export const currentRestPalettes = (): RestPalettes => ({
  environmentColors: { ...environmentColors },
  activityTypeChipColors: { ...activityTypeChipColors },
  opportunityBucketColors: { ...opportunityBucketColors },
  temperatureColors: { ...temperatureColors },
});

export function restTokenMap(group: RestGroup, p: RestPalettes): Record<string, string> {
  const root = GROUP_ROOT[group];
  const map: Record<string, string> = {};
  for (const [key, hex] of Object.entries(p[root])) {
    const lower = hex.toLowerCase();
    if (map[lower]) throw new Error(`${hex} repetido en ${root}`);
    map[lower] = `${root}.${key}`;
  }
  return map;
}

// ── Subbloques de DocumentosFormPage (revertidos por línea) ────────────────────

export type NeutralPalette = typeof neutralColors;

/** hex (minúsculas) → token de `neutralColors`, construido desde los valores de la paleta. */
export function neutralTokenMap(p: NeutralPalette = neutralColors): Record<string, string> {
  const map: Record<string, string> = {};
  const add = (hex: string, token: string) => {
    const key = hex.toLowerCase();
    if (map[key]) throw new Error(`${hex} repetido: ${map[key]} y ${token}`);
    map[key] = token;
  };
  for (const [step, hex] of Object.entries(p.gray)) add(hex, `neutralColors.gray[${step}]`);
  for (const [step, hex] of Object.entries(p.slate)) add(hex, `neutralColors.slate[${step}]`);
  for (const [role, hex] of Object.entries(p.steel)) add(hex, `neutralColors.steel.${role}`);
  return map;
}

// ── Resolvedor genérico de tokens (varias familias en una línea) ───────────────

/** Raíces de color que pueden aparecer en un token migrado; clonables para pruebas de mutación. */
export const colorTokenRoots = (): Record<string, unknown> =>
  structuredClone({
    neutralColors,
    selectionColors,
    alertColors,
    feedbackTokens,
    fiscalStatusColors,
    attachmentIndicatorColors,
    advanceBoxColors,
    documentSummaryTones,
    moduleAccents,
  });

/** Ruta de un token: `alertColors.success[800]` → ['alertColors', 'success', '800']. */
export function colorTokenPath(token: string): string[] {
  const match = /^([a-zA-Z]+)((?:\.[a-zA-Z_]+|\[\d+\])+)$/.exec(token);
  if (!match) throw new Error(`Token no reconocido: ${token}`);
  return [match[1]!, ...[...match[2]!.matchAll(/\.([a-zA-Z_]+)|\[(\d+)\]/g)].map(([, key, index]) => (key ?? index)!)];
}

export function resolveColorToken(token: string, roots: Record<string, unknown> = colorTokenRoots()): string {
  const value = colorTokenPath(token).reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], roots);
  if (typeof value !== 'string') throw new Error(`${token} no resuelve a un color`);
  return value;
}

/** Mapa hex → token limitado a los tokens de una línea, resueltos con `roots`. */
export function entriesTokenMap(entries: { token: string }[], roots: Record<string, unknown> = colorTokenRoots()): Record<string, string> {
  const map: Record<string, string> = {};
  for (const { token } of entries) {
    const hex = resolveColorToken(token, roots).toLowerCase();
    if (map[hex] && map[hex] !== token) throw new Error(`${hex} con dos tokens en la misma línea: ${map[hex]} y ${token}`);
    map[hex] = token;
  }
  return map;
}

// ── Cadena de bloques posteriores ─────────────────────────────────────────────

/**
 * Un archivo tocado por un merge de `main`: contenido completo antes y después del merge
 * (y sus SHA-256, que verifica `mainMerges.test.ts`; este módulo no usa APIs de Node).
 */
export type MergeFileFixture = { before: string; merged: string; beforeSha256: string; mergedSha256: string };
export type MergeFixture = { source: string; files: Record<string, MergeFileFixture> };

/** Deshace un merge de `main` en un archivo: exige el contenido exacto registrado del merge. */
export function revertMerge(source: string, file: string, entry: MergeFileFixture): string {
  if (source !== entry.merged) throw new Error(`${file}: no coincide con el merge registrado`);
  return entry.before;
}

/**
 * Parche de líneas de un archivo: cada hunk reemplaza `migrated` (desde el índice
 * `at`, base 0, del archivo migrado) por `original`. Los SHA-256 los verifica la prueba.
 */
export type LinePatchHunk = { at: number; migrated: string[]; original: string[] };
export type LinePatchFileFixture = { beforeSha256: string; migratedSha256: string; hunks: LinePatchHunk[] };
export type LinePatchFixture = { source: string; files: Record<string, LinePatchFileFixture> };

/** Deshace un parche de líneas, del último hunk al primero; exige cada línea migrada exacta. */
export function revertLinePatch(source: string, file: string, entry: LinePatchFileFixture): string {
  const lines = source.split('\n');
  for (const hunk of [...entry.hunks].sort((a, b) => b.at - a.at)) {
    const current = lines.slice(hunk.at, hunk.at + hunk.migrated.length);
    if (current.length !== hunk.migrated.length || current.some((line, i) => line !== hunk.migrated[i])) {
      throw new Error(`${file}: línea ${hunk.at + 1}: no coincide con el parche registrado`);
    }
    lines.splice(hunk.at, hunk.migrated.length, ...hunk.original);
  }
  return lines.join('\n');
}

export type LaterFixtures = Partial<Record<(typeof LATER_CHAIN)[number], NeutralFixture | MinorFixture | RestFixture | MergeFixture | LinePatchFixture>>;

/**
 * Revierte, del más nuevo al más viejo, los bloques posteriores a `after` que
 * tocaron `file`. `after = null` revierte todos (bloques anteriores a los neutrales).
 */
export function revertLater(after: string | null, file: string, source: string, fixtures: LaterFixtures): string {
  const start = after === null ? 0 : LATER_CHAIN.indexOf(after as (typeof LATER_CHAIN)[number]) + 1;
  if (after !== null && start === 0) throw new Error(`Bloque desconocido: ${after}`);
  let out = source;
  for (const name of [...LATER_CHAIN.slice(start)].reverse()) {
    const fixture = fixtures[name];
    const entry = fixture?.files[file];
    if (!entry) continue;
    // Los neutrales revierten por familia de token; los merges de main, por contenido; E2, por parche; el resto, por línea.
    if ((MERGE_ORDER as readonly string[]).includes(name)) out = revertMerge(out, file, entry as MergeFileFixture);
    else if ((BRAND_HOOK_ORDER as readonly string[]).includes(name) || (DATES_ORDER as readonly string[]).includes(name)) out = revertLinePatch(out, file, entry as LinePatchFileFixture);
    else if ((NEUTRAL_ORDER as readonly string[]).includes(name)) out = revertNeutral(out, (entry as NeutralFixture['files'][string]).addedImports);
    else out = revertMinor(out, entry as MinorFileFixture);
  }
  return out;
}
