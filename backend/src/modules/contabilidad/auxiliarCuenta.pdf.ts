import PDFDocument from 'pdfkit';
import type { AuxiliarCuentaResultado } from './saldos.repository';

const BRAND = '#1d2f68';
const GRAY_LIGHT = '#f3f4f6';
const BLACK = '#111827';

const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtFecha = (iso: string): string => {
  if (!iso || iso.length < 10) return iso;
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
};

type ColKey = 'poliza_numero' | 'tipo_poliza' | 'renglon' | 'fecha' | 'concepto' | 'cargo' | 'abono' | 'referencia';
type Col = { key: ColKey; header: string; x: number; w: number; align: 'left' | 'right' | 'center' };

// x/w suman de 40 a 572 (carta: 612pt de ancho, márgenes de 40pt a cada lado).
const COLS: Col[] = [
  { key: 'poliza_numero', header: 'Póliza', x: 40, w: 42, align: 'left' },
  { key: 'tipo_poliza', header: 'Tipo', x: 82, w: 55, align: 'left' },
  { key: 'renglon', header: 'No.', x: 137, w: 25, align: 'center' },
  { key: 'fecha', header: 'Fecha', x: 162, w: 52, align: 'left' },
  { key: 'concepto', header: 'Concepto', x: 214, w: 130, align: 'left' },
  { key: 'cargo', header: 'Cargo', x: 344, w: 68, align: 'right' },
  { key: 'abono', header: 'Abono', x: 412, w: 68, align: 'right' },
  { key: 'referencia', header: 'Referencia', x: 480, w: 92, align: 'left' },
];
const TABLE_LEFT = 40;
const TABLE_RIGHT = 572;
const ROW_H = 16;
const HEADER_H = 18;
const FONT_SM = 7.5;
const PAGE_BOTTOM = 760;

export function generarAuxiliarCuentaPDF(data: AuxiliarCuentaResultado): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Banda de marca
    doc.rect(0, 0, doc.page.width, 50).fill(BRAND);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14).text('Auxiliar de cuenta', 40, 17);

    let y = 68;
    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(10);
    doc.text(`Cuenta: ${data.cuenta.cuenta}`, 40, y);
    doc.text(`Descripción: ${data.cuenta.descripcion}`, 260, y);
    y += 15;
    doc.text(`Ejercicio: ${data.ejercicio}`, 40, y);
    doc.text(`Periodo: ${String(data.periodo).padStart(2, '0')}`, 150, y);
    y += 18;

    doc.font('Helvetica').fontSize(9).fillColor(BLACK);
    doc.text(`Cargos: $${fmt(data.resumen.cargos)}`, 40, y);
    doc.text(`Abonos: $${fmt(data.resumen.abonos)}`, 220, y);
    doc.text(`Número de movimientos: ${data.resumen.numero_movimientos}`, 400, y);
    y += 22;

    function drawTableHeader(yPos: number) {
      doc.rect(TABLE_LEFT, yPos, TABLE_RIGHT - TABLE_LEFT, HEADER_H).fill(BRAND);
      doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor('#ffffff');
      COLS.forEach((c) => {
        doc.text(c.header, c.x + 2, yPos + 5, { width: c.w - 4, align: c.align });
      });
    }

    drawTableHeader(y);
    y += HEADER_H;
    doc.font('Helvetica').fontSize(FONT_SM);

    data.movimientos.forEach((mov, index) => {
      if (y + ROW_H > PAGE_BOTTOM) {
        doc.addPage();
        y = 40;
        drawTableHeader(y);
        y += HEADER_H;
        doc.font('Helvetica').fontSize(FONT_SM);
      }
      if (index % 2 === 1) {
        doc.rect(TABLE_LEFT, y, TABLE_RIGHT - TABLE_LEFT, ROW_H).fill(GRAY_LIGHT);
      }
      doc.fillColor(BLACK);
      const valores: Record<ColKey, string> = {
        poliza_numero: String(mov.poliza_numero),
        tipo_poliza: mov.tipo_poliza,
        renglon: String(mov.renglon),
        fecha: fmtFecha(mov.fecha),
        concepto: mov.concepto ?? '',
        cargo: mov.cargo ? fmt(mov.cargo) : '',
        abono: mov.abono ? fmt(mov.abono) : '',
        referencia: mov.referencia ?? '',
      };
      COLS.forEach((c) => {
        doc.text(valores[c.key], c.x + 2, y + 4, { width: c.w - 4, align: c.align });
      });
      y += ROW_H;
    });

    if (y + ROW_H > PAGE_BOTTOM) {
      doc.addPage();
      y = 40;
    }
    doc.moveTo(TABLE_LEFT, y).lineTo(TABLE_RIGHT, y).strokeColor('#d1d5db').stroke();
    y += 4;
    doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor(BLACK);
    doc.text('Totales', 214, y, { width: 130, align: 'left' });
    doc.text(fmt(data.resumen.cargos), 344, y, { width: 66, align: 'right' });
    doc.text(fmt(data.resumen.abonos), 412, y, { width: 66, align: 'right' });

    doc.end();
  });
}
