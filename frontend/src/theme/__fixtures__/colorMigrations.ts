import { activeBrand } from '../brand/active.ts';
import {
  activityAccents,
  activityTypeChipColors,
  alertColors,
  categoricalPalettes,
  destructiveHoverColors,
  environmentColors,
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
export const DOCUMENTOS_FORM_ORDER = ['documentosForm.s1.baseline.json', 'documentosForm.s2.baseline.json', 'documentosForm.s3.baseline.json', 'documentosForm.s4.baseline.json'] as const;
const LATER_CHAIN = [...NEUTRAL_ORDER, MINOR_FIXTURE, REST_FIXTURE, ...DOCUMENTOS_FORM_ORDER] as const;
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

// ── Cadena de bloques posteriores ─────────────────────────────────────────────

export type LaterFixtures = Partial<Record<(typeof LATER_CHAIN)[number], NeutralFixture | MinorFixture | RestFixture>>;

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
    // Los neutrales revierten por familia de token; los bloques posteriores, por línea.
    out = (NEUTRAL_ORDER as readonly string[]).includes(name)
      ? revertNeutral(out, (entry as NeutralFixture['files'][string]).addedImports)
      : revertMinor(out, entry as MinorFileFixture);
  }
  return out;
}
