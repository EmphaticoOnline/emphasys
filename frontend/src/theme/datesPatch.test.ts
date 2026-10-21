import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DATES_ORDER, revertLinePatch, type LinePatchFixture } from './__fixtures__/colorMigrations.ts';

/**
 * Estandarización de fechas: los archivos de la cadena de migración de color que pasaron a
 * `FechaInput`/`FechaHoraInput` se registran como parche exacto de líneas; así la cadena de
 * equivalencia de colores sigue reproduciendo el contenido previo sin debilitar sus pruebas.
 */
const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const fixture = JSON.parse(readText(`./__fixtures__/${DATES_ORDER[0]}`)) as LinePatchFixture;

test('cada archivo modificado por la estandarización de fechas está registrado y se revierte byte a byte', () => {
  const files = Object.entries(fixture.files);
  assert.ok(files.length > 0);
  for (const [file, entry] of files) {
    const current = readText(`../${file}`);
    assert.equal(sha256(current), entry.migratedSha256, `${file}: cambió después de la migración de fechas sin registrarse`);
    assert.equal(sha256(revertLinePatch(current, file, entry)), entry.beforeSha256, file);
    const hunk = entry.hunks.find((h) => h.migrated.length > 0);
    if (!hunk) continue;
    const tampered = current.split('\n');
    tampered[hunk.at] = `${tampered[hunk.at]} `;
    assert.throws(() => revertLinePatch(tampered.join('\n'), file, entry), /no coincide con el parche registrado/, file);
  }
});

test('el parche de fechas no toca literales de color', () => {
  const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(/g;
  for (const [file, entry] of Object.entries(fixture.files)) {
    const count = (lines: string[]) => lines.join('\n').match(COLOR)?.length ?? 0;
    const original = entry.hunks.reduce((n, h) => n + count(h.original), 0);
    const migrated = entry.hunks.reduce((n, h) => n + count(h.migrated), 0);
    assert.equal(migrated, original, `${file}: la migración de fechas cambió literales de color`);
  }
});
