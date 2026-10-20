import assert from 'node:assert/strict';
import test from 'node:test';
import { resolverLogoEmpresa } from './resolverLogoEmpresa.ts';

const KEMPER = { primario: '#0e2183', acento: '#c92b23', sidebar: '#0e166a' };
const NINGUNO = { primario: null, acento: null, sidebar: null };

function fuentes(parcial: {
  colores?: typeof KEMPER | typeof NINGUNO | null;
  cache?: typeof KEMPER | typeof NINGUNO | null;
  identidad?: () => Promise<{ colores?: typeof KEMPER | typeof NINGUNO | null } | null>;
}) {
  const pedidos: string[] = [];
  const identidad = parcial.identidad ?? (async () => ({ colores: parcial.colores === undefined ? KEMPER : parcial.colores }));
  return {
    pedidos,
    resolver: resolverLogoEmpresa(8, {
      ...(parcial.colores !== undefined ? { colores: parcial.colores } : {}),
      cache: parcial.cache,
      fetchIdentidad: identidad,
      fetchAsset: async (_id, tipo) => {
        pedidos.push(tipo);
        return { ruta: '/uploads/empresas/8/logo.png' };
      },
    }),
  };
}

test('con los colores guardados de la empresa pide logo_default', async () => {
  const { pedidos, resolver } = fuentes({});
  assert.equal(await resolver, '/uploads/empresas/8/logo.png');
  assert.deepEqual(pedidos, ['logo_default']);
});

test('sin colores guardados no pide el logotipo', async () => {
  const { pedidos, resolver } = fuentes({
    identidad: async () => ({ colores: NINGUNO }),
  });
  assert.equal(await resolver, null);
  assert.deepEqual(pedidos, []);
});

test('si la confirmación no llega y la caché ya tiene colores, pide logo_default sin esperarla', async () => {
  const { pedidos, resolver } = fuentes({
    cache: KEMPER,
    identidad: () => new Promise(() => {}),
  });
  await new Promise((espera) => setTimeout(espera, 0));
  assert.deepEqual(pedidos, ['logo_default']);
  void resolver;
});

test('si la confirmación falla y la caché ya tiene colores, el logo sigue siendo el de la empresa', async () => {
  const { resolver } = fuentes({
    cache: KEMPER,
    identidad: () => Promise.reject(new Error('red')),
  });
  assert.equal(await resolver, '/uploads/empresas/8/logo.png');
});

test('si el servidor ya no tiene colores, no se usa la caché', async () => {
  const { resolver } = fuentes({
    cache: KEMPER,
    identidad: async () => ({ colores: NINGUNO }),
  });
  assert.equal(await resolver, null);
});
