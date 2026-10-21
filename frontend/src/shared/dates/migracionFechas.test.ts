import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

const SRC = join(import.meta.dirname, '..', '..');
const rel = (p: string) => relative(SRC, p).split('\\').join('/');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const files = walk(SRC).map((p) => ({ path: rel(p), text: readFileSync(p, 'utf8') }));

test('no quedan inputs nativos de fecha ni fecha-hora en la aplicación (salvo el selector oculto de Compass)', () => {
  const offenders = files
    .filter((f) => /type=["']date(time-local)?["']/.test(f.text))
    .map((f) => f.path)
    .filter((p) => p !== 'compass/components/ui/date-input.tsx');
  assert.deepEqual(offenders, []);
});

// Controles cuyo TextField original no declaraba size="small" (tamaño por defecto) o usan variante standard propia.
const SIZE_ORIGINAL = new Set([
  'components/documentos/facturaNueva/FacturaNuevaStandalone.tsx',
  'modules/contabilidad/PolizaFormView.tsx',
  'pages/DocumentosPage.tsx',
  'pages/InventarioMovimientoFormPage.tsx',
  'pages/configuracion/HorariosLaboralesPage.tsx',
]);

test('todo FechaInput conserva size="small" salvo los que ya usaban el tamaño por defecto', () => {
  const sinSize: string[] = [];
  for (const f of files) {
    if (f.path.startsWith('shared/dates/') || SIZE_ORIGINAL.has(f.path)) continue;
    for (const m of f.text.matchAll(/<FechaInput\b[\s\S]*?\/>/g)) {
      if (!/size:\s*['"]small['"]/.test(m[0])) sinSize.push(`${f.path}: ${m[0].slice(0, 60)}`);
    }
  }
  assert.deepEqual(sinSize, []);
});

test('FechaInput/FechaHoraInput fusionan slotProps.textField del llamador', () => {
  const src = readFileSync(join(SRC, 'shared/dates/DateFields.tsx'), 'utf8');
  assert.equal((src.match(/slotProps\?\.textField/g) ?? []).length, 2);
  assert.equal((src.match(/slotProps=\{\{ \.\.\.slotProps, textField \}\}/g) ?? []).length, 2);
});

test('DatePicker de MUI usan DD/MM/YYYY y locale es en filtros', () => {
  const problemas: string[] = [];
  for (const f of files) {
    if (f.path.startsWith('shared/dates/')) continue;
    const providers = [...f.text.matchAll(/<LocalizationProvider\b[^>]*>/g)].filter((m) => !m[0].includes('adapterLocale'));
    if (providers.length > 0) problemas.push(`${f.path}: LocalizationProvider sin adapterLocale`);
    for (const m of f.text.matchAll(/<DatePicker\b[^>]*/g)) {
      const bloque = f.text.slice(m.index, m.index + 400);
      if (!/format=["']DD\/MM\/YYYY["']/.test(bloque) && !/adapterLocale/.test(f.text)) {
        problemas.push(`${f.path}: DatePicker sin formato`);
      }
    }
  }
  assert.deepEqual(problemas, []);
});

test('Compass no depende de MUI para fechas y reutiliza las utilidades compartidas', () => {
  const dateInput = files.find((f) => f.path === 'compass/components/ui/date-input.tsx');
  assert.ok(dateInput);
  assert.doesNotMatch(dateInput.text, /@mui\//);
  assert.match(dateInput.text, /shared\/dates\/dateUtils/);
  const usos = files.filter((f) => f.path.startsWith('compass/') && /<Date(Time)?Input\b/.test(f.text) && f.path !== 'compass/components/ui/date-input.tsx');
  assert.equal(usos.length, 6);
});
