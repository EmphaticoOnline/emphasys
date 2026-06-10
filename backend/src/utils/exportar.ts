import * as XLSX from 'xlsx';

export type ExportColumna = { field: string; headerName: string };

export function generarExcelBuffer(
  filas: Record<string, any>[],
  columnas: ExportColumna[],
  nombreHoja = 'Datos'
): Buffer {
  const encabezado = columnas.map((c) => c.headerName);
  const datos = filas.map((fila) =>
    columnas.map((c) => {
      const val = fila[c.field];
      if (val === null || val === undefined) return '';
      if (typeof val === 'boolean') return val ? 'Sí' : 'No';
      if (val instanceof Date) return val.toISOString().slice(0, 10);
      return val;
    })
  );

  const hoja = XLSX.utils.aoa_to_sheet([encabezado, ...datos]);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
