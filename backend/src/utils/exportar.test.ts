import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import { formatearFechaExcel, generarExcelBuffer } from './exportar.ts';

test('formatearFechaExcel muestra día/mes/año y no confunde 05/04 con mayo', () => {
  assert.equal(formatearFechaExcel('2026-04-05'), '05/04/2026');
  assert.equal(formatearFechaExcel('2026-04-05T09:30:00'), '05/04/2026 09:30');
  assert.equal(formatearFechaExcel(new Date('2026-04-05T12:00:00Z')), '05/04/2026');
  assert.equal(formatearFechaExcel('texto'), null);
  assert.equal(formatearFechaExcel(12), null);
});

test('generarExcelBuffer formatea solo columnas de fecha y conserva números y textos', () => {
  const buf = generarExcelBuffer(
    [{ fecha: '2026-04-05', fecha_vencimiento: new Date('2026-05-04T12:00:00Z'), folio: '2026-04-05', total: 1234.5, nota: null }],
    [
      { field: 'fecha', headerName: 'Fecha' },
      { field: 'fecha_vencimiento', headerName: 'Vencimiento' },
      { field: 'folio', headerName: 'Folio' },
      { field: 'total', headerName: 'Total' },
      { field: 'nota', headerName: 'Nota' },
    ],
  );
  const hoja = XLSX.read(buf, { type: 'buffer' }).Sheets['Datos']!;
  assert.equal(hoja['A2'].v, '05/04/2026');
  assert.equal(hoja['B2'].v, '04/05/2026');
  assert.equal(hoja['C2'].v, '2026-04-05'); // columna que no es de fecha: sin cambios
  assert.equal(hoja['D2'].t, 'n');
  assert.equal(hoja['D2'].v, 1234.5);
});
