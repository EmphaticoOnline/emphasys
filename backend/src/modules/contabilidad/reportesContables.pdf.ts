import PDFDocument from 'pdfkit';
import type { BalanzaAnaliticaResultado } from './reportesContables.repository';
import type { EstadoResultadosResultado } from './reportesContables.repository';
import type { BalanceGeneralResultado } from './reportesContables.repository';

const BRAND = '#1d2f68';
const GRAY_LIGHT = '#f3f4f6';
const BLACK = '#111827';
const GRAY_TEXT = '#6b7280';
const GREEN = '#166534';
const RED = '#b91c1c';

const TABLE_LEFT = 40;
const TABLE_RIGHT = 572;
const PAGE_BOTTOM = 760;
const ROW_H = 16;
const HEADER_H = 18;
const FONT_SM = 8;

const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NOMBRES_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const fmtFechaEmision = () =>
  new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });

function crearDocumento(): { doc: PDFKit.PDFDocument; fin: Promise<Buffer> } {
  const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
  const chunks: Buffer[] = [];
  const fin = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  return { doc, fin };
}

function dibujarEncabezado(
  doc: PDFKit.PDFDocument,
  titulo: string,
  empresaNombre: string,
  lineas: string[]
): number {
  doc.rect(0, 0, doc.page.width, 50).fill(BRAND);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14).text(titulo, 40, 17);

  let y = 68;
  doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(10).text(empresaNombre, 40, y);
  y += 16;
  doc.font('Helvetica').fontSize(9).fillColor(GRAY_TEXT);
  lineas.forEach((linea) => {
    doc.text(linea, 40, y);
    y += 13;
  });
  y += 6;
  return y;
}

function nuevaPaginaSiNecesario(doc: PDFKit.PDFDocument, y: number, alturaRequerida: number): number {
  if (y + alturaRequerida > PAGE_BOTTOM) {
    doc.addPage();
    return 40;
  }
  return y;
}

// ── Balanza Analítica ─────────────────────────────────────────────────────────

type ColBalanza = { key: string; header: string; x: number; w: number; align: 'left' | 'right' | 'center' };
const COLS_BALANZA: ColBalanza[] = [
  { key: 'cuenta', header: 'Cuenta', x: 40, w: 90, align: 'left' },
  { key: 'descripcion', header: 'Descripción', x: 130, w: 170, align: 'left' },
  { key: 'saldo_inicial', header: 'Saldo inicial', x: 300, w: 68, align: 'right' },
  { key: 'cargos', header: 'Cargos', x: 368, w: 66, align: 'right' },
  { key: 'abonos', header: 'Abonos', x: 434, w: 66, align: 'right' },
  { key: 'saldo_final', header: 'Saldo final', x: 500, w: 72, align: 'right' },
];

function dibujarEncabezadoTablaBalanza(doc: PDFKit.PDFDocument, y: number) {
  doc.rect(TABLE_LEFT, y, TABLE_RIGHT - TABLE_LEFT, HEADER_H).fill(BRAND);
  doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor('#ffffff');
  COLS_BALANZA.forEach((c) => doc.text(c.header, c.x + 2, y + 5, { width: c.w - 4, align: c.align }));
}

export function generarBalanzaAnaliticaPDF(data: BalanzaAnaliticaResultado, empresaNombre: string): Promise<Buffer> {
  const { doc, fin } = crearDocumento();

  let y = dibujarEncabezado(doc, 'Balanza Analítica', empresaNombre, [
    `Ejercicio: ${data.ejercicio}    Periodo: ${NOMBRES_MESES[data.periodo_inicial - 1]} a ${NOMBRES_MESES[data.periodo_final - 1]}`,
    `Fecha de emisión: ${fmtFechaEmision()}`,
  ]);

  dibujarEncabezadoTablaBalanza(doc, y);
  y += HEADER_H;
  doc.font('Helvetica').fontSize(FONT_SM);

  data.cuentas.forEach((c, index) => {
    y = nuevaPaginaSiNecesario(doc, y, ROW_H);
    if (y === 40) {
      dibujarEncabezadoTablaBalanza(doc, y);
      y += HEADER_H;
      doc.font('Helvetica').fontSize(FONT_SM);
    }
    if (index % 2 === 1) doc.rect(TABLE_LEFT, y, TABLE_RIGHT - TABLE_LEFT, ROW_H).fill(GRAY_LIGHT);

    const color = c.afectable ? BRAND : GRAY_TEXT;
    const fuente = c.afectable ? 'Helvetica-Bold' : 'Helvetica';
    const sangria = Math.max(0, c.nivel - 1) * 8;

    doc.font(fuente).fillColor(color);
    doc.text(c.cuenta, COLS_BALANZA[0].x + 2, y + 4, { width: COLS_BALANZA[0].w - 4, align: 'left' });
    doc.text(c.descripcion, COLS_BALANZA[1].x + 2 + sangria, y + 4, { width: COLS_BALANZA[1].w - 4 - sangria, align: 'left' });
    doc.text(fmt(c.saldo_inicial), COLS_BALANZA[2].x + 2, y + 4, { width: COLS_BALANZA[2].w - 4, align: 'right' });
    doc.text(fmt(c.cargos), COLS_BALANZA[3].x + 2, y + 4, { width: COLS_BALANZA[3].w - 4, align: 'right' });
    doc.text(fmt(c.abonos), COLS_BALANZA[4].x + 2, y + 4, { width: COLS_BALANZA[4].w - 4, align: 'right' });
    doc.text(fmt(c.saldo_final), COLS_BALANZA[5].x + 2, y + 4, { width: COLS_BALANZA[5].w - 4, align: 'right' });
    y += ROW_H;
  });

  y = nuevaPaginaSiNecesario(doc, y, ROW_H + 24);
  doc.moveTo(TABLE_LEFT, y).lineTo(TABLE_RIGHT, y).strokeColor('#d1d5db').stroke();
  y += 4;
  doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor(BLACK);
  doc.text('Totales', COLS_BALANZA[1].x + 2, y, { width: COLS_BALANZA[1].w - 4, align: 'left' });
  doc.text(fmt(data.totales.cargos), COLS_BALANZA[3].x + 2, y, { width: COLS_BALANZA[3].w - 4, align: 'right' });
  doc.text(fmt(data.totales.abonos), COLS_BALANZA[4].x + 2, y, { width: COLS_BALANZA[4].w - 4, align: 'right' });
  y += 20;

  if (!data.cuadra) {
    doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(RED);
    doc.text('La balanza no cuadra. Revise pólizas aplicadas del periodo.', TABLE_LEFT, y);
  }

  doc.end();
  return fin;
}

