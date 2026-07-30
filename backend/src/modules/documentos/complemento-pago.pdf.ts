import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import {
  ComplementoPagoXmlData,
  parseComplementoPagoXml,
} from '../cfdi/complemento-pago-xml.parser';

const NAVY = '#1d2f68';
const BLUE = '#315aa6';
const LIGHT = '#eef2f8';
const GRAY = '#52606d';
const PAGE_BOTTOM = 735;
const formaPago: Record<string, string> = {
  '01': 'Efectivo',
  '02': 'Cheque nominativo',
  '03': 'Transferencia electrónica de fondos',
  '04': 'Tarjeta de crédito',
  '28': 'Tarjeta de débito',
};

const money = (value: number, currency = 'MXN') =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 2,
  }).format(value);

const shortDate = (value: string) =>
  value ? value.replace('T', ' ').replace(/\\.000(?:Z)?$/, '') : '';

const folioVisual = (data: ComplementoPagoXmlData) => {
  const number = Number(data.folio);
  const formatted = Number.isFinite(number) ? String(number).padStart(3, '0') : data.folio || '';
  return [data.serie, formatted].filter(Boolean).join('-');
};

function fiscalQrUrl(data: ComplementoPagoXmlData): string {
  const sello = data.selloCfdi || '';
  return `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${encodeURIComponent(data.uuid)}&re=${encodeURIComponent(data.emisor.rfc)}&rr=${encodeURIComponent(data.receptor.rfc)}&tt=${data.montoTotalPagos.toFixed(6)}&fe=${encodeURIComponent(sello.slice(-8))}`;
}

function drawFooter(doc: PDFKit.PDFDocument, pageNumber: number, pageCount: number) {
  const page = doc.page;
  const originalBottomMargin = page.margins.bottom;
  page.margins.bottom = 0;
  doc.font('Helvetica').fontSize(8).fillColor(GRAY)
    .text(
      'Este documento es una representación impresa de un CFDI. Complemento para recepción de pagos.',
      40,
      page.height - 31,
      { width: page.width - 155, align: 'left', lineBreak: false }
    );
  doc.fontSize(7).text(
    `Página ${pageNumber} de ${pageCount}`,
    page.width - 115,
    page.height - 30,
    { width: 75, align: 'right', lineBreak: false }
  );
  page.margins.bottom = originalBottomMargin;
}

function drawHeader(doc: PDFKit.PDFDocument, data: ComplementoPagoXmlData, logoPath?: string | null) {
  if (logoPath) {
    try {
      doc.image(logoPath, 40, 22, { fit: [140, 48], valign: 'center' });
    } catch {
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(13).text('EMPHASYS ERP', 40, 39);
    }
  } else {
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(13).text('EMPHASYS ERP', 40, 39);
  }
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(15)
    .text('COMPLEMENTO DE PAGO', 200, 30, { width: 245, lineBreak: false });
  doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(7)
    .text('CFDI · PAGOS 2.0', 200, 51, { width: 180, characterSpacing: 0.6 });

  doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(6.5)
    .text('FOLIO', 455, 26, { width: 100, align: 'right', characterSpacing: 0.8 });
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(13)
    .text(folioVisual(data), 430, 37, { width: 125, align: 'right', lineBreak: false });

  doc.fillColor(GRAY).font('Helvetica').fontSize(7)
    .text(`UUID  ${data.uuid}`, 200, 69, { width: 355, align: 'right', lineBreak: false });
  doc.moveTo(40, 91).lineTo(555, 91).strokeColor(NAVY).lineWidth(1.2).stroke();
  doc.y = 100;
}

function ensureSpace(doc: PDFKit.PDFDocument, data: ComplementoPagoXmlData, needed: number) {
  if (doc.y + needed <= PAGE_BOTTOM) return;
  doc.addPage();
  drawHeader(doc, data);
}

