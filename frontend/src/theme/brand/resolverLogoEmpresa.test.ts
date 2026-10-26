import assert from 'node:assert/strict';
import test from 'node:test';
import { resolverLogoEmpresa } from './resolverLogoEmpresa.ts';

test('si existe logo_default de la empresa, lo usa sin importar sus colores', async () => {
  const pedidos: Array<[number, string]> = [];
  const ruta = await resolverLogoEmpresa(10, {
    fetchAsset: async (id, tipo) => {
      pedidos.push([id, tipo]);
      return { ruta: '/uploads/empresas/10/logo.png' };
    },
  });
  assert.equal(ruta, '/uploads/empresas/10/logo.png');
  assert.deepEqual(pedidos, [[10, 'logo_default']]);
});

test('sin asset devuelve null para usar el logotipo de Emphasys', async () => {
  assert.equal(await resolverLogoEmpresa(10, { fetchAsset: async () => null }), null);
  assert.equal(await resolverLogoEmpresa(10, { fetchAsset: async () => ({ ruta: '' }) }), null);
});
