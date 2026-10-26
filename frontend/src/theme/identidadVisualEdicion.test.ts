import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  colorEfectivo,
  contrasteRol,
  cuerpoCambios,
  leerHex,
  manualesAfectados,
  rolesCambiados,
  SIN_COLORES,
} from '../components/configuracion/identidadVisualEdicion.ts';
import { emphasysBrand } from './brand/emphasys.ts';

/** Pantalla de identidad visual por empresa: lógica de edición y cableado del guardado. */
const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('sin color se muestra y se mide el de Emphasys, y cumple el contraste', () => {
  assert.equal(colorEfectivo('primario', null), emphasysBrand.colors.blue.base);
  assert.equal(colorEfectivo('acento', null), emphasysBrand.colors.accent);
  assert.equal(colorEfectivo('sidebar', null), emphasysBrand.colors.graphite.chrome);
  for (const rol of ['primario', 'acento', 'sidebar'] as const) assert.ok(contrasteRol(rol, null).ok, rol);
});

test('contraste: informa el peor fondo y el mínimo', () => {
  const claro = contrasteRol('acento', '#7fd0c8');
  assert.equal(claro.ok, false);
  assert.equal(claro.contra, 'beige');
  assert.equal(claro.minimo, 4.5);
  // Primario y Sidebar son fondos: se aceptan siempre, medidos contra su texto automático.
  for (const rol of ['primario', 'sidebar'] as const) {
    const libre = contrasteRol(rol, '#b47716');
    assert.equal(libre.ok, true);
    assert.equal(libre.contra, 'texto');
  }
  assert.equal(contrasteRol('acento', '#006261').contra, 'beige');
});

test('leerHex acepta con o sin # y normaliza; rechaza lo incompleto', () => {
  assert.equal(leerHex('#7A1F2B'), '#7a1f2b');
  assert.equal(leerHex('7a1f2b'), '#7a1f2b');
  assert.equal(leerHex('#7a1f2'), null);
  assert.equal(leerHex(''), null);
});

test('cambios y colores manuales afectados', () => {
  const guardados = { primario: '#7a1f2b', acento: null, sidebar: '#2a1d22' };
  const origen = { primario: 'manual', acento: 'emphasys', sidebar: 'analisis' } as const;
  const borrador = { primario: '#8a2433', acento: null, sidebar: null };
  assert.deepEqual(rolesCambiados(guardados, borrador), ['primario', 'sidebar']);
  assert.deepEqual(manualesAfectados(guardados, origen, borrador), ['primario']);
  assert.deepEqual(cuerpoCambios(guardados, borrador), { primario: '#8a2433', sidebar: null });
  assert.deepEqual(rolesCambiados(SIN_COLORES, SIN_COLORES), []);
  assert.deepEqual(manualesAfectados(guardados, origen, { ...guardados }), []);
});

test('la pantalla guarda solo con confirmación y solo confirma sobrescritura cuando la advirtió', () => {
  const ui = readText('../components/configuracion/IdentidadVisualEmpresaSection.tsx');
  // Guardar abre el diálogo de confirmación con los manuales afectados; no envía directo.
  assert.match(ui, /onClick=\{\(\) => setConfirmar\(\{ conflictos: manuales \}\)\}/);
  assert.match(ui, /disabled=\{!cambiados\.length \|\| sinContraste\.length > 0 \|\| guardando\}/);
  // confirmarSobrescritura = true solo si el diálogo mostró conflictos.
  assert.match(ui, /onClick=\{\(\) => void guardar\(Boolean\(confirmar\?\.conflictos\.length\)\)\}/);
  // Un 409 del servidor vuelve a pedir confirmación con sus conflictos.
  assert.match(ui, /if \(!r\.ok\) \{\s*setConfirmar\(\{ conflictos: r\.conflictos \}\);/);
  // Analizar solo cambia la propuesta, no el borrador ni lo guardado.
  assert.match(ui, /const datos = await analizarLogoIdentidad\(empresaId\);[\s\S]{0,140}setIdentidad\(datos\);/);
  // La vista previa usa los temas reales con la marca en edición.
  assert.match(ui, /getThemeById\(id, marcaPrevia\)/);
  assert.match(ui, /getEmpresaBrand\(borrador\)/);
  // Solo el superadministrador edita.
  assert.match(ui, /const editable = Boolean\(session\.user\?\.es_superadmin\);/);
});

test('al guardar, la app aplica los colores de esa empresa sin recargar', () => {
  assert.match(readText('../services/identidadVisualService.ts'), /dispatchEvent\(\s*new CustomEvent<DetalleIdentidadActualizada>\(EVENTO_IDENTIDAD_ACTUALIZADA/);
  assert.match(readText('./brand/useEmpresaBrand.ts'), /addEventListener\(EVENTO_IDENTIDAD_ACTUALIZADA, alGuardar\)/);
});