function labelValue(doc: PDFKit.PDFDocument, label: string, value?: string, x = 45, width = 240) {
  if (!value) return;
  doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(8).text(label, x, doc.y, { width });
  doc.fillColor('#111827').font('Helvetica').fontSize(9).text(value, x, doc.y + 10, { width });
  doc.y += 28;
}

function drawPartyBlocks(doc: PDFKit.PDFDocument, data: ComplementoPagoXmlData) {
  const top = doc.y;
  doc.roundedRect(40, top, 250, 112, 4).fillAndStroke(LIGHT, '#d5dce8');
  doc.roundedRect(305, top, 250, 112, 4).fillAndStroke(LIGHT, '#d5dce8');
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10).text('EMISOR', 50, top + 10);
  doc.fillColor('#111827').fontSize(9).text(data.emisor.nombre, 50, top + 28, { width: 230 });
  doc.font('Helvetica').fontSize(8)
    .text(`RFC: ${data.emisor.rfc}`, 50, top + 51)
    .text(`Régimen fiscal: ${data.emisor.regimenFiscal || ''}`, 50, top + 67)
    .text(`Lugar de expedición: ${data.lugarExpedicion}`, 50, top + 83);
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10).text('RECEPTOR', 315, top + 10);
  doc.fillColor('#111827').fontSize(9).text(data.receptor.nombre, 315, top + 28, { width: 230 });
  doc.font('Helvetica').fontSize(8)
    .text(`RFC: ${data.receptor.rfc}`, 315, top + 51)
    .text(`Régimen fiscal: ${data.receptor.regimenFiscal || ''}`, 315, top + 67)
    .text(`Domicilio fiscal: ${data.receptor.domicilioFiscal || ''}   Uso CFDI: ${data.receptor.usoCfdi || ''}`, 315, top + 83, { width: 230 });
  doc.y = top + 126;
}

function drawPayment(doc: PDFKit.PDFDocument, data: ComplementoPagoXmlData, payment: ComplementoPagoXmlData['pagos'][number], index: number) {
  ensureSpace(doc, data, 130);
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(12).text(
    data.pagos.length > 1 ? `DATOS DEL PAGO ${index + 1}` : 'DATOS DEL PAGO',
    40,
    doc.y,
    { width: 515 }
  );
  const top = doc.y + 6;
  doc.roundedRect(40, top, 515, 82, 4).strokeColor('#d5dce8').stroke();
  const fields = [
    ['Fecha del pago', shortDate(payment.fechaPago)],
    ['Forma de pago', `${payment.formaPago} - ${formaPago[payment.formaPago] || 'Clave SAT'}`],
    ['Moneda', payment.moneda],
    ['Tipo de cambio', payment.tipoCambio ? String(payment.tipoCambio) : undefined],
    ['Monto', money(payment.monto, payment.moneda)],
    ['Número de operación', payment.numeroOperacion],
    ['Banco ordenante', payment.bancoOrdenante || payment.rfcBancoOrdenante],
    ['Cuenta ordenante', payment.cuentaOrdenante],
    ['RFC banco beneficiario', payment.rfcBancoBeneficiario],
    ['Cuenta beneficiaria', payment.cuentaBeneficiaria],
  ].filter((field): field is [string, string] => Boolean(field[1]));
  fields.forEach(([label, value], fieldIndex) => {
    const column = fieldIndex % 3;
    const row = Math.floor(fieldIndex / 3);
    const x = 50 + column * 168;
    const y = top + 10 + row * 30;
    doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(7).text(label, x, y, { width: 158 });
    doc.fillColor('#111827').font('Helvetica').fontSize(8).text(value, x, y + 10, { width: 158 });
  });
  doc.y = top + 96;

  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11)
    .text('DOCUMENTOS RELACIONADOS', 40, doc.y, { width: 515 });
  const columns = [
    { label: 'Serie/Folio', x: 40, width: 62 },
    { label: 'UUID', x: 105, width: 155 },
    { label: 'Moneda', x: 263, width: 42 },
    { label: 'Parc.', x: 308, width: 32 },
    { label: 'Saldo anterior', x: 343, width: 68 },
    { label: 'Importe pagado', x: 414, width: 68 },
    { label: 'Saldo insoluto', x: 485, width: 70 },
  ];
  const drawTableHeader = () => {
    const headerY = doc.y + 4;
    doc.rect(40, headerY, 515, 24).fill(NAVY);
    columns.forEach((column) =>
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7)
        .text(column.label, column.x + 3, headerY + 8, {
          width: column.width - 6,
          align: 'center',
          lineBreak: false,
        })
    );
    doc.y = headerY + 24;
  };
  drawTableHeader();
  payment.documentos.forEach((related, relatedIndex) => {
    ensureSpace(doc, data, 46);
    if (doc.y < 145) drawTableHeader();
    const rowY = doc.y;
    if (relatedIndex % 2 === 0) doc.rect(40, rowY, 515, 38).fill('#f7f9fc');
    const values = [
      [related.serie && related.folio ? `${related.serie}-${related.folio}` : related.folio || '', 'center'],
      [related.uuid, 'left'],
      [related.moneda, 'center'],
      [related.parcialidad, 'center'],
      [money(related.saldoAnterior, related.moneda), 'right'],
      [money(related.importePagado, related.moneda), 'right'],
      [money(related.saldoInsoluto, related.moneda), 'right'],
    ] as const;
    columns.forEach((column, columnIndex) =>
      doc.fillColor('#111827').font(columnIndex === 1 ? 'Courier' : 'Helvetica').fontSize(columnIndex === 1 ? 6.5 : 7)
        .text(values[columnIndex][0], column.x + 3, rowY + 7, {
          width: column.width - 6,
          height: 28,
          align: values[columnIndex][1],
        })
    );
    doc.y = rowY + 38;
  });
  doc.y += 10;
}