// ── Estado de Resultados ──────────────────────────────────────────────────────

function dibujarSeccionResultados(
  doc: PDFKit.PDFDocument,
  y: number,
  titulo: string,
  cuentas: { cuenta: string; descripcion: string; importe: number }[],
  totalLabel: string,
  total: number
): number {
  y = nuevaPaginaSiNecesario(doc, y, 24);
  doc.rect(TABLE_LEFT, y, TABLE_RIGHT - TABLE_LEFT, HEADER_H).fill(BRAND);
  doc.font('Helvetica-Bold').fontSize(FONT_SM + 1).fillColor('#ffffff').text(titulo, TABLE_LEFT + 6, y + 5);
  y += HEADER_H + 4;

  doc.font('Helvetica').fontSize(FONT_SM).fillColor(BLACK);
  cuentas.forEach((c, index) => {
    y = nuevaPaginaSiNecesario(doc, y, ROW_H);
    if (index % 2 === 1) doc.rect(TABLE_LEFT, y, TABLE_RIGHT - TABLE_LEFT, ROW_H).fill(GRAY_LIGHT);
    doc.fillColor(BLACK);
    // Reporte de presentación financiera: no se muestra el número de cuenta,
    // solo la descripción (a diferencia de la Balanza Analítica).
    doc.text(c.descripcion, TABLE_LEFT + 4, y + 4, { width: 406, align: 'left' });
    doc.text(fmt(c.importe), TABLE_LEFT + 410, y + 4, { width: 118, align: 'right' });
    y += ROW_H;
  });

  y = nuevaPaginaSiNecesario(doc, y, 22);
  doc.moveTo(TABLE_LEFT, y).lineTo(TABLE_RIGHT, y).strokeColor('#d1d5db').stroke();
  y += 4;
  doc.font('Helvetica-Bold').fontSize(FONT_SM + 0.5).fillColor(BLACK);
  doc.text(totalLabel, TABLE_LEFT + 4, y, { width: 406, align: 'left' });
  doc.text(fmt(total), TABLE_LEFT + 410, y, { width: 118, align: 'right' });
  y += 24;
  return y;
}

export function generarEstadoResultadosPDF(data: EstadoResultadosResultado, empresaNombre: string): Promise<Buffer> {
  const { doc, fin } = crearDocumento();

  let y = dibujarEncabezado(doc, 'Estado de Resultados', empresaNombre, [
    `Ejercicio: ${data.ejercicio}    Periodo: ${NOMBRES_MESES[data.periodo_inicial - 1]} a ${NOMBRES_MESES[data.periodo_final - 1]}`,
    `Fecha de emisión: ${fmtFechaEmision()}`,
  ]);

  y = dibujarSeccionResultados(doc, y, 'INGRESOS', data.ingresos, 'TOTAL INGRESOS', data.total_ingresos);
  y = dibujarSeccionResultados(doc, y, 'EGRESOS', data.egresos, 'TOTAL EGRESOS', data.total_egresos);

  y = nuevaPaginaSiNecesario(doc, y, 24);
  const esUtilidad = data.utilidad_periodo >= 0;
  doc.rect(TABLE_LEFT, y, TABLE_RIGHT - TABLE_LEFT, 22).fill(esUtilidad ? '#ecfdf5' : '#fef2f2');
  doc.font('Helvetica-Bold').fontSize(10).fillColor(esUtilidad ? GREEN : RED);
  doc.text(
    `${esUtilidad ? 'UTILIDAD' : 'PÉRDIDA'} DEL PERIODO: ${fmt(Math.abs(data.utilidad_periodo))}`,
    TABLE_LEFT + 6,
    y + 5
  );

  doc.end();
  return fin;
}

