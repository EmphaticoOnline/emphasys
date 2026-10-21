import * as XLSX from 'xlsx';

export type ExportColumna = { field: string; headerName: string };

const CAMPO_FECHA = /(fecha|vencimiento|emision|ultimo_movimiento|ultima_)/i;
const ISO_FECHA = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?$/;

/** Muestra día/mes/año en columnas de fecha; el resto de valores y tipos de celda no cambia. */
export function formatearFechaExcel(val: unknown): string | null {
  if (val instanceof Date) {
    const iso = val.toISOString();
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  }
  if (typeof val !== 'string') return null;
  const m = ISO_FECHA.exec(val);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` ${m[4]}:${m[5]}` : ''}`;
}

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
      if (val instanceof Date) return formatearFechaExcel(val) ?? val.toISOString().slice(0, 10);
      if (CAMPO_FECHA.test(c.field)) return formatearFechaExcel(val) ?? val;
      return val;
    })
  );

  const hoja = XLSX.utils.aoa_to_sheet([encabezado, ...datos]);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
