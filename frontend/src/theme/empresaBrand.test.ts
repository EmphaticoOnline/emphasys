import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { razonContraste } from '../../../backend/src/shared/identidadVisual/contraste.ts';
import { activeBrand } from './brand/active.ts';
import { getEmpresaBrand, mezclar } from './brand/empresaBrand.ts';
import { guardarColoresCache, leerColoresCache } from './brand/identidadVisualCache.ts';
import { empresaParaMarca } from './brand/marcaActiva.ts';
import { classicTheme, experimentalTheme, getThemeById, THEME_IDS } from './themes.ts';
import { serializeTheme } from './__fixtures__/serializeTheme.ts';

/**
 * Identidad visual dinámica por empresa: la marca de la empresa activa sale de
 * sus tres colores; sin personalización, Emphasys queda exactamente igual.
 */
const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const toJson = (value: unknown) => JSON.parse(JSON.stringify(value));
const themeBaseline = JSON.parse(readText('./__fixtures__/emphasysMuiTheme.baseline.json'));
const NINGUNO = { primario: null, acento: null, sidebar: null };

test('sin personalización se usa el mismo objeto de Emphasys y los temas congelados', () => {
  for (const colores of [null, undefined, NINGUNO, {}]) {
    assert.equal(getEmpresaBrand(colores), activeBrand);
  }
  assert.equal(getThemeById('classic', getEmpresaBrand(NINGUNO)), classicTheme);
  assert.equal(getThemeById('experimental', getEmpresaBrand(NINGUNO)), experimentalTheme);
  assert.deepStrictEqual(toJson(serializeTheme(getThemeById('classic', getEmpresaBrand(null)))), themeBaseline.classicTheme);
  assert.deepStrictEqual(toJson(serializeTheme(getThemeById('experimental', getEmpresaBrand(null)))), themeBaseline.experimentalTheme);
});

test('los mismos colores dan la misma marca y el mismo tema (caché)', () => {
  const colores = { primario: '#7a1f2b', acento: '#0f6b5e', sidebar: '#2a1d22' };
  const marca = getEmpresaBrand(colores);
  assert.equal(getEmpresaBrand({ ...colores }), marca);
  for (const id of THEME_IDS) assert.equal(getThemeById(id, marca), getThemeById(id, getEmpresaBrand({ ...colores })));
  assert.notEqual(getEmpresaBrand({ ...colores, acento: '#1d4ed8' }), marca);
});

test('cada color solo cambia su familia; tipografía, assets, metadata y superficies siguen siendo de Emphasys', () => {
  const base = activeBrand.colors;
  const soloPrimario = getEmpresaBrand({ primario: '#7a1f2b', acento: null, sidebar: null }).colors;
  assert.equal(soloPrimario.blue.base, '#7a1f2b');
  assert.equal(soloPrimario.graphite, base.graphite);
  assert.equal(soloPrimario.accent, base.accent);

  const soloSidebar = getEmpresaBrand({ primario: null, acento: null, sidebar: '#2a1d22' }).colors;
  assert.equal(soloSidebar.graphite.chrome, '#2a1d22');
  assert.equal(soloSidebar.blue, base.blue);
  assert.equal(soloSidebar.accent, base.accent);

  const soloAcento = getEmpresaBrand({ primario: null, acento: '#0f6b5e', sidebar: null }).colors;
  assert.equal(soloAcento.accent, '#0f6b5e');
  assert.equal(soloAcento.blue, base.blue);
  assert.equal(soloAcento.graphite, base.graphite);

  const marca = getEmpresaBrand({ primario: '#7a1f2b', acento: '#0f6b5e', sidebar: '#2a1d22' });
  for (const familia of ['beige', 'ivory', 'ink'] as const) assert.equal(marca.colors[familia], base[familia], familia);
  assert.equal(marca.typography, activeBrand.typography);
  assert.equal(marca.assets, activeBrand.assets);
  assert.equal(marca.metadata, activeBrand.metadata);
  assert.equal(marca.name, activeBrand.name);
});

test('los temas de una empresa aplican sus colores y conservan los colores funcionales', () => {
  const marca = getEmpresaBrand({ primario: '#7a1f2b', acento: '#0f6b5e', sidebar: '#2a1d22' });
  const clasico = getThemeById('classic', marca);
  const experimental = getThemeById('experimental', marca);
  assert.equal(clasico.palette.primary.main, '#7a1f2b');
  assert.equal(clasico.emphasys.frame.background, '#2a1d22');
  assert.equal(experimental.emphasys.action.primary, marca.colors.graphite.raised);
  for (const id of THEME_IDS) assert.equal(getThemeById(id, marca).brand.activeBrand, marca, id);
  for (const [tema, emphasys] of [[clasico, classicTheme], [experimental, experimentalTheme]] as const) {
    for (const rol of ['error', 'warning', 'success', 'info'] as const) {
      assert.deepStrictEqual(toJson(tema.palette[rol]), toJson(emphasys.palette[rol]), rol);
    }
  }
});

