import PDFDocument from 'pdfkit';
import type {
  AplicacionDetalle,
  EstadoCuentaResult,
  MovimientoEstadoCuenta,
  VolumenContactoResult,
  ContactoVolumen,
  FacturaVolumenDetalle,
  VolumenProductoResult,
  ProductoVolumen,
  PartidaVolumenDetalle,
  OCPendientesResult,
  OCPendienteOC,
  OCPendientePartida,
} from './reportes.repository';

const BRAND       = '#1d2f68';
const GRAY_HEADER = '#374151';
const GRAY_LIGHT  = '#f3f4f6';
const GRAY_MID    = '#9ca3af';
const GRAY_SUB    = '#eef0f3';
const RED         = '#dc2626';
const GREEN       = '#16a34a';
const BLACK       = '#111827';

const fmt = (n: number) =>
  n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtFecha = (iso: string): string => {
  if (!iso || iso.length < 10) return iso;
  const [yr, mo, da] = iso.slice(0, 10).split('-');
  return `${da}-${mo}-${yr}`;
};

// ── Columnas modo estándar ────────────────────────────────────────────────────
const COL = {
  fecha:    { x: 40,  w: 62,  align: 'left'  as const },
  folio:    { x: 102, w: 72,  align: 'left'  as const },
  tipo:     { x: 174, w: 58,  align: 'left'  as const },
  concepto: { x: 232, w: 118, align: 'left'  as const },
  cargo:    { x: 350, w: 68,  align: 'right' as const },
  abono:    { x: 418, w: 68,  align: 'right' as const },
  saldo:    { x: 486, w: 70,  align: 'right' as const },
};
type Col = keyof typeof COL;
const COLS: Col[] = ['fecha', 'folio', 'tipo', 'concepto', 'cargo', 'abono', 'saldo'];
const COL_HEADERS: Record<Col, string> = {
  fecha: 'Fecha', folio: 'Folio', tipo: 'Tipo', concepto: 'Concepto',
  cargo: 'Cargo', abono: 'Abono', saldo: 'Saldo',
};

// ── Columnas modo detalle ─────────────────────────────────────────────────────
// Anchura total 40→556 (=516px). Reemplaza Cargo/Abono por Total doc./Aplicado/Saldo.
const COL_D = {
  fecha:     { x: 40,  w: 60,  align: 'left'  as const },
  folio:     { x: 100, w: 70,  align: 'left'  as const },
  tipo:      { x: 170, w: 55,  align: 'left'  as const },
  concepto:  { x: 225, w: 95,  align: 'left'  as const },
  total_doc: { x: 320, w: 72,  align: 'right' as const },
  aplicado:  { x: 392, w: 72,  align: 'right' as const },
  saldo:     { x: 464, w: 92,  align: 'right' as const },
};
type ColD = keyof typeof COL_D;
const COLS_D: ColD[] = ['fecha', 'folio', 'tipo', 'concepto', 'total_doc', 'aplicado', 'saldo'];
const COL_D_HEADERS: Record<ColD, string> = {
  fecha: 'Fecha', folio: 'Folio', tipo: 'Tipo', concepto: 'Concepto',
  total_doc: 'Total doc.', aplicado: 'Aplicado', saldo: 'Saldo',
};

const TABLE_RIGHT  = 556; // COL.saldo.x + COL.saldo.w = COL_D.saldo.x + COL_D.saldo.w
const ROW_H        = 16;
const HEADER_H     = 18;
const FONT_SM      = 7.5;
const FONT_MD      = 8.5;
const MARGIN_LEFT  = 40;
const PAGE_W       = 595.28;
const PAGE_H       = 841.89;
const MARGIN_BOTTOM = 40;

// ── Utilidades ────────────────────────────────────────────────────────────────

type AnyCol = { x: number; w: number; align: 'left' | 'right' };

function drawCell(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  col: AnyCol,
  y: number,
  opts: { bold?: boolean; color?: string; strike?: boolean; indent?: number } = {}
) {
  const pad    = 3;
  const indent = opts.indent ?? 0;
  doc
    .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(FONT_SM)
    .fillColor(opts.color ?? BLACK);

  if (col.align === 'right') {
    doc.text(text, col.x, y + pad, { width: col.w - pad, align: 'right', lineBreak: false });
  } else {
    doc.text(text, col.x + pad + indent, y + pad, {
      width: col.w - pad * 2 - indent,
      lineBreak: false,
      ellipsis: true,
    });
  }

  if (opts.strike) {
    const textW = Math.min(doc.widthOfString(text), col.w - pad * 2 - indent);
    const textX = col.align === 'right' ? col.x + col.w - pad - textW : col.x + pad + indent;
    const lineY = y + pad + FONT_SM / 2;
    doc.moveTo(textX, lineY).lineTo(textX + textW, lineY).strokeColor(GRAY_MID).lineWidth(0.5).stroke();
  }
}

function saldoColor(v: number, cancelado = false): string {
  if (cancelado) return GRAY_MID;
  if (v > 0) return RED;
  if (v < 0) return GREEN;
  return BLACK;
}

// ── Encabezados de tabla ──────────────────────────────────────────────────────

function drawTableHeader(doc: InstanceType<typeof PDFDocument>, y: number) {
  doc.rect(MARGIN_LEFT, y, TABLE_RIGHT - MARGIN_LEFT, HEADER_H).fill(BRAND);
  COLS.forEach((key) => {
    const col = COL[key];
    const pad = 3;
    doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor('#ffffff');
    if (col.align === 'right') {
      doc.text(COL_HEADERS[key], col.x, y + pad + 1, { width: col.w - pad, align: 'right', lineBreak: false });
    } else {
      doc.text(COL_HEADERS[key], col.x + pad, y + pad + 1, { width: col.w, lineBreak: false });
    }
  });
  return y + HEADER_H;
}

function drawTableHeaderDetalle(doc: InstanceType<typeof PDFDocument>, y: number) {
  doc.rect(MARGIN_LEFT, y, TABLE_RIGHT - MARGIN_LEFT, HEADER_H).fill(BRAND);
  COLS_D.forEach((key) => {
    const col = COL_D[key];
    const pad = 3;
    doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor('#ffffff');
    if (col.align === 'right') {
      doc.text(COL_D_HEADERS[key], col.x, y + pad + 1, { width: col.w - pad, align: 'right', lineBreak: false });
    } else {
      doc.text(COL_D_HEADERS[key], col.x + pad, y + pad + 1, { width: col.w, lineBreak: false });
    }
  });
  return y + HEADER_H;
}

// ── Fila estándar ─────────────────────────────────────────────────────────────

function drawRow(
  doc: InstanceType<typeof PDFDocument>,
  mov: MovimientoEstadoCuenta,
  y: number,
  shade: boolean
) {
  if (shade) doc.rect(MARGIN_LEFT, y, TABLE_RIGHT - MARGIN_LEFT, ROW_H).fill(GRAY_LIGHT);

  const color    = mov.cancelado ? GRAY_MID : BLACK;
  const strike   = mov.cancelado;
  const sc       = saldoColor(mov.saldo, mov.cancelado);

  drawCell(doc, fmtFecha(mov.fecha), COL.fecha, y, { color, strike });
  drawCell(doc, mov.folio, COL.folio, y, { color, strike });
  drawCell(doc, mov.tipo_etiqueta, COL.tipo, y, { color, strike });
  drawCell(doc, mov.concepto, COL.concepto, y, { color, strike });
  drawCell(doc, mov.cargo > 0 ? fmt(mov.cargo) : '', COL.cargo, y, { color, strike });
  drawCell(doc, mov.abono > 0 ? fmt(mov.abono) : '', COL.abono, y, { color, strike });
  drawCell(doc, fmt(mov.saldo), COL.saldo, y, { bold: true, color: sc });
}