async function drawCompactComplement(
  doc: PDFKit.PDFDocument,
  data: ComplementoPagoXmlData,
  extra: {
    estadoSat?: string | null;
    cadenaOriginal?: string | null;
  }
) {
  const payment = data.pagos[0];
  const related = payment.documentos;

  // Resumen fiscal superior: una sola franja evita repetir UUID y fechas.
  const summaryY = 106;
  const summary = [
    ['Emisión', shortDate(data.fechaEmision)],
    ['Timbrado', shortDate(data.fechaTimbrado)],
    ['Tipo / versión', `Pago · Pagos ${data.versionPagos}`],
    ['Estado SAT', extra.estadoSat || ''],
  ];
  summary.forEach(([label, value], index) => {
    const x = 42 + index * 129;
    doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(6.8).text(label, x, summaryY, { width: 120 });
    doc.fillColor('#111827').font('Helvetica').fontSize(7.8).text(value, x, summaryY + 10, {
      width: 120,
      lineBreak: false,
    });
  });

  // Emisor y receptor compactos, manteniendo el XML como fuente.
  const partiesY = 137;
  [
    {
      x: 40,
      title: 'EMISOR',
      name: data.emisor.nombre,
      details: [
        `RFC ${data.emisor.rfc}`,
        `Régimen ${data.emisor.regimenFiscal || ''}`,
        `Expedición ${data.lugarExpedicion}`,
      ],
    },
    {
      x: 300,
      title: 'RECEPTOR',
      name: data.receptor.nombre,
      details: [
        `RFC ${data.receptor.rfc}`,
        `Régimen ${data.receptor.regimenFiscal || ''}`,
        `Domicilio ${data.receptor.domicilioFiscal || ''} · Uso ${data.receptor.usoCfdi || ''}`,
      ],
    },
  ].forEach((party) => {
    doc.roundedRect(party.x, partiesY, 255, 70, 4).fillAndStroke(LIGHT, '#d5dce8');
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(8).text(party.title, party.x + 10, partiesY + 8);
    doc.fillColor('#111827').fontSize(8.2).text(party.name, party.x + 10, partiesY + 21, {
      width: 235,
      lineBreak: false,
    });
    doc.fillColor(GRAY).font('Helvetica').fontSize(6.8)
      .text(party.details.join('   ·   '), party.x + 10, partiesY + 39, {
        width: 235,
        height: 24,
      });
  });

  // Pago y totales comparten una franja; el monto conserva la mayor jerarquía.
  const paymentY = 217;
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9).text('DATOS DEL PAGO', 40, paymentY);
  doc.roundedRect(40, paymentY + 13, 515, 52, 4).strokeColor('#d5dce8').stroke();
  const paymentFields = [
    ['Fecha', shortDate(payment.fechaPago)],
    ['Forma', `${payment.formaPago} · ${formaPago[payment.formaPago] || 'Clave SAT'}`],
    ['Moneda', payment.moneda],
    ...(payment.tipoCambio ? [['Tipo de cambio', String(payment.tipoCambio)]] : []),
    ...(payment.numeroOperacion ? [['Operación', payment.numeroOperacion]] : []),
  ];
  paymentFields.slice(0, 4).forEach(([label, value], index) => {
    const x = 50 + index * 105;
    doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(6.5).text(label, x, paymentY + 23, { width: 98 });
    doc.fillColor('#111827').font('Helvetica').fontSize(7.3).text(value, x, paymentY + 34, {
      width: 98,
      height: 20,
    });
  });
  doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(6.5).text('Monto del pago', 450, paymentY + 23, {
    width: 95,
    align: 'right',
  });
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11).text(money(payment.monto, payment.moneda), 440, paymentY + 35, {
    width: 105,
    align: 'right',
  });

  const tableTitleY = 290;
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9).text('DOCUMENTOS RELACIONADOS', 40, tableTitleY);
  const columns = [
    { label: 'Serie/Folio', x: 40, width: 62 },
    { label: 'UUID', x: 102, width: 158 },
    { label: 'Mon.', x: 260, width: 40 },
    { label: 'Parc.', x: 300, width: 38 },
    { label: 'Saldo anterior', x: 338, width: 72 },
    { label: 'Importe pagado', x: 410, width: 74 },
    { label: 'Saldo insoluto', x: 484, width: 71 },
  ];
  const headerY = tableTitleY + 13;
  doc.rect(40, headerY, 515, 19).fill(NAVY);
  columns.forEach((column) =>
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(6.3)
      .text(column.label, column.x + 2, headerY + 6, {
        width: column.width - 4,
        align: 'center',
        lineBreak: false,
      })
  );
  related.forEach((item, index) => {
    const rowY = headerY + 19 + index * 27;
    if (index % 2 === 0) doc.rect(40, rowY, 515, 27).fill('#f7f9fc');
    const values = [
      item.serie && item.folio ? `${item.serie}-${item.folio}` : item.folio || '',
      item.uuid,
      item.moneda,
      item.parcialidad,
      money(item.saldoAnterior, item.moneda),
      money(item.importePagado, item.moneda),
      money(item.saldoInsoluto, item.moneda),
    ];
    columns.forEach((column, columnIndex) =>
      doc.fillColor('#111827').font(columnIndex === 1 ? 'Courier' : 'Helvetica')
        .fontSize(columnIndex === 1 ? 5.8 : 6.5)
        .text(values[columnIndex], column.x + 2, rowY + 8, {
          width: column.width - 4,
          align: columnIndex >= 4 ? 'right' : 'center',
          lineBreak: false,
        })
    );
  });

  const afterTableY = headerY + 19 + related.length * 27 + 8;
  const totalApplied = related.reduce((sum, item) => sum + item.importePagado, 0);
  doc.roundedRect(40, afterTableY, 515, 34, 4).fillAndStroke(LIGHT, '#d5dce8');
  doc.fillColor(GRAY).font('Helvetica').fontSize(7)
    .text('Monto total', 55, afterTableY + 7)
    .text('Total aplicado', 225, afterTableY + 7)
    .text('Saldo insoluto resultante', 395, afterTableY + 7);
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(8.5)
    .text(money(data.montoTotalPagos, payment.moneda), 55, afterTableY + 18)
    .text(money(totalApplied, payment.moneda), 225, afterTableY + 18)
    .text(money(related.reduce((sum, item) => sum + item.saldoInsoluto, 0), payment.moneda), 395, afterTableY + 18);

  // Fiscal en dos zonas: QR/metadatos y tres bloques monoespaciados de alta densidad.
  const fiscalY = afterTableY + 45;
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9).text('INFORMACIÓN FISCAL', 40, fiscalY);
  const qr = await QRCode.toDataURL(fiscalQrUrl(data), { width: 150, margin: 1 });
  doc.image(qr, 40, fiscalY + 13, { width: 82, height: 82 });
  doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(6.3).text('UUID', 133, fiscalY + 15);
  doc.fillColor('#111827').font('Courier').fontSize(7).text(data.uuid, 133, fiscalY + 25, {
    width: 210,
    lineBreak: false,
  });
  doc.font('Helvetica').fontSize(6.8)
    .text(`Certificado emisor  ${data.noCertificado || ''}`, 133, fiscalY + 42)
    .text(`Certificado SAT       ${data.noCertificadoSat || ''}`, 133, fiscalY + 54)
    .text(`RFC PAC                 ${data.rfcPac || ''}`, 133, fiscalY + 66)
    .text(`Fecha de timbrado   ${shortDate(data.fechaTimbrado)}`, 133, fiscalY + 78);

  const fiscalSummaryX = 360;
  doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(6.3)
    .text('CFDI', fiscalSummaryX, fiscalY + 15)
    .text('Receptor', fiscalSummaryX, fiscalY + 38)
    .text('Total / moneda', fiscalSummaryX, fiscalY + 61);
  doc.fillColor('#111827').font('Helvetica').fontSize(6.8)
    .text(`${data.emisor.rfc} / ${data.receptor.rfc}`, fiscalSummaryX, fiscalY + 25, { width: 195 })
    .text(`${data.receptor.nombre}`, fiscalSummaryX, fiscalY + 48, { width: 195, lineBreak: false })
    .text(`${money(data.montoTotalPagos, payment.moneda)} · ${payment.moneda}`, fiscalSummaryX, fiscalY + 71);

  const sealsY = fiscalY + 105;
  const blocks = [
    ['CADENA ORIGINAL', extra.cadenaOriginal || ''],
    ['SELLO DIGITAL CFDI', data.selloCfdi || ''],
    ['SELLO DIGITAL SAT', data.selloSat || ''],
  ].filter(([, value]) => Boolean(value));
  const blockWidth = (515 - 12) / Math.max(blocks.length, 1);
  blocks.forEach(([label, value], index) => {
    const x = 40 + index * (blockWidth + 6);
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(6.2).text(label, x, sealsY, {
      width: blockWidth,
      lineBreak: false,
    });
    doc.fillColor('#263238').font('Courier').fontSize(5)
      .text(value, x, sealsY + 10, {
        width: blockWidth,
        height: 98,
        lineGap: 0.3,
      });
  });
}