test('los derivados del sidebar mantienen contraste legible para cualquier sidebar válido', () => {
  const { beige, ivory } = activeBrand.colors;
  let probados = 0;
  for (let r = 0; r <= 0x80; r += 0x10) {
    for (let g = 0; g <= 0x80; g += 0x10) {
      for (let b = 0; b <= 0x80; b += 0x10) {
        const sidebar = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
        const marca = getEmpresaBrand({ primario: null, acento: null, sidebar });
        if (marca === activeBrand) continue; // no pasa la regla del servidor: se ignora
        probados += 1;
        const { graphite } = marca.colors;
        assert.ok(razonContraste(beige.base, graphite.raised) >= 4.5, `${sidebar}: botón del experimental`);
        assert.ok(razonContraste(ivory.selected, graphite.selection) >= 4.5, `${sidebar}: selección del menú`);
        assert.ok(razonContraste(graphite.itemForeground, graphite.chrome) >= 4.5, `${sidebar}: texto del menú`);
        assert.ok(razonContraste('#ffffff', marca.colors.blue.hover) >= razonContraste('#ffffff', marca.colors.blue.base));
      }
    }
  }
  assert.ok(probados > 500, `solo ${probados} sidebars válidos`);
});

test('colores inválidos o sin contraste se ignoran y ese rol queda en Emphasys', () => {
  assert.equal(getEmpresaBrand({ primario: '#ffd84d', acento: null, sidebar: null }), activeBrand);
  assert.equal(getEmpresaBrand({ primario: '#7A1F2B', acento: null, sidebar: null }), activeBrand, 'el servidor siempre envía minúsculas');
  assert.equal(getEmpresaBrand({ primario: 'rojo', acento: null, sidebar: '#cccccc' } as never), activeBrand);
  const mixto = getEmpresaBrand({ primario: '#7a1f2b', acento: '#7fd0c8', sidebar: null });
  assert.equal(mixto.colors.blue.base, '#7a1f2b');
  assert.equal(mixto.colors.accent, activeBrand.colors.accent);
});

test('mezclar interpola en sRGB', () => {
  assert.equal(mezclar('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(mezclar('#1d2f68', '#000000', 0), '#1d2f68');
  assert.equal(mezclar('#1d2f68', '#ffffff', 1), '#ffffff');
});

test('login, selección de empresa y sesión cerrada siempre usan Emphasys', () => {
  const sesion = { token: 't', empresaActivaId: 3 };
  assert.equal(empresaParaMarca({ ...sesion, pathname: '/contactos' }), 3);
  assert.equal(empresaParaMarca({ ...sesion, pathname: '/ventas/factura/nuevo' }), 3);
  for (const pathname of ['/login', '/login/', '/seleccionar-empresa', '/seleccionar-empresa/']) {
    assert.equal(empresaParaMarca({ ...sesion, pathname }), null, pathname);
  }
  assert.equal(empresaParaMarca({ pathname: '/contactos', token: null, empresaActivaId: 3 }), null, 'sesión cerrada');
  assert.equal(empresaParaMarca({ pathname: '/contactos', token: 't', empresaActivaId: null }), null, 'sin empresa');
  assert.equal(empresaParaMarca({ ...sesion, pathname: '/login-externo' }), 3);
});

test('caché: guarda, lee, borra sin personalización y tolera datos o almacenamiento rotos', () => {
  const datos = new Map<string, string>();
  const store = { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => void datos.set(k, v), removeItem: (k: string) => void datos.delete(k) };
  const colores = { primario: '#7a1f2b', acento: null, sidebar: '#2a1d22' };
  guardarColoresCache(3, colores, store);
  assert.deepEqual(leerColoresCache(3, store), colores);
  assert.equal(leerColoresCache(4, store), null);
  guardarColoresCache(3, NINGUNO, store);
  assert.equal(datos.size, 0);
  datos.set('emphasys.identidadVisual.v1.5', '{roto');
  assert.equal(leerColoresCache(5, store), null);
  const roto = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); }, removeItem: () => {} };
  assert.equal(leerColoresCache(3, roto), null);
  assert.doesNotThrow(() => guardarColoresCache(3, colores, roto));
});

test('el gate aplica la marca de la empresa activa a través de BrandContext', () => {
  const gate = readText('./AppThemeGate.tsx');
  assert.match(gate, /const brand = useEmpresaBrand\(\);/);
  assert.match(gate, /<BrandContext\.Provider value=\{brand\}>\s*<BrandThemeProvider themeId=\{themeId\}>/);
  const hook = readText('./brand/useEmpresaBrand.ts');
  assert.match(hook, /empresaParaMarca\(\{ pathname, token: session\.token, empresaActivaId: session\.empresaActivaId \}\)/);
  assert.match(hook, /leerColoresCache\(empresaId\)/);
  assert.match(hook, /guardarColoresCache\(id, colores\)/);
});