// ── Fila documento en modo detalle ────────────────────────────────────────────

function drawRowDetalle(
  doc: InstanceType<typeof PDFDocument>,
  mov: MovimientoEstadoCuenta,
  y: number,
  shade: boolean
) {
  if (shade) doc.rect(MARGIN_LEFT, y, TABLE_RIGHT - MARGIN_LEFT, ROW_H).fill(GRAY_LIGHT);

  const totalDoc  = mov.total_original ?? 0;
  const saldoAct  = mov.cancelado ? 0 : (mov.saldo_actual ?? 0);
  const aplicado  = mov.cancelado ? 0 : Math.max(0, totalDoc - saldoAct);

  const color  = mov.cancelado ? GRAY_MID : BLACK;
  const strike = mov.cancelado;

  // Color del saldo: cargo pendiente=rojo, abono disponible=verde, cero=negro
  const sc = mov.cancelado
    ? GRAY_MID
    : saldoAct === 0
    ? BLACK
    : mov.es_cargo
    ? RED        // factura con saldo pendiente
    : GREEN;     // pago/nota con saldo disponible (a favor)

  drawCell(doc, fmtFecha(mov.fecha), COL_D.fecha, y, { color, strike });
  drawCell(doc, mov.folio, COL_D.folio, y, { color, strike });
  drawCell(doc, mov.tipo_etiqueta, COL_D.tipo, y, { color, strike });
  drawCell(doc, mov.concepto, COL_D.concepto, y, { color, strike });
  drawCell(doc, totalDoc > 0 ? fmt(totalDoc) : '', COL_D.total_doc, y, { color, strike });
  drawCell(doc, aplicado > 0 ? fmt(aplicado) : '', COL_D.aplicado, y, { color });
  drawCell(doc, !mov.cancelado ? fmt(saldoAct) : '', COL_D.saldo, y, { bold: true, color: sc });
}

// ── Fila de aplicación (sangría) ──────────────────────────────────────────────

const INDENT = 12;

function drawAplicacionRow(
  doc: InstanceType<typeof PDFDocument>,
  apl: AplicacionDetalle,
  y: number
) {
  doc.rect(MARGIN_LEFT, y, TABLE_RIGHT - MARGIN_LEFT, ROW_H).fill(GRAY_SUB);

  const FONT_APL = FONT_SM - 0.5;
  const color    = GRAY_HEADER;

  const cell = (text: string, col: AnyCol, opts: { right?: boolean; indent?: number } = {}) => {
    doc.font('Helvetica').fontSize(FONT_APL).fillColor(color);
    const ind = opts.indent ?? 0;
    if (opts.right) {
      doc.text(text, col.x, y + 3, { width: col.w - 3, align: 'right', lineBreak: false });
    } else {
      doc.text(text, col.x + 3 + ind, y + 3, {
        width: col.w - 3 - ind,
        lineBreak: false,
        ellipsis: true,
      });
    }
  };

  // Marcador ↳
  doc.font('Helvetica').fontSize(FONT_APL - 0.5).fillColor(GRAY_MID)
    .text('↳', COL_D.fecha.x + 3, y + 3.5, { lineBreak: false });

  cell(fmtFecha(apl.fecha), COL_D.fecha, { indent: INDENT });
  cell(apl.folio, COL_D.folio, { indent: INDENT });
  cell(apl.tipo_etiqueta, COL_D.tipo);
  cell(apl.concepto, COL_D.concepto);

  // Área numérica fusionada (ocupa total_doc + aplicado + saldo):
  // Muestra "Aplicado:" + monto alineado al extremo derecho, sin celdas vacías.
  const areaX = COL_D.total_doc.x;
  const areaW = (COL_D.saldo.x + COL_D.saldo.w) - areaX;
  const pad   = 3;

  doc.font('Helvetica').fontSize(FONT_APL - 0.5).fillColor(GRAY_MID)
    .text('Aplicado:', areaX + pad, y + 3, { lineBreak: false });

  doc.font('Helvetica').fontSize(FONT_APL).fillColor(GRAY_HEADER)
    .text(fmt(apl.monto), areaX, y + 3, { width: areaW - pad, align: 'right', lineBreak: false });
}

// ── Exportación principal ─────────────────────────────────────────────────────

export function generarEstadoCuentaPDF(
  resultado: EstadoCuentaResult,
  titulo: string,
  contactoLabel: string,
  detalle = false
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: titulo } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Banda de marca ──
    doc.rect(0, 0, PAGE_W, 56).fill(BRAND);
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#ffffff')
      .text('Emphasys', MARGIN_LEFT, 14, { lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.8)')
      .text(titulo, MARGIN_LEFT, 32, { lineBreak: false });

    let y = 72;
    const col2x = PAGE_W / 2;

    // ── Datos del contacto ──
    doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID)
      .text(contactoLabel.toUpperCase(), MARGIN_LEFT, y);
    doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(BLACK)
      .text(resultado.contacto?.nombre ?? '—', MARGIN_LEFT, y + 10, { lineBreak: false });

    doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID)
      .text('RFC', col2x, y);
    doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(BLACK)
      .text(resultado.contacto?.rfc ?? '—', col2x, y + 10, { lineBreak: false });

    y += 32;

    doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID)
      .text('FECHA DE CORTE', MARGIN_LEFT, y);
    doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(BLACK)
      .text(fmtFecha(resultado.fecha_corte), MARGIN_LEFT, y + 10, { lineBreak: false });

    const scFinal = saldoColor(resultado.saldo_final);
    doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID)
      .text(`SALDO AL ${fmtFecha(resultado.fecha_corte)}`, col2x, y);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(scFinal)
      .text(fmt(resultado.saldo_final), col2x, y + 8, { lineBreak: false });

    y += 38;

    // ── Separador ──
    doc.rect(MARGIN_LEFT, y, TABLE_RIGHT - MARGIN_LEFT, 1).fill('#e5e7eb');
    y += 6;

    // ── Tabla ──
    const addPageHeader = () => {
      doc.addPage({ size: 'A4', margin: 0 });
      doc.rect(0, 0, PAGE_W, 30).fill(BRAND);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff')
        .text(titulo, MARGIN_LEFT, 10, { lineBreak: false });
      y = 36;
      y = detalle ? drawTableHeaderDetalle(doc, y) : drawTableHeader(doc, y);
    };

    y = detalle ? drawTableHeaderDetalle(doc, y) : drawTableHeader(doc, y);

    let shadeIdx = 0;
    for (const mov of resultado.movimientos) {
      const aplicaciones = detalle ? (mov.aplicaciones ?? []) : [];
      const bloqueH = ROW_H * (1 + aplicaciones.length);

      if (y + bloqueH > PAGE_H - MARGIN_BOTTOM) {
        addPageHeader();
        shadeIdx = 0;
      }

      if (detalle) {
        drawRowDetalle(doc, mov, y, shadeIdx % 2 === 0);
      } else {
        drawRow(doc, mov, y, shadeIdx % 2 === 0);
      }
      y += ROW_H;
      shadeIdx++;

      for (const apl of aplicaciones) {
        if (y + ROW_H > PAGE_H - MARGIN_BOTTOM) {
          addPageHeader();
          shadeIdx = 0;
        }
        drawAplicacionRow(doc, apl, y);
        y += ROW_H;
      }
    }

    // ── Total final ──
    y += 2;
    doc.rect(MARGIN_LEFT, y, TABLE_RIGHT - MARGIN_LEFT, 1).fill(BRAND);
    y += 5;

    // En modo detalle la etiqueta va antes de la última columna numérica
    const etqCol  = detalle ? COL_D.aplicado : COL.abono;
    const valCol  = detalle ? COL_D.saldo    : COL.saldo;

    doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor(GRAY_HEADER)
      .text('Saldo al corte:', etqCol.x, y, { width: etqCol.w, align: 'right', lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(scFinal)
      .text(fmt(resultado.saldo_final), valCol.x, y, { width: valCol.w - 3, align: 'right', lineBreak: false });

    // ── Pie ──
    y += 24;
    doc.font('Helvetica').fontSize(6.5).fillColor(GRAY_MID)
      .text(
        `Generado el ${new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}`,
        MARGIN_LEFT, y,
        { lineBreak: false }
      );

    doc.end();
  });
}

