import assert from 'node:assert/strict';
import test from 'node:test';
import { tieneIdentidadPersonalizada } from './logoPolicy.ts';

test('el logo empresarial solo se muestra con colores guardados y vuelve a Emphasys al restablecerlos', () => {
  assert.equal(tieneIdentidadPersonalizada(null), false);
  assert.equal(tieneIdentidadPersonalizada({ primario: null, acento: null, sidebar: null }), false);
  assert.equal(tieneIdentidadPersonalizada({ primario: '#7a1f2b', acento: null, sidebar: null }), true);
  assert.equal(tieneIdentidadPersonalizada({ primario: null, acento: '#0f6b5e', sidebar: null }), true);
  assert.equal(tieneIdentidadPersonalizada({ primario: null, acento: null, sidebar: '#2a1d22' }), true);
});