export async function generarComplementoPagoPdfDesdeXml(
  xml: string,
  extra: {
    estadoSat?: string | null;
    cadenaOriginal?: string | null;
    logoPath?: string | null;
  } = {}
): Promise<Buffer> {
  const data = parseComplementoPagoXml(xml);
  const doc = new PDFDocument({ size: 'LETTER', margin: 40, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const compact = data.pagos.length === 1 && data.pagos[0].documentos.length <= 3;
  drawHeader(doc, data, extra.logoPath);

  if (compact) {
    await drawCompactComplement(doc, data, extra);
  } else {

    const generalTop = doc.y;
    labelValue(doc, 'Fecha de emisión', shortDate(data.fechaEmision), 45, 160);
    doc.y = generalTop;
    labelValue(doc, 'Fecha de timbrado', shortDate(data.fechaTimbrado), 220, 160);
    doc.y = generalTop;
    labelValue(doc, 'Tipo / versión', `Pago · Pagos ${data.versionPagos}`, 395, 155);
    doc.y = generalTop + 35;
    if (extra.estadoSat) labelValue(doc, 'Estado SAT', extra.estadoSat, 45, 160);
    doc.y = generalTop + 70;

    drawPartyBlocks(doc, data);
    data.pagos.forEach((payment, index) => drawPayment(doc, data, payment, index));

    ensureSpace(doc, data, 92);
    const totalApplied = data.pagos.flatMap((payment) => payment.documentos)
      .reduce((sum, related) => sum + related.importePagado, 0);
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11)
      .text('TOTALES DEL COMPLEMENTO', 40, doc.y, { width: 515 });
    const totalsTop = doc.y + 4;
    doc.roundedRect(320, totalsTop, 235, 65, 4).fillAndStroke(LIGHT, '#d5dce8');
    doc.fillColor(GRAY).font('Helvetica').fontSize(8)
      .text('Monto total del pago', 335, totalsTop + 10)
      .text('Total aplicado', 335, totalsTop + 29)
      .text('Moneda', 335, totalsTop + 48);
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9)
      .text(money(data.montoTotalPagos, data.pagos[0]?.moneda), 435, totalsTop + 10, { width: 105, align: 'right' })
      .text(money(totalApplied, data.pagos[0]?.moneda), 435, totalsTop + 29, { width: 105, align: 'right' })
      .text(data.pagos[0]?.moneda || '', 435, totalsTop + 48, { width: 105, align: 'right' });
    doc.y = totalsTop + 82;

    ensureSpace(doc, data, 225);
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11)
      .text('INFORMACIÓN FISCAL', 40, doc.y, { width: 515 });
    const qr = await QRCode.toDataURL(fiscalQrUrl(data), { width: 180, margin: 1 });
    doc.image(qr, 40, doc.y + 8, { width: 105, height: 105 });
    const fiscalY = doc.y + 8;
    doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(7).text('UUID', 160, fiscalY);
    doc.fillColor('#111827').font('Courier').fontSize(8).text(data.uuid, 160, fiscalY + 11, { width: 395 });
    doc.font('Helvetica').fontSize(8)
      .text(`Certificado emisor: ${data.noCertificado || ''}`, 160, fiscalY + 30)
      .text(`Certificado SAT: ${data.noCertificadoSat || ''}`, 160, fiscalY + 45)
      .text(`RFC PAC: ${data.rfcPac || ''}`, 160, fiscalY + 60)
      .text(`Fecha de timbrado: ${shortDate(data.fechaTimbrado)}`, 160, fiscalY + 75);
    doc.y = fiscalY + 122;

    const blocks = [
      ['Cadena original del complemento de certificación', extra.cadenaOriginal || ''],
      ['Sello digital del CFDI', data.selloCfdi || ''],
      ['Sello digital del SAT', data.selloSat || ''],
    ];
    blocks.forEach(([label, value]) => {
      if (!value) return;
      ensureSpace(doc, data, 62);
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(8)
        .text(label, 40, doc.y, { width: 515 });
      doc.fillColor('#263238').font('Courier').fontSize(6.5)
        .text(value, 40, doc.y + 4, { width: 515, lineGap: 1 });
      doc.y += 12;
    });
  }

  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(index);
    drawFooter(doc, index + 1, range.count);
  }
  doc.end();
  return done;
}