// ── Compras por Proveedor PDF ─────────────────────────────────────────────────

const CPP_RIGHT = 556;
const CPP_LEFT  = 40;
const CPP_W     = CPP_RIGHT - CPP_LEFT;

// Columnas vista resumen
const CPP_COL = {
  nombre:            { x: CPP_LEFT,       w: 192, align: 'left'  as const },
  rfc:               { x: CPP_LEFT + 192, w: 82,  align: 'left'  as const },
  facturas:          { x: CPP_LEFT + 274, w: 38,  align: 'right' as const },
  subtotal:          { x: CPP_LEFT + 312, w: 62,  align: 'right' as const },
  iva:               { x: CPP_LEFT + 374, w: 56,  align: 'right' as const },
  total_comprado:    { x: CPP_LEFT + 430, w: 72,  align: 'right' as const },
  pct:               { x: CPP_LEFT + 502, w: 54,  align: 'right' as const },
};
type CppCol = keyof typeof CPP_COL;
const CPP_COLS: CppCol[] = ['nombre', 'rfc', 'facturas', 'subtotal', 'iva', 'total_comprado', 'pct'];
const CPP_HEADERS: Record<CppCol, string> = {
  nombre: 'Proveedor', rfc: 'RFC', facturas: 'Facturas',
  subtotal: 'Subtotal', iva: 'IVA', total_comprado: 'Total Comprado', pct: '% Part.',
};

// Columnas vista detalle (facturas)
const CPP_COL_D = {
  fecha:    { x: CPP_LEFT,       w: 80,  align: 'left'  as const },
  folio:    { x: CPP_LEFT + 80,  w: 154, align: 'left'  as const },
  subtotal: { x: CPP_LEFT + 234, w: 94,  align: 'right' as const },
  iva:      { x: CPP_LEFT + 328, w: 82,  align: 'right' as const },
  total:    { x: CPP_LEFT + 410, w: 106, align: 'right' as const },
};
type CppColD = keyof typeof CPP_COL_D;
const CPP_COLS_D: CppColD[] = ['fecha', 'folio', 'subtotal', 'iva', 'total'];
const CPP_HEADERS_D: Record<CppColD, string> = {
  fecha: 'Fecha', folio: 'Folio', subtotal: 'Subtotal', iva: 'IVA', total: 'Total',
};

function cppDrawHeaderRow(doc: InstanceType<typeof PDFDocument>, y: number, cols: typeof CPP_COL | typeof CPP_COL_D, headers: Record<string, string>, keys: string[]) {
  doc.rect(CPP_LEFT, y, CPP_W, HEADER_H).fill(BRAND);
  for (const key of keys) {
    const col = (cols as Record<string, AnyCol>)[key];
    const pad = 3;
    doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor('#ffffff');
    if (col.align === 'right') {
      doc.text(headers[key], col.x, y + pad + 1, { width: col.w - pad, align: 'right', lineBreak: false });
    } else {
      doc.text(headers[key], col.x + pad, y + pad + 1, { width: col.w - pad * 2, lineBreak: false });
    }
  }
  return y + HEADER_H;
}

function cppDrawResumenRow(doc: InstanceType<typeof PDFDocument>, p: ContactoVolumen, y: number, shade: boolean) {
  if (shade) doc.rect(CPP_LEFT, y, CPP_W, ROW_H).fill(GRAY_LIGHT);
  const c = BLACK;
  const pad = 3;

  const draw = (text: string, col: AnyCol) => {
    doc.font('Helvetica').fontSize(FONT_SM).fillColor(c);
    if (col.align === 'right') {
      doc.text(text, col.x, y + pad, { width: col.w - pad, align: 'right', lineBreak: false });
    } else {
      doc.text(text, col.x + pad, y + pad, { width: col.w - pad * 2, lineBreak: false, ellipsis: true });
    }
  };

  draw(p.nombre,                             CPP_COL.nombre);
  draw(p.rfc,                                CPP_COL.rfc);
  draw(String(p.cantidad_facturas),          CPP_COL.facturas);
  draw(fmt(p.subtotal),                      CPP_COL.subtotal);
  draw(fmt(p.iva),                           CPP_COL.iva);
  doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor(BRAND);
  if (CPP_COL.total_comprado.align === 'right') {
    doc.text(fmt(p.total_comprado), CPP_COL.total_comprado.x, y + pad, { width: CPP_COL.total_comprado.w - pad, align: 'right', lineBreak: false });
  }
  doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_HEADER);
  doc.text(`${p.pct_participacion.toFixed(2)} %`, CPP_COL.pct.x, y + pad, { width: CPP_COL.pct.w - pad, align: 'right', lineBreak: false });
}

function cppDrawFacturaRow(doc: InstanceType<typeof PDFDocument>, f: FacturaVolumenDetalle, y: number, shade: boolean) {
  if (shade) doc.rect(CPP_LEFT, y, CPP_W, ROW_H).fill(GRAY_LIGHT);
  const color = f.cancelado ? GRAY_MID : BLACK;
  const strike = f.cancelado;
  const pad = 3;

  const draw = (text: string, col: AnyCol) => {
    doc.font('Helvetica').fontSize(FONT_SM).fillColor(color);
    if (col.align === 'right') {
      doc.text(text, col.x, y + pad, { width: col.w - pad, align: 'right', lineBreak: false });
    } else {
      doc.text(text, col.x + pad, y + pad, { width: col.w - pad * 2, lineBreak: false, ellipsis: true });
    }
    if (strike) {
      const tw = Math.min(doc.widthOfString(text), col.w - pad * 2);
      const tx = col.align === 'right' ? col.x + col.w - pad - tw : col.x + pad;
      doc.moveTo(tx, y + pad + FONT_SM / 2).lineTo(tx + tw, y + pad + FONT_SM / 2)
        .strokeColor(GRAY_MID).lineWidth(0.5).stroke();
    }
  };

  draw(fmtFecha(f.fecha),  CPP_COL_D.fecha);
  draw(f.folio,            CPP_COL_D.folio);
  draw(fmt(f.subtotal),    CPP_COL_D.subtotal);
  draw(fmt(f.iva),         CPP_COL_D.iva);
  draw(fmt(f.total),       CPP_COL_D.total);
}

