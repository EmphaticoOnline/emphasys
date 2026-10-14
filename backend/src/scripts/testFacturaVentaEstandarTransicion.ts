import assert from 'node:assert/strict';
import { validarTransicionFacturaVentaEstandar } from '../modules/documentos/documentos.repository';

validarTransicionFacturaVentaEstandar('Borrador', 'Emitido');

assert.throws(
  () => validarTransicionFacturaVentaEstandar('Emitido', 'Timbrado'),
  /solo puede pasar a Timbrado mediante un timbrado CFDI exitoso/i,
);

assert.throws(
  () => validarTransicionFacturaVentaEstandar('Borrador', 'Timbrado'),
  /solo puede pasar a Timbrado mediante un timbrado CFDI exitoso/i,
);

console.log('OK: Borrador → Emitido permitido; Timbrado directo bloqueado.');
