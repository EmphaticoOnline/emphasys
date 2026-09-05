import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import type { CartaPortePrintModel } from './carta-porte-print.types';
import { generarImagenQRCartaPorte } from './carta-porte-qr';

const BLUE = '#1d2f68';
const INK = '#172033';
const MUTED = '#5b6472';
const LINE = '#d9dee8';
const LIGHT = '#f2f4f8';
const fmt = (v: unknown) => v == null || String(v).trim() === '' ? '' : String(v);
const money = (v?: number, currency?: string) => v == null ? '' : `${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`;

type RenderContext = { doc: PDFKit.PDFDocument; model: CartaPortePrintModel; y: number };

const colorHeader = (ctx: RenderContext) => ctx.model.colorTablaHeader || BLUE;

function dibujarMarcaCancelado(doc: PDFKit.PDFDocument): void {
  const width = 92;
  const x = doc.page.width - doc.page.margins.right - width;
  doc.save();
  doc.roundedRect(x, 12, width, 18, 3).lineWidth(0.8).stroke('#555555');
  doc.font('Trebuchet-Bold').fontSize(9).fillColor('#333333').text('CANCELADO', x, 17, { width, align: 'center' });
  doc.restore();
}

function ensureSpace(ctx: RenderContext, needed: number) {
  if (ctx.y + needed <= ctx.doc.page.height - ctx.doc.page.margins.bottom - 28) return;
  ctx.doc.addPage();
  ctx.y = 42;
  drawContinuationHeader(ctx);
}

function drawContinuationHeader(ctx: RenderContext) {
  const { doc, model } = ctx;
  doc.font('Trebuchet-Bold').fontSize(9).fillColor(colorHeader(ctx)).text('COMPLEMENTO CARTA PORTE', 42, ctx.y);
  doc.font('Trebuchet').fontSize(8).fillColor(MUTED).text(`CFDI ${fmt(model.documento.serie)}-${fmt(model.documento.folio)}   |   IdCCP ${fmt(model.cartaPorte.idCcp)}`, 42, ctx.y + 13);
  ctx.y += 32;
}

function section(ctx: RenderContext, title: string) {
  ensureSpace(ctx, 30);
  ctx.doc.roundedRect(42, ctx.y, ctx.doc.page.width - 84, 22, 3).fill(LIGHT);
  ctx.doc.font('Trebuchet-Bold').fontSize(10).fillColor(colorHeader(ctx)).text(title, 50, ctx.y + 6);
  ctx.y += 30;
}

function row(ctx: RenderContext, label: string, value: unknown, width = 250) {
  rowAt(ctx, label, value, 50, width);
}

function rowAt(ctx: RenderContext, label: string, value: unknown, x: number, width = 250) {
  const v = fmt(value);
  if (!v) return;
  ensureSpace(ctx, 18);
  ctx.doc.font('Trebuchet-Bold').fontSize(8).fillColor(MUTED).text(label, x, ctx.y, { width: 105 });
  ctx.doc.font('Trebuchet').fontSize(8.5).fillColor(INK).text(v, x + 108, ctx.y, { width });
  ctx.y += 16;
}

function cell(ctx: RenderContext, value: unknown, x: number, width: number, y: number, bold = false) {
  ctx.doc.font(bold ? 'Trebuchet-Bold' : 'Trebuchet').fontSize(7.5).fillColor(INK).text(fmt(value), x + 4, y + 5, { width: width - 8, ellipsis: false });
}

function table(ctx: RenderContext, headers: string[], widths: number[], values: unknown[][]) {
  const x0 = ctx.doc.page.margins.left;
  const total = ctx.doc.page.width - ctx.doc.page.margins.left - ctx.doc.page.margins.right;
  if (widths.reduce((a, b) => a + b, 0) !== total) throw new Error('Las columnas de Carta Porte no ocupan el ancho útil completo.');
  const drawTableHeader = () => { ctx.doc.rect(x0, ctx.y, total, 22).fill(colorHeader(ctx)); let x = x0; headers.forEach((h, i) => { ctx.doc.font('Trebuchet-Bold').fontSize(7).fillColor('#fff').text(h, x + 4, ctx.y + 6, { width: widths[i] - 8 }); x += widths[i]; }); ctx.y += 22; };
  ensureSpace(ctx, 28); drawTableHeader();
  values.forEach((valuesRow, index) => {
    ctx.doc.font('Trebuchet').fontSize(7.5);
    const heights = valuesRow.map((v, i) => ctx.doc.heightOfString(fmt(v), { width: widths[i] - 8 }));
    const h = Math.max(20, Math.min(58, Math.max(...heights) + 10));
    const pageBefore = ctx.doc.page;
    ensureSpace(ctx, h);
    if (ctx.doc.page !== pageBefore) drawTableHeader();
    if (index % 2 === 0) ctx.doc.rect(x0, ctx.y, total, h).fill('#fafbfc');
    ctx.doc.rect(x0, ctx.y, total, h).stroke(LINE);
    let x = x0; valuesRow.forEach((v, i) => { cell(ctx, v, x, widths[i], ctx.y); x += widths[i]; });
    ctx.y += h;
  });
  ctx.y += 8;
}