export function generarVolumenContactoPDF(
  resultado: VolumenContactoResult,
  detalle = false,
  titulo = 'Compras por Proveedor',
  contactoLabel = 'Proveedor'
): Promise<Buffer> {
  void contactoLabel; // reservado para uso futuro en encabezados

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: titulo } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Banda de marca
    doc.rect(0, 0, PAGE_W, 56).fill(BRAND);
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#ffffff')
      .text('Emphasys', CPP_LEFT, 14, { lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.8)')
      .text(titulo, CPP_LEFT, 32, { lineBreak: false });

    let y = 72;

    // Período
    doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID)
      .text('PERÍODO', CPP_LEFT, y);
    doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(BLACK)
      .text(`${fmtFecha(resultado.fecha_inicio)}  →  ${fmtFecha(resultado.fecha_fin)}`, CPP_LEFT, y + 10, { lineBreak: false });

    // Totales en el encabezado
    const totalGeneral = resultado.contactos.reduce((s, p) => s + p.total_comprado, 0);
    const totalFacturas = resultado.contactos.reduce((s, p) => s + p.cantidad_facturas, 0);
    const col2x = PAGE_W / 2;

    doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID)
      .text('CONTACTOS / FACTURAS', col2x, y);
    doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(BLACK)
      .text(`${resultado.contactos.length}  /  ${totalFacturas}`, col2x, y + 10, { lineBreak: false });

    y += 32;

    doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID).text('TOTAL COMPRADO', CPP_LEFT, y);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(BRAND)
      .text(fmt(totalGeneral), CPP_LEFT, y + 8, { lineBreak: false });

    y += 36;
    doc.rect(CPP_LEFT, y, CPP_W, 1).fill('#e5e7eb');
    y += 6;

    const addPageHeader = () => {
      doc.addPage({ size: 'A4', margin: 0 });
      doc.rect(0, 0, PAGE_W, 30).fill(BRAND);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff')
        .text(titulo, CPP_LEFT, 10, { lineBreak: false });
      y = 36;
    };

    if (!detalle) {
      // ── Vista resumen ──
      y = cppDrawHeaderRow(doc, y, CPP_COL, CPP_HEADERS, CPP_COLS);
      let shade = 0;
      for (const p of resultado.contactos) {
        if (y + ROW_H > PAGE_H - MARGIN_BOTTOM) {
          addPageHeader();
          y = cppDrawHeaderRow(doc, y, CPP_COL, CPP_HEADERS, CPP_COLS);
          shade = 0;
        }
        cppDrawResumenRow(doc, p, y, shade % 2 === 0);
        y += ROW_H;
        shade++;
      }

      // Totales
      y += 2;
      doc.rect(CPP_LEFT, y, CPP_W, 1).fill(BRAND);
      y += 5;
      const labelW = 90;
      doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor(GRAY_HEADER)
        .text('Total comprado:', CPP_COL.iva.x, y, { width: CPP_COL.iva.w - 3, align: 'right', lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(BRAND)
        .text(fmt(totalGeneral), CPP_COL.total_comprado.x, y, { width: CPP_COL.total_comprado.w - 3, align: 'right', lineBreak: false });
      void labelW;
    } else {
      // ── Vista detalle ──
      const facturasPorContacto = new Map<number, FacturaVolumenDetalle[]>();
      for (const f of resultado.facturas) {
        if (!facturasPorContacto.has(f.contacto_id)) facturasPorContacto.set(f.contacto_id, []);
        facturasPorContacto.get(f.contacto_id)!.push(f);
      }

      for (const p of resultado.contactos) {
        const facturas = facturasPorContacto.get(p.contacto_id) ?? [];

        // Encabezado de proveedor
        if (y + HEADER_H + ROW_H > PAGE_H - MARGIN_BOTTOM) {
          addPageHeader();
        }
        doc.rect(CPP_LEFT, y, CPP_W, HEADER_H + 2).fill(GRAY_SUB);
        doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(BLACK)
          .text(p.nombre, CPP_LEFT + 3, y + 3, { lineBreak: false });
        doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID)
          .text(`RFC: ${p.rfc || '—'}`, CPP_LEFT + 3, y + 13, { lineBreak: false });
        const pctTxt = `${p.pct_participacion.toFixed(2)} %`;
        const totalTxt = fmt(p.total_comprado);
        const factsTxt = `${p.cantidad_facturas} factura${p.cantidad_facturas === 1 ? '' : 's'}`;
        doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor(BRAND)
          .text(totalTxt, CPP_RIGHT - 110, y + 3, { width: 110 - 3, align: 'right', lineBreak: false });
        doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID)
          .text(`${factsTxt}  ·  ${pctTxt}`, CPP_RIGHT - 150, y + 13, { width: 150 - 3, align: 'right', lineBreak: false });
        y += HEADER_H + 4;

        // Encabezado de columnas
        if (y + HEADER_H > PAGE_H - MARGIN_BOTTOM) { addPageHeader(); }
        y = cppDrawHeaderRow(doc, y, CPP_COL_D, CPP_HEADERS_D, CPP_COLS_D);

        let shade = 0;
        for (const f of facturas) {
          if (y + ROW_H > PAGE_H - MARGIN_BOTTOM) {
            addPageHeader();
            y = cppDrawHeaderRow(doc, y, CPP_COL_D, CPP_HEADERS_D, CPP_COLS_D);
            shade = 0;
          }
          cppDrawFacturaRow(doc, f, y, shade % 2 === 0);
          y += ROW_H;
          shade++;
        }

        // Subtotal del proveedor
        y += 2;
        doc.rect(CPP_LEFT, y, CPP_W, 0.5).fill(GRAY_MID);
        y += 4;
        doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor(GRAY_HEADER)
          .text('Subtotal proveedor:', CPP_COL_D.iva.x, y, { width: CPP_COL_D.iva.w - 3, align: 'right', lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor(BRAND)
          .text(fmt(p.total_comprado), CPP_COL_D.total.x, y, { width: CPP_COL_D.total.w - 3, align: 'right', lineBreak: false });
        y += ROW_H + 4;
      }

      // Total general
      y += 2;
      doc.rect(CPP_LEFT, y, CPP_W, 1).fill(BRAND);
      y += 5;
      doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor(GRAY_HEADER)
        .text('Total comprado:', CPP_COL_D.iva.x, y, { width: CPP_COL_D.iva.w - 3, align: 'right', lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(BRAND)
        .text(fmt(totalGeneral), CPP_COL_D.total.x, y, { width: CPP_COL_D.total.w - 3, align: 'right', lineBreak: false });
    }

    // Pie de página
    y += 24;
    doc.font('Helvetica').fontSize(6.5).fillColor(GRAY_MID)
      .text(
        `Generado el ${new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}`,
        CPP_LEFT, y,
        { lineBreak: false }
      );

    doc.end();
  });
}

// ── Compras / Ventas por Producto PDF ─────────────────────────────────────────

const PPP_LEFT  = 40;
const PPP_RIGHT = 556;
const PPP_W     = PPP_RIGHT - PPP_LEFT;

// Columnas vista resumen (9 cols, 516px total)
const PPP_COL = {
  clave:       { x: PPP_LEFT,       w: 48,  align: 'left'  as const },
  descripcion: { x: PPP_LEFT + 48,  w: 128, align: 'left'  as const },
  unidad:      { x: PPP_LEFT + 176, w: 28,  align: 'left'  as const },
  cantidad:    { x: PPP_LEFT + 204, w: 46,  align: 'right' as const },
  precio_prom: { x: PPP_LEFT + 250, w: 58,  align: 'right' as const },
  ultimo_pu:   { x: PPP_LEFT + 308, w: 58,  align: 'right' as const },
  total:       { x: PPP_LEFT + 366, w: 72,  align: 'right' as const },
  ult_mov:     { x: PPP_LEFT + 438, w: 46,  align: 'right' as const },
  pct:         { x: PPP_LEFT + 484, w: 32,  align: 'right' as const },
};
type PppCol = keyof typeof PPP_COL;
const PPP_COLS: PppCol[] = ['clave', 'descripcion', 'unidad', 'cantidad', 'precio_prom', 'ultimo_pu', 'total', 'ult_mov', 'pct'];

// Columnas vista detalle de partidas (7 cols, 516px total)
const PPP_COL_D = {
  fecha:       { x: PPP_LEFT,       w: 58,  align: 'left'  as const },
  folio:       { x: PPP_LEFT + 58,  w: 70,  align: 'left'  as const },
  contacto:    { x: PPP_LEFT + 128, w: 120, align: 'left'  as const },
  cantidad:    { x: PPP_LEFT + 248, w: 44,  align: 'right' as const },
  precio_unit: { x: PPP_LEFT + 292, w: 60,  align: 'right' as const },
  subtotal:    { x: PPP_LEFT + 352, w: 68,  align: 'right' as const },
  total:       { x: PPP_LEFT + 420, w: 96,  align: 'right' as const },
};
type PppColD = keyof typeof PPP_COL_D;
const PPP_COLS_D: PppColD[] = ['fecha', 'folio', 'contacto', 'cantidad', 'precio_unit', 'subtotal', 'total'];

function pppDrawHeaderRow(
  doc: InstanceType<typeof PDFDocument>,
  y: number,
  cols: Record<string, AnyCol>,
  headers: Record<string, string>,
  keys: string[]
) {
  doc.rect(PPP_LEFT, y, PPP_W, HEADER_H).fill(BRAND);
  for (const key of keys) {
    const col = cols[key];
    const pad = 3;
    doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor('#ffffff');
    if (col.align === 'right') {
      doc.text(headers[key], col.x, y + pad + 1, { width: col.w - pad, align: 'right', lineBreak: false });
    } else {
      doc.text(headers[key], col.x + pad, y + pad + 1, { width: col.w - pad * 2, lineBreak: false });
    }
  }
  return y + HEADER_H;
}

function pppDrawResumenRow(
  doc: InstanceType<typeof PDFDocument>,
  p: ProductoVolumen,
  y: number,
  shade: boolean
) {
  if (shade) doc.rect(PPP_LEFT, y, PPP_W, ROW_H).fill(GRAY_LIGHT);
  const pad = 3;

  const draw = (text: string, col: AnyCol, bold = false, color = BLACK) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(FONT_SM).fillColor(color);
    if (col.align === 'right') {
      doc.text(text, col.x, y + pad, { width: col.w - pad, align: 'right', lineBreak: false });
    } else {
      doc.text(text, col.x + pad, y + pad, { width: col.w - pad * 2, lineBreak: false, ellipsis: true });
    }
  };

  draw(p.clave, PPP_COL.clave);
  draw(p.descripcion, PPP_COL.descripcion);
  draw(p.unidad, PPP_COL.unidad);
  draw(p.cantidad_total.toLocaleString('es-MX', { maximumFractionDigits: 4 }), PPP_COL.cantidad);
  draw(fmt(p.precio_promedio), PPP_COL.precio_prom);
  draw(fmt(p.ultimo_precio_unitario), PPP_COL.ultimo_pu);
  draw(fmt(p.total), PPP_COL.total, true, BRAND);
  draw(fmtFecha(p.ultimo_movimiento), PPP_COL.ult_mov);
  draw(`${p.pct_participacion.toFixed(2)} %`, PPP_COL.pct);
}

