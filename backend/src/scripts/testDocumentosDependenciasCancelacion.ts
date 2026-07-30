import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { clasificarDependenciasCancelacion } from '../modules/documentos/documentos-dependencias-cancelacion';

const dependency = (overrides: Record<string, unknown> = {}) => ({
  relacion: 'documento_origen_id' as const,
  documento_id: 1663,
  tipo_documento: 'factura',
  folio: 'B-020',
  estatus_documento: 'Timbrado',
  tipo_relacion: 'correccion' as const,
  bloquea_cancelacion: false,
  ...overrides,
});

const b4 = clasificarDependenciasCancelacion([dependency()]);
assert.equal(b4.bloqueantes.length, 0);
assert.equal(b4.noBloqueantes.length, 1);
assert.equal(b4.noBloqueantes[0].folio, 'B-020');
assert.equal(b4.noBloqueantes[0].tipoRelacion, 'correccion');

for (const estatus of ['Borrador', 'Timbrado']) {
  const correction = clasificarDependenciasCancelacion([dependency({ estatus_documento: estatus })]);
  assert.equal(correction.bloqueantes.length, 0);
}

for (const tipoDocumento of ['remision', 'nota_credito']) {
  const operational = clasificarDependenciasCancelacion([
    dependency({
      documento_id: tipoDocumento === 'remision' ? 80 : 81,
      tipo_documento: tipoDocumento,
      folio: tipoDocumento === 'remision' ? 'REM-018' : 'NC-001',
      tipo_relacion: 'derivacion_operativa',
      bloquea_cancelacion: true,
    }),
  ]);
  assert.equal(operational.bloqueantes.length, 1);
}

const mixed = clasificarDependenciasCancelacion([
  dependency(),
  dependency({
    documento_id: 80,
    tipo_documento: 'remision',
    folio: 'REM-018',
    tipo_relacion: 'derivacion_operativa',
    bloquea_cancelacion: true,
  }),
]);
assert.deepEqual(mixed.noBloqueantes.map((item) => item.folio), ['B-020']);
assert.deepEqual(mixed.bloqueantes.map((item) => item.folio), ['REM-018']);

const unknown = clasificarDependenciasCancelacion([
  dependency({ tipo_relacion: null, bloquea_cancelacion: null }),
]);
assert.equal(unknown.bloqueantes.length, 1);
assert.equal(unknown.bloqueantes[0].tipoRelacion, 'desconocida');

const duplicated = clasificarDependenciasCancelacion([
  dependency({ tipo_relacion: 'duplicacion', bloquea_cancelacion: false }),
]);
assert.equal(duplicated.bloqueantes.length, 0);

const cancelled = clasificarDependenciasCancelacion([
  dependency({ estatus_documento: 'Cancelado', tipo_relacion: null, bloquea_cancelacion: null }),
]);
assert.equal(cancelled.bloqueantes.length, 0);

const migration = fs.readFileSync(
  path.resolve(__dirname, '../../../database/migrations/20260728_clasificar_correcciones_facturas.sql'),
  'utf8'
);
for (const [source, destination] of [[152, 1661], [153, 1665], [154, 1664], [155, 1663], [156, 1662]]) {
  assert.match(migration, new RegExp(`\\(1,\\s*${source},\\s*${destination},\\s*'correccion',\\s*false`));
}
assert.match(migration, /"relacion_sat":false/);
assert.doesNotMatch(migration, /UPDATE\\s+(documentos|documentos_cfdi)/i);
assert.doesNotMatch(migration, /DELETE\\s+FROM/i);

console.log('Clasificación de dependencias de cancelación: OK (sin DB, PAC ni HTTP).');
