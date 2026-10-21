import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolverOrdenDocumentos } from '../modules/documentos/documentos.repository';

const cotizacion = 'cotizacion' as any;

assert.equal(resolverOrdenDocumentos(cotizacion, 'numero', 'asc'), 'd.numero ASC, d.id ASC');
assert.equal(resolverOrdenDocumentos(cotizacion, 'numero', 'desc'), 'd.numero DESC, d.id DESC');
assert.equal(resolverOrdenDocumentos(cotizacion, 'fecha_documento', 'asc'), 'd.fecha_documento ASC, d.id ASC');
assert.equal(resolverOrdenDocumentos(cotizacion, 'subtotal', 'desc'), 'd.subtotal DESC, d.id DESC');
assert.equal(resolverOrdenDocumentos(cotizacion, 'total', 'asc'), 'd.total ASC, d.id ASC');

// Valores inválidos y tipos distintos conservan el orden histórico seguro.
assert.equal(resolverOrdenDocumentos(cotizacion, 'numero' as any, 'DROP TABLE' as any), 'd.fecha_documento DESC, d.id DESC');
assert.equal(resolverOrdenDocumentos('factura' as any, 'total', 'asc'), 'd.fecha_documento DESC, d.id DESC');

const repositorySource = readFileSync(join(__dirname, '../modules/documentos/documentos.repository.ts'), 'utf8');
const orderByPosition = repositorySource.indexOf('ORDER BY ${resolverOrdenDocumentos');
const limitPosition = repositorySource.indexOf('LIMIT $${limitIdx} OFFSET $${offsetIdx}');
assert.ok(orderByPosition >= 0 && orderByPosition < limitPosition, 'El ordenamiento debe ocurrir antes de LIMIT/OFFSET');

console.log('Ordenamiento de cotizaciones: ascendente, descendente, lista blanca y orden predeterminado OK.');