function pppDrawPartidaRow(
  doc: InstanceType<typeof PDFDocument>,
  partida: PartidaVolumenDetalle,
  y: number,
  shade: boolean
) {
  if (shade) doc.rect(PPP_LEFT, y, PPP_W, ROW_H).fill(GRAY_LIGHT);
  const pad = 3;

  const draw = (text: string, col: AnyCol, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(FONT_SM).fillColor(BLACK);
    if (col.align === 'right') {
      doc.text(text, col.x, y + pad, { width: col.w - pad, align: 'right', lineBreak: false });
    } else {
      doc.text(text, col.x + pad, y + pad, { width: col.w - pad * 2, lineBreak: false, ellipsis: true });
    }
  };

  draw(fmtFecha(partida.fecha), PPP_COL_D.fecha);
  draw(partida.folio, PPP_COL_D.folio);
  draw(partida.contacto_nombre, PPP_COL_D.contacto);
  draw(partida.cantidad.toLocaleString('es-MX', { maximumFractionDigits: 4 }), PPP_COL_D.cantidad);
  draw(fmt(partida.precio_unitario), PPP_COL_D.precio_unit);
  draw(fmt(partida.subtotal), PPP_COL_D.subtotal);
  draw(fmt(partida.total), PPP_COL_D.total, true);
}

