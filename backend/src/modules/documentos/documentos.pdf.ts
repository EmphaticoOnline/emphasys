import path from 'path';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import pool from '../../config/database';
import { generarImagenQR, DatosQrCfdi } from '../../utils/generarCadenaQR';
import { formatearFolioDocumento } from '../../utils/documentos';
import { DOCUMENT_LAYOUTS, type DocumentLayout } from '../../config/document-layouts';
import { obtenerPlantillaParaDocumento } from '../plantillas/plantillas.service';
import { renderPlantillaHTML, type PlantillaData } from '../plantillas/plantillas.render.service';
import puppeteer from 'puppeteer';
import { heightOfRichTextBasicoPdf, renderRichTextBasicoPdf, richTextBasicoEstaVacio } from './richTextPdf';
import { obtenerCondicionesImpresionSerie } from '../configuracion/series-documento/series-documento.repository';
import { obtenerCamposConfigurablesPartidasParaImpresion } from './documentos-campos.repository';
import { obtenerRutaPdfPreview } from '../../services/pdfPreviewImage.service';
import { XMLParser } from 'fast-xml-parser';
import {
  ordenarCamposConfigurablesPartida,
  calcularAlturaCamposConfigurablesPartida,
  renderCamposConfigurablesPartida,
  type CampoConfigurablePartidaValor,
} from './camposConfigurablesPdf';

type TimbreCfdi = {
  uuid?: string | null;
  fecha_timbrado?: string | Date | null;
  rfc_emisor?: string | null;
  rfc_receptor?: string | null;
  total?: number | null;
  sello_cfdi?: string | null;
  cadena_original?: string | null;
  sello_sat?: string | null;
  rfc_proveedor_certificacion?: string | null;
  no_certificado_sat?: string | null;
  cancelado?: boolean;
};

type DocumentoCotizacion = {
  id?: number;
  tipo_documento?: string | null;
  motivo_nc?: 'devolucion' | 'bonificacion' | 'otro' | null;
  serie?: string | null;
  numero?: number | null;
  fecha_documento?: string | null;
  estatus_documento?: string | null;
  concepto_id?: number | null;
  producto_resumen?: string | null;
  cliente_nombre?: string | null;
  cliente_nombre_contacto?: string | null;
  cliente_email?: string | null;
  cliente_telefono?: string | null;
  cliente_rfc?: string | null;
  rfc_receptor?: string | null;
  cliente_direccion?: string | null;
  cliente_ciudad_estado_cp?: string | null;
  uso_cfdi?: string | null;
  regimen_fiscal_receptor?: string | null;
  forma_pago?: string | null;
  metodo_pago?: string | null;
  codigo_postal_receptor?: string | null;
  nombre_receptor?: string | null;
  agente_nombre?: string | null;
  observaciones?: string | null;
  tratamiento_impuestos?: string | null;
  total?: number | null;
  subtotal?: number | null;
  iva?: number | null;
  ieps?: number | null;
  retencion_iva?: number | null;
  retencion_isr?: number | null;
  timbre?: TimbreCfdi | null;
};

type ImpuestoPartidaPdf = {
  impuesto_id?: string | null;
  nombre?: string | null;
  tipo?: string | null;
  monto?: number | null;
};

type PartidaCotizacion = {
  id?: number | null;
  producto_clave?: string | null;
  producto_descripcion?: string | null;
  descripcion?: string | null;
  descripcion_alterna?: string | null;
  archivo_imagen_1?: string | null;
  producto_archivo_id?: number | null;
  observaciones?: string | null;
  especificaciones?: Array<{ contenido: string; orden: number }>;
  cantidad?: number | null;
  precio_unitario?: number | null;
  subtotal_partida?: number | null;
  impuestos?: ImpuestoPartidaPdf[];
};

type DataCotizacion = {
  documento?: DocumentoCotizacion;
  partidas: PartidaCotizacion[];
};

export type GenerarDocumentoPdfOptions = {
  onLayoutResolved?: (layout: DocumentLayout) => void;
  onLogoResolved?: (logoPath: string) => void;
};

type TrasladoPdfXmlInput = {
  xmlTimbrado: string;
  documento?: DocumentoCotizacion & { empresa_id?: number | null };
  empresaId?: number;
  cadenaOriginal?: string | null;
  estadoSat?: string | null;
};

const asArray = <T,>(value: T | T[] | null | undefined): T[] =>
  value == null ? [] : Array.isArray(value) ? value : [value];

const textoXml = (value: unknown): string => String(value ?? '').trim();

const moneda = (value: unknown): string => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
};