function drawHeader(ctx: RenderContext, qrBuffer: Buffer | null) {
  const { doc, model } = ctx;
  const right = 365;
  const headerTextX = 260;
  const headerTextWidth = 295;
  if (model.branding?.logoPath && fs.existsSync(model.branding.logoPath)) doc.image(model.branding.logoPath, 42, 40, { fit: [200, 85.4] });
  doc.font('Trebuchet-Bold').fontSize(15).fillColor(colorHeader(ctx)).text('COMPLEMENTO CARTA PORTE', headerTextX, 42, { width: headerTextWidth, align: 'right' });
  doc.font('Trebuchet-Bold').fontSize(10).fillColor(INK).text(fmt(model.branding?.razonSocial || model.branding?.nombre || model.cfdi.rfcEmisor), headerTextX, 64, { width: headerTextWidth, align: 'right' });
  doc.font('Trebuchet').fontSize(8).fillColor(MUTED).text(`RFC ${fmt(model.branding?.rfc || model.cfdi.rfcEmisor)}${model.branding?.regimenFiscal ? `  |  Régimen ${model.branding.regimenFiscal}` : ''}`, headerTextX, 79, { width: headerTextWidth, align: 'right' });
  if (model.branding?.domicilio) doc.text(model.branding.domicilio, headerTextX, 92, { width: headerTextWidth, align: 'right' });
  ctx.y = 126;
  section(ctx, 'DATOS FISCALES Y DE TRANSPORTE');
  const datosStartY = ctx.y;
  if (qrBuffer) doc.image(qrBuffer, 458, datosStartY, { fit: [95, 95] });
  rowAt(ctx, 'Serie / Folio', `${fmt(model.documento.serie)} / ${fmt(model.documento.folio)}`, 50, 300);
  rowAt(ctx, 'UUID CFDI', model.cfdi.uuid, 50, 300);
  rowAt(ctx, 'Fecha timbrado', model.cfdi.fechaTimbrado, 50, 300);
  rowAt(ctx, 'IdCCP', model.cartaPorte.idCcp, 50, 300);
  rowAt(ctx, 'Versión Carta Porte', model.cartaPorte.version, 50, 300);
  rowAt(ctx, 'Transporte internacional', model.cartaPorte.transporteInternacional, 50, 300);
  rowAt(ctx, 'Distancia total', model.cartaPorte.totalDistanciaRecorrida == null ? '' : `${model.cartaPorte.totalDistanciaRecorrida} km`, 50, 300);
  ctx.y = Math.max(ctx.y, datosStartY + (qrBuffer ? 95 : 0)) + 8;
}

