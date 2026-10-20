import assert from 'node:assert/strict';
import test from 'node:test';
import { emphasysBrand } from './brand/emphasys.ts';
import {
  FONDOS_REFERENCIA,
  IDENTIDAD_EMPHASYS,
  validarContraste,
} from '../../../backend/src/shared/identidadVisual/contraste.ts';

/**
 * Identidad visual por empresa (E3): el backend valida contra una copia de los
 * colores de Emphasys (no puede importar el frontend). Esta prueba evita que se
 * desincronicen.
 */
test('los colores de referencia del backend son los de emphasysBrand', () => {
  const { blue, accent, graphite, ivory, beige } = emphasysBrand.colors;
  assert.deepEqual(IDENTIDAD_EMPHASYS, { primario: blue.base, acento: accent, sidebar: graphite.chrome });
  assert.deepEqual(FONDOS_REFERENCIA, { blanco: '#ffffff', marfil: ivory.surface, beige: beige.base });
});

test('la identidad de Emphasys pasa la validación de contraste del backend', () => {
  assert.deepEqual(validarContraste(IDENTIDAD_EMPHASYS), []);
});