/** Representación fiscal compacta y aislada para un CFDI T timbrado. */
export async function generarTrasladoPDFDesdeXml(input: TrasladoPdfXmlInput): Promise<Buffer> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
    trimValues: true,
    parseTagValue: false,
  });
  const parsed = parser.parse(input.xmlTimbrado) as any;
  const comprobante = parsed?.Comprobante ?? {};
  const emisor = comprobante.Emisor ?? {};
  const receptor = comprobante.Receptor ?? {};
  const conceptos = asArray(comprobante.Conceptos?.Concepto);
  const complemento = comprobante.Complemento ?? {};
  const tfd = complemento.TimbreFiscalDigital ?? {};
  const uuid = textoXml(tfd.UUID || input.documento?.timbre?.uuid);
  const rfcEmisor = textoXml(emisor.Rfc || input.documento?.timbre?.rfc_emisor);
  const rfcReceptor = textoXml(receptor.Rfc || input.documento?.timbre?.rfc_receptor);
  const total = Number(comprobante.Total ?? input.documento?.timbre?.total ?? 0);
  const selloCfdi = textoXml(comprobante.Sello || input.documento?.timbre?.sello_cfdi);
  const qrBuffer = uuid
    ? await generarImagenQR({ uuid, rfc_emisor: rfcEmisor, rfc_receptor: rfcReceptor, total, sello_cfdi: selloCfdi })
        .then((dataUrl) => Buffer.from(dataUrl.split(',')[1] || '', 'base64'))
        .catch(() => null)
    : null;

  const logoPath = await obtenerLogoEmpresaPath(input.documento?.empresa_id ?? input.empresaId);
  const backendRoot = path.resolve(__dirname, '..', '..', '..');
  const defaultLogoPath = path.resolve(backendRoot, '..', 'frontend', 'public', 'logos', 'logo-emphasys.jpg');
  const resolvedLogo = logoPath && fs.existsSync(logoPath) ? logoPath : defaultLogoPath;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 26, bottom: 24, left: 36, right: 36 } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const BLUE = '#1d2f68';
    const INK = '#172033';
    const MUTED = '#5b6472';
    const LINE = '#d9dee8';
    const LIGHT = '#f2f4f8';
    const assetsFontsPath = path.resolve(__dirname, '..', '..', '..', 'assets', 'fonts');
    const registerFont = (name: string, fileName: string) => {
      const filePath = path.join(assetsFontsPath, fileName);
      if (!fs.existsSync(filePath)) return false;
      doc.registerFont(name, filePath);
      return true;
    };
    const FONT = registerFont('TrasladoSans', 'TREBUC.TTF') ? 'TrasladoSans' : 'Helvetica';
    const BOLD = registerFont('TrasladoSans-Bold', 'TREBUCBD.TTF') ? 'TrasladoSans-Bold' : 'Helvetica-Bold';
    const LEFT = doc.page.margins.left;
    const CONTENT_W = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const BOTTOM = doc.page.height - 26;
    const numeroDocumento = Number(input.documento?.numero);
    const folioVisual = Number.isFinite(numeroDocumento)
      ? formatearFolioDocumento(String(input.documento?.serie ?? ''), numeroDocumento)
      : 'N/D';
    const fechaTimbrado = textoXml(tfd.FechaTimbrado || input.documento?.timbre?.fecha_timbrado) || 'N/D';

    let y = 24;

    const paint = (
      value: string,
      x: number,
      yPos: number,
      opts: { font?: string; size?: number; color?: string; width: number; align?: 'left' | 'center' | 'right'; lineGap?: number }
    ) => {
      const font = opts.font || FONT;
      const size = opts.size ?? 8;
      const lineGap = opts.lineGap ?? 0;
      doc.font(font).fontSize(size).fillColor(opts.color || INK);
      const height = doc.heightOfString(value, { width: opts.width, lineGap, align: opts.align });
      doc.text(value, x, yPos, { width: opts.width, align: opts.align, lineGap, height: height + 1.5 });
      return height;
    };

    const continuation = () => {
      doc.addPage();
      y = doc.page.margins.top;
      paint('CFDI DE TRASLADO', LEFT, y, { font: BOLD, size: 8, color: BLUE, width: 150 });
      paint(`${folioVisual}   ·   ${uuid || 'Sin UUID'}`, LEFT + 150, y, {
        size: 7, color: MUTED, width: CONTENT_W - 150, align: 'right',
      });
      y += 12;
      doc.save();
      doc.moveTo(LEFT, y).lineTo(LEFT + CONTENT_W, y).lineWidth(0.6).strokeColor(LINE).stroke();
      doc.restore();
      y += 8;
    };

    const ensure = (needed: number) => {
      if (y + needed > BOTTOM) continuation();
    };

    const drawSection = (title: string) => {
      ensure(18);
      doc.roundedRect(LEFT, y, CONTENT_W, 15, 2).fill(LIGHT);
      doc.font(BOLD).fontSize(8).fillColor(BLUE).text(title, LEFT + 8, y + 3.5, {
        width: CONTENT_W - 16, height: 10, lineBreak: false,
      });
      y += 19;
    };

    const hasLogo = fs.existsSync(resolvedLogo);
    const headerTop = 22;
    if (!hasLogo) {
      paint('CFDI DE TRASLADO', LEFT, headerTop, { font: BOLD, size: 13, color: BLUE, width: CONTENT_W, align: 'left' });
      paint('Representación impresa de CFDI 4.0', LEFT, 40, { size: 7.5, color: MUTED, width: CONTENT_W, align: 'left' });
      y = 62;
    } else {
      const logoMaxWidth = 200;
      const logoMaxHeight = 122 * 0.7;
      let naturalWidth = logoMaxWidth;
      let naturalHeight = logoMaxHeight;
      try {
        const logoInfo = (doc as any).openImage(resolvedLogo) as { width: number; height: number };
        naturalWidth = logoInfo.width;
        naturalHeight = logoInfo.height;
      } catch (error) {
        console.warn('[pdf] No se pudieron leer las dimensiones del logo de traslado', {
          logoPath: resolvedLogo,
          error: (error as Error)?.message,
        });
      }
      const logoAspect = naturalWidth / naturalHeight;
      const boxAspect = logoMaxWidth / logoMaxHeight;
      const logoHeight = logoAspect > boxAspect ? logoMaxWidth / logoAspect : logoMaxHeight;
      const logoWidth = logoAspect > boxAspect ? logoMaxWidth : logoMaxHeight * logoAspect;
      doc.image(resolvedLogo, LEFT, headerTop, { fit: [logoMaxWidth, logoMaxHeight] });
      const titleX = LEFT + logoWidth + 14;
      const titleW = CONTENT_W - (titleX - LEFT);
      const titleBlockH = 30;
      const titleY = headerTop + Math.max(0, (logoHeight - titleBlockH) / 2);
      paint('CFDI DE TRASLADO', titleX, titleY, { font: BOLD, size: 13, color: BLUE, width: titleW, align: 'right' });
      paint('Representación impresa de CFDI 4.0', titleX, titleY + 18, { size: 7.5, color: MUTED, width: titleW, align: 'right' });
      y = headerTop + logoHeight + 10;
    }

    const meta = [
      ['Folio', folioVisual],
      ['Fecha de emisión', textoXml(comprobante.Fecha) || 'N/D'],
      ['Lugar de expedición', textoXml(comprobante.LugarExpedicion) || 'N/D'],
      ['Tipo / Moneda', `${textoXml(comprobante.TipoDeComprobante) || 'N/D'} / ${textoXml(comprobante.Moneda) || 'N/D'}`],
    ];
    doc.roundedRect(LEFT, y, CONTENT_W, 30, 3).fill(LIGHT);
    const metaW = CONTENT_W / meta.length;
    meta.forEach(([label, value], index) => {
      const x = LEFT + metaW * index + 8;
      const w = metaW - 14;
      doc.font(BOLD).fontSize(6).fillColor(MUTED).text(label.toUpperCase(), x, y + 5, { width: w, height: 8, lineBreak: false });
      doc.font(FONT).fontSize(8).fillColor(INK).text(value, x, y + 15, { width: w, height: 11, lineBreak: false });
    });
    y += 38;

    type PartyLine = { text: string; bold?: boolean };
    const drawParty = (title: string, lines: PartyLine[], x: number, width: number, top: number) => {
      doc.roundedRect(x, top, width, 14, 2).fill(LIGHT);
      doc.font(BOLD).fontSize(7.5).fillColor(BLUE).text(title, x + 6, top + 3, { width: width - 12, height: 10, lineBreak: false });
      let cursor = top + 18;
      lines.forEach((line) => {
        doc.font(line.bold ? BOLD : FONT).fontSize(line.bold ? 8 : 7.5).fillColor(INK);
        const height = doc.heightOfString(line.text, { width: width - 12, lineGap: 0 });
        doc.text(line.text, x + 6, cursor, { width: width - 12, height: height + 1, lineGap: 0 });
        cursor += height + 1.5;
      });
      return cursor - top;
    };
    const partyGap = 12;
    const partyW = (CONTENT_W - partyGap) / 2;
    const emisorLines: PartyLine[] = [
      { text: textoXml(emisor.Nombre) || 'N/D', bold: true },
      { text: `RFC   ${textoXml(emisor.Rfc) || 'N/D'}` },
      { text: `Régimen fiscal   ${textoXml(emisor.RegimenFiscal) || 'N/D'}` },
    ];
    const receptorLines: PartyLine[] = [
      { text: textoXml(receptor.Nombre) || 'N/D', bold: true },
      { text: `RFC   ${textoXml(receptor.Rfc) || 'N/D'}` },
      { text: `Régimen fiscal   ${textoXml(receptor.RegimenFiscalReceptor) || 'N/D'}` },
      { text: `CP fiscal   ${textoXml(receptor.DomicilioFiscalReceptor) || 'N/D'}      Uso CFDI   ${textoXml(receptor.UsoCFDI) || 'N/D'}` },
    ];
    const partyTop = y;
    const emisorH = drawParty('EMISOR', emisorLines, LEFT, partyW, partyTop);
    const receptorH = drawParty('RECEPTOR', receptorLines, LEFT + partyW + partyGap, partyW, partyTop);
    y = partyTop + Math.max(emisorH, receptorH) + 8;

    const fixedConceptWidths = [76, 56, 58, 42, 64, 66];
    const conceptCols: Array<{ title: string; width: number; align: 'left' | 'center' | 'right' }> = [
      { title: 'ClaveProdServ', width: fixedConceptWidths[0], align: 'left' },
      { title: 'Descripción', width: CONTENT_W - fixedConceptWidths.reduce((sum, width) => sum + width, 0), align: 'left' },
      { title: 'Cantidad', width: fixedConceptWidths[1], align: 'right' },
      { title: 'Unidad', width: fixedConceptWidths[2], align: 'left' },
      { title: 'Obj.Imp', width: fixedConceptWidths[3], align: 'center' },
      { title: 'Valor unit.', width: fixedConceptWidths[4], align: 'right' },
      { title: 'Importe', width: fixedConceptWidths[5], align: 'right' },
    ];
    const conceptValues = (concepto: any): string[] => {
      const claveUnidad = textoXml(concepto?.ClaveUnidad);
      const unidad = textoXml(concepto?.Unidad);
      const unidadTexto = claveUnidad && unidad && claveUnidad.toUpperCase() !== unidad.toUpperCase()
        ? `${claveUnidad} / ${unidad}`
        : (unidad || claveUnidad || 'N/D');
      const cantidadRaw = textoXml(concepto?.Cantidad);
      const cantidadNumero = Number(cantidadRaw);
      const cantidadTexto = cantidadRaw && Number.isFinite(cantidadNumero) ? moneda(cantidadNumero) : (cantidadRaw || 'N/D');
      return [
        textoXml(concepto?.ClaveProdServ) || 'N/D',
        textoXml(concepto?.Descripcion) || 'N/D',
        cantidadTexto,
        unidadTexto,
        textoXml(concepto?.ObjetoImp) || 'N/D',
        `$${moneda(concepto?.ValorUnitario)}`,
        `$${moneda(concepto?.Importe)}`,
      ];
    };
    const measureRow = (values: string[]) => {
      doc.font(FONT).fontSize(7.5);
      const tallest = Math.max(...values.map((value, index) => doc.heightOfString(value, { width: conceptCols[index].width - 8, lineGap: 0 })));
      return Math.max(16, tallest + 7);
    };
    const drawConceptHeader = () => {
      doc.rect(LEFT, y, CONTENT_W, 15).fill(BLUE);
      let x = LEFT;
      conceptCols.forEach((col) => {
        doc.font(BOLD).fontSize(6.5).fillColor('#ffffff').text(col.title, x + 4, y + 4, {
          width: col.width - 8, height: 9, align: col.align, lineBreak: false,
        });
        x += col.width;
      });
      y += 15;
    };
    const totalsHeight = 30;
    const drawTotals = () => {
      const amountW = 78;
      const labelW = 68;
      const x = LEFT + CONTENT_W - labelW - amountW;
      doc.save();
      doc.moveTo(x, y + 1).lineTo(LEFT + CONTENT_W, y + 1).lineWidth(0.6).strokeColor(LINE).stroke();
      doc.restore();
      const rows: Array<[string, string, boolean]> = [
        ['Subtotal', `$${moneda(comprobante.SubTotal)}`, false],
        ['Total', `$${moneda(comprobante.Total)}`, true],
      ];
      let cursor = y + 5;
      rows.forEach(([label, amount, strong]) => {
        doc.font(strong ? BOLD : FONT).fontSize(strong ? 8.5 : 7.5).fillColor(strong ? BLUE : MUTED)
          .text(label, x, cursor, { width: labelW, height: 11, lineBreak: false });
        doc.font(strong ? BOLD : FONT).fontSize(strong ? 8.5 : 8).fillColor(INK)
          .text(amount, x + labelW, cursor, { width: amountW, height: 11, align: 'right', lineBreak: false });
        cursor += strong ? 13 : 11;
      });
      y = cursor + 4;
    };

    ensure(19 + 15 + (conceptos.length ? measureRow(conceptValues(conceptos[0])) : 16) + (conceptos.length <= 1 ? totalsHeight : 0));
    drawSection('CONCEPTOS');
    if (!conceptos.length) {
      paint('El XML timbrado no contiene conceptos fiscales.', LEFT, y, { size: 8, color: '#b91c1c', width: CONTENT_W });
      y += 16;
    } else {
      drawConceptHeader();
      conceptos.forEach((concepto, index) => {
        const values = conceptValues(concepto);
        const rowH = measureRow(values);
        const needed = rowH + (index === conceptos.length - 1 ? totalsHeight : 0);
        if (y + needed > BOTTOM && y > doc.page.margins.top + 28) {
          continuation();
          drawConceptHeader();
        }
        if (index % 2 === 0) doc.rect(LEFT, y, CONTENT_W, rowH).fill('#f7f8fb');
        doc.save();
        doc.rect(LEFT, y, CONTENT_W, rowH).lineWidth(0.4).strokeColor(LINE).stroke();
        doc.restore();
        let x = LEFT;
        values.forEach((value, colIndex) => {
          const col = conceptCols[colIndex];
          paint(value, x + 4, y + 3, { size: 7.5, width: col.width - 8, align: col.align, lineGap: 0 });
          x += col.width;
        });
        y += rowH;
      });
    }
    if (y + totalsHeight > BOTTOM) {
      continuation();
      drawSection('CONCEPTOS');
    }
    drawTotals();

    const certFields: Array<[string, string]> = [
      ['UUID', uuid || 'N/D'],
      ['Fecha de timbrado', fechaTimbrado],
      ['RFC del PAC', textoXml(tfd.RfcProvCertif || input.documento?.timbre?.rfc_proveedor_certificacion) || 'N/D'],
      ['No. certificado emisor', textoXml(comprobante.NoCertificado) || 'N/D'],
      ['No. certificado SAT', textoXml(tfd.NoCertificadoSAT || input.documento?.timbre?.no_certificado_sat) || 'N/D'],
    ];
    const qrSize = 84;
    const certBody = Math.max(qrSize, certFields.length * 12);
    ensure(19 + certBody + 4);
    drawSection('CERTIFICACIÓN FISCAL');
    const certTop = y;
    const certTextW = CONTENT_W - (qrBuffer ? qrSize + 14 : 0);
    const certLabelW = 124;
    const fieldsHeight = certFields.length * 12;
    const fieldsTop = certTop + Math.max(0, (certBody - fieldsHeight) / 2);
    certFields.forEach(([label, value], index) => {
      const fieldY = fieldsTop + index * 12;
      doc.font(BOLD).fontSize(7).fillColor(MUTED).text(label, LEFT, fieldY, { width: certLabelW, height: 10, lineBreak: false });
      doc.font(FONT).fontSize(7.5).fillColor(INK).text(value, LEFT + certLabelW, fieldY, {
        width: certTextW - certLabelW, height: 10, lineBreak: false,
      });
    });
    if (qrBuffer) doc.image(qrBuffer, LEFT + CONTENT_W - qrSize, certTop, { fit: [qrSize, qrSize] });
    y = certTop + certBody + 8;

    const wrapTechnical = (value: string) => {
      doc.font(FONT).fontSize(6.5);
      const source = value.trim() ? value : 'No disponible';
      const maxWidth = CONTENT_W - 2;
      const lines: string[] = [];
      let current = '';
      for (const char of source) {
        if (char === '\n') {
          lines.push(current);
          current = '';
          continue;
        }
        const next = current + char;
        if (current && doc.widthOfString(next) > maxWidth) {
          lines.push(current);
          current = char === ' ' ? '' : char;
        } else {
          current = next;
        }
      }
      if (current) lines.push(current);
      return lines.length ? lines : ['No disponible'];
    };
    const drawTechnical = (title: string, value: string) => {
      const lines = wrapTechnical(value);
      const lineH = 7.7;
      const titleH = 10;
      if (y + titleH + lineH * Math.min(lines.length, 2) > BOTTOM) continuation();
      doc.font(BOLD).fontSize(6.5).fillColor(BLUE).text(title, LEFT, y, { width: CONTENT_W, height: 9, lineBreak: false });
      y += titleH;
      let carried = false;
      lines.forEach((line) => {
        if (y + lineH > BOTTOM) {
          continuation();
          doc.font(BOLD).fontSize(6.5).fillColor(BLUE).text(`${title} (continúa)`, LEFT, y, { width: CONTENT_W, height: 9, lineBreak: false });
          y += titleH;
          carried = true;
        }
        doc.font(FONT).fontSize(6.5).fillColor('#1f2937').text(line, LEFT, y, { width: CONTENT_W + 1, height: lineH, lineBreak: false });
        y += lineH;
      });
      y += carried ? 4 : 5;
    };
    drawTechnical('CADENA ORIGINAL', input.cadenaOriginal || 'Cadena original no disponible');
    drawTechnical('SELLO DIGITAL DEL CFDI', textoXml(comprobante.Sello) || 'Sello no disponible');
    drawTechnical('SELLO DEL SAT', textoXml(tfd.SelloSAT || input.documento?.timbre?.sello_sat) || 'Sello no disponible');

    if (y + 12 > BOTTOM) continuation();
    y += 2;
    paint('Este documento es una representación impresa de un CFDI.', LEFT, y, {
      size: 6.5, color: MUTED, width: CONTENT_W, align: 'center',
    });

    doc.end();
  });
}

function dibujarMarcaCancelado(doc: PDFKit.PDFDocument): void {
  const width = 92;
  const x = doc.page.width - doc.page.margins.right - width;
  doc.save();
  doc.roundedRect(x, 12, width, 18, 3).lineWidth(0.8).stroke('#555555');
  doc.font('Trebuchet-Bold').fontSize(9).fillColor('#333333').text('CANCELADO', x, 17, { width, align: 'center' });
  doc.restore();
}

type EmpresaPdfInfo = {
  nombre: string | null;
  razonSocial: string | null;
  rfc: string | null;
  regimenFiscal: string | null;
  direccion: string | null;
  direccionLineas: string[];
  telefono: string | null;
  email: string | null;
};

const formatCurrency = (value?: number | null) => {
  const num = Number(value ?? 0);
  return num.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-MX');
};

const formatEstatusDocumento = (value?: string | null): string => {
  const estatus = String(value ?? '').trim().toLowerCase();
  const etiquetas: Record<string, string> = {
    borrador: 'Borrador',
    emitido: 'Emitido',
    enviado: 'Emitido',
    timbrado: 'Timbrado',
    cancelado: 'Cancelado',
    cancelada: 'Cancelado',
  };
  return etiquetas[estatus] ?? (String(value ?? '').trim() || 'Borrador');
};

const formatTelefonoParaImpresion = (telefono: string): string => {
  const soloDigitos = telefono.replace(/\D/g, '');
  if (soloDigitos.length === 13 && soloDigitos.startsWith('521')) {
    return soloDigitos.slice(-10);
  }
  if (soloDigitos.length === 12 && soloDigitos.startsWith('52')) {
    return soloDigitos.slice(-10);
  }
  if (soloDigitos.length === 10) {
    return soloDigitos;
  }
  return telefono;
};

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return '';
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
    if (match) return match[1]; // ya viene en formato ISO CFDI
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

const getAppBaseUrl = () => {
  const rawBaseUrl = process.env.APP_BASE_URL?.trim();
  if (rawBaseUrl) return rawBaseUrl.replace(/\/$/, '');
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3001';
  return null;
};

const resolvePublicUrl = (value?: string | null) => {
  const rawValue = (value ?? '').trim();
  if (!rawValue) return null;
  if (/^https?:\/\//i.test(rawValue)) return rawValue;
  const baseUrl = getAppBaseUrl();
  if (!baseUrl) return null;
  return `${baseUrl}${rawValue.startsWith('/') ? '' : '/'}${rawValue}`;
};

async function getProductoArchivoUrl(productoArchivoId?: number | null, empresaId?: number) {
  if (!productoArchivoId || !empresaId) return null;

  const { rows } = await pool.query<{ archivo: string | null }>(
    `SELECT pa.archivo
       FROM productos_archivos pa
       INNER JOIN productos p ON p.id = pa.producto_id
      WHERE pa.id = $1
        AND p.empresa_id = $2
      LIMIT 1`,
    [productoArchivoId, empresaId]
  );

  return resolvePublicUrl(rows?.[0]?.archivo ?? null);
};

const mapRegimen = (code: string | null | undefined) => {
  const map: Record<string, string> = {
    '616': 'Sin obligaciones fiscales',
  };
  return code ? map[code] || code : 'N/D';
};

const mapFormaPago = (code: string | null | undefined) => {
  const map: Record<string, string> = {
    '01': 'Efectivo',
  };
  return code ? map[code] || code : 'N/D';
};

const mapMetodoPago = (code: string | null | undefined) => {
  const map: Record<string, string> = {
    PUE: 'Pago en una sola exhibición',
  };
  return code ? map[code] || code : 'N/D';
};

const mapUsoCfdi = (code: string | null | undefined) => {
  const map: Record<string, string> = {
    G01: 'Adquisición de mercancías',
    G03: 'Gastos en general',
    P01: 'Por definir',
    S01: 'Sin efectos fiscales',
  };
  return code ? map[code] || code : 'N/D';
};

export const normalizarColorHex = (color?: string | null): string | undefined => {
  if (!color) return undefined;
  const value = color.trim();
  const match = value.match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/);
  if (!match) return undefined;
  return `#${match[1]}`;
};

