import path from 'path';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import { generarImagenQR, DatosQrCfdi } from '../../utils/generarCadenaQR';

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
};

type DocumentoCotizacion = {
  id?: number;
  tipo_documento?: string | null;
  serie?: string | null;
  numero?: number | null;
  fecha_documento?: string | null;
  cliente_nombre?: string | null;
  cliente_email?: string | null;
  cliente_rfc?: string | null;
  rfc_receptor?: string | null;
  cliente_direccion?: string | null;
  uso_cfdi?: string | null;
  regimen_fiscal_receptor?: string | null;
  forma_pago?: string | null;
  metodo_pago?: string | null;
  codigo_postal_receptor?: string | null;
  nombre_receptor?: string | null;
  observaciones?: string | null;
  total?: number | null;
  subtotal?: number | null;
  iva?: number | null;
  timbre?: TimbreCfdi | null;
};

type PartidaCotizacion = {
  producto_clave?: string | null;
  descripcion_alterna?: string | null;
  cantidad?: number | null;
  precio_unitario?: number | null;
  subtotal_partida?: number | null;
};

type DataCotizacion = {
  documento?: DocumentoCotizacion;
  partidas: PartidaCotizacion[];
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
  };
  return code ? map[code] || code : 'N/D';
};

const tituloPorTipo = (tipo: string | null | undefined) => {
  const t = (tipo || '').toString().toLowerCase();
  if (t === 'factura') return 'FACTURA';
  if (t === 'pedido') return 'PEDIDO';
  if (t === 'remision') return 'REMISIÓN';
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

export async function generarDocumentoPDF(data: DataCotizacion): Promise<Buffer> {
  const { documento, partidas } = data;
  const timbre = documento?.timbre;

  let qrBuffer: Buffer | null = null;
  const estaTimbrado = !!timbre?.uuid;
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
  const logoPath = path.resolve(backendRoot, '..', 'frontend', 'public', 'logos', 'logo-emphasys.jpg');
  const hasLogo = fs.existsSync(logoPath);
  const fontRegularPath = path.join(__dirname, '../../fonts/TrebuchetMS.ttf');
  const fontBoldPath = path.join(__dirname, '../../fonts/TrebuchetMS-Bold.ttf');

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'LETTER' });

  const fontsPath = path.join(process.cwd(), 'fonts');

  doc.registerFont('Trebuchet', path.join(fontsPath, 'TREBUC.ttf'));
  doc.registerFont('Trebuchet-Bold', path.join(fontsPath, 'TREBUCBD.ttf'));

    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Registrar fuentes Trebuchet si existen
    const fontRegular = fontRegularPath;
    const fontBold = fontBoldPath;
    if (fs.existsSync(fontRegular)) {
      doc.registerFont('Trebuchet', fontRegular);
    }
    if (fs.existsSync(fontBold)) {
      doc.registerFont('Trebuchet-Bold', fontBold);
    }
    doc.font('Trebuchet');

    const setFont = (bold = false, size = 10, color = '#111827') => {
      doc.font(bold ? 'Trebuchet-Bold' : 'Trebuchet');
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

    // Encabezado clásico CFDI
    const headerTop = doc.y;
    const headerHeight = 88;
    const headerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Logo y nombre empresa
    if (hasLogo) {
      doc.image(logoPath, doc.page.margins.left, headerTop, { width: 130, fit: [130, 72] });
    }

    // Caja gris a la derecha
    const boxW = 240;
    const boxH = headerHeight;
    const boxX = doc.page.width - doc.page.margins.right - boxW;
    const boxY = headerTop;
    doc.roundedRect(boxX, boxY, boxW, boxH, 6).fill('#eeeeee');
    doc.fillColor('#111827');

    const folio = `${documento?.serie ?? ''}${documento?.numero ? `-${documento.numero}` : ''}`.trim();
    const fechaCert = documento?.timbre?.fecha_timbrado ? formatDate(documento.timbre.fecha_timbrado) : 'N/D';
    const uuid = documento?.timbre?.uuid || 'N/D';
    const fechaEmision = formatDate(documento?.fecha_documento) || 'N/D';
    const tipoComp = tituloPorTipo(documento?.tipo_documento);

    const boxData: Array<[string, string]> = [
      ['Factura', tipoComp],
      ['UUID', uuid],
      ['Folio', folio || 'N/D'],
      ['Fecha certificación', fechaCert],
      ['Fecha elaboración', fechaEmision],
      ['Tipo comprobante', tipoComp],
    ];

    let cursorY = boxY + 10;
    boxData.forEach(([label, value], idx) => {
      setFont(idx === 0, idx === 0 ? 12 : 9, idx === 0 ? primaryColor : '#111827');
      doc.text(idx === 0 ? value : `${label}: ${value}`, boxX + 10, cursorY, { width: boxW - 20 });
      cursorY += idx === 0 ? 16 : 13;
    });

    doc.y = Math.max(headerTop + headerHeight, cursorY) + 10;

    // Barra de datos fiscales (Método, Forma, Uso)
    setFont(true, 10, textColor);
    const barraText = `Método Pago: ${mapMetodoPago(documento?.metodo_pago)}    Forma Pago: ${mapFormaPago(documento?.forma_pago)}    Uso CFDI: ${mapUsoCfdi(documento?.uso_cfdi)}`;
    doc.text(barraText, doc.page.margins.left, doc.y, { width: contentWidth });
    doc.moveTo(doc.page.margins.left, doc.y + 6).lineTo(doc.page.width - doc.page.margins.right, doc.y + 6).strokeColor('#cccccc').stroke();
    doc.moveDown(0.6);

    // Bloque Emisor / Receptor
    const colWidth = (contentWidth - 12) / 2;
    const bloqueY = doc.y;
    const drawLabelValue = (label: string, value: string | null | undefined, x: number, y: number) => {
      const textValue = value || 'N/D';
      setFont(false, 9, textColor);
      const h = doc.heightOfString(`${label}: ${textValue}`, { width: colWidth });
      doc.text(`${label}: ${textValue}`, x, y, { width: colWidth });
      return h + 4;
    };

    setFont(true, 11, primaryColor);
    doc.text('Emisor', doc.page.margins.left, bloqueY, { width: colWidth });
    doc.text('Receptor', doc.page.margins.left + colWidth + 12, bloqueY, { width: colWidth });

    let emisorY = bloqueY + 14;
  emisorY += drawLabelValue('Nombre', 'Emphasys', doc.page.margins.left, emisorY);
  emisorY += drawLabelValue('RFC', documento?.cliente_rfc || documento?.rfc_receptor || 'N/D', doc.page.margins.left, emisorY);
  emisorY += drawLabelValue('Régimen Fiscal', mapRegimen(documento?.regimen_fiscal_receptor), doc.page.margins.left, emisorY);

    let receptorY = bloqueY + 14;
    receptorY += drawLabelValue('Nombre', documento?.nombre_receptor || documento?.cliente_nombre, doc.page.margins.left + colWidth + 12, receptorY);
    receptorY += drawLabelValue('RFC', documento?.rfc_receptor || documento?.cliente_rfc, doc.page.margins.left + colWidth + 12, receptorY);
  receptorY += drawLabelValue('Domicilio Fiscal', documento?.codigo_postal_receptor, doc.page.margins.left + colWidth + 12, receptorY);
    receptorY += drawLabelValue('Régimen Fiscal', mapRegimen(documento?.regimen_fiscal_receptor), doc.page.margins.left + colWidth + 12, receptorY);

    doc.y = Math.max(emisorY, receptorY) + 6;
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.4);

    // Tabla de partidas (sin título "Partidas")
  const startX = doc.page.margins.left;
  const columnWidths = [90, 210, 60, 70, 65]; // total = contentWidth
  const headers = ['Producto', 'Descripción', 'Cantidad', 'Precio unitario', 'Importe'];

    const drawRow = (values: string[], isHeader = false) => {
      const rowHeight = isHeader ? 20 : 18;
      const y = doc.y;
      const rowWidth = columnWidths.reduce((acc, w) => acc + w, 0);

      if (isHeader) {
        doc.rect(startX, y, rowWidth, rowHeight).fill(primaryColor);
      } else {
        doc.moveTo(startX, y + rowHeight).lineTo(startX + rowWidth, y + rowHeight).strokeColor(borderGray).stroke();
      }

      doc.save();
      values.forEach((text, idx) => {
        const x = startX + columnWidths.slice(0, idx).reduce((acc, w) => acc + w, 0) + 6;
        doc
          .fontSize(isHeader ? 10 : 9)
          .font(isHeader ? 'Trebuchet-Bold' : 'Trebuchet')
          .fillColor(isHeader ? '#ffffff' : mutedText)
          .text(text, x, y + 6, { width: columnWidths[idx] - 12, align: idx >= 2 ? 'right' : 'left' });
      });
      doc.restore();
      doc.y = y + rowHeight;
    };

    drawRow(headers, true);

    partidas.forEach((p) => {
      const values = [
        p.producto_clave || '',
        p.descripcion_alterna || '',
        Number(p.cantidad ?? 0).toFixed(2),
        formatCurrency(Number(p.precio_unitario ?? 0)),
        formatCurrency(Number(p.subtotal_partida ?? 0)),
      ];
      drawRow(values, false);
    });

    doc.moveDown(0.8);

    // Totales (debajo de la tabla, alineados a la derecha)
  const totalLabelWidth = 90;
  const totalValueWidth = 100;
  const tableWidth = columnWidths.reduce((acc, w) => acc + w, 0);
  const tableEndX = startX + tableWidth;
  const totalsStartX = tableEndX - (totalLabelWidth + totalValueWidth) - 12;

    const totalRows: Array<[string, number | null | undefined]> = [
      ['Subtotal', documento?.subtotal],
      ['IVA', documento?.iva],
      ['Total', documento?.total],
    ];

    const totalsBoxHeight = totalRows.length * 18 + 16;
    doc
      .roundedRect(totalsStartX - 12, doc.y - 6, totalLabelWidth + totalValueWidth + 24, totalsBoxHeight)
      .strokeColor(borderGray)
      .lineWidth(1.6)
      .stroke();

    totalRows.forEach(([label, value], idx) => {
      const y = doc.y + idx * 18;
      setFont(label === 'Total', 10, textColor);
      doc
        .text(label === 'Total' ? 'TOTAL' : label, totalsStartX, y, { width: totalLabelWidth, align: 'right' })
        .text(formatCurrency(value), totalsStartX + totalLabelWidth, y, { width: totalValueWidth, align: 'right' });
    });

    doc.y += totalRows.length * 18 + 10;

    // Sección de timbrado CFDI
    const timbreHeightEstimate = estaTimbrado ? (qrBuffer ? 180 : 140) : 40;
    const availableSpace = doc.page.height - doc.page.margins.bottom - doc.y;
    if (availableSpace < timbreHeightEstimate) {
      doc.addPage();
    }

    doc.moveDown(1);
    drawSectionHeader('Datos fiscales CFDI');

    if (!estaTimbrado) {
      setFont(true, 11, textColor);
      doc.text('Estatus: Borrador');
    } else {
      const startYTimbrado = doc.y;
      const colLeftX = doc.page.margins.left;
      const colRightX = doc.page.width - doc.page.margins.right - 120;

      // QR a la derecha
      if (qrBuffer) {
        doc.image(qrBuffer, colRightX, startYTimbrado, { width: 110 });
      }

      const textoLargo: Array<[string, string, number]> = [
        ['Cadena original del complemento', timbre?.cadena_original || 'N/D', 7],
        ['Sello digital del CFDI', timbre?.sello_cfdi || 'N/D', 6],
        ['Sello del SAT', timbre?.sello_sat || 'N/D', 6],
      ];

      textoLargo.forEach(([label, value, size]) => {
        setFont(true, 8, textColor);
        doc.text(`${label}:`, colLeftX, doc.y, { width: contentWidth - 140 });
        setFont(false, size, mutedText);
        doc.text(value, {
          width: contentWidth - 140,
          lineGap: size <= 6 ? 1 : 0,
        });
        doc.moveDown(0.5);
      });

      setFont(true, 10, textColor);
      doc.text('Este documento es una representación impresa de un CFDI.', colLeftX, doc.y, {
        width: contentWidth - 140,
      });
    }

    // Observaciones
    if (documento?.observaciones) {
      doc.moveDown(1);
      drawSectionHeader('Observaciones');
      setFont(false, 10, mutedText);
      doc.text(documento.observaciones, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      });
    }

    doc.end();
  });
}
