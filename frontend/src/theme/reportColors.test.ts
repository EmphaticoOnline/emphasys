import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { emphasysBrand } from './brand/emphasys.ts';
import { categoricalPalettes, inventoryFlowColors, moduleAccents, thirdPartyColors } from './functional.ts';

const readText = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
/** Extraído de HEAD (44bed37) antes de migrar el bloque de informes. */
const baseline = JSON.parse(readText('./__fixtures__/reportColors.baseline.json'));

const informes = '../pages/informes/';
const inventoryReports = [
  'inventario/InventarioValorizadoPage.tsx',
  'inventario/ExistenciasPorAlmacenPage.tsx',
  'inventario/KardexProductoPage.tsx',
  'inventario/MovimientosInventarioPage.tsx',
  'inventario/ProductosBajoMinimoPage.tsx',
];
const kpiReports = {
  movimientosPorPeriodo: 'MovimientosPorPeriodoPage.tsx',
  volumenProducto: 'VolumenProductoPage.tsx',
  volumenCompras: 'VolumenComprasPage.tsx',
} as const;

test('el acento de informes de inventario conserva su valor exacto', () => {
  assert.equal(moduleAccents.inventoryReports, baseline.inventoryReportAccent);
  assert.match(moduleAccents.inventoryReports, /^#[0-9a-f]{6}$/, 'se concatena con sufijo alfa: debe ser hex de 6 dígitos');
});

test('la paleta KPI reproduce la secuencia de cada informe', () => {
  for (const [report, colors] of Object.entries(baseline.reportKpis) as [string, string[]][]) {
    assert.deepStrictEqual(categoricalPalettes.reportKpis.slice(0, colors.length), colors, report);
  }
});

test('entradas y salidas de inventario conservan sus valores en ambos informes', () => {
  for (const flow of Object.values(baseline.inventoryFlow)) {
    assert.deepStrictEqual({ ...inventoryFlowColors }, flow);
  }
});

test('el verde de Excel conserva sus valores oficiales', () => {
  assert.equal(thirdPartyColors.excel, baseline.excel.base);
  assert.equal(thirdPartyColors.excelHover, baseline.excel.hover);
});

test('los informes de inventario leen el acento desde un solo token', () => {
  for (const file of inventoryReports) {
    const source = readText(informes + file);
    assert.ok(!source.includes(moduleAccents.inventoryReports), `${file} todavía tiene el acento literal`);
    assert.ok(source.includes('const COLOR = moduleAccents.inventoryReports;'), file);
  }
});

test('los informes con KPI no repiten la paleta literal', () => {
  for (const [report, file] of Object.entries(kpiReports)) {
    const source = readText(informes + file);
    const colors: string[] = baseline.reportKpis[report];
    colors.forEach((color, index) => {
      assert.ok(!source.includes(`color="${color}"`), `${file} todavía tiene color="${color}"`);
      assert.ok(source.includes(`color={categoricalPalettes.reportKpis[${index}]}`), `${file} KPI ${index}`);
    });
  }
});

test('Kardex y Movimientos de inventario usan el token de dirección', () => {
  for (const file of ['inventario/KardexProductoPage.tsx', 'inventario/MovimientosInventarioPage.tsx']) {
    const source = readText(informes + file);
    assert.ok(!source.includes(inventoryFlowColors.inbound), `${file} todavía tiene el verde de entradas literal`);
    assert.ok(!source.includes(inventoryFlowColors.outbound), `${file} todavía tiene el rojo de salidas literal`);
    assert.ok(source.includes('inventoryFlowColors.inbound') && source.includes('inventoryFlowColors.outbound'), file);
  }
});

test('MovimientosPorPeriodo toma el verde de Excel de la capa de terceros', () => {
  const source = readText(informes + 'MovimientosPorPeriodoPage.tsx');
  assert.ok(!source.includes(thirdPartyColors.excel) && !source.includes(thirdPartyColors.excelHover));
  assert.ok(source.includes('const EXCEL_VERDE       = thirdPartyColors.excel;'));
  assert.equal(source.match(/from '\.\.\/\.\.\/theme\/functional'/g)?.length, 1, 'un solo import de la capa funcional');
});

test('la paleta KPI no sigue a la marca aunque hoy coincida con ella', () => {
  assert.equal(categoricalPalettes.reportKpis[0], emphasysBrand.colors.blue.base);
  assert.equal(categoricalPalettes.reportKpis[1], emphasysBrand.colors.accent);
  assert.ok(!/from '\.\/brand\//.test(readText('./functional.ts')), 'functional.ts no debe importar la marca');
});