export async function generarCartaPortePDF(model: CartaPortePrintModel): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: 'LETTER', margin: 42, bufferPages: true });
  doc.registerFont('Trebuchet', require.resolve('../../../assets/fonts/TREBUC.TTF'));
  doc.registerFont('Trebuchet-Bold', require.resolve('../../../assets/fonts/TREBUCBD.TTF'));
  doc.registerFont('Trebuchet-Italic', require.resolve('../../../assets/fonts/TREBUCIT.TTF'));
  if (model.cancelado) {
    doc.on('pageAdded', () => dibujarMarcaCancelado(doc));
    dibujarMarcaCancelado(doc);
  }
  doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  const origin = model.ubicaciones.find((u) => u.tipoUbicacion.toLowerCase() === 'origen');
  const qrSource = model.cartaPorte.idCcp && origin?.fechaHora && model.cfdi.fechaTimbrado
    ? await generarImagenQRCartaPorte(model.cartaPorte.idCcp, origin.fechaHora, model.cfdi.fechaTimbrado) : null;
  const qrBuffer = qrSource ? Buffer.from(qrSource.split(',')[1], 'base64') : null;
  const ctx: RenderContext = { doc, model, y: 0 };
  drawHeader(ctx, qrBuffer);
  section(ctx, 'UBICACIONES');
  model.ubicaciones.forEach((u) => { ensureSpace(ctx, 92); ctx.doc.font('Trebuchet-Bold').fontSize(9).fillColor(colorHeader(ctx)).text(`${fmt(u.tipoUbicacion).toUpperCase()}  ${fmt(u.idUbicacion)}`, 50, ctx.y); ctx.y += 15; row(ctx, 'RFC / Nombre', `${fmt(u.rfc)}  ${fmt(u.nombre)}`, 390); row(ctx, 'Fecha / Distancia', `${fmt(u.fechaHora)}${u.distanciaRecorrida == null ? '' : `  |  ${u.distanciaRecorrida} km`}`, 390); if (u.numRegIdTrib || u.residenciaFiscal) row(ctx, 'Fiscal extranjero', `${u.numRegIdTrib ? `Num. registro: ${u.numRegIdTrib}` : ''}${u.numRegIdTrib && u.residenciaFiscal ? '  |  ' : ''}${u.residenciaFiscal ? `Residencia: ${u.residenciaFiscal}` : ''}`, 390); const d = u.domicilio; row(ctx, 'Domicilio', d ? [d.calle, d.numeroExterior, d.numeroInterior, d.colonia, d.localidad, d.municipio, d.estado, d.pais, d.codigoPostal].filter(Boolean).join(', ') : '', 390); ctx.y += 4; });
  section(ctx, 'MERCANCÍAS');
  row(ctx, 'Resumen', `Peso bruto ${fmt(model.mercancias.pesoBrutoTotal)} ${fmt(model.mercancias.unidadPeso)}  |  Total ${fmt(model.mercancias.numTotalMercancias)}${model.mercancias.pesoNetoTotal == null ? '' : `  |  Peso neto ${model.mercancias.pesoNetoTotal}`}`, 390);
  table(ctx, ['Bienes', 'Descripción', 'Cantidad', 'Unidad', 'Peso', 'Peligroso'], [72, 196, 56, 72, 58, 74], model.mercancias.items.map(i => [i.bienesTransportados, i.descripcion, i.cantidad, `${fmt(i.claveUnidad)} ${fmt(i.unidad)}`, i.pesoEnKg, i.materialPeligroso ? `${i.materialPeligroso}${i.cveMaterialPeligroso ? ` (${i.cveMaterialPeligroso})` : ''}` : '']));
  model.mercancias.items.forEach(i => { if (i.embalaje || i.valorMercancia != null) row(ctx, 'Detalle', `${i.embalaje ? `Embalaje: ${i.embalaje} ${fmt(i.descripEmbalaje)}` : ''}${i.valorMercancia == null ? '' : `  |  Valor: ${money(i.valorMercancia, i.moneda)}`}`, 390); });
  if (model.autotransporte) { section(ctx, 'AUTOTRANSPORTE'); table(ctx, ['Permiso SICT', 'No. permiso', 'Configuración', 'Placa', 'Año', 'Peso bruto'], [92, 98, 104, 68, 60, 106], [[model.autotransporte.permisoSct, model.autotransporte.numPermisoSct, model.autotransporte.configuracionVehicular, model.autotransporte.placaVm, model.autotransporte.anioModeloVm, model.autotransporte.pesoBrutoVehicular]]); section(ctx, 'SEGUROS'); const s = model.autotransporte.seguros; [['Responsabilidad civil', s.aseguraRespCivil, s.polizaRespCivil], ['Medio ambiente', s.aseguraMedAmbiente, s.polizaMedAmbiente], ['Carga', s.aseguraCarga, s.polizaCarga]].filter(r => r[1] || r[2] || s.primaSeguro != null).forEach(r => row(ctx, String(r[0]), `${fmt(r[1])}${r[2] ? `  |  Póliza ${r[2]}` : ''}`, 390)); if (s.primaSeguro != null) row(ctx, 'Prima seguro', money(s.primaSeguro), 390); }
  if (model.autotransporte?.remolques.length) { section(ctx, 'REMOLQUES'); table(ctx, ['Subtipo', 'Placa'], [264, 264], model.autotransporte.remolques.map(r => [r.subtipoRemolque, r.placa])); }
  if (model.figuras.length) { section(ctx, 'FIGURAS DE TRANSPORTE'); model.figuras.forEach(f => { ensureSpace(ctx, 70); row(ctx, 'Tipo / RFC', `${fmt(f.tipoFigura)}  |  ${fmt(f.rfcFigura)}`, 390); row(ctx, 'Nombre / Licencia', `${fmt(f.nombreFigura)}  |  ${fmt(f.numLicencia)}`, 390); if (f.numRegIdTrib || f.residenciaFiscal) row(ctx, 'Fiscal extranjero', `${f.numRegIdTrib ? `Num. registro: ${f.numRegIdTrib}` : ''}${f.numRegIdTrib && f.residenciaFiscal ? '  |  ' : ''}${f.residenciaFiscal ? `Residencia: ${f.residenciaFiscal}` : ''}`, 390); const d = f.domicilio; row(ctx, 'Domicilio', d ? Object.values(d).filter(Boolean).join(', ') : '', 390); }); }
  doc.font('Trebuchet').fontSize(7).fillColor(MUTED).text('Representación impresa del Complemento Carta Porte 3.1. Fuente fiscal: XML timbrado CFDI.', 42, doc.page.height - 34, { width: 525, height: 10, align: 'center' });
  doc.end();
  return done;
}