const tituloPorTipo = (tipo: string | null | undefined) => {
  const t = (tipo || '').toString().toLowerCase();
  if (t === 'factura') return 'FACTURA';
  if (t === 'traslado') return 'CFDI DE TRASLADO';
  if (t === 'nota_credito') return 'NOTA DE CRÉDITO';
  if (t === 'nota_credito_compra') return 'NOTA DE CRÉDITO DE COMPRA';
  if (t === 'orden_servicio') return 'ORDEN DE SERVICIO';
  if (t === 'orden_compra') return 'ORDEN DE COMPRA';
  if (t === 'pedido') return 'PEDIDO';
  if (t === 'remision') return 'REMISIÓN';
  if (t === 'recepcion') return 'RECEPCIÓN';
  if (t === 'pago_cliente') return 'RECIBO DE PAGO';
  return 'COTIZACIÓN';
};

// Conversión simple de número a letras (MXN) para mostrar monto en texto.
const unidades = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const decenas = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
const decenasTys = ['veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const centenas = ['cien', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

const numeroALetras = (num: number): string => {
  if (!Number.isFinite(num)) return '';
  const entero = Math.floor(Math.abs(num));
  const centavos = Math.round((Math.abs(num) - entero) * 100);

  const seccion = (n: number): string => {
    if (n === 0) return '';
    if (n < 10) return unidades[n];
    if (n < 20) return decenas[n - 10];
    if (n < 100) {
      const d = Math.floor(n / 10);
      const r = n % 10;
      return decenasTys[d - 2] + (r ? ' y ' + unidades[r] : '');
    }
    if (n < 1000) {
      const c = Math.floor(n / 100);
      const r = n % 100;
      const pref = c === 1 && r === 0 ? centenas[0] : (c === 1 ? centenas[1] : centenas[c]);
      return pref + (r ? ' ' + seccion(r) : '');
    }
    if (n < 1000000) {
      const miles = Math.floor(n / 1000);
      const r = n % 1000;
      const milesTxt = miles === 1 ? 'mil' : seccion(miles) + ' mil';
      return milesTxt + (r ? ' ' + seccion(r) : '');
    }
    const millones = Math.floor(n / 1000000);
    const r = n % 1000000;
    const millonesTxt = millones === 1 ? 'un millón' : seccion(millones) + ' millones';
    return millonesTxt + (r ? ' ' + seccion(r) : '');
  };

  const letras = seccion(entero) || 'cero';
  const centavosTxt = centavos.toString().padStart(2, '0');
  return `${letras.toUpperCase()} PESOS ${centavosTxt}/100 MXN`;
};

export async function obtenerLogoEmpresaPath(empresaId?: number): Promise<string | null> {
  if (!empresaId) return null;
  try {
    const { rows } = await pool.query(
      `SELECT ruta
         FROM core.empresas_assets
        WHERE empresa_id = $1 AND tipo = 'logo_default' AND activo = true
        ORDER BY created_at DESC
        LIMIT 1`,
      [empresaId]
    );
    const ruta = rows?.[0]?.ruta as string | undefined;
    if (!ruta) {
      try {
        const dbInfo = await pool.query<{ db: string }>('SELECT current_database() AS db');
        console.warn('[pdf] Logo no encontrado en BD', {
          rowCount: rows?.length ?? 0,
          dbEnv: process.env.DB_NAME,
          currentDb: dbInfo.rows?.[0]?.db,
        });
      } catch (err) {
        console.warn('[pdf] No se pudo obtener la BD actual al buscar logo', err);
      }
      return null;
    }

    // La ruta almacenada viene como /uploads/empresas/...; resolvemos a disco
    const normalizedRuta = ruta.replace(/\\/g, '/');
    if (path.isAbsolute(normalizedRuta) && !normalizedRuta.startsWith('/uploads/')) {
      return fs.existsSync(normalizedRuta) ? normalizedRuta : null;
    }

    const backendUploadsRoot = path.resolve(__dirname, '..', '..', '..', 'uploads');
    const uploadsRootCandidates = [
      process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : null,
      path.resolve(process.cwd(), 'uploads'),
      backendUploadsRoot,
      path.resolve(__dirname, '..', '..', '..', '..', 'uploads'),
    ].filter((candidate): candidate is string => Boolean(candidate));

  const relative = normalizedRuta.replace(/^\/?uploads\/?/i, '');
    for (const root of uploadsRootCandidates) {
      const absPath = path.join(root, relative);
      if (fs.existsSync(absPath)) return absPath;
    }

    console.warn('[pdf] Logo no encontrado en rutas esperadas', {
      empresaId,
      ruta,
      uploadsRootCandidates,
    });
    return null;
  } catch (error) {
    console.warn('[pdf] No se pudo obtener logo de empresa', error);
    return null;
  }
}

async function obtenerEmpresaPdfInfo(empresaId?: number): Promise<EmpresaPdfInfo | null> {
  if (!empresaId) return null;

  try {
    const { rows } = await pool.query<{
      nombre: string | null;
      razon_social: string | null;
      rfc: string | null;
      regimen_fiscal_id: string | null;
      calle: string | null;
      numero_exterior: string | null;
      numero_interior: string | null;
      colonia: string | null;
      localidad: string | null;
      estado: string | null;
      codigo_postal: string | null;
      pais: string | null;
      telefono: string | null;
      email: string | null;
    }>(
      `SELECT
         NULLIF(TRIM(COALESCE(e.nombre, '')), '') AS nombre,
         NULLIF(TRIM(COALESCE(e.razon_social, '')), '') AS razon_social,
         NULLIF(TRIM(COALESCE(e.rfc, '')), '') AS rfc,
         NULLIF(TRIM(COALESCE(e.regimen_fiscal_id, '')), '') AS regimen_fiscal_id,
         NULLIF(TRIM(COALESCE(e.calle, '')), '') AS calle,
         NULLIF(TRIM(COALESCE(e.numero_exterior, '')), '') AS numero_exterior,
         NULLIF(TRIM(COALESCE(e.numero_interior, '')), '') AS numero_interior,
         NULLIF(TRIM(col.texto), '') AS colonia,
         NULLIF(TRIM(loc.texto), '') AS localidad,
         NULLIF(TRIM(est.texto), '') AS estado,
         NULLIF(TRIM(COALESCE(e.codigo_postal, e.codigo_postal_id, '')), '') AS codigo_postal,
         NULLIF(TRIM(COALESCE(e.pais, '')), '') AS pais,
         NULLIF(TRIM(COALESCE(e.telefono, '')), '') AS telefono,
         NULLIF(TRIM(COALESCE(e.email, '')), '') AS email
       FROM core.empresas e
       LEFT JOIN sat.colonias col
         ON col.codigo_postal = e.codigo_postal_id
        AND col.colonia = e.colonia_id
       LEFT JOIN sat.localidades loc
         ON loc.estado = e.estado_id
        AND loc.localidad = e.localidad_id
       LEFT JOIN sat.estados est
         ON est.estado = e.estado_id
      WHERE e.id = $1
      LIMIT 1`,
      [empresaId]
    );

    const row = rows[0];
    if (!row) return null;

    const direccionLineas = [
      [row.calle, row.numero_exterior, row.numero_interior].filter(Boolean).join(' ').trim() || null,
      row.colonia,
      [row.localidad, row.estado].filter(Boolean).join(', ').trim() || null,
      [row.codigo_postal ? `C.P. ${row.codigo_postal}` : null, row.pais].filter(Boolean).join(', ').trim() || null,
    ].filter((value): value is string => Boolean(value && value.trim()));

    const direccion = direccionLineas.join(', ');

    return {
      nombre: row.nombre ?? row.razon_social ?? null,
      razonSocial: row.razon_social ?? null,
      rfc: row.rfc ?? null,
      regimenFiscal: row.regimen_fiscal_id ?? null,
      direccion: direccion || null,
      direccionLineas,
      telefono: row.telefono ?? null,
      email: row.email ?? null,
    };
  } catch (error) {
    console.warn('[pdf] No se pudo obtener información de empresa para PDF', {
      empresaId,
      error: (error as Error)?.message ?? error,
    });
    return null;
  }
}

async function obtenerNombreConceptoPdf(conceptoId?: number | null, empresaId?: number): Promise<string | null> {
  if (!conceptoId || !empresaId) return null;

  try {
    const { rows } = await pool.query<{ nombre_concepto: string | null }>(
      `SELECT nombre_concepto
         FROM conceptos
        WHERE id = $1
          AND empresa_id = $2
        LIMIT 1`,
      [conceptoId, empresaId]
    );

    return rows[0]?.nombre_concepto?.trim() || null;
  } catch (error) {
    console.warn('[pdf] No se pudo obtener el nombre del concepto para NC comercial', {
      conceptoId,
      empresaId,
      error: (error as Error)?.message ?? error,
    });
    return null;
  }
}

const obtenerLayoutFallback = (tipoDocumento?: string | null): DocumentLayout => {
  const tipo = (tipoDocumento ?? '').toString().toLowerCase();
  return (
    DOCUMENT_LAYOUTS[tipo as keyof typeof DOCUMENT_LAYOUTS] ?? {
      mostrarHeader: true,
      mostrarCliente: true,
      mostrarPartidas: true,
      mostrarTotales: true,
      mostrarEspecificacionesPartida: true,
    }
  );
};

async function getDocumentLayout(documento?: any, empresaIdFallback?: number): Promise<DocumentLayout> {
  const tipoDocumento = (documento?.tipo_documento ?? '').toString().toLowerCase();
  const baseLayout = obtenerLayoutFallback(tipoDocumento);
  const serieTexto = (documento?.serie ?? null) as string | null;
  const empresaId = (documento?.empresa_id ?? empresaIdFallback ?? null) as number | null;

  try {
    if (empresaId && tipoDocumento && serieTexto) {
      const { rows } = await pool.query(
        `SELECT sd.layout_id, pd.configuracion
           FROM public.series_documento sd
      LEFT JOIN public.plantillas_documento pd ON pd.id = sd.layout_id
          WHERE sd.empresa_id = $1
            AND sd.tipo_documento = $2
            AND sd.serie = $3
          LIMIT 1`,
        [empresaId, tipoDocumento, serieTexto]
      );

      const serieRow = rows?.[0];
      if (serieRow?.layout_id && serieRow?.configuracion && typeof serieRow.configuracion === 'object') {
        return { ...baseLayout, ...serieRow.configuracion };
      }
    }

    if (empresaId) {
      const { rows } = await pool.query(
        `SELECT configuracion
           FROM public.plantillas_documento
          WHERE empresa_id = $1
            AND activo = true
            AND serie IS NULL
            AND (tipo_documento IS NULL OR tipo_documento = $2)
       ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
          LIMIT 1`,
        [empresaId, tipoDocumento || null]
      );

      const empresaRow = rows?.[0];
      if (empresaRow?.configuracion && typeof empresaRow.configuracion === 'object') {
        return { ...baseLayout, ...empresaRow.configuracion };
      }
    }
  } catch (error) {
    console.warn('[pdf] Error al obtener layout dinámico, usando fallback', {
      documentoId: documento?.id ?? null,
      serieTexto,
      empresaId,
      error: (error as Error)?.message ?? error,
    });
  }

  return baseLayout;
}

async function generarPDFFromHTML(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
    });
    await page.close();
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

