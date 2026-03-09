import path from 'path';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import { generarImagenQR, DatosQrCfdi } from '../../utils/generarCadenaQR';
import { formatearFolioDocumento } from '../../utils/documentos';

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
  const headerHeight = 122;
    const headerWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Logo y nombre empresa
    if (hasLogo) {
      doc.image(logoPath, doc.page.margins.left, headerTop, { height: headerHeight * 0.7 });
    }

    // Caja gris a la derecha
    const boxW = 240;
    const boxH = headerHeight;
    const boxX = doc.page.width - doc.page.margins.right - boxW;
    const boxY = headerTop;
    doc.roundedRect(boxX, boxY, boxW, boxH, 6).fill('#eeeeee');
    doc.fillColor('#111827');

  const folio = formatearFolioDocumento(documento?.serie ?? '', Number(documento?.numero ?? 0));
  const fechaTimbrado = documento?.timbre?.fecha_timbrado ? formatDateTime(documento.timbre.fecha_timbrado) : 'N/D';
    const uuid = documento?.timbre?.uuid || 'N/D';
    const fechaEmision = formatDate(documento?.fecha_documento) || 'N/D';
    const tipoComp = tituloPorTipo(documento?.tipo_documento);

  // Título centrado en el recuadro gris
  const titleHeight = doc.heightOfString(tipoComp, { width: boxW });
  const titleY = boxY + 8; // encabezado alto, centrado solo horizontalmente
  setFont(true, 13, primaryColor);
  doc.text(tipoComp, boxX, titleY, { width: boxW, align: 'center' });

    const boxData: Array<[string, string]> = [
      ['Folio', folio || 'N/D'],
      ['Fecha elaboración', fechaEmision],
  ['Fecha timbrado', fechaTimbrado],
      ['Método Pago', mapMetodoPago(documento?.metodo_pago)],
      ['Forma Pago', mapFormaPago(documento?.forma_pago)],
      ['Uso CFDI', mapUsoCfdi(documento?.uso_cfdi)],
    ];

  let cursorY = titleY + titleHeight + 4; // datos inmediatamente debajo del encabezado dentro del recuadro (ligeramente más arriba)

    // UUID centrado, independiente de columnas
    setFont(true, 9, '#111827');
    doc.text(uuid, boxX, cursorY, { width: boxW, align: 'center' });
    cursorY += 12;

    // Columnas para etiquetas y valores
    const labelColWidth = 88;
    const gapCols = 8;
    const valueColWidth = boxW - 24 - labelColWidth - gapCols;
    const labelX = boxX + 12;
    const valueX = labelX + labelColWidth + gapCols;

    boxData.forEach(([label, value]) => {
      setFont(false, 9, '#111827');
      doc.text(label + ':', labelX, cursorY, { width: labelColWidth, align: 'right' });
      doc.text(value, valueX, cursorY, { width: valueColWidth, align: 'left' });
      cursorY += 12;
    });

  doc.y = Math.max(headerTop + headerHeight, cursorY) + 10;
  // Línea divisoria (ligeramente por encima de Emisor)
  const lineY = doc.y + 2; // bajar ~12 pts respecto al ajuste anterior
  doc.moveTo(doc.page.margins.left, lineY).lineTo(doc.page.width - doc.page.margins.right, lineY).strokeColor('#cccccc').stroke();
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
  doc.moveDown(0.4);

    // Tabla de partidas (sin título "Partidas")
  const startX = doc.page.margins.left;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnWidths = [
    90, // Producto (se mantiene)
    tableWidth - (90 + 60 + 70 + 65), // Descripción absorbe espacio extra
    60, // Cantidad
    70, // Precio unitario
    65, // Importe (alineado a margen derecho)
  ];
  const headers = ['Producto', 'Descripción', 'Cantidad', 'Precio unitario', 'Importe'];

    const drawRow = (values: string[], isHeader = false) => {
        const rowHeight = isHeader ? 20 : 17;
      const y = doc.y;
      const rowWidth = columnWidths.reduce((acc, w) => acc + w, 0);

      if (isHeader) {
        doc.rect(startX, y, rowWidth, rowHeight).fill(primaryColor);
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

  doc.moveDown(0.5);

    // Totales se renderizarán en el pie de página
    const totalRows: Array<[string, number | null | undefined]> = [
      ['Subtotal', documento?.subtotal],
      ['IVA', documento?.iva],
      ['Total', documento?.total],
    ];

    doc.moveDown(0.4);

    // Observaciones (antes de reservar espacio del pie)
    const qrWidth = 110;
    const textoWidthBase = qrBuffer ? contentWidth - qrWidth - 24 : contentWidth;

    const calcularAlturaPie = () => {
      if (!estaTimbrado) return 50; // margen de seguridad mínimo cuando no hay timbre

      const textoLargo: Array<[string, string, number]> = [
        ['Cadena original del complemento', timbre?.cadena_original || 'N/D', 7],
        ['Sello digital del CFDI', timbre?.sello_cfdi || 'N/D', 6],
        ['Sello del SAT', timbre?.sello_sat || 'N/D', 6],
      ];

      let hIzq = 0;
      const gapCols = 12;
      const totalsLabelWidth = 70;
      const totalsValueWidth = 90;
      const totalsWidth = totalsLabelWidth + totalsValueWidth;
      const textoWidth = contentWidth - totalsWidth - gapCols;

      textoLargo.forEach(([label, value, size]) => {
        setFont(true, 8, textColor);
        hIzq += doc.heightOfString(`${label}:`, { width: textoWidth });
        setFont(false, size, mutedText);
        hIzq += doc.heightOfString(value, { width: textoWidth, lineGap: size <= 6 ? 0.2 : 0 });
        hIzq += 4; // espaciado equivalente a moveDown corto
      });

      // Altura del bloque de totales (columna derecha, sin recuadro)
  const rowHeightCompact = 12; // espaciado compacto
  const totalsHeight = totalRows.length * rowHeightCompact;

  // QR debajo de totales (ligeramente más pequeño y con gap)
  const qrGap = 10;
  const qrHeight = qrBuffer ? Math.min(qrWidth, 85) : 0;

      // Leyenda final
      setFont(true, 10, textColor);
      const alturaLeyenda = doc.heightOfString('** Este documento es una representación impresa de un CFDI. **', {
        width: contentWidth,
      });

      const padding = 10; // padding superior/inferior
      const topOffset = 8; // desplazamiento usado al comenzar el footer (doc.y = footerY + 8)

      const alturaTotalBloque = Math.max(hIzq, totalsHeight + qrGap + qrHeight) + alturaLeyenda + 12;

      return alturaTotalBloque + padding + topOffset;
    };

  const footerHeight = calcularAlturaPie();
  const footerBottomMargin = 22; // margen inferior ~20-25 px para garantizar que no se corte
  const footerTop = doc.page.height - footerBottomMargin - footerHeight;

    if (documento?.observaciones) {
      const obsWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const obsHeight = doc.heightOfString(documento.observaciones, { width: obsWidth }) + 28;
      if (doc.y + obsHeight > footerTop - 6) {
        doc.addPage();
      }
      doc.moveDown(0.6);
      drawSectionHeader('Observaciones');
      setFont(false, 10, mutedText);
      doc.text(documento.observaciones, { width: obsWidth });
      doc.moveDown(0.6);
    }

    // Pie fijo timbrado CFDI anclado al borde inferior
    if (doc.y > footerTop - 8) {
      doc.addPage();
    }

  const footerY = doc.page.height - footerBottomMargin - footerHeight;
    doc
      .moveTo(doc.page.margins.left, footerY)
      .lineTo(doc.page.width - doc.page.margins.right, footerY)
      .strokeColor('#cccccc')
      .stroke();

  doc.y = footerY + 8;

    if (!estaTimbrado) {
      setFont(true, 11, textColor);
      doc.text('Estatus: Borrador');
    } else {
      const startYTimbrado = doc.y;
      const gapCols = 12;
      const totalsLabelWidth = 70;
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
          lineGap: size <= 6 ? 0.2 : 0,
        });
        if (label === 'Sello digital del CFDI') {
          selloCfdiEndY = doc.y;
        }
        doc.moveDown(0.35);
      });

      // Columna derecha: Subtotal / IVA / TOTAL compactos
      let totY = startYTimbrado;
      const rowHeightCompact = 12;
      totalRows.forEach(([label, value]) => {
        const isTotal = label === 'Total';
        setFont(isTotal, 9, textColor); // mismo tamaño para TOTAL, mantiene negritas

        const importeX = startX + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3];
        const gapLabelValor = 8; // acerca la etiqueta al monto
        const labelRight = importeX - gapLabelValor;
        const labelX = labelRight - totalsLabelWidth;

        doc.text(label.toUpperCase(), labelX, totY, { width: totalsLabelWidth, align: 'right' });
        doc.text(formatCurrency(value), importeX, totY, {
          width: columnWidths[4],
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

      // Leyenda final centrada en todo el ancho disponible del pie
  const leyendaY = Math.max(doc.y, totY + 4, selloCfdiEndY + 2); // reduce gap para que no salte de página
      doc.y = leyendaY;
      setFont(true, 10, textColor);
      doc.text('** Este documento es una representación impresa de un CFDI. **', colLeftX, doc.y, {
        width: contentWidth,
        align: 'center',
      });
    }

    doc.end();
  });
}