// ── Balance General ────────────────────────────────────────────────────────────

function dibujarSeccionBalance(
  doc: PDFKit.PDFDocument,
  y: number,
  titulo: string,
  grupos: BalanceGeneralResultado['activo'],
  totalLabel: string,
  total: number
): number {
  y = nuevaPaginaSiNecesario(doc, y, 24);
  doc.rect(TABLE_LEFT, y, TABLE_RIGHT - TABLE_LEFT, HEADER_H).fill(BRAND);
  doc.font('Helvetica-Bold').fontSize(FONT_SM + 1).fillColor('#ffffff').text(titulo, TABLE_LEFT + 6, y + 5);
  y += HEADER_H + 4;

  doc.font('Helvetica').fontSize(FONT_SM).fillColor(BLACK);
  grupos.forEach((grupo) => {
    y = nuevaPaginaSiNecesario(doc, y, ROW_H);
    doc.font('Helvetica-Bold').fillColor(BRAND);
    doc.text(grupo.grupo, TABLE_LEFT + 4, y + 4, { width: 300, align: 'left' });
    doc.text(fmt(grupo.subtotal), TABLE_LEFT + 410, y + 4, { width: 118, align: 'right' });
    y += ROW_H;

    doc.font('Helvetica').fillColor(BLACK);
    grupo.cuentas.forEach((c, index) => {
      y = nuevaPaginaSiNecesario(doc, y, ROW_H);
      if (index % 2 === 1) doc.rect(TABLE_LEFT, y, TABLE_RIGHT - TABLE_LEFT, ROW_H).fill(GRAY_LIGHT);
      doc.fillColor(BLACK);
      // Reporte de presentación financiera: no se muestra el número de
      // cuenta; la sangría respecto al grupo se da solo con la descripción.
      doc.text(c.descripcion, TABLE_LEFT + 16, y + 4, { width: 394, align: 'left' });
      doc.text(fmt(c.saldo), TABLE_LEFT + 410, y + 4, { width: 118, align: 'right' });
      y += ROW_H;
    });
  });

  y = nuevaPaginaSiNecesario(doc, y, 22);
  doc.moveTo(TABLE_LEFT, y).lineTo(TABLE_RIGHT, y).strokeColor('#d1d5db').stroke();
  y += 4;
  doc.font('Helvetica-Bold').fontSize(FONT_SM + 0.5).fillColor(BLACK);
  doc.text(totalLabel, TABLE_LEFT + 4, y, { width: 300, align: 'left' });
  doc.text(fmt(total), TABLE_LEFT + 410, y, { width: 118, align: 'right' });
  y += 24;
  return y;
}

export function generarBalanceGeneralPDF(data: BalanceGeneralResultado, empresaNombre: string): Promise<Buffer> {
  const { doc, fin } = crearDocumento();

  let y = dibujarEncabezado(doc, 'Balance General', empresaNombre, [
    `Ejercicio: ${data.ejercicio}    Periodo: ${NOMBRES_MESES[data.periodo - 1]}`,
    `Fecha de emisión: ${fmtFechaEmision()}`,
  ]);

  y = dibujarSeccionBalance(doc, y, 'ACTIVO', data.activo, 'TOTAL ACTIVO', data.total_activo);
  y = dibujarSeccionBalance(doc, y, 'PASIVO', data.pasivo, 'TOTAL PASIVO', data.total_pasivo);
  y = dibujarSeccionBalance(doc, y, 'CAPITAL', data.capital, 'TOTAL CAPITAL', data.total_capital);

  y = nuevaPaginaSiNecesario(doc, y, 22);
  doc.font('Helvetica-Bold').fontSize(FONT_SM + 0.5).fillColor(BLACK);
  doc.text('TOTAL PASIVO + CAPITAL', TABLE_LEFT + 4, y, { width: 300, align: 'left' });
  doc.text(fmt(data.total_pasivo + data.total_capital), TABLE_LEFT + 410, y, { width: 118, align: 'right' });
  y += 26;

  y = nuevaPaginaSiNecesario(doc, y, 24);
  doc.rect(TABLE_LEFT, y, TABLE_RIGHT - TABLE_LEFT, 22).fill(data.cuadrado ? '#ecfdf5' : '#fef2f2');
  doc.font('Helvetica-Bold').fontSize(10).fillColor(data.cuadrado ? GREEN : RED);
  doc.text(
    data.cuadrado ? 'Balance cuadrado' : `Diferencia: ${fmt(data.diferencia)}`,
    TABLE_LEFT + 6,
    y + 5
  );

  doc.end();
  return fin;
}