export async function generarDocumentoPDF(data: DataCotizacion, empresaId?: number, options?: GenerarDocumentoPdfOptions): Promise<Buffer> {
  const { documento, partidas } = data;
  const timbre = documento?.timbre;
  const usarPlantillas = false;

  try {
    console.log('DOCUMENTO:', documento?.id, (documento as any)?.empresa_id, documento?.tipo_documento);
    console.log('Buscando plantilla con:', {
      empresa_id: (documento as any)?.empresa_id ?? empresaId ?? null,
      tipo_documento: documento?.tipo_documento ?? null,
    });
    const plantilla = await obtenerPlantillaParaDocumento({
      empresa_id: (documento as any)?.empresa_id ?? empresaId ?? null,
      tipo_documento: documento?.tipo_documento ?? null,
    });
    console.log('PLANTILLA ENCONTRADA:', plantilla);

    if (usarPlantillas && plantilla) {
      try {
        const folio = formatearFolioDocumento(documento?.serie ?? '', Number(documento?.numero ?? 0));
        const plantillaData: PlantillaData = {
          empresa: {
            nombre: (documento as any)?.empresa_nombre ?? null,
            rfc: (documento as any)?.empresa_rfc ?? timbre?.rfc_emisor ?? null,
            direccion: (documento as any)?.empresa_direccion ?? null,
          },
          cliente: {
            nombre: documento?.nombre_receptor ?? documento?.cliente_nombre ?? null,
            rfc: documento?.rfc_receptor ?? documento?.cliente_rfc ?? null,
          },
          documento: {
            folio,
            fecha: documento?.fecha_documento ?? null,
            tipo_documento: documento?.tipo_documento ?? null,
            total: documento?.total ?? null,
            subtotal: documento?.subtotal ?? null,
          },
          partidas: (partidas ?? []).map((partida) => ({
            descripcion: partida.descripcion_alterna ?? null,
            cantidad: partida.cantidad ?? null,
            precio: partida.precio_unitario ?? null,
            importe: partida.subtotal_partida ?? null,
          })),
        };

        const html = renderPlantillaHTML(plantilla.contenido_html, plantillaData);
        console.info('[pdf] Plantilla HTML renderizada', {
          documentoId: documento?.id,
          tipoDocumento: documento?.tipo_documento,
          plantillaId: plantilla.id,
        });

        return await generarPDFFromHTML(html);
      } catch (plantillaError) {
        console.warn('[pdf] Error al renderizar plantilla HTML; usando formato clásico.', {
          documentoId: documento?.id,
          tipoDocumento: documento?.tipo_documento,
          plantillaId: plantilla.id,
          error: (plantillaError as Error)?.message,
        });
      }
    }


  let qrBuffer: Buffer | null = null;
  const estaTimbrado = !!timbre?.uuid;
  const tipoDocumentoNormalizado = (documento?.tipo_documento ?? '').toString().toLowerCase();
  const esCotizacion = tipoDocumentoNormalizado === 'cotizacion';
  const esTraslado = tipoDocumentoNormalizado === 'traslado';
  const esOrdenServicio = tipoDocumentoNormalizado === 'orden_servicio';
  const esNotaCredito = tipoDocumentoNormalizado === 'nota_credito' || tipoDocumentoNormalizado === 'nota_credito_compra';
  const esNotaCreditoComercial = esNotaCredito && (documento?.motivo_nc ?? null) === 'otro';
  const condicionesImpresionSerie = esCotizacion
    ? await obtenerCondicionesImpresionSerie(
        (documento as any)?.empresa_id ?? empresaId,
        documento?.tipo_documento ?? '',
        documento?.serie ?? ''
      )
    : null;
  const partidasConMontos = (partidas ?? []).map((partida) => {
    const cantidad = Number(partida.cantidad ?? 0);
    const precioUnitario = Number(partida.precio_unitario ?? 0);
    const subtotalNeto = Number(partida.subtotal_partida ?? 0);
    const subtotalBruto = cantidad * precioUnitario;
    const descuento = Math.max(0, subtotalBruto - subtotalNeto);

    return {
      ...partida,
      subtotalBruto,
      subtotalNeto,
      descuento,
    };
  });
  const subtotalBrutoDocumento = partidasConMontos.reduce((acc, partida) => acc + partida.subtotalBruto, 0);
  const subtotalNetoDocumento = Number(documento?.subtotal ?? partidasConMontos.reduce((acc, partida) => acc + partida.subtotalNeto, 0));
  const descuentoTotalDocumento = Math.max(0, subtotalBrutoDocumento - subtotalNetoDocumento);
  const impuestosDocumento = Array.from((partidas ?? []).reduce((agrupados, partida) => {
    for (const impuesto of partida.impuestos ?? []) {
      const tipo = String(impuesto.tipo ?? 'otro').toLowerCase();
      const id = impuesto.impuesto_id || impuesto.nombre || tipo;
      const key = `${tipo}:${id}`;
      const actual = agrupados.get(key);
      agrupados.set(key, {
        id,
        nombre: impuesto.nombre || impuesto.impuesto_id || 'Impuesto',
        tipo,
        monto: (actual?.monto ?? 0) + Number(impuesto.monto ?? 0),
      });
    }
    return agrupados;
  }, new Map<string, { id: string; nombre: string; tipo: string; monto: number }>()).values());
  const retencionesDocumento = impuestosDocumento
    .filter((impuesto) => impuesto.tipo === 'retencion')
    .reduce((total, impuesto) => total + impuesto.monto, 0)
    || Number(documento?.retencion_iva ?? 0) + Number(documento?.retencion_isr ?? 0);
  const impuestosAdicionalesDocumento = impuestosDocumento.filter((impuesto) => {
    const texto = `${impuesto.id} ${impuesto.nombre}`.toLowerCase();
    return impuesto.tipo !== 'retencion' && !texto.includes('iva');
  });
  if (estaTimbrado) {
    const qrDatos: DatosQrCfdi = {
      uuid: timbre?.uuid || '',
      rfc_emisor: timbre?.rfc_emisor || documento?.cliente_rfc || '',
      rfc_receptor: timbre?.rfc_receptor || documento?.rfc_receptor || '',
      total: Number(timbre?.total ?? documento?.total ?? 0),
      sello_cfdi: timbre?.sello_cfdi || '',
    };

    try {
      const qrDataUrl = await generarImagenQR(qrDatos);
      const base64 = qrDataUrl.split(',')[1] || '';
      qrBuffer = Buffer.from(base64, 'base64');
    } catch (err) {
      console.error('[pdf] No se pudo generar imagen QR:', err);
    }
  }
  const contentWidth = 595.28 - 2 * 50; // A4 width minus default margins (approx)
  const primaryColor = '#1d2f68';
  const textColor = '#111827';
  const mutedText = '#374151';
  const borderGray = '#e5e7eb';

  const backendRoot = path.resolve(__dirname, '..', '..', '..');
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
  const defaultLogoPath = path.resolve(backendRoot, '..', 'frontend', 'public', 'logos', 'logo-emphasys.jpg');
  console.log('[PDF DEBUG LOGO]', {
    empresaIdContexto: empresaId,
    empresaIdDocumento: (documento as any)?.empresa_id,
    empresaUsada: (documento as any)?.empresa_id ?? empresaId,
  });
  const empresaLogoPath = await obtenerLogoEmpresaPath((documento as any)?.empresa_id ?? empresaId);
  const empresaInfo = await obtenerEmpresaPdfInfo((documento as any)?.empresa_id ?? empresaId);
  const motivoNcNormalizado = (documento?.motivo_nc ?? null) as DocumentoCotizacion['motivo_nc'];
  const esNotaCreditoMotivoOtro = tipoDocumentoNormalizado === 'nota_credito' || tipoDocumentoNormalizado === 'nota_credito_compra'
    ? motivoNcNormalizado === 'otro'
    : false;
  const nombreConceptoNcComercial = esNotaCreditoMotivoOtro
    ? await obtenerNombreConceptoPdf(documento?.concepto_id ?? null, (documento as any)?.empresa_id ?? empresaId)
    : null;
  const logoPath = empresaLogoPath && fs.existsSync(empresaLogoPath) ? empresaLogoPath : defaultLogoPath;
  const hasLogo = fs.existsSync(logoPath);
  options?.onLogoResolved?.(hasLogo ? logoPath : '');
  console.info('[pdf] Logo resuelto', {
    empresaId: empresaId ?? (documento as any)?.empresa_id,
    empresaLogoPath,
    logoPath,
    hasLogo,
  });
  const assetsFontsPath = path.resolve(__dirname, '..', '..', '..', 'assets', 'fonts');
  const repoFontsPath = path.resolve(__dirname, '..', '..', '..', '..', 'fonts');

  const fontRegularPath = path.join(assetsFontsPath, 'TREBUC.TTF');
  const fontBoldPath = path.join(assetsFontsPath, 'TREBUCBD.TTF');
  const fontItalicPath = path.join(assetsFontsPath, 'TREBUCIT.TTF');

  const layout = await getDocumentLayout(documento, empresaId);
  options?.onLayoutResolved?.(layout);
  console.info('[pdf] Layout resuelto para observaciones de partida', {
    documentoId: documento?.id,
    empresaId: empresaId ?? (documento as any)?.empresa_id,
    tipoDocumento: documento?.tipo_documento,
    serie: documento?.serie ?? null,
    mostrarObservacionesPartida: layout.mostrarObservacionesPartida,
    partidasConObservaciones: (partidas ?? []).filter((p) => Boolean((p as PartidaCotizacion).observaciones)).length,
    totalPartidas: (partidas ?? []).length,
  });

  const mostrarCamposConfigurablesPartida = layout.mostrarCamposConfigurablesPartida === true;
  const empresaIdParaCamposConfigurables = (documento as any)?.empresa_id ?? empresaId;
  const partidaIdsParaCamposConfigurables = mostrarCamposConfigurablesPartida
    ? (partidas ?? [])
        .map((p) => Number((p as PartidaCotizacion)?.id))
        .filter((id): id is number => Number.isFinite(id))
    : [];
  const camposConfigurablesPartidasImpresion = mostrarCamposConfigurablesPartida
    && partidaIdsParaCamposConfigurables.length > 0
    && empresaIdParaCamposConfigurables
    ? await obtenerCamposConfigurablesPartidasParaImpresion(
        empresaIdParaCamposConfigurables,
        partidaIdsParaCamposConfigurables,
        documento?.tipo_documento ?? null
      )
    : [];

  const camposConfigurablesPorPartidaId = new Map<number, CampoConfigurablePartidaValor[]>();
  camposConfigurablesPartidasImpresion.forEach((campo) => {
    const lista = camposConfigurablesPorPartidaId.get(campo.partidaId) ?? [];
    lista.push(campo);
    camposConfigurablesPorPartidaId.set(campo.partidaId, lista);
  });
  camposConfigurablesPorPartidaId.forEach((campos, partidaId) => {
    camposConfigurablesPorPartidaId.set(partidaId, ordenarCamposConfigurablesPartida(campos));
  });

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
    let tracedPageNumber = 1;
    let manualAddPageInProgress = false;

    const getTraceStack = () => {
      const raw = String(new Error().stack || '')
        .split('\n')
        .slice(2)
        .map((line) => line.trim())
        .filter((line) => line && !line.includes('getTraceStack') && !line.includes('wrappedAddPage') && !line.includes('wrappedText'));

      return raw.slice(0, 6);
    };

    const getCurrentFunction = () => {
      const stackLine = getTraceStack()[0] || '';
      const match = stackLine.match(/^at\s+(.+?)\s+\(/);
      return match?.[1] || stackLine || 'unknown';
    };

    const originalAddPage = doc.addPage.bind(doc);
    const originalText = doc.text.bind(doc);

    const wrappedAddPage: typeof doc.addPage = ((...args: any[]) => {
      manualAddPageInProgress = true;
      console.log('[PDF TRACE] addPage() llamado', {
        currentFunction: getCurrentFunction(),
        page: tracedPageNumber,
        y: doc.y,
        stack: getTraceStack(),
      });
      try {
        return originalAddPage(...args);
      } finally {
        manualAddPageInProgress = false;
      }
    }) as typeof doc.addPage;

    const wrappedText: typeof doc.text = ((text: any, ...args: any[]) => {
      const normalizedText = typeof text === 'string' ? text : '';
      const shouldTrace = [
        'Cadena original del complemento',
        'Sello digital del CFDI',
        'Sello del SAT',
      ].some((needle) => normalizedText.includes(needle));

      if (shouldTrace) {
        console.log('[PDF TRACE] text() clave', {
          currentFunction: getCurrentFunction(),
          page: tracedPageNumber,
          y: doc.y,
          text: normalizedText,
          stack: getTraceStack(),
        });
      }

      return originalText(text, ...args);
    }) as typeof doc.text;

    doc.addPage = wrappedAddPage;
    doc.text = wrappedText;

    let hasTrebuchet = false;
    let hasTrebuchetBold = false;
    let hasTrebuchetItalic = false;

    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('pageAdded', () => {
      tracedPageNumber += 1;
      console.log('[PDF TRACE] pageAdded', {
        mode: manualAddPageInProgress ? 'manual-or-wrapped' : 'automatic-or-indirect',
        currentFunction: getCurrentFunction(),
        page: tracedPageNumber,
        y: doc.y,
        stack: getTraceStack(),
      });
    });

    const registerFontIfExists = (fontName: string, filePath: string) => {
      const exists = fs.existsSync(filePath);
      console.log('[FONT CHECK]', {
        font: fontName,
        path: filePath,
        exists,
      });
      if (!exists) {
        console.warn('[FONT MISSING]', {
          font: fontName,
          path: filePath,
        });
        return false;
      }
      console.log('[FONT REGISTER PATH]', {
        font: fontName,
        path: filePath,
      });
      doc.registerFont(fontName, filePath);
      console.log('[FONT REGISTERED]', fontName);
      return true;
    };

    // Registrar fuentes embebidas (preferidas)
    hasTrebuchet = registerFontIfExists('Trebuchet', fontRegularPath);
    hasTrebuchetBold = registerFontIfExists('Trebuchet-Bold', fontBoldPath);
    hasTrebuchetItalic = registerFontIfExists('Trebuchet-Italic', fontItalicPath);

    // Fallback a fuentes del repo (compatibilidad actual)
    if (!hasTrebuchet || !hasTrebuchetBold || !hasTrebuchetItalic) {
      const fallbackRegular = path.join(repoFontsPath, 'TREBUC.ttf');
      const fallbackBold = path.join(repoFontsPath, 'TREBUCBD.ttf');
      const fallbackItalic = path.join(repoFontsPath, 'TREBUCIT.ttf');
      hasTrebuchet = hasTrebuchet || registerFontIfExists('Trebuchet', fallbackRegular);
      hasTrebuchetBold = hasTrebuchetBold || registerFontIfExists('Trebuchet-Bold', fallbackBold);
      hasTrebuchetItalic = hasTrebuchetItalic || registerFontIfExists('Trebuchet-Italic', fallbackItalic);
    }
    doc.font(hasTrebuchet ? 'Trebuchet' : 'Helvetica');

    if (timbre?.cancelado) {
      doc.on('pageAdded', () => dibujarMarcaCancelado(doc));
      dibujarMarcaCancelado(doc);
    }

    const setFont = (bold = false, size = 10, color = '#111827') => {
      const fontName = bold ? (hasTrebuchetBold ? 'Trebuchet-Bold' : 'Helvetica-Bold') : hasTrebuchet ? 'Trebuchet' : 'Helvetica';
      doc.font(fontName);
      doc.fontSize(size).fillColor(color);
    };

    const drawSectionHeader = (title: string) => {
      const y = doc.y;
      doc.rect(doc.page.margins.left, y, contentWidth, 18).fill('#f2f2f2');
      setFont(true, 10, textColor);
      doc.text(title.toUpperCase(), doc.page.margins.left + 8, y + 4, { width: contentWidth - 16 });
      doc.y = y + 22;
      doc.fillColor(textColor);
    };

    const renderMotivoNotaCredito = () => {
      if (tipoDocumentoNormalizado !== 'nota_credito' && tipoDocumentoNormalizado !== 'nota_credito_compra') {
        return;
      }

      const motivoLabel = motivoNcNormalizado === 'devolucion'
        ? 'Devolución'
        : motivoNcNormalizado === 'bonificacion'
          ? 'Bonificación'
          : null;

      if (!motivoLabel) return;

      doc.moveDown(0.2);
      setFont(true, 10, primaryColor);
      doc.text(`Motivo: ${motivoLabel}`, doc.page.margins.left, doc.y, { width: contentWidth });
      doc.moveDown(0.35);
    };

    const startX = doc.page.margins.left;
    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Configuración de imagen de partida: gobierna si se muestra y en qué posición
    // (debajo de la descripción, en columna propia, o no se muestra).
    const showImagenPartida = layout.mostrarImagenPartida === true;
    const rawImagenPartidaHeight = Number(layout.altoImagenPartida ?? 60);
    const imagenPartidaHeight = Number.isFinite(rawImagenPartidaHeight) && rawImagenPartidaHeight > 0
      ? rawImagenPartidaHeight
      : 60;
    const rawMaxAnchoImagenPartida = Number(layout.maxAnchoImagenPartida);
    const maxAnchoImagenPartida = Number.isFinite(rawMaxAnchoImagenPartida) && rawMaxAnchoImagenPartida > 0
      ? rawMaxAnchoImagenPartida
      : null;
    const posicionImagenPartida: 'debajo' | 'columna' | 'ninguna' = !showImagenPartida
      ? 'ninguna'
      : (layout.posicionImagenPartida ?? 'debajo');
    const imagenPartidaVisible = showImagenPartida && posicionImagenPartida !== 'ninguna';
    const imagenPartidaEnColumna = !esTraslado && imagenPartidaVisible && posicionImagenPartida === 'columna';
    const imagenPartidaGap = 10;
    // Ancho moderado y fijo para la columna de imagen: maxAnchoImagenPartida actúa como
    // tope, no como valor objetivo, para que la columna no le robe espacio a la tabla.
    const imageColumnCap = 70;
    const imageColumnContentWidth = Math.min(maxAnchoImagenPartida ?? imageColumnCap, imageColumnCap);
    const imageColumnWidth = imageColumnContentWidth + 12;

    const numericColumnsWidth = esTraslado ? 58 : 58 + 76 + 68 + 68; // Traslado sólo muestra cantidad

    let columnWidths: number[];
    let headers: string[];
    let descripcionIndex: number;
    let imagenColumnIndex: number | null = null;

    if (imagenPartidaEnColumna) {
      // Layout especial: Imagen | Producto/Descripción combinado | Cantidad | Precio unitario | Desc. | Importe
      const combinedWidth = tableWidth - imageColumnWidth - numericColumnsWidth;
      columnWidths = [imageColumnWidth, combinedWidth, 58, 76, 68, 68];
      headers = esTraslado
        ? ['Imagen', 'Producto / Descripción', 'Cantidad']
        : esNotaCreditoComercial
        ? ['Imagen', 'Descripción', 'Cantidad', 'Precio unitario', 'Desc.', 'Importe']
        : ['Imagen', 'Producto / Descripción', 'Cantidad', 'Precio unitario', 'Desc.', 'Importe'];
      descripcionIndex = 1;
      imagenColumnIndex = 0;
    } else {
      columnWidths = esTraslado
        ? [84, tableWidth - (84 + 58), 58]
        : esNotaCreditoComercial
        ? [
            tableWidth - numericColumnsWidth, // Descripción absorbe el espacio del producto oculto
            58, // Cantidad
            76, // Precio unitario
            68, // Desc.
            68, // Importe (alineado a margen derecho)
          ]
        : [
            84, // Producto (se mantiene)
            tableWidth - (84 + numericColumnsWidth), // Descripción absorbe espacio extra
            58, // Cantidad
            76, // Precio unitario
            68, // Desc.
            68, // Importe (alineado a margen derecho)
          ];
      headers = esTraslado
        ? ['Producto', 'Descripción', 'Cantidad']
        : esNotaCreditoComercial
        ? ['Descripción', 'Cantidad', 'Precio unitario', 'Desc.', 'Importe']
        : ['Producto', 'Descripción', 'Cantidad', 'Precio unitario', 'Desc.', 'Importe'];
      descripcionIndex = esNotaCreditoComercial ? 0 : 1;
    }

    const obtenerDescripcionPartidaPdf = (partida: PartidaCotizacion) => {
      if (esNotaCreditoComercial) {
        const descripcionComercial = (nombreConceptoNcComercial ?? documento?.producto_resumen ?? partida.descripcion_alterna ?? '').toString().trim();
        if (descripcionComercial) return descripcionComercial;
        return '';
      }

      return (partida.producto_descripcion ?? partida.descripcion ?? partida.descripcion_alterna ?? '').toString().trim();
    };

    const renderHeader = () => {
      // Encabezado clásico CFDI
      const headerTop = doc.y;
      const headerHeight = esOrdenServicio ? 82 : 122;
      const headerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // maxAnchoLogo/altoLogo son configurables desde Formatos de impresión; si vienen
      // vacíos/inválidos se usa el comportamiento actual (hardcodeado) como default.
      const logoMaxWidthDefault = 200;
      const logoMaxHeightDefault = esOrdenServicio ? 54 : headerHeight * 0.7;

      const rawMaxAnchoLogo = Number(layout.maxAnchoLogo);
      const logoMaxWidth = Number.isFinite(rawMaxAnchoLogo) && rawMaxAnchoLogo > 0 ? rawMaxAnchoLogo : logoMaxWidthDefault;

      const rawAltoLogo = Number(layout.altoLogo);
      const logoMaxHeight = Number.isFinite(rawAltoLogo) && rawAltoLogo > 0 ? rawAltoLogo : logoMaxHeightDefault;

      const folio = formatearFolioDocumento(documento?.serie ?? '', Number(documento?.numero ?? 0));
      const fechaTimbrado = documento?.timbre?.fecha_timbrado ? formatDateTime(documento.timbre.fecha_timbrado) : 'N/D';
      const uuid = documento?.timbre?.uuid || 'N/D';
      const fechaEmision = formatDate(documento?.fecha_documento) || 'N/D';
  const tipoComp = tituloPorTipo(documento?.tipo_documento);
  const tituloLayout = esTraslado ? tipoComp : (layout.titulo ?? tipoComp);
  const colorPrimarioLayout = normalizarColorHex(layout.colorPrimario) ?? primaryColor;
      const titleFontSize = esOrdenServicio ? 10 : 13;
      const titleGapBottom = esOrdenServicio ? 1 : 4;
      const boxRowHeight = esOrdenServicio ? 10 : 12;

      // Caja gris a la derecha
      const boxW = esOrdenServicio ? 272 : 240;
      const boxX = doc.page.width - doc.page.margins.right - boxW;
      const boxY = headerTop;

      // Título centrado en el recuadro gris
      setFont(true, titleFontSize, colorPrimarioLayout);
      const titleHeight = doc.heightOfString(tituloLayout, { width: boxW });
      const titleY = boxY + (esOrdenServicio ? 5 : 8); // encabezado alto, centrado solo horizontalmente

      const boxData: Array<[string, string]> = [
        ['Folio', folio || 'N/D'],
        ['Fecha elaboración', fechaEmision],
      ];
      if (esCotizacion && documento?.agente_nombre) {
        boxData.push(['Agente', documento.agente_nombre]);
      }
      if (!esCotizacion && !esTraslado && estaTimbrado) {
        boxData.push(
          ['Fecha timbrado', fechaTimbrado],
          ['Método Pago', mapMetodoPago(documento?.metodo_pago)],
          ['Forma Pago', mapFormaPago(documento?.forma_pago)],
          ['Uso CFDI', mapUsoCfdi(documento?.uso_cfdi)]
        );
      }

      let cursorY = titleY + titleHeight + titleGapBottom; // datos inmediatamente debajo del encabezado dentro del recuadro (ligeramente más arriba)

      if (estaTimbrado) {
        // UUID centrado, independiente de columnas
        cursorY += boxRowHeight;
      }

      const boxContentBottom = cursorY + boxData.length * boxRowHeight;
      const boxH = esCotizacion
        ? boxContentBottom - boxY + 8
        : esOrdenServicio
          ? 54
          : headerHeight;

      // Logo: se calcula su altura real de render (PDFKit solo alinea
      // arriba-izquierda por defecto con `fit`) para centrarlo verticalmente
      // respecto a la altura del recuadro derecho ("Cotización"/folio) y así
      // quede en la misma banda visual, sin dejar espacio muerto de más.
      let logoActualHeight = 0;
      let logoY = headerTop;

      if (hasLogo && layout.mostrarLogo !== false) {
        let logoNaturalWidth = logoMaxWidth;
        let logoNaturalHeight = logoMaxHeight;
        try {
          const logoImageInfo = (doc as any).openImage(logoPath) as { width: number; height: number };
          logoNaturalWidth = logoImageInfo.width;
          logoNaturalHeight = logoImageInfo.height;
        } catch (error) {
          console.warn('[pdf] No se pudieron leer las dimensiones del logo, se usa el tamaño máximo configurado', {
            logoPath,
            error: (error as Error)?.message,
          });
        }

        const logoAspect = logoNaturalWidth / logoNaturalHeight;
        const boxAspect = logoMaxWidth / logoMaxHeight;
        logoActualHeight = logoAspect > boxAspect ? logoMaxWidth / logoAspect : logoMaxHeight;

        // Sube el logo moderadamente respecto al tope del recuadro derecho,
        // acotado para no invadir de más el margen superior de la página.
        const logoRaise = esCotizacion ? 6 : 0;
        const centeredOffset = Math.max((boxH - logoActualHeight) / 2, 0);
        logoY = Math.max(headerTop + centeredOffset - logoRaise, doc.page.margins.top - 10);

        doc.image(logoPath, doc.page.margins.left, logoY, {
          fit: [logoMaxWidth, logoMaxHeight],
        });
      }

      doc.roundedRect(boxX, boxY, boxW, boxH, 6).fill('#eeeeee');
      doc.fillColor('#111827');

      setFont(true, titleFontSize, colorPrimarioLayout);
      doc.text(tituloLayout, boxX, titleY, { width: boxW, align: 'center' });
      if (estaTimbrado) {
        // UUID centrado, independiente de columnas
        setFont(true, 9, '#111827');
        doc.text(uuid, boxX, cursorY, { width: boxW, align: 'center' });
        cursorY += boxRowHeight;
      }

      // Columnas para etiquetas y valores
      const labelColWidth = esOrdenServicio ? 110 : 88;
      const gapCols = esOrdenServicio ? 4 : 8;
      const valueColWidth = boxW - 24 - labelColWidth - gapCols;
      const labelX = boxX + 12;
      const valueX = labelX + labelColWidth + gapCols;

      boxData.forEach(([label, value]) => {
        setFont(false, esOrdenServicio ? 8 : 9, '#111827');
        doc.text(label + ':', labelX, cursorY, { width: labelColWidth, align: 'right', lineBreak: false });
        doc.text(value, valueX, cursorY, { width: valueColWidth, align: 'left', lineBreak: false });
        cursorY += boxRowHeight;
      });

      const headerBottom = esCotizacion
        ? headerTop + boxH
        : esOrdenServicio
          ? Math.max(headerTop + boxH, headerTop + logoMaxHeight)
          : headerTop + headerHeight;
      doc.y = Math.max(headerBottom, cursorY) + (esOrdenServicio ? 4 : 10);
      if (esCotizacion || esOrdenServicio) {
        // Se usa la altura real del logo (no el máximo reservado) para no
        // dejar espacio muerto de más cuando el logo termina antes de esa cota.
        const logoBottom = logoY + logoActualHeight;
        const lineGapTop = esOrdenServicio ? 4 : 8;
        const lineGapBottom = esOrdenServicio ? 4 : 8;
        const lineY = Math.max(logoBottom, boxY + boxH) + lineGapTop;
        doc
          .moveTo(doc.page.margins.left, lineY)
          .lineTo(doc.page.width - doc.page.margins.right, lineY)
          .strokeColor('#cccccc')
          .stroke();
        doc.y = lineY + lineGapBottom;
      } else {
        doc.moveDown(0.6);
      }
    };

    const renderCliente = () => {
      // Bloque Emisor / Receptor
      const colWidth = (contentWidth - 12) / 2;
      const bloqueY = doc.y;
      if (esOrdenServicio) {
        const labelWidth = 62;
        const rowGap = 4;
        const sectionGap = 12;
        const emisorX = doc.page.margins.left;
        const receptorX = doc.page.margins.left + colWidth + sectionGap;
        const valueGap = 6;
        const valueWidth = colWidth - labelWidth - valueGap;
        const emisorDomicilioLineas = empresaInfo?.direccionLineas?.length
          ? empresaInfo.direccionLineas
          : ((documento as any)?.empresa_direccion
              ? String((documento as any).empresa_direccion)
                  .split(',')
                  .map((chunk: string) => chunk.trim())
                  .filter(Boolean)
              : []);
        const receptorRowsBase: Array<[string, string | null]> = [
          ['Nombre', documento?.nombre_receptor || documento?.cliente_nombre || null],
          ['Teléfono', documento?.cliente_telefono ?? null],
          ['Correo', documento?.cliente_email ?? null],
        ];
        const receptorRows = receptorRowsBase.filter(([, value]) => Boolean(value));

        let emisorY = bloqueY;
        if (emisorDomicilioLineas.length > 0) {
          setFont(false, 9.5, textColor);
          emisorDomicilioLineas.forEach((linea) => {
            doc.text(linea, emisorX, emisorY, {
              width: colWidth - 8,
              align: 'left',
              lineBreak: false,
            });
            emisorY += 12;
          });
        }

        const drawCompactRows = (title: string, rows: Array<[string, string | null]>, startX: number) => {
          let currentY = bloqueY;
          setFont(true, 10, primaryColor);
          doc.text(title, startX, currentY, { width: colWidth });
          currentY += 16;

          rows.forEach(([label, value]) => {
            const safeValue = value ?? '';
            setFont(true, 8, textColor);
            doc.text(`${label}:`, startX, currentY, { width: labelWidth, align: 'right', lineBreak: false });
            setFont(false, 8, mutedText);
            const textHeight = doc.heightOfString(safeValue, { width: valueWidth });
            doc.text(safeValue, startX + labelWidth + valueGap, currentY, { width: valueWidth, align: 'left' });
            currentY += Math.max(10, textHeight) + rowGap;
          });

          return currentY;
        };

        const receptorY = drawCompactRows('Datos del cliente', receptorRows, receptorX);
        doc.y = Math.max(emisorY, receptorY) + 4;
        return;
      }

      const drawLabelValue = (label: string, value: string | null | undefined, x: number, y: number) => {
        const textValue = value || 'N/D';
        setFont(false, 9, textColor);
        const h = doc.heightOfString(`${label}: ${textValue}`, { width: colWidth });
        doc.text(`${label}: ${textValue}`, x, y, { width: colWidth });
        return h + 4;
      };

      if (esCotizacion) {
        const clienteNombreContacto = documento?.cliente_nombre_contacto || null;
        const clienteEmpresa = documento?.nombre_receptor || documento?.cliente_nombre || null;
        const clienteTelefono = documento?.cliente_telefono || null;
        const clienteEmail = documento?.cliente_email || null;
        const clienteDireccion = documento?.cliente_direccion || null;
        const clienteCiudadEstadoCp = documento?.cliente_ciudad_estado_cp || null;
        const lineHeight = 12;
        const labelColWidth = 80;
        const gapCols = 8;
        const labelX = doc.page.margins.left;
        const valueX = labelX + labelColWidth + gapCols;
        const valueWidth = contentWidth - labelColWidth - gapCols;
        const tableGap = 12;

        // Datos comerciales del cliente: cada renglón solo aparece si el
        // contacto tiene ese dato capturado (no se muestran vacíos ni datos fiscales).
        type ClienteRow = { label: string; value: string; prominent?: boolean };
        const clienteRows: ClienteRow[] = [];
        if (clienteNombreContacto) clienteRows.push({ label: 'Atención', value: clienteNombreContacto, prominent: true });
        if (clienteEmpresa) clienteRows.push({ label: 'Empresa', value: clienteEmpresa, prominent: !clienteNombreContacto });
        if (clienteTelefono) clienteRows.push({ label: 'Teléfono', value: formatTelefonoParaImpresion(clienteTelefono) });
        if (clienteEmail) clienteRows.push({ label: 'Correo', value: clienteEmail });
        if (clienteDireccion) clienteRows.push({ label: 'Dirección', value: clienteDireccion });
        if (clienteCiudadEstadoCp) clienteRows.push({ label: 'Ciudad', value: clienteCiudadEstadoCp });

        let currentY = bloqueY;
        clienteRows.forEach((row) => {
          setFont(false, row.prominent ? 10 : 9, row.prominent ? '#000000' : textColor);
          doc.text(`${row.label}:`, labelX, currentY, { width: labelColWidth, align: 'right' });
          doc.text(row.value, valueX, currentY, { width: valueWidth, align: 'left' });
          const rowHeight = doc.heightOfString(row.value, { width: valueWidth });
          currentY += Math.max(lineHeight, rowHeight);
        });

        doc.y = clienteRows.length ? currentY + tableGap : bloqueY;
        return;
      }

      setFont(true, 11, primaryColor);
      doc.text('Emisor', doc.page.margins.left, bloqueY, { width: colWidth });
      doc.text('Receptor', doc.page.margins.left + colWidth + 12, bloqueY, { width: colWidth });

      let emisorY = bloqueY + 14;
      const nombreFiscalEmisor = empresaInfo?.razonSocial || 'N/D';
      const rfcFiscalEmisor = (estaTimbrado ? timbre?.rfc_emisor : null) || empresaInfo?.rfc || 'N/D';
      emisorY += drawLabelValue('Nombre', nombreFiscalEmisor, doc.page.margins.left, emisorY);
      emisorY += drawLabelValue('RFC', rfcFiscalEmisor, doc.page.margins.left, emisorY);
      emisorY += drawLabelValue('Régimen Fiscal', mapRegimen(empresaInfo?.regimenFiscal), doc.page.margins.left, emisorY);

      let receptorY = bloqueY + 14;
      receptorY += drawLabelValue('Nombre', documento?.nombre_receptor || documento?.cliente_nombre, doc.page.margins.left + colWidth + 12, receptorY);
      receptorY += drawLabelValue('RFC', documento?.rfc_receptor || documento?.cliente_rfc, doc.page.margins.left + colWidth + 12, receptorY);
      receptorY += drawLabelValue('Domicilio Fiscal', documento?.codigo_postal_receptor, doc.page.margins.left + colWidth + 12, receptorY);
      receptorY += drawLabelValue('Régimen Fiscal', mapRegimen(documento?.regimen_fiscal_receptor), doc.page.margins.left + colWidth + 12, receptorY);

      doc.y = Math.max(emisorY, receptorY) + 6;
      doc.moveDown(0.4);
    };

    const renderPartidas = async () => {
      // Tabla de partidas (sin título "Partidas")
      // La visibilidad de observaciones de partida la decide exclusivamente el
      // layout configurado (Formatos de impresión), no el tipo de documento:
      // factura hereda mostrarObservacionesPartida=false por defecto
      // (DOCUMENT_LAYOUTS) pero puede activarse por empresa o por serie.
      const showObservaciones = layout.mostrarObservacionesPartida === true;
      // Compatibilidad: las configuraciones históricas no contienen esta
      // propiedad y deben conservar la impresión vigente de especificaciones.
      const showEspecificaciones = layout.mostrarEspecificacionesPartida !== false;
      console.info('[pdf] Decisión de impresión de observaciones de partida', {
        documentoId: documento?.id,
        tipoDocumento: documento?.tipo_documento,
        serie: documento?.serie ?? null,
        mostrarObservacionesPartida: layout.mostrarObservacionesPartida,
        showObservaciones,
      });
      console.info('[pdf] Decisión de impresión de especificaciones de partida', {
        documentoId: documento?.id,
        tipoDocumento: documento?.tipo_documento,
        serie: documento?.serie ?? null,
        mostrarEspecificacionesPartida: layout.mostrarEspecificacionesPartida,
        showEspecificaciones,
      });
      const observacionesFontSize = 8;
      const observacionesPadding = 3;
      const observacionesRichTextFonts = {
        regular: hasTrebuchet ? 'Trebuchet' : 'Helvetica',
        bold: hasTrebuchetBold ? 'Trebuchet-Bold' : 'Helvetica-Bold',
        italic: hasTrebuchetItalic ? 'Trebuchet-Italic' : 'Helvetica-Oblique',
      };
      // Campos configurables de partida: misma familia tipográfica que
      // observaciones (tamaño secundario), con la etiqueta en negrita para
      // diferenciarla visualmente del valor.
      const camposConfigurablesFontSize = 8;
      const camposConfigurablesLineHeight = 11;
      const camposConfigurablesGap = 14;
      const camposConfigurablesPaddingTop = 3;
      const camposConfigurablesOpciones = {
        fontSize: camposConfigurablesFontSize,
        gap: camposConfigurablesGap,
        lineHeight: camposConfigurablesLineHeight,
        fontRegular: observacionesRichTextFonts.regular,
        fontBold: observacionesRichTextFonts.bold,
        color: mutedText,
      };
      // La impresión ya no optimiza imágenes: solo localiza la versión
      // optimizada persistente (generada al subir la imagen o, para
      // imágenes ya existentes, en su primera impresión) y la lee del disco.
      // Sharp/compresión viven exclusivamente en pdfPreviewImage.service.ts.
      //
      // Cachea el buffer ya leído por URL normalizada, para no releer el
      // mismo archivo del disco si varias partidas usan la misma imagen
      // dentro de este mismo documento.
      const imageCache = new Map<string, Buffer | null>();

      const getPartidaImageBuffer = async (imageUrl?: string | null) => {
        const normalizedUrl = resolvePublicUrl(imageUrl);
        if (!imagenPartidaVisible || !normalizedUrl) return null;
        if (imageCache.has(normalizedUrl)) return imageCache.get(normalizedUrl) ?? null;

        try {
          const rutaOptimizada = await obtenerRutaPdfPreview(normalizedUrl);
          if (!rutaOptimizada) {
            imageCache.set(normalizedUrl, null);
            return null;
          }

          const buffer = await fs.promises.readFile(rutaOptimizada);
          imageCache.set(normalizedUrl, buffer);
          return buffer;
        } catch (error) {
          // Continúa sin imagen en vez de romper el PDF completo.
          console.warn('[pdf] No se pudo obtener la imagen optimizada de partida, se omite', {
            documentoId: documento?.id ?? null,
            imageUrl: normalizedUrl,
            error: (error as Error)?.message ?? error,
          });
          imageCache.set(normalizedUrl, null);
          return null;
        }
      };

      const getPartidaImageBufferFromPartida = async (partida: PartidaCotizacion) => {
        if (partida.archivo_imagen_1?.trim()) {
          return getPartidaImageBuffer(partida.archivo_imagen_1);
        }

        const productoArchivoUrl = await getProductoArchivoUrl(partida.producto_archivo_id ?? null, empresaId);
        return getPartidaImageBuffer(productoArchivoUrl);
      };

      const computeRowMetrics = (
        values: string[],
        observaciones?: string | null,
        hasImage = false,
        camposConfigurablesPartida: CampoConfigurablePartidaValor[] = [],
        especificaciones: Array<{ contenido: string; orden: number }> = [],
      ) => {
        const baseRowHeight = 17;
        const bodyPaddingY = 4;
        setFont(false, 9, mutedText);
        const textHeights = values.map((text, idx) =>
          doc.heightOfString(text, { width: columnWidths[idx] - 12 })
        );
        const maxTextHeight = Math.max(...textHeights, 9);
        const descriptionHeight = doc.heightOfString(values[descripcionIndex] || '', {
          width: columnWidths[descripcionIndex] - 12,
        });

        const { altura: camposConfigAltura, lineas: camposConfigLineas } = camposConfigurablesPartida.length
          ? calcularAlturaCamposConfigurablesPartida(doc, camposConfigurablesPartida, {
              width: columnWidths[descripcionIndex] - 12,
              ...camposConfigurablesOpciones,
            })
          : { altura: 0, lineas: [] as CampoConfigurablePartidaValor[][] };
        const camposConfigBlockHeight = camposConfigAltura ? camposConfigAltura + camposConfigurablesPaddingTop : 0;
        const especificacionesTexto = showEspecificaciones
          ? [...especificaciones].sort((a, b) => a.orden - b.orden).map((e) => `• ${e.contenido}`).join('\n')
          : '';
        const especificacionesHeight = especificacionesTexto
          ? doc.heightOfString(especificacionesTexto, { width: columnWidths[descripcionIndex] - 12, lineGap: 1 }) + 3
          : 0;

        const obsHtml = observaciones ?? '';
        const obsText = showObservaciones && !richTextBasicoEstaVacio(obsHtml) ? obsHtml : '';
        let obsHeight = 0;
        if (obsText) {
          obsHeight = heightOfRichTextBasicoPdf(doc, obsText, {
            width: columnWidths[descripcionIndex] - 12,
            fontSize: observacionesFontSize,
            fonts: observacionesRichTextFonts,
          });
        }

        const textBlockHeight = Math.max(baseRowHeight, maxTextHeight + bodyPaddingY * 2) + especificacionesHeight + camposConfigBlockHeight + (obsHeight ? obsHeight + observacionesPadding : 0);
        const imageBlockHeight = hasImage && !imagenPartidaEnColumna ? imagenPartidaHeight + imagenPartidaGap : 0;
        const imageColumnMinHeight = hasImage && imagenPartidaEnColumna ? imagenPartidaHeight + bodyPaddingY * 2 : 0;
        const rowHeight = Math.max(
          textBlockHeight,
          descriptionHeight + bodyPaddingY * 2 + especificacionesHeight + camposConfigBlockHeight + (obsHeight ? obsHeight + observacionesPadding : 0) + imageBlockHeight,
          imageColumnMinHeight,
        );

        return { rowHeight, bodyPaddingY, descriptionHeight, obsHeight, obsText, imageBlockHeight, camposConfigBlockHeight, camposConfigLineas, especificacionesTexto, especificacionesHeight };
      };

      const drawRow = (
        values: string[],
        y: number,
        isHeader = false,
        observaciones?: string | null,
        imageBuffer?: Buffer | null,
        camposConfigurablesPartida: CampoConfigurablePartidaValor[] = [],
        especificaciones: Array<{ contenido: string; orden: number }> = [],
      ) => {
        const baseRowHeight = isHeader ? 20 : 17;
        const bodyPaddingY = 4;
        let rowHeight = baseRowHeight;
        const rowWidth = columnWidths.reduce((acc, w) => acc + w, 0);

        let descriptionHeight = 0;
        let obsHeight = 0;
        let obsText = '';
        let camposConfigBlockHeight = 0;
        let camposConfigLineas: CampoConfigurablePartidaValor[][] = [];
        let especificacionesTexto = '';
        let especificacionesHeight = 0;
        if (!isHeader) {
          const metrics = computeRowMetrics(values, observaciones, Boolean(imageBuffer), camposConfigurablesPartida, especificaciones);
          rowHeight = metrics.rowHeight;
          descriptionHeight = metrics.descriptionHeight;
          obsHeight = metrics.obsHeight;
          obsText = metrics.obsText;
          camposConfigBlockHeight = metrics.camposConfigBlockHeight;
          camposConfigLineas = metrics.camposConfigLineas;
          especificacionesTexto = metrics.especificacionesTexto;
          especificacionesHeight = metrics.especificacionesHeight;
        }

        if (isHeader) {
          const colorTablaHeader = normalizarColorHex(layout.colorTablaHeader) ?? primaryColor;
          doc.rect(startX, y, rowWidth, rowHeight).fill(colorTablaHeader);
        }

        doc.save();
        const headerFontSize = 9;
        let headerTextY = y + 6;
        if (isHeader) {
          setFont(true, headerFontSize, '#ffffff');
          const headerTextHeight = doc.heightOfString('Ay', { width: columnWidths[0] - 12 });
          headerTextY = y + (rowHeight - headerTextHeight) / 2;
        }
        values.forEach((text, idx) => {
          const x = startX + columnWidths.slice(0, idx).reduce((acc, w) => acc + w, 0) + 6;
          const textY = isHeader ? headerTextY : y + bodyPaddingY;
          const esColumnaImagenHeader = isHeader && imagenPartidaEnColumna && idx === imagenColumnIndex;
          const align = esColumnaImagenHeader ? 'center' : idx === descripcionIndex ? 'left' : 'right';
          const colWidth = columnWidths[idx] - 12;

          if (!isHeader && imagenPartidaEnColumna && idx === descripcionIndex && text.includes('\n')) {
            const separatorIdx = text.indexOf('\n');
            const claveText = text.slice(0, separatorIdx);
            const descText = text.slice(separatorIdx + 1);
            setFont(true, 9, mutedText);
            doc.text(claveText, x, textY, { width: colWidth, align: 'left' });
            const claveHeight = doc.heightOfString(claveText, { width: colWidth });
            setFont(false, 9, mutedText);
            doc.text(descText, x, textY + claveHeight, { width: colWidth, align: 'left' });
            return;
          }

          setFont(isHeader, isHeader ? headerFontSize : 9, isHeader ? '#ffffff' : mutedText);
          doc.text(text, x, textY, { width: colWidth, align });
        });

        if (!isHeader && especificacionesTexto) {
          const descX = startX + columnWidths.slice(0, descripcionIndex).reduce((acc, w) => acc + w, 0) + 6;
          setFont(false, observacionesFontSize, mutedText);
          doc.text(especificacionesTexto, descX, y + bodyPaddingY + descriptionHeight + 3, { width: columnWidths[descripcionIndex] - 12, lineGap: 1 });
        }

        if (!isHeader && camposConfigLineas.length > 0) {
          const descX = startX + columnWidths.slice(0, descripcionIndex).reduce((acc, w) => acc + w, 0) + 6;
          const camposConfigY = y + bodyPaddingY + descriptionHeight + especificacionesHeight;
          renderCamposConfigurablesPartida(doc, camposConfigLineas, descX, camposConfigY, {
            width: columnWidths[descripcionIndex] - 12,
            ...camposConfigurablesOpciones,
          });
        }

        if (!isHeader && obsHeight > 0 && obsText) {
          const descX = startX + columnWidths.slice(0, descripcionIndex).reduce((acc, w) => acc + w, 0) + 6;
          const obsY = y + bodyPaddingY + descriptionHeight + especificacionesHeight + camposConfigBlockHeight + observacionesPadding;
          renderRichTextBasicoPdf(doc, obsText, descX, obsY, {
            width: columnWidths[descripcionIndex] - 12,
            fontSize: observacionesFontSize,
            fonts: observacionesRichTextFonts,
            color: mutedText,
          });
        }

        if (!isHeader && imageBuffer && imagenPartidaEnColumna && imagenColumnIndex !== null) {
          const imagePaddingX = 10;
          const colX = startX + columnWidths.slice(0, imagenColumnIndex).reduce((acc, w) => acc + w, 0);
          const colWidth = columnWidths[imagenColumnIndex];
          const extraVerticalSpace = Math.max(0, rowHeight - bodyPaddingY * 2 - imagenPartidaHeight);
          const imageY = y + bodyPaddingY + extraVerticalSpace / 2;
          try {
            doc.image(imageBuffer, colX + imagePaddingX, imageY, {
              fit: [colWidth - imagePaddingX * 2, imagenPartidaHeight],
              align: 'center',
              valign: 'center',
            });
          } catch (error) {
            console.warn('[pdf] No se pudo renderizar imagen de partida en columna', {
              documentoId: documento?.id ?? null,
              error: (error as Error)?.message ?? error,
            });
          }
        } else if (!isHeader && imageBuffer && !imagenPartidaEnColumna) {
          const descX = startX + columnWidths.slice(0, descripcionIndex).reduce((acc, w) => acc + w, 0) + 6;
          const imageY = y + bodyPaddingY + descriptionHeight + especificacionesHeight + camposConfigBlockHeight + (obsHeight > 0 && obsText ? obsHeight + observacionesPadding : 0) + imagenPartidaGap;
          const imageWidth = columnWidths[descripcionIndex] - 12;
          const imageFit: [number, number] = maxAnchoImagenPartida !== null
            ? [maxAnchoImagenPartida, imagenPartidaHeight]
            : [imageWidth, imagenPartidaHeight];
          try {
            doc.image(imageBuffer, descX, imageY, {
              fit: imageFit,
            });
          } catch (error) {
            console.warn('[pdf] No se pudo renderizar imagen de partida', {
              documentoId: documento?.id ?? null,
              error: (error as Error)?.message ?? error,
            });
          }
        }
        doc.restore();
        return y + rowHeight;
      };

      const pageBottom = doc.page.height - doc.page.margins.bottom;
      let currentY = doc.y;

      currentY = drawRow(headers, currentY, true);

      for (const p of partidas) {
        const cantidad = Number(p.cantidad ?? 0);
        const precioUnitario = Number(p.precio_unitario ?? 0);
        const subtotalNeto = Number(p.subtotal_partida ?? 0);
        const subtotalBruto = cantidad * precioUnitario;
        const descuento = Math.max(0, subtotalBruto - subtotalNeto);
        const descripcionPartida = obtenerDescripcionPartidaPdf(p as PartidaCotizacion);
        const values = esTraslado
          ? [p.producto_clave || '', descripcionPartida, cantidad.toFixed(2)]
          : imagenPartidaEnColumna
          ? [
              '', // Imagen: se dibuja aparte, no como texto
              esNotaCreditoComercial
                ? descripcionPartida
                : (p.producto_clave ? `${p.producto_clave}\n${descripcionPartida}` : descripcionPartida),
              cantidad.toFixed(2),
              formatCurrency(precioUnitario),
              formatCurrency(descuento),
              formatCurrency(subtotalNeto),
            ]
          : esNotaCreditoComercial
          ? [
              descripcionPartida,
              cantidad.toFixed(2),
              formatCurrency(precioUnitario),
              formatCurrency(descuento),
              formatCurrency(subtotalNeto),
            ]
          : [
              p.producto_clave || '',
              descripcionPartida,
              cantidad.toFixed(2),
              formatCurrency(precioUnitario),
              formatCurrency(descuento),
              formatCurrency(subtotalNeto),
            ];
        const imageBuffer = await getPartidaImageBufferFromPartida(p as PartidaCotizacion);
        const partidaId = Number((p as PartidaCotizacion)?.id);
        const camposConfigurablesPartida = mostrarCamposConfigurablesPartida && Number.isFinite(partidaId)
          ? camposConfigurablesPorPartidaId.get(partidaId) ?? []
          : [];
        const metrics = computeRowMetrics(
          values,
          (p as PartidaCotizacion).observaciones ?? null,
          Boolean(imageBuffer),
          camposConfigurablesPartida,
          (p as PartidaCotizacion).especificaciones ?? [],
        );
        const rowHeight = metrics.rowHeight;

        if (currentY + rowHeight > pageBottom) {
          doc.addPage();
          currentY = doc.page.margins.top;
        }

        currentY = drawRow(
          values,
          currentY,
          false,
          (p as PartidaCotizacion).observaciones ?? null,
          imageBuffer,
          camposConfigurablesPartida,
          (p as PartidaCotizacion).especificaciones ?? [],
        );
      }

      doc.y = currentY;
      doc.moveDown(0.5);
    };

    const renderTotales = () => {
      console.log('[PDF DEBUG]', {
        bloque: 'renderTotales:inicio',
        y: doc.y,
        pageHeight: doc.page.height,
        estaTimbrado,
      });
      const ocultarIvaPorTratamiento = String(documento?.tratamiento_impuestos ?? 'normal').toLowerCase() === 'sin_iva';
      // Totales se renderizarán en el pie de página
      const totalRows: Array<[string, number | null | undefined]> = esTraslado
        ? [
          ['Subtotal', Number(documento?.subtotal ?? 0)],
          ['Total', Number(documento?.total ?? 0)],
        ]
        : [
          ['Subtotal bruto', subtotalBrutoDocumento],
          ['Descuentos', descuentoTotalDocumento],
          ['Subtotal neto', subtotalNetoDocumento],
          ...(ocultarIvaPorTratamiento ? [] : [
            ['IVA trasladado', documento?.iva] as [string, number | null | undefined],
            ...(retencionesDocumento > 0
              ? [['Retenciones', -retencionesDocumento] as [string, number | null | undefined]]
              : []),
            ...impuestosAdicionalesDocumento.map((impuesto) => [impuesto.nombre, impuesto.monto] as [string, number]),
          ]),
          ['Total', documento?.total],
        ];

      doc.moveDown(0.4);

      // Observaciones (antes de reservar espacio del pie)
      const qrWidth = 110;
      const textoWidthBase = qrBuffer ? contentWidth - qrWidth - 24 : contentWidth;
      const pageBottom = doc.page.height - doc.page.margins.bottom;
      const footerBottomMargin = doc.page.margins.bottom;

      const calcularAlturaPie = () => {
        if (!estaTimbrado) return 50; // margen de seguridad mínimo cuando no hay timbre

        const textoLargo: Array<[string, string, number]> = [
          ['Cadena original del complemento', timbre?.cadena_original || 'N/D', 7],
          ['Sello digital del CFDI', timbre?.sello_cfdi || 'N/D', 6],
          ['Sello del SAT', timbre?.sello_sat || 'N/D', 6],
        ];

        let hIzq = 0;
        const gapCols = 12;
        const totalsLabelWidth = 96;
        const totalsValueWidth = 90;
        const totalsWidth = totalsLabelWidth + totalsValueWidth;
        const textoWidth = contentWidth - totalsWidth - gapCols;
        const rowHeightCompact = 12;
        const totalsPaddingY = 8;
        const qrGap = 10;
        const qrWidthAdjusted = qrBuffer ? Math.min(qrWidth, 85) : 0;

        textoLargo.forEach(([label, value, size]) => {
          setFont(true, 8, textColor);
          hIzq += doc.heightOfString(`${label}:`, { width: textoWidth });
          setFont(false, size, mutedText);
          hIzq += doc.heightOfString(value, { width: textoWidth, lineGap: 0 });
          hIzq += 2; // espaciado corto para bloque CFDI largo
        });

        const totalsHeight = totalRows.length * rowHeightCompact;

        const alturaDerecha = totalsHeight + (totalsPaddingY * 2) + (qrBuffer ? qrGap + qrWidthAdjusted : 0);

        const padding = 0; // no hay padding inferior renderizado en el bloque final
        const topOffset = 8; // desplazamiento usado al comenzar el footer (doc.y = footerY + 8)

        const alturaTotalBloque = Math.max(hIzq, alturaDerecha);

        console.log('[PDF DEBUG]', {
          bloque: 'renderTotales:componentesFooter',
          y: doc.y,
          pageHeight: doc.page.height,
          bottomMargin: footerBottomMargin,
          hIzq,
          alturaDerecha,
          qrHeight: qrWidthAdjusted,
          totalsHeight,
          padding,
          topOffset,
          alturaTotalBloque,
          estaTimbrado,
        });

        return alturaTotalBloque + padding + topOffset;
      };

  const footerHeight = estaTimbrado ? calcularAlturaPie() : 0;
  const footerTop = estaTimbrado ? doc.page.height - footerBottomMargin - footerHeight : pageBottom;

      console.log('[PDF DEBUG]', {
        bloque: 'renderTotales:calculoFooter',
        y: doc.y,
        pageHeight: doc.page.height,
        footerHeight,
        footerTop,
        estaTimbrado,
      });

      if (documento?.observaciones && !esCotizacion) {
        const obsWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const obsHeight = doc.heightOfString(documento.observaciones, { width: obsWidth }) + (esOrdenServicio ? 18 : 28);
        console.log('[PDF DEBUG]', {
          bloque: 'observaciones:antesEvaluar',
          y: doc.y,
          pageHeight: doc.page.height,
          obsHeight,
          footerTop,
          estaTimbrado,
        });
        if (doc.y + obsHeight > footerTop - 6) {
          console.log('[PDF DEBUG]', {
            bloque: 'observaciones:addPage',
            y: doc.y,
            pageHeight: doc.page.height,
            accion: 'doc.addPage',
            estaTimbrado,
          });
          doc.addPage();
        }
        doc.moveDown(0.6);
        drawSectionHeader('Observaciones');
        setFont(false, 10, mutedText);
        doc.text(documento.observaciones, { width: obsWidth });
        doc.moveDown(0.6);
      }

      if (esCotizacion || esOrdenServicio) {
        const totalsLabelWidth = 96;
        const totalsValueWidth = 90;
        const rowHeightCompact = 12;
        const totalsPaddingX = 12;
        const totalsPaddingY = 8;
        const totalsInnerGap = 8;
        const totalsRightExtra = 12;
        const totalsHeight = totalRows.length * rowHeightCompact + totalsPaddingY * 2;
        const gapBottom = esOrdenServicio ? 10 : 14;
        const bloqueHeight = totalsHeight;

        // Condiciones de impresión de la serie: se reserva el espacio de pie
        // de página necesario ANTES de anclar los recuadros de Observaciones
        // y Totales, para que el bloque quede debajo de ambos en la misma página.
        // Usa un margen inferior propio (más breve que el margen general del
        // documento) y espaciado compacto tipo "letra pequeña legal".
        const condicionesFonts = { regular: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique' };
        const condicionesColor = '#6b7280';
        const condicionesBottomMargin = 20;
        const condicionesGapTop = 6;
        const condicionesTitleGap = 2;
        const condicionesBottomPadding = 3;
        const condicionesParagraphSpacing = 1.5;
        const condicionesListItemSpacing = 1;
        const condicionesMaxReserved = 110;
        const condicionesFontTiers = [7, 6.5, 6];
        const condicionesActivo =
          esCotizacion && !!condicionesImpresionSerie && !richTextBasicoEstaVacio(condicionesImpresionSerie);

        let condicionesTituloHeight = 0;
        let condicionesTextHeight = 0;
        let condicionesFontSize = condicionesFontTiers[condicionesFontTiers.length - 1];
        let condicionesReservedHeight = 0;

        if (condicionesActivo) {
          setFont(true, 7, textColor);
          condicionesTituloHeight = doc.heightOfString('CONDICIONES', { width: contentWidth });

          for (const size of condicionesFontTiers) {
            const altura = heightOfRichTextBasicoPdf(doc, condicionesImpresionSerie as string, {
              width: contentWidth,
              fontSize: size,
              fonts: condicionesFonts,
              paragraphSpacing: condicionesParagraphSpacing,
              listItemSpacing: condicionesListItemSpacing,
            });
            condicionesFontSize = size;
            condicionesTextHeight = altura;
            if (condicionesTituloHeight + condicionesTitleGap + altura <= condicionesMaxReserved) {
              break;
            }
          }

          const bloqueCondicionesSinRecortar = condicionesTituloHeight + condicionesTitleGap + condicionesTextHeight;
          condicionesReservedHeight = Math.min(bloqueCondicionesSinRecortar, condicionesMaxReserved) + condicionesBottomPadding;
        }

        const condicionesReserva = condicionesActivo ? condicionesGapTop + condicionesReservedHeight : 0;
        const anchorY = condicionesActivo
          ? doc.page.height - condicionesBottomMargin - bloqueHeight - condicionesReserva
          : pageBottom - gapBottom - bloqueHeight;
        const totalsAmountRightX = startX + columnWidths.reduce((acc, width) => acc + width, 0);
        const totalsPanelRightX = totalsAmountRightX + totalsRightExtra;
        const totalsPanelWidth = totalsPaddingX + totalsLabelWidth + totalsInnerGap + totalsValueWidth + totalsRightExtra;
        const totalsPanelLeftX = totalsPanelRightX - totalsPanelWidth;

        if (doc.y + bloqueHeight > anchorY) {
          doc.addPage();
        }

        if (esCotizacion && documento?.observaciones) {
          const obsGap = 16;
          const obsPaddingX = 10;
          const obsPaddingY = 8;
          const obsTitleGap = 4;
          const obsLeftX = startX;
          const obsTopY = anchorY - 4;
          const obsWidth = totalsPanelLeftX - obsGap - obsLeftX;

          if (obsWidth > 40) {
            const obsInnerWidth = obsWidth - obsPaddingX * 2;
            setFont(true, 8, textColor);
            const obsTitleHeight = doc.heightOfString('OBSERVACIONES', { width: obsInnerWidth });
            const obsAvailableHeight = totalsHeight - obsPaddingY * 2 - obsTitleHeight - obsTitleGap;

            const obsFontTiers = [9, 8, 7, 6];
            let obsFontSize = obsFontTiers[obsFontTiers.length - 1];
            for (const size of obsFontTiers) {
              setFont(false, size, mutedText);
              if (doc.heightOfString(documento.observaciones, { width: obsInnerWidth }) <= obsAvailableHeight) {
                obsFontSize = size;
                break;
              }
            }

            doc
              .roundedRect(obsLeftX, obsTopY, obsWidth, totalsHeight, 5)
              .fillAndStroke('#f3f4f6', '#e5e7eb');

            setFont(true, 8, textColor);
            doc.text('OBSERVACIONES', obsLeftX + obsPaddingX, obsTopY + obsPaddingY, { width: obsInnerWidth });

            setFont(false, obsFontSize, mutedText);
            doc.text(documento.observaciones, obsLeftX + obsPaddingX, obsTopY + obsPaddingY + obsTitleHeight + obsTitleGap, {
              width: obsInnerWidth,
              height: obsAvailableHeight,
              ellipsis: true,
            });
          }
        }

        doc
          .roundedRect(totalsPanelLeftX, anchorY - 4, totalsPanelWidth, totalsHeight, 5)
          .fillAndStroke('#f3f4f6', '#e5e7eb');

        let totY = anchorY + totalsPaddingY - 4;
        totalRows.forEach(([label, value]) => {
          const isTotal = label === 'Total';
          setFont(isTotal, isTotal && esOrdenServicio ? 10 : 9, textColor);

          const importeX = totalsAmountRightX - totalsValueWidth;
          const gapLabelValor = totalsInnerGap;
          const labelRight = importeX - gapLabelValor;
          const labelX = labelRight - totalsLabelWidth;

          doc.text(label.toUpperCase(), labelX, totY, { width: totalsLabelWidth, align: 'right' });
          doc.text(formatCurrency(value), importeX, totY, {
            width: totalsValueWidth,
            align: 'right',
          });
          totY += rowHeightCompact;
        });

        if (condicionesActivo) {
          const boxBottomY = anchorY - 4 + totalsHeight;
          const condicionesY = boxBottomY + condicionesGapTop;
          const condicionesTextY = condicionesY + condicionesTituloHeight + condicionesTitleGap;
          const condicionesLimiteY = doc.page.height - condicionesBottomMargin;
          const clipHeight = condicionesMaxReserved - condicionesTituloHeight - condicionesTitleGap;
          const necesitaRecorte = condicionesTextHeight > clipHeight;

          setFont(true, 7, textColor);
          // Se acota `height` explícitamente: el margen inferior reducido de este
          // bloque queda por debajo del margen general del documento (40pt), y sin
          // este límite PDFKit insertaría una página nueva al detectar "desborde".
          doc.text('CONDICIONES', startX, condicionesY, {
            width: contentWidth,
            height: Math.max(condicionesLimiteY - condicionesY, 1),
          });

          if (necesitaRecorte) {
            // Último recurso: si el texto no cabe ni con la fuente más pequeña,
            // se recorta visualmente sin romper el layout ni desbordar la página.
            doc.save();
            doc.rect(startX, condicionesTextY, contentWidth, Math.max(clipHeight, 0)).clip();
          }

          renderRichTextBasicoPdf(doc, condicionesImpresionSerie as string, startX, condicionesTextY, {
            width: contentWidth,
            fontSize: condicionesFontSize,
            fonts: condicionesFonts,
            color: condicionesColor,
            paragraphSpacing: condicionesParagraphSpacing,
            listItemSpacing: condicionesListItemSpacing,
            // Red de seguridad: nunca debe insertar páginas nuevas por desbordamiento.
            maxY: condicionesLimiteY,
          });

          if (necesitaRecorte) {
            doc.restore();
          }

          doc.y = condicionesY + condicionesReservedHeight;
        } else {
          doc.y = totY;
        }
        return;
      }

      // Pie fijo timbrado CFDI anclado al borde inferior
      const necesitaNuevaPagina = estaTimbrado && doc.y > footerTop;
      console.log('[PDF DEBUG]', {
        bloque: 'footer:antesEvaluar',
        y: doc.y,
        pageHeight: doc.page.height,
        bottomMargin: footerBottomMargin,
        footerHeight,
        footerTop,
        necesitaNuevaPagina,
        estaTimbrado,
      });
      if (necesitaNuevaPagina) {
        console.log('[PDF DEBUG]', {
          bloque: 'footer:addPage',
          y: doc.y,
          pageHeight: doc.page.height,
          accion: 'doc.addPage',
          estaTimbrado,
        });
        doc.addPage();
      }

      const footerY = doc.page.height - footerBottomMargin - footerHeight;
      if (estaTimbrado) {
        doc.y = footerY + 8;
      }

      console.log('[PDF DEBUG]', {
        bloque: 'footer:antesRender',
        y: doc.y,
        pageHeight: doc.page.height,
        estaTimbrado,
        accion: estaTimbrado ? 'render timbrado' : 'render borrador',
      });

      if (!estaTimbrado) {
        const rowHeightCompact = 12;
        const totalsPaddingX = 12;
        const totalsPaddingY = 8;
        const totalsInnerGap = 8;
        const totalsLabelWidth = 96;
        const totalsValueWidth = 90;
        const totalsPanelWidth = totalsPaddingX + totalsLabelWidth + totalsInnerGap + totalsValueWidth;
        const totalsPanelHeight = totalRows.length * rowHeightCompact + totalsPaddingY * 2;
        const totalsPanelRightX = startX + columnWidths.reduce((acc, width) => acc + width, 0);
        const totalsPanelLeftX = totalsPanelRightX - totalsPanelWidth;
        const requiredHeight = totalsPanelHeight + 28;

        if (doc.y + requiredHeight > pageBottom) {
          doc.addPage();
        }

        const panelY = pageBottom - requiredHeight;
        doc
          .roundedRect(totalsPanelLeftX, panelY, totalsPanelWidth, totalsPanelHeight, 5)
          .fillAndStroke('#f3f4f6', '#e5e7eb');

        let totY = panelY + totalsPaddingY;
        totalRows.forEach(([label, value]) => {
          const isTotal = label === 'Total';
          setFont(isTotal, 9, textColor);
          const importeX = totalsPanelRightX - totalsValueWidth;
          const labelRight = importeX - totalsInnerGap;
          const labelX = labelRight - totalsLabelWidth;
          doc.text(label.toUpperCase(), labelX, totY, { width: totalsLabelWidth, align: 'right', lineBreak: false });
          doc.text(formatCurrency(value), importeX, totY, { width: totalsValueWidth, align: 'right', lineBreak: false });
          totY += rowHeightCompact;
        });

        setFont(true, 9, mutedText);
        doc.text(`Estatus: ${formatEstatusDocumento(documento?.estatus_documento)}`, totalsPanelLeftX, panelY + totalsPanelHeight + 6, {
          width: totalsPanelWidth,
          align: 'right',
          lineBreak: false,
        });
        doc.y = panelY + requiredHeight;
      } else {
        const startYTimbrado = doc.y;
        const gapCols = 12;
        const totalsLabelWidth = 96;
        const totalsValueWidth = 90;
        const totalsWidth = totalsLabelWidth + totalsValueWidth;
        const colLeftX = doc.page.margins.left;
        const textoWidth = contentWidth - totalsWidth - gapCols;
        const colRightX = colLeftX + textoWidth + gapCols;
        let selloCfdiEndY = startYTimbrado;

        // Columna izquierda: cadena y sellos
        const textoLargo: Array<[string, string, number]> = [
          ['Cadena original del complemento', timbre?.cadena_original || 'N/D', 7],
          ['Sello digital del CFDI', timbre?.sello_cfdi || 'N/D', 6],
          ['Sello del SAT', timbre?.sello_sat || 'N/D', 6],
        ];

        textoLargo.forEach(([label, value, size]) => {
          setFont(true, 8, textColor);
          doc.text(`${label}:`, colLeftX, doc.y, { width: textoWidth });
          setFont(false, size, mutedText);
          doc.text(value, {
            width: textoWidth,
            lineGap: 0,
          });
          if (label === 'Sello digital del CFDI') {
            selloCfdiEndY = doc.y;
          }
          doc.moveDown(0.15);
        });

        setFont(false, 8, mutedText);
        doc.text('**Este documento es una representación impresa de un CFDI**', colLeftX, doc.y, {
          width: textoWidth,
          align: 'left',
        });
        doc.moveDown(0.15);

        // Columna derecha: Subtotal bruto / descuentos / neto / IVA / total compactos
        let totY = startYTimbrado;
        const rowHeightCompact = 12;
        const totalsPaddingX = 12;
        const totalsPaddingY = 8;
        const totalsInnerGap = 8;
        const totalsPanelRightX = startX + columnWidths.reduce((acc, width) => acc + width, 0);
        const totalsPanelWidth = totalsPaddingX + totalsLabelWidth + totalsInnerGap + totalsValueWidth;
        const totalsPanelLeftX = totalsPanelRightX - totalsPanelWidth;
        const totalsPanelHeight = totalRows.length * rowHeightCompact + totalsPaddingY * 2;

        doc
          .roundedRect(totalsPanelLeftX, startYTimbrado - 4, totalsPanelWidth, totalsPanelHeight, 5)
          .fillAndStroke('#f3f4f6', '#e5e7eb');

        totY = startYTimbrado + totalsPaddingY - 4;
        totalRows.forEach(([label, value]) => {
          const isTotal = label === 'Total';
          setFont(isTotal, 9, textColor); // mismo tamaño para TOTAL, mantiene negritas

          const importeX = totalsPanelRightX - totalsValueWidth;
          const gapLabelValor = totalsInnerGap; // mantiene el monto alineado al borde derecho de la tabla
          const labelRight = importeX - gapLabelValor;
          const labelX = labelRight - totalsLabelWidth;

          doc.text(label.toUpperCase(), labelX, totY, { width: totalsLabelWidth, align: 'right' });
          doc.text(formatCurrency(value), importeX, totY, {
            width: totalsValueWidth,
            align: 'right',
          });
          totY += rowHeightCompact;
        });

        // QR debajo de los totales
        if (qrBuffer) {
          const qrWidthAdjusted = Math.min(qrWidth, 85); // ~10-15% más pequeño
          const qrX = doc.page.width - doc.page.margins.right - qrWidthAdjusted; // alinea borde derecho con margen
          const qrY = totY + 10; // más espacio vertical respecto al TOTAL
          doc.image(qrBuffer, qrX, qrY, { width: qrWidthAdjusted });
          totY = qrY + qrWidthAdjusted;
        }

      }
    };

    void (async () => {
      if (layout.mostrarHeader) {
        renderHeader();
      }

      if (layout.mostrarCliente) {
        renderCliente();
      }

      renderMotivoNotaCredito();

      if (layout.mostrarPartidas) {
        await renderPartidas();
      }

      if (layout.mostrarTotales) {
        renderTotales();
      }

      doc.end();
    })().catch(reject);
  });
  } catch (error) {
    console.error('[pdf] Error al generar PDF', {
      documentoId: documento?.id,
      tipoDocumento: documento?.tipo_documento,
      empresaId,
      hasPartidas: Boolean(partidas?.length),
      error: (error as Error)?.message,
      stack: (error as Error)?.stack,
    });
    throw error;
  }
}