export function generarVolumenProductoPDF(
  resultado: VolumenProductoResult,
  detalle = false,
  titulo = 'Compras por Producto',
  contactoLabel = 'Proveedor',
  ultimoPrecioLabel = 'Último costo'
): Promise<Buffer> {
  const PPP_HEADERS: Record<PppCol, string> = {
    clave: 'Clave', descripcion: 'Descripción', unidad: 'Unidad', cantidad: 'Cantidad',
    precio_prom: 'Precio Prom.', ultimo_pu: ultimoPrecioLabel.length > 12 ? 'Últ. C/P' : ultimoPrecioLabel,
    total: 'Total', ult_mov: 'Últ. Mov.', pct: '% Part.',
  };
  const PPP_HEADERS_D: Record<PppColD, string> = {
    fecha: 'Fecha', folio: 'Folio', contacto: contactoLabel,
    cantidad: 'Cantidad', precio_unit: 'Precio Unit.', subtotal: 'Subtotal', total: 'Total',
  };

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: titulo } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Banda de marca
    doc.rect(0, 0, PAGE_W, 56).fill(BRAND);
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#ffffff')
      .text('Emphasys', PPP_LEFT, 14, { lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.8)')
      .text(titulo, PPP_LEFT, 32, { lineBreak: false });

    let y = 72;
    const col2x = PAGE_W / 2;

    // Bloque de meta
    doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID).text('PERÍODO', PPP_LEFT, y);
    doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(BLACK)
      .text(`${fmtFecha(resultado.fecha_inicio)}  →  ${fmtFecha(resultado.fecha_fin)}`, PPP_LEFT, y + 10, { lineBreak: false });

    const totalGeneral  = resultado.productos.reduce((s, p) => s + p.total, 0);
    const totalCantidad = resultado.productos.reduce((s, p) => s + p.cantidad_total, 0);
    const cantDocs      = resultado.productos.reduce((s, p) => s + p.cantidad_documentos, 0);

    doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID).text('ARTÍCULOS / DOCS.', col2x, y);
    doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(BLACK)
      .text(`${resultado.productos.length}  /  ${cantDocs}`, col2x, y + 10, { lineBreak: false });

    y += 32;

    doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID).text('TOTAL', PPP_LEFT, y);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(BRAND)
      .text(fmt(totalGeneral), PPP_LEFT, y + 8, { lineBreak: false });

    doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID).text('CANTIDAD TOTAL', col2x, y);
    doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(BLACK)
      .text(totalCantidad.toLocaleString('es-MX', { maximumFractionDigits: 4 }), col2x, y + 8, { lineBreak: false });

    y += 36;
    doc.rect(PPP_LEFT, y, PPP_W, 1).fill('#e5e7eb');
    y += 6;

    const addPageHeader = () => {
      doc.addPage({ size: 'A4', margin: 0 });
      doc.rect(0, 0, PAGE_W, 30).fill(BRAND);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff')
        .text(titulo, PPP_LEFT, 10, { lineBreak: false });
      y = 36;
    };

    if (!detalle) {
      // ── Vista resumen ──────────────────────────────────────────────────────
      y = pppDrawHeaderRow(doc, y, PPP_COL as unknown as Record<string, AnyCol>, PPP_HEADERS, PPP_COLS);
      let shade = 0;
      for (const p of resultado.productos) {
        if (y + ROW_H > PAGE_H - MARGIN_BOTTOM) {
          addPageHeader();
          y = pppDrawHeaderRow(doc, y, PPP_COL as unknown as Record<string, AnyCol>, PPP_HEADERS, PPP_COLS);
          shade = 0;
        }
        pppDrawResumenRow(doc, p, y, shade % 2 === 0);
        y += ROW_H;
        shade++;
      }

      // Total general
      y += 2;
      doc.rect(PPP_LEFT, y, PPP_W, 1).fill(BRAND);
      y += 5;
      doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor(GRAY_HEADER)
        .text('Total:', PPP_COL.ultimo_pu.x, y, { width: PPP_COL.ultimo_pu.w - 3, align: 'right', lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(BRAND)
        .text(fmt(totalGeneral), PPP_COL.total.x, y, { width: PPP_COL.total.w - 3, align: 'right', lineBreak: false });

    } else {
      // ── Vista detalle ──────────────────────────────────────────────────────
      const partidasPorGrupo = new Map<string, PartidaVolumenDetalle[]>();
      for (const partida of resultado.partidas) {
        if (!partidasPorGrupo.has(partida.grupo_key)) partidasPorGrupo.set(partida.grupo_key, []);
        partidasPorGrupo.get(partida.grupo_key)!.push(partida);
      }

      for (const prod of resultado.productos) {
        const items = partidasPorGrupo.get(prod.grupo_key) ?? [];

        // Encabezado del producto
        if (y + HEADER_H + 4 + HEADER_H + ROW_H > PAGE_H - MARGIN_BOTTOM) addPageHeader();
        doc.rect(PPP_LEFT, y, PPP_W, HEADER_H + 4).fill(GRAY_SUB);
        doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(BLACK)
          .text(`${prod.clave} — ${prod.descripcion}`, PPP_LEFT + 3, y + 3, { width: PPP_W - 116, lineBreak: false, ellipsis: true });
        doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID)
          .text(`${prod.unidad || '—'} · Últ. mov.: ${fmtFecha(prod.ultimo_movimiento)}`, PPP_LEFT + 3, y + 13, { lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor(BRAND)
          .text(fmt(prod.total), PPP_RIGHT - 110, y + 3, { width: 107, align: 'right', lineBreak: false });
        doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID)
          .text(`${prod.pct_participacion.toFixed(2)} %`, PPP_RIGHT - 110, y + 13, { width: 107, align: 'right', lineBreak: false });
        y += HEADER_H + 6;

        // Encabezado de columnas
        if (y + HEADER_H > PAGE_H - MARGIN_BOTTOM) addPageHeader();
        y = pppDrawHeaderRow(doc, y, PPP_COL_D as unknown as Record<string, AnyCol>, PPP_HEADERS_D, PPP_COLS_D);

        // Filas de partidas
        let shade = 0;
        for (const partida of items) {
          if (y + ROW_H > PAGE_H - MARGIN_BOTTOM) {
            addPageHeader();
            y = pppDrawHeaderRow(doc, y, PPP_COL_D as unknown as Record<string, AnyCol>, PPP_HEADERS_D, PPP_COLS_D);
            shade = 0;
          }
          pppDrawPartidaRow(doc, partida, y, shade % 2 === 0);
          y += ROW_H;
          shade++;
        }

        // Subtotal del producto
        y += 2;
        doc.rect(PPP_LEFT, y, PPP_W, 0.5).fill(GRAY_MID);
        y += 4;
        doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor(GRAY_HEADER)
          .text('Subtotal artículo:', PPP_COL_D.precio_unit.x, y, { width: PPP_COL_D.precio_unit.w - 3, align: 'right', lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor(BRAND)
          .text(fmt(prod.total), PPP_COL_D.total.x, y, { width: PPP_COL_D.total.w - 3, align: 'right', lineBreak: false });
        y += ROW_H + 6;
      }

      // Gran total
      y += 2;
      doc.rect(PPP_LEFT, y, PPP_W, 1).fill(BRAND);
      y += 5;
      doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor(GRAY_HEADER)
        .text('Total:', PPP_COL_D.precio_unit.x, y, { width: PPP_COL_D.precio_unit.w - 3, align: 'right', lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(BRAND)
        .text(fmt(totalGeneral), PPP_COL_D.total.x, y, { width: PPP_COL_D.total.w - 3, align: 'right', lineBreak: false });
    }

    // Pie de página
    y += 24;
    doc.font('Helvetica').fontSize(6.5).fillColor(GRAY_MID)
      .text(
        `Generado el ${new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}`,
        PPP_LEFT, y,
        { lineBreak: false }
      );

    doc.end();
  });
}

// ── OC Pendientes de Recibir PDF ──────────────────────────────────────────────

const OCP_LEFT  = 40;
const OCP_RIGHT = 556;
const OCP_W     = OCP_RIGHT - OCP_LEFT;

// Columnas vista resumen (9 cols, 516px total)
const OCP_COL = {
  fecha_oc:  { x: OCP_LEFT,       w: 54,  align: 'left'  as const },
  folio:     { x: OCP_LEFT + 54,  w: 60,  align: 'left'  as const },
  proveedor: { x: OCP_LEFT + 114, w: 118, align: 'left'  as const },
  total_oc:  { x: OCP_LEFT + 232, w: 68,  align: 'right' as const },
  cant_ord:  { x: OCP_LEFT + 300, w: 44,  align: 'right' as const },
  cant_rec:  { x: OCP_LEFT + 344, w: 44,  align: 'right' as const },
  cant_pend: { x: OCP_LEFT + 388, w: 50,  align: 'right' as const },
  pct:       { x: OCP_LEFT + 438, w: 30,  align: 'right' as const },
  dias:      { x: OCP_LEFT + 468, w: 48,  align: 'right' as const },
};
type OcpCol = keyof typeof OCP_COL;
const OCP_COLS: OcpCol[] = ['fecha_oc', 'folio', 'proveedor', 'total_oc', 'cant_ord', 'cant_rec', 'cant_pend', 'pct', 'dias'];
const OCP_HEADERS: Record<OcpCol, string> = {
  fecha_oc: 'Fecha OC', folio: 'Folio', proveedor: 'Proveedor',
  total_oc: 'Importe OC', cant_ord: 'Ordenado', cant_rec: 'Recibido',
  cant_pend: 'Pendiente', pct: '% Rec.', dias: 'Días',
};

// Columnas vista detalle — partidas bajo OC (7 cols, 516px total)
const OCP_COL_D = {
  clave:       { x: OCP_LEFT,       w: 52,  align: 'left'  as const },
  descripcion: { x: OCP_LEFT + 52,  w: 164, align: 'left'  as const },
  unidad:      { x: OCP_LEFT + 216, w: 32,  align: 'left'  as const },
  cant_ord:    { x: OCP_LEFT + 248, w: 68,  align: 'right' as const },
  cant_rec:    { x: OCP_LEFT + 316, w: 68,  align: 'right' as const },
  cant_pend:   { x: OCP_LEFT + 384, w: 68,  align: 'right' as const },
  pct:         { x: OCP_LEFT + 452, w: 64,  align: 'right' as const },
};
type OcpColD = keyof typeof OCP_COL_D;
const OCP_COLS_D: OcpColD[] = ['clave', 'descripcion', 'unidad', 'cant_ord', 'cant_rec', 'cant_pend', 'pct'];
const OCP_HEADERS_D: Record<OcpColD, string> = {
  clave: 'Clave', descripcion: 'Descripción', unidad: 'Ud.',
  cant_ord: 'Ordenado', cant_rec: 'Recibido', cant_pend: 'Pendiente', pct: '% Recibido',
};

function ocpDrawHeaderRow(
  doc: InstanceType<typeof PDFDocument>,
  y: number,
  cols: Record<string, AnyCol>,
  headers: Record<string, string>,
  keys: string[]
) {
  doc.rect(OCP_LEFT, y, OCP_W, HEADER_H).fill(BRAND);
  for (const key of keys) {
    const col = cols[key];
    const pad = 3;
    doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor('#ffffff');
    if (col.align === 'right') {
      doc.text(headers[key], col.x, y + pad + 1, { width: col.w - pad, align: 'right', lineBreak: false });
    } else {
      doc.text(headers[key], col.x + pad, y + pad + 1, { width: col.w - pad * 2, lineBreak: false });
    }
  }
  return y + HEADER_H;
}

function ocpDrawResumenRow(doc: InstanceType<typeof PDFDocument>, o: OCPendienteOC, y: number, shade: boolean) {
  if (shade) doc.rect(OCP_LEFT, y, OCP_W, ROW_H).fill(GRAY_LIGHT);
  const pad = 3;

  const draw = (text: string, col: AnyCol, bold = false, color = BLACK) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(FONT_SM).fillColor(color);
    if (col.align === 'right') {
      doc.text(text, col.x, y + pad, { width: col.w - pad, align: 'right', lineBreak: false });
    } else {
      doc.text(text, col.x + pad, y + pad, { width: col.w - pad * 2, lineBreak: false, ellipsis: true });
    }
  };

  draw(fmtFecha(o.fecha_oc),                                                              OCP_COL.fecha_oc);
  draw(o.folio,                                                                            OCP_COL.folio);
  draw(o.proveedor_nombre,                                                                 OCP_COL.proveedor);
  draw(fmt(o.total_oc),                                                                    OCP_COL.total_oc);
  draw(o.cantidad_ordenada.toLocaleString('es-MX', { maximumFractionDigits: 4 }),         OCP_COL.cant_ord);
  draw(o.cantidad_materializada.toLocaleString('es-MX', { maximumFractionDigits: 4 }),    OCP_COL.cant_rec);
  draw(o.cantidad_pendiente.toLocaleString('es-MX', { maximumFractionDigits: 4 }),        OCP_COL.cant_pend, true, o.cantidad_pendiente > 0 ? RED : BLACK);
  draw(`${o.pct_recibido.toFixed(1)} %`,                                                   OCP_COL.pct);
  draw(String(o.dias_transcurridos),                                                       OCP_COL.dias);
}

function ocpDrawPartidaRow(doc: InstanceType<typeof PDFDocument>, p: OCPendientePartida, y: number, shade: boolean) {
  if (shade) doc.rect(OCP_LEFT, y, OCP_W, ROW_H).fill(GRAY_LIGHT);
  const pad = 3;

  const draw = (text: string, col: AnyCol, bold = false, color = BLACK) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(FONT_SM).fillColor(color);
    if (col.align === 'right') {
      doc.text(text, col.x, y + pad, { width: col.w - pad, align: 'right', lineBreak: false });
    } else {
      doc.text(text, col.x + pad, y + pad, { width: col.w - pad * 2, lineBreak: false, ellipsis: true });
    }
  };

  draw(p.clave,                                                                            OCP_COL_D.clave);
  draw(p.descripcion,                                                                      OCP_COL_D.descripcion);
  draw(p.unidad,                                                                           OCP_COL_D.unidad);
  draw(p.cantidad_ordenada.toLocaleString('es-MX', { maximumFractionDigits: 4 }),         OCP_COL_D.cant_ord);
  draw(p.cantidad_materializada.toLocaleString('es-MX', { maximumFractionDigits: 4 }),    OCP_COL_D.cant_rec);
  draw(p.cantidad_pendiente.toLocaleString('es-MX', { maximumFractionDigits: 4 }),        OCP_COL_D.cant_pend, true, p.cantidad_pendiente > 0 ? RED : BLACK);
  draw(`${p.pct_recibido.toFixed(1)} %`,                                                   OCP_COL_D.pct);
}

export function generarOCPendientesPDF(
  resultado: OCPendientesResult,
  detalle = false,
  titulo = 'Órdenes de Compra Pendientes de Recibir'
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: titulo } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Banda de marca
    doc.rect(0, 0, PAGE_W, 56).fill(BRAND);
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#ffffff')
      .text('Emphasys', OCP_LEFT, 14, { lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.8)')
      .text(titulo, OCP_LEFT, 32, { lineBreak: false });

    let y = 72;
    const col2x = PAGE_W / 2;

    const totalOrdenes   = resultado.ordenes.length;
    const totalPendiente = resultado.ordenes.reduce((s, o) => s + o.cantidad_pendiente, 0);
    const pctPromedio    = totalOrdenes > 0
      ? resultado.ordenes.reduce((s, o) => s + o.pct_recibido, 0) / totalOrdenes
      : 0;

    doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID).text('FECHA DE CORTE', OCP_LEFT, y);
    doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(BLACK)
      .text(fmtFecha(resultado.fecha_corte), OCP_LEFT, y + 10, { lineBreak: false });

    doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID).text('OC PENDIENTES', col2x, y);
    doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(BLACK)
      .text(String(totalOrdenes), col2x, y + 10, { lineBreak: false });

    y += 32;

    doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID).text('CANTIDAD PENDIENTE', OCP_LEFT, y);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(RED)
      .text(totalPendiente.toLocaleString('es-MX', { maximumFractionDigits: 4 }), OCP_LEFT, y + 8, { lineBreak: false });

    doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID).text('% PROMEDIO RECIBIDO', col2x, y);
    doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(BLACK)
      .text(`${pctPromedio.toFixed(1)} %`, col2x, y + 8, { lineBreak: false });

    y += 36;
    doc.rect(OCP_LEFT, y, OCP_W, 1).fill('#e5e7eb');
    y += 6;

    const addPageHeader = () => {
      doc.addPage({ size: 'A4', margin: 0 });
      doc.rect(0, 0, PAGE_W, 30).fill(BRAND);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff')
        .text(titulo, OCP_LEFT, 10, { lineBreak: false });
      y = 36;
    };

    if (!detalle) {
      // ── Vista resumen ──────────────────────────────────────────────────────
      y = ocpDrawHeaderRow(doc, y, OCP_COL as unknown as Record<string, AnyCol>, OCP_HEADERS, OCP_COLS);
      let shade = 0;
      for (const o of resultado.ordenes) {
        if (y + ROW_H > PAGE_H - MARGIN_BOTTOM) {
          addPageHeader();
          y = ocpDrawHeaderRow(doc, y, OCP_COL as unknown as Record<string, AnyCol>, OCP_HEADERS, OCP_COLS);
          shade = 0;
        }
        ocpDrawResumenRow(doc, o, y, shade % 2 === 0);
        y += ROW_H;
        shade++;
      }

      // Total
      y += 2;
      doc.rect(OCP_LEFT, y, OCP_W, 1).fill(BRAND);
      y += 5;
      doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor(GRAY_HEADER)
        .text(`${totalOrdenes} orden${totalOrdenes === 1 ? '' : 'es'} pendiente${totalOrdenes === 1 ? '' : 's'}`,
          OCP_COL.cant_ord.x, y, { width: OCP_COL.cant_ord.w + OCP_COL.cant_rec.w - 3, align: 'right', lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(RED)
        .text(totalPendiente.toLocaleString('es-MX', { maximumFractionDigits: 4 }),
          OCP_COL.cant_pend.x, y, { width: OCP_COL.cant_pend.w - 3, align: 'right', lineBreak: false });

    } else {
      // ── Vista detalle ──────────────────────────────────────────────────────
      const partidasPorOC = new Map<number, OCPendientePartida[]>();
      for (const p of resultado.partidas) {
        if (!partidasPorOC.has(p.oc_id)) partidasPorOC.set(p.oc_id, []);
        partidasPorOC.get(p.oc_id)!.push(p);
      }

      for (const o of resultado.ordenes) {
        const items = partidasPorOC.get(o.oc_id) ?? [];

        // Encabezado de OC
        if (y + HEADER_H + 4 + HEADER_H + ROW_H > PAGE_H - MARGIN_BOTTOM) addPageHeader();
        doc.rect(OCP_LEFT, y, OCP_W, HEADER_H + 4).fill(GRAY_SUB);
        doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(BLACK)
          .text(`${o.folio}  ·  ${o.proveedor_nombre}`, OCP_LEFT + 3, y + 3,
            { width: OCP_W - 130, lineBreak: false, ellipsis: true });
        doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID)
          .text(`Fecha: ${fmtFecha(o.fecha_oc)}  ·  ${o.dias_transcurridos} días`, OCP_LEFT + 3, y + 13, { lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor(RED)
          .text(`${o.cantidad_pendiente.toLocaleString('es-MX', { maximumFractionDigits: 4 })} pend.`,
            OCP_RIGHT - 127, y + 3, { width: 124, align: 'right', lineBreak: false });
        doc.font('Helvetica').fontSize(FONT_SM).fillColor(GRAY_MID)
          .text(`${o.pct_recibido.toFixed(1)} % recibido`, OCP_RIGHT - 127, y + 13, { width: 124, align: 'right', lineBreak: false });
        y += HEADER_H + 6;

        // Encabezado de columnas de partidas
        if (y + HEADER_H > PAGE_H - MARGIN_BOTTOM) addPageHeader();
        y = ocpDrawHeaderRow(doc, y, OCP_COL_D as unknown as Record<string, AnyCol>, OCP_HEADERS_D, OCP_COLS_D);

        let shade = 0;
        for (const p of items) {
          if (y + ROW_H > PAGE_H - MARGIN_BOTTOM) {
            addPageHeader();
            y = ocpDrawHeaderRow(doc, y, OCP_COL_D as unknown as Record<string, AnyCol>, OCP_HEADERS_D, OCP_COLS_D);
            shade = 0;
          }
          ocpDrawPartidaRow(doc, p, y, shade % 2 === 0);
          y += ROW_H;
          shade++;
        }

        // Subtotal OC
        y += 2;
        doc.rect(OCP_LEFT, y, OCP_W, 0.5).fill(GRAY_MID);
        y += 4;
        doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor(GRAY_HEADER)
          .text('Subtotal OC:', OCP_COL_D.cant_rec.x, y,
            { width: OCP_COL_D.cant_rec.w - 3, align: 'right', lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor(RED)
          .text(o.cantidad_pendiente.toLocaleString('es-MX', { maximumFractionDigits: 4 }),
            OCP_COL_D.cant_pend.x, y, { width: OCP_COL_D.cant_pend.w - 3, align: 'right', lineBreak: false });
        y += ROW_H + 6;
      }

      // Gran total
      y += 2;
      doc.rect(OCP_LEFT, y, OCP_W, 1).fill(BRAND);
      y += 5;
      doc.font('Helvetica-Bold').fontSize(FONT_SM).fillColor(GRAY_HEADER)
        .text('Total pendiente:', OCP_COL_D.cant_rec.x, y,
          { width: OCP_COL_D.cant_rec.w - 3, align: 'right', lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(FONT_MD).fillColor(RED)
        .text(totalPendiente.toLocaleString('es-MX', { maximumFractionDigits: 4 }),
          OCP_COL_D.cant_pend.x, y, { width: OCP_COL_D.cant_pend.w - 3, align: 'right', lineBreak: false });
    }

    // Pie de página
    y += 24;
    doc.font('Helvetica').fontSize(6.5).fillColor(GRAY_MID)
      .text(
        `Generado el ${new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}`,
        OCP_LEFT, y,
        { lineBreak: false }
      );

    doc.end();
  });
}
